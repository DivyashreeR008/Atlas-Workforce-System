"use client";

import { LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CommandPalette } from "@/components/layout/command-palette";
import { useAuthStore } from "@/stores/auth-store";

export function TopBar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-md">
      <div className="relative flex-1">
        <CommandPalette />
      </div>

      <div className="ml-auto flex items-center gap-3">
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