import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RotateCcw, 
  Eye,
  BookOpenCheck,
  AlertTriangle,
  Play
} from 'lucide-react';
import { getDocument, getPageImageUrl, triggerAiExtraction } from '../api/documents';
import type { DocumentResponse } from '../types';

export const DocumentStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [extracting, setExtracting] = useState<boolean>(false);
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

  const handleTriggerExtraction = async () => {
    if (!id) return;
    try {
      setExtracting(true);
      setError(null);
      await triggerAiExtraction(id);
      await fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger extraction');
    } finally {
      setExtracting(false);
    }
  };

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
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">Checking ingestion status...</p>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 font-heading">Document Not Found</h2>
        <p className="text-slate-400 text-sm mt-2">{error}</p>
        <button
          onClick={() => navigate('/upload')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs font-semibold transition cursor-pointer"
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-md border border-orange-500/20 font-mono">
              {doc?.file_type?.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 font-mono">ID: {doc?.id.slice(0, 8)}...</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight font-heading">
            {doc?.filename}
          </h1>
        </div>

        <Link
          to="/upload"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Upload Another
        </Link>
      </div>

      {/* Main Status Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm mb-8 transition-colors">
        {/* Processing State */}
        {isProcessing && (
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 font-heading">Processing Document...</h2>
                <p className="text-xs text-slate-400">
                  Extracting multiple-choice questions, isolating option stems, and preparing exam review.
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-semibold">
                <span>
                  Processing page {doc?.pages_processed || 0} of {doc?.page_count || 1}
                </span>
                <span className="font-mono text-orange-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(progressPercent, 4)}%` }}
                />
              </div>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-xs font-semibold">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1. Uploaded &amp; Verified
              </div>
              <div className="flex items-center gap-2 text-orange-400">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> 2. Normalizing Pages
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <BookOpenCheck className="w-4 h-4" /> 3. Question Extraction
              </div>
            </div>
          </div>
        )}

        {/* Failed State */}
        {isFailed && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-200 text-sm font-heading">Ingestion Encountered an Issue</h3>
                <p className="text-xs text-red-300/90 mt-1 leading-relaxed">
                  {doc?.error_message || 'An unexpected error occurred while processing the document.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTriggerExtraction}
                disabled={extracting}
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>{extracting ? 'Retrying Ingestion...' : 'Retry Extraction'}</span>
              </button>
              <button
                onClick={() => navigate('/upload')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Upload Different File
              </button>
            </div>
          </div>
        )}

        {/* Success / Extracted State */}
        {isExtracted && (
          <div className="space-y-6">
            {doc?.question_count === 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm font-heading">No Questions Extracted Yet</h3>
                    <p className="text-xs text-slate-400">
                      Pages were rendered ({doc?.page_count} pages), but 0 MCQs were detected.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerExtraction}
                    disabled={extracting}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>{extracting ? 'Extracting...' : 'Retry Extraction'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm font-heading">Document Extraction Complete</h3>
                    <p className="text-xs text-slate-400">
                      Successfully extracted {doc?.question_count} questions from {doc?.page_count} page{doc && doc.page_count > 1 ? 's' : ''}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/documents/${doc?.id}/review`)}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <BookOpenCheck className="w-3.5 h-3.5" />
                    <span>Review Questions</span>
                  </button>
                  <button
                    onClick={() => navigate(`/documents/${doc?.id}/setup`)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Configure Test</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Pages</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5 font-mono">{doc?.page_count}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Questions</div>
                <div className="text-lg font-bold text-orange-400 mt-0.5 font-mono">{doc?.question_count || 0}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Resolution</div>
                <div className="text-lg font-bold text-slate-200 mt-0.5 font-mono">150 DPI</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Status</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5 capitalize">{doc?.status}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rendered Page Image Filmstrip / Preview */}
      {isExtracted && doc && doc.id && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 font-heading flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-400" />
              <span>Rendered Page Inspection (Page {selectedPreviewPage} of {doc.page_count})</span>
            </h3>
          </div>

          {/* Page Selector Tabs */}
          {doc.page_count > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4">
              {Array.from({ length: doc.page_count }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setSelectedPreviewPage(pageNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
                    selectedPreviewPage === pageNum
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
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
              className="max-w-full h-auto rounded shadow-sm border border-slate-800"
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
