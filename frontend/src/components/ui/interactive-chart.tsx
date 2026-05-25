"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ChartDataPoint {
  label: string;
  value: number;
  secondary?: number;
  color?: string;
}

interface InteractiveChartProps {
  data: ChartDataPoint[];
  type?: "bar" | "line";
  height?: number;
  showGrid?: boolean;
  className?: string;
}

export function InteractiveChart({
  data,
  type = "bar",
  height = 200,
  showGrid = true,
  className,
}: InteractiveChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-muted-foreground", className)} style={{ height }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1);
  const padding = { top: 20, right: 16, bottom: 24, left: 8 };
  const chartWidth = 100;
  const chartHeight = height - padding.top - padding.bottom;

  if (type === "bar") {
    const barWidth = Math.min(40, (chartWidth - padding.left - padding.right) / data.length - 4);

    return (
      <div className={cn("relative", className)} style={{ height }}>
        {showGrid && (
          <div className="absolute inset-0 flex flex-col justify-between px-1 pb-6 pt-5">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div key={pct} className="border-t border-dashed border-border/40" />
            ))}
          </div>
        )}
        <div className="relative flex items-end justify-around h-full pb-6 pt-5">
          {data.map((point, idx) => {
            const barH = (point.value / maxValue) * chartHeight;
            const secondaryH = point.secondary ? (point.secondary / maxValue) * chartHeight : 0;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                className="relative flex flex-col items-center justify-end flex-1 h-full"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {isHovered && (
                  <div className="absolute -top-5 z-10 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs shadow-md border">
                    <p className="font-medium">{point.label}</p>
                    <p className="text-muted-foreground">Value: {point.value}</p>
                    {point.secondary !== undefined && (
                      <p className="text-muted-foreground">Secondary: {point.secondary}</p>
                    )}
                  </div>
                )}
                <div className="relative flex items-end gap-0.5 w-full justify-center">
                  {point.secondary !== undefined && (
                    <div
                      className="w-2 rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${secondaryH}px`,
                        backgroundColor: point.color ? `${point.color}60` : "hsl(var(--primary) / 0.3)",
                        opacity: isHovered ? 1 : 0.7,
                      }}
                    />
                  )}
                  <div
                    className="w-2 rounded-t-sm transition-all duration-200 cursor-pointer"
                    style={{
                      height: `${barH}px`,
                      backgroundColor: point.color || "hsl(var(--primary))",
                      opacity: isHovered ? 1 : 0.8,
                    }}
                  />
                </div>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground truncate max-w-full px-1">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const points = data.map((point, idx) => ({
    x: padding.left + (idx / Math.max(data.length - 1, 1)) * (chartWidth - padding.left - padding.right),
    y: padding.top + (1 - point.value / maxValue) * chartHeight,
    point,
    idx,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0} ${padding.top + chartHeight} L${points[0]?.x ?? 0} ${padding.top + chartHeight} Z`;

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none">
        {showGrid && [0, 25, 50, 75, 100].map((pct) => {
          const y = padding.top + (1 - pct / 100) * chartHeight;
          return (
            <line
              key={pct}
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="0.3"
              strokeDasharray="1 1"
            />
          );
        })}
        <path d={areaPath} fill="hsl(var(--primary) / 0.08)" />
        <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeLinejoin="round" />
        {points.map((p) => (
          <circle
            key={p.idx}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === p.idx ? 2.5 : 1.5}
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth="1"
            className="transition-all duration-150 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(p.idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
      <div className="flex justify-between px-1 -mt-1">
        {data.map((point, idx) => (
          <span
            key={idx}
            className={cn(
              "text-[10px] text-muted-foreground transition-colors",
              hoveredIndex === idx && "text-foreground font-medium"
            )}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {point.label}
          </span>
        ))}
      </div>
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          className="absolute -top-1 z-10 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs shadow-md border"
          style={{ left: `${(hoveredIndex / Math.max(data.length - 1, 1)) * 92 + 4}%` }}
        >
          <p className="font-medium">{data[hoveredIndex].label}</p>
          <p className="text-muted-foreground">Value: {data[hoveredIndex].value}</p>
        </div>
      )}
    </div>
  );
}
