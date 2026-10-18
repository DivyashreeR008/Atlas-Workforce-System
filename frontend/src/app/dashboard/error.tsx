"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/error-reporting";

/**
 * Route-level fallback for the dashboard segment (Next.js error.tsx
 * convention). It renders inside dashboard/layout.tsx, so the sidebar and
 * top bar stay mounted and the user can simply navigate elsewhere.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { boundary: "route:/dashboard" });
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h2 className="text-lg font-semibold">This page failed to load</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while rendering this page. The rest of
        the app is still available from the navigation.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
