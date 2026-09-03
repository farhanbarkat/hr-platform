import React, { useState } from 'react';
import PlansTiers from '../features/superAdmin/PlansTiers.jsx';
import BillingInvoices from '../features/superAdmin/BillingInvoices.jsx';
import AuditLogs from '../features/superAdmin/AuditLogs.jsx';

export default function ComponentShowcase() {
  const [activeTab, setActiveTab] = useState('plans');

  return (
    <div className="min-h-screen bg-[#F6F5F1] p-6 space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-[#D8D3C7] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-bold transition-colors ${
              activeTab === 'plans' ? 'bg-[#16233B] text-white' : 'bg-white text-[#5B6B79] border border-[#D8D3C7]'
            }`}
          >
            SA-FE-009: Plans & Tiers
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-bold transition-colors ${
              activeTab === 'billing' ? 'bg-[#16233B] text-white' : 'bg-white text-[#5B6B79] border border-[#D8D3C7]'
            }`}
          >
            SA-FE-010: Billing & Invoices
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-bold transition-colors ${
              activeTab === 'audit' ? 'bg-[#16233B] text-white' : 'bg-white text-[#5B6B79] border border-[#D8D3C7]'
            }`}
          >
            SA-FE-011: Audit Logs (Full)
          </button>
        </div>

        <span className="text-xs font-mono text-[#5B6B79]">
          Suite Verification Mode
        </span>
      </div>

      {/* Render Active Feature Screen */}
      <div className="bg-white p-6 border border-[#D8D3C7] rounded-[8px] shadow-2xs">
        {activeTab === 'plans' && <PlansTiers />}
        {activeTab === 'billing' && <BillingInvoices />}
        {activeTab === 'audit' && <AuditLogs />}
      </div>
    </div>
  );
}
