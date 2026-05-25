"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Wifi } from "lucide-react";
import { useMemo } from "react";

interface OnboardingEvent {
  employee_name?: string;
  stage?: string;
  progress?: number;
  department?: string;
  mentor?: string;
  start_date?: string;
  status?: string;
}

export default function OnboardingPage() {
  const { events, connected } = useSSEChannel<OnboardingEvent>("onboarding");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.employee_name), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding Progress</h1>
          <p className="text-muted-foreground">Real-time employee onboarding status tracking</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Active Onboarding</CardTitle>
          <CardDescription>{items.length} employees in onboarding</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for onboarding data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((o, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{o.employee_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {o.department && <span>{o.department}</span>}
                          {o.mentor && <span>· Mentor: {o.mentor}</span>}
                          {o.stage && <span>· Stage: {o.stage}</span>}
                        </div>
                      </div>
                      <Badge variant={o.status === "completed" ? "success" : o.status === "in_progress" ? "default" : "secondary"}>{o.status ?? "pending"}</Badge>
                    </div>
                    {o.progress !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Completion</span>
                          <span>{o.progress}%</span>
                        </div>
                        <Progress value={o.progress} className="h-2" />
                      </div>
                    )}
                    {o.start_date && <p className="text-[10px] text-muted-foreground mt-1">Started: {new Date(o.start_date).toLocaleDateString()}</p>}
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
