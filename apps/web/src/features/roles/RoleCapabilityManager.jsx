import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { PERMISSIONS } from '../../config/permissions.js';

// Base role default permission reference matrix
const BASE_ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  COMPANY_ADMIN: ['*'],
  HR: [
    'attendance.read',
    'leave.read',
    'leave.approve_hr',
    'payroll.read',
    'payroll.create',
    'payroll.run',
    'payroll.view_payslips',
    'employee.read',
    'employee.create',
    'employee.update',
    'company.read',
  ],
  MANAGER: [
    'attendance.view_team',
    'leave.view_team',
    'leave.approve_manager',
    'employee.read',
    'company.read',
  ],
  EMPLOYEE: [
    'attendance.record',
  ],
};

const PERMISSION_CATALOG = [
  {
    category: 'Attendance & Floor Supervision',
    permissions: [
      { key: PERMISSIONS.ATTENDANCE?.READ || 'attendance.read', label: 'View Company Attendance Ledger' },
      { key: PERMISSIONS.ATTENDANCE?.VIEW_TEAM || 'attendance.view_team', label: 'Shift Incharge Live Floor Telemetry' },
      { key: PERMISSIONS.ATTENDANCE?.RECORD || 'attendance.record', label: 'Self Punch-in & Out Capability' },
      { key: PERMISSIONS.ATTENDANCE?.UPDATE || 'attendance.update', label: 'Manual Punch Correction & Override' },
    ],
  },
  {
    category: 'Leave Governance & Approvals',
    permissions: [
      { key: PERMISSIONS.LEAVE?.READ || 'leave.read', label: 'Audit Company-wide Leave Ledger' },
      { key: PERMISSIONS.LEAVE?.VIEW_TEAM || 'leave.view_team', label: 'View Direct Team Submissions' },
      { key: PERMISSIONS.LEAVE?.APPROVE_MANAGER || 'leave.approve_manager', label: 'Stage 1: Line Manager Approval' },
      { key: PERMISSIONS.LEAVE?.APPROVE_HR || 'leave.approve_hr', label: 'Stage 2: HR Final Clearance & Quota Deduct' },
      { key: PERMISSIONS.LEAVE?.APPLY || 'leave.apply', label: 'Apply for Leave on Behalf of Staff' },
    ],
  },
  {
    category: 'Payroll & Financial Engine',
    permissions: [
      { key: PERMISSIONS.PAYROLL?.READ || 'payroll.read', label: 'View Monthly Compensation Summary' },
      { key: PERMISSIONS.PAYROLL?.CREATE || 'payroll.create', label: 'Initialize Monthly Payroll Run' },
      { key: PERMISSIONS.PAYROLL?.RUN || 'payroll.run', label: 'Execute Salary Calculation Orchestrator' },
      { key: PERMISSIONS.PAYROLL?.APPROVE || 'payroll.approve', label: 'Approve & Lock Disbursement Run' },
      { key: PERMISSIONS.PAYROLL?.VIEW_PAYSLIPS || 'payroll.view_payslips', label: 'Inspect Employee Salary Vouchers' },
    ],
  },
  {
    category: 'Workforce Directory & Onboarding',
    permissions: [
      { key: PERMISSIONS.EMPLOYEE?.READ || 'employee.read', label: 'Browse Workforce Directory' },
      { key: PERMISSIONS.EMPLOYEE?.CREATE || 'employee.create', label: 'Onboard Staff & Provision Auth Account' },
      { key: PERMISSIONS.EMPLOYEE?.UPDATE || 'employee.update', label: 'Modify Job Profile, Salary & Ranks' },
      { key: PERMISSIONS.EMPLOYEE?.DELETE || 'employee.delete', label: 'Offboard / Deactivate Employee' },
    ],
  },
  {
    category: 'Tenant Governance & Rostering',
    permissions: [
      { key: PERMISSIONS.COMPANY?.READ || 'company.read', label: 'View Departments & Shift Templates' },
      { key: PERMISSIONS.COMPANY?.CONFIGURE || 'company.configure', label: 'Manage Units, Shifts & Roster Policies' },
    ],
  },
];

