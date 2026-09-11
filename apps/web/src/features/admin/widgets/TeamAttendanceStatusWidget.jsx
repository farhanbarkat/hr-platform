import React from 'react';

export default function TeamAttendanceStatusWidget({ metrics, loading }) {
  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
              FLOOR SUPERVISION
            </span>
            <h3 className="text-sm font-bold text-[#16233B] mt-1">Live Shift Attendance</h3>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4] rounded">
            Live Stream
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="p-2.5 bg-[#FAF8F5] rounded border border-[#EFECE6]">
            <div className="text-lg font-bold text-[#1E7E34]">
              {loading ? '...' : metrics?.onFloorCount ?? 0}
            </div>
            <div className="text-[10px] font-mono text-[#728294]">ON FLOOR</div>
          </div>
          <div className="p-2.5 bg-[#FAF8F5] rounded border border-[#EFECE6]">
            <div className="text-lg font-bold text-[#B83E28]">
              {loading ? '...' : metrics?.absentCount ?? 0}
            </div>
            <div className="text-[10px] font-mono text-[#728294]">ABSENT</div>
          </div>
          <div className="p-2.5 bg-[#FAF8F5] rounded border border-[#EFECE6]">
            <div className="text-lg font-bold text-[#8C5D17]">
              {loading ? '...' : metrics?.unflaggedMissing ?? 0}
            </div>
            <div className="text-[10px] font-mono text-[#728294]">UNFLAGGED</div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#F4F1EA] text-[11px] text-[#728294] flex justify-between">
        <span>Turnout Rate:</span>
        <span className="font-mono font-bold text-[#16233B]">{metrics?.attendanceRatio ?? 0}%</span>
      </div>
    </div>
  );
}