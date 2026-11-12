import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  BookOpenCheck,
  Check,
  X,
  Bot,
  KeyRound,
  Edit3,
  HelpCircle,
  ChevronRight,
  Flag,
  ArrowLeft,
  Loader2,
  CheckCheck,
  Award,
  AlertCircle,
  BookOpen,
  Image as ImageIcon,
  ThumbsUp
} from 'lucide-react';
import { FormattedContent } from '../components/FormattedContent';
import { submitSession, retakeSession, overrideSessionAnswer } from '../api/sessions';
import { aiVerifyQuestion, type AiVerifyResponse } from '../api/questions';
import type { SubmissionResponse, AnswerSource } from '../types';

export const TestResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [results, setResults] = useState<SubmissionResponse | null>(
    (location.state as { result?: SubmissionResponse })?.result || null
  );
  const [loading, setLoading] = useState<boolean>(!results);
  const [retaking, setRetaking] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'all' | 'wrong' | 'unanswered' | 'flagged' | 'correct'>('all');

  // Quick Override & AI Verification state
  const [overridingQuestionId, setOverridingQuestionId] = useState<string | null>(null);
  const [verifyingQuestionId, setVerifyingQuestionId] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, AiVerifyResponse>>({});
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4500);
  };

  const handleMarkPickAsCorrect = async (q: SubmissionResponse['results'][0]) => {
    if (!id || q.selected_options.length === 0) return;
    try {
      setOverridingQuestionId(q.question_id);
      const updated = await overrideSessionAnswer(id, {
        question_id: q.question_id,
        correct_options: q.selected_options,
      });
      setResults(updated);
      showToast(`Q${q.number || ''}: Option [${q.selected_options.join(', ')}] marked as correct`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update answer key', 'error');
    } finally {
      setOverridingQuestionId(null);
    }
  };

  const handleVerifyWithAi = async (q: SubmissionResponse['results'][0]) => {
    try {
      setVerifyingQuestionId(q.question_id);
      const res = await aiVerifyQuestion(q.question_id, false);
      setAiResults((prev) => ({ ...prev, [q.question_id]: res }));
      showToast(`AI verification complete for Q${q.number || ''}`, 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'AI verification failed', 'error');
    } finally {
      setVerifyingQuestionId(null);
    }
  };

  const handleApplyAiAnswer = async (q: SubmissionResponse['results'][0], aiRes: AiVerifyResponse) => {
    if (!id || !aiRes.suggested_options.length) return;
    try {
      setOverridingQuestionId(q.question_id);
      const updated = await overrideSessionAnswer(id, {
        question_id: q.question_id,
        correct_options: aiRes.suggested_options,
        explanation: aiRes.explanation,
      });
      setResults(updated);
      setAiResults((prev) => {
        const copy = { ...prev };
        delete copy[q.question_id];
        return copy;
      });
      showToast(`Answer key updated for Q${q.number || ''}`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to apply AI answer', 'error');
    } finally {
      setOverridingQuestionId(null);
    }
  };

  useEffect(() => {
    async function fetchResults() {
      if (!id || results) return;
      try {
        setLoading(true);
        const data = await submitSession(id);
        setResults(data);
      } catch (err: unknown) {
        console.error('Failed to load session results:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [id, results]);

  const handleRetake = async (modeOption: 'same' | 'wrong_and_unanswered') => {
    if (!id) return;
    try {
      setRetaking(true);
      const newSession = await retakeSession(id, modeOption);
      navigate(`/sessions/${newSession.id}/test`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Retake failed');
      setRetaking(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">Evaluating responses and compiling results...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-100 font-heading">Results Unavailable</h2>
        <p className="text-slate-400 text-sm mt-1">Unable to load the requested scorecard.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-100 text-xs font-semibold cursor-pointer border border-slate-750 transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const {
    document_id,
    score_percentage,
    correct_count,
    wrong_count,
    unanswered_count,
    ungraded_count,
    total_graded,
    total_questions,
    time_taken_seconds,
    avg_time_per_question_seconds,
    passed,
    target_score_percentage,
    results: questionsBreakdown
  } = results;

  const flaggedCount = questionsBreakdown.filter((q) => q.flagged).length;
  const canRetakeMistakes = wrong_count + unanswered_count > 0;

  // Format Duration
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins > 0) return `${mins}m ${remSecs}s`;
    return `${remSecs}s`;
  };
  const formattedTime = formatTime(time_taken_seconds);

  // Filter Questions
  const filteredResults = questionsBreakdown.filter((q) => {
    if (filterType === 'wrong') return q.is_graded && !q.is_correct && q.selected_options.length > 0;
    if (filterType === 'unanswered') return q.selected_options.length === 0;
    if (filterType === 'flagged') return q.flagged;
    if (filterType === 'correct') return q.is_correct;
    return true;
  });

  const getSourceBadge = (source?: AnswerSource) => {
    switch (source) {
      case 'marked_in_document':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
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
            <HelpCircle className="w-3 h-3 text-slate-400" /> Not Graded
          </span>
        );
    }
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-400';
    if (pct >= 60) return 'text-amber-400';
    return 'text-orange-500';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 font-sans">
      {/* Toast Notification */}
      {actionToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border text-sm font-medium shadow-2xl flex items-center gap-3 ${
            actionToast.type === 'error'
              ? 'bg-red-950/95 border-red-500/50 text-red-200'
              : 'bg-slate-900 border-slate-700 text-white'
          }`}
        >
          {actionToast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          )}
          <span>{actionToast.message}</span>
        </div>
      )}

      {/* Back link */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>

      {/* Score Hero Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-400 font-mono">
                  Evaluation Complete
                </span>
                {target_score_percentage !== null && target_score_percentage !== undefined && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      passed
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-red-500/15 text-red-300 border-red-500/30'
                    }`}
                  >
                    {passed ? (
                      <>
                        <Award className="w-3.5 h-3.5 text-emerald-400" /> PASSED (Target {target_score_percentage}%)
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" /> BELOW TARGET (Target {target_score_percentage}%)
                      </>
                    )}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 mt-1 font-heading">
                Examination Scorecard
              </h1>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className={`text-4xl sm:text-5xl font-extrabold font-mono ${getScoreColor(score_percentage)}`}>
              {score_percentage}%
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              Score: <strong className="text-slate-100 px-2 py-0.5 rounded bg-slate-850 border border-slate-750 font-mono ml-0.5 mr-0.5">{results.score_earned}</strong> / {total_graded} Graded
            </div>
          </div>
        </div>

        {/* Breakdown Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 font-mono">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Correct</div>
            <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{correct_count}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Wrong</div>
            <div className="text-xl font-bold text-red-400 mt-1 flex items-center justify-center gap-1">
              <XCircle className="w-4 h-4" />
              <span>{wrong_count}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Unanswered</div>
            <div className="text-xl font-bold text-slate-300 mt-1">
              {unanswered_count}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Not Graded</div>
            <div className="text-xl font-bold text-amber-400 mt-1" title="Excluded from scoring (no answer key)">
              {ungraded_count}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Total Time</div>
            <div className="text-sm font-semibold text-slate-200 mt-1">
              {formattedTime}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Avg Time / Q</div>
            <div className="text-sm font-semibold text-slate-200 mt-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>{avg_time_per_question_seconds}s</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-800">
          <button
            onClick={() => handleRetake('same')}
            disabled={retaking}
            className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            {retaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span>Retake Same Test</span>
          </button>

          <button
            onClick={() => handleRetake('wrong_and_unanswered')}
            disabled={retaking || !canRetakeMistakes}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Mistakes ({wrong_count + unanswered_count})</span>
          </button>

          <Link
            to={`/documents/${document_id}/review`}
            className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <BookOpenCheck className="w-3.5 h-3.5 text-orange-400" />
            <span>Question Bank</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Review Section Header & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 mb-6">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-heading">
          <BookOpenCheck className="w-4 h-4 text-orange-400" />
          <span>Question Breakdown ({filteredResults.length})</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'all' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All ({total_questions})
          </button>
          <button
            onClick={() => setFilterType('wrong')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'wrong' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Wrong ({wrong_count})
          </button>
          <button
            onClick={() => setFilterType('unanswered')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'unanswered' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Unanswered ({unanswered_count})
          </button>
          <button
            onClick={() => setFilterType('flagged')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'flagged' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Flagged ({flaggedCount})
          </button>
          <button
            onClick={() => setFilterType('correct')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              filterType === 'correct' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Correct ({correct_count})
          </button>
        </div>
      </div>

      {/* Detailed Question Review Cards */}
      <div className="space-y-4 mb-12">
        {filteredResults.map((q, idx) => {
          const isUserAttempted = q.selected_options.length > 0;
          return (
            <div
              key={q.question_id}
              className={`p-6 rounded-2xl border transition-colors ${
                !q.is_graded
                  ? 'bg-slate-900 border-slate-800'
                  : q.is_correct
                  ? 'bg-slate-900 border-emerald-500/40'
                  : q.is_partial
                  ? 'bg-slate-900 border-amber-500/40'
                  : isUserAttempted
                  ? 'bg-slate-900 border-red-500/40'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 gap-3 mb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-xs flex items-center justify-center font-mono">
                    Q{q.number || idx + 1}
                  </span>

                  {getSourceBadge(q.answer_source)}

                  {/* Grading Status Badge */}
                  {!q.is_graded ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-850 px-3 py-1 rounded-md border border-slate-750">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> Not Graded
                    </span>
                  ) : q.is_correct ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-md border border-emerald-500/30">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Correct (+1.0)
                    </span>
                  ) : q.is_partial ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 px-3 py-1 rounded-md border border-amber-500/30">
                      <CheckCheck className="w-3.5 h-3.5" /> Partial Credit (+{q.score_earned})
                    </span>
                  ) : isUserAttempted ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 bg-red-500/15 px-3 py-1 rounded-md border border-red-500/30">
                      <X className="w-3.5 h-3.5 stroke-[2.5]" /> Incorrect ({q.score_earned < 0 ? `${q.score_earned}` : '0'})
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 bg-slate-850 px-3 py-1 rounded-md border border-slate-750">
                      Unanswered (0)
                    </span>
                  )}

                  {/* Flagged indicator */}
                  {q.flagged && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                      <Flag className="w-3 h-3 fill-current" /> Flagged
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-mono font-medium">
                  Time: {q.time_spent_seconds}s
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
              <FormattedContent
                text={q.text}
                className="text-slate-100 font-semibold text-base leading-relaxed mb-4"
              />

              {/* Options Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {q.options.map((opt) => {
                  const isCorrectAnswer = q.correct_options.includes(opt.label);
                  const isUserSelected = q.selected_options.includes(opt.label);

                  let borderStyle = 'border-slate-800 bg-slate-950 text-slate-300';
                  if (isCorrectAnswer) {
                    borderStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30';
                  } else if (isUserSelected && !isCorrectAnswer) {
                    borderStyle = 'border-red-500 bg-red-500/10 text-red-200 ring-1 ring-red-500/30';
                  }

                  const displayText = opt.text && opt.text.trim() ? opt.text : `Option ${opt.label}`;

                  return (
                    <div
                      key={opt.label}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-medium transition-colors ${borderStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center flex-shrink-0 text-xs ${
                          isCorrectAnswer
                            ? 'bg-emerald-600 text-white'
                            : isUserSelected
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-850 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <FormattedContent text={displayText} as="span" className="flex-grow font-normal text-slate-200" />
                      {isCorrectAnswer && (
                        <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Correct
                        </span>
                      )}
                      {isUserSelected && !isCorrectAnswer && (
                        <span className="text-[11px] font-semibold text-red-400 flex items-center gap-1 font-mono">
                          <X className="w-3.5 h-3.5 stroke-[2.5]" /> Your Pick
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-orange-400 font-semibold">
                    {q.answer_source === 'ai_suggested' && <Bot className="w-3.5 h-3.5 text-orange-400" />}
                    <span>Explanation {q.answer_source === 'ai_suggested' ? '(AI Verified)' : ''}:</span>
                  </div>
                  <FormattedContent text={q.explanation} className="leading-relaxed text-slate-300 font-normal pl-4" />
                </div>
              )}

              {/* Question Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 mt-3 border-t border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {isUserAttempted && !q.is_correct && (
                    <button
                      onClick={() => handleMarkPickAsCorrect(q)}
                      disabled={overridingQuestionId === q.question_id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      title="Set your selected option as correct and update results"
                    >
                      {overridingQuestionId === q.question_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>Mark My Pick ({q.selected_options.join(', ')}) as Correct</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleVerifyWithAi(q)}
                    disabled={verifyingQuestionId === q.question_id}
                    className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-orange-400 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {verifyingQuestionId === q.question_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-orange-400" />
                    )}
                    <span>{aiResults[q.question_id] ? 'Re-verify with AI' : 'Verify with AI'}</span>
                  </button>
                </div>

                <Link
                  to={`/documents/${document_id}/review`}
                  className="text-[11px] text-slate-400 hover:text-orange-300 flex items-center gap-1 transition"
                >
                  <Edit3 className="w-3 h-3 text-orange-400" /> Edit in Question Bank
                </Link>
              </div>

              {/* AI Verification Drawer */}
              {aiResults[q.question_id] && (
                <div className="mt-3.5 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-orange-400" />
                      <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] font-heading">
                        AI Verification Analysis
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setAiResults((prev) => {
                          const copy = { ...prev };
                          delete copy[q.question_id];
                          return copy;
                        });
                      }}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 font-medium">Recommended Correct Option:</span>
                    <span className="px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300 font-bold text-xs font-mono">
                      Option {aiResults[q.question_id].suggested_options.join(', ')}
                    </span>
                    {aiResults[q.question_id].suggested_options.some(opt => q.selected_options.includes(opt)) && (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Matches Your Selection
                      </span>
                    )}
                  </div>

                  {aiResults[q.question_id].explanation && (
                    <div className="text-slate-300 leading-relaxed bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                      <strong className="text-orange-400 block font-semibold">AI Reasoning:</strong>
                      <FormattedContent text={aiResults[q.question_id].explanation} className="leading-relaxed text-slate-300 font-normal" />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleApplyAiAnswer(q, aiResults[q.question_id])}
                      disabled={overridingQuestionId === q.question_id}
                      className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {overridingQuestionId === q.question_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Apply AI Answer &amp; Re-Grade</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
