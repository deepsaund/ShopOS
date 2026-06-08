"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTenant } from "@/components/ui/tenant-context";
import { useCscRole } from "../csc-role-context";
import {
  User,
  Users,
  Search,
  Plus,
  FileText,
  UploadCloud,
  FileBox,
  Compass,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  Loader2,
  LogOut,
} from "lucide-react";

interface VaultDoc {
  id: string;
  docType: string;
  fileUrl: string;
  uploadedAt: string;
}

interface RequestItem {
  id: string;
  status: string;
  priceCharged: number;
  createdAt: string;
  service: {
    name: string;
  };
}

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  priceCustomer: number;
  priceB2b: number;
  estimatedDays: number;
  requiredDocuments: {
    name: string;
    description: string;
    is_mandatory: boolean;
  }[];
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}

export default function CustomerPortalPage() {
  const { tenantId } = useTenant();
  const { role, customerId, setCustomerId } = useCscRole();

  // Search & Register states
  const [searchPhone, setSearchPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regAddress, setRegAddress] = useState("");

  // Catalog & Vault states
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  
  // Create Request form states
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [requestUploads, setRequestUploads] = useState<Record<string, string>>({});

  // Vault Upload state
  const [vaultDocType, setVaultDocType] = useState("Proof of Identity");
  const [vaultFileUrl, setVaultFileUrl] = useState("");

  // Alert/Toast states
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // All customers for simulation selector
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    fetchServices();
    fetchAllCustomers();
  }, [tenantId]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetails(customerId);
    } else {
      setSelectedCustomer(null);
      setVaultDocs([]);
      setRequests([]);
    }
  }, [customerId, tenantId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/csc/services", {
        headers: { "x-tenant-id": tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await fetch("/api/csc/customers?limit=100", {
        headers: { "x-tenant-id": tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setAllCustomers(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching all customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchCustomerDetails = async (id: string) => {
    try {
      const [custRes, vaultRes, reqsRes] = await Promise.all([
        fetch(`/api/csc/customers`, {
          headers: { "x-tenant-id": tenantId },
        }),
        fetch(`/api/csc/vault?customerId=${id}`, {
          headers: { "x-tenant-id": tenantId },
        }),
        fetch(`/api/csc/requests?customerId=${id}`, {
          headers: { "x-tenant-id": tenantId },
        }),
      ]);

      if (custRes.ok && vaultRes.ok && reqsRes.ok) {
        const [custData, vaultData, reqsData] = await Promise.all([
          custRes.json(),
          vaultRes.json(),
          reqsRes.json(),
        ]);

        const found = custData.data.find((c: Customer) => c.id === id);
        if (found) {
          setSelectedCustomer(found);
          setVaultDocs(vaultData);
          setRequests(reqsData);
        } else {
          setCustomerId("");
        }
      }
    } catch (err) {
      console.error("Error fetching customer details concurrently:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone.trim()) return;

    try {
      const res = await fetch(`/api/csc/customers`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (res.ok) {
        const result = await res.json();
        const found = result.data.find(
          (c: Customer) => c.phone.replace(/\s+/g, "") === searchPhone.trim().replace(/\s+/g, "")
        );

        if (found) {
          setCustomerId(found.id);
          showToast(`Signed In: ${found.name}`);
          setSearchPhone("");
        } else {
          alert("Phone number not registered. Please register below.");
          setIsRegistering(true);
          setRegPhone(searchPhone);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim()) return;

    try {
      const res = await fetch("/api/csc/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          name: regName.trim(),
          phone: regPhone.trim(),
          email: regEmail.trim() || null,
          address: regAddress.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      const newCust = await res.json();
      setCustomerId(newCust.id);
      showToast(`Registered and signed in successfully: ${newCust.name}`);
      setIsRegistering(false);
      // Reset inputs
      setRegName("");
      setRegPhone("");
      setRegEmail("");
      setRegAddress("");
      fetchAllCustomers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVaultUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !vaultFileUrl.trim()) return;

    try {
      const res = await fetch("/api/csc/vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          customerId,
          docType: vaultDocType,
          fileUrl: vaultFileUrl.trim(),
        }),
      });

      if (!res.ok) throw new Error("Vault upload failed");
      showToast(`Saved to Vault: ${vaultDocType}`);
      setVaultFileUrl("");
      fetchCustomerDetails(customerId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !selectedServiceId) return;

    setIsSubmittingReq(true);

    const docUploadList = Object.entries(requestUploads)
      .filter(([_, url]) => !!url)
      .map(([docType, url]) => ({
        docType,
        fileUrl: url,
      }));

    try {
      const res = await fetch("/api/csc/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          customerId,
          serviceId: selectedServiceId,
          createdByRole: role,
          documents: docUploadList,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Request submission failed");
      }

      showToast("Service request created successfully!");
      setSelectedServiceId("");
      setRequestUploads({});
      fetchCustomerDetails(customerId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_DOCUMENTS":
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 uppercase tracking-wide">
            Fix Needed
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-wide">
            Under Review
          </span>
        );
      case "DOCS_APPROVED":
        return (
          <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 uppercase tracking-wide">
            Queued
          </span>
        );
      case "PROCESSING":
        return (
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-[9px] font-bold text-indigo-400 uppercase tracking-wide animate-pulse">
            Processing
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            {status}
          </span>
        );
    }
  };

  const activeService = services.find((s) => s.id === selectedServiceId);
  const isCustomerPortalRole = role === "CUSTOMER" || role === "B2B";

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/90 backdrop-blur-xl text-white px-5 py-3.5 rounded-xl shadow-xl shadow-indigo-950/20 font-semibold text-xs border border-indigo-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="h-5 w-5 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="h-3 w-3 text-indigo-400" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {isCustomerPortalRole ? (
        /* ==================== 🏠 CUSTOMER PORTAL INTERFACE ==================== */
        <div className="space-y-6">
          {!selectedCustomer ? (
            /* 📳 Customer Login & Sim Switcher */
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-8 rounded-2xl space-y-6 shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[450px]">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
                
                <div className="space-y-2">
                  <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">SECURE LOGIN</span>
                  <h2 className="text-2xl font-black text-white tracking-tight">ShopOS CSC Customer Portal</h2>
                  <p className="text-xs text-slate-400 max-w-md">
                    Access your account using your registered phone number to track request status, upload documents, and submit new government/private service requests.
                  </p>
                </div>

                {isRegistering ? (
                  <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in zoom-in-95 duration-250">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">First time? Register your profile:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. Suresh Sharma"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Contact Phone *</label>
                        <input
                          type="text"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Email (Optional)</label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="e.g. suresh@example.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Address (Optional)</label>
                        <input
                          type="text"
                          value={regAddress}
                          onChange={(e) => setRegAddress(e.target.value)}
                          placeholder="e.g. Sector 15, Dwarka, Delhi"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsRegistering(false)}
                        className="px-5 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-400 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Sign In Instead
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10"
                      >
                        Register Profile
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <form onSubmit={handleSearch} className="flex gap-2.5 max-w-md">
                      <input
                        type="text"
                        required
                        placeholder="Enter your phone number (e.g. 9876543210)"
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650"
                      />
                      <button
                        type="submit"
                        className="px-5 py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-xs font-extrabold shadow-md border border-indigo-500/20 transition-all hover:scale-[1.02]"
                      >
                        Sign In
                      </button>
                    </form>
                    <p className="text-[11px] text-slate-500">
                      Don't have a profile yet?{" "}
                      <button
                        onClick={() => setIsRegistering(true)}
                        className="text-indigo-400 hover:underline font-bold"
                      >
                        Register profile here
                      </button>
                    </p>
                  </div>
                )}
              </div>

              {/* 👨‍💻 Simulation Portal Account Selector */}
              <div className="lg:col-span-2 bg-slate-950/20 border border-slate-800/80 p-6 rounded-2xl space-y-4 shadow-lg flex flex-col justify-start">
                <div>
                  <span className="text-[9px] text-pink-400 font-extrabold tracking-widest uppercase block mb-1">DEVELOPER ASSISTANT</span>
                  <h3 className="text-sm font-bold text-white">Simulator Account Switcher</h3>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    Instantly simulate logging in as any customer currently registered in the tenant database:
                  </p>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {loadingCustomers ? (
                    <div className="flex items-center gap-2 py-4 justify-center text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                      Loading simulator list...
                    </div>
                  ) : allCustomers.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-slate-600">
                      No customer profiles exist in database. Register a new one on the left.
                    </div>
                  ) : (
                    allCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        onClick={() => {
                          setCustomerId(cust.id);
                          showToast(`Logged in as simulated customer: ${cust.name}`);
                        }}
                        className="w-full text-left p-3.5 bg-slate-900/40 border border-slate-850 hover:border-slate-700 hover:bg-slate-900/80 rounded-xl transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-205 group-hover:text-white block">{cust.name}</span>
                          <span className="text-[10px] text-slate-500">{cust.phone}</span>
                        </div>
                        <span className="text-[9px] font-extrabold uppercase tracking-wide text-indigo-400 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          Select
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 🖥️ Customer Portal Dashboard */
            <div className="space-y-6 animate-in fade-in duration-350">
              {/* Profile Card Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/40 border border-slate-800/80 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-indigo-650 flex items-center justify-center shadow-lg shadow-indigo-650/20 text-white font-black text-lg">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[9px] text-indigo-400 font-extrabold tracking-widest uppercase block">CUSTOMER PORTAL PROFILE</span>
                    <h2 className="text-xl font-black text-white tracking-tight">{selectedCustomer.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Phone: <span className="text-slate-200 font-medium">{selectedCustomer.phone}</span></span>
                      {selectedCustomer.email && (
                        <>
                          <span className="text-slate-800">|</span>
                          <span>Email: <span className="text-slate-200 font-medium">{selectedCustomer.email}</span></span>
                        </>
                      )}
                      {selectedCustomer.address && (
                        <>
                          <span className="text-slate-800">|</span>
                          <span>Address: <span className="text-slate-200 font-medium">{selectedCustomer.address}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setCustomerId("")}
                  className="px-4.5 py-2 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  Sign Out
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main section: applications and applies */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Past Applications List */}
                  <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-4 shadow-lg">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">APPLICATIONS</span>
                      <h3 className="text-sm font-bold text-white">Track Active & Past Service Requests</h3>
                    </div>

                    {requests.length === 0 ? (
                      <div className="text-center p-8 bg-slate-900/10 border border-slate-850 rounded-xl space-y-3">
                        <FileText className="h-8 w-8 text-slate-750 mx-auto" />
                        <p className="text-xs text-slate-500">You haven't submitted any service requests yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {requests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between p-4 bg-slate-900/10 border border-slate-850 rounded-xl hover:border-slate-800 hover:bg-slate-900/30 transition-all duration-300"
                          >
                            <div className="space-y-1 max-w-[70%]">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-200">{req.service.name}</span>
                                {getStatusBadge(req.status)}
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                Submitted: {new Date(req.createdAt).toLocaleDateString()} | Cost: <span className="text-slate-350">₹{req.priceCharged}</span>
                              </p>
                            </div>
                            
                            <Link
                              href={`/csc/requests/${req.id}`}
                              className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-850 hover:border-slate-700 hover:text-white text-slate-400 transition-colors text-[10px] font-bold flex items-center gap-1.5"
                            >
                              Track Status & Chat
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Apply for services */}
                  <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-5 shadow-lg">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">SERVICE REQUEST</span>
                      <h3 className="text-sm font-bold text-white">Apply for a New Service</h3>
                    </div>

                    <form onSubmit={handleCreateRequest} className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-400 font-semibold">Choose Target Service Catalog Item</label>
                        <select
                          required
                          value={selectedServiceId}
                          onChange={(e) => {
                            setSelectedServiceId(e.target.value);
                            setRequestUploads({});
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-3 text-xs text-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="">-- Select government or private service --</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} (SLA: {s.estimatedDays} Days)
                            </option>
                          ))}
                        </select>
                      </div>

                      {activeService && (
                        <div className="p-4.5 rounded-xl border border-indigo-500/20 bg-indigo-600/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-350">Rate Details:</span>
                            <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/20 rounded-md">
                              {role === "B2B" ? `B2B Rate: ₹${activeService.priceB2b}` : `Rate: ₹${activeService.priceCustomer}`}
                            </span>
                          </div>
                          {activeService.description && (
                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{activeService.description}</p>
                          )}

                          {/* Checklist */}
                          {activeService.requiredDocuments && activeService.requiredDocuments.length > 0 && (
                            <div className="border-t border-slate-800/40 pt-4 space-y-3.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                                Scanned Documents Attachment Checklist
                              </span>

                              <div className="space-y-2.5">
                                {activeService.requiredDocuments.map((doc, idx) => {
                                  const vaultMatch = vaultDocs.find((vd) => vd.docType === doc.name);
                                  const hasVaultFile = !!vaultMatch;
                                  const isAttached = !!requestUploads[doc.name];

                                  // Prepopulate local state automatically if vault document exists
                                  if (hasVaultFile && !isAttached && !requestUploads[doc.name]) {
                                    setRequestUploads(prev => ({
                                      ...prev,
                                      [doc.name]: vaultMatch.fileUrl
                                    }));
                                  }

                                  return (
                                    <div
                                      key={idx}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 gap-3 text-xs"
                                    >
                                      <div className="space-y-0.5">
                                        <span className="font-bold text-slate-205">
                                          {doc.name} {doc.is_mandatory && <span className="text-rose-400">*</span>}
                                        </span>
                                        {doc.description && (
                                          <span className="block text-[10px] text-slate-500">{doc.description}</span>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2.5">
                                        {hasVaultFile && (
                                          <span className="text-[9px] font-bold text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1.5 uppercase">
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            Auto-pulled
                                          </span>
                                        )}

                                        <input
                                          type="text"
                                          placeholder="Scanned document image/file URL"
                                          value={requestUploads[doc.name] || ""}
                                          onChange={(e) =>
                                            setRequestUploads({
                                              ...requestUploads,
                                              [doc.name]: e.target.value,
                                            })
                                          }
                                          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-[240px]"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={!selectedServiceId || isSubmittingReq}
                        className="w-full py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950/20 transition-all border border-indigo-500/20 flex items-center justify-center gap-2 hover:scale-[1.01]"
                      >
                        {isSubmittingReq ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting Request Case File...
                          </>
                        ) : (
                          <>Submit Service Application</>
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Vault side */}
                <div className="space-y-6">
                  <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center gap-3 border-b border-slate-800/40 pb-4">
                      <FolderOpen className="h-5 w-5 text-indigo-400 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-white block">My Document Vault</span>
                        <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider">Reusable scanned files caching</span>
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      Store scanned credentials (e.g. Aadhaar copy, signature scan) permanently in your vault. They will automatically auto-populate any new service requests you create.
                    </p>

                    {/* upload form */}
                    <form onSubmit={handleVaultUpload} className="bg-slate-900/25 p-4 border border-slate-855 rounded-xl space-y-3.5 shadow-inner">
                      <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">Add Document to Registry</span>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Document Type</label>
                          <select
                            value={vaultDocType}
                            onChange={(e) => setVaultDocType(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:outline-none cursor-pointer"
                          >
                            <option value="Proof of Identity">Proof of Identity</option>
                            <option value="Proof of Address">Proof of Address</option>
                            <option value="Birth Certificate">Birth Certificate</option>
                            <option value="PAN Photo">PAN Photo</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Passport Photo">Passport Photo</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Document File/Image URL</label>
                          <input
                            type="text"
                            required
                            placeholder="Direct file image link URL"
                            value={vaultFileUrl}
                            onChange={(e) => setVaultFileUrl(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md flex items-center justify-center gap-1.5 border border-indigo-550/20 transition-all hover:scale-[1.02]"
                      >
                        <UploadCloud className="h-4 w-4" />
                        Save Scanned Copy
                      </button>
                    </form>

                    {/* Vault list */}
                    <div className="space-y-3 pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-550 tracking-wider block">My Registered Vault Files ({vaultDocs.length})</span>
                      {vaultDocs.length === 0 ? (
                        <p className="text-[10px] text-slate-600">Your document vault is currently empty.</p>
                      ) : (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                          {vaultDocs.map((vd) => (
                            <div
                              key={vd.id}
                              className="p-3 rounded-xl bg-slate-950/45 border border-slate-850 text-xs flex items-center justify-between gap-3 hover:border-slate-800 transition-all"
                            >
                              <div className="space-y-0.5 max-w-[70%]">
                                <span className="font-bold text-slate-205 block">{vd.docType}</span>
                                <a
                                  href={vd.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-[10px] text-indigo-400 hover:text-indigo-305 truncate underline"
                                >
                                  {vd.fileUrl}
                                </a>
                              </div>
                              <span className="text-[9px] text-slate-550 font-bold whitespace-nowrap">
                                {new Date(vd.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================== 💼 STAFF WALK-IN INTERFACE ==================== */
        <div className="space-y-6">
          {/* Customer Lookup & Selector */}
          <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-550/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">WALK-IN REGISTRAR</span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedCustomer ? `Active Client: ${selectedCustomer.name}` : "Lookup or Register Walk-in Client"}
                </h2>
                {selectedCustomer && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>Phone: <span className="text-slate-200 font-medium">{selectedCustomer.phone}</span></span>
                    {selectedCustomer.address && (
                      <>
                        <span className="text-slate-800">|</span>
                        <span className="truncate">Address: <span className="text-slate-200 font-medium">{selectedCustomer.address}</span></span>
                      </>
                    )}
                  </p>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2.5">
                {selectedCustomer && (
                  <button
                    onClick={() => setCustomerId("")}
                    className="px-4.5 py-2 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-bold text-slate-350 transition-all animate-in fade-in"
                  >
                    Change Selected Customer
                  </button>
                )}
                <button
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="px-4.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 hover:text-white rounded-xl text-xs font-bold text-indigo-400 flex items-center gap-2 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  {isRegistering ? "Close Form" : "Create New Walk-in Profile"}
                </button>
              </div>
            </div>

            {/* Search Input */}
            {!selectedCustomer && !isRegistering && (
              <form onSubmit={handleSearch} className="flex gap-2.5 max-w-lg">
                <input
                  type="text"
                  required
                  placeholder="Enter contact number (e.g. 9876543210)"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-xs font-extrabold shadow shadow-indigo-950/20 flex items-center gap-2 border border-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Search className="h-4 w-4" />
                  Find Account
                </button>
              </form>
            )}

            {/* Register Form */}
            {isRegistering && (
              <form onSubmit={handleRegister} className="bg-slate-900/40 p-5 border border-slate-800/80 rounded-xl space-y-4 max-w-xl animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[10px] uppercase font-extrabold text-indigo-405 tracking-wider block">New Profile Registration Form</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Suresh Sharma"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Contact Phone *</label>
                    <input
                      type="text"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Email Address (Optional)</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. suresh@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Home Address (Optional)</label>
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="e.g. Sector-4, Dwarka, New Delhi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="px-4 py-2 border border-slate-850 hover:bg-slate-850 text-slate-400 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition-colors"
                  >
                    Create Applicant Profile
                  </button>
                </div>
              </form>
            )}
          </div>

          {selectedCustomer ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              
              {/* Column 1: New Service request form & Past Requests list */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Create service request */}
                <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-5 shadow-lg">
                  <div>
                    <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">REGISTRATION</span>
                    <h3 className="text-sm font-bold text-white">Create Walk-in Service Case Request</h3>
                  </div>
                  
                  <form onSubmit={handleCreateRequest} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">Select Service Requesting</label>
                      <select
                        required
                        value={selectedServiceId}
                        onChange={(e) => {
                          setSelectedServiceId(e.target.value);
                          setRequestUploads({});
                        }}
                        className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3.5 py-3 text-xs text-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Choose a service catalog item --</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (SLA: {s.estimatedDays} Days)
                          </option>
                        ))}
                      </select>
                    </div>

                    {activeService && (
                      <div className="p-4.5 rounded-xl border border-indigo-500/20 bg-indigo-600/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-350">Service Billing Mode:</span>
                          <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/20 rounded-md">
                            Walk-in Client Price: ₹{activeService.priceCustomer}
                          </span>
                        </div>
                        {activeService.description && (
                          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{activeService.description}</p>
                        )}

                        {/* Document Upload checklist */}
                        {activeService.requiredDocuments && activeService.requiredDocuments.length > 0 && (
                          <div className="border-t border-slate-800/40 pt-4 space-y-3.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                              Required Scan Attachments Checklist
                            </span>

                            <div className="space-y-2.5">
                              {activeService.requiredDocuments.map((doc, idx) => {
                                const vaultMatch = vaultDocs.find((vd) => vd.docType === doc.name);
                                const hasVaultFile = !!vaultMatch;
                                const isAttached = !!requestUploads[doc.name];

                                // Prepopulate local state automatically if vault document exists
                                if (hasVaultFile && !isAttached && !requestUploads[doc.name]) {
                                  setRequestUploads(prev => ({
                                    ...prev,
                                    [doc.name]: vaultMatch.fileUrl
                                  }));
                                }

                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 gap-3 text-xs"
                                  >
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-slate-205">
                                        {doc.name} {doc.is_mandatory && <span className="text-rose-400">*</span>}
                                      </span>
                                      {doc.description && (
                                        <span className="block text-[10px] text-slate-500">{doc.description}</span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2.5">
                                      {hasVaultFile && (
                                        <span className="text-[9px] font-bold text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1.5 uppercase">
                                          <CheckCircle className="h-3.5 w-3.5" />
                                          Vault Cached
                                        </span>
                                      )}

                                      <input
                                        type="text"
                                        placeholder="Paste scanned document image URL"
                                        value={requestUploads[doc.name] || ""}
                                        onChange={(e) =>
                                          setRequestUploads({
                                            ...requestUploads,
                                            [doc.name]: e.target.value,
                                          })
                                        }
                                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-[240px]"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!selectedServiceId || isSubmittingReq}
                      className="w-full py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950/20 transition-all border border-indigo-500/20 flex items-center justify-center gap-2 hover:scale-[1.01]"
                    >
                      {isSubmittingReq ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting Walk-in Case File...
                        </>
                      ) : (
                        <>Register Walk-in Request Case</>
                      )}
                    </button>
                  </form>
                </div>

                {/* Request list */}
                <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-4 shadow-lg">
                  <div>
                    <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">CLIENT DOSSIERS</span>
                    <h3 className="text-sm font-bold text-white">Client's Service Request History</h3>
                  </div>
                  
                  {requests.length === 0 ? (
                    <p className="text-xs text-slate-500">No active or archived requests associated with this customer profile.</p>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-4 bg-slate-900/10 border border-slate-850 rounded-xl hover:border-slate-800 hover:bg-slate-900/30 transition-all duration-300"
                        >
                          <div className="space-y-1 max-w-[70%]">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-200">{req.service.name}</span>
                              {getStatusBadge(req.status)}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-normal font-medium">
                              Submitted: {new Date(req.createdAt).toLocaleDateString()} | Cost: <span className="text-slate-350">₹{req.priceCharged}</span>
                            </p>
                          </div>
                          
                          <Link
                            href={`/csc/requests/${req.id}`}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 hover:border-slate-700 hover:text-white text-slate-400 transition-colors text-[10px] font-bold flex items-center gap-1.5"
                          >
                            Inspect Dossier
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Vault side */}
              <div className="space-y-6">
                
                {/* Vault Manager list */}
                <div className="bg-slate-950/35 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl space-y-5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center gap-3 border-b border-slate-800/40 pb-4">
                    <FolderOpen className="h-5 w-5 text-indigo-400 animate-pulse" />
                    <div>
                      <span className="text-xs font-bold text-white block">Client's Document Vault</span>
                      <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider">Permanent Document Registry</span>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Store standard customer credentials (Aadhaar, PAN, etc.) once. Pre-populates all subsequent case applications automatically.
                  </p>

                  {/* Vault upload Form */}
                  <form onSubmit={handleVaultUpload} className="bg-slate-900/25 p-4 border border-slate-850 rounded-xl space-y-3.5 shadow-inner">
                    <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">Add Document to Registry</span>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Document Code</label>
                        <select
                          value={vaultDocType}
                          onChange={(e) => setVaultDocType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:outline-none cursor-pointer"
                        >
                          <option value="Proof of Identity">Proof of Identity</option>
                          <option value="Proof of Address">Proof of Address</option>
                          <option value="Birth Certificate">Birth Certificate</option>
                          <option value="PAN Photo">PAN Photo</option>
                          <option value="Driving License">Driving License</option>
                          <option value="Passport Photo">Passport Photo</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Scanned Image URL</label>
                        <input
                          type="text"
                          required
                          placeholder="Direct file image link"
                          value={vaultFileUrl}
                          onChange={(e) => setVaultFileUrl(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-950/20 flex items-center justify-center gap-1.5 border border-indigo-550/20 transition-all hover:scale-[1.02]"
                    >
                      <UploadCloud className="h-4 w-4" />
                      Save Scanned Copy
                    </button>
                  </form>

                  {/* Vault Files List */}
                  <div className="space-y-3 pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">REGISTERED FILE VAULT ({vaultDocs.length})</span>
                    {vaultDocs.length === 0 ? (
                      <p className="text-[10px] text-slate-650 leading-normal">Dossier vault is empty. Upload documents above to begin caching.</p>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {vaultDocs.map((vd) => (
                          <div
                            key={vd.id}
                            className="p-3 rounded-xl bg-slate-950/45 border border-slate-850 text-xs flex items-center justify-between gap-3 hover:border-slate-800 transition-colors"
                          >
                            <div className="space-y-0.5 max-w-[70%]">
                              <span className="font-bold text-slate-205 block">{vd.docType}</span>
                              <a
                                href={vd.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[10px] text-indigo-400 hover:text-indigo-305 truncate underline"
                              >
                                {vd.fileUrl}
                              </a>
                            </div>
                            <span className="text-[9px] text-slate-550 font-bold whitespace-nowrap">
                              {new Date(vd.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-900/10 border border-slate-850 rounded-2xl space-y-3">
              <Users className="h-10 w-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-400">No client selected</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Search for an existing customer contact number or register a new walk-in customer profile above.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
