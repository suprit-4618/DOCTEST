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
  Sparkles,
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
      showToast(`Q${q.number || ''}: Pick [${q.selected_options.join(', ')}] marked as correct & scorecard updated!`, 'success');
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
      showToast(`Q${q.number || ''}: AI answer [${aiRes.suggested_options.join(', ')}] applied & scorecard updated!`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to apply AI answer', 'error');
    } finally {
      setOverridingQuestionId(null);
    }
  };

  useEffect(() => {
    async function fetchGradedResults() {
      if (results || !id) return;
      try {
        setLoading(true);
        const data = await submitSession(id);
        setResults(data);
      } catch (err) {
        console.error('Failed to fetch results:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGradedResults();
  }, [id, results]);

  const handleRetake = async (mode: 'same' | 'wrong_and_unanswered') => {
    if (!id) return;
    try {
      setRetaking(true);
      const newSession = await retakeSession(id, mode);
      navigate(`/sessions/${newSession.id}/test`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to launch retake session');
      setRetaking(false);
    }
  };


  if (loading || !results) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <Trophy className="w-6 h-6" />
        </div>
        <p className="text-slate-400">Computing exam results and scorecard...</p>
      </div>
    );
  }

  const {
    total_questions,
    total_graded,
    correct_count,
    wrong_count,
    unanswered_count,
    ungraded_count,
    score_percentage,
    target_score_percentage,
    passed,
    time_taken_seconds,
    avg_time_per_question_seconds,
    results: questionsResult,
    document_id,
  } = results;

  // Format Time Taken
  const mins = Math.floor(time_taken_seconds / 60);
  const secs = time_taken_seconds % 60;
  const formattedTime = `${mins}m ${secs}s`;

  // Count flagged
  const flaggedCount = questionsResult.filter((q) => q.flagged).length;

  // Filtered Results
  const filteredResults = questionsResult.filter((q) => {
    if (filterType === 'correct') return q.is_correct;
    if (filterType === 'wrong') return !q.is_correct && q.selected_options.length > 0 && q.is_graded;
    if (filterType === 'unanswered') return q.selected_options.length === 0;
    if (filterType === 'flagged') return q.flagged;
    return true;
  });

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
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="w-3 h-3" /> No Answer Key
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-indigo-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  const canRetakeMistakes = (wrong_count + unanswered_count) > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 relative">
      {/* Toast Notification */}
      {actionToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border text-white shadow-2xl flex items-center gap-3 animate-fade-in ${
            actionToast.type === 'error'
              ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
              : actionToast.type === 'info'
              ? 'bg-violet-950/95 border-violet-500/50 text-violet-200'
              : 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {actionToast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          ) : actionToast.type === 'info' ? (
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          )}
          <span className="text-xs font-bold">{actionToast.message}</span>
        </div>
      )}

      {/* Top Navigation Row */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </Link>
        <Link
          to={`/documents/${document_id}/review`}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition"
        >
          <BookOpenCheck className="w-4 h-4" /> Review Question Bank
        </Link>
      </div>

      {/* Score Hero Card */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-cozy relative overflow-hidden mb-8">

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-500 text-white flex items-center justify-center shadow-cozy shadow-rose-500/20">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-500 dark:text-rose-300">
                  🎉 Exam Evaluation Complete
                </span>
                {target_score_percentage !== null && target_score_percentage !== undefined && (
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border-2 shadow-sm ${
                      passed
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-400/30'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-400/30'
                    }`}
                  >
                    {passed ? (
                      <>
                        <Award className="w-3.5 h-3.5 text-emerald-500" /> PASSED 🌟 (Target {target_score_percentage}%)
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> KEEP PRACTICING 🍵 (Target {target_score_percentage}%)
                      </>
                    )}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 font-heading">
                Your Practice Scorecard 🏆
              </h1>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className={`text-4xl sm:text-5xl font-black font-heading ${getScoreColor(score_percentage)}`}>
              {score_percentage}%
            </div>
            <div className="text-xs text-slate-400 font-semibold mt-1">
              Score: <strong className="text-white px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 ml-0.5 mr-0.5">{results.score_earned}</strong> / {total_graded} Graded
            </div>
          </div>
        </div>

        {/* Breakdown Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Correct</div>
            <div className="text-xl font-black text-emerald-400 mt-1 flex items-center justify-center gap-1 font-sans">
              <CheckCircle2 className="w-4 h-4" />
              <span>{correct_count}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Wrong</div>
            <div className="text-xl font-black text-rose-400 mt-1 flex items-center justify-center gap-1 font-sans">
              <XCircle className="w-4 h-4" />
              <span>{wrong_count}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Unanswered</div>
            <div className="text-xl font-black text-slate-300 mt-1 font-sans">
              {unanswered_count}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Not Graded</div>
            <div className="text-xl font-black text-amber-400 mt-1 font-sans" title="Excluded from scoring (no answer key)">
              {ungraded_count}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Time</div>
            <div className="text-sm font-black text-slate-200 mt-1 font-mono">
              {formattedTime}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Avg Time / Q</div>
            <div className="text-sm font-black text-slate-200 mt-1 font-mono flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>{avg_time_per_question_seconds}s</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-8 mt-8 border-t border-slate-800/80">
          <button
            onClick={() => handleRetake('same')}
            disabled={retaking}
            className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-cozy-pill disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95"
          >
            {retaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span>Retake Same Test</span>
          </button>

          <button
            onClick={() => handleRetake('wrong_and_unanswered')}
            disabled={retaking || !canRetakeMistakes}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-cozy transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:scale-105 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Mistakes ({wrong_count + unanswered_count}) ✨</span>
          </button>

          <Link
            to={`/documents/${document_id}/review`}
            className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-cozy-pill hover:scale-105 active:scale-95"
          >
            <BookOpenCheck className="w-3.5 h-3.5 text-rose-400" />
            <span>Question Bank</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Review Section Header & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-cozy mb-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2 font-heading">
          <BookOpenCheck className="w-4 h-4 text-rose-400" />
          Detailed Question Breakdown ({filteredResults.length})
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'all' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All ({total_questions})
          </button>
          <button
            onClick={() => setFilterType('wrong')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'wrong' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Wrong ({wrong_count})
          </button>
          <button
            onClick={() => setFilterType('unanswered')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'unanswered' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Unanswered ({unanswered_count})
          </button>
          <button
            onClick={() => setFilterType('flagged')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'flagged' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Flagged ({flaggedCount})
          </button>
          <button
            onClick={() => setFilterType('correct')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-cozy-pill cursor-pointer ${
              filterType === 'correct' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
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
              className={`p-6 sm:p-7 rounded-3xl border-2 transition-all duration-200 shadow-cozy ${
                !q.is_graded
                  ? 'bg-slate-900/60 border-slate-800/80'
                  : q.is_correct
                  ? 'bg-slate-900/90 border-emerald-500/30'
                  : q.is_partial
                  ? 'bg-slate-900/90 border-amber-500/30'
                  : isUserAttempted
                  ? 'bg-slate-900/90 border-rose-500/30'
                  : 'bg-slate-900/60 border-slate-800/80'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 gap-3 mb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-500 dark:text-rose-300 font-black text-xs flex items-center justify-center font-heading">
                    Q{q.number || idx + 1}
                  </span>

                  {getSourceBadge(q.answer_source)}

                  {/* Grading Status Badge */}
                  {!q.is_graded ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> Not Graded
                    </span>
                  ) : q.is_correct ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-400/30 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Correct 🌟 (+1.0)
                    </span>
                  ) : q.is_partial ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-400/30 shadow-sm">
                      <CheckCheck className="w-3.5 h-3.5" /> Partial Credit (+{q.score_earned})
                    </span>
                  ) : isUserAttempted ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-300 bg-rose-500/15 px-3 py-1 rounded-full border border-rose-400/30 shadow-sm">
                      <X className="w-3.5 h-3.5 stroke-[3]" /> Incorrect ({q.score_earned < 0 ? `${q.score_earned}` : '0'})
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
                      Unanswered (0)
                    </span>
                  )}

                  {/* Flagged indicator */}
                  {q.flagged && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                      <Flag className="w-3 h-3 fill-current" /> Flagged ⭐
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-mono font-bold">
                  Time: {q.time_spent_seconds}s
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
              <FormattedContent
                text={q.text}
                className="text-white font-bold text-base sm:text-lg leading-relaxed mb-5 font-heading"
              />

              {/* Options Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {q.options.map((opt) => {
                  const isCorrectAnswer = q.correct_options.includes(opt.label);
                  const isUserSelected = q.selected_options.includes(opt.label);

                  let borderStyle = 'border-slate-800/80 bg-slate-950/40 text-slate-300';
                  if (isCorrectAnswer) {
                    borderStyle = 'border-emerald-400/80 bg-emerald-500/10 text-emerald-200 ring-2 ring-emerald-400/20';
                  } else if (isUserSelected && !isCorrectAnswer) {
                    borderStyle = 'border-rose-400/80 bg-rose-500/10 text-rose-200 ring-2 ring-rose-400/20';
                  }

                  return (
                    <div
                      key={opt.label}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-xs font-medium transition-all ${borderStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm ${
                          isCorrectAnswer
                            ? 'bg-emerald-500 text-white'
                            : isUserSelected
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <FormattedContent text={opt.text} as="span" className="flex-grow font-semibold" />
                      {isCorrectAnswer && (
                        <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Correct
                        </span>
                      )}
                      {isUserSelected && !isCorrectAnswer && (
                        <span className="text-[11px] font-black text-rose-400 flex items-center gap-1">
                          <X className="w-3.5 h-3.5 stroke-[3]" /> Your Pick
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold font-heading">
                    {q.answer_source === 'ai_suggested' && <Sparkles className="w-3.5 h-3.5 text-rose-400" />}
                    <span>Explanation Note {q.answer_source === 'ai_suggested' ? '(AI-suggested)' : ''}:</span>
                  </div>
                  <FormattedContent text={q.explanation} className="leading-relaxed text-slate-300 font-medium pl-5" />
                </div>
              )}

              {/* Question Action Bar: Manual Override & AI Verification */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 mt-3 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  {isUserAttempted && !q.is_correct && (
                    <button
                      onClick={() => handleMarkPickAsCorrect(q)}
                      disabled={overridingQuestionId === q.question_id}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm"
                      title="Mark your selected answer as the official correct answer and re-grade immediately"
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
                    className="px-3.5 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm"
                    title="Ask AI to solve this question, check Salesforce/exam concepts, and verify the true correct answer"
                  >
                    {verifyingQuestionId === q.question_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    )}
                    <span>{aiResults[q.question_id] ? 'Re-verify with AI' : '✨ Verify with AI'}</span>
                  </button>
                </div>

                <Link
                  to={`/documents/${document_id}/review`}
                  className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 transition"
                >
                  <Edit3 className="w-3 h-3 text-rose-400" /> Edit in Question Bank
                </Link>
              </div>

              {/* AI Verification Drawer */}
              {aiResults[q.question_id] && (
                <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-br from-violet-950/40 via-slate-900/90 to-slate-950/80 border-2 border-violet-500/40 text-xs shadow-cozy space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-violet-500/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                      <span className="font-black text-violet-200 uppercase tracking-wider text-[11px] font-heading">
                        AI Expert Verification &amp; Second Opinion
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
                    <span className="text-slate-400 font-semibold">AI Recommended Correct Answer:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-300 font-black text-xs">
                      Option {aiResults[q.question_id].suggested_options.join(', ')}
                    </span>
                    {aiResults[q.question_id].suggested_options.some(opt => q.selected_options.includes(opt)) && (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Matches Your Pick!
                      </span>
                    )}
                  </div>

                  {aiResults[q.question_id].explanation && (
                    <div className="text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-violet-500/20 space-y-1">
                      <strong className="text-violet-300 block font-bold font-heading">AI Reasoning:</strong>
                      <FormattedContent text={aiResults[q.question_id].explanation} className="leading-relaxed text-slate-300 font-medium" />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleApplyAiAnswer(q, aiResults[q.question_id])}
                      disabled={overridingQuestionId === q.question_id}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {overridingQuestionId === q.question_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Apply AI Answer Key &amp; Re-Grade</span>
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
