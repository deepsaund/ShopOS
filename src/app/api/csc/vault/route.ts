import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const vaultUploadSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  docType: z.string().min(1, "Document type is required"),
  fileUrl: z.string().url("Invalid file URL"),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = vaultUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { customerId, docType, fileUrl } = parsed.data;

    // Verify customer exists
    const customer = await prisma.cscCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if document of this type already exists in vault
    const existing = await prisma.documentVault.findFirst({
      where: { tenantId, customerId, docType },
    });

    let vaultDoc;
    if (existing) {
      vaultDoc = await prisma.documentVault.update({
        where: { id: existing.id },
        data: { fileUrl, uploadedAt: new Date() },
      });
    } else {
      vaultDoc = await prisma.documentVault.create({
        data: {
          tenantId,
          customerId,
          docType,
          fileUrl,
        },
      });
    }

    return NextResponse.json(serializeData(vaultDoc), { status: 201 });
  } catch (error: any) {
    console.error("Error saving to vault:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required", code: "MISSING_CUSTOMER_ID" },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await prisma.cscCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const vaultDocs = await prisma.documentVault.findMany({
      where: { tenantId, customerId },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(serializeData(vaultDocs));
  } catch (error: any) {
    console.error("Error fetching vault docs:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
