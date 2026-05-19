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
