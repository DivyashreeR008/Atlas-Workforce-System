"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Filter, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterOption {
  id: string;
  label: string;
  type: "select" | "multi-select" | "text" | "date-range";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface FilterValue {
  [key: string]: string | string[] | undefined;
}

interface SmartFiltersProps {
  filters: FilterOption[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  className?: string;
}

export function SmartFilters({ filters, values, onChange, className }: SmartFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = useMemo(
    () => Object.values(values).filter((v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)).length,
    [values]
  );

  const handleClear = useCallback(() => {
    const cleared: FilterValue = {};
    filters.forEach((f) => { cleared[f.id] = undefined; });
    onChange(cleared);
  }, [filters, onChange]);

  const handleFilterChange = (id: string, value: string | string[] | undefined) => {
    onChange({ ...values, [id]: value || undefined });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1 text-xs text-muted-foreground">
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          {filters.map((filter) => (
            <div key={filter.id} className="flex flex-col gap-1.5 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              {filter.type === "select" && filter.options ? (
                <Select
                  value={(values[filter.id] as string) || ""}
                  onValueChange={(val) => handleFilterChange(filter.id, val || undefined)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={filter.placeholder || "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {filter.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : filter.type === "text" ? (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                    placeholder={filter.placeholder || "Search..."}
                    value={(values[filter.id] as string) || ""}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value || undefined)}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
