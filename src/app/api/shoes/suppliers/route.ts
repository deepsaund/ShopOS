import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeData(suppliers));
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
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
    const { name, phone, address, gstNumber } = body;

    if (!name || !phone || !address) {
      return NextResponse.json(
        { error: "Name, phone, and address are required fields", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name,
        phone,
        address,
        gstNumber: gstNumber || null,
      },
    });

    return NextResponse.json(serializeData(supplier), { status: 201 });
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
