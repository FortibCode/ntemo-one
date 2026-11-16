// =============================================================================
// Badge Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse, QueryParams } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  employee_id: string;
  employee_name: string;
  matricule: string;
  department: string;
  position: string;
  photo_url: string | null;
  qr_code_url: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  issued_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BadgeFilters extends QueryParams {
  employee_id?: string;
  department_id?: string;
  status?: Badge['status'];
  search?: string;
  page?: number;
  per_page?: number;
}

export interface BadgePreview {
  html: string;
  image_url: string;
}

export interface PaginatedBadges {
  data: Badge[];
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

const BASE = '/badges';

export const badgeService = {
  /** List badges with optional filters & pagination. */
  getBadges(filters?: BadgeFilters) {
    return apiClient.get<PaginatedBadges>(BASE, filters);
  },

  /** Generate a new badge for an employee. */
  generateBadge(employeeId: string) {
    return apiClient.post<ApiResponse<Badge>>(BASE, {
      employee_id: employeeId,
    });
  },

  /** Send a badge to the print queue. */
  printBadge(id: string) {
    return apiClient.post<ApiResponse<{ job_id: string }>>(`${BASE}/${id}/print`);
  },

  /** Get a preview (HTML + image) for a badge. */
  getBadgePreview(id: string) {
    return apiClient.get<ApiResponse<BadgePreview>>(`${BASE}/${id}/preview`);
  },
};
