"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authenticated = isAuthenticated() || !!user;

  useEffect(() => {
    if (!authenticated) {
      router.replace("/login");
    }
  }, [authenticated, router]);

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center gap-4 p-8">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
