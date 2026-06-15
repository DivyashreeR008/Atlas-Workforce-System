"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  DollarSign, TrendingUp, AlertTriangle, Lightbulb,
} from "lucide-react";

interface FormData {
  department: string;
  current_budget: number;
  forecast_months: number;
}

interface MonthlyProjection {
  month: string;
  budgeted: number;
  projected: number;
  remaining: number;
}

interface VarianceAnalysis {
  budgeted_total: number;
  projected_total: number;
  variance: number;
  variance_pct: number;
}

interface ForecastResult {
  total_forecast: number;
  monthly_projections: MonthlyProjection[];
  variance_analysis: VarianceAnalysis;
  recommendations: string[];
}

export default function BudgetForecastingPage() {
  const [form, setForm] = useState<FormData>({
    department: "",
    current_budget: 0,
    forecast_months: 3,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.forecasting.budget(form);
      return data as ForecastResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget Forecasting</h1>
        <p className="text-muted-foreground">
          AI-powered budget predictions based on historical data and trends
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast Parameters</CardTitle>
          <CardDescription>Enter department details to generate budget forecast</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Engineering"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_budget">Current Budget ($)</Label>
                <Input
                  id="current_budget"
                  type="number"
                  min={0}
                  value={form.current_budget || ""}
                  onChange={(e) => setForm({ ...form, current_budget: Number(e.target.value) })}
                  placeholder="e.g. 500000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forecast_months">Forecast Months</Label>
                <Input
                  id="forecast_months"
                  type="number"
                  min={1}
                  max={24}
                  value={form.forecast_months}
                  onChange={(e) => setForm({ ...form, forecast_months: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating..." : "Generate Forecast"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
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
              {(mutation.error as Error)?.message || "Failed to generate budget forecast. Please try again."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Forecast</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(mutation.data.total_forecast)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Budgeted Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(mutation.data.variance_analysis.budgeted_total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Projected Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(mutation.data.variance_analysis.projected_total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Variance</CardTitle>
                <Badge variant={mutation.data.variance_analysis.variance >= 0 ? "success" : "destructive"}>
                  {mutation.data.variance_analysis.variance_pct.toFixed(1)}%
                </Badge>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", mutation.data.variance_analysis.variance >= 0 ? "text-emerald-600" : "text-destructive")}>
                  {formatCurrency(mutation.data.variance_analysis.variance)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Projections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Month</th>
                      <th className="pb-3 font-medium">Budgeted</th>
                      <th className="pb-3 font-medium">Projected</th>
                      <th className="pb-3 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mutation.data.monthly_projections.map((row) => (
                      <tr key={row.month} className="border-b last:border-0">
                        <td className="py-3 font-medium">{row.month}</td>
                        <td className="py-3">{formatCurrency(row.budgeted)}</td>
                        <td className="py-3">{formatCurrency(row.projected)}</td>
                        <td className="py-3">
                          <span className={cn(row.remaining >= 0 ? "text-emerald-600" : "text-destructive")}>
                            {formatCurrency(row.remaining)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {mutation.data.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {mutation.data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {rec}
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
