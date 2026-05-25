"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle, Code, Link2, DollarSign, CheckCircle2,
} from "lucide-react";

interface FormData {
  trigger: string;
  actions: string;
  conditions: string;
  department: string;
}

interface AutomationResult {
  automation_script: string;
  integration_points: string[];
  estimated_savings: number;
  validation_steps: string[];
}

export default function AutomationBuilderPage() {
  const [form, setForm] = useState<FormData>({
    trigger: "",
    actions: "",
    conditions: "",
    department: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const actions = form.actions.split(",").map((s) => s.trim()).filter(Boolean);
      const conditions = form.conditions
        ? form.conditions.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const { data } = await aiApi.automation.build({
        trigger: form.trigger,
        actions,
        conditions,
        department: form.department,
      });
      return data as AutomationResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automation Builder</h1>
        <p className="text-muted-foreground">
          Build custom HR process automations with AI-generated scripts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Configuration</CardTitle>
          <CardDescription>Define the trigger, actions, and conditions for your automation</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger</Label>
                <Input
                  id="trigger"
                  value={form.trigger}
                  onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                  placeholder="e.g. new_employee_onboarded"
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="actions">Actions (comma-separated)</Label>
                <Input
                  id="actions"
                  value={form.actions}
                  onChange={(e) => setForm({ ...form, actions: e.target.value })}
                  placeholder="e.g. create_account, assign_mentor, send_welcome_email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conditions">Conditions (comma-separated)</Label>
                <Input
                  id="conditions"
                  value={form.conditions}
                  onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  placeholder="e.g. department=engineering, role=senior"
                />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Building..." : "Build Automation"}
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
              {(mutation.error as Error)?.message || "Failed to build automation."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Automation Script
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <pre className="rounded-lg bg-muted p-4 text-xs leading-relaxed">
                    <code>{mutation.data.automation_script}</code>
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated Savings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(mutation.data.estimated_savings)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">per year</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Integration Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mutation.data.integration_points.length > 0 ? (
                  <ul className="space-y-2">
                    {mutation.data.integration_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No integration points identified.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Validation Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mutation.data.validation_steps.length > 0 ? (
                  <ul className="space-y-2">
                    {mutation.data.validation_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        {step}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No validation steps defined.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
