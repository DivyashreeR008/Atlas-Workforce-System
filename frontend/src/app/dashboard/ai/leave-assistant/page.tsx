"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AILeaveResponse } from "@/types";
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
  CalendarCheck, CalendarX, AlertTriangle, ChevronRight, Users, Clock,
  Calendar, CheckCircle2, XCircle, Sparkles
} from "lucide-react";

const leaveTypes = [
  "Annual Leave", "Sick Leave", "Personal Leave", "Maternity Leave",
  "Paternity Leave", "Bereavement Leave", "Study Leave", "Unpaid Leave",
  "Sabbatical", "Compensatory Off",
];

const departments = [
  "Engineering", "Product", "Design", "Marketing", "Sales",
  "HR", "Finance", "Operations", "Legal", "Support",
];

export default function LeaveAssistantPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [requestedDates, setRequestedDates] = useState("");
  const [department, setDepartment] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { employee_id: string; leave_type: string; requested_dates: string[]; department?: string }) =>
      aiApi.assistants.leave(data),
  });

  const result = mutation.data?.data as AILeaveResponse | undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !leaveType || !requestedDates.trim()) return;
    mutation.mutate({
      employee_id: employeeId,
      leave_type: leaveType,
      requested_dates: requestedDates.split(",").map((d) => d.trim()).filter(Boolean),
      department: department || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Assistant</h1>
        <p className="text-muted-foreground">Smart leave recommendations based on policy and team coverage</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Request Details
          </CardTitle>
          <CardDescription>Enter leave information for AI-powered recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input placeholder="e.g., EMP-12345" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Requested Dates (comma-separated)</Label>
                <Input
                  placeholder="e.g., 2025-06-01, 2025-06-02, 2025-06-03"
                  value={requestedDates}
                  onChange={(e) => setRequestedDates(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Department (optional)</Label>
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
            </div>
            <Button type="submit" disabled={mutation.isPending || !employeeId.trim() || !leaveType || !requestedDates.trim()}>
              {mutation.isPending ? "Analyzing..." : "Get Recommendation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Analyzing Leave Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-full" />
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
            <p className="text-sm text-muted-foreground">{(mutation.error as Error)?.message || "Failed to get recommendation. Please try again."}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.recommended ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={result.recommended ? "success" : "destructive"} className="text-sm px-3 py-1">
                  {result.recommended ? "Recommended" : "Not Recommended"}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed">{result.reason}</p>
            </CardContent>
          </Card>

          {result.coverage_suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Coverage Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.coverage_suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.pattern_insights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Pattern Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Days Used</p>
                    <p className="text-lg font-bold">{result.pattern_insights.total_days_used}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining Days</p>
                    <p className="text-lg font-bold">{result.pattern_insights.remaining_days}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Department Coverage</p>
                    <p className="text-lg font-bold">{result.pattern_insights.department_coverage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previous Approvals</p>
                    <p className="text-lg font-bold">{result.pattern_insights.previous_approvals}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
