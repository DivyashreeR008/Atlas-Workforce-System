"use client";

export const dynamic = "force-dynamic";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Siren, Wifi, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface IncidentEvent {
  incident_id?: string;
  title?: string;
  severity?: string;
  status?: string;
  assignee?: string;
  department?: string;
  category?: string;
  timestamp?: string;
  resolution_progress?: number;
}

export default function IncidentsPage() {
  const { events, connected } = useSSEChannel<IncidentEvent>("incidents");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.title || e?.incident_id), [events]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const filtered = items.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (severityFilter && i.severity !== severityFilter) return false;
    return true;
  });

  const openCount = items.filter((i) => i.status === "open" || i.status === "in_progress").length;
  const criticalCount = items.filter((i) => i.severity === "critical").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground">Real-time incident tracking and resolution</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Open Incidents", count: openCount, color: "text-rose-500", icon: Siren },
          { label: "Critical", count: criticalCount, color: "text-rose-500", icon: AlertTriangle },
          { label: "Total", count: items.length, color: "text-blue-500", icon: Siren },
        ].map((m) => (
          <Card key={m.label} className="glass-panel">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <m.icon className={cn("h-5 w-5", m.color)} />
                <div>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold">{m.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Siren className="h-4 w-4" />Incidents</CardTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="cursor-pointer" onClick={() => setStatusFilter(null)}>All</Badge>
              <Badge variant={statusFilter === "open" ? "destructive" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("open")}>Open</Badge>
              <Badge variant={statusFilter === "in_progress" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("in_progress")}>In Progress</Badge>
              <Badge variant={statusFilter === "resolved" ? "success" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("resolved")}>Resolved</Badge>
            </div>
          </div>
          <CardDescription>{filtered.length} incidents matching filters</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">{items.length === 0 ? "Waiting for incident data..." : "No incidents match filters"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((inc, i) => (
                  <div key={inc.incident_id ?? i} className={cn("rounded-lg border p-3 transition-colors hover:bg-muted/30",
                    inc.severity === "critical" && "border-rose-500/30 bg-rose-500/5")}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{inc.title ?? `Incident #${inc.incident_id}`}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {inc.department && <span>{inc.department}</span>}
                          {inc.assignee && <span>· Assigned: {inc.assignee}</span>}
                          {inc.category && <span>· {inc.category}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant={inc.severity === "critical" ? "destructive" : inc.severity === "high" ? "warning" : "secondary"} className="uppercase text-[9px]">
                          {inc.severity}
                        </Badge>
                        <Badge variant={inc.status === "resolved" ? "success" : inc.status === "in_progress" ? "default" : "secondary"}>
                          {inc.status?.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    {inc.resolution_progress !== undefined && inc.status !== "resolved" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Resolution Progress</span>
                          <span>{inc.resolution_progress}%</span>
                        </div>
                        <Progress value={inc.resolution_progress} className="h-1.5" />
                      </div>
                    )}
                    {inc.timestamp && <p className="text-[10px] text-muted-foreground mt-1">{new Date(inc.timestamp).toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
