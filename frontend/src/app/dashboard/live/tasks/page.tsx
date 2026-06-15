"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitPullRequest, Wifi } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TaskEvent {
  task_id?: string;
  title?: string;
  assignee?: string;
  status?: string;
  priority?: string;
  department?: string;
  due_date?: string;
}

export default function TasksPage() {
  const { events, connected } = useSSEChannel<TaskEvent>("task");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.title || e?.task_id), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Real-Time Tasks</h1>
          <p className="text-muted-foreground">Live task assignment and status updates</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><GitPullRequest className="h-4 w-4" />Task Updates</CardTitle>
          <CardDescription>Real-time task assignments and status changes</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for task data...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((t, i) => (
                  <div key={i} className={cn("flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30")}>
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full",
                      t.status === "completed" ? "bg-emerald-500/10" : t.status === "in_progress" ? "bg-blue-500/10" : "bg-amber-500/10")}>
                      <GitPullRequest className={cn("h-4 w-4",
                        t.status === "completed" ? "text-emerald-500" : t.status === "in_progress" ? "text-blue-500" : "text-amber-500")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {t.assignee && <span>Assigned to {t.assignee}</span>}
                        {t.department && <span>· {t.department}</span>}
                        {t.due_date && <span>· Due {new Date(t.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.priority && <Badge variant={t.priority === "high" || t.priority === "critical" ? "destructive" : t.priority === "medium" ? "warning" : "secondary"} className="text-[9px] uppercase">{t.priority}</Badge>}
                      <Badge variant={t.status === "completed" ? "success" : t.status === "in_progress" ? "default" : "secondary"}>{t.status}</Badge>
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
