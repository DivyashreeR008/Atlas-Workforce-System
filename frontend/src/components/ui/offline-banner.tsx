"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm transition-transform duration-300",
        isOnline
          ? "translate-y-full bg-emerald-500/10 text-emerald-600"
          : "translate-y-0 bg-destructive/10 text-destructive"
      )}
      role="alert"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You are offline. Some features may be unavailable.</span>
        </>
      )}
    </div>
  );
}
