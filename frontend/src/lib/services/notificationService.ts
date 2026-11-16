// =============================================================================
// Notification Service — NTEMO ONE
// =============================================================================

import { apiClient, ApiResponse } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCount {
  count: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const BASE = '/notifications';

export const notificationService = {
  /** Get all notifications for the current user. */
  getNotifications() {
    return apiClient.get<ApiResponse<Notification[]>>(BASE);
  },

  /** Mark a single notification as read. */
  markAsRead(id: string) {
    return apiClient.put<ApiResponse<Notification>>(
      `${BASE}/${id}/read`,
      {},
    );
  },

  /** Mark all notifications as read. */
  markAllAsRead() {
    return apiClient.post<ApiResponse<null>>(`${BASE}/read-all`);
  },

  /** Get the count of unread notifications. */
  getUnreadCount() {
    return apiClient.get<ApiResponse<UnreadCount>>(`${BASE}/unread-count`);
  },
};
