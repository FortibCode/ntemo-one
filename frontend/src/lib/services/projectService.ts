// =============================================================================
// Project Service — NTEMO ONE (projets, tâches, échéances)
// =============================================================================

import { apiClient } from '@/lib/api';

export type ProjectStatus = 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface PersonRef {
  id: string;
  full_name: string;
  matricule: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string;
  project_manager: PersonRef | null;
  is_late: boolean;
  can_manage: boolean;
  stats: {
    tasks_total: number;
    tasks_done: number;
    tasks_overdue: number;
    progress_percentage: number;
    estimated_hours: number;
    approved_hours: number;
  };
}

export interface TaskItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  estimated_hours: number | null;
  approved_hours: number;
  due_date: string | null;
  is_overdue: boolean;
  assignee: PersonRef | null;
  can_manage: boolean;
  can_update_status: boolean;
  project?: { id: string; name: string; code: string | null };
}

export interface ProjectDetail extends ProjectSummary {
  tasks: TaskItem[];
}

export interface ProjectInput {
  name: string;
  code?: string | null;
  description?: string | null;
  project_manager_id?: string | null;
  start_date: string;
  end_date?: string | null;
  status?: ProjectStatus;
  budget?: number | null;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  estimated_hours?: number | null;
  due_date?: string | null;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const projectService = {
  async list(): Promise<ProjectSummary[]> {
    return (await apiClient.get<Envelope<ProjectSummary[]>>('/projects')).data;
  },
  async get(id: string): Promise<ProjectDetail> {
    return (await apiClient.get<Envelope<ProjectDetail>>(`/projects/${id}`)).data;
  },
  async create(input: ProjectInput): Promise<ProjectSummary> {
    return (await apiClient.post<Envelope<ProjectSummary>>('/projects', input)).data;
  },
  async update(id: string, input: Partial<ProjectInput>): Promise<ProjectSummary> {
    return (await apiClient.put<Envelope<ProjectSummary>>(`/projects/${id}`, input)).data;
  },
  async createTask(projectId: string, input: TaskInput): Promise<TaskItem> {
    return (await apiClient.post<Envelope<TaskItem>>(`/projects/${projectId}/tasks`, input)).data;
  },
  async updateTask(id: string, input: Partial<TaskInput>): Promise<TaskItem> {
    return (await apiClient.put<Envelope<TaskItem>>(`/tasks/${id}`, input)).data;
  },
  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/tasks/${id}`);
  },
  /** Bilan de projet PowerPoint (responsable du projet ou Direction). */
  downloadReport(project: { id: string; code: string | null; name: string }): Promise<void> {
    const slug = (project.code || project.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return apiClient.download(`/projects/${project.id}/report`, `bilan-${slug}.pptx`);
  },
  async myTasks(): Promise<TaskItem[]> {
    return (await apiClient.get<Envelope<TaskItem[]>>('/tasks/mine')).data;
  },
};
