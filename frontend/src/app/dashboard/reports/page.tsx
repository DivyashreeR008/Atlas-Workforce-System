"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  analyticsApi,
  employeeApi,
  payrollApi,
  leaveApi,
} from "@/lib/api";
import { downloadCSV, downloadJSON } from "@/lib/csv";
import { downloadExcel } from "@/lib/excel";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastStore } from "@/stores/toast-store";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ReportsPage() {
  const addToast = useToastStore((s) => s.toast);
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: ["analytics", "department"],
    queryFn: async () => {
      const { data } = await analyticsApi.department();
      return data as Array<{ department: string; count: number }>;
    },
    retry: false,
  });

  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: async () => {
      const { data } = await employeeApi.list({ page: 1, pageSize: 1000 });
      return data as {
        items: Array<{
          name: string;
          department: string;
          position: string;
          email: string;
        }>;
        total: number;
      };
    },
    retry: false,
  });

  const { data: payrollRecords, isLoading: payrollLoading } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => {
      const { data } = await payrollApi.list();
      return (Array.isArray(data) ? data : []) as Array<{
        employeeId: string;
        period: string;
        baseSalary: number;
        netSalary: number;
        tax: number;
        status: string;
      }>;
    },
    retry: false,
  });

  const { data: leaveRecords, isLoading: leaveLoading } = useQuery({
    queryKey: ["leave"],
    queryFn: async () => {
      const { data } = await leaveApi.list();
      return (Array.isArray(data) ? data : []) as Array<{
        employeeId: string;
        startDate: string;
        endDate: string;
        leaveType: string;
        status: string;
      }>;
    },
    retry: false,
  });

  type ReportConfig = {
    id: string;
    title: string;
    description: string;
    icon: typeof FileText;
    loading: boolean;
    rowCount?: number;
    onDownloadCSV: () => void;
    onDownloadExcel: () => void;
    onDownloadJSON: () => void;
  };

  const reports: ReportConfig[] = [
    {
      id: "headcount",
      title: "Headcount by Department",
      description: "Employee count broken down by department",
      icon: FileSpreadsheet,
      loading: deptLoading,
      rowCount: deptData?.length,
      onDownloadCSV: () => {
        if (!deptData?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadCSV(
          "headcount_by_department",
          ["Department", "Headcount"],
          deptData.map((d) => [d.department, String(d.count)])
        );
        addToast({ title: "Headcount report downloaded" });
      },
      onDownloadExcel: () => {
        if (!deptData?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadExcel(
          "headcount_by_department",
          ["Department", "Headcount"],
          deptData.map((d) => [d.department, String(d.count)])
        );
        addToast({ title: "Headcount report downloaded as Excel" });
      },
      onDownloadJSON: () => {
        if (!deptData?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadJSON("headcount_by_department", deptData);
        addToast({ title: "Headcount report downloaded" });
      },
    },
    {
      id: "employees",
      title: "Employee Directory",
      description: "Full employee listing with contact details",
      icon: FileSpreadsheet,
      loading: empLoading,
      rowCount: empData?.items?.length,
      onDownloadCSV: () => {
        const items = empData?.items;
        if (!items?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadCSV(
          "employee_directory",
          ["Name", "Email", "Department", "Position"],
          items.map((e) => [e.name, e.email, e.department, e.position])
        );
        addToast({ title: "Employee directory downloaded" });
      },
      onDownloadExcel: () => {
        const items = empData?.items;
        if (!items?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadExcel(
          "employee_directory",
          ["Name", "Email", "Department", "Position"],
          items.map((e) => [e.name, e.email, e.department, e.position])
        );
        addToast({ title: "Employee directory downloaded as Excel" });
      },
      onDownloadJSON: () => {
        if (!empData?.items?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadJSON("employee_directory", empData.items);
        addToast({ title: "Employee directory downloaded" });
      },
    },
    {
      id: "payroll",
      title: "Payroll History",
      description: "All payroll runs with net salary details",
      icon: FileSpreadsheet,
      loading: payrollLoading,
      rowCount: payrollRecords?.length,
      onDownloadCSV: () => {
        if (!payrollRecords?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadCSV(
          "payroll_history",
          ["Employee", "Period", "Gross Salary", "Tax", "Net Salary", "Status"],
          payrollRecords.map((r) => [
            r.employeeId,
            r.period,
            formatCurrency(r.baseSalary),
            formatCurrency(r.tax),
            formatCurrency(r.netSalary),
            r.status,
          ])
        );
        addToast({ title: "Payroll history downloaded" });
      },
      onDownloadExcel: () => {
        if (!payrollRecords?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadExcel(
          "payroll_history",
          ["Employee", "Period", "Gross Salary", "Tax", "Net Salary", "Status"],
          payrollRecords.map((r) => [
            r.employeeId,
            r.period,
            formatCurrency(r.baseSalary),
            formatCurrency(r.tax),
            formatCurrency(r.netSalary),
            r.status,
          ])
        );
        addToast({ title: "Payroll history downloaded as Excel" });
      },
      onDownloadJSON: () => {
        if (!payrollRecords?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadJSON("payroll_history", payrollRecords);
        addToast({ title: "Payroll history downloaded" });
      },
    },
    {
      id: "leave",
      title: "Leave Requests",
      description: "All leave requests with status",
      icon: FileSpreadsheet,
      loading: leaveLoading,
      rowCount: leaveRecords?.length,
      onDownloadCSV: () => {
        if (!leaveRecords?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadCSV(
          "leave_requests",
          ["Employee", "Type", "Start Date", "End Date", "Status"],
          leaveRecords.map((r) => [
            r.employeeId,
            r.leaveType,
            formatDate(r.startDate),
            formatDate(r.endDate),
            r.status,
          ])
        );
        addToast({ title: "Leave report downloaded" });
      },
      onDownloadExcel: () => {
        if (!leaveRecords?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadExcel(
          "leave_requests",
          ["Employee", "Type", "Start Date", "End Date", "Status"],
          leaveRecords.map((r) => [
            r.employeeId,
            r.leaveType,
            formatDate(r.startDate),
            formatDate(r.endDate),
            r.status,
          ])
        );
        addToast({ title: "Leave report downloaded as Excel" });
      },
      onDownloadJSON: () => {
        if (!leaveRecords?.length) {
          addToast({ title: "No data to export", variant: "destructive" });
          return;
        }
        downloadJSON("leave_requests", leaveRecords);
        addToast({ title: "Leave report downloaded" });
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export workforce reports in CSV, Excel, or JSON
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id} className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <report.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                  </div>
                </div>
                {!report.loading && report.rowCount !== undefined && (
                  <Badge variant="secondary">{report.rowCount} rows</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {report.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGenerating(`csv-${report.id}`);
                      report.onDownloadCSV();
                      setGenerating(null);
                    }}
                    disabled={generating === `csv-${report.id}`}
                  >
                    {generating === `csv-${report.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGenerating(`xlsx-${report.id}`);
                      report.onDownloadExcel();
                      setGenerating(null);
                    }}
                    disabled={generating === `xlsx-${report.id}`}
                  >
                    {generating === `xlsx-${report.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGenerating(`json-${report.id}`);
                      report.onDownloadJSON();
                      setGenerating(null);
                    }}
                    disabled={generating === `json-${report.id}`}
                  >
                    {generating === `json-${report.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    JSON
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
