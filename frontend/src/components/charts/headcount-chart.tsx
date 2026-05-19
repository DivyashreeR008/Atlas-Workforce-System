"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeadcountChartProps {
  data: { month: string; count: number }[];
}

export function HeadcountChart({ data }: HeadcountChartProps) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-base">Headcount Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="headcount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(239 84% 67%)"
              fill="url(#headcount)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
