"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Wifi } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface EscalationEvent {
  case_id?: string;
  title?: string;
  level?: number;
  status?: string;
  assignee?: string;
  department?: string;
  escalated_by?: string;
  timestamp?: string;
  sla_remaining_minutes?: number;
}

export default function EscalationPage() {
  const { events, connected } = useSSEChannel<EscalationEvent>("escalation");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.title || e?.case_id), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escalation Engine</h1>
          <p className="text-muted-foreground">Real-time incident escalation and SLA tracking</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Escalation Queue</CardTitle>
          <CardDescription>{items.length} active escalations</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">No escalations yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((e, i) => (
                  <div key={i} className={cn("rounded-lg border p-3 transition-colors hover:bg-muted/30",
                    (e.level ?? 0) >= 3 && "border-rose-500/30 bg-rose-500/5")}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{e.title ?? `Escalation #${e.case_id}`}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {e.department && <span>{e.department}</span>}
                          {e.assignee && <span>· Assigned: {e.assignee}</span>}
                          {e.escalated_by && <span>· By: {e.escalated_by}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant={(e.level ?? 0) >= 3 ? "destructive" : (e.level ?? 0) >= 2 ? "warning" : "secondary"}>Lvl {e.level}</Badge>
                        <Badge variant={e.status === "resolved" ? "success" : e.status === "in_progress" ? "default" : "secondary"}>{e.status}</Badge>
                      </div>
                    </div>
                    {e.sla_remaining_minutes !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>SLA remaining</span>
                          <span>{e.sla_remaining_minutes > 0 ? `${e.sla_remaining_minutes}m` : "BREACHED"}</span>
                        </div>
                        <Progress value={Math.max(0, (e.sla_remaining_minutes / 60) * 100)} className={cn("h-1.5", e.sla_remaining_minutes <= 0 && "bg-rose-500/20")} />
                      </div>
                    )}
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
