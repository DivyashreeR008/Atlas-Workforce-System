"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { NLReportResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Send, TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NaturalLanguageReportingPage() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [result, setResult] = useState<NLReportResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.reporting.generate({
        query,
        department: department || undefined,
        timeframe: timeframe || undefined,
      });
      return data as NLReportResponse;
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || mutation.isPending) return;
    mutation.mutate();
  };

  const renderTrend = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Natural Language Reporting</h1>
          <p className="text-muted-foreground">Generate workforce reports using natural language queries</p>
        </div>
        <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" />AI Reporting</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Query</CardTitle>
          <CardDescription>Describe the report you want to generate</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query">Query</Label>
              <Textarea
                id="query"
                placeholder="e.g., Show me headcount trends by department for Q1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department (optional)</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department"><SelectValue placeholder="All departments" /></SelectTrigger>
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
                <Label htmlFor="timeframe">Timeframe (optional)</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger id="timeframe"><SelectValue placeholder="Select timeframe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Select timeframe</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="this-quarter">This Quarter</SelectItem>
                    <SelectItem value="last-quarter">Last Quarter</SelectItem>
                    <SelectItem value="this-year">This Year</SelectItem>
                    <SelectItem value="last-year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={!query.trim() || mutation.isPending} className="gap-2">
              {mutation.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Send className="h-4 w-4" />}
              {mutation.isPending ? "Generating..." : "Generate Report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
            <div className="space-y-2 pt-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-5/6" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>{result.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">{result.summary}</p>

            {result.data.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Data</h3>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">Label</th>
                        <th className="px-4 py-2 text-right font-medium">Value</th>
                        <th className="px-4 py-2 text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2">{row.label}</td>
                          <td className="px-4 py-2 text-right font-mono">{row.value}</td>
                          <td className="px-4 py-2 text-right">
                            <span className={cn("inline-flex items-center gap-1 font-mono", row.change > 0 ? "text-green-600" : row.change < 0 ? "text-red-600" : "text-muted-foreground")}>
                              {renderTrend(row.change)}{row.change}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.insights.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />Insights</h3>
                <ScrollArea className="max-h-48">
                  <ul className="space-y-2">
                    {result.insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
