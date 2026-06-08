import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const uploadSchema = z.object({
  docType: z.string().min(1, "Document type is required"),
  fileUrl: z.string().url("Invalid file URL"),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id: requestId } = params;
    const body = await req.json();

    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { docType, fileUrl } = parsed.data;

    // Verify request exists under tenant
    const request = await prisma.cscRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found", code: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Update request document row
    const doc = await prisma.requestDocument.findFirst({
      where: { requestId, docType },
    });

    if (!doc) {
      await prisma.requestDocument.create({
        data: {
          requestId,
          docType,
          fileUrl,
          status: "PENDING",
        },
      });
    } else {
      await prisma.requestDocument.update({
        where: { id: doc.id },
        data: {
          fileUrl,
          status: "PENDING", // reset status to pending for staff review
          rejectionReason: null,
          reviewedAt: null,
        },
      });
    }

    // Upsert customer permanent document vault
    const vaultDoc = await prisma.documentVault.findFirst({
      where: { tenantId, customerId: request.customerId, docType },
    });

    if (vaultDoc) {
      await prisma.documentVault.update({
        where: { id: vaultDoc.id },
        data: {
          fileUrl,
          uploadedAt: new Date(),
        },
      });
    } else {
      await prisma.documentVault.create({
        data: {
          tenantId,
          customerId: request.customerId,
          docType,
          fileUrl,
        },
      });
    }

    // If request was PENDING_DOCUMENTS, transition back to SUBMITTED since user uploaded a file
    if (request.status === "PENDING_DOCUMENTS") {
      await prisma.cscRequest.update({
        where: { id: requestId },
        data: {
          status: "SUBMITTED",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error processing document upload:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
