"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LineChart, TrendingUp, Wifi } from "lucide-react";
import { useMemo } from "react";

interface ForecastEvent {
  metric: string;
  value: number;
  prediction: number;
  unit?: string;
  department?: string;
  confidence?: number;
  period?: string;
}

export default function ForecastingPage() {
  const { events, connected } = useSSEChannel<ForecastEvent>("forecast");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.metric), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Real-Time Forecasting</h1>
          <p className="text-muted-foreground">Workforce demand prediction and resource planning</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><LineChart className="h-4 w-4" />Forecast vs Actual</CardTitle>
          <CardDescription>Real-time predictions compared to actual workforce metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Wifi className="h-8 w-8" />
              <p className="text-sm">Waiting for forecast data...</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((f, i) => {
                const pct = f.prediction > 0 ? (f.value / f.prediction) * 100 : 0;
                const variance = f.value - f.prediction;
                return (
                  <Card key={i} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{f.metric}</p>
                            {f.department && <p className="text-[10px] text-muted-foreground">{f.department} {f.period ?? ""}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{f.value}{f.unit ?? ""}</p>
                          <p className="text-[10px] text-muted-foreground">Predicted: {f.prediction}{f.unit ?? ""}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">Accuracy: {Math.round(100 - Math.abs(variance / f.prediction) * 100)}%</span>
                        <div className="flex items-center gap-1">
                          {f.confidence !== undefined && (
                            <Badge variant="secondary" className="text-[9px] h-4">{(f.confidence * 100).toFixed(0)}% confidence</Badge>
                          )}
                          <Badge variant={variance > 0 ? "warning" : variance < 0 ? "destructive" : "success"} className="text-[9px] h-4">
                            {variance > 0 ? `+${variance}` : variance < 0 ? `${variance}` : "on target"}
                          </Badge>
                        </div>
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
