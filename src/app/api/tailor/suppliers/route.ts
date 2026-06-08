import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  phone: z.string().min(1, "Supplier phone is required"),
  address: z.string().min(1, "Supplier address is required"),
  gstNumber: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        ...parsed.data,
      },
    });

    return NextResponse.json(serializeData(supplier), { status: 201 });
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(serializeData(suppliers));
  } catch (error: any) {
    console.error("Error listing suppliers:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
