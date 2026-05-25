"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Building2, Briefcase, Pencil, Trash2 } from "lucide-react";
import { employeeApi } from "@/lib/api";
import type { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToastStore } from "@/stores/toast-store";

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const addToast = useToastStore((s) => s.toast);
  const rawId = params.id as string;
  const email = decodeURIComponent(rawId);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", department: "", position: "" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const { data } = await employeeApi.get(email);
        const emp = data as Employee;
        setEmployee(emp);
        setEditForm({ name: emp.name, department: emp.department, position: emp.position });
      } catch {
        setEmployee(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [email]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    try {
      const { data } = await employeeApi.update(employee.email, editForm);
      setEmployee(data as Employee);
      setEditing(false);
      addToast({ title: "Employee updated" });
    } catch {
      addToast({ title: "Failed to update employee", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    if (!confirm(`Delete employee ${employee.name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await employeeApi.delete(employee.email);
      addToast({ title: "Employee deleted" });
      router.push("/dashboard/employees");
    } catch {
      addToast({ title: "Failed to delete employee", variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/employees">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        {!loading && !error && employee && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              <Pencil className="h-4 w-4" />
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        )}
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
      ) : editing ? (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-2xl">Edit {employee.name}</CardTitle>
            <CardDescription>Update employee details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input
                  id="edit-name"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dept">Department</Label>
                <Input
                  id="edit-dept"
                  required
                  value={editForm.department}
                  onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pos">Position</Label>
                <Input
                  id="edit-pos"
                  required
                  value={editForm.position}
                  onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
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
