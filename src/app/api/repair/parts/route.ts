import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const partSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().min(1, "Part number is required"),
  compatibleDevices: z.string().min(1, "Compatible devices description is required"),
  quantityInStock: z.number().int().nonnegative("Quantity must be non-negative"),
  costPrice: z.number().positive("Cost price must be positive"),
  sellingPrice: z.number().positive("Selling price must be positive"),
  lowStockThreshold: z.number().int().positive("Low stock threshold must be positive").optional().default(5),
});

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const searchParams = req.nextUrl.searchParams;

    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (search) {
      where.OR = [
        { partName: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
        { compatibleDevices: { contains: search, mode: "insensitive" } },
      ];
    }

    const [parts, total] = await prisma.$transaction([
      prisma.repairPart.findMany({
        where,
        orderBy: { partName: "asc" },
        skip,
        take: limit,
      }),
      prisma.repairPart.count({ where }),
    ]);

    return NextResponse.json({
      data: serializeData(parts),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing repair parts:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = partSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      partName,
      partNumber,
      compatibleDevices,
      quantityInStock,
      costPrice,
      sellingPrice,
      lowStockThreshold,
    } = parsed.data;

    // Check duplicate part number
    const existing = await prisma.repairPart.findFirst({
      where: { tenantId, partNumber },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A part with this part number already exists", code: "PART_EXISTS" },
        { status: 400 }
      );
    }

    const part = await prisma.repairPart.create({
      data: {
        tenantId,
        partName,
        partNumber,
        compatibleDevices,
        quantityInStock,
        costPrice,
        sellingPrice,
        lowStockThreshold,
      },
    });

    return NextResponse.json(serializeData(part), { status: 201 });
  } catch (error: any) {
    console.error("Error creating repair part:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
