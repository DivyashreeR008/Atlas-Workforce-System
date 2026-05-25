import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type {
  Course,
  Certification,
  Assessment,
  LearningPath,
  PerformanceGoal,
  PerformanceReview,
  Feedback360,
  SuccessionPlan,
  CompliancePolicy,
  ComplianceViolation,
} from "@/types";
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = false;
let queue: Array<(token: string | null) => void> = [];

function processQueue(token: string | null) {
  queue.forEach((cb) => cb(token));
  queue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      clearAuth();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    }

    if (refreshing) {
      return new Promise((resolve, reject) => {
        queue.push((token) => {
          if (!token) reject(error);
          else {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          }
        });
      });
    }

    original._retry = true;
    refreshing = true;

    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
        refreshToken: refresh,
      });
      setTokens(data.token, data.refreshToken);
      processQueue(data.token);
      original.headers.Authorization = `Bearer ${data.token}`;
      return api(original);
    } catch {
      processQueue(null);
      clearAuth();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    } finally {
      refreshing = false;
    }
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: {
    email: string;
    password: string;
    name: string;
    department?: string;
    position?: string;
  }) => api.post("/auth/register", data),
  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refreshToken }),
};

export const employeeApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get("/employee/employees", {
      params: {
        page: params?.page,
        page_size: params?.pageSize,
        search: params?.search,
      },
    }),
  get: (email: string) => api.get(`/employee/employees/${email}`),
  create: (employee: object) => api.post("/employee/employees", employee),
  update: (email: string, employee: object) =>
    api.put(`/employee/employees/${email}`, employee),
  delete: (email: string) =>
    api.delete(`/employee/employees/${email}`),
};

export const analyticsApi = {
  department: () => api.get("/analytics/department"),
  payroll: () => api.get("/analytics/payroll"),
  performance: () => api.get("/analytics/performance"),
  aiInsights: () => api.post("/analytics/ai-insights"),
};

export const leaveApi = {
  list: () => api.get("/leave"),
  getByEmployee: (employeeId: string) =>
    api.get(`/leave/employee/${employeeId}`),
  request: (data: {
    employeeId: string;
    startDate: string;
    endDate: string;
    leaveType: string;
    reason?: string;
  }) => api.post("/leave/request", data),
  updateStatus: (id: number, status: string) =>
    api.put(`/leave/${id}/status`, { status }),
};

export const payrollApi = {
  list: () => api.get("/payroll"),
  getByEmployee: (employeeId: string) =>
    api.get(`/payroll/employee/${employeeId}`),
  run: (data: {
    employeeId: string;
    period: string;
    baseSalary: number;
    allowances?: number;
    deductions?: number;
  }) => api.post("/payroll/run", data),
};

export const attendanceApi = {
  list: () => api.get("/attendance"),
  get: (id: string) => api.get(`/attendance/${id}`),
  getByEmployee: (employeeId: string) =>
    api.get(`/attendance/employee/${employeeId}`),
  clockIn: (employeeId: string, localDate?: string) =>
    api.post("/attendance/clock-in", { employeeId, localDate }),
  clockOut: (employeeId: string, localDate?: string) =>
    api.post("/attendance/clock-out", { employeeId, localDate }),
};

