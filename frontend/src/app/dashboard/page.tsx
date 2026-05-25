"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi, employeeApi, attendanceApi } from "@/lib/api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HeadcountChart } from "@/components/charts/headcount-chart";
import { DepartmentChart } from "@/components/charts/department-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  dashboardKpis as fallbackKpis,
  departmentBreakdown,
  headcountTrend,
} from "@/lib/mock-data";
import type { KpiMetric } from "@/types";
import { Users, Clock, Briefcase, DollarSign } from "lucide-react";
import { useMemo } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardPage() {
  const { data: deptData, isLoading: deptLoading } = useQuery({
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

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance", "recent"],
    queryFn: async () => {
      const { data } = await attendanceApi.list();
      return (Array.isArray(data) ? data : []) as Array<{
        employeeId: string;
        date: string;
        clockIn: string;
        clockOut: string | null;
        status: string;
      }>;
    },
    retry: false,
    staleTime: 15000,
  });

  const totalEmployees = deptData
    ? deptData.reduce((sum, d) => sum + d.count, 0)
    : empData?.total ?? fallbackKpis[0].value;

  const presentToday = attendanceData
    ? attendanceData.filter(
        (r) =>
          r.date === new Date().toISOString().slice(0, 10) &&
          r.status === "PRESENT"
      ).length
    : 0;

  const lateToday = attendanceData
    ? attendanceData.filter((r) => r.status === "LATE").length
    : 0;

  const kpis: KpiMetric[] = [
    { label: "Total Employees", value: totalEmployees, change: 4.2, trend: "up" },
    { label: "Present Today", value: presentToday || fallbackKpis[1].value, change: presentToday ? 0 : 1.8, trend: presentToday ? "neutral" : "up" },
    { label: "Late Today", value: lateToday, change: 0, trend: "down" },
    { label: "Open Positions", value: 23, change: -12, trend: "down" },
  ];

  const realDeptBreakdown = deptData
    ? deptData.map((d) => ({ name: d.department, value: d.count }))
    : departmentBreakdown;

  const recentCheckins = useMemo(() => {
    if (!attendanceData) return [];
    return attendanceData
      .filter((r) => r.clockIn)
      .slice(0, 5)
      .map((r) => ({
        id: r.employeeId,
        time: new Date(r.clockIn).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: r.status,
      }));
  }, [attendanceData]);

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Workforce overview and key metrics
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((metric, i) => {
          const icons = [Users, Clock, Clock, Briefcase];
          const Icon = icons[i];
          return (
            <KpiCard
              key={metric.label}
              metric={metric}
              index={i}
              icon={<Icon className="h-4 w-4" />}
            />
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-6 lg:grid-cols-2">
          <HeadcountChart data={headcountTrend} />
          {deptLoading ? (
            <div className="rounded-xl border bg-card p-6">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : (
            <DepartmentChart data={realDeptBreakdown} />
          )}
        </div>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Live Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCheckins.length > 0 ? (
              <div className="space-y-3">
                {recentCheckins.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {c.id.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{c.id}</p>
                      <p className="text-xs text-muted-foreground">{c.time}</p>
                    </div>
                    <Badge
                      variant={
                        c.status === "PRESENT"
                          ? "success"
                          : c.status === "LATE"
                            ? "warning"
                            : "default"
                      }
                      className="shrink-0"
                    >
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Clock className="h-8 w-8" />
                <p className="text-sm">Waiting for check-ins today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </ErrorBoundary>
  );
}
