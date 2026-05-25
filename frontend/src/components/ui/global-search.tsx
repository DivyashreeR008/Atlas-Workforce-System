"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Command, FileText, Users, LayoutDashboard, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  source: "page" | "employee" | "report" | "ai";
}

const STATIC_RESULTS: SearchResult[] = [
  { id: "employees", label: "Employees", description: "Manage employee records and profiles", path: "/dashboard/employees", icon: Users, source: "page" },
  { id: "payroll", label: "Payroll", description: "Run payroll and manage compensation", path: "/dashboard/payroll", icon: LayoutDashboard, source: "page" },
  { id: "reports", label: "Reports", description: "Generate and export reports", path: "/dashboard/reports", icon: FileText, source: "page" },
  { id: "copilot", label: "AI Copilot", description: "Ask questions and get AI-powered assistance", path: "/dashboard/copilot", icon: Sparkles, source: "ai" },
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [aiResults, setAiResults] = useState<SearchResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setAiResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setAiResults([]); return; }
    setAiLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { aiApi } = await import("@/lib/api");
        const res = await aiApi.knowledge.search({ query: query.trim(), max_results: 3 });
        const data = res.data as any;
        if (data?.results) {
          setAiResults(
            data.results.map((r: any) => ({
              id: `ai-${Math.random().toString(36).slice(2)}`,
              label: r.title || r.content?.slice(0, 60) || "AI Suggestion",
              description: r.content?.slice(0, 100) || "Search result from AI knowledge base",
              path: `/dashboard/ai/knowledge-search?q=${encodeURIComponent(query.trim())}`,
              icon: Sparkles,
              source: "ai" as const,
            }))
          );
        }
      } catch {
        setAiResults([]);
      } finally {
        setAiLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredPages = useMemo(() => {
    if (!query.trim()) return STATIC_RESULTS;
    const q = query.toLowerCase();
    return STATIC_RESULTS.filter((r) => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [query]);

  const allResults = useMemo(() => [...filteredPages, ...aiResults], [filteredPages, aiResults]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.path);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allResults[selectedIndex]) handleSelect(allResults[selectedIndex]);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors w-full max-w-[240px]"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left text-xs">Search anything...</span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium sm:flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="fixed left-[50%] top-[15%] z-50 w-full max-w-[560px] translate-x-[-50%] rounded-xl border bg-card shadow-2xl shadow-black/10 dark:shadow-black/40"
            role="dialog"
            aria-label="Global search"
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                ref={inputRef}
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search pages, people, and knowledge..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search"
              />
              {aiLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2 text-sm">
              {allResults.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-2 py-8 text-muted-foreground">
                  <Search className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No results</p>
                  <p className="text-xs">Try different keywords or ask AI Copilot</p>
                  <button
                    onClick={() => { router.push("/dashboard/copilot"); setOpen(false); }}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ask AI Copilot <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                allResults.map((result) => {
                  const idx = allResults.indexOf(result);
                  return (
                    <div
                      key={result.id}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors",
                        idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <result.icon className={cn("h-4 w-4 shrink-0", result.source === "ai" ? "text-purple-500" : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{result.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{result.description}</p>
                      </div>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {result.source.toUpperCase()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
