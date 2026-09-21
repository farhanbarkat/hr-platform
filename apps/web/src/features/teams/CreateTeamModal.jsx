import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function CreateTeamModal({ isOpen, onClose, onTeamCreated }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    managerId: '',
    members: [],
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  // Fetch active employees and departments when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchPrerequisites = async () => {
      try {
        setFetching(true);
        setError(null);

        const [empRes, deptRes] = await Promise.all([
          apiClient.get('/employees').catch(() => ({ data: { data: [] } })),
          apiClient.get('/departments').catch(() => ({ data: { data: [] } })),
        ]);

        if (isMounted) {
          const rawEmps = empRes.data?.data?.employees || empRes.data?.data || [];
          const rawDepts = deptRes.data?.data?.departments || deptRes.data?.data || [];

          setEmployees(Array.isArray(rawEmps) ? rawEmps : []);
          setDepartments(Array.isArray(rawDepts) ? rawDepts : []);
        }
      } catch (err) {
        console.warn('Prerequisites fetch error:', err);
      } finally {
        if (isMounted) setFetching(false);
      }
    };

    fetchPrerequisites();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMemberToggle = (empId) => {
    setFormData((prev) => {
      const exists = prev.members.includes(empId);
      return {
        ...prev,
        members: exists
          ? prev.members.filter((id) => id !== empId)
          : [...prev.members, empId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.managerId) {
      setError('Team name and Squad Lead / Manager are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiClient.post('/teams', {
        name: formData.name.trim(),
        department: formData.department || 'General',
        managerId: formData.managerId,
        members: formData.members,
      });

      // Reset Form State
      setFormData({
        name: '',
        department: '',
        managerId: '',
        members: [],
      });

      if (onTeamCreated) onTeamCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to form team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none font-sans">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
          <div>
            <span className="text-[9px] font-mono tracking-widest text-[#728294] uppercase font-bold">
              ORCHESTRATION // WORKFORCE
            </span>
            <h3 className="text-base font-serif font-bold text-[#16233B]">
              Form New Team / Squad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-xl font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-2.5 mt-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {fetching ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            Loading directory workforce and departments...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs flex-1 overflow-y-auto pr-1">
            {/* Team Name */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Squad / Team Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Frontend Platform Squad"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
              />
            </div>

            {/* Department & Manager Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] bg-white"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Squad Lead / Manager *
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  required
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] bg-white"
                >
                  <option value="">Assign Lead</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName || ''} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Squad Members Assignment */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Assign Members ({formData.members.length} selected)
              </label>
              <div className="border border-[#D8D3C7] rounded p-2 max-h-40 overflow-y-auto space-y-1.5 bg-[#FAF8F5]/50">
                {employees.length === 0 ? (
                  <p className="text-[11px] text-[#728294] py-2 text-center">
                    No active employees available in directory.
                  </p>
                ) : (
                  employees
                    .filter((emp) => emp._id !== formData.managerId)
                    .map((emp) => {
                      const checked = formData.members.includes(emp._id);
                      return (
                        <label
                          key={emp._id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleMemberToggle(emp._id)}
                            className="accent-[#8C5D17]"
                          />
                          <span className="text-xs text-[#16233B]">
                            {emp.firstName} {emp.lastName || ''}{' '}
                            <span className="text-[#728294] text-[10px] font-mono">
                              ({emp.designation || 'Member'})
                            </span>
                          </span>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DED4]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-[#D8D3C7] rounded text-[#728294] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : '+ Form Squad'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}