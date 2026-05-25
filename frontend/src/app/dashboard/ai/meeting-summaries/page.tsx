"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle, FileText, ListChecks, CheckCircle2, GitPullRequest,
  MessageSquare,
} from "lucide-react";

interface FormData {
  transcript: string;
  meeting_type: string;
  attendees: string;
}

interface MeetingResult {
  summary: string;
  key_points: string[];
  action_items: string[];
  decisions: string[];
  follow_ups: string[];
}

export default function MeetingSummariesPage() {
  const [form, setForm] = useState<FormData>({
    transcript: "",
    meeting_type: "",
    attendees: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const attendees = form.attendees
        ? form.attendees.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const { data } = await aiApi.summaries.meeting({
        transcript: form.transcript,
        meeting_type: form.meeting_type || undefined,
        attendees,
      });
      return data as MeetingResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meeting Summaries</h1>
        <p className="text-muted-foreground">
          AI-generated meeting notes, key points, and action items from transcripts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
          <CardDescription>Paste the meeting transcript and provide context</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                value={form.transcript}
                onChange={(e) => setForm({ ...form, transcript: e.target.value })}
                placeholder="Paste the full meeting transcript here..."
                className="min-h-40"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meeting_type">Meeting Type</Label>
                <Input
                  id="meeting_type"
                  value={form.meeting_type}
                  onChange={(e) => setForm({ ...form, meeting_type: e.target.value })}
                  placeholder="e.g. Sprint Retrospective"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendees">Attendees (comma-separated)</Label>
                <Input
                  id="attendees"
                  value={form.attendees}
                  onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                  placeholder="e.g. Alice, Bob, Charlie"
                />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Summarizing..." : "Generate Summary"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(mutation.error as Error)?.message || "Failed to summarize meeting."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <ScrollArea className="max-h-[800px]">
          <div className="space-y-6 pr-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{mutation.data.summary}</p>
              </CardContent>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ListChecks className="h-4 w-4 text-blue-500" />
                    Key Points
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mutation.data.key_points.length > 0 ? (
                    <ul className="space-y-2">
                      {mutation.data.key_points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No key points extracted.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mutation.data.action_items.length > 0 ? (
                    <ul className="space-y-2">
                      {mutation.data.action_items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No action items extracted.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <GitPullRequest className="h-4 w-4 text-purple-500" />
                    Decisions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mutation.data.decisions.length > 0 ? (
                    <ul className="space-y-2">
                      {mutation.data.decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No decisions recorded.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-amber-500" />
                    Follow-ups
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mutation.data.follow_ups.length > 0 ? (
                    <ul className="space-y-2">
                      {mutation.data.follow_ups.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No follow-ups identified.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
