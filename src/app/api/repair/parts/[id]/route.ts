import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const updatePartSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().min(1, "Part number is required"),
  compatibleDevices: z.string().min(1, "Compatible devices description is required"),
  quantityInStock: z.number().int().nonnegative("Quantity must be non-negative"),
  costPrice: z.number().positive("Cost price must be positive"),
  sellingPrice: z.number().positive("Selling price must be positive"),
  lowStockThreshold: z.number().int().positive("Low stock threshold must be positive"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;
    const body = await req.json();

    const parsed = updatePartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      partName,
      partNumber,
      compatibleDevices,
      quantityInStock,
      costPrice,
      sellingPrice,
      lowStockThreshold,
    } = parsed.data;

    // Verify part exists
    const part = await prisma.repairPart.findFirst({
      where: { id, tenantId },
    });

    if (!part) {
      return NextResponse.json(
        { error: "Part not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check duplicate part number
    const existing = await prisma.repairPart.findFirst({
      where: { tenantId, partNumber, id: { not: id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A part with this part number already exists", code: "PART_EXISTS" },
        { status: 400 }
      );
    }

    const updated = await prisma.repairPart.update({
      where: { id },
      data: {
        partName,
        partNumber,
        compatibleDevices,
        quantityInStock,
        costPrice,
        sellingPrice,
        lowStockThreshold,
      },
    });

    return NextResponse.json(serializeData(updated));
  } catch (error: any) {
    console.error("Error updating part:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;

    const part = await prisma.repairPart.findFirst({
      where: { id, tenantId },
    });

    if (!part) {
      return NextResponse.json(
        { error: "Part not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.repairPart.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting part:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
