// =============================================================================
// Attendance Service — NTEMO ONE
// Borne QR dynamique (permission `attendance.scan_device`) et régularisations
// (permission `attendance.approve_correction`).
// =============================================================================

import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttendanceDevice {
  id: string;
  name: string;
  device_identifier: string;
  type: string;
  last_heartbeat_at: string | null;
}

export interface QrSession {
  /** Jeton signé (HMAC) à encoder dans le QR code ; usage unique. */
  token: string;
  expires_at: string;
  validity_seconds: number;
  qr_session_id: string;
  device: { name: string; identifier: string };
}

export type CorrectionStatus = 'PENDING' | 'APPROVED_N1' | 'APPROVED_RH' | 'REJECTED';

export interface CorrectionItem {
  id: string;
  date: string;
  requested_event_type: 'IN' | 'OUT';
  requested_time: string;
  reason: string;
  status: CorrectionStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  created_at: string | null;
  employee: {
    id: string | null;
    full_name: string | null;
    matricule: string | null;
    department: string | null;
  };
}

export interface CorrectionPage {
  data: CorrectionItem[];
  current_page: number;
  last_page: number;
  total: number;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const attendanceService = {
  async devices(): Promise<AttendanceDevice[]> {
    const res = await apiClient.get<Envelope<AttendanceDevice[]>>('/attendance/devices');
    return res.data;
  },

  async qrSession(deviceIdentifier: string): Promise<QrSession> {
    const res = await apiClient.post<Envelope<QrSession>>('/attendance/qr-session', {
      device_identifier: deviceIdentifier,
    });
    return res.data;
  },

  corrections(params: { status?: CorrectionStatus; page?: number } = {}): Promise<CorrectionPage> {
    return apiClient.get<CorrectionPage>('/attendance/corrections', params);
  },

  async reviewCorrection(id: string, action: 'APPROVE' | 'REJECT', reason?: string): Promise<string> {
    const res = await apiClient.post<Envelope<unknown>>(`/attendance/corrections/${id}/review`, {
      action,
      reason,
    });
    return res.message ?? '';
  },
};
