"use client";

import { mockAttendance } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  present: "success",
  late: "warning",
  absent: "destructive",
  remote: "secondary",
};

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">Daily check-in and check-out records</p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Attendance</CardTitle>
          <CardDescription>Live attendance snapshot</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Check Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockAttendance.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{row.employeeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3">{row.checkIn}</td>
                    <td className="px-4 py-3">{row.checkOut}</td>
                    <td className="px-4 py-3">{row.hours > 0 ? row.hours : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[row.status] ?? "default"}>
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
