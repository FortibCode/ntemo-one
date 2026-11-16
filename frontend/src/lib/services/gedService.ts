// =============================================================================
// GED Service — NTEMO ONE (pièces du dossier collaborateur)
// =============================================================================

import { apiClient } from '@/lib/api';

export type GedCategory = 'CNI' | 'PASSPORT' | 'DIPLOMA' | 'RESUME' | 'MEDICAL' | 'CONTRACT' | 'OTHER';

export const GED_CATEGORIES: Record<GedCategory, string> = {
  CNI: "Carte nationale d'identité",
  PASSPORT: 'Passeport',
  DIPLOMA: 'Diplôme',
  RESUME: 'CV',
  MEDICAL: 'Certificat médical',
  CONTRACT: 'Contrat signé',
  OTHER: 'Autre pièce',
};

/** Limite côté serveur (10 Mo). */
export const GED_MAX_BYTES = 10 * 1024 * 1024;
export const GED_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';

export interface GedDocument {
  id: string;
  title: string;
  category: GedCategory;
  file_name: string;
  mime_type: string;
  file_size: number;
  expiration_date: string | null;
  is_expired: boolean;
  is_confidential: boolean;
  uploaded_by: string | null;
  created_at: string | null;
}

export const gedService = {
  async list(employeeId: string): Promise<GedDocument[]> {
    return (await apiClient.get<{ data: GedDocument[] }>(`/employees/${employeeId}/documents`)).data;
  },

  upload(
    employeeId: string,
    input: { file: File; title: string; category: GedCategory; expiration_date?: string; is_confidential: boolean },
  ) {
    const form = new FormData();
    form.append('file', input.file);
    form.append('title', input.title);
    form.append('category', input.category);
    form.append('is_confidential', input.is_confidential ? '1' : '0');
    if (input.expiration_date) form.append('expiration_date', input.expiration_date);
    return apiClient.upload<{ data: { id: string } }>(`/employees/${employeeId}/documents`, form);
  },

  download(doc: Pick<GedDocument, 'id' | 'file_name'>): Promise<void> {
    return apiClient.download(`/employee-documents/${doc.id}/download`, doc.file_name);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/employee-documents/${id}`);
  },
};
