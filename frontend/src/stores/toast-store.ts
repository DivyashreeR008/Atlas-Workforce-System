import { create } from "zustand";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastState {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  toast: (item) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...item, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(item: Omit<ToastItem, "id">) {
  useToastStore.getState().toast(item);
}
