"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Clock,
  TrendingDown,
  Users,
  Briefcase,
  Filter,
} from "lucide-react";
import { atsApi } from "@/lib/api";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const funnelColors = {
  applied: "#3b82f6",
  screening: "#8b5cf6",
  interview: "#a855f7",
  offer: "#f59e0b",
  hired: "#10b981",
  rejected: "#ef4444",
};

export default function AtsAnalyticsPage() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["ats", "analytics", "overview"],
    queryFn: async () => {
      const { data } = await atsApi.getAnalyticsOverview();
      return data as {
        openPositions: number;
        totalCandidates: number;
        interviewsToday: number;
        offersPending: number;
        candidatesByStage: { stage: string; count: number }[];
      };
    },
  });

  const { data: timeToHire, isLoading: timeLoading } = useQuery({
    queryKey: ["ats", "analytics", "time-to-hire"],
    queryFn: async () => {
      const { data } = await atsApi.getTimeToHire();
      return data as { averageDays: number; byDepartment: { department: string; days: number }[] };
    },
  });

  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ["ats", "analytics", "source-effectiveness"],
    queryFn: async () => {
      const { data } = await atsApi.getSourceEffectiveness();
      return data as { source: string; count: number; hireRate: number }[];
    },
  });

  const { data: conversionFunnel, isLoading: funnelLoading } = useQuery({
    queryKey: ["ats", "analytics", "conversion-funnel"],
    queryFn: async () => {
      const { data } = await atsApi.getConversionFunnel();
      return data as { stage: string; count: number }[];
    },
  });

  const pipelineStages = [
    { key: "applied", label: "Applied" },
    { key: "screening", label: "Screening" },
    { key: "interview", label: "Interview" },
    { key: "offer", label: "Offer" },
    { key: "hired", label: "Hired" },
  ];

  const funnelData =
    conversionFunnel ??
    pipelineStages.map((s) => ({
      stage: s.label,
      count:
        overview?.candidatesByStage.find((cs) => cs.stage === s.key)?.count ??
        0,
    }));

  const sourceChartData =
    sourceData?.map((s) => ({
      name: s.source.charAt(0).toUpperCase() + s.source.slice(1),
      value: s.count,
      rate: s.hireRate,
    })) ?? [];

  const statsCards = [
    {
      label: "Open Positions",
      value: overview?.openPositions ?? 0,
      icon: Briefcase,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Total Candidates",
      value: overview?.totalCandidates ?? 0,
      icon: Users,
      color: "text-purple-600 bg-purple-500/10",
    },
    {
      label: "Avg Time to Hire",
      value: timeToHire?.averageDays ?? 0,
      suffix: " days",
      icon: Clock,
      color: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "Conversion Rate",
      value:
        funnelData.length > 0 && funnelData[0].count > 0
          ? Math.round(
              ((funnelData.find((d) => d.stage === "Hired")?.count ?? 0) /
                funnelData[0].count) *
                100
            )
          : 0,
      suffix: "%",
      icon: TrendingDown,
      color: "text-emerald-600 bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ATS Analytics</h1>
        <p className="text-muted-foreground">
          Recruitment metrics and insights
        </p>
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
                  {overviewLoading || timeLoading ? (
                    <Skeleton className="mt-1 h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {stat.value}
                      {stat.suffix ?? ""}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>
              Candidate progression through hiring stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="space-y-4">
                {funnelData.map((item, i) => {
                  const prev = i > 0 ? funnelData[i - 1].count : item.count;
                  const dropRate =
                    prev > 0
                      ? Math.round(((prev - item.count) / prev) * 100)
                      : 0;
                  const maxCount = Math.max(...funnelData.map((d) => d.count), 1);
                  return (
                    <div key={item.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                funnelColors[
                                  item.stage.toLowerCase() as keyof typeof funnelColors
                                ] ?? "#6b7280",
                            }}
                          />
                          <span>{item.stage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.count}</span>
                          {i > 0 && (
                            <Badge
                              variant={dropRate > 50 ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              -{dropRate}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.count / maxCount) * 100}%`,
                            backgroundColor:
                              funnelColors[
                                item.stage.toLowerCase() as keyof typeof funnelColors
                              ] ?? "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" />
              Source Breakdown
            </CardTitle>
            <CardDescription>
              Candidate distribution by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sourceLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : sourceChartData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8" />
                <p className="text-sm">No source data available</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {sourceChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            [
                              "#3b82f6",
                              "#8b5cf6",
                              "#10b981",
                              "#f59e0b",
                              "#ef4444",
                              "#ec4899",
                            ][i % 6]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 w-full space-y-2">
                  {sourceChartData.map((item, i) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{item.value}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.rate ? `${(item.rate * 100).toFixed(0)}% hire` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Time to Hire by Department
          </CardTitle>
          <CardDescription>
            Average days to hire broken down by department
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : !timeToHire?.byDepartment ||
            timeToHire.byDepartment.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Clock className="h-8 w-8" />
              <p className="text-sm">No time-to-hire data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timeToHire.byDepartment}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Days",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                  {timeToHire.byDepartment.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"][
                          i % 5
                        ]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
