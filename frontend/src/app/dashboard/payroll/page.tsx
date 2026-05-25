"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastStore } from "@/stores/toast-store";
import { Download, FileSpreadsheet, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv";
import { downloadExcel } from "@/lib/excel";

interface PayrollRecord {
  id: number;
  employeeId: string;
  tenantId: string;
  period: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  tax: number;
  netSalary: number;
  status: string;
  processedDate: string;
}

const statusVariant: Record<
  string,
  "default" | "secondary" | "success" | "warning"
> = {
  DRAFT: "secondary",
  PROCESSING: "warning",
  PROCESSED: "success",
};

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    period: "",
    baseSalary: "",
    allowances: "0",
    deductions: "0",
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => {
      const { data } = await payrollApi.list();
      return (Array.isArray(data) ? data : []) as PayrollRecord[];
    },
  });

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    try {
      await payrollApi.run({
        employeeId: form.employeeId,
        period: form.period,
        baseSalary: parseFloat(form.baseSalary),
        allowances: parseFloat(form.allowances),
        deductions: parseFloat(form.deductions),
      });
      addToast({ title: "Payroll processed successfully" });
      setDialogOpen(false);
      setForm({ employeeId: "", period: "", baseSalary: "", allowances: "0", deductions: "0" });
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
    } catch {
      addToast({ title: "Failed to process payroll", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Payroll runs and processing status</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Run Payroll
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-panel">
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))
        ) : !records || records.length === 0 ? (
          <Card className="glass-panel col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              No payroll records found. Run payroll to get started.
            </CardContent>
          </Card>
        ) : (
          records.slice(-3).reverse().map((run) => (
            <Card key={run.id} className="glass-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{run.period}</CardTitle>
                  <Badge variant={statusVariant[run.status] ?? "default"}>
                    {run.status}
                  </Badge>
                </div>
                <CardDescription>{run.employeeId}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(run.netSalary)}</p>
                <span className="text-sm text-muted-foreground">Net salary</span>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payroll History</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${records?.length ?? 0} payroll records`}
              </CardDescription>
            </div>
            {records && records.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadCSV(
                      "payroll_history",
                      ["Employee", "Period", "Gross", "Tax", "Net", "Status"],
                      records.map((r) => [
                        r.employeeId,
                        r.period,
                        formatCurrency(r.baseSalary + r.allowances),
                        formatCurrency(r.tax),
                        formatCurrency(r.netSalary),
                        r.status,
                      ])
                    );
                    addToast({ title: "Payroll data exported" });
                  }}
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadExcel(
                      "payroll_history",
                      ["Employee", "Period", "Gross", "Tax", "Net", "Status"],
                      records.map((r) => [
                        r.employeeId,
                        r.period,
                        formatCurrency(r.baseSalary + r.allowances),
                        formatCurrency(r.tax),
                        formatCurrency(r.netSalary),
                        r.status,
                      ])
                    );
                    addToast({ title: "Payroll data exported as Excel" });
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Tax</th>
                  <th className="px-4 py-3 font-medium">Net</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3" colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !records || records.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                      No payroll history found
                    </td>
                  </tr>
                ) : (
                  [...records].reverse().map((run) => (
                    <tr key={run.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{run.employeeId}</td>
                      <td className="px-4 py-3">{run.period}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(run.baseSalary + run.allowances)}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(run.tax)}</td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrency(run.netSalary)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[run.status] ?? "default"}>
                          {run.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Run Payroll</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Process payroll for an employee
            </p>
            <form onSubmit={handleRunPayroll} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Input
                  id="period"
                  placeholder="e.g. 2026-05"
                  required
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseSalary">Base Salary</Label>
                <Input
                  id="baseSalary"
                  type="number"
                  step="0.01"
                  required
                  value={form.baseSalary}
                  onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowances">Allowances</Label>
                <Input
                  id="allowances"
                  type="number"
                  step="0.01"
                  value={form.allowances}
                  onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductions">Deductions</Label>
                <Input
                  id="deductions"
                  type="number"
                  step="0.01"
                  value={form.deductions}
                  onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={running}>
                  {running ? "Processing..." : "Run Payroll"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
