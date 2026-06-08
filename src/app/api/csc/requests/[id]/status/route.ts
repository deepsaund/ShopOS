import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { CscRequestStatus } from "@prisma/client";
import { notifyStatusChange } from "@/lib/notifications";

const statusSchema = z.object({
  status: z.nativeEnum(CscRequestStatus),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id } = params;
    const body = await req.json();

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    // Verify request exists under tenant
    const request = await prisma.cscRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found", code: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    const completedAt = status === "COMPLETED" ? new Date() : null;

    const updated = await prisma.cscRequest.update({
      where: { id },
      data: {
        status,
        completedAt,
      },
    });

    // Notify user of status change
    await notifyStatusChange(id);

    return NextResponse.json(serializeData(updated));
  } catch (error: any) {
    console.error("Error updating request status:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
