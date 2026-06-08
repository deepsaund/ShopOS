"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import { TenantProvider, useTenant } from "@/components/ui/tenant-context";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Layers,
  Menu,
  X,
  Store,
  PlusCircle,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/repair", exact: true, icon: LayoutDashboard },
  { name: "Job Cards", href: "/repair/jobs", exact: false, icon: Wrench },
  { name: "Parts Inventory", href: "/repair/parts", exact: false, icon: Layers },
  { name: "Customers Profile", href: "/repair/customers", exact: false, icon: Users },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenantId, setTenantId } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50/50 overflow-hidden font-sans text-gray-800">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200/60 bg-white">
        <div className="flex h-16 items-center px-6 border-b border-gray-100 gap-2.5">
          <Store className="h-6 w-6 text-violet-600" />
          <span className="font-bold text-xl text-gray-900 tracking-tight">ShopOS Repair</span>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-violet-50 text-violet-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-violet-600" : "text-gray-400"}`} />
                {item.name}
              </Link>
            );
          })}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <Link
              href="/repair/jobs/new"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white shadow-sm hover:bg-violet-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              New Job Card
            </Link>
          </div>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex flex-col gap-1.5 px-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Current Tenant</span>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-150">
              <span className="text-xs font-semibold text-gray-700 truncate">{tenantId}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-white h-full border-r border-gray-100 animate-slide-in">
            <div className="flex h-16 items-center justify-between px-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Store className="h-6 w-6 text-violet-600" />
                <span className="font-bold text-lg text-gray-900">ShopOS Repair</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
              {navItems.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
                      active
                        ? "bg-violet-50 text-violet-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-violet-600" : "text-gray-400"}`} />
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-4 mt-4 border-t border-gray-100">
                <Link
                  href="/repair/jobs/new"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white shadow hover:bg-violet-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  New Job Card
                </Link>
              </div>
            </nav>
            <div className="p-4 border-t border-gray-100">
              <div className="flex flex-col gap-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
                <span className="text-[9px] uppercase font-bold text-gray-400">Tenant</span>
                <span className="text-xs font-semibold text-gray-700 truncate">{tenantId}</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200/60 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-lg text-gray-900 hidden sm:block">
              {pathname === "/repair" && "Repair Dashboard"}
              {pathname.includes("/jobs") && !pathname.includes("/new") && "Job Cards Registry"}
              {pathname.includes("/jobs/new") && "Create Job Card"}
              {pathname.includes("/parts") && "Parts Inventory"}
              {pathname.includes("/customers") && "Customer Sizing & Repair History"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Tenant switcher dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="tenant-select" className="text-xs font-medium text-gray-500 hidden md:block">
                Tenant:
              </label>
              <select
                id="tenant-select"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer shadow-sm"
              >
                <option value="test-tenant-1">Tenant 1 (Default)</option>
                <option value="test-tenant-2">Tenant 2 (Empty)</option>
                <option value="custom-repair-shop">Custom Repair Shop</option>
              </select>
            </div>
          </div>
        </header>

        {/* Child Pages Router */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function RepairLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TenantProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </TenantProvider>
    </ToastProvider>
  );
}
