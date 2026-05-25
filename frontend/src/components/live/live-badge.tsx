"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LiveBadge({ count, variant = "default" }: { count?: number; variant?: "default" | "alert" }) {
  return (
    <Badge variant={variant === "alert" ? "destructive" : "success"} className={cn("gap-1", variant === "alert" && "animate-pulse")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      Live
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </Badge>
  );
}
