"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkforceGrowthChartProps {
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
      <p className="font-semibold tabular-nums">{payload[0].value.toLocaleString()} employees</p>
    </div>
  );
};

export function WorkforceGrowthChart({ data, loading, error, onRetry }: WorkforceGrowthChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
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
          <CardTitle className="text-sm font-medium">Workforce Growth</CardTitle>
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

  const startCount = data[0]?.count ?? 0;
  const endCount = data[data.length - 1]?.count ?? 0;
  const totalGrowth = startCount > 0 ? ((endCount - startCount) / startCount * 100).toFixed(1) : "0";

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Workforce Growth</CardTitle>
          <CardDescription className="text-xs">{totalGrowth}% growth this year</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={6} interval={1} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dx={-4} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="count" fill="hsl(271 81% 56%)" radius={[2, 2, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
