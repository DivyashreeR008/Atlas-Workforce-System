"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastStore } from "@/stores/toast-store";
import { Clock, Clock9 } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "destructive",
  REMOTE: "secondary",
};

interface AttendanceRecord {
  id: number;
  employeeId: string;
  tenantId: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  status: string;
  overtime: number;
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  const { data: records, isLoading } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data } = await attendanceApi.list();
      return (Array.isArray(data) ? data : []) as AttendanceRecord[];
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem("auth-storage");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const user = parsed?.state?.user;
        if (user?.email) setEmployeeId(user.email);
      } catch {}
    }
  }, []);

  const handleClockIn = async () => {
    if (!employeeId) {
      addToast({ title: "Employee ID not found", variant: "destructive" });
      return;
    }
    setClockingIn(true);
    try {
      await attendanceApi.clockIn(employeeId);
      addToast({ title: "Clocked in successfully" });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    } catch {
      addToast({ title: "Failed to clock in", variant: "destructive" });
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) {
      addToast({ title: "Employee ID not found", variant: "destructive" });
      return;
    }
    setClockingOut(true);
    try {
      await attendanceApi.clockOut(employeeId);
      addToast({ title: "Clocked out successfully" });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    } catch {
      addToast({ title: "Failed to clock out", variant: "destructive" });
    } finally {
      setClockingOut(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Daily check-in and check-out records</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleClockIn} disabled={clockingIn}>
            <Clock9 className="h-4 w-4" />
            {clockingIn ? "Clocking in..." : "Clock In"}
          </Button>
          <Button variant="outline" onClick={handleClockOut} disabled={clockingOut}>
            <Clock className="h-4 w-4" />
            {clockingOut ? "Clocking out..." : "Clock Out"}
          </Button>
        </div>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Attendance Records</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `${records?.length ?? 0} records found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Employee ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Clock In</th>
                  <th className="px-4 py-3 font-medium">Clock Out</th>
                  <th className="px-4 py-3 font-medium">Overtime</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3" colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !records || records.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                      No attendance records found. Clock in to get started.
                    </td>
                  </tr>
                ) : (
                  records.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.employeeId}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-3">{formatTime(row.clockIn)}</td>
                      <td className="px-4 py-3">
                        {row.clockOut ? formatTime(row.clockOut) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.overtime > 0 ? `${row.overtime.toFixed(1)}h` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[row.status] ?? "default"}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
