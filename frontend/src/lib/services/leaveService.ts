// =============================================================================
// Leave Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse, QueryParams } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveFilters extends QueryParams {
  employee_id?: string;
  department_id?: string;
  status?: LeaveRequest['status'];
  type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface CreateLeaveRequestData {
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export interface LeaveBalance {
  employee_id: string;
  employee_name: string;
  balances: LeaveTypeBalance[];
}

export interface LeaveTypeBalance {
  type: string;
  label: string;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveStats {
  pending_requests: number;
  approved_this_month: number;
  rejected_this_month: number;
  employees_on_leave: number;
  most_requested_type: string;
}

export interface PaginatedLeaveRequests {
  data: LeaveRequest[];
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

const BASE = '/leaves';

export const leaveService = {
  /** List leave requests with optional filters & pagination. */
  getLeaveRequests(filters?: LeaveFilters) {
    return apiClient.get<PaginatedLeaveRequests>(BASE, filters);
  },

  /** Create a new leave request. */
  createLeaveRequest(data: CreateLeaveRequestData) {
    return apiClient.post<ApiResponse<LeaveRequest>>(BASE, data);
  },

  /** Approve a leave request. */
  approveLeave(id: string, comment?: string) {
    return apiClient.put<ApiResponse<LeaveRequest>>(`${BASE}/${id}/approve`, {
      comment,
    });
  },

  /** Reject a leave request with a mandatory reason. */
  rejectLeave(id: string, reason: string) {
    return apiClient.put<ApiResponse<LeaveRequest>>(`${BASE}/${id}/reject`, {
      reason,
    });
  },

  /** Get leave balance for a specific employee. */
  getLeaveBalance(employeeId: string) {
    return apiClient.get<ApiResponse<LeaveBalance>>(
      `/employees/${employeeId}/leave-balance`,
    );
  },

  /** Aggregate leave statistics. */
  getLeaveStats() {
    return apiClient.get<ApiResponse<LeaveStats>>(`${BASE}/stats`);
  },
};
