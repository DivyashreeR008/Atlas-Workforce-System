"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { HeadcountChart } from "@/components/charts/headcount-chart";
import { DepartmentChart } from "@/components/charts/department-chart";
import {
  attendanceTrend,
  departmentBreakdown as fallbackDept,
  headcountTrend,
} from "@/lib/mock-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AnalyticsPage() {
  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: ["analytics", "department"],
    queryFn: async () => {
      const { data } = await analyticsApi.department();
      return data as Array<{ department: string; count: number }>;
    },
    retry: false,
    staleTime: 30000,
  });

  const { data: perfData, isLoading: perfLoading } = useQuery({
    queryKey: ["analytics", "performance"],
    queryFn: async () => {
      const { data } = await analyticsApi.performance();
      return data as Record<string, unknown>;
    },
    retry: false,
    staleTime: 60000,
  });

  const realDeptBreakdown = deptData
    ? deptData.map((d) => ({ name: d.department, value: d.count }))
    : fallbackDept;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Workforce trends and department insights
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HeadcountChart data={headcountTrend} />
        {deptLoading ? (
          <div className="rounded-xl border bg-card p-6">
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : (
          <DepartmentChart data={realDeptBreakdown} />
        )}
      </div>

      {perfData && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Performance Insights</CardTitle>
            <CardDescription>AI-powered workforce analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(perfData).map(([key, value]) => (
                <div key={key} className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {typeof value === "number" ? value.toFixed(2) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Weekly Attendance Rate</CardTitle>
          <CardDescription>Average attendance by weekday</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" domain={[85, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, "Rate"]} />
              <Bar dataKey="rate" fill="hsl(239 84% 67%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