export const atsApi = {
  getJobs: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    department?: string;
    type?: string;
  }) => api.get("/ats/jobs", { params }),
  getJob: (id: string) => api.get(`/ats/jobs/${id}`),
  createJob: (data: object) => api.post("/ats/jobs", data),
  updateJob: (id: string, data: object) => api.put(`/ats/jobs/${id}`, data),
  deleteJob: (id: string) => api.delete(`/ats/jobs/${id}`),
  publishJob: (id: string) => api.post(`/ats/jobs/${id}/publish`),
  closeJob: (id: string) => api.post(`/ats/jobs/${id}/close`),

  getCandidates: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    skills?: string;
    source?: string;
  }) => api.get("/ats/candidates", { params }),
  getCandidate: (id: string) => api.get(`/ats/candidates/${id}`),
  createCandidate: (data: object) => api.post("/ats/candidates", data),
  updateCandidate: (id: string, data: object) =>
    api.put(`/ats/candidates/${id}`, data),
  deleteCandidate: (id: string) => api.delete(`/ats/candidates/${id}`),

  getApplications: (params?: {
    page?: number;
    pageSize?: number;
    jobId?: string;
    candidateId?: string;
    status?: string;
  }) => api.get("/ats/applications", { params }),
  getApplication: (id: string) => api.get(`/ats/applications/${id}`),
  submitApplication: (data: object) => api.post("/ats/applications", data),
  updateApplicationStatus: (id: string, status: string) =>
    api.put(`/ats/applications/${id}/status`, { status }),

  getInterviews: (params?: {
    page?: number;
    pageSize?: number;
    jobId?: string;
    candidateId?: string;
  }) => api.get("/ats/interviews", { params }),
  scheduleInterview: (data: object) => api.post("/ats/interviews", data),
  updateInterview: (id: string, data: object) =>
    api.put(`/ats/interviews/${id}`, data),
  submitInterviewFeedback: (id: string, data: {
    feedback: string;
    rating: number;
    status: string;
  }) => api.post(`/ats/interviews/${id}/feedback`, data),

  getOffers: (params?: {
    page?: number;
    pageSize?: number;
    jobId?: string;
    candidateId?: string;
  }) => api.get("/ats/offers", { params }),
  createOffer: (data: object) => api.post("/ats/offers", data),
  updateOffer: (id: string, data: object) =>
    api.put(`/ats/offers/${id}`, data),
  sendOffer: (id: string) => api.post(`/ats/offers/${id}/send`),
  acceptOffer: (id: string) => api.post(`/ats/offers/${id}/accept`),
  declineOffer: (id: string) => api.post(`/ats/offers/${id}/decline`),

  getAnalyticsOverview: () => api.get("/ats/analytics/overview"),
  getTimeToHire: () => api.get("/ats/analytics/time-to-hire"),
  getSourceEffectiveness: () => api.get("/ats/analytics/source-effectiveness"),
  getConversionFunnel: () => api.get("/ats/analytics/conversion-funnel"),
};

export const billingApi = {
  createCheckout: () => api.post("/billing/create-checkout-session"),
};

export const performanceApi = {
  goals: {
    list: (params?: { department?: string; ownerId?: string; status?: string }) =>
      api.get("/performance/goals", { params }),
    get: (id: string) => api.get(`/performance/goals/${id}`),
    create: (data: Partial<PerformanceGoal>) => api.post("/performance/goals", data),
    update: (id: string, data: Partial<PerformanceGoal>) => api.put(`/performance/goals/${id}`, data),
    delete: (id: string) => api.delete(`/performance/goals/${id}`),
    updateProgress: (id: string, progress: number) =>
      api.put(`/performance/goals/${id}/progress`, { progress }),
  },
  reviews: {
    list: (params?: { employeeId?: string; status?: string; type?: string }) =>
      api.get("/performance/reviews", { params }),
    get: (id: string) => api.get(`/performance/reviews/${id}`),
    create: (data: Partial<PerformanceReview>) => api.post("/performance/reviews", data),
    update: (id: string, data: Partial<PerformanceReview>) =>
      api.put(`/performance/reviews/${id}`, data),
    submit: (id: string, data: { ratings: PerformanceReview["ratings"]; summary: string }) =>
      api.post(`/performance/reviews/${id}/submit`, data),
    delete: (id: string) => api.delete(`/performance/reviews/${id}`),
  },
  feedback: {
    list: (params?: { toId?: string; fromId?: string; category?: string }) =>
      api.get("/performance/feedback", { params }),
    create: (data: Partial<Feedback360>) => api.post("/performance/feedback", data),
    delete: (id: string) => api.delete(`/performance/feedback/${id}`),
  },
  succession: {
    list: () => api.get("/performance/succession"),
    get: (id: string) => api.get(`/performance/succession/${id}`),
    create: (data: Partial<SuccessionPlan>) => api.post("/performance/succession", data),
    update: (id: string, data: Partial<SuccessionPlan>) =>
      api.put(`/performance/succession/${id}`, data),
    evaluate: (id: string) => api.post(`/performance/succession/${id}/evaluate`),
  },
  dashboard: () => api.get("/performance/dashboard"),
};

export const complianceApi = {
  policies: {
    list: (params?: { framework?: string; status?: string }) =>
      api.get("/compliance/policies", { params }),
    get: (id: string) => api.get(`/compliance/policies/${id}`),
    create: (data: Partial<CompliancePolicy>) => api.post("/compliance/policies", data),
    update: (id: string, data: Partial<CompliancePolicy>) =>
      api.put(`/compliance/policies/${id}`, data),
    delete: (id: string) => api.delete(`/compliance/policies/${id}`),
    review: (id: string) => api.post(`/compliance/policies/${id}/review`),
  },
  violations: {
    list: (params?: { status?: string; severity?: string }) =>
      api.get("/compliance/violations", { params }),
    get: (id: string) => api.get(`/compliance/violations/${id}`),
    create: (data: Partial<ComplianceViolation>) => api.post("/compliance/violations", data),
    updateStatus: (id: string, status: string, resolution?: string) =>
      api.put(`/compliance/violations/${id}/status`, { status, resolution }),
  },
  auditLogs: {
    list: (params?: { page?: number; pageSize?: number; action?: string }) =>
      api.get("/compliance/audit-logs", { params }),
    export: (params?: { startDate?: string; endDate?: string }) =>
      api.get("/compliance/audit-logs/export", { params, responseType: "blob" }),
  },
  dashboard: () => api.get("/compliance/dashboard"),
  readiness: () => api.get("/compliance/readiness"),
};

