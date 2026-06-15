"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, Wifi } from "lucide-react";
import { useMemo } from "react";

interface StaffingEvent {
  department?: string;
  filled: number;
  required: number;
  shift?: string;
  status?: string;
  date?: string;
}

export default function StaffingPage() {
  const { events, connected } = useSSEChannel<StaffingEvent>("staffing");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.department), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staffing Updates</h1>
          <p className="text-muted-foreground">Real-time shift coverage and staffing levels</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" />Shift Coverage</CardTitle>
          <CardDescription>Department-level staffing levels</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for staffing data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((s, i) => {
                  const pct = s.required > 0 ? (s.filled / s.required) * 100 : 0;
                  return (
                    <div key={i} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium capitalize">{s.department}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {s.shift && <span>Shift: {s.shift}</span>}
                            {s.date && <span>· {new Date(s.date).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <Badge variant={s.status === "fully_staffed" ? "success" : s.status === "understaffed" ? "warning" : "destructive"}>
                          {s.status?.replace("_", " ") ?? "unknown"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{s.filled} staffed</span>
                          <span>{s.required} required</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <p className="text-[10px] text-muted-foreground">
                          {pct >= 100 ? "Fully staffed" : `${s.required - s.filled} more needed (${Math.round(pct)}%)`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
