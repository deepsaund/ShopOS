import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Customer phone is required"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const searchParams = req.nextUrl.searchParams;

    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await prisma.$transaction([
      prisma.repairCustomer.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          jobCards: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.repairCustomer.count({ where }),
    ]);

    return NextResponse.json({
      data: serializeData(customers),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing repair customers:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, phone, email, address } = parsed.data;

    // Optional check: see if a customer with the same phone already exists under this tenant
    const existing = await prisma.repairCustomer.findFirst({
      where: { tenantId, phone },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A customer with this phone number already exists", code: "CUSTOMER_EXISTS" },
        { status: 400 }
      );
    }

    const customer = await prisma.repairCustomer.create({
      data: {
        tenantId,
        name,
        phone,
        email: email || null,
        address: address || null,
      },
    });

    return NextResponse.json(serializeData(customer), { status: 201 });
  } catch (error: any) {
    console.error("Error creating repair customer:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
