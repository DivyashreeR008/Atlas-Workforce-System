"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIDashboardResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Send, GripHorizontal } from "lucide-react";

export default function AIDashboardGenerationPage() {
  const [focus, setFocus] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [result, setResult] = useState<AIDashboardResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.dashboard.generate({
        focus,
        department: department || undefined,
        role: role || undefined,
      });
      return data as AIDashboardResponse;
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focus.trim() || mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Dashboard Generation</h1>
          <p className="text-muted-foreground">Create custom dashboards with AI-powered widget suggestions</p>
        </div>
        <Badge variant="secondary" className="gap-1"><LayoutDashboard className="h-3 w-3" />AI Dashboard</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard Configuration</CardTitle>
          <CardDescription>Define the focus area for your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="focus">Focus Area</Label>
              <Input
                id="focus"
                placeholder="e.g., Workforce Productivity, Recruitment Funnel, Training ROI"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department (optional)</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department"><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All departments</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Target Role (optional)</Label>
                <Input
                  id="role"
                  placeholder="e.g., Manager, Executive, Analyst"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={!focus.trim() || mutation.isPending} className="gap-2">
              {mutation.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Send className="h-4 w-4" />}
              {mutation.isPending ? "Generating..." : "Generate Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>{result.title}</CardTitle>
            <CardDescription>{result.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.widgets.map((widget, i) => (
                <Card key={i} className="border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{widget.type}</Badge>
                      <GripHorizontal className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-sm mt-2">{widget.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{widget.metric}</p>
                    {widget.chart_type && (
                      <p className="text-xs text-muted-foreground mt-1">Chart: {widget.chart_type}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {result.layout.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Layout Information</h3>
                <ScrollArea className="max-h-40">
                  <div className="space-y-1">
                    {result.layout.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Widget {item.widget}</span>
                        <span>Position: ({item.x}, {item.y})</span>
                        <span>Size: {item.w} x {item.h}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
