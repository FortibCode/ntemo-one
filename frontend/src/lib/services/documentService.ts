// =============================================================================
// Document Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse, QueryParams } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  title: string;
  type: string;
  template_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  file_url: string;
  file_size: number;
  mime_type: string;
  checksum: string;
  status: 'DRAFT' | 'GENERATED' | 'SIGNED' | 'ARCHIVED';
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFilters extends QueryParams {
  employee_id?: string;
  type?: string;
  status?: Document['status'];
  search?: string;
  page?: number;
  per_page?: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  description: string | null;
  variables: string[];
  is_active: boolean;
}

export interface GenerateDocumentData {
  template_id: string;
  employee_id?: string;
  variables?: Record<string, string>;
}

export interface DocumentVerification {
  valid: boolean;
  document_id: string | null;
  title: string | null;
  generated_at: string | null;
}

export interface PaginatedDocuments {
  data: Document[];
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

const BASE = '/documents';

export const documentService = {
  /** List documents with optional filters & pagination. */
  getDocuments(filters?: DocumentFilters) {
    return apiClient.get<PaginatedDocuments>(BASE, filters);
  },

  /** Generate a document from a template. */
  generateDocument(templateId: string, data: Omit<GenerateDocumentData, 'template_id'> = {}) {
    return apiClient.post<ApiResponse<Document>>(BASE, {
      template_id: templateId,
      ...data,
    });
  },

  /** List available document templates. */
  getTemplates() {
    return apiClient.get<ApiResponse<DocumentTemplate[]>>(`${BASE}/templates`);
  },

  /** Download a document (returns a Blob URL). */
  async downloadDocument(id: string) {
    return apiClient.get<ApiResponse<{ download_url: string }>>(
      `${BASE}/${id}/download`,
    );
  },

  /** Verify a document's authenticity by checksum. */
  verifyDocument(checksum: string) {
    return apiClient.post<ApiResponse<DocumentVerification>>(
      `${BASE}/verify`,
      { checksum },
    );
  },
};
