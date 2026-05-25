"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(() => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:8080/api/notification/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const notif = parsed.data ? JSON.parse(parsed.data) : parsed;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === notif.id)) return prev;
            return [{ ...notif, read: false }, ...prev].slice(0, 50);
          });
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        const delay = Math.min(1000 * 2 ** reconnectRef.current, 30000);
        reconnectRef.current++;
        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    } catch {
      const delay = Math.min(1000 * 2 ** reconnectRef.current, 30000);
      reconnectRef.current++;
      setTimeout(connect, delay);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-4 w-4 text-primary" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {connected && (
                <span className="flex items-center gap-1 text-[10px] text-green-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Live
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={markAllRead}>
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {connected ? "No notifications yet" : "Connecting..."}
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => markOneRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("font-medium", !n.read && "text-primary")}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="line-clamp-2 text-muted-foreground">{n.message}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>

          {notifications.length > 10 && (
            <a
              href="/dashboard/notifications"
              className="block border-t px-4 py-2 text-center text-xs font-medium text-primary hover:underline"
            >
              View all notifications
            </a>
          )}
        </div>
      )}
    </div>
  );
}
