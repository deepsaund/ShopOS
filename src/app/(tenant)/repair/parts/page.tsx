"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Search, Plus, Edit3, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Layers, Info } from "lucide-react";

interface Part {
  id: string;
  partName: string;
  partNumber: string;
  compatibleDevices: string;
  quantityInStock: number;
  costPrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
}

export default function PartsInventoryPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [compatibleDevices, setCompatibleDevices] = useState("");
  const [quantityInStock, setQuantityInStock] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  
  const [showPartDialog, setShowPartDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchParts = async () => {
    try {
      setLoading(true);
      // If lowStockOnly is true, call the low-stock endpoint instead
      let url = lowStockOnly
        ? "/api/repair/parts/low-stock"
        : `/api/repair/parts?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;

      const res = await fetch(url, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to fetch parts inventory");
      const result = await res.json();
      
      if (lowStockOnly) {
        // The low-stock endpoint returns a simple array
        setParts(result || []);
        setTotal(result.length || 0);
        setPage(1);
      } else {
        setParts(result.data || []);
        setTotal(result.total || 0);
      }
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load parts stock", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, [page, search, tenantId, lowStockOnly]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedPartId(null);
    setPartName("");
    setPartNumber("");
    setCompatibleDevices("");
    setQuantityInStock("");
    setCostPrice("");
    setSellingPrice("");
    setLowStockThreshold("5");
    setShowPartDialog(true);
  };

  const handleOpenEdit = (p: Part) => {
    setIsEditing(true);
    setSelectedPartId(p.id);
    setPartName(p.partName);
    setPartNumber(p.partNumber);
    setCompatibleDevices(p.compatibleDevices);
    setQuantityInStock(String(p.quantityInStock));
    setCostPrice(String(p.costPrice));
    setSellingPrice(String(p.sellingPrice));
    setLowStockThreshold(String(p.lowStockThreshold));
    setShowPartDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return toast("Part name is required", "error");
    if (!partNumber.trim()) return toast("Part number is required", "error");
    if (!compatibleDevices.trim()) return toast("Compatible devices description is required", "error");
    if (quantityInStock === "") return toast("Quantity is required", "error");
    if (!costPrice) return toast("Cost price is required", "error");
    if (!sellingPrice) return toast("Selling price is required", "error");

    try {
      setSubmitting(true);
      const payload = {
        partName,
        partNumber,
        compatibleDevices,
        quantityInStock: parseInt(quantityInStock) || 0,
        costPrice: parseFloat(costPrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        lowStockThreshold: parseInt(lowStockThreshold) || 5,
      };

      const url = isEditing ? `/api/repair/parts/${selectedPartId}` : "/api/repair/parts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save part");

      toast(`Part ${partName} saved successfully!`, "success");
      setShowPartDialog(false);
      fetchParts();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to save part details", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this part from inventory?")) return;

    try {
      const res = await fetch(`/api/repair/parts/${id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete part");
      }
      toast("Part deleted from inventory", "success");
      fetchParts();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to delete part", "error");
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Spare Parts Inventory</h2>
          <p className="text-sm text-gray-500">Manage repair parts stock, pricing, and warnings.</p>
        </div>

        {/* Dialog Add Part Trigger */}
        <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Add Spare Part
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Spare Part" : "Register Spare Part"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Part Name *</label>
                  <Input placeholder="E.g. iPhone 13 OLED Screen" value={partName} onChange={(e) => setPartName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Part Number *</label>
                  <Input placeholder="E.g. PART-IP13-SCR" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Compatible Devices *</label>
                <Input placeholder="E.g. iPhone 13, iPhone 13 Pro (6.1-inch)" value={compatibleDevices} onChange={(e) => setCompatibleDevices(e.target.value)} required />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Cost Price *</label>
                  <Input type="number" placeholder="Cost" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} min="0" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Selling Price *</label>
                  <Input type="number" placeholder="Selling" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} min="0" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">In Stock *</label>
                  <Input type="number" placeholder="Qty" value={quantityInStock} onChange={(e) => setQuantityInStock(e.target.value)} min="0" required />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Low Stock Threshold (Alert level) *</label>
                <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} min="1" required />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Part"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search Bar Card */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-150 rounded-xl px-3 py-1 w-full max-w-md">
              <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search parts by name, number, compatible..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                disabled={lowStockOnly}
                className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 py-2 text-gray-800 placeholder-gray-400 disabled:opacity-50"
              />
            </div>

            {/* Toggle alerts */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => {
                  setLowStockOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4.5 w-4.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                Show Low Stock Alerts Only
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card className="border-gray-200/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200/60 rounded-lg" />
              ))}
            </div>
          ) : parts.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Compatible Devices</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((p) => {
                      const isLowStock = p.quantityInStock <= p.lowStockThreshold;

                      return (
                        <TableRow key={p.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-semibold text-gray-900">{p.partName}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-500 font-bold">{p.partNumber}</TableCell>
                          <TableCell className="text-xs text-gray-600 font-medium max-w-xs truncate">
                            {p.compatibleDevices}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-800">{p.quantityInStock} units</span>
                              {isLowStock && (
                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 flex items-center gap-0.5 text-[10px]">
                                  <AlertTriangle className="h-3 w-3" /> Low Stock
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-600 text-xs">₹{p.costPrice}</TableCell>
                          <TableCell className="font-bold text-gray-800">₹{p.sellingPrice}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-violet-600 hover:text-violet-700 h-8 w-8 p-0"
                                onClick={() => handleOpenEdit(p)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                                onClick={() => handleDelete(p.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination (only visible when not in lowStockOnly view, since lowStock lists all) */}
              {!lowStockOnly && totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">
                    Showing Page {page} of {totalPages} ({total} parts)
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
              <Layers className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No spare parts in stock</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={handleOpenCreate}>
                Add Spare Part
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
