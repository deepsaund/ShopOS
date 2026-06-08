import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";

const createMessageSchema = z.object({
  senderId: z.string().min(1, "Sender ID is required"),
  senderRole: z.string().min(1, "Sender role is required"),
  content: z.string().min(1, "Message content cannot be empty"),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id: requestId } = params;

    // Verify request belongs to tenant
    const request = await prisma.cscRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found", code: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    const messages = await prisma.cscMessage.findMany({
      where: { requestId },
      orderBy: { sentAt: "asc" },
    });

    return NextResponse.json(serializeData(messages));
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = getTenantSession(req);
    const { id: requestId } = params;
    const body = await req.json();

    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { senderId, senderRole, content } = parsed.data;

    // Verify request belongs to tenant
    const request = await prisma.cscRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found", code: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    const message = await prisma.cscMessage.create({
      data: {
        requestId,
        senderId,
        senderRole,
        content,
      },
    });

    return NextResponse.json(serializeData(message), { status: 201 });
  } catch (error: any) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
