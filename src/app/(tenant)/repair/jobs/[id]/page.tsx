"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Printer,
  ShieldCheck,
  User,
  Plus,
  Coins,
  Wrench,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";

interface PartUsed {
  id: string;
  quantityUsed: number;
  priceCharged: number;
  repairPart: {
    partName: string;
    partNumber: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  paidAt: string;
}

interface JobCardDetail {
  id: string;
  jobNumber: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  imeiSerial: string | null;
  reportedIssue: string;
  diagnosedIssue: string | null;
  status: string;
  estimatedCost: number;
  finalCost: number;
  advanceTaken: number;
  balanceDue: number;
  warrantyDays: number;
  deliveryDate: string;
  deliveredAt: string | null;
  assignedToStaff: string;
  deviceConditionOnReceipt: string;
  createdAt: string;
  isUnderWarranty: boolean;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
  };
  partsUsed: PartUsed[];
  payments: Payment[];
  warrantyParent: {
    id: string;
    jobNumber: string;
    status: string;
    deviceBrand: string;
    deviceModel: string;
  } | null;
  warrantyClaims: {
    id: string;
    jobNumber: string;
    status: string;
    createdAt: string;
  }[];
}

interface InventoryPart {
  id: string;
  partName: string;
  partNumber: string;
  sellingPrice: number;
  quantityInStock: number;
}

