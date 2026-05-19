"use client";

import { mockNotifications } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default function NotificationsPage() {
  const unread = mockNotifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">System alerts and updates</p>
        </div>
        {unread > 0 && <Badge variant="default">{unread} unread</Badge>}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Inbox</CardTitle>
          <CardDescription>Recent notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockNotifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{n.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                </div>
                {!n.read && <Badge variant="secondary">New</Badge>}
              </div>
              <span className="mt-2 block text-xs text-muted-foreground">
                {formatDate(n.createdAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
