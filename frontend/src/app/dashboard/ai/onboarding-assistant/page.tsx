"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIOnboardingResponse } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertTriangle, ChevronRight, Rocket, Calendar, Users, Target,
  BookOpen, Lightbulb, ClipboardCheck, Route, Clock
} from "lucide-react";

const departments = [
  "Engineering", "Product", "Design", "Marketing", "Sales",
  "HR", "Finance", "Operations", "Legal", "Support",
];

const experienceLevels = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "senior", label: "Senior" },
];

export default function OnboardingAssistantPage() {
  const [employeeRole, setEmployeeRole] = useState("");
  const [department, setDepartment] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { employee_role: string; department: string; experience_level: string }) =>
      aiApi.assistants.onboarding(data),
  });

  const result = mutation.data?.data as AIOnboardingResponse | undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeRole.trim() || !department || !experienceLevel) return;
    mutation.mutate({ employee_role: employeeRole, department, experience_level: experienceLevel });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Onboarding Assistant</h1>
        <p className="text-muted-foreground">Personalized onboarding plans based on role, department, and experience</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            New Hire Details
          </CardTitle>
          <CardDescription>Enter employee information to generate an onboarding plan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Employee Role</Label>
                <Input placeholder="e.g., Frontend Engineer" value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Experience Level</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceLevels.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending || !employeeRole.trim() || !department || !experienceLevel}>
              {mutation.isPending ? "Generating..." : "Generate Onboarding Plan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Generating Onboarding Plan</CardTitle>
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
            <p className="text-sm text-muted-foreground">{(mutation.error as Error)?.message || "Failed to generate plan. Please try again."}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recommended Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72">
                <div className="space-y-4">
                  {result.recommended_plan.map((plan, i) => (
                    <Card key={i} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Week {plan.week}</Badge>
                          <p className="text-sm font-semibold">{plan.focus}</p>
                        </div>
                        <ul className="space-y-1">
                          {plan.activities.map((act, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                              {act}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  Estimated Ramp-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{result.estimated_ramp_up}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4" />
                  Key Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.key_milestones.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  Mentor Suggestion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.mentor_suggestion}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
