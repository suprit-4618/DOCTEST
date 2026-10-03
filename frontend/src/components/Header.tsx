import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, BookOpen, Moon, Sun } from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<'cream' | 'cocoa'>(() => {
    return (localStorage.getItem('cozy-theme') as 'cream' | 'cocoa') || 'cream';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cozy-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'cream' ? 'cocoa' : 'cream'));
  };

  return (
    <header className="border-b-2 border-slate-800 bg-slate-900 sticky top-0 z-50 transition-colors shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 rounded-2xl bg-rose-500 flex items-center justify-center shadow-sm text-white group-hover:bg-rose-600 transition duration-150">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight font-heading">
              DOCTEST
            </h1>
          </div>
        </Link>

        {/* Navigation & Cute Theme Toggle */}
        <nav className="flex items-center space-x-2 sm:space-x-3">
          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-850 text-slate-400 hover:text-slate-100 border border-slate-800 text-xs font-semibold cursor-pointer shadow-sm hover:border-slate-700 transition"
            title={`Switch to ${theme === 'cream' ? 'Cozy Cocoa (Night Cafe)' : 'Milk Tea (Warm Cream)'} theme`}
          >
            {theme === 'cream' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Cocoa 🍫</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Milk Tea 🍵</span>
              </>
            )}
          </button>

          <Link
            to="/library"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              location.pathname === '/library'
                ? 'bg-slate-850 text-slate-100 border border-slate-750 shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-rose-500" />
            <span>Library</span>
          </Link>

          <Link
            to="/upload"
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm transition active:scale-95 ${
              location.pathname.startsWith('/upload')
                ? 'bg-rose-600 ring-2 ring-rose-400/30'
                : 'bg-rose-500 hover:bg-rose-600'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upload Test</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};
