import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // Get today's range in tenant's timezone (using UTC dates matching the day boundary)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Query all dashboard statistics in parallel to eliminate waterfalls
    const [queueCount, completedToday, revenueSum, claimedRequests] = await Promise.all([
      prisma.cscRequest.count({
        where: {
          tenantId,
          claimedByStaffId: null,
          status: "DOCS_APPROVED",
        },
      }),
      prisma.cscRequest.count({
        where: {
          tenantId,
          status: "COMPLETED",
          completedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      prisma.cscRequest.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          completedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        _sum: {
          priceCharged: true,
        },
      }),
      prisma.cscRequest.findMany({
        where: {
          tenantId,
          claimedByStaffId: { not: null },
        },
        select: {
          claimedByStaffId: true,
          status: true,
          priceCharged: true,
          completedAt: true,
        },
      }),
    ]);

    const revenueToday = Number(revenueSum._sum.priceCharged || 0);

    // Group and aggregate manually in memory for maximum flexibility and clean formatting
    const staffMap = new Map<string, { staffId: string; processingCount: number; completedCount: number; completedTodayCount: number; totalRevenue: number }>();

    for (const req of claimedRequests) {
      const staffId = req.claimedByStaffId!;
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staffId,
          processingCount: 0,
          completedCount: 0,
          completedTodayCount: 0,
          totalRevenue: 0,
        });
      }

      const stats = staffMap.get(staffId)!;
      if (req.status === "PROCESSING") {
        stats.processingCount += 1;
      } else if (req.status === "COMPLETED") {
        stats.completedCount += 1;
        stats.totalRevenue += Number(req.priceCharged);
        
        if (req.completedAt && req.completedAt >= todayStart && req.completedAt <= todayEnd) {
          stats.completedTodayCount += 1;
        }
      }
    }

    const staffPerformance = Array.from(staffMap.values());

    return NextResponse.json(
      serializeData({
        queueCount,
        completedToday,
        revenueToday,
        staffPerformance,
      })
    );
  } catch (error: any) {
    console.error("Error fetching CSC dashboard statistics:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
