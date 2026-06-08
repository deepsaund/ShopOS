import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { RequestDocStatus } from "@prisma/client";
import { notifyStatusChange } from "@/lib/notifications";

const reviewSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  status: z.nativeEnum(RequestDocStatus),
  rejectionReason: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id: requestId } = params;
    const body = await req.json();

    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { documentId, status, rejectionReason } = parsed.data;

    // Verify request exists under tenant
    const request = await prisma.cscRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { service: true },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found", code: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify document belongs to request
    const document = await prisma.requestDocument.findFirst({
      where: { id: documentId, requestId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found under this request", code: "DOCUMENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Update document status
    await prisma.requestDocument.update({
      where: { id: documentId },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        reviewedAt: new Date(),
      },
    });

    // Parse required documents list from service
    let reqDocsList: any[] = [];
    if (request.service.requiredDocuments && typeof request.service.requiredDocuments === "object") {
      reqDocsList = request.service.requiredDocuments as any[];
    } else if (typeof request.service.requiredDocuments === "string") {
      reqDocsList = JSON.parse(request.service.requiredDocuments);
    }

    // Fetch all documents for this request after update
    const allDocs = await prisma.requestDocument.findMany({
      where: { requestId },
    });

    const docMap = new Map<string, typeof allDocs[0]>();
    for (const d of allDocs) {
      docMap.set(d.docType, d);
    }

    // Evaluate statuses of required documents
    let allApproved = true;
    let anyRejected = false;

    for (const reqDoc of reqDocsList) {
      const dbDoc = docMap.get(reqDoc.name);
      
      // If it is mandatory
      if (reqDoc.is_mandatory) {
        if (!dbDoc || !dbDoc.fileUrl || dbDoc.status !== "APPROVED") {
          allApproved = false;
        }
        if (dbDoc && dbDoc.status === "REJECTED") {
          anyRejected = true;
        }
      } else {
        // If optional document is uploaded and rejected
        if (dbDoc && dbDoc.status === "REJECTED") {
          anyRejected = true;
        }
      }
    }

    // Determine new request status
    let newStatus = request.status;
    if (allApproved) {
      newStatus = "DOCS_APPROVED"; // Moves to queue
    } else if (anyRejected) {
      newStatus = "PENDING_DOCUMENTS"; // Stays in pending due to rejection
    } else {
      // No rejections, but not all approved yet
      newStatus = "SUBMITTED"; // Docs under review
    }

    if (newStatus !== request.status) {
      await prisma.cscRequest.update({
        where: { id: requestId },
        data: { status: newStatus },
      });

      // Trigger status change notification
      await notifyStatusChange(requestId);
    }

    const updatedRequest = await prisma.cscRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: true,
        service: true,
        documents: true,
      },
    });

    return NextResponse.json(serializeData(updatedRequest));
  } catch (error: any) {
    console.error("Error reviewing document:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
