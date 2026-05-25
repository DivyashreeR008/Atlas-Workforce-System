"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  DollarSign,
  Briefcase,
  GraduationCap,
  Smile,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Activity,
  Heart,
  Zap,
  ArrowRight,
  UserMinus,
} from "lucide-react";
import { commandCenterApi, analyticsApi } from "@/lib/api";
import type {
  CommandCenterMetrics,
  OrgHealthMetric,
  DepartmentPerformance,
  ActivityEvent,
  AIInsight,
} from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency } from "@/lib/utils";

const kpiConfig = [
  { key: "totalHeadcount", label: "Total Headcount", icon: Users, color: "text-blue-600 bg-blue-500/10", format: "number" as const },
  { key: "payrollMtd", label: "Payroll MTD", icon: DollarSign, color: "text-emerald-600 bg-emerald-500/10", format: "currency" as const },
  { key: "openPositions", label: "Open Positions", icon: Briefcase, color: "text-amber-600 bg-amber-500/10", format: "number" as const },
  { key: "trainingCompletion", label: "Training Completion", icon: GraduationCap, color: "text-purple-600 bg-purple-500/10", format: "percent" as const },
  { key: "satisfactionScore", label: "Satisfaction Score", icon: Smile, color: "text-rose-600 bg-rose-500/10", format: "percent" as const },
];

const orgHealthCategories = [
  { key: "engagement", label: "Engagement", color: "text-emerald-500" },
  { key: "productivity", label: "Productivity", color: "text-blue-500" },
  { key: "retention", label: "Retention", color: "text-purple-500" },
  { key: "culture", label: "Culture", color: "text-amber-500" },
  { key: "innovation", label: "Innovation", color: "text-rose-500" },
];

const activityTypeConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  hire: { color: "text-emerald-500 bg-emerald-500/10", icon: Users },
  promotion: { color: "text-blue-500 bg-blue-500/10", icon: TrendingUp },
  departure: { color: "text-rose-500 bg-rose-500/10", icon: UserMinus },
  training: { color: "text-purple-500 bg-purple-500/10", icon: GraduationCap },
  achievement: { color: "text-amber-500 bg-amber-500/10", icon: Zap },
  leave: { color: "text-orange-500 bg-orange-500/10", icon: Activity },
};

const impactColors: Record<string, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

function percent(value: number) {
  return `${Math.round(value)}%`;
}

