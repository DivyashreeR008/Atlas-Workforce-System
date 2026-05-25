"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  MapPin,
  Users,
  Clock,
  Plus,
} from "lucide-react";
import { atsApi } from "@/lib/api";
import type { Job, Application } from "@/types";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToastStore } from "@/stores/toast-store";

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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [tab, setTab] = useState<"overview" | "applications">("overview");
  const [addAppOpen, setAddAppOpen] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["ats", "job", id],
    queryFn: async () => {
      const { data } = await atsApi.getJob(id);
      return data as Job;
    },
  });

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ["ats", "applications", "job", id],
    queryFn: async () => {
      const { data } = await atsApi.getApplications({ jobId: id });
      const payload = data as { items: Application[] } | Application[];
      return Array.isArray(payload) ? payload : (payload.items ?? []);
    },
  });

  const { data: candidatesData } = useQuery({
    queryKey: ["ats", "candidates", "all"],
    queryFn: async () => {
      const { data } = await atsApi.getCandidates({ pageSize: 100 });
      const payload = data as { items: { id: string; firstName: string; lastName: string }[] } | { id: string; firstName: string; lastName: string }[];
      return Array.isArray(payload) ? payload : (payload.items ?? []);
    },
  });

  async function handleAddApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateId) return;
    setSubmitting(true);
    try {
      await atsApi.submitApplication({
        jobId: id,
        candidateId,
        notes,
      });
      addToast({ title: "Application submitted" });
      setAddAppOpen(false);
      setCandidateId("");
      setNotes("");
      void queryClient.invalidateQueries({
        queryKey: ["ats", "applications"],
      });
    } catch {
      addToast({
        title: "Failed to submit application",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(appId: string, status: string) {
    try {
      await atsApi.updateApplicationStatus(appId, status);
      addToast({ title: `Application moved to ${status}` });
      void queryClient.invalidateQueries({
        queryKey: ["ats", "applications"],
      });
    } catch {
      addToast({
        title: "Failed to update status",
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Briefcase className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Job not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/ats/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  const applications = appsData ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
            <Badge
              variant={
                job.status === "open"
                  ? "success"
                  : job.status === "closed"
                    ? "destructive"
                    : job.status === "on-hold"
                      ? "warning"
                      : "secondary"
              }
            >
              {job.status}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              {job.department}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {job.type}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Posted {new Date(job.postedDate).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {job.applicationsCount} applications
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === "draft" && (
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await atsApi.publishJob(job.id);
                  addToast({ title: "Job published" });
                  void queryClient.invalidateQueries({
                    queryKey: ["ats", "job", id],
                  });
                } catch {
                  addToast({
                    title: "Failed to publish job",
                    variant: "destructive",
                  });
                }
              }}
            >
              Publish
            </Button>
          )}
          {job.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await atsApi.closeJob(job.id);
                  addToast({ title: "Job closed" });
                  void queryClient.invalidateQueries({
                    queryKey: ["ats", "job", id],
                  });
                } catch {
                  addToast({
                    title: "Failed to close job",
                    variant: "destructive",
                  });
                }
              }}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b">
        <button
          className={`pb-2 text-sm font-medium transition-colors ${
            tab === "overview"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={`pb-2 text-sm font-medium transition-colors ${
            tab === "applications"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("applications")}
        >
          Applications ({applications.length})
        </button>
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.description || "No description provided."}
              </p>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-base">Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {job.requirements || "No requirements specified."}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-base">Salary Range</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ${job.salaryMin.toLocaleString()} - $
                  {job.salaryMax.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">per year</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "applications" && (
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Applications</CardTitle>
                <CardDescription>
                  Candidates who applied for this position
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddAppOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Application
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">No applications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/ats/candidates/${app.candidateId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {app.candidate
                          ? `${app.candidate.firstName} ${app.candidate.lastName}`
                          : app.candidateId}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Applied {new Date(app.appliedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={appStatusBadge(app.status)}>
                        {app.status}
                      </Badge>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={app.status}
                        onChange={(e) =>
                          handleStatusChange(app.id, e.target.value)
                        }
                      >
                        <option value="applied">Applied</option>
                        <option value="screening">Screening</option>
                        <option value="interview">Interview</option>
                        <option value="offer">Offer</option>
                        <option value="hired">Hired</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addAppOpen} onOpenChange={setAddAppOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Application</DialogTitle>
            <DialogDescription>
              Submit an existing candidate for this job
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddApplication} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="candidate">Candidate</Label>
              <select
                id="candidate"
                required
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
              >
                <option value="">Select candidate</option>
                {(
                  (Array.isArray(candidatesData)
                    ? candidatesData
                    : candidatesData ?? []) as {
                    id: string;
                    firstName: string;
                    lastName: string;
                  }[]
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddAppOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium leading-none"
    >
      {children}
    </label>
  );
}
