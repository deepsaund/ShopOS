import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);

    // Unclaimed queue consists of requests that are DOCS_APPROVED (all docs reviewed and approved)
    // and have not been claimed by any staff yet.
    const unclaimedQueue = await prisma.cscRequest.findMany({
      where: {
        tenantId,
        claimedByStaffId: null,
        status: "DOCS_APPROVED",
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: true,
        service: true,
        documents: true,
      },
    });

    return NextResponse.json(serializeData(unclaimedQueue));
  } catch (error: any) {
    console.error("Error fetching CSC request queue:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
