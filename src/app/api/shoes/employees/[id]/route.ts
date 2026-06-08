import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { EmployeeRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  role: z.nativeEnum(EmployeeRole).optional(),
  salaryAmount: z.number().positive("Salary must be positive").optional(),
  joinDate: z.string().datetime({ message: "Invalid join date format" }).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;

    const employee = await prisma.employee.findFirst({
      where: { id, tenantId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeData(employee));
  } catch (error: any) {
    console.error("Error fetching employee:", error);
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

    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Verify employee belongs to tenant
    const existingEmployee = await prisma.employee.findFirst({
      where: { id, tenantId },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const { name, phone, role, salaryAmount, joinDate, isActive } = parsed.data;

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        name,
        phone,
        role,
        salaryAmount,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        isActive,
      },
    });

    return NextResponse.json(serializeData(updatedEmployee));
  } catch (error: any) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;

    // Verify employee belongs to tenant
    const existingEmployee = await prisma.employee.findFirst({
      where: { id, tenantId },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Delete related salary records first inside a transaction to prevent FKEY violation
    await prisma.$transaction(async (tx) => {
      await tx.salaryRecord.deleteMany({
        where: { employeeId: id, tenantId },
      });
      await tx.employee.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
