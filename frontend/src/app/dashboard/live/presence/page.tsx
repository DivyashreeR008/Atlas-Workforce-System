"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import type { PresencePayload as PresenceUser } from "@/types";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, Wifi } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export default function PresencePage() {
  const { events: presenceEvents, connected } = useSSEChannel<PresenceUser>("presence");
  const [search, setSearch] = useState("");

  const users = useMemo(() => {
    const raw = presenceEvents.map((e) => e.data).filter((u) => u?.user_id);
    return [...new Map(raw.map((u) => [u.user_id, u])).values()];
  }, [presenceEvents]);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    online: users.filter((u) => u.status === "online" || u.status === "available").length,
    away: users.filter((u) => u.status === "away").length,
    busy: users.filter((u) => u.status === "busy").length,
    offline: users.filter((u) => u.status === "offline" || (!u.status)).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Presence</h1>
          <p className="text-muted-foreground">Real-time employee availability and status tracking</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Online", count: statusCounts.online, color: "bg-emerald-500" },
          { label: "Away", count: statusCounts.away, color: "bg-amber-500" },
          { label: "Busy", count: statusCounts.busy, color: "bg-rose-500" },
          { label: "Offline", count: statusCounts.offline, color: "bg-muted-foreground" },
        ].map((s) => (
          <Card key={s.label} className="glass-panel">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn("h-3 w-3 rounded-full", s.color)} />
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, department, role..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Badge variant="outline">{users.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">{users.length === 0 ? "Waiting for presence data..." : "No users match your search"}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <div className={cn("h-3 w-3 rounded-full shrink-0",
                      u.status === "online" || u.status === "available" ? "bg-emerald-500" :
                      u.status === "away" ? "bg-amber-500" : u.status === "busy" ? "bg-rose-500" : "bg-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={u.status === "online" || u.status === "available" ? "success" : u.status === "away" ? "warning" : u.status === "busy" ? "destructive" : "secondary"} className="text-[9px] uppercase h-4">
                          {u.status ?? "offline"}
                        </Badge>
                        {u.department && <span className="text-[10px] text-muted-foreground">{u.department}</span>}
                        {u.role && <span className="text-[10px] text-muted-foreground">· {u.role}</span>}
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
