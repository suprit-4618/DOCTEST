import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { LibraryPage } from './pages/LibraryPage';
import { HomePage } from './pages/HomePage';
import { UploadPage } from './pages/UploadPage';
import { DocumentStatusPage } from './pages/DocumentStatusPage';
import { ReviewPage } from './pages/ReviewPage';
import { TestSetupPage } from './pages/TestSetupPage';
import { TestTakingPage } from './pages/TestTakingPage';
import { TestResultsPage } from './pages/TestResultsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/system" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/documents/:id" element={<DocumentStatusPage />} />
            <Route path="/documents/:id/review" element={<ReviewPage />} />
            <Route path="/documents/:id/setup" element={<TestSetupPage />} />
            <Route path="/sessions/:id/test" element={<TestTakingPage />} />
            <Route path="/sessions/:id/results" element={<TestResultsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
