import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Calendar,
  Trophy,
  History,
  AlertTriangle,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  Play,
  TrendingUp,
  FileDown,
  Sparkles,
  Loader2,
  Search,
  ChevronRight,
  Layers,
  FileCode,
  Eye,
  Plus
} from 'lucide-react';
import {
  listDocuments,
  renameDocument,
  deleteDocument,
  getDocumentAttempts,
  getDocumentWeakQuestions,
  practiceWeakQuestions,
  getExportJsonUrl,
  getExportPdfUrl,
  importDocumentJson,
} from '../api/documents';
import type {
  DocumentLibraryItem,
  AttemptHistoryItem,
  WeakQuestionItem,
  DocumentImportRequest,
} from '../types';

export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Rename state
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editFilename, setEditFilename] = useState<string>('');
  const [renaming, setRenaming] = useState<boolean>(false);

  // Delete state
  const [deletingDoc, setDeletingDoc] = useState<DocumentLibraryItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Attempt History Modal state
  const [historyDoc, setHistoryDoc] = useState<DocumentLibraryItem | null>(null);
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Weak Questions Modal state
  const [weakDoc, setWeakDoc] = useState<DocumentLibraryItem | null>(null);
  const [weakQuestions, setWeakQuestions] = useState<WeakQuestionItem[]>([]);
  const [loadingWeak, setLoadingWeak] = useState<boolean>(false);
  const [launchingWeak, setLaunchingWeak] = useState<boolean>(false);

  // Export Modal state
  const [exportDoc, setExportDoc] = useState<DocumentLibraryItem | null>(null);

  // Import JSON state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<boolean>(false);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listDocuments();
      setDocuments(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Handle Rename
  const handleStartRename = (doc: DocumentLibraryItem) => {
    setEditingDocId(doc.id);
    setEditFilename(doc.filename);
  };

  const handleSaveRename = async (docId: string) => {
    if (!editFilename.trim()) return;
    try {
      setRenaming(true);
      await renameDocument(docId, editFilename.trim());
      setEditingDocId(null);
      await loadDocuments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to rename document');
    } finally {
      setRenaming(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    try {
      setDeleting(true);
      await deleteDocument(deletingDoc.id);
      setDeletingDoc(null);
      await loadDocuments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  // Open Attempt History
  const handleOpenHistory = async (doc: DocumentLibraryItem) => {
    setHistoryDoc(doc);
    try {
      setLoadingHistory(true);
      const data = await getDocumentAttempts(doc.id);
      setAttempts(data);
    } catch (err) {
      console.error('Failed to load attempts:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Weak Questions
  const handleOpenWeak = async (doc: DocumentLibraryItem) => {
    setWeakDoc(doc);
    try {
      setLoadingWeak(true);
      const data = await getDocumentWeakQuestions(doc.id);
      setWeakQuestions(data);
    } catch (err) {
      console.error('Failed to load weak questions:', err);
    } finally {
      setLoadingWeak(false);
    }
  };

  // Launch Weak Practice Session
  const handlePracticeWeak = async (docId: string) => {
    try {
      setLaunchingWeak(true);
      const session = await practiceWeakQuestions(docId);
      navigate(`/sessions/${session.id}/test`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to launch weak question practice');
      setLaunchingWeak(false);
    }
  };

  // Import JSON file
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const parsed = JSON.parse(text);

      let payload: DocumentImportRequest;
      if (parsed.questions && Array.isArray(parsed.questions)) {
        payload = {
          filename: parsed.document?.title || file.name.replace(/\.json$/i, ''),
          questions: parsed.questions,
        };
      } else if (Array.isArray(parsed)) {
        payload = {
          filename: file.name.replace(/\.json$/i, ''),
          questions: parsed,
        };
      } else {
        throw new Error('Invalid question set JSON format');
      }

      const imported = await importDocumentJson(payload);
      await loadDocuments();
      navigate(`/documents/${imported.id}/review`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to import JSON question set');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) {
      return <span className="text-slate-400 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20">Not tested</span>;
    }
    let colorClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-400/30';
    let icon = '🌱';
    if (score >= 80) {
      colorClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-400/30';
      icon = '🌟';
    } else if (score >= 60) {
      colorClass = 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-400/30';
      icon = '✨';
    } else if (score >= 40) {
      colorClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-400/30';
      icon = '☕';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black font-sans shadow-sm ${colorClass}`}>
        <span>{icon}</span>
        <span>{score}%</span>
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-500 dark:text-rose-300 text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Document Library &amp; Question Vault
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-heading">
            Focus bruh
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Upload any PDF, Word document, image scan, or paste raw text to practice interactive tests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700/80 transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-cozy-pill hover:scale-[1.02]"
            title="Import pre-extracted question set JSON without calling AI"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <FileDown className="w-4 h-4 text-rose-400" />}
            <span>Import JSON</span>
          </button>

          <Link
            to="/upload"
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:opacity-95 text-white text-xs font-black shadow-cozy hover:shadow-cozy-hover transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Test</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-cozy mb-6">
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tests by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-400 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-semibold pr-2">
          Total: <strong className="text-white px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 ml-1">{filteredDocs.length}</strong> test{filteredDocs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-rose-400 mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-semibold">Loading your study library...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-red-950/30 border border-red-800/50 text-red-300 text-center shadow-cozy">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={loadDocuments}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-2xl text-xs font-bold hover:bg-slate-700 transition"
          >
            Try Again
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/60 border-2 border-dashed border-slate-700/60 text-center space-y-4 shadow-cozy">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-white font-heading">Your Study Desk is Empty! ☕</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? 'No documents matched your search filter.'
              : 'Add your first PDF or image test paper to begin your cozy practice journey!'}
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white text-xs font-black shadow-cozy hover:shadow-cozy-hover transition-all duration-200 hover:scale-[1.02]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload First Test</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocs.map((doc) => {
            const isEditing = editingDocId === doc.id;
            const formattedDate = new Date(doc.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={doc.id}
                className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border-2 border-slate-800/80 hover:border-rose-400/40 transition-all duration-200 shadow-cozy hover:shadow-cozy-hover flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left Document Info */}
                <div className="flex items-start gap-4 flex-grow min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-400/20 text-rose-500 dark:text-rose-300 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform duration-200">
                    <FileText className="w-6 h-6" />
                  </div>

                  <div className="min-w-0 flex-grow">
                    {/* Inline Rename */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 max-w-md mb-1.5">
                        <input
                          type="text"
                          value={editFilename}
                          onChange={(e) => setEditFilename(e.target.value)}
                          className="px-3 py-1.5 bg-slate-950 border-2 border-rose-400 rounded-xl text-sm text-white font-bold focus:outline-none flex-grow"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(doc.id);
                            if (e.key === 'Escape') setEditingDocId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(doc.id)}
                          disabled={renaming}
                          className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition cursor-pointer shadow-sm"
                          title="Save Name"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingDocId(null)}
                          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-md group-hover:text-rose-400 transition-colors font-heading">
                          {doc.filename}
                        </h2>
                        <button
                          onClick={() => handleStartRename(doc)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Rename Document"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Metadata Subtitle */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formattedDate}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1.5 font-bold text-slate-300">
                        <Layers className="w-3.5 h-3.5 text-rose-400" />
                        {doc.question_count || 0} Questions
                      </span>
                      <span>&bull;</span>
                      <span className="uppercase text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300">
                        {doc.file_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats Cards */}
                <div className="flex items-center gap-3 sm:gap-4 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80 flex-shrink-0 shadow-inner">
                  <div className="text-center px-2">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Best Score</div>
                    <div className="mt-1">{getScoreBadge(doc.best_score)}</div>
                  </div>

                  <div className="w-[1px] h-8 bg-slate-800" />

                  <div className="text-center px-2">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Last Score</div>
                    <div className="mt-1">{getScoreBadge(doc.last_score)}</div>
                  </div>

                  <div className="w-[1px] h-8 bg-slate-800" />

                  <div className="text-center px-2">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Attempts</div>
                    <div className="text-xs font-black text-slate-200 mt-1 font-sans">
                      {doc.attempt_count}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
                  {/* Attempt History */}
                  <button
                    onClick={() => handleOpenHistory(doc)}
                    disabled={doc.attempt_count === 0}
                    className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-cozy-pill hover:scale-105 active:scale-95"
                    title="View Attempt History & Score Chart"
                  >
                    <History className="w-4 h-4 text-rose-400" />
                  </button>

                  {/* Weak Questions */}
                  <button
                    onClick={() => handleOpenWeak(doc)}
                    disabled={doc.attempt_count === 0}
                    className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-cozy-pill hover:scale-105 active:scale-95"
                    title="View Most Missed Questions & Practice"
                  >
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </button>

                  {/* Export Options */}
                  <button
                    onClick={() => setExportDoc(doc)}
                    className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white transition cursor-pointer shadow-cozy-pill hover:scale-105 active:scale-95"
                    title="Export as JSON or Printable PDF"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                  </button>

                  {/* Review / Edit Questions */}
                  <Link
                    to={`/documents/${doc.id}/review`}
                    className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white transition shadow-cozy-pill hover:scale-105 active:scale-95"
                    title="Review & Edit Question Bank"
                  >
                    <Eye className="w-4 h-4 text-slate-300" />
                  </Link>

                  {/* Delete */}
                  <button
                    onClick={() => setDeletingDoc(doc)}
                    className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer shadow-cozy-pill hover:scale-105 active:scale-95"
                    title="Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Start Test */}
                  <Link
                    to={`/documents/${doc.id}/setup`}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:opacity-95 text-white font-black text-xs shadow-cozy hover:shadow-cozy-hover transition-all duration-200 flex items-center gap-1.5 ml-1 hover:scale-[1.03] active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Take Test ✨</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Attempt History & Score Over Time */}
      {historyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Attempt History</h3>
                  <p className="text-xs text-slate-400 truncate max-w-sm">{historyDoc.filename}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryDoc(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-xs">Loading historical attempts...</p>
              </div>
            ) : attempts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No completed attempts recorded yet.</p>
            ) : (
              <div className="space-y-6">
                {/* Score Progression SVG Sparkline Chart */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center justify-between">
                    <span>Score Progression Over Time</span>
                    <span className="text-[11px] text-indigo-400 font-bold font-mono">
                      {attempts.length} Attempt{attempts.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* SVG Line Chart */}
                  <div className="w-full relative flex items-center justify-center">
                    {(() => {
                      const width = 520;
                      const height = 140;
                      const padLeft = 44;
                      const padRight = 30;
                      const padTop = 26;
                      const padBottom = 24;
                      const plotW = width - padLeft - padRight;
                      const plotH = height - padTop - padBottom;

                      const coords = attempts.map((a, i) => {
                        const score = Math.round(a.score_percentage || 0);
                        const x = attempts.length === 1
                          ? padLeft + plotW / 2
                          : padLeft + (i / (attempts.length - 1)) * plotW;
                        const y = padTop + (1 - Math.max(0, Math.min(100, score)) / 100) * plotH;
                        return { x, y, score, id: a.session_id, idx: i + 1 };
                      });

                      const y100 = padTop;
                      const y50 = padTop + plotH / 2;
                      const y0 = padTop + plotH;

                      return (
                        <svg className="w-full h-auto max-h-40" viewBox={`0 0 ${width} ${height}`}>
                          <defs>
                            <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="scoreLineGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#818cf8" />
                              <stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines & Y-Axis Labels */}
                          <text x={padLeft - 8} y={y100 + 3.5} textAnchor="end" fontSize="9.5" fill="#64748b" className="font-mono">100%</text>
                          <line x1={padLeft} y1={y100} x2={width - padRight} y2={y100} stroke="#1e293b" strokeDasharray="3 3" />

                          <text x={padLeft - 8} y={y50 + 3.5} textAnchor="end" fontSize="9.5" fill="#64748b" className="font-mono">50%</text>
                          <line x1={padLeft} y1={y50} x2={width - padRight} y2={y50} stroke="#1e293b" strokeDasharray="3 3" />

                          <text x={padLeft - 8} y={y0 + 3.5} textAnchor="end" fontSize="9.5" fill="#64748b" className="font-mono">0%</text>
                          <line x1={padLeft} y1={y0} x2={width - padRight} y2={y0} stroke="#334155" strokeDasharray="3 3" />

                          {/* Gradient fill area under the line */}
                          {coords.length > 1 && (
                            <polygon
                              fill="url(#scoreAreaGradient)"
                              points={`${coords.map(c => `${c.x},${c.y}`).join(' ')} ${coords[coords.length - 1].x},${y0} ${coords[0].x},${y0}`}
                            />
                          )}

                          {/* Polyline */}
                          {coords.length > 1 && (
                            <polyline
                              fill="none"
                              stroke="url(#scoreLineGradient)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={coords.map(c => `${c.x},${c.y}`).join(' ')}
                            />
                          )}

                          {/* Points and Score Badges */}
                          {coords.map((c) => {
                            const labelY = c.y <= padTop + 14 ? c.y + 14 : c.y - 8;
                            return (
                              <g key={c.id}>
                                <circle cx={c.x} cy={c.y} r="6" fill="#818cf8" fillOpacity="0.2" />
                                <circle cx={c.x} cy={c.y} r="3.5" fill="#a5b4fc" stroke="#0f172a" strokeWidth="2" />
                                <text
                                  x={c.x}
                                  y={labelY}
                                  fontSize="10"
                                  fill="#c7d2fe"
                                  textAnchor="middle"
                                  fontWeight="600"
                                  className="font-mono"
                                >
                                  {c.score}%
                                </text>
                                <text
                                  x={c.x}
                                  y={y0 + 15}
                                  fontSize="9"
                                  fill="#64748b"
                                  textAnchor="middle"
                                  className="font-mono"
                                >
                                  #{c.idx}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Table of Attempts */}
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {attempts.map((att, idx) => {
                    const dateStr = new Date(att.submitted_at || att.started_at).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });
                    const mins = Math.floor(att.time_taken_seconds / 60);
                    const secs = att.time_taken_seconds % 60;

                    return (
                      <div
                        key={att.session_id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-300 font-bold flex items-center justify-center text-[11px]">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-200">{dateStr}</div>
                            <div className="text-[11px] text-slate-500 uppercase font-medium">
                              {att.mode} mode &bull; {mins}m {secs}s
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-slate-200">
                              {att.correct_count} / {att.total_questions} Correct
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {att.score_earned} points
                            </div>
                          </div>
                          {getScoreBadge(att.score_percentage)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Weak-Areas View */}
      {weakDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Weak Areas &amp; Missed Questions</h3>
                  <p className="text-xs text-slate-400 truncate max-w-sm">{weakDoc.filename}</p>
                </div>
              </div>
              <button
                onClick={() => setWeakDoc(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingWeak ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-xs">Analyzing historical mistakes...</p>
              </div>
            ) : weakQuestions.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Trophy className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-white">No weak questions detected!</p>
                <p className="text-xs text-slate-400">You have answered all tested questions correctly across attempts.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Found <strong className="text-amber-400">{weakQuestions.length}</strong> frequently missed question{weakQuestions.length > 1 ? 's' : ''}:
                  </span>

                  <button
                    onClick={() => handlePracticeWeak(weakDoc.id)}
                    disabled={launchingWeak}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {launchingWeak ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>Practice My Weak Questions</span>
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {weakQuestions.map((q) => (
                    <div
                      key={q.question_id}
                      className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-300">
                          Q{q.number || '?'}:
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-800/40 text-rose-300 text-[11px] font-semibold">
                          Missed {q.mistake_count} of {q.attempt_count} times ({Math.round(q.error_rate * 100)}% error)
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium leading-relaxed">
                        {q.text}
                      </p>

                      <div className="text-[11px] text-emerald-400 font-medium">
                        Correct Answer: {q.correct_options.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Export Options */}
      {exportDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Export Question Bank</h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs">{exportDoc.filename}</p>
                </div>
              </div>
              <button
                onClick={() => setExportDoc(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Export Option 1: Clean JSON */}
              <a
                href={getExportJsonUrl(exportDoc.id)}
                download
                onClick={() => setExportDoc(null)}
                className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Cleaned JSON Question Set</div>
                    <div className="text-[11px] text-slate-400">Structured JSON for backup or instant re-import</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </a>

              {/* Export Option 2: Blank Exam Paper PDF */}
              <a
                href={getExportPdfUrl(exportDoc.id, false)}
                download
                onClick={() => setExportDoc(null)}
                className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Printable Blank Test Paper (PDF)</div>
                    <div className="text-[11px] text-slate-400">Clean exam paper with check-boxes and NO answers</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </a>

              {/* Export Option 3: Printable PDF with Separate Answer Key */}
              <a
                href={getExportPdfUrl(exportDoc.id, true)}
                download
                onClick={() => setExportDoc(null)}
                className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Test Paper + Answer Key Page (PDF)</div>
                    <div className="text-[11px] text-slate-400">Blank test with separate teacher solutions at the end</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 rounded-2xl bg-red-950/50 border border-red-800/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Document?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{deletingDoc.filename}</strong>?
              This will erase all extracted questions, attempt histories, and wipe stored page images from the disk.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
