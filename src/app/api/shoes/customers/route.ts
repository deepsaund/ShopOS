import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, phone, address } = parsed.data;

    const customer = await prisma.shoeCustomer.create({
      data: {
        tenantId,
        name,
        phone,
        address: address || null,
      },
    });

    return NextResponse.json(serializeData(customer), { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer:", error);
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

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const whereClause: any = {
      tenantId,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await prisma.$transaction([
      prisma.shoeCustomer.findMany({
        where: whereClause,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.shoeCustomer.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      data: serializeData(customers),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing customers:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
