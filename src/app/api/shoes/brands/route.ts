import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  logoUrl: z.string().url("Invalid logo URL").optional().or(z.literal("").or(z.null())),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createBrandSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, logoUrl } = parsed.data;

    const brand = await prisma.shoeBrand.create({
      data: {
        tenantId,
        name,
        logoUrl: logoUrl || null,
      },
    });

    return NextResponse.json(serializeData(brand), { status: 201 });
  } catch (error: any) {
    console.error("Error creating shoe brand:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const brands = await prisma.shoeBrand.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeData(brands));
  } catch (error: any) {
    console.error("Error listing shoe brands:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

