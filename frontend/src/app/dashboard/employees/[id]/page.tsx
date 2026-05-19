"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Mail, Building2, Briefcase } from "lucide-react";
import { employeeApi } from "@/lib/api";
import type { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function EmployeeDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  const email = decodeURIComponent(rawId);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const { data } = await employeeApi.get(email);
        setEmployee(data as Employee);
      } catch {
        setEmployee(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [email]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/employees">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card className="glass-panel">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </CardContent>
        </Card>
      ) : error || !employee ? (
        <Card className="glass-panel">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Employee not found</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/dashboard/employees">Return to list</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{employee.name}</CardTitle>
                <CardDescription className="mt-1">{employee.email}</CardDescription>
              </div>
              <Badge>{employee.department}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="font-medium">{employee.email}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Department</dt>
                  <dd className="font-medium">{employee.department}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Position</dt>
                  <dd className="font-medium">{employee.position}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
