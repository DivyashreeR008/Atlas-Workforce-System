"use client";


import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Bot, Cpu, Users, Clock, UserCheck,
} from "lucide-react";

interface FormData {
  goal: string;
  autonomy_level: string;
}

interface PlanPhase {
  phase: number;
  name: string;
  agent: string;
  autonomous: boolean;
  human_required: boolean;
}

interface SubAgent {
  name: string;
  role: string;
  capabilities: string[];
}

interface AgenticResult {
  plan: PlanPhase[];
  sub_agents: SubAgent[];
  estimated_steps: number;
  estimated_duration: string;
  human_touchpoints: number;
}

export default function AgenticHRPage() {
  const [form, setForm] = useState<FormData>({
    goal: "",
    autonomy_level: "semi_autonomous",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.agentic.hr({
        goal: form.goal,
        autonomy_level: form.autonomy_level,
      });
      return data as AgenticResult;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agentic HR Workflows</h1>
        <p className="text-muted-foreground">
          Multi-agent AI orchestration for complex HR workflows
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Goal</CardTitle>
          <CardDescription>Define the HR workflow goal and autonomy level for AI agent orchestration</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Goal</Label>
              <Textarea
                id="goal"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="e.g. Automate the full employee onboarding process including IT setup, HR orientation, and team introduction"
                className="min-h-32"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="autonomy_level">Autonomy Level</Label>
              <Select
                value={form.autonomy_level}
                onValueChange={(v) => setForm({ ...form, autonomy_level: v })}
              >
                <SelectTrigger id="autonomy_level">
                  <SelectValue placeholder="Select autonomy level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semi_autonomous">Semi-Autonomous</SelectItem>
                  <SelectItem value="fully_autonomous">Fully Autonomous</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Orchestrating..." : "Generate Workflow Plan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
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
              {(mutation.error as Error)?.message || "Failed to generate workflow plan."}
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated Steps</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mutation.data.estimated_steps}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mutation.data.estimated_duration}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Human Touchpoints</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mutation.data.human_touchpoints}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Execution Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Phase</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Agent</th>
                      <th className="pb-3 font-medium">Autonomous</th>
                      <th className="pb-3 font-medium">Human Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mutation.data.plan.map((phase) => (
                      <tr key={phase.phase} className="border-b last:border-0">
                        <td className="py-3">{phase.phase}</td>
                        <td className="py-3 font-medium">{phase.name}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="gap-1">
                            <Bot className="h-3 w-3" />
                            {phase.agent}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge variant={phase.autonomous ? "success" : "secondary"}>
                            {phase.autonomous ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge variant={phase.human_required ? "warning" : "success"}>
                            {phase.human_required ? "Required" : "Not Required"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {mutation.data.sub_agents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Sub-Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mutation.data.sub_agents.map((agent) => (
                    <Card key={agent.name}>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          {agent.name}
                        </CardTitle>
                        <CardDescription>{agent.role}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {agent.capabilities.map((cap) => (
                            <li key={cap} className="flex items-start gap-2 text-xs">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                              {cap}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
