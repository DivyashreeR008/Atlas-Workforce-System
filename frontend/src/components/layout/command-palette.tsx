"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const commands = [
  { label: "Employee Directory", path: "/dashboard/employees", keywords: "employees staff people directory" },
  { label: "Run Payroll", path: "/dashboard/payroll", keywords: "payroll salary payment run" },
  { label: "Analytics & Insights", path: "/dashboard/analytics", keywords: "analytics insights charts trends" },
  { label: "Attendance", path: "/dashboard/attendance", keywords: "attendance clock in out check" },
  { label: "Leave Requests", path: "/dashboard/leave", keywords: "leave vacation sick time off" },
  { label: "Reports", path: "/dashboard/reports", keywords: "reports export generate" },
  { label: "Notifications", path: "/dashboard/notifications", keywords: "notifications alerts updates" },
  { label: "Settings", path: "/dashboard/settings", keywords: "settings preferences account" },
  { label: "Dashboard", path: "/dashboard", keywords: "dashboard home overview" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
        setQuery("");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (path: string) => {
    router.push(path);
    setOpen(false);
    setQuery("");
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-[0.5rem] bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <span className="hidden lg:inline-flex">Search workforce...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-[50%] top-[20%] z-50 w-full max-w-[600px] translate-x-[-50%] overflow-hidden rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            autoFocus
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 text-sm text-foreground">
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-muted-foreground">
              No results found
            </div>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {query ? "Results" : "Quick Links"}
              </div>
              {filtered.map((cmd) => (
                <div
                  key={cmd.path}
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground outline-none"
                  onClick={() => handleSelect(cmd.path)}
                >
                  {cmd.label}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
