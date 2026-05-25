"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronDown,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  Briefcase,
  Target,
  GraduationCap,
  Bot,
  Shield,
  ShieldCheck,
  LayoutGrid,
  Cable,
  Orbit,
  LineChart,
  BookOpen,
  Lock,
  Fingerprint,
  Siren,
  Database,
  Key,
  Globe,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { href: string; label: string }[];
}

const navItems: ({ href: string; label: string; icon: React.ComponentType<{ className?: string }> } | NavGroup)[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/lifecycle", label: "Lifecycle", icon: Orbit },
  {
    label: "Workforce Planning",
    icon: LineChart,
    children: [
      { href: "/dashboard/workforce-planning", label: "Dashboard" },
    ],
  },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  {
    label: "ATS",
    icon: Briefcase,
    children: [
      { href: "/dashboard/ats", label: "Dashboard" },
      { href: "/dashboard/ats/jobs", label: "Jobs" },
      { href: "/dashboard/ats/candidates", label: "Candidates" },
      { href: "/dashboard/ats/analytics", label: "Analytics" },
    ],
  },
  { href: "/dashboard/payroll", label: "Payroll", icon: Wallet },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/leave", label: "Leave", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  {
    label: "Performance",
    icon: Target,
    children: [
      { href: "/dashboard/performance", label: "Overview" },
      { href: "/dashboard/performance?tab=okrs", label: "OKRs & KPIs" },
      { href: "/dashboard/performance?tab=reviews", label: "Reviews" },
      { href: "/dashboard/performance?tab=feedback", label: "Feedback" },
      { href: "/dashboard/performance?tab=hipo", label: "HiPo Tracking" },
      { href: "/dashboard/performance?tab=ai", label: "AI Insights" },
      { href: "/dashboard/performance?tab=devplans", label: "Dev Plans" },
    ],
  },
  {
    label: "LMS",
    icon: GraduationCap,
    children: [
      { href: "/dashboard/lms", label: "Dashboard" },
      { href: "/dashboard/lms/courses", label: "Courses" },
      { href: "/dashboard/lms/certifications", label: "Certifications" },
      { href: "/dashboard/lms/skills", label: "Skills" },
    ],
  },
  {
    label: "L&D",
    icon: BookOpen,
    children: [
      { href: "/dashboard/learning-development", label: "Dashboard" },
    ],
  },
  {
    label: "AI Platform",
    icon: Bot,
    children: [
      { href: "/dashboard/ai", label: "AI Hub" },
      { href: "/dashboard/ai/hr-copilot", label: "HR Copilot" },
      { href: "/dashboard/ai/employee-copilot", label: "Employee Copilot" },
      { href: "/dashboard/ai/manager-copilot", label: "Manager Copilot" },
      { href: "/dashboard/ai/executive-copilot", label: "Executive Copilot" },
      { href: "/dashboard/ai/natural-language-reporting", label: "NL Reporting" },
      { href: "/dashboard/ai/ai-dashboard", label: "AI Dashboard" },
      { href: "/dashboard/ai/attrition-prediction", label: "Attrition Prediction" },
      { href: "/dashboard/ai/burnout-prediction", label: "Burnout Prediction" },
      { href: "/dashboard/ai/promotion-prediction", label: "Promotion Prediction" },
      { href: "/dashboard/ai/salary-recommendation", label: "Salary Recommendation" },
      { href: "/dashboard/ai/workforce-forecasting", label: "WF Forecasting" },
      { href: "/dashboard/ai/policy-assistant", label: "Policy Assistant" },
      { href: "/dashboard/ai/leave-assistant", label: "Leave Assistant" },
      { href: "/dashboard/ai/recruitment-assistant", label: "Recruitment Assistant" },
      { href: "/dashboard/ai/onboarding-assistant", label: "Onboarding Assistant" },
      { href: "/dashboard/ai/training-assistant", label: "Training Assistant" },
      { href: "/dashboard/ai/compliance-assistant", label: "Compliance Assistant" },
      { href: "/dashboard/ai/knowledge-search", label: "Knowledge Search" },
      { href: "/dashboard/ai/org-advisor", label: "Org Advisor" },
      { href: "/dashboard/ai/risk-detection", label: "Risk Detection" },
      { href: "/dashboard/ai/anomaly-detection", label: "Anomaly Detection" },
      { href: "/dashboard/ai/shift-optimization", label: "Shift Optimization" },
      { href: "/dashboard/ai/succession-planning", label: "Succession Planning" },
      { href: "/dashboard/ai/budget-forecasting", label: "Budget Forecasting" },
      { href: "/dashboard/ai/performance-summaries", label: "Perf Summaries" },
      { href: "/dashboard/ai/meeting-summaries", label: "Meeting Summaries" },
      { href: "/dashboard/ai/workflow-generation", label: "Workflow Generation" },
      { href: "/dashboard/ai/automation-builder", label: "Automation Builder" },
      { href: "/dashboard/ai/agentic-hr", label: "Agentic HR" },
      { href: "/dashboard/ai/autonomous-intelligence", label: "Auto Intelligence" },
    ],
  },
  { href: "/dashboard/compliance", label: "Compliance", icon: Shield },
  {
    label: "Security",
    icon: ShieldCheck,
    children: [
      { href: "/dashboard/security", label: "Dashboard" },
      { href: "/dashboard/security/pam", label: "Privileged Access" },
      { href: "/dashboard/security/data-classification", label: "Data Classification" },
      { href: "/dashboard/security/dlp", label: "DLP Policies" },
      { href: "/dashboard/security/compliance-center", label: "Compliance Center" },
      { href: "/dashboard/security/compliance-reports", label: "Compliance Reports" },
    ],
  },
  {
    label: "Live",
    icon: LayoutGrid,
    children: [
      { href: "/dashboard/live", label: "Overview" },
      { href: "/dashboard/live/presence", label: "Presence" },
      { href: "/dashboard/live/attendance-wall", label: "Attendance Wall" },
      { href: "/dashboard/live/activity-feed", label: "Activity Feed" },
      { href: "/dashboard/live/alerts", label: "Alerts" },
      { href: "/dashboard/live/announcements", label: "Announcements" },
      { href: "/dashboard/live/chat", label: "Chat" },
      { href: "/dashboard/live/polls", label: "Polls" },
      { href: "/dashboard/live/incidents", label: "Incidents" },
      { href: "/dashboard/live/emergency", label: "Emergency" },
      { href: "/dashboard/live/sla", label: "SLA Monitor" },
      { href: "/dashboard/live/payroll-progress", label: "Payroll Progress" },
      { href: "/dashboard/live/leave-approvals", label: "Leave Approvals" },
      { href: "/dashboard/live/kpi-dashboards", label: "KPI Dashboards" },
      { href: "/dashboard/live/heatmap", label: "Heatmap" },
      { href: "/dashboard/live/tasks", label: "Tasks" },
      { href: "/dashboard/live/escalation", label: "Escalation" },
      { href: "/dashboard/live/compliance-violations", label: "Compliance" },
      { href: "/dashboard/live/onboarding", label: "Onboarding" },
      { href: "/dashboard/live/recruitment", label: "Recruitment" },
      { href: "/dashboard/live/forecasting", label: "Forecasting" },
      { href: "/dashboard/live/staffing", label: "Staffing" },
      { href: "/dashboard/live/command-center", label: "Command Center" },
    ],
  },
  { href: "/dashboard/integrations", label: "Integrations", icon: Cable },
  { href: "/dashboard/command-center", label: "Command Center", icon: LayoutGrid },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const groups: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if ("children" in item && item.children.some((c) => pathname.startsWith(c.href.replace(/\/$/, "")))) {
        groups[item.label] = true;
      }
    });
    return groups;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  function isGroupActive(group: NavGroup) {
    return group.children.some((c) => isActive(c.href));
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center px-2"
        )}
      >
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              A
            </span>
            <span>Atlas</span>
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            A
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          if ("children" in item) {
            const groupActive = isGroupActive(item);
            const isOpen = openGroups[item.label] ?? groupActive;
            return (
              <div key={item.label}>
                {!collapsed ? (
                  <>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        groupActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                              isActive(child.href)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.children[0].href}
                    title={item.label}
                    className={cn(
                      "flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      groupActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                  </Link>
                )}
              </div>
            );
          }
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
