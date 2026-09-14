import React, { useState } from 'react';
import { apiClient } from '../../../lib/apiClient.js';
import { useAuth } from '../../../context/AuthContext.jsx';

export default function AttendanceClockWidget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [isError, setIsError] = useState(false);

  const handleAction = async (type) => {
    try {
      setLoading(true);
      setStatus(null);
      setIsError(false);

      // Resolve own employee ID from AuthContext session
      const targetEmpId = user?.employeeId || user?.employee?._id || user?._id;

      const payload = {
        employeeId: targetEmpId, // Satisfies "employeeId is required for HR/Admin"
        source: 'WEB',
        timestamp: new Date().toISOString(),
      };

      const res = await apiClient.post(`/attendance/${type}`, payload);
      const msg = res.data?.message || `Clocked ${type === 'check-in' ? 'In' : 'Out'} recorded.`;
      setStatus(msg);
    } catch (err) {
      setIsError(true);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `Failed to ${type}. Please verify staff profile link.`;
      setStatus(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      <div>
        <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
          SELF-SERVICE DESK
        </span>
        <h3 className="text-sm font-bold text-[#16233B] mt-1">Shift Time Tracker</h3>
        <p className="text-xs text-[#728294] mt-0.5">Punch your daily operational shift timestamp.</p>
      </div>

      {status && (
        <div
          className={`my-3 text-[11px] font-mono p-2.5 rounded border ${
            isError
              ? 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
              : 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]'
          }`}
        >
          {isError ? '⚠️ ' : '✓ '}
          {status}
        </div>
      )}

      <div className="flex gap-2.5 mt-4">
        <button
          onClick={() => handleAction('check-in')}
          disabled={loading}
          className="flex-1 py-2 bg-[#1E7E34] hover:bg-[#18662A] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
        >
          {loading ? 'PUNCHING...' : 'CLOCK IN'}
        </button>
        <button
          onClick={() => handleAction('check-out')}
          disabled={loading}
          className="flex-1 py-2 bg-[#B83E28] hover:bg-[#97321F] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
        >
          {loading ? 'PUNCHING...' : 'CLOCK OUT'}
        </button>
      </div>
    </div>
  );
}