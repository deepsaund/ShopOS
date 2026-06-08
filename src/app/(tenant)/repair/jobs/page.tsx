"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldCheck,
  Calendar,
  User,
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
  deliveryDate: string;
  isUnderWarranty: boolean;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function JobCardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [staff, setStaff] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [warrantyOnly, setWarrantyOnly] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      let url = `/api/repair/jobs?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (status && status !== "ALL") {
        url += `&status=${status}`;
      }
      if (staff) {
        url += `&staff=${encodeURIComponent(staff)}`;
      }
      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }
      if (warrantyOnly) {
        url += `&warranty=true`;
      }

      const res = await fetch(url, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load job cards");
      const data = await res.json();
      setJobs(data.data || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load jobs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, status, tenantId, warrantyOnly]);

  const handleApplyFilters = () => {
    setPage(1);
    fetchJobs();
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setStaff("");
    setStartDate("");
    setEndDate("");
    setWarrantyOnly(false);
    setPage(1);
  };

  const getStatusBadge = (jobStatus: string) => {
    switch (jobStatus) {
      case "RECEIVED":
        return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">Received</Badge>;
      case "DIAGNOSING":
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200">Diagnosing</Badge>;
      case "WAITING_FOR_PARTS":
        return <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200">Wait Parts</Badge>;
      case "REPAIRING":
        return <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200">Repairing</Badge>;
      case "READY":
        return <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">Ready</Badge>;
      case "DELIVERED":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200">Delivered</Badge>;
      case "UNREPAIRABLE":
        return <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200">Unrepairable</Badge>;
      case "RETURNED_UNREPAIRED":
        return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-200">Returned Unrepaired</Badge>;
      default:
        return <Badge>{jobStatus}</Badge>;
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Job Cards registry</h2>
          <p className="text-sm text-gray-500">Search, filter, and track repair job tickets.</p>
        </div>
        <Button onClick={() => router.push("/repair/jobs/new")} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Create Job Card
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs value={status} onValueChange={(val) => { setStatus(val); setPage(1); }} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-gray-100/80 rounded-xl">
          <TabsTrigger value="ALL">All Jobs</TabsTrigger>
          <TabsTrigger value="RECEIVED">Received</TabsTrigger>
          <TabsTrigger value="DIAGNOSING">Diagnosing</TabsTrigger>
          <TabsTrigger value="WAITING_FOR_PARTS">Waiting Parts</TabsTrigger>
          <TabsTrigger value="REPAIRING">Repairing</TabsTrigger>
          <TabsTrigger value="READY">Ready</TabsTrigger>
          <TabsTrigger value="DELIVERED">Delivered</TabsTrigger>
          <TabsTrigger value="RETURNED_UNREPAIRED">Returned</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Advanced Filters */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Search Text</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Job #, Brand, Customer Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Staff */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Assigned Staff</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Staff Name"
                  value={staff}
                  onChange={(e) => setStaff(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Est. Delivery From</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-gray-800 cursor-pointer"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Est. Delivery To</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-gray-800 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-gray-100">
            {/* Warranty Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={warrantyOnly}
                onChange={(e) => setWarrantyOnly(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-violet-600" />
                Under Warranty Only
              </span>
            </label>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleApplyFilters}>
                <Filter className="h-4 w-4" /> Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card className="border-gray-200/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200/60 rounded-lg" />
              ))}
            </div>
          ) : jobs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Balance Due</TableHead>
                      <TableHead>Assigned Staff</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => {
                      const totalCost = job.finalCost > 0 ? job.finalCost : job.estimatedCost;

                      return (
                        <TableRow
                          key={job.id}
                          onClick={() => router.push(`/repair/jobs/${job.id}`)}
                          className="cursor-pointer hover:bg-gray-50/50"
                        >
                          <TableCell className="font-bold text-gray-900">{job.jobNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-gray-800">{job.customer.name}</p>
                              <p className="text-[11px] text-gray-400 font-medium">{job.customer.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-800">
                                {job.deviceBrand} {job.deviceModel}
                              </p>
                              <p className="text-[11px] text-gray-400 font-semibold uppercase">
                                {job.deviceType} {job.imeiSerial ? `| IMEI: ${job.imeiSerial}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell className="font-bold text-gray-700">₹{totalCost}</TableCell>
                          <TableCell>
                            <span
                              className={`font-extrabold ${
                                job.balanceDue > 0 ? "text-red-500" : "text-green-600"
                              }`}
                            >
                              ₹{job.balanceDue}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-600 text-xs">
                            {job.assignedToStaff}
                          </TableCell>
                          <TableCell>
                            {job.isUnderWarranty ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-0.5 w-fit">
                                <ShieldCheck className="h-3 w-3" /> Under Warranty
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400 font-medium">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-violet-600 hover:text-violet-700 gap-1"
                              onClick={() => router.push(`/repair/jobs/${job.id}`)}
                            >
                              <Eye className="h-4 w-4" /> View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">
                    Showing Page {page} of {totalPages} ({total} jobs)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No job cards found matching current filters.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={handleResetFilters}>
                Reset Search Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
