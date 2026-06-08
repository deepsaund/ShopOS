import { NextRequest } from "next/server";
import prisma from "../lib/prisma";

// Import route handlers
import { POST as createCustomer, GET as listCustomers } from "../app/api/tailor/customers/route";
import { GET as getCustomerDetail, PUT as updateCustomer } from "../app/api/tailor/customers/[id]/route";
import { POST as createStock, GET as listStock } from "../app/api/tailor/stock/route";
import { POST as createOrder, GET as listOrders } from "../app/api/tailor/orders/route";
import { PUT as updateOrderStatus } from "../app/api/tailor/orders/[id]/status/route";
import { POST as recordPayment } from "../app/api/tailor/orders/[id]/payment/route";
import { GET as getDashboard } from "../app/api/tailor/dashboard/route";

const tenantId = "test-tenant-1";

function mockRequest(url: string, method: string, body?: any): NextRequest {
  const reqInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
    },
  };
  if (body) {
    reqInit.body = JSON.stringify(body);
  }
  return new NextRequest(url, reqInit as any);
}

async function runTests() {
  console.log("=== STARTING CRM VERIFICATION TEST SUITE ===");

  try {
    // 0. Clean database
    console.log("\n0. Cleaning database...");
    await prisma.payment.deleteMany({});
    await prisma.tailorOrderItem.deleteMany({});
    await prisma.tailorOrder.deleteMany({});
    await prisma.stockTransaction.deleteMany({});
    await prisma.clothStock.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.tailorCustomer.deleteMany({});
    console.log("Database cleared.");

    // Create a supplier directly (since there's no Supplier API endpoint requested)
    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: "Supreme Fabrics Ltd",
        phone: "+1999888777",
        address: "123 Fabric Lane, Textile Town",
        gstNumber: "GST-99283-A",
      },
    });
    console.log(`Created supplier: ${supplier.name} (${supplier.id})`);

    // 1. Create customer
    console.log("\n1. Testing POST /api/tailor/customers...");
    const customerPayload = {
      name: "John Doe",
      phone: "9876543210",
      email: "john@example.com",
      address: "456 Oak Avenue",
      measurements: {
        chest: 40,
        waist: 34,
        hips: 41,
        shoulder: 18,
        sleeve_length: 25,
        shirt_length: 30,
        pant_length: 42,
        pant_waist: 34,
        pant_thigh: 24,
        notes: "Prefers relaxed fit for shirts.",
      },
    };

    const createCustReq = mockRequest("http://localhost/api/tailor/customers", "POST", customerPayload);
    const createCustRes = await createCustomer(createCustReq);
    console.log("Status code:", createCustRes.status);
    const customer = await createCustRes.json();
    console.log("Created customer:", customer);

    if (createCustRes.status !== 201) throw new Error("Customer creation failed");

    // 2. List customers
    console.log("\n2. Testing GET /api/tailor/customers...");
    const listCustReq = mockRequest("http://localhost/api/tailor/customers?page=1&limit=10&search=John", "GET");
    const listCustRes = await listCustomers(listCustReq);
    const customersList = await listCustRes.json();
    console.log("List customers response:", customersList);
    if (customersList.total !== 1) throw new Error("Customer list search failed");

    // 3. Get customer detail
    console.log("\n3. Testing GET /api/tailor/customers/[id]...");
    const detailReq = mockRequest(`http://localhost/api/tailor/customers/${customer.id}`, "GET");
    const detailRes = await getCustomerDetail(detailReq, { params: { id: customer.id } });
    const customerDetail = await detailRes.json();
    console.log("Customer detail with orders:", customerDetail);
    if (!customerDetail.id) throw new Error("Retrieve customer details failed");

    // 4. Update measurements
    console.log("\n4. Testing PUT /api/tailor/customers/[id]...");
    const updatePayload = {
      measurements: {
        chest: 41, // updated chest size
        notes: "Prefers relaxed fit for shirts. Hemi-tight collar.",
      },
    };
    const updateReq = mockRequest(`http://localhost/api/tailor/customers/${customer.id}`, "PUT", updatePayload);
    const updateRes = await updateCustomer(updateReq, { params: { id: customer.id } });
    const updatedCustomer = await updateRes.json();
    console.log("Updated measurements:", updatedCustomer.measurements);
    if (updatedCustomer.measurements.chest !== 41) throw new Error("Customer measurements update failed");

    // 5. Add stock
    console.log("\n5. Testing POST /api/tailor/stock...");
    const stockPayload = {
      supplierId: supplier.id,
      fabricName: "Italian Cotton Navy Blue",
      fabricType: "Cotton",
      color: "Navy Blue",
      pattern: "Plain",
      quantityMeters: 50.0,
      ratePerMeter: 12.5,
      lowStockThresholdMeters: 10.0,
    };
    const createStockReq = mockRequest("http://localhost/api/tailor/stock", "POST", stockPayload);
    const createStockRes = await createStock(createStockReq);
    const stockItem = await createStockRes.json();
    console.log("Added stock item:", stockItem);
    if (createStockRes.status !== 201) throw new Error("Stock addition failed");

    // Verify StockTransaction IN was created
    const stockTxIn = await prisma.stockTransaction.findFirst({
      where: { clothStockId: stockItem.id, transactionType: "IN" },
    });
    console.log("Auto-created StockTransaction (IN):", stockTxIn);
    if (!stockTxIn || Number(stockTxIn.quantityMeters) !== 50) throw new Error("StockTransaction (IN) verification failed");

    // 6. List stock
    console.log("\n6. Testing GET /api/tailor/stock...");
    const listStockReq = mockRequest("http://localhost/api/tailor/stock?page=1&limit=10", "GET");
    const listStockRes = await listStock(listStockReq);
    const stockList = await listStockRes.json();
    console.log("Stock list response with prediction:", stockList.data[0]);
    if (stockList.data[0].isLowStock !== false) throw new Error("Low stock calculation failed");

    // 7. Place Order
    console.log("\n7. Testing POST /api/tailor/orders...");
    const orderPayload = {
      customerId: customer.id,
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // due in 5 days
      totalAmount: 150.0,
      advancePaid: 50.0,
      items: [
        {
          garmentType: "SHIRT",
          clothStockId: stockItem.id,
          fabricMetersUsed: 2.5,
          itemPrice: 75.0,
          customNotes: "Long sleeve, mandarin collar.",
        },
        {
          garmentType: "PANT",
          clothStockId: stockItem.id,
          fabricMetersUsed: 1.5,
          itemPrice: 75.0,
          customNotes: "Slim fit.",
        },
      ],
    };

    const createOrderReq = mockRequest("http://localhost/api/tailor/orders", "POST", orderPayload);
    const createOrderRes = await createOrder(createOrderReq);
    const order = await createOrderRes.json();
    console.log("Created order details:", order);
    if (createOrderRes.status !== 201) throw new Error("Order creation failed");

    // Verify order fields
    console.log("Generated order number:", order.orderNumber);
    if (!order.orderNumber.startsWith("ORD-")) throw new Error("Order number format invalid");
    if (order.balanceDue !== 100) throw new Error("Order balance due calculation invalid");

    // Verify stock deduction
    const updatedStock = await prisma.clothStock.findUnique({ where: { id: stockItem.id } });
    console.log("Stock quantity after deduction (original 50 - 4 used):", Number(updatedStock?.quantityMeters));
    if (Number(updatedStock?.quantityMeters) !== 46) throw new Error("Inventory deduction failed");

    // Verify StockTransaction OUT
    const stockTxOut = await prisma.stockTransaction.findFirst({
      where: { clothStockId: stockItem.id, transactionType: "OUT", referenceId: order.id },
    });
    console.log("Auto-created StockTransaction (OUT):", stockTxOut);
    if (!stockTxOut || Number(stockTxOut.quantityMeters) !== 2.5) throw new Error("StockTransaction (OUT) verification failed");

    // Verify advance payment log
    const advPayment = await prisma.payment.findFirst({
      where: { orderId: order.id, paymentType: "ADVANCE" },
    });
    console.log("Advance payment record:", advPayment);
    if (!advPayment || Number(advPayment.amount) !== 50) throw new Error("Advance payment logging failed");

    // 8. List Orders
    console.log("\n8. Testing GET /api/tailor/orders...");
    const listOrdersReq = mockRequest("http://localhost/api/tailor/orders?page=1&limit=10&status=TAKEN", "GET");
    const listOrdersRes = await listOrders(listOrdersReq);
    const ordersList = await listOrdersRes.json();
    console.log("List orders response:", ordersList.data[0]);
    if (ordersList.total !== 1) throw new Error("List orders failed");

    // 9. Update order status
    console.log("\n9. Testing PUT /api/tailor/orders/[id]/status...");
    const updateStatusPayload = { status: "CUTTING" };
    const statusReq = mockRequest(`http://localhost/api/tailor/orders/${order.id}/status`, "PUT", updateStatusPayload);
    const statusRes = await updateOrderStatus(statusReq, { params: { id: order.id } });
    const statusUpdatedOrder = await statusRes.json();
    console.log("Updated order status details:", statusUpdatedOrder.status);
    if (statusUpdatedOrder.status !== "CUTTING") throw new Error("Order status update failed");

    // 10. Record balance payment
    console.log("\n10. Testing POST /api/tailor/orders/[id]/payment...");
    const paymentPayload = {
      amount: 100.0,
      paymentMode: "UPI",
      paymentType: "BALANCE",
      notes: "Settled on trial success.",
    };
    const paymentReq = mockRequest(`http://localhost/api/tailor/orders/${order.id}/payment`, "POST", paymentPayload);
    const paymentRes = await recordPayment(paymentReq, { params: { id: order.id } });
    const paymentResult = await paymentRes.json();
    console.log("Recorded payment order details (balanceDue should be 0):", paymentResult);
    if (paymentResult.balanceDue !== 0) throw new Error("Payment record failed to update balance due");

    // 11. Fetch Dashboard
    console.log("\n11. Testing GET /api/tailor/dashboard...");
    const dashReq = mockRequest("http://localhost/api/tailor/dashboard", "GET");
    const dashRes = await getDashboard(dashReq);
    const dashboard = await dashRes.json();
    console.log("Dashboard KPIs:", dashboard);
    if (dashboard.totalOrdersByStatus.CUTTING !== 1) throw new Error("Dashboard orders count aggregation failed");

    // Check prediction in stock list now that order data exists
    console.log("\n12. Verifying Stock Predictions in GET /api/tailor/stock...");
    const predictionStockRes = await listStock(listStockReq);
    const predictionStock = await predictionStockRes.json();
    console.log("Stock Prediction Detail:", predictionStock.data[0].prediction);
    // Average meters per order: total used (4.0 meters) / 1 order = 4.0 avg meters per order.
    // Stock remaining: 46 meters.
    // Estimated orders remaining: 46 / 4 = 11.
    if (predictionStock.data[0].prediction.estimatedOrdersRemaining !== 11) {
      throw new Error("Stock prediction calculation incorrect");
    }

    console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
  } catch (error: any) {
    console.error("\n❌ VERIFICATION TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
