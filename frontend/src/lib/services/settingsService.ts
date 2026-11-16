// =============================================================================
// Settings Service — NTEMO ONE
// Lecture ouverte à tous ; écriture protégée par la permission `settings.manage`.
// =============================================================================

import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
}

export type DigestFrequency = 'realtime' | 'daily' | 'weekly' | 'off';
export type Weekday =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface AttendanceConfig {
  /** Imposé par le moteur de pointage (15 s) — lecture seule. */
  qr_expiry_seconds: number;
  grace_period_minutes: number;
  working_hours_start: string;
  working_hours_end: string;
  lunch_break_start: string;
  lunch_break_end: string;
  auto_checkout_enabled: boolean;
  auto_checkout_time: string;
  geofencing_enabled: boolean;
  geofencing_radius_meters: number;
}

export interface OrganizationSettings {
  leave_quotas: Record<string, number>;
  leave_policy: {
    carry_over_enabled: boolean;
    carry_over_max_days: number;
    /** Imposé par le workflow de congés (N+1 puis RH) — lecture seule. */
    approval_workflow: '2-tier';
  };
  notification_preferences: {
    email_enabled: boolean;
    sms_enabled: boolean;
    push_enabled: boolean;
    digest_frequency: DigestFrequency;
  };
  working_days: Weekday[];
  attendance: AttendanceConfig;
}

export interface SettingsPayload {
  organization: OrganizationInfo;
  settings: OrganizationSettings;
}

export interface SettingsUpdate {
  organization?: Partial<Omit<OrganizationInfo, 'id' | 'slug'>>;
  leave_quotas?: Record<string, number>;
  leave_policy?: Partial<Omit<OrganizationSettings['leave_policy'], 'approval_workflow'>>;
  notification_preferences?: Partial<OrganizationSettings['notification_preferences']>;
  working_days?: Weekday[];
}

export type AttendanceUpdate = Partial<Omit<AttendanceConfig, 'qr_expiry_seconds'>>;

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const settingsService = {
  async get(): Promise<SettingsPayload> {
    const res = await apiClient.get<Envelope<SettingsPayload>>('/settings');
    return res.data;
  },

  async update(payload: SettingsUpdate): Promise<SettingsPayload> {
    const res = await apiClient.put<Envelope<SettingsPayload>>('/settings', payload);
    return res.data;
  },

  async updateAttendance(payload: AttendanceUpdate): Promise<AttendanceConfig> {
    const res = await apiClient.put<Envelope<{ attendance: AttendanceConfig }>>(
      '/settings/attendance',
      payload,
    );
    return res.data.attendance;
  },
};
