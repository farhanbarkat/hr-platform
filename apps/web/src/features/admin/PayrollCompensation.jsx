import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function PayrollCompensation() {
  const [loading, setLoading] = useState(true);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [salaryTypes, setSalaryTypes] = useState([]);

  // Modals & Drawers
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Forms
  const [runForm, setRunForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const [salaryTypeForm, setSalaryTypeForm] = useState({
    name: '',
    type: 'FIXED_MONTHLY', // 'FIXED_MONTHLY' | 'HOURLY' | 'PER_UNIT' | 'PERFORMANCE_BASED'
  });

  // 1. Fetch Payslips for Specific Run
  const fetchPayslipsForRun = async (runId) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/payroll/runs/${runId}/payslips`);
      const list = res.data?.data || [];
      setPayslips(Array.isArray(list) ? list : []);
      if (list.length > 0) {
        setSelectedPayslip(list[0]);
      } else {
        setSelectedPayslip(null);
      }
    } catch (err) {
      console.error('Error fetching payslips:', err);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch All Payroll Runs, Salary Types, and Departments
  const loadPayrollData = useCallback(async () => {
    try {
      setLoading(true);

      const [runsRes, deptRes, typesRes] = await Promise.allSettled([
        apiClient.get('/payroll/runs'),
        apiClient.get('/departments'),
        apiClient.get('/salary-types').catch(() => ({ data: { data: [] } })),
      ]);

      let runsList = [];
      if (runsRes.status === 'fulfilled') {
        const d = runsRes.value.data?.data;
        runsList = Array.isArray(d) ? d : [];
        setPayrollRuns(runsList);
      }

      if (deptRes.status === 'fulfilled') {
        const depts = deptRes.value.data?.data;
        setDepartments(Array.isArray(depts) ? depts : []);
      }

      if (typesRes.status === 'fulfilled') {
        const types = typesRes.value.data?.data;
        setSalaryTypes(Array.isArray(types) ? types : []);
      }

      if (runsList.length > 0) {
        const latest = runsList[0];
        setActiveRun(latest);
        await fetchPayslipsForRun(latest._id);
      } else {
        setPayslips([]);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading payroll data:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayrollData();
  }, [loadPayrollData]);

  // 3. Initialize Run & Trigger Calculation
  const handleCreateRun = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      setActionLoading(true);
      // Step A: Create DRAFT Run
      const res = await apiClient.post('/payroll/runs', {
        year: Number(runForm.year),
        month: Number(runForm.month),
      });

      const newRun = res.data?.data;
      setShowInitModal(false);

      if (newRun?._id) {
        // Step B: Automatically run orchestrator to compute attendance & gross pay
        try {
          await apiClient.post(`/payroll/runs/${newRun._id}/calculate`);
        } catch (calcErr) {
          console.warn('Auto-calculate note:', calcErr.message);
        }
      }

      await loadPayrollData();
    } catch (err) {
      setActionError(
        err.response?.data?.message || 'Failed to initialize payroll run.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Recalculate Batch Action
  const handleRecalculate = async () => {
    if (!activeRun?._id) {
      alert('Please select or initialize an active payroll run first.');
      return;
    }
    try {
      setActionLoading(true);
      await apiClient.post(`/payroll/runs/${activeRun._id}/calculate`);
      await fetchPayslipsForRun(activeRun._id);

      const runsRes = await apiClient.get('/payroll/runs');
      const list = runsRes.data?.data || [];
      setPayrollRuns(list);
      const current = list.find((r) => r._id === activeRun._id);
      if (current) setActiveRun(current);

      alert(
        'Payroll batch recalculated with latest attendance and deductions!'
      );
    } catch (err) {
      alert(
        err.response?.data?.message ||
          'Calculation failed. Ensure employees have assigned salary structures.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Approve & Lock Run
  const handleApprove = async () => {
    if (!activeRun?._id) return;
    if (activeRun.status === 'APPROVED') {
      alert('This payroll run is already locked and approved.');
      return;
    }

    const confirm = window.confirm(
      'Are you sure you want to approve and lock this payroll batch? Payslips will be locked and visible to employees.'
    );
    if (!confirm) return;

    try {
      setActionLoading(true);
      await apiClient.post(`/payroll/runs/${activeRun._id}/approve`);
      await fetchPayslipsForRun(activeRun._id);

      const runsRes = await apiClient.get('/payroll/runs');
      const list = runsRes.data?.data || [];
      setPayrollRuns(list);
      const current = list.find((r) => r._id === activeRun._id);
      if (current) setActiveRun(current);

      alert('Payroll run approved and locked successfully!');
    } catch (err) {
      alert(
        err.response?.data?.message ||
          'Cannot approve: Ensure run is in CALCULATED state first.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Download Single Payslip PDF
  const handleDownloadPdf = async (payslip) => {
    if (!payslip?._id) return;
    try {
      setActionLoading(true);
      // Generate / fetch download link
      const res = await apiClient.get(`/payslips/${payslip._id}/download`);
      const url = res.data?.data?.downloadUrl || res.data?.data?.url;

      if (url) {
        window.open(url, '_blank');
      } else {
        // Direct PDF generator trigger fallback
        const pdfGenRes = await apiClient.post(
          `/payslips/${payslip._id}/generate-pdf`
        );
        const pdfUrl =
          pdfGenRes.data?.data?.pdfUrl || pdfGenRes.data?.data?.downloadUrl;
        if (pdfUrl) {
          window.open(pdfUrl, '_blank');
        } else {
          alert('Payslip PDF generated. Check your downloads or S3 storage.');
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to download payslip PDF.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Download Consolidated Payslips (CSV/ZIP Data Package)
  const handleDownloadZipOrCsv = () => {
    if (payslips.length === 0) {
      alert('No payslips available in current batch to export.');
      return;
    }

    const headers =
      'Employee,EMP_ID,GrossSalary,AttendanceDeduction,LoanEMI,TaxDeduction,NetPayable,Status\n';
    const rows = payslips
      .map((p) => {
        const emp = p.employeeId;
        const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`;
        const code = emp?.employeeCode || emp?.employeeId || 'EMP';
        return `"${name}","${code}",${p.grossSalary || 0},${p.attendanceDeduction || p.lateDeduction || 0},${p.loanEmi || 0},${p.taxDeduction || 0},${p.netPayable || 0},"${p.status || 'DRAFT'}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `payroll_batch_${activeRun?._id || 'export'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // 8. Create Custom Salary Type
  const handleCreateSalaryType = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!salaryTypeForm.name.trim()) {
      setActionError('Salary Type Name is required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/salary-types', {
        name: salaryTypeForm.name.trim(),
        type: salaryTypeForm.type,
      });

      const typesRes = await apiClient.get('/salary-types');
      setSalaryTypes(typesRes.data?.data || []);
      setSalaryTypeForm({ name: '', type: 'FIXED_MONTHLY' });
      alert('Salary Type created successfully.');
    } catch (err) {
      setActionError(
        err.response?.data?.message || 'Failed to create salary type.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // KPI Calculations from Live Payslips
  const totalGross = payslips.reduce(
    (acc, p) => acc + (Number(p.grossSalary || p.totalEarnings) || 0),
    0
  );
  const totalDeductions = payslips.reduce(
    (acc, p) =>
      acc +
      (Number(p.totalDeductions) ||
        Number(p.attendanceDeduction || 0) +
          Number(p.loanEmi || 0) +
          Number(p.taxDeduction || 0)),
    0
  );
  const totalNet = payslips.reduce(
    (acc, p) =>
      acc +
      (Number(p.netPayable || p.netSalary) ||
        Number(p.grossSalary || 0) -
          (Number(p.attendanceDeduction || 0) +
            Number(p.loanEmi || 0) +
            Number(p.taxDeduction || 0))),
    0
  );
  const totalLateDeductions = payslips.reduce(
    (acc, p) => acc + (Number(p.attendanceDeduction || p.lateDeduction) || 0),
    0
  );
  const totalLoanDeductions = payslips.reduce(
    (acc, p) => acc + (Number(p.loanEmi || p.advanceDeduction) || 0),
    0
  );

  // Filtered Payslips
  const filteredPayslips = payslips.filter((item) => {
    const emp = item.employeeId;
    const name =
      `${emp?.firstName || ''} ${emp?.lastName || ''} ${emp?.userId?.name || ''}`.toLowerCase();
    const code = (emp?.employeeCode || emp?.employeeId || '').toLowerCase();
    return (
      !search.trim() ||
      name.includes(search.toLowerCase()) ||
      code.includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto select-none font-sans text-[#1D2530] pb-24">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[#111C2E]">
            Payroll Run & Compensation Engine
          </h1>
          <p className="text-[11px] text-[#69788A] mt-0.5">
            Monthly salary calculation, automated deductions, payslip
            generation, and statutory tax compliance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Functional Button 1: Settings & Salary Types */}
          <button
            onClick={() => {
              setActionError('');
              setShowSettingsModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>⚙️</span>
            <span>Payroll Settings & Salary Types</span>
          </button>

          {/* Functional Button 2: Initialize Run */}
          <button
            onClick={() => {
              setActionError('');
              setShowInitModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            <span>+</span>
            <span>Initialize New Payroll Run</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CURRENT MONTH NET */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              CURRENT MONTH NET
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#111C2E] font-mono">
                PKR
              </span>
              <span className="text-2xl font-serif font-bold text-[#111C2E]">
                {totalNet.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              {payslips.length} Active Employees Included
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            💵
          </div>
        </div>

        {/* LATE / EARLY DEDUCTIONS */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#B83E28] uppercase tracking-wider block">
              LATE / EARLY DEDUCTIONS
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#B83E28] font-mono">
                PKR
              </span>
              <span className="text-2xl font-serif font-bold text-[#B83E28]">
                {totalLateDeductions.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Live attendance deduction pool
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#B83E28] text-sm">
            ⏱️
          </div>
        </div>

        {/* ACTIVE LOAN EMIS */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              ACTIVE LOAN EMIS
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#111C2E] font-mono">
                PKR
              </span>
              <span className="text-2xl font-serif font-bold text-[#111C2E]">
                {totalLoanDeductions.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Active Recovery Schedules
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            🏛️
          </div>
        </div>

        {/* RUN STATUS */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              RUN STATUS
            </span>
            <div>
              <span className="px-2 py-0.5 bg-[#FAF3E8] text-[#8C5D17] border border-[#E8D4B5] rounded text-[10.5px] font-mono font-bold">
                {activeRun?.status || 'NO ACTIVE RUN'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Batch:{' '}
              {activeRun?.period
                ? `${activeRun.period.month}/${activeRun.period.year}`
                : 'Not initialized'}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#8C5D17] text-sm">
            📊
          </div>
        </div>
      </div>

      {/* 4-Step Orchestration Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs font-mono">
        <div className="p-3 rounded bg-white border border-[#E3DED4] flex items-center gap-3 shadow-2xs">
          <span className="w-5 h-5 rounded-full bg-[#1E7E34] text-white flex items-center justify-center text-[10px] font-bold">
            ✓
          </span>
          <div>
            <div className="font-bold text-[#111C2E] text-[11px]">STEP 1</div>
            <div className="text-[10px] text-[#728294]">Data Aggregation</div>
          </div>
        </div>
        <div className="p-3 rounded bg-white border border-[#E3DED4] flex items-center gap-3 shadow-2xs">
          <span className="w-5 h-5 rounded-full bg-[#1E7E34] text-white flex items-center justify-center text-[10px] font-bold">
            ✓
          </span>
          <div>
            <div className="font-bold text-[#111C2E] text-[11px]">STEP 2</div>
            <div className="text-[10px] text-[#728294]">
              Automated Deductions
            </div>
          </div>
        </div>
        <div
          className={`p-3 rounded border-2 flex items-center gap-3 shadow-2xs ${
            activeRun?.status === 'CALCULATED'
              ? 'bg-[#FAF4E8] border-[#8C5D17]'
              : 'bg-white border-[#E3DED4]'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-[#8C5D17] text-white flex items-center justify-center text-[10px] font-bold">
            3
          </span>
          <div>
            <div className="font-bold text-[#8C5D17] text-[11px]">
              STEP 3 (ACTIVE)
            </div>
            <div className="text-[10px] text-[#8C5D17]">Pre-Approval Audit</div>
          </div>
        </div>
        <div
          className={`p-3 rounded border flex items-center gap-3 shadow-2xs ${
            activeRun?.status === 'APPROVED'
              ? 'bg-[#EBF7EE] border-[#C8E6C9]'
              : 'bg-white border-[#E3DED4] opacity-60'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              activeRun?.status === 'APPROVED'
                ? 'bg-[#1E7E34] text-white'
                : 'bg-[#E5E0D6] text-[#728294]'
            }`}
          >
            {activeRun?.status === 'APPROVED' ? '✓' : '4'}
          </span>
          <div>
            <div className="font-bold text-[#111C2E] text-[11px]">STEP 4</div>
            <div className="text-[10px] text-[#728294]">
              Final Approval & Lock
            </div>
          </div>
        </div>
      </div>

      {/* Main Ledger Table & Payslip Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          className={`space-y-3 transition-all ${selectedPayslip ? 'lg:col-span-8' : 'lg:col-span-12'}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E3DED4] shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[260px] flex-1">
                <span className="absolute left-3 top-2 text-[#8C9BAE] text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search employee name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded pl-8 pr-3 py-1.5 text-xs text-[#1D2530] placeholder-[#8C9BAE] outline-none focus:border-[#8C5D17]"
                />
              </div>

              {/* Payroll Run Selector */}
              {payrollRuns.length > 0 && (
                <select
                  value={activeRun?._id || ''}
                  onChange={(e) => {
                    const matched = payrollRuns.find(
                      (r) => r._id === e.target.value
                    );
                    if (matched) {
                      setActiveRun(matched);
                      fetchPayslipsForRun(matched._id);
                    }
                  }}
                  className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer font-mono"
                >
                  {payrollRuns.map((r) => (
                    <option key={r._id} value={r._id}>
                      Period: {r.period?.month}/{r.period?.year} ({r.status})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="text-xs font-mono text-[#728294]">
              Showing {filteredPayslips.length} of {payslips.length} records
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[9.5px] font-mono uppercase tracking-wider text-[#728294]">
                    <th className="py-3 px-4">EMPLOYEE DETAILS</th>
                    <th className="py-3 px-3 text-right">GROSS PAY</th>
                    <th className="py-3 px-3 text-right">ATTENDANCE DED.</th>
                    <th className="py-3 px-3 text-right">LOAN EMI</th>
                    <th className="py-3 px-3 text-right">TAX</th>
                    <th className="py-3 px-3 text-right">NET PAYABLE</th>
                    <th className="py-3 px-3 text-center">STATUS</th>
                    <th className="py-3 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA] text-xs">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="py-10 text-center font-mono text-[#728294]"
                      >
                        Loading compensation records from database...
                      </td>
                    </tr>
                  ) : filteredPayslips.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="py-10 text-center font-mono text-[#728294]"
                      >
                        {payrollRuns.length === 0
                          ? 'No payroll runs created yet. Click "+ Initialize New Payroll Run" to start.'
                          : 'No payslips generated for this run yet. Click "Recalculate Batch" below.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPayslips.map((item) => {
                      const emp = item.employeeId;
                      const isSelected = selectedPayslip?._id === item._id;

                      return (
                        <tr
                          key={item._id}
                          onClick={() => setSelectedPayslip(item)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#FAF4E8]/80'
                              : 'hover:bg-[#FAF8F5]/80'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#111C2E]">
                              {emp?.firstName
                                ? `${emp.firstName} ${emp.lastName || ''}`
                                : emp?.userId?.name || 'Staff Member'}
                            </div>
                            <div className="text-[10px] font-mono text-[#728294]">
                              <span className="text-[#8C5D17] font-semibold">
                                {emp?.employeeCode || emp?.employeeId || 'EMP'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-[#111C2E] text-right">
                            PKR{' '}
                            {(
                              item.grossSalary ||
                              item.totalEarnings ||
                              0
                            ).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 font-mono text-[#B83E28] text-right">
                            -PKR{' '}
                            {(
                              item.attendanceDeduction ||
                              item.lateDeduction ||
                              0
                            ).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 font-mono text-[#546274] text-right">
                            -PKR {(item.loanEmi || 0).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 font-mono text-[#546274] text-right">
                            -PKR {(item.taxDeduction || 0).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-[#111C2E] text-right">
                            PKR{' '}
                            {(
                              item.netPayable ||
                              item.netSalary ||
                              0
                            ).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-semibold bg-[#EBF7EE] text-[#1E7E34]">
                              {item.status || 'Verified'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPayslip(item);
                              }}
                              className="px-2.5 py-1 bg-white border border-[#D5CEC2] hover:bg-[#FAF8F5] rounded text-[11px] font-mono text-[#111C2E] cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Section: Payslip Inspector Drawer */}
        {selectedPayslip && (
          <div className="lg:col-span-4 bg-white rounded-lg border border-[#E3DED4] p-5 space-y-4 shadow-xs sticky top-4 max-h-[calc(100vh-140px)] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DED4]">
              <div>
                <div className="text-[10px] font-mono text-[#8C5D17] uppercase font-bold">
                  PAYSLIP INSPECTION
                </div>
                <div className="text-xs font-mono text-[#728294]">
                  Batch ID:{' '}
                  {activeRun?._id
                    ? String(activeRun._id).slice(-8).toUpperCase()
                    : 'CURRENT'}
                </div>
              </div>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="text-xs text-[#728294] hover:text-[#111C2E] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono border-b border-[#F4F1EA] pb-3">
              <div>
                <span className="text-[#728294] block text-[9.5px]">
                  EMPLOYEE NAME
                </span>
                <span className="font-bold text-[#111C2E]">
                  {selectedPayslip.employeeId?.firstName
                    ? `${selectedPayslip.employeeId.firstName} ${selectedPayslip.employeeId.lastName || ''}`
                    : selectedPayslip.employeeId?.userId?.name || 'Employee'}
                </span>
              </div>
              <div>
                <span className="text-[#728294] block text-[9.5px]">
                  EMPLOYEE ID
                </span>
                <span className="font-bold text-[#111C2E]">
                  {selectedPayslip.employeeId?.employeeCode ||
                    selectedPayslip.employeeId?.employeeId ||
                    'EMP'}
                </span>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase block">
                EARNINGS BREAKDOWN
              </span>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#546274]">Gross Calculation</span>
                <span className="font-mono font-bold text-[#111C2E]">
                  PKR{' '}
                  {(
                    selectedPayslip.grossSalary ||
                    selectedPayslip.totalEarnings ||
                    0
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="space-y-1.5 text-xs pt-1 border-t border-[#F4F1EA]">
              <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase block">
                DEDUCTIONS & RECOVERIES
              </span>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#546274]">Attendance Deduction</span>
                <span className="font-mono text-[#B83E28]">
                  -PKR{' '}
                  {(
                    selectedPayslip.attendanceDeduction ||
                    selectedPayslip.lateDeduction ||
                    0
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#546274]">Loan Recovery</span>
                <span className="font-mono text-[#B83E28]">
                  -PKR {(selectedPayslip.loanEmi || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#546274]">Income Tax Withholding</span>
                <span className="font-mono text-[#B83E28]">
                  -PKR {(selectedPayslip.taxDeduction || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Net Amount Box */}
            <div className="p-3.5 bg-[#FAF4E8] border border-[#E8D4B5] rounded-md flex justify-between items-center">
              <div>
                <span className="text-[9px] font-mono uppercase text-[#8C5D17] font-bold block">
                  NET PAYABLE AMOUNT
                </span>
                <span className="text-xl font-serif font-bold text-[#111C2E]">
                  PKR{' '}
                  {(
                    selectedPayslip.netPayable ||
                    selectedPayslip.netSalary ||
                    0
                  ).toLocaleString()}
                </span>
              </div>
              <span className="text-xl text-[#1E7E34]">🛡️</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleDownloadPdf(selectedPayslip)}
                disabled={actionLoading}
                className="text-xs font-mono text-[#8C5D17] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <span>⬇</span>
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs font-mono text-[#546274] hover:bg-[#F2EFE9] cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Fixed code (Sidebar ki 230px chhor kar start hoga): */}
      <div className="fixed bottom-0 left-[230px] right-0 z-30 bg-[#0B1320] border-t border-[#1C2C45] px-6 py-3.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-6 font-mono text-xs">
          <div>
            <span className="text-[9px] text-[#6C7D93] uppercase block">
              TOTAL GROSS PAY
            </span>
            <span className="font-bold text-white text-sm">
              PKR {totalGross.toLocaleString()}
            </span>
          </div>
          <div className="h-6 w-px bg-[#1C2C45]" />
          <div>
            <span className="text-[9px] text-[#E05238] uppercase block">
              TOTAL DEDUCTIONS
            </span>
            <span className="font-bold text-[#E05238] text-sm">
              PKR {totalDeductions.toLocaleString()}
            </span>
          </div>
          <div className="h-6 w-px bg-[#1C2C45]" />
          <div>
            <span className="text-[9px] text-[#E5B56A] uppercase block">
              NET COMMITMENT
            </span>
            <span className="font-bold text-[#E5B56A] text-sm">
              PKR {totalNet.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Functional Recalculate Button */}
          <button
            disabled={actionLoading || !activeRun}
            onClick={handleRecalculate}
            className="px-4 py-2 bg-[#141F32] hover:bg-[#1A2840] border border-[#273B5B] text-white rounded text-xs font-mono font-semibold cursor-pointer transition-all disabled:opacity-50"
          >
            {actionLoading ? 'Executing...' : 'Recalculate Batch'}
          </button>

          {/* Functional Batch Export Button */}
          <button
            onClick={handleDownloadZipOrCsv}
            className="px-4 py-2 bg-[#141F32] hover:bg-[#1A2840] border border-[#273B5B] text-white rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>📥</span>
            <span>Download Batch Export</span>
          </button>

          {/* Functional Approve & Lock Button */}
          <button
            disabled={
              actionLoading || !activeRun || activeRun.status === 'APPROVED'
            }
            onClick={handleApprove}
            className="px-5 py-2 bg-[#C98A2C] hover:bg-[#B37822] text-white rounded text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md disabled:opacity-40"
          >
            <span>🔒</span>
            <span>
              {activeRun?.status === 'APPROVED'
                ? 'Payroll Locked & Approved'
                : 'Approve & Lock Payroll Run'}
            </span>
          </button>
        </div>
      </div>

      {/* Modal 1: Initialize New Payroll Run */}
      {showInitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">
                Initialize New Payroll Run
              </h2>
              <button
                onClick={() => setShowInitModal(false)}
                className="text-xs text-[#728294] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleCreateRun}
              className="p-5 space-y-3.5 text-xs font-sans"
            >
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">
                    Month (1 - 12) *
                  </label>
                  <select
                    required
                    value={runForm.month}
                    onChange={(e) =>
                      setRunForm({ ...runForm, month: e.target.value })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', {
                          month: 'long',
                        })}{' '}
                        ({i + 1})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">
                    Year *
                  </label>
                  <input
                    type="number"
                    required
                    min="2024"
                    max="2030"
                    value={runForm.year}
                    onChange={(e) =>
                      setRunForm({ ...runForm, year: e.target.value })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowInitModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono shadow-xs"
                >
                  {actionLoading ? 'Initializing...' : 'Confirm & Calculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Payroll Settings & Salary Types (Functional) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">
                Payroll Settings & Salary Types
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-xs text-[#728294] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs font-sans">
              {/* Existing Salary Types List */}
              <div className="space-y-2">
                <span className="font-bold text-[#111C2E] uppercase font-mono text-[10px] block">
                  ACTIVE SALARY STRUCTURE TYPES
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {salaryTypes.length === 0 ? (
                    <div className="text-[11px] text-[#728294] font-mono p-2 bg-[#FAF8F5] rounded border border-[#E3DED4]">
                      Standard Fixed Monthly salary structure active by default.
                    </div>
                  ) : (
                    salaryTypes.map((t) => (
                      <div
                        key={t._id}
                        className="flex justify-between items-center p-2 rounded bg-[#FAF8F5] border border-[#E3DED4]"
                      >
                        <span className="font-semibold text-[#111C2E]">
                          {t.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#8C5D17] bg-white px-1.5 py-0.5 border border-[#D5CEC2] rounded">
                          {t.type}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add New Salary Type */}
              <form
                onSubmit={handleCreateSalaryType}
                className="space-y-3 pt-2 border-t border-[#E3DED4]"
              >
                <span className="font-bold text-[#111C2E] uppercase font-mono text-[10px] block">
                  + CONFIGURE NEW SALARY TYPE
                </span>
                {actionError && (
                  <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                    {actionError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#111C2E] block">
                      Type Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sales Commission Base"
                      value={salaryTypeForm.name}
                      onChange={(e) =>
                        setSalaryTypeForm({
                          ...salaryTypeForm,
                          name: e.target.value,
                        })
                      }
                      className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#111C2E] block">
                      Type Model *
                    </label>
                    <select
                      value={salaryTypeForm.type}
                      onChange={(e) =>
                        setSalaryTypeForm({
                          ...salaryTypeForm,
                          type: e.target.value,
                        })
                      }
                      className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                    >
                      <option value="FIXED_MONTHLY">Fixed Monthly</option>
                      <option value="HOURLY">Hourly Rate</option>
                      <option value="PER_UNIT">Per Unit Output</option>
                      <option value="PERFORMANCE_BASED">
                        Performance Metric
                      </option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono shadow-xs"
                  >
                    {actionLoading ? 'Saving...' : 'Save Salary Type'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
