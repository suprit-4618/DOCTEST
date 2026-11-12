import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bot,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Edit3,
  Trash2,
  Plus,
  KeyRound,
  Eye,
  Play,
  ArrowUpDown,
  Filter,
  ShieldCheck,
  Loader2,
  X,
  Check,
  BookOpen,
  Image as ImageIcon
} from 'lucide-react';
import { FormattedContent } from '../components/FormattedContent';
import {
  getDocument,
  getDocumentQuestions,
  addDocumentQuestion,
  applyAnswerKey,
  suggestAnswers,
  getPageImageUrl
} from '../api/documents';
import { updateQuestion, deleteQuestion, aiVerifyQuestion } from '../api/questions';
import type {
  DocumentResponse,
  QuestionDetail,
  QuestionOption,
  QuestionCreate,
  QuestionUpdate,
  AnswerSource
} from '../types';

export const ReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [filterType, setFilterType] = useState<'all' | 'needs_review' | 'no_answer' | 'has_answer'>('all');
  const [sortByReview, setSortByReview] = useState<boolean>(false);

  // Modals & Action States
  const [editingQuestion, setEditingQuestion] = useState<QuestionDetail | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState<boolean>(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [answerKeyInput, setAnswerKeyInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [aiVerifyingId, setAiVerifyingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // New Question Form state
  const [newQText, setNewQText] = useState<string>('');
  const [newQOptions, setNewQOptions] = useState<QuestionOption[]>([
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ]);
  const [newQCorrect, setNewQCorrect] = useState<string[]>([]);
  const [newQExplanation, setNewQExplanation] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [docData, questionsData] = await Promise.all([
        getDocument(id),
        getDocumentQuestions(id),
      ]);
      setDoc(docData);
      setQuestions(questionsData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load questions';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handlers
  const handleDelete = async (questionId: string, qNumber?: number | null) => {
    if (!window.confirm(`Are you sure you want to delete Question ${qNumber || ''}?`)) return;
    try {
      await deleteQuestion(questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      showNotification('Question deleted');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    try {
      setActionLoading(true);
      const updatePayload: QuestionUpdate = {
        text: editingQuestion.text,
        options: editingQuestion.options,
        correct_options: editingQuestion.correct_options,
        explanation: editingQuestion.explanation,
        needs_review: editingQuestion.needs_review,
      };
      const updated = await updateQuestion(editingQuestion.id, updatePayload);
      setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setEditingQuestion(null);
      showNotification('Question updated');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update question');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newQText.trim()) return;
    try {
      setActionLoading(true);
      const payload: QuestionCreate = {
        number: questions.length + 1,
        text: newQText,
        options: newQOptions.filter((o) => o.text.trim().length > 0),
        correct_options: newQCorrect,
        explanation: newQExplanation,
      };
      const created = await addDocumentQuestion(id, payload);
      setQuestions((prev) => [...prev, created]);
      setIsAddingQuestion(false);
      setNewQText('');
      setNewQOptions([
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' },
      ]);
      setNewQCorrect([]);
      setNewQExplanation('');
      showNotification('New question added');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyKey = async () => {
    if (!id || !answerKeyInput.trim()) return;
    try {
      setActionLoading(true);
      const result = await applyAnswerKey(id, answerKeyInput.trim());
      setQuestions(result);
      setIsAnswerKeyOpen(false);
      setAnswerKeyInput('');
      showNotification(`Answer key applied successfully!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to apply answer key');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuggestAnswers = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const result = await suggestAnswers(id);
      setQuestions(result);
      showNotification(`AI solved and verified questions.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to suggest answers');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAiVerifySingle = async (questionId: string) => {
    try {
      setAiVerifyingId(questionId);
      const verified = await aiVerifyQuestion(questionId, true);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                correct_options: verified.suggested_options,
                explanation: verified.explanation,
                answer_source: 'ai_suggested',
                needs_review: false,
              }
            : q
        )
      );
      showNotification(`Question verified: answer is ${verified.suggested_options.join(', ')}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'AI verification failed');
    } finally {
      setAiVerifyingId(null);
    }
  };

  // Metrics
  const totalCount = questions.length;
  const withAnswersCount = questions.filter((q) => q.correct_options && q.correct_options.length > 0).length;
  const noAnswersCount = totalCount - withAnswersCount;
  const needsReviewCount = questions.filter((q) => q.needs_review || q.confidence < 0.85).length;

  // Filtered & Sorted list
  const filteredQuestions = questions.filter((q) => {
    if (filterType === 'needs_review') return q.needs_review || q.confidence < 0.85;
    if (filterType === 'no_answer') return !q.correct_options || q.correct_options.length === 0;
    if (filterType === 'has_answer') return q.correct_options && q.correct_options.length > 0;
    return true;
  });

  const displayedQuestions = [...filteredQuestions].sort((a, b) => {
    if (sortByReview) {
      const aReview = a.needs_review || a.confidence < 0.85 ? 1 : 0;
      const bReview = b.needs_review || b.confidence < 0.85 ? 1 : 0;
      if (bReview !== aReview) return bReview - aReview;
    }
    return (a.number || 0) - (b.number || 0);
  });

  const getSourceBadge = (source?: AnswerSource) => {
    switch (source) {
      case 'marked_in_document':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Marked in Doc
          </span>
        );
      case 'answer_key_in_document':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <KeyRound className="w-3 h-3 text-emerald-400" /> Answer Key
          </span>
        );
      case 'ai_suggested':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Bot className="w-3 h-3 text-orange-400" /> AI Suggested
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Edit3 className="w-3 h-3" /> Manual Edit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="w-3 h-3 text-slate-400" /> No Answer
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">Loading question bank...</p>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 font-heading">Failed to Load Questions</h2>
        <p className="text-slate-400 text-sm mt-2">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs font-semibold transition cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 border border-emerald-500/40 text-slate-100 shadow-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
            <span>&bull;</span>
            <Link to={`/documents/${id}`} className="hover:text-slate-200 transition-colors">{doc?.filename}</Link>
            <span>&bull;</span>
            <span className="text-orange-400 font-semibold">Question Review</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight font-heading">
            Review &amp; Edit Questions
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/documents/${id}/setup`)}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Configure &amp; Start Test</span>
          </button>
        </div>
      </div>

      {/* Security Callout */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium mb-6">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>
          <strong className="text-slate-100">Isolated Environment:</strong> Questions and answers are maintained here for instructor review. During examination mode, answer keys remain isolated on the server.
        </span>
      </div>

      {/* Summary Header Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Questions</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{totalCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Answers Detected</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{withAnswersCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Un-annotated</div>
          <div className="text-2xl font-bold text-orange-400 mt-1 font-mono">{noAnswersCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Needs Review</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{needsReviewCount}</div>
        </div>
      </div>

      {/* Un-annotated Questions Warning Banner */}
      {noAnswersCount > 0 && (
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-8">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-grow">
              <h3 className="text-sm font-bold text-slate-100 font-heading">
                {noAnswersCount} question{noAnswersCount > 1 ? 's do' : ' does'} not have an answer detected yet
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Choose how you would like to proceed:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <button
                  onClick={handleSuggestAnswers}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Auto-Solve with AI</span>
                </button>

                <button
                  onClick={() => setIsAnswerKeyOpen(true)}
                  className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                  <span>Paste Bulk Answer Key</span>
                </button>

                <button
                  onClick={() => navigate(`/documents/${id}/setup`)}
                  className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Practice Without Key</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters, Sorting, Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 mb-6">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-orange-400" /> Filter:
          </span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'all' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('needs_review')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'needs_review' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Needs Review ({needsReviewCount})
          </button>
          <button
            onClick={() => setFilterType('no_answer')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'no_answer' ? 'bg-orange-700 text-white shadow-sm' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            No Answer ({noAnswersCount})
          </button>
          <button
            onClick={() => setFilterType('has_answer')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'has_answer' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            With Answers ({withAnswersCount})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSortByReview(!sortByReview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              sortByReview
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : 'bg-slate-850 border-slate-750 text-slate-300 hover:text-slate-100'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort Review</span>
          </button>

          <button
            onClick={() => setIsAnswerKeyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 text-xs font-semibold transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-orange-400" />
            <span>Answer Key</span>
          </button>

          <button
            onClick={handleSuggestAnswers}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            title="Auto-solve answers across all questions in the document"
          >
            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            <span>Auto-Solve All</span>
          </button>

          <button
            onClick={() => setIsAddingQuestion(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Question Cards List & Empty State */}
      {displayedQuestions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 my-8">
          <div className="w-12 h-12 rounded-full bg-slate-850 flex items-center justify-center mx-auto text-slate-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 font-heading">No Multiple-Choice Questions Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            {questions.length === 0
              ? 'No multiple-choice questions were detected in this document. You can add questions manually or import an answer key.'
              : 'No questions match the selected filter.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsAddingQuestion(true)}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question Manually</span>
            </button>
            <button
              onClick={() => setIsAnswerKeyOpen(true)}
              className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 border border-slate-750 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-orange-400" />
              <span>Set Answer Key</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          {displayedQuestions.map((q) => {
            const isHighReview = q.needs_review || q.confidence < 0.85;
            return (
              <div
                key={q.id}
                className={`p-6 rounded-2xl border transition-colors ${
                  isHighReview
                    ? 'bg-slate-900 border-amber-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-750'
                }`}
              >
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800 gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-xs flex items-center justify-center font-mono">
                      Q{q.number || '·'}
                    </span>
                    {getSourceBadge(q.answer_source)}

                    {isHighReview && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" /> Needs Review ({Math.round(q.confidence * 100)}%)
                      </span>
                    )}

                    {q.source_page && (
                      <button
                        onClick={() => setPreviewPage(q.source_page ?? 1)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-850 text-slate-400 hover:text-orange-400 border border-slate-800 transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Page {q.source_page}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAiVerifySingle(q.id)}
                      disabled={aiVerifyingId === q.id}
                      className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-orange-400 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5 px-3 disabled:opacity-50"
                      title="Run AI Solver on this specific question to verify correct answer"
                    >
                      {aiVerifyingId === q.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-orange-400" />
                      )}
                      <span>AI Verify</span>
                    </button>

                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white transition cursor-pointer text-xs font-semibold flex items-center gap-1.5 px-3"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(q.id, q.number)}
                      className="p-1.5 rounded-lg bg-slate-850 hover:bg-red-500/20 border border-slate-750 text-slate-400 hover:text-red-400 transition cursor-pointer text-xs"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Shared Passage / Context */}
                {q.context && (
                  <div className="my-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-orange-400 mb-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Reading Passage / Reference Context</span>
                    </div>
                    <FormattedContent text={q.context} className="leading-relaxed" />
                  </div>
                )}

                {/* Figure / Diagram Image */}
                {q.figure_image_url && (
                  <div className="my-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
                    <div className="flex items-center gap-1.5 self-start text-xs font-semibold text-slate-400 mb-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                      <span>Referenced Figure</span>
                    </div>
                    <img
                      src={q.figure_image_url}
                      alt={`Diagram for Q${q.number}`}
                      className="max-h-56 object-contain rounded-lg border border-slate-800 shadow-sm"
                    />
                  </div>
                )}

                {/* Question Text */}
                <FormattedContent text={q.text} className="py-3 text-slate-100 text-base font-semibold leading-relaxed" />

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pb-3">
                  {q.options.map((opt) => {
                    const isCorrect = q.correct_options.includes(opt.label);
                    return (
                      <div
                        key={opt.label}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs transition-colors ${
                          isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center flex-shrink-0 text-xs ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-850 text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <FormattedContent text={opt.text} as="span" className="flex-grow font-normal text-slate-200" />
                        {isCorrect && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 stroke-[2.5]" />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="mt-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    <strong className="text-slate-200 block mb-1 font-semibold">Explanation:</strong>
                    <FormattedContent text={q.explanation} className="leading-relaxed pl-2 font-normal" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Edit Question Inline */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-heading">
                <Edit3 className="w-5 h-5 text-orange-400" />
                Edit Question {editingQuestion.number}
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Question Text
                </label>
                <textarea
                  rows={3}
                  value={editingQuestion.text}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, text: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-heading">
                    Options &amp; Correct Answers (Click letter to toggle correct answer)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLabel = String.fromCharCode(65 + editingQuestion.options.length);
                      setEditingQuestion({
                        ...editingQuestion,
                        options: [...editingQuestion.options, { label: nextLabel, text: '' }],
                      });
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
                  >
                    + Add Option
                  </button>
                </div>

                <div className="space-y-2">
                  {editingQuestion.options.map((opt, idx) => {
                    const isCorrect = editingQuestion.correct_options.includes(opt.label);
                    return (
                      <div key={opt.label} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nextCorrect = isCorrect
                              ? editingQuestion.correct_options.filter((c) => c !== opt.label)
                              : [...editingQuestion.correct_options, opt.label];
                            setEditingQuestion({ ...editingQuestion, correct_options: nextCorrect });
                          }}
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center flex-shrink-0 cursor-pointer transition ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                          title="Toggle as correct answer"
                        >
                          {opt.label}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const newOpts = [...editingQuestion.options];
                            newOpts[idx].text = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="flex-grow px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = editingQuestion.options.filter((_, i) => i !== idx);
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Explanation
                </label>
                <input
                  type="text"
                  value={editingQuestion.explanation || ''}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  placeholder="Optional answer explanation"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="needs_review_cb"
                  checked={editingQuestion.needs_review}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, needs_review: e.target.checked })
                  }
                  className="rounded border-slate-700 text-orange-600 focus:ring-orange-500 accent-orange-600"
                />
                <label htmlFor="needs_review_cb" className="text-xs text-slate-300">
                  Mark as needing further review
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Set Answer Key */}
      {isAnswerKeyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-heading">
                <KeyRound className="w-5 h-5 text-orange-400" />
                Bulk Set Answer Key
              </h3>
              <button onClick={() => setIsAnswerKeyOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste answer key formatted as <code className="text-orange-400">1-B, 2-D, 3-A</code> or <code className="text-orange-400">1. B 2. C 3. D</code>.
            </p>

            <textarea
              rows={4}
              value={answerKeyInput}
              onChange={(e) => setAnswerKeyInput(e.target.value)}
              placeholder="e.g. 1-B, 2-D, 3-A, 4-C, 5-B..."
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm font-mono focus:outline-none focus:border-orange-500 transition-colors"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAnswerKeyOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-750"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyKey}
                disabled={actionLoading || !answerKeyInput.trim()}
                className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
              >
                Apply Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Manual Question */}
      {isAddingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-heading">
                <Plus className="w-5 h-5 text-orange-400" />
                Add New Question Manually
              </h3>
              <button onClick={() => setIsAddingQuestion(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Question Text
                </label>
                <textarea
                  rows={3}
                  required
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="Enter the question prompt..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-heading">
                  Options (Click letter to toggle as correct)
                </label>
                <div className="space-y-2">
                  {newQOptions.map((opt, idx) => {
                    const isCorrect = newQCorrect.includes(opt.label);
                    return (
                      <div key={opt.label} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewQCorrect((prev) =>
                              prev.includes(opt.label)
                                ? prev.filter((c) => c !== opt.label)
                                : [...prev, opt.label]
                            );
                          }}
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center flex-shrink-0 cursor-pointer ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          placeholder={`Option ${opt.label} text`}
                          onChange={(e) => {
                            const updated = [...newQOptions];
                            updated[idx].text = e.target.value;
                            setNewQOptions(updated);
                          }}
                          className="flex-grow px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Explanation
                </label>
                <input
                  type="text"
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  placeholder="Optional explanation for the correct answer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingQuestion(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newQText.trim()}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Source Page Image Preview */}
      {previewPage && id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-heading">
                <Eye className="w-5 h-5 text-orange-400" />
                Original Document Page {previewPage}
              </h3>
              <button onClick={() => setPreviewPage(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-grow overflow-auto flex items-center justify-center p-2 bg-slate-950 rounded-xl border border-slate-800">
              <img
                src={getPageImageUrl(id, previewPage)}
                alt={`Source Page ${previewPage}`}
                className="max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
