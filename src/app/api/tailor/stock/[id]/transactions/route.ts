import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const stockId = params.id;

    // Verify stock exists under this tenant
    const stock = await prisma.clothStock.findFirst({
      where: {
        id: stockId,
        tenantId,
      },
    });

    if (!stock) {
      return NextResponse.json(
        { error: "Fabric stock not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const transactions = await prisma.stockTransaction.findMany({
      where: {
        clothStockId: stockId,
        tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(serializeData(transactions));
  } catch (error: any) {
    console.error("Error listing stock transactions:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
