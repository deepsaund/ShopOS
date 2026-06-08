import { NextRequest } from "next/server";
import prisma from "../lib/prisma";

// Import route handlers
import { POST as createBrand } from "../app/api/shoes/brands/route";
import { POST as createProduct, GET as listProducts } from "../app/api/shoes/products/route";
import { GET as getProductDetail } from "../app/api/shoes/products/[id]/route";
import { POST as recordPurchase } from "../app/api/shoes/purchase/route";
import { GET as listLowStock } from "../app/api/shoes/stock/low/route";
import { POST as createSale, GET as listSales } from "../app/api/shoes/sales/route";
import { GET as getSaleDetail } from "../app/api/shoes/sales/[id]/route";
import { POST as createCustomer, GET as listCustomers } from "../app/api/shoes/customers/route";
import { GET as getCustomerDetail } from "../app/api/shoes/customers/[id]/route";
import { POST as recordUdhaarPayment } from "../app/api/shoes/customers/[id]/payment/route";
import { POST as createEmployee, GET as listEmployees } from "../app/api/shoes/employees/route";
import { GET as getEmployeeDetail, PUT as updateEmployee, DELETE as deleteEmployee } from "../app/api/shoes/employees/[id]/route";
import { POST as recordSalary, GET as getSalaryHistory } from "../app/api/shoes/employees/[id]/salary/route";
import { GET as getDashboard } from "../app/api/shoes/dashboard/route";

