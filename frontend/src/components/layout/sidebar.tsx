"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Cable,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LogOut,
  Monitor,
  Orbit,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  Users,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// === Sidebar context ===
const SIDEBAR_COOKIE = "sidebar_state";

interface SidebarContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  isMobile: boolean;
}

const SidebarCtx = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(() => {
    if (typeof document === "undefined") return true;
    const c = document.cookie.match(`(^| )${SIDEBAR_COOKIE}=([^;]+)`);
    return c ? c[2] === "true" : true;
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(max-width: 768px)");
    setIsMobile(q.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    q.addEventListener("change", h);
    return () => q.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${open};path=/;max-age=604800`;
  }, [open]);

  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const val = useMemo(() => ({ open, setOpen, toggle, isMobile }), [open, toggle, isMobile]);

  return (
    <SidebarCtx.Provider value={val}>
      <TooltipProvider delayDuration={0}>
        <div className="flex min-h-svh w-full">
          {children}
        </div>
      </TooltipProvider>
    </SidebarCtx.Provider>
  );
}

// === Navigation config ===
interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { href: string; label: string }[];
}

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

type NavEntry = NavItem | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

const navItems: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/lifecycle", label: "Lifecycle", icon: Orbit },
  { label: "Workforce Planning", icon: LineChart, children: [{ href: "/dashboard/workforce-planning", label: "Dashboard" }] },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { label: "ATS", icon: Briefcase, children: [
    { href: "/dashboard/ats", label: "Dashboard" },
    { href: "/dashboard/ats/jobs", label: "Jobs" },
    { href: "/dashboard/ats/candidates", label: "Candidates" },
    { href: "/dashboard/ats/analytics", label: "Analytics" },
  ]},
  { href: "/dashboard/payroll", label: "Payroll", icon: Wallet },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/leave", label: "Leave", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { label: "Performance", icon: Target, children: [
    { href: "/dashboard/performance", label: "Overview" },
    { href: "/dashboard/performance?tab=okrs", label: "OKRs & KPIs" },
    { href: "/dashboard/performance?tab=reviews", label: "Reviews" },
    { href: "/dashboard/performance?tab=feedback", label: "Feedback" },
    { href: "/dashboard/performance?tab=hipo", label: "HiPo Tracking" },
    { href: "/dashboard/performance?tab=ai", label: "AI Insights" },
    { href: "/dashboard/performance?tab=devplans", label: "Dev Plans" },
  ]},
  { label: "LMS", icon: GraduationCap, children: [
    { href: "/dashboard/lms", label: "Dashboard" },
    { href: "/dashboard/lms/courses", label: "Courses" },
    { href: "/dashboard/lms/certifications", label: "Certifications" },
    { href: "/dashboard/lms/skills", label: "Skills" },
  ]},
  { label: "L&D", icon: BookOpen, children: [{ href: "/dashboard/learning-development", label: "Dashboard" }] },
  { label: "AI Platform", icon: Bot, children: [
    { href: "/dashboard/ai", label: "AI Hub" },
    { href: "/dashboard/ai/hr-copilot", label: "HR Copilot" },
    { href: "/dashboard/ai/ai-dashboard", label: "AI Dashboard" },
    { href: "/dashboard/ai/attrition-prediction", label: "Attrition Pred." },
    { href: "/dashboard/ai/workforce-forecasting", label: "WF Forecast" },
    { href: "/dashboard/ai/risk-detection", label: "Risk Detection" },
    { href: "/dashboard/ai/automation-builder", label: "Automation" },
  ]},
  { href: "/dashboard/compliance", label: "Compliance", icon: Shield },
  { label: "Security", icon: ShieldCheck, children: [
    { href: "/dashboard/security", label: "Dashboard" },
    { href: "/dashboard/security/pam", label: "Privileged Access" },
    { href: "/dashboard/security/data-classification", label: "Data Class." },
  ]},
  { label: "Live", icon: Monitor, children: [
    { href: "/dashboard/live", label: "Overview" },
    { href: "/dashboard/live/presence", label: "Presence" },
    { href: "/dashboard/live/alerts", label: "Alerts" },
    { href: "/dashboard/live/chat", label: "Chat" },
    { href: "/dashboard/live/command-center", label: "Cmd Center" },
  ]},
  { href: "/dashboard/integrations", label: "Integrations", icon: Cable },
  { href: "/dashboard/command-center", label: "Command Center", icon: LayoutGrid },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// === Sidebar Component ===
export function Sidebar() {
  const pathname = usePathname();
  const { open, toggle, isMobile } = useSidebar();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const g: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (isGroup(item) && item.children.some((c) => pathname.startsWith(c.href.replace(/\/$/, "")))) {
        g[item.label] = true;
      }
    });
    return g;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  function isGroupActive(group: NavGroup) {
    return group.children.some((c) => isActive(c.href));
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  return (
    <>
      {isMobile && open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => toggle()}
        />
      )}

      <aside
        data-state={open ? "expanded" : "collapsed"}
        className={cn(
          "bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex h-full flex-col transition-all duration-200 ease-linear",
          isMobile
            ? cn("fixed inset-y-0 left-0 z-50", open ? "w-64" : "-translate-x-full")
            : cn(
                open ? "w-64" : "w-16",
                "hidden md:flex"
              )
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border",
            open ? "px-4" : "justify-center px-2"
          )}
        >
          {open ? (
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                A
              </span>
              <span className="text-sidebar-foreground">Atlas</span>
            </Link>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    A
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {navItems.map((item) => {
            if (isGroup(item)) {
              const groupActive = isGroupActive(item);
              const isOpen = openGroups[item.label] ?? groupActive;

              if (!open) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.children[0].href}
                        className={cn(
                          "flex items-center justify-center rounded-lg p-2 transition-colors",
                          groupActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <CollapsiblePrimitive.Root
                  key={item.label}
                  open={isOpen}
                  onOpenChange={() => toggleGroup(item.label)}
                >
                  <CollapsiblePrimitive.Trigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
                  </CollapsiblePrimitive.Trigger>
                  <CollapsiblePrimitive.Content>
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                            isActive(child.href)
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </CollapsiblePrimitive.Content>
                </CollapsiblePrimitive.Root>
              );
            }

            const active = isActive(item.href);

            if (!open) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center rounded-lg p-2 transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          {open ? (
            <div className="space-y-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex w-full items-center gap-2 px-2 py-1.5 h-auto"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left text-sm leading-tight">
                      <p className="font-medium truncate">{user?.name ?? "User"}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate">
                        {user?.role}
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-medium">{user?.name}</div>
                  <div className="px-2 pb-1 text-xs text-muted-foreground capitalize">
                    {user?.role}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-muted-foreground"
                onClick={() => toggle()}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-2">Collapse</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-muted-foreground"
                onClick={() => toggle()}
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export { SidebarProvider, useSidebar };
