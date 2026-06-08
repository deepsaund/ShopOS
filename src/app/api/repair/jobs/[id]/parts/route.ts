import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const addPartSchema = z.object({
  partId: z.string().min(1, "Part ID is required"),
  quantityUsed: z.number().int().positive("Quantity used must be positive"),
  priceCharged: z.number().nonnegative("Price charged must be non-negative"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id: jobId } = params;
    const body = await req.json();

    const parsed = addPartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { partId, quantityUsed, priceCharged } = parsed.data;

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

    // 2. Verify part exists and has enough stock
    const part = await prisma.repairPart.findFirst({
      where: { id: partId, tenantId },
    });

    if (!part) {
      return NextResponse.json(
        { error: "Repair part not found in inventory", code: "PART_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (part.quantityInStock < quantityUsed) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${part.quantityInStock}`, code: "OUT_OF_STOCK" },
        { status: 400 }
      );
    }

    // 3. Perform inventory deduction, job card part creation, and update costs in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create JobCardPart
      const jobCardPart = await tx.jobCardPart.create({
        data: {
          jobId,
          partId,
          quantityUsed,
          priceCharged,
        },
      });

      // Deduct from stock
      await tx.repairPart.update({
        where: { id: partId },
        data: {
          quantityInStock: {
            decrement: quantityUsed,
          },
        },
      });

      // Update JobCard costs
      const incrementAmount = priceCharged * quantityUsed;
      // If finalCost is 0, base it on estimatedCost + parts cost. Otherwise finalCost + parts cost.
      const currentFinal = Number(job.finalCost);
      const baseCost = currentFinal > 0 ? currentFinal : Number(job.estimatedCost);
      const newFinalCost = baseCost + incrementAmount;

      // Re-sum payments
      const paymentsSum = job.payments.reduce((sum, p) => {
        if (p.paymentType === "REFUND") {
          return sum - Number(p.amount);
        }
        return sum + Number(p.amount);
      }, 0);

      const newBalanceDue = newFinalCost - paymentsSum;

      const updatedJob = await tx.jobCard.update({
        where: { id: jobId },
        data: {
          finalCost: newFinalCost,
          balanceDue: newBalanceDue,
        },
        include: {
          partsUsed: {
            include: {
              repairPart: true,
            },
          },
          payments: true,
        },
      });

      return { jobCardPart, job: updatedJob };
    });

    return NextResponse.json(serializeData(result), { status: 201 });
  } catch (error: any) {
    console.error("Error adding part to job card:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
