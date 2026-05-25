"use client";

import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

export function LiveIndicator({ connected, label }: { connected: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn("flex h-2 w-2 rounded-full", connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
      {connected ? (
        <Wifi className="h-3 w-3 text-emerald-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-rose-500" />
      )}
      <span className={cn(connected ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {label ?? (connected ? "Live" : "Disconnected")}
      </span>
    </div>
  );
}
