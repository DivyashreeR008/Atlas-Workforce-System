"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AISuccessionResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCheck, Users, BarChart4, GraduationCap, AlertTriangle, Shield, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Engineering", "Marketing", "Sales", "HR", "Finance",
  "Operations", "Legal", "Design", "Product", "Support",
];

const READINESS_COLORS: Record<string, string> = {
  ready_now: "bg-green-500/10 text-green-500 border-green-500/20",
  ready_1_2_years: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ready_3_5_years: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  not_ready: "bg-red-500/10 text-red-500 border-red-500/20",
};

const READINESS_LABELS: Record<string, string> = {
  ready_now: "Ready Now",
  ready_1_2_years: "1-2 Years",
  ready_3_5_years: "3-5 Years",
  not_ready: "Not Ready",
};

export default function SuccessionPlanningPage() {
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [timeline, setTimeline] = useState(12);

  const mutation = useMutation({
    mutationFn: async () => {
      const skills = requiredSkills.split(",").map((s) => s.trim()).filter(Boolean);
      const { data } = await aiApi.planning.succession({
        position,
        department,
        required_skills: skills,
        timeline_months: timeline,
      });
      return data as AISuccessionResponse;
    },
  });

  const vacancyColor = (risk: string) => {
    const l = risk.toLowerCase();
    if (l.includes("high") || l.includes("critical")) return "destructive";
    if (l.includes("medium")) return "warning";
    if (l.includes("low")) return "success";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Succession Planning
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <GraduationCap className="h-3 w-3" />AI Talent Planning
            </Badge>
          </div>
          <CardDescription>Identify and develop internal successors for key positions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Position *</Label>
                <Input
                  placeholder="e.g. Engineering Manager"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Input
                  placeholder="e.g. leadership, python, agile"
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Timeline (months)</Label>
                <Input
                  type="number"
                  value={timeline}
                  onChange={(e) => setTimeline(Number(e.target.value))}
                  min={1}
                  max={60}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!position || !department || mutation.isPending}>
                <UserCheck className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Succession analysis failed. Please try again.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutation.reset()}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { key: "ready_now", icon: Shield },
              { key: "ready_1_2_years", icon: TrendingUp },
              { key: "ready_3_5_years", icon: Target },
              { key: "not_ready", icon: AlertTriangle },
            ].map(({ key, icon: Icon }) => {
              const value = mutation.data.readiness_levels[key as keyof typeof mutation.data.readiness_levels];
              return (
                <Card key={key} className={cn("border-border/50", READINESS_COLORS[key])}>
                  <CardContent className="pt-4 text-center space-y-2">
                    <Icon className="h-5 w-5 mx-auto" />
                    <p className="text-xs text-muted-foreground">{READINESS_LABELS[key]}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Internal Candidates
                </CardTitle>
                <Badge variant={vacancyColor(mutation.data.risk_of_vacancy)} className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Risk: {mutation.data.risk_of_vacancy}
                </Badge>
              </div>
              <CardDescription>{mutation.data.internal_candidates.length} potential successor(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Current Role</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Readiness</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Overlap Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mutation.data.internal_candidates.map((candidate, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 px-3 font-medium">{candidate.name}</td>
                        <td className="py-2.5 px-3">{candidate.current_role}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              candidate.readiness === "ready-now" ? READINESS_COLORS.ready_now :
                              candidate.readiness === "ready-in-1-2" || candidate.readiness === "1-2 years" ? READINESS_COLORS.ready_1_2_years :
                              candidate.readiness === "ready-in-3-5" || candidate.readiness === "3-5 years" ? READINESS_COLORS.ready_3_5_years :
                              READINESS_COLORS.not_ready
                            )}
                          >
                            {candidate.readiness}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Progress value={candidate.overlap_score * 100} className="h-1.5 w-20" />
                            <span className="text-xs text-muted-foreground">{Math.round(candidate.overlap_score * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {mutation.data.development_plans.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4" />
                  Development Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {mutation.data.development_plans.map((plan, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium mt-0.5 shrink-0">
                        {i + 1}
                      </span>
                      <span>{plan}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
