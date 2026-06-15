"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIPredictionResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUp, Send, Target, ListChecks, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PromotionPredictionPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [timeframe, setTimeframe] = useState("12");
  const [result, setResult] = useState<AIPredictionResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.predictions.promotion({
        employee_id: employeeId || undefined,
        department: department || undefined,
        timeframe_months: parseInt(timeframe),
      });
      return data as AIPredictionResponse;
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotion Prediction</h1>
          <p className="text-muted-foreground">AI-powered employee promotion readiness assessment</p>
        </div>
        <Badge variant="secondary" className="gap-1"><ArrowUp className="h-3 w-3" />Promotion AI</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prediction Parameters</CardTitle>
          <CardDescription>Enter employee details to analyze promotion readiness</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID (optional)</Label>
                <Input
                  id="employeeId"
                  placeholder="e.g., EMP-001"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department (optional)</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All departments</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timeframe (months)</Label>
                <div className="flex items-center gap-3 pt-2">
                  <Input
                    type="range"
                    min="3"
                    max="24"
                    step="3"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-8 text-right">{timeframe}m</span>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Send className="h-4 w-4" />}
              {mutation.isPending ? "Predicting..." : "Run Prediction"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="space-y-2 pt-2">
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
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />Readiness Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant={result.prediction === "Ready" || result.prediction === "High" ? "default" : result.prediction === "Moderate" ? "secondary" : "destructive"}
                  className="text-sm px-3 py-1"
                >
                  {result.prediction}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Readiness Score</span>
                  <span className="font-mono font-medium">{(result.probability * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      result.probability > 0.7 ? "bg-green-500" : result.probability > 0.4 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${result.probability * 100}%` }}
                  />
                </div>
              </div>

              {result.suggested_roles && result.suggested_roles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Briefcase className="h-4 w-4" />Suggested Roles</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.suggested_roles.map((role, i) => (
                      <Badge key={i} variant="outline">{role}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ListChecks className="h-4 w-4" />Recommendations</h3>
                  <ScrollArea className="max-h-48">
                    <ul className="space-y-1.5">
                      {result.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contributing Factors</CardTitle>
              <CardDescription>Key factors influencing promotion readiness</CardDescription>
            </CardHeader>
            <CardContent>
              {result.factors && result.factors.length > 0 ? (
                <ScrollArea className="max-h-80">
                  <div className="space-y-3">
                    {result.factors.map((factor, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{factor.factor}</span>
                          <span className="font-mono text-muted-foreground">{factor.weight}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${factor.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : result.risk_factors.length > 0 ? (
                <ScrollArea className="max-h-80">
                  <div className="space-y-3">
                    {result.risk_factors.map((factor, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{factor.factor}</span>
                          {factor.weight !== undefined && (
                            <span className="font-mono text-muted-foreground">{(factor.weight * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No detailed factors available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
