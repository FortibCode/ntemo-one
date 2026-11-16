// =============================================================================
// Badge Service — NTEMO ONE (permission `badges.generate_revoke`)
// =============================================================================

import { apiClient } from '@/lib/api';

export type BadgeStatus = 'ACTIVE' | 'REVOKED' | 'REPLACED' | 'EXPIRED' | string;

export interface BadgeItem {
  id: string;
  badge_number: string;
  status: BadgeStatus;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  employee: {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    department?: { name: string } | null;
    position?: { title: string } | null;
  } | null;
}

export interface BadgePage {
  data: BadgeItem[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface BadgeVerification {
  is_valid: boolean;
  message?: string;
  badge_number?: string;
  status?: string;
  employee?: { full_name: string; matricule: string; department: string | null; position: string | null };
  issued_at?: string;
  expires_at?: string | null;
}

export const badgeService = {
  list(params: { search?: string; status?: string; page?: number } = {}): Promise<BadgePage> {
    return apiClient.get<BadgePage>('/badges', params);
  },

  async issue(employeeId: string, expiresAt?: string): Promise<BadgeItem> {
    const res = await apiClient.post<{ data: BadgeItem }>('/badges/issue', {
      employee_id: employeeId,
      expires_at: expiresAt || undefined,
    });
    return res.data;
  },

  async revoke(badgeId: string, reason: string): Promise<void> {
    await apiClient.post(`/badges/${badgeId}/revoke`, { reason });
  },

  /** Vérification d'un jeton scanné ; un badge refusé renvoie 422 avec le motif. */
  async verify(securityToken: string): Promise<BadgeVerification> {
    try {
      return await apiClient.post<BadgeVerification>('/badges/verify', { security_token: securityToken });
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 422) return { is_valid: false, message: e.message };
      throw err;
    }
  },

  print(badge: Pick<BadgeItem, 'id' | 'badge_number'>): Promise<void> {
    return apiClient.download(`/badges/${badge.id}/print`, `badge-${badge.badge_number}.pdf`);
  },
};
