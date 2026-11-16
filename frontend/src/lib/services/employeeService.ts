// =============================================================================
// Employee Service — NTEMO ONE (dossiers, structure, contrats, comptes)
// =============================================================================

import { apiClient } from '@/lib/api';

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
export type ContractType = 'CDI' | 'CDD' | 'STAGE' | 'PRESTATION' | 'APPRENTISSAGE';

export interface EmployeeItem {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: 'M' | 'F' | null;
  birth_date: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  national_id_number: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  probation_end_date: string | null;
  department: { id: string; name: string; code: string | null } | null;
  position: { id: string; title: string; code: string | null } | null;
  manager: { id: string; matricule: string; full_name: string } | null;
  has_account: boolean;
  current_contract?: { type: ContractType; start_date: string; end_date: string | null } | null;
}

export interface EmployeePage {
  data: EmployeeItem[];
  meta?: { current_page: number; last_page: number; total: number };
}

export interface EmployeeInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: 'M' | 'F' | null;
  birth_date?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  national_id_number?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  manager_id?: string | null;
  hire_date: string;
  status?: EmployeeStatus;
}

export interface Structure {
  departments: { id: string; name: string; code: string | null }[];
  positions: { id: string; title: string; code: string | null; department_id: string | null }[];
}

export interface ContractItem {
  id: string;
  type: ContractType;
  reference: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'DRAFT';
  start_date: string;
  end_date: string | null;
  probation_end_date: string | null;
  gross_salary: number | null;
  currency: string;
  notes: string | null;
}

export interface CreatedAccount {
  user_id: string;
  email: string;
  role: string;
  temporary_password: string;
}

export const employeeService = {
  list(params: { search?: string; status?: string; department_id?: string; page?: number; per_page?: number } = {}) {
    return apiClient.get<EmployeePage>('/employees', { per_page: 25, ...params });
  },
  async create(input: EmployeeInput): Promise<EmployeeItem> {
    return (await apiClient.post<{ data: EmployeeItem }>('/employees', input)).data;
  },
  async update(id: string, input: Partial<EmployeeInput>): Promise<EmployeeItem> {
    return (await apiClient.put<{ data: EmployeeItem }>(`/employees/${id}`, input)).data;
  },
  async structure(): Promise<Structure> {
    return (await apiClient.get<{ data: Structure }>('/structure')).data;
  },
  async contracts(employeeId: string): Promise<ContractItem[]> {
    return (await apiClient.get<{ data: ContractItem[] }>(`/employees/${employeeId}/contracts`)).data;
  },
  async addContract(
    employeeId: string,
    input: { type: ContractType; start_date: string; end_date?: string | null; probation_end_date?: string | null; gross_salary?: number | null; reference?: string | null },
  ): Promise<ContractItem> {
    return (await apiClient.post<{ data: ContractItem }>(`/employees/${employeeId}/contracts`, input)).data;
  },
  async createAccount(employeeId: string, roleId: string, email?: string): Promise<CreatedAccount> {
    return (
      await apiClient.post<{ data: CreatedAccount }>(`/employees/${employeeId}/account`, { role_id: roleId, email: email || undefined })
    ).data;
  },
};
