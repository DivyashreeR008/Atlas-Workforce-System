"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIOrgAdvisorResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Lightbulb, BarChart3, MessageSquareText, ArrowRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OrgAdvisorPage() {
  const [query, setQuery] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.advisory.org({ query });
      return data as AIOrgAdvisorResponse;
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Organization Advisor
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <Lightbulb className="h-3 w-3" />AI Advisory
            </Badge>
          </div>
          <CardDescription>Get AI-powered organizational analysis and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <Textarea
              placeholder="Describe your organizational challenge or question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              className="w-full resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!query.trim() || mutation.isPending}>
                <MessageSquareText className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Analysis failed. Please try again.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutation.reset()}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4" />
                Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{mutation.data.answer}</p>
            </CardContent>
          </Card>

          {mutation.data.recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {mutation.data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium mt-0.5 shrink-0">
                        {i + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {mutation.data.impact_analysis && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Impact Analysis
                </CardTitle>
                <CardDescription>Key organizational metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Communication Efficiency", value: mutation.data.impact_analysis.communication_efficiency, icon: MessageSquareText },
                    { label: "Decision Speed", value: mutation.data.impact_analysis.decision_speed, icon: ArrowRight },
                    { label: "Collaboration Score", value: mutation.data.impact_analysis.collaboration_score, icon: BarChart3 },
                  ].map((metric) => {
                    const numVal = parseInt(metric.value);
                    return (
                      <Card key={metric.label} className="border-border/50">
                        <CardContent className="pt-4 text-center space-y-2">
                          <metric.icon className="h-5 w-5 mx-auto text-primary" />
                          <p className="text-xs text-muted-foreground">{metric.label}</p>
                          <p className={cn("text-2xl font-bold", numVal >= 70 ? "text-green-500" : numVal >= 40 ? "text-yellow-500" : "text-red-500")}>
                            {metric.value}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {mutation.data.impact_analysis.suggested_improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Improvements</p>
                    <div className="flex flex-wrap gap-2">
                      {mutation.data.impact_analysis.suggested_improvements.map((imp, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{imp}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
