import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ApplyLeaveModal from '../leave/ApplyLeaveModal.jsx';
import AttendancePunchCard from '../attendance/AttendancePunchCard.jsx';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const fetchDashboard = async () => {
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
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

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

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto select-none font-sans text-[#16233B] p-6 pb-16">
      
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

      {/* 2. Top Attendance Strip & Clock Punch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Real-Time Geofenced GPS Punch Station */}
        <div className="lg:col-span-4">
          <AttendancePunchCard onRecordUpdated={fetchDashboard} />
        </div>

        {/* Current Month Attendance Telemetry */}
        <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs lg:col-span-8 flex flex-col justify-between min-h-[290px]">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
                ATTENDANCE VELOCITY
              </span>
              <span className="text-[10px] font-mono text-[#8C5D17] bg-[#FAF4E8] px-2 py-0.5 border border-[#E3DED4] rounded">
                Current Month
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#16233B] mt-1">Monthly Shift Summary</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center my-4">
            <div className="p-3 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#1E7E34]">{attendance?.presentDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">PRESENT</div>
            </div>
            <div className="p-3 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#B83E28]">{attendance?.absentDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">ABSENT</div>
            </div>
            <div className="p-3 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#8C5D17]">{attendance?.lateDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">LATE DAYS</div>
            </div>
            <div className="p-3 bg-[#FAF8F5] border border-[#EFECE6] rounded">
              <div className="text-xl font-bold font-mono text-[#16233B]">{attendance?.totalLoggedDays ?? 0}</div>
              <div className="text-[9px] font-mono text-[#728294] mt-0.5">LOGGED DAYS</div>
            </div>
          </div>

          <div className="text-[11px] text-[#728294] flex justify-between pt-3 border-t border-[#F4F1EA]">
            <span>Half Days: <b className="font-mono text-[#16233B]">{attendance?.halfDays ?? 0}</b></span>
            <span className="font-mono text-[10px] text-[#1E7E34]">Telemetry Live Synced ✓</span>
          </div>
        </div>

      </div>

      {/* 3. Leave Balances & Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Leave Balances Quota */}
        <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
                ANNUAL QUOTA
              </span>
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="text-[10px] font-mono font-bold text-[#8C5D17] hover:text-[#734B12] bg-[#FAF4E8] px-2 py-0.5 border border-[#E3DED4] rounded hover:border-[#8C5D17] transition-all cursor-pointer"
              >
                + APPLY FOR LEAVE
              </button>
            </div>
            <h3 className="text-sm font-bold text-[#16233B] mt-1">Available Leave Entitlements</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
              {leaves?.balances?.length === 0 ? (
                <div className="col-span-full py-4 text-center font-mono text-xs text-[#728294]">
                  No leave quotas allocated for this fiscal year.
                </div>
              ) : (
                leaves?.balances?.map((b, idx) => (
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

          {leaves?.recentRequests?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#F4F1EA]">
              <span className="text-[9px] font-mono uppercase text-[#728294] font-bold block mb-1.5">
                Recent Leave Applications
              </span>
              <div className="space-y-1.5">
                {leaves.recentRequests.map((req) => (
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
            </div>
          )}
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
              {tasks?.items?.length === 0 ? (
                <div className="py-8 text-center font-mono text-xs text-[#728294]">
                  All assigned operational tasks completed.
                </div>
              ) : (
                tasks?.items?.map((task) => (
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

      {/* 4. Latest Payslips Drawer */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
          COMPENSATION ARCHIVE
        </span>
        <h3 className="text-sm font-bold text-[#16233B] mt-1">Recent Payslips & Disbursements</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {payslips?.length === 0 ? (
            <div className="col-span-full py-4 text-center font-mono text-xs text-[#728294]">
              No finalized payslips available for the recent pay cycles.
            </div>
          ) : (
            payslips?.map((slip) => (
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

      {/* 5. Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={fetchDashboard}
      />

    </div>
  );
}