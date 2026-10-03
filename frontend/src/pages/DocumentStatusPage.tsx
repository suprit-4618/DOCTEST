import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RotateCcw, 
  Sparkles,
  Eye,
  BookOpenCheck
} from 'lucide-react';
import { getDocument, getPageImageUrl } from '../api/documents';
import type { DocumentResponse } from '../types';

export const DocumentStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreviewPage, setSelectedPreviewPage] = useState<number>(1);

  const fetchStatus = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getDocument(id);
      setDoc(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch document status';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (doc?.status === 'processing' || doc?.status === 'uploaded' || !doc) {
        fetchStatus();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [id, doc?.status, fetchStatus]);

  if (loading && !doc) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
        <p className="text-slate-400">Loading document status...</p>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Document Not Found</h2>
        <p className="text-slate-400 text-sm mt-2">{error}</p>
        <button
          onClick={() => navigate('/upload')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Back to Upload
        </button>
      </div>
    );
  }

  const isProcessing = doc?.status === 'processing' || doc?.status === 'uploaded';
  const isExtracted = doc?.status === 'extracted';
  const isFailed = doc?.status === 'failed';

  const progressPercent = doc
    ? Math.min(100, Math.round(((doc.pages_processed || 0) / Math.max(doc.page_count, 1)) * 100))
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-rose-500 dark:text-rose-300 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-400/30 shadow-sm">
              {doc?.file_type?.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {doc?.id.slice(0, 8)}...</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1.5 font-heading">{doc?.filename}</h1>
        </div>

        <Link
          to="/upload"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-rose-400 transition px-3.5 py-2 rounded-2xl bg-slate-800/80 shadow-cozy-pill"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Upload Another
        </Link>
      </div>

      {/* Main Status Container */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-cozy mb-8">
        {/* Processing State */}
        {isProcessing && (
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-400/25 text-rose-400 shadow-sm">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white font-heading">Brewing Your Test Paper 🍵...</h2>
                <p className="text-xs text-slate-400">
                  Relax while we gently read and normalize every page into high-clarity sheets.
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-bold">
                <span>
                  Processing page {doc?.pages_processed || 0} of {doc?.page_count || 1}
                </span>
                <span className="font-mono text-rose-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-950/60 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/60 shadow-inner">
                <div
                  className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(progressPercent, 5)}%` }}
                />
              </div>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80 text-xs font-bold">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> 1. Uploaded &amp; Verified
              </div>
              <div className="flex items-center gap-2 text-rose-400 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" /> 2. Normalizing Pages
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Sparkles className="w-4 h-4" /> 3. MCQ Extraction
              </div>
            </div>
          </div>
        )}

        {/* Failed State */}
        {isFailed && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 shadow-cozy">
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-200 font-heading">Ingestion Encountered an Issue</h3>
                <p className="text-xs text-red-300/90 mt-1">
                  {doc?.error_message || 'An unexpected error occurred while processing the document.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/upload')}
              className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold transition shadow-cozy-pill cursor-pointer"
            >
              Try Uploading Again
            </button>
          </div>
        )}

        {/* Success / Extracted State */}
        {isExtracted && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-400/30 shadow-sm">
              <div className="flex items-center gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-white font-heading">Document Ready for Practice! 🌟</h3>
                  <p className="text-xs text-emerald-300/90">
                    Successfully extracted questions from {doc?.page_count} page{doc && doc.page_count > 1 ? 's' : ''}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/documents/${doc?.id}/review`)}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-95 text-white text-xs font-black shadow-cozy transition cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
                >
                  <BookOpenCheck className="w-4 h-4" /> Review Questions ✨
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Pages</div>
                <div className="text-xl font-black text-white mt-1 font-heading">{doc?.page_count}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Questions</div>
                <div className="text-xl font-black text-rose-400 mt-1 font-heading">{doc?.question_count || 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Resolution</div>
                <div className="text-xl font-black text-slate-200 mt-1 font-mono">150 DPI</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 shadow-inner text-center">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Status</div>
                <div className="text-xl font-black text-emerald-400 mt-1 capitalize font-heading">{doc?.status}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rendered Page Image Gallery / Viewer */}
      {isExtracted && doc && doc.id && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              Rendered Page Preview (Page {selectedPreviewPage} of {doc.page_count})
            </h3>
          </div>

          {/* Page Selector Tabs */}
          {doc.page_count > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
              {Array.from({ length: doc.page_count }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setSelectedPreviewPage(pageNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedPreviewPage === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Page {pageNum}
                </button>
              ))}
            </div>
          )}

          {/* Image Display */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-center justify-center overflow-auto max-h-[600px]">
            <img
              src={getPageImageUrl(doc.id, selectedPreviewPage || 1)}
              alt={`Page ${selectedPreviewPage}`}
              className="max-w-full h-auto rounded shadow-lg border border-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
