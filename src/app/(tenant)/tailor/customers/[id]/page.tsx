"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { formatRupee } from "@/lib/utils";
import {
  ArrowLeft,
  Ruler,
  Scissors,
  ClipboardList,
  Edit,
  Phone,
  Mail,
  MapPin,
  Calendar,
} from "lucide-react";

interface CustomerDetails {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  measurements: Record<string, any>;
  createdAt: string;
  orders: any[];
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const customerId = params.id;

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Edit fields (Personal)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Edit fields (Measurements)
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

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tailor/customers/${customerId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load customer details");
      const result = await res.json();
      setCustomer(result);

      // Pre-populate edit state
      setName(result.name || "");
      setPhone(result.phone || "");
      setEmail(result.email || "");
      setAddress(result.address || "");
      
      const m = result.measurements || {};
      setChest(m.chest?.toString() || "");
      setWaist(m.waist?.toString() || "");
      setHips(m.hips?.toString() || "");
      setShoulder(m.shoulder?.toString() || "");
      setSleeveLength(m.sleeve_length?.toString() || "");
      setShirtLength(m.shirt_length?.toString() || "");
      setPantLength(m.pant_length?.toString() || "");
      setPantWaist(m.pant_waist?.toString() || "");
      setPantThigh(m.pant_thigh?.toString() || "");
      setSpecialNotes(m.notes || "");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to load customer details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [customerId, tenantId]);

  const handleUpdate = async (e: React.FormEvent) => {
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

      const res = await fetch(`/api/tailor/customers/${customerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update measurements");
      }

      toast("Customer profile and sizing updated successfully!", "success");
      setDrawerOpen(false);
      fetchCustomerDetails();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to save profile", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-24 bg-gray-200/60 rounded-lg" />
        <div className="h-44 bg-gray-200/60 rounded-xl" />
        <div className="h-64 bg-gray-200/60 rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-semibold">Customer record not found.</p>
        <Button className="mt-4" onClick={() => router.push("/tailor/customers")}>
          Back to Registry
        </Button>
      </div>
    );
  }

  const m = customer.measurements || {};
  const measurementFields = [
    { label: "Chest Size", value: m.chest },
    { label: "Waist Size", value: m.waist },
    { label: "Hips Size", value: m.hips },
    { label: "Shoulder Size", value: m.shoulder },
    { label: "Sleeve Length", value: m.sleeve_length },
    { label: "Shirt Length", value: m.shirt_length },
    { label: "Pant Length", value: m.pant_length },
    { label: "Pant Waist", value: m.pant_waist },
    { label: "Pant Thigh", value: m.pant_thigh },
  ];

  return (
    <div className="space-y-6">
      {/* Back button and main header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push("/tailor/customers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-gray-500">Back to Customers</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Customer Quick Profile Card */}
        <div className="w-full lg:w-1/3 space-y-6">
          <Card>
            <CardHeader className="border-b border-gray-100 pb-5">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-2xl font-bold mb-3 shadow-inner">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <CardTitle className="text-xl font-bold">{customer.name}</CardTitle>
                <Badge variant="outline" className="mt-1.5 border-violet-100 text-violet-700 bg-violet-50/50">
                  Customer
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>{customer.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>Registered {new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Edit drawer button */}
              <div className="pt-4 border-t flex flex-col gap-2">
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <Edit className="h-4 w-4" />
                      Edit Measurements
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="max-w-xl">
                    <SheetHeader>
                      <SheetTitle>Modify Sizing Profile</SheetTitle>
                    </SheetHeader>
                    <form onSubmit={handleUpdate} className="space-y-6 pt-4">
                      {/* Personal Info */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wider border-b pb-1">Personal Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Name</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Phone</label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-500">Email Address</label>
                          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-500">Address</label>
                          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
                        </div>
                      </div>

                      {/* Measurements fields */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wider border-b pb-1">Measurements (Inches)</h3>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Chest</label>
                            <Input type="number" step="0.1" value={chest} onChange={(e) => setChest(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Waist</label>
                            <Input type="number" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Hips</label>
                            <Input type="number" step="0.1" value={hips} onChange={(e) => setHips(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Shoulder</label>
                            <Input type="number" step="0.1" value={shoulder} onChange={(e) => setShoulder(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Sleeve</label>
                            <Input type="number" step="0.1" value={sleeveLength} onChange={(e) => setSleeveLength(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Shirt Length</label>
                            <Input type="number" step="0.1" value={shirtLength} onChange={(e) => setShirtLength(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Pant Length</label>
                            <Input type="number" step="0.1" value={pantLength} onChange={(e) => setPantLength(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Pant Waist</label>
                            <Input type="number" step="0.1" value={pantWaist} onChange={(e) => setPantWaist(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Pant Thigh</label>
                            <Input type="number" step="0.1" value={pantThigh} onChange={(e) => setPantThigh(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-500">Fitting Notes</label>
                          <Textarea placeholder="Add tailoring specifications" value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} rows={2} />
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end pt-4 border-t">
                        <SheetClose asChild>
                          <Button variant="outline" type="button">Cancel</Button>
                        </SheetClose>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? "Updating..." : "Update Profile"}
                        </Button>
                      </div>
                    </form>
                  </SheetContent>
                </Sheet>

                {/* Place Order shortcut */}
                <Link href={`/tailor/orders/new?customerId=${customer.id}`}>
                  <Button className="w-full gap-2">
                    <Scissors className="h-4 w-4" />
                    Place New Order
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Sizing and Orders History display */}
        <div className="flex-1 space-y-6">
          {/* Sizing Grid Card */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 border-b border-gray-100/60 pb-4">
              <Ruler className="h-5 w-5 text-violet-600" />
              <CardTitle className="text-md font-bold text-gray-800">Sizing Measurements (Inches)</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {measurementFields.map((field) => (
                  <div key={field.label} className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 flex flex-col gap-1 shadow-sm">
                    <span className="text-xs font-bold tracking-wide text-gray-400 uppercase">{field.label}</span>
                    <span className="text-base font-extrabold text-gray-800">
                      {field.value !== null && field.value !== undefined ? `${field.value} "` : "—"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t pt-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Fitting & Customization Notes</span>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-700 bg-violet-50/20 p-3 rounded-lg border border-violet-100/35 font-medium">
                  {m.notes || "No special instructions recorded on this profile."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Orders History Card */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 border-b border-gray-100/60 pb-4">
              <ClipboardList className="h-5 w-5 text-violet-600" />
              <CardTitle className="text-md font-bold text-gray-800">Orders History</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {customer.orders && customer.orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order No.</TableHead>
                      <TableHead>Garments</TableHead>
                      <TableHead>Placement Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-semibold text-violet-600">
                          <Link href={`/tailor/orders?search=${o.orderNumber}`}>
                            {o.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[150px] truncate">
                          {o.items?.map((it: any) => it.garmentType).join(", ")}
                        </TableCell>
                        <TableCell>
                          {new Date(o.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.status.toLowerCase() as any}>
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatRupee(o.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-gray-900">
                          {formatRupee(o.balanceDue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Scissors className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No orders registered for this customer yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
