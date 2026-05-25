"use client";

import Link from "next/link";
import {
  Bot, Brain, LineChart, Shield, Users, Search, FileText, BarChart3,
  Target, TrendingUp, Calendar, Clock, DollarSign, GitPullRequest,
  Activity, AlertTriangle, Radio, Zap, Layers, Sparkles, Workflow,
  Cpu, Orbit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "AI Copilots",
    icon: Bot,
    items: [
      { href: "/dashboard/ai/hr-copilot", label: "HR Copilot", desc: "AI-powered HR operations assistant" },
      { href: "/dashboard/ai/employee-copilot", label: "Employee Copilot", desc: "Personal employee experience assistant" },
      { href: "/dashboard/ai/manager-copilot", label: "Manager Copilot", desc: "Team management and leadership AI" },
      { href: "/dashboard/ai/executive-copilot", label: "Executive Copilot", desc: "Strategic workforce intelligence" },
    ],
  },
  {
    label: "Predictions & Analytics",
    icon: Brain,
    items: [
      { href: "/dashboard/ai/attrition-prediction", label: "Attrition Prediction", desc: "Predict employee turnover risk" },
      { href: "/dashboard/ai/burnout-prediction", label: "Burnout Prediction", desc: "Detect employee burnout signals" },
      { href: "/dashboard/ai/promotion-prediction", label: "Promotion Prediction", desc: "Identify ready-for-promotion talent" },
      { href: "/dashboard/ai/salary-recommendation", label: "Salary Recommendations", desc: "Market-based compensation insights" },
    ],
  },
  {
    label: "Reporting & Dashboards",
    icon: BarChart3,
    items: [
      { href: "/dashboard/ai/natural-language-reporting", label: "NL Reporting", desc: "Generate reports from plain English" },
      { href: "/dashboard/ai/ai-dashboard", label: "AI Dashboard", desc: "Auto-generated analytics dashboards" },
      { href: "/dashboard/ai/workforce-forecasting", label: "WF Forecasting", desc: "Workforce demand projections" },
      { href: "/dashboard/ai/budget-forecasting", label: "Budget Forecasting", desc: "AI-powered budget predictions" },
    ],
  },
  {
    label: "Intelligent Assistants",
    icon: Sparkles,
    items: [
      { href: "/dashboard/ai/policy-assistant", label: "Policy Assistant", desc: "Instant policy Q&A" },
      { href: "/dashboard/ai/leave-assistant", label: "Leave Assistant", desc: "Smart leave recommendations" },
      { href: "/dashboard/ai/recruitment-assistant", label: "Recruitment Assistant", desc: "AI-powered hiring support" },
      { href: "/dashboard/ai/onboarding-assistant", label: "Onboarding Assistant", desc: "Personalized onboarding plans" },
      { href: "/dashboard/ai/training-assistant", label: "Training Assistant", desc: "Skill gap training recommendations" },
      { href: "/dashboard/ai/compliance-assistant", label: "Compliance Assistant", desc: "Regulatory compliance checking" },
      { href: "/dashboard/ai/knowledge-search", label: "Knowledge Search", desc: "Enterprise knowledge discovery" },
    ],
  },
  {
    label: "Risk & Advisory",
    icon: Shield,
    items: [
      { href: "/dashboard/ai/org-advisor", label: "Org Advisor", desc: "Organizational structure advice" },
      { href: "/dashboard/ai/risk-detection", label: "Risk Detection", desc: "Proactive risk identification" },
      { href: "/dashboard/ai/anomaly-detection", label: "Anomaly Detection", desc: "Data pattern anomaly alerts" },
      { href: "/dashboard/ai/succession-planning", label: "Succession Planning", desc: "Leadership pipeline planning" },
    ],
  },
  {
    label: "Operations & Automation",
    icon: Workflow,
    items: [
      { href: "/dashboard/ai/shift-optimization", label: "Shift Optimization", desc: "AI-optimized shift scheduling" },
      { href: "/dashboard/ai/performance-summaries", label: "Perf Summaries", desc: "Automated performance reviews" },
      { href: "/dashboard/ai/meeting-summaries", label: "Meeting Summaries", desc: "AI-generated meeting notes" },
      { href: "/dashboard/ai/workflow-generation", label: "Workflow Generation", desc: "Auto-generated HR workflows" },
      { href: "/dashboard/ai/automation-builder", label: "Automation Builder", desc: "Build HR process automations" },
    ],
  },
  {
    label: "Next-Gen AI",
    icon: Cpu,
    items: [
      { href: "/dashboard/ai/agentic-hr", label: "Agentic HR", desc: "Multi-agent HR workflow orchestration" },
      { href: "/dashboard/ai/autonomous-intelligence", label: "Auto Intelligence", desc: "Self-learning workforce AI" },
    ],
  },
];

export default function AIHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Platform</h1>
          <p className="text-muted-foreground">Enterprise AI features: copilots, predictions, automation, and autonomous intelligence</p>
        </div>
        <Badge variant="success" className="gap-1">
          <Sparkles className="h-3 w-3" /> 30 AI Features
        </Badge>
      </div>

      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-3">
            <group.icon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{group.label}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="glass-panel cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 h-full">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
