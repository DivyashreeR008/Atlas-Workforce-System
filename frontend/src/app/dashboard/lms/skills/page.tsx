"use client";


import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, TrendingUp, Plus, Search, AlertTriangle } from "lucide-react";
import { lmsApi } from "@/lib/api";
import type { SkillMatrix, SkillGap } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastStore } from "@/stores/toast-store";

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ employeeId: "", skill: "", level: 3, category: "" });

  const { data: matrix, isLoading: matrixLoading } = useQuery({
    queryKey: ["lms-skills-matrix"],
    queryFn: async () => {
      const { data } = await lmsApi.skills.matrix();
      return (Array.isArray(data) ? data : []) as SkillMatrix[];
    },
  });

  const { data: gapAnalysis } = useQuery({
    queryKey: ["lms-skills-gaps"],
    queryFn: async () => {
      const { data } = await lmsApi.skills.gapAnalysis();
      return (Array.isArray(data) ? data : []) as SkillGap[];
    },
  });

  const filteredMatrix = (matrix ?? []).filter(
    (m) =>
      m.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddSkill(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await lmsApi.skills.upsert(form);
      addToast({ title: "Skill added" });
      setDialogOpen(false);
      setForm({ employeeId: "", skill: "", level: 3, category: "" });
      void queryClient.invalidateQueries({ queryKey: ["lms-skills-matrix"] });
      void queryClient.invalidateQueries({ queryKey: ["lms-skills-gaps"] });
    } catch {
      addToast({ title: "Failed to add skill", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const skillLevelColor = (level: number) => {
    if (level <= 2) return "destructive";
    if (level <= 3) return "warning";
    return "success";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills Intelligence</h1>
          <p className="text-muted-foreground">Skill matrix, gap analysis, and employee profiles</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Skill
        </Button>
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Skill Matrix</TabsTrigger>
          <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Employee Skill Matrix</CardTitle>
                  <CardDescription>Heatmap of skills by employee and role</CardDescription>
                </div>
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search employee or role..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {matrixLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="mb-3 h-12 w-full" />
                ))
              ) : filteredMatrix.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No skill data found. Add skills to build the matrix.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Employee</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Skills</th>
                        <th className="px-4 py-3 font-medium">Avg Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatrix.map((entry) => {
                        const avgLevel =
                          entry.skills.length > 0
                            ? Math.round(
                                (entry.skills.reduce((sum, s) => sum + s.level, 0) /
                                  entry.skills.length) *
                                  10
                              ) / 10
                            : 0;
                        return (
                          <tr
                            key={entry.employeeId}
                            className="border-b transition-colors hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 font-medium">{entry.employeeName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{entry.role}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {entry.skills.map((s) => (
                                  <Badge key={s.skill} variant={skillLevelColor(s.level) as any}>
                                    {s.skill}: {s.level}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Progress value={avgLevel * 20} className="w-20" />
                                <span className="text-xs text-muted-foreground">{avgLevel}/5</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Skill Gap Analysis</CardTitle>
              <CardDescription>Identified gaps between required and actual skill levels</CardDescription>
            </CardHeader>
            <CardContent>
              {!gapAnalysis ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="mb-3 h-14 w-full" />
                ))
              ) : gapAnalysis.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No skill gaps identified. All required skills are at adequate levels.
                </p>
              ) : (
                <div className="space-y-3">
                  {gapAnalysis
                    .filter((g) => g.gap > 0)
                    .sort((a, b) => b.gap - a.gap)
                    .map((gap, i) => (
                      <div
                        key={`${gap.role}-${gap.skill}-${i}`}
                        className="rounded-lg border p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">
                              {gap.role} &mdash; {gap.skill}
                            </span>
                          </div>
                          <Badge variant={gap.gap >= 2 ? "destructive" : "warning"}>
                            Gap: {gap.gap}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Required: {gap.requiredLevel}/5</span>
                          <span>Current: {gap.employeeLevel}/5</span>
                          <div className="flex-1">
                            <Progress
                              value={(gap.employeeLevel / gap.requiredLevel) * 100}
                              className="h-1.5"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Add Skill</h2>
            <p className="mt-1 text-sm text-muted-foreground">Record a skill for an employee</p>
            <form onSubmit={handleAddSkill} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="empId">Employee ID</Label>
                <Input id="empId" required value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillName">Skill</Label>
                <Input id="skillName" required value={form.skill} onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillCategory">Category</Label>
                <Input id="skillCategory" required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillLevel">Proficiency Level</Label>
                <Select value={String(form.level)} onValueChange={(v) => setForm((f) => ({ ...f, level: parseInt(v) }))}>
                  <SelectTrigger id="skillLevel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} - {["Novice", "Beginner", "Competent", "Proficient", "Expert"][n - 1]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
