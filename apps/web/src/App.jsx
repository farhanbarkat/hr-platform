import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { APP_NAME } from '@repo/shared';
import { UI_VERSION } from '@repo/ui';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F6F5F1] p-8">
      <div className="max-w-3xl mx-auto bg-white border border-[#D8D3C7] rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D8D3C7] pb-4">
          <h1 className="text-2xl font-bold text-[#16233B]">
            {APP_NAME} <span className="text-xs bg-[#B9812E] text-white px-2 py-0.5 rounded">FE-001</span>
          </h1>
          <span className="text-xs text-[#5B6B79]">UI Package v{UI_VERSION}</span>
        </div>

        <p className="text-sm text-[#5B6B79] mt-4">
          Monorepo frontend skeleton initialized successfully. All backend feature module folders and path aliases are wired.
        </p>

        <div className="mt-6 flex gap-4">
          <Link
            to="/"
            className="px-4 py-2 text-sm font-semibold rounded bg-[#B9812E] text-white hover:opacity-90"
          >
            Home Route
          </Link>
          <Link
            to="/status"
            className="px-4 py-2 text-sm font-semibold rounded border border-[#D8D3C7] text-[#16233B] hover:bg-slate-50"
          >
            Module Status
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-[#D8D3C7]">
          <Routes>
            <Route path="/" element={<div className="text-xs text-[#2E7D5B] font-semibold">✓ React Router is operational.</div>} />
            <Route path="/status" element={<div className="text-xs text-[#3A6EA5] font-semibold">✓ 14 Feature module structures linked.</div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}