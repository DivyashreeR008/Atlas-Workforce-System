"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HiringPipelineChartProps {
  data: { stage: string; count: number }[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const COLORS = [
  "hsl(190 90% 50%)",
  "hsl(239 84% 67%)",
  "hsl(271 81% 56%)",
  "hsl(35 92% 65%)",
  "hsl(160 84% 39%)",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-sm text-sm">
      <p className="font-medium">{label}</p>
      <p className="font-semibold tabular-nums">{payload[0].value.toLocaleString()} candidates</p>
    </div>
  );
};

export function HiringPipelineChart({ data, loading, error, onRetry }: HiringPipelineChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
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
          <CardTitle className="text-sm font-medium">Hiring Pipeline</CardTitle>
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

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Hiring Pipeline</CardTitle>
          <CardDescription className="text-xs">Candidate funnel by stage</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dy={6} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dx={-4} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
