import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { OrderStatus, GarmentType, PaymentMode } from "@prisma/client";

export const dynamic = "force-dynamic";

const orderItemSchema = z.object({
  garmentType: z.nativeEnum(GarmentType),
  clothStockId: z.string().optional().nullable(),
  fabricMetersUsed: z.number().positive("Fabric meters used must be positive").optional().nullable(),
  itemPrice: z.number().positive("Item price must be positive"),
  customNotes: z.string().optional().nullable(),
});

const createOrderSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  totalAmount: z.number().positive("Total amount must be positive"),
  advancePaid: z.number().nonnegative("Advance paid must be non-negative").optional().default(0),
  advancePaymentMode: z.nativeEnum(PaymentMode).optional().default("CASH"),
  specialInstructions: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, "At least one garment item is required"),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      customerId,
      deliveryDate,
      totalAmount,
      advancePaid,
      advancePaymentMode,
      specialInstructions,
      items,
    } = parsed.data;

    // 1. Verify customer exists under this tenant
    const customer = await prisma.tailorCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const currentYear = new Date().getFullYear();
    const prefix = `ORD-${currentYear}-`;

    // 2. Perform database operations inside a transaction to ensure integrity and safety
    const order = await prisma.$transaction(async (tx) => {
      // Find the latest order for this tenant and this year to generate the next sequence number
      const lastOrder = await tx.tailorOrder.findFirst({
        where: {
          tenantId,
          orderNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          orderNumber: "desc",
        },
        select: {
          orderNumber: true,
        },
      });

      let sequence = 1;
      if (lastOrder && lastOrder.orderNumber) {
        const parts = lastOrder.orderNumber.split("-");
        const lastSeq = parseInt(parts[2] || "0");
        if (!isNaN(lastSeq)) {
          sequence = lastSeq + 1;
        }
      }

      const orderNumber = `${prefix}${String(sequence).padStart(4, "0")}`;
      const balanceDue = totalAmount - advancePaid;

      // Create Order
      const newOrder = await tx.tailorOrder.create({
        data: {
          tenantId,
          customerId,
          orderNumber,
          status: "TAKEN",
          deliveryDate: new Date(deliveryDate),
          totalAmount,
          advancePaid,
          balanceDue,
          specialInstructions,
        },
      });

      // Create Order Items and update Stock + create StockTransactions
      for (const item of items) {
        const orderItem = await tx.tailorOrderItem.create({
          data: {
            orderId: newOrder.id,
            garmentType: item.garmentType,
            clothStockId: item.clothStockId,
            fabricMetersUsed: item.fabricMetersUsed,
            itemPrice: item.itemPrice,
            customNotes: item.customNotes,
          },
        });

        // If a cloth stock was used, deduct from stock and add OUT transaction
        if (item.clothStockId && item.fabricMetersUsed && item.fabricMetersUsed > 0) {
          const stock = await tx.clothStock.findFirst({
            where: { id: item.clothStockId, tenantId },
          });

          if (!stock) {
            throw new Error(`Cloth stock with ID ${item.clothStockId} not found under tenant.`);
          }

          // Deduct quantity
          await tx.clothStock.update({
            where: { id: item.clothStockId },
            data: {
              quantityMeters: {
                decrement: item.fabricMetersUsed,
              },
            },
          });

          // Create stock transaction
          await tx.stockTransaction.create({
            data: {
              tenantId,
              clothStockId: item.clothStockId,
              transactionType: "OUT",
              quantityMeters: item.fabricMetersUsed,
              referenceType: "ORDER_USAGE",
              referenceId: newOrder.id,
              notes: `Fabric deduction for item: ${item.garmentType} in order ${orderNumber}`,
            },
          });
        }
      }

      // If advance payment was made, log it
      if (advancePaid > 0) {
        await tx.payment.create({
          data: {
            tenantId,
            orderId: newOrder.id,
            amount: advancePaid,
            paymentMode: advancePaymentMode,
            paymentType: "ADVANCE",
            notes: `Advance payment for order ${orderNumber}`,
          },
        });
      }

      // Fetch complete created order details
      return tx.tailorOrder.findUnique({
        where: { id: newOrder.id },
        include: {
          items: {
            include: {
              clothStock: true,
            },
          },
          payments: true,
        },
      });
    });

    return NextResponse.json(serializeData(order), { status: 201 });
  } catch (error: any) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", code: "INTERNAL_ERROR" },
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

    const status = searchParams.get("status") as OrderStatus | null;
    const customerId = searchParams.get("customerId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const whereClause: any = {
      tenantId,
    };

    if (status) {
      whereClause.status = status;
    }

    if (customerId) {
      whereClause.customerId = customerId;
    }

    if (startDate || endDate) {
      whereClause.deliveryDate = {};
      if (startDate) {
        whereClause.deliveryDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.deliveryDate.lte = new Date(endDate);
      }
    }

    const [orders, total] = await prisma.$transaction([
      prisma.tailorOrder.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          items: {
            include: {
              clothStock: true,
            },
          },
          payments: true,
        },
        skip,
        take: limit,
      }),
      prisma.tailorOrder.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      data: serializeData(orders),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing orders:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
