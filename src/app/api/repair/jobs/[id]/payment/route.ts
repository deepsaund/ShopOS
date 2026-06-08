import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { PaymentMode, RepairPaymentType } from "@prisma/client";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  amount: z.number().positive("Payment amount must be positive"),
  paymentMode: z.nativeEnum(PaymentMode),
  paymentType: z.nativeEnum(RepairPaymentType),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id: jobId } = params;
    const body = await req.json();

    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { amount, paymentMode, paymentType } = parsed.data;

    // 1. Verify job exists
    const job = await prisma.jobCard.findFirst({
      where: { id: jobId, tenantId },
      include: { payments: true },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job card not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Add payment and update job card balance in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.repairPayment.create({
        data: {
          tenantId,
          jobId,
          amount,
          paymentMode,
          paymentType,
        },
      });

      // Sum existing payments + new payment
      const allPayments = [...job.payments, payment];
      const paymentsSum = allPayments.reduce((sum, p) => {
        if (p.paymentType === "REFUND") {
          return sum - Number(p.amount);
        }
        return sum + Number(p.amount);
      }, 0);

      const resolvedCost = Number(job.finalCost) > 0 ? Number(job.finalCost) : Number(job.estimatedCost);
      const newBalanceDue = resolvedCost - paymentsSum;

      // Update Job Card
      const updatedJob = await tx.jobCard.update({
        where: { id: jobId },
        data: {
          balanceDue: newBalanceDue,
        },
        include: {
          customer: true,
          partsUsed: {
            include: {
              repairPart: true,
            },
          },
          payments: true,
        },
      });

      return { payment, job: updatedJob };
    });

    return NextResponse.json(serializeData(result), { status: 201 });
  } catch (error: any) {
    console.error("Error recording payment for job card:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
