import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // Fetch all SKUs for the tenant along with product and brand details
    const allSkus = await prisma.shoeSKU.findMany({
      where: { tenantId },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
      orderBy: {
        product: {
          modelName: "asc",
        },
      },
    });

    // Filter SKUs whose quantity in stock is at or below the low stock threshold
    const lowStockSkus = allSkus.filter(
      (sku) => sku.quantityInStock <= sku.lowStockThreshold
    );

    return NextResponse.json(serializeData(lowStockSkus));
  } catch (error: any) {
    console.error("Error fetching low stock SKUs:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
