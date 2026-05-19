"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { employeeApi } from "@/lib/api";
import type { Employee, PaginatedEmployees } from "@/types";
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

async function fetchEmployeePage(
  page: number,
  pageSize: number,
  search?: string
) {
  const { data } = await employeeApi.list({
    page,
    pageSize,
    search: search || undefined,
  });
  const payload = data as PaginatedEmployees | Employee[];
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length };
  }
  return { items: payload.items ?? [], total: payload.total ?? 0 };
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    position: "",
  });

  const pageSize = 10;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["employees", page, debouncedSearch],
    queryFn: () => fetchEmployeePage(page, pageSize, debouncedSearch),
  });

  const employees = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await employeeApi.create(form);
      addToast({ title: "Employee created" });
      setDialogOpen(false);
      setForm({ name: "", email: "", department: "", position: "" });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch {
      addToast({ title: "Failed to create employee", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage workforce directory ({total} total)
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>Search and browse all employees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, department..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3" colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-muted-foreground"
                      colSpan={4}
                    >
                      No employees found
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr
                      key={emp.email}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/employees/${encodeURIComponent(emp.email)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {emp.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {emp.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{emp.department}</Badge>
                      </td>
                      <td className="px-4 py-3">{emp.position}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Add Employee</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a new employee record
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  required
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  required
                  value={form.position}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, position: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
