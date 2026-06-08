"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/components/ui/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { formatRupee } from "@/lib/utils";
import {
  Briefcase,
  Calendar,
  IndianRupee,
  History,
  CheckCircle,
  AlertCircle,
  Plus,
  PlusCircle,
  Trash,
} from "lucide-react";

export default function EmployeesPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [salaryStatuses, setSalaryStatuses] = useState<Record<string, boolean>>({});

  // Employee creation states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("SALESPERSON");
  const [newSalary, setNewSalary] = useState("");
  const [newJoinDate, setNewJoinDate] = useState("");

  // Pay Salary Dialog States
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payingEmployee, setPayingEmployee] = useState<any | null>(null);
  const [payMonth, setPayMonth] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("BANK");
  const [payNotes, setPayNotes] = useState("");

  // History Modal States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<any | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  useEffect(() => {
    loadEmployees();
  }, [tenantId]);

  async function loadEmployees() {
    try {
      setLoading(true);
      const res = await fetch(`/api/shoes/employees?limit=100`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load staff directory");
      const json = await res.json();
      setEmployees(json.data || []);
      
      // Load payment status for each employee for this month
      const statuses: Record<string, boolean> = {};
      for (const emp of json.data || []) {
        const historyRes = await fetch(`/api/shoes/employees/${emp.id}/salary`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (historyRes.ok) {
          const payments = await historyRes.json();
          const paidThisMonth = payments.some((p: any) => p.month === currentMonth);
          statuses[emp.id] = paidThisMonth;
        }
      }
      setSalaryStatuses(statuses);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // Create Staff Member
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone || !newSalary || !newJoinDate) {
      toast("All employee details are required", "error");
      return;
    }

    try {
      const res = await fetch("/api/shoes/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          role: newRole,
          salaryAmount: parseFloat(newSalary),
          joinDate: new Date(newJoinDate).toISOString(),
          isActive: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to register employee");
      
      toast("Employee registered successfully", "success");
      setIsCreateOpen(false);
      setNewName("");
      setNewPhone("");
      setNewSalary("");
      setNewJoinDate("");
      loadEmployees();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Open Pay Salary Dialog
  const openPaySalary = (emp: any) => {
    setPayingEmployee(emp);
    setPayMonth(currentMonth);
    setPayAmount(emp.salaryAmount.toString());
    setPayMode("BANK");
    setPayNotes("");
    setIsPayOpen(true);
  };

  // Submit Salary Payment
  const handlePaySalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingEmployee || !payAmount || !payMonth) return;

    try {
      const res = await fetch(`/api/shoes/employees/${payingEmployee.id}/salary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          month: payMonth,
          amountPaid: parseFloat(payAmount),
          paymentDate: new Date().toISOString(),
          paymentMode: payMode,
          notes: payNotes || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Salary record creation failed");
      }

      toast(`Salary for ${payMonth} paid to ${payingEmployee.name}`, "success");
      setIsPayOpen(false);
      loadEmployees();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  // Open Salary History Modal
  const openSalaryHistory = async (emp: any) => {
    setHistoryEmployee(emp);
    try {
      setLoadingHistory(true);
      setIsHistoryOpen(true);
      const res = await fetch(`/api/shoes/employees/${emp.id}/salary`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to fetch salary history");
      const history = await res.json();
      setSalaryHistory(history);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Are you sure you want to remove this employee? This will also delete their salary history.")) return;
    try {
      const res = await fetch(`/api/shoes/employees/${id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to delete employee");
      toast("Employee profile removed", "success");
      loadEmployees();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-600" /> Shop Staff Directory
          </h2>
          <p className="text-sm text-gray-500">Record payments and manage staff credentials.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Staff Grid list */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-200/60 rounded-xl" />
          ))}
        </div>
      ) : employees.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((emp) => {
            const isPaid = salaryStatuses[emp.id];
            return (
              <Card key={emp.id} className="hover:border-indigo-150 transition-all flex flex-col justify-between">
                <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100 flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-indigo-750 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5">
                      {emp.role}
                    </span>
                    <h3 className="font-bold text-gray-950 mt-2 leading-tight">{emp.name}</h3>
                    <p className="text-xs text-gray-400 font-medium">{emp.phone}</p>
                  </div>
                  
                  {isPaid ? (
                    <Badge variant="success" className="gap-1 px-2.5 py-0.5">
                      <CheckCircle className="h-3 w-3" /> Paid
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1 px-2.5 py-0.5 animate-pulse">
                      <AlertCircle className="h-3 w-3" /> Unpaid
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-600">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Salary</span>
                      <p className="font-bold text-gray-900 text-sm">{formatRupee(emp.salaryAmount)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Joined</span>
                      <p className="font-bold text-gray-800 text-sm">
                        {new Date(emp.joinDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                    <Button
                      onClick={() => openPaySalary(emp)}
                      disabled={isPaid}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-3"
                    >
                      Pay Salary
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 text-gray-650"
                      onClick={() => openSalaryHistory(emp)}
                      title="Salary History"
                    >
                      <History className="h-4.5 w-4.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-500 hover:bg-red-50"
                      onClick={() => handleDeleteEmployee(emp.id)}
                      title="Remove Staff Member"
                    >
                      <Trash className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 border border-dashed border-gray-150 rounded-2xl animate-fade-in">
          <Briefcase className="h-10 w-10 text-gray-300 mb-2" />
          <h3 className="font-bold text-md text-gray-700">No staff registered</h3>
          <p className="text-sm text-gray-450 mt-1">Add employee files to track salaries and served-by checkout sales.</p>
          <Button onClick={() => setIsCreateOpen(true)} className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700">
            Add Staff Member
          </Button>
        </div>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Employee Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Full Name</label>
              <Input
                placeholder="e.g. David Staff"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Phone Number</label>
              <Input
                placeholder="e.g. 555-2233"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Role</label>
                <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="MANAGER">Manager</option>
                  <option value="SALESPERSON">Salesperson</option>
                  <option value="HELPER">Helper</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Monthly Salary (₹)</label>
                <Input
                  type="number"
                  placeholder="25000"
                  value={newSalary}
                  onChange={(e) => setNewSalary(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Join Date</label>
              <Input
                type="date"
                value={newJoinDate}
                onChange={(e) => setNewJoinDate(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                Register Profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay Salary Dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Salary Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaySalarySubmit} className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-xs font-semibold text-indigo-800">
              Staff: <span className="font-bold text-indigo-950">{payingEmployee?.name}</span> • Base Salary:{" "}
              <strong className="text-sm">{formatRupee(payingEmployee?.salaryAmount)}</strong>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Salary Month</label>
                <Input
                  placeholder="YYYY-MM (e.g. 2026-06)"
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Amount Paid (₹)</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Payment Mode</label>
              <Select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Notes / Tx ID</label>
              <Input
                placeholder="Optional payment notes..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <Button type="button" variant="ghost" onClick={() => setIsPayOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                Submit Salary
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Salary History Modal */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Salary Ledger — {historyEmployee?.name}</DialogTitle>
          </DialogHeader>

          {loadingHistory ? (
            <div className="py-12 text-center text-gray-400 text-sm animate-pulse">
              Loading payment history...
            </div>
          ) : salaryHistory.length > 0 ? (
            <div className="max-h-[50vh] overflow-y-auto pr-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryHistory.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-bold">{rec.month}</TableCell>
                      <TableCell>
                        {new Date(rec.paymentDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rec.paymentMode}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {formatRupee(rec.amountPaid)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm font-semibold">
              No salary payments registered for this employee.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
            <Button variant="ghost" onClick={() => setIsHistoryOpen(false)}>
              Close History
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
