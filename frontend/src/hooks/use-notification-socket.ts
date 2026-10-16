"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getReconnectDelay } from "@/lib/reconnect";

export interface LiveNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATION_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/api/notification/ws";

function parseNotification(raw: string): LiveNotification | null {
  try {
    const parsed = JSON.parse(raw);
    const notif =
      parsed && typeof parsed.data === "string" ? JSON.parse(parsed.data) : parsed;
    if (!notif || notif.id === undefined || notif.id === null) return null;
    return {
      id: String(notif.id),
      title: String(notif.title ?? "Notification"),
      message: String(notif.message ?? ""),
      read: false,
      createdAt: String(notif.createdAt ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function useNotificationSocket() {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const clearPendingReconnect = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    clearPendingReconnect();
    const delay = getReconnectDelay(reconnectRef.current);
    reconnectRef.current++;
    timeoutRef.current = setTimeout(() => connectRef.current(), delay);
  }, [clearPendingReconnect]);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(NOTIFICATION_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectRef.current = 0;
        clearPendingReconnect();
      };

      ws.onmessage = (event) => {
        const notif = parseNotification(event.data);
        if (!notif) return;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notif.id)) return prev;
          return [notif, ...prev].slice(0, 50);
        });
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => ws.close();
    } catch {
      scheduleReconnect();
    }
  }, [scheduleReconnect, clearPendingReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearPendingReconnect();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect, clearPendingReconnect]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markOneRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  return { notifications, connected, markAllRead, markOneRead };
}
