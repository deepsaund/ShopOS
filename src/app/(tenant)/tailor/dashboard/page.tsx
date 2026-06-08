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
  Clock,
  AlertTriangle,
  IndianRupee,
  ChevronRight,
  Scissors,
  Layers,
  Sparkles,
} from "lucide-react";

interface DashboardData {
  totalOrdersByStatus: Record<string, number>;
  lowStockItemsCount: number;
  lowStockItems: any[];
  todaysDeliveriesCount: number;
  todaysDeliveries: any[];
  pendingBalanceAmount: number;
}

export default function DashboardPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        // Fetch dashboard metrics
        const dashRes = await fetch("/api/tailor/dashboard", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!dashRes.ok) throw new Error("Failed to load dashboard metrics");
        const dashData = await dashRes.json();
        setData(dashData);

        // Fetch recent orders
        const ordersRes = await fetch("/api/tailor/orders?page=1&limit=5", {
          headers: { "x-tenant-id": tenantId },
        });
        if (!ordersRes.ok) throw new Error("Failed to load recent orders");
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.data || []);
      } catch (error: any) {
        console.error(error);
        toast(error.message || "An error occurred while loading dashboard data", "error");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [tenantId, toast]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Stat Cards Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200/60 rounded-xl" />
          ))}
        </div>
        {/* Tables Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 bg-gray-200/60 rounded-xl" />
          <div className="h-80 bg-gray-200/60 rounded-xl" />
        </div>
        {/* Recent Orders Skeleton */}
        <div className="h-64 bg-gray-200/60 rounded-xl" />
      </div>
    );
  }

  // Calculate total active orders (excluding CANCELLED and DELIVERED)
  const activeOrdersCount = data
    ? Object.entries(data.totalOrdersByStatus).reduce((sum, [status, count]) => {
        if (status !== "CANCELLED" && status !== "DELIVERED") {
          return sum + count;
        }
        return sum;
      }, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-violet-600/5 to-indigo-600/5 border border-violet-100 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Welcome back to ShopOS Tailor CRM <Sparkles className="h-5 w-5 text-violet-600 animate-pulse" />
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Here is what's happening in your shop today.
          </p>
        </div>
        <Link href="/tailor/orders/new">
          <Button className="gap-2">
            <Scissors className="h-4 w-4" />
            Create New Order
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Orders Card */}
        <Card className="hover:border-violet-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Active Orders</span>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {activeOrdersCount}
                </h3>
              </div>
              <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deliveries Due Today Card */}
        <Card className="hover:border-violet-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Due Today</span>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {data?.todaysDeliveriesCount || 0}
                </h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Fabrics Card */}
        <Card className="hover:border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Low Stock Fabric</span>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {data?.lowStockItemsCount || 0}
                </h3>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  (data?.lowStockItemsCount || 0) > 0
                    ? "bg-red-50 text-red-600 animate-bounce"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Balance Collection Card */}
        <Card className="hover:border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Pending Balance</span>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {formatRupee(data?.pendingBalanceAmount)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <IndianRupee className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Deliveries and Low Stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Deliveries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-md font-bold text-gray-800">Today's Deliveries</CardTitle>
            <Badge variant={data?.todaysDeliveriesCount ? "warning" : "secondary"}>
              {data?.todaysDeliveriesCount || 0} Orders
            </Badge>
          </CardHeader>
          <CardContent>
            {data?.todaysDeliveries && data.todaysDeliveries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.todaysDeliveries.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold text-violet-600">
                        <Link href={`/tailor/orders?search=${order.orderNumber}`}>
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-gray-800">{order.customer.name}</TableCell>
                      <TableCell>
                        <Badge variant={order.status.toLowerCase() as any}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {formatRupee(order.balanceDue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-100">
                <Clock className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">No deliveries due today.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Fabrics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-md font-bold text-gray-800">Low Stock Fabrics</CardTitle>
            {data?.lowStockItemsCount && data.lowStockItemsCount > 0 ? (
              <Badge variant="destructive" className="animate-pulse">
                {data.lowStockItemsCount} Alerts
              </Badge>
            ) : (
              <Badge variant="success">All Stock Good</Badge>
            )}
          </CardHeader>
          <CardContent>
            {data?.lowStockItems && data.lowStockItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabric</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Meters Left</TableHead>
                    <TableHead className="text-right">Estimated Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockItems.map((fabric) => (
                    <TableRow key={fabric.id}>
                      <TableCell className="font-semibold text-gray-800">{fabric.fabricName}</TableCell>
                      <TableCell>{fabric.color}</TableCell>
                      <TableCell className="font-bold text-red-600">
                        {fabric.quantityMeters}m
                      </TableCell>
                      <TableCell className="text-right font-semibold text-gray-600">
                        {fabric.prediction?.estimatedOrdersRemaining !== null
                          ? `${fabric.prediction.estimatedOrdersRemaining} orders`
                          : "No orders history"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-100">
                <Layers className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">All fabric stocks are above thresholds.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-md font-bold text-gray-800">Recent Orders</CardTitle>
            <p className="text-xs text-gray-400">Latest orders registered across the tailor CRM.</p>
          </div>
          <Link href="/tailor/orders">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-violet-600 hover:text-violet-700">
              View All Orders
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Garments</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-semibold text-violet-600">
                      <Link href={`/tailor/orders?search=${order.orderNumber}`}>
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-gray-800">
                      {order.customer?.name}
                    </TableCell>
                    <TableCell className="text-gray-600 text-xs">
                      {order.items?.map((it: any) => it.garmentType).join(", ")}
                    </TableCell>
                    <TableCell>
                      {new Date(order.deliveryDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.status.toLowerCase() as any}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupee(order.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      {formatRupee(order.balanceDue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-100">
              <Scissors className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-500">No orders placed yet.</p>
              <Link href="/tailor/orders/new" className="mt-3">
                <Button size="sm" variant="outline">
                  Create First Order
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
