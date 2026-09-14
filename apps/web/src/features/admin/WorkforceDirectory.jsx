import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';

export default function WorkforceDirectory() {
  const { isSuperAdmin, user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Onboarding Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    cnic: '',
    phone: '',
    designation: '',
    departmentId: '',
    role: 'HR_MANAGER',
    dateOfJoining: new Date().toISOString().split('T')[0],
    basicSalary: 150000,
  });

  const canManage =
    isSuperAdmin ||
    user?.role === 'COMPANY_ADMIN' ||
    user?.role === 'ADMIN' ||
    hasPermission(PERMISSIONS.EMPLOYEE.CREATE);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/employees?limit=200');
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw) ? raw : raw.employees || [];
      setEmployees(list);
    } catch (err) {
      console.error('Failed to fetch workforce records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/departments');
      const list = res.data?.data || res.data || [];
      const safeDepts = Array.isArray(list) ? list : [];
      setDepartments(safeDepts);

      // Agar departments mojood hon toh pehla department auto-select kar lein
      if (safeDepts.length > 0 && !form.departmentId) {
        setForm((prev) => ({ ...prev, departmentId: safeDepts[0]._id }));
      }
    } catch (err) {
      console.warn('Failed to load departments');
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!form.departmentId) {
      setFormError('Department is required. Please select an operational department.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const autoEmpId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        cnic: form.cnic.trim(),
        phone: form.phone ? form.phone.trim() : '',
        employeeId: autoEmpId,               // 👈 Missing required field resolved!
        department: form.departmentId,       // 👈 Controller compatibility
        departmentId: form.departmentId,     // 👈 Model compatibility
        designation: form.designation.trim(),
        role: form.role,
        dateOfJoining: form.dateOfJoining,
        basicSalary: Number(form.basicSalary),
        salary: Number(form.basicSalary),
      };

      const res = await apiClient.post('/employees', payload);
      const data = res.data?.data || {};

      // Controller response: authAccount.tempPassword
      const tempPass =
        data.authAccount?.tempPassword ||
        data.temporaryPassword ||
        'Welcome@123';

      setCreatedCredentials({
        name: `${form.firstName} ${form.lastName}`,
        email: form.email,
        role: form.role,
        password: tempPass,
        employeeCode: autoEmpId,
      });

      fetchEmployees();
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to onboard employee.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreatedCredentials(null);
    setFormError('');
    setCopied(false);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      cnic: '',
      phone: '',
      designation: '',
      departmentId: departments[0]?._id || '',
      role: 'HR_MANAGER',
      dateOfJoining: new Date().toISOString().split('T')[0],
      basicSalary: 150000,
    });
  };

  const filteredEmployees = employees.filter((emp) => {
    const term = search.toLowerCase();
    const fullName =
      `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const designation = (emp.designation || emp.jobTitle || '').toLowerCase();
    const dept = (
      emp.department?.name ||
      emp.departmentId?.name ||
      ''
    ).toLowerCase();
    return (
      fullName.includes(term) ||
      email.includes(term) ||
      designation.includes(term) ||
      dept.includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            PERSONNEL MANAGEMENT // WORKFORCE REPOSITORY
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Workforce Directory
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Active Staff Count:{' '}
            <span className="font-mono font-bold text-[#8C5D17]">
              {employees.length}
            </span>{' '}
            records
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setFormError('');
              setCreatedCredentials(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
          >
            + ONBOARD EMPLOYEE
          </button>
        )}
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-3 flex items-center justify-between gap-4 shadow-2xs">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name, corporate email, or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded text-xs focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/50 font-sans"
          />
        </div>
        <span className="text-[11px] font-mono text-[#728294]">
          Showing {filteredEmployees.length} of {employees.length}
        </span>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Designation / Role</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE6] text-xs">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center font-mono text-xs text-[#728294]"
                >
                  Querying workforce directory...
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center font-mono text-xs text-[#728294]"
                >
                  No workforce records found.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr
                  key={emp._id}
                  className="hover:bg-[#FAF8F5]/60 transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#16233B]">
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div className="text-[10px] font-mono text-[#728294]">
                      {emp.email}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-[#16233B]">
                      {emp.designation || emp.jobTitle || 'Operational Staff'}
                    </span>
                    <span className="block text-[9px] font-mono text-[#8C5D17]">
                      Security: {emp.role || 'EMPLOYEE'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#5B6B79]">
                    {emp.department?.name ||
                      emp.departmentId?.name ||
                      'General Operations'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]">
                      {emp.employmentStatus || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() =>
                        navigate('/company-admin/roles-capabilities')
                      }
                      className="px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#8C5D17] text-[10px] font-mono font-bold rounded cursor-pointer transition-colors"
                      title="Delegate custom powers"
                    >
                      DELEGATE POWERS &rarr;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* ONBOARDING MODAL                                          */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E3DED4] flex justify-between items-center bg-[#FAF8F5]">
              <div>
                <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#728294] font-bold">
                  WORKFORCE PROVISIONING // ONBOARDING GATEWAY
                </span>
                <h2 className="text-base font-serif font-bold text-[#16233B] mt-0.5">
                  {createdCredentials
                    ? 'Account Provisioned & Ready'
                    : 'Onboard New Staff Member'}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-[#728294] hover:text-[#16233B] text-xl font-mono leading-none cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {/* View 2: Generated Credentials Screen */}
            {createdCredentials ? (
              <div className="p-6 space-y-5 select-text">
                <div className="p-3 bg-[#EBF7EE] border border-[#C8E6C9] rounded text-xs font-mono text-[#1E7E34] flex items-center gap-2">
                  <span>✓</span>
                  <span>Employee and Auth User created successfully!</span>
                </div>

                <div className="bg-[#FAF8F5] border border-[#D5CEC2] rounded-lg p-4 space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-[#728294] block font-bold">
                      STAFF MEMBER
                    </span>
                    <span className="font-bold text-[#111C2E] text-sm">
                      {createdCredentials.name}
                    </span>
                    <span className="text-[10px] text-[#8C5D17] block">
                      Assigned Role: {createdCredentials.role}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#E3DED4] space-y-2">
                    <div>
                      <span className="text-[10px] uppercase text-[#728294] block font-bold">
                        LOGIN EMAIL
                      </span>
                      <span className="font-bold text-[#111C2E] select-all bg-white px-2 py-1 border border-[#D8D3C7] rounded block">
                        {createdCredentials.email}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded border-2 border-[#8C5D17]/40 flex items-center justify-between">
                      <div>
                        <span className="text-[9.5px] uppercase text-[#8C5D17] font-bold block">
                          TEMPORARY ACCESS PASSWORD
                        </span>
                        <span className="text-base font-bold text-[#8C5D17] tracking-wider select-all font-mono">
                          {createdCredentials.password}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyCredentials}
                        className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white text-[11px] font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
                      >
                        {copied ? '✓ COPIED' : '📋 COPY ALL'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF4E8] border border-[#E8D4B5] rounded text-xs text-[#8C5D17] leading-relaxed">
                  👉 <b>Credentials copy karein</b> aur New Incognito Window (
                  <code>Ctrl+Shift+N</code>) mein login karke HR permissions
                  verify karein.
                </div>

                <div className="flex justify-end pt-2 border-t border-[#E3DED4]">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2 bg-[#111C2E] hover:bg-[#1E2B3E] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors"
                  >
                    DONE & CLOSE
                  </button>
                </div>
              </div>
            ) : (
              /* View 1: Complete Onboarding Form Matching Backend Schema */
              <form
                onSubmit={handleOnboardSubmit}
                className="p-6 space-y-3.5 text-xs font-sans"
              >
                {formError && (
                  <div className="p-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-xs">
                    ⚠️ {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tariq"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mehmood"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Corporate Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. hr.tariq@cloudlogic.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      CNIC / National ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="35201-1234567-1"
                      value={form.cnic}
                      onChange={(e) =>
                        setForm({ ...form, cnic: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="0300-1234567"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Date of Joining *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.dateOfJoining}
                      onChange={(e) =>
                        setForm({ ...form, dateOfJoining: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Security Role *
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-white text-[#16233B] outline-none focus:border-[#8C5D17] font-mono cursor-pointer"
                    >
                      <option value="HR_MANAGER">HR MANAGER</option>
                      <option value="HR">HR SPECIALIST</option>
                      <option value="MANAGER">LINE MANAGER</option>
                      <option value="EMPLOYEE">STANDARD EMPLOYEE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Job Designation *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior HR Manager"
                      value={form.designation}
                      onChange={(e) =>
                        setForm({ ...form, designation: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Department *
                    </label>
                    <select
                      required
                      value={form.departmentId}
                      onChange={(e) =>
                        setForm({ ...form, departmentId: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-white text-[#16233B] outline-none focus:border-[#8C5D17] cursor-pointer"
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d._id || d.id} value={d._id || d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#728294] font-bold mb-1">
                      Base Salary (PKR) *
                    </label>
                    <input
                      type="number"
                      required
                      value={form.basicSalary}
                      onChange={(e) =>
                        setForm({ ...form, basicSalary: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded bg-[#FAF8F5]/40 text-[#16233B] outline-none focus:border-[#8C5D17] font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E3DED4] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-xs font-mono font-bold rounded cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {submitting ? 'PROVISIONING...' : 'CONFIRM ONBOARDING'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
