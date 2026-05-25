"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, GraduationCap, TrendingUp, Award, AlertTriangle, Clock } from "lucide-react";
import { lmsApi } from "@/lib/api";
import type { LmsDashboardStats, Enrollment, Certification } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function LmsDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["lms-dashboard"],
    queryFn: async () => {
      const { data } = await lmsApi.dashboard();
      return data as LmsDashboardStats;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["lms-enrollments"],
    queryFn: async () => {
      const { data } = await lmsApi.enrollments.list({ status: "active" });
      return (data as Enrollment[]).slice(0, 5);
    },
  });

  const { data: expiringCerts } = useQuery({
    queryKey: ["lms-certifications-expiring"],
    queryFn: async () => {
      const { data } = await lmsApi.certifications.list();
      const certs = data as Certification[];
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return certs.filter(
        (c) => c.status === "active" && new Date(c.expiryDate) <= in30Days && new Date(c.expiryDate) >= now
      );
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["lms-courses-featured"],
    queryFn: async () => {
      const { data } = await lmsApi.courses.list({ status: "published" });
      return (data as any[]).slice(0, 6);
    },
  });

  const statCards = [
    { label: "Total Courses", value: stats?.totalCourses ?? 0, icon: BookOpen },
    { label: "Active Enrollments", value: stats?.activeEnrollments ?? 0, icon: GraduationCap },
    { label: "Completion Rate", value: `${stats?.completionRate ?? 0}%`, icon: TrendingUp },
    { label: "Certifications", value: stats?.totalCertifications ?? 0, icon: Award },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learning Management</h1>
        <p className="text-muted-foreground">Manage courses, certifications, and skill development</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">My Learning</CardTitle>
              <Link href="/dashboard/lms/courses">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!enrollments ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))
            ) : enrollments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No active enrollments.
                <br />
                <Link href="/dashboard/lms/courses" className="text-primary hover:underline">
                  Browse courses
                </Link>
              </p>
            ) : (
              enrollments.map((enr) => (
                <div key={enr.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{enr.courseTitle ?? "Course"}</span>
                    <span className="text-xs text-muted-foreground">{enr.progress}%</span>
                  </div>
                  <Progress value={enr.progress} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Certification Expiry Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!expiringCerts ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : expiringCerts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No certifications expiring soon.
              </p>
            ) : (
              expiringCerts.map((cert) => {
                const daysLeft = Math.ceil(
                  (new Date(cert.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{cert.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {daysLeft > 0 ? `Expires in ${daysLeft} days` : "Expired"}
                      </div>
                    </div>
                    <Badge variant={daysLeft <= 7 ? "destructive" : "warning"}>
                      {daysLeft}d
                    </Badge>
                  </div>
                );
              })
            )}
            <div className="pt-2 text-center">
              <Link href="/dashboard/lms/certifications">
                <Button variant="outline" size="sm">Manage Certifications</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Course Catalog</h2>
          <Link href="/dashboard/lms/courses">
            <Button variant="outline" size="sm">Browse All</Button>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!courses
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="glass-panel">
                  <CardContent className="p-4">
                    <Skeleton className="mb-2 h-4 w-3/4" />
                    <Skeleton className="mb-2 h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))
            : courses.map((course: any) => (
                <Link key={course.id} href={`/dashboard/lms/courses/${course.id}`}>
                  <Card className="glass-panel transition-all hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="secondary">{course.category}</Badge>
                        <Badge
                          variant={
                            course.level === "beginner"
                              ? "success"
                              : course.level === "intermediate"
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {course.level}
                        </Badge>
                      </div>
                      <h3 className="mb-1 font-semibold">{course.title}</h3>
                      <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                        {course.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {course.duration}
                        </span>
                        <span>{course.instructor}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>
      </div>
    </div>
  );
}
