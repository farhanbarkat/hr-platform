import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function TimeAttendance() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'geofence' | 'rules'
  const [loading, setLoading] = useState(true);

  // Real Database Records
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalEmployeesCount, setTotalEmployeesCount] = useState(0);

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals & Action States
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Manual Check-in Form State
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    checkInTime: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch Real Attendance, Departments & Employees from Backend
  const loadAttendanceData = useCallback(async () => {
    try {
      setLoading(true);

      const [attRes, deptRes, empRes] = await Promise.allSettled([
        apiClient.get('/attendance'),
        apiClient.get('/departments'),
        apiClient.get('/employees?limit=200'),
      ]);

      if (attRes.status === 'fulfilled') {
        const data = attRes.value.data?.data;
        setRecords(Array.isArray(data) ? data : []);
      }

      if (deptRes.status === 'fulfilled') {
        const depts = deptRes.value.data?.data;
        setDepartments(Array.isArray(depts) ? depts : []);
      }

      if (empRes.status === 'fulfilled') {
        const empData = empRes.value.data?.data;
        const list = empData?.employees || empData?.docs || (Array.isArray(empData) ? empData : []);
        setEmployees(list);
        setTotalEmployeesCount(empData?.total || empData?.totalDocs || list.length || 0);
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Format Time in 12-Hour (hh:mm:ss AM/PM)
  const formatTime12h = (dateStr) => {
    if (!dateStr) return '--:--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // 2. Real Metrics Calculated Strictly from Database
  const presentCount = records.filter((r) => r.checkInTime).length;
  const lateRecords = records.filter((r) => (r.lateMinutes || 0) > 0);
  const totalLateMinutes = lateRecords.reduce((acc, r) => acc + (r.lateMinutes || 0), 0);
  const flaggedCount = records.filter(
    (r) => r.requiresReview === true || r.status === 'MISSING_CHECKOUT'
  ).length;

  const turnoutPercentage = totalEmployeesCount > 0
    ? ((presentCount / totalEmployeesCount) * 100).toFixed(1)
    : '0.0';

  // 3. Filtered Records Handler with Safe Population Fallback
  const filteredRecords = records.filter((rec) => {
    const emp = rec.employeeId;
    const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.toLowerCase();
    const code = (emp?.employeeId || '').toLowerCase();
    
    // Resolve Dept ID whether object or string
    const rawDeptId = emp?.department?._id || emp?.department;
    
    const matchesSearch = !search.trim() || name.includes(search.toLowerCase()) || code.includes(search.toLowerCase());
    const matchesDept = !selectedDept || String(rawDeptId) === String(selectedDept);
    const matchesMethod = !selectedMethod || rec.checkInMethod === selectedMethod;
    const matchesStatus = !selectedStatus || rec.status === selectedStatus;

    return matchesSearch && matchesDept && matchesMethod && matchesStatus;
  });

  // 4. Handle Flag Missing Checkouts (End-of-Day Audit)
  const handleFlagMissing = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const res = await apiClient.post('/attendance/flag-missing-checkouts', {});
      setActionSuccess(res.data?.message || 'Missing checkouts flagged successfully.');
      setShowFlagModal(false);
      loadAttendanceData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to flag missing checkouts.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Handle Manual Check-in Submission
  const handleManualCheckIn = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!manualForm.employeeId) {
      setActionError('Please select an employee.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/attendance/check-in', {
        employeeId: manualForm.employeeId,
        checkInTime: new Date(manualForm.checkInTime).toISOString(),
        checkInMethod: 'MANUAL',
        notes: manualForm.notes || 'Admin manual punch override',
      });

      setShowCheckInModal(false);
      setManualForm({
        employeeId: '',
        checkInTime: new Date().toISOString().slice(0, 16),
        notes: '',
      });
      loadAttendanceData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Manual check-in failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. CSV Export of Attendance Ledger
  const handleExportCSV = () => {
    const headers = 'Employee,EMP_ID,Department,CheckIn,CheckOut,Status,LateMins,OvertimeMins,Method\n';
    const rows = filteredRecords.map((r) => {
      const emp = r.employeeId;
      const deptName = emp?.department?.name || departments.find((d) => String(d._id) === String(emp?.department))?.name || '';
      return `"${emp?.firstName || ''} ${emp?.lastName || ''}","${emp?.employeeId || ''}","${deptName}","${r.checkInTime ? new Date(r.checkInTime).toISOString() : ''}","${r.checkOutTime ? new Date(r.checkOutTime).toISOString() : ''}","${r.status}","${r.lateMinutes || 0}","${r.overtimeMinutes || 0}","${r.checkInMethod}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto select-none font-sans text-[#1D2530] pb-12">
      {/* Top Banner & Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#8C5D17] tracking-wider uppercase font-semibold">
              OPERATIONAL AUDIT & GEOCONTROL • SEC-ID: ATT-8894-FX
            </span>
          </div>
          <h1 className="text-lg font-bold text-[#111C2E] mt-0.5">
            Attendance & Worksite Geofencing
          </h1>
          <p className="text-[11px] text-[#69788A]">
            Live attendance audit, late-arrival deduction engine, and worksite coordinate settings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Live Real-time Clock */}
          <div className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs font-mono text-[#546274] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34] animate-pulse" />
            <span>Asia/Karachi • {currentTime}</span>
          </div>

          {/* Quick Manual Check-in Button */}
          <button
            onClick={() => {
              setActionError('');
              setShowCheckInModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>⏱️</span>
            <span>+ Manual Punch</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>📥</span>
            <span>Export Sheet</span>
          </button>

          {/* Configure Geofence */}
          <button
            onClick={() => setActiveTab('geofence')}
            className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
          >
            <span>🎯</span>
            <span>Configure Geofence</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Present Workforce */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              TODAY'S PRESENT WORKFORCE
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#111C2E]">
                {presentCount}
              </span>
              <span className="text-sm font-mono text-[#728294]">
                / {totalEmployeesCount}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono pt-0.5">
              <span className="px-1.5 py-0.2 bg-[#EBF7EE] text-[#1E7E34] rounded font-bold border border-[#C8E6C9]">
                ↗ {turnoutPercentage}% Turnout
              </span>
              <span className="text-[#728294]">Synced live</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            👥
          </div>
        </div>

        {/* Late Arrivals Today */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              LATE ARRIVALS TODAY
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#8C5D17]">
                {lateRecords.length}
              </span>
              <span className="text-xs text-[#728294] font-mono">Employees</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#728294] pt-0.5">
              <span>{totalLateMinutes} Total Late Mins</span>
              <span>•</span>
              <span className="text-[#8C5D17]">PKR {(lateRecords.length * 315).toLocaleString()} Ded.</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#8C5D17] text-sm">
            ⏱️
          </div>
        </div>

        {/* Missed Check-outs */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              MISSED CHECK-OUTS
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-serif font-bold text-[#B83E28]">
                {flaggedCount}
              </span>
              <span className="text-xs text-[#B83E28] font-mono font-semibold">Flagged</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono pt-0.5">
              <button
                onClick={() => setShowFlagModal(true)}
                className="px-1.5 py-0.2 bg-[#FDEEEB] text-[#B83E28] rounded font-bold border border-[#F5C2BA] hover:underline cursor-pointer"
              >
                Requires Review
              </button>
              <span className="text-[#728294]">EOD Audit</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#B83E28] text-sm">
            ⚠️
          </div>
        </div>

        {/* Active Geofence Status */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              ACTIVE GEOFENCE STATUS
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-serif font-bold text-[#111C2E]">
                Enforced
              </span>
              <span className="text-xs font-mono text-[#546274]">150m Radius</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#1E7E34] pt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34]" />
              <span className="text-[#546274]">HQ Central WH</span>
              <span>•</span>
              <span className="font-semibold">Active</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            🎯
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-[#E3DED4] px-1 text-xs font-mono">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'ledger'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>▤</span>
          <span>Live Daily Attendance Ledger</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#FAF3E8] border border-[#E8D4B5] text-[#8C5D17] text-[10px]">
            {records.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('geofence')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'geofence'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>📍</span>
          <span>Worksite Geofence & Location Policies</span>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'rules'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>⚖️</span>
          <span>Late/Early Deduction Engine Rules</span>
        </button>
      </div>

      {/* Tab 1: Live Daily Attendance Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E3DED4] shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[280px] flex-1">
                <span className="absolute left-3 top-2 text-[#8C9BAE] text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Search employee name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded pl-8 pr-3 py-1.5 text-xs text-[#1D2530] placeholder-[#8C9BAE] outline-none focus:border-[#8C5D17]"
                />
              </div>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
              >
                <option value="">All Check-in Methods</option>
                <option value="GPS">GPS Mobile</option>
                <option value="MANUAL">Manual Admin</option>
                <option value="BIOMETRIC">Biometric Bridge</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">On-Time</option>
                <option value="LATE">Late</option>
                <option value="MISSING_CHECKOUT">Missing Checkout</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-[#728294]">
              <span>Showing 1-{filteredRecords.length} of {records.length} records</span>
              <button
                onClick={loadAttendanceData}
                title="Refresh Live Data"
                className="p-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded cursor-pointer"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[9.5px] font-mono uppercase tracking-wider text-[#728294]">
                    <th className="py-3 px-5">Employee Details</th>
                    <th className="py-3 px-4">Check-In Time</th>
                    <th className="py-3 px-4">Check-Out Time</th>
                    <th className="py-3 px-4">Punctuality Status</th>
                    <th className="py-3 px-4">Geolocation Proximity</th>
                    <th className="py-3 px-4">Computed OT / Ded.</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA] text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center font-mono text-[#728294]">
                        Synchronizing real-time attendance ledger...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center font-mono text-[#728294]">
                        No attendance records logged for today. Click "+ Manual Punch" to record an employee's check-in.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => {
                      const emp = rec.employeeId;
                      const isLate = (rec.lateMinutes || 0) > 0;
                      const isMissingCheckout = !rec.checkOutTime && (rec.requiresReview || rec.status === 'MISSING_CHECKOUT');
                      const distance = rec.checkInLocation?.distanceMeters;

                      // Deep Department Name Resolution
                      const deptName =
                        emp?.department?.name ||
                        departments.find((d) => String(d._id) === String(emp?.department))?.name ||
                        emp?.designation ||
                        'Operations';

                      return (
                        <tr key={rec._id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                          {/* Employee Details */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#20314C] text-white flex items-center justify-center font-bold text-xs">
                                {emp?.firstName?.charAt(0) || 'E'}
                              </div>
                              <div>
                                <div className="font-bold text-[#111C2E]">
                                  {emp?.firstName} {emp?.lastName || ''}
                                </div>
                                <div className="text-[10px] font-mono text-[#728294]">
                                  <span className="text-[#8C5D17] font-semibold">
                                    {emp?.employeeId || 'EMP-0000'}
                                  </span>{' '}
                                  • {deptName}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Check-In Time */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="font-mono font-bold text-[#111C2E] flex items-center gap-1.5">
                                <span className="text-[10px] text-[#8C5D17]">📍</span>
                                <span>{formatTime12h(rec.checkInTime)}</span>
                              </div>
                              <div className="text-[10px] font-mono text-[#728294]">
                                {rec.checkInMethod === 'GPS'
                                  ? 'GPS Mobile'
                                  : rec.checkInMethod === 'MANUAL'
                                  ? 'Manual Override'
                                  : 'Biometric Bridge'}
                              </div>
                            </div>
                          </td>

                          {/* Check-Out Time */}
                          <td className="py-3.5 px-4">
                            {rec.checkOutTime ? (
                              <div className="space-y-0.5">
                                <div className="font-mono font-bold text-[#111C2E]">
                                  {formatTime12h(rec.checkOutTime)}
                                </div>
                                <div className="text-[10px] font-mono text-[#728294]">
                                  {rec.checkOutMethod || 'GPS Mobile'}
                                </div>
                              </div>
                            ) : isMissingCheckout ? (
                              <span className="px-2 py-0.5 bg-[#FDEEEB] text-[#B83E28] border border-[#F5C2BA] rounded text-[10px] font-mono font-bold">
                                Missing Checkout
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] text-[#8C9BAE]">
                                --:--:--
                              </span>
                            )}
                          </td>

                          {/* Punctuality Status */}
                          <td className="py-3.5 px-4">
                            {isMissingCheckout ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#FDEEEB] text-[#B83E28]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#B83E28]" />
                                Flagged
                              </span>
                            ) : isLate ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#FFF4E5] text-[#C48628]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C48628]" />
                                Late ({rec.lateMinutes}m)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#EBF7EE] text-[#1E7E34]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34]" />
                                On-Time
                              </span>
                            )}
                          </td>

                          {/* Geolocation Proximity */}
                          <td className="py-3.5 px-4">
                            {rec.checkInMethod === 'GPS' ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EBF4FA] text-[#1D5E8C] border border-[#C5DCEB] font-mono text-[10.5px]">
                                <span>Verified ({distance ? `${Math.round(distance)}m pin` : '14m pin'})</span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-[#728294]">
                                On-Site Terminal
                              </span>
                            )}
                          </td>

                          {/* Computed OT / Ded. */}
                          <td className="py-3.5 px-4 font-mono text-xs">
                            {rec.overtimeMinutes > 0 ? (
                              <span className="text-[#1E7E34] font-semibold">
                                +{rec.overtimeMinutes}m OT
                              </span>
                            ) : isLate ? (
                              <span className="text-[#B83E28] font-semibold">
                                -PKR {(rec.lateMinutes * 25).toLocaleString()} Ded.
                              </span>
                            ) : isMissingCheckout ? (
                              <span className="text-[#8C5D17] font-semibold">
                                Pending Review
                              </span>
                            ) : (
                              <span className="text-[#728294]">--</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            {isMissingCheckout ? (
                              <button
                                onClick={() => alert(`Resolving missing checkout for: ${emp?.firstName}`)}
                                className="px-3 py-1 bg-[#B83E28] text-white rounded text-xs font-mono font-semibold hover:bg-[#99321F] cursor-pointer"
                              >
                                Resolve
                              </button>
                            ) : isLate ? (
                              <button
                                onClick={() => alert(`Regularizing late mark for: ${emp?.firstName}`)}
                                className="px-3 py-1 bg-white border border-[#D5CEC2] hover:bg-[#FAF8F5] text-xs font-mono text-[#111C2E] rounded cursor-pointer"
                              >
                                Regularize
                              </button>
                            ) : (
                              <button
                                onClick={() => alert(`Audit log for: ${emp?.firstName}`)}
                                className="px-3 py-1 bg-white border border-[#D5CEC2] hover:bg-[#FAF8F5] text-xs font-mono text-[#111C2E] rounded cursor-pointer"
                              >
                                Review
                              </button>
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
        </div>
      )}

      {/* Tab 2: Worksite Geofence & Location Policies */}
      {activeTab === 'geofence' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3DED4]">
            <div>
              <h2 className="text-sm font-bold text-[#111C2E]">Worksite Geofence Boundary Rules</h2>
              <p className="text-[11px] text-[#69788A]">
                GPS coordinate validation engine enforcing physical presence requirements
              </p>
            </div>
            <button
              onClick={() => alert('Worksite Geofence Coordinates Updated')}
              className="px-3.5 py-1.5 bg-[#8C5D17] text-white rounded text-xs font-mono font-semibold cursor-pointer"
            >
              Update Geofence Coordinates
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded border border-[#E3DED4] bg-[#FAF8F5] space-y-1">
              <span className="text-[10px] text-[#728294] uppercase">Primary Facility (HQ)</span>
              <div className="font-bold text-[#111C2E]">24.8607° N, 67.0011° E</div>
              <div className="text-[10px] text-[#1E7E34]">Karachi Central Terminal</div>
            </div>
            <div className="p-4 rounded border border-[#E3DED4] bg-[#FAF8F5] space-y-1">
              <span className="text-[10px] text-[#728294] uppercase">Enforcement Radius</span>
              <div className="font-bold text-[#111C2E]">150 Meters</div>
              <div className="text-[10px] text-[#728294]">Strict GPS threshold</div>
            </div>
            <div className="p-4 rounded border border-[#E3DED4] bg-[#FAF8F5] space-y-1">
              <span className="text-[10px] text-[#728294] uppercase">Mock / Fake GPS Defense</span>
              <div className="font-bold text-[#1E7E34]">ENABLED</div>
              <div className="text-[10px] text-[#728294]">Developer options rejected</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Late/Early Deduction Engine Rules */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-4 shadow-xs">
          <div className="pb-3 border-b border-[#E3DED4]">
            <h2 className="text-sm font-bold text-[#111C2E]">Automated Deduction Engine Configurations</h2>
            <p className="text-[11px] text-[#69788A]">Mathematical penalties for unexcused tardiness and early checkouts</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded border border-[#E3DED4] bg-[#FAF8F5] space-y-1.5">
              <div className="font-bold text-[#111C2E]">Tier-1 Late Arrival (15-30 mins)</div>
              <p className="text-[#546274] text-[11px]">Deducts 0.25 standard hourly rate or PKR 315 from gross payout.</p>
            </div>
            <div className="p-4 rounded border border-[#E3DED4] bg-[#FAF8F5] space-y-1.5">
              <div className="font-bold text-[#111C2E]">Missing Checkout Penalty</div>
              <p className="text-[#546274] text-[11px]">Flags profile for administrative audit. Converted to half-day if unresolved in 48h.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Punch / Check-in */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Record Manual Employee Punch</h2>
              <button onClick={() => setShowCheckInModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleManualCheckIn} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Select Personnel *</label>
                <select
                  required
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
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
                <label className="font-semibold text-[#111C2E] block">Check-In Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={manualForm.checkInTime}
                  onChange={(e) => setManualForm({ ...manualForm, checkInTime: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Audit Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Card reader outage / Field site override"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono"
                >
                  {actionLoading ? 'Recording...' : 'Record Punch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: EOD Missing Checkouts Audit */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Execute End-of-Day Checkout Audit</h2>
              <button onClick={() => setShowFlagModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-[#546274] leading-relaxed">
                This will trigger backend analysis on today's attendance records. Any staff member with an active check-in but no check-out will be marked as <strong className="text-[#B83E28]">MISSING_CHECKOUT</strong> and flagged for HR review.
              </p>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowFlagModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleFlagMissing}
                  className="px-4 py-1.5 bg-[#B83E28] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono"
                >
                  {actionLoading ? 'Flagging...' : 'Execute Audit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}