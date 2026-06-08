"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { formatRupee } from "@/lib/utils";
import {
  Scissors,
  Plus,
  Trash2,
  AlertCircle,
  IndianRupee,
  Calendar,
  Check,
  UserPlus,
  ArrowLeft,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface FabricStock {
  id: string;
  fabricName: string;
  fabricType: string;
  color: string;
  quantityMeters: number;
}

interface SelectedItem {
  garmentType: string;
  clothStockId: string;
  fabricMetersUsed: string;
  itemPrice: string;
  customNotes: string;
}

function NewOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const queryCustomerId = searchParams.get("customerId") || "";

  // Data sources
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fabrics, setFabrics] = useState<FabricStock[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [customerId, setCustomerId] = useState(queryCustomerId);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [advancePaymentMode, setAdvancePaymentMode] = useState("CASH");

  // Items list
  const [items, setItems] = useState<SelectedItem[]>([
    { garmentType: "SHIRT", clothStockId: "", fabricMetersUsed: "", itemPrice: "", customNotes: "" },
  ]);

  // Inline customer creation form state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load customers (fetch all by requesting large limit)
        const custRes = await fetch("/api/tailor/customers?page=1&limit=100", {
          headers: { "x-tenant-id": tenantId },
        });
        const custData = await custRes.json();
        setCustomers(custData.data || []);

        // Load stock fabrics (fetch all by requesting large limit)
        const fabricRes = await fetch("/api/tailor/stock?page=1&limit=100", {
          headers: { "x-tenant-id": tenantId },
        });
        const fabricData = await fabricRes.json();
        setFabrics(fabricData.data || []);
      } catch (error) {
        console.error(error);
        toast("Failed to load initial order data sources", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tenantId]);

  // Sync customer pre-selection from URL query params
  useEffect(() => {
    if (queryCustomerId) {
      setCustomerId(queryCustomerId);
    }
  }, [queryCustomerId]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { garmentType: "SHIRT", clothStockId: "", fabricMetersUsed: "", itemPrice: "", customNotes: "" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return toast("An order must contain at least one garment item", "error");
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof SelectedItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return toast("Name and Phone are required", "error");

    try {
      setSavingCustomer(true);
      const res = await fetch("/api/tailor/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          name: custName,
          phone: custPhone,
          email: custEmail.trim() || null,
          address: custAddress.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      toast(`Customer ${custName} registered successfully!`, "success");
      setCustomers((prev) => [data, ...prev]);
      setCustomerId(data.id);
      setAddCustomerOpen(false);

      // Reset customer form fields
      setCustName("");
      setCustPhone("");
      setCustEmail("");
      setCustAddress("");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to register customer", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  // Math aggregates
  const totalAmount = items.reduce((sum, item) => {
    const price = parseFloat(item.itemPrice);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const advance = parseFloat(advancePaid);
  const balanceDue = totalAmount - (isNaN(advance) ? 0 : advance);

  // Validation: Check if requested fabric meters exceed available stock
  const getStockWarning = (item: SelectedItem) => {
    if (!item.clothStockId || !item.fabricMetersUsed) return null;
    const stock = fabrics.find((f) => f.id === item.clothStockId);
    if (!stock) return null;
    const requested = parseFloat(item.fabricMetersUsed);
    const available = Number(stock.quantityMeters);
    if (isNaN(requested)) return null;
    if (requested > available) {
      return `Insufficent fabric: Only ${available}m left.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return toast("Please select a customer", "error");
    if (!deliveryDate) return toast("Please choose a delivery commitment date", "error");
    if (totalAmount <= 0) return toast("Total order amount must be greater than 0", "error");
    if (parseFloat(advancePaid) > totalAmount) {
      return toast("Advance paid cannot exceed the total order amount", "error");
    }

    // Check fabric warning blocks
    for (const item of items) {
      const warning = getStockWarning(item);
      if (warning) return toast(warning, "error");
    }

    try {
      setSubmittingOrder(true);
      const orderPayload = {
        customerId,
        deliveryDate: new Date(deliveryDate).toISOString(),
        totalAmount,
        advancePaid: parseFloat(advancePaid) || 0,
        advancePaymentMode,
        specialInstructions: specialInstructions.trim() || null,
        items: items.map((item) => ({
          garmentType: item.garmentType,
          clothStockId: item.clothStockId || null,
          fabricMetersUsed: item.fabricMetersUsed ? parseFloat(item.fabricMetersUsed) : null,
          itemPrice: parseFloat(item.itemPrice),
          customNotes: item.customNotes.trim() || null,
        })),
      };

      const res = await fetch("/api/tailor/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");

      toast(`Order ${data.orderNumber} created successfully!`, "success");
      router.push("/tailor/orders");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to place order", "error");
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-44 bg-gray-200/60 rounded-lg" />
        <div className="h-96 bg-gray-200/60 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-gray-500">Back</span>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">Place New Tailoring Order</h2>
        <p className="text-sm text-gray-500 mt-0.5">Register garments, deduct cloth stock, and record advances.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Form Fields */}
          <div className="flex-1 space-y-6">
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-md font-bold text-gray-800">1. Customer & Delivery Commitments</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Select Customer *</label>
                    <div className="flex gap-2">
                      <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                        <option value="">-- Choose Customer --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </Select>
                      <Sheet open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" type="button" size="icon" title="Add New Customer">
                            <UserPlus className="h-4 w-4 text-gray-500" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="max-w-md">
                          <SheetHeader>
                            <SheetTitle>Register Customer Sizing Profile</SheetTitle>
                          </SheetHeader>
                          <form onSubmit={handleSaveCustomer} className="space-y-4 pt-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-500">Name *</label>
                              <Input placeholder="E.g. Ramesh" value={custName} onChange={(e) => setCustName(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-500">Phone Number *</label>
                              <Input placeholder="E.g. 9876543210" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-500">Email</label>
                              <Input type="email" placeholder="E.g. r@gmail.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-500">Address</label>
                              <Textarea placeholder="Address" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} rows={2} />
                            </div>
                            <div className="flex gap-2 justify-end pt-4 border-t">
                              <SheetClose asChild>
                                <Button variant="outline" type="button">Close</Button>
                              </SheetClose>
                              <Button type="submit" disabled={savingCustomer}>
                                {savingCustomer ? "Saving..." : "Save Customer"}
                              </Button>
                            </div>
                          </form>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </div>

                  {/* Delivery Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Delivery Commitment Date *</label>
                    <div className="relative">
                      <Input
                        type="date"
                        required
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Special Order Instructions</label>
                  <Textarea
                    placeholder="Urgent order, trial on delivery, double lining, custom buttons etc."
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Items builder */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <CardTitle className="text-md font-bold text-gray-800">2. Garments & Fabric Deductions</CardTitle>
                <Button variant="outline" size="sm" type="button" onClick={handleAddItem} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Garment
                </Button>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const warning = getStockWarning(item);
                  return (
                    <div key={index} className="py-6 first:pt-0 last:pb-0 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-violet-700">Garment #{index + 1}</span>
                        {items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Garment Type */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Garment Type *</label>
                          <Select
                            value={item.garmentType}
                            onChange={(e) => handleItemChange(index, "garmentType", e.target.value)}
                          >
                            <option value="SHIRT">Shirt</option>
                            <option value="PANT">Pant</option>
                            <option value="SUIT">Suit (Coat + Pant)</option>
                            <option value="KURTA">Kurta</option>
                            <option value="SALWAR_KAMEEZ">Salwar Kameez</option>
                            <option value="BLOUSE">Blouse</option>
                            <option value="COAT">Waistcoat / Coat</option>
                            <option value="OTHER">Other Tailoring</option>
                          </Select>
                        </div>

                        {/* Fabric Selector */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Fabric Selection</label>
                          <Select
                            value={item.clothStockId}
                            onChange={(e) => {
                              handleItemChange(index, "clothStockId", e.target.value);
                            }}
                          >
                            <option value="">-- No stock fabric (Self Cloth) --</option>
                            {fabrics.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.fabricName} ({f.color}) — {f.quantityMeters}m left
                              </option>
                            ))}
                          </Select>
                        </div>

                        {/* Fabric Meters to use */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Fabric Meters Used</label>
                          <Input
                            type="number"
                            step="0.05"
                            placeholder="Meters (e.g. 2.5)"
                            disabled={!item.clothStockId}
                            value={item.fabricMetersUsed}
                            onChange={(e) => handleItemChange(index, "fabricMetersUsed", e.target.value)}
                          />
                        </div>

                        {/* Price */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500">Stitching Price (₹) *</label>
                          <Input
                            type="number"
                            required
                            placeholder="Price"
                            value={item.itemPrice}
                            onChange={(e) => handleItemChange(index, "itemPrice", e.target.value)}
                          />
                        </div>

                        {/* Item Notes */}
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-gray-500">Garment Specifications</label>
                          <Input
                            placeholder="Pocket style, button styling, cuff width, etc."
                            value={item.customNotes}
                            onChange={(e) => handleItemChange(index, "customNotes", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Fabric Stock Warning */}
                      {warning && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200/50 rounded-lg text-xs font-semibold">
                          <AlertCircle className="h-4 w-4" />
                          <span>{warning}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Pricing & Checkout Side Card */}
          <div className="w-full lg:w-80">
            <Card className="sticky top-6 border-violet-200 shadow-md">
              <CardHeader className="bg-violet-600 text-white rounded-t-xl">
                <CardTitle className="text-md font-bold flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  Order Billing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">Stitching Subtotal</span>
                  <span className="font-bold text-gray-950">{formatRupee(totalAmount)}</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Advance Paid (₹)</label>
                  <Input
                    type="number"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Payment Mode</label>
                  <Select value={advancePaymentMode} onChange={(e) => setAdvancePaymentMode(e.target.value)}>
                    <option value="CASH">Cash Payment</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="CREDIT">Shop Ledger Credit</option>
                  </Select>
                </div>
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Balance Due</span>
                  <span className={`text-base font-extrabold ${balanceDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {formatRupee(balanceDue)}
                  </span>
                </div>

                <div className="pt-4">
                  <Button type="submit" disabled={submittingOrder} className="w-full h-10 gap-2 font-bold shadow-lg shadow-violet-200">
                    <Check className="h-5 w-5" />
                    {submittingOrder ? "Creating Order..." : "Create Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-44 bg-gray-200/60 rounded-lg" />
        <div className="h-96 bg-gray-200/60 rounded-xl" />
      </div>
    }>
      <NewOrderPageContent />
    </Suspense>
  );
}
