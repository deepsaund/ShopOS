import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { CscRequestRole, CscRequestStatus } from "@prisma/client";
import { notifyStatusChange } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const createRequestSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  serviceId: z.string().min(1, "Service ID is required"),
  createdByRole: z.nativeEnum(CscRequestRole),
  documents: z.array(z.object({
    docType: z.string().min(1),
    fileUrl: z.string().url("Invalid file URL"),
  })).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const body = await req.json();

    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { customerId, serviceId, createdByRole, documents } = parsed.data;

    // 1. Verify customer and service exist under this tenant in parallel
    const [customer, service] = await Promise.all([
      prisma.cscCustomer.findFirst({
        where: { id: customerId, tenantId },
      }),
      prisma.cscService.findFirst({
        where: { id: serviceId, tenantId },
      }),
    ]);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!service) {
      return NextResponse.json(
        { error: "Service not found", code: "SERVICE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Determine price charged based on role
    const priceCharged = createdByRole === "B2B" ? service.priceB2b : service.priceCustomer;

    // Parse required documents list from service
    let reqDocsList: any[] = [];
    if (service.requiredDocuments && typeof service.requiredDocuments === "object") {
      reqDocsList = service.requiredDocuments as any[];
    } else if (typeof service.requiredDocuments === "string") {
      reqDocsList = JSON.parse(service.requiredDocuments);
    }

    // 3. Create request and documents in a transaction
    const newRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.cscRequest.create({
        data: {
          tenantId,
          customerId,
          serviceId,
          createdByRole,
          priceCharged,
          status: "SUBMITTED", // Initial state
        },
      });

      // Find customer's vault documents to pre-populate missing ones
      const vaultDocs = await tx.documentVault.findMany({
        where: { tenantId, customerId },
      });

      // Map docType -> fileUrl from vault
      const vaultMap = new Map<string, string>();
      for (const vd of vaultDocs) {
        vaultMap.set(vd.docType, vd.fileUrl);
      }

      // Map docType -> fileUrl from request input
      const inputMap = new Map<string, string>();
      for (const d of documents) {
        inputMap.set(d.docType, d.fileUrl);
      }

      // For each required document, check input, then vault, else create empty
      for (const reqDoc of reqDocsList) {
        const fileUrl = inputMap.get(reqDoc.name) || vaultMap.get(reqDoc.name) || "";
        await tx.requestDocument.create({
          data: {
            requestId: request.id,
            docType: reqDoc.name,
            fileUrl,
            status: "PENDING",
          },
        });
      }

      return request;
    });

    // 4. Trigger notification
    await notifyStatusChange(newRequest.id);

    // Fetch full request
    const requestDetails = await prisma.cscRequest.findUnique({
      where: { id: newRequest.id },
      include: {
        customer: true,
        service: true,
        documents: true,
      },
    });

    return NextResponse.json(serializeData(requestDetails), { status: 201 });
  } catch (error: any) {
    console.error("Error creating CSC request:", error);
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

    const customerId = searchParams.get("customerId");
    const claimedByStaffId = searchParams.get("claimedByStaffId");
    const status = searchParams.get("status") as CscRequestStatus | null;

    const whereClause: any = {
      tenantId,
    };

    if (customerId) {
      whereClause.customerId = customerId;
    }

    if (claimedByStaffId) {
      whereClause.claimedByStaffId = claimedByStaffId;
    }

    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.cscRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        service: true,
        documents: true,
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json(serializeData(requests));
  } catch (error: any) {
    console.error("Error listing CSC requests:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
