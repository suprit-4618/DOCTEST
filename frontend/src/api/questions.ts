import { apiClient } from './client';
import type { QuestionDetail, QuestionUpdate } from '../types';

export async function getQuestion(id: string): Promise<QuestionDetail> {
  return apiClient<QuestionDetail>(`/api/questions/${id}`);
}

export async function updateQuestion(id: string, payload: QuestionUpdate): Promise<QuestionDetail> {
  return apiClient<QuestionDetail>(`/api/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestion(id: string): Promise<void> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const response = await fetch(`${API_BASE_URL}/api/questions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete question (${response.status})`);
  }
}

export interface AiVerifyResponse {
  question_id: string;
  suggested_options: string[];
  explanation: string;
  applied: boolean;
}

export async function aiVerifyQuestion(
  questionId: string,
  apply: boolean = false
): Promise<AiVerifyResponse> {
  return apiClient<AiVerifyResponse>(`/api/questions/${questionId}/ai-verify?apply=${apply}`, {
    method: 'POST',
  });
}

