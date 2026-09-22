import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { PERMISSIONS } from '../../config/permissions.js';

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
  // Navigation View: 'EMPLOYEE_POWERS' | 'CUSTOM_ROLE_TEMPLATES'
  const [activeTab, setActiveTab] = useState('EMPLOYEE_POWERS');

  // Common State
  const [employees, setEmployees] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Individual Overrides State
  const [jobTitle, setJobTitle] = useState('');
  const [reason, setReason] = useState('Delegated operational authority by Company Admin');
  const [assignedCustomRoleId, setAssignedCustomRoleId] = useState('');
  const [grantedPermissions, setGrantedPermissions] = useState(new Set());
  const [removedPermissions, setRemovedPermissions] = useState(new Set());

  // Custom Role Template Builder State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    basedOnSystemRole: 'EMPLOYEE',
    permissions: [],
  });

  // 1. Load Employees, Overrides, and Custom Roles
  const loadData = async (preserveSelectedId = null) => {
    try {
      setLoading(true);
      const [empRes, overridesRes, customRolesRes] = await Promise.allSettled([
        apiClient.get('/employees?limit=200'),
        apiClient.get('/role-overrides'),
        apiClient.get('/custom-roles'),
      ]);

      let empList = [];
      if (empRes.status === 'fulfilled') {
        const raw = empRes.value.data;
        empList = Array.isArray(raw) ? raw : raw?.data?.employees || raw?.data || raw?.employees || [];
      }

      let overrideList = [];
      if (overridesRes.status === 'fulfilled') {
        const raw = overridesRes.value.data;
        overrideList = Array.isArray(raw) ? raw : raw?.data?.overrides || raw?.data || raw?.overrides || [];
      }

      if (customRolesRes.status === 'fulfilled') {
        const roles = customRolesRes.value.data?.data || customRolesRes.value.data || [];
        setCustomRoles(Array.isArray(roles) ? roles : []);
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
      setFeedback({ type: 'error', text: 'Failed to load employee directory and custom roles.' });
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
    setAssignedCustomRoleId(emp.customRoleId?._id || emp.customRoleId || '');

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

  // Custom role template permission check
  const isCustomRoleInherited = (permKey) => {
    if (!assignedCustomRoleId) return false;
    const matchedRole = customRoles.find((r) => r._id === assignedCustomRoleId);
    return matchedRole?.permissions?.includes(permKey) || false;
  };

  // Effective permission check
  const isPermissionActive = (permKey) => {
    if (removedPermissions.has(permKey)) return false;
    if (grantedPermissions.has(permKey)) return true;
    if (isCustomRoleInherited(permKey)) return true;
    return isBaseInherited(permKey);
  };

  // Toggle permission
  const handleTogglePermission = (permKey) => {
    const inherited = isBaseInherited(permKey) || isCustomRoleInherited(permKey);
    const newGranted = new Set(grantedPermissions);
    const newRemoved = new Set(removedPermissions);

    if (inherited) {
      if (newRemoved.has(permKey)) {
        newRemoved.delete(permKey);
      } else {
        newRemoved.add(permKey);
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

  // Toggle group
  const handleToggleGroup = (groupPermissions) => {
    const allKeys = groupPermissions.map((p) => p.key);
    const allCurrentlyActive = allKeys.every((k) => isPermissionActive(k));

    const newGranted = new Set(grantedPermissions);
    const newRemoved = new Set(removedPermissions);

    allKeys.forEach((key) => {
      const inherited = isBaseInherited(key) || isCustomRoleInherited(key);
      if (allCurrentlyActive) {
        if (inherited) newRemoved.add(key);
        newGranted.delete(key);
      } else {
        if (inherited) newRemoved.delete(key);
        else newGranted.add(key);
      }
    });

    setGrantedPermissions(newGranted);
    setRemovedPermissions(newRemoved);
  };

  // 2. Save Employee Overrides & Assign Custom Role
  const handleSaveOverrides = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      setFeedback({ type: '', text: '' });

      const grantedArray = Array.from(grantedPermissions);
      const removedArray = Array.from(removedPermissions);
      const trimmedTitle = jobTitle.trim();
      const trimmedReason = reason.trim();

      // Parallel execute: Update Role Override & Assign Custom Role
      await Promise.all([
        apiClient.put(`/role-overrides/${selectedEmployee._id}`, {
          grantedPermissions: grantedArray,
          removedPermissions: removedArray,
          jobTitle: trimmedTitle,
          reason: trimmedReason,
        }),
        apiClient.post('/custom-roles/assign', {
          employeeId: selectedEmployee._id,
          customRoleId: assignedCustomRoleId || null,
        }),
      ]);

      setFeedback({
        type: 'success',
        text: `Permissions & Role bundle successfully updated for ${selectedEmployee.firstName} ${selectedEmployee.lastName}!`,
      });

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

  // 3. Create or Edit Custom Role Template
  const handleSaveCustomRoleTemplate = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim() || roleForm.permissions.length === 0) {
      alert('Role name and at least one permission are required.');
      return;
    }

    try {
      setSaving(true);
      if (editingRoleId) {
        await apiClient.put(`/custom-roles/${editingRoleId}`, roleForm);
        setFeedback({ type: 'success', text: `Custom Role '${roleForm.name}' updated successfully.` });
      } else {
        await apiClient.post('/custom-roles', roleForm);
        setFeedback({ type: 'success', text: `Custom Role '${roleForm.name}' created successfully.` });
      }

      setIsRoleModalOpen(false);
      setEditingRoleId(null);
      setRoleForm({ name: '', description: '', basedOnSystemRole: 'EMPLOYEE', permissions: [] });
      loadData(selectedEmployee?._id);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to save custom role.' });
    } finally {
      setSaving(false);
    }
  };

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
      {/* Top Banner Feedback */}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            TENANT GOVERNANCE // RBAC BUNDLES & CAPABILITIES
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Role Delegation & Custom Role Engine
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5 max-w-2xl">
            Create composite custom roles (e.g. HOD, Shift Incharge), assign them to personnel, or configure explicit permission overrides.
          </p>
        </div>

        {/* Tab Switcher & Modal Trigger */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('EMPLOYEE_POWERS')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded cursor-pointer transition-colors ${
              activeTab === 'EMPLOYEE_POWERS'
                ? 'bg-[#16233B] text-white'
                : 'bg-white border border-[#D8D3C7] text-[#728294] hover:bg-[#FAF8F5]'
            }`}
          >
            Staff Overrides & Assignment
          </button>
          <button
            onClick={() => setActiveTab('CUSTOM_ROLE_TEMPLATES')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded cursor-pointer transition-colors ${
              activeTab === 'CUSTOM_ROLE_TEMPLATES'
                ? 'bg-[#16233B] text-white'
                : 'bg-white border border-[#D8D3C7] text-[#728294] hover:bg-[#FAF8F5]'
            }`}
          >
            Custom Role Templates ({customRoles.length})
          </button>
          <button
            onClick={() => {
              setEditingRoleId(null);
              setRoleForm({ name: '', description: '', basedOnSystemRole: 'EMPLOYEE', permissions: [] });
              setIsRoleModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
          >
            + New Role Template
          </button>
        </div>
      </div>

      {/* VIEW 1: STAFF DIRECTORY & PERMISSION OVERRIDES */}
      {activeTab === 'EMPLOYEE_POWERS' && (
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
                  const customRoleName = customRoles.find(
                    (r) => r._id === (emp.customRoleId?._id || emp.customRoleId)
                  )?.name;

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
                          {customRoleName && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4] rounded font-bold">
                              {customRoleName}
                            </span>
                          )}
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

          {/* Right Column: Permission Matrix & Role Selection */}
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
                        Base: {selectedEmployee.role || selectedEmployee.userId?.role || 'EMPLOYEE'}
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

                  <button
                    type="button"
                    onClick={handleSaveOverrides}
                    disabled={saving}
                    className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded shadow-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'SAVING POWERS...' : 'SAVE CAPABILITIES'}
                  </button>
                </div>

                {/* 1. Custom Role Selector & Designation Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#FAF8F5] rounded border border-[#E3DED4]">
                  {/* Attach Custom Role Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                      ATTACH CUSTOM ROLE TEMPLATE
                    </label>
                    <select
                      value={assignedCustomRoleId}
                      onChange={(e) => setAssignedCustomRoleId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
                    >
                      <option value="">None (Standard Role Defaults)</option>
                      {customRoles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} ({r.permissions?.length || 0} Powers)
                        </option>
                      ))}
                    </select>
                    <span className="text-[9px] text-[#728294] block">
                      Inherits predefined bundle of authorities.
                    </span>
                  </div>

                  {/* Badge Job Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                      BADGE DESIGNATION / TITLE
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Floor 1 Supervisor"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
                    />
                    <span className="text-[9px] text-[#728294] block">
                      Displays on live telemetry desk & reports.
                    </span>
                  </div>

                  {/* Justification */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                      DELEGATION REASON
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17]"
                    />
                    <span className="text-[9px] text-[#728294] block">
                      Compliance audit trail logging.
                    </span>
                  </div>
                </div>

                {/* 2. Permission Checklist Matrix */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#728294]">
                      POWER & PERMISSIONS MATRIX
                    </h3>
                    <div className="flex items-center gap-4 text-[10.5px] font-mono">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#728294]"></span> Base
                      </span>
                      <span className="flex items-center gap-1.5 text-[#8C5D17]">
                        <span className="w-2 h-2 rounded-full bg-[#8C5D17]"></span> Custom Role
                      </span>
                      <span className="flex items-center gap-1.5 text-[#1E7E34]">
                        <span className="w-2 h-2 rounded-full bg-[#1E7E34]"></span> Added
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
                              const customRoleHasIt = isCustomRoleInherited(perm.key);
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

                                      {/* Status Badges */}
                                      {isRevoked ? (
                                        <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#FDEEEB] text-[#B83E28] font-bold">
                                          REVOKED
                                        </span>
                                      ) : isCustomGranted ? (
                                        <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#EBF7F0] text-[#1E7E34] font-bold">
                                          +GRANTED
                                        </span>
                                      ) : customRoleHasIt ? (
                                        <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4] font-bold">
                                          ROLE BUNDLE
                                        </span>
                                      ) : baseHasIt ? (
                                        <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#728294]">
                                          BASE ROLE
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
                Select an employee from the staff directory to configure custom role bundles or overrides.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: CUSTOM ROLE TEMPLATES CATALOG */}
      {activeTab === 'CUSTOM_ROLE_TEMPLATES' && (
        <div className="bg-white border border-[#E3DED4] rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#F4F1EA]">
            <div>
              <h3 className="text-sm font-bold text-[#16233B] font-serif">
                Configured Company Role Templates ({customRoles.length})
              </h3>
              <p className="text-xs text-[#728294]">
                Templates can be attached to any staff member in the staff directory tab.
              </p>
            </div>
          </div>

          {customRoles.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-[#728294]">
              No custom roles created yet. Click '+ New Role Template' at the top to configure one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customRoles.map((r) => (
                <div key={r._id} className="p-4 rounded-lg border border-[#E3DED4] bg-[#FAF8F5] space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-[#16233B]">{r.name}</span>
                      <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] font-bold">
                        {r.permissions?.length || 0} Powers
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-[#5B6B79] mt-1 line-clamp-2">{r.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {r.permissions?.slice(0, 4).map((p) => (
                        <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 bg-white border border-[#D8D3C7] rounded text-[#728294]">
                          {p}
                        </span>
                      ))}
                      {r.permissions?.length > 4 && (
                        <span className="text-[9px] font-mono text-[#8C5D17] self-center">
                          +{r.permissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E3DED4]/60 flex justify-end">
                    <button
                      onClick={() => {
                        setEditingRoleId(r._id);
                        setRoleForm({
                          name: r.name,
                          description: r.description || '',
                          basedOnSystemRole: r.basedOnSystemRole || 'EMPLOYEE',
                          permissions: r.permissions || [],
                        });
                        setIsRoleModalOpen(true);
                      }}
                      className="text-xs font-mono font-bold text-[#8C5D17] hover:underline cursor-pointer"
                    >
                      Edit Template &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE / EDIT CUSTOM ROLE TEMPLATE */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
              <h3 className="text-base font-bold text-[#16233B]">
                {editingRoleId ? 'Edit Custom Role Template' : 'Create Custom Role Template'}
              </h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-lg font-bold text-[#728294] hover:text-[#16233B] cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleSaveCustomRoleTemplate} className="space-y-4 mt-4 text-xs flex-1 overflow-y-auto pr-1">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Head of Department (HOD) / Shift Incharge"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Operational scope of this role bundle..."
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>

              {/* Permission Checklist Selection */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-mono uppercase text-[#728294] font-bold">
                    Assign Permissions Bundle ({roleForm.permissions.length} Selected)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto p-2.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]">
                  {PERMISSION_CATALOG.flatMap((g) => g.permissions).map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 p-1.5 bg-white border border-[#EFECE6] rounded cursor-pointer hover:border-[#8C5D17]">
                      <input
                        type="checkbox"
                        checked={roleForm.permissions.includes(perm.key)}
                        onChange={() => {
                          const exists = roleForm.permissions.includes(perm.key);
                          setRoleForm({
                            ...roleForm,
                            permissions: exists
                              ? roleForm.permissions.filter((p) => p !== perm.key)
                              : [...roleForm.permissions, perm.key],
                          });
                        }}
                        className="accent-[#8C5D17]"
                      />
                      <div className="truncate">
                        <span className="block font-bold text-[11px] text-[#16233B]">{perm.label}</span>
                        <span className="block font-mono text-[9px] text-[#728294]">{perm.key}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#D8D3C7] rounded text-[#728294]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Role Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}