const statusOrder = [
  "RECEIVED",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "REPAIRING",
  "READY",
  "DELIVERED",
];

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const { id: jobId } = params;

  const [job, setJob] = useState<JobCardDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Status and Diagnosis update states
  const [status, setStatus] = useState("");
  const [diagnosedIssue, setDiagnosedIssue] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [finalCost, setFinalCost] = useState("0");
  const [assignedToStaff, setAssignedToStaff] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("0");
  const [updatingJob, setUpdatingJob] = useState(false);

  // Parts logging states
  const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState<InventoryPart | null>(null);
  const [quantityUsed, setQuantityUsed] = useState(1);
  const [priceCharged, setPriceCharged] = useState("0");
  const [addingPart, setAddingPart] = useState(false);
  const [showPartDialog, setShowPartDialog] = useState(false);

  // Payment recording states
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentType, setPaymentType] = useState("FINAL");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/repair/jobs/${jobId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load job card details");
      const data = await res.json();
      setJob(data);

      // Initialize edit fields
      setStatus(data.status);
      setDiagnosedIssue(data.diagnosedIssue || "");
      setEstimatedCost(String(data.estimatedCost));
      setFinalCost(String(data.finalCost));
      setAssignedToStaff(data.assignedToStaff);
      setWarrantyDays(String(data.warrantyDays));
      
      // Default payment amount to remaining balance
      setPaymentAmount(String(data.balanceDue));
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load job card details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
  }, [jobId, tenantId]);

  // Fetch parts inventory when search query is entered
  useEffect(() => {
    const fetchParts = async () => {
      if (!partSearch.trim()) {
        setInventoryParts([]);
        return;
      }
      try {
        const res = await fetch(`/api/repair/parts?search=${encodeURIComponent(partSearch)}`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (res.ok) {
          const data = await res.json();
          setInventoryParts(data.data || []);
        }
      } catch (error) {
        console.error(error);
      }
    };
    const delay = setTimeout(fetchParts, 350);
    return () => clearTimeout(delay);
  }, [partSearch, tenantId]);

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingJob(true);
      const res = await fetch(`/api/repair/jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          status,
          diagnosedIssue: diagnosedIssue.trim() || null,
          estimatedCost: parseFloat(estimatedCost) || 0,
          finalCost: parseFloat(finalCost) || 0,
          assignedToStaff,
          warrantyDays: parseInt(warrantyDays) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update job card");

      toast("Job card details updated successfully", "success");
      setJob(data);
      setPaymentAmount(String(data.balanceDue));
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to update job card", "error");
    } finally {
      setUpdatingJob(false);
    }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return toast("Please select a part", "error");

    try {
      setAddingPart(true);
      const res = await fetch(`/api/repair/jobs/${jobId}/parts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          partId: selectedPart.id,
          quantityUsed,
          priceCharged: parseFloat(priceCharged) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add part to job");

      toast("Part allocated successfully!", "success");
      setJob(data.job);
      setPaymentAmount(String(data.job.balanceDue));
      setShowPartDialog(false);
      // Reset parts form
      setSelectedPart(null);
      setPartSearch("");
      setQuantityUsed(1);
      setPriceCharged("0");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to add part", "error");
    } finally {
      setAddingPart(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentAmount) || 0;
    if (payAmt <= 0) return toast("Payment amount must be positive", "error");

    try {
      setRecordingPayment(true);
      const res = await fetch(`/api/repair/jobs/${jobId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          amount: payAmt,
          paymentMode,
          paymentType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast("Payment transaction logged successfully!", "success");
      setJob(data.job);
      setPaymentAmount(String(data.job.balanceDue));
      setShowPaymentDialog(false);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to record payment", "error");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 mb-3" />
        <p className="font-semibold text-sm">Loading job card record...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
        <p className="font-bold text-base">Job card not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/repair/jobs")}>
          Back to Registry
        </Button>
      </div>
    );
  }

  const isFinalDelivered = job.status === "DELIVERED" || job.status === "RETURNED_UNREPAIRED";

  return (
    <div className="space-y-6">
      {/* ================= PRINT ONLY ELEMENT ================= */}
      <div className="hidden print:block bg-white text-black p-6 font-mono text-sm leading-relaxed max-w-2xl mx-auto">
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold uppercase">SHOPOS ELECTRONICS REPAIR</h2>
          <p className="text-xs">123 Tech Park, Silicon Valley, India</p>
          <p className="text-xs">Phone: +91 99999 88888 | GSTIN: 27AAAAA1111A1Z1</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="font-bold uppercase text-xs text-gray-600">Job Card Details</p>
            <p><span className="font-bold">Job Number:</span> {job.jobNumber}</p>
            <p><span className="font-bold">Status:</span> {job.status}</p>
            <p><span className="font-bold">Received:</span> {new Date(job.createdAt).toLocaleDateString("en-IN")}</p>
            <p><span className="font-bold">Est. Delivery:</span> {new Date(job.deliveryDate).toLocaleDateString("en-IN")}</p>
            {job.deliveredAt && (
              <p><span className="font-bold">Delivered:</span> {new Date(job.deliveredAt).toLocaleDateString("en-IN")}</p>
            )}
          </div>
          <div>
            <p className="font-bold uppercase text-xs text-gray-600">Customer Details</p>
            <p><span className="font-bold">Name:</span> {job.customer.name}</p>
            <p><span className="font-bold">Phone:</span> {job.customer.phone}</p>
            {job.customer.email && <p><span className="font-bold">Email:</span> {job.customer.email}</p>}
            {job.customer.address && <p><span className="font-bold">Addr:</span> {job.customer.address}</p>}
          </div>
        </div>

        <div className="border-t border-b py-3 my-4">
          <p className="font-bold uppercase text-xs text-gray-600 mb-2">Device Information</p>
          <p><span className="font-bold">Device Type:</span> {job.deviceType}</p>
          <p><span className="font-bold">Brand & Model:</span> {job.deviceBrand} {job.deviceModel}</p>
          {job.imeiSerial && <p><span className="font-bold">IMEI/Serial:</span> {job.imeiSerial}</p>}
          <p><span className="font-bold">Condition on Receipt:</span> {job.deviceConditionOnReceipt}</p>
          <p className="mt-2"><span className="font-bold">Reported Issue:</span> {job.reportedIssue}</p>
          {job.diagnosedIssue && (
            <p className="mt-1"><span className="font-bold">Diagnosed Issue:</span> {job.diagnosedIssue}</p>
          )}
        </div>

        {/* Parts Used Table */}
        {job.partsUsed.length > 0 && (
          <div className="mb-4">
            <p className="font-bold uppercase text-xs text-gray-600 mb-1">Spare Parts Used</p>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Part Details</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {job.partsUsed.map((p) => (
                  <tr key={p.id} className="border-b border-dashed">
                    <td className="py-1.5">{p.repairPart.partName} ({p.repairPart.partNumber})</td>
                    <td className="py-1.5 text-center">{p.quantityUsed}</td>
                    <td className="py-1.5 text-right">₹{p.priceCharged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payments Summary */}
        <div className="border-t pt-3 mt-4 text-right space-y-1">
          <p><span className="font-bold">Estimated Repair Cost:</span> ₹{job.estimatedCost}</p>
          {job.finalCost > 0 && <p><span className="font-bold">Final Repair Cost:</span> ₹{job.finalCost}</p>}
          <p><span className="font-bold">Advance Payment:</span> ₹{job.advanceTaken}</p>
          
          {/* List payments */}
          {job.payments.length > 0 && (
            <div className="text-xs text-gray-500 font-normal">
              {job.payments.map((p, index) => (
                <p key={p.id}>
                  Payment #{index + 1} ({p.paymentType} - {p.paymentMode}): ₹{p.amount}
                </p>
              ))}
            </div>
          )}

          <p className="text-base font-bold border-t pt-1 mt-2">
            Remaining Balance Due: ₹{job.balanceDue}
          </p>
          {job.warrantyDays > 0 && (
            <p className="text-xs font-bold text-gray-600 mt-2">
              Warranty Covered: {job.warrantyDays} Days
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-12 mt-16 text-center text-xs">
          <div>
            <div className="border-t border-black pt-2">Customer Signature</div>
          </div>
          <div>
            <div className="border-t border-black pt-2">Authorized Signatory</div>
          </div>
        </div>
      </div>

      {/* ================= NORMAL LAYOUT (PRINT HIDDEN) ================= */}
      <div className="print:hidden space-y-6">
        {/* Top bar Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/repair/jobs")} className="text-gray-500">
              <ArrowLeft className="h-4 w-4" /> Back to List
            </Button>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-semibold text-gray-500">Job: {job.jobNumber}</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 shadow-sm">
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>

            {job.isUnderWarranty && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 gap-1.5"
                onClick={() =>
                  router.push(
                    `/repair/jobs/new?claimParentId=${job.id}&parentJobNumber=${job.jobNumber}`
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" /> Claim Warranty
              </Button>
            )}
          </div>
        </div>

        {/* Warranty Claim alerts */}
        {job.warrantyParent && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-800">
            <ShieldCheck className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p>
              This job card is a **Warranty Claim** linked to original Job Card{" "}
              <Link href={`/repair/jobs/${job.warrantyParent.id}`} className="font-bold underline text-amber-950 hover:text-amber-800">
                {job.warrantyParent.jobNumber}
              </Link>{" "}
              ({job.warrantyParent.deviceBrand} {job.warrantyParent.deviceModel}).
            </p>
          </div>
        )}

        {job.warrantyClaims.length > 0 && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-2 text-sm text-violet-800">
            <p className="font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
              Warranty Claims filed against this job card:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {job.warrantyClaims.map((claim) => (
                <li key={claim.id}>
                  <Link href={`/repair/jobs/${claim.id}`} className="font-semibold underline text-violet-950">
                    {claim.jobNumber}
                  </Link>{" "}
                  - Filed on {new Date(claim.createdAt).toLocaleDateString()} (Status: {claim.status})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visual Timeline Row */}
        <Card className="border-gray-200/60 shadow-sm overflow-hidden">
          <CardContent className="p-6 bg-gray-50/30">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4 select-none">
              {statusOrder.map((step, idx) => {
                const isCurrent = job.status === step;
                const isCompleted = statusOrder.indexOf(job.status) >= idx;
                
                // Special handles for failure termination cases
                const hasFailed = job.status === "UNREPAIRABLE" || job.status === "RETURNED_UNREPAIRED";

                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center text-center space-y-1.5 flex-1 relative">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center border font-bold text-sm transition-all duration-300 ${
                          hasFailed && isCurrent
                            ? "bg-red-100 border-red-300 text-red-700"
                            : isCurrent
                            ? "bg-violet-600 border-violet-600 text-white shadow"
                            : isCompleted
                            ? "bg-violet-100 border-violet-200 text-violet-700"
                            : "bg-white border-gray-200 text-gray-400"
                        }`}
                      >
                        {isCompleted && !isCurrent && !hasFailed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isCurrent ? "text-gray-900 font-bold" : "text-gray-500"
                        }`}
                      >
                        {step.replace(/_/g, " ")}
                      </span>
                    </div>
                    {idx < statusOrder.length - 1 && (
                      <div
                        className={`hidden md:block h-0.5 flex-1 transition-all duration-300 ${
                          isCompleted ? "bg-violet-500" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
              {/* Failure statuses summary */}
              {(job.status === "UNREPAIRABLE" || job.status === "RETURNED_UNREPAIRED") && (
                <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-center">
                  <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                    Terminal State: {job.status.replace(/_/g, " ")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer & Device Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Panel */}
          <Card className="border-gray-200/60 shadow-sm">
            <CardHeader className="border-b bg-gray-50/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Full Name</span>
                <p className="font-semibold text-gray-800 text-sm">{job.customer.name}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Phone Number</span>
                <p className="font-semibold text-gray-800 text-sm">{job.customer.phone}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Email Address</span>
                <p className="font-semibold text-gray-800 text-sm">{job.customer.email || "No email"}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Address</span>
                <p className="font-semibold text-gray-800 text-sm line-clamp-2">{job.customer.address || "No address"}</p>
              </div>
              <div className="pt-2 border-t text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/repair/customers/${job.customer.id}`)}
                  className="w-full text-violet-600 hover:bg-violet-50 border-violet-100 gap-1"
                >
                  <FileText className="h-4 w-4" /> View Customer History
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Device & Diagnostics details */}
          <Card className="border-gray-200/60 shadow-sm lg:col-span-2">
            <CardHeader className="border-b bg-gray-50/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Device & Diagnostics details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Device Type</span>
                  <p className="font-semibold text-gray-800 text-sm">{job.deviceType}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Brand</span>
                  <p className="font-semibold text-gray-800 text-sm">{job.deviceBrand}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Model</span>
                  <p className="font-semibold text-gray-800 text-sm">{job.deviceModel}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">IMEI/Serial</span>
                  <p className="font-semibold text-gray-800 text-sm truncate">{job.imeiSerial || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Condition on Receipt</span>
                  <p className="text-gray-700 text-xs font-semibold leading-relaxed mt-0.5 bg-gray-50 border rounded-lg p-2.5">
                    {job.deviceConditionOnReceipt}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Reported Issue</span>
                  <p className="text-gray-700 text-xs font-semibold leading-relaxed mt-0.5 bg-gray-50 border rounded-lg p-2.5">
                    {job.reportedIssue}
                  </p>
                </div>
              </div>

              {job.diagnosedIssue && (
                <div className="pt-3 border-t">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Diagnosis & Tech Notes</span>
                  <p className="text-gray-700 text-xs font-semibold leading-relaxed mt-0.5 bg-violet-50/40 border border-violet-100 rounded-lg p-2.5">
                    {job.diagnosedIssue}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Update Diagnosis, Status, Costs Form */}
        <Card className="border-gray-200/60 shadow-sm">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Update Diagnosis, Status & Costs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleUpdateJob} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Job Status</label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="RECEIVED">Received</option>
                    <option value="DIAGNOSING">Diagnosing</option>
                    <option value="WAITING_FOR_PARTS">Waiting for Parts</option>
                    <option value="REPAIRING">Repairing</option>
                    <option value="READY">Ready for Pickup</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="UNREPAIRABLE">Unrepairable</option>
                    <option value="RETURNED_UNREPAIRED">Returned Unrepaired</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Estimated Cost (₹)</label>
                  <Input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} min="0" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Final Cost (₹)</label>
                  <Input type="number" value={finalCost} onChange={(e) => setFinalCost(e.target.value)} min="0" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Diagnosis Notes</label>
                  <Input
                    placeholder="E.g. Loose charging connector pins soldered, battery replaced..."
                    value={diagnosedIssue}
                    onChange={(e) => setDiagnosedIssue(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Assigned Staff</label>
                  <Input value={assignedToStaff} onChange={(e) => setAssignedToStaff(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Warranty Days</label>
                  <Select value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)}>
                    <option value="0">No Warranty</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days (3 Months)</option>
                    <option value="180">180 Days (6 Months)</option>
                    <option value="365">365 Days (1 Year)</option>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2 text-right">
                  <Button type="submit" disabled={updatingJob} className="min-w-[130px]">
                    {updatingJob ? "Updating..." : "Save Updates"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Bottom Section: Spare Parts Used & Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Spare Parts Section */}
          <Card className="border-gray-200/60 shadow-sm flex flex-col">
            <CardHeader className="border-b bg-gray-50/50 flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Spare Parts Used
              </CardTitle>

              {/* Add Part Dialog */}
              <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1 border-violet-100 text-violet-600 hover:bg-violet-50">
                    <Plus className="h-4 w-4" /> Add Part
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Allocate Spare Part</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddPart} className="space-y-4 pt-2">
                    {/* Search and Select Part */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-gray-500">Search Part in Stock *</label>
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                        <Search className="h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Type part name or number..."
                          value={partSearch}
                          onChange={(e) => setPartSearch(e.target.value)}
                          className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400"
                        />
                      </div>

                      {/* Dropdown list */}
                      {inventoryParts.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-25 max-h-40 overflow-y-auto divide-y">
                          {inventoryParts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedPart(p);
                                setPriceCharged(String(p.sellingPrice));
                                setPartSearch("");
                                setInventoryParts([]);
                              }}
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-xs flex justify-between items-center"
                            >
                              <div>
                                <p className="font-bold text-gray-900">{p.partName}</p>
                                <p className="text-[10px] text-gray-400 font-semibold">{p.partNumber}</p>
                              </div>
                              <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                                ₹{p.sellingPrice} | Stock: {p.quantityInStock}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Part Badge */}
                    {selectedPart && (
                      <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3 text-xs">
                        <p className="font-bold text-violet-950">{selectedPart.partName}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Part #: {selectedPart.partNumber}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Qty Used *</label>
                        <Input
                          type="number"
                          value={quantityUsed}
                          onChange={(e) => setQuantityUsed(parseInt(e.target.value) || 1)}
                          min="1"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Price Charged per unit (₹) *</label>
                        <Input
                          type="number"
                          value={priceCharged}
                          onChange={(e) => setPriceCharged(e.target.value)}
                          min="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" disabled={addingPart}>
                        {addingPart ? "Allocating..." : "Allocate Part"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-64">
              {job.partsUsed.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Name</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price Charged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.partsUsed.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{p.repairPart.partName}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{p.repairPart.partNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-gray-600 text-sm">
                          {p.quantityUsed}
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-gray-800 text-sm">
                          ₹{(p.priceCharged * p.quantityUsed).toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                  <Wrench className="h-8 w-8 text-gray-300 mb-1" />
                  <p className="text-xs font-semibold">No spare parts allocated yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments Section */}
          <Card className="border-gray-200/60 shadow-sm flex flex-col">
            <CardHeader className="border-b bg-gray-50/50 flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Payment Transactions
              </CardTitle>

              {/* Record Payment Dialog */}
              <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1 border-violet-100 text-violet-600 hover:bg-violet-50">
                    <Plus className="h-4 w-4" /> Add Payment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment Transaction</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Amount (₹) *</label>
                      <Input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        min="1"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Payment Mode</label>
                        <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI / QR Code</option>
                          <option value="CARD">Debit/Credit Card</option>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Payment Type</label>
                        <Select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                          <option value="FINAL">Final Balance</option>
                          <option value="ADVANCE">Additional Advance</option>
                          <option value="REFUND">Refund</option>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" disabled={recordingPayment}>
                        {recordingPayment ? "Saving Transaction..." : "Save Payment"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-64">
              {job.payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Paid At</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Badge
                            className={`font-semibold text-[10px] ${
                              p.paymentType === "ADVANCE"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : p.paymentType === "REFUND"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-green-50 text-green-700 border-green-200"
                            }`}
                          >
                            {p.paymentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-600 text-xs">{p.paymentMode}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(p.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell
                          className={`text-right font-extrabold text-sm ${
                            p.paymentType === "REFUND" ? "text-red-500" : "text-gray-800"
                          }`}
                        >
                          {p.paymentType === "REFUND" ? "-" : ""}₹{p.amount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                  <Coins className="h-8 w-8 text-gray-300 mb-1" />
                  <p className="text-xs font-semibold">No transactions recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
