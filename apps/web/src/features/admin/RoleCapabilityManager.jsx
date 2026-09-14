import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { PERMISSIONS } from '../../config/permissions.js';

// Standard Enterprise Permission Catalog matching Backend Middlewares & Permissions Config
const PERMISSION_CATALOG = [
  {
    category: 'Attendance & Floor Supervision',
    permissions: [
      { key: PERMISSIONS.ATTENDANCE.READ || 'attendance.read', label: 'View Company Attendance Ledger' },
      { key: PERMISSIONS.ATTENDANCE.VIEW_TEAM || 'attendance.view_team', label: 'Shift Incharge Live Floor Telemetry' },
      { key: PERMISSIONS.ATTENDANCE.RECORD || 'attendance.record', label: 'Self Punch-in & Out Capability' },
      { key: PERMISSIONS.ATTENDANCE.UPDATE || 'attendance.update', label: 'Manual Punch Correction & Override' },
    ],
  },
  {
    category: 'Leave Governance & Approvals',
    permissions: [
      { key: PERMISSIONS.LEAVE.READ || 'leave.read', label: 'Audit Company-wide Leave Ledger' },
      { key: PERMISSIONS.LEAVE.VIEW_TEAM || 'leave.view_team', label: 'View Direct Team Submissions' },
      { key: PERMISSIONS.LEAVE.APPROVE_MANAGER || 'leave.approve_manager', label: 'Stage 1: Line Manager Approval' },
      { key: PERMISSIONS.LEAVE.APPROVE_HR || 'leave.approve_hr', label: 'Stage 2: HR Final Clearance & Quota Deduct' },
      { key: PERMISSIONS.LEAVE.APPLY || 'leave.apply', label: 'Apply for Leave on Behalf of Staff' },
    ],
  },
  {
    category: 'Payroll & Financial Engine',
    permissions: [
      { key: PERMISSIONS.PAYROLL.READ || 'payroll.read', label: 'View Monthly Compensation Summary' },
      { key: PERMISSIONS.PAYROLL.CREATE || 'payroll.create', label: 'Initialize Monthly Payroll Run' },
      { key: PERMISSIONS.PAYROLL.RUN || 'payroll.run', label: 'Execute Salary Calculation Orchestrator' },
      { key: PERMISSIONS.PAYROLL.APPROVE || 'payroll.approve', label: 'Approve & Lock Disbursement Run' },
      { key: PERMISSIONS.PAYROLL.VIEW_PAYSLIPS || 'payroll.view_payslips', label: 'Inspect Employee Salary Vouchers' },
    ],
  },
  {
    category: 'Workforce Directory & Onboarding',
    permissions: [
      { key: PERMISSIONS.EMPLOYEE.READ || 'employee.read', label: 'Browse Workforce Directory' },
      { key: PERMISSIONS.EMPLOYEE.CREATE || 'employee.create', label: 'Onboard Staff & Provision Auth Account' },
      { key: PERMISSIONS.EMPLOYEE.UPDATE || 'employee.update', label: 'Modify Job Profile, Salary & Ranks' },
      { key: PERMISSIONS.EMPLOYEE.DELETE || 'employee.delete', label: 'Offboard / Deactivate Employee' },
    ],
  },
  {
    category: 'Tenant Governance & Rostering',
    permissions: [
      { key: PERMISSIONS.COMPANY.READ || 'company.read', label: 'View Departments & Shift Templates' },
      { key: PERMISSIONS.COMPANY.CONFIGURE || 'company.configure', label: 'Manage Units, Shifts & Roster Policies' },
    ],
  },
];

