"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Wifi, Users } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PresenceUser {
  user_id: string;
  name: string;
  status: string;
  department?: string;
  role?: string;
  location?: string;
}

export default function HeatmapPage() {
  const { events: presenceEvents, connected } = useSSEChannel<PresenceUser>("presence");

  const users = useMemo(() => {
    const raw = presenceEvents.map((e) => e.data).filter((u) => u?.user_id);
    return [...new Map(raw.map((u) => [u.user_id, u])).values()];
  }, [presenceEvents]);

  const deptStats = useMemo(() => {
    const map = new Map<string, { total: number; online: number }>();
    users.forEach((u) => {
      const dept = u.department ?? "Unassigned";
      const entry = map.get(dept) ?? { total: 0, online: 0 };
      entry.total++;
      if (u.status === "online" || u.status === "available") entry.online++;
      map.set(dept, entry);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [users]);

  const maxTotal = Math.max(...deptStats.map(([, s]) => s.total), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workforce Heatmap</h1>
          <p className="text-muted-foreground">Department-level workforce density and availability</p>
        </div>
        <LiveIndicator connected={connected} label={`${users.length} staff`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Department Density</CardTitle>
            <CardDescription>Workforce distribution across departments</CardDescription>
          </CardHeader>
          <CardContent>
            {deptStats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for presence data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deptStats.map(([dept, stats]) => {
                  const pct = (stats.total / maxTotal) * 100;
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium truncate capitalize">{dept}</span>
                          <Badge variant="secondary" className="text-[9px] h-4">{stats.total}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {stats.online} online ({stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="flex h-6 gap-0.5">
                        <div
                          className="rounded-l-md bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <div
                          className="rounded-r-md bg-emerald-500 transition-all"
                          style={{ width: `${(stats.online / maxTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Availability Map</CardTitle>
            <CardDescription>Online/offline ratios by department</CardDescription>
          </CardHeader>
          <CardContent>
            {deptStats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for presence data...</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {deptStats.map(([dept, stats]) => {
                  const onlinePct = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0;
                  return (
                    <Card key={dept} className="border">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs font-medium capitalize mb-2">{dept}</p>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all",
                                onlinePct >= 75 ? "bg-emerald-500" : onlinePct >= 50 ? "bg-amber-500" : "bg-rose-500")}
                              style={{ width: `${onlinePct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{onlinePct}%</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>{stats.online} online</span>
                          <span>{stats.total - stats.online} offline</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">All Staff by Department</CardTitle>
          <CardDescription>Complete workforce roster with live status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {users.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for presence data...</p>
              </div>
            ) : (
              users.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2 rounded-lg border p-2.5 transition-colors hover:bg-muted/30">
                  <div className={cn("h-2.5 w-2.5 rounded-full shrink-0",
                    u.status === "online" || u.status === "available" ? "bg-emerald-500" :
                    u.status === "away" ? "bg-amber-500" : u.status === "busy" ? "bg-rose-500" : "bg-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{u.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{(u.department ?? u.role ?? u.status)}</p>
                  </div>
                  <span className={cn("text-[9px] uppercase",
                    u.status === "online" || u.status === "available" ? "text-emerald-500" :
                    u.status === "away" ? "text-amber-500" : u.status === "busy" ? "text-rose-500" : "text-muted-foreground")}>
                    {u.status ?? "offline"}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
