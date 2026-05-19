"use client";

import { mockLeaveRequests } from "@/lib/mock-data";
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
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export default function LeavePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
        <p className="text-muted-foreground">Leave requests and approvals</p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Leave Requests</CardTitle>
          <CardDescription>Pending and recent requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockLeaveRequests.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{req.employeeName}</td>
                    <td className="px-4 py-3">{req.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(req.startDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(req.endDate)}
                    </td>
                    <td className="px-4 py-3">{req.days}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[req.status] ?? "default"}>
                        {req.status}
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
