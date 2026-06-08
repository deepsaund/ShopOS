import { NextRequest } from "next/server";
import prisma from "../lib/prisma";

// Import route handlers
import { POST as createCustomer, GET as listCustomers } from "../app/api/repair/customers/route";
import { GET as getCustomerDetail, PUT as updateCustomer, DELETE as deleteCustomer } from "../app/api/repair/customers/[id]/route";
import { POST as createPart, GET as listParts } from "../app/api/repair/parts/route";
import { PUT as updatePart, DELETE as deletePart } from "../app/api/repair/parts/[id]/route";
import { GET as listLowStock } from "../app/api/repair/parts/low-stock/route";
import { POST as createJob, GET as listJobs } from "../app/api/repair/jobs/route";
import { GET as getJobDetail, PUT as updateJob } from "../app/api/repair/jobs/[id]/route";
import { POST as addJobPart } from "../app/api/repair/jobs/[id]/parts/route";
import { POST as recordJobPayment } from "../app/api/repair/jobs/[id]/payment/route";
import { GET as getDashboard } from "../app/api/repair/dashboard/route";

const tenantId = "test-tenant-repair";

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
  console.log("=== STARTING REPAIR CRM VERIFICATION TEST SUITE ===");

  try {
    // 0. Clean database
    console.log("\n0. Cleaning database...");
    await prisma.repairPayment.deleteMany({});
    await prisma.jobCardPart.deleteMany({});
    await prisma.jobCard.deleteMany({});
    await prisma.repairPart.deleteMany({});
    await prisma.repairCustomer.deleteMany({});
    console.log("Database cleared.");

    // 1. Create Repair Customer
    console.log("\n1. Testing POST /api/repair/customers...");
    const customerPayload = {
      name: "Rahul Sharma",
      phone: "9876543210",
      email: "rahul.sharma@example.com",
      address: "Flat 402, Green Glen Layout, Bangalore",
    };
    const custRes = await createCustomer(mockRequest("http://localhost/api/repair/customers", "POST", customerPayload));
    const customer = await custRes.json();
    console.log("Status:", custRes.status);
    console.log("Created Customer:", customer);
    if (custRes.status !== 201) throw new Error("Customer creation failed");

    // 2. List Customers
    console.log("\n2. Testing GET /api/repair/customers...");
    const listCustsRes = await listCustomers(mockRequest("http://localhost/api/repair/customers?search=Rahul", "GET"));
    const custList = await listCustsRes.json();
    console.log("List response count:", custList.total);
    if (custList.total !== 1) throw new Error("Customer search/listing failed");

    // 3. Update Customer
    console.log("\n3. Testing PUT /api/repair/customers/[id]...");
    const updatedPayload = {
      name: "Rahul Sharma (Gold)",
      phone: "9876543210",
      email: "rahul.gold@example.com",
      address: "Flat 402, Green Glen Layout, Bangalore",
    };
    const updateRes = await updateCustomer(
      mockRequest(`http://localhost/api/repair/customers/${customer.id}`, "PUT", updatedPayload),
      { params: { id: customer.id } }
    );
    const updatedCustomer = await updateRes.json();
    console.log("Updated Customer Name:", updatedCustomer.name);
    if (updatedCustomer.name !== "Rahul Sharma (Gold)") throw new Error("Customer update failed");

    // 4. Create Parts Inventory
    console.log("\n4. Testing POST /api/repair/parts...");
    const part1Payload = {
      partName: "iPhone 13 OLED Screen Replacement",
      partNumber: "PART-IP13-SCR",
      compatibleDevices: "iPhone 13, iPhone 13 Pro",
      quantityInStock: 8,
      costPrice: 2500,
      sellingPrice: 4000,
      lowStockThreshold: 5,
    };
    const part1Res = await createPart(mockRequest("http://localhost/api/repair/parts", "POST", part1Payload));
    const part1 = await part1Res.json();
    console.log("Part 1 Created:", part1);
    if (part1Res.status !== 201) throw new Error("Part 1 creation failed");

    const part2Payload = {
      partName: "Type-C Charging Port Connector",
      partNumber: "PART-TYPC-CON",
      compatibleDevices: "Samsung S21, Oneplus 9, Pixel 6",
      quantityInStock: 3, // Initial stock is below threshold (5) -> triggers alert
      costPrice: 80,
      sellingPrice: 250,
      lowStockThreshold: 5,
    };
    const part2Res = await createPart(mockRequest("http://localhost/api/repair/parts", "POST", part2Payload));
    const part2 = await part2Res.json();
    console.log("Part 2 Created (Low Stock):", part2);
    if (part2Res.status !== 201) throw new Error("Part 2 creation failed");

    // 5. Test Low Stock Alerts
    console.log("\n5. Testing GET /api/repair/parts/low-stock...");
    const lowStockRes = await listLowStock(mockRequest("http://localhost/api/repair/parts/low-stock", "GET"));
    const lowStock = await lowStockRes.json();
    console.log("Low Stock Items list:", lowStock);
    if (lowStock.length !== 1 || lowStock[0].partNumber !== "PART-TYPC-CON") {
      throw new Error("Low stock alert calculation failed");
    }

    // 6. Create Job Card
    console.log("\n6. Testing POST /api/repair/jobs...");
    const jobPayload = {
      customerId: customer.id,
      deviceType: "MOBILE",
      deviceBrand: "Apple",
      deviceModel: "iPhone 13",
      reportedIssue: "Screen cracked after drop. Battery draining fast.",
      estimatedCost: 1500, // labor / basic service charge
      advanceTaken: 500,
      advancePaymentMode: "UPI",
      warrantyDays: 90,
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      assignedToStaff: "Amit (Senior Tech)",
      deviceConditionOnReceipt: "Screws missing at bottom, scratches on body, screen cracked.",
    };
    const jobRes = await createJob(mockRequest("http://localhost/api/repair/jobs", "POST", jobPayload));
    const job = await jobRes.json();
    console.log("Status:", jobRes.status);
    console.log("Job Card Created:", job);
    if (jobRes.status !== 201) throw new Error("Job card creation failed");
    if (!job.jobNumber.startsWith("JOB-")) throw new Error("Job number sequence prefix is incorrect");
    if (job.balanceDue !== 1000) throw new Error(`Balance due calculation incorrect: expected 1000, got ${job.balanceDue}`);

    // Verify payment transaction was created
    const payments = await prisma.repairPayment.findMany({ where: { jobId: job.id } });
    console.log("Logged Payments for Job Card:", payments);
    if (payments.length !== 1 || payments[0].paymentType !== "ADVANCE" || Number(payments[0].amount) !== 500) {
      throw new Error("Advance payment record not created properly in database");
    }

    // 7. List Job Cards
    console.log("\n7. Testing GET /api/repair/jobs (with filter)...");
    const listJobsRes = await listJobs(mockRequest("http://localhost/api/repair/jobs?status=RECEIVED", "GET"));
    const jobsList = await listJobsRes.json();
    console.log("List response count:", jobsList.total);
    if (jobsList.total !== 1) throw new Error("Job cards listing / filtering failed");

    // 8. Update Diagnosis, Status, Costs
    console.log("\n8. Testing PUT /api/repair/jobs/[id]...");
    const updateJobPayload = {
      status: "REPAIRING",
      diagnosedIssue: "OLED display panel fully damaged. Connector pins loose. Cleaned motherboard.",
      estimatedCost: 2000, // revised base cost
    };
    const updateJobRes = await updateJob(
      mockRequest(`http://localhost/api/repair/jobs/${job.id}`, "PUT", updateJobPayload),
      { params: { id: job.id } }
    );
    const updatedJob = await updateJobRes.json();
    console.log("Updated Job Card:", updatedJob);
    if (updatedJob.status !== "REPAIRING" || updatedJob.balanceDue !== 1500) {
      throw new Error("Job card status or cost update recalculation failed");
    }

    // 9. Allocate Spare Part used
    console.log("\n9. Testing POST /api/repair/jobs/[id]/parts (Add OLED Screen)...");
    const partUsagePayload = {
      partId: part1.id,
      quantityUsed: 1,
      priceCharged: 4200, // selling price is 4000, but charged 4200 (extra premium charge)
    };
    const addPartRes = await addJobPart(
      mockRequest(`http://localhost/api/repair/jobs/${job.id}/parts`, "POST", partUsagePayload),
      { params: { id: job.id } }
    );
    const addPartResJson = await addPartRes.json();
    console.log("Allocated Part:", addPartResJson.jobCardPart);
    console.log("Updated Job Final Cost & Balance:", addPartResJson.job.finalCost, addPartResJson.job.balanceDue);
    // Base cost was revised to 2000. Part is 4200. Total = 6200. Paid advance = 500. Balance due = 5700.
    if (addPartResJson.job.finalCost !== 6200 || addPartResJson.job.balanceDue !== 5700) {
      throw new Error("Automatic finalCost and balanceDue adjustment on part allocation failed");
    }

    // Check inventory stock decrement
    const updatedPart1 = await prisma.repairPart.findUnique({ where: { id: part1.id } });
    console.log("Part 1 Stock after decrement (should be 7):", updatedPart1?.quantityInStock);
    if (updatedPart1?.quantityInStock !== 7) throw new Error("Inventory part quantity in stock was not decremented");

    // 10. Record Payment (Final Balance)
    console.log("\n10. Testing POST /api/repair/jobs/[id]/payment...");
    const payPayload = {
      amount: 5700,
      paymentMode: "CARD",
      paymentType: "FINAL",
    };
    const payRes = await recordJobPayment(
      mockRequest(`http://localhost/api/repair/jobs/${job.id}/payment`, "POST", payPayload),
      { params: { id: job.id } }
    );
    const payResult = await payRes.json();
    console.log("Recorded Payment:", payResult.payment);
    console.log("Updated Job Card Balance Due:", payResult.job.balanceDue);
    if (payResult.job.balanceDue !== 0) throw new Error("Payment failed to clear balance due");

    // 11. Complete Job & Deliver
    console.log("\n11. Testing PUT /api/repair/jobs/[id] -> status DELIVERED...");
    const deliverRes = await updateJob(
      mockRequest(`http://localhost/api/repair/jobs/${job.id}`, "PUT", { status: "DELIVERED" }),
      { params: { id: job.id } }
    );
    const deliveredJob = await deliverRes.json();
    console.log("Delivered Date timestamp:", deliveredJob.deliveredAt);
    if (!deliveredJob.deliveredAt) throw new Error("DELIVERED status update failed to set deliveredAt timestamp");

    // 12. Retrieve Job Detail (Verify Warranty status)
    console.log("\n12. Testing GET /api/repair/jobs/[id] (Verify warranty is active)...");
    const detailRes = await getJobDetail(
      mockRequest(`http://localhost/api/repair/jobs/${job.id}`, "GET"),
      { params: { id: job.id } }
    );
    const detail = await detailRes.json();
    console.log("Job details fetched - Under Warranty:", detail.isUnderWarranty);
    if (!detail.isUnderWarranty) throw new Error("Warranty active status check returned false");

    // 13. Warranty Claim flow
    console.log("\n13. Testing warranty claim flow...");
    const claimPayload = {
      customerId: customer.id,
      deviceType: "MOBILE",
      deviceBrand: "Apple",
      deviceModel: "iPhone 13",
      reportedIssue: "Display flickering. Connected pins loose.",
      estimatedCost: 0,
      advanceTaken: 0,
      warrantyDays: 0,
      deliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      assignedToStaff: "Amit (Senior Tech)",
      deviceConditionOnReceipt: "Screws fitted, screen has no scratch, flickering visible.",
      warrantyParentId: job.id, // linked to parent
    };
    const claimRes = await createJob(mockRequest("http://localhost/api/repair/jobs", "POST", claimPayload));
    const claim = await claimRes.json();
    console.log("Warranty Claim Job Card Created:", claim);
    if (claim.warrantyParentId !== job.id) throw new Error("Warranty claim flow parent link not stored");

    // 14. Fetch Dashboard stats
    console.log("\n14. Testing GET /api/repair/dashboard...");
    const dashRes = await getDashboard(mockRequest("http://localhost/api/repair/dashboard", "GET"));
    const dashboard = await dashRes.json();
    console.log("Dashboard Stats:", dashboard);
    // Active jobs: RECEIVED (the warranty claim) is active. DELIVERED is not active. So active = 1.
    if (dashboard.statusCounts.RECEIVED !== 1) throw new Error("Dashboard status counts incorrect");
    if (dashboard.lowStockCount !== 1) throw new Error("Dashboard low stock count incorrect");

    console.log("\n=== ALL REPAIR SHOP CRM TESTS COMPLETED SUCCESSFULLY ===");
  } catch (error: any) {
    console.error("\n❌ VERIFICATION TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
