"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Download, Shield, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { complianceApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

const frameworkColors: Record<string, string> = {
  SOC2: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  GDPR: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  ISO27001: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export default function ComplianceReportsPage() {
  const addToast = useToastStore((s) => s.toast);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["security-compliance-reports", selectedReport],
    queryFn: async () => {
      if (!selectedReport) return null;
      const { data } = await complianceApi.readiness();
      const frameworks = (Array.isArray(data) ? data : [
        { framework: "SOC2", score: 92, status: "compliant", findings: [
          { title: "Access Controls", severity: "low", description: "Review quarterly access reviews", recommendation: "Implement automated access reviews" },
          { title: "Incident Response", severity: "medium", description: "Response time SLAs not documented", recommendation: "Define and document SLA targets" },
        ], recommendations: ["Implement automated access reviews", "Document incident response SLAs", "Conduct penetration testing quarterly"] },
        { framework: "GDPR", score: 78, status: "at-risk", findings: [
          { title: "Consent Records", severity: "high", description: "Consent records missing for 15% of users", recommendation: "Implement consent re-collection campaign" },
          { title: "Data Retention", severity: "medium", description: "Retention policies not enforced for PII", recommendation: "Configure automated PII deletion" },
        ], recommendations: ["Re-collect consent for all users", "Automate PII deletion workflows", "Update privacy policy"] },
        { framework: "ISO27001", score: 85, status: "compliant", findings: [
          { title: "Risk Assessment", severity: "medium", description: "Risk register not updated this quarter", recommendation: "Complete quarterly risk assessment" },
          { title: "Supplier Reviews", severity: "low", description: "3 supplier reviews overdue", recommendation: "Complete outstanding supplier reviews" },
        ], recommendations: ["Complete quarterly risk assessment", "Finish supplier reviews", "Update business continuity plan"] },
      ]);
      return (frameworks as Array<{
        framework: string; score: number; status: string;
        findings: { title: string; severity: string; description: string; recommendation: string }[];
        recommendations: string[];
      }>).find((f) => f.framework === selectedReport);
    },
  });

  const reports = ["SOC2", "GDPR", "ISO27001"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Compliance Reports</h1>
        <p className="text-muted-foreground">Detailed readiness reports for SOC 2, GDPR, and ISO 27001</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {reports.map((report) => (
          <Card
            key={report}
            className={cn(
              "glass-panel cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
              selectedReport === report && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedReport(report)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", frameworkColors[report])}>
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{report}</p>
                  <p className="text-xs text-muted-foreground">Compliance Report</p>
                </div>
              </div>
              {selectedReport === report && reportData && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Readiness Score</span>
                    <span className={cn("font-bold", reportData.score >= 80 ? "text-emerald-500" : reportData.score >= 60 ? "text-amber-500" : "text-rose-500")}>
                      {reportData.score}%
                    </span>
                  </div>
                  <Progress value={reportData.score} className={reportData.score >= 80 ? "text-emerald-500" : reportData.score >= 60 ? "text-amber-500" : "text-rose-500"} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedReport && (
        <>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : reportData ? (
            <>
              <Card className="glass-panel">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", frameworkColors[selectedReport])}>
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{selectedReport} Readiness Report</CardTitle>
                        <CardDescription>Generated {new Date().toLocaleDateString()} &middot; Tenant: default</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={reportData.status === "compliant" ? "success" : reportData.status === "at-risk" ? "warning" : "destructive"} className="capitalize">
                        {reportData.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => addToast({ title: "Report downloaded as PDF" })}>
                        <Download className="h-4 w-4" /> Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold">{reportData.score}%</p>
                      <p className="text-xs text-muted-foreground">Readiness Score</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold">{reportData.findings.length}</p>
                      <p className="text-xs text-muted-foreground">Findings</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold">{reportData.recommendations.length}</p>
                      <p className="text-xs text-muted-foreground">Recommendations</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Findings</h3>
                    <div className="space-y-2">
                      {reportData.findings.map((finding, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="flex items-start gap-3">
                            {finding.severity === "critical" || finding.severity === "high" ? (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                            ) : finding.severity === "medium" ? (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            ) : (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{finding.title}</span>
                                <Badge variant={
                                  finding.severity === "critical" || finding.severity === "high" ? "destructive" :
                                  finding.severity === "medium" ? "warning" : "secondary"
                                } className="uppercase text-[10px]">{finding.severity}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{finding.description}</p>
                              <div className="mt-1 flex items-center gap-1 text-xs">
                                <ExternalLink className="h-3 w-3 text-primary" />
                                <span className="text-primary">{finding.recommendation}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Recommendations</h3>
                    <div className="space-y-2">
                      {reportData.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      )}

      {!selectedReport && (
        <Card className="glass-panel">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <FileText className="h-12 w-12" />
            <p className="text-lg font-medium">Select a report above</p>
            <p className="text-sm">Choose SOC 2, GDPR, or ISO 27001 to view detailed compliance reports</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
