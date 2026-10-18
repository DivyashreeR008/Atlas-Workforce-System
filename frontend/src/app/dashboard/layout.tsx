"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
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
          <div className="flex h-screen w-full overflow-hidden bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto">
                <div className="w-full px-4 py-4 md:px-6 md:py-6">
                  {/* Route-level failures are handled by app/dashboard/error.tsx;
                      individual widgets carry their own WidgetBoundary. */}
                  {children}
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
