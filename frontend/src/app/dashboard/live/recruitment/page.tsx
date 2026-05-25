"use client";

export const dynamic = "force-dynamic";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Wifi } from "lucide-react";
import { useMemo } from "react";

interface RecruitmentEvent {
  candidate_name?: string;
  position?: string;
  stage?: string;
  status?: string;
  score?: number;
  department?: string;
  recruiter?: string;
}

export default function RecruitmentPage() {
  const { events, connected } = useSSEChannel<RecruitmentEvent>("recruitment");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.candidate_name), [events]);

  const stageOrder = ["sourced", "applied", "screened", "interviewing", "offered", "hired", "rejected"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recruitment Pipeline</h1>
          <p className="text-muted-foreground">Real-time candidate tracking through the hiring pipeline</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" />Candidate Pipeline</CardTitle>
          <CardDescription>{items.length} active candidates</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for recruitment data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((r, i) => (
                  <div key={i} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{r.candidate_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {r.position && <span>{r.position}</span>}
                          {r.department && <span>· {r.department}</span>}
                          {r.recruiter && <span>· Recruiter: {r.recruiter}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "hired" ? "success" : r.status === "rejected" ? "destructive" : r.status === "offered" ? "warning" : "secondary"}>
                          {r.status ?? r.stage}
                        </Badge>
                      </div>
                    </div>
                    {r.score !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Fit Score</span>
                          <span>{r.score}%</span>
                        </div>
                        <Progress value={r.score} className="h-2" />
                      </div>
                    )}
                    {r.stage && stageOrder.indexOf(r.stage) >= 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {stageOrder.map((s) => (
                          <div key={s} className={`h-1.5 flex-1 rounded-full ${stageOrder.indexOf(r.stage!) >= stageOrder.indexOf(s) ? "bg-primary" : "bg-muted"}`} />
                        ))}
                        <span className="text-[9px] text-muted-foreground ml-1 capitalize">{r.stage}</span>
                      </div>
                    )}
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
