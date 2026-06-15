"use client";


import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, DollarSign, Briefcase, GraduationCap, Smile, TrendingUp,
  TrendingDown, AlertTriangle, Lightbulb, Activity, Heart, Zap,
  ArrowRight, UserMinus, UserPlus, Clock, Target, Shield,
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  Sparkles, Brain, Flag, Layers, GitBranch, Building2, Banknote,
  Info, CheckCircle, XCircle, ChevronRight, Gauge, Scan,
  Download, ExternalLink, Globe,
} from "lucide-react";
import { commandCenterApi } from "@/lib/api";
import type {
  CommandCenterOverview, OrgHealthDetail, OrgHealthDimension, OrgHealthTrend,
  DepartmentHeatmap, DepartmentHeatmapItem,
  WorkforceCost, CostByDepartment, CostTrend,
  AttritionRiskMap, RiskByDepartment, HighRiskEmployee, RiskTrend,
  HiringPipeline, PipelineStage, HiringByDept, UpcomingInterview,
  BudgetForecast, BudgetDept, MonthlyBurn,
  WorkforceUtilization, UtilizationDept, UtilizationTrend,
  DepartmentBenchmarking, BenchmarkDept, BenchmarkMetrics,
  AiBriefing, AiFinding, AiRecommendation, AiRiskFlag,
  RiskDashboard, RiskCategory, RiskTrendItem,
} from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency } from "@/lib/utils";

function formatPercent(v: number) { return `${Math.round(v)}%`; }
function formatNumber(v: number) { return v.toLocaleString(); }
function formatCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
} as const;
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
} as const;

const defaultOverview: CommandCenterOverview = {
  totalHeadcount: 1248, headcountChange: 3.2,
  payrollMtd: 2840000, payrollChange: 2.1,
  openPositions: 23, positionsChange: -5.1,
  trainingCompletion: 86, trainingChange: 4.3,
  satisfactionScore: 4.2, satisfactionChange: 0.3,
  orgHealthScore: 78, productivityScore: 85, riskScore: 32,
  newHiresThisMonth: 14, departuresThisMonth: 6,
  avgTenure: 3.4, avgTimeToHire: 28,
};

const defaultHealthDetail: OrgHealthDetail = {
  overall: 78,
  dimensions: [
    { name: "Engagement", score: 82, change: 3, status: "healthy" },
    { name: "Productivity", score: 78, change: -2, status: "moderate" },
    { name: "Retention", score: 74, change: 5, status: "moderate" },
    { name: "Culture", score: 71, change: 1, status: "moderate" },
    { name: "Innovation", score: 68, change: -4, status: "needs-attention" },
    { name: "Diversity", score: 76, change: 6, status: "moderate" },
    { name: "Wellness", score: 83, change: 2, status: "healthy" },
  ],
  trend: [
    { month: "Jan", score: 72 }, { month: "Feb", score: 73 },
    { month: "Mar", score: 75 }, { month: "Apr", score: 74 },
    { month: "May", score: 76 }, { month: "Jun", score: 78 },
  ],
};

const defaultHeatmap: DepartmentHeatmap = {
  departments: [
    { name: "Engineering", metrics: { productivity: 92, engagement: 85, retention: 88, innovation: 90, wellness: 78 }, headcount: 420, attrition: 8, budgetUtilization: 88, health: "healthy" },
    { name: "Sales", metrics: { productivity: 88, engagement: 72, retention: 70, innovation: 65, wellness: 74 }, headcount: 280, attrition: 15, budgetUtilization: 92, health: "moderate" },
    { name: "Operations", metrics: { productivity: 85, engagement: 78, retention: 82, innovation: 60, wellness: 80 }, headcount: 210, attrition: 10, budgetUtilization: 76, health: "moderate" },
    { name: "HR", metrics: { productivity: 90, engagement: 82, retention: 92, innovation: 72, wellness: 86 }, headcount: 95, attrition: 5, budgetUtilization: 70, health: "healthy" },
    { name: "Finance", metrics: { productivity: 87, engagement: 80, retention: 88, innovation: 62, wellness: 82 }, headcount: 143, attrition: 6, budgetUtilization: 85, health: "healthy" },
    { name: "Marketing", metrics: { productivity: 83, engagement: 76, retention: 75, innovation: 78, wellness: 72 }, headcount: 100, attrition: 12, budgetUtilization: 80, health: "moderate" },
  ],
  avgProductivity: 87, avgEngagement: 79, overallHealth: "moderate",
};

