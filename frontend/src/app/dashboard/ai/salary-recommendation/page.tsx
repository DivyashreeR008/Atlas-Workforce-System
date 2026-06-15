"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AISalaryResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DollarSign, Send, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SalaryRecommendationPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [performanceScore, setPerformanceScore] = useState("");
  const [location, setLocation] = useState("");
  const [department, setDepartment] = useState("");
  const [result, setResult] = useState<AISalaryResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.salary.recommend({
        employee_id: employeeId,
        role,
        experience_years: parseInt(experienceYears),
        performance_score: performanceScore ? parseInt(performanceScore) : undefined,
        location: location || undefined,
        department: department || undefined,
      });
      return data as AISalaryResponse;
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !role.trim() || !experienceYears.trim() || mutation.isPending) return;
    mutation.mutate();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);

  const getComparisonImpact = (current: number, recommended: number) => {
    const diff = recommended - current;
    const pct = ((diff / current) * 100).toFixed(1);
    if (diff > 0) return { icon: TrendingUp, color: "text-green-600", text: `+${pct}% increase` };
    if (diff < 0) return { icon: TrendingDown, color: "text-red-600", text: `${pct}% decrease` };
    return { icon: Minus, color: "text-muted-foreground", text: "No change" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Recommendation</h1>
          <p className="text-muted-foreground">AI-powered salary benchmarking and recommendations</p>
        </div>
        <Badge variant="secondary" className="gap-1"><DollarSign className="h-3 w-3" />Salary AI</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee & Role Details</CardTitle>
          <CardDescription>Provide the details for salary analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input id="employeeId" placeholder="e.g., EMP-001" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" placeholder="e.g., Senior Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Experience (years)</Label>
                <Input id="experience" type="number" min="0" placeholder="e.g., 5" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="performance">Performance Score (optional)</Label>
                <Input id="performance" type="number" min="0" max="100" placeholder="0-100" value={performanceScore} onChange={(e) => setPerformanceScore(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input id="location" placeholder="e.g., New York, NY" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department (optional)</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Select department</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={!employeeId.trim() || !role.trim() || !experienceYears.trim() || mutation.isPending} className="gap-2">
              {mutation.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Send className="h-4 w-4" />}
              {mutation.isPending ? "Analyzing..." : "Get Recommendation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !mutation.isPending && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Salary Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Salary</p>
                  <p className="text-2xl font-bold">{formatCurrency(result.current_salary)}</p>
                  <Badge variant="outline" className="text-xs">{result.percentile}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Recommended Salary</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(result.recommended_salary)}</p>
                  {(() => {
                    const cmp = getComparisonImpact(result.current_salary, result.recommended_salary);
                    const Icon = cmp.icon;
                    return (
                      <span className={cn("inline-flex items-center gap-1 text-xs", cmp.color)}>
                        <Icon className="h-3 w-3" />{cmp.text}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Market Data</CardTitle>
              <CardDescription>Benchmark percentiles for {result.market_data.role} in {result.market_data.location}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Percentile</th>
                      <th className="px-3 py-2 text-right font-medium">Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-3 py-2">P10</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(result.market_data.p10)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2">P25</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(result.market_data.p25)}</td>
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <td className="px-3 py-2 font-medium">P50 (Median)</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(result.market_data.p50)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2">P75</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(result.market_data.p75)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">P90</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(result.market_data.p90)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {result.factors.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Factors Considered</CardTitle>
                <CardDescription>Key factors influencing the salary recommendation</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-48">
                  <div className="flex flex-wrap gap-2">
                    {result.factors.map((factor, i) => (
                      <Badge key={i} variant="outline" className="gap-1.5 px-3 py-1.5">
                        <span className="font-medium">{factor.name}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{factor.impact}</span>
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
