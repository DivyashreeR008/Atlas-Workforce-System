"use client";

export const dynamic = "force-dynamic";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, BarChart3, TrendingUp, Wifi } from "lucide-react";
import { useMemo } from "react";

interface KPIEvent {
  metric: string;
  value: number;
  target: number;
  unit?: string;
  department?: string;
  trend?: string;
}

export default function KPIDashboardsPage() {
  const { events, connected } = useSSEChannel<KPIEvent>("kpi");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.metric), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPI Dashboards</h1>
          <p className="text-muted-foreground">Real-time key performance indicator tracking</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Active KPIs</CardTitle>
          <CardDescription>Real-time metrics across departments</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Wifi className="h-8 w-8" />
              <p className="text-sm">Waiting for KPI data...</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((kpi, i) => {
                const pct = (kpi.value / kpi.target) * 100;
                return (
                  <Card key={i} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{kpi.metric}</p>
                            {kpi.department && <p className="text-[10px] text-muted-foreground">{kpi.department}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{kpi.value}{kpi.unit ?? ""}</p>
                          <p className="text-[10px] text-muted-foreground">Target: {kpi.target}{kpi.unit ?? ""}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{Math.round(pct)}% of target</span>
                        {kpi.trend && (
                          <Badge variant={kpi.trend === "up" ? "success" : kpi.trend === "down" ? "destructive" : "secondary"} className="text-[9px] h-4">
                            {kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→"} {kpi.trend}
                          </Badge>
                        )}
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
  );
}
