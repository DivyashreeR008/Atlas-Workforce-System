"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

export interface BreadcrumbItem {
  title: string;
  link: string;
}

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  lifecycle: "Lifecycle",
  attendance: "Attendance",
  payroll: "Payroll",
  analytics: "Analytics",
  leave: "Leave",
  reports: "Reports",
  notifications: "Notifications",
  performance: "Performance",
  lms: "LMS",
  "learning-development": "L&D",
  "workforce-planning": "Workforce Planning",
  ai: "AI",
  compliance: "Compliance",
  security: "Security",
  live: "Live",
  integrations: "Integrations",
  "command-center": "Command Center",
  settings: "Settings",
  ats: "ATS",
  jobs: "Jobs",
  candidates: "Candidates",
  courses: "Courses",
  certifications: "Certifications",
  skills: "Skills",
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const items: BreadcrumbItem[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const link = "/" + segments.slice(0, i + 1).join("/");
      const title = labelMap[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
      items.push({ title, link });
    }

    return items;
  }, [pathname]);
}
