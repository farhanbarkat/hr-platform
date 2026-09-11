import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PayrollSummaryWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      <div>
        <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
          COMPENSATION METRICS
        </span>
        <h3 className="text-sm font-bold text-[#16233B] mt-1">Payroll Cycle & Advances</h3>
        <p className="text-xs text-[#728294] mt-0.5">Execution logs, batch salary runs, and employee loans.</p>
      </div>

      <button
        onClick={() => navigate('/company-admin/payroll')}
        className="mt-4 w-full py-2 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#16233B] hover:text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors"
      >
        OPEN PAYROLL RUNNER &rarr;
      </button>
    </div>
  );
}