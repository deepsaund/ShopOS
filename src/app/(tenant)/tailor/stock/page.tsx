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
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { formatRupee } from "@/lib/utils";
import {
  Layers,
  Plus,
  AlertTriangle,
  History,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface FabricStock {
  id: string;
  fabricName: string;
  fabricType: string;
  color: string;
  pattern: string | null;
  quantityMeters: number;
  ratePerMeter: number;
  lowStockThresholdMeters: number;
  isLowStock: boolean;
  prediction: {
    avgMetersPerOrderLast30Days: number;
    estimatedOrdersRemaining: number | null;
  };
}

interface Transaction {
  id: string;
  transactionType: "IN" | "OUT";
  quantityMeters: number;
  referenceType: string;
  referenceId: string;
  notes: string | null;
  createdAt: string;
}

export default function StockPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [stocks, setStocks] = useState<FabricStock[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Form states (Fabric Intake)
  const [supplierId, setSupplierId] = useState("");
  const [fabricName, setFabricName] = useState("");
  const [fabricType, setFabricType] = useState("");
  const [color, setColor] = useState("");
  const [pattern, setPattern] = useState("");
  const [quantityMeters, setQuantityMeters] = useState("");
  const [ratePerMeter, setRatePerMeter] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [submittingStock, setSubmittingStock] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Form states (Supplier Inline Registration)
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Expanded fabric ID for transactions log
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tailor/stock?page=${page}&limit=${limit}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load fabric stock");
      const result = await res.json();
      setStocks(result.data || []);
      setTotal(result.total || 0);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load stock", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/tailor/suppliers", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load suppliers");
      const data = await res.json();
      setSuppliers(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchSuppliers();
  }, [page, tenantId]);

  const loadTransactions = async (stockId: string) => {
    if (expandedStockId === stockId) {
      setExpandedStockId(null);
      return;
    }

    try {
      setLoadingTx(true);
      setExpandedStockId(stockId);
      const res = await fetch(`/api/tailor/stock/${stockId}/transactions`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load transaction history");
      const data = await res.json();
      setTransactions(data || []);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load transactions", "error");
    } finally {
      setLoadingTx(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim() || !supAddress.trim()) {
      return toast("Please fill out all required supplier fields", "error");
    }

    try {
      setSavingSupplier(true);
      const res = await fetch("/api/tailor/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          name: supName,
          phone: supPhone,
          address: supAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register supplier");

      toast(`Supplier ${supName} registered!`, "success");
      setSuppliers((prev) => [...prev, data]);
      setSupplierId(data.id);
      setAddSupplierOpen(false);

      // Reset supplier inputs
      setSupName("");
      setSupPhone("");
      setSupAddress("");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to save supplier", "error");
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleSubmitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return toast("Please select a supplier", "error");
    if (!fabricName.trim()) return toast("Fabric name is required", "error");
    if (!fabricType.trim()) return toast("Fabric type is required", "error");
    if (!color.trim()) return toast("Color is required", "error");
    
    const qty = parseFloat(quantityMeters);
    const rate = parseFloat(ratePerMeter);
    const threshold = parseFloat(lowStockThreshold);

    if (isNaN(qty) || qty <= 0) return toast("Please enter a valid quantity", "error");
    if (isNaN(rate) || rate <= 0) return toast("Please enter a valid rate per meter", "error");

    try {
      setSubmittingStock(true);
      const res = await fetch("/api/tailor/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          supplierId,
          fabricName,
          fabricType,
          color,
          pattern: pattern.trim() || null,
          quantityMeters: qty,
          ratePerMeter: rate,
          lowStockThresholdMeters: isNaN(threshold) ? 5.0 : threshold,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add fabric stock");

      toast(`Fabric ${fabricName} added to inventory!`, "success");
      setDrawerOpen(false);

      // Reset stock form fields
      setSupplierId("");
      setFabricName("");
      setFabricType("");
      setColor("");
      setPattern("");
      setQuantityMeters("");
      setRatePerMeter("");
      setLowStockThreshold("5");

      fetchStock();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to add stock", "error");
    } finally {
      setSubmittingStock(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Fabric Stock Inventory</h2>
          <p className="text-sm text-gray-500 mt-0.5">Add cloth stock received from suppliers, monitor meters, and check depletion predictions.</p>
        </div>

        {/* Radix Sheet Trigger for Add Stock Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Fabric Stock
            </Button>
          </SheetTrigger>
          <SheetContent className="max-w-xl">
            <SheetHeader>
              <SheetTitle>Add Cloth Stock received</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmitStock} className="space-y-6 pt-4">
              {/* Supplier Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wider border-b pb-1">Supplier Selection</h3>
                <div className="flex gap-2">
                  <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Sheet open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" type="button" size="icon" title="Add New Supplier">
                        <PlusCircle className="h-4 w-4 text-gray-500" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="max-w-md">
                      <SheetHeader>
                        <SheetTitle>Register Fabric Supplier</SheetTitle>
                      </SheetHeader>
                      <form onSubmit={handleSaveSupplier} className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Supplier Name *</label>
                          <Input placeholder="E.g. Cotton India Ltd" value={supName} onChange={(e) => setSupName(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Phone Number *</label>
                          <Input placeholder="E.g. 9988776655" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Office Address *</label>
                          <Textarea placeholder="Supplier office address" value={supAddress} onChange={(e) => setSupAddress(e.target.value)} required rows={2} />
                        </div>
                        <div className="flex gap-2 justify-end pt-4 border-t">
                          <SheetClose asChild>
                            <Button variant="outline" type="button">Close</Button>
                          </SheetClose>
                          <Button type="submit" disabled={savingSupplier}>
                            {savingSupplier ? "Saving..." : "Save Supplier"}
                          </Button>
                        </div>
                      </form>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {/* Fabric Parameters */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wider border-b pb-1">Fabric Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Fabric Name *</label>
                    <Input placeholder="E.g. Linen Premium Solid" value={fabricName} onChange={(e) => setFabricName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Fabric Type *</label>
                    <Input placeholder="E.g. Linen / Silk / Cotton" value={fabricType} onChange={(e) => setFabricType(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Color *</label>
                    <Input placeholder="E.g. Navy Blue" value={color} onChange={(e) => setColor(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Pattern Pattern</label>
                    <Input placeholder="E.g. Check / Stripes / Solid" value={pattern} onChange={(e) => setPattern(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500">Meters Received *</label>
                    <Input type="number" step="0.1" placeholder="Meters" value={quantityMeters} onChange={(e) => setQuantityMeters(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500">Rate / Meter (₹) *</label>
                    <Input type="number" step="0.01" placeholder="Rate" value={ratePerMeter} onChange={(e) => setRatePerMeter(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500">Alert Threshold (m)</label>
                    <Input type="number" step="0.1" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <SheetClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </SheetClose>
                <Button type="submit" disabled={submittingStock}>
                  {submittingStock ? "Adding Stock..." : "Add Stock"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Stock Levels Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200/60 rounded-lg" />
              ))}
            </div>
          ) : stocks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Fabric Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Available Meters</TableHead>
                  <TableHead>Rate / Meter</TableHead>
                  <TableHead>Est. Orders Left</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((s) => {
                  const isExpanded = expandedStockId === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500"
                            onClick={() => loadTransactions(s.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            {s.fabricName}
                            {s.isLowStock && (
                              <Badge variant="destructive" className="gap-1 px-1.5 py-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{s.fabricType}</TableCell>
                        <TableCell>{s.color}</TableCell>
                        <TableCell className={`font-bold ${s.isLowStock ? "text-red-600" : "text-gray-700"}`}>
                          {s.quantityMeters} m
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatRupee(s.ratePerMeter)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 font-semibold">
                          {s.prediction?.estimatedOrdersRemaining !== null && s.prediction?.estimatedOrdersRemaining !== undefined
                            ? `${s.prediction.estimatedOrdersRemaining} orders`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => loadTransactions(s.id)}
                          >
                            <History className="h-3.5 w-3.5" />
                            History
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expandable sub-view: Transaction Log */}
                      {isExpanded && (
                        <TableRow className="bg-gray-50/40 hover:bg-gray-50/40">
                          <TableCell colSpan={8} className="p-0 border-b border-gray-100">
                            <div className="px-12 py-5 border-l-2 border-violet-500/80 bg-gray-50/20">
                              <h4 className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                Stock Transaction Ledger
                              </h4>
                              {loadingTx ? (
                                <p className="text-xs text-gray-500 animate-pulse">Loading logs...</p>
                              ) : transactions.length > 0 ? (
                                <div className="space-y-2 max-w-2xl">
                                  {transactions.map((tx) => {
                                    const isIncoming = tx.transactionType === "IN";
                                    return (
                                      <div
                                        key={tx.id}
                                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm text-xs font-medium"
                                      >
                                        <div className="flex items-center gap-3">
                                          {isIncoming ? (
                                            <div className="p-1 bg-emerald-50 text-emerald-600 rounded">
                                              <TrendingUp className="h-4.5 w-4.5" />
                                            </div>
                                          ) : (
                                            <div className="p-1 bg-red-50 text-red-600 rounded">
                                              <TrendingDown className="h-4.5 w-4.5" />
                                            </div>
                                          )}
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-gray-800 font-semibold">{tx.notes || "Stock movement"}</span>
                                            <span className="text-[10px] text-gray-400">
                                              {tx.referenceType} — Ref: {tx.referenceId}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className={`font-bold ${isIncoming ? "text-emerald-600" : "text-red-500"}`}>
                                            {isIncoming ? "+" : "-"} {tx.quantityMeters} m
                                          </span>
                                          <span className="text-gray-400 text-[10px]">
                                            {new Date(tx.createdAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">No transaction logs registered for this fabric.</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Layers className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No fabric stock recorded yet.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setDrawerOpen(true)}>
                Add Fabric Stock
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
