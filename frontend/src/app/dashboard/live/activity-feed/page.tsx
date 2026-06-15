"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Filter, Wifi } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface ActivityEvent {
  actor: string;
  action: string;
  resource: string;
  details?: string;
  department?: string;
  timestamp?: string;
}

export default function ActivityFeedPage() {
  const { events, connected } = useSSEChannel<ActivityEvent>("activity");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.actor), [events]);
  const departments = useMemo(() => [...new Set(items.map((a) => a.department).filter(Boolean))] as string[], [items]);
  const filtered = deptFilter ? items.filter((a) => a.department === deptFilter) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Feed</h1>
          <p className="text-muted-foreground">Real-time department activity stream</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Activity Stream</CardTitle>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <button onClick={() => setDeptFilter(null)} className={cn("text-xs px-2 py-0.5 rounded", !deptFilter && "bg-primary/10 text-primary")}>All</button>
              {departments.map((d) => (
                <button key={d} onClick={() => setDeptFilter(d)} className={cn("text-xs px-2 py-0.5 rounded capitalize", deptFilter === d && "bg-primary/10 text-primary")}>{d}</button>
              ))}
            </div>
          </div>
          <CardDescription>{filtered.length} events{deptFilter ? ` in ${deptFilter}` : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for activity data...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{a.actor}</span>
                        <span className="text-muted-foreground"> {a.action} </span>
                        <span className="font-medium">{a.resource}</span>
                      </p>
                      {a.details && <p className="text-xs text-muted-foreground mt-0.5">{a.details}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {a.department && <Badge variant="outline" className="text-[9px] capitalize">{a.department}</Badge>}
                      {a.timestamp && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.timestamp).toLocaleTimeString()}</p>}
                    </div>
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
