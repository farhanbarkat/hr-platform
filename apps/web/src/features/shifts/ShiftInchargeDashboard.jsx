import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ShiftInchargeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'ROSTER' | 'SWAPS'
  const [activeTab, setActiveTab] = useState('ROSTER');

  // Floor Telemetry States
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Shift Swap States
  const [swaps, setSwaps] = useState([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [swapFilter, setSwapFilter] = useState('ALL');

  // 1. Fetch Incharge Telemetry Data
  const fetchInchargeData = async () => {
    try {
      setLoading(true);
      setError(null);
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

  // 2. Fetch Shift Swap Requests
  const fetchSwapRequests = useCallback(async () => {
    try {
      setSwapsLoading(true);
      const res = await apiClient.get('/shift-swaps');
      setSwaps(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.warn('Shift swaps load notice:', err);
    } finally {
      setSwapsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInchargeData();
    fetchSwapRequests();
    const interval = setInterval(() => {
      fetchInchargeData();
      fetchSwapRequests();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchSwapRequests]);

  // Manager Approval / Rejection Handler
  const handleManagerApproval = async (id, action) => {
    const comments = window.prompt(`Enter optional remarks for ${action}:`) || '';
    try {
      setActionLoadingId(id);
      await apiClient.put(`/shift-swaps/${id}/manager-approval`, { action, comments });
      fetchSwapRequests();
      fetchInchargeData(); // Refresh roster because shift assignments change on approval
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process swap request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Peer Colleague Response (If incharge is also target colleague)
  const handlePeerResponse = async (id, action) => {
    try {
      setActionLoadingId(id);
      await apiClient.put(`/shift-swaps/${id}/peer-response`, { action });
      fetchSwapRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process peer response.');
    } finally {
      setActionLoadingId(null);
    }
  };

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

  const filteredSwaps = swaps.filter((s) => {
    if (swapFilter === 'ALL') return true;
    return s.status === swapFilter;
  });

  const pendingApprovalsCount = swaps.filter(
    (s) => s.status === 'PENDING_MANAGER_APPROVAL'
  ).length;

  const formatTime = (iso) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING_PEER_ACCEPTANCE: 'bg-[#FFF8E6] text-[#B9812E] border-[#F3E2B8]',
      PENDING_MANAGER_APPROVAL: 'bg-[#EBF3FC] text-[#2062B7] border-[#C3DCF8]',
      APPROVED: 'bg-[#EAF7ED] text-[#1E7E34] border-[#BCE8C5]',
      PEER_REJECTED: 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]',
      MANAGER_REJECTED: 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]',
      EXPIRED: 'bg-[#F7F6F2] text-[#728294] border-[#E3DED4]',
    };
    return badges[status] || 'bg-white text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-16">
      
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
            Real-time floor presence, grace threshold breaches, and peer shift swap authorization.
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
            onClick={() => {
              fetchInchargeData();
              fetchSwapRequests();
            }}
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

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-[#E3DED4] gap-6 text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab('ROSTER')}
          className={`pb-2.5 cursor-pointer transition-colors relative ${
            activeTab === 'ROSTER'
              ? 'text-[#8C5D17] border-b-2 border-[#8C5D17]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          LIVE FLOOR ROSTER ({roster.length})
        </button>

        <button
          onClick={() => setActiveTab('SWAPS')}
          className={`pb-2.5 cursor-pointer transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'SWAPS'
              ? 'text-[#8C5D17] border-b-2 border-[#8C5D17]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          <span>SHIFT SWAP OPERATIONS</span>
          {pendingApprovalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#B83E28] text-white font-mono">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LIVE ROSTER VIEW */}
      {activeTab === 'ROSTER' && (
        <div className="space-y-4">
          {/* Search & Filter Ribbon */}
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

          {/* Supervision Table */}
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
      )}

      {/* TAB 2: SHIFT SWAP OPERATIONS */}
      {activeTab === 'SWAPS' && (
        <div className="space-y-4">
          {/* Swap Status Filter */}
          <div className="bg-white border border-[#E3DED4] rounded-lg p-3 flex justify-between items-center shadow-2xs">
            <span className="text-xs font-serif font-bold text-[#16233B]">
              Shift Exchange Requests ({filteredSwaps.length})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-[#728294]">Filter Status:</span>
              <select
                value={swapFilter}
                onChange={(e) => setSwapFilter(e.target.value)}
                className="px-2.5 py-1 border border-[#D8D3C7] rounded text-xs font-mono focus:outline-none focus:border-[#8C5D17] bg-white"
              >
                <option value="ALL">ALL REQUESTS</option>
                <option value="PENDING_MANAGER_APPROVAL">AWAITING APPROVAL</option>
                <option value="PENDING_PEER_ACCEPTANCE">AWAITING PEER</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PEER_REJECTED">PEER REJECTED</option>
                <option value="MANAGER_REJECTED">MANAGER REJECTED</option>
              </select>
            </div>
          </div>

          {swapsLoading ? (
            <div className="p-8 bg-white border border-[#E3DED4] rounded-lg text-center text-xs font-mono text-[#728294]">
              Loading shift exchange pool...
            </div>
          ) : filteredSwaps.length === 0 ? (
            <div className="p-8 bg-white border border-[#E3DED4] rounded-lg text-center text-xs font-mono text-[#728294]">
              No shift swap requests found matching current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredSwaps.map((item) => {
                const reqEmp = item.requesterId;
                const targetEmp = item.targetEmployeeId;
                const reqShift = item.requesterShiftAssignmentId?.shiftTemplateId;
                const targetShift = item.targetShiftAssignmentId?.shiftTemplateId;

                const isPeerTarget = targetEmp?._id === user?.employeeId || targetEmp?.email === user?.email;
                const isManager = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role);

                return (
                  <div
                    key={item._id}
                    className="p-4 bg-white border border-[#E3DED4] rounded-lg shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#16233B]">
                          {reqEmp?.firstName} {reqEmp?.lastName}{' '}
                          <span className="font-normal font-mono text-[10px] text-[#728294]">
                            ({reqShift?.name || 'Shift'} {reqShift?.startTime}-{reqShift?.endTime})
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-[#8C5D17] font-bold">⇄</span>
                        <span className="text-xs font-bold text-[#16233B]">
                          {targetEmp?.firstName} {targetEmp?.lastName}{' '}
                          <span className="font-normal font-mono text-[10px] text-[#728294]">
                            ({targetShift?.name || 'Shift'} {targetShift?.startTime}-{targetShift?.endTime})
                          </span>
                        </span>
                        <span
                          className={`text-[9.5px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#5B6B79] flex flex-wrap gap-x-4">
                        <span>Swap Date: <strong className="text-[#16233B] font-mono">{new Date(item.swapDate).toLocaleDateString()}</strong></span>
                        {item.reason && <span>Reason: <em className="text-[#16233B]">"{item.reason}"</em></span>}
                        {item.managerComments && <span>Manager Note: <em className="text-[#8C5D17]">"{item.managerComments}"</em></span>}
                      </div>
                    </div>

                    {/* Action Execution Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* 1. Colleague Peer Action */}
                      {isPeerTarget && item.status === 'PENDING_PEER_ACCEPTANCE' && (
                        <>
                          <button
                            onClick={() => handlePeerResponse(item._id, 'ACCEPT')}
                            disabled={actionLoadingId === item._id}
                            className="px-3 py-1 bg-[#1E7E34] hover:bg-[#176228] text-white text-[11px] font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
                          >
                            Accept Peer Swap
                          </button>
                          <button
                            onClick={() => handlePeerResponse(item._id, 'REJECT')}
                            disabled={actionLoadingId === item._id}
                            className="px-3 py-1 bg-[#B83E28] hover:bg-[#962F1E] text-white text-[11px] font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {/* 2. Manager / Shift Incharge Final Authorization Action */}
                      {isManager && item.status === 'PENDING_MANAGER_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleManagerApproval(item._id, 'APPROVE')}
                            disabled={actionLoadingId === item._id}
                            className="px-3.5 py-1.5 bg-[#1E7E34] hover:bg-[#176228] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-xs"
                          >
                            ✓ Authorize Shift Swap
                          </button>
                          <button
                            onClick={() => handleManagerApproval(item._id, 'REJECT')}
                            disabled={actionLoadingId === item._id}
                            className="px-3.5 py-1.5 bg-[#B83E28] hover:bg-[#962F1E] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-xs"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}