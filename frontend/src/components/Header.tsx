import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Moon, Sun, UploadCloud, Library } from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-sm group-hover:bg-orange-500 transition">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold text-slate-100 tracking-tight font-heading">
              DocTest
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Exam Engine
            </span>
          </div>
        </Link>

        {/* Navigation & Theme Toggle */}
        <nav className="flex items-center space-x-2 sm:space-x-3">
          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-850 text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-orange-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <Link
            to="/library"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              location.pathname === '/library'
                ? 'bg-slate-800 text-slate-100 border-slate-700'
                : 'text-slate-400 hover:text-slate-100 border-transparent hover:border-slate-800'
            }`}
          >
            <Library className="w-3.5 h-3.5 text-emerald-500" />
            <span>Library</span>
          </Link>

          <Link
            to="/upload"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};
