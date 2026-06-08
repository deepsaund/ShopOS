import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const purchaseItemSchema = z.object({
  skuId: z.string().uuid("Invalid SKU ID"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  costPricePerUnit: z.number().positive("Cost price must be positive"),
});

const createPurchaseSchema = z.object({
  supplierId: z.string().uuid("Invalid Supplier ID"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  purchaseDate: z.string().datetime({ message: "Invalid purchase date format" }),
  totalAmount: z.number().positive("Total amount must be positive"),
  notes: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "Purchase must have at least one item"),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createPurchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { supplierId, invoiceNumber, purchaseDate, totalAmount, notes, items } = parsed.data;

    // Verify supplier exists and belongs to the tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify all SKUs belong to the tenant
    const skuIds = items.map((item) => item.skuId);
    const skus = await prisma.shoeSKU.findMany({
      where: {
        id: { in: skuIds },
        tenantId,
      },
    });

    if (skus.length !== items.length) {
      return NextResponse.json(
        { error: "One or more SKUs are invalid or do not belong to this tenant", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Process purchase in a transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase record
      const purchaseRecord = await tx.shoePurchase.create({
        data: {
          tenantId,
          supplierId,
          invoiceNumber,
          purchaseDate: new Date(purchaseDate),
          totalAmount,
          notes: notes || null,
        },
      });

      // 2. Process items
      for (const item of items) {
        // Create purchase item
        await tx.shoePurchaseItem.create({
          data: {
            purchaseId: purchaseRecord.id,
            skuId: item.skuId,
            quantity: item.quantity,
            costPricePerUnit: item.costPricePerUnit,
          },
        });

        // Increment SKU stock
        await tx.shoeSKU.update({
          where: { id: item.skuId },
          data: {
            quantityInStock: {
              increment: item.quantity,
            },
          },
        });
      }

      // Fetch complete purchase details
      return tx.shoePurchase.findUnique({
        where: { id: purchaseRecord.id },
        include: {
          items: {
            include: {
              sku: {
                include: {
                  product: true,
                },
              },
            },
          },
          supplier: true,
        },
      });
    });

    return NextResponse.json(serializeData(purchase), { status: 201 });
  } catch (error: any) {
    console.error("Error recording purchase:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
