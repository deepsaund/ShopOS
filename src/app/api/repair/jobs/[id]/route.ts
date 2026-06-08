import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { JobStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateJobSchema = z.object({
  diagnosedIssue: z.string().optional().nullable(),
  status: z.nativeEnum(JobStatus).optional(),
  estimatedCost: z.number().nonnegative().optional(),
  finalCost: z.number().nonnegative().optional(),
  assignedToStaff: z.string().optional(),
  deviceConditionOnReceipt: z.string().optional(),
  warrantyDays: z.number().int().nonnegative().optional(),
  deliveryDate: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;

    const job = await prisma.jobCard.findFirst({
      where: { id, tenantId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        partsUsed: {
          include: {
            repairPart: true,
          },
        },
        payments: true,
        warrantyParent: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            deviceBrand: true,
            deviceModel: true,
          },
        },
        warrantyClaims: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job card not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Compute isUnderWarranty
    let isUnderWarranty = false;
    if (job.status === "DELIVERED" && job.deliveredAt && job.warrantyDays > 0) {
      const today = new Date();
      const warrantyExpiry = new Date(job.deliveredAt);
      warrantyExpiry.setDate(warrantyExpiry.getDate() + job.warrantyDays);
      isUnderWarranty = warrantyExpiry > today;
    }

    return NextResponse.json(serializeData({
      ...job,
      isUnderWarranty,
    }));
  } catch (error: any) {
    console.error("Error fetching job card:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;
    const body = await req.json();

    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      diagnosedIssue,
      status,
      estimatedCost,
      finalCost,
      assignedToStaff,
      deviceConditionOnReceipt,
      warrantyDays,
      deliveryDate,
    } = parsed.data;

    // Fetch existing job card with payments
    const existingJob = await prisma.jobCard.findFirst({
      where: { id, tenantId },
      include: {
        payments: true,
      },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "Job card not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
      const updateData: any = {};

      if (diagnosedIssue !== undefined) updateData.diagnosedIssue = diagnosedIssue;
      if (status !== undefined) {
        updateData.status = status;
        if (status === "DELIVERED" && existingJob.status !== "DELIVERED") {
          updateData.deliveredAt = new Date();
        }
      }
      if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost;
      if (finalCost !== undefined) updateData.finalCost = finalCost;
      if (assignedToStaff !== undefined) updateData.assignedToStaff = assignedToStaff;
      if (deviceConditionOnReceipt !== undefined) updateData.deviceConditionOnReceipt = deviceConditionOnReceipt;
      if (warrantyDays !== undefined) updateData.warrantyDays = warrantyDays;
      if (deliveryDate !== undefined) updateData.deliveryDate = new Date(deliveryDate);

      // Re-calculate balance due
      const activeFinalCost = finalCost !== undefined ? finalCost : Number(existingJob.finalCost);
      const activeEstimatedCost = estimatedCost !== undefined ? estimatedCost : Number(existingJob.estimatedCost);
      
      const paymentsSum = existingJob.payments.reduce((sum, p) => {
        if (p.paymentType === "REFUND") {
          return sum - Number(p.amount);
        }
        return sum + Number(p.amount);
      }, 0);

      const resolvedCost = activeFinalCost > 0 ? activeFinalCost : activeEstimatedCost;
      updateData.balanceDue = resolvedCost - paymentsSum;

      return tx.jobCard.update({
        where: { id },
        data: updateData,
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
    });

    return NextResponse.json(serializeData(updatedJob));
  } catch (error: any) {
    console.error("Error updating job card:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
