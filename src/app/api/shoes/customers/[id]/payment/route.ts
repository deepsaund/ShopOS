import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { UdhaarTransactionType } from "@prisma/client";

export const dynamic = "force-dynamic";

const repaymentSchema = z.object({
  amount: z.number().positive("Repayment amount must be positive"),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;
    const body = await req.json();

    const parsed = repaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { amount, notes } = parsed.data;

    // Verify customer exists
    const customer = await prisma.shoeCustomer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Repayment transaction
    const updatedCustomer = await prisma.$transaction(async (tx) => {
      // Create repayment ledger entry
      await tx.udhaarLedger.create({
        data: {
          tenantId,
          customerId: id,
          transactionType: UdhaarTransactionType.PAYMENT,
          amount,
          notes: notes || "Udhaar repayment received",
        },
      });

      // Decrement total balance
      return tx.shoeCustomer.update({
        where: { id },
        data: {
          totalUdhaarBalance: {
            decrement: amount,
          },
        },
      });
    });

    return NextResponse.json(serializeData(updatedCustomer), { status: 201 });
  } catch (error: any) {
    console.error("Error recording udhaar payment:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
