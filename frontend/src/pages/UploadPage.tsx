import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  FileType as FileTypeIcon, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Clipboard, 
  Sparkles,
  Loader2
} from 'lucide-react';
import { uploadDocument } from '../api/documents';

const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx'];
const MAX_SIZE_MB = 25;

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type '${ext}'. Please upload a PDF, PNG, JPG, WEBP, or DOCX document.`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds the ${MAX_SIZE_MB}MB limit.`);
      return;
    }
    setSelectedFile(file);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handlePasteSampleText = () => {
    const sample = `1. Which data structure operates on a Last-In, First-Out (LIFO) principle?
A) Queue
B) Stack [CORRECT]
C) Array
D) Linked List

2. What is the default port for HTTPS traffic?
A) 21
B) 80
C) 443
D) 8080

3. Which of the following is NOT a primitive type in JavaScript?
A) string
B) boolean
C) number
D) object`;
    setPastedText(sample);
    if (!docTitle) {
      setDocTitle('Computer Science Practice Quiz');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === 'file' && !selectedFile) {
      setError('Please select or drop a file to upload.');
      return;
    }

    if (activeTab === 'text' && !pastedText.trim()) {
      setError('Please enter or paste question text.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();

      if (activeTab === 'file' && selectedFile) {
        formData.append('file', selectedFile);
        if (docTitle.trim()) {
          formData.append('filename', `${docTitle.trim()}.${selectedFile.name.split('.').pop()}`);
        }
      } else {
        formData.append('pasted_text', pastedText);
        formData.append('filename', `${docTitle.trim() || 'Pasted_MCQ_Test'}.txt`);
      }

      const res = await uploadDocument(formData);
      navigate(`/documents/${res.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please check backend connection.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold tracking-wide mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" /> Cozy Practice Prep ✨
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight font-heading">
          Upload Your Practice Exam 📖
        </h1>
        <p className="mt-2 text-slate-400 text-sm max-w-xl mx-auto">
          Drop any PDF, handwritten screenshot, or Word document. We will gently mask existing markings so you can test yourself in peace.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-cozy">
        {/* Pill-shaped Cute Tabs */}
        <div className="flex p-1 rounded-2xl bg-slate-850 border border-slate-800 mb-6 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('file'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
              activeTab === 'file'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Document / Photos</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('text'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
              activeTab === 'text'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            <span>Paste Raw Text</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-heading">
              Document / Test Title (Optional)
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g., Email Specialist Practice Quiz, Marketing Cloud Midterm"
              className="w-full px-4 py-3 bg-slate-850 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition shadow-inner"
            />
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'file' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-rose-400 bg-rose-500/10 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-slate-800 bg-slate-850/50 hover:border-rose-400/50 hover:bg-slate-850'
                }`}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-100 font-heading">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Tap or drop another to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-sm">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold text-slate-200 font-heading">
                        Drop your notes or exam file here, or <span className="text-rose-500 underline underline-offset-2">browse files</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supports PDF, PNG, JPG, JPEG, WEBP, DOCX (Max {MAX_SIZE_MB}MB, up to 150 pages)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                        <FileTypeIcon className="w-3 h-3 text-rose-400" /> PDF
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                        <ImageIcon className="w-3 h-3 text-emerald-400" /> Images / Screenshots
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                        <FileText className="w-3 h-3 text-amber-400" /> DOCX
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Pasted Text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-heading">
                  Question Content
                </label>
                <button
                  type="button"
                  onClick={handlePasteSampleText}
                  className="text-xs text-rose-500 hover:text-rose-400 transition font-semibold cursor-pointer"
                >
                  Insert Sample Questions 📝
                </button>
              </div>
              <textarea
                rows={9}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your questions here... (e.g. 1. What is...? A) ... B) ...)"
                className="w-full px-4 py-3 bg-slate-850 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition leading-relaxed shadow-inner"
              />
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300 font-heading">Validation Notice</p>
                <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold text-sm shadow-cozy-pill transition duration-150 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Baking Questions & Initializing Cozy Exam... ☕</span>
              </>
            ) : (
              <>
                <span>Process Document & Begin Practice</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
