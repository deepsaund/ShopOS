"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { formatRupee } from "@/lib/utils";
import {
  Search,
  Plus,
  Scissors,
  IndianRupee,
  Calendar,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  deliveryDate: string;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  specialInstructions: string | null;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
  };
  items: any[];
  payments: any[];
}

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  // URL search parameter shortcut
  const searchUrlQuery = searchParams.get("search") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchUrlQuery);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Status Form state
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentType, setPaymentType] = useState("BALANCE");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const statusQuery = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
      const dateRangeQuery = `${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`;
      
      const res = await fetch(
        `/api/tailor/orders?page=${page}&limit=${limit}${statusQuery}${dateRangeQuery}`,
        {
          headers: { "x-tenant-id": tenantId },
        }
      );
      if (!res.ok) throw new Error("Failed to load orders");
      const result = await res.json();
      
      // Client-side text search (to search by customer name, phone, or order number)
      let list: Order[] = result.data || [];
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter(
          (o) =>
             o.orderNumber.toLowerCase().includes(q) ||
             o.customer.name.toLowerCase().includes(q) ||
             o.customer.phone.includes(q)
        );
      }

      setOrders(list);
      setTotal(search.trim() ? list.length : (result.total || 0));
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter, startDate, endDate, tenantId]);

  // Handle direct search input changes
  useEffect(() => {
    if (searchUrlQuery) {
      setSearch(searchUrlQuery);
    }
  }, [searchUrlQuery]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !newStatus) return;

    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/tailor/orders/${activeOrder.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast(`Order ${activeOrder.orderNumber} status updated to ${newStatus}`, "success");
      setStatusModalOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return toast("Please enter a valid amount", "error");

    try {
      setRecordingPayment(true);
      const res = await fetch(`/api/tailor/orders/${activeOrder.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          amount,
          paymentMode,
          paymentType,
          notes: paymentNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast(`Recorded ₹${amount} payment for ${activeOrder.orderNumber}!`, "success");
      setPaymentModalOpen(false);
      
      // Reset payment states
      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentMode("CASH");
      setPaymentType("BALANCE");

      fetchOrders();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to record payment", "error");
    } finally {
      setRecordingPayment(false);
    }
  };

  const openStatusModal = (order: Order) => {
    setActiveOrder(order);
    setNewStatus(order.status);
    setStatusModalOpen(true);
  };

  const openPaymentModal = (order: Order) => {
    setActiveOrder(order);
    setPaymentAmount(order.balanceDue.toString()); // default to full outstanding balance
    setPaymentType("BALANCE");
    setPaymentModalOpen(true);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Orders Management Ledger</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track cutting, stitching, trials, and record payments.</p>
        </div>
        <Link href="/tailor/orders/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </Link>
      </div>

      {/* Tabs Filter */}
      <Tabs value={statusFilter} onValueChange={(val) => {
        setStatusFilter(val);
        setPage(1);
      }} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1.5 rounded-xl border border-gray-150">
          <TabsTrigger value="ALL">All Orders</TabsTrigger>
          <TabsTrigger value="TAKEN">Taken</TabsTrigger>
          <TabsTrigger value="CUTTING">Cutting</TabsTrigger>
          <TabsTrigger value="STITCHING">Stitching</TabsTrigger>
          <TabsTrigger value="TRIAL">Trial</TabsTrigger>
          <TabsTrigger value="READY">Ready</TabsTrigger>
          <TabsTrigger value="DELIVERED">Delivered</TabsTrigger>
          <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Advanced Filter Panel */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Search</label>
              <div className="flex items-center gap-2 border border-gray-200 bg-white rounded-lg px-3 py-1 text-sm shadow-sm hover:border-gray-300">
                <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Order No., customer name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 py-1.5 text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Date Filters */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Delivery From</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Delivery To</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
            </div>

            {/* Refresh button */}
            <div className="flex items-end">
              <Button variant="outline" onClick={() => {
                setSearch("");
                setStartDate("");
                setEndDate("");
                setStatusFilter("ALL");
                setPage(1);
                fetchOrders();
              }} className="w-full gap-2 text-gray-600 hover:text-gray-900 shadow-sm">
                <RefreshCw className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200/60 rounded-lg" />
              ))}
            </div>
          ) : orders.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Garments</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-semibold text-violet-600">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">{o.customer?.name}</span>
                          <span className="text-xs text-gray-400">{o.customer?.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 text-xs font-medium max-w-[150px] truncate">
                        {o.items?.map((it) => `${it.garmentType} (${it.fabricMetersUsed || 0}m)`).join(", ")}
                      </TableCell>
                      <TableCell className="font-medium text-gray-600">
                        {new Date(o.deliveryDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={o.status.toLowerCase() as any}>
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatRupee(o.totalAmount)}
                      </TableCell>
                      <TableCell className={`text-right font-extrabold ${o.balanceDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {formatRupee(o.balanceDue)}
                      </TableCell>
                      <TableCell className="text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-gray-200"
                          onClick={() => openStatusModal(o)}
                        >
                          <Scissors className="h-3.5 w-3.5 text-gray-500" />
                          Status
                        </Button>
                        {o.balanceDue > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100/60 border-emerald-200/50"
                            onClick={() => openPaymentModal(o)}
                          >
                            <IndianRupee className="h-3.5 w-3.5" />
                            Pay
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">
                    Showing Page {page} of {totalPages} ({total} orders)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Scissors className="h-10 w-10 text-gray-300 mb-2 animate-pulse" />
              <p className="text-sm font-semibold text-gray-500">No orders matching selected criteria.</p>
              <Link href="/tailor/orders/new" className="mt-3">
                <Button size="sm" variant="outline">
                  Place First Order
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* UPDATE STATUS MODAL (Dialog) */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStatus} className="space-y-4 pt-2">
            <p className="text-xs text-gray-500">
              Update tailoring tracking status for order{" "}
              <strong className="text-gray-900">{activeOrder?.orderNumber}</strong>.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Tailoring Status</label>
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="TAKEN">Taken (Order Confirmed)</option>
                <option value="CUTTING">Cutting Fabric</option>
                <option value="STITCHING">Stitching Garments</option>
                <option value="TRIAL">Trial / Fitting</option>
                <option value="READY">Ready for Delivery</option>
                <option value="DELIVERED">Delivered to Customer</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <DialogClose asChild>
                <Button variant="outline" type="button">Close</Button>
              </DialogClose>
              <Button type="submit" disabled={updatingStatus}>
                {updatingStatus ? "Saving..." : "Save Status"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECORD PAYMENT MODAL (Dialog) */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <p className="text-xs text-gray-500">
              Log payment transaction for order{" "}
              <strong className="text-gray-900">{activeOrder?.orderNumber}</strong>. Total outstanding balance is{" "}
              <strong className="text-amber-600">{formatRupee(activeOrder?.balanceDue)}</strong>.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Payment Amount (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Payment Type</label>
                <Select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  <option value="BALANCE">Balance Payment</option>
                  <option value="ADVANCE">Advance Payment</option>
                  <option value="REFUND">Refund Transaction</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Payment Mode</label>
              <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="CASH">Cash Payment</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="CREDIT">Shop Credit / Ledger</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Notes / Remarks</label>
              <Textarea
                placeholder="Transaction reference ID, trial success, client signature, etc."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={recordingPayment} className="bg-emerald-600 hover:bg-emerald-700">
                {recordingPayment ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-44 bg-gray-200/60 rounded-lg" />
        <div className="h-96 bg-gray-200/60 rounded-xl" />
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}

