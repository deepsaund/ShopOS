import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { ShoeCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

const createSkuSchema = z.object({
  size: z.string().min(1, "Size is required"),
  color: z.string().min(1, "Color is required"),
  quantityInStock: z.number().int().nonnegative("Quantity cannot be negative"),
  mrp: z.number().positive("MRP must be positive"),
  sellingPrice: z.number().positive("Selling price must be positive"),
  costPrice: z.number().positive("Cost price must be positive"),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  barcode: z.string().optional().nullable(),
});

const createProductSchema = z.object({
  brandId: z.string().uuid("Invalid Brand ID"),
  modelName: z.string().min(1, "Model name is required"),
  category: z.nativeEnum(ShoeCategory),
  description: z.string().optional().nullable(),
  images: z.array(z.string().url("Invalid image URL")).optional().default([]),
  skus: z.array(createSkuSchema).min(1, "At least one SKU variant is required"),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { brandId, modelName, category, description, images, skus } = parsed.data;

    // Verify brand exists and belongs to the tenant
    const brand = await prisma.shoeBrand.findFirst({
      where: { id: brandId, tenantId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: "Shoe brand not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Create product with nested SKUs
    const product = await prisma.shoeProduct.create({
      data: {
        tenantId,
        brandId,
        modelName,
        category,
        description: description || null,
        images,
        skus: {
          create: skus.map((sku) => ({
            tenantId,
            size: sku.size,
            color: sku.color,
            quantityInStock: sku.quantityInStock,
            mrp: sku.mrp,
            sellingPrice: sku.sellingPrice,
            costPrice: sku.costPrice,
            lowStockThreshold: sku.lowStockThreshold ?? 3,
            barcode: sku.barcode || null,
          })),
        },
      },
      include: {
        brand: true,
        skus: true,
      },
    });

    return NextResponse.json(serializeData(product), { status: 201 });
  } catch (error: any) {
    console.error("Error creating product:", error);
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

    const brandId = searchParams.get("brandId") || undefined;
    const category = searchParams.get("category") as ShoeCategory | null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const whereClause: any = {
      tenantId,
    };

    if (brandId) {
      whereClause.brandId = brandId;
    }

    if (category && Object.values(ShoeCategory).includes(category)) {
      whereClause.category = category;
    }

    if (search) {
      whereClause.modelName = { contains: search, mode: "insensitive" };
    }

    const [products, total] = await prisma.$transaction([
      prisma.shoeProduct.findMany({
        where: whereClause,
        include: {
          brand: true,
          skus: true,
        },
        orderBy: { modelName: "asc" },
        skip,
        take: limit,
      }),
      prisma.shoeProduct.count({
        where: whereClause,
      }),
    ]);

    // Map to include stock summary
    const formattedProducts = products.map((product) => {
      const totalStock = product.skus.reduce((sum, sku) => sum + sku.quantityInStock, 0);
      const sizes = Array.from(new Set(product.skus.map((s) => s.size)));
      const colors = Array.from(new Set(product.skus.map((s) => s.color)));

      return {
        id: product.id,
        tenantId: product.tenantId,
        brandId: product.brandId,
        modelName: product.modelName,
        category: product.category,
        description: product.description,
        images: product.images,
        brand: {
          id: product.brand.id,
          name: product.brand.name,
          logoUrl: product.brand.logoUrl,
        },
        totalStock,
        sizes,
        colors,
      };
    });

    return NextResponse.json({
      data: serializeData(formattedProducts),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing products:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