export default function RoleCapabilityManager() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [reason, setReason] = useState('Delegated operational authority by Company Admin');
  const [activePermissions, setActivePermissions] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // 1. Fetch Employees and existing overrides
  const loadData = async () => {
    try {
      setLoading(true);
      const [empRes, overridesRes] = await Promise.allSettled([
        apiClient.get('/employees?limit=200'),
        apiClient.get('/roles/overrides'),
      ]);

      // Normalize Employees
      let empList = [];
      if (empRes.status === 'fulfilled') {
        const raw = empRes.value.data;
        if (Array.isArray(raw)) empList = raw;
        else if (Array.isArray(raw?.data)) empList = raw.data;
        else if (Array.isArray(raw?.data?.employees)) empList = raw.data.employees;
        else if (Array.isArray(raw?.employees)) empList = raw.employees;
      }

      // Normalize Overrides
      let overrideList = [];
      if (overridesRes.status === 'fulfilled') {
        const raw = overridesRes.value.data;
        if (Array.isArray(raw)) overrideList = raw;
        else if (Array.isArray(raw?.data)) overrideList = raw.data;
        else if (Array.isArray(raw?.data?.overrides)) overrideList = raw.data.overrides;
        else if (Array.isArray(raw?.overrides)) overrideList = raw.overrides;
      }

      // Merge safely
      const merged = (empList || []).map((emp) => {
        const ov = (overrideList || []).find(
          (o) => (o.employeeId?._id || o.employeeId) === emp._id
        );
        return {
          ...emp,
          override: ov || null,
        };
      });

      setEmployees(merged);
      if (merged.length > 0 && !selectedEmployee) {
        selectUser(merged[0]);
      } else if (selectedEmployee) {
        const refreshed = merged.find((e) => e._id === selectedEmployee._id);
        if (refreshed) selectUser(refreshed);
      }
    } catch (err) {
      console.error('Data load exception:', err);
      setFeedback({ type: 'error', text: 'Failed to load employee directory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When an employee is selected
  const selectUser = (emp) => {
    setSelectedEmployee(emp);
    setJobTitle(emp.jobTitle || emp.designation || '');
    setReason(emp.override?.reason || 'Delegated operational authority by Company Admin');

    // Load active granted permissions
    const currentPerms = new Set(emp.override?.grantedPermissions || []);
    setActivePermissions(currentPerms);
  };

  // Toggle individual permission checkbox
  const handleTogglePermission = (permKey) => {
    const updated = new Set(activePermissions);
    if (updated.has(permKey)) {
      updated.delete(permKey);
    } else {
      updated.add(permKey);
    }
    setActivePermissions(updated);
  };

  // Quick Select Group Action
  const handleToggleGroup = (groupPermissions) => {
    const allKeys = groupPermissions.map((p) => p.key);
    const hasAll = allKeys.every((k) => activePermissions.has(k));

    const updated = new Set(activePermissions);
    if (hasAll) {
      allKeys.forEach((k) => updated.delete(k));
    } else {
      allKeys.forEach((k) => updated.add(k));
    }
    setActivePermissions(updated);
  };

  // Save changes to backend
  const handleSaveOverrides = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      setFeedback({ type: '', text: '' });

      const payload = {
        grantedPermissions: Array.from(activePermissions),
        removedPermissions: [],
        jobTitle: jobTitle.trim(),
        reason: reason.trim(),
      };

      // Backend route: PUT /api/v1/roles/overrides/:employeeId
      await apiClient.put(`/roles/overrides/${selectedEmployee._id}`, payload);

      setFeedback({
        type: 'success',
        text: `Successfully saved capability powers for ${selectedEmployee.firstName} ${selectedEmployee.lastName}.`,
      });

      loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save role capabilities.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtered employee list
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.firstName?.toLowerCase().includes(q) ||
        e.lastName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      
      {/* Notifications */}
      {feedback.text && (
        <div
          className={`p-3 rounded text-xs font-mono flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34]'
              : 'bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28]'
          }`}
        >
          <span>{feedback.type === 'success' ? '✓' : '⚠️'} {feedback.text}</span>
          <button onClick={() => setFeedback({ type: '', text: '' })} className="cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* Screen Header */}
      <div>
        <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
          TENANT GOVERNANCE // DELEGATION ENGINE
        </span>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
          Employee Roles & Custom Capability Powers
        </h1>
        <p className="text-xs text-[#5B6B79] mt-0.5 max-w-2xl">
          Delegate granular authorities to Supervisors, Shift Incharges, HR Specialists, or Department Leads without altering root user roles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Employee Selector List */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-[#E3DED4] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#F4F1EA]">
            <h2 className="text-xs font-bold text-[#16233B] uppercase tracking-wider font-mono">
              STAFF DIRECTORY ({filteredEmployees.length})
            </h2>
          </div>

          <input
            type="text"
            placeholder="Search by name, email, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
          />

          <div className="divide-y divide-[#F4F1EA] max-h-[580px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-xs font-mono text-[#728294]">
                Loading staff directory...
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-[#728294]">
                No personnel found matching search.
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedEmployee?._id === emp._id;
                const activeCount = emp.override?.grantedPermissions?.length || 0;

                return (
                  <div
                    key={emp._id}
                    onClick={() => selectUser(emp)}
                    className={`p-3 rounded cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#FAF4E8] border-l-4 border-[#8C5D17]'
                        : 'hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#16233B]">
                        {emp.firstName} {emp.lastName}
                      </span>
                      {activeCount > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] rounded font-bold">
                          {activeCount} Powers
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#728294]">{emp.email}</div>
                    <div className="text-[10px] font-mono text-[#8C5D17] mt-1 flex justify-between">
                      <span>{emp.jobTitle || emp.designation || 'Staff Member'}</span>
                      <span className="text-[#728294]">{emp.employeeCode || ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Permission Catalog & Title Customization */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-[#E3DED4] p-6 shadow-xs space-y-6">
          {selectedEmployee ? (
            <>
              {/* Selected User Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#F4F1EA] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#16233B]">
                      Configuring Powers: {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#728294] uppercase font-semibold">
                      Base: {selectedEmployee.role || 'EMPLOYEE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#728294] mt-0.5">
                    Granted capabilities immediately override base role restrictions across UI and backend APIs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#8C5D17] bg-[#FAF4E8] px-2.5 py-1.5 rounded border border-[#E3DED4]">
                    {activePermissions.size} Granted
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveOverrides}
                    disabled={saving}
                    className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded shadow-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'SAVING POWERS...' : 'SAVE CAPABILITIES'}
                  </button>
                </div>
              </div>

              {/* Title & Reason Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#FAF8F5] rounded border border-[#E3DED4]">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                    CUSTOM DESIGNATION / BADGE TITLE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shift Incharge / Senior HR Lead"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
                  />
                  <span className="text-[9.5px] text-[#728294] block">
                    Displays on telemetry desks, floor rosters, and letterheads.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                    DELEGATION JUSTIFICATION
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17]"
                  />
                  <span className="text-[9.5px] text-[#728294] block">
                    Logged in internal audit trail for governance compliance.
                  </span>
                </div>
              </div>

              {/* Capabilities Checklist Catalog */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#728294]">
                    POWER & PERMISSIONS CATALOG
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActivePermissions(new Set())}
                    className="text-[10px] font-mono text-[#B83E28] hover:underline cursor-pointer"
                  >
                    Clear All Granted
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_CATALOG.map((group) => {
                    const allKeys = group.permissions.map((p) => p.key);
                    const selectedCount = allKeys.filter((k) => activePermissions.has(k)).length;
                    const isAllSelected = selectedCount === allKeys.length;

                    return (
                      <div key={group.category} className="p-4 rounded border border-[#EFECE6] bg-[#FAF8F5] space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-[#E3DED4]">
                          <span className="text-xs font-bold text-[#16233B]">
                            {group.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(group.permissions)}
                            className="text-[9.5px] font-mono text-[#8C5D17] hover:underline cursor-pointer"
                          >
                            {isAllSelected ? 'Deselect All' : 'Select All'} ({selectedCount}/{allKeys.length})
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {group.permissions.map((perm) => {
                            const isChecked = activePermissions.has(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className="flex items-start gap-2.5 text-xs text-[#16233B] cursor-pointer hover:text-[#8C5D17]"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.key)}
                                  className="mt-0.5 accent-[#8C5D17] cursor-pointer"
                                />
                                <div className="leading-tight">
                                  <span className="block font-medium">{perm.label}</span>
                                  <span className="block text-[9.5px] font-mono text-[#728294]">{perm.key}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-[#728294] font-mono">
              Please select an employee from the staff directory on the left to configure custom capabilities.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}