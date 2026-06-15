"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Cpu, Users, Bell, TrendingUp, AlertTriangle, BarChart3, Activity, Clock, Globe, Shield } from "lucide-react";

export default function CommandCenterPage() {
  const { events: slaEvents, connected: slConnected } = useSSEChannel("sla");
  const { events: kpiEvents } = useSSEChannel("kpi");
  const { events: alertEvents } = useSSEChannel("alert");
  const { events: presenceEvents } = useSSEChannel("presence");
  const { events: complianceEvents } = useSSEChannel("compliance");
  const { events: forecastingEvents } = useSSEChannel("forecast");

  const slaItems = slaEvents.map((e) => e.data as unknown as { service: string; status: string; response_time_ms?: number; threshold_ms?: number });
  const kpiItems = kpiEvents.map((e) => e.data as unknown as { metric: string; value: number; target: number; unit?: string; department?: string });
  const alerts = alertEvents.slice(0, 10);
  const presenceUsers = presenceEvents.map((e) => e.data as unknown as { user_id: string; name: string; status: string; department?: string; role?: string }).filter((u) => u?.user_id);
  const uniquePresence = [...new Map(presenceUsers.map((u) => [u.user_id, u])).values()];
  const onlineCount = uniquePresence.filter((u) => u.status === "online" || u.status === "available").length;
  const complianceItems = complianceEvents.map((e) => e.data as unknown as { policy: string; status: string; score?: number; violations?: number });
  const forecastItems = forecastingEvents.map((e) => e.data as unknown as { metric: string; value: number; prediction: number; unit?: string });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Command Center</h1>
          <p className="text-muted-foreground">Real-time enterprise-wide monitoring and intelligence</p>
        </div>
        <LiveIndicator connected={slConnected} label="Live" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {[
          { icon: Cpu, label: "System Health", value: "98.7%", sub: "Operational", color: "text-emerald-500" },
          { icon: Users, label: "Online Staff", value: onlineCount.toString(), sub: `${uniquePresence.length} total`, color: "text-blue-500" },
          { icon: Bell, label: "Alerts", value: alerts.length.toString(), sub: `${alerts.filter((a) => (a.data as any)?.severity === "critical").length} critical`, color: "text-rose-500" },
          { icon: TrendingUp, label: "KPI Tracking", value: kpiItems.length.toString(), sub: "active metrics", color: "text-amber-500" },
          { icon: BarChart3, label: "SLA Compliance", value: slaItems.length ? `${Math.round(slaItems.filter((s) => s.status === "healthy").length / slaItems.length * 100)}%` : "N/A", sub: `${slaItems.length} services`, color: "text-violet-500" },
        ].map((m) => (
          <Card key={m.label} className="glass-panel">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <m.icon className={cn("h-5 w-5", m.color)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass-panel lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />SLA Monitoring</CardTitle>
              <LiveIndicator connected={slConnected} />
            </div>
            <CardDescription>Real-time service level agreement status across all departments</CardDescription>
          </CardHeader>
          <CardContent>
            {slaItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Clock className="h-8 w-8" />
                <p className="text-sm">Waiting for SLA data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slaItems.map((sla, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{sla.service}</span>
                        <Badge variant={sla.status === "healthy" ? "success" : sla.status === "warning" ? "warning" : "destructive"}>
                          {sla.status}
                        </Badge>
                      </div>
                      {sla.response_time_ms !== undefined && sla.threshold_ms !== undefined && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{sla.response_time_ms}ms</span>
                            <span>Threshold: {sla.threshold_ms}ms</span>
                          </div>
                          <Progress value={Math.min((sla.response_time_ms / sla.threshold_ms) * 100, 100)} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Recent Alerts</CardTitle>
            <CardDescription>Highest severity alerts requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground px-4">
                  <Bell className="h-8 w-8" />
                  <p className="text-sm">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {alerts.map((a, i) => {
                    const d = a.data as { title?: string; severity?: string; category?: string; message?: string };
                    return (
                      <div key={i} className={cn("flex items-center gap-3 border-b px-4 py-2.5 text-sm transition-colors hover:bg-muted/30 last:border-b-0",
                        d.severity === "critical" && "bg-rose-500/5")}>
                        <AlertTriangle className={cn("h-4 w-4 shrink-0",
                          d.severity === "critical" ? "text-rose-500" : d.severity === "high" ? "text-orange-500" : "text-amber-500")} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-xs">{d.title ?? "Alert"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{d.message ?? ""}</p>
                        </div>
                        <Badge variant={d.severity === "critical" ? "destructive" : "warning"} className="text-[9px] h-4 px-1 uppercase shrink-0">
                          {d.severity ?? "info"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />KPI Metrics</CardTitle>
            <CardDescription>Real-time key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            {kpiItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8" />
                <p className="text-sm">Waiting for KPI data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {kpiItems.slice(0, 5).map((kpi, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{kpi.metric}</span>
                      <span className="font-medium">{kpi.value}{kpi.unit ?? ""} / {kpi.target}{kpi.unit ?? ""}</span>
                    </div>
                    <Progress value={(kpi.value / kpi.target) * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Compliance Status</CardTitle>
            <CardDescription>Real-time compliance and policy adherence</CardDescription>
          </CardHeader>
          <CardContent>
            {complianceItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Shield className="h-8 w-8" />
                <p className="text-sm">Waiting for compliance data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {complianceItems.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{c.policy}</p>
                      {c.score !== undefined && (
                        <Progress value={c.score} className="h-1.5 mt-1" />
                      )}
                    </div>
                    <Badge variant={c.status === "compliant" ? "success" : c.status === "warning" ? "warning" : "destructive"} className="shrink-0 ml-2">
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Forecasting</CardTitle>
            <CardDescription>Predicted vs actual workforce metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {forecastItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8" />
                <p className="text-sm">Waiting for forecast data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {forecastItems.slice(0, 5).map((f, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{f.metric}</span>
                      <span className="font-medium">{f.value}{f.unit ?? ""} / {f.prediction}{f.unit ?? ""}</span>
                    </div>
                    <Progress value={(f.value / f.prediction) * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Active Staff</CardTitle>
          <CardDescription>Currently online workforce presence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {uniquePresence.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">Waiting for presence data...</p>
              </div>
            ) : (
              uniquePresence.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className={cn("h-2 w-2 rounded-full shrink-0",
                    u.status === "online" || u.status === "available" ? "bg-emerald-500" :
                    u.status === "away" ? "bg-amber-500" : u.status === "busy" ? "bg-rose-500" :
                    "bg-muted-foreground")} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{u.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{u.role ?? u.department ?? u.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