const defaultWorkforceCost: WorkforceCost = {
  totalPayroll: 2840000, totalBenefits: 426000, totalTaxes: 284000, totalCost: 3550000,
  byDepartment: [
    { department: "Engineering", headcount: 420, payroll: 1260000, benefits: 189000, total: 1575000, percentOfTotal: 44.4 },
    { department: "Sales", headcount: 280, payroll: 700000, benefits: 105000, total: 875000, percentOfTotal: 24.6 },
    { department: "Operations", headcount: 210, payroll: 420000, benefits: 63000, total: 525000, percentOfTotal: 14.8 },
    { department: "Finance", headcount: 143, payroll: 286000, benefits: 42900, total: 357500, percentOfTotal: 10.1 },
    { department: "Marketing", headcount: 100, payroll: 180000, benefits: 27000, total: 225000, percentOfTotal: 6.3 },
    { department: "HR", headcount: 95, payroll: 150000, benefits: 22500, total: 187500, percentOfTotal: 5.3 },
  ],
  costPerEmployee: 2845,
  costTrend: [
    { month: "Jan", cost: 3200000 }, { month: "Feb", cost: 3250000 },
    { month: "Mar", cost: 3350000 }, { month: "Apr", cost: 3400000 },
    { month: "May", cost: 3480000 }, { month: "Jun", cost: 3550000 },
  ],
};

const defaultAttritionRisk: AttritionRiskMap = {
  overallRiskScore: 32, atRiskCount: 18, highRiskCount: 4,
  byDepartment: [
    { department: "Engineering", riskScore: 38, atRisk: 6, highRisk: 2, avgTenure: 2.8, avgSatisfaction: 3.9 },
    { department: "Sales", riskScore: 45, atRisk: 5, highRisk: 1, avgTenure: 2.1, avgSatisfaction: 3.5 },
    { department: "Operations", riskScore: 28, atRisk: 3, highRisk: 1, avgTenure: 3.5, avgSatisfaction: 4.0 },
    { department: "Marketing", riskScore: 35, atRisk: 2, highRisk: 0, avgTenure: 2.5, avgSatisfaction: 3.7 },
    { department: "Finance", riskScore: 22, atRisk: 1, highRisk: 0, avgTenure: 4.2, avgSatisfaction: 4.3 },
    { department: "HR", riskScore: 18, atRisk: 1, highRisk: 0, avgTenure: 4.0, avgSatisfaction: 4.4 },
  ],
  highRiskEmployees: [
    { name: "Alex Rivera", department: "Engineering", risk: 87, role: "Senior Developer", reason: "Passive job seeker, below market comp" },
    { name: "Emily Watson", department: "Sales", risk: 76, role: "Account Exec", reason: "No promotion in 3 years" },
    { name: "Mike Johnson", department: "Operations", risk: 65, role: "Logistics Manager", reason: "Work-life balance concerns" },
    { name: "Priya Sharma", department: "Engineering", risk: 62, role: "Data Scientist", reason: "Relocation likely" },
  ],
  trend: [
    { month: "Jan", rate: 28 }, { month: "Feb", rate: 30 },
    { month: "Mar", rate: 29 }, { month: "Apr", rate: 32 },
    { month: "May", rate: 31 }, { month: "Jun", rate: 32 },
  ],
};

const defaultHiringPipeline: HiringPipeline = {
  openPositions: 23, activeCandidates: 156, interviewsThisWeek: 18,
  offersOutstanding: 7, timeToHireAvg: 28, acceptanceRate: 82,
  pipelineStages: [
    { stage: "Applied", count: 156 }, { stage: "Screened", count: 98 },
    { stage: "Interview", count: 52 }, { stage: "Offer", count: 12 },
    { stage: "Hired", count: 8 },
  ],
  byDepartment: [
    { department: "Engineering", openings: 8, candidates: 62, interviews: 22, offers: 4 },
    { department: "Sales", openings: 5, candidates: 38, interviews: 14, offers: 2 },
    { department: "Operations", openings: 4, candidates: 22, interviews: 8, offers: 1 },
    { department: "Marketing", openings: 3, candidates: 18, interviews: 5, offers: 1 },
    { department: "Finance", openings: 2, candidates: 12, interviews: 3, offers: 0 },
    { department: "HR", openings: 1, candidates: 4, interviews: 2, offers: 0 },
  ],
  upcomingInterviews: [
    { candidate: "Sarah Chen", position: "Senior Developer", date: "Today, 2:00 PM", interviewer: "Tom Park" },
    { candidate: "James Lee", position: "Sales Manager", date: "Today, 3:30 PM", interviewer: "Lisa Wong" },
    { candidate: "Maria Santos", position: "Marketing Lead", date: "Tomorrow, 10:00 AM", interviewer: "David Kim" },
    { candidate: "Raj Patel", position: "Data Analyst", date: "Tomorrow, 1:00 PM", interviewer: "Anna Scott" },
  ],
};

const defaultBudgetForecast: BudgetForecast = {
  totalBudget: 45000000, totalSpent: 32400000, remainingBudget: 12600000,
  burnRate: 5400000, projectedOverspend: false,
  byDepartment: [
    { department: "Engineering", budget: 18000000, spent: 13500000, remaining: 4500000, utilization: 75, forecast: 17600000, onTrack: true },
    { department: "Sales", budget: 10000000, spent: 7600000, remaining: 2400000, utilization: 76, forecast: 9800000, onTrack: true },
    { department: "Operations", budget: 7000000, spent: 4800000, remaining: 2200000, utilization: 69, forecast: 7200000, onTrack: false },
    { department: "Finance", budget: 5000000, spent: 3500000, remaining: 1500000, utilization: 70, forecast: 4900000, onTrack: true },
    { department: "Marketing", budget: 3000000, spent: 1800000, remaining: 1200000, utilization: 60, forecast: 3100000, onTrack: false },
    { department: "HR", budget: 2000000, spent: 1200000, remaining: 800000, utilization: 60, forecast: 1950000, onTrack: true },
  ],
  monthlyBurn: [
    { month: "Jan", budget: 3600000, actual: 3500000 },
    { month: "Feb", budget: 3700000, actual: 3600000 },
    { month: "Mar", budget: 3800000, actual: 3900000 },
    { month: "Apr", budget: 3800000, actual: 3750000 },
    { month: "May", budget: 3900000, actual: 4000000 },
    { month: "Jun", budget: 3900000, actual: 3850000 },
  ],
};

