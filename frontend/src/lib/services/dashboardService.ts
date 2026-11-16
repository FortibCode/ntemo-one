// =============================================================================
// Dashboard Service — NTEMO ONE (permission `dashboard.view`)
// =============================================================================

import { apiClient } from '@/lib/api';

export interface TrendPoint {
  date: string;
  present: number;
  late: number;
}

export interface RecentEvent {
  id: string;
  type: 'IN' | 'OUT' | 'BREAK_IN' | 'BREAK_OUT' | string;
  source: string;
  time: string;
  employee: { full_name: string | null; matricule: string | null; department: string | null };
}

export interface ContractAlert {
  kind: 'PROBATION_END' | 'CONTRACT_END';
  date: string;
  days_left: number;
  contract_type: string;
  employee: { id: string | null; full_name: string | null; matricule: string | null };
}

export interface DocumentAlert {
  id: string;
  title: string;
  category: string;
  date: string;
  days_left: number;
  employee: { id: string | null; full_name: string | null; matricule: string | null };
}

export interface DashboardKpis {
  date: string;
  is_working_day: boolean;
  workforce: { total_employees: number; active_employees: number; on_leave_today: number };
  attendance: {
    present_today: number;
    late_today: number;
    absent_today: number;
    attendance_rate_percentage: number;
    trend: TrendPoint[];
    recent_events: RecentEvent[];
  };
  leaves: { pending_approval_count: number; pending_manager_count: number; pending_hr_count: number };
  approvals: { pending_corrections: number; pending_timesheets: number };
  documents: { generated_this_month: number; active_badges: number };
  projects: { active_projects_count: number; approved_hours_this_month: number; overdue_tasks_count: number };
  contract_alerts: ContractAlert[];
  document_alerts: DocumentAlert[];
}

export const dashboardService = {
  async kpis(): Promise<DashboardKpis> {
    const res = await apiClient.get<{ success: boolean; data: DashboardKpis }>('/dashboard/kpis');
    return res.data;
  },
};
