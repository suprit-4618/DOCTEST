import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Sparkles,
  Clock,
  Shuffle,
  MinusCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Layers,
  Target,
  CheckCheck
} from 'lucide-react';
import { getDocument, getDocumentQuestions } from '../api/documents';
import { createSession } from '../api/sessions';
import type { DocumentResponse, QuestionDetail, SessionMode, SessionCreate } from '../types';

export const TestSetupPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [starting, setStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Setup form states
  const [mode, setMode] = useState<SessionMode>('exam');
  const [questionCountType, setQuestionCountType] = useState<'all' | 'custom'>('all');
  const [customQuestionCount, setCustomQuestionCount] = useState<number>(10);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(false);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [negativeMarking, setNegativeMarking] = useState<number>(0.0);
  const [targetScoreEnabled, setTargetScoreEnabled] = useState<boolean>(false);
  const [targetScorePercentage, setTargetScorePercentage] = useState<number>(70);
  const [partialCredit, setPartialCredit] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const [docData, questionsData] = await Promise.all([
          getDocument(id),
          getDocumentQuestions(id),
        ]);
        setDoc(docData);
        setQuestions(questionsData);
        if (questionsData.length > 0) {
          setCustomQuestionCount(Math.min(10, questionsData.length));
          // Suggested default timer: ~1.5 min per question
          setTimeLimitMinutes(Math.max(5, Math.round(questionsData.length * 1.5)));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load test metadata');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleStartTest = async () => {
    if (!id) return;
    try {
      setStarting(true);
      setError(null);

      const payload: SessionCreate = {
        document_id: id,
        mode: mode,
        time_limit_seconds: timerEnabled ? timeLimitMinutes * 60 : null,
        question_count: questionCountType === 'custom' ? customQuestionCount : undefined,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        negative_marking: negativeMarking,
        target_score_percentage: targetScoreEnabled ? targetScorePercentage : null,
        partial_credit: partialCredit,
      };

      const session = await createSession(payload);
      navigate(`/sessions/${session.id}/test`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch test session');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
        <p className="text-slate-400">Configuring exam environment...</p>
      </div>
    );
  }

  const totalAvailable = questions.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back Button */}
      <Link
        to={id ? `/documents/${id}/review` : '/'}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 transition"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Question Review
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-500 dark:text-rose-300 text-xs font-black uppercase tracking-wider mb-3 shadow-sm">
          <GraduationCap className="w-4 h-4" /> Quiz Setup &amp; Preferences 🍵
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-heading">
          Configure Your Practice Test
        </h1>
        <p className="mt-1 text-sm text-slate-400 font-medium">
          Document: <strong className="text-white px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 ml-0.5 mr-0.5">{doc?.filename}</strong> ({totalAvailable} total questions available)
        </p>
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-400/25 text-rose-600 dark:text-rose-200 text-xs flex items-center gap-3 mb-8 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-rose-400 flex-shrink-0" />
        <span>
          <strong>Zero Leakage:</strong> Correct answers are strictly isolated and never transmitted until you choose to submit. Practice peacefully without spoilers! 🧸
        </span>
      </div>

      <div className="space-y-6">
        {/* Step 1: Mode Selection */}
        <div>
          <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-3 font-heading">
            1. Select Test Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Exam Mode Card */}
            <div
              onClick={() => setMode('exam')}
              className={`p-6 rounded-3xl border-2 cursor-pointer transition-all duration-200 shadow-cozy hover:scale-[1.01] ${
                mode === 'exam'
                  ? 'border-rose-400 bg-rose-500/10 ring-2 ring-rose-400/25'
                  : 'border-slate-800 bg-slate-900 hover:border-rose-400/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-white flex items-center gap-2 font-heading">
                  <GraduationCap className="w-5 h-5 text-rose-400" />
                  Exam Mode 🎯
                </span>
                {mode === 'exam' && <CheckCircle2 className="w-5 h-5 text-rose-400" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Realistic exam simulation. No answers or hints are revealed during the test. Complete scorecard & detailed review presented upon submission.
              </p>
            </div>

            {/* Practice Mode Card */}
            <div
              onClick={() => setMode('practice')}
              className={`p-6 rounded-3xl border-2 cursor-pointer transition-all duration-200 shadow-cozy hover:scale-[1.01] ${
                mode === 'practice'
                  ? 'border-rose-400 bg-rose-500/10 ring-2 ring-rose-400/25'
                  : 'border-slate-800 bg-slate-900 hover:border-rose-400/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-white flex items-center gap-2 font-heading">
                  <Sparkles className="w-5 h-5 text-rose-400" />
                  Practice Mode 🍵
                </span>
                {mode === 'practice' && <CheckCircle2 className="w-5 h-5 text-rose-400" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Gentle interactive mode. Receive immediate cheerful feedback and explanations for each question as you practice.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Number of Questions */}
        <div className="p-6 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-cozy">
          <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-3 font-heading">
            2. Question Count
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setQuestionCountType('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-cozy-pill cursor-pointer ${
                questionCountType === 'all'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              All {totalAvailable} Questions
            </button>
            <button
              type="button"
              onClick={() => setQuestionCountType('custom')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-cozy-pill cursor-pointer ${
                questionCountType === 'custom'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Random Subset
            </button>

            {questionCountType === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalAvailable}
                  value={customQuestionCount}
                  onChange={(e) =>
                    setCustomQuestionCount(
                      Math.max(1, Math.min(totalAvailable, parseInt(e.target.value) || 1))
                    )
                  }
                  className="w-20 px-3 py-1.5 bg-slate-950 border-2 border-slate-700 rounded-xl text-white text-xs font-bold text-center focus:outline-none focus:border-rose-400"
                />
                <span className="text-xs text-slate-400 font-semibold">questions</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Timer Options */}
        <div className="p-6 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-cozy space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-rose-400" />
              <div>
                <span className="text-sm font-bold text-white font-heading">Gentle Timer</span>
                <p className="text-xs text-slate-400">Countdown timer with automatic submit on expiry</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>

          {timerEnabled && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTimeLimitMinutes(mins)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-cozy-pill ${
                    timeLimitMinutes === mins
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {mins} min
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2.5 py-1 bg-slate-950 border-2 border-slate-700 rounded-xl text-white text-xs font-bold text-center focus:outline-none focus:border-rose-400"
                />
                <span className="text-xs text-slate-400 font-semibold">custom mins</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Randomization & Negative Marking */}
        <div className="p-6 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-cozy space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shuffle className="w-5 h-5 text-rose-400" />
              <div>
                <span className="text-sm font-bold text-white font-heading">Shuffle Questions</span>
                <p className="text-xs text-slate-400">Randomize question presentation order</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="w-5 h-5 rounded-lg border-slate-700 text-rose-500 focus:ring-rose-400 cursor-pointer accent-rose-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-rose-400" />
              <div>
                <span className="text-sm font-bold text-white font-heading">Shuffle Options</span>
                <p className="text-xs text-slate-400">Randomize option order (A/B/C/D) per question</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={shuffleOptions}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              className="w-5 h-5 rounded-lg border-slate-700 text-rose-500 focus:ring-rose-400 cursor-pointer accent-rose-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <MinusCircle className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-sm font-bold text-white font-heading">Negative Marking Penalty</span>
                <p className="text-xs text-slate-400">Deduct marks for incorrect answers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[0.0, 0.25, 0.33, 0.5].map((penalty) => (
                <button
                  key={penalty}
                  type="button"
                  onClick={() => setNegativeMarking(penalty)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-cozy-pill ${
                    negativeMarking === penalty
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {penalty === 0.0 ? 'None (0)' : `-${penalty}`}
                </button>
              ))}
            </div>
          </div>

          {/* Partial Credit */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <CheckCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-sm font-bold text-white font-heading">Partial Credit (Multi-choice)</span>
                <p className="text-xs text-slate-400">Award proportional score for partially correct selections</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={partialCredit}
              onChange={(e) => setPartialCredit(e.target.checked)}
              className="w-5 h-5 rounded-lg border-slate-700 text-rose-500 focus:ring-rose-400 cursor-pointer accent-rose-500"
            />
          </div>

          {/* Target Passing Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-rose-400" />
              <div>
                <span className="text-sm font-bold text-white font-heading">Target Passing Score</span>
                <p className="text-xs text-slate-400">Display Pass/Fail badge on results</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={targetScoreEnabled}
                onChange={(e) => setTargetScoreEnabled(e.target.checked)}
                className="w-5 h-5 rounded-lg border-slate-700 text-rose-500 focus:ring-rose-400 cursor-pointer mr-2 accent-rose-500"
              />
              {targetScoreEnabled && (
                <div className="flex items-center gap-1.5">
                  {[50, 70, 80].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTargetScorePercentage(pct)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-cozy-pill ${
                        targetScorePercentage === pct
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={targetScorePercentage}
                    onChange={(e) => setTargetScorePercentage(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-14 px-2 py-1 bg-slate-950 border-2 border-slate-700 rounded-xl text-white text-xs text-center font-bold"
                  />
                  <span className="text-xs text-slate-400 font-bold">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs shadow-cozy">
            {error}
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartTest}
          disabled={starting || totalAvailable === 0}
          className="w-full py-4 px-6 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-base shadow-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
        >
          {starting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Preparing Your Quiz Cozy Nook...</span>
            </>
          ) : (
            <>
              <span>Begin {mode === 'exam' ? 'Exam' : 'Practice Session'} ✨</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
