// =============================================================================
// Leave Service — NTEMO ONE (demandes, validation N+1 / RH, calendrier partagé)
// =============================================================================

import { apiClient } from '@/lib/api';

export type LeaveStatus = 'PENDING_N1' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveType {
  id: string;
  name: string;
  code: string | null;
  default_days_per_year: string | number;
  is_paid: boolean;
}

export interface MyLeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  total_days: string | number;
  reason: string | null;
  status: LeaveStatus;
  created_at: string;
  leave_type: { id: string; name: string } | null;
}

export interface PendingLeave {
  id: string;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  leave_type: string | null;
  review_level: 'N1' | 'HR';
  employee: { full_name: string; matricule: string; department: string | null };
}

export interface CalendarLeave {
  id: string;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  leave_type: string | null;
  employee: { id: string; full_name: string; department: string | null };
}

export const leaveService = {
  async types(): Promise<LeaveType[]> {
    return (await apiClient.get<{ data: LeaveType[] }>('/leaves/types')).data;
  },
  async mine(): Promise<MyLeaveRequest[]> {
    return (await apiClient.get<{ data: MyLeaveRequest[] }>('/leaves/my-requests')).data ?? [];
  },
  async pending(): Promise<PendingLeave[]> {
    return (await apiClient.get<{ data: PendingLeave[] }>('/leaves/pending')).data;
  },
  async calendar(month: string): Promise<CalendarLeave[]> {
    return (await apiClient.get<{ data: CalendarLeave[] }>('/leaves/calendar', { month })).data;
  },
  request(payload: { leave_type_id: string; start_date: string; end_date: string; reason: string }) {
    return apiClient.post<{ data: MyLeaveRequest; message?: string }>('/leaves/requests', payload);
  },
  review(item: PendingLeave, approved: boolean, comments?: string) {
    const path = item.review_level === 'N1' ? 'review-n1' : 'review-hr';
    return apiClient.post<{ message: string }>(`/leaves/requests/${item.id}/${path}`, { approved, comments });
  },
};
