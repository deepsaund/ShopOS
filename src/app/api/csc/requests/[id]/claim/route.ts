import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { notifyStatusChange } from "@/lib/notifications";

const claimSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;
    const body = await req.json();

    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { staffId } = parsed.data;

    // Perform atomic transaction with SELECT FOR UPDATE SKIP LOCKED
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // 1. Lock the row for update. If locked by another transaction, SKIP LOCKED will return nothing
      const lockedRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, claimed_by_staff_id, tenant_id FROM csc_requests WHERE id = $1 FOR UPDATE SKIP LOCKED`,
        id
      );

      if (!lockedRows || lockedRows.length === 0) {
        throw new Error("This request is currently being claimed by another staff member, or does not exist.");
      }

      const requestRow = lockedRows[0];

      if (requestRow.tenant_id !== tenantId) {
        throw new Error("Access denied: Request does not belong to this tenant");
      }

      if (requestRow.claimed_by_staff_id) {
        throw new Error("This request has already been claimed.");
      }

      // 2. Perform the update now that we have exclusive lock
      const updated = await tx.cscRequest.update({
        where: { id },
        data: {
          claimedByStaffId: staffId,
          status: "PROCESSING",
        },
      });

      return updated;
    });

    // Send notification about status update
    await notifyStatusChange(id);

    return NextResponse.json(serializeData(updatedRequest));
  } catch (error: any) {
    console.error("Error claiming request:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", code: "CLAIM_FAILED" },
      { status: 400 }
    );
  }
}
