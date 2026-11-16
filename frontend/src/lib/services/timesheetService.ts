// =============================================================================
// Timesheet Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse, QueryParams } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimesheetEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  date: string;
  hours: number;
  description: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimesheetFilters extends QueryParams {
  employee_id?: string;
  project_id?: string;
  status?: TimesheetEntry['status'];
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface LogTimeData {
  project_id: string;
  date: string;
  hours: number;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  client: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  start_date: string;
  end_date: string | null;
}

export interface TimesheetStats {
  total_hours_this_week: number;
  total_hours_this_month: number;
  pending_approvals: number;
  active_projects: number;
  hours_by_project: Array<{
    project_id: string;
    project_name: string;
    hours: number;
  }>;
}

export interface PaginatedTimesheets {
  data: TimesheetEntry[];
  meta?: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const BASE = '/timesheets';

export const timesheetService = {
  /** List timesheet entries with optional filters & pagination. */
  getTimesheets(filters?: TimesheetFilters) {
    return apiClient.get<PaginatedTimesheets>(BASE, filters);
  },

  /** Log time for a project. */
  logTime(data: LogTimeData) {
    return apiClient.post<ApiResponse<TimesheetEntry>>(BASE, data);
  },

  /** Approve a submitted timesheet entry. */
  approveTimesheet(id: string) {
    return apiClient.put<ApiResponse<TimesheetEntry>>(
      `${BASE}/${id}/approve`,
      {},
    );
  },

  /** Reject a submitted timesheet entry with a reason. */
  rejectTimesheet(id: string, reason: string) {
    return apiClient.put<ApiResponse<TimesheetEntry>>(`${BASE}/${id}/reject`, {
      reason,
    });
  },

  /** List available projects. */
  getProjects() {
    return apiClient.get<ApiResponse<Project[]>>('/projects');
  },

  /** Aggregate timesheet statistics. */
  getTimesheetStats() {
    return apiClient.get<ApiResponse<TimesheetStats>>(`${BASE}/stats`);
  },
};
