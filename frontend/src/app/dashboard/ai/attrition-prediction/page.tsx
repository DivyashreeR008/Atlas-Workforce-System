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
import { AlertTriangle, Send, TrendingDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AttritionPredictionPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [timeframe, setTimeframe] = useState("12");
  const [result, setResult] = useState<AIPredictionResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.predictions.attrition({
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

  const getPredictionVariant = (prediction: string) => {
    switch (prediction.toLowerCase()) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "default";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attrition Prediction</h1>
          <p className="text-muted-foreground">AI-powered employee attrition risk assessment</p>
        </div>
        <Badge variant="secondary" className="gap-1"><TrendingDown className="h-3 w-3" />Attrition AI</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prediction Parameters</CardTitle>
          <CardDescription>Enter employee details or department to analyze</CardDescription>
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
              <Skeleton className="h-8 w-24 rounded-full" />
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
                <AlertTriangle className="h-4 w-4" />Prediction Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant={getPredictionVariant(result.prediction)} className="text-sm px-3 py-1">
                  {result.prediction} Risk
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Probability</span>
                  <span className="font-mono font-medium">{(result.probability * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      result.probability > 0.7 ? "bg-red-500" : result.probability > 0.4 ? "bg-yellow-500" : "bg-green-500"
                    )}
                    style={{ width: `${result.probability * 100}%` }}
                  />
                </div>
              </div>

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
              <CardTitle className="text-base">Risk Factors</CardTitle>
              <CardDescription>Key factors contributing to the prediction</CardDescription>
            </CardHeader>
            <CardContent>
              {result.risk_factors.length > 0 ? (
                <ScrollArea className="max-h-80">
                  <div className="space-y-3">
                    {result.risk_factors.map((factor, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{factor.factor}</span>
                          <span className="font-mono text-muted-foreground">{(factor.weight! * 100).toFixed(0)}% weight</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${factor.weight! * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No detailed risk factors available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
