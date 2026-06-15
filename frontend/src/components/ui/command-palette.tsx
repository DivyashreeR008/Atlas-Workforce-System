"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, Users, Clock, Wallet, BarChart3, Calendar, FileText, Bell, Shield, Bot, Settings, Cable, LayoutGrid, Briefcase, Target, GraduationCap, BookOpen, LineChart, Orbit, ShieldCheck, Radio, MessageSquare, Activity, AlertTriangle, Megaphone, Footprints, TrendingUp, UserPlus, Globe, GitPullRequest, Siren, BarChart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  path: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const ALL_COMMANDS: Command[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", keywords: "home overview main", icon: LayoutDashboard, category: "Core" },
  { id: "employees", label: "Employees", path: "/dashboard/employees", keywords: "employees staff people directory", icon: Users, category: "Core" },
  { id: "lifecycle", label: "Lifecycle", path: "/dashboard/lifecycle", keywords: "onboarding offboarding lifecycle", icon: Orbit, category: "Core" },
  { id: "attendance", label: "Attendance", path: "/dashboard/attendance", keywords: "attendance clock in out check time", icon: Clock, category: "Core" },
  { id: "payroll", label: "Payroll", path: "/dashboard/payroll", keywords: "payroll salary payment run compensation", icon: Wallet, category: "Core" },
  { id: "analytics", label: "Analytics", path: "/dashboard/analytics", keywords: "analytics insights charts trends data", icon: BarChart3, category: "Core" },
  { id: "leave", label: "Leave", path: "/dashboard/leave", keywords: "leave vacation sick time off pto", icon: Calendar, category: "Core" },
  { id: "reports", label: "Reports", path: "/dashboard/reports", keywords: "reports export generate pdf", icon: FileText, category: "Core" },
  { id: "notifications", label: "Notifications", path: "/dashboard/notifications", keywords: "notifications alerts updates", icon: Bell, category: "Core" },
  { id: "compliance", label: "Compliance", path: "/dashboard/compliance", keywords: "compliance audit policy regulation", icon: Shield, category: "Core" },
  { id: "copilot", label: "AI Copilot", path: "/dashboard/copilot", keywords: "ai copilot chat assistant help", icon: Bot, category: "AI" },
  { id: "integrations", label: "Integrations", path: "/dashboard/integrations", keywords: "integrations api webhook connect", icon: Cable, category: "Core" },
  { id: "command-center", label: "Command Center", path: "/dashboard/command-center", keywords: "executive command center overview", icon: LayoutGrid, category: "Core" },
  { id: "settings", label: "Settings", path: "/dashboard/settings", keywords: "settings preferences account config", icon: Settings, category: "Core" },
  { id: "ats", label: "ATS Dashboard", path: "/dashboard/ats", keywords: "ats applicant tracking jobs candidates", icon: Briefcase, category: "HR" },
  { id: "ats-jobs", label: "ATS Jobs", path: "/dashboard/ats/jobs", keywords: "ats jobs positions openings", icon: Briefcase, category: "HR" },
  { id: "ats-candidates", label: "ATS Candidates", path: "/dashboard/ats/candidates", keywords: "ats candidates applicants", icon: Users, category: "HR" },
  { id: "ats-analytics", label: "ATS Analytics", path: "/dashboard/ats/analytics", keywords: "ats analytics hiring metrics", icon: BarChart3, category: "HR" },
  { id: "performance", label: "Performance", path: "/dashboard/performance", keywords: "performance reviews goals okrs", icon: Target, category: "HR" },
  { id: "lms", label: "LMS Dashboard", path: "/dashboard/lms", keywords: "lms learning courses training", icon: GraduationCap, category: "HR" },
  { id: "workforce-planning", label: "Workforce Planning", path: "/dashboard/workforce-planning", keywords: "workforce planning capacity forecast", icon: LineChart, category: "HR" },
  { id: "learning-dev", label: "L&D Dashboard", path: "/dashboard/learning-development", keywords: "learning development training skills", icon: BookOpen, category: "HR" },
  { id: "security", label: "Security Dashboard", path: "/dashboard/security", keywords: "security zero trust pam dlp", icon: ShieldCheck, category: "Admin" },
  { id: "security-pam", label: "Privileged Access", path: "/dashboard/security/pam", keywords: "pam privileged access management", icon: ShieldCheck, category: "Admin" },
  { id: "security-data", label: "Data Classification", path: "/dashboard/security/data-classification", keywords: "data classification sensitivity", icon: ShieldCheck, category: "Admin" },
  { id: "security-dlp", label: "DLP Policies", path: "/dashboard/security/dlp", keywords: "dlp data loss prevention", icon: ShieldCheck, category: "Admin" },
  { id: "security-compliance", label: "Compliance Center", path: "/dashboard/security/compliance-center", keywords: "compliance center security", icon: ShieldCheck, category: "Admin" },
  { id: "security-reports", label: "Compliance Reports", path: "/dashboard/security/compliance-reports", keywords: "compliance reports security", icon: FileText, category: "Admin" },
  { id: "live", label: "Live Overview", path: "/dashboard/live", keywords: "live realtime operations center", icon: Radio, category: "Live" },
  { id: "live-presence", label: "Live Presence", path: "/dashboard/live/presence", keywords: "live presence online status", icon: Users, category: "Live" },
  { id: "live-chat", label: "Live Chat", path: "/dashboard/live/chat", keywords: "live chat messaging communication", icon: MessageSquare, category: "Live" },
  { id: "live-activity", label: "Activity Feed", path: "/dashboard/live/activity-feed", keywords: "live activity feed events", icon: Activity, category: "Live" },
  { id: "live-alerts", label: "Alerts", path: "/dashboard/live/alerts", keywords: "live alerts warnings notifications", icon: AlertTriangle, category: "Live" },
  { id: "live-announcements", label: "Announcements", path: "/dashboard/live/announcements", keywords: "live announcements broadcasts", icon: Megaphone, category: "Live" },
  { id: "live-attendance", label: "Attendance Wall", path: "/dashboard/live/attendance-wall", keywords: "live attendance clock wall", icon: Footprints, category: "Live" },
  { id: "live-command", label: "Command Center", path: "/dashboard/live/command-center", keywords: "live executive command monitoring", icon: LayoutGrid, category: "Live" },
  { id: "live-kpi", label: "KPI Dashboards", path: "/dashboard/live/kpi-dashboards", keywords: "live kpi metrics dashboards", icon: TrendingUp, category: "Live" },
  { id: "live-heatmap", label: "Workforce Heatmap", path: "/dashboard/live/heatmap", keywords: "live heatmap workforce density", icon: Globe, category: "Live" },
  { id: "live-tasks", label: "Tasks", path: "/dashboard/live/tasks", keywords: "live tasks assignments", icon: GitPullRequest, category: "Live" },
  { id: "live-escalation", label: "Escalation", path: "/dashboard/live/escalation", keywords: "live escalation sla", icon: TrendingUp, category: "Live" },
  { id: "live-compliance", label: "Compliance Violations", path: "/dashboard/live/compliance-violations", keywords: "live compliance violations", icon: Shield, category: "Live" },
  { id: "live-onboarding", label: "Onboarding", path: "/dashboard/live/onboarding", keywords: "live onboarding progress", icon: UserPlus, category: "Live" },
  { id: "live-recruitment", label: "Recruitment", path: "/dashboard/live/recruitment", keywords: "live recruitment pipeline", icon: Briefcase, category: "Live" },
  { id: "live-forecasting", label: "Forecasting", path: "/dashboard/live/forecasting", keywords: "live forecasting predictions", icon: LineChart, category: "Live" },
  { id: "live-sla", label: "SLA Monitor", path: "/dashboard/live/sla", keywords: "live sla service level", icon: Clock, category: "Live" },
  { id: "live-staffing", label: "Staffing", path: "/dashboard/live/staffing", keywords: "live staffing shift coverage", icon: Users, category: "Live" },
  { id: "live-polls", label: "Polls", path: "/dashboard/live/polls", keywords: "live polls voting", icon: BarChart, category: "Live" },
  { id: "live-emergency", label: "Emergency", path: "/dashboard/live/emergency", keywords: "live emergency broadcast", icon: Radio, category: "Live" },
  { id: "live-incidents", label: "Incidents", path: "/dashboard/live/incidents", keywords: "live incidents management", icon: Siren, category: "Live" },
  { id: "live-payroll", label: "Payroll Progress", path: "/dashboard/live/payroll-progress", keywords: "live payroll progress", icon: Wallet, category: "Live" },
  { id: "live-leave", label: "Leave Approvals", path: "/dashboard/live/leave-approvals", keywords: "live leave approvals", icon: Calendar, category: "Live" },
  { id: "ai-hub", label: "AI Hub", path: "/dashboard/ai", keywords: "ai artificial intelligence hub", icon: Sparkles, category: "AI" },
  { id: "ai-hr-copilot", label: "HR Copilot", path: "/dashboard/ai/hr-copilot", keywords: "ai hr copilot assistant", icon: Bot, category: "AI" },
  { id: "ai-employee-copilot", label: "Employee Copilot", path: "/dashboard/ai/employee-copilot", keywords: "ai employee copilot assistant", icon: Bot, category: "AI" },
  { id: "ai-manager-copilot", label: "Manager Copilot", path: "/dashboard/ai/manager-copilot", keywords: "ai manager copilot assistant", icon: Bot, category: "AI" },
  { id: "ai-executive-copilot", label: "Executive Copilot", path: "/dashboard/ai/executive-copilot", keywords: "ai executive copilot assistant", icon: Bot, category: "AI" },
  { id: "ai-reporting", label: "NL Reporting", path: "/dashboard/ai/natural-language-reporting", keywords: "ai natural language reporting", icon: FileText, category: "AI" },
  { id: "ai-dashboard", label: "AI Dashboard", path: "/dashboard/ai/ai-dashboard", keywords: "ai dashboard generation", icon: LayoutGrid, category: "AI" },
  { id: "ai-attrition", label: "Attrition Prediction", path: "/dashboard/ai/attrition-prediction", keywords: "ai attrition prediction turnover", icon: TrendingUp, category: "AI" },
  { id: "ai-burnout", label: "Burnout Prediction", path: "/dashboard/ai/burnout-prediction", keywords: "ai burnout prediction wellness", icon: Activity, category: "AI" },
  { id: "ai-promotion", label: "Promotion Prediction", path: "/dashboard/ai/promotion-prediction", keywords: "ai promotion prediction career", icon: Target, category: "AI" },
  { id: "ai-salary", label: "Salary Recommendation", path: "/dashboard/ai/salary-recommendation", keywords: "ai salary recommendation compensation", icon: Wallet, category: "AI" },
  { id: "ai-forecasting", label: "WF Forecasting", path: "/dashboard/ai/workforce-forecasting", keywords: "ai workforce forecasting demand", icon: LineChart, category: "AI" },
  { id: "ai-policy", label: "Policy Assistant", path: "/dashboard/ai/policy-assistant", keywords: "ai policy assistant qa", icon: Shield, category: "AI" },
  { id: "ai-leave", label: "Leave Assistant", path: "/dashboard/ai/leave-assistant", keywords: "ai leave assistant recommendation", icon: Calendar, category: "AI" },
  { id: "ai-recruitment", label: "Recruitment Assistant", path: "/dashboard/ai/recruitment-assistant", keywords: "ai recruitment assistant hiring", icon: Briefcase, category: "AI" },
  { id: "ai-onboarding", label: "Onboarding Assistant", path: "/dashboard/ai/onboarding-assistant", keywords: "ai onboarding assistant plans", icon: UserPlus, category: "AI" },
  { id: "ai-training", label: "Training Assistant", path: "/dashboard/ai/training-assistant", keywords: "ai training assistant courses", icon: GraduationCap, category: "AI" },
  { id: "ai-compliance", label: "Compliance Assistant", path: "/dashboard/ai/compliance-assistant", keywords: "ai compliance assistant check", icon: ShieldCheck, category: "AI" },
  { id: "ai-knowledge", label: "Knowledge Search", path: "/dashboard/ai/knowledge-search", keywords: "ai knowledge search discovery", icon: Search, category: "AI" },
  { id: "ai-org-advisor", label: "Org Advisor", path: "/dashboard/ai/org-advisor", keywords: "ai organization advisor structure", icon: Users, category: "AI" },
  { id: "ai-risk", label: "Risk Detection", path: "/dashboard/ai/risk-detection", keywords: "ai risk detection assessment", icon: AlertTriangle, category: "AI" },
  { id: "ai-anomaly", label: "Anomaly Detection", path: "/dashboard/ai/anomaly-detection", keywords: "ai anomaly detection outliers", icon: Activity, category: "AI" },
  { id: "ai-shift", label: "Shift Optimization", path: "/dashboard/ai/shift-optimization", keywords: "ai shift optimization scheduling", icon: Clock, category: "AI" },
  { id: "ai-succession", label: "Succession Planning", path: "/dashboard/ai/succession-planning", keywords: "ai succession planning pipeline", icon: Target, category: "AI" },
  { id: "ai-budget", label: "Budget Forecasting", path: "/dashboard/ai/budget-forecasting", keywords: "ai budget forecasting finance", icon: Wallet, category: "AI" },
  { id: "ai-performance", label: "Perf Summaries", path: "/dashboard/ai/performance-summaries", keywords: "ai performance summaries reviews", icon: BarChart3, category: "AI" },
  { id: "ai-meeting", label: "Meeting Summaries", path: "/dashboard/ai/meeting-summaries", keywords: "ai meeting summaries notes", icon: FileText, category: "AI" },
  { id: "ai-workflow", label: "Workflow Generation", path: "/dashboard/ai/workflow-generation", keywords: "ai workflow generation process", icon: GitPullRequest, category: "AI" },
  { id: "ai-automation", label: "Automation Builder", path: "/dashboard/ai/automation-builder", keywords: "ai automation builder builder", icon: Settings, category: "AI" },
  { id: "ai-agentic", label: "Agentic HR", path: "/dashboard/ai/agentic-hr", keywords: "ai agentic hr workflows agents", icon: Bot, category: "AI" },
  { id: "ai-autonomous", label: "Auto Intelligence", path: "/dashboard/ai/autonomous-intelligence", keywords: "ai autonomous intelligence self learning", icon: Sparkles, category: "AI" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS;
    const q = query.toLowerCase();
    return ALL_COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filtered.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filtered]);

  const handleSelect = useCallback((path: string) => {
    router.push(path);
    setOpen(false);
    setQuery("");
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selectedIndex]) { handleSelect(filtered[selectedIndex].path); }
    if (e.key === "Escape") { setOpen(false); }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div
        className="fixed left-[50%] top-[15%] z-50 w-full max-w-[580px] translate-x-[-50%] rounded-xl border bg-card shadow-2xl shadow-black/10 dark:shadow-black/40"
        role="dialog"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search pages, settings, and actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <span>ESC</span>
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2 text-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-2 py-8 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">No results found</p>
              <p className="text-xs">Try different keywords</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{category}</div>
                {cmds.map((cmd) => {
                  const idx = filtered.indexOf(cmd);
                  return (
                    <div
                      key={cmd.id}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors",
                        idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                      onClick={() => handleSelect(cmd.path)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      role="option"
                      aria-selected={idx === selectedIndex}
                    >
                      <cmd.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{cmd.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{cmd.path}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
