"use client";

import { Clock, User, Bell, Shield, FileText, AlertTriangle, CheckCircle, XCircle, MessageSquare, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: "created" | "updated" | "deleted" | "warning" | "error" | "success" | "info" | "message" | "system";
  title: string;
  description?: string;
  user?: string;
  timestamp: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: CheckCircle,
  updated: RefreshCw,
  deleted: XCircle,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
  info: Bell,
  message: MessageSquare,
  system: Shield,
};

const TYPE_COLORS: Record<string, string> = {
  created: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  updated: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  deleted: "text-red-500 border-red-500/30 bg-red-500/10",
  warning: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  error: "text-red-500 border-red-500/30 bg-red-500/10",
  success: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  info: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  message: "text-violet-500 border-violet-500/30 bg-violet-500/10",
  system: "text-muted-foreground border-muted/30 bg-muted/10",
};

interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
  maxItems?: number;
}

export function ActivityTimeline({ events, className, maxItems }: ActivityTimelineProps) {
  const display = maxItems ? events.slice(0, maxItems) : events;

  if (display.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-8 text-muted-foreground", className)}>
        <Clock className="h-8 w-8 opacity-30" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {display.map((event, idx) => {
        const Icon = TYPE_ICONS[event.type] || Bell;
        const colorClass = TYPE_COLORS[event.type] || TYPE_COLORS.info;
        return (
          <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {idx < display.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", colorClass)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">{event.title}</p>
                <time className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{event.timestamp}</time>
              </div>
              {event.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
              )}
              {event.user && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <User className="h-3 w-3" />
                  {event.user}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
