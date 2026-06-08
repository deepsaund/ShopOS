"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Search, Plus, UserPlus, Eye, ChevronLeft, ChevronRight, Contact2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  jobCards: { id: string; createdAt: string }[];
}

export default function RepairCustomersPage() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Form states for customer registration
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/repair/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
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
      const res = await fetch("/api/repair/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          name,
          phone,
          email: email.trim() || null,
          address: address.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register customer");

      toast(`Customer ${name} registered successfully!`, "success");
      setShowAddDialog(false);
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Repair Customer profiles</h2>
          <p className="text-sm text-gray-500">Manage customer profile info and device-wise histories.</p>
        </div>

        {/* Dialog Add Customer Trigger */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <UserPlus className="h-4 w-4" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register Customer profile</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Full Name *</label>
                <Input placeholder="Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Phone Number *</label>
                <Input placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Email Address (Optional)</label>
                <Input type="email" placeholder="rajesh@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Home Address</label>
                <Textarea placeholder="Full residential address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Customer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search Bar Card */}
      <Card className="border-gray-200/60 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-150 rounded-xl px-3 py-1 w-full max-w-md">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 py-2 text-gray-800 placeholder-gray-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="border-gray-200/60 shadow-sm overflow-hidden">
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
                    <TableHead>Email Address</TableHead>
                    <TableHead>Total Job Cards</TableHead>
                    <TableHead>Registered Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const totalJobs = c.jobCards?.length || 0;

                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => router.push(`/repair/customers/${c.id}`)}
                        className="cursor-pointer hover:bg-gray-50/50"
                      >
                        <TableCell className="font-semibold text-gray-900 hover:text-violet-600 transition-colors">
                          {c.name}
                        </TableCell>
                        <TableCell className="font-medium">{c.phone}</TableCell>
                        <TableCell className="text-gray-600 text-xs font-semibold">{c.email || "—"}</TableCell>
                        <TableCell className="font-bold text-gray-700">{totalJobs} device entries</TableCell>
                        <TableCell className="text-gray-500 text-xs font-semibold">
                          {new Date(c.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-violet-600 hover:text-violet-700 gap-1"
                            onClick={() => router.push(`/repair/customers/${c.id}`)}
                          >
                            <Eye className="h-4 w-4" /> View History
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
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
              <Contact2 className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No customer records found</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddDialog(true)}>
                Register Customer Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
