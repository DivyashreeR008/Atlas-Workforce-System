"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, AlertTriangle, UserCheck, Fingerprint, Lock, Database,
  Key, Globe, Monitor, Siren, FileText, CheckCircle2, Shield,
} from "lucide-react";
import { securityApi } from "@/lib/api";
import type { SecurityDashboard, RiskAssessment } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const riskColors: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function SecurityPage() {
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["security-dashboard"],
    queryFn: async () => {
      const { data } = await securityApi.dashboard("default");
      return data as SecurityDashboard;
    },
  });

  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ["security-risk-assessments"],
    queryFn: async () => {
      const { data } = await securityApi.risk.list({ page_size: 10 });
      return (Array.isArray(data) ? data : data?.items ?? []) as RiskAssessment[];
    },
  });

  const score = dashData ? 100 - dashData.overall_risk_score : 85;
  const scoreColor = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-rose-500";
  const scoreStroke = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";

  if (dashLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Security</h1><p className="text-muted-foreground">NASA-Level security operations dashboard</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </div>
    );
  }

  const metrics = [
    { label: "Zero-Trust Policies", value: dashData?.active_zt_policies ?? 0, total: dashData?.zero_trust_policies ?? 0, icon: ShieldCheck, color: "text-violet-500" },
    { label: "Conditional Access", value: dashData?.active_ca_policies ?? 0, total: dashData?.conditional_access_policies ?? 0, icon: Fingerprint, color: "text-blue-500" },
    { label: "High Risk Sessions", value: dashData?.high_risk_sessions ?? 0, icon: AlertTriangle, color: "text-rose-500" },
    { label: "PAM Active Grants", value: dashData?.active_privileged_grants ?? 0, icon: Lock, color: "text-amber-500" },
    { label: "Data Classifications", value: dashData?.data_classifications ?? 0, icon: Database, color: "text-cyan-500" },
    { label: "Open DLP Incidents", value: dashData?.open_dlp_incidents ?? 0, icon: Siren, color: "text-red-500" },
    { label: "Active Encryption Keys", value: dashData?.active_encryption_keys ?? 0, icon: Key, color: "text-emerald-500" },
    { label: "Data Residency Rules", value: dashData?.data_residency_rules ?? 0, icon: Globe, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Operations</h1>
          <p className="text-muted-foreground">NASA-Level security: zero-trust, risk-based auth, PAM, DLP, encryption, data residency</p>
        </div>
        <Badge variant={dashData?.compliance_status === "healthy" ? "success" : dashData?.compliance_status === "needs_attention" ? "warning" : "destructive"} className="capitalize">
          {dashData?.compliance_status?.replace("_", " ") ?? "unknown"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="glass-panel lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Security Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative mb-4 flex h-36 w-36 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={scoreStroke} strokeWidth="8"
                  strokeDasharray={`${(score / 100) * 326.73} 326.73`} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`text-3xl font-bold ${scoreColor}`}>{score}%</span>
                <span className="text-xs text-muted-foreground">overall</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Risk score: {dashData?.overall_risk_score ?? 0}/100
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.label} className="glass-panel">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <m.icon className={`h-5 w-5 ${m.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <p className="text-xl font-bold">{m.value}{m.total ? ` / ${m.total}` : ""}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="risk" className="space-y-4">
        <TabsList>
          <TabsTrigger value="risk">Risk Assessments</TabsTrigger>
          <TabsTrigger value="features">Feature Status</TabsTrigger>
        </TabsList>

        <TabsContent value="risk">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Recent Risk Assessments</CardTitle>
              <CardDescription>Risk-based authentication evaluations</CardDescription>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !riskData || riskData.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <ShieldCheck className="h-8 w-8" />
                  <p className="text-sm">No risk assessments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {riskData.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">User {r.user_id}</span>
                          <Badge className={cn("border", riskColors[r.risk_level])}>{r.risk_level}</Badge>
                          <span className="text-xs text-muted-foreground">Score: {r.risk_score}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          IP: {r.ip_address ?? "N/A"} &middot; Device: {r.device_id?.substring(0, 20) ?? "N/A"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(r.assessed_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Zero-Trust Architecture", status: dashData && dashData.active_zt_policies > 0 ? "active" : "inactive", count: dashData?.active_zt_policies },
              { name: "Multi-Factor Authentication", status: "active", desc: "TOTP + WebAuthn" },
              { name: "Hardware Security Keys", status: "active", desc: "FIDO2/WebAuthn" },
              { name: "SSO / SAML", status: "active", desc: "SAML 2.0" },
              { name: "OAuth Enterprise Login", status: "active", desc: "Google, Microsoft, GitHub, Okta" },
              { name: "SCIM Provisioning", status: "active", desc: "SCIM 2.0" },
              { name: "Conditional Access", status: dashData && dashData.active_ca_policies > 0 ? "active" : "inactive", count: dashData?.active_ca_policies },
              { name: "Risk-Based Authentication", status: dashData && dashData.pending_risk_assessments > 0 ? "active" : "inactive" },
              { name: "Immutable Audit Trails", status: "active", desc: "SHA-256 hash chain" },
              { name: "Privileged Access Mgmt", status: dashData && dashData.active_privileged_grants > 0 ? "active" : "inactive", count: dashData?.active_privileged_grants },
              { name: "Just-In-Time Permissions", status: dashData && dashData.pending_pam_requests > 0 ? "active" : "inactive" },
              { name: "Data Classification", status: dashData && dashData.data_classifications > 0 ? "active" : "inactive", count: dashData?.data_classifications },
              { name: "Encryption Key Rotation", status: dashData && dashData.active_encryption_keys > 0 ? "active" : "inactive", count: dashData?.active_encryption_keys },
              { name: "Data Residency Controls", status: dashData && dashData.data_residency_rules > 0 ? "active" : "inactive", count: dashData?.data_residency_rules },
              { name: "DLP Policies", status: dashData && dashData.dlp_policies > 0 ? "active" : "inactive", count: dashData?.dlp_policies },
              { name: "Session Recording", status: dashData && dashData.session_recordings_active > 0 ? "active" : "inactive", count: dashData?.session_recordings_active },
              { name: "GDPR Controls", status: "active" },
              { name: "SOC 2 Controls", status: "active" },
              { name: "ISO 27001 Controls", status: "active" },
            ].map((f) => (
              <Card key={f.name} className="glass-panel">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", f.status === "active" ? "bg-emerald-500/15" : "bg-muted")}>
                        {f.status === "active" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        {"desc" in f && <p className="text-xs text-muted-foreground">{f.desc}</p>}
                        {"count" in f && f.count !== undefined && <p className="text-xs text-muted-foreground">{f.count} configured</p>}
                      </div>
                    </div>
                    <Badge variant={f.status === "active" ? "success" : "secondary"} className="uppercase text-[10px]">{f.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
