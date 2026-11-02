export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: OrganizationSummary | null;
  roles: string[];
  permissions?: string[];
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface PositionSummary {
  id: string;
  title: string;
  code: string | null;
}

export interface ManagerSummary {
  id: string;
  matricule: string;
  full_name: string;
}

export interface Employee {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: 'M' | 'F' | null;
  birth_date: string | null;
  birth_place: string | null;
  nationality: string | null;
  marital_status: string | null;
  dependent_children: number;
  address: string | null;
  city: string | null;
  national_id_number: string | null;
  social_security_number: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  hire_date: string;
  probation_end_date: string | null;
  termination_date: string | null;
  photo_path: string | null;
  department: DepartmentSummary | null;
  position: PositionSummary | null;
  manager: ManagerSummary | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta?: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  };
}

