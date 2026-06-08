"use client";

import React, { useState, useEffect } from "react";
import Link from "next/navigation";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Search, Plus, UserPlus, Eye, ChevronLeft, ChevronRight } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  orders: { createdAt: string }[];
}

export default function CustomersPage() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Measurements State
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [shoulder, setShoulder] = useState("");
  const [sleeveLength, setSleeveLength] = useState("");
  const [shirtLength, setShirtLength] = useState("");
  const [pantLength, setPantLength] = useState("");
  const [pantWaist, setPantWaist] = useState("");
  const [pantThigh, setPantThigh] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tailor/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load customer profiles");
      const result = await res.json();
      setCustomers(result.data || []);
      setTotal(result.total || 0);
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load customers", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast("Customer name is required", "error");
    if (!phone.trim()) return toast("Customer phone is required", "error");

    try {
      setSubmitting(true);
      const payload = {
        name,
        phone,
        email: email.trim() || null,
        address: address.trim() || null,
        measurements: {
          chest: chest ? parseFloat(chest) : null,
          waist: waist ? parseFloat(waist) : null,
          hips: hips ? parseFloat(hips) : null,
          shoulder: shoulder ? parseFloat(shoulder) : null,
          sleeve_length: sleeveLength ? parseFloat(sleeveLength) : null,
          shirt_length: shirtLength ? parseFloat(shirtLength) : null,
          pant_length: pantLength ? parseFloat(pantLength) : null,
          pant_waist: pantWaist ? parseFloat(pantWaist) : null,
          pant_thigh: pantThigh ? parseFloat(pantThigh) : null,
          notes: specialNotes.trim() || null,
        },
      };

      const res = await fetch("/api/tailor/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create customer");
      }

      toast(`Customer ${name} registered successfully!`, "success");
      setDrawerOpen(false);
      
      // Reset form fields
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setChest("");
      setWaist("");
      setHips("");
      setShoulder("");
      setSleeveLength("");
      setShirtLength("");
      setPantLength("");
      setPantWaist("");
      setPantThigh("");
      setSpecialNotes("");

      // Reload list
      setPage(1);
      fetchCustomers();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to register customer", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers Profile Registry</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage customer sizing profiles and orders history.</p>
        </div>
        
        {/* Radix Sheet Trigger for Creating Customer Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Customer
            </Button>
          </SheetTrigger>
          <SheetContent className="max-w-xl">
            <SheetHeader>
              <SheetTitle>Add Customer Profile</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              {/* Personal Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wider border-b pb-1">Personal Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Full Name *</label>
                    <Input placeholder="E.g. Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Phone Number *</label>
                    <Input placeholder="E.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Email Address (Optional)</label>
                  <Input type="email" placeholder="E.g. rajesh@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Home Address</label>
                  <Textarea placeholder="Full residential address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
                </div>
              </div>

              {/* Sizing Measurements */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wider border-b pb-1">Measurements (In Inches)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Chest</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={chest} onChange={(e) => setChest(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Waist</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={waist} onChange={(e) => setWaist(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Hips</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={hips} onChange={(e) => setHips(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Shoulder</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={shoulder} onChange={(e) => setShoulder(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Sleeve Length</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={sleeveLength} onChange={(e) => setSleeveLength(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Shirt Length</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={shirtLength} onChange={(e) => setShirtLength(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Pant Length</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={pantLength} onChange={(e) => setPantLength(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Pant Waist</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={pantWaist} onChange={(e) => setPantWaist(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">Pant Thigh</label>
                    <Input type="number" step="0.1" placeholder="Inches" value={pantThigh} onChange={(e) => setPantThigh(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Fitting Notes</label>
                  <Textarea placeholder="Collar style, cuffs, loose fitting preference, pocket styles, etc." value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} rows={2} />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <SheetClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </SheetClose>
                <Button type="submit" disabled={submitting} className="min-w-[120px]">
                  {submitting ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filter and Search Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-150 rounded-xl px-3 py-1 w-full max-w-md">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // reset page on search
              }}
              className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 py-2 text-gray-800 placeholder-gray-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers List Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200/60 rounded-lg" />
              ))}
            </div>
          ) : customers.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Last Order Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const totalOrders = c.orders?.length || 0;
                    const lastOrder = c.orders && c.orders.length > 0 ? c.orders[0].createdAt : null;

                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => router.push(`/tailor/customers/${c.id}`)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-semibold text-gray-900 hover:text-violet-600 transition-colors">
                          {c.name}
                        </TableCell>
                        <TableCell className="font-medium">{c.phone}</TableCell>
                        <TableCell className="font-medium text-gray-700">
                          {totalOrders}
                        </TableCell>
                        <TableCell>
                          {lastOrder
                            ? new Date(lastOrder).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "No orders yet"}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-violet-600 hover:text-violet-700 gap-1"
                            onClick={() => router.push(`/tailor/customers/${c.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                            View Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">
                    Showing Page {page} of {totalPages} ({total} customers)
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
              <UserPlus className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No customer records found.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setDrawerOpen(true)}>
                Add Customer Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
