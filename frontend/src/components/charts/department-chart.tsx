"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DepartmentChartProps {
  data: { name: string; value: number }[];
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-base">By Department</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey="name" type="category" width={90} className="text-xs" />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(160 84% 39%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