export const copilotApi = {
  chat: {
    send: (message: string, sessionId?: string) =>
      api.post("/copilot/chat", { message, sessionId }),
    stream: (message: string, sessionId?: string) =>
      api.post("/copilot/chat/stream", { message, sessionId }, { responseType: "stream" }),
  },
  sessions: {
    list: () => api.get("/copilot/sessions"),
    get: (id: string) => api.get(`/copilot/sessions/${id}`),
    create: (title: string) => api.post("/copilot/sessions", { title }),
    delete: (id: string) => api.delete(`/copilot/sessions/${id}`),
  },
  predictions: {
    attrition: () => api.get("/copilot/predictions/attrition"),
    hiring: () => api.get("/copilot/predictions/hiring"),
    performance: () => api.get("/copilot/predictions/performance"),
  },
  insights: () => api.get("/copilot/insights"),
};

export const commandCenterApi = {
  overview: () => api.get("/command-center/overview"),
  orgHealth: () => api.get("/command-center/org-health"),
  departmentHeatmap: () => api.get("/command-center/department-heatmap"),
  workforceCost: () => api.get("/command-center/workforce-cost"),
  attritionRiskMap: () => api.get("/command-center/attrition-risk-map"),
  hiringPipeline: () => api.get("/command-center/hiring-pipeline"),
  budgetForecast: () => api.get("/command-center/budget-forecast"),
  utilization: () => api.get("/command-center/utilization"),
  benchmarking: () => api.get("/command-center/benchmarking"),
  aiBriefing: () => api.get("/command-center/ai-briefing"),
  riskDashboard: () => api.get("/command-center/risk-dashboard"),
  activityFeed: (params?: { limit?: number }) =>
    api.get("/command-center/activity-feed", { params }),
  kpiHistory: (kpi: string) => api.get(`/command-center/kpi-history/${kpi}`),
};

export const integrationApi = {
  dashboard: () => api.get("/integration/dashboard"),
  webhooks: {
    list: (params?: { page?: number; page_size?: number; enabled?: boolean }) =>
      api.get("/integration/webhooks", { params }),
    get: (id: string) => api.get(`/integration/webhooks/${id}`),
    create: (data: {
      name: string;
      url: string;
      event_types: string[];
      secret?: string;
      retry_count?: number;
      timeout_sec?: number;
    }) => api.post("/integration/webhooks", data),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/integration/webhooks/${id}`, data),
    delete: (id: string) => api.delete(`/integration/webhooks/${id}`),
    deliveries: (id: string, params?: { status?: string; page?: number; page_size?: number }) =>
      api.get(`/integration/webhooks/${id}/deliveries`, { params }),
  },
  subscriptions: {
    list: (params?: { page?: number; page_size?: number; enabled?: boolean }) =>
      api.get("/integration/subscriptions", { params }),
    create: (data: {
      event_type: string;
      kafka_topic?: string;
      source_service?: string;
    }) => api.post("/integration/subscriptions", data),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/integration/subscriptions/${id}`, data),
    delete: (id: string) => api.delete(`/integration/subscriptions/${id}`),
  },
  outbox: {
    list: (params?: { status?: string; page?: number; page_size?: number }) =>
      api.get("/integration/outbox", { params }),
  },
  config: {
    list: () => api.get("/integration/config"),
    get: (key: string) => api.get(`/integration/config/${key}`),
    create: (data: { key: string; value: unknown; description?: string }) =>
      api.post("/integration/config", data),
    update: (key: string, data: { value: unknown; description?: string }) =>
      api.put(`/integration/config/${key}`, data),
    delete: (key: string) => api.delete(`/integration/config/${key}`),
  },
};

