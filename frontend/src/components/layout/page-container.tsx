"use client";

import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4 p-4 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="bg-muted mb-2 h-8 w-48 rounded" />
          <div className="bg-muted h-4 w-96 rounded" />
        </div>
      </div>
      <div className="bg-muted mt-6 h-40 w-full rounded-lg" />
      <div className="bg-muted h-40 w-full rounded-lg" />
    </div>
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  isLoading?: boolean;
  pageTitle?: string;
  pageDescription?: string;
  pageHeaderAction?: React.ReactNode;
}

export function PageContainer({
  children,
  isLoading = false,
  pageTitle,
  pageDescription,
  pageHeaderAction,
}: PageContainerProps) {
  const content = isLoading ? <PageSkeleton /> : children;
  const hasHeader = pageTitle || pageHeaderAction;

  return (
    <div className="flex flex-1 flex-col">
      {hasHeader && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {pageTitle && (
              <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
            )}
            {pageDescription && (
              <p className="text-muted-foreground text-sm">{pageDescription}</p>
            )}
          </div>
          {pageHeaderAction && <div className="shrink-0">{pageHeaderAction}</div>}
        </div>
      )}
      {content}
    </div>
  );
}
