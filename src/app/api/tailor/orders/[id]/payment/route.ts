import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { PaymentMode, PaymentType } from "@prisma/client";

export const dynamic = "force-dynamic";

const recordPaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be positive"),
  paymentMode: z.nativeEnum(PaymentMode),
  paymentType: z.nativeEnum(PaymentType),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;
    const body = await req.json();

    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { amount, paymentMode, paymentType, notes } = parsed.data;

    // Check if order exists
    const order = await prisma.tailorOrder.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Process payment and update balance_due in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment
      await tx.payment.create({
        data: {
          tenantId,
          orderId: id,
          amount,
          paymentMode,
          paymentType,
          notes: notes || `Payment type ${paymentType} recorded via API`,
        },
      });

      // 2. Fetch all payments for this order to recalculate
      const payments = await tx.payment.findMany({
        where: {
          orderId: id,
        },
      });

      let paidSum = 0;
      for (const p of payments) {
        const amt = Number(p.amount);
        if (p.paymentType === "REFUND") {
          paidSum -= amt;
        } else {
          paidSum += amt;
        }
      }

      // If the current payment type is ADVANCE, let's also increment advancePaid on the order
      const advanceSum = payments
        .filter((p) => p.paymentType === "ADVANCE")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const balanceDue = Number(order.totalAmount) - paidSum;

      // 3. Update the order
      const updatedOrder = await tx.tailorOrder.update({
        where: {
          id,
        },
        data: {
          balanceDue,
          advancePaid: advanceSum,
        },
        include: {
          payments: true,
          items: true,
        },
      });

      return updatedOrder;
    });

    return NextResponse.json(serializeData(result));
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
