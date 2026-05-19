"use client";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { HeadcountChart } from "@/components/charts/headcount-chart";
import { DepartmentChart } from "@/components/charts/department-chart";
import {
  dashboardKpis,
  departmentBreakdown,
  headcountTrend,
} from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Workforce overview and key metrics
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((metric, i) => (
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
        <DepartmentChart data={departmentBreakdown} />
      </div>
    </div>
  );
}
