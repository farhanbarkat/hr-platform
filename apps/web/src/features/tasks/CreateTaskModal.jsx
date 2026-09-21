import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function CreateTaskModal({ isOpen, onClose, onTaskCreated }) {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    teamId: '',
    assignedTo: '',
    priority: 'MEDIUM',
    deadline: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPrerequisites = async () => {
      try {
        const [deptRes, empRes] = await Promise.all([
          apiClient.get('/departments').catch(() => ({ data: { data: [] } })),
          apiClient.get('/employees').catch(() => ({ data: { data: [] } })),
        ]);

        // Safe array extraction
        const rawDepts = deptRes.data?.data?.departments || deptRes.data?.data || [];
        const rawEmps = empRes.data?.data?.employees || empRes.data?.data || [];

        const depts = Array.isArray(rawDepts) ? rawDepts : [];
        const emps = Array.isArray(rawEmps) ? rawEmps : [];

        setDepartments(depts);
        setEmployees(emps);
        setFilteredEmployees(emps);

        if (depts.length > 0) {
          setFormData((prev) => ({
            ...prev,
            teamId: prev.teamId || depts[0]._id,
          }));
        }
      } catch (err) {
        console.warn('Prerequisites fetch error:', err);
      }
    };

    fetchPrerequisites();
  }, [isOpen]);

  useEffect(() => {
    if (!formData.teamId || !Array.isArray(employees)) {
      setFilteredEmployees(Array.isArray(employees) ? employees : []);
      return;
    }

    const matched = employees.filter((emp) => {
      const deptId = emp?.departmentId?._id || emp?.departmentId || emp?.teamId;
      return deptId?.toString() === formData.teamId.toString();
    });

    const finalEmps = matched.length > 0 ? matched : employees;
    setFilteredEmployees(finalEmps);

    if (finalEmps.length > 0 && !finalEmps.some((e) => e._id === formData.assignedTo)) {
      setFormData((prev) => ({ ...prev, assignedTo: finalEmps[0]._id }));
    }
  }, [formData.teamId, employees]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.teamId || !formData.assignedTo || !formData.deadline) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiClient.post('/tasks', {
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        teamId: formData.teamId,
        assignedTo: formData.assignedTo,
        priority: formData.priority || 'MEDIUM',
        deadline: new Date(formData.deadline).toISOString(),
      });

      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none font-sans">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-lg p-6 animate-in fade-in duration-150">
        <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">
              OPERATIONAL WORKFLOW // TASK DISPATCH
            </span>
            <h3 className="text-base font-serif font-bold text-[#16233B] mt-0.5">
              Create & Assign Team Task
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-xl font-mono leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-2.5 mt-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          <div>
            <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Audit Q3 Tax Reconciliation Ledger"
              className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Target Team / Department *
              </label>
              <select
                value={formData.teamId}
                onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono focus:border-[#8C5D17]"
              >
                <option value="">Select Department</option>
                {Array.isArray(departments) &&
                  departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} {d.code ? `(${d.code})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Assigned Employee *
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono focus:border-[#8C5D17]"
              >
                <option value="">Select Assignee</option>
                {Array.isArray(filteredEmployees) &&
                  filteredEmployees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName ? `${emp.firstName} ${emp.lastName || ''}` : emp.name || 'Employee'} ({emp.employeeCode || 'EMP'})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Priority Tier
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono focus:border-[#8C5D17]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Critical SLA)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Deadline Date *
              </label>
              <input
                type="date"
                required
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono focus:border-[#8C5D17]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
              Deliverable Specifications / Notes
            </label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Scope details, acceptance criteria, or reference links..."
              className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-[#D8D3C7] rounded text-[#728294] cursor-pointer hover:bg-[#FAF8F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#734B12] text-white font-bold rounded cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Dispatching...' : 'Dispatch Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}