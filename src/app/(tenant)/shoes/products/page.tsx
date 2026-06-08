"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { formatRupee } from "@/lib/utils";
import {
  Grid,
  List,
  Plus,
  Search,
  PlusCircle,
  Edit,
  Trash,
  Layers,
} from "lucide-react";

interface SkuInput {
  size: string;
  color: string;
  quantityInStock: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  lowStockThreshold: number;
  barcode: string;
}

export default function ProductsPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");

  // Create Product States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBrandId, setNewBrandId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newCategory, setNewCategory] = useState("CASUAL");
  const [newDescription, setNewDescription] = useState("");
  const [newSkus, setNewSkus] = useState<SkuInput[]>([
    { size: "8", color: "Black", quantityInStock: 5, mrp: 1500, sellingPrice: 1300, costPrice: 800, lowStockThreshold: 3, barcode: "" },
  ]);

  // Brand Creation inside Add Product States
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState("");

  // Bulk Stock Update States
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [bulkStockList, setBulkStockList] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [tenantId]);

  async function loadInitialData() {
    try {
      setLoading(true);
      // Fetch Products
      const prodRes = await fetch("/api/shoes/products?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!prodRes.ok) throw new Error("Failed to load products");
      const prodData = await prodRes.json();
      setProducts(prodData.data || []);

      // Fetch Brands
      const brandRes = await fetch("/api/shoes/brands", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!brandRes.ok) throw new Error("Failed to load brands");
      const brandData = await brandRes.json();
      setBrands(brandData || []);
    } catch (err: any) {
      toast(err.message || "Error loading inventory data", "error");
    } finally {
      setLoading(false);
    }
  }

  // Handle SKU input edits in creation form
  const handleSkuChange = (index: number, field: keyof SkuInput, value: any) => {
    const updated = [...newSkus];
    updated[index] = { ...updated[index], [field]: value };
    setNewSkus(updated);
  };

  // Add a new SKU row in creation form
  const addSkuRow = () => {
    setNewSkus([
      ...newSkus,
      { size: "8", color: "Black", quantityInStock: 5, mrp: 1500, sellingPrice: 1300, costPrice: 800, lowStockThreshold: 3, barcode: "" },
    ]);
  };

  // Remove a SKU row in creation form
  const removeSkuRow = (index: number) => {
    if (newSkus.length > 1) {
      setNewSkus(newSkus.filter((_, i) => i !== index));
    }
  };

  // Submit Brand Creation
  const handleAddBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    try {
      const res = await fetch("/api/shoes/brands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ name: brandName, logoUrl: brandLogo || null }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create brand");
      }
      const createdBrand = await res.json();
      setBrands([...brands, createdBrand]);
      setNewBrandId(createdBrand.id);
      setIsAddBrandOpen(false);
      setBrandName("");
      setBrandLogo("");
      toast("Brand added successfully", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Submit Product Creation
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandId) {
      toast("Please select a brand", "error");
      return;
    }
    if (!newModelName.trim()) {
      toast("Please specify a model name", "error");
      return;
    }

    try {
      const formattedSkus = newSkus.map((s) => ({
        size: s.size,
        color: s.color,
        quantityInStock: Number(s.quantityInStock),
        mrp: Number(s.mrp),
        sellingPrice: Number(s.sellingPrice),
        costPrice: Number(s.costPrice),
        lowStockThreshold: Number(s.lowStockThreshold),
        barcode: s.barcode || null,
      }));

      const res = await fetch("/api/shoes/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          brandId: newBrandId,
          modelName: newModelName,
          category: newCategory,
          description: newDescription || null,
          images: [],
          skus: formattedSkus,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create product");
      }

      toast("Product and SKU variants created successfully", "success");
      setIsCreateOpen(false);
      
      // Reset form
      setNewBrandId("");
      setNewModelName("");
      setNewCategory("CASUAL");
      setNewDescription("");
      setNewSkus([{ size: "8", color: "Black", quantityInStock: 5, mrp: 1500, sellingPrice: 1300, costPrice: 800, lowStockThreshold: 3, barcode: "" }]);
      
      // Reload products
      loadInitialData();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Open Bulk Stock Edit Modal
  const openBulkUpdate = async (productId: string) => {
    try {
      const res = await fetch(`/api/shoes/products/${productId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to retrieve product details");
      const productDetail = await res.json();
      setSelectedProduct(productDetail);
      setBulkStockList(
        productDetail.skus.map((sku: any) => ({
          id: sku.id,
          size: sku.size,
          color: sku.color,
          quantityInStock: sku.quantityInStock,
        }))
      );
      setIsBulkOpen(true);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Handle Bulk Stock input change
  const handleBulkStockChange = (index: number, val: string) => {
    const updated = [...bulkStockList];
    updated[index].quantityInStock = Math.max(0, parseInt(val) || 0);
    setBulkStockList(updated);
  };

  // Submit Bulk Stock Update
  const handleBulkSubmit = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/shoes/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          skus: bulkStockList.map((s) => ({
            id: s.id,
            quantityInStock: s.quantityInStock,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to update stock");
      }

      toast("Product stock levels updated successfully", "success");
      setIsBulkOpen(false);
      setSelectedProduct(null);
      loadInitialData();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Filters calculation
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || product.category === selectedCategory;
    const matchesBrand = selectedBrand === "ALL" || product.brandId === selectedBrand;
    return matchesSearch && matchesCategory && matchesBrand;
  });

  const getStockChipColor = (qty: number, threshold: number) => {
    if (qty <= 0) return "bg-red-50 text-red-700 border-red-200";
    if (qty <= threshold) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
            <Input
              placeholder="Search model or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="w-[160px]">
            <Select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
              <option value="ALL">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-[160px]">
            <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="ALL">All Categories</option>
              <option value="FORMAL">Formal</option>
              <option value="CASUAL">Casual</option>
              <option value="SPORTS">Sports</option>
              <option value="SANDAL">Sandal</option>
              <option value="SLIPPER">Slipper</option>
              <option value="KIDS">Kids</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
        </div>

        {/* View Mode & Add buttons */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded-lg p-0.5 bg-gray-50 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md ${
                viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Grid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md ${
                viewMode === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Shoe Product & Variants</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateProductSubmit} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Brand</label>
                    <div className="flex gap-1.5">
                      <Select value={newBrandId} onChange={(e) => setNewBrandId(e.target.value)}>
                        <option value="">Choose Brand</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => setIsAddBrandOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Model/Style Name</label>
                    <Input
                      placeholder="e.g., Air Max 90"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Category</label>
                    <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                      <option value="FORMAL">Formal</option>
                      <option value="CASUAL">Casual</option>
                      <option value="SPORTS">Sports</option>
                      <option value="SANDAL">Sandal</option>
                      <option value="SLIPPER">Slipper</option>
                      <option value="KIDS">Kids</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Description (Optional)</label>
                  <Input
                    placeholder="Short description of model features..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>

                {/* SKUs Variant Setup */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="text-sm font-bold text-gray-800">SKU size & color variants</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addSkuRow}
                      className="text-xs text-indigo-650 hover:bg-indigo-50 gap-1.5"
                    >
                      <PlusCircle className="h-4.5 w-4.5" /> Add Size/Color
                    </Button>
                  </div>

                  {newSkus.map((sku, index) => (
                    <div
                      key={index}
                      className="grid gap-3 sm:grid-cols-8 items-end bg-gray-50/70 p-3 rounded-xl border border-gray-100 relative group animate-fade-in"
                    >
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-gray-400">Size</label>
                        <Input
                          placeholder="8"
                          value={sku.size}
                          onChange={(e) => handleSkuChange(index, "size", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-gray-400">Color</label>
                        <Input
                          placeholder="Black"
                          value={sku.color}
                          onChange={(e) => handleSkuChange(index, "color", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-gray-400">Stock</label>
                        <Input
                          type="number"
                          value={sku.quantityInStock}
                          onChange={(e) => handleSkuChange(index, "quantityInStock", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-gray-400">Cost Price</label>
                        <Input
                          type="number"
                          value={sku.costPrice}
                          onChange={(e) => handleSkuChange(index, "costPrice", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-gray-400">Selling Price</label>
                        <Input
                          type="number"
                          value={sku.sellingPrice}
                          onChange={(e) => handleSkuChange(index, "sellingPrice", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-gray-400">MRP</label>
                        <Input
                          type="number"
                          value={sku.mrp}
                          onChange={(e) => handleSkuChange(index, "mrp", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-1.5">
                        <label className="text-[10px] font-bold text-gray-400">Barcode</label>
                        <Input
                          placeholder="Optional"
                          value={sku.barcode}
                          onChange={(e) => handleSkuChange(index, "barcode", e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end sm:col-span-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={newSkus.length === 1}
                          onClick={() => removeSkuRow(index)}
                          className="text-red-500 hover:text-red-750 hover:bg-red-50"
                        >
                          <Trash className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
                  <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Create Product & SKUs
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Brand Creation Modal (Sub-flow) */}
      <Dialog open={isAddBrandOpen} onOpenChange={setIsAddBrandOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Shoe Brand</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBrandSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Brand Name</label>
              <Input
                placeholder="e.g., Nike, Adidas"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Logo URL (Optional)</label>
              <Input
                placeholder="https://..."
                value={brandLogo}
                onChange={(e) => setBrandLogo(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setIsAddBrandOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Add Brand
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Stock Update Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Bulk Update Stock — {selectedProduct?.brand?.name} {selectedProduct?.modelName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right w-32">Current Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkStockList.map((sku, index) => (
                  <TableRow key={sku.id}>
                    <TableCell className="font-bold">{sku.size}</TableCell>
                    <TableCell>{sku.color}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        className="text-right"
                        value={sku.quantityInStock}
                        onChange={(e) => handleBulkStockChange(index, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => { setIsBulkOpen(false); setSelectedProduct(null); }}>
              Cancel
            </Button>
            <Button onClick={handleBulkSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Stock Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading state */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-200/60 rounded-xl" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        viewMode === "grid" ? (
          /* Grid View */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((prod) => (
              <Card key={prod.id} className="hover:border-indigo-150 transition-all shadow-sm flex flex-col justify-between overflow-hidden">
                <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 rounded-md px-2 py-0.5">
                      {prod.category}
                    </span>
                    <h3 className="font-bold text-gray-900 mt-1.5 leading-tight text-md">
                      {prod.brand?.name} {prod.modelName}
                    </h3>
                  </div>
                  {prod.brand?.logoUrl ? (
                    <img src={prod.brand.logoUrl} alt="Logo" className="h-7 w-7 object-contain rounded-md" />
                  ) : (
                    <Layers className="h-5 w-5 text-gray-455" />
                  )}
                </CardHeader>

                <CardContent className="py-5 flex-1 flex flex-col justify-between gap-5">
                  {/* SKU Stock Badges */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock per Size</h4>
                    <div className="flex flex-wrap gap-2.5">
                      {products
                        .find((p) => p.id === prod.id)
                        ?.sizes?.map((size: string) => {
                          return (
                            <div
                              key={size}
                              className="text-xs flex items-center border border-gray-150 bg-white rounded-lg pl-2.5 pr-1 py-1 gap-1.5"
                            >
                              <span className="font-semibold text-gray-750">Size {size}</span>
                              {prod.skus
                                ?.filter((s: any) => s.size === size)
                                .map((sku: any) => (
                                  <Badge
                                    key={sku.id}
                                    className={`px-1.5 py-0.5 text-[9px] font-bold border ${getStockChipColor(
                                      sku.quantityInStock,
                                      sku.lowStockThreshold
                                    )}`}
                                    variant="outline"
                                    title={`${sku.color}: ${sku.quantityInStock} in stock`}
                                  >
                                    {sku.quantityInStock}
                                  </Badge>
                                ))}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Summary & Buttons */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-auto">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Stock</span>
                      <p className="font-bold text-gray-900 text-lg leading-none">{prod.totalStock} units</p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBulkUpdate(prod.id)}
                      className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Update Stock
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sizes & Stock</TableHead>
                    <TableHead className="text-right">Total Stock</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-bold text-gray-800">{prod.brand?.name}</TableCell>
                      <TableCell className="font-semibold">{prod.modelName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] px-2.5">
                          {prod.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {prod.skus?.map((sku: any) => (
                            <span
                              key={sku.id}
                              className={`text-[11px] border rounded-lg px-2 py-0.5 font-medium flex gap-1 ${getStockChipColor(
                                sku.quantityInStock,
                                sku.lowStockThreshold
                              )}`}
                            >
                              Size {sku.size} ({sku.color}): <strong>{sku.quantityInStock}</strong>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-md">{prod.totalStock} units</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openBulkUpdate(prod.id)}
                          className="text-indigo-655 hover:bg-indigo-50 text-xs"
                        >
                          Update Stock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 border border-dashed border-gray-150 rounded-2xl">
          <Layers className="h-10 w-10 text-gray-300 mb-2" />
          <h3 className="font-bold text-md text-gray-700">No products registered</h3>
          <p className="text-sm text-gray-400 mt-1">Get started by creating your first shoe style.</p>
          <Button onClick={() => setIsCreateOpen(true)} className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700">
            Create Product
          </Button>
        </div>
      )}
    </div>
  );
}
