import React from 'react';
import { ShieldCheck, Command } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-900/60 transition-colors py-6 text-xs text-slate-500">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Brand & Engine note */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <span className="font-bold text-slate-300 font-heading tracking-tight">DocTest Engine</span>
          </div>
          <span className="text-slate-700">&bull;</span>
          <span className="text-slate-500 text-[11px]">Local Document Examination Architecture</span>
        </div>

        {/* Center: Keyboard hint */}
        <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500">
          <Command className="w-3.5 h-3.5 text-orange-400" />
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-850 border border-slate-800 text-[10px] font-mono text-slate-300">A-D</kbd>
          <span>to select</span>
          <span className="text-slate-700">&bull;</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-850 border border-slate-800 text-[10px] font-mono text-slate-300">&larr; &rarr;</kbd>
          <span>to navigate</span>
          <span className="text-slate-700">&bull;</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-850 border border-slate-800 text-[10px] font-mono text-slate-300">F</kbd>
          <span>to flag</span>
        </div>

        {/* Right: Security & Offline indicator */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Zero Answer Leakage Protocol</span>
        </div>
      </div>
    </footer>
  );
};
