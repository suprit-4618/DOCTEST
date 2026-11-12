import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
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
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">Configuring examination environment...</p>
      </div>
    );
  }

  const totalAvailable = questions.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 font-sans">
      {/* Back Button */}
      <Link
        to={id ? `/documents/${id}/review` : '/'}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Question Review
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <GraduationCap className="w-4 h-4" /> Test Session Configuration
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight font-heading">
          Configure Your Examination
        </h1>
        <p className="mt-1 text-sm text-slate-400 font-medium">
          Document: <strong className="text-slate-200 px-2 py-0.5 rounded bg-slate-850 border border-slate-750 ml-0.5 mr-0.5">{doc?.filename}</strong> ({totalAvailable} questions available)
        </p>
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center gap-3 mb-8 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <span>
          <strong className="text-slate-100">Isolated Key Security:</strong> Answer verification is isolated server-side. Full results and analytics are generated upon completion.
        </span>
      </div>

      <div className="space-y-6">
        {/* Step 1: Mode Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-heading">
            1. Select Session Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Exam Mode Card */}
            <div
              onClick={() => setMode('exam')}
              className={`p-6 rounded-2xl border cursor-pointer transition-all duration-150 ${
                mode === 'exam'
                  ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-750'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-slate-100 flex items-center gap-2 font-heading">
                  <GraduationCap className="w-5 h-5 text-orange-400" />
                  Examination Mode
                </span>
                {mode === 'exam' && <CheckCircle2 className="w-5 h-5 text-orange-400" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                Standard timed examination. Answers and explanations are concealed until the test is submitted for final grading.
              </p>
            </div>

            {/* Practice Mode Card */}
            <div
              onClick={() => setMode('practice')}
              className={`p-6 rounded-2xl border cursor-pointer transition-all duration-150 ${
                mode === 'practice'
                  ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-750'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-slate-100 flex items-center gap-2 font-heading">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  Practice Mode
                </span>
                {mode === 'practice' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                Self-paced practice. Verify answers on each question instantly and inspect explanations and references.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Number of Questions */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm transition-colors">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-heading">
            2. Question Set Size
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setQuestionCountType('all')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                questionCountType === 'all'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-850 text-slate-300 hover:text-white border border-slate-750'
              }`}
            >
              All {totalAvailable} Questions
            </button>
            <button
              type="button"
              onClick={() => setQuestionCountType('custom')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                questionCountType === 'custom'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-850 text-slate-300 hover:text-white border border-slate-750'
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
                  className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-750 rounded-lg text-slate-100 text-xs font-bold text-center focus:outline-none focus:border-orange-500 font-mono"
                />
                <span className="text-xs text-slate-400 font-medium">questions</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Timer Options */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm transition-colors space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-400" />
              <div>
                <span className="text-sm font-bold text-slate-100 font-heading">Timer</span>
                <p className="text-xs text-slate-400">Time-limited session with automatic submission on expiration</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {timerEnabled && (
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2.5">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTimeLimitMinutes(mins)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer font-mono ${
                    timeLimitMinutes === mins
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-850 text-slate-300 hover:text-white border border-slate-750'
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
                  className="w-16 px-2.5 py-1 bg-slate-950 border border-slate-750 rounded-lg text-slate-100 text-xs font-bold text-center focus:outline-none focus:border-orange-500 font-mono"
                />
                <span className="text-xs text-slate-400 font-medium">custom mins</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Randomization & Marking */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm transition-colors space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shuffle className="w-5 h-5 text-orange-400" />
              <div>
                <span className="text-sm font-bold text-slate-100 font-heading">Shuffle Questions</span>
                <p className="text-xs text-slate-400">Randomize question order for each session</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-orange-400" />
              <div>
                <span className="text-sm font-bold text-slate-100 font-heading">Shuffle Options</span>
                <p className="text-xs text-slate-400">Randomize option order (A/B/C/D) per question</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={shuffleOptions}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <MinusCircle className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-sm font-bold text-slate-100 font-heading">Negative Marking Penalty</span>
                <p className="text-xs text-slate-400">Deduct marks for incorrect answers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[0.0, 0.25, 0.33, 0.5].map((penalty) => (
                <button
                  key={penalty}
                  type="button"
                  onClick={() => setNegativeMarking(penalty)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer font-mono ${
                    negativeMarking === penalty
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-750'
                  }`}
                >
                  {penalty === 0.0 ? 'None (0)' : `-${penalty}`}
                </button>
              ))}
            </div>
          </div>

          {/* Partial Credit */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <CheckCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-sm font-bold text-slate-100 font-heading">Partial Credit</span>
                <p className="text-xs text-slate-400">Award partial credit for multi-select questions</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={partialCredit}
              onChange={(e) => setPartialCredit(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
            />
          </div>

          {/* Target Passing Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-orange-400" />
              <div>
                <span className="text-sm font-bold text-slate-100 font-heading">Target Score Threshold</span>
                <p className="text-xs text-slate-400">Benchmark score percentage on performance report</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={targetScoreEnabled}
                onChange={(e) => setTargetScoreEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer mr-2 accent-orange-600"
              />
              {targetScoreEnabled && (
                <div className="flex items-center gap-1.5">
                  {[50, 70, 80].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTargetScorePercentage(pct)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer font-mono ${
                        targetScorePercentage === pct
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-750'
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
                    className="w-14 px-2 py-1 bg-slate-950 border border-slate-750 rounded-lg text-slate-100 text-xs text-center font-bold font-mono"
                  />
                  <span className="text-xs text-slate-400 font-bold">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartTest}
          disabled={starting || totalAvailable === 0}
          className="w-full py-3.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {starting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Preparing Examination Session...</span>
            </>
          ) : (
            <>
              <span>Begin {mode === 'exam' ? 'Examination' : 'Practice Session'}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
