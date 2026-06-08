import { NextRequest } from "next/server";
import prisma from "../lib/prisma";

// Import route handlers
import { POST as createService, GET as listServices } from "../app/api/csc/services/route";
import { PUT as updateService, DELETE as deleteService } from "../app/api/csc/services/[id]/route";
import { POST as createCustomer, GET as listCustomers } from "../app/api/csc/customers/route";
import { POST as saveVault, GET as getVault } from "../app/api/csc/vault/route";
import { POST as createRequest, GET as listRequests } from "../app/api/csc/requests/route";
import { GET as getQueue } from "../app/api/csc/requests/queue/route";
import { POST as claimRequest } from "../app/api/csc/requests/[id]/claim/route";
import { PUT as updateRequestStatus } from "../app/api/csc/requests/[id]/status/route";
import { POST as reviewDocument } from "../app/api/csc/requests/[id]/documents/review/route";
import { POST as uploadDocument } from "../app/api/csc/requests/[id]/documents/upload/route";
import { GET as getMessages, POST as sendMessage } from "../app/api/csc/requests/[id]/messages/route";
import { GET as getDashboard } from "../app/api/csc/dashboard/route";

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
  console.log("=== STARTING CSC CRM INTEGRATION TEST SUITE ===");

  try {
    // 0. Clean database
    console.log("\n0. Cleaning database...");
    await prisma.cscNotification.deleteMany({});
    await prisma.cscMessage.deleteMany({});
    await prisma.requestDocument.deleteMany({});
    await prisma.cscRequest.deleteMany({});
    await prisma.documentVault.deleteMany({});
    await prisma.cscCustomer.deleteMany({});
    await prisma.cscService.deleteMany({});
    console.log("Database cleared.");

    // 1. Create a Service
    console.log("\n1. Testing POST /api/csc/services (Create Service)...");
    const servicePayload = {
      name: "Aadhaar Card Update",
      description: "Correction of name, DOB, or address details in Aadhaar database.",
      priceCustomer: 150.0,
      priceB2b: 100.0,
      estimatedDays: 7,
      requiredDocuments: [
        { name: "Proof of Identity", description: "PAN card or Passport photo", is_mandatory: true },
        { name: "Proof of Address", description: "Utility bill or Bank statement", is_mandatory: true },
        { name: "Birth Certificate", description: "Required only for age correction", is_mandatory: false }
      ],
    };

    const createServiceReq = mockRequest("http://localhost/api/csc/services", "POST", servicePayload);
    const createServiceRes = await createService(createServiceReq);
    console.log("Status code:", createServiceRes.status);
    const service = await createServiceRes.json();
    console.log("Created service:", service);

    if (createServiceRes.status !== 201) throw new Error("Service creation failed");

    // 2. Create another Service to test CRUD delete / update
    console.log("\n2. Testing Service Update & Delete...");
    const servicePayload2 = {
      name: "Temporary Service",
      description: "Will be deleted",
      priceCustomer: 50.0,
      priceB2b: 30.0,
      estimatedDays: 2,
      requiredDocuments: [],
    };
    const createServiceReq2 = mockRequest("http://localhost/api/csc/services", "POST", servicePayload2);
    const createServiceRes2 = await createService(createServiceReq2);
    const tempService = await createServiceRes2.json();

    // Update service
    const updateServiceReq = mockRequest(`http://localhost/api/csc/services/${tempService.id}`, "PUT", {
      name: "Temporary Service (Updated)",
      priceCustomer: 60.0,
    });
    const updateServiceRes = await updateService(updateServiceReq, { params: { id: tempService.id } });
    const updatedService = await updateServiceRes.json();
    console.log("Updated service name:", updatedService.name);
    if (updatedService.priceCustomer !== 60) throw new Error("Service update failed");

    // Delete service
    const deleteServiceReq = mockRequest(`http://localhost/api/csc/services/${tempService.id}`, "DELETE");
    const deleteServiceRes = await deleteService(deleteServiceReq, { params: { id: tempService.id } });
    console.log("Deleted status code:", deleteServiceRes.status);
    if (deleteServiceRes.status !== 200) throw new Error("Service delete failed");

    // 3. Register Customer
    console.log("\n3. Testing POST /api/csc/customers (Register Customer)...");
    const customerPayload = {
      name: "Suresh Sharma",
      phone: "9876543210",
      email: "suresh@example.com",
      address: "Sector 15, Dwarka, Delhi",
    };
    const createCustReq = mockRequest("http://localhost/api/csc/customers", "POST", customerPayload);
    const createCustRes = await createCustomer(createCustReq);
    const customer = await createCustRes.json();
    console.log("Registered customer:", customer);
    if (createCustRes.status !== 201) throw new Error("Customer registration failed");

    // Verify duplicate check returns status 200 with same customer
    const duplicateCustReq = mockRequest("http://localhost/api/csc/customers", "POST", customerPayload);
    const duplicateCustRes = await createCustomer(duplicateCustReq);
    console.log("Duplicate lookup status:", duplicateCustRes.status);
    if (duplicateCustRes.status !== 200) throw new Error("Customer duplicate check failed");

    // 4. Save to Document Vault
    console.log("\n4. Testing POST /api/csc/vault (Document Vault)...");
    const vaultPayload = {
      customerId: customer.id,
      docType: "Proof of Identity",
      fileUrl: "https://shopos-vault.s3.amazonaws.com/suresh_pan.jpg",
    };
    const vaultReq = mockRequest("http://localhost/api/csc/vault", "POST", vaultPayload);
    const vaultRes = await saveVault(vaultReq);
    const vaultDoc = await vaultRes.json();
    console.log("Stored document in vault:", vaultDoc);
    if (vaultRes.status !== 201) throw new Error("Vault saving failed");

    // Verify GET /api/csc/vault
    const listVaultReq = mockRequest(`http://localhost/api/csc/vault?customerId=${customer.id}`, "GET");
    const listVaultRes = await getVault(listVaultReq);
    const vaultDocs = await listVaultRes.json();
    console.log("Customer vault files:", vaultDocs);
    if (vaultDocs.length !== 1) throw new Error("Retrieving vault failed");

    // 5. Create Service Request (B2B Price verification)
    console.log("\n5. Testing POST /api/csc/requests (B2B Request Submission)...");
    // This request will auto-populate "Proof of Identity" from the vault.
    // The "Proof of Address" will be provided in the request body.
    // The "Birth Certificate" (optional) is omitted.
    const requestPayload = {
      customerId: customer.id,
      serviceId: service.id,
      createdByRole: "B2B",
      documents: [
        { docType: "Proof of Address", fileUrl: "https://shopos-vault.s3.amazonaws.com/suresh_bill.jpg" }
      ]
    };
    const createReq = mockRequest("http://localhost/api/csc/requests", "POST", requestPayload);
    const createRes = await createRequest(createReq);
    const requestItem = await createRes.json();
    console.log("Created request details:", requestItem);
    if (createRes.status !== 201) throw new Error("Request creation failed");

    // Verify priceCharged is B2B price (100)
    console.log("Price Charged:", requestItem.priceCharged);
    if (Number(requestItem.priceCharged) !== 100) throw new Error("B2B pricing logic failed");

    // Verify status is SUBMITTED
    if (requestItem.status !== "SUBMITTED") throw new Error("Initial request status is not SUBMITTED");

    // Verify that two RequestDocuments were created (Identity populated from vault, Address from request payload)
    console.log("Request documents checklist:", requestItem.documents);
    if (requestItem.documents.length !== 3) throw new Error("Request documents initialization failed");

    // 6. Review Documents - Partial Rejection
    console.log("\n6. Testing POST /api/csc/requests/[id]/documents/review (Partial Rejection)...");
    // We reject "Proof of Identity" document
    const identityDoc = requestItem.documents.find((d: any) => d.docType === "Proof of Identity");
    const reviewPayload1 = {
      documentId: identityDoc.id,
      status: "REJECTED",
      rejectionReason: "Photo is too blurry",
    };
    const reviewReq1 = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/documents/review`, "POST", reviewPayload1);
    const reviewRes1 = await reviewDocument(reviewReq1, { params: { id: requestItem.id } });
    const requestAfterRejection = await reviewRes1.json();
    console.log("Request status after rejection:", requestAfterRejection.status);
    // Should stay/move to PENDING_DOCUMENTS due to rejection
    if (requestAfterRejection.status !== "PENDING_DOCUMENTS") throw new Error("Rejection status transition failed");

    // 7. Customer Re-uploads document
    console.log("\n7. Testing POST /api/csc/requests/[id]/documents/upload (Customer upload correction)...");
    const uploadPayload = {
      docType: "Proof of Identity",
      fileUrl: "https://shopos-vault.s3.amazonaws.com/suresh_pan_clear.jpg",
    };
    const uploadReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/documents/upload`, "POST", uploadPayload);
    const uploadRes = await uploadDocument(uploadReq, { params: { id: requestItem.id } });
    console.log("Upload response code:", uploadRes.status);
    if (uploadRes.status !== 200) throw new Error("Document upload failed");

    // Fetch request again to verify status went back to SUBMITTED
    const listReq = mockRequest(`http://localhost/api/csc/requests?customerId=${customer.id}`, "GET");
    const listRes = await listRequests(listReq);
    const userReqs = await listRes.json();
    const currentRequest = userReqs.find((r: any) => r.id === requestItem.id);
    console.log("Request status after re-upload:", currentRequest.status);
    if (currentRequest.status !== "SUBMITTED") throw new Error("Re-upload status transition back to SUBMITTED failed");

    // 8. Approve all required documents -> moves to queue
    console.log("\n8. Testing Document Approvals -> Moves to Queue...");
    const updatedDocs = currentRequest.documents;
    const identityDocUpdated = updatedDocs.find((d: any) => d.docType === "Proof of Identity");
    const addressDoc = updatedDocs.find((d: any) => d.docType === "Proof of Address");

    // Approve Identity
    const approveIdentityReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/documents/review`, "POST", {
      documentId: identityDocUpdated.id,
      status: "APPROVED",
    });
    await reviewDocument(approveIdentityReq, { params: { id: requestItem.id } });

    // Approve Address
    const approveAddressReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/documents/review`, "POST", {
      documentId: addressDoc.id,
      status: "APPROVED",
    });
    const finalReviewRes = await reviewDocument(approveAddressReq, { params: { id: requestItem.id } });
    const requestAfterApprovals = await finalReviewRes.json();
    console.log("Request status after all approved:", requestAfterApprovals.status);
    // Should transition to DOCS_APPROVED
    if (requestAfterApprovals.status !== "DOCS_APPROVED") throw new Error("Approval queue-ready status transition failed");

    // Verify GET /api/csc/requests/queue contains this request
    const getQueueReq = mockRequest("http://localhost/api/csc/requests/queue", "GET");
    const getQueueRes = await getQueue(getQueueReq);
    const queue = await getQueueRes.json();
    console.log("Queue size:", queue.length);
    const inQueue = queue.some((r: any) => r.id === requestItem.id);
    if (!inQueue) throw new Error("Request did not enter the claim queue");

    // 9. Atomic claim verification
    console.log("\n9. Testing POST /api/csc/requests/[id]/claim (Atomic Claim)...");
    const claimReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/claim`, "POST", { staffId: "staff-1" });
    const claimRes = await claimRequest(claimReq, { params: { id: requestItem.id } });
    const claimedRequest = await claimRes.json();
    console.log("Claimed request status:", claimedRequest.status);
    console.log("Claimed by staff:", claimedRequest.claimedByStaffId);
    if (claimRes.status !== 200) throw new Error("Claim endpoint failed");
    if (claimedRequest.status !== "PROCESSING" || claimedRequest.claimedByStaffId !== "staff-1") {
      throw new Error("Claim assignments failed");
    }

    // Try to claim again, should fail
    const doubleClaimReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/claim`, "POST", { staffId: "staff-2" });
    const doubleClaimRes = await claimRequest(doubleClaimReq, { params: { id: requestItem.id } });
    console.log("Double claim response code:", doubleClaimRes.status);
    if (doubleClaimRes.status === 200) throw new Error("Double claim succeeded, race condition locking failed!");

    // 10. Send Chat Messages
    console.log("\n10. Testing Chat Messages (GET / POST)...");
    const sendMsgReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/messages`, "POST", {
      senderId: "staff-1",
      senderRole: "STAFF",
      content: "Hello Suresh, your Aadhaar corrections have been submitted to the central database.",
    });
    await sendMessage(sendMsgReq, { params: { id: requestItem.id } });

    const getMsgsReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/messages`, "GET");
    const getMsgsRes = await getMessages(getMsgsReq, { params: { id: requestItem.id } });
    const chatHistory = await getMsgsRes.json();
    console.log("Chat history length:", chatHistory.length);
    console.log("Last message content:", chatHistory[chatHistory.length - 1].content);
    if (chatHistory.length !== 1) throw new Error("Chat message storage failed");

    // 11. Complete request and fetch dashboard metrics
    console.log("\n11. Testing Status Completion & Dashboard...");
    const statusUpdateReq = mockRequest(`http://localhost/api/csc/requests/${requestItem.id}/status`, "PUT", { status: "COMPLETED" });
    const statusUpdateRes = await updateRequestStatus(statusUpdateReq, { params: { id: requestItem.id } });
    const completedReq = await statusUpdateRes.json();
    console.log("Final status:", completedReq.status);
    if (completedReq.status !== "COMPLETED" || !completedReq.completedAt) throw new Error("Request completion failed");

    // Check dashboard metrics
    const dashReq = mockRequest("http://localhost/api/csc/dashboard", "GET");
    const dashRes = await getDashboard(dashReq);
    const dashboard = await dashRes.json();
    console.log("Dashboard Stats:", dashboard);
    if (dashboard.completedToday !== 1) throw new Error("Dashboard completions failed");
    if (dashboard.revenueToday !== 100) throw new Error("Dashboard revenue failed");
    if (dashboard.staffPerformance[0].completedCount !== 1) throw new Error("Dashboard staff metrics failed");

    console.log("\n=== ALL CSC CRM INTEGRATION TESTS COMPLETED SUCCESSFULLY ===");
  } catch (error: any) {
    console.error("\n❌ CSC VERIFICATION TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
