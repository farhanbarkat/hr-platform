import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

const SALARY_TYPES = [
  { value: 'FIXED', label: 'Fixed' },
  { value: 'PER_UNIT', label: 'Per-Unit' },
  { value: 'PERFORMANCE_BASED', label: 'Performance-Based' },
];

const emptyAllowance = () => ({ name: '', amount: '', isTaxable: true });

export default function SalaryConfigurationDesk() {
  const [activeTab, setActiveTab] = useState('STRUCTURES');
  const [employees, setEmployees] = useState([]);
  const [salaryTypes, setSalaryTypes] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [structureForm, setStructureForm] = useState({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    basicPay: '',
    currency: 'PKR',
    salaryTypeId: '',
    notes: '',
    allowances: [emptyAllowance()],
  });
  const [typeForm, setTypeForm] = useState({
    name: '',
    type: 'FIXED',
    unitLabel: 'unit',
    ratePerUnit: '',
    basePay: '',
    bonusPercent: '',
    metricSource: 'sales',
  });
  const [typeSaving, setTypeSaving] = useState(false);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const [employeeResponse, typeResponse] = await Promise.all([
        apiClient.get('/employees?limit=200'),
        apiClient.get('/salary-types'),
      ]);
      const employeePayload = employeeResponse.data?.data || employeeResponse.data || [];
      const employeeList = Array.isArray(employeePayload) ? employeePayload : employeePayload.employees || [];
      setEmployees(employeeList);
      const typePayload = typeResponse.data?.data || typeResponse.data || [];
      setSalaryTypes(Array.isArray(typePayload) ? typePayload : []);
      if (!selectedEmployeeId && employeeList[0]?._id) setSelectedEmployeeId(employeeList[0]._id);
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to load salary configuration data.' });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (employeeId) => {
    if (!employeeId) return;
    try {
      setHistoryLoading(true);
      const response = await apiClient.get(`/salary-structures/employee/${employeeId}/history`);
      const payload = response.data?.data || response.data || [];
      setHistory(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setHistory([]);
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to load salary history.' });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => loadMetadata(), 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => loadHistory(selectedEmployeeId), 0);
    return () => clearTimeout(timeout);
  }, [selectedEmployeeId]);

  const updateAllowance = (index, field, value) => {
    setStructureForm((current) => ({
      ...current,
      allowances: current.allowances.map((allowance, allowanceIndex) => allowanceIndex === index
        ? { ...allowance, [field]: value }
        : allowance),
    }));
  };

  const saveStructure = async (event) => {
    event.preventDefault();
    if (!selectedEmployeeId) {
      setFeedback({ ok: false, text: 'Select an employee before creating a salary revision.' });
      return;
    }
    try {
      setSaving(true);
      setFeedback(null);
      await apiClient.post('/salary-structures', {
        employeeId: selectedEmployeeId,
        effectiveFrom: structureForm.effectiveFrom,
        basicPay: structureForm.basicPay,
        currency: structureForm.currency,
        salaryTypeId: structureForm.salaryTypeId || null,
        notes: structureForm.notes,
        allowances: structureForm.allowances
          .filter((allowance) => allowance.name.trim() && allowance.amount !== '')
          .map((allowance) => ({ ...allowance, amount: allowance.amount.toString() })),
      });
      setFeedback({ ok: true, text: 'New salary revision created. Previous versions remain unchanged.' });
      setStructureForm((current) => ({ ...current, allowances: [emptyAllowance()], notes: '' }));
      await loadHistory(selectedEmployeeId);
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to create salary revision.' });
    } finally {
      setSaving(false);
    }
  };

  const saveSalaryType = async (event) => {
    event.preventDefault();
    try {
      setTypeSaving(true);
      setFeedback(null);
      await apiClient.post('/salary-types', {
        name: typeForm.name.trim(),
        type: typeForm.type,
        perUnitConfig: typeForm.type === 'PER_UNIT' ? {
          unitLabel: typeForm.unitLabel.trim(),
          ratePerUnit: typeForm.ratePerUnit,
        } : undefined,
        performanceConfig: typeForm.type === 'PERFORMANCE_BASED' ? {
          basePay: typeForm.basePay,
          bonusPercent: typeForm.bonusPercent,
          metricSource: typeForm.metricSource.trim(),
        } : undefined,
      });
      setFeedback({ ok: true, text: 'Salary type created for this company.' });
      setTypeForm({ name: '', type: 'FIXED', unitLabel: 'unit', ratePerUnit: '', basePay: '', bonusPercent: '', metricSource: 'sales' });
      await loadMetadata();
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to create salary type.' });
    } finally {
      setTypeSaving(false);
    }
  };

  const selectedEmployee = employees.find((employee) => employee._id === selectedEmployeeId);
  const selectedType = salaryTypes.find((salaryType) => salaryType._id === structureForm.salaryTypeId);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12 font-sans text-[#16233B]">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3DED4] pb-4 sm:flex-row sm:items-center">
        <div>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#728294]">PAYROLL GOVERNANCE // COMPENSATION CONFIGURATION</span>
          <h1 className="mt-1 text-2xl font-serif font-bold">Salary Structures & Salary Types</h1>
          <p className="mt-1 text-xs text-[#5B6B79]">Create immutable salary revisions and configure company-specific calculation strategies.</p>
        </div>
        <div className="flex rounded border border-[#D8D3C7] bg-white p-1">
          <button type="button" onClick={() => setActiveTab('STRUCTURES')} className={`rounded px-3 py-1.5 text-[10px] font-mono font-bold ${activeTab === 'STRUCTURES' ? 'bg-[#8C5D17] text-white' : 'text-[#728294]'}`}>EMPLOYEE STRUCTURES</button>
          <button type="button" onClick={() => setActiveTab('TYPES')} className={`rounded px-3 py-1.5 text-[10px] font-mono font-bold ${activeTab === 'TYPES' ? 'bg-[#8C5D17] text-white' : 'text-[#728294]'}`}>SALARY TYPES</button>
        </div>
      </div>

      {feedback && <div className={`rounded border p-3 text-xs ${feedback.ok ? 'border-[#C6EAD3] bg-[#EBF7F0] text-[#1E7E34]' : 'border-[#F5C2BA] bg-[#FDEEEB] text-[#B83E28]'}`}>{feedback.text}</div>}

      {activeTab === 'STRUCTURES' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <section className="rounded-lg border border-[#E3DED4] bg-white p-5 shadow-2xs">
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Employee salary profile</h2>
            <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} disabled={loading} className="mt-2 w-full rounded border border-[#D8D3C7] bg-white px-3 py-2 text-xs">
              <option value="">Select employee...</option>
              {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.firstName} {employee.lastName} - {employee.employeeId || employee.email}</option>)}
            </select>
            {selectedEmployee && <div className="mt-4 rounded border border-[#E3DED4] bg-[#FAF8F5] p-3 text-xs"><p className="font-bold">{selectedEmployee.firstName} {selectedEmployee.lastName}</p><p className="text-[#5B6B79]">{selectedEmployee.designation || 'Employee'}</p><p className="text-[#5B6B79]">{selectedEmployee.department?.name || selectedEmployee.departmentId?.name || 'Department not assigned'}</p></div>}
            <p className="mt-4 text-[11px] leading-relaxed text-[#728294]">Salary revisions are append-only. To change pay, create a new effective date; existing history cannot be edited here.</p>
          </section>

          <section className="rounded-lg border border-[#E3DED4] bg-white p-5 shadow-2xs">
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Create salary revision</h2>
            <form onSubmit={saveStructure} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Effective from<input required type="date" value={structureForm.effectiveFrom} onChange={(event) => setStructureForm({ ...structureForm, effectiveFrom: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans text-[#16233B]" /></label>
                <label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Basic pay<input required min="0" step="0.01" type="number" value={structureForm.basicPay} onChange={(event) => setStructureForm({ ...structureForm, basicPay: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono text-[#16233B]" /></label>
                <label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Currency<input value={structureForm.currency} onChange={(event) => setStructureForm({ ...structureForm, currency: event.target.value.toUpperCase() })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono text-[#16233B]" /></label>
              </div>
              <label className="block text-[10px] font-mono font-bold uppercase text-[#728294]">Salary type<select value={structureForm.salaryTypeId} onChange={(event) => setStructureForm({ ...structureForm, salaryTypeId: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] bg-white px-3 py-2 text-xs font-sans text-[#16233B]"><option value="">Fixed / legacy structure</option>{salaryTypes.map((salaryType) => <option key={salaryType._id} value={salaryType._id}>{salaryType.name} ({salaryType.type})</option>)}</select></label>
              {selectedType && <div className="rounded border border-[#E8D4B5] bg-[#FAF4E8] p-3 text-xs text-[#8C5D17]">Assigned calculation: <b>{selectedType.type}</b>. Variable inputs are entered per pay period in payroll; this structure only assigns the strategy.</div>}
              <div><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-mono font-bold uppercase text-[#728294]">Allowances</span><button type="button" onClick={() => setStructureForm((current) => ({ ...current, allowances: [...current.allowances, emptyAllowance()] }))} className="text-[10px] font-mono font-bold text-[#8C5D17]">+ ADD ALLOWANCE</button></div><div className="space-y-2">{structureForm.allowances.map((allowance, index) => <div key={index} className="grid grid-cols-[1fr_140px_auto] gap-2"><input value={allowance.name} placeholder="Allowance name" onChange={(event) => updateAllowance(index, 'name', event.target.value)} className="rounded border border-[#D8D3C7] px-3 py-2 text-xs" /><input value={allowance.amount} min="0" step="0.01" type="number" placeholder="Amount" onChange={(event) => updateAllowance(index, 'amount', event.target.value)} className="rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /><button type="button" disabled={structureForm.allowances.length === 1} onClick={() => setStructureForm((current) => ({ ...current, allowances: current.allowances.filter((_, allowanceIndex) => allowanceIndex !== index) }))} className="rounded border border-[#D8D3C7] px-2 text-xs text-[#B83E28] disabled:opacity-40">X</button></div>)}</div></div>
              <label className="block text-[10px] font-mono font-bold uppercase text-[#728294]">Notes<textarea value={structureForm.notes} onChange={(event) => setStructureForm({ ...structureForm, notes: event.target.value })} rows="2" className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label>
              <div className="flex justify-end"><button type="submit" disabled={saving} className="rounded bg-[#8C5D17] px-4 py-2 text-xs font-mono font-bold text-white disabled:opacity-50">{saving ? 'CREATING REVISION...' : 'CREATE REVISION'}</button></div>
            </form>
          </section>

          <section className="xl:col-span-2 rounded-lg border border-[#E3DED4] bg-white shadow-2xs">
            <div className="border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-3"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Salary revision history</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#FAF8F5] text-[10px] font-mono uppercase text-[#728294]"><tr><th className="px-4 py-3">Effective from</th><th className="px-4 py-3 text-right">Basic pay</th><th className="px-4 py-3">Allowances</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Notes</th></tr></thead><tbody className="divide-y divide-[#EFECE6]">{historyLoading ? <tr><td colSpan="5" className="p-6 text-center text-[#728294]">Loading history...</td></tr> : history.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-[#728294]">No salary revisions found.</td></tr> : history.map((revision) => <tr key={revision._id}><td className="px-4 py-3 font-mono">{new Date(revision.effectiveFrom).toLocaleDateString()}</td><td className="px-4 py-3 text-right font-mono">{revision.basicPayDecimal || revision.basicPay?.$numberDecimal || revision.basicPay || '-'}</td><td className="px-4 py-3">{(revision.allowances || []).map((allowance) => `${allowance.name}: ${allowance.amountDecimal || allowance.amount?.$numberDecimal || allowance.amount}`).join(', ') || 'None'}</td><td className="px-4 py-3">{revision.salaryTypeId?.name || 'Fixed / legacy'}</td><td className="px-4 py-3 text-[#5B6B79]">{revision.notes || '-'}</td></tr>)}</tbody></table></div>
          </section>
        </div>
      )}

      {activeTab === 'TYPES' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <section className="rounded-lg border border-[#E3DED4] bg-white p-5 shadow-2xs"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Define company salary type</h2><form onSubmit={saveSalaryType} className="mt-4 space-y-4"><label className="block text-[10px] font-mono font-bold uppercase text-[#728294]">Name<input required value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} placeholder="Production hourly" className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label><label className="block text-[10px] font-mono font-bold uppercase text-[#728294]">Calculation strategy<select value={typeForm.type} onChange={(event) => setTypeForm({ ...typeForm, type: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] bg-white px-3 py-2 text-xs font-sans">{SALARY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>{typeForm.type === 'PER_UNIT' && <div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Unit label<input required value={typeForm.unitLabel} onChange={(event) => setTypeForm({ ...typeForm, unitLabel: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Rate per unit<input required min="0" step="0.01" type="number" value={typeForm.ratePerUnit} onChange={(event) => setTypeForm({ ...typeForm, ratePerUnit: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label></div>}{typeForm.type === 'PERFORMANCE_BASED' && <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Base pay<input required min="0" step="0.01" type="number" value={typeForm.basePay} onChange={(event) => setTypeForm({ ...typeForm, basePay: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Bonus percent<input required min="0" step="0.01" type="number" value={typeForm.bonusPercent} onChange={(event) => setTypeForm({ ...typeForm, bonusPercent: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-mono" /></label></div><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Metric source<input required value={typeForm.metricSource} onChange={(event) => setTypeForm({ ...typeForm, metricSource: event.target.value })} className="mt-1 w-full rounded border border-[#D8D3C7] px-3 py-2 text-xs font-sans" /></label></div>}<button type="submit" disabled={typeSaving} className="w-full rounded bg-[#8C5D17] px-4 py-2 text-xs font-mono font-bold text-white disabled:opacity-50">{typeSaving ? 'SAVING...' : 'CREATE SALARY TYPE'}</button></form></section>
          <section className="rounded-lg border border-[#E3DED4] bg-white shadow-2xs"><div className="border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-3"><h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Active company salary types</h2></div><div className="divide-y divide-[#EFECE6]">{salaryTypes.length === 0 ? <p className="p-6 text-xs text-[#728294]">No salary types configured.</p> : salaryTypes.map((salaryType) => <div key={salaryType._id} className="p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-[#16233B]">{salaryType.name}</p><p className="text-[10px] font-mono uppercase text-[#8C5D17]">{salaryType.type}</p></div><span className="rounded border border-[#C6EAD3] bg-[#EBF7F0] px-2 py-1 text-[10px] font-mono text-[#1E7E34]">ACTIVE</span></div>{salaryType.type === 'PER_UNIT' && <p className="mt-2 text-xs text-[#5B6B79]">{salaryType.perUnitConfig?.unitLabel}: {salaryType.perUnitConfig?.ratePerUnit}</p>}{salaryType.type === 'PERFORMANCE_BASED' && <p className="mt-2 text-xs text-[#5B6B79]">Base {salaryType.performanceConfig?.basePay} + {salaryType.performanceConfig?.bonusPercent}% of {salaryType.performanceConfig?.metricSource}</p>}</div>)}</div></section>
        </div>
      )}
    </div>
  );
}
