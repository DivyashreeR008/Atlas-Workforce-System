"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (path: string) => {
    router.push(path);
    setOpen(false);
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
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" 
        onClick={() => setOpen(false)}
      />
      {/* Modal */}
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
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Quick Links</div>
          <div 
            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground outline-none"
            onClick={() => handleSelect('/dashboard/employees')}
          >
            Employee Directory
          </div>
          <div 
            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground outline-none"
            onClick={() => handleSelect('/dashboard/payroll')}
          >
            Run Payroll
          </div>
          <div 
            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground outline-none"
            onClick={() => handleSelect('/dashboard/analytics')}
          >
            Analytics & Insights
          </div>
        </div>
      </div>
    </>
  );
}
