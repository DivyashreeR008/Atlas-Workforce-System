"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIPolicyResponse } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  BookOpen, AlertTriangle, ChevronRight, FileText, Scale, Search, MessageSquare
} from "lucide-react";

const policyAreas = [
  "General", "Leave", "Attendance", "Code of Conduct", "Compensation",
  "Benefits", "Remote Work", "Anti-Harassment", "Data Privacy", "Health & Safety",
];

export default function PolicyAssistantPage() {
  const [query, setQuery] = useState("");
  const [policyArea, setPolicyArea] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { query: string; policy_area?: string }) =>
      aiApi.assistants.policy(data),
  });

  const result = mutation.data?.data as AIPolicyResponse | undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    mutation.mutate({ query, policy_area: policyArea || undefined });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Policy Assistant</h1>
        <p className="text-muted-foreground">Instant answers to HR policy questions with citation references</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Ask a Policy Question
          </CardTitle>
          <CardDescription>Get answers backed by official policy documents</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Your Question</Label>
              <Textarea
                placeholder="e.g., What is the maternity leave policy for new parents?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Policy Area (optional)</Label>
              <Select value={policyArea} onValueChange={setPolicyArea}>
                <SelectTrigger>
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  {policyAreas.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={mutation.isPending || !query.trim()}>
              {mutation.isPending ? "Analyzing..." : "Ask Policy Assistant"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Analyzing Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{(mutation.error as Error)?.message || "Failed to get policy answer. Please try again."}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Answer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Policy Citations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Policy</th>
                      <th className="pb-2 font-medium">Relevance</th>
                      <th className="pb-2 font-medium">Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.policy_citations.map((c, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 font-medium">{c.policy}</td>
                        <td className="py-2">
                          <Badge variant={c.relevance === "high" ? "success" : c.relevance === "medium" ? "warning" : "secondary"}>
                            {c.relevance}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{c.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {result.related_policies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Related Policies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.related_policies.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
