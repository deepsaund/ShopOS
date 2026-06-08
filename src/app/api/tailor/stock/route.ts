import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const createStockSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required"),
  fabricName: z.string().min(1, "Fabric name is required"),
  fabricType: z.string().min(1, "Fabric type is required"),
  color: z.string().min(1, "Color is required"),
  pattern: z.string().optional().nullable(),
  quantityMeters: z.number().positive("Quantity must be positive"),
  ratePerMeter: z.number().positive("Rate must be positive"),
  lowStockThresholdMeters: z.number().nonnegative("Low stock threshold must be non-negative"),
  receivedDate: z.string().optional().nullable(), // ISO date string
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createStockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      supplierId,
      fabricName,
      fabricType,
      color,
      pattern,
      quantityMeters,
      ratePerMeter,
      lowStockThresholdMeters,
      receivedDate,
    } = parsed.data;

    // Verify supplier exists under this tenant
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found", code: "SUPPLIER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Execute in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create ClothStock
      const stock = await tx.clothStock.create({
        data: {
          tenantId,
          supplierId,
          fabricName,
          fabricType,
          color,
          pattern,
          quantityMeters,
          ratePerMeter,
          lowStockThresholdMeters,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        },
      });

      // 2. Create StockTransaction (IN)
      const purchaseId = `PUR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await tx.stockTransaction.create({
        data: {
          tenantId,
          clothStockId: stock.id,
          transactionType: "IN",
          quantityMeters,
          referenceType: "PURCHASE",
          referenceId: purchaseId,
          notes: `Initial stock intake for fabric: ${fabricName}`,
        },
      });

      return stock;
    });

    return NextResponse.json(serializeData(result), { status: 201 });
  } catch (error: any) {
    console.error("Error creating stock:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const searchParams = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    // 1. Get all stock items for the tenant (paginated)
    const [stockItems, total] = await prisma.$transaction([
      prisma.clothStock.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.clothStock.count({
        where: { tenantId },
      }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 2. Process predictions and low-stock flags
    const processedData = await Promise.all(
      stockItems.map(async (stock) => {
        const quantityMeters = Number(stock.quantityMeters);
        const threshold = Number(stock.lowStockThresholdMeters);
        const isLowStock = quantityMeters <= threshold;

        // Stock prediction: calculate average meters used per order in the last 30 days
        const orderItems = await prisma.tailorOrderItem.findMany({
          where: {
            clothStockId: stock.id,
            order: {
              tenantId,
              createdAt: {
                gte: thirtyDaysAgo,
              },
            },
          },
          select: {
            fabricMetersUsed: true,
            orderId: true,
          },
        });

        const totalMetersUsedLast30Days = orderItems.reduce(
          (sum, item) => sum + (item.fabricMetersUsed ? Number(item.fabricMetersUsed) : 0),
          0
        );

        const uniqueOrdersCount = new Set(orderItems.map((item) => item.orderId)).size;
        const avgMetersPerOrder = uniqueOrdersCount > 0 ? totalMetersUsedLast30Days / uniqueOrdersCount : 0;
        const estimatedOrdersRemaining = avgMetersPerOrder > 0 ? Math.floor(quantityMeters / avgMetersPerOrder) : null;

        return {
          ...stock,
          isLowStock,
          prediction: {
            avgMetersPerOrderLast30Days: avgMetersPerOrder,
            totalMetersUsedLast30Days,
            orderCountLast30Days: uniqueOrdersCount,
            estimatedOrdersRemaining, // null indicates no historical data
          },
        };
      })
    );

    return NextResponse.json({
      data: serializeData(processedData),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing stock:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
