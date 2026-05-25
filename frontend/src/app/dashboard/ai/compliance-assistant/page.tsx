"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIComplianceResponse } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, XCircle, ChevronRight, Shield,
  FileText, BookOpen, Scale, Gavel
} from "lucide-react";

const departments = [
  "Engineering", "Product", "Design", "Marketing", "Sales",
  "HR", "Finance", "Operations", "Legal", "Support",
];

const roles = [
  "Engineer", "Manager", "Director", "VP", "C-Level",
  "Analyst", "Coordinator", "Specialist", "Associate", "Intern",
];

const regions = [
  "US", "EU", "UK", "APAC", "LATAM", "MEA", "Canada", "Australia",
];

export default function ComplianceAssistantPage() {
  const [action, setAction] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeRole, setEmployeeRole] = useState("");
  const [region, setRegion] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { action: string; department: string; employee_role: string; region?: string }) =>
      aiApi.assistants.compliance(data),
  });

  const result = mutation.data?.data as AIComplianceResponse | undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!action.trim() || !department || !employeeRole) return;
    mutation.mutate({ action, department, employee_role: employeeRole, region: region || undefined });
  };

  const severityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "warning";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Assistant</h1>
        <p className="text-muted-foreground">Regulatory compliance checking for HR actions and policies</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Compliance Check
          </CardTitle>
          <CardDescription>Describe the action or scenario to check for compliance risks</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Action / Scenario</Label>
              <Input
                placeholder="e.g., Terminate employee for repeated late arrivals"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employee Role</Label>
                <Select value={employeeRole} onValueChange={setEmployeeRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Region (optional)</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending || !action.trim() || !department || !employeeRole}>
              {mutation.isPending ? "Checking..." : "Check Compliance"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Checking Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-full" />
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
            <p className="text-sm text-muted-foreground">{(mutation.error as Error)?.message || "Failed to check compliance. Please try again."}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.compliant ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Compliance Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={result.compliant ? "success" : "destructive"} className="text-sm px-3 py-1">
                  {result.compliant ? "Compliant" : "Non-Compliant"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {result.risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Identified Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Severity</th>
                        <th className="pb-2 font-medium">Description</th>
                        <th className="pb-2 font-medium">Mitigation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.risks.map((risk, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{risk.type}</td>
                          <td className="py-2">
                            <Badge variant={severityVariant(risk.severity)}>{risk.severity}</Badge>
                          </td>
                          <td className="py-2 text-muted-foreground">{risk.description}</td>
                          <td className="py-2 text-muted-foreground">{risk.mitigation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {result.required_actions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Required Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.required_actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.policy_references.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Policy References
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.policy_references.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
