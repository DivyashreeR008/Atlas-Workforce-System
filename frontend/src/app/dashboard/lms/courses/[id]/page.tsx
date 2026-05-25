"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Clock, BookOpen, User, ArrowLeft, Play, Users, FileQuestion } from "lucide-react";
import { lmsApi } from "@/lib/api";
import type { Course, Enrollment, Assessment } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastStore } from "@/stores/toast-store";

const levelBadge = (level: string) => {
  if (level === "beginner") return "success";
  if (level === "intermediate") return "warning";
  return "destructive";
};

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);

  const { data: course, isLoading } = useQuery({
    queryKey: ["lms-course", id],
    queryFn: async () => {
      const { data } = await lmsApi.courses.get(id);
      return data as Course;
    },
    enabled: !!id,
  });

  const { data: enrollments } = useQuery({
    queryKey: ["lms-enrollments", id],
    queryFn: async () => {
      const { data } = await lmsApi.enrollments.list({ courseId: id });
      return (Array.isArray(data) ? data : []) as Enrollment[];
    },
    enabled: !!id,
  });

  const { data: assessments } = useQuery({
    queryKey: ["lms-assessments", id],
    queryFn: async () => {
      const { data } = await lmsApi.assessments.list(id);
      return (Array.isArray(data) ? data : []) as Assessment[];
    },
    enabled: !!id,
  });

  async function handleEnroll() {
    try {
      await lmsApi.enrollments.create({ employeeId: "me", courseId: id });
      addToast({ title: "Enrolled successfully" });
      void queryClient.invalidateQueries({ queryKey: ["lms-enrollments", id] });
    } catch {
      addToast({ title: "Failed to enroll", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Course not found.
        <br />
        <Button variant="link" onClick={() => router.push("/dashboard/lms/courses")}>
          Back to courses
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back
      </Button>

      <Card className="glass-panel">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant={levelBadge(course.level) as any}>{course.level}</Badge>
                <Badge variant={course.status === "published" ? "success" : "outline"}>
                  {course.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground">{course.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {course.instructor}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {enrollments?.length ?? 0} enrolled
                </span>
              </div>
            </div>
            <Button onClick={handleEnroll} className="shrink-0">
              <Play className="mr-1 h-4 w-4" />
              Enroll Now
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {course.prerequisites && course.prerequisites.length > 0 && (
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Prerequisites</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {course.prerequisites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileQuestion className="h-4 w-4" />
              Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!assessments || assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessments yet.</p>
            ) : (
              <div className="space-y-2">
                {assessments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Passing: {a.passingScore}/{a.maxScore}
                      </p>
                    </div>
                    <Badge variant="secondary">{a.attempts?.length ?? 0} attempts</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {enrollments && enrollments.length > 0 && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Enrolled Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enr) => (
                    <tr key={enr.id} className="border-b transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">{enr.employeeName ?? enr.employeeId}</td>
                      <td className="px-4 py-3">{enr.progress}%</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            enr.status === "completed"
                              ? "success"
                              : enr.status === "active"
                                ? "default"
                                : "destructive"
                          }
                        >
                          {enr.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(enr.enrolledAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
