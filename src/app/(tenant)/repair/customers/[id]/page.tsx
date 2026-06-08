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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  User,
  Wrench,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface PartUsed {
  id: string;
  quantityUsed: number;
  priceCharged: number;
  repairPart: {
    partName: string;
    partNumber: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  paidAt: string;
}

interface JobCard {
  id: string;
  jobNumber: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  imeiSerial: string | null;
  reportedIssue: string;
  diagnosedIssue: string | null;
  status: string;
  estimatedCost: number;
  finalCost: number;
  advanceTaken: number;
  balanceDue: number;
  warrantyDays: number;
  deliveryDate: string;
  deliveredAt: string | null;
  assignedToStaff: string;
  deviceConditionOnReceipt: string;
  createdAt: string;
  partsUsed: PartUsed[];
  payments: Payment[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  jobCards: JobCard[];
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const { id: customerId } = params;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Customer States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/repair/customers/${customerId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load customer profile details");
      const data = await res.json();
      setCustomer(data);

      // Pre-fill edit fields
      setName(data.name);
      setPhone(data.phone);
      setEmail(data.email || "");
      setAddress(data.address || "");
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

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast("Customer name is required", "error");
    if (!phone.trim()) return toast("Customer phone is required", "error");

    try {
      setUpdating(true);
      const res = await fetch(`/api/repair/customers/${customerId}`, {
        method: "PUT",
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
      if (!res.ok) throw new Error(data.error || "Failed to update customer");

      toast("Customer profile updated successfully", "success");
      setShowEditDialog(false);
      fetchCustomerDetails();
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to update customer profile", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (customer && customer.jobCards.length > 0) {
      return toast("Cannot delete customer with active device job cards. Clear job cards first.", "error");
    }
    if (!confirm("Are you sure you want to delete this customer profile permanently?")) return;

    try {
      const res = await fetch(`/api/repair/customers/${customerId}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete customer");
      }
      toast("Customer profile deleted successfully", "success");
      router.push("/repair/customers");
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Failed to delete customer", "error");
    }
  };

  const getStatusBadge = (jobStatus: string) => {
    switch (jobStatus) {
      case "RECEIVED":
        return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">Received</Badge>;
      case "DIAGNOSING":
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200">Diagnosing</Badge>;
      case "WAITING_FOR_PARTS":
        return <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200">Wait Parts</Badge>;
      case "REPAIRING":
        return <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200">Repairing</Badge>;
      case "READY":
        return <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">Ready</Badge>;
      case "DELIVERED":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200">Delivered</Badge>;
      case "UNREPAIRABLE":
        return <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200">Unrepairable</Badge>;
      case "RETURNED_UNREPAIRED":
        return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-200">Returned Unrepaired</Badge>;
      default:
        return <Badge>{jobStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500">
        <Clock className="h-8 w-8 animate-spin text-violet-600 mb-3" />
        <p className="font-semibold text-sm">Loading customer history profile...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
        <p className="font-bold text-base">Customer profile not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/repair/customers")}>
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/repair/customers")} className="text-gray-500">
          <ArrowLeft className="h-4 w-4" /> Back to Profiles
        </Button>

        <div className="flex gap-2">
          {/* Quick Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shadow-sm">
                <Edit2 className="h-4 w-4" /> Edit Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Customer profile</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateCustomer} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Full Name *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Phone Number *</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Email Address (Optional)</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Home Address</label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={updating}>
                    {updating ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleDeleteCustomer} className="text-red-600 hover:bg-red-50 border-red-200">
            <Trash2 className="h-4 w-4" /> Delete Profile
          </Button>
        </div>
      </div>

      {/* Profile summary card */}
      <Card className="border-gray-200/60 shadow-sm overflow-hidden bg-gradient-to-r from-violet-50/50 to-indigo-50/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-2xl shadow">
                {customer.name[0].toUpperCase()}
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-gray-400" /> {customer.phone}
                  </span>
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-gray-400" /> {customer.email}
                    </span>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" /> {customer.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={() => router.push(`/repair/jobs/new?claimParentId=&claimParent=true`)} className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> New Device Entry
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Device History list */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Device Repair History</h3>
          <p className="text-xs text-gray-500">View chronologically ordered job card sheets for this customer.</p>
        </div>

        {customer.jobCards.length > 0 ? (
          <div className="space-y-6">
            {customer.jobCards.map((job) => {
              const totalCost = job.finalCost > 0 ? job.finalCost : job.estimatedCost;
              return (
                <Card key={job.id} className="border-gray-200/60 shadow-sm overflow-hidden hover:border-violet-300 transition-colors">
                  <CardHeader className="border-b bg-gray-50/40 flex flex-row items-center justify-between py-3">
                    <div className="flex items-center gap-2.5">
                      <Badge className="bg-gray-150 text-gray-800 font-bold hover:bg-gray-150">{job.jobNumber}</Badge>
                      <h4 className="font-bold text-sm text-gray-800">
                        {job.deviceBrand} {job.deviceModel} ({job.deviceType})
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-violet-600 hover:bg-violet-50 h-8 gap-1 pr-1 font-semibold"
                        onClick={() => router.push(`/repair/jobs/${job.id}`)}
                      >
                        Details <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-400 block text-[9px] uppercase tracking-wide">Reported Issue</span>
                          <span className="text-gray-700 leading-relaxed italic">"{job.reportedIssue}"</span>
                        </div>
                        {job.diagnosedIssue && (
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase tracking-wide">Diagnosis Notes</span>
                            <span className="text-gray-700 leading-relaxed font-semibold">{job.diagnosedIssue}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 border-l md:pl-4">
                        <div>
                          <span className="text-gray-400 block text-[9px] uppercase tracking-wide">Date Received</span>
                          <span className="text-gray-700">
                            {new Date(job.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[9px] uppercase tracking-wide">Estimated Delivery</span>
                          <span className="text-gray-700">
                            {new Date(job.deliveryDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {job.deliveredAt && (
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase tracking-wide">Date Delivered</span>
                            <span className="text-green-600 font-bold">
                              {new Date(job.deliveredAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 border-l md:pl-4">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-[9px] uppercase tracking-wide">Total Cost Charged</span>
                          <span className="text-gray-800 font-bold">₹{totalCost}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-[9px] uppercase tracking-wide">Advance Taken</span>
                          <span className="text-gray-800 font-bold">₹{job.advanceTaken}</span>
                        </div>
                        <div className="flex justify-between border-t border-dashed pt-1.5 mt-1">
                          <span className="text-gray-500 font-bold">Balance Due</span>
                          <span className={`font-extrabold ${job.balanceDue > 0 ? "text-red-500" : "text-green-600"}`}>
                            ₹{job.balanceDue}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Spare parts used summary for this job */}
                    {job.partsUsed.length > 0 && (
                      <div className="pt-3 border-t border-dashed">
                        <span className="text-gray-400 text-[9px] uppercase tracking-wide block mb-1">Spare Parts Used</span>
                        <div className="flex flex-wrap gap-2">
                          {job.partsUsed.map((p) => (
                            <Badge key={p.id} variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                              {p.repairPart.partName} ({p.quantityUsed}x) - ₹{p.priceCharged * p.quantityUsed}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 bg-gray-50 border-2 border-dashed rounded-xl">
            <Wrench className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm font-semibold">No device repair history records found</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => router.push(`/repair/jobs/new`)}>
              Create First Job Card
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
