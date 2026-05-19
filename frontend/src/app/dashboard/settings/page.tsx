"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Appearance and account preferences</p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Customize how Atlas looks on your device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark mode
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{user.name}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{user.email}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium capitalize">{user.role}</dd>
              </div>
              {user.department && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Department</dt>
                    <dd className="font-medium">{user.department}</dd>
                  </div>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Not signed in</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
