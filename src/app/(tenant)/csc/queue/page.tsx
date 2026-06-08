"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTenant } from "@/components/ui/tenant-context";
import { useCscRole } from "../csc-role-context";
import {
  FileText,
  User,
  Clock,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Search,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

interface RequestItem {
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
  };
  service: {
    name: string;
    estimatedDays: number;
  };
  documents: {
    id: string;
    docType: string;
    status: string;
  }[];
}

export default function QueuePage() {
  const { tenantId } = useTenant();
  const { role, staffId, simulatedStaffName } = useCscRole();

  const [activeTab, setActiveTab] = useState<"unclaimed" | "my-claims" | "all">("unclaimed");
  const [unclaimedRequests, setUnclaimedRequests] = useState<RequestItem[]>([]);
  const [myClaims, setMyClaims] = useState<RequestItem[]>([]);
  const [allRequests, setAllRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [claimingIds, setClaimingIds] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  useEffect(() => {
    fetchQueueData();
  }, [tenantId, role, activeTab]);

  const fetchQueueData = async () => {
    try {
      setLoading(true);
      setError("");

      if (activeTab === "unclaimed") {
        const res = await fetch("/api/csc/requests/queue", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!res.ok) throw new Error("Failed to load queue");
        const data = await res.json();
        setUnclaimedRequests(data);
      } else if (activeTab === "my-claims") {
        const res = await fetch(`/api/csc/requests?claimedByStaffId=${staffId}`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (!res.ok) throw new Error("Failed to load claimed requests");
        const data = await res.json();
        setMyClaims(data);
      } else if (activeTab === "all" && role === "ADMIN") {
        const res = await fetch("/api/csc/requests", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!res.ok) throw new Error("Failed to load all requests");
        const data = await res.json();
        setAllRequests(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (requestId: string) => {
    // 1. Mark as claiming in local state for UI spinners
    setClaimingIds((prev) => ({ ...prev, [requestId]: true }));

    // 2. Optimistic UI Updates
    const requestToClaim = unclaimedRequests.find((r) => r.id === requestId);
    if (!requestToClaim) {
      setClaimingIds((prev) => ({ ...prev, [requestId]: false }));
      return;
    }

    // Save previous states for potential rollback
    const prevUnclaimed = [...unclaimedRequests];
    const prevMyClaims = [...myClaims];

    // Optimistically update states
    const optimisticallyClaimed: RequestItem = {
      ...requestToClaim,
      claimedByStaffId: staffId,
      status: "PROCESSING",
    };

    setUnclaimedRequests((prev) => prev.filter((r) => r.id !== requestId));
    setMyClaims((prev) => [optimisticallyClaimed, ...prev]);
    showToast("Processing claim optimistically...");

    try {
      const res = await fetch(`/api/csc/requests/${requestId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ staffId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Claim failed");
      }

      showToast("Request claimed successfully! Moved to 'My Claims'");
      
      // Fetch fresh queue data in background to ensure local client state matches DB exactly
      const freshRes = await fetch("/api/csc/requests/queue", {
        headers: { "x-tenant-id": tenantId },
      });
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setUnclaimedRequests(freshData);
      }
      const freshClaimsRes = await fetch(`/api/csc/requests?claimedByStaffId=${staffId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (freshClaimsRes.ok) {
        const freshClaimsData = await freshClaimsRes.json();
        setMyClaims(freshClaimsData);
      }
    } catch (err: any) {
      // Rollback optimistic states on failure
      setUnclaimedRequests(prevUnclaimed);
      setMyClaims(prevMyClaims);
      alert(`Claim failed: ${err.message}`);
    } finally {
      setClaimingIds((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_DOCUMENTS":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
            Action Needed / Rejected Docs
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
            Awaiting Doc Review
          </span>
        );
      case "DOCS_APPROVED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 border border-sky-500/30 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.1)]">
            Unclaimed Queue
          </span>
        );
      case "PROCESSING":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.15)] animate-pulse">
            Processing Case
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-400">
            {status}
          </span>
        );
    }
  };

  if (role !== "ADMIN" && role !== "STAFF") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-950/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl min-h-[350px] text-center space-y-4">
        <div className="p-4 bg-rose-500/10 rounded-full border border-rose-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight">Access Restricted</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          Only CSC Staff or Administrators can access the claiming queues. Use the simulated Role Switcher at the top right of the dashboard layout to switch to <span className="text-indigo-400 font-bold">STAFF</span> or <span className="text-indigo-400 font-bold">ADMIN</span> mode.
        </p>
      </div>
    );
  }

  const activeRequests =
    activeTab === "unclaimed"
      ? unclaimedRequests
      : activeTab === "my-claims"
      ? myClaims
      : allRequests;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/90 backdrop-blur-xl text-white px-5 py-3.5 rounded-xl shadow-xl shadow-indigo-950/30 font-semibold text-xs border border-indigo-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="h-5 w-5 bg-indigo-500/15 border border-indigo-500/30 rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-indigo-400" />
          </div>
          <span className="text-slate-200">{toastMessage}</span>
        </div>
      )}

      {/* Staff Bar info */}
      <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 shadow-lg">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block mb-1">Claim Queue Management</span>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            CSC Service Center Queue
            <Sparkles className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Logged Operator: <span className="text-indigo-400 font-bold">{simulatedStaffName}</span>
          </p>
        </div>

        {/* Queue tabs */}
        <div className="flex bg-slate-900/60 border border-slate-800/80 p-1 rounded-xl gap-1 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("unclaimed")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "unclaimed"
                ? "bg-gradient-to-r from-indigo-650 to-violet-650 text-white shadow-md shadow-indigo-650/15 border border-indigo-500/25"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Unclaimed Queue
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "unclaimed" ? "bg-white/20 text-white" : "bg-slate-850 text-slate-500"}`}>
              {unclaimedRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("my-claims")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "my-claims"
                ? "bg-gradient-to-r from-indigo-650 to-violet-650 text-white shadow-md shadow-indigo-650/15 border border-indigo-500/25"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            My Claims
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "my-claims" ? "bg-white/20 text-white" : "bg-slate-850 text-slate-500"}`}>
              {myClaims.filter((c) => c.status !== "COMPLETED").length}
            </span>
          </button>
          {role === "ADMIN" && (
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-gradient-to-r from-indigo-650 to-violet-650 text-white shadow-md shadow-indigo-650/15 border border-indigo-500/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Requests (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      {loading && activeRequests.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-slate-950/20 border border-slate-900 rounded-2xl animate-pulse flex flex-col justify-between p-6"
            >
              <div className="h-4 bg-slate-800 rounded w-1/3"></div>
              <div className="h-3 bg-slate-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-slate-950/45 backdrop-blur-xl border border-rose-500/20 rounded-2xl text-rose-400 text-xs">
          {error}
        </div>
      ) : activeRequests.length === 0 ? (
        <div className="text-center p-16 bg-slate-950/15 backdrop-blur-xl border border-slate-800/80 rounded-2xl space-y-4 shadow-md">
          <div className="mx-auto w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center">
            <FileText className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-350">
              {activeTab === "unclaimed" && "No unclaimed requests in queue"}
              {activeTab === "my-claims" && "You have not claimed any requests"}
              {activeTab === "all" && "No requests found for this tenant"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {activeTab === "unclaimed" &&
                "New requests appear here once all required customer documents are submitted & approved."}
              {activeTab === "my-claims" &&
                "Claim an active request from the Unclaimed Queue tab to add it to your processing pipeline."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeRequests.map((request) => {
            const isClaiming = !!claimingIds[request.id];
            return (
              <div
                key={request.id}
                className="group relative flex flex-col md:flex-row md:items-center justify-between gap-5 bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 hover:border-indigo-500/40 hover:shadow-[0_0_25px_rgba(99,102,241,0.1)] transition-all duration-300 shadow-md"
              >
                {/* Left Column: Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {request.service.name}
                    </h3>
                    {getStatusBadge(request.status)}
                    {request.claimedByStaffId && activeTab === "all" && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-500" />
                        Staff Assigned: {request.claimedByStaffId}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="truncate text-slate-300 font-medium">{request.customer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-300 font-medium">₹{request.priceCharged}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-350">SLA: {request.service.estimatedDays} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-slate-500" />
                      <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Actions */}
                <div className="flex items-center gap-3 border-t border-slate-850 pt-4 md:pt-0 md:border-t-0">
                  {activeTab === "unclaimed" && (
                    <button
                      onClick={() => handleClaim(request.id)}
                      disabled={isClaiming}
                      className="w-full md:w-auto px-4.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 text-white shadow-md shadow-indigo-950/20 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-350 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 border border-indigo-500/20"
                    >
                      {isClaiming ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          Claim Request
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  )}

                  <Link
                    href={`/csc/requests/${request.id}`}
                    className="w-full md:w-auto px-4.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 border border-slate-850 text-slate-200 text-center hover:bg-slate-850 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    View Case File
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
