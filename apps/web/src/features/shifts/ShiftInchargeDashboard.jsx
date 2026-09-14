import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ShiftInchargeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchInchargeData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Backend route
      const res = await apiClient.get('/shift-incharge/dashboard');
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to load incharge monitoring roster.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInchargeData();
    const interval = setInterval(fetchInchargeData, 45000);
    return () => clearInterval(interval);
  }, []);

  const { shiftSummary, roster = [] } = data || {};

  const filteredRoster = roster.filter((item) => {
    const emp = item.employee;
    const term = search.toLowerCase();
    const nameMatch = emp?.name?.toLowerCase().includes(term);
    const codeMatch = emp?.employeeCode?.toLowerCase().includes(term);
    const matchesSearch = nameMatch || codeMatch;

    const matchesStatus =
      filterStatus === 'ALL' || item.attendance?.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const formatTime = (iso) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            FLOOR SUPERVISION // LIVE SHIFT TELEMETRY
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Shift Incharge Monitoring Desk
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Real-time floor presence, grace threshold breaches, and leave status for assigned teams.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => navigate('/company-admin/departments')}
            className="px-3 py-1.5 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-[#16233B] text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
          >
            + MANAGE ROSTER & INCHARGES
          </button>
          <button
            onClick={fetchInchargeData}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
          >
            ↻ REFRESH POOL
          </button>
        </div>
      </div>

      {/* Error / Notice Banner */}
      {error && (
        <div className="p-4 bg-[#FDEEEB] border border-[#F5C2BA] rounded-lg text-xs font-mono text-[#B83E28]">
          ⚠️ {error}
        </div>
      )}

      {/* 2. Real-Time Shift KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">SUPERVISED</span>
          <div className="text-xl font-bold font-mono text-[#16233B] mt-1">
            {shiftSummary?.totalAssigned ?? 0}
          </div>
          <div className="text-[10px] text-[#728294] mt-0.5">Assigned to floor</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#1E7E34] uppercase tracking-wider block">ON FLOOR</span>
          <div className="text-xl font-bold font-mono text-[#1E7E34] mt-1">
            {shiftSummary?.presentCount ?? 0}
          </div>
          <div className="text-[10px] text-[#1E7E34] mt-0.5">Punched in & active</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#8C5D17] uppercase tracking-wider block">LATE ENTRIES</span>
          <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">
            {shiftSummary?.lateCount ?? 0}
          </div>
          <div className="text-[10px] text-[#8C5D17] mt-0.5">Grace period elapsed</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#B83E28] uppercase tracking-wider block">ABSENT</span>
          <div className="text-xl font-bold font-mono text-[#B83E28] mt-1">
            {shiftSummary?.absentCount ?? 0}
          </div>
          <div className="text-[10px] text-[#B83E28] mt-0.5">No punch recorded</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#7B4D99] uppercase tracking-wider block">ON LEAVE</span>
          <div className="text-xl font-bold font-mono text-[#7B4D99] mt-1">
            {shiftSummary?.onLeaveCount ?? 0}
          </div>
          <div className="text-[10px] text-[#7B4D99] mt-0.5">Approved absence</div>
        </div>
      </div>

      {/* 3. Search & Filter Ribbon */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search worker by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded text-xs focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/40 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[10px] font-mono uppercase text-[#728294]">Floor Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8D3C7] rounded text-xs font-mono focus:outline-none focus:border-[#8C5D17] bg-white"
          >
            <option value="ALL">ALL WORKERS</option>
            <option value="CHECKED_IN">CHECKED IN (ON TIME)</option>
            <option value="LATE">LATE</option>
            <option value="EXPECTED">EXPECTED (PENDING)</option>
            <option value="ABSENT">ABSENT</option>
            <option value="ON_LEAVE">ON LEAVE</option>
          </select>
        </div>
      </div>

      {/* 4. Live Roster Supervision Table */}
      <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
              <th className="py-3 px-4">Supervised Personnel</th>
              <th className="py-3 px-4">Assigned Shift</th>
              <th className="py-3 px-4">Punch-In Timestamp</th>
              <th className="py-3 px-4">Punch-Out</th>
              <th className="py-3 px-4">Grace Policy</th>
              <th className="py-3 px-4 text-right">Floor Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE6] text-xs">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center font-mono text-xs text-[#728294]">
                  Polling floor telemetry records...
                </td>
              </tr>
            ) : filteredRoster.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center select-none">
                  <div className="font-mono text-xs text-[#728294]">
                    No active shift assignments found for today.
                  </div>
                  <p className="text-[11px] text-[#8C9BAE] mt-1 max-w-md mx-auto">
                    To monitor staff here, ensure employees have an active shift allocated with today's date in the roster.
                  </p>
                  <button
                    onClick={() => navigate('/company-admin/departments')}
                    className="mt-3 px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#734B12] text-white font-mono text-xs font-bold rounded cursor-pointer transition-colors"
                  >
                    Assign Staff in Roster &rarr;
                  </button>
                </td>
              </tr>
            ) : (
              filteredRoster.map((item) => {
                const emp = item.employee;
                const shift = item.shift;
                const att = item.attendance;

                const statusBgMap = {
                  CHECKED_IN: 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]',
                  LATE: 'bg-[#FAF4E8] text-[#8C5D17] border-[#E3DED4]',
                  EXPECTED: 'bg-[#EBF3F8] text-[#26689A] border-[#C3DDF0]',
                  ABSENT: 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]',
                  ON_LEAVE: 'bg-[#F5EDF8] text-[#7B4D99] border-[#E6CFEE]',
                };

                return (
                  <tr key={item.assignmentId} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#16233B]">
                        {emp?.name || 'Worker'}
                      </div>
                      <div className="text-[10px] font-mono text-[#728294]">
                        {emp?.designation || 'Staff'} • {emp?.employeeCode || 'EMP'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold font-mono text-[#16233B]">
                        {shift?.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#8C5D17]">
                        {shift?.startTime} &rarr; {shift?.endTime}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-[#16233B]">
                      {formatTime(att?.checkInTime)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#5B6B79]">
                      {formatTime(att?.checkOutTime)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#5B6B79]">
                      {shift?.gracePeriod || 15} mins
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-block px-2.5 py-0.5 text-[9.5px] font-mono rounded font-bold uppercase border ${
                        statusBgMap[att?.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {att?.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}