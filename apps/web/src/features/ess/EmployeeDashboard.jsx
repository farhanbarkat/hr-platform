import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ApplyLeaveModal from '../leave/ApplyLeaveModal.jsx';
import AttendancePunchCard from '../attendance/AttendancePunchCard.jsx';
import ProposeShiftSwapModal from './ProposeShiftSwapModal.jsx';
import ShiftSwapDesk from '../shifts/ShiftSwapDesk.jsx';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // 🔄 Shift Swap State Management
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapRefreshKey, setSwapRefreshKey] = useState(0);

  // 🏦 Loan Application & Telemetry State
  const [myLoans, setMyLoans] = useState([]);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanForm, setLoanForm] = useState({
    principal: '',
    tenureMonths: 12,
    purpose: '',
  });
  const [loanFeedback, setLoanFeedback] = useState(null);

  // 1. Fetch Core Dashboard Telemetry
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/ess/dashboard');
      if (res.data?.data) {
        setDashboardData(res.data.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Employee record not found. Please ensure your user account is linked to an active Employee profile.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Employee Personal Loans (TICKET-029)
  const fetchMyLoans = useCallback(async () => {
    try {
      const res = await apiClient.get('/loans/my-loans');
      setMyLoans(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load employee loans:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchMyLoans();
  }, [fetchDashboard, fetchMyLoans]);

  // 3. Handle Loan Submission directly from ESS
  const handleApplyLoan = async (e) => {
    e.preventDefault();
    try {
      setLoanSubmitting(true);
      setLoanFeedback(null);

      await apiClient.post('/loans/apply', {
        principal: parseFloat(loanForm.principal),
        tenureMonths: parseInt(loanForm.tenureMonths, 10),
        purpose: loanForm.purpose,
      });

      setLoanFeedback({
        ok: true,
        text: 'Loan petition submitted successfully for HR & Admin review.',
      });
      setLoanForm({ principal: '', tenureMonths: 12, purpose: '' });
      setIsLoanModalOpen(false);
      fetchMyLoans();
    } catch (err) {
      setLoanFeedback({
        ok: false,
        text: err.response?.data?.message || 'Failed to submit loan petition.',
      });
    } finally {
      setLoanSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1300px] mx-auto text-center font-mono text-xs text-[#728294]">
        Synchronizing Employee Portal & Telemetry...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-[800px] mx-auto select-none font-sans">
        <div className="bg-[#FDEEEB] border border-[#F5C2BA] rounded-lg p-6 text-center space-y-3">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-base font-bold text-[#B83E28]">Portal Access Notice</h2>
          <p className="text-xs text-[#5B6B79] font-mono">{error}</p>
          <button
            onClick={() => navigate('/company-admin/overview')}
            className="px-4 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors"
          >
            &larr; Return to Admin Overview
          </button>
        </div>
      </div>
    );
  }

  const { profile, attendance, leaves, payslips, tasks } = dashboardData || {};

  // Normalize leave balances
  const leaveBalances = Array.isArray(leaves?.balances) ? leaves.balances : [];
  const recentLeaveRequests = Array.isArray(leaves?.recentRequests) ? leaves.recentRequests : [];

  // Loan metrics
  const activeLoan = myLoans.find((l) => ['APPROVED', 'APPLIED'].includes(l.status));
  const activePrincipal = parseFloat(activeLoan?.principal?.toString() || 0);
  const activeBalance = parseFloat(activeLoan?.remainingBalance?.toString() || 0);
  const activeEmi = parseFloat(activeLoan?.monthlyEmi?.toString() || 0);
  const activePaid = activePrincipal - activeBalance;
  const repaymentPercent = activePrincipal > 0 ? Math.min(100, Math.round((activePaid / activePrincipal) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto select-none font-sans text-[#16233B] p-6 pb-20">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E3DED4] gap-3">
        <div>
          <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-bold">
            SELF-SERVICE DESK // EMPLOYEE HUB
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#16233B] mt-0.5">
            Welcome, {profile?.name || user?.firstName}
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Capacity: <span className="font-mono font-bold text-[#8C5D17]">{profile?.designation || 'Staff'}</span> • 
            Department: <span className="font-mono font-bold text-[#16233B] ml-1">{profile?.department || 'Unassigned'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs self-start md:self-auto">
          <div className="px-3 py-1.5 bg-white border border-[#E3DED4] rounded shadow-2xs">
            <span className="text-[#728294]">EMP ID:</span> <span className="font-bold text-[#16233B]">{profile?.employeeCode || profile?.employeeId}</span>
          </div>
          <button
            onClick={() => navigate('/company-admin/overview')}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#8C5D17] font-bold rounded cursor-pointer transition-colors"
          >
            Admin View &rarr;
          </button>
        </div>
      </div>

      {/* Global Feedback Banner for Loans */}
      {loanFeedback && (
        <div className={`p-3 rounded text-xs font-mono border ${
          loanFeedback.ok
            ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]'
            : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {loanFeedback.text}
        </div>
      )}

      {/* 2. Top Attendance Strip & Clock Punch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Real-Time Geofenced GPS Punch Station */}
        <div className="lg:col-span-4">
          <AttendancePunchCard onRecordUpdated={fetchDashboard} />
        </div>

        {/* Current Month Attendance Telemetry with Assigned Shift Callout */}
        <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs lg:col-span-8 flex flex-col justify-between min-h-[290px]">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
                ATTENDANCE VELOCITY & ACTIVE SHIFT
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSwapModalOpen(true)}
                  className="text-[10px] font-mono font-bold text-[#8C5D17] hover:text-[#734B12] bg-[#FAF4E8] hover:bg-[#FAF0D9] px-2.5 py-1 border border-[#E3DED4] rounded hover:border-[#8C5D17] transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  ⇄ SELECT & SWAP SHIFT
                </button>
                <span className="text-[10px] font-mono text-[#8C5D17] bg-[#FAF4E8] px-2 py-1 border border-[#E3DED4] rounded">
                  Current Month
                </span>
              </div>
            </div>

            {/* Assigned Shift Strip */}
            <div className="mt-3 p-3 bg-[#FAF8F5] border border-[#E3DED4] rounded-md flex justify-between items-center">
              <div>
                <span className="text-[9.5px] font-mono text-[#728294] uppercase block">
                  YOUR CURRENT SCHEDULED ROSTER
                </span>
                <span className="text-xs font-bold text-[#16233B] mt-0.5 block">
                  {dashboardData?.profile?.currentShift?.name || 'Standard Production Shift'}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-bold text-[#8C5D17]">
                  {dashboardData?.profile?.currentShift?.startTime || '09:00'} &rarr; {dashboardData?.profile?.currentShift?.endTime || '18:00'}
                </span>
                <span className="block text-[9.5px] text-[#728294]">
                  Grace Window: {dashboardData?.profile?.currentShift?.gracePeriod || 15} mins
                </span>
              </div>
            </div>
          </div>

          {/* Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center my-3">
            <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#1E7E34]">{attendance?.presentDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">PRESENT</div>
            </div>
            <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#B83E28]">{attendance?.absentDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">ABSENT</div>
            </div>
            <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#8C5D17]">{attendance?.lateDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">LATE DAYS</div>
            </div>
            <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#16233B]">{attendance?.totalLoggedDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">LOGGED DAYS</div>
            </div>
          </div>

          <div className="text-[11px] text-[#728294] flex justify-between pt-2.5 border-t border-[#F4F1EA]">
            <span>Half Days: <b className="font-mono text-[#16233B]">{attendance?.halfDays ?? 0}</b></span>
            <span className="font-mono text-[10px] text-[#1E7E34]">Telemetry Live Synced ✓</span>
          </div>
        </div>

      </div>

      {/* 3. Leave Balances (Annual Quota) & Operational Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Leave Balances Quota & Apply Leave */}
        <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
                ANNUAL QUOTA // LEAVE OPERATIONS
              </span>
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="text-[10px] font-mono font-bold text-white bg-[#8C5D17] hover:bg-[#784F14] px-3 py-1 rounded transition-all cursor-pointer shadow-xs flex items-center gap-1"
              >
                + APPLY FOR LEAVE
              </button>
            </div>
            <h3 className="text-sm font-bold text-[#16233B] mt-1">Available Leave Entitlements</h3>

            {/* Leave Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
              {leaveBalances.length === 0 ? (
                <>
                  <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
                    <div className="text-[10px] font-mono uppercase text-[#728294] truncate">Annual Leave</div>
                    <div className="text-lg font-bold font-mono text-[#8C5D17] mt-0.5">
                      -- <span className="text-[9px] text-[#728294] font-normal">days</span>
                    </div>
                    <div className="text-[9px] text-[#8C9BAE] font-mono mt-0.5">Policy Active</div>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
                    <div className="text-[10px] font-mono uppercase text-[#728294] truncate">Casual Leave</div>
                    <div className="text-lg font-bold font-mono text-[#8C5D17] mt-0.5">
                      -- <span className="text-[9px] text-[#728294] font-normal">days</span>
                    </div>
                    <div className="text-[9px] text-[#8C9BAE] font-mono mt-0.5">Policy Active</div>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
                    <div className="text-[10px] font-mono uppercase text-[#728294] truncate">Sick Leave</div>
                    <div className="text-lg font-bold font-mono text-[#8C5D17] mt-0.5">
                      -- <span className="text-[9px] text-[#728294] font-normal">days</span>
                    </div>
                    <div className="text-[9px] text-[#8C9BAE] font-mono mt-0.5">Policy Active</div>
                  </div>
                </>
              ) : (
                leaveBalances.map((b, idx) => (
                  <div key={idx} className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded">
                    <div className="text-[10px] font-mono uppercase text-[#728294] truncate">
                      {b.leaveType || 'Annual'}
                    </div>
                    <div className="text-lg font-bold font-mono text-[#8C5D17] mt-0.5">
                      {b.remaining ?? 0} <span className="text-[9px] text-[#728294] font-normal">days</span>
                    </div>
                    <div className="text-[9px] text-[#8C9BAE] font-mono mt-0.5">
                      Used: {b.used ?? 0} / {b.totalAllocated ?? 0}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Applications Mini-List */}
          <div className="mt-4 pt-3 border-t border-[#F4F1EA]">
            <span className="text-[9px] font-mono uppercase text-[#728294] font-bold block mb-1.5">
              Recent Leave Applications
            </span>
            {recentLeaveRequests.length === 0 ? (
              <p className="text-[11px] font-mono text-[#728294] py-1">
                No leave requests filed recently.
              </p>
            ) : (
              <div className="space-y-1.5">
                {recentLeaveRequests.map((req) => (
                  <div key={req._id} className="text-xs p-2 bg-[#FAF8F5] border border-[#EFECE6] rounded flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#16233B]">{req.leaveType}</span>
                      <span className="text-[#728294] ml-2 font-mono text-[10px]">
                        {new Date(req.startDate).toLocaleDateString()} ({req.totalDays}d)
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      req.status === 'APPROVED' ? 'bg-[#EBF7F0] text-[#1E7E34]' :
                      req.status === 'REJECTED' ? 'bg-[#FDEEEB] text-[#B83E28]' :
                      'bg-[#FAF4E8] text-[#8C5D17]'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Active Tasks */}
        <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
                OPERATIONAL ASSIGNMENTS
              </span>
              {tasks?.overdueCount > 0 && (
                <span className="text-[9px] font-mono bg-[#FDEEEB] text-[#B83E28] px-2 py-0.5 rounded border border-[#F5C2BA] font-bold">
                  {tasks.overdueCount} Overdue
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-[#16233B] mt-1">Pending Tasks & Deliverables</h3>

            <div className="space-y-2 mt-3">
              {!tasks?.items || tasks.items.length === 0 ? (
                <div className="py-8 text-center font-mono text-xs text-[#728294]">
                  All assigned operational tasks completed.
                </div>
              ) : (
                tasks.items.map((task) => (
                  <div key={task._id} className="p-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded flex justify-between items-start">
                    <div className="pr-2">
                      <div className="font-bold text-xs text-[#16233B]">{task.title}</div>
                      {task.description && (
                        <div className="text-[11px] text-[#728294] line-clamp-1 mt-0.5">{task.description}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                        task.priority === 'HIGH' ? 'bg-[#FDEEEB] text-[#B83E28]' : 'bg-white border border-[#E3DED4] text-[#728294]'
                      }`}>
                        {task.priority || 'NORMAL'}
                      </span>
                      {task.deadline && (
                        <div className={`text-[9px] font-mono mt-1 ${task.isOverdue ? 'text-[#B83E28] font-bold' : 'text-[#728294]'}`}>
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#728294] pt-3 border-t border-[#F4F1EA]">
            Active Tasks: <b className="text-[#16233B]">{tasks?.activeCount ?? 0}</b>
          </div>
        </div>

      </div>

      {/* 4. Shift Exchange & Peer Roster Desk (Live Colleague Requests) */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs">
        <ShiftSwapDesk key={swapRefreshKey} isManagerView={false} />
      </div>

      {/* 5. Financial Advances & Loans Strip */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#F4F1EA] gap-3">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
              FINANCIAL ADVANCE & DISBURSEMENTS
            </span>
            <h3 className="text-sm font-bold text-[#16233B] mt-0.5">
              Salary Advances & Company Loans
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => navigate('/company-admin/loans')}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#16233B] font-bold rounded cursor-pointer transition-colors"
            >
              Audit Ledger &rarr;
            </button>
            <button
              onClick={() => setIsLoanModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#734B12] text-white font-bold rounded cursor-pointer transition-colors shadow-2xs"
            >
              + APPLY ADVANCE
            </button>
          </div>
        </div>

        {activeLoan ? (
          <div className="mt-4 p-4 bg-[#FAF8F5] border border-[#EFECE6] rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold font-mono text-[#16233B]">
                    {activePrincipal.toLocaleString()} PKR
                  </span>
                  <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    activeLoan.status === 'APPROVED' ? 'bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]' :
                    'bg-[#FAF4E8] text-[#8C5D17] border border-[#E8D4B5]'
                  }`}>
                    {activeLoan.status}
                  </span>
                </div>
                <div className="text-xs text-[#5B6B79] mt-0.5 font-sans">
                  Purpose: <b className="text-[#16233B]">{activeLoan.purpose || 'Personal Support'}</b>
                </div>
              </div>

              <div className="font-mono text-xs sm:text-right">
                <span className="text-[#728294] block text-[9.5px]">PAYROLL RECOVERY EMI:</span>
                <span className="font-bold text-[#8C5D17] text-sm">
                  {activeEmi.toLocaleString()} PKR / mo
                </span>
              </div>
            </div>

            {activeLoan.status === 'APPROVED' && (
              <div className="pt-2 border-t border-[#E3DED4]/60">
                <div className="flex justify-between text-[10.5px] font-mono text-[#728294] mb-1">
                  <span>Paid Off: <b>{activePaid.toLocaleString()} PKR</b> ({repaymentPercent}%)</span>
                  <span>Balance Due: <b className="text-[#16233B]">{activeBalance.toLocaleString()} PKR</b></span>
                </div>
                <div className="w-full h-2.5 bg-[#E3DED4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1E7E34] rounded-full transition-all duration-500"
                    style={{ width: `${repaymentPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center font-mono text-xs text-[#728294]">
            No active loan balance or pending application. You are eligible to apply for an advance.
          </div>
        )}
      </div>

      {/* 6. Latest Payslips Drawer */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
          COMPENSATION ARCHIVE
        </span>
        <h3 className="text-sm font-bold text-[#16233B] mt-1">Recent Payslips & Disbursements</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {!payslips || payslips.length === 0 ? (
            <div className="col-span-full py-4 text-center font-mono text-xs text-[#728294]">
              No finalized payslips available for the recent pay cycles.
            </div>
          ) : (
            payslips.map((slip) => (
              <div key={slip._id} className="p-3 bg-[#FAF8F5] border border-[#EFECE6] rounded flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-[#16233B]">
                    {new Date(0, slip.payPeriodMonth - 1).toLocaleString('en-US', { month: 'short' })} {slip.payPeriodYear}
                  </div>
                  <div className="text-[10px] font-mono text-[#728294] mt-0.5">
                    Net: <b className="text-[#16233B]">{slip.netPay?.toLocaleString()} PKR</b>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded font-bold bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]">
                  {slip.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 7. Modals Integration */}
      <ApplyLeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={fetchDashboard}
      />

      {/* Shift Swap Proposal Modal */}
      <ProposeShiftSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        onSwapProposed={() => {
          setSwapRefreshKey((prev) => prev + 1);
        }}
      />

      {/* Loan Application Modal */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-6 max-w-md w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#16233B]">Apply for Salary Advance / Loan</h3>
            <p className="text-xs text-[#728294] mt-1 font-mono">
              Auto-repaid via payroll installments across selected tenure months.
            </p>

            <form onSubmit={handleApplyLoan} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Requested Principal (PKR)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="500"
                  value={loanForm.principal}
                  onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })}
                  placeholder="e.g. 100000"
                  className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Tenure (Months)
                </label>
                <select
                  value={loanForm.tenureMonths}
                  onChange={(e) => setLoanForm({ ...loanForm, tenureMonths: e.target.value })}
                  className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                >
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={24}>24 Months (2 Years)</option>
                </select>
              </div>

              {loanForm.principal && (
                <div className="p-3 bg-[#FAF8F5] border border-[#E3DED4] rounded text-xs font-mono">
                  <span className="text-[#728294] block text-[9.5px]">ESTIMATED MONTHLY DEDUCTION:</span>
                  <span className="text-base font-bold text-[#8C5D17]">
                    {(parseFloat(loanForm.principal) / parseInt(loanForm.tenureMonths, 10)).toFixed(2)}{' '}
                    PKR / Month
                  </span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Purpose / Need
                </label>
                <textarea
                  rows="2"
                  required
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  placeholder="State the reason for financial assistance..."
                  className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 font-mono">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-3 py-2 border border-[#D8D3C7] rounded text-[#728294] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loanSubmitting}
                  className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {loanSubmitting ? 'Submitting...' : 'Dispatch Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}