export const lifecycleApi = {
  dashboard: () => api.get("/lifecycle/dashboard"),
  onboarding: {
    templates: {
      list: (params?: { page?: number; page_size?: number; is_active?: boolean }) =>
        api.get("/lifecycle/onboarding/templates", { params }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/onboarding/templates", data),
      get: (id: string) => api.get(`/lifecycle/onboarding/templates/${id}`),
      update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/onboarding/templates/${id}`, data),
      delete: (id: string) => api.delete(`/lifecycle/onboarding/templates/${id}`),
    },
    assignments: {
      list: (params?: { page?: number; page_size?: number; employee_id?: string; status?: string }) =>
        api.get("/lifecycle/onboarding/assignments", { params }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/onboarding/assignments", data),
      get: (id: string) => api.get(`/lifecycle/onboarding/assignments/${id}`),
      update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/onboarding/assignments/${id}`, data),
      delete: (id: string) => api.delete(`/lifecycle/onboarding/assignments/${id}`),
    },
  },
  offboarding: {
    list: (params?: { page?: number; page_size?: number; employee_id?: string; status?: string }) =>
      api.get("/lifecycle/offboarding", { params }),
    create: (data: Record<string, unknown>) => api.post("/lifecycle/offboarding", data),
    get: (id: string) => api.get(`/lifecycle/offboarding/${id}`),
    update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/offboarding/${id}`, data),
  },
  probation: {
    list: (params?: { page?: number; page_size?: number; employee_id?: string; status?: string }) =>
      api.get("/lifecycle/probation", { params }),
    create: (data: Record<string, unknown>) => api.post("/lifecycle/probation", data),
    getByEmployee: (employeeId: string) => api.get(`/lifecycle/probation/employee/${employeeId}`),
    get: (id: string) => api.get(`/lifecycle/probation/${id}`),
    update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/probation/${id}`, data),
    assessments: {
      list: (probationId: string) => api.get(`/lifecycle/probation/${probationId}/assessments`),
      create: (probationId: string, data: Record<string, unknown>) =>
        api.post(`/lifecycle/probation/${probationId}/assessments`, data),
      update: (id: string, data: Record<string, unknown>) =>
        api.put(`/lifecycle/probation/assessments/${id}`, data),
    },
  },
  career: {
    frameworks: {
      list: () => api.get("/lifecycle/career/frameworks"),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/career/frameworks", data),
    },
    jobFamilies: {
      list: (frameworkId?: string) => api.get("/lifecycle/career/job-families", { params: { framework_id: frameworkId } }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/career/job-families", data),
    },
    paths: {
      list: (jobFamilyId?: string) => api.get("/lifecycle/career/paths", { params: { job_family_id: jobFamilyId } }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/career/paths", data),
    },
    roadmaps: {
      list: (employeeId?: string) => api.get("/lifecycle/career/roadmaps", { params: { employee_id: employeeId } }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/career/roadmaps", data),
      get: (id: string) => api.get(`/lifecycle/career/roadmaps/${id}`),
      update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/career/roadmaps/${id}`, data),
    },
  },
  mobility: {
    jobs: {
      list: (params?: { status?: string; department?: string }) =>
        api.get("/lifecycle/mobility/jobs", { params }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/mobility/jobs", data),
      get: (id: string) => api.get(`/lifecycle/mobility/jobs/${id}`),
      update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/mobility/jobs/${id}`, data),
      delete: (id: string) => api.delete(`/lifecycle/mobility/jobs/${id}`),
    },
    applications: {
      list: (params?: { job_id?: string; employee_id?: string; status?: string }) =>
        api.get("/lifecycle/mobility/applications", { params }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/mobility/applications", data),
      update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/mobility/applications/${id}`, data),
    },
    transfers: {
      list: (params?: { page_size?: number; employee_id?: string; status?: string }) =>
        api.get("/lifecycle/mobility/transfers", { params }),
      create: (data: Record<string, unknown>) => api.post("/lifecycle/mobility/transfers", data),
      get: (id: string) => api.get(`/lifecycle/mobility/transfers/${id}`),
      update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/mobility/transfers/${id}`, data),
    },
  },
  promotions: {
    list: (params?: { page_size?: number; employee_id?: string; status?: string }) =>
      api.get("/lifecycle/promotions", { params }),
    create: (data: Record<string, unknown>) => api.post("/lifecycle/promotions", data),
    get: (id: string) => api.get(`/lifecycle/promotions/${id}`),
    update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/promotions/${id}`, data),
  },
  timeline: {
    list: (employeeId: string) => api.get(`/lifecycle/timeline/${employeeId}`),
    create: (data: Record<string, unknown>) => api.post("/lifecycle/timeline", data),
  },
  documents: {
    list: (employeeId: string, category?: string) =>
      api.get(`/lifecycle/documents/${employeeId}`, { params: { category } }),
    create: (data: Record<string, unknown>) => api.post("/lifecycle/documents", data),
    get: (id: string) => api.get(`/lifecycle/documents/doc/${id}`),
    update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/documents/doc/${id}`, data),
    delete: (id: string) => api.delete(`/lifecycle/documents/doc/${id}`),
  },
  profile: {
    get: (employeeId: string) => api.get(`/lifecycle/profile/${employeeId}`),
    upsert: (employeeId: string, data: Record<string, unknown>) =>
      api.put(`/lifecycle/profile/${employeeId}`, data),
  },
  achievements: {
    list: (employeeId: string, category?: string) =>
      api.get(`/lifecycle/achievements/${employeeId}`, { params: { category } }),
    create: (data: Record<string, unknown>) => api.post("/lifecycle/achievements", data),
    update: (id: string, data: Record<string, unknown>) => api.put(`/lifecycle/achievements/${id}`, data),
    delete: (id: string) => api.delete(`/lifecycle/achievements/${id}`),
  },
};

