"use client";


import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio, Siren, Wifi, Send, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface EmergencyEvent {
  id?: string;
  title?: string;
  message?: string;
  severity?: string;
  type?: string;
  source?: string;
  department?: string;
  timestamp?: string;
  acknowledged?: boolean;
}

export default function EmergencyBroadcastPage() {
  const { events, connected } = useSSEChannel<EmergencyEvent>("emergency");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.title), [events]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"critical" | "high" | "medium">("critical");

  const handleSend = () => {
    if (!title.trim()) return;
    setTitle("");
    setMessage("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emergency Broadcast</h1>
          <p className="text-muted-foreground">Send and monitor emergency alerts across the organization</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-panel border-rose-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-rose-500" />
              New Broadcast
            </CardTitle>
            <CardDescription>Send an emergency alert to all employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Alert title..." value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Detailed message..." className="min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="flex items-center gap-2">
              {(["critical", "high", "medium"] as const).map((s) => (
                <Button
                  key={s}
                  variant={severity === s ? "default" : "outline"}
                  size="sm"
                  className={severity === s && s === "critical" ? "bg-rose-600 hover:bg-rose-700" : undefined}
                  onClick={() => setSeverity(s)}
                >
                  {s === "critical" ? "🔴" : s === "high" ? "🟠" : "🟡"} {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
            <Button onClick={handleSend} className="w-full" disabled={!title.trim()}>
              <Send className="h-4 w-4 mr-2" /> Broadcast Alert
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Radio className="h-4 w-4" />Broadcast History</CardTitle>
            <CardDescription>{items.length} broadcasts</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Wifi className="h-8 w-8" />
                  <p className="text-sm">No broadcasts yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((b, i) => (
                    <div key={b.id ?? i} className={cn("rounded-lg border p-3",
                      b.severity === "critical" && "border-rose-500/30 bg-rose-500/5")}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5", b.severity === "critical" ? "text-rose-500" : b.severity === "high" ? "text-orange-500" : "text-amber-500")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{b.title}</p>
                          <p className="text-xs text-muted-foreground">{b.message}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                            {b.source && <span>{b.source}</span>}
                            {b.department && <span>· {b.department}</span>}
                            {b.timestamp && <span>· {new Date(b.timestamp).toLocaleTimeString()}</span>}
                          </div>
                        </div>
                        <Badge variant={b.severity === "critical" ? "destructive" : b.severity === "high" ? "warning" : "secondary"} className="uppercase text-[9px] shrink-0">
                          {b.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
