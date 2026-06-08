import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().nullable(),
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

    const { name, phone, email, address } = parsed.data;

    // Check if customer already exists by phone under this tenant
    const existing = await prisma.cscCustomer.findFirst({
      where: { phone, tenantId },
    });

    if (existing) {
      return NextResponse.json(serializeData(existing), { status: 200 });
    }

    const customer = await prisma.cscCustomer.create({
      data: {
        tenantId,
        name,
        phone,
        email,
        address,
      },
    });

    return NextResponse.json(serializeData(customer), { status: 201 });
  } catch (error: any) {
    console.error("Error creating CSC customer:", error);
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
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20"));
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
      prisma.cscCustomer.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          requests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              createdAt: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.cscCustomer.count({
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
    console.error("Error listing CSC customers:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
