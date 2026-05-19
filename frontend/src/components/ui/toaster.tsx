"use client";

import * as Toast from "@radix-ui/react-toast";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-1 rounded-lg border bg-card p-4 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out"
          )}
        >
          {t.title && (
            <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>
          )}
          {t.description && (
            <Toast.Description className="text-sm text-muted-foreground">
              {t.description}
            </Toast.Description>
          )}
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-0 right-0 z-50 flex max-h-screen flex-col gap-2 p-4" />
    </Toast.Provider>
  );
}
