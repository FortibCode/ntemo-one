// =============================================================================
// Document Service — NTEMO ONE
// Moteur documentaire (PDF / Word), bilans Excel et badges imprimables.
// =============================================================================

import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldType = 'text' | 'date' | 'number' | 'textarea';

/** Champ complémentaire à saisir lors de la génération (variables hors fiche employé). */
export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  code: string | null;
  output_format: 'PDF' | 'DOCX' | string;
  description: string | null;
  available_variables: TemplateField[] | null;
  category: { id: string; name: string } | null;
  current_version: { id: string; version_number: string } | null;
}

export interface DocumentGeneration {
  id: string;
  title: string;
  template: string | null;
  output_format: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  file_size_bytes: number | null;
  file_hash_sha256: string | null;
  error_message: string | null;
  generated_at: string | null;
  employee: { full_name: string; matricule: string } | null;
  requested_by: string | null;
}

export interface GenerateResult {
  id: string;
  title: string;
  output_format: string;
  file_hash_sha256: string;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const documentService = {
  async templates(): Promise<DocumentTemplate[]> {
    const res = await apiClient.get<Envelope<DocumentTemplate[]>>('/documents/templates');
    return res.data;
  },

  async generations(): Promise<DocumentGeneration[]> {
    const res = await apiClient.get<Envelope<DocumentGeneration[]>>('/documents/generations');
    return res.data;
  },

  async generate(payload: {
    template_id: string;
    employee_id?: string;
    extra_variables?: Record<string, string>;
  }): Promise<GenerateResult> {
    const res = await apiClient.post<Envelope<GenerateResult>>('/documents/generate', payload);
    return res.data;
  },

  download(generation: { id: string; title: string; output_format: string }): Promise<void> {
    return apiClient.download(
      `/documents/download/${generation.id}`,
      `${generation.title}.${generation.output_format.toLowerCase()}`,
    );
  },

  /** Bilan mensuel de présence (.xlsx) — `month` au format AAAA-MM. */
  downloadMonthlyAttendance(month: string): Promise<void> {
    return apiClient.download(
      `/reports/attendance/monthly?month=${encodeURIComponent(month)}`,
      `bilan-presence-${month}.xlsx`,
    );
  },

  /** Badge imprimable recto/verso (PDF format carte). */
  downloadBadge(badgeId: string, badgeNumber: string): Promise<void> {
    return apiClient.download(`/badges/${badgeId}/print`, `badge-${badgeNumber}.pdf`);
  },
};
