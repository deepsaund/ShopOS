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
import { Select } from "@/components/ui/select";
import { formatRupee } from "@/lib/utils";
import {
  Truck,
  Plus,
  PlusCircle,
  Trash,
  Calendar,
  FileText,
  Save,
} from "lucide-react";

interface PurchaseLine {
  productId: string;
  skuId: string;
  quantity: number;
  costPricePerUnit: number;
}

export default function PurchaseStockPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([
    { productId: "", skuId: "", quantity: 10, costPricePerUnit: 500 },
  ]);

  // Supplier creation states
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supGst, setSupGst] = useState("");

  useEffect(() => {
    loadPageData();
  }, [tenantId]);

  async function loadPageData() {
    try {
      setLoading(true);
      
      // 1. Fetch Suppliers
      const supRes = await fetch("/api/shoes/suppliers", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!supRes.ok) throw new Error("Failed to load suppliers");
      const supData = await supRes.json();
      setSuppliers(supData || []);
      if (supData && supData.length > 0) {
        setSelectedSupplierId(supData[0].id);
      }

      // 2. Fetch Products with SKUs
      const prodRes = await fetch("/api/shoes/products?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!prodRes.ok) throw new Error("Failed to load products");
      const prodData = await prodRes.json();
      
      // Load detailed products containing nested skus
      const detailed: any[] = [];
      for (const p of prodData.data || []) {
        const dRes = await fetch(`/api/shoes/products/${p.id}`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (dRes.ok) {
          detailed.push(await dRes.json());
        }
      }
      setProducts(detailed);

      // Default date to today
      setPurchaseDate(new Date().toISOString().split("T")[0]);
    } catch (err: any) {
      toast(err.message || "Error loading page details", "error");
    } finally {
      setLoading(false);
    }
  }

  // Handle line product select
  const handleProductSelect = (index: number, productId: string) => {
    const updated = [...lines];
    updated[index].productId = productId;
    
    // Auto-select first SKU of the product if available
    const product = products.find((p) => p.id === productId);
    if (product && product.skus && product.skus.length > 0) {
      updated[index].skuId = product.skus[0].id;
      updated[index].costPricePerUnit = Number(product.skus[0].costPrice);
    } else {
      updated[index].skuId = "";
      updated[index].costPricePerUnit = 0;
    }
    setLines(updated);
  };

  // Handle line SKU select
  const handleSkuSelect = (index: number, skuId: string) => {
    const updated = [...lines];
    updated[index].skuId = skuId;
    
    const product = products.find((p) => p.id === updated[index].productId);
    const sku = product?.skus?.find((s: any) => s.id === skuId);
    if (sku) {
      updated[index].costPricePerUnit = Number(sku.costPrice);
    }
    setLines(updated);
  };

  // Handle line input changes
  const handleLineValueChange = (index: number, field: "quantity" | "costPricePerUnit", val: number) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: val };
    setLines(updated);
  };

  // Add line row
  const addLine = () => {
    setLines([...lines, { productId: "", skuId: "", quantity: 10, costPricePerUnit: 500 }]);
  };

  // Remove line row
  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  // Calculate invoice totals
  const invoiceTotal = lines.reduce((sum, item) => sum + item.quantity * item.costPricePerUnit, 0);

  // Submit Supplier Creation
  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim() || !supAddress.trim()) {
      toast("Name, Phone, and Address are required", "error");
      return;
    }

    try {
      const res = await fetch("/api/shoes/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ name: supName, phone: supPhone, address: supAddress, gstNumber: supGst || null }),
      });
      if (!res.ok) throw new Error("Failed to register supplier");
      const created = await res.json();
      setSuppliers([...suppliers, created]);
      setSelectedSupplierId(created.id);
      setIsAddSupplierOpen(false);
      
      setSupName("");
      setSupPhone("");
      setSupAddress("");
      setSupGst("");
      toast("Supplier profile created successfully", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Submit Purchase Stock Invoice
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast("Please select a supplier", "error");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast("Invoice number is required", "error");
      return;
    }
    if (lines.some((l) => !l.productId || !l.skuId)) {
      toast("Please make sure all items and sizes are selected", "error");
      return;
    }

    try {
      const res = await fetch("/api/shoes/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          invoiceNumber,
          purchaseDate: new Date(purchaseDate).toISOString(),
          totalAmount: invoiceTotal,
          notes: notes || null,
          items: lines.map((l) => ({
            skuId: l.skuId,
            quantity: Number(l.quantity),
            costPricePerUnit: Number(l.costPricePerUnit),
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to submit purchase stock");
      }

      toast("Purchase invoice submitted, inventory stock updated", "success");
      
      // Reset form
      setInvoiceNumber("");
      setNotes("");
      setLines([{ productId: "", skuId: "", quantity: 10, costPricePerUnit: 500 }]);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title banner */}
      <div className="space-y-0.5">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="h-5 w-5 text-indigo-650" /> Record Purchase Invoice
        </h2>
        <p className="text-sm text-gray-500">Record stock invoices received from footwear suppliers.</p>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-gray-400 text-sm animate-pulse">
          Loading page selectors...
        </Card>
      ) : (
        <form onSubmit={handlePurchaseSubmit} className="space-y-6">
          {/* Invoice Headers Info */}
          <Card className="shadow-sm">
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4 items-end">
              {/* Supplier selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500">Supplier</label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAddSupplierOpen(true)}
                    className="text-[11px] text-indigo-650 h-auto p-0 hover:bg-transparent"
                  >
                    + New Supplier
                  </Button>
                </div>
                <Select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="h-10">
                  <option value="" disabled>Choose Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Invoice Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-gray-450" /> Invoice Number
                </label>
                <Input
                  placeholder="e.g. INV-9908"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                  className="h-10 shadow-sm"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-450" /> Received Date
                </label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  className="h-10 shadow-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Invoice Notes</label>
                <Input
                  placeholder="e.g. Freight paid by supplier..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-10 shadow-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items Table Builder */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-md font-bold text-gray-800">Invoice Line Items</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addLine}
                className="text-xs text-indigo-650 hover:bg-indigo-50 gap-1.5"
              >
                <PlusCircle className="h-4.5 w-4.5" /> Add Line Item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Product Style</TableHead>
                    <TableHead>Size & Color</TableHead>
                    <TableHead className="w-28 text-right">Qty Received</TableHead>
                    <TableHead className="w-32 text-right">Unit Cost Price (₹)</TableHead>
                    <TableHead className="w-36 text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => {
                    const selectedProductDetail = products.find((p) => p.id === line.productId);
                    const skuDropdownItems = selectedProductDetail?.skus || [];

                    return (
                      <TableRow key={index} className="hover:bg-transparent">
                        <TableCell>
                          <Select
                            value={line.productId}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                          >
                            <option value="">Choose Product Style</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.brand?.name} {p.modelName} ({p.category})
                              </option>
                            ))}
                          </Select>
                        </TableCell>

                        <TableCell>
                          <Select
                            value={line.skuId}
                            onChange={(e) => handleSkuSelect(index, e.target.value)}
                            disabled={!line.productId}
                          >
                            <option value="">Choose Variant size</option>
                            {skuDropdownItems.map((sku: any) => (
                              <option key={sku.id} value={sku.id}>
                                Size {sku.size} — {sku.color}
                              </option>
                            ))}
                          </Select>
                        </TableCell>

                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            className="text-right h-9"
                            value={line.quantity}
                            onChange={(e) => handleLineValueChange(index, "quantity", Math.max(1, parseInt(e.target.value) || 0))}
                          />
                        </TableCell>

                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="text-right h-9"
                            value={line.costPricePerUnit}
                            onChange={(e) => handleLineValueChange(index, "costPricePerUnit", Math.max(0.01, parseFloat(e.target.value) || 0))}
                          />
                        </TableCell>

                        <TableCell className="text-right font-bold text-gray-900 text-sm">
                          {formatRupee(line.quantity * line.costPricePerUnit)}
                        </TableCell>

                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={lines.length === 1}
                            onClick={() => removeLine(index)}
                            className="text-red-500 hover:text-red-750 hover:bg-red-50 h-8 w-8"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Summary and Save panel */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                <div className="text-center sm:text-left space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Net Invoice Total</span>
                  <h3 className="font-bold text-gray-900 text-xl leading-none">{formatRupee(invoiceTotal)}</h3>
                </div>

                <Button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 shadow-sm px-6">
                  <Save className="h-4.5 w-4.5" /> Submit Stock Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* Supplier Registration Dialog Modal */}
      <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Footwear Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSupplierSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Supplier Name</label>
              <Input
                placeholder="e.g. Footwear Distributors Inc"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Phone Number</label>
              <Input
                placeholder="e.g. 555-0199"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Warehouse Address</label>
              <Input
                placeholder="e.g. 789 Warehouse Blvd"
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">GST Number (Optional)</label>
              <Input
                placeholder="e.g. GST-SHOE-77A"
                value={supGst}
                onChange={(e) => setSupGst(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setIsAddSupplierOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                Register Supplier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
