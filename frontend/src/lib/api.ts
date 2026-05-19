import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
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
};

export const analyticsApi = {
  dashboard: () => api.get("/analytics/dashboard"),
  trends: () => api.get("/analytics/trends"),
};
