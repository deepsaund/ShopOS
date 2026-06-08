"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Wrench,
  AlertTriangle,
  Sparkles,
  IndianRupee,
  Clock,
  ArrowRight,
  User,
  ExternalLink,
} from "lucide-react";

interface JobCard {
  id: string;
  jobNumber: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  imeiSerial: string | null;
  reportedIssue: string;
  status: string;
  estimatedCost: number;
  finalCost: number;
  advanceTaken: number;
  balanceDue: number;
  assignedToStaff: string;
  createdAt: string;
  isUnderWarranty: boolean;
  customer: {
    name: string;
    phone: string;
  };
}

interface DashboardMetrics {
  statusCounts: Record<string, number>;
  readyForPickupCount: number;
  pendingCollections: number;
  lowStockCount: number;
}

const statusColumns = [
  { key: "RECEIVED", label: "Received", bg: "bg-blue-50 border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
  { key: "DIAGNOSING", label: "Diagnosing", bg: "bg-amber-50 border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  { key: "WAITING_FOR_PARTS", label: "Waiting for Parts", bg: "bg-orange-50 border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-800" },
  { key: "REPAIRING", label: "Repairing", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", badge: "bg-indigo-100 text-indigo-800" },
  { key: "READY", label: "Ready for Pickup", bg: "bg-green-50 border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-800" },
  { key: "DELIVERED", label: "Delivered", bg: "bg-gray-50 border-gray-200", text: "text-gray-700", badge: "bg-gray-100 text-gray-800" },
  { key: "UNREPAIRABLE", label: "Unrepairable", bg: "bg-red-50 border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800" },
  { key: "RETURNED_UNREPAIRED", label: "Returned Unrepaired", bg: "bg-rose-50 border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-800" },
];

export default function RepairDashboard() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    statusCounts: {},
    readyForPickupCount: 0,
    pendingCollections: 0,
    lowStockCount: 0,
  });

  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch metrics
      const metricsRes = await fetch("/api/repair/dashboard", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!metricsRes.ok) throw new Error("Failed to load dashboard metrics");
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      // Fetch active jobs (first 100)
      const jobsRes = await fetch("/api/repair/jobs?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!jobsRes.ok) throw new Error("Failed to load jobs");
      const jobsData = await jobsRes.json();
      setJobs(jobsData.data || []);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      setUpdatingId(jobId);
      const res = await fetch(`/api/repair/jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast("Status updated successfully", "success");
      
      // Update local state to avoid full re-render
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job.id === jobId
            ? { ...job, status: newStatus, deliveredAt: newStatus === "DELIVERED" ? new Date().toISOString() : job.deliveredAt }
            : job
        )
      );

      // Re-fetch metrics for totals
      const metricsRes = await fetch("/api/repair/dashboard", {
        headers: { "x-tenant-id": tenantId },
      });
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to update status", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const getActiveJobsCount = () => {
    const activeStates = ["RECEIVED", "DIAGNOSING", "WAITING_FOR_PARTS", "REPAIRING"];
    return activeStates.reduce((sum, state) => sum + (metrics.statusCounts[state] || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Jobs */}
        <Card className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-violet-100 text-xs font-bold uppercase tracking-wider">Active Jobs</p>
                <h3 className="text-3xl font-extrabold">{getActiveJobsCount()}</h3>
                <p className="text-violet-100 text-xs font-medium">In received or repair stages</p>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <Wrench className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ready for Pickup */}
        <Card className="bg-white border border-gray-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Ready for Pickup</p>
                <h3 className="text-3xl font-extrabold text-green-600">{metrics.readyForPickupCount}</h3>
                <p className="text-gray-400 text-xs font-medium">Completed and awaiting customer</p>
              </div>
              <div className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                <Sparkles className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Collections */}
        <Card className="bg-white border border-gray-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Pending Collections</p>
                <h3 className="text-3xl font-extrabold text-blue-600">
                  ₹{metrics.pendingCollections.toLocaleString("en-IN")}
                </h3>
                <p className="text-gray-400 text-xs font-medium">Unpaid balance on active repairs</p>
              </div>
              <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                <IndianRupee className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Parts */}
        <Card className="bg-white border border-gray-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Low Stock Parts</p>
                <h3 className="text-3xl font-extrabold text-amber-600">{metrics.lowStockCount}</h3>
                <p className="text-gray-400 text-xs font-medium">Inventory items below safety levels</p>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board Title */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Repair Workflow Board</h2>
          <p className="text-sm text-gray-500">Track and advance job status cards across stages.</p>
        </div>
        <Button onClick={() => router.push("/repair/jobs/new")} className="gap-1.5 shadow-sm">
          <PlusCircle className="h-4 w-4" /> Create Job Card
        </Button>
      </div>

      {/* Kanban Board Columns Container */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-[400px] border border-gray-200" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 pb-6 overflow-x-auto select-none snap-x snap-mandatory min-h-[500px]">
          {statusColumns.map((col) => {
            const colJobs = jobs.filter((job) => job.status === col.key);

            return (
              <div
                key={col.key}
                className="w-80 flex-shrink-0 flex flex-col bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden snap-center"
              >
                {/* Column Header */}
                <div className={`px-4 py-3 border-b flex justify-between items-center ${col.bg}`}>
                  <span className={`font-semibold text-sm ${col.text}`}>{col.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${col.badge}`}>
                    {colJobs.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[550px] custom-scrollbar">
                  {colJobs.length > 0 ? (
                    colJobs.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => router.push(`/repair/jobs/${job.id}`)}
                        className={`bg-white p-4 rounded-xl border border-gray-150 shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-200 cursor-pointer relative group ${
                          updatingId === job.id ? "opacity-55 pointer-events-none" : ""
                        }`}
                      >
                        {/* Job Badge */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {job.jobNumber}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-400 capitalize flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(job.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>

                        {/* Customer & Device */}
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm text-gray-900 group-hover:text-violet-600 transition-colors">
                            {job.customer.name}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium">
                            {job.deviceBrand} {job.deviceModel} ({job.deviceType})
                          </p>
                          <p className="text-xs text-gray-400 line-clamp-2 italic pt-1 border-t border-dashed border-gray-100">
                            "{job.reportedIssue}"
                          </p>
                        </div>

                        {/* Cost & Balance */}
                        <div className="mt-3 pt-2 border-t flex justify-between items-center text-xs">
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase font-bold tracking-wide">
                              Cost
                            </span>
                            <span className="font-bold text-gray-700">
                              ₹{job.finalCost > 0 ? job.finalCost : job.estimatedCost}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400 block text-[9px] uppercase font-bold tracking-wide">
                              Balance Due
                            </span>
                            <span
                              className={`font-bold ${
                                job.balanceDue > 0 ? "text-red-500" : "text-green-600"
                              }`}
                            >
                              ₹{job.balanceDue}
                            </span>
                          </div>
                        </div>

                        {/* Quick Status Control */}
                        <div
                          className="mt-3.5 pt-2.5 border-t flex items-center justify-between gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[80px]">{job.assignedToStaff}</span>
                          </div>

                          <div className="relative">
                            <Select
                              value={job.status}
                              onChange={(e) => handleStatusChange(job.id, e.target.value)}
                              className="text-[10px] h-7 px-1.5 py-0 rounded font-semibold w-[100px]"
                            >
                              <option value="RECEIVED">Received</option>
                              <option value="DIAGNOSING">Diagnose</option>
                              <option value="WAITING_FOR_PARTS">Wait Parts</option>
                              <option value="REPAIRING">Repairing</option>
                              <option value="READY">Ready</option>
                              <option value="DELIVERED">Delivered</option>
                              <option value="UNREPAIRABLE">Unrepairable</option>
                              <option value="RETURNED_UNREPAIRED">Returned</option>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white/40">
                      <p className="text-xs font-semibold">No jobs in this stage</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
