"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AIShiftResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarClock, DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Engineering", "Marketing", "Sales", "HR", "Finance",
  "Operations", "Legal", "Design", "Product", "Support",
];

export default function ShiftOptimizationPage() {
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await aiApi.operations.shifts({
        department,
        date_range: [startDate, endDate],
      });
      return data as AIShiftResponse;
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Shift Optimization
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />AI Scheduling
            </Badge>
          </div>
          <CardDescription>Optimize shift schedules for better coverage and cost efficiency</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!department || !startDate || !endDate || mutation.isPending}>
                <CalendarClock className="h-4 w-4 mr-2" />
                Optimize
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Shift optimization failed. Please try again.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutation.reset()}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {mutation.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  Cost Savings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-500">
                  ${mutation.data.cost_savings.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Projected savings from optimized schedule</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Efficiency Gain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {mutation.data.efficiency_gain.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Projected efficiency improvement</p>
              </CardContent>
            </Card>
          </div>

          {mutation.data.coverage_gaps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Coverage Gaps
                </CardTitle>
                <CardDescription>Shifts with insufficient staffing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Shift</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Required</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Assigned</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutation.data.coverage_gaps.map((gap, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 px-3">{gap.date}</td>
                          <td className="py-2.5 px-3">{gap.shift}</td>
                          <td className="py-2.5 px-3">{gap.staff_required}</td>
                          <td className="py-2.5 px-3">{gap.staff_assigned}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="destructive" className="text-xs">{gap.gap}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4" />
                Optimized Schedule Preview
              </CardTitle>
              <CardDescription>{mutation.data.optimized_schedule.length} shifts scheduled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Shift</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Required</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Assigned</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mutation.data.optimized_schedule.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 px-3">{item.date}</td>
                        <td className="py-2.5 px-3">{item.shift}</td>
                        <td className="py-2.5 px-3">{item.staff_required}</td>
                        <td className="py-2.5 px-3">{item.staff_assigned}</td>
                        <td className="py-2.5 px-3">
                          {item.gap > 0 ? (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <Users className="h-3 w-3" /> Gap: {item.gap}
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Filled
                            </Badge>
                          )}
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
