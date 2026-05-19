import type {
  AttendanceRecord,
  KpiMetric,
  LeaveRequest,
  Notification,
  PayrollSummary,
} from "@/types";

export const dashboardKpis: KpiMetric[] = [
  { label: "Total Employees", value: 1248, change: 4.2, trend: "up" },
  { label: "Present Today", value: 1189, change: 1.8, trend: "up" },
  { label: "Open Positions", value: 23, change: -12, trend: "down" },
  { label: "Monthly Payroll", value: 2840000, change: 2.1, trend: "up" },
];

export const headcountTrend = [
  { month: "Jan", count: 1100 },
  { month: "Feb", count: 1125 },
  { month: "Mar", count: 1150 },
  { month: "Apr", count: 1180 },
  { month: "May", count: 1210 },
  { month: "Jun", count: 1248 },
];

export const departmentBreakdown = [
  { name: "Engineering", value: 420 },
  { name: "Sales", value: 280 },
  { name: "Operations", value: 210 },
  { name: "HR", value: 95 },
  { name: "Finance", value: 143 },
  { name: "Marketing", value: 100 },
];

export const attendanceTrend = [
  { day: "Mon", rate: 96 },
  { day: "Tue", rate: 94 },
  { day: "Wed", rate: 97 },
  { day: "Thu", rate: 95 },
  { day: "Fri", rate: 92 },
];

export const mockAttendance: AttendanceRecord[] = [
  {
    id: "1",
    employeeName: "Sarah Chen",
    date: "2026-05-15",
    checkIn: "08:55",
    checkOut: "17:30",
    status: "present",
    hours: 8.5,
  },
  {
    id: "2",
    employeeName: "James Wilson",
    date: "2026-05-15",
    checkIn: "09:22",
    checkOut: "18:00",
    status: "late",
    hours: 8.6,
  },
  {
    id: "3",
    employeeName: "Maria Garcia",
    date: "2026-05-15",
    checkIn: "08:30",
    checkOut: "—",
    status: "remote",
    hours: 0,
  },
  {
    id: "4",
    employeeName: "David Kim",
    date: "2026-05-15",
    checkIn: "—",
    checkOut: "—",
    status: "absent",
    hours: 0,
  },
];

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: "1",
    employeeName: "Sarah Chen",
    type: "Annual Leave",
    startDate: "2026-05-20",
    endDate: "2026-05-24",
    status: "pending",
    days: 5,
  },
  {
    id: "2",
    employeeName: "James Wilson",
    type: "Sick Leave",
    startDate: "2026-05-16",
    endDate: "2026-05-17",
    status: "approved",
    days: 2,
  },
  {
    id: "3",
    employeeName: "Maria Garcia",
    type: "Personal",
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    status: "rejected",
    days: 1,
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "1",
    title: "Payroll run started",
    message: "May 2026 payroll processing has begun.",
    read: false,
    createdAt: "2026-05-15T09:00:00Z",
  },
  {
    id: "2",
    title: "Leave request pending",
    message: "Sarah Chen submitted annual leave for approval.",
    read: false,
    createdAt: "2026-05-14T14:30:00Z",
  },
  {
    id: "3",
    title: "New employee onboarded",
    message: "Alex Rivera joined Engineering.",
    read: true,
    createdAt: "2026-05-13T11:00:00Z",
  },
];

export const mockPayrollRuns: PayrollSummary[] = [
  {
    id: "1",
    period: "May 2026",
    totalAmount: 2840000,
    employeeCount: 1248,
    status: "processing",
  },
  {
    id: "2",
    period: "April 2026",
    totalAmount: 2795000,
    employeeCount: 1235,
    status: "completed",
  },
  {
    id: "3",
    period: "March 2026",
    totalAmount: 2760000,
    employeeCount: 1220,
    status: "completed",
  },
];
