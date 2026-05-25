export type UserRole = "admin" | "hr" | "manager" | "employee";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  position?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  refreshToken?: string;
  user: User;
}

export interface Employee {
  _id?: string;
  id?: number;
  name: string;
  department: string;
  position: string;
  email: string;
}

export interface PaginatedEmployees {
  items: Employee[];
  total: number;
  page: number;
  pageSize?: number;
  page_size?: number;
  totalPages?: number;
  total_pages?: number;
}

export interface KpiMetric {
  label: string;
  value: number;
  change: number;
  trend: "up" | "down" | "neutral";
}

export interface AttendanceRecord {
  id: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "present" | "late" | "absent" | "remote";
  hours: number;
}

export interface LeaveRequest {
  id: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
  days: number;
}

export interface PayrollSummary {
  id: string;
  period: string;
  totalAmount: number;
  employeeCount: number;
  status: "draft" | "processing" | "completed";
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type JobType = "full-time" | "part-time" | "contract" | "internship" | "temporary";
export type JobStatus = "draft" | "open" | "closed" | "on-hold";
export type CandidateStatus = "active" | "passive" | "hired" | "rejected";
export type ApplicationStatus =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";
export type InterviewStatus = "scheduled" | "completed" | "cancelled";
export type OfferStatus = "draft" | "sent" | "accepted" | "declined";

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: JobType;
  status: JobStatus;
  description: string;
  requirements: string;
  salaryMin: number;
  salaryMax: number;
  applicationsCount: number;
  postedDate: string;
  closingDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentCompany: string;
  currentPosition: string;
  skills: string[];
  status: CandidateStatus;
  source: string;
  appliedDate: string;
  resumeUrl: string;
  experience: Experience[];
  education: Education[];
  createdAt: string;
  updatedAt: string;
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  appliedDate: string;
  notes: string;
  job?: Job;
  candidate?: Candidate;
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  type: string;
  scheduledDate: string;
  duration: number;
  location: string;
  meetingLink: string;
  status: InterviewStatus;
  feedback: string;
  rating: number;
  job?: Job;
  candidate?: Candidate;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  status: OfferStatus;
  salaryOffered: number;
  startDate: string;
  expiresAt: string;
  notes: string;
  job?: Job;
  candidate?: Candidate;
  createdAt: string;
  updatedAt: string;
}

export interface AtsDashboardStats {
  openPositions: number;
  totalCandidates: number;
  interviewsToday: number;
  offersPending: number;
  candidatesByStage: { stage: string; count: number }[];
}

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published" | "archived";
export type EnrollmentStatus = "active" | "completed" | "dropped";
export type CertStatus = "active" | "expired" | "revoked";

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  duration: string;
  instructor: string;
  status: CourseStatus;
  thumbnail?: string;
  prerequisites?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  employeeId: string;
  employeeName?: string;
  courseId: string;
  courseTitle?: string;
  progress: number;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt?: string;
  dueDate?: string;
  grade?: number;
}

export interface Certification {
  id: string;
  name: string;
  employeeId: string;
  employeeName?: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  credentialUrl?: string;
  status: CertStatus;
  verified: boolean;
}

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  passingScore: number;
  maxScore: number;
  questions?: AssessmentQuestion[];
  attempts?: AssessmentAttempt[];
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  employeeId: string;
  employeeName?: string;
  score: number;
  passed: boolean;
  attemptedAt: string;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  courses: string[];
  duration?: string;
  status: "active" | "inactive";
}

export interface SkillRating {
  skill: string;
  level: number;
  category: string;
  lastAssessed: string;
}

export interface SkillMatrix {
  employeeId: string;
  employeeName: string;
  role: string;
  skills: SkillRating[];
}

export interface SkillGap {
  role: string;
  skill: string;
  requiredLevel: number;
  employeeLevel: number;
  gap: number;
}

export interface LmsDashboardStats {
  totalCourses: number;
  activeEnrollments: number;
  completionRate: number;
  totalCertifications: number;
  expiringCertifications: number;
}

export type GoalStatus = "on-track" | "at-risk" | "behind" | "completed" | "draft";
export type ReviewStatus = "pending" | "in-progress" | "completed" | "cancelled";
export type FeedbackVisibility = "public" | "private" | "anonymous";
export type SuccessionStatus = "ready-now" | "ready-in-1-2" | "ready-in-3-5" | "not-ready";

export interface PerformanceGoal {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  department: string;
  category: string;
  keyResults: { title: string; current: number; target: number }[];
  progress: number;
  status: GoalStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerId: string;
  reviewerName: string;
  period: string;
  type: "quarterly" | "annual" | "probation" | "peer";
  ratings: { category: string; score: number; comment?: string }[];
  overallScore: number;
  summary: string;
  status: ReviewStatus;
  dueDate: string;
  completedAt?: string;
  createdAt: string;
}

export interface Feedback360 {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar?: string;
  toId: string;
  toName: string;
  message: string;
  category: "kudos" | "innovation" | "leadership" | "teamwork" | "customer";
  visibility: FeedbackVisibility;
  createdAt: string;
}

export interface SuccessionPlan {
  id: string;
  position: string;
  department: string;
  currentHolder: string;
  candidates: { employeeId: string; employeeName: string; readiness: SuccessionStatus; notes?: string }[];
  riskLevel: "low" | "medium" | "high";
  lastReviewed: string;
}

export type ComplianceStatus = "compliant" | "non-compliant" | "at-risk";

export interface CompliancePolicy {
  id: string;
  name: string;
  description: string;
  framework: "SOC2" | "GDPR" | "ISO27001" | "HIPAA" | "PCI-DSS" | "internal";
  status: ComplianceStatus;
  lastReviewed: string;
  nextReview: string;
  owner: string;
  version: string;
}

export interface ComplianceViolation {
  id: string;
  policyId: string;
  policyName: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedEntity: string;
  reportedBy: string;
  reportedAt: string;
  status: "open" | "investigating" | "resolved" | "mitigated";
  resolvedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: { label: string; action: string }[];
}

export interface CopilotSession {
  id: string;
  title: string;
  messages: CopilotMessage[];
  context?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommandCenterMetrics {
  totalHeadcount: number;
  payrollMtd: number;
  openPositions: number;
  trainingCompletion: number;
  satisfactionScore: number;
  orgHealth: number;
  attritionRate: number;
  avgTenure: number;
}

export interface OrgHealthMetric {
  category: string;
  score: number;
  change: number;
}

export interface DepartmentPerformance {
  department: string;
  productivity: number;
  engagement: number;
  headcount: number;
  attrition: number;
  budgetUtilization: number;
}

export interface ActivityEvent {
  id: string;
  type: "hire" | "promotion" | "departure" | "training" | "achievement" | "leave";
  actor: string;
  description: string;
  timestamp: string;
}

export interface AIInsight {
  id: string;
  type: "opportunity" | "risk" | "recommendation" | "trend";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: string;
  timestamp: string;
}