const defaultUtilization: WorkforceUtilization = {
  overallUtilization: 82, billableUtilization: 68,
  byDepartment: [
    { department: "Engineering", utilization: 88, billable: 76, capacity: 440, active: 390, idle: 50 },
    { department: "Sales", utilization: 85, billable: 72, capacity: 300, active: 255, idle: 45 },
    { department: "Operations", utilization: 78, billable: 60, capacity: 230, active: 180, idle: 50 },
    { department: "Finance", utilization: 80, billable: 65, capacity: 155, active: 125, idle: 30 },
    { department: "HR", utilization: 74, billable: 55, capacity: 105, active: 78, idle: 27 },
    { department: "Marketing", utilization: 76, billable: 58, capacity: 115, active: 88, idle: 27 },
  ],
  trend: [
    { month: "Jan", utilization: 78 }, { month: "Feb", utilization: 79 },
    { month: "Mar", utilization: 80 }, { month: "Apr", utilization: 81 },
    { month: "May", utilization: 82 }, { month: "Jun", utilization: 82 },
  ],
};

const defaultBenchmarking: DepartmentBenchmarking = {
  companyAvg: { productivity: 87, engagement: 79, retention: 82, attrition: 9, costPerEmployee: 2845 },
  industryAvg: { productivity: 82, engagement: 75, retention: 78, attrition: 12, costPerEmployee: 3100 },
  departments: [
    { name: "Engineering", productivity: 92, engagement: 85, retention: 88, attrition: 8, costPerHead: 3000, benchmark: "above" },
    { name: "Sales", productivity: 88, engagement: 72, retention: 70, attrition: 15, costPerHead: 2500, benchmark: "match" },
    { name: "Operations", productivity: 85, engagement: 78, retention: 82, attrition: 10, costPerHead: 2000, benchmark: "match" },
    { name: "Finance", productivity: 87, engagement: 80, retention: 88, attrition: 6, costPerHead: 2000, benchmark: "above" },
    { name: "HR", productivity: 90, engagement: 82, retention: 92, attrition: 5, costPerHead: 1580, benchmark: "above" },
    { name: "Marketing", productivity: 83, engagement: 76, retention: 75, attrition: 12, costPerHead: 1800, benchmark: "below" },
  ],
};

const defaultAiBriefing: AiBriefing = {
  generatedAt: new Date().toISOString(),
  executiveSummary: "The organization is in a strong position with healthy headcount growth and improving satisfaction scores. Key areas of focus should be engineering retention and innovation culture, where scores have declined quarter-over-quarter. Budget utilization is on track across most departments, and the hiring pipeline remains robust with a high acceptance rate.",
  keyFindings: [
    { severity: "positive", area: "Headcount Growth", message: "Headcount grew 3.2% this month, outpacing industry average", metric: "+3.2%" },
    { severity: "positive", area: "Training Completion", message: "Training completion rose to 86%, indicating strong L&D engagement", metric: "86%" },
    { severity: "warning", area: "Engineering Attrition", message: "Engineering attrition risk is elevated at 38%, consider retention initiatives", metric: "38%" },
    { severity: "critical", area: "Innovation Score", message: "Innovation culture score dropped 4 points to 68, needs immediate attention", metric: "68" },
    { severity: "warning", area: "Sales Engagement", message: "Sales engagement at 72% is below company average of 79%", metric: "72%" },
  ],
  recommendations: [
    { priority: "high", action: "Launch engineering stay interviews and market compensation review", impact: "Could reduce attrition risk by 15-20%", timeline: "Q3" },
    { priority: "high", action: "Accelerate innovation lab program with cross-functional teams", impact: "Expected to boost innovation score by 8-10 points", timeline: "Immediate" },
    { priority: "medium", action: "Implement sales engagement program with gamification and recognition", impact: "Target engagement increase to 78%", timeline: "Q3" },
    { priority: "medium", action: "Expand diversity recruiting pipeline to 3 new partner universities", impact: "Improve diversity score and talent pipeline", timeline: "Q4" },
    { priority: "low", action: "Review wellness benefits package based on employee feedback survey", impact: "Maintain wellness score above 80", timeline: "Q4" },
  ],
  riskFlags: [
    { type: "Attrition", severity: "high", message: "Key senior engineers showing passive job-seeking behavior", affectedDept: "Engineering" },
    { type: "Budget", severity: "medium", message: "Operations and Marketing departments forecasting overspend", affectedDept: "Operations, Marketing" },
    { type: "Compliance", severity: "low", message: "Q2 compliance training completion at 72%, below 90% target", affectedDept: "All" },
  ],
};

