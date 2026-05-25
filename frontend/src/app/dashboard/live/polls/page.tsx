"use client";

import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { BarChart3, Vote, Wifi } from "lucide-react";
import { useMemo, useState } from "react";

interface PollEvent {
  poll_id?: string;
  question?: string;
  options?: { label: string; votes: number }[];
  total_votes?: number;
  status?: string;
  department?: string;
  expires_at?: string;
}

export default function PollsPage() {
  const { events, connected } = useSSEChannel<PollEvent>("polls");
  const items = useMemo(() => events.map((e) => e.data).filter((e) => e?.question), [events]);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  const handleVote = (pollId: string) => {
    setVoted((prev) => new Set(prev).add(pollId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Polls</h1>
          <p className="text-muted-foreground">Real-time employee polling and voting</p>
        </div>
        <LiveIndicator connected={connected} />
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Vote className="h-4 w-4" />Active Polls</CardTitle>
          <CardDescription>{items.length} active polls</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Wifi className="h-8 w-8" />
                <p className="text-sm">No active polls</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((poll, i) => {
                  const total = poll.total_votes ?? poll.options?.reduce((sum, o) => sum + o.votes, 0) ?? 0;
                  return (
                    <Card key={poll.poll_id ?? i} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{poll.question}</p>
                          </div>
                          <Badge>{total} votes</Badge>
                        </div>
                        {poll.department && <p className="text-xs text-muted-foreground mb-3">{poll.department} department</p>}
                        {poll.options && (
                          <div className="space-y-2 mb-3">
                            {poll.options.map((opt, j) => {
                              const pct = total > 0 ? (opt.votes / total) * 100 : 0;
                              return (
                                <div key={j} className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span>{opt.label}</span>
                                    <span className="font-medium">{opt.votes} ({Math.round(pct)}%)</span>
                                  </div>
                                  <Progress value={pct} className="h-3" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          {poll.status && <Badge variant="outline" className="text-[10px]">{poll.status}</Badge>}
                          {poll.expires_at && <span className="text-[10px] text-muted-foreground">Expires {new Date(poll.expires_at).toLocaleString()}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
