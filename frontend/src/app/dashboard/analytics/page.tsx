"use client";

import { HeadcountChart } from "@/components/charts/headcount-chart";
import { DepartmentChart } from "@/components/charts/department-chart";
import {
  attendanceTrend,
  departmentBreakdown,
  headcountTrend,
} from "@/lib/mock-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <DepartmentChart data={departmentBreakdown} />
      </div>

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
