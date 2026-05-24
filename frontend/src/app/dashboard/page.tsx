"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi, employeeApi } from "@/lib/api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HeadcountChart } from "@/components/charts/headcount-chart";
import { DepartmentChart } from "@/components/charts/department-chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dashboardKpis as fallbackKpis,
  departmentBreakdown,
  headcountTrend,
} from "@/lib/mock-data";
import type { KpiMetric } from "@/types";

export default function DashboardPage() {
  const { data: deptData } = useQuery({
    queryKey: ["analytics", "department"],
    queryFn: async () => {
      const { data } = await analyticsApi.department();
      return data as Array<{ department: string; count: number }>;
    },
    retry: false,
    staleTime: 30000,
  });

  const { data: empData } = useQuery({
    queryKey: ["employees", "page1"],
    queryFn: async () => {
      const { data } = await employeeApi.list({ page: 1, pageSize: 1 });
      return data as { total: number };
    },
    retry: false,
    staleTime: 30000,
  });

  const totalEmployees = deptData
    ? deptData.reduce((sum, d) => sum + d.count, 0)
    : empData?.total ?? fallbackKpis[0].value;

  const kpis: KpiMetric[] = [
    { label: "Total Employees", value: totalEmployees, change: 4.2, trend: "up" },
    { label: "Present Today", value: 0, change: 0, trend: "neutral" },
    { label: "Open Positions", value: 23, change: -12, trend: "down" },
    { label: "Monthly Payroll", value: 0, change: 0, trend: "neutral" },
  ];

  const realDeptBreakdown = deptData
    ? deptData.map((d) => ({ name: d.department, value: d.count }))
    : departmentBreakdown;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Workforce overview and key metrics
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((metric, i) => (
          <KpiCard
            key={metric.label}
            metric={metric}
            index={i}
            isCurrency={metric.label.includes("Payroll")}
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <HeadcountChart data={headcountTrend} />
        {deptData ? (
          <DepartmentChart data={realDeptBreakdown} />
        ) : (
          <div className="rounded-xl border bg-card p-6">
            <Skeleton className="h-[300px] w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
