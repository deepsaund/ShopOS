import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { EmployeeRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const createEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  role: z.nativeEnum(EmployeeRole),
  salaryAmount: z.number().positive("Salary must be positive"),
  joinDate: z.string().datetime({ message: "Invalid join date format" }),
  isActive: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, phone, role, salaryAmount, joinDate, isActive } = parsed.data;

    const employee = await prisma.employee.create({
      data: {
        tenantId,
        name,
        phone,
        role,
        salaryAmount,
        joinDate: new Date(joinDate),
        isActive,
      },
    });

    return NextResponse.json(serializeData(employee), { status: 201 });
  } catch (error: any) {
    console.error("Error creating employee:", error);
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

    const skip = (page - 1) * limit;

    const [employees, total] = await prisma.$transaction([
      prisma.employee.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.employee.count({
        where: { tenantId },
      }),
    ]);

    return NextResponse.json({
      data: serializeData(employees),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing employees:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
