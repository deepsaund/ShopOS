import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";
import { serializeData } from "@/lib/serialization";
import { DeviceType, JobStatus, PaymentMode } from "@prisma/client";

export const dynamic = "force-dynamic";

const createJobSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  deviceType: z.nativeEnum(DeviceType),
  deviceBrand: z.string().min(1, "Device brand is required"),
  deviceModel: z.string().min(1, "Device model is required"),
  imeiSerial: z.string().optional().nullable(),
  reportedIssue: z.string().min(1, "Reported issue is required"),
  estimatedCost: z.number().nonnegative("Estimated cost must be non-negative"),
  advanceTaken: z.number().nonnegative("Advance taken must be non-negative").optional().default(0),
  advancePaymentMode: z.nativeEnum(PaymentMode).optional().default("CASH"),
  warrantyDays: z.number().int().nonnegative().optional().default(0),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  assignedToStaff: z.string().min(1, "Assigned staff is required"),
  deviceConditionOnReceipt: z.string().min(1, "Device condition is required"),
  customerSignatureUrl: z.string().optional().nullable(),
  warrantyParentId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantSession(req);
    const searchParams = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status") as JobStatus | null;
    const staff = searchParams.get("staff") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const search = searchParams.get("search") || "";
    const warrantyOnly = searchParams.get("warranty") === "true";

    const where: any = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (staff) {
      where.assignedToStaff = { contains: staff, mode: "insensitive" };
    }

    if (startDate || endDate) {
      where.deliveryDate = {};
      if (startDate) {
        where.deliveryDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.deliveryDate.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { jobNumber: { contains: search, mode: "insensitive" } },
        { deviceBrand: { contains: search, mode: "insensitive" } },
        { deviceModel: { contains: search, mode: "insensitive" } },
        { imeiSerial: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Fetch jobs
    const jobs = await prisma.jobCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        payments: true,
      },
    });

    const today = new Date();

    // Map jobs to compute isUnderWarranty and filter if warrantyOnly is set
    const formattedJobs = jobs.map((job) => {
      let isUnderWarranty = false;
      if (job.status === "DELIVERED" && job.deliveredAt && job.warrantyDays > 0) {
        const warrantyExpiry = new Date(job.deliveredAt);
        warrantyExpiry.setDate(warrantyExpiry.getDate() + job.warrantyDays);
        isUnderWarranty = warrantyExpiry > today;
      }
      return {
        ...job,
        isUnderWarranty,
      };
    });

    const filteredJobs = warrantyOnly
      ? formattedJobs.filter((job) => job.isUnderWarranty)
      : formattedJobs;

    // Manual slicing for pagination because of warranty filter client-side/in-memory mapping
    const total = filteredJobs.length;
    const paginatedJobs = filteredJobs.slice(skip, skip + limit);

    return NextResponse.json({
      data: serializeData(paginatedJobs),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error listing jobs:", error);
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

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      customerId,
      deviceType,
      deviceBrand,
      deviceModel,
      imeiSerial,
      reportedIssue,
      estimatedCost,
      advanceTaken,
      advancePaymentMode,
      warrantyDays,
      deliveryDate,
      assignedToStaff,
      deviceConditionOnReceipt,
      customerSignatureUrl,
      warrantyParentId,
    } = parsed.data;

    // Verify customer exists
    const customer = await prisma.repairCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify warranty parent if provided
    if (warrantyParentId) {
      const parentJob = await prisma.jobCard.findFirst({
        where: { id: warrantyParentId, tenantId },
      });
      if (!parentJob) {
        return NextResponse.json(
          { error: "Warranty parent job card not found", code: "PARENT_JOB_NOT_FOUND" },
          { status: 404 }
        );
      }
    }

    const currentYear = new Date().getFullYear();
    const prefix = `JOB-${currentYear}-`;

    const job = await prisma.$transaction(async (tx) => {
      // Find latest job card for this tenant & year
      const lastJob = await tx.jobCard.findFirst({
        where: {
          tenantId,
          jobNumber: { startsWith: prefix },
        },
        orderBy: { jobNumber: "desc" },
        select: { jobNumber: true },
      });

      let sequence = 1;
      if (lastJob && lastJob.jobNumber) {
        const parts = lastJob.jobNumber.split("-");
        const lastSeq = parseInt(parts[2] || "0");
        if (!isNaN(lastSeq)) {
          sequence = lastSeq + 1;
        }
      }

      const jobNumber = `${prefix}${String(sequence).padStart(4, "0")}`;
      const balanceDue = estimatedCost - advanceTaken;

      // Create job card
      const newJob = await tx.jobCard.create({
        data: {
          tenantId,
          customerId,
          jobNumber,
          deviceType,
          deviceBrand,
          deviceModel,
          imeiSerial: imeiSerial || null,
          reportedIssue,
          status: "RECEIVED",
          estimatedCost,
          finalCost: 0,
          advanceTaken,
          balanceDue,
          warrantyDays,
          deliveryDate: new Date(deliveryDate),
          assignedToStaff,
          deviceConditionOnReceipt,
          customerSignatureUrl: customerSignatureUrl || null,
          warrantyParentId: warrantyParentId || null,
        },
      });

      // If advance taken, record payment
      if (advanceTaken > 0) {
        await tx.repairPayment.create({
          data: {
            tenantId,
            jobId: newJob.id,
            amount: advanceTaken,
            paymentMode: advancePaymentMode,
            paymentType: "ADVANCE",
          },
        });
      }

      return newJob;
    });

    return NextResponse.json(serializeData(job), { status: 201 });
  } catch (error: any) {
    console.error("Error creating job card:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
