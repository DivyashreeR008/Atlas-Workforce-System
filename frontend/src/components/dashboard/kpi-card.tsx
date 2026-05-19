"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { KpiMetric } from "@/types";

interface KpiCardProps {
  metric: KpiMetric;
  isCurrency?: boolean;
  index?: number;
}

export function KpiCard({ metric, isCurrency, index = 0 }: KpiCardProps) {
  const display = isCurrency
    ? formatCurrency(metric.value)
    : metric.value.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {metric.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tracking-tight">{display}</p>
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              metric.trend === "up" && "text-emerald-600 dark:text-emerald-400",
              metric.trend === "down" && "text-red-600 dark:text-red-400",
              metric.trend === "neutral" && "text-muted-foreground"
            )}
          >
            {metric.trend === "up" && <TrendingUp className="h-3 w-3" />}
            {metric.trend === "down" && <TrendingDown className="h-3 w-3" />}
            {metric.change > 0 ? "+" : ""}
            {metric.change}% vs last month
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
