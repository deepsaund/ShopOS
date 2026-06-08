"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import { TenantProvider, useTenant } from "@/components/ui/tenant-context";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Users,
  UserCheck,
  Building,
  Menu,
  X,
  User,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { CscUserRole, CscRoleContext, useCscRole } from "./csc-role-context";

function CscLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantId, setTenantId } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Simulated state for dev mode role switching
  const [role, setRoleState] = useState<CscUserRole>("ADMIN");
  const [customerId, setCustomerId] = useState("");
  const staffId = "staff-1";
  const simulatedStaffName = "Arjun Kumar (Staff)";

  // Load from local storage if available
  useEffect(() => {
    const savedRole = localStorage.getItem("shopos_csc_role") as CscUserRole;
    if (savedRole) {
      setRoleState(savedRole);
    }
    const savedCustomerId = localStorage.getItem("shopos_csc_customer_id");
    if (savedCustomerId) {
      setCustomerId(savedCustomerId);
    }
  }, []);

  const setRole = (newRole: CscUserRole) => {
    setRoleState(newRole);
    localStorage.setItem("shopos_csc_role", newRole);
    
    // Redirect logically depending on role to make navigation seamless
    if (newRole === "CUSTOMER" || newRole === "B2B") {
      router.push("/csc/customer");
    } else if (newRole === "STAFF") {
      router.push("/csc/queue");
    } else {
      router.push("/csc/performance");
    }
  };

  const updateCustomerId = (id: string) => {
    setCustomerId(id);
    localStorage.setItem("shopos_csc_customer_id", id);
  };

  // Build navigation items based on active role
  const navItems = [];

  if (role === "ADMIN" || role === "STAFF") {
    if (role === "ADMIN") {
      navItems.push({ name: "Analytics & Performance", href: "/csc/performance", icon: LayoutDashboard });
      navItems.push({ name: "Service Catalog", href: "/csc/services", icon: Briefcase });
    }
    navItems.push({ name: "Request Queue", href: "/csc/queue", icon: FileText });
  }

  navItems.push({ name: "Customer Portal", href: "/csc/customer", icon: UserCheck });

  return (
    <CscRoleContext.Provider
      value={{
        role,
        setRole,
        staffId,
        simulatedStaffName,
        customerId,
        setCustomerId: updateCustomerId,
      }}
    >
      <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-100">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-72 border-r border-slate-800/60 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex h-20 items-center px-6 border-b border-slate-800/40 gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg shadow-indigo-500/10">
              <Building className="h-5.5 w-5.5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-md text-white tracking-tight block leading-tight">ShopOS CRM</span>
              <span className="text-[9px] text-indigo-400 font-extrabold tracking-widest uppercase flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-pink-400" />
                CSC CENTER
              </span>
            </div>
          </div>
          
          <nav className="flex-1 space-y-2 px-4 py-8 overflow-y-auto">
            <span className="text-[9px] px-4 uppercase font-bold tracking-widest text-slate-500 block mb-2">Workspaces</span>
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/csc" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                    active
                      ? "bg-indigo-600/10 border-l-4 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5"
                      : "text-slate-400 border-l-4 border-transparent hover:border-slate-800 hover:bg-slate-900/20 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 transition-colors duration-300 ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-5 border-t border-slate-800/40 bg-slate-900/10">
            {/* Simulation Context Panel */}
            <div className="flex flex-col gap-2.5 p-4 rounded-2xl border border-slate-800/60 bg-slate-950/50 backdrop-blur-md shadow-inner">
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Active Simulation</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse"></span>
                <span className="text-[11px] font-bold text-slate-300">Tenant: <span className="text-slate-200">{tenantId}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/50"></span>
                <span className="text-[11px] font-bold text-slate-300">
                  Role: <span className="text-indigo-400 font-extrabold">{role}</span>
                </span>
              </div>
              {customerId && (role === "CUSTOMER" || role === "B2B") && (
                <div className="flex items-center gap-2 border-t border-slate-800/40 pt-2.5 mt-0.5">
                  <User className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold text-slate-400 truncate">Client ID: {customerId.slice(0, 8)}...</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex flex-col w-72 bg-slate-950 h-full border-r border-slate-800 animate-slide-in">
              <div className="flex h-20 items-center justify-between px-6 border-b border-slate-850">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-xl text-white">
                    <Building className="h-5 w-5" />
                  </div>
                  <span className="font-extrabold text-sm text-white">ShopOS CSC</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <nav className="flex-1 space-y-2 px-4 py-6 overflow-y-auto">
                {navItems.map((item) => {
                  const active = pathname === item.href || (item.href !== "/csc" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold ${
                        active
                          ? "bg-indigo-600/10 border-l-4 border-indigo-500 text-indigo-300 font-semibold"
                          : "text-slate-400 border-l-4 border-transparent hover:bg-slate-900/40 hover:text-slate-200"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${active ? "text-indigo-400" : "text-slate-500"}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <header className="h-20 flex items-center justify-between px-6 md:px-8 bg-slate-900/20 border-b border-slate-800/40 flex-shrink-0 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="font-extrabold text-md md:text-lg text-white tracking-tight hidden sm:block">
                {pathname.includes("/performance") && "CSC Center Analytics"}
                {pathname.includes("/services") && "Services Catalog Manager"}
                {pathname.includes("/queue") && "Request Claim Queue"}
                {pathname.includes("/requests/") && "Service Request Details"}
                {pathname.includes("/customer") && "Customer Walk-in & Portal"}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Dev Simulation Role Selector */}
              <div className="flex items-center bg-slate-950/80 border border-slate-800/80 rounded-xl p-1 gap-1 shadow-inner">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase px-2 hidden lg:inline-block tracking-wider">Simulate Role:</span>
                {(["ADMIN", "STAFF", "CUSTOMER", "B2B"] as CscUserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 ${
                      role === r
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Tenant switcher */}
              <div className="flex items-center gap-2">
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="h-10 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 text-xs font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-md transition-all"
                >
                  <option value="test-tenant-1">Tenant 1</option>
                  <option value="test-tenant-2">Tenant 2</option>
                  <option value="csc-main-center">CSC Main Center</option>
                </select>
              </div>
            </div>
          </header>

          {/* Child Pages Router */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-slate-900/20 to-slate-950">
            <div className="max-w-7xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CscRoleContext.Provider>
  );
}

export default function CscLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TenantProvider>
        <CscLayoutContent>{children}</CscLayoutContent>
      </TenantProvider>
    </ToastProvider>
  );
}
