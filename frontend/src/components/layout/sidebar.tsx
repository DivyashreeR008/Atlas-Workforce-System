"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/payroll", label: "Payroll", icon: Wallet },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/leave", label: "Leave", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
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
