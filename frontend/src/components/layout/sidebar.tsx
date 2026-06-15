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
  Clock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  LineChart,
  LogOut,
  Monitor,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  Users,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Sidebar Context ────────────────────────────────────────────
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  useEffect(() => {
    const q = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setOpen(false);
    };
    q.addEventListener("change", h);
    return () => q.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${open};path=/;max-age=604800`;
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const val = useMemo(() => ({ open, setOpen, toggle, isMobile }), [open, toggle, isMobile]);

  return (
    <SidebarCtx.Provider value={val}>
      <TooltipProvider delayDuration={0}>
        <div className="flex min-h-svh w-full">{children}</div>
      </TooltipProvider>
    </SidebarCtx.Provider>
  );
}

// ─── Navigation Config ──────────────────────────────────────────
interface NavChild {
  href: string;
  label: string;
}

interface NavGroupItem {
  kind: "group";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavChild[];
}

interface NavLinkItem {
  kind: "link";
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

type NavItem = NavLinkItem | NavGroupItem;

interface NavSection {
  label: string;
  items: NavItem[];
}

function isGroup(item: NavItem): item is NavGroupItem {
  return item.kind === "group";
}

const navSections: NavSection[] = [
  {
    label: "Core",
    items: [
      { kind: "link", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { kind: "link", href: "/dashboard/employees", label: "Employees", icon: Users },
      { kind: "link", href: "/dashboard/payroll", label: "Payroll", icon: Wallet },
    ],
  },
  {
    label: "People",
    items: [
      {
        kind: "group", label: "Performance", icon: Target,
        children: [
          { href: "/dashboard/performance", label: "Overview" },
          { href: "/dashboard/performance?tab=okrs", label: "OKRs & KPIs" },
          { href: "/dashboard/performance?tab=reviews", label: "Reviews" },
          { href: "/dashboard/performance?tab=hipo", label: "HiPo Tracking" },
          { href: "/dashboard/performance?tab=devplans", label: "Dev Plans" },
        ],
      },
      { kind: "link", href: "/dashboard/lifecycle", label: "Lifecycle", icon: Orbit },
      {
        kind: "group", label: "ATS", icon: Briefcase,
        children: [
          { href: "/dashboard/ats", label: "Dashboard" },
          { href: "/dashboard/ats/jobs", label: "Jobs" },
          { href: "/dashboard/ats/candidates", label: "Candidates" },
          { href: "/dashboard/ats/analytics", label: "Analytics" },
        ],
      },
      {
        kind: "group", label: "LMS", icon: GraduationCap,
        children: [
          { href: "/dashboard/lms", label: "Dashboard" },
          { href: "/dashboard/lms/courses", label: "Courses" },
          { href: "/dashboard/lms/certifications", label: "Certifications" },
          { href: "/dashboard/lms/skills", label: "Skills" },
        ],
      },
      { kind: "link", href: "/dashboard/learning-development", label: "L&D", icon: BookOpen },
    ],
  },
  {
    label: "Operations",
    items: [
      { kind: "link", href: "/dashboard/attendance", label: "Attendance", icon: Clock },
      { kind: "link", href: "/dashboard/leave", label: "Leave", icon: Calendar },
      { kind: "link", href: "/dashboard/workforce-planning", label: "Workforce Planning", icon: LineChart },
      { kind: "link", href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { kind: "link", href: "/dashboard/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { kind: "link", href: "/dashboard/command-center", label: "Command Center", icon: LayoutGrid },
      {
        kind: "group", label: "AI Platform", icon: Bot,
        children: [
          { href: "/dashboard/ai", label: "AI Hub" },
          { href: "/dashboard/ai/hr-copilot", label: "HR Copilot" },
          { href: "/dashboard/ai/attrition-prediction", label: "Attrition Pred." },
          { href: "/dashboard/ai/workforce-forecasting", label: "WF Forecasting" },
          { href: "/dashboard/ai/risk-detection", label: "Risk Detection" },
        ],
      },
      {
        kind: "group", label: "Live", icon: Monitor,
        children: [
          { href: "/dashboard/live", label: "Overview" },
          { href: "/dashboard/live/presence", label: "Presence" },
          { href: "/dashboard/live/alerts", label: "Alerts" },
          { href: "/dashboard/live/command-center", label: "Cmd Center" },
        ],
      },
    ],
  },
  {
    label: "Security",
    items: [
      { kind: "link", href: "/dashboard/compliance", label: "Compliance", icon: Shield },
      {
        kind: "group", label: "Security", icon: ShieldCheck,
        children: [
          { href: "/dashboard/security", label: "Dashboard" },
          { href: "/dashboard/security/pam", label: "Privileged Access" },
          { href: "/dashboard/security/data-classification", label: "Data Classification" },
        ],
      },
      { kind: "link", href: "/dashboard/integrations", label: "Integrations", icon: Cable },
    ],
  },
  {
    label: "System",
    items: [
      { kind: "link", href: "/dashboard/settings", label: "Settings", icon: Settings },
      { kind: "link", href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

function flattenNavItems(): { href: string; label: string }[] {
  const result: { href: string; label: string }[] = [];
  for (const section of navSections) {
    for (const item of section.items) {
      if (isGroup(item)) {
        for (const child of item.children) {
          result.push(child);
        }
      } else {
        result.push({ href: item.href, label: item.label });
      }
    }
  }
  return result;
}

// ─── Sub-components ─────────────────────────────────────────────
function NavSectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
    </div>
  );
}

function ActiveIndicator() {
  return (
    <div className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  index,
}: {
  item: NavLinkItem;
  pathname: string;
  collapsed: boolean;
  index: number;
}) {
  const active = item.href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(item.href);

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        collapsed ? "mx-auto h-9 w-9 justify-center" : "mx-1.5 px-2.5 py-1.5"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active && <ActiveIndicator />}
      <item.icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-4 w-4")} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function NavGroup({
  item,
  pathname,
  collapsed,
  openGroup,
  onToggle,
}: {
  item: NavGroupItem;
  pathname: string;
  collapsed: boolean;
  openGroup: string | null;
  onToggle: (label: string) => void;
}) {
  const isOpen = openGroup === item.label;
  const isActive = item.children.some((c) => {
    if (c.href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(c.href);
  });

  // Collapsed mode: just an icon linking to first child
  if (collapsed) {
    return (
      <Tooltip key={item.label}>
        <TooltipTrigger asChild>
          <Link
            href={item.children[0].href}
            className={cn(
              "mx-auto flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground",
              isActive && "bg-primary/10 text-primary"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      <button
        onClick={() => onToggle(item.label)}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150 mx-1.5",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        aria-expanded={isOpen}
      >
        {isActive && <ActiveIndicator />}
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border/40 pl-2">
              {item.children.map((child) => {
                const childActive = child.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150",
                      childActive
                        ? "font-medium text-primary"
                        : "text-muted-foreground/70 hover:text-foreground"
                    )}
                  >
                    {childActive && (
                      <div className="absolute left-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <span className="pl-0.5">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { open, toggle, isMobile } = useSidebar();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (isGroup(item) && item.children.some((c) => pathname.startsWith(c.href.replace(/\/$/, "")))) {
          return item.label;
        }
      }
    }
    return null;
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  }, []);

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
      {/* Mobile overlay */}
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
            ? cn("fixed inset-y-0 left-0 z-50", open ? "w-60" : "-translate-x-full")
            : cn(
                open ? "w-60" : "w-14",
                "hidden md:flex"
              )
        )}
      >
        {/* ── Logo ── */}
        <div className={cn("flex h-14 items-center border-b border-sidebar-border shrink-0", open ? "px-4" : "justify-center")}>
          {open ? (
            <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold">
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
              <TooltipContent side="right" sideOffset={8}>Dashboard</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.label}>
              <NavSectionLabel label={section.label} collapsed={!open} />
              {section.items.map((item, i) => {
                if (isGroup(item)) {
                  return (
                    <NavGroup
                      key={item.label}
                      item={item}
                      pathname={pathname}
                      collapsed={!open}
                      openGroup={openGroup}
                      onToggle={toggleGroup}
                    />
                  );
                }
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={!open}
                    index={i}
                  />
                );
              })}
            </div>
          ))}
          {/* Bottom spacer so content doesn't hide behind footer */}
          <div className="h-4" />
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-sidebar-border">
          {open ? (
            <div className="p-2 space-y-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted/50">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left leading-tight min-w-0">
                      <p className="truncate text-sm font-medium text-sidebar-foreground">
                        {user?.name ?? "User"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground capitalize">
                        {user?.role}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-medium">{user?.name ?? "User"}</div>
                  <div className="px-2 pb-1 text-xs text-muted-foreground capitalize">
                    {user?.role ?? "N/A"}
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

              <button
                onClick={() => toggle()}
                className="flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="flex justify-center">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggle()}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
                  >
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Expand sidebar</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export { SidebarProvider, useSidebar };
