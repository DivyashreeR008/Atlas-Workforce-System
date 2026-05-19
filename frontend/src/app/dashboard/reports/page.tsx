"use client";

import { FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reportTypes = [
  { title: "Headcount Report", description: "Monthly employee count by department" },
  { title: "Payroll Summary", description: "Payroll disbursement breakdown" },
  { title: "Attendance Summary", description: "Attendance rates and exceptions" },
  { title: "Leave Balance", description: "Remaining leave balances by employee" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export workforce reports
        </p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Available Reports</CardTitle>
          <CardDescription>
            Report generation will be available in a future release
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {reportTypes.map((report) => (
              <div
                key={report.title}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{report.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.description}
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" disabled>
                    Coming soon
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
