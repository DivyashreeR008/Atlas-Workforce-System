"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Calendar,
  FileCheck,
  ArrowRight,
  Plus,
} from "lucide-react";
import { atsApi } from "@/lib/api";
import type { AtsDashboardStats, Job } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stageColors: Record<string, string> = {
  applied: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  screening: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  interview: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  offer: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  hired: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export default function AtsDashboardPage() {
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["ats", "overview"],
    queryFn: async () => {
      const { data } = await atsApi.getAnalyticsOverview();
      return data as AtsDashboardStats;
    },
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["ats", "jobs", "recent"],
    queryFn: async () => {
      const { data } = await atsApi.getJobs({ page: 1, pageSize: 5 });
      return (Array.isArray(data) ? data : data?.items ?? []) as Job[];
    },
  });

  const stats = overviewData ?? {
    openPositions: 0,
    totalCandidates: 0,
    interviewsToday: 0,
    offersPending: 0,
    candidatesByStage: [],
  };

  const kpiCards = [
    {
      label: "Open Positions",
      value: stats.openPositions,
      icon: Briefcase,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Total Candidates",
      value: stats.totalCandidates,
      icon: Users,
      color: "text-purple-600 bg-purple-500/10",
    },
    {
      label: "Interviews Today",
      value: stats.interviewsToday,
      icon: Calendar,
      color: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "Offers Pending",
      value: stats.offersPending,
      icon: FileCheck,
      color: "text-emerald-600 bg-emerald-500/10",
    },
  ];

  const pipelineStages = [
    { key: "applied", label: "Applied" },
    { key: "screening", label: "Screening" },
    { key: "interview", label: "Interview" },
    { key: "offer", label: "Offer" },
    { key: "hired", label: "Hired" },
  ];

  const maxStageCount = Math.max(
    ...stats.candidatesByStage.map((s) => s.count),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ATS Dashboard</h1>
          <p className="text-muted-foreground">
            Applicant tracking overview and metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/ats/candidates">
              <Users className="h-4 w-4" />
              View Candidates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/ats/jobs">
              <Plus className="h-4 w-4" />
              Post Job
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="glass-panel">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-lg p-2.5 ${kpi.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  {overviewLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{kpi.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="glass-panel lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Pipeline Overview</CardTitle>
            <CardDescription>
              Candidates by recruitment stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : stats.candidatesByStage.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">No candidate data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pipelineStages.map(({ key, label }) => {
                  const stage = stats.candidatesByStage.find(
                    (s) => s.stage === key
                  );
                  const count = stage?.count ?? 0;
                  const pct = Math.round((count / maxStageCount) * 100);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{label}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${stageColors[key]?.split(" ")[0] ?? "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Jobs</CardTitle>
                <CardDescription>Latest open positions</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/ats/jobs">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : jobsData?.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Briefcase className="h-8 w-8" />
                <p className="text-sm">No jobs posted yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobsData?.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/ats/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.department} &middot; {job.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {job.applicationsCount} applications
                      </span>
                      <Badge
                        variant={
                          job.status === "open"
                            ? "success"
                            : job.status === "closed"
                              ? "destructive"
                              : job.status === "on-hold"
                                ? "warning"
                                : "secondary"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
