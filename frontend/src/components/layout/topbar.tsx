"use client";

import { LogOut, Keyboard, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearch } from "@/components/ui/global-search";
import { CommandPalette } from "@/components/ui/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function TopBar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={toggleSidebar}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <GlobalSearch />
      </div>

      <CommandPalette />

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <div className="hidden items-center gap-2 sm:flex">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium leading-none">{user?.name ?? "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}