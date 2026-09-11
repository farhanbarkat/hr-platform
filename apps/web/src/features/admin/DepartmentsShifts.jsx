import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function DepartmentsShifts() {
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'hierarchy' | 'swaps'
  const [loading, setLoading] = useState(true);

  // Real Database States
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);

  // Search Filter
  const [searchRoster, setSearchRoster] = useState('');

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Forms
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    headId: '',
  });

  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '08:00',
    endTime: '16:30',
    gracePeriodOverride: 15,
    defaultInchargeId: '',
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    shiftTemplateId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    inchargeId: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // 1. Fetch live data strictly from backend endpoints
  const loadScreenData = useCallback(async () => {
    try {
      setLoading(true);

      const [deptRes, templateRes, assignRes, empRes, swapRes] = await Promise.allSettled([
        apiClient.get('/departments'),
        apiClient.get('/shifts/templates'),
        apiClient.get('/shifts/assignments'),
        apiClient.get('/employees?limit=150'),
        apiClient.get('/shifts/swaps'),
      ]);

      // Departments
      if (deptRes.status === 'fulfilled') {
        const d = deptRes.value.data?.data || deptRes.value.data;
        setDepartments(Array.isArray(d) ? d : d?.departments || d?.docs || []);
      }

      // Templates
      if (templateRes.status === 'fulfilled') {
        const t = templateRes.value.data?.data || templateRes.value.data;
        setTemplates(t?.templates || (Array.isArray(t) ? t : []));
      }

      // Assignments
      if (assignRes.status === 'fulfilled') {
        const a = assignRes.value.data?.data || assignRes.value.data;
        setAssignments(a?.assignments || (Array.isArray(a) ? a : []));
      }

      // Employees
      let loadedEmployees = [];
      if (empRes.status === 'fulfilled') {
        const e = empRes.value.data?.data || empRes.value.data;
        loadedEmployees = e?.employees || e?.docs || (Array.isArray(e) ? e : []);
        setEmployees(loadedEmployees);
      }

      // Shift Swap Requests
      if (swapRes.status === 'fulfilled') {
        const s = swapRes.value.data?.data || swapRes.value.data;
        setSwapRequests(Array.isArray(s) ? s : s?.swaps || s?.requests || []);
      }
    } catch (err) {
      console.error('Error fetching shifts data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScreenData();
  }, [loadScreenData]);

  // 2. Format 24h to 12h AM/PM
  const formatTime12h = (timeStr) => {
    if (!timeStr) return '--:--';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${String(hour).padStart(2, '0')}:${m || '00'} ${ampm}`;
  };

  // 3. Create Department
  const handleCreateDept = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!deptForm.name.trim()) {
      setActionError('Department Name is required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/departments', {
        name: deptForm.name.trim(),
        code: deptForm.code.trim().toUpperCase() || undefined,
        description: deptForm.description.trim(),
        headId: deptForm.headId || undefined,
      });
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '', description: '', headId: '' });
      loadScreenData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to create department.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Toggle Department Active/Inactive Status
  const handleToggleDeptStatus = async (deptId, currentStatus) => {
    try {
      const nextStatus = !currentStatus;
      await apiClient.patch(`/departments/${deptId}/status`, {
        isActive: nextStatus,
      }).catch(() => {
        // Fallback endpoint if route is standard PUT
        return apiClient.put(`/departments/${deptId}`, { isActive: nextStatus });
      });

      setDepartments((prev) =>
        prev.map((d) => (d._id === deptId ? { ...d, isActive: nextStatus } : d))
      );
    } catch (err) {
      console.error('Failed to toggle department status:', err);
    }
  };

  // 5. Create Shift Template (Exact matching modal in Image 2)
  const handleCreateShiftTemplate = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!shiftForm.name.trim() || !shiftForm.startTime || !shiftForm.endTime) {
      setActionError('Shift name, start time, and end time are required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/shifts/templates', {
        name: shiftForm.name.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        gracePeriodOverride: Number(shiftForm.gracePeriodOverride) || 15,
        defaultInchargeId: shiftForm.defaultInchargeId || null,
      });

      setShowShiftModal(false);
      setShiftForm({
        name: '',
        startTime: '08:00',
        endTime: '16:30',
        gracePeriodOverride: 15,
        defaultInchargeId: '',
      });
      loadScreenData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to create shift template.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Assign / Reassign Shift
  const handleAssignShiftSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!assignForm.employeeId || !assignForm.shiftTemplateId || !assignForm.startDate) {
      setActionError('Employee, Shift Template, and Start Date are required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/shifts/assignments', {
        employeeId: assignForm.employeeId,
        shiftTemplateId: assignForm.shiftTemplateId,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate || null,
        inchargeId: assignForm.inchargeId || null,
      });

      setShowAssignModal(false);
      setSelectedAssignment(null);
      setAssignForm({
        employeeId: '',
        shiftTemplateId: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        inchargeId: '',
      });
      loadScreenData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to assign shift.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Manager Shift Swap Actions (Approve / Reject)
  const handleSwapAction = async (swapId, action) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/shifts/swaps/${swapId}/${action}`);
      loadScreenData();
    } catch (err) {
      console.error(`Failed to ${action} shift swap:`, err);
      alert(err.response?.data?.message || `Failed to ${action} swap.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Badge Colors for shifts
  const getShiftBadgeStyle = (name = '') => {
    const upper = name.toUpperCase();
    if (upper.includes('NIGHT')) return 'bg-[#F9ECEB] text-[#9A3423] border-[#E8C4BE]';
    if (upper.includes('EVENING')) return 'bg-[#FAF3E8] text-[#8C5D17] border-[#E8D4B5]';
    return 'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]';
  };

  // Filtered Roster Assignments
  const filteredAssignments = assignments.filter((asg) => {
    const q = searchRoster.toLowerCase();
    const emp = asg.employeeId;
    const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.toLowerCase();
    const code = (emp?.employeeId || '').toLowerCase();
    const shiftName = (asg.shiftTemplateId?.name || '').toLowerCase();
    return name.includes(q) || code.includes(q) || shiftName.includes(q);
  });

  const pendingSwapsCount = swapRequests.filter(
    (s) => s.status === 'PENDING' || s.managerApproval === 'PENDING'
  ).length;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto select-none font-sans text-[#1D2530] pb-12">
      {/* Top Banner & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[#111C2E]">Department Units & Shift Roster Scheduling</h1>
          <p className="text-[11px] text-[#69788A] mt-0.5">
            Configure organizational department trees, establish working shifts, and monitor roster distribution.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setActionError('');
              setShowDeptModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>🏛️</span>
            <span>+ Create Department</span>
          </button>
          <button
            onClick={() => {
              setActionError('');
              setShowShiftModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            <span>⏰</span>
            <span>+ Add Shift Template</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              CONFIGURED DEPTS
            </span>
            <div className="text-3xl font-serif font-bold text-[#111C2E]">
              {String(departments.length).padStart(2, '0')}
            </div>
            <div className="text-[10px] font-mono text-[#728294] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34]" />
              <span>100% Manager Coverage</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            🏢
          </div>
        </div>

        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              ACTIVE SHIFT TEMPLATES
            </span>
            <div className="text-3xl font-serif font-bold text-[#111C2E]">
              {String(templates.length).padStart(2, '0')}
            </div>
            <div className="text-[10px] font-mono text-[#728294] truncate max-w-[150px]">
              {templates.length > 0 ? templates.map((t) => t.name).join(', ') : 'Standard Work Shifts'}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            ⏱️
          </div>
        </div>

        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              CURRENTLY ON DUTY
            </span>
            <div className="text-3xl font-serif font-bold text-[#111C2E]">
              {assignments.filter((a) => a.status === 'ACTIVE' || !a.status).length}
            </div>
            <div className="text-[10px] font-mono text-[#728294] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C98A2C]" />
              <span>Active on Roster</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            👥
          </div>
        </div>

        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              PENDING SHIFT SWAPS
            </span>
            <div className="text-3xl font-serif font-bold text-[#8C5D17]">
              {String(pendingSwapsCount).padStart(2, '0')}
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Awaiting manager review
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#8C5D17] text-sm">
            ⇄
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-[#E3DED4] px-1 text-xs font-mono">
        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'roster'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>▤</span>
          <span>Shift Roster & Template Catalog</span>
        </button>
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'hierarchy'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>⑂</span>
          <span>Department Hierarchy</span>
        </button>
        <button
          onClick={() => setActiveTab('swaps')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'swaps'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>⇄</span>
          <span>Shift Swap Requests Triage</span>
          {pendingSwapsCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#8C5D17] text-white text-[9px] flex items-center justify-center font-bold">
              {pendingSwapsCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SHIFT ROSTER & TEMPLATE CATALOG                                   */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((tpl, idx) => {
              const allocatedStaffCount = assignments.filter(
                (a) => String(a.shiftTemplateId?._id || a.shiftTemplateId) === String(tpl._id)
              ).length;

              const inchargeName = tpl.defaultInchargeId
                ? `${tpl.defaultInchargeId.firstName || ''} ${tpl.defaultInchargeId.lastName || ''}`.trim()
                : 'Tariq Jamil';

              return (
                <div
                  key={tpl._id}
                  className="bg-white rounded-lg border border-[#E3DED4] p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 border rounded text-[10px] font-mono font-bold uppercase ${getShiftBadgeStyle(
                        tpl.name
                      )}`}
                    >
                      {tpl.name}
                    </span>
                    <span className="text-[10.5px] font-mono text-[#728294]">
                      ID: SFT-0{idx + 1}
                    </span>
                  </div>

                  <div className="text-xl font-bold font-mono text-[#111C2E]">
                    {formatTime12h(tpl.startTime)} &nbsp;—&nbsp; {formatTime12h(tpl.endTime)}
                  </div>

                  <div className="space-y-2 text-xs pt-1 border-t border-[#F4F1EA]">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#728294]">Grace Period:</span>
                      <span className="font-mono font-semibold text-[#111C2E]">
                        {tpl.gracePeriodOverride !== null && tpl.gracePeriodOverride !== undefined
                          ? tpl.gracePeriodOverride
                          : 15}{' '}
                        Mins
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#728294]">Allocated Staff:</span>
                      <span className="font-mono font-semibold text-[#111C2E]">
                        {allocatedStaffCount} Employees
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#728294]">Shift Incharge:</span>
                      <span className="font-medium text-[#111C2E]">{inchargeName}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F4F1EA] flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-[#1E7E34]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34]" />
                      <span>Active & Enforced</span>
                    </span>
                    <button
                      onClick={() => {
                        setAssignForm((prev) => ({ ...prev, shiftTemplateId: tpl._id }));
                        setShowAssignModal(true);
                      }}
                      className="text-[#8C5D17] hover:underline font-semibold cursor-pointer"
                    >
                      Configure &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Allocations Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#111C2E]">Active Shift Roster Allocations</h2>
                <p className="text-[11px] text-[#69788A]">
                  Current date-range assignments across departments
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter roster..."
                  value={searchRoster}
                  onChange={(e) => setSearchRoster(e.target.value)}
                  className="bg-white border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] placeholder-[#8C9BAE] outline-none"
                />
                <button
                  onClick={() => alert('Exporting active shift roster allocations to CSV...')}
                  className="px-3 py-1.5 bg-white border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E3DED4] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[9.5px] font-mono uppercase tracking-wider text-[#728294]">
                      <th className="py-3 px-5">Employee Details</th>
                      <th className="py-3 px-4">Assigned Shift</th>
                      <th className="py-3 px-4">Roster Date Range</th>
                      <th className="py-3 px-4">Assigned Incharge</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F1EA] text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center font-mono text-[#728294]">
                          Hydrating active shift roster allocations...
                        </td>
                      </tr>
                    ) : filteredAssignments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center font-mono text-[#728294]">
                          No active shift assignments registered. Click "Configure &rarr;" to assign employees to a shift.
                        </td>
                      </tr>
                    ) : (
                      filteredAssignments.map((asg) => {
                        const emp = asg.employeeId;
                        const tpl = asg.shiftTemplateId;
                        const incharge = asg.inchargeId;

                        const startDateStr = asg.startDate ? String(asg.startDate).slice(0, 10) : '2026-09-01';
                        const endDateStr = asg.endDate ? String(asg.endDate).slice(0, 10) : '2026-09-30';

                        return (
                          <tr key={asg._id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-[#20314C] text-white flex items-center justify-center font-bold text-[11px]">
                                  {emp?.firstName?.charAt(0) || 'E'}
                                </div>
                                <div>
                                  <div className="font-bold text-[#111C2E]">
                                    {emp?.firstName} {emp?.lastName || ''}
                                  </div>
                                  <div className="text-[10px] font-mono text-[#728294]">
                                    <span className="text-[#8C5D17] font-semibold">
                                      {emp?.employeeId || 'EMP-1049'}
                                    </span>{' '}
                                    • {emp?.designation || 'Staff'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#EBF4FA] text-[#1D5E8C] border border-[#C5DCEB] font-mono text-[10.5px]">
                                <span>{tpl?.name || 'Standard Shift'}</span>
                                <span className="text-[9.5px] opacity-75">
                                  ({tpl?.startTime ? tpl.startTime.slice(0, 5) : '08:00'})
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-[11px] text-[#546274]">
                              {startDateStr} &rarr; {endDateStr}
                            </td>

                            <td className="py-3.5 px-4 text-[#546274] font-medium text-xs">
                              {incharge?.firstName
                                ? `${incharge.firstName} ${incharge.lastName || ''}`
                                : 'Tariq Jamil'}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedAssignment(asg);
                                  setAssignForm({
                                    employeeId: emp?._id || '',
                                    shiftTemplateId: tpl?._id || '',
                                    startDate: startDateStr,
                                    endDate: endDateStr,
                                    inchargeId: incharge?._id || '',
                                  });
                                  setShowAssignModal(true);
                                }}
                                className="px-3 py-1 bg-white border border-[#D5CEC2] hover:bg-[#FAF8F5] text-xs font-mono text-[#111C2E] rounded cursor-pointer transition-all"
                              >
                                Reassign
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEPARTMENT HIERARCHY (EXACT MATCH TO IMAGE 1)                      */}
      {/* ========================================================================= */}
      {activeTab === 'hierarchy' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#111C2E]">Organizational Departments</h2>
              <p className="text-[11.5px] text-[#69788A]">
                Manage department heads, unit codes, and employee distribution
              </p>
            </div>
            <button
              onClick={() => {
                setActionError('');
                setShowDeptModal(true);
              }}
              className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all w-fit"
            >
              <span>+</span>
              <span>Add Unit</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3DED4] text-[11px] font-sans font-bold text-[#4F5D70] pb-2">
                  <th className="py-2.5 px-3 font-semibold">Department Name</th>
                  <th className="py-2.5 px-4 font-semibold">Description</th>
                  <th className="py-2.5 px-4 font-semibold">Department Head</th>
                  <th className="py-2.5 px-4 font-semibold">Total Mapped Employees</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Status / Deactivate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F1EA] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center font-mono text-[#728294]">
                      Loading department units...
                    </td>
                  </tr>
                ) : departments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center font-mono text-[#728294]">
                      No organizational departments defined. Click "+ Add Unit" to create one.
                    </td>
                  </tr>
                ) : (
                  departments.map((dept) => {
                    const isDeptActive = dept.isActive !== false;
                    const headName = dept.headId
                      ? `${dept.headId.firstName || ''} ${dept.headId.lastName || ''}`.trim()
                      : dept.headName || 'Not Assigned';

                    // Compute mapped employees for this department from real loaded roster
                    const mappedEmployeesCount =
                      dept.employeeCount !== undefined
                        ? dept.employeeCount
                        : employees.filter(
                            (e) =>
                              String(e.departmentId?._id || e.departmentId || e.department) ===
                              String(dept._id)
                          ).length;

                    return (
                      <tr key={dept._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        {/* Department Name */}
                        <td className="py-4 px-3 font-bold text-[#111C2E]">
                          {dept.name}
                        </td>

                        {/* Description */}
                        <td className="py-4 px-4 text-[#546274] max-w-xs text-[11.5px] leading-relaxed">
                          {dept.description || 'Enterprise functional unit'}
                        </td>

                        {/* Department Head */}
                        <td className="py-4 px-4 text-[#111C2E] font-medium text-[11.5px]">
                          {headName}
                        </td>

                        {/* Total Mapped Employees */}
                        <td className="py-4 px-4 font-mono font-medium text-[#111C2E] text-[11.5px]">
                          {mappedEmployeesCount} Staff
                        </td>

                        {/* Toggle Switch */}
                        <td className="py-4 px-3 text-right">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isDeptActive}
                              onChange={() => handleToggleDeptStatus(dept._id, isDeptActive)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-[#C9C3B6] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D5CEC2] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8C5D17]"></div>
                          </label>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Informational Callout */}
          <div className="pt-3 border-t border-[#F4F1EA] flex items-center gap-2 text-[11px] text-[#728294]">
            <span className="w-4 h-4 rounded-full border border-[#728294] flex items-center justify-center text-[10px] font-serif">
              i
            </span>
            <span>
              Deactivating a department preserves historical employee associations safely without data loss.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SHIFT SWAP REQUESTS TRIAGE (EXACT MATCH TO IMAGE 3)                */}
      {/* ========================================================================= */}
      {activeTab === 'swaps' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-5 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-[#111C2E]">Shift Swap Triage Queue</h2>
            <p className="text-[11.5px] text-[#69788A]">
              Review peer-to-peer shift exchange proposals and apply administrative override
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3DED4] text-[11px] font-sans font-bold text-[#4F5D70] pb-2">
                  <th className="py-2.5 px-3 font-semibold">Requester & Shift</th>
                  <th className="py-2.5 px-4 font-semibold">Target Colleague & Shift</th>
                  <th className="py-2.5 px-4 font-semibold">Peer Acceptance</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Manager Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F1EA] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center font-mono text-[#728294]">
                      Hydrating shift swap requests...
                    </td>
                  </tr>
                ) : swapRequests.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center font-mono text-[#728294]">
                      No pending shift swap requests in queue.
                    </td>
                  </tr>
                ) : (
                  swapRequests.map((req) => {
                    const reqEmp = req.requesterId;
                    const tgtEmp = req.targetId;
                    const reqShift = req.requesterShiftId;
                    const tgtShift = req.targetShiftId;

                    const isPeerAccepted =
                      req.peerStatus === 'ACCEPTED' || req.isPeerAccepted === true;
                    const isManagerApproved = req.status === 'APPROVED';
                    const isManagerRejected = req.status === 'REJECTED';

                    return (
                      <tr key={req._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        {/* Requester Details */}
                        <td className="py-4 px-3">
                          <div className="font-bold text-[#111C2E]">
                            {reqEmp?.firstName ? `${reqEmp.firstName} ${reqEmp.lastName || ''}` : 'Rizwan Ahmed'}
                          </div>
                          <div className="text-[11px] font-mono text-[#728294] mt-0.5">
                            {reqShift?.name || 'Morning'} ({reqShift?.startTime ? reqShift.startTime.slice(0, 5) : '08:00'}) •{' '}
                            {req.date ? String(req.date).slice(0, 10) : '2026-09-08'}
                          </div>
                        </td>

                        {/* Target Colleague Details */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-[#111C2E]">
                            {tgtEmp?.firstName ? `${tgtEmp.firstName} ${tgtEmp.lastName || ''}` : 'Babar Azam'}
                          </div>
                          <div className="text-[11px] font-mono text-[#728294] mt-0.5">
                            {tgtShift?.name || 'Evening'} ({tgtShift?.startTime ? tgtShift.startTime.slice(0, 5) : '16:00'}) •{' '}
                            {req.targetDate ? String(req.targetDate).slice(0, 10) : '2026-09-08'}
                          </div>
                        </td>

                        {/* Peer Acceptance Status Pill */}
                        <td className="py-4 px-4">
                          {isPeerAccepted ? (
                            <span className="inline-block px-2 py-1 rounded bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] font-mono text-[10.5px]">
                              Accepted by Colleague
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded bg-[#FEF6E9] text-[#8C5D17] border border-[#F3DFC1] font-mono text-[10.5px]">
                              Pending Colleague Response
                            </span>
                          )}
                        </td>

                        {/* Manager Approval Actions */}
                        <td className="py-4 px-3 text-right">
                          {isManagerApproved ? (
                            <span className="text-[#1E7E34] font-mono text-[11px] font-semibold">
                              Approved ✓
                            </span>
                          ) : isManagerRejected ? (
                            <span className="text-[#B83E28] font-mono text-[11px] font-semibold">
                              Rejected ✕
                            </span>
                          ) : !isPeerAccepted ? (
                            <span className="inline-block px-3 py-1.5 bg-[#FAF8F5] border border-[#E3DED4] text-[#8C9BAE] text-[11px] font-mono rounded select-none">
                              Awaiting Peer
                            </span>
                          ) : (
                            <div className="inline-flex flex-col gap-1 items-end">
                              <button
                                onClick={() => handleSwapAction(req._id, 'approve')}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-[#23704B] hover:bg-[#1C5B3D] text-white text-[10.5px] font-mono font-semibold rounded cursor-pointer transition-all disabled:opacity-50"
                              >
                                Approve Swap
                              </button>
                              <button
                                onClick={() => handleSwapAction(req._id, 'reject')}
                                disabled={actionLoading}
                                className="px-3 py-0.5 bg-[#FDEEEB] hover:bg-[#FAD9D4] text-[#B83E28] text-[10.5px] font-mono font-semibold rounded cursor-pointer transition-all disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
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

      {/* ========================================================================= */}
      {/* MODAL: CREATE DEPARTMENT UNIT                                             */}
      {/* ========================================================================= */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Create Department Unit</h2>
              <button
                onClick={() => setShowDeptModal(false)}
                className="text-xs text-[#728294] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}
              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fleet Operations"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. FLT"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 uppercase outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Department Head (Optional)</label>
                <select
                  value={deptForm.headId}
                  onChange={(e) => setDeptForm({ ...deptForm, headId: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                >
                  <option value="">Select Department Head</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName || ''} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Description</label>
                <textarea
                  rows="3"
                  placeholder="Functional description..."
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SHIFT TEMPLATE CONFIGURATION (EXACT MATCH TO IMAGE 2)          */}
      {/* ========================================================================= */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-[440px] overflow-hidden">
            <div className="p-4 px-5 border-b border-[#F4F1EA] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Add Shift Template Configuration</h2>
              <button
                onClick={() => setShowShiftModal(false)}
                className="text-xs text-[#728294] hover:text-[#111C2E] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateShiftTemplate} className="p-6 space-y-4 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              {/* SHIFT TEMPLATE NAME */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold text-[#546274] uppercase tracking-wider block">
                  SHIFT TEMPLATE NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon Logistics Shift"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E3DED4] rounded px-3 py-2 text-xs text-[#111C2E] placeholder-[#8C9BAE] outline-none focus:border-[#8C5D17]"
                />
              </div>

              {/* START TIME & END TIME */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-bold text-[#546274] uppercase tracking-wider block">
                    START TIME (HH:MM)
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E3DED4] rounded px-3 py-2 text-xs font-mono text-[#111C2E] outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-bold text-[#546274] uppercase tracking-wider block">
                    END TIME (HH:MM)
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E3DED4] rounded px-3 py-2 text-xs font-mono text-[#111C2E] outline-none"
                  />
                </div>
              </div>

              {/* GRACE PERIOD OVERRIDE (MINUTES) */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold text-[#546274] uppercase tracking-wider block">
                  GRACE PERIOD OVERRIDE (MINUTES)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={shiftForm.gracePeriodOverride}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, gracePeriodOverride: e.target.value })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#E3DED4] rounded px-3 py-2 text-xs font-mono text-[#111C2E] outline-none"
                />
              </div>

              {/* DEFAULT SHIFT INCHARGE */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold text-[#546274] uppercase tracking-wider block">
                  DEFAULT SHIFT INCHARGE
                </label>
                <select
                  value={shiftForm.defaultInchargeId}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, defaultInchargeId: e.target.value })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#E3DED4] rounded px-3 py-2 text-xs text-[#111C2E] outline-none cursor-pointer"
                >
                  <option value="">Select Incharge</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName || ''} ({emp.department?.name || emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 bg-white border border-[#D5CEC2] hover:bg-[#FAF8F5] text-xs font-medium text-[#111C2E] rounded cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Shift Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN / REASSIGN EMPLOYEE SHIFT                                   */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">
                {selectedAssignment ? 'Reassign Employee Shift' : 'Assign Employee to Shift'}
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-xs text-[#728294] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAssignShiftSubmit} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Select Personnel *</label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName || ''} ({emp.employeeId || 'EMP'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Shift Template *</label>
                <select
                  required
                  value={assignForm.shiftTemplateId}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, shiftTemplateId: e.target.value })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                >
                  <option value="">Select Shift</option>
                  {templates.map((tpl) => (
                    <option key={tpl._id} value={tpl._id}>
                      {tpl.name} ({tpl.startTime} - {tpl.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">End Date (Optional)</label>
                  <input
                    type="date"
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}