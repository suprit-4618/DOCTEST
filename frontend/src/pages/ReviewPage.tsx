import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
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

  // Metrics
  const totalCount = questions.length;
  const withAnswersCount = questions.filter((q) => q.correct_options && q.correct_options.length > 0).length;
  const noAnswersCount = totalCount - withAnswersCount;
  const needsReviewCount = questions.filter((q) => q.needs_review || q.confidence < 0.85).length;

  // Filtered & Sorted questions
  const displayedQuestions = questions
    .filter((q) => {
      if (filterType === 'needs_review') return q.needs_review || q.confidence < 0.85;
      if (filterType === 'no_answer') return !q.correct_options || q.correct_options.length === 0;
      if (filterType === 'has_answer') return q.correct_options && q.correct_options.length > 0;
      return true;
    })
    .sort((a, b) => {
      if (sortByReview) {
        if (a.needs_review && !b.needs_review) return -1;
        if (!a.needs_review && b.needs_review) return 1;
      }
      return (a.number || 0) - (b.number || 0);
    });

  // Handle Edit Question Save
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    try {
      setActionLoading(true);
      const payload: QuestionUpdate = {
        text: editingQuestion.text,
        number: editingQuestion.number,
        options: editingQuestion.options,
        correct_options: editingQuestion.correct_options,
        answer_source: editingQuestion.correct_options.length > 0 ? 'manual' : 'none',
        explanation: editingQuestion.explanation,
        needs_review: editingQuestion.needs_review,
      };

      const updated = await updateQuestion(editingQuestion.id, payload);
      setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setEditingQuestion(null);
      showNotification(`Question ${updated.number || ''} updated successfully.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Question
  const handleDelete = async (qId: string, qNum?: number | null) => {
    if (!confirm(`Are you sure you want to delete Question ${qNum || ''}?`)) return;
    try {
      setActionLoading(true);
      await deleteQuestion(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      showNotification(`Question ${qNum || ''} deleted.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Question
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newQText.trim()) return;

    try {
      setActionLoading(true);
      const payload: QuestionCreate = {
        number: questions.length + 1,
        text: newQText.trim(),
        options: newQOptions.filter((o) => o.text.trim() !== ''),
        correct_options: newQCorrect,
        answer_source: newQCorrect.length > 0 ? 'manual' : 'none',
        explanation: newQExplanation.trim() || undefined,
        needs_review: false,
      };

      const created = await addDocumentQuestion(id, payload);
      setQuestions((prev) => [...prev, created]);
      setIsAddingQuestion(false);
      setNewQText('');
      setNewQCorrect([]);
      setNewQExplanation('');
      showNotification(`Question ${created.number} added manually.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Bulk Apply Answer Key
  const handleApplyKey = async () => {
    if (!id || !answerKeyInput.trim()) return;
    try {
      setActionLoading(true);
      const updated = await applyAnswerKey(id, answerKeyInput);
      setQuestions(updated);
      setIsAnswerKeyOpen(false);
      setAnswerKeyInput('');
      showNotification('Answer key applied successfully to all matching questions!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to apply answer key');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Suggest Answers
  const handleSuggestAnswers = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const updated = await suggestAnswers(id);
      setQuestions(updated);
      showNotification('AI answer suggestions generated for questions!', 'info');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setActionLoading(false);
    }
  };

  const [aiVerifyingId, setAiVerifyingId] = useState<string | null>(null);

  const handleAiVerifySingle = async (qId: string) => {
    try {
      setAiVerifyingId(qId);
      const res = await aiVerifyQuestion(qId, true);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === qId
            ? {
                ...q,
                correct_options: res.suggested_options,
                answer_source: 'ai_suggested',
                explanation: res.explanation,
                needs_review: false,
              }
            : q
        )
      );
      showNotification(`AI verified Question! Correct option: [${res.suggested_options.join(', ')}]`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'AI verification failed');
    } finally {
      setAiVerifyingId(null);
    }
  };


  const getSourceBadge = (source: AnswerSource) => {
    switch (source) {
      case 'marked_in_document':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <CheckCircle2 className="w-3 h-3" /> Marked in Doc
          </span>
        );
      case 'answer_key_in_document':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <KeyRound className="w-3 h-3" /> Answer Key
          </span>
        );
      case 'ai_suggested':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">
            <Sparkles className="w-3 h-3 text-violet-400" /> AI Suggested
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Edit3 className="w-3 h-3" /> Manual Edit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle className="w-3 h-3" /> No Answer
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
        <p className="text-slate-400">Loading extracted questions for review...</p>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Failed to Load Questions</h2>
        <p className="text-slate-400 text-sm mt-2">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 border border-indigo-500/40 text-white shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Top Breadcrumb & Security Note */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="hover:text-white">Home</Link>
            <span>&bull;</span>
            <Link to={`/documents/${id}`} className="hover:text-white">{doc?.filename}</Link>
            <span>&bull;</span>
            <span className="text-rose-400 font-bold">Question Review</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">
            Review &amp; Edit Questions 🍵
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/documents/${id}/setup`)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:opacity-95 text-white font-black text-xs shadow-cozy hover:shadow-cozy-hover transition-all duration-200 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Configure &amp; Start Test ✨</span>
          </button>
        </div>
      </div>

      {/* Security Callout */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-400/25 text-rose-600 dark:text-rose-200 text-xs font-semibold mb-6 shadow-sm">
        <ShieldCheck className="w-4 h-4 text-rose-400 flex-shrink-0" />
        <span>
          <strong>Zero Leakage:</strong> This is your review shelf where answers are visible for editing. During the quiz, answers and hints are kept safely isolated on the server.
        </span>
      </div>

      {/* Summary Header Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-3xl bg-slate-900/90 border-2 border-slate-800/80 shadow-cozy text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Questions</div>
          <div className="text-2xl font-black text-white mt-1 font-heading">{totalCount}</div>
        </div>
        <div className="p-4 rounded-3xl bg-slate-900/90 border-2 border-slate-800/80 shadow-cozy text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Answers Detected</div>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-heading">{withAnswersCount}</div>
        </div>
        <div className="p-4 rounded-3xl bg-slate-900/90 border-2 border-slate-800/80 shadow-cozy text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Un-annotated</div>
          <div className="text-2xl font-black text-rose-400 mt-1 font-heading">{noAnswersCount}</div>
        </div>
        <div className="p-4 rounded-3xl bg-slate-900/90 border-2 border-slate-800/80 shadow-cozy text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Needs Review</div>
          <div className="text-2xl font-black text-amber-400 mt-1 font-heading">{needsReviewCount}</div>
        </div>
      </div>

      {/* Un-annotated Questions Warning Banner */}
      {noAnswersCount > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-400/30 mb-8 shadow-cozy">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-grow">
              <h3 className="text-sm font-bold text-white font-heading">
                {noAnswersCount} question{noAnswersCount > 1 ? 's do' : ' does'} not have an answer detected yet
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Choose how you would like to proceed with the un-annotated questions:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <button
                  onClick={handleSuggestAnswers}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-cozy-pill"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>(b) Ask AI to Suggest Answers</span>
                </button>

                <button
                  onClick={() => setIsAnswerKeyOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-cozy-pill"
                >
                  <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                  <span>(c) Paste Bulk Answer Key</span>
                </button>

                <button
                  onClick={() => navigate(`/documents/${id}/setup`)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-cozy-pill"
                >
                  <span>(a) Practice Without Answers</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters, Sorting, Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-cozy mb-6">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-bold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-rose-400" /> Filter:
          </span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'all' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('needs_review')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'needs_review' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Needs Review ({needsReviewCount})
          </button>
          <button
            onClick={() => setFilterType('no_answer')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'no_answer' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            No Answer ({noAnswersCount})
          </button>
          <button
            onClick={() => setFilterType('has_answer')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'has_answer' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            With Answers ({withAnswersCount})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortByReview(!sortByReview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold border transition cursor-pointer shadow-cozy-pill ${
              sortByReview
                ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort Review</span>
          </button>

          <button
            onClick={() => setIsAnswerKeyOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-bold transition cursor-pointer shadow-cozy-pill"
          >
            <KeyRound className="w-3.5 h-3.5 text-rose-400" />
            <span>Answer Key</span>
          </button>

          <button
            onClick={handleSuggestAnswers}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-400/30 text-xs font-bold transition cursor-pointer shadow-cozy-pill disabled:opacity-50"
            title="Ask AI to solve and verify answers across all questions in the document"
          >
            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" /> : <Sparkles className="w-3.5 h-3.5 text-violet-400" />}
            <span>AI Solve All</span>
          </button>

          <button
            onClick={() => setIsAddingQuestion(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-95 text-white text-xs font-black shadow-cozy transition cursor-pointer hover:scale-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question ✨</span>
          </button>
        </div>
      </div>

      {/* Question Cards List & Empty State */}
      {displayedQuestions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4 my-8">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Multiple-Choice Questions Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            {questions.length === 0
              ? 'No multiple-choice questions were detected in this document. You can add questions manually, set an answer key, or try uploading a clearer file.'
              : 'No questions match the selected filter.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsAddingQuestion(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question Manually</span>
            </button>
            <button
              onClick={() => setIsAnswerKeyOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
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
                className={`p-6 rounded-3xl border-2 transition-all duration-200 shadow-cozy ${
                  isHighReview
                    ? 'bg-slate-900/90 border-amber-400/40 shadow-cozy'
                    : 'bg-slate-900/90 border-slate-800/80 hover:border-rose-400/40'
                }`}
              >
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800/80 gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-500 dark:text-rose-300 font-black text-xs flex items-center justify-center font-heading">
                      Q{q.number || '·'}
                    </span>
                    {getSourceBadge(q.answer_source)}

                    {isHighReview && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30">
                        <AlertTriangle className="w-3 h-3" /> Needs Review ({Math.round(q.confidence * 100)}%)
                      </span>
                    )}

                    {q.source_page && (
                      <button
                        onClick={() => setPreviewPage(q.source_page || 1)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer shadow-cozy-pill"
                      >
                        <Eye className="w-3 h-3" /> Page {q.source_page}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAiVerifySingle(q.id)}
                      disabled={aiVerifyingId === q.id}
                      className="p-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-300 transition cursor-pointer text-xs font-bold flex items-center gap-1.5 px-3 shadow-cozy-pill disabled:opacity-50"
                      title="Run AI Solver on this specific question to verify correct answer & generate explanation"
                    >
                      {aiVerifyingId === q.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      )}
                      <span>AI Verify</span>
                    </button>

                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1.5 px-3 shadow-cozy-pill"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(q.id, q.number)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer text-xs shadow-cozy-pill"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Shared Passage / Context */}
                {q.context && (
                  <div className="my-3 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-slate-300 text-xs shadow-inner">
                    <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-rose-400 mb-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Reading Passage / Context</span>
                    </div>
                    <FormattedContent text={q.context} className="leading-relaxed" />
                  </div>
                )}

                {/* Figure / Diagram Image */}
                {q.figure_image_url && (
                  <div className="my-3 p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex flex-col items-center shadow-inner">
                    <div className="flex items-center gap-1.5 self-start text-xs font-bold text-slate-400 mb-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                      <span>Referenced Figure</span>
                    </div>
                    <img
                      src={q.figure_image_url}
                      alt={`Diagram for Q${q.number}`}
                      className="max-h-56 object-contain rounded-xl border border-slate-800 shadow"
                    />
                  </div>
                )}

                {/* Question Text */}
                <FormattedContent text={q.text} className="py-3 text-white text-base font-bold leading-relaxed font-heading" />

                {/* Options Grid (2 to 6 options) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pb-3">
                  {q.options.map((opt) => {
                    const isCorrect = q.correct_options.includes(opt.label);
                    return (
                      <div
                        key={opt.label}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-xs transition-all ${
                          isCorrect
                            ? 'bg-emerald-500/10 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/20'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-xl font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm ${
                            isCorrect
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <FormattedContent text={opt.text} as="span" className="flex-grow font-semibold" />
                        {isCorrect && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 stroke-[3]" />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation (if present) */}
                {q.explanation && (
                  <div className="mt-2 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 shadow-inner">
                    <strong className="text-white block mb-1 font-bold font-heading">Friendly Explanation:</strong>
                    <FormattedContent text={q.explanation} className="leading-relaxed pl-2 font-medium" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Edit Question Inline */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
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
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Question Text
                </label>
                <textarea
                  rows={3}
                  value={editingQuestion.text}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, text: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Options & Correct Answers (Check to set as correct)
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
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
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
                            isCorrect ? 'bg-emerald-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400'
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
                          className="flex-grow px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = editingQuestion.options.filter((_, i) => i !== idx);
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Explanation
                </label>
                <input
                  type="text"
                  value={editingQuestion.explanation || ''}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  placeholder="Optional answer explanation"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
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
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="needs_review_cb" className="text-xs text-slate-300">
                  Mark as needing further review
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                Bulk Set Answer Key
              </h3>
              <button onClick={() => setIsAnswerKeyOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste your answer key in standard format (e.g. <code className="text-indigo-300">1-B, 2-D, 3-A</code> or <code className="text-indigo-300">1. B 2. C 3. D</code>) to set answers in one click.
            </p>

            <textarea
              rows={4}
              value={answerKeyInput}
              onChange={(e) => setAnswerKeyInput(e.target.value)}
              placeholder="e.g. 1-B, 2-D, 3-A, 4-C, 5-B..."
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAnswerKeyOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyKey}
                disabled={actionLoading || !answerKeyInput.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
              >
                Apply Key to Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Manual Question */}
      {isAddingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Add New Question Manually
              </h3>
              <button onClick={() => setIsAddingQuestion(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Question Text
                </label>
                <textarea
                  rows={3}
                  required
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="Enter the question prompt..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
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
                            isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
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
                          className="flex-grow px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Explanation
                </label>
                <input
                  type="text"
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  placeholder="Optional explanation for the correct answer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingQuestion(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newQText.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                Original Document Page {previewPage}
              </h3>
              <button onClick={() => setPreviewPage(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-grow overflow-auto flex items-center justify-center p-2 bg-slate-950 rounded-xl border border-slate-800">
              <img
                src={getPageImageUrl(id, previewPage)}
                alt={`Source Page ${previewPage}`}
                className="max-h-[70vh] object-contain rounded shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
