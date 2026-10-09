import { apiClient } from './client';
import type { 
  SessionCreate, 
  TestSessionResponse, 
  AnswerProgressUpdate, 
  AnswerProgressResponse, 
  SubmissionResponse,
  PracticeCheckRequest,
  PracticeFeedbackResponse
} from '../types';

export async function createSession(payload: SessionCreate): Promise<TestSessionResponse> {
  return apiClient<TestSessionResponse>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getSession(sessionId: string): Promise<TestSessionResponse> {
  return apiClient<TestSessionResponse>(`/api/sessions/${sessionId}`);
}

export async function saveAnswers(
  sessionId: string, 
  payload: AnswerProgressUpdate
): Promise<AnswerProgressResponse> {
  return apiClient<AnswerProgressResponse>(`/api/sessions/${sessionId}/answers`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function checkPracticeQuestion(
  sessionId: string,
  questionId: string,
  payload: PracticeCheckRequest
): Promise<PracticeFeedbackResponse> {
  return apiClient<PracticeFeedbackResponse>(`/api/sessions/${sessionId}/questions/${questionId}/check`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitSession(sessionId: string): Promise<SubmissionResponse> {
  return apiClient<SubmissionResponse>(`/api/sessions/${sessionId}/submit`, {
    method: 'POST',
  });
}

export async function retakeSession(
  sessionId: string,
  mode: 'same' | 'wrong_and_unanswered' = 'same'
): Promise<TestSessionResponse> {
  return apiClient<TestSessionResponse>(`/api/sessions/${sessionId}/retake`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function overrideSessionAnswer(
  sessionId: string,
  payload: { question_id: string; correct_options: string[]; explanation?: string }
): Promise<SubmissionResponse> {
  return apiClient<SubmissionResponse>(`/api/sessions/${sessionId}/override-answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
