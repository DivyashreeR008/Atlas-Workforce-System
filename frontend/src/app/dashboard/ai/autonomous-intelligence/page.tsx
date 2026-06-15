"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Brain, TrendingUp, Zap, BarChart3, Lightbulb,
} from "lucide-react";

interface FormData {
  scope: string;
  metrics: string;
  generate_recommendations: boolean;
}

interface Insight {
  type: string;
  description: string;
  confidence: number;
  auto_actionable: boolean;
}

interface Prediction {
  metric: string;
  current: number;
  "30d": number;
  "90d": number;
}

interface AutonomousResult {
  analysis: string;
  insights: Insight[];
  predictions: Prediction[];
  auto_actions: string[];
  dashboard_suggestions: string;
}

export default function AutonomousIntelligencePage() {
  const [form, setForm] = useState<FormData>({
    scope: "organization",
    metrics: "",
    generate_recommendations: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const metrics = form.metrics
        ? form.metrics.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const { data } = await aiApi.autonomous.intelligence({
        scope: form.scope,
        metrics,
        generate_recommendations: form.generate_recommendations,
      });
      return data as AutonomousResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Autonomous Workforce Intelligence</h1>
        <p className="text-muted-foreground">
          Self-learning AI that continuously analyzes workforce data and auto-executes improvements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>Configure the scope and metrics for autonomous intelligence analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) => setForm({ ...form, scope: v })}
                >
                  <SelectTrigger id="scope">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metrics">Metrics (comma-separated)</Label>
                <Input
                  id="metrics"
                  value={form.metrics}
                  onChange={(e) => setForm({ ...form, metrics: e.target.value })}
                  placeholder="e.g. productivity, engagement, attrition"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="generate_recommendations"
                type="checkbox"
                checked={form.generate_recommendations}
                onChange={(e) =>
                  setForm({ ...form, generate_recommendations: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="generate_recommendations" className="text-sm">
                Generate recommendations
              </Label>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Analyzing..." : "Run Analysis"}
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
              {(mutation.error as Error)?.message || "Failed to run analysis."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{mutation.data.analysis}</p>
            </CardContent>
          </Card>

          {mutation.data.insights.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mutation.data.insights.map((insight, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {insight.type}
                      </Badge>
                      {insight.auto_actionable && (
                        <Badge variant="success" className="text-xs">Auto-Actionable</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{insight.description}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Confidence</span>
                        <span>{insight.confidence}%</span>
                      </div>
                      <Progress value={insight.confidence} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {mutation.data.predictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 font-medium">Metric</th>
                        <th className="pb-3 font-medium">Current</th>
                        <th className="pb-3 font-medium">30-Day</th>
                        <th className="pb-3 font-medium">90-Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutation.data.predictions.map((pred) => (
                        <tr key={pred.metric} className="border-b last:border-0">
                          <td className="py-3 font-medium">{pred.metric}</td>
                          <td className="py-3">{pred.current}</td>
                          <td className="py-3">{pred["30d"]}</td>
                          <td className="py-3">{pred["90d"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {mutation.data.auto_actions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Auto Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {mutation.data.auto_actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {mutation.data.dashboard_suggestions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Dashboard Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {mutation.data.dashboard_suggestions}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
