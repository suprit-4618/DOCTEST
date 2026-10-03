import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Send,
  Loader2,
  Check,
  LayoutGrid,
  Keyboard,
  ShieldCheck,
  BookOpen,
  Image as ImageIcon
} from 'lucide-react';
import { FormattedContent } from '../components/FormattedContent';
import { getSession, saveAnswers, checkPracticeQuestion, submitSession } from '../api/sessions';
import type {
  TestSessionResponse,
  TestQuestion,
  AnswerSaveItem,
  PracticeFeedbackResponse
} from '../types';

export const TestTakingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<TestSessionResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answersMap, setAnswersMap] = useState<Record<string, AnswerSaveItem>>({});
  const [practiceFeedback, setPracticeFeedback] = useState<Record<string, PracticeFeedbackResponse>>({});
  
  // Timing
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [timeSpentMap, setTimeSpentMap] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load & Session Recovery
  useEffect(() => {
    async function initSession() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getSession(id);
        setSession(data);

        // Restore answers from backend or fallback
        const initialAnswers: Record<string, AnswerSaveItem> = {};
        if (data.answers && data.answers.length > 0) {
          data.answers.forEach((ans) => {
            initialAnswers[ans.question_id] = ans;
          });
        }
        setAnswersMap(initialAnswers);

        // Calculate timer remaining
        if (data.time_limit_seconds) {
          const startedAt = new Date(data.started_at).getTime();
          const elapsedSecs = Math.floor((Date.now() - startedAt) / 1000);
          const remaining = Math.max(0, data.time_limit_seconds - elapsedSecs);
          setSecondsRemaining(remaining);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load test session');
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [id]);

  // 2. Timer Loop & Auto Submit on Zero
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [secondsRemaining]);

  // Question Time Tracking
  useEffect(() => {
    const currentQ = session?.questions[currentIndex];
    if (!currentQ) return;

    const interval = setInterval(() => {
      setTimeSpentMap((prev) => ({
        ...prev,
        [currentQ.id]: (prev[currentQ.id] || 0) + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, session?.questions]);

  // 3. Auto-save answers debounced to backend
  const syncAnswerToBackend = useCallback(
    async (_qId: string, updated: AnswerSaveItem) => {
      if (!id) return;
      try {
        await saveAnswers(id, { answers: [updated] });
      } catch (err) {
        console.error('Failed to auto-save answer:', err);
      }
    },
    [id]
  );

  // Handle Option Select
  const handleSelectOption = (label: string) => {
    const currentQ = session?.questions[currentIndex];
    if (!currentQ) return;

    const existing = answersMap[currentQ.id] || {
      question_id: currentQ.id,
      selected_options: [],
      flagged: false,
      time_spent_seconds: 0,
    };

    // Check if question prompt implies multi-select ("select all that apply")
    const isMultiSelect = currentQ.text.toLowerCase().includes('select all') || currentQ.text.toLowerCase().includes('all that apply');

    let nextSelected: string[];
    if (isMultiSelect) {
      nextSelected = existing.selected_options.includes(label)
        ? existing.selected_options.filter((l) => l !== label)
        : [...existing.selected_options, label];
    } else {
      nextSelected = existing.selected_options.includes(label) ? [] : [label];
    }

    const updatedItem: AnswerSaveItem = {
      ...existing,
      selected_options: nextSelected,
      time_spent_seconds: (timeSpentMap[currentQ.id] || 0),
    };

    setAnswersMap((prev) => ({ ...prev, [currentQ.id]: updatedItem }));
    syncAnswerToBackend(currentQ.id, updatedItem);
  };

  // Toggle Flag for Review
  const handleToggleFlag = () => {
    const currentQ = session?.questions[currentIndex];
    if (!currentQ) return;

    const existing = answersMap[currentQ.id] || {
      question_id: currentQ.id,
      selected_options: [],
      flagged: false,
      time_spent_seconds: 0,
    };

    const updatedItem: AnswerSaveItem = {
      ...existing,
      flagged: !existing.flagged,
      time_spent_seconds: (timeSpentMap[currentQ.id] || 0),
    };

    setAnswersMap((prev) => ({ ...prev, [currentQ.id]: updatedItem }));
    syncAnswerToBackend(currentQ.id, updatedItem);
  };

  // Clear Answer
  const handleClearAnswer = () => {
    const currentQ = session?.questions[currentIndex];
    if (!currentQ) return;

    const existing = answersMap[currentQ.id];
    if (!existing) return;

    const updatedItem: AnswerSaveItem = {
      ...existing,
      selected_options: [],
      time_spent_seconds: (timeSpentMap[currentQ.id] || 0),
    };

    setAnswersMap((prev) => ({ ...prev, [currentQ.id]: updatedItem }));
    syncAnswerToBackend(currentQ.id, updatedItem);
  };

  // Practice Mode Check Answer
  const handlePracticeCheck = async () => {
    const currentQ = session?.questions[currentIndex];
    if (!currentQ || !id) return;

    const existing = answersMap[currentQ.id];
    if (!existing || existing.selected_options.length === 0) return;

    try {
      const feedback = await checkPracticeQuestion(id, currentQ.id, {
        selected_options: existing.selected_options,
        time_spent_seconds: timeSpentMap[currentQ.id] || 0,
      });
      setPracticeFeedback((prev) => ({ ...prev, [currentQ.id]: feedback }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Practice check failed');
    }
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    if (!id) return;
    try {
      setSubmitting(true);
      setShowSubmitModal(false);
      const result = await submitSession(id);
      navigate(`/sessions/${id}/results`, { state: { result } });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!id || submitting) return;
    try {
      setSubmitting(true);
      const result = await submitSession(id);
      navigate(`/sessions/${id}/results`, { state: { result } });
    } catch (err) {
      console.error('Auto submit error:', err);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an input or modal is open
      if (showSubmitModal) return;
      const key = e.key.toUpperCase();

      if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        handleSelectOption(key);
      } else if (['1', '2', '3', '4', '5'].includes(key)) {
        const num = parseInt(key);
        const mappedLabel = String.fromCharCode(64 + num);
        handleSelectOption(mappedLabel);
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
      } else if (e.key === 'ArrowRight') {
        if (session && currentIndex < session.questions.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (key === 'F') {
        handleToggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, session, showSubmitModal, answersMap, timeSpentMap]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
        <p className="text-slate-400">Loading exam environment...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Session Unavailable</h2>
        <p className="text-slate-400 text-sm mt-1">{error || 'Session not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const questionsList = session.questions;
  const currentQ: TestQuestion = questionsList[currentIndex];
  const currentAns = answersMap[currentQ.id];
  const selectedOptions = currentAns?.selected_options || [];
  const isFlagged = Boolean(currentAns?.flagged);
  const currentPractice = practiceFeedback[currentQ.id];

  const totalQ = questionsList.length;
  const answeredCount = Object.values(answersMap).filter(
    (a) => a.selected_options && a.selected_options.length > 0
  ).length;
  const flaggedCount = Object.values(answersMap).filter((a) => a.flagged).length;
  const unansweredCount = totalQ - answeredCount;

  // Format Timer
  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimerWarning = secondsRemaining !== null && secondsRemaining <= 300 && secondsRemaining > 60;
  const isTimerCritical = secondsRemaining !== null && secondsRemaining <= 60;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {/* Top Test Header Bar */}
      <div className="border-b-2 border-slate-800 bg-slate-900 sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-300 border border-rose-400/30 shadow-sm flex items-center gap-1.5">
              <span>{session.mode === 'practice' ? '🍵' : '🎯'}</span>
              <span>{session.mode.toUpperCase()} MODE</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
              Answered <strong className="text-white px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 ml-0.5 mr-0.5">{answeredCount}</strong> of {totalQ}
            </span>
          </div>

          {/* Countdown Timer */}
          {secondsRemaining !== null && (
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-2 font-mono text-sm font-bold shadow-cozy-pill transition-all ${
                isTimerCritical
                  ? 'bg-rose-500/20 border-rose-400 text-rose-500 dark:text-rose-200 animate-pulse'
                  : isTimerWarning
                  ? 'bg-amber-500/15 border-amber-400 text-amber-600 dark:text-amber-200'
                  : 'bg-slate-800/90 border-slate-700/80 text-slate-200'
              }`}
            >
              <Clock className={`w-4 h-4 ${isTimerCritical ? 'text-rose-400 animate-spin' : 'text-rose-400'}`} />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>
          )}

          {/* Actions & Mobile Palette Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
              className="p-2.5 rounded-2xl bg-slate-800 text-slate-300 md:hidden cursor-pointer shadow-cozy-pill"
              title="Toggle Question Palette"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white font-black text-xs shadow-cozy hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Test ✨</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-grow grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Question Area */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col space-y-6">
          {/* Progress Bar */}
          <div className="w-full bg-slate-900/80 rounded-full h-2.5 p-0.5 overflow-hidden border border-slate-800/80 shadow-inner">
            <div
              className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${((currentIndex + 1) / totalQ) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          <div className="bg-slate-900/90 border-2 border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-cozy flex-grow flex flex-col justify-between">
            <div>
              {/* Question Header Status */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 gap-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-500 dark:text-rose-300 shadow-sm font-heading">
                    Question {currentIndex + 1} of {totalQ}
                  </span>
                  {currentQ.source_page && (
                    <span className="text-xs text-slate-400 font-medium">Page {currentQ.source_page}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFlag}
                    className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border-2 transition-all cursor-pointer shadow-cozy-pill hover:scale-105 active:scale-95 ${
                      isFlagged
                        ? 'bg-amber-500/20 border-amber-400 text-amber-500 dark:text-amber-200'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-current text-amber-400' : ''}`} />
                    <span>{isFlagged ? 'Flagged ⭐' : 'Flag'}</span>
                  </button>

                  {selectedOptions.length > 0 && (
                    <button
                      onClick={handleClearAnswer}
                      className="px-3 py-1 rounded-full bg-slate-800/80 text-slate-400 hover:text-white text-xs font-bold transition shadow-cozy-pill cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Shared Passage / Reading Context */}
              {currentQ.context && (
                <div className="mb-6 p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-slate-200 shadow-inner">
                  <div className="flex items-center gap-2 mb-2 text-xs font-black uppercase tracking-wider text-rose-400">
                    <BookOpen className="w-4 h-4" />
                    <span>Reading Passage / Shared Context</span>
                  </div>
                  <FormattedContent text={currentQ.context} className="text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto pr-2" />
                </div>
              )}

              {/* Figure / Diagram Image */}
              {currentQ.figure_image_url && (
                <div className="mb-6 p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex flex-col items-center shadow-inner">
                  <div className="flex items-center gap-1.5 self-start mb-2 text-xs font-bold text-slate-400">
                    <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                    <span>Referenced Figure / Diagram</span>
                  </div>
                  <img
                    src={currentQ.figure_image_url}
                    alt={`Diagram for question ${currentQ.number || currentIndex + 1}`}
                    className="max-h-72 object-contain rounded-xl border border-slate-800 shadow-md"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Question Prompt */}
              <div className="mb-6">
                <FormattedContent
                  text={currentQ.text}
                  className="text-lg sm:text-xl font-bold text-white leading-relaxed font-heading"
                />
              </div>

              {/* Options List (Handles 2 to 6 options gracefully) */}
              <div className="space-y-3">
                {currentQ.options.map((opt) => {
                  const isSelected = selectedOptions.includes(opt.label);
                  const isPracticeChecked = Boolean(currentPractice);
                  const isPracticeCorrect = currentPractice?.correct_options.includes(opt.label);
                  const isPracticeSelectedWrong = isPracticeChecked && isSelected && !isPracticeCorrect;

                  let borderClass = 'border-slate-800/80 bg-slate-950/40 hover:border-rose-400/40 hover:bg-rose-500/5';
                  if (isPracticeChecked) {
                    if (isPracticeCorrect) {
                      borderClass = 'border-emerald-400 bg-emerald-500/15 shadow-cozy ring-2 ring-emerald-400/30';
                    } else if (isPracticeSelectedWrong) {
                      borderClass = 'border-rose-400 bg-rose-500/15';
                    }
                  } else if (isSelected) {
                    borderClass = 'border-rose-400 bg-rose-500/10 shadow-cozy ring-2 ring-rose-400/25';
                  }

                  return (
                    <div
                      key={opt.label}
                      onClick={() => handleSelectOption(opt.label)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectOption(opt.label);
                        }
                      }}
                      className={`flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 group hover:scale-[1.01] active:scale-[0.99] ${borderClass}`}
                    >
                      {/* Letter Icon / Circle */}
                      <span
                        className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-md scale-105'
                            : 'bg-slate-800 text-slate-300 group-hover:bg-rose-500/20 group-hover:text-rose-500'
                        }`}
                      >
                        {opt.label}
                      </span>

                      {/* Option Text with Math/Code/RTL */}
                      <FormattedContent
                        text={opt.text}
                        as="span"
                        className="flex-grow text-sm sm:text-base font-semibold text-slate-200"
                      />

                      {/* Checked indicator */}
                      {isSelected && !isPracticeChecked && (
                        <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm animate-scale-in">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}

                      {/* Practice indicator */}
                      {isPracticeChecked && isPracticeCorrect && (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 animate-scale-in" />
                      )}
                      {isPracticeChecked && isPracticeSelectedWrong && (
                        <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0 animate-scale-in" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Practice Mode Instant Feedback Box */}
              {session.mode === 'practice' && (
                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  {!currentPractice ? (
                    <button
                      onClick={handlePracticeCheck}
                      disabled={selectedOptions.length === 0}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-95 text-white font-black text-xs transition-all shadow-cozy disabled:opacity-40 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Check Answer ✨</span>
                    </button>
                  ) : (
                    <div
                      className={`p-5 rounded-2xl border-2 text-xs space-y-2 shadow-cozy ${
                        currentPractice.is_correct
                          ? 'bg-emerald-500/10 border-emerald-400 text-emerald-200'
                          : 'bg-rose-500/10 border-rose-400 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black text-sm font-heading">
                        {currentPractice.is_correct ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span>Yay! That is correct! 🌟</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-rose-400" />
                            <span>Not quite right. Correct: {currentPractice.correct_options.join(', ')}</span>
                          </>
                        )}
                      </div>
                      {currentPractice.explanation && (
                        <div className="text-slate-300 font-medium leading-relaxed mt-2 pl-7">
                          <strong className="text-white block mb-1">Friendly Note:</strong>
                          <FormattedContent text={currentPractice.explanation} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Question Navigation Controls */}
            <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-800/80 gap-4">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-5 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-cozy-pill disabled:opacity-40 cursor-pointer hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-semibold px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                <Keyboard className="w-3.5 h-3.5 text-rose-400" />
                <span>Shortcuts: A-D select &bull; &larr; &rarr; navigate &bull; F flag</span>
              </div>

              {currentIndex < totalQ - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQ - 1, prev + 1))}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow-cozy hover:shadow-cozy-hover transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-cozy hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Finish &amp; Submit 🎉</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette (Desktop & Mobile Drawer) */}
        <div
          className={`md:col-span-4 lg:col-span-3 ${
            isPaletteOpenMobile
              ? 'fixed inset-0 z-50 bg-slate-950/90 p-6 flex flex-col'
              : 'hidden md:flex flex-col'
          }`}
        >
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 sm:p-6 shadow-cozy flex-grow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 font-heading">
                  <LayoutGrid className="w-4 h-4 text-rose-400" />
                  Question Palette
                </span>
                {isPaletteOpenMobile && (
                  <button
                    onClick={() => setIsPaletteOpenMobile(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800"
                  >
                    Close
                  </button>
                )}
              </div>

              {/* Palette Legend */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                  <span>{answeredCount} Done</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                  <span>{flaggedCount} Flagged</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 shadow-sm" />
                  <span>{unansweredCount} Left</span>
                </div>
              </div>

              {/* Palette Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-[350px] overflow-y-auto pr-1">
                {questionsList.map((q, idx) => {
                  const ans = answersMap[q.id];
                  const hasAnswer = ans?.selected_options && ans.selected_options.length > 0;
                  const flagged = Boolean(ans?.flagged);
                  const isCurrent = idx === currentIndex;

                  let colorStyle = 'bg-slate-800/80 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400';
                  if (flagged) {
                    colorStyle = 'bg-amber-500 text-slate-950 font-black shadow-sm';
                  } else if (hasAnswer) {
                    colorStyle = 'bg-emerald-500 text-white font-black shadow-sm';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsPaletteOpenMobile(false);
                      }}
                      className={`h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer relative shadow-cozy-pill hover:scale-105 active:scale-95 ${colorStyle} ${
                        isCurrent ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900 scale-105' : ''
                      }`}
                    >
                      {idx + 1}
                      {flagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zero Leakage Badge */}
            <div className="pt-4 border-t border-slate-800/80 mt-4 text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span>Answers isolated on backend</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Submit Confirmation Dialog */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-400/20 text-rose-500 dark:text-rose-300 flex items-center justify-center shadow-sm">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Ready to Submit? 🍵</h3>
                <p className="text-xs text-slate-400">Review your questions before checking your score!</p>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-center shadow-inner">
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Answered</div>
                <div className="text-xl font-black text-emerald-400 mt-0.5">{answeredCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Unanswered</div>
                <div className="text-xl font-black text-rose-400 mt-0.5">{unansweredCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Flagged</div>
                <div className="text-xl font-black text-amber-400 mt-0.5">{flaggedCount}</div>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-500 dark:text-amber-200 text-xs flex items-start gap-2.5 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. Feel free to review them or submit whenever you're ready!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition cursor-pointer shadow-cozy-pill"
              >
                Keep Reviewing
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white text-xs font-black shadow-cozy transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Grading Answers...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Submit 🎉</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
