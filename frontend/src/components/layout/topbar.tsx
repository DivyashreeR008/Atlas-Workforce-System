"use client";

import { useState, useEffect } from "react";
import { LogOut, Menu, User, Settings, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearch } from "@/components/ui/global-search";
import { CommandPalette } from "@/components/ui/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth-store";
import { useSidebar } from "@/components/layout/sidebar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export function TopBar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { toggle, open } = useSidebar();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header
      className={`sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-md transition-shadow duration-200 ${
        scrolled ? "shadow-sm" : "shadow-none"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          onClick={toggle}
          variant="ghost"
          size="icon"
          className="md:flex hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:block min-w-0">
          <Breadcrumbs />
        </div>
        <GlobalSearch />
      </div>

      <CommandPalette />

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="hidden h-auto gap-2 px-2 sm:flex"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left text-sm leading-tight">
                <p className="font-medium">{user?.name ?? "User"}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-medium">{user?.name ?? "User"}</div>
            <div className="px-2 pb-1 text-xs text-muted-foreground capitalize">
              {user?.role ?? "N/A"}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Sign out"
          className="sm:hidden"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
