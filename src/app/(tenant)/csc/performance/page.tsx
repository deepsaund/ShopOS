"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useCscRole } from "../csc-role-context";
import {
  TrendingUp,
  FileText,
  CheckCircle,
  IndianRupee,
  Users,
  AlertCircle,
  Briefcase,
  Clock,
  ArrowUpRight,
} from "lucide-react";

interface StaffStats {
  staffId: string;
  processingCount: number;
  completedCount: number;
  completedTodayCount: number;
  totalRevenue: number;
}

interface DashboardData {
  queueCount: number;
  completedToday: number;
  revenueToday: number;
  staffPerformance: StaffStats[];
}

export default function PerformancePage() {
  const { tenantId } = useTenant();
  const { role } = useCscRole();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardStats();
  }, [tenantId]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/csc/dashboard", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl min-h-[300px] text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h3 className="text-lg font-bold text-white">Access Denied</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Only administrators can access performance analytics. Use the Role Switcher at the top of the page to switch to ADMIN mode.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-slate-950/40 border border-slate-850 rounded-2xl text-rose-400 text-xs">
        {error || "Failed to load dashboard metrics"}
      </div>
    );
  }

  // Calculate total operators
  const totalOperators = data.staffPerformance.length;

  return (
    <div className="space-y-8 py-2">
      {/* Title & SLA Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div className="space-y-1">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
            ADMINISTRATOR INTELLIGENCE
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">CSC Analytics Dashboard</h2>
          <p className="text-xs text-slate-400">
            Real-time tracking of claiming operations, revenue distribution, and operator SLA velocities.
          </p>
        </div>
        <button
          onClick={fetchDashboardStats}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-300 transition-all flex items-center gap-1.5"
        >
          Refresh Data
          <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800/80 p-6 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <FileText className="h-20 w-20 text-indigo-400" />
          </div>
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Unclaimed Queue</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{data.queueCount}</span>
              <span className="text-xs text-indigo-400 font-semibold">claims ready</span>
            </div>
            <p className="text-[10px] text-slate-500">Approved documents awaiting operator claim.</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950/20 border border-slate-800/80 p-6 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle className="h-20 w-20 text-emerald-400" />
          </div>
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Completed Today</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{data.completedToday}</span>
              <span className="text-xs text-emerald-500 font-semibold">requests finished</span>
            </div>
            <p className="text-[10px] text-slate-500">Processed and resolved in the last 24h.</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-violet-950/20 border border-slate-800/80 p-6 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <IndianRupee className="h-20 w-20 text-violet-400" />
          </div>
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Daily Revenue</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-violet-400">₹{data.revenueToday}</span>
              <span className="text-xs text-violet-500 font-semibold">today's earnings</span>
            </div>
            <p className="text-[10px] text-slate-500">Accrued price fees of completed cases today.</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-amber-950/20 border border-slate-800/80 p-6 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Users className="h-20 w-20 text-amber-400" />
          </div>
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Active Operators</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">{totalOperators}</span>
              <span className="text-xs text-amber-500 font-semibold">staff claimed</span>
            </div>
            <p className="text-[10px] text-slate-500">Total staff with active claims or completions.</p>
          </div>
        </div>
      </div>

      {/* Staff Performance summary Table */}
      <div className="bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/40">
          <h3 className="font-bold text-sm text-white">Operator Efficiency Ledger</h3>
          <p className="text-[10px] text-slate-500">Individual performance metrics breakdown per active staff operator.</p>
        </div>

        <div className="overflow-x-auto">
          {data.staffPerformance.length === 0 ? (
            <div className="text-center p-12 text-slate-500">
              <Briefcase className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-semibold">No performance data captured yet</p>
              <p className="text-[10px] text-slate-650">Operator metrics compile once requests are claimed and processed.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-slate-850 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  <th className="px-6 py-4">Operator/Staff Identifier</th>
                  <th className="px-6 py-4 text-center">Active Processing</th>
                  <th className="px-6 py-4 text-center">Completions Today</th>
                  <th className="px-6 py-4 text-center">Cumulative Completed</th>
                  <th className="px-6 py-4 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-xs text-slate-300">
                {data.staffPerformance.map((staff) => (
                  <tr key={staff.staffId} className="hover:bg-slate-900/20 transition-all">
                    <td className="px-6 py-4 font-bold text-slate-200">
                      {staff.staffId === "staff-1" ? "Arjun Kumar (Simulated Operator)" : staff.staffId}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                        staff.processingCount > 0 ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10" : "text-slate-500 bg-slate-900"
                      }`}>
                        {staff.processingCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-200">
                      {staff.completedTodayCount}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-200">
                      {staff.completedCount}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-violet-400">
                      ₹{staff.totalRevenue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
