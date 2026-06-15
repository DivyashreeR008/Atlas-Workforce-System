"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Wifi } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SLAEvent {
  service: string;
  status: string;
  response_time_ms?: number;
  threshold_ms?: number;
  uptime?: number;
  department?: string;
}

export default function SLAPage() {
  const { events, connected } = useSSEChannel<SLAEvent>("sla");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.service), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SLA Monitoring</h1>
          <p className="text-muted-foreground">Real-time service level agreement status</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Service Status</CardTitle>
          <CardDescription>{items.length} monitored services</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for SLA data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((sla, i) => (
                  <div key={i} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium">{sla.service}</p>
                        {sla.department && <p className="text-xs text-muted-foreground">{sla.department}</p>}
                      </div>
                      <Badge variant={sla.status === "healthy" ? "success" : sla.status === "warning" ? "warning" : "destructive"}>
                        {sla.status}
                      </Badge>
                    </div>
                    {sla.response_time_ms !== undefined && sla.threshold_ms !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{sla.response_time_ms}ms response time</span>
                          <span>Threshold: {sla.threshold_ms}ms</span>
                        </div>
                        <Progress value={Math.min((sla.response_time_ms / sla.threshold_ms) * 100, 100)}
                          className={cn("h-2", sla.response_time_ms > sla.threshold_ms * 0.9 ? "bg-rose-500/20" : sla.response_time_ms > sla.threshold_ms * 0.7 ? "bg-amber-500/20" : "bg-emerald-500/20")} />
                      </div>
                    )}
                    {sla.uptime !== undefined && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Uptime:</span>
                        <Progress value={sla.uptime} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium">{sla.uptime.toFixed(2)}%</span>
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
