import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

const requiredDocSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  description: z.string().optional().default(""),
  is_mandatory: z.boolean().optional().default(true),
});

const updateServiceSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  priceCustomer: z.number().positive("Price for customer must be positive").optional(),
  priceB2b: z.number().positive("Price for B2B must be positive").optional(),
  estimatedDays: z.number().int().positive("Estimated days must be a positive integer").optional(),
  requiredDocuments: z.array(requiredDocSchema).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;
    const body = await req.json();

    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const service = await prisma.cscService.findFirst({
      where: { id, tenantId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found", code: "SERVICE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const updated = await prisma.cscService.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        priceCustomer: parsed.data.priceCustomer,
        priceB2b: parsed.data.priceB2b,
        estimatedDays: parsed.data.estimatedDays,
        requiredDocuments: parsed.data.requiredDocuments,
      },
    });

    return NextResponse.json(serializeData(updated));
  } catch (error: any) {
    console.error("Error updating CSC service:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;

    const service = await prisma.cscService.findFirst({
      where: { id, tenantId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found", code: "SERVICE_NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.cscService.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting CSC service:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
