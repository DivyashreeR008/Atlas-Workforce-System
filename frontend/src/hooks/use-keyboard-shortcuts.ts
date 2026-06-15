"use client";

import { useEffect, useCallback, useRef } from "react";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;
  description?: string;
}

export function useGlobalShortcut(key: string, handler: () => void, options?: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean; enabled?: boolean }) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (options?.enabled === false) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const metaKey = options?.meta ?? false;
      const ctrlKey = options?.ctrl ?? false;
      const shiftKey = options?.shift ?? false;
      const altKey = options?.alt ?? false;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.metaKey === metaKey &&
        e.ctrlKey === ctrlKey &&
        e.shiftKey === shiftKey &&
        e.altKey === altKey &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handlerRef.current();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [key, options?.ctrl, options?.meta, options?.shift, options?.alt, options?.enabled]);
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      for (const s of shortcutsRef.current) {
        if (s.enabled === false) continue;
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          e.metaKey === !!s.meta &&
          e.ctrlKey === !!s.ctrl &&
          e.shiftKey === !!s.shift &&
          e.altKey === !!s.alt &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

const GLOBAL_SHORTCUTS: Shortcut[] = [];

export function registerGlobalShortcuts(newShortcuts: Shortcut[]) {
  GLOBAL_SHORTCUTS.push(...newShortcuts);
}

export function formatShortcutLabel(shortcut: Pick<Shortcut, "key" | "ctrl" | "meta" | "shift" | "alt">): string {
  const parts: string[] = [];
  if (shortcut.meta) parts.push("⌘");
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");
  parts.push(shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1));
  return parts.join(" + ");
}

export function useKeyboardShortcutsDialog() {
  const shortcuts = useKeyboardShortcuts;

  return {
    shortcuts,
    formatShortcutLabel,
  };
}
