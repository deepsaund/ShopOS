"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useCscRole } from "../csc-role-context";
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  X,
  Check,
  Calendar,
  Sparkles,
} from "lucide-react";

interface RequiredDoc {
  name: string;
  description: string;
  is_mandatory: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string;
  priceCustomer: number;
  priceB2b: number;
  estimatedDays: number;
  requiredDocuments: RequiredDoc[];
}

export default function ServicesPage() {
  const { tenantId } = useTenant();
  const { role } = useCscRole();
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceCustomer, setPriceCustomer] = useState(100);
  const [priceB2b, setPriceB2b] = useState(80);
  const [estimatedDays, setEstimatedDays] = useState(5);
  const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);

  // New doc item inputs
  const [newDocName, setNewDocName] = useState("");
  const [newDocDesc, setNewDocDesc] = useState("");
  const [newDocMandatory, setNewDocMandatory] = useState(true);

  useEffect(() => {
    fetchServices();
  }, [tenantId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/csc/services", {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load services");
      const data = await res.json();
      setServices(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPriceCustomer(100);
    setPriceB2b(80);
    setEstimatedDays(5);
    setRequiredDocs([]);
    setEditingId(null);
    setNewDocName("");
    setNewDocDesc("");
    setNewDocMandatory(true);
  };

  const openCreateModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEditModal = (service: Service) => {
    setName(service.name);
    setDescription(service.description);
    setPriceCustomer(service.priceCustomer);
    setPriceB2b(service.priceB2b);
    setEstimatedDays(service.estimatedDays);
    setRequiredDocs(service.requiredDocuments || []);
    setEditingId(service.id);
    setIsOpen(true);
  };

  const addDocRequirement = () => {
    if (!newDocName.trim()) return;
    
    if (requiredDocs.some((d) => d.name.toLowerCase() === newDocName.trim().toLowerCase())) {
      alert("Document already added in checklist");
      return;
    }

    setRequiredDocs([
      ...requiredDocs,
      {
        name: newDocName.trim(),
        description: newDocDesc.trim(),
        is_mandatory: newDocMandatory,
      },
    ]);
    setNewDocName("");
    setNewDocDesc("");
    setNewDocMandatory(true);
  };

  const removeDocRequirement = (index: number) => {
    setRequiredDocs(requiredDocs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name,
      description,
      priceCustomer: Number(priceCustomer),
      priceB2b: Number(priceB2b),
      estimatedDays: Number(estimatedDays),
      requiredDocuments: requiredDocs,
    };

    try {
      const url = editingId ? `/api/csc/services/${editingId}` : "/api/csc/services";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save service");
      }

      showToast(editingId ? "Service updated successfully" : "Service created successfully");
      setIsOpen(false);
      resetForm();
      fetchServices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const res = await fetch(`/api/csc/services/${id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });

      if (!res.ok) throw new Error("Failed to delete service");
      showToast("Service deleted successfully");
      fetchServices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-slate-800/80 rounded-3xl min-h-[300px] text-center space-y-4 backdrop-blur-md">
        <div className="p-3 bg-rose-500/10 rounded-2xl">
          <AlertCircle className="h-8 w-8 text-rose-500" />
        </div>
        <h3 className="text-md font-bold text-white">Access Denied</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Only administrators can manage the service catalog. Use the Role Switcher at the top of the page to switch to ADMIN mode.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3.5 rounded-xl shadow-xl shadow-indigo-600/30 font-bold text-xs border border-indigo-500 flex items-center gap-2 animate-bounce">
          <Check className="h-4.5 w-4.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/30 border border-slate-850/60 p-6 rounded-3xl backdrop-blur-xl">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Government & Private Services Catalog
          </h2>
          <p className="text-xs text-slate-400">Configure catalog services, document checklists, B2B price margins, and processing SLA times.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Service
        </button>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 bg-slate-900/30 border border-slate-850 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-slate-900/20 border border-slate-850 rounded-2xl text-rose-400 text-xs">
          {error}
        </div>
      ) : services.length === 0 ? (
        <div className="text-center p-12 bg-slate-900/10 border border-slate-800 rounded-3xl">
          <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400">No services configured</p>
          <p className="text-[11px] text-slate-500 mt-1">Click "Add Service" to initialize the catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-col justify-between bg-slate-900/30 border border-slate-850/80 rounded-3xl p-6 hover:border-indigo-500/35 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 backdrop-blur-sm"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-extrabold text-sm text-white">{service.name}</h3>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900/60 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900/60 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[36px] line-clamp-2">
                  {service.description || "No description provided."}
                </p>

                {/* Price Grid & SLA */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-4 rounded-2xl border border-slate-850/50 text-center shadow-inner">
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">Customer</span>
                    <span className="text-xs font-extrabold text-slate-200">₹{service.priceCustomer}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">B2B Agent</span>
                    <span className="text-xs font-extrabold text-indigo-400">₹{service.priceB2b}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">SLA Days</span>
                    <span className="text-xs font-extrabold text-emerald-400">{service.estimatedDays} days</span>
                  </div>
                </div>

                {/* Required Documents checklist */}
                <div className="space-y-2 pt-1.5">
                  <span className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    Required Documents Checklist
                  </span>
                  {service.requiredDocuments && service.requiredDocuments.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {service.requiredDocuments.map((doc, idx) => (
                        <span
                          key={idx}
                          className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                            doc.is_mandatory
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-800/40 text-slate-400 border-slate-800"
                          }`}
                          title={doc.description}
                        >
                          {doc.name}
                          {doc.is_mandatory && " *"}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-600 block">No documents required.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-zoom-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-950/30">
              <h3 className="font-extrabold text-sm text-white">
                {editingId ? "Edit Service Properties" : "Create New Service"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Service Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aadhaar Card Registration"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the service workflow and details..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Customer Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={priceCustomer}
                    onChange={(e) => setPriceCustomer(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">B2B Agent Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={priceB2b}
                    onChange={(e) => setPriceB2b(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Estimated Days (SLA)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Document Configuration */}
              <div className="border-t border-slate-800/80 pt-5 space-y-3">
                <span className="text-xs font-extrabold text-white block">Document Requirements Checklist</span>
                
                {/* Current Doc List */}
                <div className="space-y-2">
                  {requiredDocs.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">No documents requested yet. Configure them below.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-2">
                      {requiredDocs.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-200">
                              {doc.name} {doc.is_mandatory && <span className="text-rose-400">*</span>}
                            </span>
                            {doc.description && (
                              <span className="block text-[10px] text-slate-500">{doc.description}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocRequirement(idx)}
                            className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add new Document Input Form */}
                <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-4">
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Configure Document Requirement</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold">Document Name</label>
                      <input
                        type="text"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder="e.g. Aadhaar Photo front"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">Requirement Type</label>
                      <div className="flex items-center gap-2 pt-1.5">
                        <input
                          type="checkbox"
                          id="new-doc-mandatory"
                          checked={newDocMandatory}
                          onChange={(e) => setNewDocMandatory(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-900 text-indigo-650 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <label htmlFor="new-doc-mandatory" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                          Mandatory file upload
                        </label>
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold">Description / Format Info</label>
                      <input
                        type="text"
                        value={newDocDesc}
                        onChange={(e) => setNewDocDesc(e.target.value)}
                        placeholder="e.g. Color scanned copy in PDF or JPEG (Max 2MB)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addDocRequirement}
                    className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-indigo-400 hover:bg-slate-850 hover:text-indigo-300 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Document to Checklist
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4.5 py-2.5 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 transition-colors"
                >
                  {editingId ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
