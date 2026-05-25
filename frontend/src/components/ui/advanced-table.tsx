"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, ArrowLeft, ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  width?: string;
}

interface AdvancedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function AdvancedTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = "Search...",
  onRowClick,
  emptyMessage = "No data found",
  className,
}: AdvancedTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => String(row[col.key] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = typeof aVal === "string" ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: Column<T> }) => {
    if (!column.sortable) return null;
    if (sortKey !== column.key) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5 shrink-0" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0" />
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {searchable && (
        <div className="relative w-full max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "h-10 px-3 text-left text-xs font-medium text-muted-foreground",
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                    col.className
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="inline-flex items-center">
                    {col.label}
                    <SortIcon column={col} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn(
                    "border-b last:border-0 transition-colors hover:bg-muted/30",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-3 py-2.5 text-sm", col.className)}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Select value={String(safePage + 1)} onValueChange={(v) => setPage(Number(v) - 1)}>
              <SelectTrigger className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: totalPages }, (_, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
