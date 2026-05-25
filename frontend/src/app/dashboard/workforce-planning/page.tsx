"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  Users, Briefcase, TrendingUp, TrendingDown, Target, Award,
  AlertTriangle, Lightbulb, Activity, Brain, Layers, GitBranch,
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon,
  Sparkles, Database, UserCheck, UserMinus, UserPlus, Clock,
  DollarSign, Shield, CheckCircle, XCircle, ChevronRight,
  Play, Plus, Settings, Download, ExternalLink, Search,
  Filter, Calendar, Building2, Workflow, Users2, Zap,
  BookOpen, GraduationCap, Info, Gauge, RefreshCw,
} from "lucide-react";
import { workforcePlanningApi } from "@/lib/api";
import type {
  WorkforceDashboard, WorkforceDeptSummary,
  WorkforceDemandForecast, CapacityPlan, WorkforceAllocation,
  ProjectStaffing, SkillGapAnalysis, ResourceForecast,
  BenchManagement, TalentForecast, AttritionForecast,
  RetirementForecast, HiringRecommendation, WorkforceSimulation,
  WhatIfAnalysis, OrgRedesignSimulator, StrategicPlan,
} from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

function formatPercent(v: number) { return `${Math.round(v)}%`; }
function formatNumber(v: number) { return v.toLocaleString(); }
function formatCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

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
    CRITICAL: "destructive", OPEN: "secondary", FILLED: "success",
    ACTIVE: "success", DRAFT: "secondary", COMPLETED: "success",
    ON_BENCH: "warning", BILLABLE: "success", NON_BILLABLE: "secondary",
    healthy: "success", moderate: "warning", "needs-attention": "destructive",
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