export default function CommandCenterPage() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["command-center-metrics"],
    queryFn: async () => {
      const { data } = await commandCenterApi.metrics();
      return data as CommandCenterMetrics;
    },
  });

  const { data: orgHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["command-center-org-health"],
    queryFn: async () => {
      const { data } = await commandCenterApi.orgHealth();
      return (Array.isArray(data) ? data : []) as OrgHealthMetric[];
    },
  });

  const { data: deptPerf, isLoading: deptLoading } = useQuery({
    queryKey: ["command-center-dept-performance"],
    queryFn: async () => {
      const { data } = await commandCenterApi.departmentPerformance();
      return (Array.isArray(data) ? data : []) as DepartmentPerformance[];
    },
  });

  const { data: activityFeed, isLoading: activityLoading } = useQuery({
    queryKey: ["command-center-activity"],
    queryFn: async () => {
      const { data } = await commandCenterApi.activityFeed({ limit: 10 });
      return (Array.isArray(data) ? data : []) as ActivityEvent[];
    },
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["command-center-insights"],
    queryFn: async () => {
      const { data } = await commandCenterApi.insights();
      return (Array.isArray(data) ? data : []) as AIInsight[];
    },
  });

  const { data: attritionRisks, isLoading: attritionLoading } = useQuery({
    queryKey: ["command-center-attrition"],
    queryFn: async () => {
      const { data } = await commandCenterApi.attritionRisks();
      return (Array.isArray(data) ? data : []) as { employee: string; department: string; risk: number; reason: string }[];
    },
  });

  const defaultMetrics: CommandCenterMetrics = {
    totalHeadcount: 1248,
    payrollMtd: 2840000,
    openPositions: 23,
    trainingCompletion: 86,
    satisfactionScore: 4.2,
    orgHealth: 78,
    attritionRate: 12,
    avgTenure: 3.4,
  };

  const m = metrics ?? defaultMetrics;
  const healthScore = m.orgHealth;

  const kpiValues: Record<string, number> = {
    totalHeadcount: m.totalHeadcount,
    payrollMtd: m.payrollMtd,
    openPositions: m.openPositions,
    trainingCompletion: m.trainingCompletion,
    satisfactionScore: m.satisfactionScore,
  };

  const defaultOrgHealth: OrgHealthMetric[] = [
    { category: "engagement", score: 82, change: 3 },
    { category: "productivity", score: 78, change: -2 },
    { category: "retention", score: 74, change: 5 },
    { category: "culture", score: 71, change: 1 },
    { category: "innovation", score: 68, change: -4 },
  ];

  const healthCategories = (orgHealth?.length ? orgHealth : defaultOrgHealth).map((h) => {
    const cfg = orgHealthCategories.find((c) => c.key === h.category);
    return { ...h, color: cfg?.color ?? "text-muted-foreground", label: cfg?.label ?? h.category };
  });

  const defaultDeptData: DepartmentPerformance[] = [
    { department: "Engineering", productivity: 92, engagement: 85, headcount: 420, attrition: 8, budgetUtilization: 88 },
    { department: "Sales", productivity: 88, engagement: 72, headcount: 280, attrition: 15, budgetUtilization: 92 },
    { department: "Operations", productivity: 85, engagement: 78, headcount: 210, attrition: 10, budgetUtilization: 76 },
    { department: "HR", productivity: 90, engagement: 82, headcount: 95, attrition: 5, budgetUtilization: 70 },
    { department: "Finance", productivity: 87, engagement: 80, headcount: 143, attrition: 6, budgetUtilization: 85 },
    { department: "Marketing", productivity: 83, engagement: 76, headcount: 100, attrition: 12, budgetUtilization: 80 },
  ];

  const departments = deptPerf?.length ? deptPerf : defaultDeptData;

  const defaultActivity: ActivityEvent[] = [
    { id: "1", type: "hire", actor: "Sarah Chen", description: "joined Engineering as Senior Developer", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    { id: "2", type: "promotion", actor: "James Wilson", description: "promoted to Team Lead in Sales", timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    { id: "3", type: "training", actor: "Maria Garcia", description: "completed Advanced Leadership Program", timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
    { id: "4", type: "achievement", actor: "David Kim", description: "reached 100% quota for Q2", timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
    { id: "5", type: "departure", actor: "Lisa Park", description: "departed from Marketing", timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString() },
  ];

  const activities = activityFeed?.length ? activityFeed : defaultActivity;

  const defaultInsights: AIInsight[] = [
    { id: "1", type: "opportunity", title: "High-performing sales team", description: "Sales team exceeding targets by 22%. Consider scaling best practices across regions.", impact: "high", category: "Performance", timestamp: new Date().toISOString() },
    { id: "2", type: "recommendation", title: "Engineering retention initiative", description: "Attrition in Engineering up 15% QoQ. Recommend stay interviews and comp review.", impact: "high", category: "Retention", timestamp: new Date().toISOString() },
    { id: "3", type: "risk", title: "Skill gap in AI/ML", description: "42% of critical AI/ML roles unfilled. Consider upskilling program.", impact: "medium", category: "Talent", timestamp: new Date().toISOString() },
    { id: "4", type: "trend", title: "Remote work preference rising", description: "68% of employees prefer hybrid. Office attendance down 12% from last quarter.", impact: "medium", category: "Culture", timestamp: new Date().toISOString() },
    { id: "5", type: "recommendation", title: "Q3 hiring plan adjustment", description: "Recommend accelerating 15 engineering hires to meet product roadmap.", impact: "high", category: "Planning", timestamp: new Date().toISOString() },
  ];

  const aiInsights = insights?.length ? insights : defaultInsights;

  const defaultAttritionRisks = [
    { employee: "Alex Rivera", department: "Engineering", risk: 87, reason: "Passive job seeker, below market comp" },
    { employee: "Emily Watson", department: "Sales", risk: 76, reason: "No promotion in 3 years" },
    { employee: "Mike Johnson", department: "Operations", risk: 65, reason: "Work-life balance concerns" },
    { employee: "Priya Sharma", department: "Engineering", risk: 62, reason: "Relocation likely" },
  ];

  const risks = attritionRisks?.length ? attritionRisks : defaultAttritionRisks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground">
          Executive overview with real-time workforce intelligence
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiConfig.map((kpi, i) => {
          const Icon = kpi.icon;
          const val = kpiValues[kpi.key as keyof typeof kpiValues] ?? 0;
          const display =
            kpi.format === "currency"
              ? formatCurrency(val)
              : kpi.format === "percent"
                ? percent(val)
                : val.toLocaleString();
          return (
            <Card key={kpi.key} className="glass-panel">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${kpi.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{kpi.label}</p>
                  {metricsLoading ? (
                    <Skeleton className="mt-1 h-6 w-16" />
                  ) : (
                    <p className="text-lg font-bold">{display}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="space-y-6 lg:col-span-4">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-base">Organization Health</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none" stroke={healthScore >= 75 ? "#10b981" : healthScore >= 50 ? "#f59e0b" : "#f43f5e"}
                      strokeWidth="8"
                      strokeDasharray={`${(healthScore / 100) * 263.89} 263.89`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold">{healthScore}%</span>
                    <span className="text-xs text-muted-foreground">health</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {healthCategories.map((h) => (
                    <div key={h.category} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={h.color}>{h.label}</span>
                        <span className="font-medium">{h.score}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-current transition-all duration-500"
                          style={{ width: `${h.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Department Performance
                </CardTitle>
              </div>
              <CardDescription>Productivity and engagement heatmap</CardDescription>
            </CardHeader>
            <CardContent>
              {deptLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {departments.map((dept) => {
                    const avgScore = Math.round((dept.productivity + dept.engagement) / 2);
                    const perfColor =
                      avgScore >= 85
                        ? "border-l-emerald-500"
                        : avgScore >= 70
                          ? "border-l-amber-500"
                          : "border-l-rose-500";
                    return (
                      <div
                        key={dept.department}
                        className={cn(
                          "rounded-lg border border-l-4 bg-card/50 p-3 transition-colors hover:bg-muted/30",
                          perfColor
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-sm">{dept.department}</span>
                          <span className="text-xs text-muted-foreground">{dept.headcount} people</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Productivity</span>
                            <div className="flex items-center gap-1 font-medium">
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                              {dept.productivity}%
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Engagement</span>
                            <div className="flex items-center gap-1 font-medium">
                              <Heart className="h-3 w-3 text-rose-500" />
                              {dept.engagement}%
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Attrition</span>
                            <div className="font-medium">{dept.attrition}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Budget</span>
                            <div className="font-medium">{dept.budgetUtilization}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-amber-500" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insightsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              ) : (
                aiInsights.slice(0, 4).map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium">{insight.title}</span>
                      <Badge variant={impactColors[insight.impact] ?? "secondary"} className="ml-auto text-xs">
                        {insight.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Attrition Risk Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attritionLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))
              ) : (
                risks.slice(0, 4).map((risk) => (
                  <div
                    key={risk.employee}
                    className="flex items-center gap-3 rounded-lg border p-2.5"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-rose-500/10 text-xs text-rose-600">
                        {risk.employee.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{risk.employee}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {risk.department} &middot; {risk.reason}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          risk.risk >= 80
                            ? "text-rose-500"
                            : risk.risk >= 65
                              ? "text-amber-500"
                              : "text-muted-foreground"
                        )}
                      >
                        {risk.risk}%
                      </span>
                      <p className="text-xs text-muted-foreground">risk</p>
                    </div>
                  </div>
                ))
              )}
              <Button variant="ghost" size="sm" className="w-full text-xs">
                View All Risks
                <ArrowRight className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Real-time Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : (
                activities.slice(0, 5).map((event) => {
                  const cfg = activityTypeConfig[event.type] ?? { color: "text-muted-foreground bg-muted", icon: Activity };
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/30"
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${cfg.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{event.actor}</span>
                          <span className="text-muted-foreground"> {event.description}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
