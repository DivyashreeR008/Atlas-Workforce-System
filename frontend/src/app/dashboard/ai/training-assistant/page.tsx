"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AITrainingResponse } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, ChevronRight, Clock, BookOpen, BarChart3,
  Target, TrendingUp, Lightbulb, GraduationCap, Route
} from "lucide-react";

export default function TrainingAssistantPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [performanceGaps, setPerformanceGaps] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { employee_id: string; current_skills?: string[]; target_role?: string; performance_gaps?: string[] }) =>
      aiApi.assistants.training(data),
  });

  const result = mutation.data?.data as AITrainingResponse | undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) return;
    mutation.mutate({
      employee_id: employeeId,
      current_skills: currentSkills.split(",").map((s) => s.trim()).filter(Boolean),
      target_role: targetRole || undefined,
      performance_gaps: performanceGaps.split(",").map((g) => g.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training Assistant</h1>
        <p className="text-muted-foreground">Skill gap analysis and personalized training recommendations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Employee Training Profile
          </CardTitle>
          <CardDescription>Enter employee details for tailored training recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input placeholder="e.g., EMP-12345" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Target Role (optional)</Label>
                <Input placeholder="e.g., Senior Engineer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Current Skills (comma-separated)</Label>
                <Input placeholder="e.g., JavaScript, React, Python" value={currentSkills} onChange={(e) => setCurrentSkills(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Performance Gaps (comma-separated)</Label>
                <Input placeholder="e.g., Leadership, System Design" value={performanceGaps} onChange={(e) => setPerformanceGaps(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending || !employeeId.trim()}>
              {mutation.isPending ? "Analyzing..." : "Get Training Recommendations"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Analyzing Training Needs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{(mutation.error as Error)?.message || "Failed to get recommendations. Please try again."}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Recommended Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {result.recommended_courses.map((course, i) => (
                    <Card key={i}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold">{course.title}</p>
                            <p className="text-xs text-muted-foreground">{course.category}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0">{course.duration}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={course.relevance} className="h-2" />
                          <span className="text-xs text-muted-foreground shrink-0">{course.relevance}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Skill Gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Skill</th>
                        <th className="pb-2 font-medium">Current</th>
                        <th className="pb-2 font-medium">Required</th>
                        <th className="pb-2 font-medium">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.skill_gaps.map((gap, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{gap.skill}</td>
                          <td className="py-2">{gap.current}</td>
                          <td className="py-2">{gap.required}</td>
                          <td className="py-2">
                            <Badge variant={gap.priority === "high" ? "destructive" : gap.priority === "medium" ? "warning" : "secondary"}>
                              {gap.priority}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  Learning Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <ul className="space-y-2">
                    {result.learning_path.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-xs font-medium text-primary shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Estimated Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{result.estimated_time}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
