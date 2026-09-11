import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function QuickShiftAssignmentWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      <div>
        <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
          ROSTER & LINE CONTROL
        </span>
        <h3 className="text-sm font-bold text-[#16233B] mt-1">Departments & Line Shifts</h3>
        <p className="text-xs text-[#728294] mt-0.5">Assign shifts, rotation bands, and departmental leads.</p>
      </div>

      <button
        onClick={() => navigate('/company-admin/departments')}
        className="mt-4 w-full py-2 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#16233B] hover:text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors"
      >
        MANAGE ROSTER &rarr;
      </button>
    </div>
  );
}