const defaultRiskDashboard: RiskDashboard = {
  overallRiskScore: 32, riskLevel: "low",
  categories: [
    { name: "Attrition", score: 38, level: "moderate", trend: "stable" },
    { name: "Compliance", score: 22, level: "low", trend: "improving" },
    { name: "Financial", score: 28, level: "low", trend: "stable" },
    { name: "Operational", score: 35, level: "moderate", trend: "worsening" },
    { name: "Talent Gap", score: 42, level: "moderate", trend: "stable" },
    { name: "Culture", score: 30, level: "low", trend: "improving" },
  ],
  trend: [
    { month: "Jan", score: 35 }, { month: "Feb", score: 34 },
    { month: "Mar", score: 36 }, { month: "Apr", score: 33 },
    { month: "May", score: 32 }, { month: "Jun", score: 32 },
  ],
};

function SectionHeader({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
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
  label: string; value: number; change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string; format: "number" | "currency" | "percent" | "decimal";
  loading?: boolean;
}) {
  const display = format === "currency" ? formatCurrency(value) : format === "percent" ? formatPercent(value) : format === "decimal" ? value.toFixed(1) : formatNumber(value);
  const isUp = change !== undefined && change >= 0;
  return (
    <motion.div variants={itemVariants}>
      <Card className="glass-panel overflow-hidden">
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className={`rounded-lg p-1.5 ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">{display}</p>
              {change !== undefined && (
                <div className="mt-1 flex items-center gap-1">
                  {isUp ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
                  <span className={cn("text-xs font-medium", isUp ? "text-emerald-500" : "text-rose-500")}>
                    {isUp ? "+" : ""}{change}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function HealthGauge({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? 80 : size === "lg" ? 140 : 100;
  const stroke = size === "sm" ? 6 : size === "lg" ? 10 : 8;
  const radius = (dims - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const colorVal = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: dims, height: dims }}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${dims} ${dims}`}>
        <circle cx={dims / 2} cy={dims / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={dims / 2} cy={dims / 2} r={radius} fill="none" stroke={colorVal}
          strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`${textSize} font-bold`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function StatusDot({ value }: { value: number }) {
  const color = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#f43f5e";
  return <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    positive: "success", warning: "warning", critical: "destructive",
    high: "destructive", medium: "warning", low: "secondary",
    healthy: "success", moderate: "warning", "needs-attention": "destructive",
    above: "success", match: "secondary", below: "destructive",
  };
  return <Badge variant={map[severity] ?? "secondary"} className="text-[10px] px-1.5 py-0">{severity}</Badge>;
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4"];

function OverviewTab({ ov, hd, loading }: { ov: CommandCenterOverview; hd: OrgHealthDetail; loading: boolean }) {
  const kpis = [
    { label: "Total Headcount", value: ov.totalHeadcount, change: ov.headcountChange, icon: Users, color: "text-blue-600 bg-blue-500/10", format: "number" as const },
    { label: "Payroll MTD", value: ov.payrollMtd, change: ov.payrollChange, icon: DollarSign, color: "text-emerald-600 bg-emerald-500/10", format: "currency" as const },
    { label: "Open Positions", value: ov.openPositions, change: ov.positionsChange, icon: Briefcase, color: "text-amber-600 bg-amber-500/10", format: "number" as const },
    { label: "Training Completion", value: ov.trainingCompletion, change: ov.trainingChange, icon: GraduationCap, color: "text-purple-600 bg-purple-500/10", format: "percent" as const },
    { label: "Satisfaction", value: ov.satisfactionScore, change: ov.satisfactionChange, icon: Smile, color: "text-rose-600 bg-rose-500/10", format: "decimal" as const },
    { label: "Org Health", value: ov.orgHealthScore, change: undefined, icon: Heart, color: "text-pink-600 bg-pink-500/10", format: "percent" as const },
  ];

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} loading={loading} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-base">Workforce Health Score</CardTitle>
              </div>
              <CardDescription>7-dimension composite health assessment</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-8">
                  <Skeleton className="h-28 w-28 rounded-full" />
                  <div className="flex-1 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <HealthGauge score={hd.overall} label="health" size="lg" />
                  <div className="flex-1 space-y-2.5">
                    {hd.dimensions.map((d) => {
                      const isUp = d.change >= 0;
                      return (
                        <div key={d.name} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <StatusDot value={d.score} />
                              <span className="font-medium">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("font-semibold tabular-nums", scoreColor(d.score))}>{d.score}</span>
                              <span className={cn("flex items-center gap-0.5 text-[10px]", isUp ? "text-emerald-500" : "text-rose-500")}>
                                {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                {Math.abs(d.change)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full transition-all duration-500 ${scoreBg(d.score)}`}
                              style={{ width: `${d.score}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-base">Productivity Score</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <HealthGauge score={ov.productivityScore} label="overall" size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Department Avg</span>
                        <span className="font-bold">{ov.productivityScore}%</span>
                      </div>
                      <Progress value={ov.productivityScore} className="mt-1 h-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {defaultHeatmap.departments.map((d) => (
                      <div key={d.name} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1">
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-medium">{d.metrics.productivity}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Workforce Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "New Hires", value: ov.newHiresThisMonth, icon: UserPlus, color: "text-emerald-500" },
                    { label: "Departures", value: ov.departuresThisMonth, icon: UserMinus, color: "text-rose-500" },
                    { label: "Avg Tenure", value: `${ov.avgTenure}y`, icon: Clock, color: "text-blue-500" },
                    { label: "Time to Hire", value: `${ov.avgTimeToHire}d`, icon: Target, color: "text-amber-500" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2 rounded-lg border bg-card/50 p-2.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${s.color}/10`}>
                        <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-bold">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function WorkforceTab({ heatmap, cost, budget, util, bench, loading }: {
  heatmap: DepartmentHeatmap; cost: WorkforceCost; budget: BudgetForecast;
  util: WorkforceUtilization; bench: DepartmentBenchmarking; loading: boolean;
}) {
  const heatMetrics = ["productivity", "engagement", "retention", "innovation", "wellness"];
  const heatLabels: Record<string, string> = { productivity: "Prod", engagement: "Eng", retention: "Ret", innovation: "Inn", wellness: "Well" };
  const costDeptData = cost.byDepartment.map((d) => ({ name: d.department, Payroll: d.payroll / 1000, Benefits: d.benefits / 1000, Total: d.total / 1000 }));
  const totalCostVal = cost.totalCost;
  const pieData = cost.byDepartment.map((d) => ({ name: d.department, value: d.total }));
  const utilDeptData = util.byDepartment.map((d) => ({ name: d.department, Utilization: d.utilization, Billable: d.billable }));

  if (loading) return (
    <div className="space-y-6">
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={6} />
      <SectionSkeleton rows={4} />
    </div>
  );

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Layers} title="Organization Heatmap" description="5-metric department scorecard" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {heatmap.departments.map((dept) => {
                const avgScore = Math.round(Object.values(dept.metrics).reduce((a, b) => a + b, 0) / heatMetrics.length);
                return (
                  <div key={dept.name} className={`rounded-lg border border-l-4 bg-card/50 p-3 transition-colors hover:bg-muted/30 ${
                    avgScore >= 80 ? "border-l-emerald-500" : avgScore >= 60 ? "border-l-amber-500" : "border-l-rose-500"
                  }`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{dept.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{dept.headcount}</span>
                        <Users className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="mb-2 flex gap-2">
                      {heatMetrics.map((m) => (
                        <div key={m} className="flex items-center gap-1 text-[10px]">
                          <StatusDot value={dept.metrics[m]} />
                          <span className="text-muted-foreground">{heatLabels[m]}</span>
                          <span className="font-medium tabular-nums">{dept.metrics[m]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Attrition: {dept.attrition}%</span>
                      <span>Budget: {dept.budgetUtilization}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Banknote} title="Workforce Cost" description="Cost breakdown by department" />
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Total Cost", value: formatCurrency(totalCostVal) },
                  { label: "Cost / Employee", value: formatCurrency(cost.costPerEmployee) },
                  { label: "Payroll", value: formatCurrency(cost.totalPayroll) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="text-sm font-bold">{s.value}</p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={costDeptData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}K`} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="Payroll" fill="#3b82f6" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="Benefits" fill="#10b981" radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={LineChartIcon} title="Cost Trend" description="Monthly cost trajectory" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cost.costTrend}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="cost" stroke="#3b82f6" fill="url(#costGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={DollarSign} title="Budget Forecast" description="Department budget tracking" />
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-4 gap-3">
              {[
                { label: "Total Budget", value: formatCurrency(budget.totalBudget) },
                { label: "Spent", value: formatCurrency(budget.totalSpent) },
                { label: "Remaining", value: formatCurrency(budget.remainingBudget) },
                { label: "Burn Rate", value: `${formatCurrency(budget.burnRate)}/mo` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-muted/30 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-bold">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium py-2">Department</th>
                    <th className="text-right font-medium py-2">Budget</th>
                    <th className="text-right font-medium py-2">Spent</th>
                    <th className="text-right font-medium py-2">Utilization</th>
                    <th className="text-right font-medium py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {budget.byDepartment.map((d) => (
                    <tr key={d.department} className="border-b last:border-0">
                      <td className="py-2 font-medium">{d.department}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(d.budget)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(d.spent)}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={d.utilization} className="h-1.5 w-16" />
                          <span className="tabular-nums">{d.utilization}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        {d.onTrack ? <CheckCircle className="inline h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="inline h-3.5 w-3.5 text-rose-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Activity} title="Workforce Utilization" description="Billable vs non-billable breakdown" />
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Overall</span>
                  <span className="text-lg font-bold">{util.overallUtilization}%</span>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Billable</span>
                  <span className="text-lg font-bold text-emerald-500">{util.billableUtilization}%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={utilDeptData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="Billable" fill="#10b981" radius={[0, 2, 2, 0]} />
                  <Bar dataKey="Utilization" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={BarChart3} title="Department Benchmarking" description="Company vs industry" />
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(["productivity", "engagement", "retention", "attrition"] as const).map((m) => (
                  <div key={m} className="rounded-lg bg-muted/30 p-2">
                    <p className="text-[10px] text-muted-foreground capitalize">{m}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{bench.companyAvg[m]}%</span>
                      <span className="text-[10px] text-muted-foreground">vs {bench.industryAvg[m]}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-2">Dept</th>
                      <th className="text-right font-medium py-2">Prod</th>
                      <th className="text-right font-medium py-2">Eng</th>
                      <th className="text-right font-medium py-2">Ret</th>
                      <th className="text-right font-medium py-2">Att</th>
                      <th className="text-right font-medium py-2">Bench</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bench.departments.map((d) => (
                      <tr key={d.name} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{d.name}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.productivity}%</td>
                        <td className="py-1.5 text-right tabular-nums">{d.engagement}%</td>
                        <td className="py-1.5 text-right tabular-nums">{d.retention}%</td>
                        <td className="py-1.5 text-right tabular-nums">{d.attrition}%</td>
                        <td className="py-1.5 text-right"><SeverityBadge severity={d.benchmark} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function PipelineTab({ pipeline, attrition, loading }: { pipeline: HiringPipeline; attrition: AttritionRiskMap; loading: boolean }) {
  const funnelData = pipeline.pipelineStages;
  const maxCount = Math.max(...funnelData.map((f) => f.count));
  const riskDeptBarData = attrition.byDepartment.map((d) => ({ name: d.department, Score: d.riskScore }));

  if (loading) return (
    <div className="space-y-6">
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={5} />
    </div>
  );

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={GitBranch} title="Hiring Pipeline" description="Full recruitment funnel" />
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[
                { label: "Open Positions", value: pipeline.openPositions, icon: Briefcase, color: "text-blue-500" },
                { label: "Active Candidates", value: pipeline.activeCandidates, icon: Users, color: "text-emerald-500" },
                { label: "Interviews/Week", value: pipeline.interviewsThisWeek, icon: Activity, color: "text-amber-500" },
                { label: "Outstanding Offers", value: pipeline.offersOutstanding, icon: Target, color: "text-purple-500" },
                { label: "Time to Hire", value: `${pipeline.timeToHireAvg}d`, icon: Clock, color: "text-rose-500" },
                { label: "Acceptance Rate", value: `${pipeline.acceptanceRate}%`, icon: CheckCircle, color: "text-emerald-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 rounded-lg border bg-card/50 p-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${s.color}/10`}>
                    <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="text-sm font-bold">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Pipeline Funnel</p>
                <div className="space-y-1.5">
                  {funnelData.map((stage, i) => {
                    const widthPct = (stage.count / maxCount) * 100;
                    return (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-right text-muted-foreground">{stage.stage}</span>
                        <div className="flex-1">
                          <div className="h-7 rounded-md bg-primary/10 flex items-center px-2" style={{ width: `${Math.max(widthPct, 8)}%` }}>
                            <span className="text-xs font-bold tabular-nums">{stage.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">By Department</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left font-medium py-2">Department</th>
                        <th className="text-right font-medium py-2">Openings</th>
                        <th className="text-right font-medium py-2">Candidates</th>
                        <th className="text-right font-medium py-2">Interviews</th>
                        <th className="text-right font-medium py-2">Offers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipeline.byDepartment.map((d) => (
                        <tr key={d.department} className="border-b last:border-0">
                          <td className="py-1.5 font-medium">{d.department}</td>
                          <td className="py-1.5 text-right tabular-nums">{d.openings}</td>
                          <td className="py-1.5 text-right tabular-nums">{d.candidates}</td>
                          <td className="py-1.5 text-right tabular-nums">{d.interviews}</td>
                          <td className="py-1.5 text-right tabular-nums">{d.offers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Upcoming Interviews</p>
                  <div className="space-y-1.5">
                    {pipeline.upcomingInterviews.map((iv) => (
                      <div key={iv.candidate} className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
                        <div>
                          <p className="text-xs font-medium">{iv.candidate}</p>
                          <p className="text-[10px] text-muted-foreground">{iv.position} &middot; {iv.interviewer}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{iv.date}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={AlertTriangle} title="Attrition Risk Map" description="Risk assessment by department" action={
              <Badge variant={attrition.overallRiskScore >= 50 ? "destructive" : "warning"} className="text-[10px]">
                Score: {attrition.overallRiskScore}
              </Badge>
            } />
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "At Risk", value: attrition.atRiskCount, color: "bg-amber-500" },
                    { label: "High Risk", value: attrition.highRiskCount, color: "bg-rose-500" },
                    { label: "Avg Risk Score", value: `${attrition.overallRiskScore}%`, color: "bg-blue-500" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/30 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className={`text-lg font-bold ${s.label === "High Risk" ? "text-rose-500" : ""}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={riskDeptBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="Score" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Risk Trend</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={attrition.trend}>
                      <Line type="monotone" dataKey="rate" stroke="#f43f5e" strokeWidth={2} dot={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">High Risk Employees</p>
                <div className="space-y-2">
                  {attrition.highRiskEmployees.map((emp) => (
                    <div key={emp.name} className="flex items-center gap-3 rounded-lg border p-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-rose-500/10 text-xs text-rose-600">
                          {emp.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{emp.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{emp.role} &middot; {emp.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn("text-sm font-bold", scoreColor(emp.risk))}>{emp.risk}%</span>
                        <p className="text-[10px] text-muted-foreground">risk</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function AiBriefingTab({ briefing, loading }: { briefing: AiBriefing; loading: boolean }) {
  if (loading) return (
    <div className="space-y-6">
      <SectionSkeleton rows={2} />
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={3} />
    </div>
  );

  const severityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    positive: CheckCircle, warning: AlertTriangle, critical: XCircle,
  };
  const severityColors: Record<string, string> = {
    positive: "border-emerald-500/20 bg-emerald-500/5", warning: "border-amber-500/20 bg-amber-500/5", critical: "border-rose-500/20 bg-rose-500/5",
  };
  const priorityColors: Record<string, string> = {
    high: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Sparkles} title="AI Executive Briefing" description={`Generated ${formatRelativeTime(briefing.generatedAt)} ago`} action={
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Download className="h-3 w-3" /> Export
              </Button>
            } />
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 p-4">
              <div className="flex items-start gap-3">
                <Brain className="mt-0.5 h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Executive Summary</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{briefing.executiveSummary}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Lightbulb} title="Key Findings" description="AI-identified insights" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {briefing.keyFindings.map((finding, i) => {
                const Icon = severityIcons[finding.severity] ?? Info;
                return (
                  <div key={i} className={`rounded-lg border p-3 ${severityColors[finding.severity] ?? ""}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
                        finding.severity === "positive" ? "text-emerald-500" : finding.severity === "warning" ? "text-amber-500" : "text-rose-500"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{finding.area}</span>
                          <SeverityBadge severity={finding.severity} />
                        </div>
                        <p className="text-xs text-muted-foreground">{finding.message}</p>
                        <span className="text-xs font-bold tabular-nums">{finding.metric}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={CheckCircle} title="Recommendations" description="Prioritized actions" />
            </CardHeader>
            <CardContent className="space-y-2">
              {briefing.recommendations.map((rec, i) => (
                <div key={i} className="rounded-lg border p-3 transition-colors hover:bg-muted/30">
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityColors[rec.priority]}`}>
                      {rec.priority}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{rec.action}</p>
                      <p className="text-[10px] text-muted-foreground">{rec.impact} &middot; {rec.timeline}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Flag} title="Risk Flags" description="Critical items requiring attention" />
            </CardHeader>
            <CardContent className="space-y-2">
              {briefing.riskFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-rose-500/10 bg-rose-500/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{flag.type}</span>
                      <SeverityBadge severity={flag.severity} />
                      <Badge variant="outline" className="text-[10px] ml-auto">{flag.affectedDept}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.message}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function RiskTab({ risk, loading }: { risk: RiskDashboard; loading: boolean }) {
  const riskLevelColor = risk.riskLevel === "low" ? "text-emerald-500" : risk.riskLevel === "moderate" ? "text-amber-500" : "text-rose-500";
  const levelColors: Record<string, string> = {
    low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    high: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };

  if (loading) return (
    <div className="space-y-6">
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={4} />
    </div>
  );

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Shield} title="Composite Risk Score" description="Aggregate risk assessment" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="flex flex-col items-center justify-center lg:col-span-1">
                <HealthGauge score={100 - risk.overallRiskScore} label="safe" size="lg" />
                <span className={`mt-1 text-xs font-semibold capitalize ${riskLevelColor}`}>{risk.riskLevel} risk</span>
              </div>
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Risk Categories</p>
                <div className="space-y-2">
                  {risk.categories.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold tabular-nums ${scoreColor(100 - cat.score)}`}>{cat.score}</span>
                            <span className={`text-[10px] capitalize rounded px-1 py-0 ${levelColors[cat.level]}`}>{cat.level}</span>
                            <span className={`text-[10px] ${
                              cat.trend === "improving" ? "text-emerald-500" : cat.trend === "worsening" ? "text-rose-500" : "text-muted-foreground"
                            }`}>{cat.trend}</span>
                          </div>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full transition-all ${scoreBg(100 - cat.score)}`}
                            style={{ width: `${Math.min(100, cat.score * 2)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Risk Trend</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={risk.trend}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="score" stroke="#f43f5e" fill="url(#riskGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Globe} title="Company-wide Analytics Center" description="Launch specialized analytics modules" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "Performance Analytics", desc: "Goal tracking, reviews, feedback trends", icon: BarChart3, href: "/dashboard/performance", color: "text-blue-500 bg-blue-500/10" },
                { title: "Compliance Center", desc: "Policy audits, violations, readiness", icon: Shield, href: "/dashboard/compliance", color: "text-emerald-500 bg-emerald-500/10" },
                { title: "Reports & Insights", desc: "Custom reports, scheduled exports", icon: LineChartIcon, href: "/dashboard/reports", color: "text-purple-500 bg-purple-500/10" },
                { title: "Talent Analytics", desc: "ATS pipeline, time-to-hire, sourcing", icon: Users, href: "/dashboard/ats", color: "text-amber-500 bg-amber-500/10" },
              ].map((m) => (
                <Link key={m.title} href={m.href}>
                  <div className="group cursor-pointer rounded-lg border bg-card/50 p-4 transition-all hover:bg-muted/30 hover:shadow-md">
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${m.color}`}>
                      <m.icon className="h-5 w-5" />
                    </div>
                    <p className="mb-1 text-sm font-semibold group-hover:text-primary">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Launch <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function SectionSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn("glass-panel", className)}>
      <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </CardContent>
    </Card>
  );
}

export default function CommandCenterPage() {
  const [tab, setTab] = useState("overview");

  const { data: overviewResp, isLoading: overviewLoading } = useQuery({
    queryKey: ["command-center-overview"],
    queryFn: async () => { const { data } = await commandCenterApi.overview(); return data as CommandCenterOverview; },
  });
  const { data: healthResp, isLoading: healthLoading } = useQuery({
    queryKey: ["command-center-org-health"],
    queryFn: async () => { const { data } = await commandCenterApi.orgHealth(); return data as OrgHealthDetail; },
  });
  const { data: heatmapResp, isLoading: heatmapLoading } = useQuery({
    queryKey: ["command-center-heatmap"],
    queryFn: async () => { const { data } = await commandCenterApi.departmentHeatmap(); return data as DepartmentHeatmap; },
  });
  const { data: costResp, isLoading: costLoading } = useQuery({
    queryKey: ["command-center-cost"],
    queryFn: async () => { const { data } = await commandCenterApi.workforceCost(); return data as WorkforceCost; },
  });
  const { data: pipelineResp, isLoading: pipelineLoading } = useQuery({
    queryKey: ["command-center-pipeline"],
    queryFn: async () => { const { data } = await commandCenterApi.hiringPipeline(); return data as HiringPipeline; },
  });
  const { data: attritionResp, isLoading: attritionLoading } = useQuery({
    queryKey: ["command-center-attrition"],
    queryFn: async () => { const { data } = await commandCenterApi.attritionRiskMap(); return data as AttritionRiskMap; },
  });
  const { data: budgetResp, isLoading: budgetLoading } = useQuery({
    queryKey: ["command-center-budget"],
    queryFn: async () => { const { data } = await commandCenterApi.budgetForecast(); return data as BudgetForecast; },
  });
  const { data: utilResp, isLoading: utilLoading } = useQuery({
    queryKey: ["command-center-utilization"],
    queryFn: async () => { const { data } = await commandCenterApi.utilization(); return data as WorkforceUtilization; },
  });
  const { data: benchResp, isLoading: benchLoading } = useQuery({
    queryKey: ["command-center-benchmarking"],
    queryFn: async () => { const { data } = await commandCenterApi.benchmarking(); return data as DepartmentBenchmarking; },
  });
  const { data: briefingResp, isLoading: briefingLoading } = useQuery({
    queryKey: ["command-center-briefing"],
    queryFn: async () => { const { data } = await commandCenterApi.aiBriefing(); return data as AiBriefing; },
  });
  const { data: riskResp, isLoading: riskLoading } = useQuery({
    queryKey: ["command-center-risk"],
    queryFn: async () => { const { data } = await commandCenterApi.riskDashboard(); return data as RiskDashboard; },
  });

  const ov = overviewResp ?? defaultOverview;
  const hd = healthResp ?? defaultHealthDetail;
  const heatmap = heatmapResp ?? defaultHeatmap;
  const cost = costResp ?? defaultWorkforceCost;
  const pipeline = pipelineResp ?? defaultHiringPipeline;
  const attrition = attritionResp ?? defaultAttritionRisk;
  const budget = budgetResp ?? defaultBudgetForecast;
  const util = utilResp ?? defaultUtilization;
  const bench = benchResp ?? defaultBenchmarking;
  const briefing = briefingResp ?? defaultAiBriefing;
  const risk = riskResp ?? defaultRiskDashboard;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Command Center</h1>
          <p className="text-sm text-muted-foreground">Real-time workforce intelligence powered by AI</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" /> AI Powered
          </Badge>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            <Download className="h-3 w-3" /> Export
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="workforce" className="text-xs sm:text-sm">Workforce</TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm">Pipeline</TabsTrigger>
          <TabsTrigger value="briefing" className="text-xs sm:text-sm">AI Briefing</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs sm:text-sm">Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab ov={ov} hd={hd} loading={overviewLoading || healthLoading} />
        </TabsContent>

        <TabsContent value="workforce" className="mt-4">
          <WorkforceTab heatmap={heatmap} cost={cost} budget={budget} util={util} bench={bench}
            loading={heatmapLoading || costLoading || budgetLoading || utilLoading || benchLoading} />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab pipeline={pipeline} attrition={attrition} loading={pipelineLoading || attritionLoading} />
        </TabsContent>

        <TabsContent value="briefing" className="mt-4">
          <AiBriefingTab briefing={briefing} loading={briefingLoading} />
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <RiskTab risk={risk} loading={riskLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
