import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

const emptyAllowance = () => ({ name: '', amount: '', isTaxable: true });

export default function PromotionWorkflowDesk() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [salaryTypes, setSalaryTypes] = useState([]);
  const [form, setForm] = useState({ newDesignation: '', newDepartmentId: '', effectiveDate: new Date().toISOString().slice(0, 10), baseSalary: '', grossSalary: '', netSalary: '', currency: 'PKR', salaryTypeId: '', justification: '', allowances: [emptyAllowance()] });

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeeResponse, departmentResponse, promotionResponse, salaryTypeResponse] = await Promise.all([
        apiClient.get('/employees?limit=200'),
        apiClient.get('/departments'),
        apiClient.get('/promotions'),
        apiClient.get('/salary-types'),
      ]);
      const employeePayload = employeeResponse.data?.data || employeeResponse.data || [];
      const employeeList = Array.isArray(employeePayload) ? employeePayload : employeePayload.employees || [];
      setEmployees(employeeList);
      const departmentPayload = departmentResponse.data?.data || departmentResponse.data || [];
      setDepartments(Array.isArray(departmentPayload) ? departmentPayload : []);
      const promotionPayload = promotionResponse.data?.data || promotionResponse.data || [];
      setPromotions(Array.isArray(promotionPayload) ? promotionPayload : []);
      const salaryTypePayload = salaryTypeResponse.data?.data || salaryTypeResponse.data || [];
      setSalaryTypes(Array.isArray(salaryTypePayload) ? salaryTypePayload : []);
      if (!selectedEmployeeId && employeeList[0]?._id) setSelectedEmployeeId(employeeList[0]._id);
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to load promotion workflow data.' });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (employeeId) => {
    if (!employeeId) return;
    try {
      const response = await apiClient.get(`/promotions/employee/${employeeId}`);
      const payload = response.data?.data || response.data || [];
      setHistory(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setHistory([]);
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to load promotion history.' });
    }
  };

  useEffect(() => { const timeout = setTimeout(loadData, 0); return () => clearTimeout(timeout); }, []);
  useEffect(() => { const timeout = setTimeout(() => loadHistory(selectedEmployeeId), 0); return () => clearTimeout(timeout); }, [selectedEmployeeId]);

  const createProposal = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);
      await apiClient.post('/promotions', {
        employeeId: selectedEmployeeId,
        newDesignation: form.newDesignation.trim(),
        newDepartmentId: form.newDepartmentId || null,
        effectiveDate: form.effectiveDate,
        proposedSalary: {
          baseSalary: form.baseSalary,
          grossSalary: form.grossSalary || form.baseSalary,
          netSalary: form.netSalary || form.grossSalary || form.baseSalary,
          currency: form.currency,
          salaryTypeId: form.salaryTypeId || null,
          allowances: form.allowances.filter((allowance) => allowance.name.trim() && allowance.amount !== '').map((allowance) => ({ ...allowance, amount: allowance.amount.toString() })),
        },
        justification: form.justification,
      });
      setFeedback({ ok: true, text: 'Promotion proposed. It now requires Company Admin/HR approval before an offer is sent.' });
      setForm((current) => ({ ...current, newDesignation: '', baseSalary: '', grossSalary: '', netSalary: '', salaryTypeId: '', justification: '', allowances: [emptyAllowance()] }));
      await loadData();
      await loadHistory(selectedEmployeeId);
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to create promotion proposal.' });
    } finally { setSaving(false); }
  };

  const approvePromotion = async (promotionId) => {
    try {
      setSaving(true);
      await apiClient.patch(`/promotions/${promotionId}/approve`);
      setFeedback({ ok: true, text: 'Promotion approved. Company promotion letter generated and offer sent to the employee.' });
      await loadData();
      await loadHistory(selectedEmployeeId);
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to approve promotion.' });
    } finally { setSaving(false); }
  };

  const selectedEmployee = employees.find((employee) => employee._id === selectedEmployeeId);
  const updateAllowance = (index, field, value) => setForm((current) => ({ ...current, allowances: current.allowances.map((allowance, allowanceIndex) => allowanceIndex === index ? { ...allowance, [field]: value } : allowance) }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12 font-sans text-[#16233B]">
      <div className="border-b border-[#E3DED4] pb-4"><span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#728294]">PEOPLE OPERATIONS // CAREER EVENTS</span><h1 className="mt-1 text-2xl font-serif font-bold">Promotion Workflow</h1><p className="mt-1 text-xs text-[#5B6B79]">Propose, approve, issue the company letter, and let the employee accept before profile changes take effect.</p></div>
      {feedback && <div className={`rounded border p-3 text-xs ${feedback.ok ? 'border-[#C6EAD3] bg-[#EBF7F0] text-[#1E7E34]' : 'border-[#F5C2BA] bg-[#FDEEEB] text-[#B83E28]'}`}>{feedback.text}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-lg border border-[#E3DED4] bg-white p-5 shadow-2xs"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Employee</h2><select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} disabled={loading} className="mt-2 w-full rounded border border-[#D8D3C7] bg-white px-3 py-2 text-xs"><option value="">Select employee...</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.firstName} {employee.lastName} - {employee.employeeId || employee.email}</option>)}</select>{selectedEmployee && <div className="mt-4 rounded border border-[#E3DED4] bg-[#FAF8F5] p-3 text-xs"><p className="font-bold">Current: {selectedEmployee.designation || 'Staff'}</p><p className="text-[#5B6B79]">{selectedEmployee.department?.name || selectedEmployee.departmentId?.name || 'Department not assigned'}</p></div>}<p className="mt-4 text-[11px] leading-relaxed text-[#728294]">The proposer is never listed as an approver by the backend. Acceptance creates the new salary version and updates the employee profile.</p>{salaryTypes.length > 0 && <p className="mt-2 text-[10px] font-mono text-[#8C5D17]">{salaryTypes.length} company salary strateg{salaryTypes.length === 1 ? 'y' : 'ies'} available.</p>}</section>

        <section className="rounded-lg border border-[#E3DED4] bg-white p-5 shadow-2xs"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Propose promotion</h2><form onSubmit={createProposal} className="mt-4 space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">New designation<input required value={form.newDesignation} onChange={(event) => setForm({ ...form, newDesignation: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Effective date<input required type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">New department<select value={form.newDepartmentId} onChange={(event) => setForm({ ...form, newDepartmentId: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] bg-white px-3 py-2 text-xs font-sans"><option value="">Keep current</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-4"><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Base salary<input required min="0" step="0.01" type="number" value={form.baseSalary} onChange={(event) => setForm({ ...form, baseSalary: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Gross<input required min="0" step="0.01" type="number" value={form.grossSalary} onChange={(event) => setForm({ ...form, grossSalary: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Net<input required min="0" step="0.01" type="number" value={form.netSalary} onChange={(event) => setForm({ ...form, netSalary: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Currency<input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label></div><div><div className="mb-2 flex justify-between"><span className="text-[10px] font-mono font-bold uppercase text-[#728294]">Proposed allowances</span><button type="button" onClick={() => setForm((current) => ({ ...current, allowances: [...current.allowances, emptyAllowance()] }))} className="text-[10px] font-mono font-bold text-[#8C5D17]">+ ADD</button></div>{form.allowances.map((allowance, index) => <div key={index} className="mb-2 grid grid-cols-[1fr_140px_auto] gap-2"><input placeholder="Allowance" value={allowance.name} onChange={(event) => updateAllowance(index, 'name', event.target.value)} className="rounded border border-[#D8D3C7] px-3 py-2 text-xs" /><input placeholder="Amount" type="number" min="0" step="0.01" value={allowance.amount} onChange={(event) => updateAllowance(index, 'amount', event.target.value)} className="rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /><button type="button" disabled={form.allowances.length === 1} onClick={() => setForm((current) => ({ ...current, allowances: current.allowances.filter((_, allowanceIndex) => allowanceIndex !== index) }))} className="rounded border border-[#D8D3C7] px-2 text-xs text-[#B83E28] disabled:opacity-40">X</button></div>)}</div><label className="block text-[10px] font-mono font-bold uppercase text-[#728294]">Justification<textarea required value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} rows="2" className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label><div className="flex justify-end"><button type="submit" disabled={saving || !selectedEmployeeId} className="rounded bg-[#8C5D17] px-4 py-2 text-xs font-mono font-bold text-white disabled:opacity-50">{saving ? 'SUBMITTING...' : 'SUBMIT PROPOSAL'}</button></div></form></section>
      </div>

      <section className="rounded-lg border border-[#E3DED4] bg-white shadow-2xs"><div className="border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-3"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Approval queue</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#FAF8F5] text-[10px] font-mono uppercase text-[#728294]"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EFECE6]">{promotions.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-[#728294]">No promotion records found.</td></tr> : promotions.map((promotion) => <tr key={promotion._id}><td className="px-4 py-3 font-bold">{promotion.employeeId?.firstName} {promotion.employeeId?.lastName}</td><td className="px-4 py-3">{promotion.previousDesignation} &rarr; <b>{promotion.newDesignation}</b></td><td className="px-4 py-3 font-mono">{new Date(promotion.effectiveDate).toLocaleDateString()}</td><td className="px-4 py-3 font-mono text-[#8C5D17]">{promotion.status}</td><td className="px-4 py-3 text-right">{promotion.status === 'proposed' && <button type="button" disabled={saving} onClick={() => approvePromotion(promotion._id)} className="rounded bg-[#1E7E34] px-3 py-1.5 text-[10px] font-mono font-bold text-white disabled:opacity-50">APPROVE & SEND OFFER</button>}</td></tr>)}</tbody></table></div></section>

      <section className="rounded-lg border border-[#E3DED4] bg-white shadow-2xs"><div className="border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-3"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Read-only promotion history</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#FAF8F5] text-[10px] font-mono uppercase text-[#728294]"><tr><th className="px-4 py-3">Effective</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Salary</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-[#EFECE6]">{history.length === 0 ? <tr><td colSpan="4" className="p-6 text-center text-[#728294]">Select an employee to view history.</td></tr> : history.map((promotion) => <tr key={promotion._id}><td className="px-4 py-3 font-mono">{new Date(promotion.effectiveDate).toLocaleDateString()}</td><td className="px-4 py-3">{promotion.previousDesignation} &rarr; <b>{promotion.newDesignation}</b></td><td className="px-4 py-3 font-mono">{promotion.proposedSalary?.currency || 'PKR'} {promotion.proposedSalary?.grossSalary || '-'}</td><td className="px-4 py-3 font-mono text-[#8C5D17]">{promotion.status}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
