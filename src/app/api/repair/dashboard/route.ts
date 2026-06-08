import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // 1. Group active jobs by status
    const jobsGrouped = await prisma.jobCard.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: {
        id: true,
      },
    });

    const statusCounts: Record<string, number> = {
      RECEIVED: 0,
      DIAGNOSING: 0,
      WAITING_FOR_PARTS: 0,
      REPAIRING: 0,
      READY: 0,
      DELIVERED: 0,
      UNREPAIRABLE: 0,
      RETURNED_UNREPAIRED: 0,
    };

    for (const group of jobsGrouped) {
      statusCounts[group.status] = group._count.id;
    }

    // 2. Count ready for pickup (READY status)
    const readyForPickupCount = statusCounts["READY"] || 0;

    // 3. Pending collections (total balance_due for all jobs that are not DELIVERED or RETURNED_UNREPAIRED or RETURNED)
    const activeJobsBalance = await prisma.jobCard.aggregate({
      where: {
        tenantId,
        status: {
          notIn: ["DELIVERED", "RETURNED_UNREPAIRED"],
        },
        balanceDue: {
          gt: 0,
        },
      },
      _sum: {
        balanceDue: true,
      },
    });

    const pendingCollections = Number(activeJobsBalance._sum.balanceDue || 0);

    // 4. Low stock parts count (quantityInStock <= lowStockThreshold)
    const allParts = await prisma.repairPart.findMany({
      where: { tenantId },
      select: {
        id: true,
        quantityInStock: true,
        lowStockThreshold: true,
      },
    });

    const lowStockCount = allParts.filter(
      (part) => part.quantityInStock <= part.lowStockThreshold
    ).length;

    const dashboardMetrics = {
      statusCounts,
      readyForPickupCount,
      pendingCollections,
      lowStockCount,
    };

    return NextResponse.json(serializeData(dashboardMetrics));
  } catch (error: any) {
    console.error("Error generating repair dashboard metrics:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