export default function RoleCapabilityManager() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [reason, setReason] = useState('Delegated operational authority by Company Admin');

  // Override States
  const [grantedPermissions, setGrantedPermissions] = useState(new Set());
  const [removedPermissions, setRemovedPermissions] = useState(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // 1. Fetch Employees and existing overrides using exact route: /role-overrides
  const loadData = async (preserveSelectedId = null) => {
    try {
      setLoading(true);
      const [empRes, overridesRes] = await Promise.allSettled([
        apiClient.get('/employees?limit=200'),
        apiClient.get('/role-overrides'),
      ]);

      let empList = [];
      if (empRes.status === 'fulfilled') {
        const raw = empRes.value.data;
        if (Array.isArray(raw)) empList = raw;
        else if (Array.isArray(raw?.data)) empList = raw.data;
        else if (Array.isArray(raw?.data?.employees)) empList = raw.data.employees;
        else if (Array.isArray(raw?.employees)) empList = raw.employees;
      }

      let overrideList = [];
      if (overridesRes.status === 'fulfilled') {
        const raw = overridesRes.value.data;
        if (Array.isArray(raw)) overrideList = raw;
        else if (Array.isArray(raw?.data)) overrideList = raw.data;
        else if (Array.isArray(raw?.data?.overrides)) overrideList = raw.data.overrides;
        else if (Array.isArray(raw?.overrides)) overrideList = raw.overrides;
      }

      const merged = (empList || []).map((emp) => {
        const ov = (overrideList || []).find((o) => {
          const overrideEmpId = o.employeeId?._id || o.employeeId;
          return overrideEmpId?.toString() === emp._id?.toString();
        });
        return {
          ...emp,
          override: ov || null,
        };
      });

      setEmployees(merged);

      const targetId = preserveSelectedId || selectedEmployee?._id;
      if (targetId) {
        const found = merged.find((e) => e._id?.toString() === targetId?.toString());
        if (found) selectUser(found);
      } else if (merged.length > 0) {
        selectUser(merged[0]);
      }
    } catch (err) {
      console.error('Data load exception:', err);
      setFeedback({ type: 'error', text: 'Failed to load employee capability directory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When an employee is selected from directory
  const selectUser = (emp) => {
    setSelectedEmployee(emp);
    setJobTitle(emp.jobTitle || emp.override?.jobTitle || emp.designation || '');
    setReason(emp.override?.reason || 'Delegated operational authority by Company Admin');

    setGrantedPermissions(new Set(emp.override?.grantedPermissions || []));
    setRemovedPermissions(new Set(emp.override?.removedPermissions || []));
  };

  // Base role permission check
  const isBaseInherited = (permKey) => {
    if (!selectedEmployee) return false;
    const role = (selectedEmployee.role || selectedEmployee.userId?.role || 'EMPLOYEE').toUpperCase();
    const rolePerms = BASE_ROLE_PERMISSIONS[role] || [];
    return rolePerms.includes('*') || rolePerms.includes(permKey);
  };

  // Check effective active state
  const isPermissionActive = (permKey) => {
    if (removedPermissions.has(permKey)) return false;
    if (grantedPermissions.has(permKey)) return true;
    return isBaseInherited(permKey);
  };

  // Toggle permission
  const handleTogglePermission = (permKey) => {
    const baseHasIt = isBaseInherited(permKey);
    const newGranted = new Set(grantedPermissions);
    const newRemoved = new Set(removedPermissions);

    if (baseHasIt) {
      if (newRemoved.has(permKey)) {
        newRemoved.delete(permKey); // restore base
      } else {
        newRemoved.add(permKey); // revoke base
      }
    } else {
      if (newGranted.has(permKey)) {
        newGranted.delete(permKey);
      } else {
        newGranted.add(permKey);
      }
    }

    setGrantedPermissions(newGranted);
    setRemovedPermissions(newRemoved);
  };

  // Toggle whole category group
  const handleToggleGroup = (groupPermissions) => {
    const allKeys = groupPermissions.map((p) => p.key);
    const allCurrentlyActive = allKeys.every((k) => isPermissionActive(k));

    const newGranted = new Set(grantedPermissions);
    const newRemoved = new Set(removedPermissions);

    allKeys.forEach((key) => {
      const baseHasIt = isBaseInherited(key);
      if (allCurrentlyActive) {
        if (baseHasIt) newRemoved.add(key);
        newGranted.delete(key);
      } else {
        if (baseHasIt) newRemoved.delete(key);
        else newGranted.add(key);
      }
    });

    setGrantedPermissions(newGranted);
    setRemovedPermissions(newRemoved);
  };

  // 2. Save Capabilities to /api/v1/role-overrides/:id with instant state sync
  const handleSaveOverrides = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      setFeedback({ type: '', text: '' });

      const grantedArray = Array.from(grantedPermissions);
      const removedArray = Array.from(removedPermissions);
      const trimmedTitle = jobTitle.trim();
      const trimmedReason = reason.trim();

      const payload = {
        grantedPermissions: grantedArray,
        removedPermissions: removedArray,
        jobTitle: trimmedTitle,
        reason: trimmedReason,
      };

      // Exact backend route: PUT /api/v1/role-overrides/:employeeId
      const res = await apiClient.put(`/role-overrides/${selectedEmployee._id}`, payload);
      const savedOverride = res.data?.data || payload;

      // Update local state instantly so the directory list & current view reflect immediately
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp._id === selectedEmployee._id) {
            return {
              ...emp,
              jobTitle: trimmedTitle || emp.jobTitle || emp.designation,
              designation: trimmedTitle || emp.designation,
              override: {
                ...emp.override,
                ...savedOverride,
                grantedPermissions: grantedArray,
                removedPermissions: removedArray,
                jobTitle: trimmedTitle,
                reason: trimmedReason,
              },
            };
          }
          return emp;
        })
      );

      setSelectedEmployee((prev) => ({
        ...prev,
        jobTitle: trimmedTitle || prev.jobTitle || prev.designation,
        override: {
          ...prev?.override,
          ...savedOverride,
          grantedPermissions: grantedArray,
          removedPermissions: removedArray,
          jobTitle: trimmedTitle,
          reason: trimmedReason,
        },
      }));

      setFeedback({
        type: 'success',
        text: `Powers saved successfully for ${selectedEmployee.firstName} ${selectedEmployee.lastName}! (${grantedArray.length} Granted, ${removedArray.length} Revoked)`,
      });

      // Background re-fetch to ensure database synchronization
      loadData(selectedEmployee._id);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save role capabilities.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default base role permissions (DELETE /api/v1/role-overrides/:id)
  const handleResetDefaults = async () => {
    if (!selectedEmployee) return;
    if (!window.confirm(`Reset all custom capabilities for ${selectedEmployee.firstName}? Base role defaults will be restored.`)) {
      return;
    }

    try {
      setSaving(true);
      await apiClient.delete(`/role-overrides/${selectedEmployee._id}`);

      setGrantedPermissions(new Set());
      setRemovedPermissions(new Set());

      setFeedback({
        type: 'success',
        text: `Custom capabilities removed. ${selectedEmployee.firstName} restored to default role permissions.`,
      });

      loadData(selectedEmployee._id);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reset capabilities.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Search filter
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.firstName?.toLowerCase().includes(q) ||
        e.lastName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.jobTitle?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      {/* Feedback Banner */}
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
          Inspect inherited base role powers, grant custom capabilities, or revoke permissions dynamically per employee.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Staff Directory */}
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
                const isSelected = selectedEmployee?._id?.toString() === emp._id?.toString();
                const grantedCount = emp.override?.grantedPermissions?.length || 0;
                const revokedCount = emp.override?.removedPermissions?.length || 0;

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
                      <div className="flex items-center gap-1">
                        {grantedCount > 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] rounded font-bold">
                            +{grantedCount} Powers
                          </span>
                        )}
                        {revokedCount > 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#FDEEEB] text-[#B83E28] border border-[#F5C2BA] rounded font-bold">
                            -{revokedCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#728294] truncate">{emp.email}</div>
                    <div className="text-[10px] font-mono text-[#8C5D17] mt-1 flex justify-between">
                      <span className="truncate">{emp.jobTitle || emp.override?.jobTitle || emp.designation || 'Staff'}</span>
                      <span className="text-[#728294] shrink-0">{emp.role || 'EMPLOYEE'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Permission Matrix */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-[#E3DED4] p-6 shadow-xs space-y-6">
          {selectedEmployee ? (
            <>
              {/* Selected User Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#F4F1EA] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#16233B]">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#728294] uppercase font-semibold">
                      Base Role: {selectedEmployee.role || selectedEmployee.userId?.role || 'EMPLOYEE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono">
                    <span className="text-[#16233B]">
                      Active Powers: <b>{PERMISSION_CATALOG.flatMap((g) => g.permissions).filter((p) => isPermissionActive(p.key)).length}</b>
                    </span>
                    <span className="text-[#1E7E34]">
                      Extra Granted: <b>+{grantedPermissions.size}</b>
                    </span>
                    <span className="text-[#B83E28]">
                      Revoked: <b>-{removedPermissions.size}</b>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(grantedPermissions.size > 0 || removedPermissions.size > 0) && (
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      disabled={saving}
                      className="px-3 py-2 border border-[#D8D3C7] hover:bg-[#FAF8F5] text-[#728294] text-xs font-mono rounded cursor-pointer transition-colors"
                    >
                      Reset Defaults
                    </button>
                  )}
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
                    placeholder="e.g. Shift Incharge / Senior Floor Lead"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
                  />
                  <span className="text-[9.5px] text-[#728294] block">
                    Displays on floor rosters and telemetry monitoring desks.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                    DELEGATION REASON / AUDIT NOTE
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17]"
                  />
                  <span className="text-[9.5px] text-[#728294] block">
                    Saved in internal audit ledger for compliance records.
                  </span>
                </div>
              </div>

              {/* Capabilities Checklist Catalog */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#728294]">
                    POWER & PERMISSIONS MATRIX
                  </h3>
                  <div className="flex items-center gap-4 text-[10.5px] font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#728294]"></span> Base Role
                    </span>
                    <span className="flex items-center gap-1.5 text-[#1E7E34]">
                      <span className="w-2 h-2 rounded-full bg-[#1E7E34]"></span> Custom Added
                    </span>
                    <span className="flex items-center gap-1.5 text-[#B83E28]">
                      <span className="w-2 h-2 rounded-full bg-[#B83E28]"></span> Revoked
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_CATALOG.map((group) => {
                    const allKeys = group.permissions.map((p) => p.key);
                    const activeCount = allKeys.filter((k) => isPermissionActive(k)).length;
                    const isAllSelected = activeCount === allKeys.length;

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
                            {isAllSelected ? 'Deselect All' : 'Select All'} ({activeCount}/{allKeys.length})
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {group.permissions.map((perm) => {
                            const isChecked = isPermissionActive(perm.key);
                            const baseHasIt = isBaseInherited(perm.key);
                            const isCustomGranted = grantedPermissions.has(perm.key);
                            const isRevoked = removedPermissions.has(perm.key);

                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2.5 p-2 rounded border transition-colors cursor-pointer ${
                                  isChecked
                                    ? isCustomGranted
                                      ? 'bg-[#EBF7F0]/60 border-[#C6EAD3]'
                                      : 'bg-white border-[#E3DED4]'
                                    : isRevoked
                                    ? 'bg-[#FDEEEB]/40 border-[#F5C2BA]'
                                    : 'bg-transparent border-transparent opacity-60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.key)}
                                  className="mt-0.5 accent-[#8C5D17] cursor-pointer"
                                />
                                <div className="leading-tight flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-xs text-[#16233B]">
                                      {perm.label}
                                    </span>

                                    {/* Permission Status Pill */}
                                    {isRevoked ? (
                                      <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#FDEEEB] text-[#B83E28] font-bold">
                                        REVOKED
                                      </span>
                                    ) : isCustomGranted ? (
                                      <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#EBF7F0] text-[#1E7E34] font-bold">
                                        +GRANTED
                                      </span>
                                    ) : baseHasIt ? (
                                      <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#728294]">
                                        ROLE
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="block text-[9.5px] font-mono text-[#728294] mt-0.5">
                                    {perm.key}
                                  </span>
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