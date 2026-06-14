"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AttendanceChartProps {
  data: { day: string; rate: number }[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-sm text-sm">
      <p className="font-medium">{label}</p>
      <p className="font-semibold tabular-nums">{payload[0].value}% attendance</p>
    </div>
  );
};

export function AttendanceChart({ data, loading, error, onRetry }: AttendanceChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Attendance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">Failed to load chart data</p>
            {onRetry && (
              <button onClick={onRetry} className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                Retry
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const avg = data.length > 0 ? (data.reduce((s, d) => s + d.rate, 0) / data.length).toFixed(1) : "0";

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Attendance Trend</CardTitle>
          <CardDescription className="text-xs">Avg {avg}% this week</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dy={6} />
            <YAxis domain={[85, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dx={-4} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Line type="monotone" dataKey="rate" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(160 84% 39%)", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
