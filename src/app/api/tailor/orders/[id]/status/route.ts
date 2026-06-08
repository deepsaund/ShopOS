import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const id = params.id;
    const body = await req.json();

    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    const existingOrder = await prisma.tailorOrder.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const updatedOrder = await prisma.tailorOrder.update({
      where: {
        id,
      },
      data: {
        status,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: true,
        payments: true,
      },
    });

    return NextResponse.json(serializeData(updatedOrder));
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
