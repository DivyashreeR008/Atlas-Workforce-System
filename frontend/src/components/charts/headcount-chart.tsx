"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HeadcountChartProps {
  data: { month: string; count: number }[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-sm text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-primary font-semibold tabular-nums">
        {payload[0].value.toLocaleString()} employees
      </p>
    </div>
  );
};

export function HeadcountChart({ data, loading, error, onRetry }: HeadcountChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Headcount Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-muted-foreground">
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

  const current = data[data.length - 1]?.count ?? 0;
  const previous = data[data.length - 2]?.count ?? 0;
  const change = previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : "0";
  const isUp = current >= previous;

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Headcount Trend</CardTitle>
          <CardDescription className="text-xs">Monthly workforce growth</CardDescription>
        </div>
        <div className={cn("rounded-full px-2 py-0.5 text-xs font-medium", isUp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
          {isUp ? "+" : ""}{change}% vs last month
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="hc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(239 84% 67%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(239 84% 67%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dy={6} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dx={-4} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Area type="monotone" dataKey="count" stroke="hsl(239 84% 67%)" fill="url(#hc)" strokeWidth={2} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

import { cn } from "@/lib/utils";
