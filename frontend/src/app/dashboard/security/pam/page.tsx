"use client";


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Lock, UserCheck, Clock, Shield, CheckCircle2, XCircle, AlertTriangle,
  Plus, Search,
} from "lucide-react";
import { securityApi } from "@/lib/api";
import type { PrivilegedRole, PrivilegedAccess } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastStore } from "@/stores/toast-store";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  revoked: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  expired: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

export default function PAMPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [search, setSearch] = useState("");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ user_id: "", role_id: "", justification: "", duration_minutes: 60 });

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["pam-roles"],
    queryFn: async () => {
      const { data } = await securityApi.pam.roles.list("default");
      return (Array.isArray(data) ? data : []) as PrivilegedRole[];
    },
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["pam-requests"],
    queryFn: async () => {
      const { data } = await securityApi.pam.requests.list({ page_size: 50 });
      return (Array.isArray(data) ? data : data?.items ?? []) as PrivilegedAccess[];
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (form: typeof requestForm) => {
      const { data } = await securityApi.pam.requests.create({
        tenant_id: "default", ...form,
        jit_enabled: true,
        role_id: form.role_id,
      } as Partial<PrivilegedAccess>);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pam-requests"] });
      addToast({ title: "Access request submitted" });
      setShowRequestDialog(false);
    },
    onError: () => addToast({ title: "Failed to submit request", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await securityApi.pam.requests.approve(id, "admin");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pam-requests"] });
      addToast({ title: "Access approved" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await securityApi.pam.requests.revoke(id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pam-requests"] });
      addToast({ title: "Access revoked" });
    },
  });

  const filtered = requests?.filter((r) =>
    r.user_id.toLowerCase().includes(search.toLowerCase()) || r.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privileged Access Management</h1>
          <p className="text-muted-foreground">Just-in-time privileged access with approval workflows</p>
        </div>
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Request Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Privileged Access</DialogTitle>
              <DialogDescription>Submit a JIT elevation request for approval</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input value={requestForm.user_id} onChange={(e) => setRequestForm(f => ({ ...f, user_id: e.target.value }))} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Privileged Role</Label>
                <Select value={requestForm.role_id} onValueChange={(v) => setRequestForm(f => ({ ...f, role_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name} ({r.risk_level})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={requestForm.duration_minutes} onChange={(e) => setRequestForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))} />
              </div>
              <div className="space-y-2">
                <Label>Justification</Label>
                <Textarea value={requestForm.justification} onChange={(e) => setRequestForm(f => ({ ...f, justification: e.target.value }))} placeholder="Reason for privileged access..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
              <Button onClick={() => requestMutation.mutate(requestForm)} disabled={!requestForm.user_id || !requestForm.role_id}>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15"><Lock className="h-5 w-5 text-violet-500" /></div>
              <div><p className="text-sm text-muted-foreground">Privileged Roles</p><p className="text-xl font-bold">{roles?.length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15"><UserCheck className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="text-sm text-muted-foreground">Active Grants</p><p className="text-xl font-bold">{requests?.filter(r => r.status === "approved").length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15"><Clock className="h-5 w-5 text-amber-500" /></div>
              <div><p className="text-sm text-muted-foreground">Pending Requests</p><p className="text-xl font-bold">{requests?.filter(r => r.status === "pending").length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15"><Shield className="h-5 w-5 text-rose-500" /></div>
              <div><p className="text-sm text-muted-foreground">JIT Enabled</p><p className="text-xl font-bold">{requests?.filter(r => r.jit_enabled).length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Privileged Roles</CardTitle>
            <CardDescription>Roles with elevated permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !roles || roles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground"><Lock className="h-8 w-8" /><p className="text-sm">No privileged roles defined</p></div>
            ) : (
              <div className="space-y-2">
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.description ?? "No description"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.permissions.slice(0, 4).map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                        {r.permissions.length > 4 && <Badge variant="outline" className="text-[10px]">+{r.permissions.length - 4}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={r.risk_level === "high" ? "destructive" : r.risk_level === "medium" ? "warning" : "secondary"} className="uppercase text-[10px]">{r.risk_level}</Badge>
                      <span className="text-xs text-muted-foreground">{r.max_duration_minutes}min max</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Access Requests</CardTitle>
                <CardDescription>JIT permission elevation requests</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-40 pl-8 text-xs" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !filtered || filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground"><Shield className="h-8 w-8" /><p className="text-sm">No access requests</p></div>
            ) : (
              <div className="space-y-2">
                {filtered.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{req.user_id}</span>
                        <Badge className={cn("border", statusColors[req.status])} variant="outline">{req.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Role: {req.role_name ?? req.role_id?.substring(0, 8)} &middot;
                        {req.jit_enabled && " JIT"} &middot;
                        {req.start_time && `Started ${new Date(req.start_time).toLocaleString()}`}
                      </p>
                      {req.justification && <p className="text-xs text-muted-foreground italic">"{req.justification}"</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveMutation.mutate(req.id)}>
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => revokeMutation.mutate(req.id)}>
                            <XCircle className="h-3 w-3 mr-1 text-rose-500" /> Deny
                          </Button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => revokeMutation.mutate(req.id)}>
                          <XCircle className="h-3 w-3 mr-1 text-rose-500" /> Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