const tenantId = "test-tenant-shoes";

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
  console.log("=== STARTING SHOE SHOP CRM VERIFICATION TEST SUITE ===");

  try {
    // 0. Clean database
    console.log("\n0. Cleaning database...");
    await prisma.salaryRecord.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.udhaarLedger.deleteMany({});
    await prisma.shoeSaleItem.deleteMany({});
    await prisma.shoeSale.deleteMany({});
    await prisma.shoeCustomer.deleteMany({});
    await prisma.shoePurchaseItem.deleteMany({});
    await prisma.shoePurchase.deleteMany({});
    await prisma.shoeSKU.deleteMany({});
    await prisma.shoeProduct.deleteMany({});
    await prisma.shoeBrand.deleteMany({});
    await prisma.supplier.deleteMany({ where: { tenantId } });
    console.log("Database cleared.");

    // Create a supplier directly
    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: "Footwear Distributors Inc",
        phone: "555-0199",
        address: "789 Warehouse Blvd",
        gstNumber: "GST-SHOE-77A",
      },
    });
    console.log(`Created supplier: ${supplier.name} (${supplier.id})`);

    // 1. Create Shoe Brand
    console.log("\n1. Testing POST /api/shoes/brands...");
    const brandPayload = {
      name: "Nike",
      logoUrl: "https://logo.com/nike.png",
    };
    const brandRes = await createBrand(mockRequest("http://localhost/api/shoes/brands", "POST", brandPayload));
    const brand = await brandRes.json();
    console.log("Status:", brandRes.status);
    console.log("Created Brand:", brand);
    if (brandRes.status !== 201) throw new Error("Brand creation failed");

    // 2. Create Shoe Product with SKUs
    console.log("\n2. Testing POST /api/shoes/products...");
    const productPayload = {
      brandId: brand.id,
      modelName: "Air Max 90",
      category: "SPORTS",
      description: "Classic sports style shoe",
      images: ["https://nike.com/airmax90.jpg"],
      skus: [
        {
          size: "8",
          color: "Black",
          quantityInStock: 2, // low stock initially (threshold 3)
          mrp: 120.0,
          sellingPrice: 110.0,
          costPrice: 60.0,
          lowStockThreshold: 3,
        },
        {
          size: "9",
          color: "Black",
          quantityInStock: 5,
          mrp: 120.0,
          sellingPrice: 110.0,
          costPrice: 60.0,
          lowStockThreshold: 3,
        }
      ]
    };
    const prodRes = await createProduct(mockRequest("http://localhost/api/shoes/products", "POST", productPayload));
    const product = await prodRes.json();
    console.log("Status:", prodRes.status);
    console.log("Created Product:", product);
    if (prodRes.status !== 201) throw new Error("Product creation failed");

    // 3. List Products
    console.log("\n3. Testing GET /api/shoes/products...");
    const listProdsRes = await listProducts(mockRequest("http://localhost/api/shoes/products?category=SPORTS", "GET"));
    const prodList = await listProdsRes.json();
    console.log("List response:", prodList);
    if (prodList.total !== 1 || prodList.data[0].totalStock !== 7) throw new Error("Product listing stock summary failed");

    // 4. Product Detail
    console.log("\n4. Testing GET /api/shoes/products/[id]...");
    const prodDetailRes = await getProductDetail(
      mockRequest(`http://localhost/api/shoes/products/${product.id}`, "GET"),
      { params: { id: product.id } }
    );
    const prodDetail = await prodDetailRes.json();
    console.log("Detail response skus count:", prodDetail.skus.length);
    if (prodDetail.skus.length !== 2) throw new Error("Product details fetch failed");

    // 5. Test Low Stock API
    console.log("\n5. Testing GET /api/shoes/stock/low...");
    const lowStockRes = await listLowStock(mockRequest("http://localhost/api/shoes/stock/low", "GET"));
    const lowStockList = await lowStockRes.json();
    console.log("Low Stock SKUs:", lowStockList);
    // Size 8 should be low stock (2 <= 3), Size 9 is not (5 > 3)
    if (lowStockList.length !== 1 || lowStockList[0].size !== "8") throw new Error("Low stock SKU listing failed");

    // 6. Record Stock Purchase (increases SKU stock)
    console.log("\n6. Testing POST /api/shoes/purchase...");
    const sku8Id = product.skus.find((s: any) => s.size === "8").id;
    const sku9Id = product.skus.find((s: any) => s.size === "9").id;

    const purchasePayload = {
      supplierId: supplier.id,
      invoiceNumber: "INV-99283",
      purchaseDate: new Date().toISOString(),
      totalAmount: 180.0,
      notes: "Received new batch",
      items: [
        {
          skuId: sku8Id,
          quantity: 3, // quantity 2 -> 5
          costPricePerUnit: 60.0
        }
      ]
    };
    const purchaseRes = await recordPurchase(mockRequest("http://localhost/api/shoes/purchase", "POST", purchasePayload));
    const purchase = await purchaseRes.json();
    console.log("Purchase Recorded:", purchase);
    if (purchaseRes.status !== 201) throw new Error("Purchase creation failed");

    // Check that SKU 8 stock is incremented
    const updatedSku8 = await prisma.shoeSKU.findUnique({ where: { id: sku8Id } });
    console.log("Updated Sku 8 quantity (should be 5):", updatedSku8?.quantityInStock);
    if (updatedSku8?.quantityInStock !== 5) throw new Error("Purchase failed to increment SKU stock");

    // 7. Create Customer
    console.log("\n7. Testing POST /api/shoes/customers...");
    const customerPayload = {
      name: "Alice Smith",
      phone: "9876543211",
      address: "101 Maple Drive",
    };
    const custRes = await createCustomer(mockRequest("http://localhost/api/shoes/customers", "POST", customerPayload));
    const customer = await custRes.json();
    console.log("Created Customer:", customer);
    if (custRes.status !== 201) throw new Error("Customer creation failed");

    // 8. Record Sale (decrements stock, handles Udhaar)
    console.log("\n8. Testing POST /api/shoes/sales (with Udhaar)...");
    const salePayload = {
      customerId: customer.id,
      saleDate: new Date().toISOString(),
      totalMrp: 240.0,
      discount: 20.0,
      totalAmount: 220.0,
      paymentMode: "UDHAAR",
      amountPaid: 0.0,
      amountPending: 220.0,
      servedBy: "Manager Jane",
      notes: "Customer promised to pay next week",
      items: [
        {
          skuId: sku8Id,
          quantity: 2, // stock 5 -> 3
          pricePerUnit: 110.0,
          discountPerUnit: 10.0
        }
      ]
    };
    const saleRes = await createSale(mockRequest("http://localhost/api/shoes/sales", "POST", salePayload));
    const saleResult = await saleRes.json();
    console.log("Sale recorded response:", saleResult);
    if (saleRes.status !== 201) throw new Error("Sale creation failed");
    // Profit = (110 - 60) * 2 = 100
    if (saleResult.profit !== 100) throw new Error(`Incorrect profit calculation, expected 100 but got ${saleResult.profit}`);

    // Verify stock decrement
    const finalSku8 = await prisma.shoeSKU.findUnique({ where: { id: sku8Id } });
    console.log("Stock after sale (should be 3):", finalSku8?.quantityInStock);
    if (finalSku8?.quantityInStock !== 3) throw new Error("Stock decrement failed");

    // Verify Udhaar ledger + Customer balance
    const updatedCustomer = await prisma.shoeCustomer.findUnique({ where: { id: customer.id } });
    console.log("Customer Udhaar Balance (should be 220):", Number(updatedCustomer?.totalUdhaarBalance));
    if (Number(updatedCustomer?.totalUdhaarBalance) !== 220) throw new Error("Customer udhaar balance not incremented");

    const ledgerEntry = await prisma.udhaarLedger.findFirst({
      where: { customerId: customer.id, transactionType: "CREDIT" },
    });
    console.log("Ledger entry (CREDIT):", ledgerEntry);
    if (!ledgerEntry || Number(ledgerEntry.amount) !== 220) throw new Error("Ledger credit entry not created");

    // Try a sale that exceeds stock limit
    console.log("\nTesting POST /api/shoes/sales edge case (exceeding stock)...");
    const invalidSalePayload = {
      customerId: customer.id,
      saleDate: new Date().toISOString(),
      totalMrp: 550.0,
      discount: 0.0,
      totalAmount: 550.0,
      paymentMode: "CASH",
      amountPaid: 550.0,
      amountPending: 0.0,
      servedBy: "Manager Jane",
      items: [
        {
          skuId: sku8Id,
          quantity: 10, // exceeds available stock 3
          pricePerUnit: 110.0,
          discountPerUnit: 0.0
        }
      ]
    };
    const invalidSaleRes = await createSale(mockRequest("http://localhost/api/shoes/sales", "POST", invalidSalePayload));
    console.log("Status (should be 400):", invalidSaleRes.status);
    const invalidSaleJson = await invalidSaleRes.json();
    console.log("Error response:", invalidSaleJson);
    if (invalidSaleRes.status !== 400 || invalidSaleJson.code !== "INSUFFICIENT_STOCK") {
      throw new Error("Sale exceeding stock limit was not rejected correctly");
    }

    // 9. Repay Udhaar
    console.log("\n9. Testing POST /api/shoes/customers/[id]/payment...");
    const repaymentPayload = {
      amount: 100.0,
      notes: "Part payment by cash",
    };
    const repayRes = await recordUdhaarPayment(
      mockRequest(`http://localhost/api/shoes/customers/${customer.id}/payment`, "POST", repaymentPayload),
      { params: { id: customer.id } }
    );
    const repayResult = await repayRes.json();
    console.log("Repayment Result (Customer total udhaar balance should be 120):", Number(repayResult.totalUdhaarBalance));
    if (Number(repayResult.totalUdhaarBalance) !== 120) throw new Error("Udhaar repayment failed to update customer balance");

    // 10. Customer detail with ledger
    console.log("\n10. Testing GET /api/shoes/customers/[id]...");
    const custDetailRes = await getCustomerDetail(
      mockRequest(`http://localhost/api/shoes/customers/${customer.id}`, "GET"),
      { params: { id: customer.id } }
    );
    const custDetail = await custDetailRes.json();
    console.log("Customer detail records: sales count:", custDetail.sales.length, "ledger count:", custDetail.udhaarLedgers.length);
    if (custDetail.udhaarLedgers.length !== 2) throw new Error("Ledger records count incorrect");

    // 11. Employee and Salary CRUD
    console.log("\n11. Testing Employee CRUD...");
    const employeePayload = {
      name: "David Staff",
      phone: "555-2233",
      role: "SALESPERSON",
      salaryAmount: 2500.0,
      joinDate: new Date().toISOString(),
    };
    const empCreateRes = await createEmployee(mockRequest("http://localhost/api/shoes/employees", "POST", employeePayload));
    const employee = await empCreateRes.json();
    console.log("Created Employee:", employee);
    if (empCreateRes.status !== 201) throw new Error("Employee creation failed");

    // Pay salary
    const salaryPayload = {
      month: "2026-06",
      amountPaid: 2500.0,
      paymentDate: new Date().toISOString(),
      paymentMode: "BANK",
      notes: "June Salary",
    };
    const salaryRes = await recordSalary(
      mockRequest(`http://localhost/api/shoes/employees/${employee.id}/salary`, "POST", salaryPayload),
      { params: { id: employee.id } }
    );
    const salary = await salaryRes.json();
    console.log("Recorded Salary:", salary);
    if (salaryRes.status !== 201) throw new Error("Salary logging failed");

    // Salary history
    const salaryHistRes = await getSalaryHistory(
      mockRequest(`http://localhost/api/shoes/employees/${employee.id}/salary`, "GET"),
      { params: { id: employee.id } }
    );
    const salaryHistory = await salaryHistRes.json();
    console.log("Salary History records count:", salaryHistory.length);
    if (salaryHistory.length !== 1) throw new Error("Salary history retrieval failed");

    // 12. Fetch Dashboard
    console.log("\n12. Testing GET /api/shoes/dashboard...");
    const dashRes = await getDashboard(mockRequest("http://localhost/api/shoes/dashboard", "GET"));
    const dashboard = await dashRes.json();
    console.log("Dashboard KPIs:", dashboard);
    if (dashboard.todaySalesTotal !== 220 || dashboard.todayUnitsSold !== 2) throw new Error("Dashboard sales/units aggregation invalid");
    if (dashboard.topSellingSizesToday[0].size !== "8" || dashboard.topSellingSizesToday[0].quantity !== 2) {
      throw new Error("Dashboard top selling sizes calculation invalid");
    }

    console.log("\n=== ALL SHOE SHOP CRM TESTS COMPLETED SUCCESSFULLY ===");
  } catch (error: any) {
    console.error("\n❌ VERIFICATION TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
