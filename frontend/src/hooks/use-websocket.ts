"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/auth";
import { requiredEnv } from "@/lib/env";
import { getReconnectDelay } from "@/lib/reconnect";

const WS_BASE = requiredEnv(
  "NEXT_PUBLIC_WS_URL",
  "ws://localhost:8080/api/live/ws"
);

export function useWebSocket<T = Record<string, unknown>>(channel: string, enabled = true) {
  const [messages, setMessages] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    function connect() {
      if (!mounted) return;
      const token = getAccessToken();
      const url = token ? `${WS_BASE}/${channel}?token=${encodeURIComponent(token)}` : `${WS_BASE}/${channel}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      ws.onmessage = (msg) => {
        if (!mounted || !msg.data) return;
        try {
          const parsed = JSON.parse(msg.data) as T;
          setMessages((prev) => [parsed, ...prev].slice(0, 200));
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!mounted) return;
        retryRef.current++;
        const delay = getReconnectDelay(retryRef.current);
        timeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      mounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [channel, enabled]);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, connected, send, clear };
}
