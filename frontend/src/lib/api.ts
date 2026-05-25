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
  metrics: () => api.get("/command-center/metrics"),
  orgHealth: () => api.get("/command-center/org-health"),
  departmentPerformance: () => api.get("/command-center/department-performance"),
  activityFeed: (params?: { limit?: number }) =>
    api.get("/command-center/activity-feed", { params }),
  insights: () => api.get("/command-center/insights"),
  attritionRisks: () => api.get("/command-center/attrition-risks"),
  kpiHistory: (kpi: string) => api.get(`/command-center/kpi-history/${kpi}`),
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
