"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/me", label: "My Profile" },
  { href: "/dashboard/me/payslips", label: "My Payslips" },
  { href: "/dashboard/me/leave", label: "My Leave" },
];

export default function MyWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, payslips and leave. Everything here is scoped to your own
          account on the server.
        </p>
      </div>
      <nav
        className="flex gap-1 border-b"
        aria-label="My workspace sections"
      >
        {tabs.map((tab) => {
          const active =
            tab.href === "/dashboard/me"
              ? pathname === tab.href
              : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
