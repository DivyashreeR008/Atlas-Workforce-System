"use client";

import { mockPayrollRuns } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const statusVariant: Record<
  string,
  "default" | "secondary" | "success" | "warning"
> = {
  draft: "secondary",
  processing: "warning",
  completed: "success",
};

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground">Payroll runs and processing status</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {mockPayrollRuns.map((run) => (
          <Card key={run.id} className="glass-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{run.period}</CardTitle>
                <Badge variant={statusVariant[run.status] ?? "default"}>
                  {run.status}
                </Badge>
              </div>
              <CardDescription>{run.employeeCount} employees</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(run.totalAmount)}</p>
              <span className="text-sm text-muted-foreground">Total disbursement</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Payroll History</CardTitle>
          <CardDescription>All payroll runs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Employees</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockPayrollRuns.map((run) => (
                  <tr key={run.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{run.period}</td>
                    <td className="px-4 py-3">{run.employeeCount}</td>
                    <td className="px-4 py-3">{formatCurrency(run.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[run.status] ?? "default"}>
                        {run.status}
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
