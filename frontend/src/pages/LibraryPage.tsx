import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Calendar,
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
      return <span className="text-slate-400 text-xs font-medium px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Not tested</span>;
    }
    let colorClass = 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    if (score >= 80) {
      colorClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    } else if (score >= 60) {
      colorClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-bold ${colorClass}`}>
        <span>{score}%</span>
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-sans">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Document Repository &amp; Archive
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Document Library
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Manage your uploaded test papers, inspect question banks, and launch test simulations.
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
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-2 cursor-pointer"
            title="Import pre-extracted question set JSON"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <FileDown className="w-4 h-4 text-orange-400" />}
            <span>Import JSON</span>
          </button>

          <Link
            to="/upload"
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Document</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#161B22] border border-slate-800 mb-6">
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 text-orange-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0E1117] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium pr-2">
          Total: <strong className="text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 ml-1">{filteredDocs.length}</strong> test{filteredDocs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Loading documents...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/30 border border-red-800/50 text-red-300 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={loadDocuments}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
          >
            Try Again
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#161B22] border border-dashed border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">No Documents in Library</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? 'No documents matched your search filter.'
              : 'Upload a PDF or scan to begin extracting questions and taking tests.'}
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
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
                className="p-5 sm:p-6 rounded-2xl bg-[#161B22] border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left Document Info */}
                <div className="flex items-start gap-4 flex-grow min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                          className="px-3 py-1.5 bg-[#0E1117] border border-orange-500 rounded-lg text-sm text-white font-semibold focus:outline-none flex-grow"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(doc.id);
                            if (e.key === 'Escape') setEditingDocId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(doc.id)}
                          disabled={renaming}
                          className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
                          title="Save Name"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingDocId(null)}
                          className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-md group-hover:text-orange-400 transition-colors">
                          {doc.filename}
                        </h2>
                        <button
                          onClick={() => handleStartRename(doc)}
                          className="p-1 text-slate-400 hover:text-orange-400 transition cursor-pointer"
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
                      <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                        <Layers className="w-3.5 h-3.5 text-orange-400" />
                        {doc.question_count || 0} Questions
                      </span>
                      <span>&bull;</span>
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {doc.file_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats Cards */}
                <div className="flex items-center gap-3 sm:gap-4 bg-[#0E1117] p-2.5 rounded-xl border border-slate-800 flex-shrink-0">
                  <div className="text-center px-2">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Best Score</div>
                    <div className="mt-1">{getScoreBadge(doc.best_score)}</div>
                  </div>

                  <div className="w-[1px] h-7 bg-slate-800" />

                  <div className="text-center px-2">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Last Score</div>
                    <div className="mt-1">{getScoreBadge(doc.last_score)}</div>
                  </div>

                  <div className="w-[1px] h-7 bg-slate-800" />

                  <div className="text-center px-2">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Attempts</div>
                    <div className="text-xs font-bold text-slate-200 mt-1">
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
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="View Attempt History"
                  >
                    <History className="w-4 h-4 text-orange-400" />
                  </button>

                  {/* Weak Questions */}
                  <button
                    onClick={() => handleOpenWeak(doc)}
                    disabled={doc.attempt_count === 0}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="View Most Missed Questions"
                  >
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </button>

                  {/* Export Options */}
                  <button
                    onClick={() => setExportDoc(doc)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Export as JSON or PDF"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                  </button>

                  {/* Review / Edit Questions */}
                  <Link
                    to={`/documents/${doc.id}/review`}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Review & Edit Question Bank"
                  >
                    <Eye className="w-4 h-4 text-slate-300" />
                  </Link>

                  {/* Delete */}
                  <button
                    onClick={() => setDeletingDoc(doc)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition cursor-pointer"
                    title="Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Start Test */}
                  <Link
                    to={`/documents/${doc.id}/setup`}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 ml-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Take Test</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Attempt History */}
      {historyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Attempt History</h3>
                  <p className="text-xs text-slate-400">{historyDoc.filename}</p>
                </div>
              </div>
              <button onClick={() => setHistoryDoc(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading attempts...</p>
              </div>
            ) : attempts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No completed attempts recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {attempts.map((att, i) => (
                  <div
                    key={att.session_id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0E1117] border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px]">
                        #{attempts.length - i}
                      </span>
                      <div>
                        <div className="font-semibold text-white">
                          Score: {att.score_percentage}% ({att.score_earned} marks)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(att.started_at).toLocaleString()} &bull; Mode: {att.mode}
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/sessions/${att.session_id}/results`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      View Report
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Weak Questions */}
      {weakDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Most Missed Questions</h3>
                  <p className="text-xs text-slate-400">{weakDoc.filename}</p>
                </div>
              </div>
              <button onClick={() => setWeakDoc(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingWeak ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Analyzing performance data...</p>
              </div>
            ) : weakQuestions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Great job! No repeatedly missed questions found.</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {weakQuestions.map((wq) => (
                    <div
                      key={wq.question_id}
                      className="p-3 rounded-xl bg-[#0E1117] border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">Question {wq.number || ''}</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-[10px]">
                          Missed {wq.mistake_count} times ({Math.round(wq.error_rate * 100)}%)
                        </span>
                      </div>
                      <p className="text-slate-300 truncate">{wq.text}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handlePracticeWeak(weakDoc.id)}
                    disabled={launchingWeak}
                    className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {launchingWeak ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>Practice Weak Questions</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Export Options */}
      {exportDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Export Test Paper</h3>
                  <p className="text-xs text-slate-400">{exportDoc.filename}</p>
                </div>
              </div>
              <button onClick={() => setExportDoc(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={getExportJsonUrl(exportDoc.id)}
                download
                onClick={() => setExportDoc(null)}
                className="p-3 rounded-xl bg-[#0E1117] hover:bg-slate-850 border border-slate-800 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Export JSON Question Set</div>
                    <div className="text-[11px] text-slate-400">Portable format for sharing and backup</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </a>

              <a
                href={getExportPdfUrl(exportDoc.id, false)}
                download
                onClick={() => setExportDoc(null)}
                className="p-3 rounded-xl bg-[#0E1117] hover:bg-slate-850 border border-slate-800 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Printable Blank Test (PDF)</div>
                    <div className="text-[11px] text-slate-400">Clean exam paper with checkboxes</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </a>

              <a
                href={getExportPdfUrl(exportDoc.id, true)}
                download
                onClick={() => setExportDoc(null)}
                className="p-3 rounded-xl bg-[#0E1117] hover:bg-slate-850 border border-slate-800 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Test Paper + Solution Key (PDF)</div>
                    <div className="text-[11px] text-slate-400">Test paper with answer key section at end</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800/40">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Document</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{deletingDoc.filename}</strong>?
              This will erase all questions and attempt history from the database.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingDoc(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
