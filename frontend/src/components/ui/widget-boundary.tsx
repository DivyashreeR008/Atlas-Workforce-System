"use client";

import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { reportClientError } from "@/lib/error-reporting";

interface WidgetBoundaryProps {
  /** Short widget name used in the fallback copy and error reports. */
  title: string;
  /** Refetch callback for this widget's own query, if it has one. */
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Compact, isolated boundary for a single dashboard widget.
 *
 * A widget that throws during render is replaced by a small fallback card; the
 * surrounding page keeps working. Retry refetches only this widget's query and
 * remounts the widget instead of reloading the whole route.
 */
export function WidgetBoundary({ title, onRetry, children }: WidgetBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error) => reportClientError(error, { boundary: `widget:${title}` })}
      fallback={(reset) => (
        <div
          role="alert"
          className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
        >
          <p className="text-sm text-muted-foreground">{title} failed to load</p>
          <button
            onClick={() => {
              onRetry?.();
              reset();
            }}
            className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
