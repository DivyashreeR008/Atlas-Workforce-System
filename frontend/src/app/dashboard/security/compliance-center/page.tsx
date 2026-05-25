"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { Shield, CheckCircle2, AlertTriangle, XCircle, FileText, ExternalLink } from "lucide-react";
import { complianceApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const frameworkBadges: Record<string, { label: string; color: string }> = {
  SOC2: { label: "SOC 2", color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  GDPR: { label: "GDPR", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  ISO27001: { label: "ISO 27001", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

export default function ComplianceCenterPage() {
  const { data: readinessData, isLoading } = useQuery({
    queryKey: ["compliance-readiness-center"],
    queryFn: async () => {
      const { data } = await complianceApi.readiness();
      return (Array.isArray(data) ? data : [
        { framework: "SOC2", score: 92, status: "compliant", controls: 45, passed: 42, failing: 3 },
        { framework: "GDPR", score: 78, status: "at-risk", controls: 38, passed: 30, failing: 8 },
        { framework: "ISO27001", score: 85, status: "compliant", controls: 52, passed: 44, failing: 8 },
      ]) as {
        framework: string; score: number; status: string;
        controls: number; passed: number; failing: number;
      }[];
    },
  });

  const { data: policies } = useQuery({
    queryKey: ["compliance-policies-center"],
    queryFn: async () => {
      const { data } = await complianceApi.policies.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as { id: string; name: string; framework: string; status: string; description: string; version: string }[];
    },
  });

  const frameworks = [
    {
      key: "GDPR", name: "General Data Protection Regulation", description: "EU data protection and privacy regulation",
      controls: [
        { name: "Consent Management", status: "compliant", description: "User consent tracking and management" },
        { name: "Right to Access", status: "compliant", description: "Data access request handling" },
        { name: "Right to Erasure", status: "compliant", description: "Right to be forgotten implementation" },
        { name: "Data Portability", status: "compliant", description: "Data export in portable format" },
        { name: "Breach Notification", status: "at-risk", description: "72-hour breach notification process" },
        { name: "Data Protection Impact Assessment", status: "non-compliant", description: "DPIA for high-risk processing" },
      ],
    },
    {
      key: "SOC2", name: "Service Organization Control 2", description: "Security, availability, processing integrity, confidentiality, privacy",
      controls: [
        { name: "Logical & Physical Access", status: "compliant", description: "Access controls and authentication" },
        { name: "System Operations", status: "compliant", description: "Monitoring and incident response" },
        { name: "Change Management", status: "compliant", description: "Change control and testing" },
        { name: "Risk Mitigation", status: "at-risk", description: "Risk assessment and treatment" },
        { name: "Vendor Management", status: "non-compliant", description: "Third-party risk management" },
      ],
    },
    {
      key: "ISO27001", name: "ISO/IEC 27001", description: "Information security management system",
      controls: [
        { name: "Information Security Policies", status: "compliant", description: "Policy framework and review" },
        { name: "Asset Management", status: "compliant", description: "Asset inventory and classification" },
        { name: "Access Control", status: "compliant", description: "Access rights and review" },
        { name: "Cryptography", status: "compliant", description: "Encryption and key management" },
        { name: "Physical Security", status: "at-risk", description: "Physical access controls" },
        { name: "Incident Management", status: "compliant", description: "Incident response and reporting" },
        { name: "Business Continuity", status: "at-risk", description: "BCM and disaster recovery" },
      ],
    },
  ];

  const statusIcon: Record<string, typeof CheckCircle2> = {
    compliant: CheckCircle2,
    "at-risk": AlertTriangle,
    "non-compliant": XCircle,
  };

  const statusColor: Record<string, string> = {
    compliant: "text-emerald-500",
    "at-risk": "text-amber-500",
    "non-compliant": "text-rose-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Center</h1>
        <p className="text-muted-foreground">GDPR, SOC 2, ISO 27001 — unified compliance management</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
        ) : (
          (readinessData ?? []).map((fw) => {
            const badge = frameworkBadges[fw.framework as keyof typeof frameworkBadges] || { label: fw.framework, color: "bg-muted" };
            const scoreColor = fw.score >= 80 ? "text-emerald-500" : fw.score >= 60 ? "text-amber-500" : "text-rose-500";
            return (
              <Card key={fw.framework} className="glass-panel">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className={cn("border-0", badge.color)}>{badge.label}</Badge>
                    <Badge variant={fw.status === "compliant" ? "success" : fw.status === "at-risk" ? "warning" : "destructive"}>{fw.status}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{fw.framework} Readiness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center justify-center">
                    <div className="relative flex h-24 w-24 items-center justify-center">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                        <circle cx="60" cy="60" r="52" fill="none" stroke={fw.score >= 80 ? "#10b981" : fw.score >= 60 ? "#f59e0b" : "#f43f5e"} strokeWidth="8"
                          strokeDasharray={`${(fw.score / 100) * 326.73} 326.73`} strokeLinecap="round" className="transition-all duration-1000" />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className={`text-xl font-bold ${scoreColor}`}>{fw.score}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Controls</span>
                      <span className="font-medium">{fw.controls}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-500">Passed</span>
                      <span className="font-medium">{fw.passed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-rose-500">Failing</span>
                      <span className="font-medium">{fw.failing}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Tabs defaultValue="gdpr" className="space-y-4">
        <TabsList>
          {frameworks.map((fw) => (
            <TabsTrigger key={fw.key} value={fw.key.toLowerCase()}>
              <Badge className={cn("border-0 mr-2", frameworkBadges[fw.key as keyof typeof frameworkBadges]?.color || "bg-muted")}>
                {frameworkBadges[fw.key as keyof typeof frameworkBadges]?.label || fw.key}
              </Badge>
              {fw.name.split(" ")[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {frameworks.map((fw) => (
          <TabsContent key={fw.key} value={fw.key.toLowerCase()}>
            <Card className="glass-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{fw.name}</CardTitle>
                    <CardDescription>{fw.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">{fw.controls.length} controls</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fw.controls.map((ctl) => {
                    const Icon = statusIcon[ctl.status as keyof typeof statusIcon] || AlertTriangle;
                    return (
                      <div key={ctl.name} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", statusColor[ctl.status as keyof typeof statusColor] || "text-muted-foreground")} />
                            <span className="text-sm font-medium">{ctl.name}</span>
                            <Badge variant={
                              ctl.status === "compliant" ? "success" : ctl.status === "at-risk" ? "warning" : "destructive"
                            } className="uppercase text-[10px]">{ctl.status}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground ml-6">{ctl.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
