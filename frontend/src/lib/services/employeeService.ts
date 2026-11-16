// =============================================================================
// Employee Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse, QueryParams } from '@/lib/api';
import type { Employee, PaginatedResponse } from '@/types';

// ---------------------------------------------------------------------------
// Request / filter types
// ---------------------------------------------------------------------------

export interface EmployeeFilters extends QueryParams {
  search?: string;
  status?: Employee['status'];
  department_id?: string;
  position_id?: string;
  page?: number;
  per_page?: number;
}

export interface CreateEmployeeData {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: 'M' | 'F' | null;
  birth_date?: string | null;
  birth_place?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  dependent_children?: number;
  address?: string | null;
  city?: string | null;
  national_id_number?: string | null;
  social_security_number?: string | null;
  hire_date: string;
  department_id?: string | null;
  position_id?: string | null;
  manager_id?: string | null;
}

export type UpdateEmployeeData = Partial<CreateEmployeeData>;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface EmployeeStats {
  total: number;
  active: number;
  on_leave: number;
  suspended: number;
  terminated: number;
  new_this_month: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const BASE = '/employees';

export const employeeService = {
  /** List employees with optional filters & pagination. */
  getEmployees(filters?: EmployeeFilters) {
    return apiClient.get<PaginatedResponse<Employee>>(BASE, filters);
  },

  /** Get a single employee by ID. */
  getEmployee(id: string) {
    return apiClient.get<ApiResponse<Employee>>(`${BASE}/${id}`);
  },

  /** Create a new employee. */
  createEmployee(data: CreateEmployeeData) {
    return apiClient.post<ApiResponse<Employee>>(BASE, data);
  },

  /** Update an existing employee. */
  updateEmployee(id: string, data: UpdateEmployeeData) {
    return apiClient.put<ApiResponse<Employee>>(`${BASE}/${id}`, data);
  },

  /** Delete (soft-delete) an employee. */
  deleteEmployee(id: string) {
    return apiClient.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  /** Aggregate stats for the dashboard. */
  getEmployeeStats() {
    return apiClient.get<ApiResponse<EmployeeStats>>(`${BASE}/stats`);
  },
};
