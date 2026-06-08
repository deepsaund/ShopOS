"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupee } from "@/lib/utils";
import {
  History,
  Search,
  Filter,
  Calendar,
  Eye,
  TrendingUp,
} from "lucide-react";

export default function SalesHistoryPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [sales, setSales] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");

  // Detail Modal states
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    loadSalesData();
  }, [tenantId, startDateStr, endDateStr, paymentModeFilter]);

  useEffect(() => {
    // Load employees for filter
    async function loadEmployees() {
      try {
        const res = await fetch("/api/shoes/employees?limit=100", {
          headers: { "x-tenant-id": tenantId },
        });
        if (res.ok) {
          const json = await res.json();
          setEmployees(json.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadEmployees();
  }, [tenantId]);

  async function loadSalesData() {
    try {
      setLoading(true);
      
      let queryUrl = `/api/shoes/sales?limit=100`;
      if (startDateStr) {
        queryUrl += `&startDate=${new Date(startDateStr).toISOString()}`;
      }
      if (endDateStr) {
        // End of that day
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        queryUrl += `&endDate=${end.toISOString()}`;
      }
      if (paymentModeFilter !== "ALL") {
        queryUrl += `&paymentMode=${paymentModeFilter}`;
      }

      const res = await fetch(queryUrl, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load sales history");
      const json = await res.json();
      setSales(json.data || []);
    } catch (err: any) {
      toast(err.message || "Error fetching sales history", "error");
    } finally {
      setLoading(false);
    }
  }

  // Filter servedBy in-memory
  const filteredSales = sales.filter((sale) => {
    if (employeeFilter !== "ALL" && sale.servedBy !== employeeFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter panel */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Start Date
              </label>
              <Input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="h-9"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> End Date
              </label>
              <Input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Payment Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Payment Mode</label>
              <Select value={paymentModeFilter} onChange={(e) => setPaymentModeFilter(e.target.value)} className="h-9">
                <option value="ALL">All Modes</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="UDHAAR">Udhaar</option>
                <option value="PARTIAL">Partial</option>
              </Select>
            </div>

            {/* Served By Employee */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Served By Staff</label>
              <Select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="h-9">
                <option value="ALL">All Staff</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table list */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center justify-between">
          <CardTitle className="text-md font-bold text-gray-800 flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-500" /> Transaction Invoices
          </CardTitle>
          <Badge variant="secondary" className="bg-indigo-50 text-indigo-750">
            {filteredSales.length} Total Sales
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm animate-pulse">
              Loading transactions data...
            </div>
          ) : filteredSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items Sold</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead className="text-right">Paid (₹)</TableHead>
                  <TableHead className="text-right">Pending (₹)</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const itemSummary = sale.items
                    ?.map((it: any) => `${it.sku?.product?.brand?.name || ""} Size ${it.sku?.size}`)
                    .join(", ");
                  return (
                    <TableRow
                      key={sale.id}
                      onClick={() => {
                        setSelectedSale(sale);
                        setIsDetailOpen(true);
                      }}
                      className="cursor-pointer hover:bg-gray-50/70 transition-colors"
                    >
                      <TableCell className="font-semibold text-gray-700">
                        {new Date(sale.saleDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-bold text-gray-800">
                        {sale.customer ? sale.customer.name : "Walk-in Customer"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-gray-550" title={itemSummary}>
                        {itemSummary || "No items"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {formatRupee(sale.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {formatRupee(sale.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          Number(sale.amountPending) > 0 ? "text-rose-600" : "text-gray-550"
                        }`}
                      >
                        {formatRupee(sale.amountPending)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.paymentMode.toLowerCase() as any}>
                          {sale.paymentMode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4.5 w-4.5 text-indigo-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-20 text-gray-400 text-sm font-semibold">
              No transactions matched the selected filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Detail Dialog Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sale Details — Invoice #{selectedSale?.id?.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-5 py-2">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <span className="text-gray-450 uppercase font-bold tracking-wider text-[10px]">Date & Time</span>
                  <p className="font-bold text-gray-800">
                    {new Date(selectedSale.saleDate).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-450 uppercase font-bold tracking-wider text-[10px]">Served By Staff</span>
                  <p className="font-bold text-gray-800">{selectedSale.servedBy}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-450 uppercase font-bold tracking-wider text-[10px]">Customer Profile</span>
                  <p className="font-bold text-gray-900">
                    {selectedSale.customer ? (
                      `${selectedSale.customer.name} (${selectedSale.customer.phone})`
                    ) : (
                      "Walk-in Client"
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-450 uppercase font-bold tracking-wider text-[10px]">Payment Mode</span>
                  <div>
                    <Badge variant={selectedSale.paymentMode.toLowerCase() as any}>
                      {selectedSale.paymentMode}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Items listing */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sale Items Checklist</h4>
                <div className="border border-gray-150 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead>Style/Size</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-bold text-xs text-gray-800">
                              {item.sku?.product?.brand?.name} {item.sku?.product?.modelName}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold">
                              Size {item.sku?.size} • {item.sku?.color}
                            </p>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-xs">{item.quantity}</TableCell>
                          <TableCell className="text-right font-bold text-xs text-gray-900">
                            {formatRupee(item.pricePerUnit * item.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Summary and Profit calculations */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 space-y-2.5 text-xs text-gray-650">
                <div className="flex justify-between">
                  <span>Subtotal MRP:</span>
                  <span className="font-medium">{formatRupee(selectedSale.totalMrp)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Total Discount:</span>
                  <span>-{formatRupee(selectedSale.discount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-gray-900 border-t border-gray-200/50 pt-2">
                  <span>Net Amount Paid:</span>
                  <span>{formatRupee(selectedSale.totalAmount)}</span>
                </div>

                <div className="flex justify-between text-indigo-700 font-bold border-t border-gray-200/50 pt-2 bg-indigo-50/50 -mx-4 -mb-4 p-3 rounded-b-xl items-center">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-4.5 w-4.5" /> Total Profit Margin
                  </span>
                  <span>{formatRupee(selectedSale.profit)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
            <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>
              Close Detail
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
