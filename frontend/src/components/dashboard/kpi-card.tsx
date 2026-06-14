"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import type { KpiMetric } from "@/types";
import type { ReactNode } from "react";

interface KpiCardProps {
  metric?: KpiMetric;
  isCurrency?: boolean;
  index?: number;
  icon?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  subtitle?: string;
}

function KpiCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCardError({ onRetry, label }: { onRetry?: () => void; label?: string }) {
  return (
    <Card className="overflow-hidden border-destructive/20 bg-destructive/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label ?? "Metric"}</p>
            <p className="text-sm text-muted-foreground">Failed to load</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiCard({ metric, isCurrency, icon, index = 0, loading, error, onRetry, subtitle }: KpiCardProps) {
  if (loading) return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}><KpiCardSkeleton /></motion.div>;
  if (error || !metric) return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}><KpiCardError onRetry={onRetry} label={metric?.label} /></motion.div>;

  const display = isCurrency
    ? formatCurrency(metric.value)
    : metric.value.toLocaleString();

  const trendColor =
    metric.trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : metric.trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  const trendBg =
    metric.trend === "up"
      ? "bg-emerald-500/10"
      : metric.trend === "down"
        ? "bg-red-500/10"
        : "bg-muted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20 group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                {metric.label}
              </p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {display}
              </p>
              <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", trendBg, trendColor)}>
                {metric.trend === "up" && <TrendingUp className="h-3 w-3 shrink-0" />}
                {metric.trend === "down" && <TrendingDown className="h-3 w-3 shrink-0" />}
                {metric.trend === "neutral" && <Minus className="h-3 w-3 shrink-0" />}
                <span>{metric.change >= 0 ? "+" : ""}{metric.change}%</span>
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {icon && (
              <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                {icon}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export { KpiCardSkeleton, KpiCardError };
