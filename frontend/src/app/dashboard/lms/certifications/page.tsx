"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, AlertTriangle, Plus, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { lmsApi } from "@/lib/api";
import type { Certification } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToastStore } from "@/stores/toast-store";

export default function CertificationsPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    issuer: "",
    employeeId: "",
    issueDate: "",
    expiryDate: "",
    credentialUrl: "",
  });

  const { data: certs, isLoading } = useQuery({
    queryKey: ["lms-certifications", statusFilter],
    queryFn: async () => {
      const { data } = await lmsApi.certifications.list({
        status: statusFilter || undefined,
      });
      return (Array.isArray(data) ? data : (data as any).items ?? []) as Certification[];
    },
  });

  const expiringSoon = (certs ?? []).filter((c) => {
    if (c.status !== "active") return false;
    const daysLeft = Math.ceil(
      (new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysLeft <= 30 && daysLeft >= 0;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await lmsApi.certifications.create(form);
      addToast({ title: "Certification recorded" });
      setDialogOpen(false);
      setForm({ name: "", issuer: "", employeeId: "", issueDate: "", expiryDate: "", credentialUrl: "" });
      void queryClient.invalidateQueries({ queryKey: ["lms-certifications"] });
    } catch {
      addToast({ title: "Failed to record certification", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certifications</h1>
          <p className="text-muted-foreground">Track and manage employee certifications</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Record Certification
        </Button>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Certifications expiring soon</p>
              <p className="text-xs text-muted-foreground">
                {expiringSoon.length} certification{expiringSoon.length > 1 ? "s" : ""} expiring within 30 days
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">All Certifications</CardTitle>
              <CardDescription>
                {certs?.length ?? 0} total certification{certs?.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Issuer</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-3" colSpan={7}>
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  : (certs ?? []).length === 0
                    ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                          No certifications found.
                        </td>
                      </tr>
                    )
                    : (certs ?? []).map((cert) => {
                        const daysLeft = Math.ceil(
                          (new Date(cert.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <tr
                            key={cert.id}
                            className="border-b transition-colors hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 font-medium">{cert.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {cert.employeeName ?? cert.employeeId}
                            </td>
                            <td className="px-4 py-3">{cert.issuer}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(cert.issueDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(cert.expiryDate).toLocaleDateString()}
                              {daysLeft <= 30 && daysLeft >= 0 && (
                                <Badge variant="warning" className="ml-2">
                                  {daysLeft}d
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  cert.status === "active"
                                    ? "success"
                                    : cert.status === "expired"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {cert.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {cert.verified ? (
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
          </div>

          {certs && certs.length > 0 && (
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const unverified = certs.filter((c) => !c.verified);
                    for (const c of unverified) {
                      await lmsApi.certifications.verify(c.id);
                    }
                    addToast({ title: `${unverified.length} certifications verified` });
                    void queryClient.invalidateQueries({ queryKey: ["lms-certifications"] });
                  } catch {
                    addToast({ title: "Verification failed", variant: "destructive" });
                  }
                }}
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                Verify Unverified
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Record Certification</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a new certification for an employee
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="certName">Certification Name</Label>
                <Input id="certName" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certIssuer">Issuer</Label>
                <Input id="certIssuer" required value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certEmployee">Employee ID</Label>
                <Input id="certEmployee" required value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input id="issueDate" type="date" required value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input id="expiryDate" type="date" required value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credentialUrl">Credential URL (optional)</Label>
                <Input id="credentialUrl" type="url" value={form.credentialUrl} onChange={(e) => setForm((f) => ({ ...f, credentialUrl: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
