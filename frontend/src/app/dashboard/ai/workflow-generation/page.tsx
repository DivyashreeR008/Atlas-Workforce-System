"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, Workflow, Clock, Users, Zap,
} from "lucide-react";

interface FormData {
  process_name: string;
  department: string;
  description: string;
}

interface WorkflowStep {
  step: number;
  name: string;
  role: string;
  estimated_time: string;
  automation_potential: string;
}

interface WorkflowResult {
  workflow_steps: WorkflowStep[];
  estimated_time: string;
  required_roles: string[];
  automation_opportunities: string[];
}

export default function WorkflowGenerationPage() {
  const [form, setForm] = useState<FormData>({
    process_name: "",
    department: "",
    description: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.automation.workflow(form);
      return data as WorkflowResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workflow Generation</h1>
        <p className="text-muted-foreground">
          AI-powered workflow generation for HR and workforce processes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process Details</CardTitle>
          <CardDescription>Describe the process to generate an optimized workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="process_name">Process Name</Label>
                <Input
                  id="process_name"
                  value={form.process_name}
                  onChange={(e) => setForm({ ...form, process_name: e.target.value })}
                  placeholder="e.g. Employee Onboarding"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. HR"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the process in detail..."
                className="min-h-32"
                required
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating..." : "Generate Workflow"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(mutation.error as Error)?.message || "Failed to generate workflow."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mutation.data.estimated_time}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Required Roles</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {mutation.data.required_roles.map((role) => (
                    <Badge key={role} variant="secondary">{role}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Automation Opportunities</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {mutation.data.automation_opportunities.map((opp) => (
                    <Badge key={opp} variant="success">{opp}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Workflow Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Step</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Est. Time</th>
                      <th className="pb-3 font-medium">Automation Potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mutation.data.workflow_steps.map((step) => (
                      <tr key={step.step} className="border-b last:border-0">
                        <td className="py-3">{step.step}</td>
                        <td className="py-3 font-medium">{step.name}</td>
                        <td className="py-3">
                          <Badge variant="outline">{step.role}</Badge>
                        </td>
                        <td className="py-3">{step.estimated_time}</td>
                        <td className="py-3">
                          <Badge
                            variant={
                              step.automation_potential === "High"
                                ? "success"
                                : step.automation_potential === "Medium"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {step.automation_potential}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
