"use client";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationSocket } from "@/hooks/use-notification-socket";
import { formatDate } from "@/lib/utils";

export default function NotificationsPage() {
  const { notifications, connected, markAllRead } = useNotificationSocket();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">System alerts and updates</p>
          </div>
          {unread > 0 && <Badge variant="default">{unread} unread</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
          )}
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Inbox</CardTitle>
          <CardDescription>
            {notifications.length > 0
              ? `${notifications.length} notifications`
              : connected
                ? "Waiting for notifications..."
                : "Connecting to notification server..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {connected ? "No notifications yet" : "Connecting to live updates..."}
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border p-4 ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{n.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {n.message}
                    </p>
                  </div>
                  {!n.read && <Badge variant="secondary">New</Badge>}
                </div>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {formatDate(n.createdAt)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
