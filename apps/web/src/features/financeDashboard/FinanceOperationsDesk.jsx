import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function FinanceOperationsDesk() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'claims' | 'my-claims'
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [claimsQueue, setClaimsQueue] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  // Modals / Drawers
  const [isOpExModalOpen, setIsOpExModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isNewClaimModalOpen, setIsNewClaimModalOpen] = useState(false);
  const [rejectingClaimId, setRejectingClaimId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form states
  const [opExForm, setOpExForm] = useState({ title: '', category: 'MISCELLANEOUS', amount: '', notes: '' });
  const [incomeForm, setIncomeForm] = useState({ title: '', source: 'CLIENT_RETAINER', amount: '', notes: '' });
  const [claimForm, setClaimForm] = useState({ category: 'TRAVEL', amount: '', description: '' });

  const [feedback, setFeedback] = useState({ text: '', ok: true });

  // 1. Fetch Overview Metrics
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/finance/dashboard');
      setMetrics(res.data?.data || null);
    } catch (err) {
      console.warn('Failed to load finance dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Claims Approval Queue
  const fetchClaimsQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/expenses/queue?status=${statusFilter}`);
      setClaimsQueue(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load claims queue:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // 3. Fetch Personal Claims
  const fetchMyClaims = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/expenses/my-claims');
      setMyClaims(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load personal claims:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'claims') fetchClaimsQueue();
    if (activeTab === 'my-claims') fetchMyClaims();
  }, [activeTab, fetchOverview, fetchClaimsQueue, fetchMyClaims]);

  // Handle Claims Actions (Approve / Reject)
  const handleReviewClaim = async (id, action, reason = '') => {
    try {
      await apiClient.patch(`/expenses/${id}/action`, {
        action,
        rejectionReason: reason,
      });
      setFeedback({ text: `Claim ${action.toLowerCase()}d successfully.`, ok: true });
      setRejectingClaimId(null);
      setRejectionReason('');
      fetchClaimsQueue();
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || `Failed to ${action.toLowerCase()} claim.`, ok: false });
    }
  };

  // Submit OpEx
  const handleCreateOpEx = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/finance/expenses', opExForm);
      setFeedback({ text: 'Operational expense logged successfully.', ok: true });
      setIsOpExModalOpen(false);
      setOpExForm({ title: '', category: 'MISCELLANEOUS', amount: '', notes: '' });
      fetchOverview();
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || 'Failed to record expense.', ok: false });
    }
  };

  // Submit Income
  const handleCreateIncome = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/finance/income', incomeForm);
      setFeedback({ text: 'Company income recorded successfully.', ok: true });
      setIsIncomeModalOpen(false);
      setIncomeForm({ title: '', source: 'CLIENT_RETAINER', amount: '', notes: '' });
      fetchOverview();
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || 'Failed to record income.', ok: false });
    }
  };

  // Submit Expense Claim
  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/expenses', claimForm);
      setFeedback({ text: 'Expense claim dispatched for manager approval.', ok: true });
      setIsNewClaimModalOpen(false);
      setClaimForm({ category: 'TRAVEL', amount: '', description: '' });
      if (activeTab === 'my-claims') fetchMyClaims();
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || 'Failed to submit claim.', ok: false });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            FISCAL TELEMETRY & DISBURSEMENTS // FINOPS
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Financial Operations Desk
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Manage operational burn rates, company income streams, and employee reimbursement queues.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpExModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#D8D3C7] text-xs font-mono font-bold rounded cursor-pointer transition-all"
          >
            + Add OpEx
          </button>
          <button
            onClick={() => setIsIncomeModalOpen(true)}
            className="px-3 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-all"
          >
            + Record Income
          </button>
        </div>
      </div>

      {feedback.text && (
        <div className={`p-3 rounded text-xs font-mono border ${
          feedback.ok ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]' : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#E3DED4] gap-6 text-xs font-mono">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          FINANCIAL P&L SUMMARY
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-2.5 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'claims'
              ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          <span>REIMBURSEMENT QUEUE</span>
          {claimsQueue.filter((c) => c.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#8C5D17] text-white rounded-full text-[9px]">
              {claimsQueue.filter((c) => c.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-claims')}
          className={`pb-2.5 transition-all cursor-pointer ${
            activeTab === 'my-claims'
              ? 'border-b-2 border-[#8C5D17] font-bold text-[#16233B]'
              : 'text-[#728294] hover:text-[#16233B]'
          }`}
        >
          MY EXPENSE CLAIMS
        </button>
      </div>

      {/* TAB 1: P&L SUMMARY & CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">Total Revenue</span>
              <div className="text-xl font-bold font-mono text-[#1E7E34] mt-1">
                {(metrics?.totalIncome || 0).toLocaleString()} <span className="text-xs font-normal text-[#728294]">PKR</span>
              </div>
              <span className="text-[9.5px] font-mono text-[#728294] mt-1 block">YTD Income streams</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">Payroll Burden</span>
              <div className="text-xl font-bold font-mono text-[#B83E28] mt-1">
                {(metrics?.totalPayroll || 0).toLocaleString()} <span className="text-xs font-normal text-[#728294]">PKR</span>
              </div>
              <span className="text-[9.5px] font-mono text-[#728294] mt-1 block">Direct salary liabilities</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">Operational Expenses (OpEx)</span>
              <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">
                {(metrics?.totalOpEx || 0).toLocaleString()} <span className="text-xs font-normal text-[#728294]">PKR</span>
              </div>
              <span className="text-[9.5px] font-mono text-[#728294] mt-1 block">Overheads & reimbursements</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
              <span className="text-[10px] font-mono text-[#728294] uppercase block">Net Margin Ratio</span>
              <div className={`text-xl font-bold font-mono mt-1 ${
                (metrics?.netMargin || 0) >= 0 ? 'text-[#1E7E34]' : 'text-[#B83E28]'
              }`}>
                {(metrics?.netMargin || 0).toFixed(1)}%
              </div>
              <span className="text-[9.5px] font-mono text-[#728294] mt-1 block">
                Net: {((metrics?.totalIncome || 0) - (metrics?.totalPayroll || 0) - (metrics?.totalOpEx || 0)).toLocaleString()} PKR
              </span>
            </div>
          </div>

          {/* Quick Ledger Breakdown */}
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-[#16233B]">Monthly Cash Flow Trend & Telemetry</h3>
            <p className="text-xs text-[#728294] mt-0.5 font-mono">
              Consolidated calculations from Payroll, OpEx ledger, and Enterprise retainers.
            </p>
            <div className="mt-4 py-8 text-center text-xs font-mono text-[#728294] border border-dashed border-[#E3DED4] rounded">
              Telemetry synchronized with backend aggregation pipeline.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REIMBURSEMENT APPROVAL QUEUE */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-lg border border-[#E3DED4]">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#728294]">Filter by Status:</span>
              {['PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#16233B] text-white'
                      : 'bg-[#FAF8F5] border border-[#E3DED4] text-[#728294] hover:text-[#16233B]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Claims Table */}
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[10px] text-[#728294] uppercase">
                  <tr>
                    <th className="py-3 px-4">Claimant Employee</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#728294]">
                        Querying claims approval queue...
                      </td>
                    </tr>
                  ) : claimsQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#728294]">
                        No {statusFilter.toLowerCase()} expense claims in this tenant.
                      </td>
                    </tr>
                  ) : (
                    claimsQueue.map((claim) => {
                      const emp = claim.employeeId || {};
                      const isSelf = emp.userId?.toString() === user?._id?.toString();

                      return (
                        <tr key={claim._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                          <td className="py-3 px-4 font-sans">
                            <div className="font-bold text-[#16233B] text-xs">
                              {emp.firstName ? `${emp.firstName} ${emp.lastName || ''}` : 'Employee'}
                            </div>
                            <div className="text-[10px] font-mono text-[#728294]">{emp.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[9.5px] px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] font-bold text-[#8C5D17]">
                              {claim.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-[#16233B]">
                            {claim.amount?.toLocaleString()} PKR
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate text-[#5B6B79] font-sans text-xs">
                            {claim.description}
                          </td>
                          <td className="py-3 px-3 text-[#728294]">
                            {new Date(claim.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                              claim.status === 'APPROVED'
                                ? 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]'
                                : claim.status === 'REJECTED'
                                ? 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]'
                                : 'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]'
                            }`}>
                              {claim.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {claim.status === 'PENDING' ? (
                              isSelf ? (
                                <span className="text-[9.5px] text-[#728294] italic">Self-Claim Guard</span>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleReviewClaim(claim._id, 'APPROVE')}
                                    className="px-2 py-1 bg-[#1E7E34] hover:bg-[#18662A] text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setRejectingClaimId(claim._id)}
                                    className="px-2 py-1 bg-[#B83E28] hover:bg-[#97321F] text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )
                            ) : (
                              <span className="text-[10px] text-[#728294]">
                                {claim.approvedBy?.name ? `By ${claim.approvedBy.name}` : 'Closed'}
                              </span>
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

      {/* TAB 3: MY EXPENSE CLAIMS */}
      {activeTab === 'my-claims' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3.5 rounded-lg border border-[#E3DED4]">
            <span className="text-xs font-mono text-[#728294]">Self-Service Claims Archive</span>
            <button
              onClick={() => setIsNewClaimModalOpen(true)}
              className="px-3 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer"
            >
              + Submit New Claim
            </button>
          </div>

          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[10px] text-[#728294] uppercase">
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Submission Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Remarks / Rejection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA]">
                  {myClaims.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#728294]">
                        You haven't submitted any expense claims yet.
                      </td>
                    </tr>
                  ) : (
                    myClaims.map((c) => (
                      <tr key={c._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#8C5D17]">{c.category}</td>
                        <td className="py-3 px-3 font-bold text-[#16233B]">{c.amount?.toLocaleString()} PKR</td>
                        <td className="py-3 px-3 text-[#5B6B79] font-sans text-xs">{c.description}</td>
                        <td className="py-3 px-3 text-[#728294]">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                            c.status === 'APPROVED' ? 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]' :
                            c.status === 'REJECTED' ? 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]' :
                            'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#B83E28] text-xs font-sans">
                          {c.rejectionReason || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add OpEx */}
      {isOpExModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 max-w-md w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#16233B]">Record Operational Expense</h3>
            <form onSubmit={handleCreateOpEx} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  value={opExForm.title}
                  onChange={(e) => setOpExForm({ ...opExForm, title: e.target.value })}
                  placeholder="e.g. AWS Cloud Hosting Bill"
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Category</label>
                  <select
                    value={opExForm.category}
                    onChange={(e) => setOpExForm({ ...opExForm, category: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                  >
                    <option value="UTILITIES">Utilities</option>
                    <option value="OFFICE_SUPPLIES">Office Supplies</option>
                    <option value="SOFTWARE_SAAS">Software & SaaS</option>
                    <option value="RENT">Rent & Lease</option>
                    <option value="TRAVEL">Corporate Travel</option>
                    <option value="MISCELLANEOUS">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={opExForm.amount}
                    onChange={(e) => setOpExForm({ ...opExForm, amount: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Notes / Ledger Details</label>
                <textarea
                  rows="2"
                  value={opExForm.notes}
                  onChange={(e) => setOpExForm({ ...opExForm, notes: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpExModalOpen(false)}
                  className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294] font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded cursor-pointer"
                >
                  Record OpEx
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Income */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 max-w-md w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#16233B]">Record Enterprise Income</h3>
            <form onSubmit={handleCreateIncome} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Income Title</label>
                <input
                  type="text"
                  required
                  value={incomeForm.title}
                  onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
                  placeholder="e.g. European Client Retainer Q3"
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Source</label>
                  <select
                    value={incomeForm.source}
                    onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                  >
                    <option value="CLIENT_RETAINER">Client Retainer</option>
                    <option value="PROJECT_MILESTONE">Project Milestone</option>
                    <option value="CONSULTING">Consulting</option>
                    <option value="INVESTMENT_RETURN">Investment Return</option>
                    <option value="MISCELLANEOUS">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIncomeModalOpen(false)}
                  className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294] font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E7E34] hover:bg-[#18662A] text-white font-mono font-bold rounded cursor-pointer"
                >
                  Record Income
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Submit Claim */}
      {isNewClaimModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 max-w-md w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#16233B]">Submit Expense Claim</h3>
            <form onSubmit={handleSubmitClaim} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Category</label>
                  <select
                    value={claimForm.category}
                    onChange={(e) => setClaimForm({ ...claimForm, category: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                  >
                    <option value="TRAVEL">Travel / Taxi</option>
                    <option value="MEALS">Client Meals</option>
                    <option value="FUEL">Fuel / Transport</option>
                    <option value="MEDICAL">Medical Allowance</option>
                    <option value="OFFICE_SUPPLY">Stationery / Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={claimForm.amount}
                    onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">Business Purpose & Details</label>
                <textarea
                  rows="3"
                  required
                  value={claimForm.description}
                  onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                  placeholder="Explain the expense business justification..."
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewClaimModalOpen(false)}
                  className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294] font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded cursor-pointer"
                >
                  Dispatch Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reject Reason */}
      {rejectingClaimId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 max-w-sm w-full shadow-lg font-sans">
            <h3 className="text-sm font-bold text-[#B83E28]">Reject Expense Claim</h3>
            <p className="text-xs text-[#728294] mt-1 font-mono">
              Provide a clear audit reason for rejecting this claim.
            </p>
            <div className="mt-3">
              <textarea
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Missing valid tax invoice or exceeds policy limit."
                className="w-full p-2 text-xs border border-[#D8D3C7] rounded outline-none focus:border-[#B83E28]"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3 text-xs font-mono">
              <button
                onClick={() => {
                  setRejectingClaimId(null);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewClaim(rejectingClaimId, 'REJECT', rejectionReason)}
                disabled={!rejectionReason.trim()}
                className="px-4 py-1.5 bg-[#B83E28] hover:bg-[#97321F] text-white font-bold rounded cursor-pointer disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}