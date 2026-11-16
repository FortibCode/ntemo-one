// =============================================================================
// Dashboard Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  total_employees: number;
  present_today: number;
  absent_today: number;
  on_leave_today: number;
  pending_leave_requests: number;
  pending_corrections: number;
  active_projects: number;
  total_hours_this_month: number;
}

export interface ActivityItem {
  id: string;
  type: 'attendance' | 'leave' | 'document' | 'employee' | 'timesheet';
  title: string;
  description: string;
  actor_name: string;
  created_at: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'info' | 'error' | 'success';
  title: string;
  message: string;
  action_url: string | null;
  created_at: string;
}

export type ChartPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface ChartData {
  attendance: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
  }>;
  leaves_by_type: Array<{
    type: string;
    count: number;
  }>;
  hours_by_project: Array<{
    project: string;
    hours: number;
  }>;
  employee_growth: Array<{
    month: string;
    count: number;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const BASE = '/dashboard';

export const dashboardService = {
  /** Get key performance indicators for the main dashboard. */
  getDashboardKpis() {
    return apiClient.get<ApiResponse<DashboardKpis>>(`${BASE}/kpis`);
  },

  /** Get recent activity feed. */
  getRecentActivity() {
    return apiClient.get<ApiResponse<ActivityItem[]>>(`${BASE}/activity`);
  },

  /** Get active alerts / notifications for the dashboard. */
  getAlerts() {
    return apiClient.get<ApiResponse<Alert[]>>(`${BASE}/alerts`);
  },

  /** Get chart data for a given period. */
  getChartData(period: ChartPeriod) {
    return apiClient.get<ApiResponse<ChartData>>(`${BASE}/charts`, { period });
  },
};
