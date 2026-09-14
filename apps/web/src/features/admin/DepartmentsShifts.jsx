import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';

export default function DepartmentsShifts() {
  const { user, isSuperAdmin, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState('ROSTER'); // ROSTER | SHIFTS | DEPARTMENTS
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Modal States
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '09:00',
    endTime: '18:00',
    gracePeriodOverride: 15,
    isNightShift: false,
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    shiftTemplateId: '',
    inchargeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  const canManage =
    isSuperAdmin ||
    user?.role === 'COMPANY_ADMIN' ||
    user?.role === 'ADMIN' ||
    hasPermission(PERMISSIONS.COMPANY.CONFIGURE);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [deptRes, shiftRes, assignRes, empRes] = await Promise.allSettled([
        apiClient.get('/departments'),
        apiClient.get('/shifts/templates'),
        apiClient.get('/shifts/assignments'),
        apiClient.get('/employees?limit=200'),
      ]);

      if (deptRes.status === 'fulfilled') {
        const raw = deptRes.value.data?.data || deptRes.value.data || [];
        setDepartments(Array.isArray(raw) ? raw : (raw.departments || []));
      }
      if (shiftRes.status === 'fulfilled') {
        const raw = shiftRes.value.data?.data || shiftRes.value.data || [];
        const templates = raw.templates || (Array.isArray(raw) ? raw : []);
        setShifts(templates);
      }
      if (assignRes.status === 'fulfilled') {
        const raw = assignRes.value.data?.data || assignRes.value.data || [];
        const list = raw.assignments || (Array.isArray(raw) ? raw : []);
        setAssignments(list);
      }
      if (empRes.status === 'fulfilled') {
        const raw = empRes.value.data?.data || empRes.value.data || [];
        const list = raw.employees || (Array.isArray(raw) ? raw : []);
        setEmployees(list);
      }
    } catch (err) {
      console.error('Failed to load roster data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFeedback(null);
      await apiClient.post('/departments', deptForm);
      setFeedback({ text: 'Department successfully created.', ok: true });
      setIsDeptModalOpen(false);
      setDeptForm({ name: '', code: '', description: '' });
      fetchData();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to create department.',
        ok: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFeedback(null);
      const payload = {
        name: shiftForm.name.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        gracePeriodOverride: Number(shiftForm.gracePeriodOverride) || 0,
        isNightShift: Boolean(shiftForm.isNightShift),
      };

      await apiClient.post('/shifts/templates', payload);
      setFeedback({ text: 'Shift template configured successfully.', ok: true });
      setIsShiftModalOpen(false);
      setShiftForm({
        name: '',
        startTime: '09:00',
        endTime: '18:00',
        gracePeriodOverride: 15,
        isNightShift: false,
      });
      fetchData();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to configure shift template.',
        ok: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignShift = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFeedback(null);

      const payload = {
        employeeId: assignForm.employeeId,
        shiftTemplateId: assignForm.shiftTemplateId,
        startDate: assignForm.startDate,
        ...(assignForm.endDate ? { endDate: assignForm.endDate } : {}),
        ...(assignForm.inchargeId ? { inchargeId: assignForm.inchargeId } : {}),
      };

      await apiClient.post('/shifts/assignments', payload);
      setFeedback({ text: 'Shift & Incharge successfully allocated.', ok: true });
      setIsAssignModalOpen(false);
      setAssignForm({
        employeeId: '',
        shiftTemplateId: '',
        inchargeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
      fetchData();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to assign shift.',
        ok: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            ORGANIZATION ARCHITECTURE // ROTATIONS & SUPERVISION
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Shift Rostering & Department Structure
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Assign shifts to employees, nominate Shift Incharges, and manage operational templates.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1E7E34] hover:bg-[#18662A] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
            >
              + ASSIGN SHIFT & INCHARGE
            </button>
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
            >
              + CONFIGURE SHIFT
            </button>
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
            >
              + NEW DEPARTMENT
            </button>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3 text-xs font-mono rounded border ${
          feedback.ok
            ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]'
            : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.ok ? '✓ ' : '⚠️ '}
          {feedback.text}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#E3DED4]">
        <button
          onClick={() => setActiveTab('ROSTER')}
          className={`pb-2.5 px-3 text-xs font-mono font-bold tracking-wider cursor-pointer border-b-2 transition-colors ${
            activeTab === 'ROSTER'
              ? 'border-[#8C5D17] text-[#8C5D17]'
              : 'border-transparent text-[#728294] hover:text-[#16233B]'
          }`}
        >
          ACTIVE ROSTER & INCHARGES ({assignments.length})
        </button>
        <button
          onClick={() => setActiveTab('SHIFTS')}
          className={`pb-2.5 px-3 text-xs font-mono font-bold tracking-wider cursor-pointer border-b-2 transition-colors ${
            activeTab === 'SHIFTS'
              ? 'border-[#8C5D17] text-[#8C5D17]'
              : 'border-transparent text-[#728294] hover:text-[#16233B]'
          }`}
        >
          SHIFT TEMPLATES ({shifts.length})
        </button>
        <button
          onClick={() => setActiveTab('DEPARTMENTS')}
          className={`pb-2.5 px-3 text-xs font-mono font-bold tracking-wider cursor-pointer border-b-2 transition-colors ${
            activeTab === 'DEPARTMENTS'
              ? 'border-[#8C5D17] text-[#8C5D17]'
              : 'border-transparent text-[#728294] hover:text-[#16233B]'
          }`}
        >
          DEPARTMENTS ({departments.length})
        </button>
      </div>

      {/* Tab 1: Live Shift Assignments & Incharges */}
      {activeTab === 'ROSTER' && (
        <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
                <th className="py-3 px-4">Allocated Employee</th>
                <th className="py-3 px-4">Assigned Shift</th>
                <th className="py-3 px-4">Designated Shift Incharge</th>
                <th className="py-3 px-4">Effective Timeline</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-xs text-[#728294]">
                    Loading shift roster assignments...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-xs text-[#728294]">
                    No shift allocations recorded. Click "+ ASSIGN SHIFT & INCHARGE" to allocate personnel.
                  </td>
                </tr>
              ) : (
                assignments.map((item) => {
                  const emp = item.employeeId;
                  const shift = item.shiftTemplateId;
                  const incharge = item.inchargeId;

                  return (
                    <tr key={item._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      {/* Employee Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#16233B]">
                          {emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Staff Member'}
                        </div>
                        <div className="text-[10px] font-mono text-[#728294]">
                          {emp?.designation || 'Staff'} • {emp?.employeeId || emp?.employeeCode || 'ID'}
                        </div>
                      </td>

                      {/* Shift Timing */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold font-mono text-[#8C5D17]">
                          {shift?.name || 'Assigned Shift'}
                        </span>
                        <div className="text-[10px] font-mono text-[#5B6B79]">
                          {shift?.startTime} &rarr; {shift?.endTime}
                        </div>
                      </td>

                      {/* Incharge / Supervisor */}
                      <td className="py-3.5 px-4">
                        {incharge ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34]"></span>
                            <div>
                              <div className="font-bold text-xs text-[#16233B]">
                                {incharge.firstName} {incharge.lastName}
                              </div>
                              <div className="text-[9px] font-mono text-[#8C5D17]">
                                {incharge.designation || 'Supervisor'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-[#8C9BAE] italic">
                            Direct Admin Oversight
                          </span>
                        )}
                      </td>

                      {/* Timeline */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#5B6B79]">
                        <div>From: {new Date(item.startDate).toLocaleDateString()}</div>
                        <div className="text-[10px] text-[#8C9BAE]">
                          {item.endDate ? `To: ${new Date(item.endDate).toLocaleDateString()}` : 'Continuous Schedule'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase ${
                          item.status === 'ACTIVE'
                            ? 'bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]'
                            : 'bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4]'
                        }`}>
                          {item.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Shifts Templates */}
      {activeTab === 'SHIFTS' && (
        <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
                <th className="py-3 px-4">Shift Name</th>
                <th className="py-3 px-4">Timing Window</th>
                <th className="py-3 px-4">Grace Override</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] text-xs">
              {shifts.map((s) => (
                <tr key={s._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#16233B]">{s.name}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#8C5D17]">{s.startTime} &rarr; {s.endTime}</td>
                  <td className="py-3.5 px-4 font-mono text-[#5B6B79]">
                    {s.gracePeriodOverride !== null && s.gracePeriodOverride !== undefined ? `${s.gracePeriodOverride} mins` : 'Default (15m)'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px]">
                    {s.isNightShift ? (
                      <span className="px-1.5 py-0.5 bg-[#141F32] text-[#8C9BAE] rounded">NIGHT</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-[#FAF4E8] text-[#8C5D17] rounded">REGULAR</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]">
                      {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Departments */}
      {activeTab === 'DEPARTMENTS' && (
        <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
                <th className="py-3 px-4">Department Name</th>
                <th className="py-3 px-4">Unit Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] text-xs">
              {departments.map((dept) => (
                <tr key={dept._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#16233B]">{dept.name}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#8C5D17]">{dept.code || 'DEPT'}</td>
                  <td className="py-3.5 px-4 text-[#5B6B79] max-w-sm truncate">{dept.description || 'Corporate operations unit.'}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]">
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Assign Shift & Incharge */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E3DED4] flex justify-between items-center bg-[#FAF8F5]">
              <div>
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#728294] font-bold">ROSTER ALLOCATION</span>
                <h2 className="text-sm font-bold text-[#16233B]">Assign Shift & Nominate Incharge</h2>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-[#728294] hover:text-[#16233B] text-lg font-mono leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAssignShift} className="p-5 space-y-4 text-xs">
              
              {/* Select Employee */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Target Employee *
                </label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} ({emp.designation || 'Staff'} - {emp.employeeId || emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Shift Template */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Shift Schedule *
                </label>
                <select
                  required
                  value={assignForm.shiftTemplateId}
                  onChange={(e) => setAssignForm({ ...assignForm, shiftTemplateId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
                >
                  <option value="">Select Shift Schedule...</option>
                  {shifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {/* Nominate Shift Incharge / Line Supervisor */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Designated Shift Incharge / Supervisor
                </label>
                <select
                  value={assignForm.inchargeId}
                  onChange={(e) => setAssignForm({ ...assignForm, inchargeId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
                >
                  <option value="">Direct Admin Oversight (No Incharge)</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} — {emp.designation || 'Supervisor'}
                    </option>
                  ))}
                </select>
                <span className="text-[9px] text-[#728294] font-mono block mt-0.5">
                  The incharge will get real-time live monitoring of this employee on their dashboard.
                </span>
              </div>

              {/* Date Bounds */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    min={assignForm.startDate}
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E3DED4] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-xs font-mono rounded cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#1E7E34] hover:bg-[#18662A] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'ALLOCATING...' : 'CONFIRM ASSIGNMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Shift Template */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E3DED4] flex justify-between items-center bg-[#FAF8F5]">
              <h2 className="text-sm font-bold text-[#16233B]">Configure Shift Template</h2>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="text-[#728294] hover:text-[#16233B] text-lg font-mono leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateShift} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Shift Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  placeholder="e.g. Night Operation Shift"
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                    Grace Override (Mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shiftForm.gracePeriodOverride}
                    onChange={(e) => setShiftForm({ ...shiftForm, gracePeriodOverride: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
                  />
                </div>
                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftForm.isNightShift}
                      onChange={(e) => setShiftForm({ ...shiftForm, isNightShift: e.target.checked })}
                      className="rounded border-[#D8D3C7] text-[#8C5D17] focus:ring-0"
                    />
                    <span className="text-[11px] font-mono text-[#16233B] font-semibold">Overnight Shift</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E3DED4] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-xs font-mono rounded cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'SAVING...' : 'SAVE SHIFT TEMPLATE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Department */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E3DED4] flex justify-between items-center bg-[#FAF8F5]">
              <h2 className="text-sm font-bold text-[#16233B]">Provision Department</h2>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="text-[#728294] hover:text-[#16233B] text-lg font-mono leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateDepartment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Quality Assurance"
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Department Code *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. QA"
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Operational scope of this department..."
                  className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans"
                />
              </div>

              <div className="pt-3 border-t border-[#E3DED4] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-xs font-mono rounded cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'SAVING...' : 'CREATE DEPARTMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}