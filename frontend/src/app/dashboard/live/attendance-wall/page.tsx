"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Footprints, Clock, Wifi } from "lucide-react";
import { useMemo } from "react";

interface AttendanceEvent {
  employee_id: string;
  name: string;
  action: string;
  department?: string;
  timestamp?: string;
  location?: string;
}

export default function AttendanceWallPage() {
  const { events, connected } = useSSEChannel<AttendanceEvent>("attendance");

  const attendance = useMemo(() => {
    return events.map((e) => e.data).filter((e) => e?.employee_id);
  }, [events]);

  const checkIns = attendance.filter((e) => e.action === "check_in" || e.action === "clock_in");
  const checkOuts = attendance.filter((e) => e.action === "check_out" || e.action === "clock_out");
  const breaks = attendance.filter((e) => e.action === "break_start" || e.action === "break_end");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance Wall</h1>
          <p className="text-muted-foreground">Real-time employee clock-in/out activity stream</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Today's Check-ins", count: checkIns.length, color: "text-emerald-500" },
          { label: "Today's Check-outs", count: checkOuts.length, color: "text-rose-500" },
          { label: "Breaks", count: breaks.length, color: "text-amber-500" },
          { label: "Total Events", count: attendance.length, color: "text-blue-500" },
        ].map((m) => (
          <Card key={m.label} className="glass-panel">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Footprints className={cn("h-5 w-5", m.color)} />
                </div>
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
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Live Attendance Stream</CardTitle>
          <CardDescription>Real-time clock-in/out events as they happen</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {attendance.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for attendance data...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendance.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full",
                      a.action.includes("in") ? "bg-emerald-500/10" : a.action.includes("out") ? "bg-rose-500/10" : "bg-amber-500/10")}>
                      <Footprints className={cn("h-4 w-4",
                        a.action.includes("in") ? "text-emerald-500" : a.action.includes("out") ? "text-rose-500" : "text-amber-500")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.name} <span className="text-muted-foreground font-normal">- {a.action.replace("_", " ")}</span></p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {a.department && <span>{a.department}</span>}
                        {a.location && <span>· {a.location}</span>}
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
