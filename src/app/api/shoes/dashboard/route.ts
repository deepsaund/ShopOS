import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // Get time bounds for today (local server time)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Fetch sales recorded today
    const salesToday = await prisma.shoeSale.findMany({
      where: {
        tenantId,
        saleDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      include: {
        items: true,
      },
    });

    const todaySalesTotal = salesToday.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const todayUnitsSold = salesToday.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );

    // 2. Count low stock SKUs
    const allSkus = await prisma.shoeSKU.findMany({
      where: { tenantId },
      select: {
        quantityInStock: true,
        lowStockThreshold: true,
      },
    });
    const lowStockCount = allSkus.filter(
      (sku) => sku.quantityInStock <= sku.lowStockThreshold
    ).length;

    // 3. Sum total outstanding udhaar balance
    const udhaarAggregate = await prisma.shoeCustomer.aggregate({
      where: { tenantId },
      _sum: {
        totalUdhaarBalance: true,
      },
    });
    const pendingUdhaarTotal = Number(udhaarAggregate._sum.totalUdhaarBalance || 0);

    // 4. Calculate top-selling sizes today
    const saleItemsToday = await prisma.shoeSaleItem.findMany({
      where: {
        sale: {
          tenantId,
          saleDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      },
      include: {
        sku: {
          select: {
            size: true,
          },
        },
      },
    });

    const sizeCounts: Record<string, number> = {};
    for (const item of saleItemsToday) {
      const size = item.sku.size;
      sizeCounts[size] = (sizeCounts[size] || 0) + item.quantity;
    }

    const topSellingSizesToday = Object.entries(sizeCounts)
      .map(([size, quantity]) => ({ size, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    const dashboardData = {
      todaySalesTotal,
      todayUnitsSold,
      lowStockCount,
      pendingUdhaarTotal,
      topSellingSizesToday,
    };

    return NextResponse.json(serializeData(dashboardData));
  } catch (error: any) {
    console.error("Error generating shoe dashboard metrics:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