function KPICard({ label, value, change, icon: Icon, color, format, loading }: {
  label: string; value: number | string; change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string; format?: "number" | "currency" | "percent" | "string";
  loading?: boolean;
}) {
  const display = format === "currency" ? formatCurrency(Number(value)) : format === "percent" ? formatPercent(Number(value)) : String(value);
  const isUp = change !== undefined && change >= 0;
  return (
    <motion.div variants={itemVariants}>
      <Card className="glass-panel overflow-hidden">
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-24" /><Skeleton className="h-3 w-12" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className={`rounded-lg p-1.5 ${color}`}><Icon className="h-3.5 w-3.5" /></div>
              </div>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">{display}</p>
              {change !== undefined && (
                <div className="mt-1 flex items-center gap-1">
                  {isUp ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
                  <span className={cn("text-xs font-medium", isUp ? "text-emerald-500" : "text-rose-500")}>{isUp ? "+" : ""}{change}%</span>
                  <span className="text-xs text-muted-foreground">vs last period</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#ec4899"];

// ── Default Data ──────────────────────────────────────────────────────

const defaultDashboard: WorkforceDashboard = {
  total_headcount: 1248, total_capacity: 1450, total_allocated: 1180,
  bench_count: 42, open_requirements: 23, attrition_rate: 12.5,
  utilization_rate: 81.4, skill_gap_count: 156, hiring_urgent: 8,
  department_summary: [
    { department: "Engineering", total_capacity: 450, allocated: 420, open_roles: 8 },
    { department: "Sales", total_capacity: 300, allocated: 280, open_roles: 5 },
    { department: "Operations", total_capacity: 230, allocated: 210, open_roles: 4 },
    { department: "Finance", total_capacity: 155, allocated: 143, open_roles: 2 },
    { department: "Marketing", total_capacity: 115, allocated: 100, open_roles: 3 },
    { department: "HR", total_capacity: 105, allocated: 95, open_roles: 1 },
  ],
  trends: {},
};

const defaultDemandForecasts: WorkforceDemandForecast[] = [
  { id: "1", tenant_id: "default", department: "Engineering", role: "Senior Developer", current_headcount: 120, projected_headcount: 150, gap: 30, period: "2026-Q3", confidence_level: 0.85, factors: {}, created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", department: "Engineering", role: "Data Scientist", current_headcount: 25, projected_headcount: 40, gap: 15, period: "2026-Q3", confidence_level: 0.78, factors: {}, created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", department: "Sales", role: "Account Executive", current_headcount: 80, projected_headcount: 95, gap: 15, period: "2026-Q3", confidence_level: 0.82, factors: {}, created_at: "", updated_at: "" },
  { id: "4", tenant_id: "default", department: "Operations", role: "Logistics Manager", current_headcount: 30, projected_headcount: 35, gap: 5, period: "2026-Q3", confidence_level: 0.90, factors: {}, created_at: "", updated_at: "" },
];

const defaultCapacityPlans: CapacityPlan[] = [
  { id: "1", tenant_id: "default", department: "Engineering", role: "All Roles", total_capacity: 450, allocated: 420, available: 30, utilization_rate: 93.3, period: "2026-Q3", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", department: "Sales", role: "All Roles", total_capacity: 300, allocated: 280, available: 20, utilization_rate: 93.3, period: "2026-Q3", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", department: "Operations", role: "All Roles", total_capacity: 230, allocated: 210, available: 20, utilization_rate: 91.3, period: "2026-Q3", created_at: "", updated_at: "" },
  { id: "4", tenant_id: "default", department: "Finance", role: "All Roles", total_capacity: 155, allocated: 143, available: 12, utilization_rate: 92.3, period: "2026-Q3", created_at: "", updated_at: "" },
  { id: "5", tenant_id: "default", department: "Marketing", role: "All Roles", total_capacity: 115, allocated: 100, available: 15, utilization_rate: 87.0, period: "2026-Q3", created_at: "", updated_at: "" },
  { id: "6", tenant_id: "default", department: "HR", role: "All Roles", total_capacity: 105, allocated: 95, available: 10, utilization_rate: 90.5, period: "2026-Q3", created_at: "", updated_at: "" },
];

const defaultAllocations: WorkforceAllocation[] = [
  { id: "1", tenant_id: "default", employee_id: "E001", employee_name: "Alice Johnson", department: "Engineering", role: "Senior Developer", project_name: "Platform Redesign", allocation_percentage: 100, start_date: "2026-01-15", end_date: "2026-09-30", status: "ACTIVE", notes: "", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", employee_id: "E002", employee_name: "Bob Smith", department: "Engineering", role: "Frontend Developer", project_name: "Mobile App v3", allocation_percentage: 75, start_date: "2026-02-01", end_date: "2026-08-31", status: "ACTIVE", notes: "Split with support tasks", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", employee_id: "E003", employee_name: "Carol Davis", department: "Sales", role: "Account Executive", project_name: "Enterprise Expansion", allocation_percentage: 100, start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", notes: "", created_at: "", updated_at: "" },
  { id: "4", tenant_id: "default", employee_id: "E004", employee_name: "David Wilson", department: "Marketing", role: "Marketing Lead", project_name: "Brand Refresh", allocation_percentage: 50, start_date: "2026-03-01", end_date: "2026-07-31", status: "ACTIVE", notes: "Also managing social media", created_at: "", updated_at: "" },
];

const defaultBenchData: BenchManagement[] = [
  { id: "1", tenant_id: "default", employee_id: "E010", employee_name: "Emma Brown", department: "Engineering", role: "Full Stack Developer", skills: [{ skill: "React", level: 4 }, { skill: "Node.js", level: 4 }, { skill: "Python", level: 3 }], bench_start_date: "2026-06-01", bench_duration_days: 24, billable_status: "NON_BILLABLE", status: "ON_BENCH", notes: "", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", employee_id: "E011", employee_name: "Frank Miller", department: "Engineering", role: "DevOps Engineer", skills: [{ skill: "AWS", level: 5 }, { skill: "Docker", level: 4 }, { skill: "K8s", level: 4 }], bench_start_date: "2026-05-15", bench_duration_days: 41, billable_status: "NON_BILLABLE", status: "ON_BENCH", notes: "", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", employee_id: "E012", employee_name: "Grace Lee", department: "Marketing", role: "Graphic Designer", skills: [{ skill: "Figma", level: 5 }, { skill: "Photoshop", level: 4 }], bench_start_date: "2026-06-10", bench_duration_days: 15, billable_status: "NON_BILLABLE", status: "ON_BENCH", notes: "", created_at: "", updated_at: "" },
];

const defaultSkillGaps: SkillGapAnalysis[] = [
  { id: "1", tenant_id: "default", department: "Engineering", role: "Senior Developer", skill_name: "AI/ML", required_level: 4, current_avg_level: 2.5, gap_score: 1.5, employee_count: 45, priority: "HIGH", period: "2026-H2", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", department: "Engineering", role: "Senior Developer", skill_name: "Cloud (AWS)", required_level: 4, current_avg_level: 3.0, gap_score: 1.0, employee_count: 45, priority: "HIGH", period: "2026-H2", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", department: "Sales", role: "Account Executive", skill_name: "CRM Analytics", required_level: 3, current_avg_level: 2.0, gap_score: 1.0, employee_count: 80, priority: "MEDIUM", period: "2026-H2", created_at: "", updated_at: "" },
  { id: "4", tenant_id: "default", department: "Engineering", role: "Data Scientist", skill_name: "Deep Learning", required_level: 5, current_avg_level: 3.0, gap_score: 2.0, employee_count: 25, priority: "HIGH", period: "2026-H2", created_at: "", updated_at: "" },
  { id: "5", tenant_id: "default", department: "Marketing", role: "Marketing Lead", skill_name: "Marketing Analytics", required_level: 4, current_avg_level: 2.5, gap_score: 1.5, employee_count: 15, priority: "MEDIUM", period: "2026-H2", created_at: "", updated_at: "" },
  { id: "6", tenant_id: "default", department: "Operations", role: "Logistics Manager", skill_name: "Supply Chain AI", required_level: 3, current_avg_level: 1.5, gap_score: 1.5, employee_count: 30, priority: "LOW", period: "2026-H2", created_at: "", updated_at: "" },
];

const defaultHiringRecs: HiringRecommendation[] = [
  { id: "1", tenant_id: "default", department: "Engineering", role: "Senior AI/ML Engineer", priority: "HIGH", recommended_count: 5, current_gap: 8, urgency: "HIGH", business_impact: "AI product roadmap at risk", justification: "Strategic AI initiatives require specialized talent", status: "OPEN", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", department: "Engineering", role: "Cloud Architect", priority: "HIGH", recommended_count: 3, current_gap: 4, urgency: "HIGH", business_impact: "Cloud migration delayed", justification: "AWS migration project needs senior architect", status: "OPEN", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", department: "Sales", role: "Enterprise Account Exec", priority: "MEDIUM", recommended_count: 5, current_gap: 6, urgency: "MEDIUM", business_impact: "Enterprise segment underpenetrated", justification: "New market expansion requires additional coverage", status: "OPEN", created_at: "", updated_at: "" },
  { id: "4", tenant_id: "default", department: "Marketing", role: "Digital Marketing Manager", priority: "MEDIUM", recommended_count: 2, current_gap: 3, urgency: "MEDIUM", business_impact: "Digital presence optimization", justification: "Digital transformation initiative requires dedicated lead", status: "OPEN", created_at: "", updated_at: "" },
];

const defaultAttritionForecasts: AttritionForecast[] = [
  { id: "1", tenant_id: "default", department: "Engineering", role: "All Roles", current_headcount: 420, projected_attrition_rate: 14.5, projected_attrition_count: 61, confidence: 0.78, risk_factors: {}, period: "2026-H2", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", department: "Sales", role: "All Roles", current_headcount: 280, projected_attrition_rate: 18.0, projected_attrition_count: 50, confidence: 0.72, risk_factors: {}, period: "2026-H2", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", department: "Marketing", role: "All Roles", current_headcount: 100, projected_attrition_rate: 15.0, projected_attrition_count: 15, confidence: 0.75, risk_factors: {}, period: "2026-H2", created_at: "", updated_at: "" },
];

const defaultRetirementForecasts: RetirementForecast[] = [
  { id: "1", tenant_id: "default", department: "Engineering", role: "All Roles", eligible_count: 25, projected_retirements: 8, avg_age: 42.5, risk_level: "MEDIUM", period: "2026-2030", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", department: "Finance", role: "All Roles", eligible_count: 18, projected_retirements: 6, avg_age: 45.2, risk_level: "HIGH", period: "2026-2030", created_at: "", updated_at: "" },
  { id: "3", tenant_id: "default", department: "Operations", role: "All Roles", eligible_count: 30, projected_retirements: 10, avg_age: 48.0, risk_level: "HIGH", period: "2026-2030", created_at: "", updated_at: "" },
];

const defaultSimulations: WorkforceSimulation[] = [
  { id: "1", tenant_id: "default", name: "Headcount Growth - 15% YoY", description: "Project headcount with 15% annual growth and 10% attrition", simulation_type: "HEADCOUNT", parameters: { current_headcount: 1248, growth_rate: 0.15, attrition_rate: 0.10, periods: 4 }, results: {}, status: "COMPLETED", created_by: "Admin", created_at: "", updated_at: "" },
  { id: "2", tenant_id: "default", name: "AI/ML Skill Gap Closure", description: "Project skill level improvement with training & hiring", simulation_type: "SKILL_GAP", parameters: { department: "Engineering", baseline_skill_level: 2.5, target_skill_level: 4, training_impact: 0.5, hiring_impact: 0.8, periods: 4 }, results: {}, status: "COMPLETED", created_by: "Admin", created_at: "", updated_at: "" },
];

const defaultOrgRedesigns: OrgRedesignSimulator[] = [
  { id: "1", tenant_id: "default", name: "Flat Structure Transition", description: "Transition from 5-layer to 3-layer org structure", current_structure: { departments: [{ name: "Engineering", headcount: 420, cost: 1575000 }, { name: "Sales", headcount: 280, cost: 875000 }] }, proposed_structure: { departments: [{ name: "Product Engineering", headcount: 380, cost: 1420000 }, { name: "Revenue", headcount: 320, cost: 950000 }] }, impact_analysis: {}, status: "DRAFT", created_by: "Admin", created_at: "", updated_at: "" },
];

const defaultStrategicPlans: StrategicPlan[] = [
  { id: "1", tenant_id: "default", name: "FY2026 Workforce Strategy", period: "FY2026", objectives: [{ title: "Reduce critical skill gaps by 40%", description: "Address top-5 skill gaps through training and hiring", target_date: "2026-12-31", status: "ON_TRACK", progress: 35 }, { title: "Decrease attrition to <10%", description: "Implement retention programs across high-risk departments", target_date: "2026-12-31", status: "AT_RISK", progress: 20 }, { title: "Increase bench utilization to 85%", description: "Optimize bench resource allocation to billable projects", target_date: "2026-09-30", status: "ON_TRACK", progress: 50 }], kpis: [{ name: "Skill Gap Closure Rate", current_value: 35, target_value: 100, unit: "%", trend: "up" }, { name: "Attrition Rate", current_value: 12.5, target_value: 10, unit: "%", trend: "down" }, { name: "Bench Utilization", current_value: 72, target_value: 85, unit: "%", trend: "up" }], initiatives: [{ name: "AI Academy", description: "Internal AI/ML upskilling program", owner: "CTO", budget: 250000, start_date: "2026-01-01", end_date: "2026-12-31", status: "ACTIVE", progress: 45 }], status: "ACTIVE", progress: 35, created_by: "Admin", created_at: "", updated_at: "" },
];

// ── Tab Components ─────────────────────────────────────────────────────

function OverviewTab({ dash, loading }: { dash: WorkforceDashboard; loading: boolean }) {
  const kpis = [
    { label: "Total Headcount", value: dash.total_headcount, icon: Users, color: "text-blue-600 bg-blue-500/10", format: "number" as const },
    { label: "Total Capacity", value: dash.total_capacity, icon: Database, color: "text-emerald-600 bg-emerald-500/10", format: "number" as const },
    { label: "Utilization Rate", value: dash.utilization_rate, icon: Gauge, color: "text-amber-600 bg-amber-500/10", format: "percent" as const },
    { label: "Attrition Rate", value: dash.attrition_rate, icon: UserMinus, color: "text-rose-600 bg-rose-500/10", format: "percent" as const },
    { label: "On Bench", value: dash.bench_count, icon: Users2, color: "text-purple-600 bg-purple-500/10", format: "number" as const },
    { label: "Open Requirements", value: dash.open_requirements, icon: Briefcase, color: "text-pink-600 bg-pink-500/10", format: "number" as const },
  ];

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => <KPICard key={kpi.label} {...kpi} loading={loading} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Building2} title="Department Capacity" description="Allocation by department" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dash.department_summary.map(d => ({ ...d, available: d.total_capacity - d.allocated }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="allocated" name="Allocated" fill="#3b82f6" radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="available" name="Available" fill="#10b981" radius={[2, 2, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Target} title="Strategic Plans" description="Active workforce initiatives" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-3">
                  {defaultStrategicPlans.map((plan) => (
                    <div key={plan.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">{plan.name}</span>
                        <SeverityBadge severity={plan.status} />
                      </div>
                      <div className="mb-2 space-y-2">
                        {plan.objectives.slice(0, 3).map((obj, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate max-w-[200px]">{obj.title}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={obj.progress} className="h-1.5 w-16" />
                              <span className={cn("tabular-nums font-medium", scoreColor(obj.progress))}>{obj.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Overall Progress</span>
                        <span className="font-bold text-foreground">{plan.progress}%</span>
                      </div>
                      <Progress value={plan.progress} className="mt-1 h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Activity} title="Workforce Health Overview" description="Key metrics at a glance" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Skill Gaps Identified", value: dash.skill_gap_count, icon: BookOpen, desc: "Across all departments", color: "text-amber-500" },
                { label: "Urgent Hiring Needs", value: dash.hiring_urgent, icon: AlertTriangle, desc: "High-priority roles", color: "text-rose-500" },
                { label: "Project Staffing Gap", value: Math.max(0, dash.open_requirements - dash.bench_count), icon: UserPlus, desc: "Net hiring required", color: "text-blue-500" },
                { label: "Retirement Risk", value: defaultRetirementForecasts.reduce((s, r) => s + r.projected_retirements, 0), icon: Clock, desc: "Projected next 5 years", color: "text-purple-500" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-card/50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function DemandTab({ loading }: { loading: boolean }) {
  const gapChartData = defaultDemandForecasts.map(f => ({ name: f.role.split(" ").slice(0, 2).join(" "), current: f.current_headcount, projected: f.projected_headcount, gap: f.gap }));
  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={TrendingUp} title="Workforce Demand Forecast" description="Projected vs current headcount by role" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={gapChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="current" name="Current" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="projected" name="Projected" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b text-muted-foreground"><th className="text-left font-medium py-2">Department</th><th className="text-left font-medium py-2">Role</th><th className="text-right font-medium py-2">Current</th><th className="text-right font-medium py-2">Projected</th><th className="text-right font-medium py-2">Gap</th><th className="text-right font-medium py-2">Confidence</th></tr></thead>
                    <tbody>
                      {defaultDemandForecasts.map((f) => (
                        <tr key={f.id} className="border-b last:border-0">
                          <td className="py-1.5 font-medium">{f.department}</td>
                          <td className="py-1.5">{f.role}</td>
                          <td className="py-1.5 text-right tabular-nums">{f.current_headcount}</td>
                          <td className="py-1.5 text-right tabular-nums">{f.projected_headcount}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{f.gap > 0 ? <span className="text-rose-500">+{f.gap}</span> : f.gap}</td>
                          <td className="py-1.5 text-right"><SeverityBadge severity={f.confidence_level >= 0.8 ? "HIGH" : f.confidence_level >= 0.6 ? "MEDIUM" : "LOW"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Database} title="Resource Forecast" description="Net headcount projections" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: "Engineering", current: 420, hires: 35, attrition: -61, net: 394 },
                  { name: "Sales", current: 280, hires: 20, attrition: -50, net: 250 },
                  { name: "Operations", current: 210, hires: 10, attrition: -25, net: 195 },
                  { name: "Finance", current: 143, hires: 5, attrition: -12, net: 136 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="current" name="Current" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="hires" name="Projected Hires" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="attrition" name="Projected Attrition" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Brain} title="Talent Forecast" description="Talent pool vs projected needs" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { role: "AI/ML Engineers", pool: 18, needs: 40, gap: 22, risk: "HIGH" },
                  { role: "Cloud Architects", pool: 12, needs: 22, gap: 10, risk: "HIGH" },
                  { role: "Data Scientists", pool: 25, needs: 35, gap: 10, risk: "MEDIUM" },
                  { role: "Enterprise AE", pool: 80, needs: 95, gap: 15, risk: "MEDIUM" },
                  { role: "DevOps Engineers", pool: 28, needs: 35, gap: 7, risk: "LOW" },
                ].map((t) => (
                  <div key={t.role} className="flex items-center justify-between rounded-lg bg-muted/30 p-2.5">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{t.role}</span>
                        <SeverityBadge severity={t.risk} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>Pool: {t.pool}</span>
                        <span>Needs: {t.needs}</span>
                        <span className={cn("font-medium", t.gap > 10 ? "text-rose-500" : "text-amber-500")}>Gap: {t.gap}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function CapacityTab({ loading }: { loading: boolean }) {
  const utilData = defaultCapacityPlans.map(c => ({ name: c.department, utilization: c.utilization_rate }));
  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Gauge} title="Capacity Utilization" description="Department capacity usage" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={utilData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`, "Utilization"]} />
                  <Bar dataKey="utilization" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {utilData.map((_, i) => (
                      <Cell key={i} fill={utilData[i].utilization >= 90 ? "#f43f5e" : utilData[i].utilization >= 80 ? "#f59e0b" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={UserCheck} title="Active Allocations" description="Current project assignments" />
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto space-y-2">
              {defaultAllocations.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border bg-card/50 p-2.5">
                  <div>
                    <p className="text-xs font-medium">{a.employee_name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.project_name} &middot; {a.allocation_percentage}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{a.department}</Badge>
                    <SeverityBadge severity={a.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Users2} title="Bench Management" description="Resources available for assignment" action={<Badge variant="warning" className="text-[10px]">{defaultBenchData.length} on bench</Badge>} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {defaultBenchData.map((b) => (
                <div key={b.id} className="rounded-lg border bg-card/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{b.employee_name}</span>
                    <SeverityBadge severity={b.billable_status} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{b.role} &middot; {b.department}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {b.skills.slice(0, 3).map((s) => (
                      <Badge key={s.skill as string} variant="secondary" className="text-[10px]">{s.skill as string}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Bench: {b.bench_duration_days}d</span>
                    <span>Since {b.bench_start_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={GitBranch} title="Project Staffing" description="Projects with staffing requirements" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground"><th className="text-left font-medium py-2">Project</th><th className="text-left font-medium py-2">Department</th><th className="text-right font-medium py-2">Required</th><th className="text-right font-medium py-2">Filled</th><th className="text-right font-medium py-2">Gap</th><th className="text-right font-medium py-2">Status</th></tr></thead>
                <tbody>
                  {[
                    { name: "Platform Redesign", dept: "Engineering", req: 12, filled: 10, gap: 2, status: "ACTIVE" },
                    { name: "Mobile App v3", dept: "Engineering", req: 8, filled: 6, gap: 2, status: "ACTIVE" },
                    { name: "Enterprise Expansion", dept: "Sales", req: 6, filled: 4, gap: 2, status: "ACTIVE" },
                    { name: "Brand Refresh", dept: "Marketing", req: 4, filled: 3, gap: 1, status: "ACTIVE" },
                    { name: "Cloud Migration", dept: "Engineering", req: 5, filled: 2, gap: 3, status: "PLANNED" },
                  ].map((p) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="py-1.5 font-medium">{p.name}</td>
                      <td className="py-1.5">{p.dept}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.req}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.filled}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium text-rose-500">+{p.gap}</td>
                      <td className="py-1.5 text-right"><SeverityBadge severity={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function SkillsTab({ loading }: { loading: boolean }) {
  const radarData = defaultSkillGaps.filter((_, i) => i < 5).map(s => ({ skill: s.skill_name, required: s.required_level, current: s.current_avg_level }));
  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={RadarChart.name === "RadarChart" ? Target : Target} title="Skills Gap Radar" description="Required vs current proficiency" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar name="Required Level" dataKey="required" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} />
                  <Radar name="Current Level" dataKey="current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={BookOpen} title="Gap Analysis by Role" description="Prioritized skills gaps" />
            </CardHeader>
            <CardContent className="space-y-3">
              {defaultSkillGaps.map((s) => (
                <div key={s.id} className="rounded-lg bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-medium">{s.skill_name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{s.role}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={s.priority} />
                      <span className="text-xs font-bold tabular-nums text-rose-500">{s.gap_score.toFixed(1)} gap</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1">
                    <span>Required: {s.required_level}/5</span>
                    <span>Current: {s.current_avg_level.toFixed(1)}/5</span>
                    <span>{s.employee_count} employees</span>
                  </div>
                  <Progress value={(s.current_avg_level / s.required_level) * 100} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={GraduationCap} title="Recommended Upskilling Programs" description="Training initiatives to close gaps" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: "AI/ML Certification Track", skills: ["AI/ML", "Deep Learning"], duration: "6 months", cost: 150000, impact: "High" },
                { name: "Cloud Architecture Bootcamp", skills: ["Cloud (AWS)"], duration: "3 months", cost: 80000, impact: "High" },
                { name: "Data Analytics Workshop", skills: ["Marketing Analytics", "CRM Analytics"], duration: "2 months", cost: 45000, impact: "Medium" },
              ].map((p) => (
                <div key={p.name} className="rounded-lg border bg-card/50 p-3">
                  <p className="text-sm font-semibold mb-1">{p.name}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {p.skills.map((sk) => <Badge key={sk} variant="secondary" className="text-[10px]">{sk}</Badge>)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{p.duration}</span>
                    <span>{formatCurrency(p.cost)}</span>
                    <SeverityBadge severity={p.impact === "High" ? "HIGH" : "MEDIUM"} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ForecastingTab({ loading }: { loading: boolean }) {
  const attritionData = defaultAttritionForecasts.map(a => ({ name: a.department, rate: a.projected_attrition_rate, count: a.projected_attrition_count }));
  const retirementData = defaultRetirementForecasts.map(r => ({ name: r.department, eligible: r.eligible_count, projected: r.projected_retirements }));
  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={UserMinus} title="Attrition Forecast" description="Projected attrition by department" action={<Badge variant="destructive" className="text-[10px]">Avg: {defaultAttritionForecasts.reduce((s, a) => s + a.projected_attrition_rate, 0) / defaultAttritionForecasts.length}%</Badge>} />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attritionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="rate" name="Attrition Rate %" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {defaultAttritionForecasts.map((a) => (
                  <div key={a.id} className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{a.department}</p>
                    <p className="text-lg font-bold text-rose-500">{a.projected_attrition_rate}%</p>
                    <p className="text-[10px] text-muted-foreground">{a.projected_attrition_count} employees</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Clock} title="Retirement Forecast" description="Eligible retirements (2026-2030)" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={retirementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="eligible" name="Eligible" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="projected" name="Projected Retirements" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {defaultRetirementForecasts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.department}</span>
                      <span className="text-muted-foreground">Avg age: {r.avg_age}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{r.eligible_count} eligible</span>
                      <span className="font-medium">{r.projected_retirements} projected</span>
                      <SeverityBadge severity={r.risk_level} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={LineChartIcon} title="Combined Workforce Forecast" description="Headcount projection with attrition & retirements" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={[
                { period: "Q1 2026", headcount: 1248, hires: 0, leavers: 0 },
                { period: "Q2 2026", headcount: 1260, hires: 35, leavers: 23 },
                { period: "Q3 2026", headcount: 1275, hires: 40, leavers: 25 },
                { period: "Q4 2026", headcount: 1292, hires: 45, leavers: 28 },
                { period: "Q1 2027", headcount: 1305, hires: 42, leavers: 29 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="headcount" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function SimulationsTab({ loading }: { loading: boolean }) {
  const [activeSimTab, setActiveSimTab] = useState("simulations");
  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <Tabs value={activeSimTab} onValueChange={setActiveSimTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="simulations">Simulation Engine</TabsTrigger>
          <TabsTrigger value="whatif">What-If Analysis</TabsTrigger>
          <TabsTrigger value="orgRedesign">Org Redesign</TabsTrigger>
        </TabsList>

        <TabsContent value="simulations">
          <div className="grid gap-6 lg:grid-cols-2">
            {defaultSimulations.map((sim) => (
              <motion.div key={sim.id} variants={itemVariants}>
                <Card className="glass-panel">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={Play} title={sim.name} description={sim.description} />
                      <SeverityBadge severity={sim.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Parameters</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(sim.parameters).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
                            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                            <span className="font-medium tabular-nums">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => {}}>
                      <RefreshCw className="h-3 w-3" /> Re-run Simulation
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <motion.div variants={itemVariants}>
              <Card className="glass-panel border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">New Simulation</p>
                  <p className="text-xs text-muted-foreground text-center mt-1">Create headcount, skill gap, or attrition scenarios</p>
                  <Button size="sm" className="mt-3 gap-1"><Plus className="h-3 w-3" /> Create</Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="whatif">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Lightbulb} title="What-If Scenarios" description="Test different workforce assumptions" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { scenario: "10% Budget Cut", assumption: "Engineering hiring frozen for 2 quarters", impact: "Headcount growth slows to 2%, project delays expected", confidence: 0.85 },
                  { scenario: "AI Automation Adoption", assumption: "30% of manual tasks automated", impact: "Reskill 50 employees, reduce ops headcount by 15%", confidence: 0.72 },
                  { scenario: "Remote-First Policy", assumption: "60% workforce becomes remote", impact: "Real estate savings of $2M, talent pool expands 3x", confidence: 0.68 },
                  { scenario: "Aggressive Hiring", assumption: "Double hiring budget for Q3-Q4", impact: "Headcount grows 22% YoY, utilization drops to 75%", confidence: 0.76 },
                ].map((w) => (
                  <div key={w.scenario} className="rounded-lg border bg-card/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{w.scenario}</span>
                      <Badge variant="secondary" className="text-[10px]">{Math.round(w.confidence * 100)}% confidence</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded bg-muted/30 p-2">
                        <span className="text-muted-foreground">Assumption:</span>
                        <p className="font-medium mt-0.5">{w.assumption}</p>
                      </div>
                      <div className="rounded bg-muted/30 p-2">
                        <span className="text-muted-foreground">Projected Impact:</span>
                        <p className="font-medium mt-0.5">{w.impact}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orgRedesign">
          <div className="grid gap-6 lg:grid-cols-2">
            {defaultOrgRedesigns.map((org) => (
              <motion.div key={org.id} variants={itemVariants}>
                <Card className="glass-panel">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={Building2} title={org.name} description={org.description} />
                      <SeverityBadge severity={org.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 mb-4">
                      <div className="rounded-lg border bg-card/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Current Structure</p>
                        {(org.current_structure.departments as Array<{ name: string; headcount: number; cost: number }>)?.map((d) => (
                          <div key={d.name} className="flex items-center justify-between text-xs py-1">
                            <span>{d.name}</span>
                            <span className="tabular-nums">{d.headcount} FTEs</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border bg-card/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Proposed Structure</p>
                        {(org.proposed_structure.departments as Array<{ name: string; headcount: number; cost: number }>)?.map((d) => (
                          <div key={d.name} className="flex items-center justify-between text-xs py-1">
                            <span>{d.name}</span>
                            <span className="tabular-nums">{d.headcount} FTEs</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" className="w-full gap-1"><Play className="h-3 w-3" /> Run Impact Analysis</Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function RecommendationsTab({ loading }: { loading: boolean }) {
  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Zap} title="AI-Driven Hiring Recommendations" description="Prioritized hiring needs based on gap analysis" action={<Badge variant="destructive" className="text-[10px]">{defaultHiringRecs.filter(r => r.urgency === "HIGH").length} urgent</Badge>} />
          </CardHeader>
          <CardContent className="space-y-3">
            {defaultHiringRecs.map((r) => (
              <div key={r.id} className="rounded-lg border bg-card/50 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{r.role}</span>
                      <SeverityBadge severity={r.urgency} />
                      <SeverityBadge severity={r.priority} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{r.department} &middot; {r.business_impact}</p>
                    <p className="text-[10px] text-muted-foreground">{r.justification}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-rose-500">{r.recommended_count}</p>
                    <p className="text-[10px] text-muted-foreground">needed</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Current gap: <strong>{r.current_gap}</strong></span>
                  <span>Status: <SeverityBadge severity={r.status} /></span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Sparkles} title="AI-Generated Workforce Insights" description="Intelligent recommendations" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { type: "Talent", title: "AI/ML Talent Shortage Critical", desc: "Only 18 qualified candidates for 40 projected needs. Accelerate AI Academy launch.", icon: Brain, color: "text-rose-500" },
                { type: "Retention", title: "Sales Attrition Risk High", desc: "Projected 18% attrition in sales. Implement retention bonuses and career paths.", icon: AlertTriangle, color: "text-amber-500" },
                { type: "Cost", title: "Bench Cost Impact", desc: "42 employees on bench costing $420K/month. Prioritize allocation to billable projects.", icon: DollarSign, color: "text-blue-500" },
                { type: "Strategy", title: "Retirement Wave Planning", desc: "24 projected retirements by 2030. Start knowledge transfer and succession plans.", icon: Clock, color: "text-purple-500" },
              ].map((insight) => (
                <div key={insight.title} className="rounded-lg border bg-card/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <insight.icon className={`h-4 w-4 ${insight.color}`} />
                    <div>
                      <p className="text-xs font-medium">{insight.type}</p>
                      <p className="text-sm font-semibold">{insight.title}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{insight.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function WorkforcePlanningPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["workforce", "dashboard"],
    queryFn: async () => {
      const { data } = await workforcePlanningApi.dashboard();
      return data as WorkforceDashboard;
    },
    retry: false,
    staleTime: 30000,
  });

  const dash = dashData ?? defaultDashboard;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workforce Planning</h1>
        <p className="text-muted-foreground">
          AI-driven workforce insights, forecasting, simulation, and strategic planning
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="demand">Demand</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="skills">Skills Gap</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
          <TabsTrigger value="simulations">Simulations</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab dash={dash} loading={dashLoading} />
        </TabsContent>

        <TabsContent value="demand">
          <DemandTab loading={dashLoading} />
        </TabsContent>

        <TabsContent value="capacity">
          <CapacityTab loading={dashLoading} />
        </TabsContent>

        <TabsContent value="skills">
          <SkillsTab loading={dashLoading} />
        </TabsContent>

        <TabsContent value="forecasting">
          <ForecastingTab loading={dashLoading} />
        </TabsContent>

        <TabsContent value="simulations">
          <SimulationsTab loading={dashLoading} />
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsTab loading={dashLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
