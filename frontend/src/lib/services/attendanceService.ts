// =============================================================================
// Attendance Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse, QueryParams } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';
  hours_worked: number | null;
  overtime_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceFilters extends QueryParams {
  employee_id?: string;
  department_id?: string;
  date_from?: string;
  date_to?: string;
  status?: AttendanceRecord['status'];
  page?: number;
  per_page?: number;
}

export interface CorrectionRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  attendance_id: string;
  date: string;
  field: string;
  old_value: string | null;
  new_value: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CreateCorrectionData {
  attendance_id: string;
  field: string;
  new_value: string;
  reason: string;
}

export interface ReviewCorrectionData {
  status: 'APPROVED' | 'REJECTED';
  comment?: string;
}

export interface QrToken {
  token: string;
  expires_at: string;
}

export interface AttendanceStats {
  present_today: number;
  absent_today: number;
  late_today: number;
  on_leave_today: number;
  average_hours_this_week: number;
  punctuality_rate: number;
}

export interface PaginatedAttendance {
  data: AttendanceRecord[];
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

const BASE = '/attendance';

export const attendanceService = {
  /** Get today's attendance records for all employees. */
  getTodayAttendance() {
    return apiClient.get<ApiResponse<AttendanceRecord[]>>(`${BASE}/today`);
  },

  /** Get historical attendance records with filters. */
  getAttendanceHistory(filters?: AttendanceFilters) {
    return apiClient.get<PaginatedAttendance>(BASE, filters);
  },

  /** Check in via QR token. */
  checkIn(qrToken: string) {
    return apiClient.post<ApiResponse<AttendanceRecord>>(`${BASE}/check-in`, {
      qr_token: qrToken,
    });
  },

  /** Check out via QR token. */
  checkOut(qrToken: string) {
    return apiClient.post<ApiResponse<AttendanceRecord>>(`${BASE}/check-out`, {
      qr_token: qrToken,
    });
  },

  /** List correction requests (optionally filtered by status). */
  getCorrections(status?: CorrectionRequest['status']) {
    return apiClient.get<ApiResponse<CorrectionRequest[]>>(
      `${BASE}/corrections`,
      status ? { status } : undefined,
    );
  },

  /** Submit a new correction request. */
  requestCorrection(data: CreateCorrectionData) {
    return apiClient.post<ApiResponse<CorrectionRequest>>(
      `${BASE}/corrections`,
      data,
    );
  },

  /** Approve or reject a correction request. */
  reviewCorrection(id: string, data: ReviewCorrectionData) {
    return apiClient.put<ApiResponse<CorrectionRequest>>(
      `${BASE}/corrections/${id}/review`,
      data,
    );
  },

  /** Generate a new QR token for attendance scanning. */
  generateQrToken() {
    return apiClient.post<ApiResponse<QrToken>>(`${BASE}/qr-token`);
  },

  /** Aggregate attendance statistics. */
  getAttendanceStats() {
    return apiClient.get<ApiResponse<AttendanceStats>>(`${BASE}/stats`);
  },
};
