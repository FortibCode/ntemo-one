// =============================================================================
// AI Service — NTEMO AI (permission `ai.use`)
// =============================================================================

import { apiClient } from '@/lib/api';

export interface AiStatus {
  enabled: boolean;
  model: string | null;
  task_types: Record<string, string>;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiConversation {
  id: string;
  title: string;
  updated_at: string;
  messages: AiMessage[];
}

export interface AiDraft {
  id: string;
  task_type: string;
  user_prompt: string;
  generated_draft: string;
  source?: 'claude' | 'demo';
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const aiService = {
  async status(): Promise<AiStatus> {
    return (await apiClient.get<Envelope<AiStatus>>('/ai/status')).data;
  },
  async conversations(): Promise<AiConversation[]> {
    return (await apiClient.get<Envelope<AiConversation[]>>('/ai/conversations')).data;
  },
  async createConversation(title: string): Promise<AiConversation> {
    return (await apiClient.post<Envelope<AiConversation>>('/ai/conversations', { title })).data;
  },
  async send(conversationId: string, message: string) {
    return (
      await apiClient.post<Envelope<{ user_message: AiMessage; assistant_message: AiMessage; source: 'claude' | 'demo' }>>(
        `/ai/conversations/${conversationId}/messages`,
        { message },
      )
    ).data;
  },
  async draft(taskType: string, prompt: string): Promise<AiDraft> {
    return (await apiClient.post<Envelope<AiDraft>>('/ai/tasks/draft', { task_type: taskType, prompt })).data;
  },
};
