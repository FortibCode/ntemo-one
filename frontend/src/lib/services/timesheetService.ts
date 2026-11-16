// =============================================================================
// Timesheet Service — NTEMO ONE
// Déclaration (tous) et validation (permission `timesheets.approve`, périmètre équipe/projet).
// =============================================================================

import { apiClient } from '@/lib/api';

export type TimeEntryStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ProjectTask {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
  tasks: ProjectTask[];
}

export interface TimeEntry {
  id: string;
  date: string;
  hours: string | number;
  description: string;
  status: TimeEntryStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  project: { id: string; name: string; code: string | null } | null;
  task: { id: string; title: string } | null;
  approver: { name: string } | null;
  employee?: {
    first_name: string;
    last_name: string;
    matricule: string;
    department?: { name: string } | null;
  } | null;
}

export interface TimeEntryPage {
  data: TimeEntry[];
  current_page: number;
  last_page: number;
  total: number;
}

export const timesheetService = {
  async projects(): Promise<Project[]> {
    const res = await apiClient.get<{ data: Project[] }>('/projects');
    return res.data;
  },

  myEntries(): Promise<TimeEntryPage> {
    return apiClient.get<TimeEntryPage>('/timesheets/my-entries');
  },

  teamEntries(params: { status?: TimeEntryStatus; page?: number } = {}): Promise<TimeEntryPage> {
    return apiClient.get<TimeEntryPage>('/timesheets', params);
  },

  log(payload: { project_id: string; task_id?: string; date: string; hours: number; description: string }) {
    return apiClient.post<{ data: TimeEntry }>('/timesheets/log', payload);
  },

  review(id: string, action: 'APPROVE' | 'REJECT', reason?: string) {
    return apiClient.post<{ message: string }>(`/timesheets/${id}/review`, { action, reason });
  },
};
