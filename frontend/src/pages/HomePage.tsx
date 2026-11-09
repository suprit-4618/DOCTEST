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
  Clock,
  UploadCloud,
  ArrowRight,
  FileCheck2,
  ShieldCheck,
  Check,
  FileText
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealthData(data);
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
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-5">
          <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Interactive Exam Simulator</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-100 tracking-tight font-heading">
          Transform Documents into <span className="text-orange-500">Interactive Exams</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Upload any PDF test paper, scanned exam, or document. Questions and options are extracted cleanly with answer keys masked for distraction-free self-testing and instant server-side grading.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm shadow-sm transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 hover:text-white font-semibold text-sm shadow-sm transition"
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Open Library</span>
          </Link>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mb-3">
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-100 mb-1">Multi-Format Ingestion</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            High-DPI rendering for PDFs, scanned images, DOCX files, and direct plain text questions.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-3">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-100 mb-1">Zero Answer Leakage</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Printed marks and answer keys are masked during testing with server-verified scoring upon submit.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mb-3">
            <Check className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-100 mb-1">Comprehensive Review</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Question palette navigation, countdown timers, weak-area analytics, and blank PDF exports.
          </p>
        </div>
      </div>

      {/* Backend Health Check Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">System Services</h2>
              <p className="text-xs text-slate-500">FastAPI backend and local database connection</p>
            </div>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
            <span>{loading ? 'Checking...' : 'Refresh Status'}</span>
          </button>
        </div>

        {/* Status Content */}
        <div className="pt-5">
          {loading && !healthData && !error && (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2.5 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
              <span>Verifying service connectivity...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <div className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold">Backend Connection Failed</div>
                  <div className="text-xs mt-1 text-slate-400">{error}</div>
                </div>
              </div>
            </div>
          )}

          {healthData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold">Backend server is online and operational</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
                  <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Service</div>
                  <div className="mt-1 text-xs font-bold text-slate-100">{healthData.app}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
                  <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Version</div>
                  <div className="mt-1 text-xs font-bold font-mono text-orange-400">{healthData.version}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
                  <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Response Time</span>
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-300 truncate" title={healthData.timestamp}>
                    {new Date(healthData.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
