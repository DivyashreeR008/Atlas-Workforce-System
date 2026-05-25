"use client";

export const dynamic = "force-dynamic";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, Wifi } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface AlertEvent {
  title?: string;
  message?: string;
  severity?: string;
  category?: string;
  source?: string;
  timestamp?: string;
}

export default function AlertsPage() {
  const { events, connected } = useSSEChannel<AlertEvent>("alert");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.title || e?.message), [events]);

  const critical = items.filter((a) => a.severity === "critical").length;
  const high = items.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Real-Time Alerts</h1>
          <p className="text-muted-foreground">Monitor and respond to system alerts</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-panel border-rose-500/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-rose-500">{critical}</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-orange-500/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">High</p>
            <p className="text-2xl font-bold text-orange-500">{high}</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Alerts</p>
            <p className="text-2xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Alert Feed</CardTitle>
          <CardDescription>Real-time alert stream</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">No alerts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((a, i) => (
                  <div key={i} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30",
                    a.severity === "critical" && "border-rose-500/30 bg-rose-500/5")}>
                    <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5",
                      a.severity === "critical" ? "text-rose-500" : a.severity === "high" ? "text-orange-500" : "text-amber-500")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{a.title ?? "Alert"}</p>
                        <Badge variant={a.severity === "critical" ? "destructive" : a.severity === "high" ? "warning" : "secondary"} className="uppercase text-[9px] h-4">
                          {a.severity ?? "info"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.message ?? ""}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {a.category && <span>{a.category}</span>}
                        {a.source && <span>· {a.source}</span>}
                        {a.timestamp && <span>· {new Date(a.timestamp).toLocaleTimeString()}</span>}
                      </div>
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
