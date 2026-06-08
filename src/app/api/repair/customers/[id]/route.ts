import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const updateCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Customer phone is required"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;

    const customer = await prisma.repairCustomer.findFirst({
      where: { id, tenantId },
      include: {
        jobCards: {
          orderBy: { createdAt: "desc" },
          include: {
            partsUsed: {
              include: {
                repairPart: true,
              },
            },
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeData(customer));
  } catch (error: any) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;
    const body = await req.json();

    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, phone, email, address } = parsed.data;

    // Verify customer exists
    const customer = await prisma.repairCustomer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check duplicate phone
    const existing = await prisma.repairCustomer.findFirst({
      where: { tenantId, phone, id: { not: id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A customer with this phone number already exists", code: "CUSTOMER_EXISTS" },
        { status: 400 }
      );
    }

    const updated = await prisma.repairCustomer.update({
      where: { id },
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
      },
    });

    return NextResponse.json(serializeData(updated));
  } catch (error: any) {
    console.error("Error updating customer:", error);
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

    const customer = await prisma.repairCustomer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Delete customer
    await prisma.repairCustomer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
