import prisma from "./prisma";

/**
 * Sends a notification (in-app + simulated MSG91 SMS) on request status changes.
 */
export async function notifyStatusChange(requestId: string) {
  try {
    const request = await prisma.cscRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: true,
        service: true,
      },
    });

    if (!request) {
      console.error(`[Notification] Request ${requestId} not found.`);
      return;
    }

    const customerName = request.customer.name;
    const customerPhone = request.customer.phone;
    const serviceName = request.service.name;
    const status = request.status;

    let message = "";

    switch (status) {
      case "SUBMITTED":
        message = `Dear ${customerName}, your request for ${serviceName} has been submitted successfully and is under review.`;
        break;
      case "PENDING_DOCUMENTS":
        message = `Dear ${customerName}, some documents for your ${serviceName} request require attention or were rejected. Please check and re-upload.`;
        break;
      case "DOCS_APPROVED":
        message = `Dear ${customerName}, all documents for your ${serviceName} request have been approved and the request is queued for processing.`;
        break;
      case "PROCESSING":
        message = `Dear ${customerName}, your request for ${serviceName} is now under processing.`;
        break;
      case "COMPLETED":
        message = `Dear ${customerName}, your request for ${serviceName} has been successfully completed!`;
        break;
      default:
        message = `Dear ${customerName}, the status of your request for ${serviceName} has been updated to ${status}.`;
    }

    // 1. Create in-app notification in DB
    await prisma.cscNotification.create({
      data: {
        tenantId: request.tenantId,
        userId: request.customerId,
        message,
        requestId: request.id,
      },
    });

    // 2. Log MSG91 SMS Simulation
    console.log(`\n================== [MSG91 SMS GATEWAY] ==================`);
    console.log(`Sender: SHOPOS-CSC`);
    console.log(`To: ${customerPhone}`);
    console.log(`Message: ${message}`);
    console.log(`Status: Sent Successfully (Simulated)`);
    console.log(`=========================================================\n`);

  } catch (error) {
    console.error("Error sending notification:", error);
  }
}
