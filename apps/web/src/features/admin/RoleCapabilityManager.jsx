import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient.js';

// Global Permissions Catalog by Category
const PERMISSION_CATALOG = [
  {
    category: 'Attendance Management',
    permissions: [
      { key: 'attendance:view', label: 'View Employee Attendance Records' },
      { key: 'attendance:checkin', label: 'Self Check-in & Check-out' },
      { key: 'attendance:manage_missing', label: 'Flag & Resolve Missing Checkouts' },
      { key: 'attendance:override', label: 'Manual Attendance Time Adjustment' },
    ],
  },
  {
    category: 'Leave Management & Approvals',
    permissions: [
      { key: 'leave:view_own', label: 'View Own Leave Balances' },
      { key: 'leave:create', label: 'Apply for Leave' },
      { key: 'leave:view_team', label: 'View Department / Team Leave Requests' },
      { key: 'leave:approve_manager', label: 'Stage 1: Line Manager Approval' },
      { key: 'leave:approve_hr', label: 'Stage 2: HR Final Approval & Quota Deduct' },
      { key: 'leave:manage_balances', label: 'Initialize & Adjust Annual Quotas' },
    ],
  },
  {
    category: 'Payroll & Compensation',
    permissions: [
      { key: 'payroll:view', label: 'View Monthly Payroll Breakdown' },
      { key: 'payroll:execute', label: 'Run & Finalize Company Payroll' },
      { key: 'loans:apply', label: 'Apply for Salary Advance / Loan' },
      { key: 'loans:approve', label: 'Pre-Approve & Authorize Salary Loans' },
    ],
  },
  {
    category: 'Employee Directory & Onboarding',
    permissions: [
      { key: 'employee:view', label: 'Browse Employee Directory' },
      { key: 'employee:create', label: 'Onboard New Employees / Interns' },
      { key: 'employee:edit', label: 'Edit Job Profile & Designation' },
      { key: 'employee:deactivate', label: 'Offboard / Deactivate Employee' },
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
        // Backend mount path matches app.js: /api/v1/roles/overrides
        apiClient.get('/roles/overrides'),
      ]);

      // Robust Employee Array Normalization
      let empList = [];
      if (empRes.status === 'fulfilled') {
        const raw = empRes.value.data;
        if (Array.isArray(raw)) empList = raw;
        else if (Array.isArray(raw?.data)) empList = raw.data;
        else if (Array.isArray(raw?.data?.employees)) empList = raw.data.employees;
        else if (Array.isArray(raw?.employees)) empList = raw.employees;
      }

      // Robust Overrides Array Normalization
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

  // When an employee is selected from left pane
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

      // Backend route: /api/v1/roles/overrides/:employeeId
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
        e.designation?.toLowerCase().includes(q)
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
          <button onClick={() => setFeedback({ type: '', text: '' })} className="cursor-pointer">✕</button>
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
          Delegate custom authorities to HR Executives, Senior HR, Interns, or Department Leads without altering root database roles.
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
            placeholder="Search staff by name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
          />

          <div className="divide-y divide-[#F4F1EA] max-h-[550px] overflow-y-auto pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedEmployee?._id === emp._id;
              const hasOverride = Boolean(emp.override?.grantedPermissions?.length);

              return (
                <div
                  key={emp._id}
                  onClick={() => selectUser(emp)}
                  className={`p-3 rounded cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FAF4E8] border-l-3 border-[#8C5D17]'
                      : 'hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#16233B]">
                      {emp.firstName} {emp.lastName}
                    </span>
                    {hasOverride && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] rounded">
                        Custom Powers
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#728294]">{emp.email}</div>
                  <div className="text-[10px] font-mono text-[#8C5D17] mt-1">
                    {emp.jobTitle || emp.designation || 'Staff Member'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Catalog & Custom Title Form */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-[#E3DED4] p-6 shadow-xs space-y-6">
          {selectedEmployee ? (
            <>
              {/* Selected User Heading */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#F4F1EA] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#16233B]">
                      Configuring Powers for: {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#728294]">
                      Base Role: {selectedEmployee.role || 'EMPLOYEE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#728294] mt-0.5">
                    Assign specific feature powers to this user. Unchecked features will follow default role behavior.
                  </p>
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

              {/* Title & Reason Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#FAF8F5] rounded border border-[#E3DED4]">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-[#5B6B79]">
                    CUSTOM DESIGNATION / JOB TITLE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior HR Specialist / HR Intern"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
                  />
                  <span className="text-[9.5px] text-[#728294] block">
                    Displays on user badge, letterhead, and attendance logs.
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
              <div className="space-y-6">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#728294]">
                  POWER & PERMISSIONS CATALOG
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {PERMISSION_CATALOG.map((group) => (
                    <div key={group.category} className="p-4 rounded border border-[#EFECE6] bg-[#FAF8F5] space-y-3">
                      <div className="text-xs font-bold text-[#16233B] pb-1 border-b border-[#E3DED4]">
                        {group.category}
                      </div>

                      <div className="space-y-2">
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
                              <div>
                                <span className="block font-medium">{perm.label}</span>
                                <span className="block text-[9.5px] font-mono text-[#728294]">{perm.key}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-[#728294] font-mono">
              Please select an employee from the staff directory on the left to configure capabilities.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}