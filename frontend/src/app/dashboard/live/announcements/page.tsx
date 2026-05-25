"use client";

export const dynamic = "force-dynamic";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Megaphone, Wifi } from "lucide-react";
import { useMemo } from "react";

interface AnnouncementEvent {
  title?: string;
  message?: string;
  priority?: string;
  author?: string;
  department?: string;
  timestamp?: string;
}

export default function AnnouncementsPage() {
  const { events, connected } = useSSEChannel<AnnouncementEvent>("announcement");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.title), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">Live company-wide announcements and broadcasts</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" />Live Announcements</CardTitle>
          <CardDescription>{items.length} announcements</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">Waiting for announcements...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((a, i) => (
                  <Card key={i} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          {a.author && <p className="text-xs text-muted-foreground">Posted by {a.author}{a.department ? ` · ${a.department}` : ""}</p>}
                        </div>
                        {a.priority && <Badge variant={a.priority === "high" ? "destructive" : a.priority === "medium" ? "warning" : "secondary"}>{a.priority}</Badge>}
                      </div>
                      {a.message && <p className="text-sm text-muted-foreground mt-2">{a.message}</p>}
                      {a.timestamp && <p className="text-[10px] text-muted-foreground mt-2">{new Date(a.timestamp).toLocaleString()}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
