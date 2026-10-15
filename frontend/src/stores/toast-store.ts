import { create } from "zustand";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  /** Auto-dismiss delay in ms. Defaults to 5000, destructive defaults to 10000. Use Infinity or 0 to stay until dismissed. */
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  toast: (item) => {
    const id = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((s) => ({ toasts: [...s.toasts, { ...item, id }] }));
    const duration = item.duration ?? (item.variant === "destructive" ? 10000 : 5000);
    if (duration !== Infinity && duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(item: Omit<ToastItem, "id">) {
  useToastStore.getState().toast(item);
}
