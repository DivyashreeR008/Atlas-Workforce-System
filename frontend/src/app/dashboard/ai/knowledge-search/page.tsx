"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIKnowledgeResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen, TrendingUp, Hash, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(10);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.knowledge.search({ query, max_results: maxResults });
      return data as AIKnowledgeResponse;
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Knowledge Search
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <BookOpen className="h-3 w-3" />AI Knowledge Base
            </Badge>
          </div>
          <CardDescription>Search across your organizational knowledge base</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search knowledge base..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  placeholder="Results"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  min={1}
                  max={50}
                />
              </div>
              <Button type="submit" disabled={!query.trim() || mutation.isPending}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Failed to perform search. Please try again.</p>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Results</CardTitle>
                <Badge variant="secondary">{mutation.data.total} found</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mutation.data.results.map((result) => (
                <Card key={result.id} className="border-border/50">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm">{result.title}</h3>
                      <Badge variant="outline" className="text-xs">{result.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>Relevance</span>
                      <Progress value={result.relevance * 100} className="h-1.5 w-24" />
                      <span>{Math.round(result.relevance * 100)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {mutation.data.suggested_queries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4" />
                  Suggested Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {mutation.data.suggested_queries.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(q); }}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
