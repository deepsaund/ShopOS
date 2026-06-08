"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupee } from "@/lib/utils";
import {
  Users,
  Search,
  IndianRupee,
  Calendar,
  CreditCard,
  History,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  User,
} from "lucide-react";

export default function CustomersPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Repayment Dialog States
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayNotes, setRepayNotes] = useState("");
  const [repayingCustomer, setRepayingCustomer] = useState<any | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [tenantId]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const res = await fetch(`/api/shoes/customers?limit=100`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load customers list");
      const json = await res.json();
      setCustomers(json.data || []);
      
      // Auto-select first customer if available
      if (json.data && json.data.length > 0) {
        handleSelectCustomer(json.data[0]);
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // Load customer detail profile
  const handleSelectCustomer = async (cust: any) => {
    setSelectedCustomer(cust);
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/shoes/customers/${cust.id}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load customer profile");
      const details = await res.json();
      setCustomerDetail(details);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Submit Repayment
  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingCustomer || !repayAmount) return;

    try {
      const res = await fetch(`/api/shoes/customers/${repayingCustomer.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          amount: parseFloat(repayAmount),
          notes: repayNotes || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Repayment recording failed");
      }

      toast("Udhaar repayment recorded successfully", "success");
      setIsRepayOpen(false);
      setRepayAmount("");
      setRepayNotes("");

      // Reload list and current profile
      loadCustomers();
      if (selectedCustomer && selectedCustomer.id === repayingCustomer.id) {
        handleSelectCustomer(repayingCustomer);
      }
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Left Panel: Customer Directory List */}
      <div className="md:col-span-5 space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
            <CardTitle className="text-md font-bold text-gray-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" /> Customer Profiles
            </CardTitle>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-750">
              {filteredCustomers.length} Total
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 shadow-sm"
              />
            </div>

            {/* List */}
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm animate-pulse">
                Loading profiles list...
              </div>
            ) : filteredCustomers.length > 0 ? (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredCustomers.map((cust) => {
                  const active = selectedCustomer?.id === cust.id;
                  const hasUdhaar = Number(cust.totalUdhaarBalance) > 0;
                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        active
                          ? "bg-indigo-50 border-indigo-200 shadow-sm"
                          : "bg-white hover:bg-gray-50 border-gray-150"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-bold text-sm text-gray-950 truncate">{cust.name}</h4>
                        <p className="text-xs text-gray-400 font-semibold">{cust.phone}</p>
                      </div>

                      <div className="text-right space-y-1">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            hasUdhaar
                              ? "bg-rose-50 text-rose-700 border-rose-100"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {formatRupee(cust.totalUdhaarBalance)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm font-medium">
                No customer profiles match.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel: Selected Customer Ledger & Purchase History */}
      <div className="md:col-span-7">
        {loadingDetail ? (
          <Card className="h-full flex items-center justify-center p-20 animate-pulse">
            <div className="text-center text-gray-400 text-sm font-semibold">
              Loading detailed client record...
            </div>
          </Card>
        ) : customerDetail ? (
          <div className="space-y-6">
            {/* Customer profile banner card */}
            <Card className="shadow-sm">
              <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">{customerDetail.name}</h3>
                    <p className="text-xs text-gray-400 font-medium">
                      Phone: <span className="font-semibold text-gray-600">{customerDetail.phone}</span>
                      {customerDetail.address && ` • Address: ${customerDetail.address}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="space-y-0.5 bg-rose-50/50 border border-rose-100 p-2.5 rounded-xl text-center flex-1 sm:flex-initial sm:px-4">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-rose-700">Udhaar Due</span>
                    <p className="font-bold text-rose-800 text-base leading-tight">
                      {formatRupee(customerDetail.totalUdhaarBalance)}
                    </p>
                  </div>

                  {Number(customerDetail.totalUdhaarBalance) > 0 && (
                    <Button
                      onClick={() => {
                        setRepayingCustomer(customerDetail);
                        setIsRepayOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm h-10 px-4"
                    >
                      <IndianRupee className="h-4 w-4 mr-1" /> Record Repayment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Udhaar Ledger Timeline */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <CreditCard className="h-4.5 w-4.5 text-indigo-500" /> Credit & Payment Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customerDetail.udhaarLedgers && customerDetail.udhaarLedgers.length > 0 ? (
                  <div className="relative border-l border-gray-150 pl-5 ml-2.5 space-y-5 py-2">
                    {customerDetail.udhaarLedgers.map((tx: any) => {
                      const isCredit = tx.transactionType === "CREDIT";
                      return (
                        <div key={tx.id} className="relative animate-fade-in">
                          {/* Indicator circle */}
                          <span
                            className={`absolute -left-[30px] top-1 p-1 rounded-full border ${
                              isCredit
                                ? "bg-rose-50 text-rose-600 border-rose-200"
                                : "bg-emerald-50 text-emerald-600 border-emerald-200"
                            }`}
                          >
                            {isCredit ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                            )}
                          </span>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-bold text-xs text-gray-850">
                                {isCredit ? "Udhaar Credit Added" : "Repayment Received"}
                              </span>
                              <span
                                className={`text-xs font-bold ${
                                  isCredit ? "text-rose-650" : "text-emerald-650"
                                }`}
                              >
                                {isCredit ? "+" : "-"} {formatRupee(tx.amount)}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(tx.createdAt).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {tx.notes && <p className="text-xs text-gray-500 italic">“{tx.notes}”</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-xs font-medium">
                    No ledger transactions recorded.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Purchase History */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-indigo-500" /> Purchase History
                </CardTitle>
                <Badge variant="secondary" className="text-xs bg-gray-50">
                  {customerDetail.sales?.length || 0} Invoices
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {customerDetail.sales && customerDetail.sales.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Items Bought</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead className="text-right">Total Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerDetail.sales.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-semibold text-xs text-gray-700">
                            {new Date(sale.saleDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-gray-550">
                            {sale.items
                              ?.map((it: any) => `${it.sku?.product?.brand?.name || ""} Sz ${it.sku?.size}`)
                              .join(", ")}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {formatRupee(sale.amountPaid)} ({sale.paymentMode})
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs text-gray-900">
                            {formatRupee(sale.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-gray-400 text-xs font-semibold">
                    No invoices registered for this client.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="h-full flex flex-col items-center justify-center p-20 text-center bg-gray-50/50 border border-dashed border-gray-150 rounded-2xl">
            <Users className="h-10 w-10 text-gray-300 mb-2" />
            <h3 className="font-bold text-md text-gray-700">Select Customer</h3>
            <p className="text-sm text-gray-400 mt-1">Select a customer profile to view timelines & history.</p>
          </Card>
        )}
      </div>

      {/* Record Repayment Dialog Modal */}
      <Dialog open={isRepayOpen} onOpenChange={setIsRepayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Udhaar Repayment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRepaySubmit} className="space-y-4">
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-xs font-semibold text-rose-800">
              Outstanding credit balance for {repayingCustomer?.name}:{" "}
              <strong className="text-sm">{formatRupee(repayingCustomer?.totalUdhaarBalance)}</strong>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Repayment Amount (₹)</label>
              <Input
                type="number"
                placeholder="Enter paid amount..."
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Notes / Mode details</label>
              <Input
                placeholder="e.g. Paid in cash, Google Pay txn ID..."
                value={repayNotes}
                onChange={(e) => setRepayNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setIsRepayOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm">
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
