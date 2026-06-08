import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // Fetch parts where quantityInStock <= lowStockThreshold
    const allParts = await prisma.repairPart.findMany({
      where: { tenantId },
    });

    const lowStockParts = allParts.filter(
      (part) => part.quantityInStock <= part.lowStockThreshold
    );

    return NextResponse.json(serializeData(lowStockParts));
  } catch (error: any) {
    console.error("Error fetching low stock parts:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
