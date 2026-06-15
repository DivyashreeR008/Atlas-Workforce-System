"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Wifi } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ComplianceEvent {
  policy: string;
  status: string;
  score?: number;
  violations?: number;
  department?: string;
  last_checked?: string;
  details?: string;
}

export default function ComplianceViolationsPage() {
  const { events, connected } = useSSEChannel<ComplianceEvent>("compliance");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.policy), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Violations</h1>
          <p className="text-muted-foreground">Real-time compliance monitoring and policy adherence</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Compliance Status</CardTitle>
          <CardDescription>Real-time policy compliance across departments</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for compliance data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((c, i) => (
                  <div key={i} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium">{c.policy}</p>
                        {c.department && <p className="text-xs text-muted-foreground">{c.department}</p>}
                      </div>
                      <Badge variant={c.status === "compliant" ? "success" : c.status === "warning" ? "warning" : "destructive"}>{c.status}</Badge>
                    </div>
                    {c.score !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Compliance Score</span>
                          <span>{c.score}%</span>
                        </div>
                        <Progress value={c.score} className={cn("h-2", c.score < 70 ? "bg-rose-500/20" : c.score < 85 ? "bg-amber-500/20" : "bg-emerald-500/20")} />
                      </div>
                    )}
                    {c.violations !== undefined && c.violations > 0 && (
                      <p className="text-xs text-rose-500 mt-2">{c.violations} violation{c.violations > 1 ? "s" : ""} detected{c.details ? `: ${c.details}` : ""}</p>
                    )}
                    {c.last_checked && <p className="text-[10px] text-muted-foreground mt-1">Last checked: {new Date(c.last_checked).toLocaleString()}</p>}
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
