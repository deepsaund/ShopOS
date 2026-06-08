import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;

    const customer = await prisma.shoeCustomer.findFirst({
      where: { id, tenantId },
      include: {
        udhaarLedgers: {
          orderBy: { createdAt: "desc" },
        },
        sales: {
          orderBy: { saleDate: "desc" },
          include: {
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
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeData(customer));
  } catch (error: any) {
    console.error("Error retrieving customer profile:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
