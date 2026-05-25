"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIAnomalyResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Activity, BarChart4, TrendingUp, AlertCircle, Sigma } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Engineering", "Marketing", "Sales", "HR", "Finance",
  "Operations", "Legal", "Design", "Product", "Support",
];

export default function AnomalyDetectionPage() {
  const [dataSource, setDataSource] = useState("");
  const [metric, setMetric] = useState("");
  const [department, setDepartment] = useState("");
  const [sensitivity, setSensitivity] = useState(0.75);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.risk.anomalies({
        data_source: dataSource,
        metric: metric || undefined,
        department: department || undefined,
        sensitivity,
      });
      return data as AIAnomalyResponse;
    },
  });

  const severityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "destructive";
      case "high": return "warning";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Anomaly Detection
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="h-3 w-3" />AI Monitoring
            </Badge>
          </div>
          <CardDescription>Detect unusual patterns in workforce data</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Source *</Label>
                <Input
                  placeholder="e.g. attendance, payroll"
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Metric (optional)</Label>
                <Input
                  placeholder="e.g. overtime, absences"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sensitivity: {sensitivity.toFixed(2)}</Label>
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.50</span>
                  <span>1.00</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!dataSource.trim() || mutation.isPending}>
                <Activity className="h-4 w-4 mr-2" />
                Detect Anomalies
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Anomaly detection failed. Please try again.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutation.reset()}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Alert Level
                </CardTitle>
                <Badge variant={severityBadge(mutation.data.alert_level)} className="text-sm px-3 py-1">
                  {mutation.data.alert_level}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {mutation.data.anomalies.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart4 className="h-4 w-4" />
                  Detected Anomalies
                </CardTitle>
                <CardDescription>{mutation.data.anomalies.length} anomaly(s) found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Timestamp</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Expected</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actual</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Deviation</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutation.data.anomalies.map((anomaly, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 px-3">{anomaly.timestamp}</td>
                          <td className="py-2.5 px-3">{anomaly.expected.toFixed(2)}</td>
                          <td className="py-2.5 px-3 font-medium">{anomaly.actual.toFixed(2)}</td>
                          <td className="py-2.5 px-3">
                            <span className={cn(
                              "font-medium",
                              anomaly.deviation.startsWith("+") ? "text-destructive" : anomaly.deviation.startsWith("-") ? "text-green-500" : ""
                            )}>
                              {anomaly.deviation}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={severityBadge(anomaly.severity)} className="text-xs">{anomaly.severity}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sigma className="h-4 w-4" />
                Baseline Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/50">
                  <CardContent className="pt-4 text-center space-y-1">
                    <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Mean</p>
                    <p className="text-xl font-bold">{mutation.data.baseline.mean.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-4 text-center space-y-1">
                    <BarChart4 className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Std Deviation</p>
                    <p className="text-xl font-bold">{mutation.data.baseline.std.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-4 text-center space-y-1">
                    <Activity className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Period</p>
                    <p className="text-xl font-bold">{mutation.data.baseline.period}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
