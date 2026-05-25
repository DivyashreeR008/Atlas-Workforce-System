"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Target,
  FileCheck,
  MessageSquare,
  UserCheck,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Star,
  ThumbsUp,
  Lightbulb,
  Users,
} from "lucide-react";
import { performanceApi } from "@/lib/api";
import type { PerformanceGoal, PerformanceReview, Feedback360, SuccessionPlan } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const goalStatusColors: Record<string, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  "on-track": "success",
  "at-risk": "warning",
  behind: "destructive",
  completed: "default",
  draft: "secondary",
};

const reviewStatusColors: Record<string, "warning" | "success" | "secondary" | "destructive"> = {
  pending: "warning",
  "in-progress": "secondary",
  completed: "success",
  cancelled: "destructive",
};

const feedbackCategoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  kudos: ThumbsUp,
  innovation: Lightbulb,
  leadership: Star,
  teamwork: Users,
  customer: MessageSquare,
};

export default function PerformancePage() {
  const [tab, setTab] = useState("goals");

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["performance-dashboard"],
    queryFn: async () => {
      const { data } = await performanceApi.dashboard();
      return data as {
        activeGoals: number;
        pendingReviews: number;
        feedbackGiven: number;
        successionReady: number;
      };
    },
  });

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["performance-goals"],
    queryFn: async () => {
      const { data } = await performanceApi.goals.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceGoal[];
    },
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["performance-reviews"],
    queryFn: async () => {
      const { data } = await performanceApi.reviews.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceReview[];
    },
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["performance-feedback"],
    queryFn: async () => {
      const { data } = await performanceApi.feedback.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as Feedback360[];
    },
  });

  const { data: succession } = useQuery({
    queryKey: ["performance-succession"],
    queryFn: async () => {
      const { data } = await performanceApi.succession.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as SuccessionPlan[];
    },
  });

  const statsCards = [
    { label: "Active Goals", value: dashData?.activeGoals ?? 0, icon: Target, color: "text-blue-600 bg-blue-500/10" },
    { label: "Pending Reviews", value: dashData?.pendingReviews ?? 0, icon: FileCheck, color: "text-amber-600 bg-amber-500/10" },
    { label: "Feedback Given", value: dashData?.feedbackGiven ?? 0, icon: MessageSquare, color: "text-purple-600 bg-purple-500/10" },
    { label: "Succession Ready", value: dashData?.successionReady ?? 0, icon: UserCheck, color: "text-emerald-600 bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Management</h1>
          <p className="text-muted-foreground">Goals, reviews, feedback, and succession planning</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          {tab === "goals" ? "New Goal" : tab === "reviews" ? "New Review" : "New Feedback"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="glass-panel">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-lg p-2.5 ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  {dashLoading ? (
                    <Skeleton className="mt-1 h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stat.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="goals">Goals & OKRs</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="feedback">Feedback Wall</TabsTrigger>
          <TabsTrigger value="succession">Succession</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">OKRs & Goals</CardTitle>
              <CardDescription>Track progress across the organization</CardDescription>
            </CardHeader>
            <CardContent>
              {goalsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : !goals || goals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Target className="h-8 w-8" />
                  <p className="text-sm">No goals created yet</p>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                    Create your first goal
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{goal.title}</span>
                            <Badge variant={goalStatusColors[goal.status] ?? "default"}>
                              {goal.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {goal.ownerName} &middot; {goal.department}
                          </p>
                        </div>
                        <span className="text-sm font-medium">{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} />
                      {goal.keyResults && goal.keyResults.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {goal.keyResults.map((kr, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{kr.title}</span>
                              <span>{kr.current} / {kr.target}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {reviewsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))
            ) : !reviews || reviews.length === 0 ? (
              <Card className="glass-panel lg:col-span-2">
                <CardContent className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <FileCheck className="h-8 w-8" />
                  <p className="text-sm">No reviews found</p>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.id} className="glass-panel">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">{review.employeeName}</CardTitle>
                        <CardDescription>{review.type} review &middot; {review.period}</CardDescription>
                      </div>
                      <Badge variant={reviewStatusColors[review.status] ?? "secondary"}>
                        {review.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-lg font-bold">{review.overallScore.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/ 5</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Reviewer: {review.reviewerName}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {review.ratings.slice(0, 3).map((r, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {r.category}: {r.score}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Peer Recognition Wall
              </CardTitle>
              <CardDescription>Recent kudos and shoutouts from the team</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : !feedback || feedback.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <ThumbsUp className="h-8 w-8" />
                  <p className="text-sm">No feedback yet. Be the first to recognize a teammate!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedback.map((fb) => {
                    const CatIcon = feedbackCategoryIcons[fb.category] ?? MessageSquare;
                    return (
                      <div
                        key={fb.id}
                        className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-xs font-medium text-primary">
                                {fb.fromName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{fb.fromName}</p>
                              <p className="text-xs text-muted-foreground">
                                to {fb.toName}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <CatIcon className="h-3 w-3" />
                            {fb.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{fb.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(fb.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="succession" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {!succession || succession.length === 0 ? (
              <Card className="glass-panel lg:col-span-2">
                <CardContent className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <UserCheck className="h-8 w-8" />
                  <p className="text-sm">No succession plans defined</p>
                </CardContent>
              </Card>
            ) : (
              succession.map((plan) => {
                const readyNow = plan.candidates.filter((c) => c.readiness === "ready-now").length;
                return (
                  <Card key={plan.id} className="glass-panel">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-medium">{plan.position}</CardTitle>
                          <CardDescription>{plan.department}</CardDescription>
                        </div>
                        <Badge
                          variant={
                            plan.riskLevel === "high"
                              ? "destructive"
                              : plan.riskLevel === "medium"
                                ? "warning"
                                : "success"
                          }
                        >
                          {plan.riskLevel} risk
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Current: {plan.currentHolder}
                      </p>
                      <div className="space-y-2">
                        {plan.candidates.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                          >
                            <span className="text-sm">{c.employeeName}</span>
                            <Badge
                              variant={
                                c.readiness === "ready-now"
                                  ? "success"
                                  : c.readiness === "ready-in-1-2"
                                    ? "warning"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {c.readiness}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <UserCheck className="h-3 w-3" />
                        {readyNow} ready now &middot; Last reviewed{" "}
                        {new Date(plan.lastReviewed).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