export const lmsApi = {
  dashboard: () => api.get("/lms/dashboard"),
  courses: {
    list: (params?: { category?: string; level?: string; status?: string; search?: string }) =>
      api.get("/lms/courses", { params }),
    get: (id: string) => api.get(`/lms/courses/${id}`),
    create: (data: Partial<Course>) => api.post("/lms/courses", data),
    update: (id: string, data: Partial<Course>) => api.put(`/lms/courses/${id}`, data),
    delete: (id: string) => api.delete(`/lms/courses/${id}`),
    publish: (id: string) => api.post(`/lms/courses/${id}/publish`),
    archive: (id: string) => api.post(`/lms/courses/${id}/archive`),
  },
  enrollments: {
    list: (params?: { courseId?: string; employeeId?: string; status?: string }) =>
      api.get("/lms/enrollments", { params }),
    create: (data: { employeeId: string; courseId: string }) =>
      api.post("/lms/enrollments", data),
    bulkCreate: (data: { employeeIds: string[]; courseId: string }) =>
      api.post("/lms/enrollments/bulk", data),
    updateProgress: (id: string, progress: number) =>
      api.put(`/lms/enrollments/${id}/progress`, { progress }),
    complete: (id: string, grade?: number) =>
      api.post(`/lms/enrollments/${id}/complete`, { grade }),
    delete: (id: string) => api.delete(`/lms/enrollments/${id}`),
  },
  certifications: {
    list: (params?: { employeeId?: string; status?: string }) =>
      api.get("/lms/certifications", { params }),
    create: (data: Partial<Certification>) => api.post("/lms/certifications", data),
    update: (id: string, data: Partial<Certification>) =>
      api.put(`/lms/certifications/${id}`, data),
    verify: (id: string) => api.post(`/lms/certifications/${id}/verify`),
    delete: (id: string) => api.delete(`/lms/certifications/${id}`),
  },
  assessments: {
    list: (courseId: string) => api.get(`/lms/assessments`, { params: { courseId } }),
    get: (id: string) => api.get(`/lms/assessments/${id}`),
    create: (data: Partial<Assessment>) => api.post("/lms/assessments", data),
    update: (id: string, data: Partial<Assessment>) =>
      api.put(`/lms/assessments/${id}`, data),
    delete: (id: string) => api.delete(`/lms/assessments/${id}`),
    attempts: {
      list: (assessmentId: string) =>
        api.get(`/lms/assessments/${assessmentId}/attempts`),
      submit: (assessmentId: string, answers: number[]) =>
        api.post(`/lms/assessments/${assessmentId}/attempts`, { answers }),
    },
  },
  learningPaths: {
    list: () => api.get("/lms/learning-paths"),
    get: (id: string) => api.get(`/lms/learning-paths/${id}`),
    create: (data: Partial<LearningPath>) => api.post("/lms/learning-paths", data),
    update: (id: string, data: Partial<LearningPath>) =>
      api.put(`/lms/learning-paths/${id}`, data),
    delete: (id: string) => api.delete(`/lms/learning-paths/${id}`),
  },
  skills: {
    matrix: () => api.get("/lms/skills/matrix"),
    employee: (employeeId: string) => api.get(`/lms/skills/employee/${employeeId}`),
    upsert: (data: { employeeId: string; skill: string; level: number; category: string }) =>
      api.post("/lms/skills", data),
    gapAnalysis: () => api.get("/lms/skills/gap-analysis"),
  },
};
