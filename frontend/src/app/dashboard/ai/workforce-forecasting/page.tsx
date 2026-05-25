"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIForecastResponse } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, Minus, Users, Calendar, Brain, AlertTriangle,
  BarChart3, ChevronRight, Lightbulb
} from "lucide-react";

const departments = [
  "Engineering", "Product", "Design", "Marketing", "Sales",
  "HR", "Finance", "Operations", "Legal", "Support",
];

export default function WorkforceForecastingPage() {
  const [department, setDepartment] = useState("");
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [includeAttrition, setIncludeAttrition] = useState(true);
  const [includeHiring, setIncludeHiring] = useState(true);

  const mutation = useMutation({
    mutationFn: (data: { department?: string; horizon_months?: number; include_attrition?: boolean; include_hiring?: boolean }) =>
      aiApi.forecasting.workforce(data),
  });

  const result = mutation.data?.data as AIForecastResponse | undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      department: department || undefined,
      horizon_months: horizonMonths,
      include_attrition: includeAttrition,
      include_hiring: includeHiring,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workforce Forecasting</h1>
        <p className="text-muted-foreground">AI-powered workforce demand projections and headcount forecasting</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast Parameters</CardTitle>
          <CardDescription>Configure workforce forecasting inputs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horizon (months)</Label>
                <Input type="number" min={1} max={60} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeAttrition} onChange={(e) => setIncludeAttrition(e.target.checked)} className="rounded" />
                Include Attrition
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeHiring} onChange={(e) => setIncludeHiring(e.target.checked)} className="rounded" />
                Include Hiring
              </label>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating..." : "Generate Forecast"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Generating Forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{(mutation.error as Error)?.message || "Failed to generate forecast. Please try again."}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Forecast Results</h2>
            <Badge variant={result.confidence >= 80 ? "success" : result.confidence >= 60 ? "warning" : "destructive"}>
              {result.confidence}% Confidence
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.forecasts.map((f, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{f.metric}</p>
                    {f.change_pct > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : f.change_pct < 0 ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-1">{f.projected}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>Current: {f.current}</span>
                    <Badge variant={f.change_pct > 0 ? "success" : f.change_pct < 0 ? "destructive" : "secondary"}>
                      {f.change_pct > 0 ? "+" : ""}{f.change_pct}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Headcount Projection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Month</th>
                      <th className="pb-2 font-medium">Headcount</th>
                      <th className="pb-2 font-medium">Hires</th>
                      <th className="pb-2 font-medium">Attrition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.total_headcount_projection.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2">{row.month}</td>
                        <td className="py-2 font-medium">{row.headcount}</td>
                        <td className="py-2 text-green-600">{row.hires}</td>
                        <td className="py-2 text-red-600">{row.attrition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {result.key_insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.key_insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
