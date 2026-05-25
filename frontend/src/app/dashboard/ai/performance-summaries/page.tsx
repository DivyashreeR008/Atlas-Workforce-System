"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Star, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";

interface FormData {
  employee_id: string;
  period: string;
  include_metrics: string;
}

interface PerformanceResult {
  overall_score: number;
  trend: "up" | "down" | "neutral";
  summary: string;
  highlights: string[];
  areas_for_improvement: string[];
}

export default function PerformanceSummariesPage() {
  const [form, setForm] = useState<FormData>({
    employee_id: "",
    period: "quarterly",
    include_metrics: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const metrics = form.include_metrics
        ? form.include_metrics.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const { data } = await aiApi.summaries.performance({
        employee_id: form.employee_id,
        period: form.period,
        include_metrics: metrics,
      });
      return data as PerformanceResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance Summaries</h1>
        <p className="text-muted-foreground">
          AI-generated performance review summaries with insights and recommendations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Summary</CardTitle>
          <CardDescription>Enter employee details to generate a performance summary</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input
                  id="employee_id"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  placeholder="e.g. EMP001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => setForm({ ...form, period: v })}
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="include_metrics">Metrics (comma-separated)</Label>
                <Input
                  id="include_metrics"
                  value={form.include_metrics}
                  onChange={(e) => setForm({ ...form, include_metrics: e.target.value })}
                  placeholder="e.g. productivity, quality, attendance"
                />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating..." : "Generate Summary"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(mutation.error as Error)?.message || "Failed to generate performance summary."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Overall Performance</CardTitle>
                <Badge variant="secondary" className="flex items-center gap-1 text-base">
                  <Star className="h-4 w-4 text-amber-500" />
                  {mutation.data.overall_score.toFixed(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Trend:</span>
                <Badge
                  variant={
                    mutation.data.trend === "up"
                      ? "success"
                      : mutation.data.trend === "down"
                        ? "destructive"
                        : "outline"
                  }
                  className="flex items-center gap-1"
                >
                  {trendIcon(mutation.data.trend)}
                  {mutation.data.trend === "up" ? "Improving" : mutation.data.trend === "down" ? "Declining" : "Stable"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{mutation.data.summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mutation.data.highlights.length > 0 ? (
                  <ul className="space-y-2">
                    {mutation.data.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No highlights available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-amber-500" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mutation.data.areas_for_improvement.length > 0 ? (
                  <ul className="space-y-2">
                    {mutation.data.areas_for_improvement.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No areas for improvement identified.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
