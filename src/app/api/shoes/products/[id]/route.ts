import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const updateSkusSchema = z.object({
  skus: z.array(
    z.object({
      id: z.string().uuid(),
      quantityInStock: z.number().int().nonnegative(),
    })
  ),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;

    const product = await prisma.shoeProduct.findFirst({
      where: { id, tenantId },
      include: {
        brand: true,
        skus: {
          orderBy: { size: "asc" },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeData(product));
  } catch (error: any) {
    console.error("Error retrieving product details:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const productId = params.id;
    const body = await req.json();

    const parsed = updateSkusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { skus } = parsed.data;

    // Verify all SKUs belong to this product and tenant
    const skuIds = skus.map((s) => s.id);
    const existingSkus = await prisma.shoeSKU.findMany({
      where: {
        id: { in: skuIds },
        productId,
        tenantId,
      },
    });

    if (existingSkus.length !== skus.length) {
      return NextResponse.json(
        { error: "One or more SKUs are invalid for this product", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(
      skus.map((item) =>
        prisma.shoeSKU.update({
          where: { id: item.id },
          data: { quantityInStock: item.quantityInStock },
        })
      )
    );

    return NextResponse.json(serializeData(updated));
  } catch (error: any) {
    console.error("Error updating SKU stock:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

