import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t-2 border-slate-800 bg-slate-900 py-4 text-xs text-slate-500 transition-colors">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        <p className="font-semibold text-slate-400">
          DocTest
        </p>
      </div>
    </footer>
  );
};
