"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Orbit,
  UserPlus,
  UserMinus,
  Timer,
  Briefcase,
  TrendingUp,
  ArrowRightLeft,
  FileText,
  Award,
  Map,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Users,
  Building,
  ExternalLink,
} from "lucide-react";
import { lifecycleApi } from "@/lib/api";
import type {
  LifecycleDashboard,
  OnboardingTemplate,
  OnboardingAssignment,
  OffboardingRecord,
  ProbationRecord,
  InternalJobPosting,
  PromotionRequest,
  TransferRequest,
} from "@/types";

const tabs = [
  { id: "overview", label: "Overview", icon: Orbit },
  { id: "onboarding", label: "Onboarding", icon: UserPlus },
  { id: "offboarding", label: "Offboarding", icon: UserMinus },
  { id: "probation", label: "Probation", icon: Timer },
  { id: "mobility", label: "Mobility", icon: ArrowRightLeft },
  { id: "promotions", label: "Promotions", icon: TrendingUp },
  { id: "career", label: "Career", icon: Map },
];

export default function LifecyclePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const { data: dashboard } = useQuery<LifecycleDashboard>({
    queryKey: ["lifecycle-dashboard"],
    queryFn: () => lifecycleApi.dashboard().then((r) => r.data),
  });

  const { data: onboardingTemplates } = useQuery({
    queryKey: ["lifecycle-onboarding-templates"],
    queryFn: () => lifecycleApi.onboarding.templates.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: assignments } = useQuery({
    queryKey: ["lifecycle-onboarding-assignments"],
    queryFn: () => lifecycleApi.onboarding.assignments.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: offboarding } = useQuery({
    queryKey: ["lifecycle-offboarding"],
    queryFn: () => lifecycleApi.offboarding.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: probations } = useQuery({
    queryKey: ["lifecycle-probations"],
    queryFn: () => lifecycleApi.probation.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: internalJobs } = useQuery({
    queryKey: ["lifecycle-internal-jobs"],
    queryFn: () => lifecycleApi.mobility.jobs.list().then((r) => r.data),
  });

  const { data: promotions } = useQuery({
    queryKey: ["lifecycle-promotions"],
    queryFn: () => lifecycleApi.promotions.list({ page_size: 50 }).then((r) => r.data),
  });

  const { data: transfers } = useQuery({
    queryKey: ["lifecycle-transfers"],
    queryFn: () => lifecycleApi.mobility.transfers.list({ page_size: 50 }).then((r) => r.data),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => lifecycleApi.onboarding.templates.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle-onboarding-templates"] }),
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => lifecycleApi.mobility.jobs.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle-internal-jobs"] }),
  });

  function statCard(label: string, value: number, icon: React.ReactNode, color: string) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
          <div>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Employee Lifecycle</h1>
          <p className="text-sm text-gray-400">
            Onboarding, offboarding, probation, career, internal mobility, and promotions
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statCard("Onboarding Pending", dashboard?.onboarding_pending ?? 0, <UserPlus className="h-5 w-5 text-blue-400" />, "bg-blue-500/20")}
            {statCard("Onboarding Active", dashboard?.onboarding_active ?? 0, <Users className="h-5 w-5 text-cyan-400" />, "bg-cyan-500/20")}
            {statCard("Offboarding Pending", dashboard?.offboarding_pending ?? 0, <UserMinus className="h-5 w-5 text-orange-400" />, "bg-orange-500/20")}
            {statCard("Active Probations", dashboard?.probations_active ?? 0, <Timer className="h-5 w-5 text-yellow-400" />, "bg-yellow-500/20")}
            {statCard("Promotions Pending", dashboard?.promotions_pending ?? 0, <TrendingUp className="h-5 w-5 text-green-400" />, "bg-green-500/20")}
            {statCard("Transfers Pending", dashboard?.transfers_pending ?? 0, <ArrowRightLeft className="h-5 w-5 text-purple-400" />, "bg-purple-500/20")}
            {statCard("Documents", dashboard?.total_documents ?? 0, <FileText className="h-5 w-5 text-indigo-400" />, "bg-indigo-500/20")}
            {statCard("Achievements", dashboard?.total_achievements ?? 0, <Award className="h-5 w-5 text-pink-400" />, "bg-pink-500/20")}
            {statCard("Career Roadmaps", dashboard?.total_career_roadmaps ?? 0, <Map className="h-5 w-5 text-emerald-400" />, "bg-emerald-500/20")}
          </div>
        </div>
      )}

      {activeTab === "onboarding" && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-400">Onboarding Templates</h3>
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="p-3">Name</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Stages</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(onboardingTemplates?.items ?? []).map((t: OnboardingTemplate) => (
                    <tr key={t.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                      <td className="p-3 font-medium text-white">{t.name}</td>
                      <td className="p-3">{t.department || "—"}</td>
                      <td className="p-3">{t.stages?.length ?? 0}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${t.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                          {t.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3">
                        <button onClick={() => deleteTemplate.mutate(t.id)} className="rounded p-1 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(onboardingTemplates?.items ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">No templates yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-400">Active Assignments</h3>
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {(assignments?.items ?? []).filter((a: OnboardingAssignment) => a.status !== "COMPLETED").map((a: OnboardingAssignment) => (
                    <tr key={a.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                      <td className="p-3 font-medium text-white">{a.employee_id}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          a.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                          a.status === "IN_PROGRESS" ? "bg-blue-500/20 text-blue-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>{a.status}</span>
                      </td>
                      <td className="p-3">{a.current_stage || "—"}</td>
                      <td className="p-3">{a.start_date || "—"}</td>
                    </tr>
                  ))}
                  {(assignments?.items ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-500">No assignments.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "offboarding" && (
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-gray-400">
                <th className="p-3">Employee</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Last Day</th>
                <th className="p-3">Status</th>
                <th className="p-3">Clearance</th>
                <th className="p-3">Exit Interview</th>
              </tr>
            </thead>
            <tbody>
              {(offboarding?.items ?? []).map((r: OffboardingRecord) => (
                <tr key={r.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                  <td className="p-3 font-medium text-white">{r.employee_id}</td>
                  <td className="p-3">{r.reason || "—"}</td>
                  <td className="p-3">{r.last_working_date || "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      r.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                      r.status === "IN_PROGRESS" ? "bg-blue-500/20 text-blue-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>{r.status}</span>
                  </td>
                  <td className="p-3">{r.clearance_checklist?.length ?? 0} items</td>
                  <td className="p-3">
                    {r.exit_interview_completed
                      ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                      : <XCircle className="h-4 w-4 text-gray-500" />}
                  </td>
                </tr>
              ))}
              {(offboarding?.items ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No offboarding records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "probation" && (
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-gray-400">
                <th className="p-3">Employee</th>
                <th className="p-3">Period</th>
                <th className="p-3">Days</th>
                <th className="p-3">Status</th>
                <th className="p-3">Extended</th>
                <th className="p-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {(probations?.items ?? []).map((p: ProbationRecord) => (
                <tr key={p.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                  <td className="p-3 font-medium text-white">{p.employee_id}</td>
                  <td className="p-3">{p.start_date} → {p.end_date}</td>
                  <td className="p-3">{p.probation_length_days}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      p.status === "ACTIVE" ? "bg-blue-500/20 text-blue-400" :
                      p.status === "COMPLETED" ? "bg-green-500/20 text-green-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{p.status}</span>
                  </td>
                  <td className="p-3">{p.extended ? <CheckCircle2 className="h-4 w-4 text-yellow-400" /> : "—"}</td>
                  <td className="p-3">{p.result || "—"}</td>
                </tr>
              ))}
              {(probations?.items ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No probation records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "mobility" && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-400">Internal Job Postings</h3>
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="p-3">Title</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(internalJobs?.items ?? []).map((j: InternalJobPosting) => (
                    <tr key={j.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                      <td className="p-3 font-medium text-white">{j.title}</td>
                      <td className="p-3">{j.department || "—"}</td>
                      <td className="p-3">{j.level || "—"}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          j.status === "PUBLISHED" ? "bg-green-500/20 text-green-400" :
                          j.status === "DRAFT" ? "bg-gray-500/20 text-gray-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>{j.status}</span>
                      </td>
                      <td className="p-3">
                        <button onClick={() => deleteJob.mutate(j.id)} className="rounded p-1 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(internalJobs?.items ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">No internal job postings.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-400">Transfer Requests</h3>
              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-gray-400">
                      <th className="p-3">Employee</th>
                      <th className="p-3">From → To</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transfers?.items ?? []).map((t: TransferRequest) => (
                      <tr key={t.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                        <td className="p-3 font-medium text-white">{t.employee_id}</td>
                        <td className="p-3 text-xs">{(t.from_department || "—")} → {t.to_department}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            t.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                            t.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                            "bg-red-500/20 text-red-400"
                          }`}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                    {(transfers?.items ?? []).length === 0 && (
                      <tr><td colSpan={3} className="p-6 text-center text-gray-500">No transfers.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-400">Promotion Requests</h3>
              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-gray-400">
                      <th className="p-3">Employee</th>
                      <th className="p-3">Current → Proposed</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(promotions?.items ?? []).map((p: PromotionRequest) => (
                      <tr key={p.id} className="border-b border-white/5 text-gray-300 hover:bg-white/5">
                        <td className="p-3 font-medium text-white">{p.employee_id}</td>
                        <td className="p-3 text-xs">{(p.current_title || "—")} → {p.proposed_title}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            p.status === "SUBMITTED" ? "bg-yellow-500/20 text-yellow-400" :
                            p.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                            p.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                    {(promotions?.items ?? []).length === 0 && (
                      <tr><td colSpan={3} className="p-6 text-center text-gray-500">No promotions.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "promotions" && <MobilityPromotionsView />}

      {activeTab === "career" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Career frameworks, job families, career paths, and roadmaps are available via the service API.
            Navigate to <strong className="text-white">Employees → Profile</strong> for individual career roadmaps.
          </p>
        </div>
      )}
    </div>
  );
}

function MobilityPromotionsView() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-400">Promotions & Transfers</h3>
      <p className="text-sm text-gray-500">
        This tab combines the Mobility (internal jobs, applications, transfers) and Promotions data.
        Use the main tabs above for detailed views.
      </p>
    </div>
  );
}
