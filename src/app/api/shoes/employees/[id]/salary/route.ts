import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { SalaryPaymentMode } from "@prisma/client";

export const dynamic = "force-dynamic";

const createSalarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  amountPaid: z.number().positive("Amount paid must be positive"),
  paymentDate: z.string().datetime({ message: "Invalid payment date format" }),
  paymentMode: z.nativeEnum(SalaryPaymentMode),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const employeeId = params.id;
    const body = await req.json();

    const parsed = createSalarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { month, amountPaid, paymentDate, paymentMode, notes } = parsed.data;

    // Verify employee exists and belongs to the tenant
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const salaryRecord = await prisma.salaryRecord.create({
      data: {
        tenantId,
        employeeId,
        month,
        amountPaid,
        paymentDate: new Date(paymentDate),
        paymentMode,
        notes: notes || null,
      },
    });

    return NextResponse.json(serializeData(salaryRecord), { status: 201 });
  } catch (error: any) {
    console.error("Error creating salary record:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const employeeId = params.id;

    // Verify employee exists and belongs to the tenant
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const salaryHistory = await prisma.salaryRecord.findMany({
      where: { employeeId, tenantId },
      orderBy: { month: "desc" },
    });

    return NextResponse.json(serializeData(salaryHistory));
  } catch (error: any) {
    console.error("Error retrieving salary history:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
