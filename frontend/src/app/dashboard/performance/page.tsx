"use client";


import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, Award, Star, Users, UserCheck,
  MessageSquare, Lightbulb, Zap, Brain, Sparkles, BookOpen,
  GraduationCap, Activity, CheckCircle, XCircle, AlertTriangle,
  Plus, Settings, Play, ChevronRight, Medal, BarChart3,
  LineChart as LineChartIcon, Gauge, RefreshCw, UserPlus,
  Clock, ThumbsUp, FileCheck, ArrowRight, Info, Layers,
  Building2, Shield, Search, Filter, Calendar,
} from "lucide-react";
import { performanceApi } from "@/lib/api";
import type {
  PerformanceGoal, PerformanceReview, Feedback360, SuccessionPlan,
  KpiTarget, GoalAlignment, ContinuousFeedback, ManagerReview,
  PeerReview, PerformanceCalibration, PromotionReadiness,
  TalentReviewBoard, HiPoEmployee, LeadershipReadiness,
  AiPerformanceInsight, CoachingRecommendation, DevelopmentPlan,
} from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];

function scoreColor(v: number): string {
  if (v >= 80) return "text-emerald-500";
  if (v >= 60) return "text-amber-500";
  return "text-rose-500";
}

function scoreBg(v: number): string {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary" | "default"> = {
    HIGH: "destructive", MEDIUM: "warning", LOW: "secondary",
    CRITICAL: "destructive", "on-track": "success", "at-risk": "warning", behind: "destructive",
    completed: "default", draft: "secondary", active: "success", "in-progress": "warning",
    "ready-now": "success", "ready-in-6-months": "warning", "ready-in-1-year": "secondary", "not-ready": "destructive",
    ready: "success", "development-needed": "warning", pending: "secondary",
    identified: "secondary", "in-program": "warning", graduated: "success", exited: "destructive",
  };
  return <Badge variant={map[severity] ?? "secondary"} className="text-[10px] px-1.5 py-0">{severity}</Badge>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function SectionHeader({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Goal Dialog ─────────────────────────────────────────────────────────────

function GoalDialog({ open, onOpenChange, editItem }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem?: PerformanceGoal | null;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ title: editItem?.title ?? "", description: editItem?.description ?? "", ownerName: editItem?.ownerName ?? "", department: editItem?.department ?? "", status: editItem?.status ?? "draft" as string, progress: editItem?.progress ?? 0, startDate: editItem?.startDate ?? "", endDate: editItem?.endDate ?? "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<PerformanceGoal>;
      if (editItem) await performanceApi.goals.update(editItem.id, payload);
      else await performanceApi.goals.create(payload);
    },
    onSuccess: () => {       qc.invalidateQueries({ queryKey: ["performance-goals"] }); qc.invalidateQueries({ queryKey: ["perf-dashboard"] }); toast({ title: editItem ? "Goal updated" : "Goal created" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to save goal", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Goal" : "New Goal / OKR"}</DialogTitle>
          <DialogDescription>Define or update a performance goal or OKR.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Owner</Label><Input value={form.ownerName} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} /></div>
            <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="on-track">On Track</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                  <SelectItem value="behind">Behind</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Progress %</Label><Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm(p => ({ ...p, progress: Number(e.target.value) }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
            <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── KPI Dialog ──────────────────────────────────────────────────────────────

function KpiDialog({ open, onOpenChange, editItem }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem?: KpiTarget | null;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ name: editItem?.name ?? "", category: editItem?.category ?? "", currentValue: editItem?.currentValue ?? 0, targetValue: editItem?.targetValue ?? 100, unit: editItem?.unit ?? "%", owner: editItem?.owner ?? "", frequency: editItem?.frequency ?? "monthly" as string });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<KpiTarget>;
      if (editItem) await performanceApi.kpiTargets.update(editItem.id, payload);
      else await performanceApi.kpiTargets.create(payload);
    },
    onSuccess: () => {       qc.invalidateQueries({ queryKey: ["perf-kpis"] }); toast({ title: editItem ? "KPI updated" : "KPI created" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to save KPI", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit KPI Target" : "New KPI Target"}</DialogTitle>
          <DialogDescription>Track a key performance indicator.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Current Value</Label><Input type="number" value={form.currentValue} onChange={e => setForm(p => ({ ...p, currentValue: Number(e.target.value) }))} /></div>
            <div><Label>Target Value</Label><Input type="number" value={form.targetValue} onChange={e => setForm(p => ({ ...p, targetValue: Number(e.target.value) }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Owner</Label><Input value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))} /></div>
            <div><Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Feedback Dialog ─────────────────────────────────────────────────────────

function FeedbackDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ fromName: "", toName: "", message: "", category: "kudos" as string });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<Feedback360>;
      return performanceApi.feedback.create(payload);
    },
    onSuccess: () => {       qc.invalidateQueries({ queryKey: ["perf-feedback"] }); toast({ title: "Feedback sent!" }); onOpenChange(false); setForm({ fromName: "", toName: "", message: "", category: "kudos" }); },
    onError: () => toast({ title: "Failed to send feedback", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>Recognize a teammate or share constructive feedback.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From</Label><Input value={form.fromName} onChange={e => setForm(p => ({ ...p, fromName: e.target.value }))} /></div>
            <div><Label>To</Label><Input value={form.toName} onChange={e => setForm(p => ({ ...p, toName: e.target.value }))} /></div>
          </div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kudos">Kudos</SelectItem>
                <SelectItem value="innovation">Innovation</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
                <SelectItem value="teamwork">Teamwork</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Message</Label><Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Sending..." : "Send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Continuous Feedback Dialog ──────────────────────────────────────────────

function ContinuousFeedbackDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ fromName: "", toName: "", message: "", type: "praise" as string, context: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<ContinuousFeedback>;
      return performanceApi.continuousFeedback.create(payload);
    },
    onSuccess: () => {       qc.invalidateQueries({ queryKey: ["perf-continuous-feedback"] }); toast({ title: "Feedback submitted" }); onOpenChange(false); setForm({ fromName: "", toName: "", message: "", type: "praise", context: "" }); },
    onError: () => toast({ title: "Failed to submit feedback", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Continuous Feedback</DialogTitle>
          <DialogDescription>Share real-time praise or constructive input.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From</Label><Input value={form.fromName} onChange={e => setForm(p => ({ ...p, fromName: e.target.value }))} /></div>
            <div><Label>To</Label><Input value={form.toName} onChange={e => setForm(p => ({ ...p, toName: e.target.value }))} /></div>
          </div>
          <div><Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="praise">Praise</SelectItem>
                <SelectItem value="constructive">Constructive</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="one-on-one">One-on-One</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Context</Label><Input value={form.context} onChange={e => setForm(p => ({ ...p, context: e.target.value }))} /></div>
          <div><Label>Message</Label><Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Sending..." : "Send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Peer Review Dialog ──────────────────────────────────────────────────────

function PeerReviewDialog({ open, onOpenChange, editItem }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem?: PeerReview | null;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({
    revieweeName: editItem?.revieweeName ?? "",
    reviewerName: editItem?.reviewerName ?? "",
    project: editItem?.project ?? "",
    collaboration: editItem?.collaboration ?? 3,
    communication: editItem?.communication ?? 3,
    technicalSkills: editItem?.technicalSkills ?? 3,
    reliability: editItem?.reliability ?? 3,
    strengths: editItem?.strengths ?? "",
    improvements: editItem?.improvements ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (editItem) await performanceApi.peerReviews.update(editItem.id, form);
      else await performanceApi.peerReviews.create(form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["perf-peer-reviews"] }); toast({ title: editItem ? "Review updated" : "Peer review submitted" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to save review", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Peer Review" : "New Peer Review"}</DialogTitle>
          <DialogDescription>Evaluate a colleague&apos;s performance on a project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Reviewee</Label><Input value={form.revieweeName} onChange={e => setForm(p => ({ ...p, revieweeName: e.target.value }))} /></div>
            <div><Label>Reviewer</Label><Input value={form.reviewerName} onChange={e => setForm(p => ({ ...p, reviewerName: e.target.value }))} /></div>
          </div>
          <div><Label>Project</Label><Input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            {(["collaboration", "communication", "technicalSkills", "reliability"] as const).map((field) => (
              <div key={field}>
                <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input type="number" min="1" max="5" value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <div><Label>Strengths</Label><Textarea value={form.strengths} onChange={e => setForm(p => ({ ...p, strengths: e.target.value }))} /></div>
          <div><Label>Areas for Improvement</Label><Textarea value={form.improvements} onChange={e => setForm(p => ({ ...p, improvements: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Promotion Readiness Dialog ──────────────────────────────────────────────

function PromotionDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ employeeName: "", currentRole: "", targetRole: "", readinessScore: 0, recommendations: "", overallRating: "not-ready" as string });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<PromotionReadiness>;
      return performanceApi.promotionReadiness.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["perf-promotion"] }); toast({ title: "Promotion readiness assessed" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to assess", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promotion Readiness Assessment</DialogTitle>
          <DialogDescription>Evaluate an employee&apos;s readiness for promotion.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Employee Name</Label><Input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Current Role</Label><Input value={form.currentRole} onChange={e => setForm(p => ({ ...p, currentRole: e.target.value }))} /></div>
            <div><Label>Target Role</Label><Input value={form.targetRole} onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))} /></div>
          </div>
          <div><Label>Readiness Score (0-100)</Label><Input type="number" min="0" max="100" value={form.readinessScore} onChange={e => setForm(p => ({ ...p, readinessScore: Number(e.target.value) }))} /></div>
          <div><Label>Overall Rating</Label>
            <Select value={form.overallRating} onValueChange={v => setForm(p => ({ ...p, overallRating: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ready-now">Ready Now</SelectItem>
                <SelectItem value="ready-in-6-months">Ready in 6 Months</SelectItem>
                <SelectItem value="ready-in-1-year">Ready in 1 Year</SelectItem>
                <SelectItem value="not-ready">Not Ready</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Recommendations</Label><Textarea value={form.recommendations} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── HiPo Dialog ─────────────────────────────────────────────────────────────

function HiPoDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ employeeName: "", department: "", currentRole: "", nominatedBy: "", program: "", reasoning: "" });

  const mutation = useMutation({
    mutationFn: async () => performanceApi.hiPo.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["perf-hipo"] }); toast({ title: "HiPo employee identified" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to identify", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Identify High-Potential Employee</DialogTitle>
          <DialogDescription>Nominate an employee for HiPo tracking.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Employee Name</Label><Input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} /></div>
            <div><Label>Current Role</Label><Input value={form.currentRole} onChange={e => setForm(p => ({ ...p, currentRole: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nominated By</Label><Input value={form.nominatedBy} onChange={e => setForm(p => ({ ...p, nominatedBy: e.target.value }))} /></div>
            <div><Label>Program</Label><Input value={form.program} onChange={e => setForm(p => ({ ...p, program: e.target.value }))} /></div>
          </div>
          <div><Label>Reasoning</Label><Textarea value={form.reasoning} onChange={e => setForm(p => ({ ...p, reasoning: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Coaching Dialog ─────────────────────────────────────────────────────────

function CoachingDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ employeeName: "", focusArea: "", recommendation: "", suggestedApproach: "", priority: "medium" as string });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<CoachingRecommendation>;
      return performanceApi.coachingRecommendations.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["perf-coaching"] }); toast({ title: "Coaching recommendation added" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coaching Recommendation</DialogTitle>
          <DialogDescription>Recommend coaching for an employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Employee Name</Label><Input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} /></div>
          <div><Label>Focus Area</Label><Input value={form.focusArea} onChange={e => setForm(p => ({ ...p, focusArea: e.target.value }))} /></div>
          <div><Label>Recommendation</Label><Textarea value={form.recommendation} onChange={e => setForm(p => ({ ...p, recommendation: e.target.value }))} /></div>
          <div><Label>Suggested Approach</Label><Textarea value={form.suggestedApproach} onChange={e => setForm(p => ({ ...p, suggestedApproach: e.target.value }))} /></div>
          <div><Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Development Plan Dialog ─────────────────────────────────────────────────

function DevPlanDialog({ open, onOpenChange, editItem }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem?: DevelopmentPlan | null;
}) {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const [form, setForm] = useState({ employeeName: editItem?.employeeName ?? "", title: editItem?.title ?? "", status: editItem?.status ?? "draft" as string, startDate: editItem?.startDate ?? "", endDate: editItem?.endDate ?? "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = form as unknown as Partial<DevelopmentPlan>;
      if (editItem) await performanceApi.developmentPlans.update(editItem.id, payload);
      else await performanceApi.developmentPlans.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["perf-dev-plans"] }); toast({ title: editItem ? "Plan updated" : "Development plan created" }); onOpenChange(false); },
    onError: () => toast({ title: "Failed to save plan", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Development Plan" : "New Development Plan"}</DialogTitle>
          <DialogDescription>Create a development plan for an employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Employee Name</Label><Input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} /></div>
          <div><Label>Plan Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Progress %</Label><Input type="number" min="0" max="100" value={editItem?.progress ?? 0} disabled /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
            <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ loading }: { loading: boolean }) {
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["perf-dashboard"],
    queryFn: async () => {
      const { data } = await performanceApi.dashboard();
      return data as { activeGoals: number; pendingReviews: number; feedbackGiven: number; successionReady: number } ?? {};
    },
    staleTime: 30000, enabled: !loading,
  });

  const { data: goals } = useQuery({
    queryKey: ["performance-goals"],
    queryFn: async () => { const { data } = await performanceApi.goals.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceGoal[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: reviews } = useQuery({
    queryKey: ["performance-reviews"],
    queryFn: async () => { const { data } = await performanceApi.reviews.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceReview[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: kpis } = useQuery({
    queryKey: ["perf-kpis"],
    queryFn: async () => { const { data } = await performanceApi.kpiTargets.list(); return (Array.isArray(data) ? data : data?.items ?? []) as KpiTarget[]; },
    staleTime: 30000, enabled: !loading,
  });

  const statsCards = [
    { label: "Active Goals", value: dashData?.activeGoals ?? goals?.filter(g => g.status !== "completed").length ?? 0, icon: Target, color: "text-blue-600 bg-blue-500/10" },
    { label: "Pending Reviews", value: dashData?.pendingReviews ?? reviews?.filter(r => r.status === "pending").length ?? 0, icon: FileCheck, color: "text-amber-600 bg-amber-500/10" },
    { label: "Feedback Given", value: dashData?.feedbackGiven ?? 0, icon: MessageSquare, color: "text-purple-600 bg-purple-500/10" },
    { label: "Succession Ready", value: dashData?.successionReady ?? 0, icon: UserCheck, color: "text-emerald-600 bg-emerald-500/10" },
  ];

  const goalStatusData = [
    { name: "On Track", value: goals?.filter(g => g.status === "on-track").length ?? 0, color: "#22c55e" },
    { name: "At Risk", value: goals?.filter(g => g.status === "at-risk").length ?? 0, color: "#f97316" },
    { name: "Behind", value: goals?.filter(g => g.status === "behind").length ?? 0, color: "#ef4444" },
    { name: "Completed", value: goals?.filter(g => g.status === "completed").length ?? 0, color: "#3b82f6" },
  ];

  const kpiChartData = kpis?.slice(0, 8).map(k => ({ name: k.name.length > 12 ? k.name.slice(0, 12) + "..." : k.name, current: k.currentValue, target: k.targetValue })) ?? [];

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card className="glass-panel">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className={`rounded-lg p-2.5 ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    {dashLoading ? <Skeleton className="mt-1 h-7 w-16" /> : <p className="text-2xl font-bold">{stat.value}</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={PieChart as unknown as React.ComponentType<{ className?: string }>} title="Goal Status Distribution" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={goalStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {goalStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={BarChart3} title="KPI Tracking" description="Current vs target" />
            </CardHeader>
            <CardContent>
              {kpiChartData.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8" />
                  <p className="text-sm">No KPIs set up yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={kpiChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="current" fill="#6366f1" name="Current" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="target" fill="#22c55e" name="Target" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Tab: OKRs & Goals ───────────────────────────────────────────────────────

function OkrTab({ loading }: { loading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<PerformanceGoal | null>(null);

  const { data: goals, isLoading } = useQuery({
    queryKey: ["performance-goals"],
    queryFn: async () => { const { data } = await performanceApi.goals.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceGoal[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: kpis } = useQuery({
    queryKey: ["perf-kpis"],
    queryFn: async () => { const { data } = await performanceApi.kpiTargets.list(); return (Array.isArray(data) ? data : data?.items ?? []) as KpiTarget[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} editItem={editItem} />
      <KpiDialog open={false} onOpenChange={() => {}} />

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Target} title="OKRs & Goals" description="Track progress across the organization"
                action={<Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-3 w-3" /> New Goal</Button>}
              />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : !goals || goals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Target className="h-8 w-8" />
                  <p className="text-sm">No goals created yet</p>
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Create your first goal</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div key={goal.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{goal.title}</span>
                            <SeverityBadge severity={goal.status} />
                            <span className="text-xs text-muted-foreground">{goal.category}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{goal.ownerName} &middot; {goal.department}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-bold tabular-nums", scoreColor(goal.progress))}>{goal.progress}%</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6" onClick={() => { setEditItem(goal); setDialogOpen(true); }}><Settings className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <Progress value={goal.progress} className={scoreBg(goal.progress)} />
                      {goal.keyResults && goal.keyResults.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {goal.keyResults.map((kr, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{kr.title}</span>
                              <span>{kr.current} / {kr.target}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={BarChart3} title="KPI Targets" description="Key performance indicators"
                action={<KpiDialogTrigger><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3 w-3" /> Add KPI</Button></KpiDialogTrigger>}
              />
            </CardHeader>
            <CardContent>
              {!kpis || kpis.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8" />
                  <p className="text-sm">No KPI targets defined</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kpis.map((kpi) => {
                    const pct = Math.min(Math.round((kpi.currentValue / kpi.targetValue) * 100), 100);
                    return (
                      <div key={kpi.id} className="rounded-lg border bg-card/50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{kpi.name}</span>
                          <SeverityBadge severity={pct >= 80 ? "HIGH" : pct >= 50 ? "MEDIUM" : "LOW"} />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{kpi.category} &middot; {kpi.owner} &middot; {kpi.frequency}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Progress value={pct} className={scoreBg(pct)} />
                          </div>
                          <span className={cn("text-xs font-bold tabular-nums", scoreColor(pct))}>{kpi.currentValue}/{kpi.targetValue} {kpi.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Award} title="Goal Alignment" description="How goals align with company objectives" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["Company OKRs", "Department Goals", "Team Objectives", "Individual Goals"].map((level, i) => (
                  <div key={level} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <span className="text-sm font-medium">{level}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Helper for KPI dialog trigger - wraps a button to open the KPI dialog
function KpiDialogTrigger({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <KpiDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// ── Tab: Reviews ────────────────────────────────────────────────────────────

function ReviewsTab({ loading }: { loading: boolean }) {
  const [peerDialogOpen, setPeerDialogOpen] = useState(false);
  const [peerEditItem, setPeerEditItem] = useState<PeerReview | null>(null);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["performance-reviews"],
    queryFn: async () => { const { data } = await performanceApi.reviews.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceReview[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: managerReviews } = useQuery({
    queryKey: ["perf-manager-reviews"],
    queryFn: async () => { const { data } = await performanceApi.managerReviews.list(); return (Array.isArray(data) ? data : data?.items ?? []) as ManagerReview[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: peerReviews } = useQuery({
    queryKey: ["perf-peer-reviews"],
    queryFn: async () => { const { data } = await performanceApi.peerReviews.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PeerReview[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <PeerReviewDialog open={peerDialogOpen} onOpenChange={setPeerDialogOpen} editItem={peerEditItem} />

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={FileCheck} title="360° Reviews" description="Quarterly, annual, and probation reviews" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 lg:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
            ) : !reviews || reviews.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <FileCheck className="h-8 w-8" />
                <p className="text-sm">No reviews found</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{review.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{review.type} &middot; {review.period}</p>
                      </div>
                      <SeverityBadge severity={review.status} />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-lg font-bold">{review.overallScore.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/ 5</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Reviewer: {review.reviewerName}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.ratings.slice(0, 3).map((r, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{r.category}: {r.score}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Users} title="Manager Reviews" description="Direct manager evaluations" />
            </CardHeader>
            <CardContent>
              {!managerReviews || managerReviews.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Users className="h-8 w-8" />
                  <p className="text-sm">No manager reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {managerReviews.map((mr) => (
                    <div key={mr.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{mr.employeeName}</span>
                        <SeverityBadge severity={mr.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Manager: {mr.managerName} &middot; {mr.period}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{mr.overallScore.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/ 5</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Users} title="Peer Reviews" description="Cross-functional peer evaluations"
                action={<Button size="sm" variant="outline" className="gap-1" onClick={() => { setPeerEditItem(null); setPeerDialogOpen(true); }}><Plus className="h-3 w-3" /> New Review</Button>}
              />
            </CardHeader>
            <CardContent>
              {!peerReviews || peerReviews.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Users className="h-8 w-8" />
                  <p className="text-sm">No peer reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {peerReviews.map((pr) => (
                    <div key={pr.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{pr.revieweeName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{pr.overallScore.toFixed(1)}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6" onClick={() => { setPeerEditItem(pr); setPeerDialogOpen(true); }}><Settings className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Reviewer: {pr.reviewerName} &middot; {pr.project}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">Collaboration: {pr.collaboration}</Badge>
                        <Badge variant="outline" className="text-[10px]">Communication: {pr.communication}</Badge>
                        <Badge variant="outline" className="text-[10px]">Technical: {pr.technicalSkills}</Badge>
                        <Badge variant="outline" className="text-[10px]">Reliability: {pr.reliability}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Tab: Feedback ───────────────────────────────────────────────────────────

function FeedbackTab({ loading }: { loading: boolean }) {
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [cfDialogOpen, setCfDialogOpen] = useState(false);

  const { data: feedback, isLoading } = useQuery({
    queryKey: ["perf-feedback"],
    queryFn: async () => { const { data } = await performanceApi.feedback.list(); return (Array.isArray(data) ? data : data?.items ?? []) as Feedback360[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: continuousFb } = useQuery({
    queryKey: ["perf-continuous-feedback"],
    queryFn: async () => { const { data } = await performanceApi.continuousFeedback.list(); return (Array.isArray(data) ? data : data?.items ?? []) as ContinuousFeedback[]; },
    staleTime: 30000, enabled: !loading,
  });

  const feedbackCategoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    kudos: ThumbsUp, innovation: Lightbulb, leadership: Star, teamwork: Users, customer: MessageSquare,
  };

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <FeedbackDialog open={fbDialogOpen} onOpenChange={setFbDialogOpen} />
      <ContinuousFeedbackDialog open={cfDialogOpen} onOpenChange={setCfDialogOpen} />

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setFbDialogOpen(true)}><Plus className="h-3 w-3" /> Send Recognition</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setCfDialogOpen(true)}><MessageSquare className="h-3 w-3" /> Continuous Feedback</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={ThumbsUp} title="Recognition Wall" description="Kudos and shoutouts from the team" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : !feedback || feedback.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <ThumbsUp className="h-8 w-8" />
                  <p className="text-sm">No feedback yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedback.map((fb) => {
                    const CatIcon = feedbackCategoryIcons[fb.category] ?? MessageSquare;
                    return (
                      <div key={fb.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-xs font-medium text-primary">{fb.fromName.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{fb.fromName}</p>
                              <p className="text-xs text-muted-foreground">to {fb.toName}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                            <CatIcon className="h-3 w-3" /> {fb.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{fb.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={MessageSquare} title="Continuous Feedback" description="Real-time praise and constructive input" />
            </CardHeader>
            <CardContent>
              {!continuousFb || continuousFb.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8" />
                  <p className="text-sm">No continuous feedback yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {continuousFb.map((cf) => (
                    <div key={cf.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium">{cf.fromName} <span className="text-muted-foreground">→</span> {cf.toName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <SeverityBadge severity={cf.type} />
                            {cf.isAcknowledged && <Badge variant="success" className="text-[10px]">Acknowledged</Badge>}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{cf.message}</p>
                      {cf.context && <p className="text-xs text-muted-foreground mt-1 italic">Context: {cf.context}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(cf.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Tab: Calibration & Talent Review ────────────────────────────────────────

function CalibrationTab({ loading }: { loading: boolean }) {
  const { data: calibrations } = useQuery({
    queryKey: ["perf-calibrations"],
    queryFn: async () => { const { data } = await performanceApi.calibrations.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PerformanceCalibration[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: talentBoards } = useQuery({
    queryKey: ["perf-talent-board"],
    queryFn: async () => { const { data } = await performanceApi.talentReviewBoard.list(); return (Array.isArray(data) ? data : data?.items ?? []) as TalentReviewBoard[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Layers} title="Performance Calibration" description="Calibrate ratings across teams" />
            </CardHeader>
            <CardContent>
              {!calibrations || calibrations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Layers className="h-8 w-8" />
                  <p className="text-sm">No calibration sessions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {calibrations.map((cal) => (
                    <div key={cal.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{cal.name}</span>
                        <SeverityBadge severity={cal.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{cal.period} &middot; {cal.participants.length} participants</p>
                      <div className="space-y-1.5">
                        {cal.participants.slice(0, 4).map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span>{p.employeeName}</span>
                            <div className="flex items-center gap-2">
                              <span>Rating: {p.rating}</span>
                              {p.calibratedRating && <span className="text-primary">→ {p.calibratedRating}</span>}
                            </div>
                          </div>
                        ))}
                        {cal.participants.length > 4 && <p className="text-xs text-muted-foreground">+{cal.participants.length - 4} more</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Award} title="Talent Review Board" description="9-box grid and talent decisions" />
            </CardHeader>
            <CardContent>
              {!talentBoards || talentBoards.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Award className="h-8 w-8" />
                  <p className="text-sm">No talent reviews scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {talentBoards.map((tb) => (
                    <div key={tb.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{tb.name}</span>
                        <SeverityBadge severity={tb.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{new Date(tb.date).toLocaleDateString()} &middot; {tb.employees.length} employees</p>
                      <div className="grid grid-cols-5 gap-1">
                        {(["star", "high-potential", "core", "question-mark", "underperformer"] as const).map((box) => {
                          const count = tb.employees.filter(e => e.box === box).length;
                          const boxColors: Record<string, string> = {
                            star: "bg-emerald-500/20 text-emerald-600 border-emerald-300",
                            "high-potential": "bg-blue-500/20 text-blue-600 border-blue-300",
                            core: "bg-amber-500/20 text-amber-600 border-amber-300",
                            "question-mark": "bg-purple-500/20 text-purple-600 border-purple-300",
                            underperformer: "bg-rose-500/20 text-rose-600 border-rose-300",
                          };
                          return (
                            <div key={box} className={`rounded border p-1.5 text-center ${boxColors[box] ?? ""}`}>
                              <p className="text-[10px] font-medium capitalize">{box.replace("-", "\n")}</p>
                              <p className="text-sm font-bold">{count}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Tab: Promotion & Readiness ──────────────────────────────────────────────

function PromotionTab({ loading }: { loading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: promotions } = useQuery({
    queryKey: ["perf-promotion"],
    queryFn: async () => { const { data } = await performanceApi.promotionReadiness.list(); return (Array.isArray(data) ? data : data?.items ?? []) as PromotionReadiness[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: leadership } = useQuery({
    queryKey: ["perf-leadership"],
    queryFn: async () => { const { data } = await performanceApi.leadershipReadiness.list(); return (Array.isArray(data) ? data : data?.items ?? []) as LeadershipReadiness[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <PromotionDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Medal} title="Promotion Readiness" description="Assess readiness for advancement"
                action={<Button size="sm" variant="outline" className="gap-1" onClick={() => setDialogOpen(true)}><Plus className="h-3 w-3" /> Assess</Button>}
              />
            </CardHeader>
            <CardContent>
              {!promotions || promotions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Medal className="h-8 w-8" />
                  <p className="text-sm">No assessments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promotions.map((p) => (
                    <div key={p.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{p.employeeName}</span>
                        <SeverityBadge severity={p.overallRating} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{p.currentRole} → {p.targetRole}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1">
                          <Progress value={p.readinessScore} className={scoreBg(p.readinessScore)} />
                        </div>
                        <span className={cn("text-xs font-bold", scoreColor(p.readinessScore))}>{p.readinessScore}%</span>
                      </div>
                      {p.recommendations && <p className="text-xs text-muted-foreground">{p.recommendations}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={GraduationCap} title="Leadership Readiness" description="Evaluate leadership potential" />
            </CardHeader>
            <CardContent>
              {!leadership || leadership.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <GraduationCap className="h-8 w-8" />
                  <p className="text-sm">No leadership assessments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leadership.map((l) => (
                    <div key={l.id} className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{l.employeeName}</span>
                        <SeverityBadge severity={l.overallReadiness} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{l.currentRole} → {l.targetRole}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1">
                          <Progress value={l.readinessScore} className={scoreBg(l.readinessScore)} />
                        </div>
                        <span className={cn("text-xs font-bold", scoreColor(l.readinessScore))}>{l.readinessScore}%</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {l.recommendedDevelopment.slice(0, 3).map((d, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Tab: HiPo ───────────────────────────────────────────────────────────────

function HiPoTab({ loading }: { loading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: hipoEmployees } = useQuery({
    queryKey: ["perf-hipo"],
    queryFn: async () => { const { data } = await performanceApi.hiPo.list(); return (Array.isArray(data) ? data : data?.items ?? []) as HiPoEmployee[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <HiPoDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={Zap} title="High-Potential Employees" description="Track and develop future leaders"
              action={<Button size="sm" variant="outline" className="gap-1" onClick={() => setDialogOpen(true)}><Plus className="h-3 w-3" /> Identify HiPo</Button>}
            />
          </CardHeader>
          <CardContent>
            {!hipoEmployees || hipoEmployees.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Zap className="h-8 w-8" />
                <p className="text-sm">No high-potential employees identified</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hipoEmployees.map((hipo) => {
                  const avgScore = Math.round((hipo.performanceScore + hipo.potentialScore) / 2);
                  return (
                    <div key={hipo.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{hipo.employeeName}</span>
                        <SeverityBadge severity={hipo.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{hipo.currentRole} &middot; {hipo.department}</p>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Performance</span>
                            <span className={scoreColor(hipo.performanceScore)}>{hipo.performanceScore}%</span>
                          </div>
                          <Progress value={hipo.performanceScore} className={scoreBg(hipo.performanceScore)} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Potential</span>
                            <span className={scoreColor(hipo.potentialScore)}>{hipo.potentialScore}%</span>
                          </div>
                          <Progress value={hipo.potentialScore} className={scoreBg(hipo.potentialScore)} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {hipo.reason.slice(0, 2).map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Nominated by {hipo.nominatedBy}</span>
                        {hipo.mentorName && <span>Mentor: {hipo.mentorName}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ── Tab: AI Insights ────────────────────────────────────────────────────────

function AiInsightsTab({ loading }: { loading: boolean }) {
  const { data: insights } = useQuery({
    queryKey: ["perf-ai-insights"],
    queryFn: async () => { const { data } = await performanceApi.aiInsights.list(); return (Array.isArray(data) ? data : data?.items ?? []) as AiPerformanceInsight[]; },
    staleTime: 30000, enabled: !loading,
  });

  const { data: coaching } = useQuery({
    queryKey: ["perf-coaching"],
    queryFn: async () => { const { data } = await performanceApi.coachingRecommendations.list(); return (Array.isArray(data) ? data : data?.items ?? []) as CoachingRecommendation[]; },
    staleTime: 30000, enabled: !loading,
  });

  const insightIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    strength: TrendingUp, "growth-area": TrendingDown, pattern: Activity, prediction: Sparkles, anomaly: AlertTriangle,
  };

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Brain} title="AI Performance Insights" description="AI-powered analysis and predictions"
                action={<Button size="sm" variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Generate Insights</Button>}
              />
            </CardHeader>
            <CardContent>
              {!insights || insights.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Brain className="h-8 w-8" />
                  <p className="text-sm">No AI insights available yet</p>
                  <Button variant="outline" size="sm" className="gap-1"><Sparkles className="h-4 w-4" /> Generate from Data</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.map((insight) => {
                    const Icon = insightIcons[insight.insightType] ?? Lightbulb;
                    return (
                      <div key={insight.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{insight.title}</p>
                              <p className="text-xs text-muted-foreground">{insight.employeeName} &middot; {insight.category}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{(insight.confidence * 100).toFixed(0)}% confidence</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                        <div className="mt-2 rounded bg-muted/30 p-2">
                          <p className="text-xs font-medium">Recommendation:</p>
                          <p className="text-xs text-muted-foreground">{insight.recommendation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <SectionHeader icon={Lightbulb} title="Coaching Recommendations" description="Personalized coaching suggestions" />
            </CardHeader>
            <CardContent className="space-y-3">
              {!coaching || coaching.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Lightbulb className="h-8 w-8" />
                  <p className="text-sm">No coaching recommendations yet</p>
                </div>
              ) : (
                coaching.map((c) => (
                  <div key={c.id} className="rounded-lg border bg-card/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{c.employeeName}</span>
                      <SeverityBadge severity={c.priority} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{c.focusArea}</p>
                    <p className="text-xs mb-2">{c.recommendation}</p>
                    <div className="flex flex-wrap gap-1">
                      {c.resources.slice(0, 3).map((r, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{r.type}: {r.title}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Tab: Development Plans ──────────────────────────────────────────────────

function DevPlansTab({ loading }: { loading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<DevelopmentPlan | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["perf-dev-plans"],
    queryFn: async () => { const { data } = await performanceApi.developmentPlans.list(); return (Array.isArray(data) ? data : data?.items ?? []) as DevelopmentPlan[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <DevPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} editItem={editItem} />

      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={BookOpen} title="Development Plans" description="Personalized growth and career plans"
              action={<Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-3 w-3" /> New Plan</Button>}
            />
          </CardHeader>
          <CardContent>
            {!plans || plans.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8" />
                <p className="text-sm">No development plans created yet</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{plan.title}</p>
                        <p className="text-xs text-muted-foreground">{plan.employeeName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={plan.status} />
                        <Button variant="ghost" size="sm" className="h-6 w-6" onClick={() => { setEditItem(plan); setDialogOpen(true); }}><Settings className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1">
                        <Progress value={plan.progress} className={scoreBg(plan.progress)} />
                      </div>
                      <span className={cn("text-xs font-bold", scoreColor(plan.progress))}>{plan.progress}%</span>
                    </div>
                    <div className="space-y-1.5">
                      {plan.goals.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span>{g.title}</span>
                          <SeverityBadge severity={g.status} />
                        </div>
                      ))}
                    </div>
                    {plan.skills && plan.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {plan.skills.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ── Tab: Succession ─────────────────────────────────────────────────────────

function SuccessionTab({ loading }: { loading: boolean }) {
  const { data: succession } = useQuery({
    queryKey: ["performance-succession"],
    queryFn: async () => { const { data } = await performanceApi.succession.list(); return (Array.isArray(data) ? data : data?.items ?? []) as SuccessionPlan[]; },
    staleTime: 30000, enabled: !loading,
  });

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <SectionHeader icon={UserCheck} title="Succession Planning" description="Pipeline for key positions" />
          </CardHeader>
          <CardContent>
            {!succession || succession.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <UserCheck className="h-8 w-8" />
                <p className="text-sm">No succession plans defined</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {succession.map((plan) => {
                  const readyNow = plan.candidates.filter(c => c.readiness === "ready-now").length;
                  return (
                    <div key={plan.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{plan.position}</p>
                          <p className="text-xs text-muted-foreground">{plan.department}</p>
                        </div>
                        <SeverityBadge severity={plan.riskLevel === "high" ? "CRITICAL" : plan.riskLevel === "medium" ? "MEDIUM" : "LOW"} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Current: {plan.currentHolder}</p>
                      <div className="space-y-2">
                        {plan.candidates.map((c, i) => (
                          <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                            <span className="text-sm">{c.employeeName}</span>
                            <SeverityBadge severity={c.readiness} />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <UserCheck className="h-3 w-3" />
                        {readyNow} ready now &middot; Last reviewed {new Date(plan.lastReviewed).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "overview";
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const valid = ["overview", "okrs", "reviews", "feedback", "calibration", "promotion", "hipo", "ai", "devplans", "succession"];
    return tabParam && valid.includes(tabParam) ? tabParam : "overview";
  });
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Management</h1>
          <p className="text-muted-foreground">Module 8 — OKRs, KPIs, reviews, calibration, talent, and development</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setLoading(!loading)}>
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="okrs">OKRs & KPIs</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
          <TabsTrigger value="promotion">Promotion</TabsTrigger>
          <TabsTrigger value="hipo">HiPo</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
          <TabsTrigger value="devplans">Dev Plans</TabsTrigger>
          <TabsTrigger value="succession">Succession</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab loading={loading} />
        </TabsContent>
        <TabsContent value="okrs">
          <OkrTab loading={loading} />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTab loading={loading} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab loading={loading} />
        </TabsContent>
        <TabsContent value="calibration">
          <CalibrationTab loading={loading} />
        </TabsContent>
        <TabsContent value="promotion">
          <PromotionTab loading={loading} />
        </TabsContent>
        <TabsContent value="hipo">
          <HiPoTab loading={loading} />
        </TabsContent>
        <TabsContent value="ai">
          <AiInsightsTab loading={loading} />
        </TabsContent>
        <TabsContent value="devplans">
          <DevPlansTab loading={loading} />
        </TabsContent>
        <TabsContent value="succession">
          <SuccessionTab loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}