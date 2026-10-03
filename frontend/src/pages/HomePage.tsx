import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchHealth } from '../api/health';
import type { HealthCheckResponse } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Server, 
  Layers, 
  ShieldCheck, 
  Clock,
  UploadCloud,
  ArrowRight,
  FileCheck2
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealthData(data);
      setLastChecked(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reach backend API';
      setError(message);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <FileCheck2 className="w-3.5 h-3.5" /> High-DPI Ingestion & Zero-Leakage Engine
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          DocTest
        </h1>
        <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Transform any PDF, image photo, Word document, or pasted questions into clean interactive tests with masked answers and backend-verified grading.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-sm transition duration-150 active:scale-95"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document to Ingest
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 hover:border-slate-700 text-slate-100 font-bold text-sm shadow-sm transition duration-150 active:scale-95"
          >
            <Layers className="w-4 h-4 text-rose-500" />
            Open Study Library
          </Link>
        </div>
      </div>

      {/* Backend Health Check Card */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-cozy mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">System Status</h2>
              <p className="text-xs text-slate-500">Verification of FastAPI backend & storage engine at <code className="text-rose-500 font-mono">/api/health</code></p>
            </div>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-750 text-sm font-semibold transition duration-150 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-500' : ''}`} />
            {loading ? 'Checking...' : 'Refresh Status'}
          </button>
        </div>

        {/* Status Content */}
        <div className="pt-6">
          {loading && !healthData && !error && (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
              <span>Connecting to backend server...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/20 text-red-600 dark:text-red-400">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold">Backend Unreachable</div>
                  <div className="text-xs mt-1">{error}</div>
                  <div className="mt-3 text-xs text-slate-500">
                    Ensure FastAPI is running: <code className="text-rose-500 bg-slate-800 px-1.5 py-0.5 rounded">uvicorn app.main:app --reload --port 8000</code> inside the <code className="text-rose-500 bg-slate-800 px-1.5 py-0.5 rounded">backend/</code> directory.
                  </div>
                </div>
              </div>
            </div>
          )}

          {healthData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold">Backend is online and operational</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Application</div>
                  <div className="mt-1 text-sm font-bold text-slate-100">{healthData.app}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">API Version</div>
                  <div className="mt-1 text-sm font-bold font-mono text-rose-500">{healthData.version}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Server Time
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-300 truncate" title={healthData.timestamp}>
                    {new Date(healthData.timestamp).toLocaleTimeString()} ({new Date(healthData.timestamp).toLocaleDateString()})
                  </div>
                </div>
              </div>

              {lastChecked && (
                <div className="text-right text-[11px] text-slate-500 pt-1">
                  Last checked at {lastChecked.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Architecture Blueprint Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-sm">
          <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
            <UploadCloud className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Universal Ingestion</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Multi-page PDF rendering at ~150 DPI with PyMuPDF, EXIF-normalized image auto-rotation, and DOCX conversion.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-sm">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Zero Answer Leakage</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Strict isolation: Correct answers remain securely stored on the backend until test submission.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-sm">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Provenance Tracking</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Tracks answer origin: <code className="text-rose-500">marked_in_document</code>, <code className="text-rose-500">answer_key</code>, <code className="text-rose-500">ai_suggested</code>, or <code className="text-rose-500">manual</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
