"use client";


import { useState } from "react";
import Link from "next/link";
import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { PresenceAvatar } from "@/components/live/presence-avatar";
import {
  Activity, AlertTriangle, Bell, Briefcase, Clock, Cloud, Database,
  Footprints, GitPullRequest, Globe, LineChart, Megaphone, MessageSquare,
  Radio, Siren, Target, TrendingUp, Truck, UserCheck, Users, UserPlus,
  Wifi, Shield, Hourglass, BarChart3, Building2, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type SSEEvent = { channel: string; event: string; data: Record<string, unknown>; timestamp: string };

export default function LivePage() {
  const { events: presenceEvents, connected: pConnected } = useSSEChannel("presence");
  const { events: activityEvents, connected: aConnected } = useSSEChannel("activity");
  const { events: alertEvents, connected: alConnected } = useSSEChannel("alert");
  const { events: attendanceEvents, connected: atConnected } = useSSEChannel("attendance");
  const { events: announcementEvents, connected: anConnected } = useSSEChannel("announcement");
  const { events: slaEvents, connected: slConnected } = useSSEChannel("sla");
  const { events: staffingEvents } = useSSEChannel("staffing");

  const presenceUsers = presenceEvents
    .map((e) => e.data as unknown as { user_id: string; name: string; status: string; department?: string; role?: string })
    .filter((u) => u?.user_id);

  const uniquePresence = [...new Map(presenceUsers.map((u) => [u.user_id, u])).values()];
  const onlineUsers = uniquePresence.filter((u) => u.status === "online" || u.status === "available");
  const alerts = alertEvents.slice(0, 5);

  const channels = [
    { key: "presence", label: "Live Presence", icon: Users, connected: pConnected, href: "/dashboard/live/presence", count: onlineUsers.length },
    { key: "attendance", label: "Attendance Wall", icon: Footprints, connected: atConnected, href: "/dashboard/live/attendance-wall" },
    { key: "activity", label: "Activity Feed", icon: Activity, connected: aConnected, href: "/dashboard/live/activity-feed" },
    { key: "alert", label: "Alerts", icon: AlertTriangle, connected: alConnected, href: "/dashboard/live/alerts", count: alerts.length },
    { key: "announcement", label: "Announcements", icon: Megaphone, connected: anConnected, href: "/dashboard/live/announcements" },
    { key: "sla", label: "SLA Monitor", icon: Clock, connected: slConnected, href: "/dashboard/live/sla" },
    { key: "payroll", label: "Payroll Progress", icon: BarChart3, href: "/dashboard/live/payroll-progress" },
    { key: "leave", label: "Leave Approvals", icon: Briefcase, href: "/dashboard/live/leave-approvals" },
    { key: "kpi", label: "KPI Dashboards", icon: Target, href: "/dashboard/live/kpi-dashboards" },
    { key: "heatmap", label: "Workforce Heatmap", icon: Globe, href: "/dashboard/live/heatmap" },
    { key: "task", label: "Task Assignment", icon: GitPullRequest, href: "/dashboard/live/tasks" },
    { key: "escalation", label: "Escalation Engine", icon: TrendingUp, href: "/dashboard/live/escalation" },
    { key: "compliance", label: "Compliance Violations", icon: Shield, href: "/dashboard/live/compliance-violations" },
    { key: "onboarding", label: "Onboarding Progress", icon: UserPlus, href: "/dashboard/live/onboarding" },
    { key: "recruitment", label: "Recruitment Pipeline", icon: Briefcase, href: "/dashboard/live/recruitment" },
    { key: "forecast", label: "Forecasting", icon: LineChart, href: "/dashboard/live/forecasting" },
    { key: "staffing", label: "Staffing Updates", icon: Truck, href: "/dashboard/live/staffing" },
    { key: "chat", label: "Internal Chat", icon: MessageSquare, href: "/dashboard/live/chat" },
    { key: "polls", label: "Live Polls", icon: BarChart3, href: "/dashboard/live/polls" },
    { key: "emergency", label: "Emergency Broadcast", icon: Radio, href: "/dashboard/live/emergency" },
    { key: "incidents", label: "Incident Management", icon: Siren, href: "/dashboard/live/incidents" },
    { key: "executive", label: "Executive Monitoring", icon: Building2, href: "/dashboard/live/command-center" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Operations Center</h1>
          <p className="text-muted-foreground">Real-time employee presence, activity, alerts, and workforce intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator connected={pConnected || aConnected || alConnected} label={onlineUsers.length ? `${onlineUsers.length} online` : "Live"} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, label: "Online Now", value: onlineUsers.length, total: uniquePresence.length, color: "text-emerald-500" },
          { icon: Activity, label: "Activity Events", value: activityEvents.length, color: "text-blue-500" },
          { icon: AlertTriangle, label: "Active Alerts", value: alerts.length, color: alerts.length ? "text-rose-500" : "text-muted-foreground" },
          { icon: Clock, label: "SLA Items", value: slaEvents.length, color: "text-amber-500" },
        ].map((m) => (
          <Card key={m.label} className="glass-panel">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <m.icon className={cn("h-5 w-5", m.color)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold">{m.value}{m.total ? ` / ${m.total}` : ""}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">All Channels</TabsTrigger>
          <TabsTrigger value="presence">Live Presence</TabsTrigger>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((ch) => (
              <Link key={ch.key} href={ch.href}>
                <Card className="glass-panel cursor-pointer transition-all hover:ring-2 hover:ring-primary/50">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <ch.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ch.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {"connected" in ch && ch.connected !== undefined && (
                          <span className={cn("flex h-1.5 w-1.5 rounded-full", ch.connected ? "bg-emerald-500" : "bg-muted-foreground")} />
                        )}
                        {ch.count !== undefined && (
                          <Badge variant="secondary" className="text-[10px] h-4">{ch.count}</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="presence">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Live Employee Presence</CardTitle>
              <CardDescription>{onlineUsers.length} online &middot; {uniquePresence.length} total visible</CardDescription>
            </CardHeader>
            <CardContent>
              {uniquePresence.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Wifi className="h-8 w-8" />
                  <p className="text-sm">Waiting for presence data...</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {uniquePresence.map((u) => (
                    <div key={u.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                      <PresenceAvatar name={u.name} status={u.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={u.status === "online" ? "success" : u.status === "away" ? "warning" : "secondary"} className="text-[10px] uppercase h-4">
                            {u.status}
                          </Badge>
                          {u.department && <span className="text-[10px] text-muted-foreground truncate">{u.department}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Live Activity Feed</CardTitle>
              <CardDescription>Real-time department activity stream</CardDescription>
            </CardHeader>
            <CardContent>
              {activityEvents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Activity className="h-8 w-8" />
                  <p className="text-sm">No activity events yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activityEvents.map((ev, i) => {
                    const d = ev.data as { actor?: string; action?: string; resource?: string; details?: string; department?: string };
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/30">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{d.actor ?? "System"}</span>
                          <span className="text-muted-foreground"> {d.action ?? "performed"}{" "}</span>
                          <span className="font-medium">{d.resource ?? "action"}</span>
                          {d.details && <p className="text-xs text-muted-foreground truncate">{d.details}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          {d.department && <Badge variant="outline" className="text-[10px]">{d.department}</Badge>}
                          <p className="text-[10px] text-muted-foreground">{new Date(ev.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Real-Time Alerts</CardTitle>
              <CardDescription>{alerts.length} recent alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Bell className="h-8 w-8" />
                  <p className="text-sm">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a, i) => {
                    const d = a.data as { title?: string; message?: string; severity?: string; category?: string };
                    return (
                      <div key={i} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30",
                        d.severity === "critical" && "border-rose-500/30 bg-rose-500/5")}>
                        <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5",
                          d.severity === "critical" ? "text-rose-500" : d.severity === "high" ? "text-orange-500" : "text-amber-500")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{d.title ?? "Alert"}</p>
                          <p className="text-xs text-muted-foreground">{d.message ?? ""}</p>
                        </div>
                        <Badge variant={d.severity === "critical" ? "destructive" : d.severity === "high" ? "warning" : "secondary"} className="uppercase text-[10px] shrink-0">
                          {d.severity ?? "info"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
