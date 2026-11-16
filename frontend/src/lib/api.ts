// =============================================================================
// Base API Client — NTEMO ONE
// Wraps fetch with auth token injection, typed errors, and convenience methods.
// =============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard envelope returned by Laravel API responses. */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: PaginationMeta;
  links?: PaginationLinks;
}

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface PaginationLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

/** Typed error thrown by the API client. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly errors: Record<string, string[]> | null;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** Query-param value types accepted by GET helpers. */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('ntemo_token');
    }
  }

  // -- Token management -----------------------------------------------------

  setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('ntemo_token', token);
      } else {
        localStorage.removeItem('ntemo_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('ntemo_token');
    }
    return this.token;
  }

  // -- Core request ---------------------------------------------------------

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    // Only set Content-Type for requests that carry a body
    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message: string =
        data?.message || `Erreur serveur (${response.status})`;
      const errors: Record<string, string[]> | null = data?.errors ?? null;
      throw new ApiError(message, response.status, errors);
    }

    return data as T;
  }

  // -- Convenience verbs ----------------------------------------------------

  get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      });
      const qs = query.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Télécharge un fichier protégé (PDF, DOCX, XLSX…) avec le jeton d'authentification
   * et déclenche l'enregistrement dans le navigateur.
   */
  async download(endpoint: string, fallbackName: string): Promise<void> {
    const headers = new Headers({ Accept: '*/*' });
    const token = this.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(
        data?.message || `Téléchargement impossible (${response.status})`,
        response.status,
        data?.errors ?? null,
      );
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : fallbackName;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Singleton
export const apiClient = new ApiClient();
