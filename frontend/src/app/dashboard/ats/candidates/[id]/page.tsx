"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
  ExternalLink,
  Building2,
} from "lucide-react";
import { atsApi } from "@/lib/api";
import type { Candidate, Application, Interview } from "@/types";
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

const appStatusBadge = (
  status: string
): "success" | "warning" | "destructive" | "secondary" | "default" => {
  switch (status) {
    case "hired":
      return "success";
    case "interview":
    case "offer":
      return "warning";
    case "rejected":
      return "destructive";
    case "applied":
    case "screening":
      return "secondary";
    default:
      return "default";
  }
};

const interviewStatusBadge = (
  status: string
): "success" | "warning" | "destructive" | "secondary" | "default" => {
  switch (status) {
    case "completed":
      return "success";
    case "scheduled":
      return "warning";
    case "cancelled":
      return "destructive";
    default:
      return "default";
  }
};

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "applications" | "interviews">(
    "profile"
  );

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["ats", "candidate", id],
    queryFn: async () => {
      const { data } = await atsApi.getCandidate(id);
      return data as Candidate;
    },
  });

  const { data: applications } = useQuery({
    queryKey: ["ats", "applications", "candidate", id],
    queryFn: async () => {
      const { data } = await atsApi.getApplications({ candidateId: id });
      const payload = data as { items: Application[] } | Application[];
      return Array.isArray(payload) ? payload : (payload.items ?? []);
    },
  });

  const { data: interviews } = useQuery({
    queryKey: ["ats", "interviews", "candidate", id],
    queryFn: async () => {
      const { data } = await atsApi.getInterviews({ candidateId: id });
      const payload = data as { items: Interview[] } | Interview[];
      return Array.isArray(payload) ? payload : (payload.items ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <User className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Candidate not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/ats/candidates">Back to Candidates</Link>
        </Button>
      </div>
    );
  }

  const fullName = `${candidate.firstName} ${candidate.lastName}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-80 shrink-0">
          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                  {candidate.firstName[0]}
                  {candidate.lastName[0]}
                </div>
                <h2 className="mt-4 text-xl font-semibold">{fullName}</h2>
                <p className="text-sm text-muted-foreground">
                  {candidate.currentPosition}
                </p>
                <p className="text-sm text-muted-foreground">
                  {candidate.currentCompany}
                </p>
                <Badge
                  className="mt-2"
                  variant={
                    candidate.status === "active"
                      ? "success"
                      : candidate.status === "passive"
                        ? "secondary"
                        : candidate.status === "hired"
                          ? "default"
                          : "destructive"
                  }
                >
                  {candidate.status}
                </Badge>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${candidate.email}`}
                    className="text-primary hover:underline"
                  >
                    {candidate.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.currentCompany || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span>Source: {candidate.source}</span>
                </div>
                {candidate.resumeUrl && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={candidate.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      View Resume
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {candidate.skills?.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-4 border-b">
            <button
              className={`pb-2 text-sm font-medium transition-colors ${
                tab === "profile"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("profile")}
            >
              Profile
            </button>
            <button
              className={`pb-2 text-sm font-medium transition-colors ${
                tab === "applications"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("applications")}
            >
              Applications ({(applications ?? []).length})
            </button>
            <button
              className={`pb-2 text-sm font-medium transition-colors ${
                tab === "interviews"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("interviews")}
            >
              Interviews ({(interviews ?? []).length})
            </button>
          </div>

          {tab === "profile" && (
            <div className="mt-6 space-y-6">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Experience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {candidate.experience?.length > 0 ? (
                    <div className="space-y-4">
                      {candidate.experience.map((exp) => (
                        <div key={exp.id} className="border-l-2 border-muted pl-4">
                          <p className="font-medium">{exp.position}</p>
                          <p className="text-sm text-muted-foreground">
                            {exp.company}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(exp.startDate).toLocaleDateString()} -{" "}
                            {exp.endDate
                              ? new Date(exp.endDate).toLocaleDateString()
                              : "Present"}
                          </p>
                          {exp.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No experience listed
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {candidate.education?.length > 0 ? (
                    <div className="space-y-4">
                      {candidate.education.map((edu) => (
                        <div key={edu.id} className="border-l-2 border-muted pl-4">
                          <p className="font-medium">{edu.degree} in {edu.field}</p>
                          <p className="text-sm text-muted-foreground">
                            {edu.institution}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(edu.startDate).toLocaleDateString()} -{" "}
                            {edu.endDate
                              ? new Date(edu.endDate).toLocaleDateString()
                              : "Present"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No education listed
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "applications" && (
            <div className="mt-6">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-base">Applications</CardTitle>
                  <CardDescription>
                    Jobs this candidate has applied to
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(applications ?? []).length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p className="text-sm">No applications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(applications ?? []).map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/ats/jobs/${app.jobId}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {app.job?.title ?? app.jobId}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              Applied{" "}
                              {new Date(app.appliedDate).toLocaleDateString()}
                            </p>
                            {app.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {app.notes}
                              </p>
                            )}
                          </div>
                          <Badge variant={appStatusBadge(app.status)}>
                            {app.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "interviews" && (
            <div className="mt-6">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-base">Interview History</CardTitle>
                  <CardDescription>
                    All interviews scheduled for this candidate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(interviews ?? []).length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <MapPin className="h-8 w-8" />
                      <p className="text-sm">No interviews scheduled</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(interviews ?? []).map((interview) => (
                        <div
                          key={interview.id}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {interview.type} Interview
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  interview.scheduledDate
                                ).toLocaleString()}{" "}
                                &middot; {interview.duration} min
                              </p>
                              {interview.location && (
                                <p className="text-xs text-muted-foreground">
                                  {interview.location}
                                </p>
                              )}
                              {interview.meetingLink && (
                                <a
                                  href={interview.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  Join meeting
                                </a>
                              )}
                            </div>
                            <Badge
                              variant={interviewStatusBadge(interview.status)}
                            >
                              {interview.status}
                            </Badge>
                          </div>
                          {interview.feedback && (
                            <div className="mt-2 rounded-md bg-muted/50 p-3">
                              <p className="text-xs font-medium">Feedback</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {interview.feedback}
                              </p>
                              {interview.rating > 0 && (
                                <div className="mt-1 flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 ${
                                        i < interview.rating
                                          ? "fill-amber-400 text-amber-400"
                                          : "text-muted-foreground"
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
