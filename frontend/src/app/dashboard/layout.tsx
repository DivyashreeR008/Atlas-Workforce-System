"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { OfflineBanner } from "@/components/ui/offline-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AuthGuard>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <OfflineBanner />
      </AuthGuard>
    </Suspense>
  );
}
