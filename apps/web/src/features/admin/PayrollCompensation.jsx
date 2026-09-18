import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { PayslipViewerModal, PayslipAdjustmentModal } from '../payroll/index.js';

export default function PayrollCompensation() {
  const { user, isSuperAdmin, hasPermission } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState('');

  // Modular Modals State
  const [inspectSlip, setInspectSlip] = useState(null);
  const [adjustingSlip, setAdjustingSlip] = useState(null);

  const canManagePayroll =
    isSuperAdmin ||
    user?.role === 'COMPANY_ADMIN' ||
    user?.role === 'ADMIN' ||
    hasPermission(PERMISSIONS.PAYROLL.CREATE) ||
    hasPermission(PERMISSIONS.PAYROLL.RUN);

  // 1. Fetch Runs List
  const fetchRuns = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await apiClient.get('/payroll/runs');
      const runsList = res.data?.data || [];
      setRuns(runsList);

      const matched = runsList.find(
        (r) => r.period?.month === Number(selectedMonth) && r.period?.year === Number(selectedYear)
      );

      if (matched) {
        setActiveRun(matched);
        fetchPayslipsForRun(matched._id);
      } else {
        setActiveRun(null);
        setPayslips([]);
      }
    } catch (err) {
      console.error('Failed to fetch payroll runs:', err);
      setRuns([]);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Payslips for Specific Run
  const fetchPayslipsForRun = async (runId) => {
    try {
      const res = await apiClient.get(`/payroll/runs/${runId}/payslips`);
      setPayslips(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch run payslips:', err);
      setPayslips([]);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [selectedMonth, selectedYear]);

  // 3. Stage 1 & 2: Calculate Run
  const handleRunPayroll = async () => {
    try {
      setExecuting(true);
      setFeedback(null);

      let runId = activeRun?._id;

      if (!runId) {
        const createRes = await apiClient.post('/payroll/runs', {
          month: Number(selectedMonth),
          year: Number(selectedYear),
        });
        runId = createRes.data?.data?._id;
      }

      await apiClient.post(`/payroll/runs/${runId}/calculate`);

      setFeedback({
        text: `Payroll calculated successfully for ${selectedMonth}/${selectedYear}. Ready for review.`,
        ok: true,
      });

      fetchRuns();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to process payroll calculation.',
        ok: false,
      });
    } finally {
      setExecuting(false);
    }
  };

  // 4. Stage 3: Approve & Lock Run
  const handleApprovePayroll = async () => {
    if (!activeRun?._id) return;
    if (!window.confirm('Are you sure you want to approve and lock this payroll run? This will finalize all payslips.')) return;

    try {
      setExecuting(true);
      setFeedback(null);
      await apiClient.post(`/payroll/runs/${activeRun._id}/approve`);
      setFeedback({
        text: `Payroll run approved and locked. Payslips released for disbursement.`,
        ok: true,
      });
      fetchRuns();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to approve payroll run.',
        ok: false,
      });
    } finally {
      setExecuting(false);
    }
  };

  // 5. Robust PDF Generation & Download
  const handleDownloadPdf = async (slip) => {
    try {
      setPdfLoadingId(slip._id);
      setFeedback(null);

      // Step A: Ensure PDF is generated on backend
      try {
        await apiClient.post(`/payslips/${slip._id}/generate-pdf`);
      } catch (genErr) {
        console.warn('PDF generation notice:', genErr);
      }

      // Step B: Fetch download URL
      const res = await apiClient.get(`/payslips/${slip._id}/download`);
      const downloadUrl = res.data?.data?.url || res.data?.data?.downloadUrl || res.data?.data;

      if (downloadUrl && typeof downloadUrl === 'string') {
        window.open(downloadUrl, '_blank');
      } else {
        // Fallback: Open in Inspect modal for direct printing
        setInspectSlip(slip);
        setFeedback({
          text: 'Opening printable voucher view for direct browser download.',
          ok: true,
        });
      }
    } catch (err) {
      setInspectSlip(slip);
      setFeedback({
        text: 'Cloud PDF engine offline. Opened printable payslip view for instant PDF saving.',
        ok: true,
      });
    } finally {
      setPdfLoadingId(null);
    }
  };

  const totalGross = payslips.reduce((acc, p) => acc + (Number(p.grossPay || p.earnings?.totalEarnings || p.earnings?.grossPay || 0)), 0);
  const totalDeductions = payslips.reduce((acc, p) => acc + (Number(p.totalDeductions || p.deductions?.totalDeductions || 0)), 0);
  const totalNet = payslips.reduce((acc, p) => acc + (Number(p.netPay || 0)), 0);

  const filteredPayslips = payslips.filter((slip) => {
    const emp = slip.employeeId;
    const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.toLowerCase();
    const code = (emp?.employeeCode || '').toLowerCase();
    const term = search.toLowerCase();
    return name.includes(term) || code.includes(term);
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            FINANCIAL ENGINE // COMPENSATION ORCHESTRATION
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Payroll & Compensation Desk
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Execute salary orchestrations, inspect granular payroll vouchers, and manage disbursements.
          </p>
        </div>

        {/* Date Filters & Trigger */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono font-bold text-[#16233B] focus:outline-none focus:border-[#8C5D17] shadow-2xs cursor-pointer"
          >
            {monthNames.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono font-bold text-[#16233B] focus:outline-none focus:border-[#8C5D17] shadow-2xs cursor-pointer"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {canManagePayroll && (
            <>
              {(!activeRun || activeRun.status === 'DRAFT' || activeRun.status === 'CALCULATED') && (
                <button
                  onClick={handleRunPayroll}
                  disabled={executing}
                  className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {executing ? 'ORCHESTRATING...' : activeRun?.status === 'CALCULATED' ? '↻ RE-CALCULATE' : '⚡ CALCULATE PAYROLL'}
                </button>
              )}

              {activeRun?.status === 'CALCULATED' && (
                <button
                  onClick={handleApprovePayroll}
                  disabled={executing}
                  className="px-4 py-1.5 bg-[#1E7E34] hover:bg-[#18662A] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  ✓ APPROVE & LOCK
                </button>
              )}
            </>
          )}
        </div>
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

      {/* 2. Top Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">CYCLE STATUS</span>
          <div className="text-xl font-bold font-mono text-[#16233B] mt-1">
            {activeRun ? activeRun.status : 'NOT STARTED'}
          </div>
          <div className="text-[10px] text-[#728294] mt-0.5">
            {activeRun?.lockedAt ? `Locked on ${new Date(activeRun.lockedAt).toLocaleDateString()}` : 'Awaiting calculation/approval'}
          </div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">TOTAL GROSS</span>
          <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">
            {totalGross.toLocaleString()} <span className="text-xs font-normal text-[#728294]">PKR</span>
          </div>
          <div className="text-[10px] text-[#728294] mt-0.5">Base compensation sum</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">TOTAL DEDUCTIONS</span>
          <div className="text-xl font-bold font-mono text-[#B83E28] mt-1">
            {totalDeductions.toLocaleString()} <span className="text-xs font-normal text-[#728294]">PKR</span>
          </div>
          <div className="text-[10px] text-[#B83E28] mt-0.5">Absents, leaves & loans</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">NET OUTFLOW</span>
          <div className="text-xl font-bold font-mono text-[#1E7E34] mt-1">
            {totalNet.toLocaleString()} <span className="text-xs font-normal text-[#728294]">PKR</span>
          </div>
          <div className="text-[10px] text-[#1E7E34] mt-0.5">Payable across {payslips.length} employees</div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-3 flex justify-between items-center shadow-2xs">
        <input
          type="text"
          placeholder="Search employee name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-1.5 border border-[#D8D3C7] rounded text-xs focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/40 font-sans"
        />
        <span className="text-xs font-mono text-[#728294]">
          Generated Slips: <b className="text-[#16233B]">{filteredPayslips.length}</b>
        </span>
      </div>

      {/* 4. Payslips Table */}
      <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Gross Pay</th>
                <th className="py-3 px-4">Total Deductions</th>
                <th className="py-3 px-4">Net Payable</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-xs text-[#728294]">
                    Synchronizing payroll run & payslips...
                  </td>
                </tr>
              ) : filteredPayslips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center select-none">
                    <div className="font-mono text-xs text-[#728294]">
                      No payslips found for {monthNames[selectedMonth - 1]} {selectedYear}.
                    </div>
                    <p className="text-[11px] text-[#8C9BAE] mt-1 max-w-md mx-auto">
                      Click "⚡ CALCULATE PAYROLL" above to trigger the payroll calculation orchestrator.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayslips.map((slip) => {
                  const emp = slip.employeeId;
                  const gross = Number(slip.grossPay || slip.earnings?.totalEarnings || slip.earnings?.grossPay || 0);
                  const deductions = Number(slip.totalDeductions || slip.deductions?.totalDeductions || 0);
                  const net = Number(slip.netPay || 0);
                  const isDownloading = pdfLoadingId === slip._id;

                  return (
                    <tr key={slip._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      {/* Employee Profile */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#16233B]">
                          {emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (slip.employeeName || 'Staff Member')}
                        </div>
                        <div className="text-[10px] font-mono text-[#728294]">
                          {emp?.employeeCode || 'EMP'} • {emp?.userId?.email || 'Active'}
                        </div>
                      </td>

                      {/* Gross */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#16233B]">
                        {gross.toLocaleString()} <span className="text-[10px] text-[#728294]">PKR</span>
                      </td>

                      {/* Deductions */}
                      <td className="py-3.5 px-4 font-mono text-[#B83E28]">
                        -{deductions.toLocaleString()} <span className="text-[10px] text-[#728294]">PKR</span>
                      </td>

                      {/* Net Pay */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1E7E34]">
                        {net.toLocaleString()} <span className="text-[10px] text-[#728294]">PKR</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase border ${
                          slip.status === 'APPROVED' || slip.status === 'PAID'
                            ? 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]'
                            : 'bg-[#FAF4E8] text-[#8C5D17] border-[#E3DED4]'
                        }`}>
                          {slip.status}
                        </span>
                      </td>

                      {/* Actions: Inspect & PDF */}
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => setInspectSlip(slip)}
                          className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#D8D3C7] text-[#16233B] text-[10px] font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
                        >
                          🔍 INSPECT
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(slip)}
                          disabled={isDownloading}
                          className="px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#8C5D17] text-[10px] font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                        >
                          {isDownloading ? 'GETTING...' : 'PDF ↓'}
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

      {/* Modular Inspect Modal */}
      <PayslipViewerModal
        slip={inspectSlip}
        onClose={() => setInspectSlip(null)}
        onAdjustmentTriggered={(slip) => {
          setInspectSlip(null);
          setAdjustingSlip(slip);
        }}
      />

      {/* Modular Post-Approval Adjustment Modal */}
      <PayslipAdjustmentModal
        slip={adjustingSlip}
        onClose={() => setAdjustingSlip(null)}
        onSuccess={fetchRuns}
      />

    </div>
  );
}   