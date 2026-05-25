"use client";

import { useState } from "react";
import { GripVertical, Maximize2, Minimize2, MoreHorizontal, RefreshCw, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type WidgetSize = "sm" | "md" | "lg" | "xl" | "full";

interface CustomizableWidgetProps {
  title: string;
  children: React.ReactNode;
  defaultSize?: WidgetSize;
  onRemove?: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
  loading?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1 row-span-1",
  md: "col-span-2 row-span-1",
  lg: "col-span-1 row-span-2",
  xl: "col-span-2 row-span-2",
  full: "col-span-full",
};

export function CustomizableWidget({
  title,
  children,
  defaultSize = "md",
  onRemove,
  onRefresh,
  onSettings,
  loading = false,
  className,
}: CustomizableWidgetProps) {
  const [size, setSize] = useState<WidgetSize>(defaultSize);
  const [menuOpen, setMenuOpen] = useState(false);

  const cycleSize = () => {
    const sizes: WidgetSize[] = ["sm", "md", "lg", "xl", "full"];
    const idx = sizes.indexOf(size);
    setSize(sizes[(idx + 1) % sizes.length]);
    setMenuOpen(false);
  };

  return (
    <div className={cn("group relative rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md", SIZE_CLASSES[size], className)}>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
          <h3 className="text-sm font-medium truncate">{title}</h3>
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="relative flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cycleSize} title="Toggle size">
            {size === "full" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border bg-popover p-1 shadow-md">
                  {onRefresh && (
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                      onClick={() => { onRefresh(); setMenuOpen(false); }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                  )}
                  {onSettings && (
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                      onClick={() => { onSettings(); setMenuOpen(false); }}
                    >
                      <Settings className="h-3.5 w-3.5" /> Settings
                    </button>
                  )}
                  {onRemove && (
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => { onRemove(); setMenuOpen(false); }}
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 overflow-auto" style={{ maxHeight: size === "sm" ? "200px" : size === "md" ? "300px" : "500px" }}>
        {children}
      </div>
    </div>
  );
}
