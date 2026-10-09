export type AnswerSource =
  | 'marked_in_document'
  | 'answer_key_in_document'
  | 'ai_suggested'
  | 'manual'
  | 'none';

export type DocumentStatus = 'uploaded' | 'processing' | 'extracted' | 'failed';

export type SessionMode = 'exam' | 'practice';

export type FileType = 'pdf' | 'image' | 'docx' | 'text' | 'other';

export interface QuestionOption {
  label: string;
  text: string;
}

/**
 * Test-taking question representation.
 * Structurally guaranteed to have ZERO answer leakage.
 */
export interface TestQuestion {
  id: string;
  document_id: string;
  number?: number | null;
  text: string;
  options: QuestionOption[];
  source_page?: number | null;
  context?: string | null;
  figure_image_url?: string | null;
}

/**
 * Full question representation (used only for review/edit screens).
 */
export interface QuestionDetail {
  id: string;
  document_id: string;
  number?: number | null;
  text: string;
  options: QuestionOption[];
  correct_options: string[];
  answer_source: AnswerSource;
  confidence: number;
  source_page?: number | null;
  explanation?: string | null;
  context?: string | null;
  figure_image_url?: string | null;
  needs_review: boolean;
}

export interface QuestionCreate {
  number?: number | null;
  text: string;
  options: QuestionOption[];
  correct_options?: string[];
  answer_source?: AnswerSource;
  confidence?: number;
  source_page?: number | null;
  explanation?: string | null;
  context?: string | null;
  figure_image_url?: string | null;
  needs_review?: boolean;
}

export interface QuestionUpdate {
  text?: string;
  number?: number | null;
  options?: QuestionOption[];
  correct_options?: string[];
  answer_source?: AnswerSource;
  confidence?: number;
  explanation?: string | null;
  context?: string | null;
  figure_image_url?: string | null;
  needs_review?: boolean;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  file_type: FileType;
  page_count: number;
  pages_processed?: number;
  progress?: number;
  status: DocumentStatus;
  error_message?: string | null;
  created_at: string;
  question_count?: number;
}

export interface DocumentLibraryItem extends DocumentResponse {
  best_score?: number | null;
  last_score?: number | null;
  attempt_count: number;
}

export interface AttemptHistoryItem {
  session_id: string;
  mode: SessionMode;
  started_at: string;
  submitted_at: string;
  score_percentage: number;
  score_earned: number;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  time_taken_seconds: number;
  passed?: boolean | null;
  target_score_percentage?: number | null;
}

export interface WeakQuestionItem {
  question_id: string;
  number?: number | null;
  text: string;
  options: QuestionOption[];
  correct_options: string[];
  answer_source: AnswerSource;
  explanation?: string | null;
  context?: string | null;
  figure_image_url?: string | null;
  mistake_count: number;
  attempt_count: number;
  error_rate: number;
}

export interface DocumentImportRequest {
  filename?: string;
  questions: QuestionCreate[];
}

export interface SessionCreate {
  document_id: string;
  mode?: SessionMode;
  time_limit_seconds?: number | null;
  question_count?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  negative_marking?: number;
  target_score_percentage?: number | null;
  partial_credit?: boolean;
}

export interface RetakeRequest {
  mode: 'same' | 'wrong_and_unanswered';
}

export interface TestSessionResponse {
  id: string;
  document_id: string;
  mode: SessionMode;
  time_limit_seconds?: number | null;
  negative_marking?: number;
  target_score_percentage?: number | null;
  partial_credit?: boolean;
  started_at: string;
  submitted_at?: string | null;
  question_order: string[];
  questions: TestQuestion[];
  answers?: AnswerSaveItem[];
}

export interface PracticeCheckRequest {
  selected_options: string[];
  time_spent_seconds?: number;
}

export interface PracticeFeedbackResponse {
  question_id: string;
  is_correct: boolean;
  correct_options: string[];
  explanation?: string | null;
  answer_source: AnswerSource;
}

export interface AnswerSaveItem {
  question_id: string;
  selected_options: string[];
  flagged?: boolean;
  time_spent_seconds?: number;
}

export interface AnswerProgressUpdate {
  answers: AnswerSaveItem[];
}

export interface AnswerProgressResponse {
  session_id: string;
  saved_count: number;
  updated_at: string;
}

export interface QuestionResult {
  question_id: string;
  number?: number | null;
  text: string;
  options: QuestionOption[];
  selected_options: string[];
  correct_options: string[];
  is_correct: boolean;
  is_graded: boolean;
  is_partial: boolean;
  score_earned: number;
  answer_source: AnswerSource;
  explanation?: string | null;
  context?: string | null;
  figure_image_url?: string | null;
  time_spent_seconds: number;
  flagged?: boolean;
}

export interface SubmissionResponse {
  session_id: string;
  document_id: string;
  mode: SessionMode;
  started_at: string;
  submitted_at: string;
  total_questions: number;
  total_graded: number;
  attempted_count: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  ungraded_count: number;
  score_earned: number;
  score_percentage: number;
  target_score_percentage?: number | null;
  passed?: boolean | null;
  time_taken_seconds: number;
  avg_time_per_question_seconds: number;
  partial_credit?: boolean;
  negative_marking?: number;
  results: QuestionResult[];
}

export interface HealthCheckResponse {
  status: string;
  app: string;
  version: string;
  timestamp: string;
}
