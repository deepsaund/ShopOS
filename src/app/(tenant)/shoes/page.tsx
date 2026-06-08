"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupee } from "@/lib/utils";
import {
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  ChevronRight,
  ShoppingBag,
  Footprints,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardKPIs {
  todaySalesTotal: number;
  todayUnitsSold: number;
  lowStockCount: number;
  pendingUdhaarTotal: number;
  topSellingSizesToday: { size: string; quantity: number }[];
}

export default function ShoesDashboard() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        
        // 1. Fetch KPIs
        const kpisRes = await fetch("/api/shoes/dashboard", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!kpisRes.ok) throw new Error("Failed to load dashboard metrics");
        const kpisData = await kpisRes.json();
        setKpis(kpisData);

        // 2. Fetch Low Stock Items
        const lowStockRes = await fetch("/api/shoes/stock/low", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!lowStockRes.ok) throw new Error("Failed to load low stock alerts");
        const lowStockData = await lowStockRes.json();
        setLowStockItems(lowStockData);

        // 3. Fetch Recent Sales
        const salesRes = await fetch("/api/shoes/sales?limit=10", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!salesRes.ok) throw new Error("Failed to load recent sales");
        const salesData = await salesRes.json();
        setRecentSales(salesData.data || []);

        // 4. Calculate Sales Last 7 Days for Recharts Bar Chart
        const allSales = salesData.data || [];
        const aggregatedChartData = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          
          const totalAmount = allSales
            .filter((s: any) => s.saleDate.startsWith(dateStr))
            .reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0);

          return {
            day: date.toLocaleDateString("en-IN", { weekday: "short" }),
            dateStr,
            amount: totalAmount,
          };
        }).reverse();
        
        setChartData(aggregatedChartData);

      } catch (error: any) {
        console.error(error);
        toast(error.message || "An error occurred while loading dashboard metrics", "error");
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      loadDashboardData();
    }
  }, [tenantId, toast]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* KPI Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200/60 rounded-xl" />
          ))}
        </div>
        {/* Chart Skeleton */}
        <div className="h-80 bg-gray-200/60 rounded-xl" />
        {/* Tables Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 bg-gray-200/60 rounded-xl" />
          <div className="h-80 bg-gray-200/60 rounded-xl" />
        </div>
      </div>
    );
  }

  // Filter sales that happened today for the recent sales today table
  const todayStr = new Date().toISOString().split("T")[0];
  const todaysRecentSales = recentSales.filter((s) => s.saleDate.startsWith(todayStr));

  return (
    <div className="space-y-6">
      {/* Welcome & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-indigo-600/5 to-purple-600/5 border border-indigo-100 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Welcome to ShopOS Shoe Shop CRM <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time stock alerts, checkout system, and credit tracking.
          </p>
        </div>
        <Link href="/shoes/sales/new">
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <ShoppingBag className="h-4 w-4" />
            New Sale (POS)
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sales Today */}
        <Card className="hover:border-indigo-200 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Today's Sales</span>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {formatRupee(kpis?.todaySalesTotal)}
                </h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <IndianRupee className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Units Sold Today */}
        <Card className="hover:border-indigo-200 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Units Sold Today</span>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {kpis?.todayUnitsSold || 0}
                </h3>
              </div>
              <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="hover:border-red-200 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Low Stock SKUs</span>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {kpis?.lowStockCount || 0}
                </h3>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  (kpis?.lowStockCount || 0) > 0
                    ? "bg-red-50 text-red-600 animate-bounce"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Udhaar */}
        <Card className="hover:border-rose-200 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Pending Udhaar</span>
                <h3 className="text-2xl font-bold text-rose-600 tracking-tight">
                  {formatRupee(kpis?.pendingUdhaarTotal)}
                </h3>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <IndianRupee className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-md font-bold text-gray-800">Sales Trends (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-80 w-full">
          {mounted && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(value) => [formatRupee(Number(value)), "Sales"]}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px" }}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Chart unavailable
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: Low Stock and Recent Sales */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-md font-bold text-gray-800">Low Stock Alerts</CardTitle>
            {lowStockItems.length > 0 ? (
              <Badge variant="destructive" className="animate-pulse">
                {lowStockItems.length} Alerts
              </Badge>
            ) : (
              <Badge variant="success">All Stock Good</Badge>
            )}
          </CardHeader>
          <CardContent>
            {lowStockItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Stock Left</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.slice(0, 5).map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell className="font-semibold text-gray-850">
                        {sku.product?.brand?.name} {sku.product?.modelName}
                      </TableCell>
                      <TableCell className="font-medium">{sku.size}</TableCell>
                      <TableCell>{sku.color}</TableCell>
                      <TableCell className="font-bold text-red-650">{sku.quantityInStock}</TableCell>
                      <TableCell className="text-right font-medium text-gray-550">
                        {sku.lowStockThreshold}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 border border-dashed border-gray-150 rounded-xl">
                <Footprints className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">All shoe stocks are above thresholds.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-md font-bold text-gray-800">Recent Sales Today</CardTitle>
            </div>
            <Link href="/shoes/sales">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-indigo-600">
                View History <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todaysRecentSales.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todaysRecentSales.slice(0, 5).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium text-gray-800">
                        {sale.customer ? sale.customer.name : "Walk-in Customer"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.paymentMode.toLowerCase() as any}>
                          {sale.paymentMode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {formatRupee(sale.amountPaid)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {formatRupee(sale.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 border border-dashed border-gray-150 rounded-xl">
                <ShoppingBag className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">No sales recorded today yet.</p>
                <Link href="/shoes/sales/new" className="mt-3">
                  <Button size="sm" variant="outline" className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    <PlusCircle className="h-4 w-4" /> Start Sale
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
