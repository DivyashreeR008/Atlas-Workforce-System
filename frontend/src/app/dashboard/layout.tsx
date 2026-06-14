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
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <OfflineBanner />
      </AuthGuard>
    </Suspense>
  );
}
