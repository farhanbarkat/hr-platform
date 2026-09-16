import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoanManagementDesk() {
  const { user, isSuperAdmin, isCompanyAdmin } = useAuth();

  const isHRorAdmin =
    isSuperAdmin ||
    isCompanyAdmin ||
    ['HR', 'ADMIN', 'COMPANY_ADMIN'].includes(String(user?.role || '').toUpperCase());

  const [activeTab, setActiveTab] = useState(isHRorAdmin ? 'company-loans' : 'my-loans');
  const [loading, setLoading] = useState(false);
  const [companyLoans, setCompanyLoans] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [preApprovalModal, setPreApprovalModal] = useState(null); // { loan, flags, payoffDate }
  const [rejectModalLoanId, setRejectModalLoanId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [repaymentsDrawer, setRepaymentsDrawer] = useState(null); // { loan, items: [] }

  // Apply Form State
  const [applyForm, setApplyForm] = useState({
    principal: '',
    tenureMonths: 12,
    purpose: '',
  });

  const [feedback, setFeedback] = useState({ text: '', ok: true });

  // 1. Fetch Company Loans (HR / Admin)
  const fetchCompanyLoans = useCallback(async () => {
    try {
      setLoading(true);
      let query = '/loans';
      if (statusFilter) query += `?status=${statusFilter}`;
      const res = await apiClient.get(query);
      setCompanyLoans(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to fetch company loans:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // 2. Fetch Personal Loans (ESS)
  const fetchMyLoans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/loans/my-loans');
      setMyLoans(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to fetch personal loans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'company-loans' && isHRorAdmin) {
      fetchCompanyLoans();
    } else {
      fetchMyLoans();
    }
  }, [activeTab, isHRorAdmin, fetchCompanyLoans, fetchMyLoans]);

  // Handle Apply Loan (ESS)
  const handleApplyLoan = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setFeedback({ text: '', ok: true });

      await apiClient.post('/loans/apply', {
        principal: parseFloat(applyForm.principal),
        tenureMonths: parseInt(applyForm.tenureMonths, 10),
        purpose: applyForm.purpose,
      });

      setFeedback({ text: 'Loan application submitted successfully.', ok: true });
      setIsApplyModalOpen(false);
      setApplyForm({ principal: '', tenureMonths: 12, purpose: '' });
      fetchMyLoans();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to submit loan application.',
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Pre-Approval Check
  const handleCheckPreApproval = async (loanId) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/loans/pre-approval-check/${loanId}`);
      setPreApprovalModal(res.data?.data || null);
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Pre-approval check failed.',
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Process Approval or Rejection
  const handleProcessDecision = async (loanId, decision, reason = '') => {
    try {
      setLoading(true);
      await apiClient.patch(`/loans/${loanId}/approval`, {
        decision,
        rejectionReason: reason,
      });

      setFeedback({
        text: `Loan has been ${decision.toLowerCase()} successfully.`,
        ok: true,
      });

      setPreApprovalModal(null);
      setRejectModalLoanId(null);
      setRejectionReason('');
      fetchCompanyLoans();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || `Failed to process loan ${decision}.`,
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Repayment History
  const handleViewRepayments = async (loan) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/loans/${loan._id}/repayments`);
      setRepaymentsDrawer({
        loan,
        items: res.data?.data || [],
      });
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to retrieve repayment ledger.',
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Portfolio KPIs (Admin)
  const totalDisbursed = companyLoans
    .filter((l) => ['APPROVED', 'COMPLETED'].includes(l.status))
    .reduce((acc, l) => acc + (parseFloat(l.principal?.toString()) || 0), 0);

  const totalOutstanding = companyLoans
    .filter((l) => l.status === 'APPROVED')
    .reduce((acc, l) => acc + (parseFloat(l.remainingBalance?.toString()) || 0), 0);

  const pendingCount = companyLoans.filter((l) => l.status === 'APPLIED').length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            CAPITAL DISBURSEMENTS & PAYROLL ADVANCES // LOAN DESK
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Loan & Advance Management
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Administer enterprise loan sanctions, contract expiry risk evaluations, and automatic monthly EMI payroll deductions.
          </p>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-all shadow-xs"
        >
          + APPLY FOR LOAN
        </button>
      </div>

      {feedback.text && (
        <div
          className={`p-3 rounded text-xs font-mono border ${
            feedback.ok
              ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]'
              : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#E3DED4] gap-6 text-xs font-mono">
        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('company-loans')}
            className={`pb-2.5 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'company-loans'
                ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
                : 'text-[#728294] hover:text-[#16233B]'
            }`}
          >
            <span>COMPANY DISBURSEMENT DIRECTORY</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#8C5D17] text-white rounded-full text-[9px]">
                {pendingCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('my-loans')}
          className={`pb-2.5 transition-all cursor-pointer ${
            activeTab === 'my-loans'
              ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          MY LOAN PORTFOLIO (ESS)
        </button>
      </div>

      {/* TAB 1: COMPANY LOANS DIRECTORY (ADMIN/HR) */}
      {activeTab === 'company-loans' && isHRorAdmin && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">
                Total Sanctioned Principal
              </span>
              <div className="text-xl font-bold font-mono text-[#16233B] mt-1">
                {totalDisbursed.toLocaleString()}{' '}
                <span className="text-xs font-normal text-[#728294]">PKR</span>
              </div>
              <span className="text-[9.5px] font-mono text-[#1E7E34] mt-1 block">
                Active & completed lifecycles
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">
                Outstanding Principal Due
              </span>
              <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">
                {totalOutstanding.toLocaleString()}{' '}
                <span className="text-xs font-normal text-[#728294]">PKR</span>
              </div>
              <span className="text-[9.5px] font-mono text-[#728294] mt-1 block">
                Scheduled for payroll EMI recovery
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">
                Pending Loan Petitions
              </span>
              <div className="text-xl font-bold font-mono text-[#B83E28] mt-1">
                {pendingCount}
              </div>
              <span className="text-[9.5px] font-mono text-[#728294] mt-1 block">
                Awaiting pre-approval evaluation
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-lg border border-[#E3DED4]">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#728294]">Filter Status:</span>
              {['', 'APPLIED', 'APPROVED', 'COMPLETED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#16233B] text-white'
                      : 'bg-[#FAF8F5] border border-[#E3DED4] text-[#728294] hover:text-[#16233B]'
                  }`}
                >
                  {st || 'ALL'}
                </button>
              ))}
            </div>
          </div>

          {/* Loans Directory Table */}
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[10px] text-[#728294] uppercase">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Principal</th>
                    <th className="py-3 px-3">Tenure / Monthly EMI</th>
                    <th className="py-3 px-3">Remaining Balance</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Applied Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#728294]">
                        Querying loan ledger telemetry...
                      </td>
                    </tr>
                  ) : companyLoans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#728294]">
                        No loans match the current filter.
                      </td>
                    </tr>
                  ) : (
                    companyLoans.map((l) => {
                      const emp = l.employeeId || {};
                      const principal = parseFloat(l.principal?.toString() || 0);
                      const balance = parseFloat(l.remainingBalance?.toString() || 0);
                      const emi = parseFloat(l.monthlyEmi?.toString() || 0);

                      return (
                        <tr key={l._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                          <td className="py-3 px-4 font-sans">
                            <div className="font-bold text-[#16233B] text-xs">
                              {emp.firstName ? `${emp.firstName} ${emp.lastName || ''}` : 'Employee'}
                            </div>
                            <div className="text-[10px] font-mono text-[#728294]">
                              {emp.employeeId || emp.email || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-bold text-[#16233B]">
                            {principal.toLocaleString()} PKR
                          </td>
                          <td className="py-3 px-3">
                            <div>{l.tenureMonths} Months</div>
                            <span className="text-[10px] text-[#8C5D17] font-semibold">
                              {emi.toLocaleString()} PKR/mo
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-[#16233B]">
                              {balance.toLocaleString()} PKR
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                l.status === 'APPROVED'
                                  ? 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]'
                                  : l.status === 'COMPLETED'
                                  ? 'bg-[#FAF8F5] text-[#16233B] border-[#D8D3C7]'
                                  : l.status === 'REJECTED'
                                  ? 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]'
                                  : 'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]'
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#728294]">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            {l.status === 'APPLIED' ? (
                              <button
                                onClick={() => handleCheckPreApproval(l._id)}
                                className="px-2.5 py-1 bg-[#16233B] hover:bg-[#101A2B] text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Review & Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleViewRepayments(l)}
                                className="px-2 py-1 bg-white hover:bg-[#FAF8F5] border border-[#D8D3C7] text-[#16233B] rounded text-[10px] font-bold cursor-pointer"
                              >
                                View Ledger
                              </button>
                            )}
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
      )}

      {/* TAB 2: MY LOANS (ESS VIEW) */}
      {activeTab === 'my-loans' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-[#16233B]">Active & Historical Advances</h3>
            <p className="text-xs text-[#728294] mt-0.5 font-mono">
              Monthly EMIs are automatically deducted from your payroll during the monthly salary run.
            </p>

            <div className="mt-4 space-y-3">
              {myLoans.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-[#728294] border border-dashed border-[#E3DED4] rounded">
                  You have no loan or salary advance records.
                </div>
              ) : (
                myLoans.map((l) => {
                  const principal = parseFloat(l.principal?.toString() || 0);
                  const balance = parseFloat(l.remainingBalance?.toString() || 0);
                  const emi = parseFloat(l.monthlyEmi?.toString() || 0);
                  const paid = principal - balance;
                  const percentPaid = principal > 0 ? Math.min(100, Math.round((paid / principal) * 100)) : 0;

                  return (
                    <div key={l._id} className="p-4 bg-[#FAF8F5] border border-[#E3DED4] rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-[#16233B] font-mono">
                              {principal.toLocaleString()} PKR
                            </span>
                            <span
                              className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${
                                l.status === 'APPROVED'
                                  ? 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]'
                                  : l.status === 'COMPLETED'
                                  ? 'bg-white text-[#16233B] border-[#D8D3C7]'
                                  : l.status === 'REJECTED'
                                  ? 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]'
                                  : 'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]'
                              }`}
                            >
                              {l.status}
                            </span>
                          </div>
                          <div className="text-xs text-[#5B6B79] mt-1 font-sans">
                            Purpose: <span className="text-[#16233B]">{l.purpose || 'Personal Support'}</span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right font-mono text-xs">
                          <span className="text-[#728294] block text-[10px]">MONTHLY RECOVERY:</span>
                          <span className="font-bold text-[#8C5D17]">
                            {emi.toLocaleString()} PKR / Month
                          </span>
                        </div>
                      </div>

                      {/* Repayment Progress Bar */}
                      {l.status === 'APPROVED' && (
                        <div className="mt-4 pt-3 border-t border-[#E3DED4]/60">
                          <div className="flex justify-between text-[10px] font-mono text-[#728294] mb-1">
                            <span>Paid: {paid.toLocaleString()} PKR ({percentPaid}%)</span>
                            <span>Remaining Balance: {balance.toLocaleString()} PKR</span>
                          </div>
                          <div className="w-full h-2 bg-[#E3DED4] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1E7E34] rounded-full transition-all duration-500"
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {l.rejectionReason && (
                        <div className="mt-2 p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-[11px] font-sans">
                          Reason: {l.rejectionReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: APPLY FOR LOAN (ESS) */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-6 max-w-md w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#16233B]">Apply for Company Advance / Loan</h3>
            <p className="text-xs text-[#728294] mt-1 font-mono">
              Subject to company policy and active employment contract validation.
            </p>

            <form onSubmit={handleApplyLoan} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Requested Principal (PKR)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="500"
                  value={applyForm.principal}
                  onChange={(e) => setApplyForm({ ...applyForm, principal: e.target.value })}
                  placeholder="e.g. 150000"
                  className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Tenure (Months)
                </label>
                <select
                  value={applyForm.tenureMonths}
                  onChange={(e) => setApplyForm({ ...applyForm, tenureMonths: e.target.value })}
                  className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                >
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={24}>24 Months (2 Years)</option>
                </select>
              </div>

              {/* Live EMI calculation preview */}
              {applyForm.principal && (
                <div className="p-3 bg-[#FAF8F5] border border-[#E3DED4] rounded text-xs font-mono">
                  <span className="text-[#728294] block text-[9.5px]">ESTIMATED MONTHLY EMI:</span>
                  <span className="text-base font-bold text-[#8C5D17]">
                    {(parseFloat(applyForm.principal) / parseInt(applyForm.tenureMonths, 10)).toFixed(2)}{' '}
                    PKR / mo
                  </span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Reason / Purpose of Advance
                </label>
                <textarea
                  rows="2"
                  required
                  value={applyForm.purpose}
                  onChange={(e) => setApplyForm({ ...applyForm, purpose: e.target.value })}
                  placeholder="Medical expenses, home renovation, education..."
                  className="w-full p-2.5 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 font-mono">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-3 py-2 border border-[#D8D3C7] rounded text-[#728294] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white font-bold rounded cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRE-APPROVAL AUDIT CHECK & DECISION (ADMIN/HR) */}
      {preApprovalModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-6 max-w-lg w-full shadow-lg font-sans">
            <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
              <div>
                <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#728294] font-bold">
                  PRE-APPROVAL RISK EVALUATION
                </span>
                <h3 className="text-sm font-bold text-[#16233B] mt-0.5">
                  Sanction Review:{' '}
                  {preApprovalModal.loan?.employeeId?.firstName}{' '}
                  {preApprovalModal.loan?.employeeId?.lastName}
                </h3>
              </div>
              <button
                onClick={() => setPreApprovalModal(null)}
                className="text-[#728294] hover:text-[#16233B] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAF8F5] rounded border border-[#E3DED4] font-mono">
                <div>
                  <span className="text-[#728294] block text-[9.5px]">PRINCIPAL:</span>
                  <span className="font-bold text-[#16233B]">
                    {parseFloat(preApprovalModal.loan?.principal?.toString() || 0).toLocaleString()} PKR
                  </span>
                </div>
                <div>
                  <span className="text-[#728294] block text-[9.5px]">TENURE & EMI:</span>
                  <span className="font-bold text-[#8C5D17]">
                    {preApprovalModal.loan?.tenureMonths} Mo @{' '}
                    {parseFloat(preApprovalModal.loan?.monthlyEmi?.toString() || 0).toLocaleString()}{' '}
                    PKR
                  </span>
                </div>
              </div>

              {/* Warning Flags */}
              {preApprovalModal.flags?.length > 0 ? (
                <div className="space-y-2">
                  {preApprovalModal.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#FAF4E8] border border-[#E8D4B5] text-[#8C5D17] rounded text-xs"
                    >
                      <div className="font-mono font-bold text-[10px] uppercase">
                        ⚠️ {flag.code} ({flag.severity})
                      </div>
                      <div className="mt-1 font-sans">{flag.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34] rounded text-xs font-mono">
                  ✓ No contract risk flags detected. Repayment concludes within contract tenure.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DED4] font-mono">
                <button
                  onClick={() => {
                    setRejectModalLoanId(preApprovalModal.loan._id);
                    setPreApprovalModal(null);
                  }}
                  className="px-3 py-1.5 bg-[#B83E28] hover:bg-[#97321F] text-white font-bold rounded cursor-pointer text-xs"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleProcessDecision(preApprovalModal.loan._id, 'APPROVED')}
                  disabled={loading}
                  className="px-4 py-1.5 bg-[#1E7E34] hover:bg-[#18662A] text-white font-bold rounded cursor-pointer text-xs disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Approve & Sanction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REJECTION REASON */}
      {rejectModalLoanId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 max-w-sm w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#B83E28]">Reject Loan Petition</h3>
            <p className="text-xs text-[#728294] mt-1 font-mono">
              Audit reason required for employee portal record.
            </p>
            <div className="mt-3">
              <textarea
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contract tenure insufficient, probation period, or policy threshold..."
                className="w-full p-2 text-xs border border-[#D8D3C7] rounded outline-none focus:border-[#B83E28]"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3 text-xs font-mono">
              <button
                onClick={() => {
                  setRejectModalLoanId(null);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessDecision(rejectModalLoanId, 'REJECT', rejectionReason)}
                disabled={!rejectionReason.trim()}
                className="px-4 py-1.5 bg-[#B83E28] hover:bg-[#97321F] text-white font-bold rounded cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: REPAYMENT LEDGER (TICKET-030) */}
      {repaymentsDrawer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-xl overflow-y-auto border-l border-[#E3DED4] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-[#E3DED4]">
                <div>
                  <span className="text-[10px] font-mono text-[#728294] uppercase font-bold">
                    REPAYMENT AUDIT LEDGER
                  </span>
                  <h3 className="text-base font-bold text-[#16233B]">
                    {repaymentsDrawer.loan?.employeeId?.firstName}{' '}
                    {repaymentsDrawer.loan?.employeeId?.lastName}
                  </h3>
                </div>
                <button
                  onClick={() => setRepaymentsDrawer(null)}
                  className="text-gray-400 hover:text-gray-700 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="my-4 space-y-2">
                {repaymentsDrawer.items.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-[#728294]">
                    No payroll deductions executed yet for this loan.
                  </div>
                ) : (
                  repaymentsDrawer.items.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 bg-[#FAF8F5] border border-[#E3DED4] rounded text-xs font-mono space-y-1"
                    >
                      <div className="flex justify-between font-bold text-[#16233B]">
                        <span>Deduction: {parseFloat(item.amount?.toString() || 0).toLocaleString()} PKR</span>
                        <span className="text-[#1E7E34]">PROCESSED ✓</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-[#728294]">
                        <span>
                          Principal: {parseFloat(item.principalBefore?.toString() || 0).toLocaleString()} &rarr;{' '}
                          {parseFloat(item.principalAfter?.toString() || 0).toLocaleString()} PKR
                        </span>
                        <span>{new Date(item.repaymentDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setRepaymentsDrawer(null)}
              className="w-full py-2 bg-[#16233B] text-white text-xs font-mono font-bold rounded cursor-pointer mt-4"
            >
              Close Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}