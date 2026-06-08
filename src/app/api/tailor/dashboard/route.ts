import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // 1. Total orders grouped by status
    const ordersGrouped = await prisma.tailorOrder.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: {
        id: true,
      },
    });

    const totalOrdersByStatus: Record<string, number> = {
      TAKEN: 0,
      CUTTING: 0,
      STITCHING: 0,
      TRIAL: 0,
      READY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    for (const group of ordersGrouped) {
      totalOrdersByStatus[group.status] = group._count.id;
    }

    // 2. Low stock items (quantity_meters <= low_stock_threshold_meters)
    const allStock = await prisma.clothStock.findMany({
      where: { tenantId },
      include: {
        supplier: {
          select: {
            name: true,
          },
        },
      },
    });

    const lowStockItems = allStock
      .filter((stock) => Number(stock.quantityMeters) <= Number(stock.lowStockThresholdMeters))
      .map((stock) => ({
        id: stock.id,
        fabricName: stock.fabricName,
        fabricType: stock.fabricType,
        color: stock.color,
        quantityMeters: Number(stock.quantityMeters),
        lowStockThresholdMeters: Number(stock.lowStockThresholdMeters),
        supplierName: stock.supplier.name,
      }));

    // 3. Today's deliveries due (delivery_date is today)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysDeliveries = await prisma.tailorOrder.findMany({
      where: {
        tenantId,
        deliveryDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: {
          not: "CANCELLED",
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        deliveryDate: "asc",
      },
    });

    // 4. Pending balance amount (total balance_due for all non-cancelled orders)
    const balanceAggregate = await prisma.tailorOrder.aggregate({
      where: {
        tenantId,
        status: {
          not: "CANCELLED",
        },
      },
      _sum: {
        balanceDue: true,
      },
    });

    const pendingBalanceAmount = Number(balanceAggregate._sum.balanceDue || 0);

    const dashboardData = {
      totalOrdersByStatus,
      lowStockItemsCount: lowStockItems.length,
      lowStockItems,
      todaysDeliveriesCount: todaysDeliveries.length,
      todaysDeliveries,
      pendingBalanceAmount,
    };

    return NextResponse.json(serializeData(dashboardData));
  } catch (error: any) {
    console.error("Error generating dashboard metrics:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
