"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Shield,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Download,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { complianceApi } from "@/lib/api";
import type { CompliancePolicy, ComplianceViolation, AuditLogEntry } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const severityColors: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
};

const policyStatusColors: Record<string, "success" | "destructive" | "warning"> = {
  compliant: "success",
  "non-compliant": "destructive",
  "at-risk": "warning",
};

const frameworkBadges = [
  { key: "SOC2", label: "SOC 2", color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  { key: "GDPR", label: "GDPR", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  { key: "ISO27001", label: "ISO 27001", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  { key: "HIPAA", label: "HIPAA", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  { key: "PCI-DSS", label: "PCI DSS", color: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
];

export default function CompliancePage() {
  const [auditSearch, setAuditSearch] = useState("");

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["compliance-dashboard"],
    queryFn: async () => {
      const { data } = await complianceApi.dashboard();
      return data as {
        score: number;
        totalPolicies: number;
        openViolations: number;
        resolvedThisMonth: number;
        violationsBySeverity: { severity: string; count: number }[];
      };
    },
  });

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ["compliance-policies"],
    queryFn: async () => {
      const { data } = await complianceApi.policies.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as CompliancePolicy[];
    },
  });

  const { data: violations, isLoading: violationsLoading } = useQuery({
    queryKey: ["compliance-violations"],
    queryFn: async () => {
      const { data } = await complianceApi.violations.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as ComplianceViolation[];
    },
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["compliance-audit-logs"],
    queryFn: async () => {
      const { data } = await complianceApi.auditLogs.list({ page: 1, pageSize: 10 });
      return (Array.isArray(data) ? data : data?.items ?? []) as AuditLogEntry[];
    },
  });

  const { data: readinessData } = useQuery({
    queryKey: ["compliance-readiness"],
    queryFn: async () => {
      const { data } = await complianceApi.readiness();
      return data as { framework: string; score: number; status: string }[];
    },
  });

  const score = dashData?.score ?? 87;
  const scoreColor = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-rose-500";
  const scoreStroke = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";

  const severityData = dashData?.violationsBySeverity ?? [
    { severity: "critical", count: 2 },
    { severity: "high", count: 5 },
    { severity: "medium", count: 12 },
    { severity: "low", count: 24 },
  ];

  const maxSeverity = Math.max(...severityData.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance & Audit</h1>
        <p className="text-muted-foreground">
          Policy management, violation tracking, and audit readiness
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="glass-panel lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {dashLoading ? (
              <Skeleton className="h-32 w-32 rounded-full" />
            ) : (
              <>
                <div className="relative mb-4 flex h-36 w-36 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60" cy="60" r="52"
                      fill="none" stroke="hsl(var(--muted))"
                      strokeWidth="8"
                    />
                    <circle
                      cx="60" cy="60" r="52"
                      fill="none" stroke={scoreStroke}
                      strokeWidth="8"
                      strokeDasharray={`${(score / 100) * 326.73} 326.73`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className={`text-3xl font-bold ${scoreColor}`}>{score}%</span>
                    <span className="text-xs text-muted-foreground">overall</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {dashData?.resolvedThisMonth ?? 8} resolved this month
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Open Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {severityData.map((s) => {
                  const pct = (s.count / maxSeverity) * 100;
                  return (
                    <div key={s.severity} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 capitalize">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              s.severity === "critical" && "bg-rose-500",
                              s.severity === "high" && "bg-orange-500",
                              s.severity === "medium" && "bg-amber-500",
                              s.severity === "low" && "bg-sky-500"
                            )}
                          />
                          {s.severity}
                        </span>
                        <span className="font-medium">{s.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            s.severity === "critical" && "bg-rose-500",
                            s.severity === "high" && "bg-orange-500",
                            s.severity === "medium" && "bg-amber-500",
                            s.severity === "low" && "bg-sky-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Framework Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!readinessData ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(readinessData.length > 0 ? readinessData : [
                  { framework: "SOC2", score: 92, status: "compliant" },
                  { framework: "GDPR", score: 78, status: "at-risk" },
                  { framework: "ISO27001", score: 85, status: "compliant" },
                ]).map((fw) => {
                  const badge = frameworkBadges.find((b) => b.key === fw.framework);
                  return (
                    <div key={fw.framework} className="flex items-center gap-3 rounded-lg border p-3">
                      <Badge className={cn("border-0", badge?.color)}>
                        {badge?.label ?? fw.framework}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Readiness</span>
                          <span className="font-medium">{fw.score}%</span>
                        </div>
                        <Progress value={fw.score} className="mt-1" />
                      </div>
                      <Badge variant={fw.status === "compliant" ? "success" : fw.status === "at-risk" ? "warning" : "destructive"}>
                        {fw.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policiesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))
            ) : !policies || policies.length === 0 ? (
              <Card className="glass-panel sm:col-span-2 lg:col-span-3">
                <CardContent className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p className="text-sm">No policies defined</p>
                </CardContent>
              </Card>
            ) : (
              policies.map((policy) => {
                const badge = frameworkBadges.find((b) => b.key === policy.framework);
                return (
                  <Card key={policy.id} className="glass-panel">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-medium">{policy.name}</CardTitle>
                          <CardDescription className="text-xs">{policy.framework}</CardDescription>
                        </div>
                        <Badge variant={policyStatusColors[policy.status] ?? "default"}>
                          {policy.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Badge className={cn("border-0", badge?.color)}>
                        {badge?.label ?? policy.framework}
                      </Badge>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{policy.description}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>v{policy.version}</span>
                        <span>Next review: {new Date(policy.nextReview).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Violations Tracker</CardTitle>
              <CardDescription>Security and compliance incidents</CardDescription>
            </CardHeader>
            <CardContent>
              {violationsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !violations || violations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm">No violations found. All clear!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {violations.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{v.policyName}</span>
                          <Badge className={cn("border", severityColors[v.severity])}>
                            {v.severity}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {v.description} &middot; {v.affectedEntity}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant={
                            v.status === "open"
                              ? "destructive"
                              : v.status === "investigating"
                                ? "warning"
                                : v.status === "mitigated"
                                  ? "secondary"
                                  : "success"
                          }
                        >
                          {v.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.reportedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Audit Trail</CardTitle>
                  <CardDescription>System activity and access logs</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="h-8 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p className="text-sm">No audit log entries yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {(auditSearch
                    ? auditLogs.filter(
                        (l) =>
                          l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          l.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          l.resource.toLowerCase().includes(auditSearch.toLowerCase())
                      )
                    : auditLogs
                  ).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{log.actor}</span>
                        <span className="text-muted-foreground">
                          {" "}{log.action}{" "}
                        </span>
                        <span className="font-medium">{log.resource}</span>
                        <p className="text-xs text-muted-foreground">{log.details}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
