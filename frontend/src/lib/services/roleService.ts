// =============================================================================
// Role Service — NTEMO ONE (RBAC)
// Endpoints protégés par la permission `roles.manage`.
// =============================================================================

import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PermissionItem {
  id: string;
  name: string;
  slug: string;
  module: string;
  description: string | null;
}

export interface RoleSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  users_count: number;
  /** Slugs des permissions accordées au rôle. */
  permissions: string[];
}

export interface RoleAssignmentResult {
  user_id: string;
  user_name: string;
  roles: string[];
}

export interface RoleUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  /** true pour l'utilisateur connecté (ses rôles ne peuvent pas lui être retirés). */
  is_self: boolean;
  matricule: string | null;
  department: string | null;
  roles: { id: string; name: string; slug: string }[];
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const roleService = {
  async list(): Promise<RoleSummary[]> {
    const res = await apiClient.get<Envelope<RoleSummary[]>>('/roles');
    return res.data;
  },

  async permissions(): Promise<PermissionItem[]> {
    const res = await apiClient.get<Envelope<PermissionItem[]>>('/permissions');
    return res.data;
  },

  async users(params: { search?: string; role_id?: string } = {}): Promise<RoleUser[]> {
    const res = await apiClient.get<Envelope<RoleUser[]>>('/roles/users', params);
    return res.data;
  },

  async assign(userId: string, roleId: string): Promise<RoleAssignmentResult> {
    const res = await apiClient.post<Envelope<RoleAssignmentResult>>('/roles/assign', {
      user_id: userId,
      role_id: roleId,
    });
    return res.data;
  },

  async revoke(userId: string, roleId: string): Promise<RoleAssignmentResult> {
    const res = await apiClient.post<Envelope<RoleAssignmentResult>>('/roles/revoke', {
      user_id: userId,
      role_id: roleId,
    });
    return res.data;
  },
};
