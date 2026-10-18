"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  devicesApi,
  sessionsApi,
  type SessionRecord,
  type TrustedDevice,
} from "@/lib/api";
import { getSessionId } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";

function formatTimestamp(value?: string | null): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The sessions endpoint returns the raw user agent string; keep the label
// readable without pretending we know more than the string says.
function summarizeUserAgent(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/") || userAgent.includes("CriOS/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const os = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac OS")
      ? "macOS"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("iPhone") || userAgent.includes("iPad")
          ? "iOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "an unknown OS";
  return `${browser} on ${os}`;
}

function deviceLabel(device: TrustedDevice): string {
  return device.device_name || device.device_id;
}

function RowSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-64" />
    </div>
  );
}

export default function SecuritySessionsPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const logout = useAuthStore((s) => s.logout);
  const currentSessionId = getSessionId();

  const sessionsQuery = useQuery({
    queryKey: ["security-sessions"],
    queryFn: () =>
      sessionsApi.list({ limit: 50 }).then((r) => r.data as SessionRecord[]),
  });

  const devicesQuery = useQuery({
    queryKey: ["security-devices"],
    queryFn: () =>
      devicesApi.list({ limit: 50 }).then((r) => r.data as TrustedDevice[]),
  });

  const revokeSession = useMutation({
    mutationFn: (session: SessionRecord) => sessionsApi.revoke(session.id),
    onSuccess: async (_result, session) => {
      queryClient.invalidateQueries({ queryKey: ["security-sessions"] });
      if (currentSessionId && session.id === currentSessionId) {
        addToast({
          title: "Current session revoked",
          description: "Signing you out...",
        });
        await logout();
        return;
      }
      addToast({ title: "Session revoked", variant: "success" });
    },
    onError: () =>
      addToast({ title: "Failed to revoke session", variant: "destructive" }),
  });

  const revokeOtherSessions = useMutation({
    mutationFn: async () => {
      if (!currentSessionId) throw new Error("Current session id unavailable");
      return sessionsApi.revokeOthers(currentSessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-sessions"] });
      addToast({ title: "Other sessions revoked", variant: "success" });
    },
    onError: () =>
      addToast({ title: "Failed to revoke other sessions", variant: "destructive" }),
  });

  const toggleTrust = useMutation({
    mutationFn: (device: TrustedDevice) => devicesApi.toggleTrust(device.id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["security-devices"] });
      addToast({
        title: res.data?.is_trusted ? "Device trusted" : "Device trust removed",
        variant: "success",
      });
    },
    onError: () =>
      addToast({ title: "Failed to update device trust", variant: "destructive" }),
  });

  const removeDevice = useMutation({
    mutationFn: (device: TrustedDevice) => devicesApi.remove(device.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-devices"] });
      addToast({ title: "Device removed", variant: "success" });
    },
    onError: () =>
      addToast({ title: "Failed to remove device", variant: "destructive" }),
  });

  const handleRevoke = (session: SessionRecord) => {
    const isCurrent = currentSessionId !== null && session.id === currentSessionId;
    const message = isCurrent
      ? `Revoking your current session signs you out of this browser immediately. Continue?`
      : `Revoke the ${summarizeUserAgent(session.user_agent)} session? That device will need to sign in again.`;
    if (window.confirm(message)) {
      revokeSession.mutate(session);
    }
  };

  const handleRemoveDevice = (device: TrustedDevice) => {
    if (
      window.confirm(
        `Remove ${deviceLabel(device)}? It will have to register again on its next sign-in.`
      )
    ) {
      removeDevice.mutate(device);
    }
  };

  const activeSessions = (sessionsQuery.data ?? []).filter(
    (session) => session.is_active !== false
  );
  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to settings
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Sessions &amp; devices</h1>
        <p className="text-muted-foreground">
          Review where your account is signed in and manage the devices you trust
        </p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Active sessions</CardTitle>
                <CardDescription>
                  Every browser or device currently signed in to your account
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => revokeOtherSessions.mutate()}
              disabled={
                !currentSessionId ||
                revokeOtherSessions.isPending ||
                activeSessions.length === 0
              }
            >
              <LogOut className="h-4 w-4" />
              {revokeOtherSessions.isPending
                ? "Revoking..."
                : "Revoke all other sessions"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQuery.isLoading ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : sessionsQuery.isError ? (
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Failed to load active sessions
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sessionsQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="py-6 text-center">
              <Shield className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">No active sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Sessions appear here after you sign in. On a brand new account
                this list fills the first time you log in.
              </p>
            </div>
          ) : (
            activeSessions.map((session, index) => {
              const isCurrent =
                currentSessionId !== null && session.id === currentSessionId;
              return (
                <div key={session.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {summarizeUserAgent(session.user_agent)}
                        </p>
                        {isCurrent && (
                          <Badge variant="success">Current session</Badge>
                        )}
                        {session.device_id && (
                          <Badge variant="secondary">{session.device_id}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        IP {session.ip_address ?? "unknown"} - started{" "}
                        {formatTimestamp(session.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isCurrent
                          ? "You are using this session right now"
                          : `Expires ${formatTimestamp(session.expires_at)}`}
                      </p>
                    </div>
                    <Button
                      variant={isCurrent ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => handleRevoke(session)}
                      disabled={revokeSession.isPending}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </div>
                  {index < activeSessions.length - 1 && (
                    <Separator className="mt-3" />
                  )}
                </div>
              );
            })
          )}
          {!currentSessionId && !sessionsQuery.isLoading && (
            <p className="text-xs text-muted-foreground">
              This browser could not be matched to a session id, so revoking all
              other sessions is disabled to avoid signing you out by accident.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Trusted devices</CardTitle>
              <CardDescription>
                Devices registered to your account; trusted devices skip extra
                verification on sign-in
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {devicesQuery.isLoading ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : devicesQuery.isError ? (
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Failed to load devices
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => devicesQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-6 text-center">
              <Smartphone className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">No devices registered yet</p>
              <p className="text-sm text-muted-foreground">
                Sign in from a browser or phone and it will show up here so you
                can trust or remove it.
              </p>
            </div>
          ) : (
            devices.map((device, index) => (
              <div key={device.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{deviceLabel(device)}</p>
                      {device.is_trusted ? (
                        <Badge variant="success">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Trusted
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not trusted</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[device.browser, device.os].filter(Boolean).join(" on ") ||
                        device.device_type ||
                        "Unknown platform"}{" "}
                      - IP {device.ip_address ?? "unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last used {formatTimestamp(device.last_used_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTrust.mutate(device)}
                      disabled={toggleTrust.isPending}
                    >
                      {device.is_trusted ? "Remove trust" : "Trust device"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDevice(device)}
                      disabled={removeDevice.isPending}
                      aria-label={`Remove ${deviceLabel(device)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
                {index < devices.length - 1 && <Separator className="mt-3" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
