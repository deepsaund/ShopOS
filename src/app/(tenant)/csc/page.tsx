"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useCscRole, CscUserRole } from "./csc-role-context";
import {
  ShieldAlert,
  Users,
  Briefcase,
  FileText,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileBox,
} from "lucide-react";

export default function CscPage() {
  const router = useRouter();
  const { role, setRole } = useCscRole();

  const handleRoleCardClick = (targetRole: CscUserRole) => {
    setRole(targetRole);
  };

  const features = [
    {
      role: "ADMIN" as CscUserRole,
      title: "Administrator Controls",
      description: "Manage service catalog CRUD, required documents, view staff completion stats, and monitor all requests.",
      icon: ShieldAlert,
      color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400",
      buttonColor: "bg-pink-600 hover:bg-pink-700",
      targetPath: "/csc/performance",
    },
    {
      role: "STAFF" as CscUserRole,
      title: "Service Desk Staff",
      description: "Claim requests from the queue, review and approve/reject documents, and process client requests.",
      icon: Users,
      color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
      targetPath: "/csc/queue",
    },
    {
      role: "CUSTOMER" as CscUserRole,
      title: "Customer Walk-in & Portal",
      description: "Register customers, manage document vault (Aadhaar, PAN), submit request cases, and chat with staff.",
      icon: FileBox,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
      buttonColor: "bg-emerald-600 hover:bg-emerald-700",
      targetPath: "/csc/customer",
    },
    {
      role: "B2B" as CscUserRole,
      title: "B2B Agent Portal",
      description: "Submit requests in bulk at discounted B2B pricing, upload documents, and track processes in real-time.",
      icon: Briefcase,
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
      buttonColor: "bg-amber-600 hover:bg-amber-700",
      targetPath: "/csc/customer",
    },
  ];

  return (
    <div className="space-y-10 py-6">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-slate-900 via-indigo-950/40 to-slate-950 border border-slate-800 p-8 md:p-12 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_45%)]" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            ShopOS Module 3
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200">
            CSC Center CRM Portal
          </h1>
          <p className="text-slate-400 text-sm md:text-md leading-relaxed max-w-xl">
            A comprehensive, multi-role SaaS system designed to manage citizen services (Aadhaar, Passport, Driving License), B2B agent pipelines, atomic staff claim queues, and secure document vaults.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <CheckCircle className="h-4.5 w-4.5 text-indigo-400" />
              <span>Document Vault</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <CheckCircle className="h-4.5 w-4.5 text-indigo-400" />
              <span>Atomic Queue Locking</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <CheckCircle className="h-4.5 w-4.5 text-indigo-400" />
              <span>Real-time Chat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Switcher Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight">Select a workspace portal</h2>
        <p className="text-xs text-slate-400">Choose a simulation profile to access specific CRM features and workflows:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((item) => {
            const Icon = item.icon;
            const isSelected = role === item.role;
            return (
              <div
                key={item.role}
                onClick={() => handleRoleCardClick(item.role)}
                className={`relative group overflow-hidden rounded-2xl border bg-gradient-to-b ${
                  item.color
                } p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
                  isSelected ? "ring-2 ring-indigo-500 shadow-indigo-500/10 scale-[1.01]" : "hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-3 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-900/60 rounded-xl">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-md text-white group-hover:text-indigo-200 transition-colors">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Simulate Workflow</span>
                  <div className="flex items-center gap-1 group-hover:gap-2 transition-all">
                    <span>Enter Portal</span>
                    <ArrowRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
