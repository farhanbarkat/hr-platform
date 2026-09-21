import React, { useState } from 'react';
import TaxSlabsDesk from './TaxSlabsDesk.jsx';
import TaxCertificatesDesk from './TaxCertificatesDesk.jsx';

export default function TaxWorkspaceDesk() {
  const [activeTab, setActiveTab] = useState('slabs'); // 'slabs' | 'certificates'

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      
      {/* Header Banner */}
      <div className="pb-4 border-b border-[#E3DED4]">
        <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
          STATUTORY COMPLIANCE & FISCAL WITHHOLDINGS // TAX DESK
        </span>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
          Income Tax & Certificates Enclave
        </h1>
        <p className="text-xs text-[#5B6B79] mt-0.5">
          Configure progressive taxation brackets, simulate withholding deductions, and issue annual tax certificates.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E3DED4] gap-6 text-xs font-mono">
        <button
          onClick={() => setActiveTab('slabs')}
          className={`pb-2.5 transition-all cursor-pointer ${
            activeTab === 'slabs'
              ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          PROGRESSIVE SLABS & ESTIMATOR
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          className={`pb-2.5 transition-all cursor-pointer ${
            activeTab === 'certificates'
              ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          ANNUAL TAX CERTIFICATES REGISTRY
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'slabs' ? <TaxSlabsDesk /> : <TaxCertificatesDesk />}

    </div>
  );
}