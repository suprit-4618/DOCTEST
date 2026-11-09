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

const parseUtcDate = (dateStr: string | null | undefined): number => {
  if (!dateStr) return Date.now();
  const trimmed = dateStr.trim();
  const hasTz = trimmed.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(trimmed);
  const normalizedStr = hasTz ? trimmed : `${trimmed}Z`;
  const time = new Date(normalizedStr).getTime();
  return isNaN(time) ? Date.now() : time;
};

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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load test session');
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [id]);

  // 2. Countdown Timer Loop
  useEffect(() => {
    if (!session || !session.time_limit_seconds || session.submitted_at) {
      setSecondsRemaining(null);
      return;
    }

    const startedAtMs = parseUtcDate(session.started_at);
    const timeLimitSecs = session.time_limit_seconds;

    const tick = () => {
      const now = Date.now();
      const elapsedSecs = Math.max(0, Math.floor((now - startedAtMs) / 1000));
      const remaining = Math.max(0, timeLimitSecs - elapsedSecs);
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleAutoSubmit();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.id, session?.started_at, session?.time_limit_seconds, session?.submitted_at]);

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

  // Auto-save answers to backend
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
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">Loading examination environment...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Session Unavailable</h2>
        <p className="text-slate-400 text-sm mt-1">{error || 'Session not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
        >
          Return to Dashboard
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
    if (totalSecs < 0) totalSecs = 0;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimerWarning = secondsRemaining !== null && secondsRemaining <= 300 && secondsRemaining > 60;
  const isTimerCritical = secondsRemaining !== null && secondsRemaining <= 60;

  return (
    <div className="min-h-screen bg-[#0E1117] flex flex-col font-sans">
      {/* Top Test Header Bar */}
      <div className="border-b border-slate-800 bg-[#161B22] sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/30">
              {session.mode.toUpperCase()} MODE
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Answered <strong className="text-emerald-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 ml-0.5 mr-0.5">{answeredCount}</strong> of {totalQ}
            </span>
          </div>

          {/* Countdown Timer */}
          {secondsRemaining !== null && (
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border font-mono text-sm font-semibold transition-all ${
                isTimerCritical
                  ? 'bg-red-500/15 border-red-500/50 text-red-400 animate-pulse'
                  : isTimerWarning
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              <Clock className={`w-4 h-4 ${isTimerCritical ? 'text-red-400 animate-spin' : 'text-orange-400'}`} />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>
          )}

          {/* Actions & Mobile Palette Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 md:hidden cursor-pointer hover:bg-slate-700"
              title="Toggle Question Palette"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Exam</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-grow grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Question Area */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col space-y-6">
          {/* Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="bg-orange-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${((currentIndex + 1) / totalQ) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl p-6 sm:p-8 flex-grow flex flex-col justify-between shadow-sm">
            <div>
              {/* Question Header Status */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 gap-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400">
                    Question {currentIndex + 1} of {totalQ}
                  </span>
                  {currentQ.source_page && (
                    <span className="text-xs text-slate-400 font-medium">Page {currentQ.source_page}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFlag}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      isFlagged
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-current text-amber-400' : ''}`} />
                    <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
                  </button>

                  {selectedOptions.length > 0 && (
                    <button
                      onClick={handleClearAnswer}
                      className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Shared Passage / Reading Context */}
              {currentQ.context && (
                <div className="mb-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                    <BookOpen className="w-4 h-4" />
                    <span>Reading Passage / Reference Context</span>
                  </div>
                  <FormattedContent text={currentQ.context} className="text-sm text-slate-300 leading-relaxed max-h-56 overflow-y-auto pr-2" />
                </div>
              )}

              {/* Figure / Diagram Image */}
              {currentQ.figure_image_url && (
                <div className="mb-6 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center">
                  <div className="flex items-center gap-1.5 self-start mb-2 text-xs font-semibold text-slate-400">
                    <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                    <span>Referenced Figure</span>
                  </div>
                  <img
                    src={currentQ.figure_image_url}
                    alt={`Diagram for question ${currentQ.number || currentIndex + 1}`}
                    className="max-h-72 object-contain rounded-lg border border-slate-800"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Question Prompt */}
              <div className="mb-6">
                <FormattedContent
                  text={currentQ.text}
                  className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed"
                />
              </div>

              {/* Options List */}
              <div className="space-y-3">
                {currentQ.options.map((opt) => {
                  const isSelected = selectedOptions.includes(opt.label);
                  const isPracticeChecked = Boolean(currentPractice);
                  const isPracticeCorrect = currentPractice?.correct_options.includes(opt.label);
                  const isPracticeSelectedWrong = isPracticeChecked && isSelected && !isPracticeCorrect;

                  let cardStyle = 'border-slate-800 bg-[#0E1117]/60 hover:border-slate-700 hover:bg-slate-900/60';
                  if (isPracticeChecked) {
                    if (isPracticeCorrect) {
                      cardStyle = 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30';
                    } else if (isPracticeSelectedWrong) {
                      cardStyle = 'border-red-500 bg-red-500/10 ring-1 ring-red-500/30';
                    }
                  } else if (isSelected) {
                    cardStyle = 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30';
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
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-150 group ${cardStyle}`}
                    >
                      {/* Letter Icon */}
                      <span
                        className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-orange-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </span>

                      {/* Option Text */}
                      <FormattedContent
                        text={opt.text}
                        as="span"
                        className="flex-grow text-sm sm:text-base font-normal text-slate-200"
                      />

                      {/* Checked indicator */}
                      {isSelected && !isPracticeChecked && (
                        <div className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}

                      {/* Practice indicator */}
                      {isPracticeChecked && isPracticeCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      )}
                      {isPracticeChecked && isPracticeSelectedWrong && (
                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Practice Mode Feedback Box */}
              {session.mode === 'practice' && (
                <div className="mt-6 pt-4 border-t border-slate-800">
                  {!currentPractice ? (
                    <button
                      onClick={handlePracticeCheck}
                      disabled={selectedOptions.length === 0}
                      className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-colors disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                    >
                      <span>Check Answer</span>
                    </button>
                  ) : (
                    <div
                      className={`p-4 rounded-xl border text-xs space-y-2 ${
                        currentPractice.is_correct
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-red-500/10 border-red-500/30 text-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        {currentPractice.is_correct ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Correct Answer</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>Incorrect. Correct Option: {currentPractice.correct_options.join(', ')}</span>
                          </>
                        )}
                      </div>
                      {currentPractice.explanation && (
                        <div className="text-slate-300 font-normal leading-relaxed mt-1 pl-6">
                          <strong className="text-slate-100 block mb-0.5">Explanation:</strong>
                          <FormattedContent text={currentPractice.explanation} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Question Navigation Controls */}
            <div className="flex items-center justify-between pt-6 mt-8 border-t border-slate-800 gap-4">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium px-3 py-1 rounded-md bg-slate-900 border border-slate-800">
                <Keyboard className="w-3.5 h-3.5 text-orange-400" />
                <span>Shortcuts: A-D select &bull; &larr; &rarr; navigate &bull; F flag</span>
              </div>

              {currentIndex < totalQ - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQ - 1, prev + 1))}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Submit Exam</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette */}
        <div
          className={`md:col-span-4 lg:col-span-3 ${
            isPaletteOpenMobile
              ? 'fixed inset-0 z-50 bg-[#0E1117]/95 p-6 flex flex-col'
              : 'hidden md:flex flex-col'
          }`}
        >
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl p-5 flex-grow flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-orange-400" />
                  Question Palette
                </span>
                {isPaletteOpenMobile && (
                  <button
                    onClick={() => setIsPaletteOpenMobile(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                  >
                    Close
                  </button>
                )}
              </div>

              {/* Palette Legend */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>{answeredCount} Done</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>{flaggedCount} Flagged</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span>{unansweredCount} Left</span>
                </div>
              </div>

              {/* Palette Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {questionsList.map((q, idx) => {
                  const ans = answersMap[q.id];
                  const hasAnswer = ans?.selected_options && ans.selected_options.length > 0;
                  const flagged = Boolean(ans?.flagged);
                  const isCurrent = idx === currentIndex;

                  let colorStyle = 'bg-slate-800/80 text-slate-300 hover:bg-slate-700';
                  if (flagged) {
                    colorStyle = 'bg-amber-500 text-slate-950 font-bold';
                  } else if (hasAnswer) {
                    colorStyle = 'bg-emerald-600 text-white font-bold';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsPaletteOpenMobile(false);
                      }}
                      className={`h-9 rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer relative ${colorStyle} ${
                        isCurrent ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[#161B22]' : ''
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

            {/* Verification Badge */}
            <div className="pt-4 border-t border-slate-800 mt-4 text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Isolated session verification</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Submit Confirmation Dialog */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Submit Examination</h3>
                <p className="text-xs text-slate-400">Review your question status before finalizing.</p>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div>
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Answered</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{answeredCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Unanswered</div>
                <div className="text-lg font-bold text-orange-400 mt-0.5">{unansweredCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Flagged</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{flaggedCount}</div>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. Are you sure you want to finish now?</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Keep Reviewing
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Grading Answers...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Submit</span>
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
