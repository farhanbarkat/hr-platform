import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function AddEmployeeModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Auto-generate employee code prefix suggestion
  const defaultEmpId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    cnic: '',
    employeeId: defaultEmpId,
    phone: '',
    designation: '',
    departmentId: '',
    shiftId: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!isOpen) return;

    const loadMetadata = async () => {
      try {
        const [depRes, shiftRes] = await Promise.allSettled([
          apiClient.get('/departments'),
          apiClient.get('/shifts'),
        ]);

        if (depRes.status === 'fulfilled') {
          const list = depRes.value.data?.data || depRes.value.data || [];
          setDepartments(Array.isArray(list) ? list : []);
        }

        if (shiftRes.status === 'fulfilled') {
          const list = shiftRes.value.data?.data || shiftRes.value.data || [];
          setShifts(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load employee metadata:', err);
      }
    };

    loadMetadata();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const selectedDept = formData.departmentId?.trim();
    if (!selectedDept) {
      setError('Please select a Department.');
      return;
    }

    setLoading(true);

    try {
      // Exact keys strictly matching your backend controller validation
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        cnic: formData.cnic.trim(),
        employeeId: formData.employeeId.trim(),
        phone: formData.phone.trim(),
        designation: formData.designation.trim(),
        department: selectedDept,
        departmentId: selectedDept,
        dateOfJoining: formData.dateOfJoining,
        employmentStatus: 'PROBATION',
        ...(formData.shiftId ? { shift: formData.shiftId } : {}),
      };

      await apiClient.post('/employees', payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to onboard employee.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E3DED4] flex items-center justify-between bg-[#FAF8F5]">
          <div>
            <span className="text-[9px] font-mono tracking-widest text-[#728294] uppercase font-bold">
              WORKFORCE ONBOARDING
            </span>
            <h2 className="text-base font-bold text-[#16233B] mt-0.5">
              Provision New Employee Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-xl font-mono leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                placeholder="e.g. Farhan"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                placeholder="e.g. Barkat"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Corporate Email *
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="worker@cloudlogic.com"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
              />
            </div>

            {/* Employee ID */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Employee ID / Code *
              </label>
              <input
                type="text"
                name="employeeId"
                required
                value={formData.employeeId}
                onChange={handleChange}
                placeholder="e.g. EMP-1001"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
              />
            </div>

            {/* CNIC */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                National ID / CNIC *
              </label>
              <input
                type="text"
                name="cnic"
                required
                value={formData.cnic}
                onChange={handleChange}
                placeholder="e.g. 35201-1234567-1"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Contact Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+92 300 1234567"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
              />
            </div>

            {/* Designation */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Designation / Job Title *
              </label>
              <input
                type="text"
                name="designation"
                required
                value={formData.designation}
                onChange={handleChange}
                placeholder="e.g. QA Engineer / Floor Lead"
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Department *
              </label>
              <select
                name="departmentId"
                required
                value={formData.departmentId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
              >
                <option value="">Select Department...</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Assignment */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Assigned Shift Schedule
              </label>
              <select
                name="shiftId"
                value={formData.shiftId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
              >
                <option value="">Standard Day Shift (Default)</option>
                {shifts.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.startTime} - {s.endTime})
                  </option>
                ))}
              </select>
            </div>

            {/* Date of Joining */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Date of Joining *
              </label>
              <input
                type="date"
                name="dateOfJoining"
                required
                value={formData.dateOfJoining}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#E3DED4] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-[#16233B] text-xs font-mono font-semibold rounded cursor-pointer transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
            >
              {loading ? 'PROVISIONING...' : 'CONFIRM ONBOARDING'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}