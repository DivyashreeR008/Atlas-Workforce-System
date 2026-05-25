"use client";

export const dynamic = "force-dynamic";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Clock, Wifi } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface LeaveEvent {
  employee_name?: string;
  leave_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  department?: string;
  approver?: string;
}

export default function LeaveApprovalsPage() {
  const { events, connected } = useSSEChannel<LeaveEvent>("leave");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.employee_name), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Approvals</h1>
          <p className="text-muted-foreground">Real-time leave request and approval tracking</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" />Leave Requests</CardTitle>
          <CardDescription>Pending, approved, and rejected leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for leave data...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full",
                      l.status === "approved" ? "bg-emerald-500/10" : l.status === "pending" ? "bg-amber-500/10" : "bg-rose-500/10")}>
                      <Briefcase className={cn("h-4 w-4",
                        l.status === "approved" ? "text-emerald-500" : l.status === "pending" ? "text-amber-500" : "text-rose-500")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{l.employee_name}</p>
                      <p className="text-xs text-muted-foreground">{l.leave_type} · {l.department}</p>
                    </div>
                    <Badge variant={l.status === "approved" ? "success" : l.status === "pending" ? "warning" : "destructive"}>{l.status}</Badge>
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
