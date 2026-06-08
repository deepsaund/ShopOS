"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Search, Plus, UserPlus, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}

export default function NewJobCardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  // URL parameters for warranty claim flow
  const claimParentId = searchParams.get("claimParentId");
  const parentJobNumber = searchParams.get("parentJobNumber");

  // Form states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deviceType, setDeviceType] = useState("MOBILE");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [imeiSerial, setImeiSerial] = useState("");
  const [reportedIssue, setReportedIssue] = useState("");
  const [deviceCondition, setDeviceCondition] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [advanceTaken, setAdvanceTaken] = useState("0");
  const [advancePaymentMode, setAdvancePaymentMode] = useState("CASH");
  const [warrantyDays, setWarrantyDays] = useState("0");
  
  // Default delivery date is tomorrow
  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };
  const [deliveryDate, setDeliveryDate] = useState(getTomorrowString());
  const [assignedToStaff, setAssignedToStaff] = useState("");
  
  // Customer Lookup states
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // Quick Customer Create State
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Fetch parent job if this is a warranty claim
  useEffect(() => {
    if (claimParentId) {
      const fetchParentJob = async () => {
        try {
          const res = await fetch(`/api/repair/jobs/${claimParentId}`, {
            headers: { "x-tenant-id": tenantId },
          });
          if (!res.ok) throw new Error("Failed to fetch warranty parent details");
          const parentJob = await res.json();
          
          // Pre-fill customer
          setSelectedCustomer(parentJob.customer);
          // Pre-fill device
          setDeviceType(parentJob.deviceType);
          setDeviceBrand(parentJob.deviceBrand);
          setDeviceModel(parentJob.deviceModel);
          setImeiSerial(parentJob.imeiSerial || "");
          setDeviceCondition(parentJob.deviceConditionOnReceipt || "");
          setAssignedToStaff(parentJob.assignedToStaff || "");
          
          // A warranty claim typically costs 0
          setEstimatedCost("0");
          setAdvanceTaken("0");
          setReportedIssue(`Warranty Claim linked to job ${parentJob.jobNumber}. Issue: `);
        } catch (error: any) {
          console.error(error);
          toast("Could not prefill warranty parent info", "error");
        }
      };
      fetchParentJob();
    }
  }, [claimParentId, tenantId]);

  // Handle Customer search
  useEffect(() => {
    const searchCustomers = async () => {
      if (!customerSearch.trim()) {
        setCustomerResults([]);
        return;
      }
      try {
        setSearchingCustomer(true);
        const res = await fetch(`/api/repair/customers?search=${encodeURIComponent(customerSearch)}`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (!res.ok) throw new Error("Failed to search customers");
        const data = await res.json();
        setCustomerResults(data.data || []);
      } catch (error: any) {
        console.error(error);
      } finally {
        setSearchingCustomer(false);
      }
    };

    const delay = setTimeout(searchCustomers, 300);
    return () => clearTimeout(delay);
  }, [customerSearch, tenantId]);

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return toast("Customer name is required", "error");
    if (!newCustPhone.trim()) return toast("Customer phone is required", "error");

    try {
      setSavingCustomer(true);
      const res = await fetch("/api/repair/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          name: newCustName,
          phone: newCustPhone,
          email: newCustEmail || null,
          address: newCustAddress || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      toast("Customer registered successfully!", "success");
      setSelectedCustomer(data);
      setShowAddCustomer(false);
      // Reset fields
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewCustAddress("");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to register customer", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return toast("Please select or register a customer", "error");
    if (!deviceBrand.trim()) return toast("Device brand is required", "error");
    if (!deviceModel.trim()) return toast("Device model is required", "error");
    if (!reportedIssue.trim()) return toast("Reported issue details are required", "error");
    if (!deviceCondition.trim()) return toast("Device receipt condition is required", "error");
    if (!assignedToStaff.trim()) return toast("Please assign to a staff member", "error");

    try {
      setSubmitting(true);
      const payload = {
        customerId: selectedCustomer.id,
        deviceType,
        deviceBrand,
        deviceModel,
        imeiSerial: imeiSerial.trim() || null,
        reportedIssue,
        estimatedCost: parseFloat(estimatedCost) || 0,
        advanceTaken: parseFloat(advanceTaken) || 0,
        advancePaymentMode,
        warrantyDays: parseInt(warrantyDays) || 0,
        deliveryDate,
        assignedToStaff,
        deviceConditionOnReceipt: deviceCondition,
        customerSignatureUrl: null,
        warrantyParentId: claimParentId || null,
      };

      const res = await fetch("/api/repair/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create job card");

      toast(`Job card ${data.jobNumber} created successfully!`, "success");
      router.push(`/repair/jobs/${data.id}`);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to create job card", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Form Form */}
        <div className="flex-1 space-y-6">
          <Card className="border-gray-200/60 shadow-sm">
            <CardHeader className="border-b bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {claimParentId ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-violet-600" />
                    Claim Warranty (New claim for {parentJobNumber})
                  </>
                ) : (
                  "Create Device Job Card"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Customer Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-violet-700 uppercase tracking-wider border-b pb-1">
                    1. Customer Information
                  </h3>
                  {selectedCustomer ? (
                    <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900">{selectedCustomer.name}</p>
                        <p className="text-xs text-gray-500 font-semibold mt-0.5">Phone: {selectedCustomer.phone}</p>
                        {selectedCustomer.email && (
                          <p className="text-xs text-gray-500 font-semibold">Email: {selectedCustomer.email}</p>
                        )}
                        {selectedCustomer.address && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1">Addr: {selectedCustomer.address}</p>
                        )}
                      </div>
                      {!claimParentId && (
                        <Button variant="outline" size="sm" type="button" onClick={() => setSelectedCustomer(null)}>
                          Change Customer
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Lookup input */}
                        <div className="flex-1 relative">
                          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                            <Search className="h-4.5 w-4.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search customer by name or phone..."
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                              className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400"
                            />
                          </div>
                          
                          {/* Results dropdown */}
                          {customerResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-25 max-h-52 overflow-y-auto divide-y divide-gray-100">
                              {customerResults.map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setSelectedCustomer(c);
                                    setCustomerSearch("");
                                    setCustomerResults([]);
                                  }}
                                  className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                  <p className="font-bold text-sm text-gray-900">{c.name}</p>
                                  <p className="text-xs text-gray-500 font-medium">Phone: {c.phone}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {customerSearch && customerResults.length === 0 && !searchingCustomer && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl p-4 shadow-lg text-center z-25">
                              <p className="text-xs text-gray-400 font-medium">No customers found</p>
                            </div>
                          )}
                        </div>

                        {/* Quick Add Button */}
                        <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline" className="gap-1.5 font-semibold text-violet-600 border-violet-200 hover:bg-violet-50">
                              <UserPlus className="h-4.5 w-4.5" /> Quick Register
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Register Customer</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleQuickCreateCustomer} className="space-y-4 pt-2">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Name *</label>
                                <Input placeholder="Rajesh Kumar" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} required />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Phone Number *</label>
                                <Input placeholder="9876543210" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} required />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Email Address (Optional)</label>
                                <Input type="email" placeholder="rajesh@gmail.com" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Address (Optional)</label>
                                <Textarea placeholder="Full address" value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} rows={2} />
                              </div>
                              <div className="flex gap-2 justify-end border-t pt-4">
                                <DialogClose asChild>
                                  <Button type="button" variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={savingCustomer}>
                                  {savingCustomer ? "Registering..." : "Register Customer"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Device Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-violet-700 uppercase tracking-wider border-b pb-1">
                    2. Device & Issue Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Device Type *</label>
                      <Select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} disabled={!!claimParentId}>
                        <option value="MOBILE">Mobile Phone</option>
                        <option value="LAPTOP">Laptop / Notebook</option>
                        <option value="TABLET">Tablet / iPad</option>
                        <option value="TV">Television (TV)</option>
                        <option value="AC">Air Conditioner (AC)</option>
                        <option value="OTHER">Other Electronic</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Device Brand *</label>
                      <Input placeholder="E.g. Apple, Samsung, Dell" value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} required disabled={!!claimParentId} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Device Model *</label>
                      <Input placeholder="E.g. iPhone 15, Latitude 5420" value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} required disabled={!!claimParentId} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">IMEI or Serial Number (Optional)</label>
                      <Input placeholder="E.g. 358912345678901, SN-8923A" value={imeiSerial} onChange={(e) => setImeiSerial(e.target.value)} disabled={!!claimParentId} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Assigned Staff *</label>
                      <Input placeholder="E.g. Anil Kumar (Technician)" value={assignedToStaff} onChange={(e) => setAssignedToStaff(e.target.value)} required />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Reported Issue *</label>
                    <Textarea
                      placeholder="Detailed explanation of the problems reported by the customer..."
                      value={reportedIssue}
                      onChange={(e) => setReportedIssue(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Device Condition on Receipt *</label>
                    <Textarea
                      placeholder="E.g. Scratches on back glass, minor dent in bottom right corner, screen guard cracked, side buttons working..."
                      value={deviceCondition}
                      onChange={(e) => setDeviceCondition(e.target.value)}
                      rows={2}
                      required
                    />
                  </div>
                </div>

                {/* 3. Costs & Warranty Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-violet-700 uppercase tracking-wider border-b pb-1">
                    3. Costs, Payment & Service Dates
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Estimated Cost (₹) *</label>
                      <Input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} min="0" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Advance Taken (₹)</label>
                      <Input type="number" value={advanceTaken} onChange={(e) => setAdvanceTaken(e.target.value)} min="0" disabled={!!claimParentId} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Advance Payment Mode</label>
                      <Select value={advancePaymentMode} onChange={(e) => setAdvancePaymentMode(e.target.value)} disabled={!!claimParentId}>
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI / QR Code</option>
                        <option value="CARD">Debit/Credit Card</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Estimated Delivery Date *</label>
                      <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Warranty Period Offered (Days)</label>
                      <Select value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)}>
                        <option value="0">No Warranty</option>
                        <option value="30">30 Days</option>
                        <option value="90">90 Days (3 Months)</option>
                        <option value="180">180 Days (6 Months)</option>
                        <option value="365">365 Days (1 Year)</option>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Submission row */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="min-w-[150px]">
                    {submitting ? "Creating Job Card..." : "Create Job Card"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info panel */}
        <div className="w-full lg:w-80 space-y-6">
          <Card className="border-gray-200/60 shadow-sm bg-gray-50/50">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Repair Policy Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-gray-600 leading-relaxed font-medium">
              <div className="flex gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-600 flex-shrink-0" />
                <p>Verify customer name and phone details accurately for notifications and receipt delivery.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-600 flex-shrink-0" />
                <p>Note all cracks, scratches, and missing screws in the physical receipt description block to prevent disputes.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-600 flex-shrink-0" />
                <p>The estimated cost can be revised later by updating the Job Card. Parts can be charged dynamically from inventory.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
