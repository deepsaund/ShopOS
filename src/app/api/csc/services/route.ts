import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const requiredDocSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  description: z.string().optional().default(""),
  is_mandatory: z.boolean().optional().default(true),
});

const createServiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  priceCustomer: z.number().positive("Price for customer must be positive"),
  priceB2b: z.number().positive("Price for B2B must be positive"),
  estimatedDays: z.number().int().positive("Estimated days must be a positive integer"),
  requiredDocuments: z.array(requiredDocSchema).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const service = await prisma.cscService.create({
      data: {
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description,
        priceCustomer: parsed.data.priceCustomer,
        priceB2b: parsed.data.priceB2b,
        estimatedDays: parsed.data.estimatedDays,
        requiredDocuments: parsed.data.requiredDocuments,
      },
    });

    return NextResponse.json(serializeData(service), { status: 201 });
  } catch (error: any) {
    console.error("Error creating CSC service:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const services = await prisma.cscService.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(serializeData(services));
  } catch (error: any) {
    console.error("Error fetching CSC services:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
