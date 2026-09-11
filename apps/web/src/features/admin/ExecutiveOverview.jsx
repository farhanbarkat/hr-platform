import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { apiClient } from '../../lib/apiClient.js';

import AttendanceClockWidget from './widgets/AttendanceClockWidget.jsx';
import TeamAttendanceStatusWidget from './widgets/TeamAttendanceStatusWidget.jsx';
import QuickShiftAssignmentWidget from './widgets/QuickShiftAssignmentWidget.jsx';
import LeaveApprovalQueueWidget from './widgets/LeaveApprovalQueueWidget.jsx';
import PayrollSummaryWidget from './widgets/PayrollSummaryWidget.jsx';
import AttendanceTrendChart from './widgets/AttendanceTrendChart.jsx';

export default function ExecutiveOverview() {
  const { user, isSuperAdmin, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({ onFloor: 0, absent: 0, missing: 0, ratio: 0 });
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load live data from your existing established routers
  useEffect(() => {
    let isMounted = true;

    const loadRealData = async () => {
      try {
        setLoading(true);

        const [empRes, attRes, leaveRes] = await Promise.allSettled([
          apiClient.get('/employees?limit=200'),
          apiClient.get('/attendance?limit=200'),
          apiClient.get('/leaves/pending-approvals'),
        ]);

        if (!isMounted) return;

        // 1. Live Employees Count
        let empCount = 0;
        if (empRes.status === 'fulfilled') {
          const raw = empRes.value.data?.data || empRes.value.data || [];
          empCount = Array.isArray(raw) ? raw.length : (raw.total || 0);
          setTotalEmployees(empCount);
        }

        // 2. Live Today Attendance Stats
        if (attRes.status === 'fulfilled') {
          const rawAtt = attRes.value.data?.data || attRes.value.data || [];
          const records = Array.isArray(rawAtt) ? rawAtt : [];

          const onFloor = records.filter((r) => r.checkIn && !r.checkOut).length;
          const checkedOut = records.filter((r) => r.checkIn && r.checkOut).length;
          const missing = records.filter((r) => r.isMissingCheckout).length;
          const totalPresent = onFloor + checkedOut;
          const absent = Math.max(0, empCount - totalPresent);
          const ratio = empCount > 0 ? Math.round((totalPresent / empCount) * 100) : 0;

          setAttendanceStats({ onFloor, absent, missing, ratio });

          // 3. Build 7-Day Velocity from existing attendance records
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const past7 = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];

            const count = records.filter((r) => {
              const rDate = new Date(r.date || r.createdAt);
              return rDate.toDateString() === d.toDateString();
            }).length;

            past7.push({
              day: dayName,
              present: count,
              absent: Math.max(0, empCount - count),
            });
          }
          setTrendData(past7);
        }

        // 4. Live Pending Leaves Queue
        if (leaveRes.status === 'fulfilled') {
          const rawLeaves = leaveRes.value.data?.data || leaveRes.value.data || [];
          setPendingLeaves(Array.isArray(rawLeaves) ? rawLeaves.length : 0);
        }
      } catch (err) {
        console.error('Error fetching dashboard live data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRealData();

    return () => {
      isMounted = false;
    };
  }, []);

  const can = (perm) => isSuperAdmin || user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || hasPermission(perm);
  const canAny = (perms) => isSuperAdmin || user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || hasAnyPermission(perms);
  const designation = user?.jobTitle || user?.designation || 'Operational Staff';

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto select-none font-sans text-[#16233B] pb-12">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
              OPERATIONAL WORKSPACE // {user?.companyName || 'TENANT HUB'}
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1E7E34]"></span>
          </div>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'Administrator'}
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Assigned Operational Capacity: <span className="font-mono font-semibold text-[#8C5D17]">{designation}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="px-3 py-1.5 bg-white border border-[#E3DED4] rounded shadow-2xs">
            <span className="text-[#728294]">ROLE:</span> <span className="font-bold text-[#16233B]">{user?.role || 'EMPLOYEE'}</span>
          </div>
          <div className="px-3 py-1.5 bg-[#FAF4E8] border border-[#E3DED4] text-[#8C5D17] rounded font-bold shadow-2xs">
            DATABASE // CONNECTED
          </div>
        </div>
      </div>

      {/* 2. Top Metric Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/company-admin/employees')}
          className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs cursor-pointer hover:border-[#8C5D17] transition-all"
        >
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">TOTAL ACTIVE HEADCOUNT</span>
          <div className="text-xl font-bold font-mono text-[#16233B] mt-1">
            {loading ? '...' : totalEmployees} <span className="text-[10px] font-normal text-[#1E7E34]">staff</span>
          </div>
          <div className="text-[10px] text-[#728294] mt-0.5">Workforce active records</div>
        </div>

        <div
          onClick={() => navigate('/company-admin/attendance')}
          className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs cursor-pointer hover:border-[#8C5D17] transition-all"
        >
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">CURRENT SHIFT ATTENDANCE</span>
          <div className="text-xl font-bold font-mono text-[#1E7E34] mt-1">
            {loading ? '...' : `${attendanceStats.ratio}%`}
            <span className="text-[10px] text-[#B83E28] font-normal ml-1">
              ({attendanceStats.onFloor} on-floor)
            </span>
          </div>
          <div className="text-[10px] text-[#728294] mt-0.5">
            {attendanceStats.absent} off-duty / absent
          </div>
        </div>

        <div
          onClick={() => navigate('/company-admin/leaves')}
          className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs cursor-pointer hover:border-[#8C5D17] transition-all"
        >
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">PENDING APPROVAL QUEUE</span>
          <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">
            {loading ? '...' : pendingLeaves} <span className="text-[10px] font-normal text-[#728294]">requests</span>
          </div>
          <div className="text-[10px] text-[#1E7E34] mt-0.5">
            {pendingLeaves > 0 ? 'Requires attention' : 'Queue cleared'}
          </div>
        </div>

        <div
          onClick={() => navigate('/company-admin/payroll')}
          className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs cursor-pointer hover:border-[#8C5D17] transition-all"
        >
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">PAYROLL CYCLE</span>
          <div className="text-xl font-bold font-mono text-[#16233B] mt-1">
            {new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
          </div>
          <div className="text-[10px] text-[#8C5D17] mt-0.5">Active Cycle</div>
        </div>
      </div>

      {/* 3. Graph & Shift Telemetry */}
      {can(PERMISSIONS.ATTENDANCE.READ) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <AttendanceTrendChart data={trendData} loading={loading} />
          </div>
          <div className="lg:col-span-1">
            <TeamAttendanceStatusWidget
              metrics={{
                onFloorCount: attendanceStats.onFloor,
                absentCount: attendanceStats.absent,
                unflaggedMissing: attendanceStats.missing,
                attendanceRatio: attendanceStats.ratio,
              }}
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* 4. Action Hubs */}
      <div>
        <div className="pb-2 border-b border-[#F4F1EA] mb-4">
          <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-bold">
            OPERATIONAL HUBS & ACTIONS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AttendanceClockWidget />

          {can(PERMISSIONS.COMPANY.READ) && <QuickShiftAssignmentWidget />}

          {canAny([PERMISSIONS.LEAVE.APPROVE_MANAGER, PERMISSIONS.LEAVE.APPROVE_HR, PERMISSIONS.LEAVE.VIEW_TEAM]) && (
            <LeaveApprovalQueueWidget count={pendingLeaves} />
          )}

          {can(PERMISSIONS.PAYROLL.READ) && <PayrollSummaryWidget />}

          {can(PERMISSIONS.FINANCE.VIEW_DASHBOARD) && (
            <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
                  FINANCIAL LEDGER
                </span>
                <h3 className="text-sm font-bold text-[#16233B] mt-1">Company Treasury & Finance</h3>
                <p className="text-xs text-[#728294] mt-0.5">Cash burn rate, operational expenses, and department budgets.</p>
              </div>
              <button
                onClick={() => navigate('/company-admin/finance')}
                className="mt-4 w-full py-2 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#16233B] hover:text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors"
              >
                VIEW FINANCIAL AUDIT &rarr;
              </button>
            </div>
          )}

          {(isSuperAdmin || user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || can(PERMISSIONS.COMPANY.CONFIGURE)) && (
            <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
                  SECURITY & GOVERNANCE
                </span>
                <h3 className="text-sm font-bold text-[#16233B] mt-1">Roles & Custom Delegation</h3>
                <p className="text-xs text-[#728294] mt-0.5">Assign powers to Floor Managers, Senior HR, or Interns dynamically.</p>
              </div>
              <button
                onClick={() => navigate('/company-admin/roles-capabilities')}
                className="mt-4 w-full py-2 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#16233B] hover:text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors"
              >
                MANAGE DELEGATIONS &rarr;
              </button>
            </div>
          )}

          {(isSuperAdmin || user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || can(PERMISSIONS.SETTINGS.READ)) && (
            <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
                  CONFIGURATION DESK
                </span>
                <h3 className="text-sm font-bold text-[#16233B] mt-1">Organization Settings</h3>
                <p className="text-xs text-[#728294] mt-0.5">Configure tenant details, shift policies, and branding.</p>
              </div>
              <button
                onClick={() => navigate('/company-admin/settings')}
                className="mt-4 w-full py-2 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#16233B] hover:text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors"
              >
                SYSTEM PREFERENCES &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}