import { apiClient } from './client';
import type {
  DocumentResponse,
  DocumentLibraryItem,
  AttemptHistoryItem,
  WeakQuestionItem,
  DocumentImportRequest,
  TestSessionResponse,
  QuestionDetail,
  QuestionCreate,
} from '../types';

export async function uploadDocument(formData: FormData): Promise<DocumentResponse> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const json = await response.json();
      errorDetail = json.detail || json.message || errorDetail;
    } catch {
      // fallback
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  return apiClient<DocumentResponse>(`/api/documents/${id}`);
}

export async function getDocumentPages(id: string): Promise<{
  document_id: string;
  total_pages: number;
  pages?: string[];
}> {
  return apiClient(`/api/documents/${id}/pages`);
}

export function getPageImageUrl(docId: string, pageNum: number): string {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  return `${API_BASE_URL}/api/documents/${docId}/pages/${pageNum}`;
}

export async function getDocumentQuestions(id: string): Promise<QuestionDetail[]> {
  return apiClient<QuestionDetail[]>(`/api/documents/${id}/questions`);
}

export async function addDocumentQuestion(
  docId: string,
  payload: QuestionCreate
): Promise<QuestionDetail> {
  return apiClient<QuestionDetail>(`/api/documents/${docId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function applyAnswerKey(
  docId: string,
  keyText: string
): Promise<QuestionDetail[]> {
  return apiClient<QuestionDetail[]>(`/api/documents/${docId}/apply-answer-key`, {
    method: 'POST',
    body: JSON.stringify({ key_text: keyText }),
  });
}

export async function suggestAnswers(docId: string): Promise<QuestionDetail[]> {
  return apiClient<QuestionDetail[]>(`/api/documents/${docId}/suggest-answers`, {
    method: 'POST',
  });
}

export async function listDocuments(): Promise<DocumentLibraryItem[]> {
  return apiClient<DocumentLibraryItem[]>('/api/documents');
}

export async function renameDocument(id: string, filename: string): Promise<DocumentResponse> {
  return apiClient<DocumentResponse>(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ filename }),
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

export async function getDocumentAttempts(id: string): Promise<AttemptHistoryItem[]> {
  return apiClient<AttemptHistoryItem[]>(`/api/documents/${id}/attempts`);
}

export async function getDocumentWeakQuestions(id: string): Promise<WeakQuestionItem[]> {
  return apiClient<WeakQuestionItem[]>(`/api/documents/${id}/weak-questions`);
}

export async function practiceWeakQuestions(id: string): Promise<TestSessionResponse> {
  return apiClient<TestSessionResponse>(`/api/documents/${id}/practice-weak`, {
    method: 'POST',
  });
}

export function getExportJsonUrl(docId: string): string {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  return `${API_BASE_URL}/api/documents/${docId}/export/json`;
}

export function getExportPdfUrl(docId: string, includeAnswerKey: boolean = false): string {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  return `${API_BASE_URL}/api/documents/${docId}/export/pdf?include_answer_key=${includeAnswerKey}`;
}

export async function importDocumentJson(payload: DocumentImportRequest): Promise<DocumentResponse> {
  return apiClient<DocumentResponse>('/api/documents/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function triggerAiExtraction(id: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/api/documents/${id}/extract`, {
    method: 'POST',
  });
}
