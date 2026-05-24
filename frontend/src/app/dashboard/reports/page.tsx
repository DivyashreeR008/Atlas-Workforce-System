"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, employeeApi, payrollApi, leaveApi } from "@/lib/api";
import { FileText, Download, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast-store";

interface ReportGenerator {
  title: string;
  description: string;
  apiCall: () => Promise<unknown>;
  format: (data: unknown) => string;
}

export default function ReportsPage() {
  const addToast = useToastStore((s) => s.toast);
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: deptData } = useQuery({
    queryKey: ["analytics", "department"],
    queryFn: async () => {
      const { data } = await analyticsApi.department();
      return data as Array<{ department: string; count: number }>;
    },
    retry: false,
  });

  const { data: empData } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: async () => {
      const { data } = await employeeApi.list({ page: 1, pageSize: 100 });
      return data as { items: Array<{ name: string; department: string; position: string; email: string }>; total: number };
    },
    retry: false,
  });

  const { data: payrollRecords } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => {
      const { data } = await payrollApi.list();
      return (Array.isArray(data) ? data : []) as Array<{ employeeId: string; period: string; netSalary: number; status: string }>;
    },
    retry: false,
  });

  const reportTypes: ReportGenerator[] = [
    {
      title: "Headcount Report",
      description: "Employee count by department",
      apiCall: () => analyticsApi.department().then((r) => r.data),
      format: (data: unknown) => {
        const rows = data as Array<{ department: string; count: number }>;
        if (!rows?.length) return "No data available";
        const lines = rows.map((r) => `${r.department}: ${r.count}`);
        const total = rows.reduce((s, r) => s + r.count, 0);
        return `=== Headcount Report ===\n\n${lines.join("\n")}\n\nTotal: ${total}`;
      },
    },
    {
      title: "Payroll Summary",
      description: "Payroll disbursement breakdown",
      apiCall: () => analyticsApi.payroll().then((r) => r.data),
      format: (data: unknown) => {
        const rows = data as Array<{ period: string; total_base_salary: number; total_net_salary: number }>;
        if (!rows?.length) return "No payroll data available";
        const lines = rows.map((r) =>
          `${r.period}: Gross $${r.total_base_salary?.toFixed(2) ?? "0.00"}, Net $${r.total_net_salary?.toFixed(2) ?? "0.00"}`
        );
        return `=== Payroll Summary ===\n\n${lines.join("\n")}`;
      },
    },
    {
      title: "Employee Directory",
      description: "Full employee listing with details",
      apiCall: async () => {
        if (empData?.items) return empData.items;
        const { data } = await employeeApi.list({ page: 1, pageSize: 100 });
        return (data as { items: Array<{ name: string; department: string; position: string; email: string }> }).items ?? [];
      },
      format: (data: unknown) => {
        const rows = data as Array<{ name: string; department: string; position: string; email: string }>;
        if (!rows?.length) return "No employees found";
        const lines = rows.map((r) => `${r.name} | ${r.department} | ${r.position} | ${r.email}`);
        return `=== Employee Directory ===\n\nName | Department | Position | Email\n${"-".repeat(60)}\n${lines.join("\n")}\n\nTotal: ${rows.length}`;
      },
    },
    {
      title: "Payroll History",
      description: "All payroll runs by employee",
      apiCall: async () => payrollRecords ?? [],
      format: (data: unknown) => {
        const rows = data as Array<{ employeeId: string; period: string; netSalary: number; status: string }>;
        if (!rows?.length) return "No payroll history available";
        const lines = rows.map((r) =>
          `${r.employeeId} | ${r.period} | $${r.netSalary?.toFixed(2) ?? "0.00"} | ${r.status}`
        );
        return `=== Payroll History ===\n\nEmployee | Period | Net Salary | Status\n${"-".repeat(60)}\n${lines.join("\n")}`;
      },
    },
  ];

  const handleGenerate = async (report: ReportGenerator) => {
    setGenerating(report.title);
    try {
      const data = await report.apiCall();
      const text = report.format(data);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, "_").toLowerCase()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ title: `${report.title} downloaded` });
    } catch {
      addToast({ title: `Failed to generate ${report.title}`, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export workforce reports
        </p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Available Reports</CardTitle>
          <CardDescription>
            Generate reports from live data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {reportTypes.map((report) => (
              <div
                key={report.title}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{report.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.description}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => handleGenerate(report)}
                    disabled={generating === report.title}
                  >
                    {generating === report.title ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
