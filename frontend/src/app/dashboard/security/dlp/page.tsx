"use client";


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Siren, AlertTriangle, Shield, CheckCircle2, Search, FileText, Filter,
} from "lucide-react";
import { securityApi } from "@/lib/api";
import type { DLPPolicy, DLPIncident } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

const severityColors: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
};

const statusColors: Record<string, string> = {
  open: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  investigating: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  remediated: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export default function DLPPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [search, setSearch] = useState("");

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ["dlp-policies"],
    queryFn: async () => {
      const { data } = await securityApi.dlp.policies.list({ tenant_id: "default" });
      return (Array.isArray(data) ? data : []) as DLPPolicy[];
    },
  });

  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ["dlp-incidents"],
    queryFn: async () => {
      const { data } = await securityApi.dlp.incidents.list({ page_size: 50 });
      return (Array.isArray(data) ? data : data?.items ?? []) as DLPIncident[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await securityApi.dlp.incidents.updateStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlp-incidents"] });
      addToast({ title: "Incident status updated" });
    },
  });

  const filtered = incidents?.filter((i) =>
    i.description?.toLowerCase().includes(search.toLowerCase()) ||
    i.resource_type?.toLowerCase().includes(search.toLowerCase()) ||
    i.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = incidents?.filter((i) => i.status === "open").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Loss Prevention</h1>
        <p className="text-muted-foreground">DLP policies and incident management</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15"><FileText className="h-5 w-5 text-violet-500" /></div>
              <div><p className="text-sm text-muted-foreground">DLP Policies</p><p className="text-xl font-bold">{policies?.length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15"><AlertTriangle className="h-5 w-5 text-rose-500" /></div>
              <div><p className="text-sm text-muted-foreground">Open Incidents</p><p className="text-xl font-bold">{openCount}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="text-sm text-muted-foreground">Resolved</p><p className="text-xl font-bold">{incidents?.filter((i) => i.status === "resolved" || i.status === "remediated").length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/15"><Siren className="h-5 w-5 text-orange-500" /></div>
              <div><p className="text-sm text-muted-foreground">Active Policies</p><p className="text-xl font-bold">{policies?.filter((p) => p.enabled).length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents">
          <Card className="glass-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">DLP Incidents</CardTitle>
                  <CardDescription>Data loss prevention alerts and violations</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 pl-8 text-xs" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {incidentsLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : !filtered || filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm">No DLP incidents found. All clear!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((inc) => (
                    <div key={inc.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{inc.resource_type ?? "Unknown"}</span>
                          {inc.severity && <Badge className={cn("border", severityColors[inc.severity])} variant="outline">{inc.severity}</Badge>}
                          <Badge className={cn("border", statusColors[inc.status] || "")} variant="outline">{inc.status}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {inc.description ?? "No description"} &middot;
                          {inc.user_id && `User: ${inc.user_id}`}
                          {inc.data_classification && ` &middot; Classification: ${inc.data_classification}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{new Date(inc.detected_at).toLocaleString()}</span>
                        {inc.status === "open" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: inc.id, status: "investigating" })}>
                            Investigate
                          </Button>
                        )}
                        {inc.status === "investigating" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: inc.id, status: "resolved" })}>
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policiesLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            ) : !policies || policies.length === 0 ? (
              <Card className="glass-panel sm:col-span-2 lg:col-span-3">
                <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Shield className="h-12 w-12" />
                  <p className="text-sm">No DLP policies defined</p>
                </CardContent>
              </Card>
            ) : (
              policies.map((p) => (
                <Card key={p.id} className="glass-panel">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium">{p.name}</CardTitle>
                      <Badge className={cn("border", severityColors[p.severity] || "bg-muted")} variant="outline">{p.severity}</Badge>
                    </div>
                    <CardDescription className="text-xs">{p.description ?? "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Shield className={cn("h-3 w-3", p.enabled ? "text-emerald-500" : "text-muted-foreground")} />
                      <span>{p.enabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.actions.map((a) => (
                        <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
