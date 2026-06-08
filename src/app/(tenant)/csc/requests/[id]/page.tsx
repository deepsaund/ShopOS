"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTenant } from "@/components/ui/tenant-context";
import { useCscRole } from "../../csc-role-context";
import {
  ArrowLeft,
  FileText,
  User,
  Clock,
  Briefcase,
  UploadCloud,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  Building,
} from "lucide-react";

interface DocumentItem {
  id: string;
  docType: string;
  fileUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: string | null;
}

interface MessageItem {
  id: string;
  senderId: string;
  senderRole: string;
  content: string;
  sentAt: string;
}

interface RequestDetail {
  id: string;
  customerId: string;
  serviceId: string;
  status: string;
  priceCharged: number;
  createdAt: string;
  completedAt: string | null;
  claimedByStaffId: string | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
  };
  service: {
    name: string;
    description: string;
    estimatedDays: number;
    requiredDocuments: any;
  };
  documents: DocumentItem[];
}

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const { tenantId } = useTenant();
  const { role, staffId, simulatedStaffName } = useCscRole();
  const { id: requestId } = params;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Input states
  const [chatInput, setChatInput] = useState("");
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [simulatedDocUrls, setSimulatedDocUrls] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRequestDetails();
    fetchMessages();
    
    // Poll chat messages every 5 seconds for simulation
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [tenantId, requestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/csc/requests`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load request details");
      const list: RequestDetail[] = await res.json();
      const item = list.find((r) => r.id === requestId);
      if (!item) throw new Error("Request not found");
      setRequest(item);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/csc/requests/${requestId}/messages`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching chat messages:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      const senderRole = role === "ADMIN" ? "ADMIN" : role === "STAFF" ? "STAFF" : "CUSTOMER";
      const senderId = role === "CUSTOMER" || role === "B2B" ? (request?.customerId || "cust") : staffId;

      const res = await fetch(`/api/csc/requests/${requestId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          senderId,
          senderRole,
          content: chatInput.trim(),
        }),
      });

      if (res.ok) {
        setChatInput("");
        fetchMessages();
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleDocReview = async (documentId: string, status: "APPROVED" | "REJECTED", reason?: string) => {
    try {
      const res = await fetch(`/api/csc/requests/${requestId}/documents/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          documentId,
          status,
          rejectionReason: reason || null,
        }),
      });

      if (!res.ok) throw new Error("Document review failed");
      
      setRejectingDocId(null);
      setRejectionReason("");
      fetchRequestDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/csc/requests/${requestId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Status update failed");
      fetchRequestDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Mock Upload simulation for Customer
  const handleMockUpload = async (docType: string) => {
    const mockUrl = simulatedDocUrls[docType];
    if (!mockUrl || !mockUrl.startsWith("http")) {
      alert("Please enter a valid document mock image URL (e.g. https://images.unsplash.com/photo-1540555700478-4be289fbecef)");
      return;
    }

    try {
      // 1. Upload to customer's document vault
      await fetch("/api/csc/vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          customerId: request?.customerId,
          docType,
          fileUrl: mockUrl,
        }),
      });

      // 2. Submit/Update request document
      const res = await fetch(`/api/csc/requests/${requestId}/documents/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          docType,
          fileUrl: mockUrl,
        }),
      });

      if (!res.ok) throw new Error("Upload failed");
      
      // Clear URL state
      setSimulatedDocUrls({
        ...simulatedDocUrls,
        [docType]: "",
      });

      fetchRequestDetails();
      alert("Mock document uploaded successfully! Admin can now review it.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStepProgress = () => {
    if (!request) return 0;
    switch (request.status) {
      case "PENDING_DOCUMENTS":
        return 1;
      case "SUBMITTED":
        return 2;
      case "DOCS_APPROVED":
        return 3;
      case "PROCESSING":
        return 4;
      case "COMPLETED":
        return 5;
      default:
        return 1;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 bg-slate-950/20 rounded-2xl border border-slate-900 min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="text-xs text-slate-500 font-medium">Loading case details...</span>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-10 text-center bg-slate-950/45 backdrop-blur-xl border border-rose-500/20 rounded-2xl text-rose-450 text-xs">
        {error || "Failed to load request details"}
      </div>
    );
  }

  const stepProgress = getStepProgress();
  const isAdminOrStaff = role === "ADMIN" || role === "STAFF";

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href={isAdminOrStaff ? "/csc/queue" : "/csc/customer"}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-450 hover:text-white transition-all hover:-translate-x-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Case Dashboard
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Docs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Service Header Info */}
          <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/50 pb-5">
              <div className="space-y-1">
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">
                  SERVICE REQUEST CASE FILE
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">{request.service.name}</h2>
                <p className="text-[11px] text-slate-400">ID: <span className="font-mono text-indigo-300/80">{request.id}</span></p>
              </div>
              <div className="text-right sm:bg-slate-900/40 sm:border sm:border-slate-850 p-3 rounded-xl min-w-[120px]">
                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">Service Fee</span>
                <span className="text-lg font-extrabold text-indigo-350">₹{request.priceCharged}</span>
              </div>
            </div>

            {/* Timelines and customer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs text-slate-400">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">APPLICANT DOSSIER</span>
                <div className="space-y-2 p-4 rounded-xl bg-slate-900/30 border border-slate-850/80 hover:border-slate-800 transition-colors">
                  <div className="flex items-center gap-2 text-slate-200">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="font-bold">{request.customer.name}</span>
                  </div>
                  <div className="space-y-1 pl-6 text-[11px] text-slate-400">
                    <p>Phone: <span className="text-slate-300 font-medium">{request.customer.phone}</span></p>
                    {request.customer.email && <p>Email: <span className="text-slate-350">{request.customer.email}</span></p>}
                    {request.customer.address && <p className="truncate">Address: <span className="text-slate-355">{request.customer.address}</span></p>}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">CASE WORKFLOW</span>
                <div className="space-y-2.5 p-4 rounded-xl bg-slate-900/30 border border-slate-850/80 hover:border-slate-800 transition-colors">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-450 font-medium">Current Status:</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-indigo-500/10 border border-indigo-550/20 text-indigo-400 uppercase tracking-wide">
                      {request.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-450 font-medium">Assigned Officer:</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      {request.claimedByStaffId ? (
                        <>
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {request.claimedByStaffId}
                        </>
                      ) : (
                        "Unclaimed (In Queue)"
                      )}
                    </span>
                  </div>
                  {request.completedAt && (
                    <div className="flex justify-between items-center text-[11px] text-emerald-400 bg-emerald-500/5 p-1 px-2 border border-emerald-500/10 rounded">
                      <span>Closed Date:</span>
                      <span className="font-bold">{new Date(request.completedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visual Progress Timeline (Glowing Neon) */}
            <div className="pt-5 border-t border-slate-800/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-5 tracking-wider">SERVICE DELIVERY TIMELINE</span>
              
              <div className="relative flex flex-col sm:flex-row justify-between gap-6">
                
                {/* Horizontal line for desktop (Glowing) */}
                <div className="absolute top-4 left-12 right-12 h-[3px] bg-slate-900 hidden sm:block z-0 overflow-hidden rounded">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] transition-all duration-700" 
                    style={{ width: `${Math.max(0, (stepProgress - 1) * 25)}%` }}
                  />
                </div>
                
                {[
                  { step: 1, label: "Submission", desc: "Form & Docs Uploaded" },
                  { step: 2, label: "Review", desc: "Staff Verify Checklist" },
                  { step: 3, label: "Approved", desc: "Ready for Processing" },
                  { step: 4, label: "Processing", desc: "Govt / Provider Submission" },
                  { step: 5, label: "Completed", desc: "Delivery & Archive" },
                ].map((s) => {
                  const isActive = stepProgress >= s.step;
                  const isCurrent = stepProgress === s.step;
                  return (
                    <div key={s.step} className="relative z-10 flex flex-row sm:flex-col items-center gap-4 sm:gap-2.5 text-center flex-1">
                      {/* Node Circle */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 ${
                          isActive
                            ? "bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                            : "bg-slate-950 border-slate-800 text-slate-600"
                        } ${isCurrent ? "ring-[5px] ring-indigo-500/20 scale-[1.08] animate-pulse" : ""}`}
                      >
                        {isActive && s.step < stepProgress ? (
                          <CheckCircle2 className="h-4.5 w-4.5" />
                        ) : (
                          <span className="text-xs font-extrabold">{s.step}</span>
                        )}
                      </div>
                      
                      {/* Labels */}
                      <div className="text-left sm:text-center">
                        <span className={`block text-[11px] font-bold tracking-tight ${isActive ? "text-slate-100" : "text-slate-500"}`}>
                          {s.label}
                        </span>
                        <span className="hidden sm:block text-[9px] text-slate-550 mt-0.5 leading-tight font-medium max-w-[100px] mx-auto">
                          {s.desc}
                        </span>
                        {isCurrent && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold bg-indigo-500/10 border border-indigo-550/20 text-indigo-400 tracking-wider mt-1 sm:mt-0">
                            Active Stage
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Staff status change controls */}
            {isAdminOrStaff && request.claimedByStaffId === staffId && request.status !== "COMPLETED" && (
              <div className="pt-5 border-t border-slate-800/50 flex flex-wrap items-center gap-3 bg-indigo-950/5 p-4 rounded-xl border border-indigo-950/20">
                <div className="w-full flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-250">Internal Case Controls (Assigned Staff)</span>
                </div>
                {request.status === "DOCS_APPROVED" && (
                  <button
                    onClick={() => handleStatusChange("PROCESSING")}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15 border border-indigo-500/20"
                  >
                    Initiate Gov Submission & Processing
                  </button>
                )}
                {request.status === "PROCESSING" && (
                  <button
                    onClick={() => handleStatusChange("COMPLETED")}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-505 hover:to-teal-505 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-605/15 border border-emerald-500/20"
                  >
                    Conclude & Mark Completed
                  </button>
                )}
                <span className="text-[10px] text-slate-500 pl-1">Updates applicant dashboard in real-time.</span>
              </div>
            )}
          </div>

          {/* Documents Review Checklist */}
          <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-5 shadow-lg">
            <div>
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">
                CASE VERIFICATION CHECKLIST
              </span>
              <h3 className="text-sm font-bold text-white">Required Applicant Documentation</h3>
            </div>

            <div className="space-y-4">
              {request.documents.map((doc) => {
                const hasFile = !!doc.fileUrl;
                return (
                  <div
                    key={doc.id}
                    className="p-4.5 rounded-xl border border-slate-850 bg-slate-900/10 hover:border-slate-800/80 transition-all duration-300 space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-455" />
                          {doc.docType}
                        </span>
                        {doc.rejectionReason && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-400 font-medium bg-rose-500/5 px-2.5 py-1 rounded border border-rose-500/10">
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Rejection Reason: {doc.rejectionReason}</span>
                          </div>
                        )}
                      </div>

                      {/* Status pill */}
                      <div className="flex items-center gap-2">
                        {doc.status === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approved
                          </span>
                        )}
                        {doc.status === "REJECTED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-rose-500/10 border border-rose-500/30 text-rose-450 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                            <XCircle className="h-3.5 w-3.5" />
                            Rejected
                          </span>
                        )}
                        {doc.status === "PENDING" && hasFile && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)] animate-pulse">
                            <Clock className="h-3.5 w-3.5" />
                            Awaiting Officer Review
                          </span>
                        )}
                        {doc.status === "PENDING" && !hasFile && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Action Required (Upload File)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* File preview / Action */}
                    {hasFile ? (
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-3 bg-slate-950/75 border border-slate-850 rounded-xl">
                        <div className="flex items-center gap-2 max-w-[250px] sm:max-w-[380px] truncate">
                          <div className="h-7 w-7 rounded bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-3.5 w-3.5 text-indigo-400" />
                          </div>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-305 font-bold underline truncate"
                          >
                            View Scanned Copy File
                          </a>
                        </div>

                        {/* Admin / Staff Review Buttons */}
                        {isAdminOrStaff && doc.status === "PENDING" && (
                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <button
                              onClick={() => handleDocReview(doc.id, "APPROVED")}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all shadow shadow-emerald-950/20"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingDocId(doc.id)}
                              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all shadow shadow-rose-950/20"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* File upload simulator for customer */
                      !isAdminOrStaff && (
                        <div className="space-y-2.5 bg-slate-950/70 border border-slate-850 p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">Submit Scanned Photo / Document URL</span>
                          <div className="flex gap-2.5">
                            <input
                              type="text"
                              placeholder="Paste direct document image link (e.g. https://example.com/pan.jpg)"
                              value={simulatedDocUrls[doc.docType] || ""}
                              onChange={(e) =>
                                setSimulatedDocUrls({
                                  ...simulatedDocUrls,
                                  [doc.docType]: e.target.value,
                                })
                              }
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => handleMockUpload(doc.docType)}
                              className="px-4.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow shadow-indigo-950/20 border border-indigo-500/25"
                            >
                              <UploadCloud className="h-4 w-4" />
                              Submit
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-normal">
                            Note: This writes directly to your permanent customer vault for re-use, and links it to this specific request dossier.
                          </p>
                        </div>
                      )
                    )}

                    {/* Rejection input box inline */}
                    {rejectingDocId === doc.id && (
                      <div className="bg-slate-955 p-4 border border-rose-500/20 rounded-xl space-y-3.5">
                        <span className="text-xs font-bold text-rose-400 block">Provide Reason for Rejection</span>
                        <input
                          type="text"
                          required
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. Expired document date / blurry scans"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setRejectingDocId(null)}
                            className="px-3.5 py-1.5 border border-slate-800 hover:bg-slate-850 text-slate-400 rounded-lg text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDocReview(doc.id, "REJECTED", rejectionReason)}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold"
                          >
                            Submit Rejection
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Chat Panel */}
        <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 rounded-2xl flex flex-col h-[650px] overflow-hidden shadow-lg">
          
          {/* Chat Header */}
          <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-950/45 flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <MessageSquare className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-xs text-white block">Case Correspondence</span>
              <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Helpdesk Correction Chat</span>
            </div>
          </div>

          {/* Messages body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-605 space-y-3">
                <div className="h-10 w-10 bg-slate-900 border border-slate-850 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-350 block">No communications yet</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[170px] mx-auto leading-relaxed">
                    Staff or applicant can send messages here to clarify missing details.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe =
                  (role === "CUSTOMER" && msg.senderRole === "CUSTOMER") ||
                  ((role === "STAFF" || role === "ADMIN") && (msg.senderRole === "STAFF" || msg.senderRole === "ADMIN"));
                
                const senderDisplay = msg.senderRole === "ADMIN" ? "ADMIN" : msg.senderRole === "STAFF" ? "OFFICER" : "APPLICANT";
                
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1.5">
                      <span className={`text-[8px] font-extrabold tracking-wider uppercase ${isMe ? "text-indigo-400" : "text-slate-400"}`}>
                        {senderDisplay}
                      </span>
                      <span className="text-[8px] text-slate-550 font-semibold">
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow shadow-indigo-950/20 border border-indigo-500/20"
                          : "bg-slate-900/60 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Form Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800/80 bg-slate-950/45 flex gap-2.5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Reply to case file..."
              className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-650"
            />
            <button
              type="submit"
              className="p-3 bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-md shadow-indigo-950/20 transition-all border border-indigo-500/25 active:scale-95 flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
