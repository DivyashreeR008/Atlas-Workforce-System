"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIRiskResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ShieldAlert, TrendingUp, TrendingDown, AlertTriangle, Gauge, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Engineering", "Marketing", "Sales", "HR", "Finance",
  "Operations", "Legal", "Design", "Product", "Support",
];

export default function RiskDetectionPage() {
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [riskCategories, setRiskCategories] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const categories = riskCategories.split(",").map((s) => s.trim()).filter(Boolean);
      const { data } = await aiApi.risk.detect({
        department: department || undefined,
        employee_id: employeeId || undefined,
        risk_categories: categories.length > 0 ? categories : undefined,
      });
      return data as AIRiskResponse;
    },
  });

  const severityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
      case "high": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      default: return "text-green-500 bg-green-500/10 border-green-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Risk Detection
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3" />AI Risk Analysis
            </Badge>
          </div>
          <CardDescription>Detect and analyze workforce risks across departments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label>Employee ID (optional)</Label>
                <Input
                  placeholder="e.g. EMP-001"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Risk Categories (comma-separated)</Label>
                <Input
                  placeholder="e.g. attrition, performance, compliance"
                  value={riskCategories}
                  onChange={(e) => setRiskCategories(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Detect Risks
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Risk detection failed. Please try again.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutation.reset()}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-4 w-4" />
                  Overall Risk Score
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-3">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-32 h-32 -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle
                      cx="64" cy="64" r="56" fill="none"
                      stroke={mutation.data.overall_risk_score >= 70 ? "hsl(var(--destructive))" : mutation.data.overall_risk_score >= 40 ? "hsl(var(--warning))" : "hsl(var(--success))"}
                      strokeWidth="8"
                      strokeDasharray={`${352 * mutation.data.overall_risk_score / 100} 352`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={cn(
                    "absolute text-3xl font-bold",
                    mutation.data.overall_risk_score >= 70 ? "text-destructive" : mutation.data.overall_risk_score >= 40 ? "text-warning" : "text-success"
                  )}>
                    {mutation.data.overall_risk_score}
                  </span>
                </div>
                <Badge variant={mutation.data.trend === "increasing" ? "destructive" : mutation.data.trend === "decreasing" ? "success" : "secondary"} className="gap-1">
                  {mutation.data.trend === "increasing" ? <TrendingUp className="h-3 w-3" /> : mutation.data.trend === "decreasing" ? <TrendingDown className="h-3 w-3" /> : null}
                  {mutation.data.trend}
                </Badge>
              </CardContent>
            </Card>

            {mutation.data.mitigation_priorities.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" />
                    Mitigation Priorities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {mutation.data.mitigation_priorities.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium mt-0.5 shrink-0">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {mutation.data.risks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Detected Risks
                </CardTitle>
                <CardDescription>{mutation.data.risks.length} risk(s) identified</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Risk</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Severity</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Probability</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Impact</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Affected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutation.data.risks.map((risk, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-xs">{risk.category}</Badge>
                          </td>
                          <td className="py-2.5 px-3 font-medium">{risk.risk}</td>
                          <td className="py-2.5 px-3">
                            <Badge className={cn("text-xs", severityColor(risk.severity))}>{risk.severity}</Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <Progress value={risk.probability * 100} className="h-1.5 w-16" />
                              <span className="text-xs text-muted-foreground">{Math.round(risk.probability * 100)}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">{risk.impact}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span>{risk.affected_employees}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
