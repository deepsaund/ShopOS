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
  Search,
  ShoppingCart,
  User,
  Plus,
  Trash,
  Printer,
  CheckCircle,
  Minus,
} from "lucide-react";

interface CartItem {
  skuId: string;
  productId: string;
  brandName: string;
  modelName: string;
  size: string;
  color: string;
  pricePerUnit: number;
  costPrice: number;
  mrp: number;
  discountPerUnit: number;
  quantity: number;
  quantityInStock: number;
}

export default function NewSalePage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Cart & checkout states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("WALK_IN");
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [servedBy, setServedBy] = useState<string>("");
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [saleNotes, setSaleNotes] = useState<string>("");

  // Customer registration state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  // Receipt details states
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantId]);

  async function loadData() {
    try {
      // Fetch Products with detailed SKUs
      const prodRes = await fetch("/api/shoes/products?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!prodRes.ok) throw new Error("Failed to load inventory");
      const prodData = await prodRes.json();
      
      const productsWithSkus = [];
      for (const p of prodData.data || []) {
        const detailRes = await fetch(`/api/shoes/products/${p.id}`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (detailRes.ok) {
          productsWithSkus.push(await detailRes.json());
        }
      }
      setProducts(productsWithSkus);

      // Fetch Customers
      const custRes = await fetch("/api/shoes/customers?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.data || []);
      }

      // Fetch Employees
      const empRes = await fetch("/api/shoes/employees?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.data || []);
        if (empData.data && empData.data.length > 0) {
          setServedBy(empData.data[0].name);
        }
      }
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  // Add item to POS cart
  const addToCart = (sku: any, product: any) => {
    const existing = cart.find((item) => item.skuId === sku.id);
    if (existing) {
      if (existing.quantity >= sku.quantityInStock) {
        toast("Cannot exceed available stock level", "error");
        return;
      }
      setCart(
        cart.map((item) =>
          item.skuId === sku.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (sku.quantityInStock <= 0) {
        toast("Out of stock variant", "error");
        return;
      }
      const newItem: CartItem = {
        skuId: sku.id,
        productId: product.id,
        brandName: product.brand?.name || "",
        modelName: product.modelName,
        size: sku.size,
        color: sku.color,
        pricePerUnit: Number(sku.sellingPrice),
        costPrice: Number(sku.costPrice),
        mrp: Number(sku.mrp),
        discountPerUnit: Number(sku.mrp) - Number(sku.sellingPrice),
        quantity: 1,
        quantityInStock: sku.quantityInStock,
      };
      setCart([...cart, newItem]);
    }
    toast(`Added Size ${sku.size} - ${sku.color} to cart`, "success");
  };

  // Adjust quantity in cart
  const updateQty = (skuId: string, delta: number) => {
    const item = cart.find((i) => i.skuId === skuId)!;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((i) => i.skuId !== skuId));
      return;
    }
    if (newQty > item.quantityInStock) {
      toast("Cannot exceed available stock level", "error");
      return;
    }
    setCart(cart.map((i) => (i.skuId === skuId ? { ...i, quantity: newQty } : i)));
  };

  // Calculations
  const totalMrp = cart.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  const cartAutoDiscount = cart.reduce((sum, item) => sum + item.discountPerUnit * item.quantity, 0);
  
  const finalDiscount = cartAutoDiscount + customDiscount;
  const finalAmount = Math.max(0, totalMrp - finalDiscount);

  // Udhaar logic
  const isUdhaarSelected = paymentMode === "UDHAAR" || paymentMode === "PARTIAL";
  const calculatedPaid = paymentMode === "UDHAAR" ? 0 : paymentMode === "PARTIAL" ? parseFloat(amountPaidInput) || 0 : finalAmount;
  const calculatedPending = Math.max(0, finalAmount - calculatedPaid);

  // Submit Customer Creation
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast("Name and Phone are required", "error");
      return;
    }

    try {
      const res = await fetch("/api/shoes/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ name: newCustName, phone: newCustPhone, address: newCustAddress || null }),
      });
      if (!res.ok) throw new Error("Failed to create customer");
      const created = await res.json();
      setCustomers([...customers, created]);
      setSelectedCustomerId(created.id);
      setIsAddCustomerOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustAddress("");
      toast("Customer registered successfully", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Submit Sale Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast("Shopping cart is empty", "error");
      return;
    }
    if (isUdhaarSelected && selectedCustomerId === "WALK_IN") {
      toast("Customer account is required for credit/udhaar sales", "error");
      return;
    }
    if (!servedBy) {
      toast("Please select staff server", "error");
      return;
    }

    try {
      const bodyPayload = {
        customerId: selectedCustomerId === "WALK_IN" ? null : selectedCustomerId,
        saleDate: new Date().toISOString(),
        totalMrp,
        discount: finalDiscount,
        totalAmount: finalAmount,
        paymentMode,
        amountPaid: calculatedPaid,
        amountPending: calculatedPending,
        servedBy,
        notes: saleNotes || null,
        items: cart.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          discountPerUnit: item.discountPerUnit + (customDiscount / cart.reduce((s, i) => s + i.quantity, 0)),
        })),
      };

      const res = await fetch("/api/shoes/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Sale checkout failed");
      }

      const saleReceipt = await res.json();
      setCompletedSale(saleReceipt);
      setIsReceiptOpen(true);
      toast("Sale recorded successfully", "success");
      
      setCart([]);
      setCustomDiscount(0);
      setAmountPaidInput("");
      setSaleNotes("");
      setSelectedCustomerId("WALK_IN");
      setPaymentMode("CASH");

      loadData();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Print Receipt
  const triggerPrint = () => {
    window.print();
  };

  // Search Results
  const filteredProducts = products.filter((product) => {
    const term = searchQuery.toLowerCase();
    return (
      product.modelName.toLowerCase().includes(term) ||
      product.brand?.name.toLowerCase().includes(term) ||
      product.skus?.some((s: any) => s.size.includes(term) || s.color.toLowerCase().includes(term))
    );
  });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Product Selection & Inventory Search */}
      <div className="lg:col-span-7 space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-md font-bold text-gray-800 flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-500" /> Search Shoe Stock
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
              <Input
                placeholder="Search style, brand, size (e.g. Nike, Casual, Size 8)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 shadow-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-gray-50/50 p-4 rounded-xl border border-gray-150 flex flex-col sm:flex-row justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {prod.category}
                    </span>
                    <h4 className="font-bold text-gray-900 mt-1 leading-tight">
                      {prod.brand?.name} {prod.modelName}
                    </h4>
                    <p className="text-xs text-gray-455 font-medium">{prod.description || "No description"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 max-w-sm sm:justify-end">
                    {prod.skus?.map((sku: any) => (
                      <button
                        key={sku.id}
                        onClick={() => addToCart(sku, prod)}
                        disabled={sku.quantityInStock <= 0}
                        className={`text-xs pl-2.5 pr-2 py-1.5 border rounded-lg flex items-center gap-1.5 transition-all ${
                          sku.quantityInStock <= 0
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                            : "bg-white text-gray-700 hover:border-indigo-500 hover:text-indigo-700 active:scale-95 cursor-pointer shadow-sm"
                        }`}
                        title={`${sku.color}: ${sku.quantityInStock} left`}
                      >
                        <span className="font-bold">Sz {sku.size}</span>
                        <Badge
                          variant="outline"
                          className={`px-1 py-0 text-[9px] font-bold border ${
                            sku.quantityInStock <= 0
                              ? "bg-red-50 text-red-500 border-red-100"
                              : sku.quantityInStock <= sku.lowStockThreshold
                              ? "bg-amber-50 text-amber-600 border-amber-100 animate-pulse"
                              : "bg-emerald-50 text-emerald-600 border-emerald-100"
                          }`}
                        >
                          {sku.quantityInStock}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm font-medium">
                  No matching style found in inventory.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* POS Cart & Checkout Panel */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="shadow-md border-indigo-100 flex flex-col">
          <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-md font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-indigo-600" /> Active Checkout Cart
            </CardTitle>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items
            </Badge>
          </CardHeader>

          <CardContent className="py-4 space-y-4 flex-1">
            {cart.length > 0 ? (
              <div className="space-y-3.5 max-h-[30vh] overflow-y-auto pr-2">
                {cart.map((item) => (
                  <div
                    key={item.skuId}
                    className="flex items-center justify-between gap-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100 animate-fade-in"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h5 className="font-bold text-xs text-gray-800 truncate">
                        {item.brandName} {item.modelName}
                      </h5>
                      <p className="text-[10px] text-gray-450 font-semibold uppercase tracking-wider">
                        Size {item.size} • {item.color}
                      </p>
                      <p className="font-bold text-xs text-gray-900 mt-1">{formatRupee(item.pricePerUnit)}</p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => updateQty(item.skuId, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-sm font-bold text-gray-800 w-4 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => updateQty(item.skuId, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-750 hover:bg-red-50 h-8 w-8 rounded-lg"
                      onClick={() => updateQty(item.skuId, -item.quantity)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 border border-dashed border-gray-100 rounded-xl">
                <ShoppingCart className="h-9 w-9 text-gray-300 mb-2" />
                <p className="text-xs font-semibold text-gray-500">Checkout cart is empty.</p>
                <p className="text-[10px] text-gray-450 mt-0.5">Click sizes above to add products.</p>
              </div>
            )}

            {/* Customer Selector */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="h-4 w-4" /> Customer Account
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="text-xs text-indigo-600 p-0 h-auto hover:bg-transparent"
                >
                  <Plus className="h-3.5 w-3.5" /> Register Customer
                </Button>
              </div>
              <Select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="WALK_IN">Walk-in Customer (No Udhaar)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </Select>
            </div>

            {/* Payment Section */}
            <div className="space-y-3.5 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment Mode</label>
                  <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="UDHAAR">Udhaar (Credit)</option>
                    <option value="PARTIAL">Partial</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Served By Staff</label>
                  <Select value={servedBy} onChange={(e) => setServedBy(e.target.value)}>
                    <option value="">Select Staff</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {paymentMode === "PARTIAL" && (
                <div className="space-y-1.5 animate-slide-in">
                  <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Amount Paid (₹)</label>
                  <Input
                    type="number"
                    placeholder="Enter paid amount..."
                    className="bg-white h-9"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2 text-xs font-medium text-gray-600 pt-1.5 border-t border-gray-200/50">
                <div className="flex justify-between">
                  <span>Subtotal (MRP)</span>
                  <span>{formatRupee(totalMrp)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Product Discount</span>
                  <span>-{formatRupee(cartAutoDiscount)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>Additional Discount</span>
                  <div className="flex items-center border border-gray-200 rounded px-1.5 py-0.5 bg-white h-7 w-24">
                    <span className="text-[10px] text-gray-400 font-bold mr-1">₹</span>
                    <input
                      type="number"
                      value={customDiscount || ""}
                      onChange={(e) => setCustomDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full text-right outline-none text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200/70 pt-2.5">
                  <span>Final Amount</span>
                  <span>{formatRupee(finalAmount)}</span>
                </div>

                {isUdhaarSelected && (
                  <div className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-lg space-y-1 mt-2.5 text-[11px] animate-fade-in">
                    <div className="flex justify-between font-semibold text-rose-700">
                      <span>Amount Paid</span>
                      <span>{formatRupee(calculatedPaid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-800 border-t border-rose-200/50 pt-1">
                      <span>Pending Udhaar Balance</span>
                      <span>{formatRupee(calculatedPending)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale Notes</label>
              <Input
                placeholder="Optional notes about sale/customer..."
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className="h-9"
              />
            </div>

            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-6 rounded-xl shadow-md transition-all mt-4"
            >
              Confirm Sale & Print Receipt
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Customer Registration Dialog */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Customer Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Customer Name</label>
              <Input
                placeholder="e.g., Alice Smith"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Phone Number</label>
              <Input
                placeholder="e.g., 9876543211"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Address (Optional)</label>
              <Input
                placeholder="e.g., 101 Maple Drive"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setIsAddCustomerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Register Profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-md print:max-w-full print:p-0">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle className="h-5.5 w-5.5" /> Checkout Successful
            </DialogTitle>
          </DialogHeader>

          <div className="bg-white p-4 border border-gray-150 rounded-xl space-y-4 font-mono text-xs text-gray-800 leading-normal max-w-sm mx-auto shadow-sm">
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-200">
              <h3 className="font-bold text-base text-gray-900 tracking-tight">SHOPOS FOOTWEAR</h3>
              <p className="text-[10px] text-gray-400">123 Shoe Bazar, New Delhi</p>
              <p className="text-[10px] text-gray-400">Tel: +91 99998888</p>
            </div>

            <div className="space-y-1 pb-3 border-b border-gray-200/50 text-[10px] text-gray-500">
              <div className="flex justify-between">
                <span>INVOICE:</span>
                <span className="font-bold text-gray-700">{completedSale?.id?.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE:</span>
                <span>
                  {completedSale && new Date(completedSale.saleDate).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CLIENT:</span>
                <span className="font-bold text-gray-700">
                  {completedSale?.customer ? completedSale.customer.name : "Walk-in Customer"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SERVED BY:</span>
                <span>{completedSale?.servedBy}</span>
              </div>
            </div>

            <div className="space-y-2.5 pb-3 border-b border-dashed border-gray-200">
              <div className="grid grid-cols-4 font-bold text-gray-900 border-b border-gray-100 pb-1 text-[11px]">
                <span className="col-span-2">Item</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
              </div>

              {completedSale?.items?.map((item: any) => (
                <div key={item.id} className="grid grid-cols-4 text-gray-700 text-[10px] leading-tight">
                  <div className="col-span-2">
                    <p className="font-bold text-gray-900 truncate">
                      {item.sku?.product?.brand?.name} {item.sku?.product?.modelName}
                    </p>
                    <p className="text-[9px] text-gray-400">
                      Size {item.sku?.size} • {item.sku?.color}
                    </p>
                  </div>
                  <span className="text-center font-semibold">{item.quantity}</span>
                  <span className="text-right font-bold text-gray-900">{formatRupee(item.pricePerUnit * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pb-2 text-[11px] text-gray-700">
              <div className="flex justify-between">
                <span>Total MRP:</span>
                <span>{formatRupee(completedSale?.totalMrp)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Total Discount:</span>
                <span>-{formatRupee(completedSale?.discount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-gray-900 border-t border-gray-150 pt-2">
                <span>Net Total:</span>
                <span>{formatRupee(completedSale?.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Amount Paid ({completedSale?.paymentMode}):</span>
                <span>{formatRupee(completedSale?.amountPaid)}</span>
              </div>
              {Number(completedSale?.amountPending) > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Balance Pending (Udhaar):</span>
                  <span>{formatRupee(completedSale?.amountPending)}</span>
                </div>
              )}
            </div>

            <div className="text-center pt-3 border-t border-dashed border-gray-200">
              <p className="font-semibold text-gray-900">Thank you for shopping!</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Please check sizes before leaving</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 print:hidden">
            <Button variant="ghost" onClick={() => setIsReceiptOpen(false)}>
              Close
            </Button>
            <Button onClick={triggerPrint} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <Printer className="h-4.5 w-4.5" /> Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
