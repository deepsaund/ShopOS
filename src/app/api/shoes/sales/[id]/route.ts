import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;

    const sale = await prisma.shoeSale.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        items: {
          include: {
            sku: {
              include: {
                product: {
                  include: {
                    brand: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Sale record not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const profit = sale.items.reduce((sum, item) => {
      const cost = Number(item.sku.costPrice);
      const salePrice = Number(item.pricePerUnit);
      return sum + (salePrice - cost) * item.quantity;
    }, 0);

    const responseData = {
      ...sale,
      profit,
    };

    return NextResponse.json(serializeData(responseData));
  } catch (error: any) {
    console.error("Error fetching sale details:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
