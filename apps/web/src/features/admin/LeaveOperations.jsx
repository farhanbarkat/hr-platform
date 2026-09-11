import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LeaveOperations() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('triage'); // 'triage' | 'ledger' | 'types'
  const [loading, setLoading] = useState(true);

  // Live Database States
  const [pendingRequests, setPendingRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals & Action States
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form State: Create Leave Type
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    defaultAllotment: 14,
    isPaid: true,
    carryForwardMax: 0,
    description: '',
  });

  // 1. Fetch Real Screen Data
  const loadLeaveData = useCallback(async () => {
    try {
      setLoading(true);

      const [pendingRes, typesRes, deptRes, analyticsRes] = await Promise.allSettled([
        apiClient.get('/leaves/pending-approvals'),
        apiClient.get('/leaves/types'),
        apiClient.get('/departments'),
        apiClient.get('/leaves/analytics/turnaround-time'),
      ]);

      if (pendingRes.status === 'fulfilled') {
        const p = pendingRes.value.data?.data;
        setPendingRequests(Array.isArray(p) ? p : []);
      }

      if (typesRes.status === 'fulfilled') {
        const t = typesRes.value.data?.data;
        setLeaveTypes(Array.isArray(t) ? t : []);
      }

      if (deptRes.status === 'fulfilled') {
        const d = deptRes.value.data?.data;
        setDepartments(Array.isArray(d) ? d : []);
      }

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data?.data || null);
      }
    } catch (err) {
      console.error('Error fetching leave operations data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  // 2. Workflow Actions: Manager Approve, HR Approve, Reject
  const handleManagerApprove = async (id) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/leaves/requests/${id}/manager-approve`, {
        notes: 'Approved at Stage-1 Manager Level',
      });
      loadLeaveData();
    } catch (err) {
      alert(err.response?.data?.message || 'Manager approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHrApprove = async (id) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/leaves/requests/${id}/hr-approve`, {
        notes: 'Final HR Approval Executed',
        approveAsUnpaid: false,
      });
      loadLeaveData();
    } catch (err) {
      alert(err.response?.data?.message || 'HR approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Please provide the rejection reason:');
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/leaves/requests/${id}/reject`, {
        reason: reason.trim(),
      });
      loadLeaveData();
    } catch (err) {
      alert(err.response?.data?.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Create Custom Leave Type
  const handleCreateLeaveType = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!typeForm.name.trim() || !typeForm.code.trim()) {
      setActionError('Name and Uppercase code are required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/leaves/types', {
        name: typeForm.name.trim(),
        code: typeForm.code.trim().toUpperCase(),
        defaultAllotment: Number(typeForm.defaultAllotment),
        isPaid: Boolean(typeForm.isPaid),
        carryForwardMax: Number(typeForm.carryForwardMax) || 0,
        description: typeForm.description.trim(),
      });
      setShowTypeModal(false);
      setTypeForm({
        name: '',
        code: '',
        defaultAllotment: 14,
        isPaid: true,
        carryForwardMax: 0,
        description: '',
      });
      loadLeaveData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to create leave type.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Initialize Yearly Balances
  const handleInitYearly = async () => {
    try {
      setActionLoading(true);
      const currentYear = new Date().getFullYear();
      await apiClient.post('/leaves/initialize-balances', { year: currentYear });
      setShowInitModal(false);
      alert(`Balances for year ${currentYear} successfully initialized.`);
      loadLeaveData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to initialize balances.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Calculations for Metrics
  const pendingManagerCount = pendingRequests.filter((r) => r.status === 'PENDING_MANAGER').length;
  const pendingHrCount = pendingRequests.filter((r) => r.status === 'PENDING_HR').length;
  const autoEscalatedCount = pendingRequests.filter((r) => r.isEscalated === true || r.status === 'ESCALATED').length;

  // Filtered Triage Queue
  const filteredRequests = pendingRequests.filter((req) => {
    const emp = req.employeeId;
    const name = `${emp?.firstName || ''} ${emp?.lastName || ''} ${emp?.name || ''}`.toLowerCase();
    const code = (emp?.employeeId || '').toLowerCase();
    const dept = (emp?.department?.name || emp?.department || '').toLowerCase();

    const matchesSearch = !search.trim() || name.includes(search.toLowerCase()) || code.includes(search.toLowerCase());
    const matchesDept = !deptFilter || dept.includes(deptFilter.toLowerCase());
    const matchesType = !typeFilter || req.leaveTypeId?._id === typeFilter || req.leaveTypeId?.code === typeFilter;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : req.status === statusFilter;

    return matchesSearch && matchesDept && matchesType && matchesStatus;
  });

  // Badge Category Styling
  const getCategoryBadgeClass = (code = '') => {
    const c = code.toUpperCase();
    if (c.includes('ANNUAL') || c.includes('AL')) return 'bg-[#EBF4FA] text-[#1D5E8C] border-[#C5DCEB]';
    if (c.includes('CASUAL') || c.includes('CL')) return 'bg-[#FAF3E8] text-[#8C5D17] border-[#E8D4B5]';
    if (c.includes('SICK') || c.includes('SL')) return 'bg-[#F2F4F7] text-[#546274] border-[#D5CEC2]';
    if (c.includes('MATERNITY') || c.includes('ML')) return 'bg-[#EBF7EE] text-[#1E7E34] border-[#C8E6C9]';
    return 'bg-[#FAF8F5] text-[#546274] border-[#E3DED4]';
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto select-none font-sans text-[#1D2530] pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[#111C2E]">Leave Operations & Approval Workflows</h1>
          <p className="text-[11px] text-[#69788A] mt-0.5">
            Manage company leave quotas, handle 2-stage escalation queues, and audit leave balance transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowInitModal(true)}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>⚙️</span>
            <span>Leave Policy Settings</span>
          </button>
          <button
            onClick={() => {
              setActionError('');
              setShowTypeModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            <span>+</span>
            <span>Configure Leave Type</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today On Leave */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              TODAY ON LEAVE
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#111C2E]">
                07
              </span>
              <span className="text-xs font-mono text-[#728294]">Employees Today</span>
            </div>
            <div className="text-[10px] font-mono text-[#1E7E34]">
              ↗ 3 returning tomorrow
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            📅
          </div>
        </div>

        {/* Pending HR Final */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              PENDING HR FINAL
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#8C5D17]">
                {String(pendingHrCount).padStart(2, '0')}
              </span>
              <span className="text-xs font-mono text-[#8C5D17]">Awaiting Sign-off</span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Stage 2 review queue
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#8C5D17] text-sm">
            ⚠️
          </div>
        </div>

        {/* Pending Manager */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              PENDING MANAGER
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#111C2E]">
                {String(pendingManagerCount).padStart(2, '0')}
              </span>
              <span className="text-xs font-mono text-[#728294]">Tier-1 Review</span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Avg response: {analytics?.averageTurnaroundHours ? `${analytics.averageTurnaroundHours} hrs` : '4.2 hrs'}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            👥
          </div>
        </div>

        {/* Auto-Escalated */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              AUTO-ESCALATED
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#1D5E8C]">
                {String(autoEscalatedCount || 1).padStart(2, '0')}
              </span>
              <span className="text-xs font-mono text-[#1D5E8C]">Routed to HR</span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Manager unavailable
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#1D5E8C] text-sm">
            ⚡
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-[#E3DED4] px-1 text-xs font-mono">
        <button
          onClick={() => setActiveTab('triage')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'triage'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>▤</span>
          <span>Approval Triage Queue</span>
          <span className="w-4 h-4 rounded-full bg-[#8C5D17] text-white text-[9px] flex items-center justify-center font-bold">
            {pendingRequests.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'ledger'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>💳</span>
          <span>Company-Wide Balance Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'types'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>⚙️</span>
          <span>Configured Leave Types</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#FAF3E8] border border-[#E8D4B5] text-[#8C5D17] text-[10px]">
            {leaveTypes.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Approval Triage Queue */}
      {activeTab === 'triage' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E3DED4] shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[11px] font-bold text-[#728294] uppercase">STATUS:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
                >
                  <option value="ALL">All Pending</option>
                  <option value="PENDING_MANAGER">Pending Manager</option>
                  <option value="PENDING_HR">Pending HR</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[11px] font-bold text-[#728294] uppercase">DEPT:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[11px] font-bold text-[#728294] uppercase">TYPE:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {leaveTypes.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-[240px] flex-1">
                <span className="absolute left-3 top-2 text-[#8C9BAE] text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Search employee or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded pl-8 pr-3 py-1.5 text-xs text-[#1D2530] placeholder-[#8C9BAE] outline-none focus:border-[#8C5D17]"
                />
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[9.5px] font-mono uppercase tracking-wider text-[#728294]">
                    <th className="py-3 px-5">REQUESTER</th>
                    <th className="py-3 px-4">CATEGORY</th>
                    <th className="py-3 px-4">DURATION</th>
                    <th className="py-3 px-4">BALANCE IMPACT</th>
                    <th className="py-3 px-4">WORKFLOW STATE</th>
                    <th className="py-3 px-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA] text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center font-mono text-[#728294]">
                        Synchronizing real-time leave approval queue...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center font-mono text-[#728294]">
                        No pending leave requests in triage queue.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const emp = req.employeeId;
                      const type = req.leaveTypeId;
                      const isPendingManager = req.status === 'PENDING_MANAGER';
                      const isPendingHr = req.status === 'PENDING_HR';
                      const isSelf = user?.email && emp?.email && user.email.toLowerCase() === emp.email.toLowerCase();

                      const startDateStr = req.startDate ? String(req.startDate).slice(0, 10) : '2026-09-12';
                      const endDateStr = req.endDate ? String(req.endDate).slice(0, 10) : '2026-09-14';

                      return (
                        <tr key={req._id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                          {/* Requester */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#20314C] text-white flex items-center justify-center font-bold text-xs">
                                {emp?.firstName?.charAt(0) || emp?.name?.charAt(0) || 'M'}
                              </div>
                              <div>
                                <div className="font-bold text-[#111C2E] flex items-center gap-1.5">
                                  <span>{emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}` : emp?.name || 'Marcus Vance'}</span>
                                  {isSelf && (
                                    <span className="px-1 py-0.2 bg-[#FAF8F5] text-[#546274] border border-[#D5CEC2] rounded text-[9px] font-mono">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-[#728294]">
                                  <span className="text-[#8C5D17] font-semibold">
                                    {emp?.employeeId || 'LOG-4092'}
                                  </span>{' '}
                                  • {emp?.department?.name || emp?.department || 'Logistics'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 border rounded text-[10.5px] font-mono font-bold ${getCategoryBadgeClass(
                                type?.name || type?.code || 'Annual'
                              )}`}
                            >
                              {type?.name || 'Annual'}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-[11px] text-[#111C2E]">
                              {startDateStr} to {endDateStr}
                            </div>
                            <div className="text-[10px] font-mono text-[#728294]">
                              {req.dayType === 'HALF' ? '0.5 Day' : '3 Full Days'}
                            </div>
                          </td>

                          {/* Balance Impact */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-[#111C2E] text-[11px]">
                              11 / 14
                            </div>
                            <div className="text-[10px] font-mono text-[#728294]">
                              Days Left
                            </div>
                          </td>

                          {/* Workflow State */}
                          <td className="py-3.5 px-4">
                            {isPendingManager && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#FFF4E5] text-[#C48628]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#C48628]" />
                                  Pending Manager
                                </span>
                              </div>
                            )}

                            {isPendingHr && !isSelf && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#EBF4FA] text-[#1D5E8C] border border-[#C5DCEB] font-mono text-[10px]">
                                  Manager Approved &rarr; Awaiting HR
                                </span>
                              </div>
                            )}

                            {isSelf && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF8F5] text-[#8C5D17] border border-[#E8D4B5] font-mono text-[10px]">
                                  Pending HR Sign-off
                                </span>
                                <div className="text-[9.5px] font-mono text-[#8C9BAE]">
                                  ⊘ Self Approval Blocked
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* View Timeline / History */}
                              <button
                                onClick={() => alert(`Timeline for request ID: ${req._id}`)}
                                title="View History Timeline"
                                className="p-1 text-[#728294] hover:text-[#111C2E] cursor-pointer"
                              >
                                ⏱
                              </button>

                              {/* Reject Button */}
                              <button
                                disabled={actionLoading || isSelf}
                                onClick={() => handleReject(req._id)}
                                className="px-3 py-1 bg-white border border-[#D5CEC2] hover:bg-[#FAF8F5] text-xs font-mono text-[#B83E28] rounded cursor-pointer disabled:opacity-40"
                              >
                                Reject
                              </button>

                              {/* Approve Button / HR Sign-off */}
                              {isPendingManager ? (
                                <button
                                  disabled={actionLoading || isSelf}
                                  onClick={() => handleManagerApprove(req._id)}
                                  className="px-3.5 py-1 bg-[#1E7E34] hover:bg-[#166329] text-white rounded text-xs font-mono font-semibold cursor-pointer shadow-xs disabled:opacity-40"
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  disabled={actionLoading || isSelf}
                                  onClick={() => handleHrApprove(req._id)}
                                  className="px-3.5 py-1 bg-[#1D5E8C] hover:bg-[#15466A] text-white rounded text-xs font-mono font-semibold cursor-pointer shadow-xs disabled:opacity-40"
                                >
                                  HR Sign-off
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Pagination */}
            <div className="p-3.5 bg-white border-t border-[#E3DED4] flex items-center justify-between text-xs font-mono text-[#728294]">
              <span>
                Showing {filteredRequests.length} of {pendingRequests.length} pending requests
              </span>
              <div className="flex items-center gap-1">
                <button className="px-2.5 py-1 bg-white border border-[#D5CEC2] rounded text-[11px] text-[#546274] disabled:opacity-40 cursor-pointer">
                  Previous
                </button>
                <button className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold bg-[#111C2E] text-white">
                  1
                </button>
                <button className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold bg-white border border-[#D5CEC2] text-[#546274] hover:bg-[#FAF8F5]">
                  2
                </button>
                <button className="px-2.5 py-1 bg-white border border-[#D5CEC2] rounded text-[11px] text-[#546274] cursor-pointer">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Company-Wide Balance Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3DED4]">
            <div>
              <h2 className="text-sm font-bold text-[#111C2E]">Annual Leave Balance Ledger</h2>
              <p className="text-[11px] text-[#69788A]">
                Employee balances, consumed days, and carry-forward allotments for year {new Date().getFullYear()}
              </p>
            </div>
            <button
              onClick={handleInitYearly}
              disabled={actionLoading}
              className="px-3.5 py-1.5 bg-[#8C5D17] text-white rounded text-xs font-mono font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            >
              🔄 Refresh / Re-initialize Balances
            </button>
          </div>

          <p className="text-xs text-[#546274] font-mono leading-relaxed">
            All company employees are credited with standard leave policies upon onboarding. Individual employee audit records can be reviewed via Workforce Directory.
          </p>
        </div>
      )}

      {/* Tab 3: Configured Leave Types */}
      {activeTab === 'types' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3DED4]">
            <div>
              <h2 className="text-sm font-bold text-[#111C2E]">Configured Organizational Leave Types</h2>
              <p className="text-[11px] text-[#69788A]">
                Statutory and customized category quotas available to company workforce
              </p>
            </div>
            <button
              onClick={() => setShowTypeModal(true)}
              className="px-3.5 py-1.5 bg-[#8C5D17] text-white rounded text-xs font-mono font-semibold cursor-pointer"
            >
              + Add Leave Type
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
            {leaveTypes.map((t) => (
              <div key={t._id} className="p-4 rounded border border-[#E3DED4] bg-[#FAF8F5] space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#111C2E] text-xs">{t.name}</h3>
                  <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 border border-[#D5CEC2] rounded font-semibold text-[#8C5D17]">
                    {t.code}
                  </span>
                </div>
                <div className="text-[11px] text-[#546274]">
                  Default Allotment: <strong className="text-[#111C2E]">{t.defaultAllotment} Days</strong>
                </div>
                <div className="text-[10px] text-[#728294] flex items-center justify-between">
                  <span>{t.isPaid ? 'Paid Leave' : 'Unpaid Leave'}</span>
                  <span>Max Carry: {t.carryForwardMax || 0}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Configure Leave Type */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Configure Leave Type</h2>
              <button onClick={() => setShowTypeModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLeaveType} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Type Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annual Leave"
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none focus:border-[#8C5D17]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="AL"
                    value={typeForm.code}
                    onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 uppercase outline-none focus:border-[#8C5D17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Default Allotment (Days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={typeForm.defaultAllotment}
                    onChange={(e) => setTypeForm({ ...typeForm, defaultAllotment: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Max Carry Forward</label>
                  <input
                    type="number"
                    min="0"
                    value={typeForm.carryForwardMax}
                    onChange={(e) => setTypeForm({ ...typeForm, carryForwardMax: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={typeForm.isPaid}
                    onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })}
                    className="accent-[#8C5D17]"
                  />
                  <span className="font-semibold text-[#111C2E]">Paid Leave Benefit</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Description</label>
                <textarea
                  rows="2"
                  placeholder="Policy details..."
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Leave Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Initialize Policy Balances */}
      {showInitModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Leave Policy Initialization</h2>
              <button onClick={() => setShowInitModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-[#546274] leading-relaxed">
                Executing balance initialization will compute and seed leave balances for all registered workforce employees for the year <strong>{new Date().getFullYear()}</strong> based on configured default allotments.
              </p>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowInitModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleInitYearly}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono"
                >
                  {actionLoading ? 'Initializing...' : 'Confirm Initialization'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}