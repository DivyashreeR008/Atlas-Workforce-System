"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Wifi } from "lucide-react";
import { useMemo } from "react";

interface PayrollEvent {
  batch_id?: string;
  status?: string;
  processed?: number;
  total?: number;
  department?: string;
  payroll_period?: string;
  amount?: number;
}

export default function PayrollProgressPage() {
  const { events, connected } = useSSEChannel<PayrollEvent>("payroll");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.batch_id || e?.department), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll Progress</h1>
          <p className="text-muted-foreground">Real-time payroll processing status across departments</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Processing Status</CardTitle>
          <CardDescription>Payroll batch progress and completion rates</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Wifi className="h-8 w-8" />
              <p className="text-sm">Waiting for payroll data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((p, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{p.department ?? "General"}</p>
                      <p className="text-xs text-muted-foreground">{p.batch_id ? `Batch: ${p.batch_id}` : ""} {p.payroll_period ? `· ${p.payroll_period}` : ""}</p>
                    </div>
                    <span className="text-sm font-medium">{p.processed ?? 0} / {p.total ?? 0}</span>
                  </div>
                  <Progress value={p.total ? ((p.processed ?? 0) / p.total) * 100 : 0} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
