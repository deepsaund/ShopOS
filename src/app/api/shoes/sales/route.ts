import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { ShoePaymentMode, UdhaarTransactionType } from "@prisma/client";

export const dynamic = "force-dynamic";

const saleItemSchema = z.object({
  skuId: z.string().uuid("Invalid SKU ID"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  pricePerUnit: z.number().positive("Price per unit must be positive"),
  discountPerUnit: z.number().nonnegative("Discount per unit cannot be negative"),
});

const createSaleSchema = z.object({
  customerId: z.string().uuid("Invalid Customer ID").optional().nullable(),
  saleDate: z.string().datetime({ message: "Invalid sale date format" }),
  totalMrp: z.number().positive("Total MRP must be positive"),
  discount: z.number().nonnegative("Discount cannot be negative"),
  totalAmount: z.number().positive("Total amount must be positive"),
  paymentMode: z.nativeEnum(ShoePaymentMode),
  amountPaid: z.number().nonnegative("Amount paid cannot be negative"),
  amountPending: z.number().nonnegative("Amount pending cannot be negative"),
  servedBy: z.string().min(1, "Served by employee name is required"),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "Sale must have at least one item"),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      customerId,
      saleDate,
      totalMrp,
      discount,
      totalAmount,
      paymentMode,
      amountPaid,
      amountPending,
      servedBy,
      notes,
      items,
    } = parsed.data;

    // Check if customer ID is supplied when transaction has a pending balance (Udhaar/Partial)
    if ((paymentMode === ShoePaymentMode.UDHAAR || amountPending > 0) && !customerId) {
      return NextResponse.json(
        { error: "Customer ID is required for sales with a pending udhaar balance", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Verify all SKUs belong to the tenant and check stock
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

    // Pre-verify stock to avoid failing in transaction
    for (const item of items) {
      const sku = skus.find((s) => s.id === item.skuId)!;
      if (sku.quantityInStock < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for variant ${sku.color} / Size ${sku.size}. Available: ${sku.quantityInStock}, requested: ${item.quantity}`,
            code: "INSUFFICIENT_STOCK",
          },
          { status: 400 }
        );
      }
    }

    // Run transaction
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Create Sale record
      const saleRecord = await tx.shoeSale.create({
        data: {
          tenantId,
          customerId: customerId || null,
          saleDate: new Date(saleDate),
          totalMrp,
          discount,
          totalAmount,
          paymentMode,
          amountPaid,
          amountPending,
          servedBy,
          notes: notes || null,
        },
      });

      // 2. Create Sale Items and update SKU stock levels
      for (const item of items) {
        await tx.shoeSaleItem.create({
          data: {
            saleId: saleRecord.id,
            skuId: item.skuId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            discountPerUnit: item.discountPerUnit,
          },
        });

        // Decrement stock
        await tx.shoeSKU.update({
          where: { id: item.skuId },
          data: {
            quantityInStock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 3. Handle Udhaar ledger logging and running total updates
      if (customerId && amountPending > 0) {
        await tx.udhaarLedger.create({
          data: {
            tenantId,
            customerId,
            transactionType: UdhaarTransactionType.CREDIT,
            amount: amountPending,
            saleId: saleRecord.id,
            notes: `Udhaar generated from sale invoice: ${saleRecord.id}`,
          },
        });

        await tx.shoeCustomer.update({
          where: { id: customerId },
          data: {
            totalUdhaarBalance: {
              increment: amountPending,
            },
          },
        });
      }

      // Return complete sale object
      return tx.shoeSale.findUnique({
        where: { id: saleRecord.id },
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
          customer: true,
        },
      });
    });

    // Calculate profit
    const profit = sale!.items.reduce((sum, item) => {
      const cost = Number(item.sku.costPrice);
      const salePrice = Number(item.pricePerUnit);
      return sum + (salePrice - cost) * item.quantity;
    }, 0);

    const responseData = {
      ...sale,
      profit,
    };

    return NextResponse.json(serializeData(responseData), { status: 201 });
  } catch (error: any) {
    console.error("Error creating sale:", error);
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

    const customerId = searchParams.get("customerId") || undefined;
    const paymentMode = searchParams.get("paymentMode") as ShoePaymentMode | null;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));

    const skip = (page - 1) * limit;

    const whereClause: any = {
      tenantId,
    };

    if (customerId) {
      whereClause.customerId = customerId;
    }

    if (paymentMode && Object.values(ShoePaymentMode).includes(paymentMode)) {
      whereClause.paymentMode = paymentMode;
    }

    if (startDateStr || endDateStr) {
      whereClause.saleDate = {};
      if (startDateStr) {
        whereClause.saleDate.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        whereClause.saleDate.lte = new Date(endDateStr);
      }
    }

    const [sales, total] = await prisma.$transaction([
      prisma.shoeSale.findMany({
        where: whereClause,
        include: {
          customer: true,
          items: {
            include: {
              sku: true,
            },
          },
        },
        orderBy: { saleDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.shoeSale.count({
        where: whereClause,
      }),
    ]);

    // Format with profit calculations
    const formattedSales = sales.map((sale) => {
      const profit = sale.items.reduce((sum, item) => {
        const cost = Number(item.sku.costPrice);
        const salePrice = Number(item.pricePerUnit);
        return sum + (salePrice - cost) * item.quantity;
      }, 0);

      return {
        ...sale,
        profit,
      };
    });

    return NextResponse.json({
      data: serializeData(formattedSales),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing sales:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
