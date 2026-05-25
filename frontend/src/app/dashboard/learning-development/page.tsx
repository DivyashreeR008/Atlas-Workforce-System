"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  GraduationCap, BookOpen, Award, TrendingUp, Users, Target,
  Shield, Lightbulb, UserCheck, Store, FileText, BarChart3,
  CheckCircle, Clock, AlertTriangle, Star, Zap, Search,
  Filter, Plus, ChevronRight, ExternalLink, Sparkles,
} from "lucide-react";
import { ldApi } from "@/lib/api";
import type {
  LearningAnalyticsOverview, ComplianceTraining, ComplianceDashboard,
  LearningRecommendation, MentorProfile, MentorSession,
  MarketplaceListing, KnowledgeArticle, SkillEndorsement,
  CompetencyFramework, CompetencyMatrixResult, LearningJourney,
} from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatPercent(v: number) { return `${Math.round(v)}%`; }
function formatNumber(v: number) { return v.toLocaleString(); }

function scoreColor(v: number): string {
  if (v >= 80) return "text-emerald-500";
  if (v >= 60) return "text-amber-500";
  return "text-rose-500";
}

function scoreBg(v: number): string {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    HIGH: "destructive", MEDIUM: "warning", LOW: "secondary",
    COMPLETED: "success", PENDING: "secondary", IN_PROGRESS: "warning",
    OVERDUE: "destructive", ACTIVE: "success", PUBLISHED: "success",
    DRAFT: "secondary", SCHEDULED: "warning", CANCELLED: "destructive",
  };
  return <Badge variant={map[severity] ?? "secondary"} className="text-[10px] px-1.5 py-0">{severity}</Badge>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function SectionHeader({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const COLORS = ["#10b981","#f59e0b","#ef4444","#6366f1","#ec4899","#14b8a6","#8b5cf6"];

export default function LearningDevelopmentPage() {
  const [tab, setTab] = useState("overview");

  const { data: overview, isLoading: ol } = useQuery({
    queryKey: ["ld-overview"],
    queryFn: async () => {
      const { data } = await ldApi.overview();
      return data as LearningAnalyticsOverview;
    },
  });

  const { data: complianceDash } = useQuery({
    queryKey: ["ld-compliance-dash"],
    queryFn: async () => {
      const { data } = await ldApi.compliance.dashboard();
      return data as ComplianceDashboard;
    },
  });

  const { data: complianceList } = useQuery({
    queryKey: ["ld-compliance-list"],
    queryFn: async () => {
      const { data } = await ldApi.compliance.list({ page_size: 10 });
      return data.data as ComplianceTraining[];
    },
  });

  const { data: recs } = useQuery({
    queryKey: ["ld-recommendations"],
    queryFn: async () => {
      const { data } = await ldApi.recommendations.list();
      return data.data as LearningRecommendation[];
    },
  });

  const { data: mentors } = useQuery({
    queryKey: ["ld-mentors"],
    queryFn: async () => {
      const { data } = await ldApi.mentors.list();
      return data.data as MentorProfile[];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["ld-sessions"],
    queryFn: async () => {
      const { data } = await ldApi.mentorSessions.list();
      return data.data as MentorSession[];
    },
  });

  const { data: marketplaceItems } = useQuery({
    queryKey: ["ld-marketplace"],
    queryFn: async () => {
      const { data } = await ldApi.marketplace.list({ page_size: 8 });
      return data.data as MarketplaceListing[];
    },
  });

  const { data: knowledgeArticles } = useQuery({
    queryKey: ["ld-knowledge"],
    queryFn: async () => {
      const { data } = await ldApi.knowledge.list({ page_size: 8 });
      return data.data as KnowledgeArticle[];
    },
  });

  const { data: competencyMatrix } = useQuery({
    queryKey: ["ld-competency"],
    queryFn: async () => {
      const { data } = await ldApi.competencyMatrix();
      return data.data as CompetencyMatrixResult[];
    },
  });

  const { data: journeys } = useQuery({
    queryKey: ["ld-journeys"],
    queryFn: async () => {
      const { data } = await ldApi.journeys.list();
      return data.data as LearningJourney[];
    },
  });

  const { data: endorsements } = useQuery({
    queryKey: ["ld-endorsements"],
    queryFn: async () => {
      const { data } = await ldApi.endorsements.list();
      return data.data as SkillEndorsement[];
    },
  });

  const { data: deptData } = useQuery({
    queryKey: ["ld-departments"],
    queryFn: async () => {
      const { data } = await ldApi.departments();
      return data.data as { department: string; total_enrolled: number; completed: number; in_progress: number }[];
    },
  });

  const { data: trendData } = useQuery({
    queryKey: ["ld-trends"],
    queryFn: async () => {
      const { data } = await ldApi.trends("monthly");
      return data.data as { period: string; enrollments: number; completions: number }[];
    },
  });

  const statCards = ol ? [] : [
    { label: "Courses", value: overview?.courses.total ?? 0, icon: BookOpen },
    { label: "Completion Rate", value: formatPercent(overview?.completion_rate ?? 0), icon: TrendingUp },
    { label: "Certifications", value: overview?.certifications.active ?? 0, icon: Award },
    { label: "Compliance Rate", value: formatPercent(overview?.compliance.rate ?? 0), icon: Shield },
    { label: "Skills", value: overview?.skills.total ?? 0, icon: Target },
    { label: "Knowledge Articles", value: overview?.knowledge_articles ?? 0, icon: FileText },
  ];

  const chartData = [
    { name: "Courses", value: overview?.courses.total ?? 0 },
    { name: "Enrollments", value: overview?.enrollments.total ?? 0 },
    { name: "Certifications", value: overview?.certifications.total ?? 0 },
    { name: "Assessments", value: overview?.assessments.total ?? 0 },
    { name: "Compliance", value: overview?.compliance.total ?? 0 },
    { name: "Articles", value: overview?.knowledge_articles ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learning & Development</h1>
        <p className="text-muted-foreground">Strategic learning, compliance, mentoring, and knowledge management</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="glass-panel w-full flex-wrap gap-1 p-1">
          <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Overview</TabsTrigger>
          <TabsTrigger value="compliance" className="flex-1 min-w-[100px]">Compliance</TabsTrigger>
          <TabsTrigger value="competency" className="flex-1 min-w-[100px]">Competency</TabsTrigger>
          <TabsTrigger value="recommendations" className="flex-1 min-w-[100px]">AI Recommendations</TabsTrigger>
          <TabsTrigger value="mentoring" className="flex-1 min-w-[100px]">Mentoring</TabsTrigger>
          <TabsTrigger value="marketplace" className="flex-1 min-w-[100px]">Marketplace</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 min-w-[100px]">Analytics</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6">
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {ol ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-panel"><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
            )) : statCards.map((s) => (
              <motion.div key={s.label} variants={itemVariants}>
                <Card className="glass-panel">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{s.value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Learning Overview</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Monthly Trends</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="enrollments" stroke="#10b981" strokeWidth={2} dot={false} name="Enrollments" />
                    <Line type="monotone" dataKey="completions" stroke="#6366f1" strokeWidth={2} dot={false} name="Completions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={GraduationCap} title="Learning Journeys" />
              </CardHeader>
              <CardContent className="space-y-3">
                {!journeys ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />) : journeys.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">No learning journeys yet</p>
                ) : journeys.slice(0, 5).map((j) => (
                  <div key={j.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{j.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        {j.target_role ?? "No target role"} &middot; Step {j.current_step + 1}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={j.progress_pct} className="w-20 h-2" />
                      <span className="text-xs w-10 text-right">{Math.round(j.progress_pct)}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={Star} title="Recent Endorsements" />
              </CardHeader>
              <CardContent className="space-y-3">
                {!endorsements ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />) : endorsements.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">No endorsements yet</p>
                ) : endorsements.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{e.skill_name}</p>
                      <p className="text-xs text-muted-foreground">Endorsed by {e.endorser_name ?? e.endorsed_by}</p>
                    </div>
                    <Badge variant="success">{e.proficiency}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === COMPLIANCE TAB === */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-panel">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{complianceDash?.total ?? 0}</div></CardContent>
            </Card>
            <Card className="glass-panel border-emerald-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-500">Completed</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-emerald-500">{complianceDash?.completed ?? 0}</div></CardContent>
            </Card>
            <Card className="glass-panel border-amber-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-500">Pending</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-amber-500">{complianceDash?.pending ?? 0}</div></CardContent>
            </Card>
            <Card className="glass-panel border-rose-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-rose-500">Overdue</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-rose-500">{complianceDash?.overdue ?? 0}</div></CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Compliance by Policy</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={complianceDash?.by_policy ?? []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="policy_name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" fill="#e5e7eb" name="Total" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={Shield} title="Recent Compliance Records" action={<Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" />Assign</Button>} />
              </CardHeader>
              <CardContent className="space-y-3">
                {!complianceList ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />) : complianceList.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{c.policy_name}</p>
                      <p className="text-xs text-muted-foreground">{c.employee_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.due_date && new Date(c.due_date) < new Date() && c.status !== "COMPLETED" ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : <SeverityBadge severity={c.status} />}
                      {c.score != null && <span className="text-xs font-medium">{c.score}%</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === COMPETENCY TAB === */}
        <TabsContent value="competency" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Competency Matrix</CardTitle></CardHeader>
              <CardContent>
                {!competencyMatrix ? (
                  <Skeleton className="h-64 w-full" />
                ) : competencyMatrix.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No competency frameworks defined</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={competencyMatrix.map((c) => ({
                      name: c.framework.name,
                      score: Math.round(c.avg_score),
                      qualified: c.qualified_count,
                    }))}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Avg Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Framework Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!competencyMatrix ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) : competencyMatrix.map((c) => (
                  <div key={c.framework.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{c.framework.name}</p>
                        <p className="text-xs text-muted-foreground">{c.framework.role} - {c.framework.level ?? "All Levels"}</p>
                      </div>
                      <SeverityBadge severity={c.framework.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Employees: {c.employee_count}</span>
                      <span>Qualified: {c.qualified_count}</span>
                      <span className={scoreColor(c.avg_score)}>{formatPercent(c.avg_score)} avg</span>
                    </div>
                    <Progress value={c.avg_score} className="mt-2 h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === AI RECOMMENDATIONS TAB === */}
        <TabsContent value="recommendations" className="space-y-6">
          <div className="flex items-center justify-between">
            <SectionHeader icon={Lightbulb} title="AI Learning Recommendations" description="Skill-gap driven course suggestions" />
            <Button variant="outline" size="sm"><Sparkles className="h-3 w-3 mr-1" />Generate for Employee</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {["HIGH", "MEDIUM", "LOW"].map((p) => (
              <Card key={p} className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className={cn("text-sm", p === "HIGH" ? "text-rose-500" : p === "MEDIUM" ? "text-amber-500" : "text-muted-foreground")}>
                    {p} Priority
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{recs?.filter((r) => r.priority === p).length ?? 0}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass-panel">
            <CardHeader><CardTitle className="text-base">All Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!recs ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) : recs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No recommendations yet. Generate for an employee to see suggestions.</p>
              ) : recs.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{r.title}</p>
                      <SeverityBadge severity={r.priority} />
                    </div>
                    <p className="text-xs text-muted-foreground">{r.description ?? r.reason}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Skill: {r.skill_name}</span>
                      <span>Type: {r.recommended_type}</span>
                      <span>Employee: {r.employee_id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <SeverityBadge severity={r.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === MENTORING TAB === */}
        <TabsContent value="mentoring" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={UserCheck} title="Mentors" action={<Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" />Add Mentor</Button>} />
              </CardHeader>
              <CardContent className="space-y-3">
                {!mentors ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) : mentors.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No mentors registered</p>
                ) : mentors.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">{m.full_name.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.role} &middot; {m.department}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3 w-3", i < Math.round(m.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-muted-foreground">{m.current_mentees}/{m.max_mentees} mentees</div>
                      {m.is_available ? <Badge variant="success" className="mt-1">Available</Badge> : <Badge variant="secondary">Busy</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={Clock} title="Upcoming Sessions" />
              </CardHeader>
              <CardContent className="space-y-3">
                {!sessions ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />) : sessions.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No sessions scheduled</p>
                ) : sessions.filter((s) => s.status === "SCHEDULED").slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{s.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        Mentee: {s.mentee_id} &middot; {s.duration_mins} min
                      </p>
                      {s.scheduled_at && (
                        <p className="text-xs text-muted-foreground">{new Date(s.scheduled_at).toLocaleDateString()} {new Date(s.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      )}
                    </div>
                    <SeverityBadge severity={s.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === MARKETPLACE + KNOWLEDGE TAB === */}
        <TabsContent value="marketplace" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={Store} title="Training Marketplace" action={<Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" />Add Listing</Button>} />
              </CardHeader>
              <CardContent className="space-y-3">
                {!marketplaceItems ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) : marketplaceItems.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No marketplace listings</p>
                ) : marketplaceItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.provider} &middot; {item.category}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                        <span className="text-xs text-muted-foreground">{item.duration_hours}h</span>
                        <span className="text-xs font-medium">{item.currency} {item.cost}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{item.rating}</span>
                      </div>
                      <span className="text-muted-foreground">{item.enrolled_count}/{item.max_participants}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <SectionHeader icon={FileText} title="Knowledge Hub" action={
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Search..." className="h-8 w-40 pl-7 text-xs" />
                    </div>
                    <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" />Add</Button>
                  </div>
                } />
              </CardHeader>
              <CardContent className="space-y-3">
                {!knowledgeArticles ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) : knowledgeArticles.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No articles yet</p>
                ) : knowledgeArticles.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3 transition-colors hover:bg-accent/50 cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{a.summary}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] ml-2">{a.content_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{a.author_name ?? a.author_id}</span>
                      <span>{a.category}</span>
                      <span>{a.view_count} views</span>
                      <span>{a.useful_count} useful</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === ANALYTICS TAB === */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Enrollments by Department</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptData ?? []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="department" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total_enrolled" fill="#6366f1" name="Total" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader><CardTitle className="text-base">Enrollment Trends</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="enrollments" stroke="#10b981" strokeWidth={2} dot={false} name="Enrollments" />
                    <Line type="monotone" dataKey="completions" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Completions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-panel">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completion Rate</CardTitle></CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", scoreColor(overview?.completion_rate ?? 0))}>{formatPercent(overview?.completion_rate ?? 0)}</div>
                <Progress value={overview?.completion_rate ?? 0} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pass Rate</CardTitle></CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", scoreColor(overview?.pass_rate ?? 0))}>{formatPercent(overview?.pass_rate ?? 0)}</div>
                <Progress value={overview?.pass_rate ?? 0} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Compliance Rate</CardTitle></CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", scoreColor(overview?.compliance.rate ?? 0))}>{formatPercent(overview?.compliance.rate ?? 0)}</div>
                <Progress value={overview?.compliance.rate ?? 0} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring Certs (30d)</CardTitle></CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", (overview?.certifications.expiring_30d ?? 0) > 0 ? "text-rose-500" : "text-emerald-500")}>
                  {overview?.certifications.expiring_30d ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
