import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const updateCustomerSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  phone: z.string().min(1, "Phone cannot be empty").optional(),
  email: z.string().email("Invalid email").optional().nullable(),
  address: z.string().optional().nullable(),
  measurements: z.object({
    chest: z.number().optional().nullable(),
    waist: z.number().optional().nullable(),
    hips: z.number().optional().nullable(),
    shoulder: z.number().optional().nullable(),
    sleeve_length: z.number().optional().nullable(),
    shirt_length: z.number().optional().nullable(),
    pant_length: z.number().optional().nullable(),
    pant_waist: z.number().optional().nullable(),
    pant_thigh: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;

    const customer = await prisma.tailorCustomer.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                clothStock: true
              }
            },
            payments: true
          }
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
    console.error("Error retrieving customer:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;
    const body = await req.json();

    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const existingCustomer = await prisma.tailorCustomer.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Merge measurements if present
    let updatedMeasurements = existingCustomer.measurements;
    if (parsed.data.measurements) {
      const current = typeof existingCustomer.measurements === 'object' && existingCustomer.measurements !== null
        ? (existingCustomer.measurements as Record<string, any>)
        : {};
      updatedMeasurements = {
        ...current,
        ...parsed.data.measurements,
      };
    }

    const updatedCustomer = await prisma.tailorCustomer.update({
      where: {
        id,
      },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        address: parsed.data.address,
        measurements: updatedMeasurements as any,
      },
    });

    return NextResponse.json(serializeData(updatedCustomer));
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
