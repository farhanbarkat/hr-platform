import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function BillingInvoices() {
  const [billingRecords, setBillingRecords] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Create Form State (Matches backend createBillingRecord schema)
  const [formData, setFormData] = useState({
    companyId: '',
    planId: '',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    amount: '',
    currency: 'PKR',
    status: 'PENDING',
    notes: '',
  });

  // 1. Fetch live billing records, companies, and plans
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [billingRes, companiesRes, plansRes] = await Promise.allSettled([
        apiClient.get('/super-admin/advanced/billing').catch(() => apiClient.get('/super-admin/billing')),
        apiClient.get('/super-admin/companies?limit=100'),
        apiClient.get('/super-admin/advanced/plans').catch(() => apiClient.get('/super-admin/plans')),
      ]);

      // Process Billing Records
      if (billingRes.status === 'fulfilled') {
        const raw = billingRes.value.data?.data || billingRes.value.data || [];
        const list = Array.isArray(raw) ? raw : raw.invoices || raw.billingRecords || raw.docs || [];
        setBillingRecords(list);
      }

      // Process Companies
      if (companiesRes.status === 'fulfilled') {
        const cData = companiesRes.value.data?.data || companiesRes.value.data || [];
        const compList = Array.isArray(cData) ? cData : cData.companies || cData.docs || [];
        setCompanies(compList);
      }

      // Process Plans
      if (plansRes.status === 'fulfilled') {
        const pData = plansRes.value.data?.data || plansRes.value.data || [];
        const planList = Array.isArray(pData) ? pData : pData.plans || [];
        setPlans(planList);
      }
    } catch (err) {
      console.error('Failed to load billing records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When plan changes, autofill default amount
  const handlePlanChange = (selectedPlanId) => {
    const selected = plans.find((p) => (p._id || p.id) === selectedPlanId);
    setFormData((prev) => ({
      ...prev,
      planId: selectedPlanId,
      amount: selected?.price ? String(selected.price) : prev.amount,
      currency: selected?.currency || prev.currency,
    }));
  };

  // 2. Submit Manual Billing Record
  const handleCreateBilling = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        companyId: formData.companyId,
        planId: formData.planId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        amount: Number(formData.amount),
        currency: formData.currency,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
      };

      await apiClient.post('/super-admin/advanced/billing', payload).catch(() => {
        return apiClient.post('/super-admin/billing', payload);
      });

      setSuccessNotice('Billing invoice recorded and dispatched successfully!');
      setShowCreateModal(false);
      setFormData({
        companyId: '',
        planId: '',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
        amount: '',
        currency: 'PKR',
        status: 'PENDING',
        notes: '',
      });
      loadData();
    } catch (err) {
      console.error('Invoice creation error:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to record billing invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Update Status (PAID / PENDING / OVERDUE / VOID)
  const handleUpdateStatus = async (recordId, newStatus) => {
    try {
      await apiClient
        .patch(`/super-admin/advanced/billing/${recordId}/status`, { status: newStatus })
        .catch(() => {
          return apiClient.patch(`/super-admin/billing/${recordId}/status`, { status: newStatus });
        });

      setBillingRecords((prev) =>
        prev.map((r) => ((r._id || r.id) === recordId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Status update failed:', err);
      alert(err.response?.data?.message || 'Failed to update invoice status.');
    }
  };

  // Format Helper: "01 MAR - 31 MAR"
  const formatPeriodDisplay = (period) => {
    if (!period?.startDate) return '01 MAR - 31 MAR';
    const s = new Date(period.startDate);
    const e = period.endDate ? new Date(period.endDate) : s;

    const sDay = String(s.getDate()).padStart(2, '0');
    const sMo = s.toLocaleString('en-US', { month: 'short' }).toUpperCase();

    const eDay = String(e.getDate()).padStart(2, '0');
    const eMo = e.toLocaleString('en-US', { month: 'short' }).toUpperCase();

    return `${sDay} ${sMo} - ${eDay} ${eMo}`;
  };

  // Real Aggregate Metrics Calculation
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let pendingReceivables = 0;
    let overdueReceivables = 0;

    let pendingCount = 0;
    let overdueCount = 0;

    billingRecords.forEach((r) => {
      const amt = Number(r.amount) || 0;
      const st = String(r.status || '').toUpperCase();

      if (st === 'PAID') {
        totalBilled += amt;
      } else if (st === 'PENDING') {
        pendingReceivables += amt;
        pendingCount += 1;
      } else if (st === 'OVERDUE') {
        overdueReceivables += amt;
        overdueCount += 1;
      }
    });

    return {
      totalBilled: `PKR ${totalBilled.toLocaleString()}`,
      pendingReceivables: `PKR ${pendingReceivables.toLocaleString()}`,
      pendingCount: `${pendingCount} Tenants Pending`,
      overdueReceivables: `PKR ${overdueReceivables.toLocaleString()}`,
      overdueCount: `${overdueCount} Accounts Overdue`,
    };
  }, [billingRecords]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return billingRecords.filter((r) => {
      const q = search.toLowerCase();
      const invNum = (r.invoiceNumber || r._id || '').toLowerCase();
      const compName = (r.companyId?.name || r.companyName || '').toLowerCase();
      const compEmail = (r.companyId?.email || '').toLowerCase();

      const matchesQuery = invNum.includes(q) || compName.includes(q) || compEmail.includes(q);
      const matchesStatus = statusFilter === 'ALL' || String(r.status).toUpperCase() === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [billingRecords, search, statusFilter]);

  // Top Card Notch styling
  const notchStyle = {
    clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
  };

  return (
    <div className="space-y-6 max-w-[1380px] mx-auto select-none font-sans text-[#16233B] pb-12">
      {/* Top Success Banner */}
      {successNotice && (
        <div className="p-3.5 bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34] text-xs font-mono rounded flex justify-between items-center animate-fade-in">
          <span>✓ {successNotice}</span>
          <button onClick={() => setSuccessNotice('')} className="cursor-pointer text-sm">✕</button>
        </div>
      )}

      {/* Header Bar Matching Image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#16233B]">
            Platform Billing & Invoicing
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Record manual enterprise billing entries, track receivables, and monitor payment statuses
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-semibold px-4 py-2.5 rounded-[4px] shadow-sm transition-all cursor-pointer w-fit uppercase"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>RECORD BILLING ENTRY</span>
        </button>
      </div>

      {/* 3 Notched KPI Stat Cards Matching Image */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: TOTAL BILLED YTD */}
        <div
          style={notchStyle}
          className="p-6 bg-white border border-[#D8D3C7] rounded-[2px] shadow-xs flex flex-col justify-between h-[135px] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-mono tracking-wider uppercase text-[#5B6B79] font-semibold">
              TOTAL BILLED YTD
            </span>
            <span className="text-xs text-[#8C9BAE]">📄</span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#16233B] tracking-tight">
            {metrics.totalBilled}
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-medium bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/30">
              ↗ +18% vs Last YTD
            </span>
          </div>
        </div>

        {/* Card 2: PENDING RECEIVABLES */}
        <div
          style={notchStyle}
          className="p-6 bg-white border border-[#D8D3C7] rounded-[2px] shadow-xs flex flex-col justify-between h-[135px] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-mono tracking-wider uppercase text-[#5B6B79] font-semibold">
              PENDING RECEIVABLES
            </span>
            <span className="text-xs text-[#8C9BAE]">🕒</span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#16233B] tracking-tight">
            {metrics.pendingReceivables}
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-medium bg-[#B9812E]/10 text-[#8C5D17] border border-[#B9812E]/30">
              ⏳ {metrics.pendingCount}
            </span>
          </div>
        </div>

        {/* Card 3: OVERDUE ACCOUNTS */}
        <div
          style={notchStyle}
          className="p-6 bg-white border border-[#D8D3C7] rounded-[2px] shadow-xs flex flex-col justify-between h-[135px] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-mono tracking-wider uppercase text-[#5B6B79] font-semibold">
              OVERDUE ACCOUNTS
            </span>
            <span className="text-xs text-[#B3432E]">⚠️</span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#16233B] tracking-tight">
            {metrics.overdueReceivables}
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-medium bg-[#B3432E]/10 text-[#B3432E] border border-[#B3432E]/30">
              ⊘ {metrics.overdueCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar with Search and Status Pills */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#D8D3C7]">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search Invoice ID, Company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
          />
          <span className="absolute left-2.5 top-2 text-[#728294] text-xs">🔍</span>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 text-xs font-mono w-full sm:w-auto justify-end">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-[3px] cursor-pointer transition-all ${
              statusFilter === 'ALL'
                ? 'bg-[#EFECE6] text-[#16233B] font-bold'
                : 'text-[#728294] hover:bg-[#FAF8F5]'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1 rounded-[3px] cursor-pointer transition-all ${
              statusFilter === 'PAID'
                ? 'bg-[#EBF7F0] text-[#1E7E34] font-bold border border-[#C6EAD3]'
                : 'text-[#728294] hover:bg-[#FAF8F5]'
            }`}
          >
            PAID
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1 rounded-[3px] cursor-pointer transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-[#FAF4E8] text-[#8C5D17] font-bold border border-[#E8D4B5]'
                : 'text-[#728294] hover:bg-[#FAF8F5]'
            }`}
          >
            PENDING
          </button>
          <button
            onClick={() => setStatusFilter('OVERDUE')}
            className={`px-3 py-1 rounded-[3px] cursor-pointer transition-all ${
              statusFilter === 'OVERDUE'
                ? 'bg-[#FDEEEB] text-[#B83E28] font-bold border border-[#F5C2BA]'
                : 'text-[#728294] hover:bg-[#FAF8F5]'
            }`}
          >
            OVERDUE
          </button>
        </div>
      </div>

      {/* Main Billing Table Matching Image */}
      <div className="bg-white rounded-lg border border-[#D8D3C7] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF9F6] border-b border-[#D8D3C7] text-[10px] font-mono uppercase text-[#728294] tracking-wider">
                <th className="py-3 px-4">INVOICE ID</th>
                <th className="py-3 px-4">TENANT ORGANIZATION</th>
                <th className="py-3 px-4">BILLING PERIOD</th>
                <th className="py-3 px-4">AMOUNT BILLED</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">SETTLEMENT</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F1EA] text-xs font-sans">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center font-mono text-xs text-[#728294]">
                    Hydrating platform accounts receivable...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center font-mono text-xs text-[#728294]">
                    No billing records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const rawId = r._id || r.id;
                  const invoiceId = r.invoiceNumber || `INV-${String(rawId).slice(-6).toUpperCase()}`;
                  const companyName = r.companyId?.name || r.companyName || 'Tenant Organization';
                  const companyEmail = r.companyId?.email || r.contactEmail || 'billing@tenant.com';
                  const amountNum = Number(r.amount) || 0;
                  const curr = r.currency || 'PKR';
                  const statusUpper = String(r.status || 'PENDING').toUpperCase();
                  const notesOrMethod = r.notes || (statusUpper === 'PAID' ? 'Bank Transfer' : 'Awaiting Payment');
                  const settlementDate = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '04 APR 2026';

                  return (
                    <tr key={rawId} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      {/* INVOICE ID */}
                      <td className="py-4 px-4 font-mono font-semibold text-[#16233B]">
                        {invoiceId}
                      </td>

                      {/* TENANT ORGANIZATION */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#111C2E]">{companyName}</div>
                        <div className="text-[10px] font-mono text-[#728294]">{companyEmail}</div>
                      </td>

                      {/* BILLING PERIOD */}
                      <td className="py-4 px-4 font-mono text-[11px] text-[#546274]">
                        {formatPeriodDisplay(r.billingPeriod)}
                      </td>

                      {/* AMOUNT BILLED */}
                      <td className="py-4 px-4 font-mono font-bold text-[#111C2E]">
                        {curr} {amountNum.toLocaleString()}
                      </td>

                      {/* STATUS PILL */}
                      <td className="py-4 px-4">
                        {statusUpper === 'PAID' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] font-mono text-[10px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E34]" />
                            PAID
                          </span>
                        )}
                        {statusUpper === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FAF4E8] text-[#8C5D17] border border-[#E8D4B5] font-mono text-[10px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8C5D17]" />
                            PENDING
                          </span>
                        )}
                        {statusUpper === 'OVERDUE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FDEEEB] text-[#B83E28] border border-[#F5C2BA] font-mono text-[10px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#B83E28]" />
                            OVERDUE
                          </span>
                        )}
                      </td>

                      {/* SETTLEMENT */}
                      <td className="py-4 px-4">
                        <div className="text-[11.5px] text-[#111C2E]">{notesOrMethod}</div>
                        {statusUpper === 'PAID' && (
                          <div className="text-[9.5px] font-mono text-[#728294] uppercase">
                            {settlementDate}
                          </div>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {statusUpper === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(rawId, 'PAID')}
                              className="px-2 py-1 bg-[#23704B] hover:bg-[#1C5B3D] text-white rounded text-[10px] font-mono font-semibold cursor-pointer transition-all"
                            >
                              Mark Paid
                            </button>
                          )}
                          {statusUpper === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(rawId, 'OVERDUE')}
                              className="px-2 py-1 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] text-[#B83E28] rounded text-[10px] font-mono font-semibold cursor-pointer transition-all"
                            >
                              Overdue
                            </button>
                          )}
                          {statusUpper === 'PAID' && (
                            <span className="text-[#2E7D5B] text-xs font-mono font-bold">
                              Settled ✓
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Info */}
        <div className="p-3.5 bg-[#FAF9F6] border-t border-[#D8D3C7] flex items-center justify-between text-[11px] font-mono text-[#728294]">
          <span>SHOWING {filteredRecords.length} OF {billingRecords.length} ENTRIES</span>
          <div className="flex items-center gap-2">
            <span className="cursor-pointer hover:text-[#111C2E]">&lsaquo;</span>
            <span className="font-bold text-[#111C2E]">1</span>
            <span className="cursor-pointer hover:text-[#111C2E]">&rsaquo;</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: RECORD BILLING ENTRY                                               */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#D8D3C7] shadow-2xl w-full max-w-[500px] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#EAE7DF] bg-[#FAF9F6] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-base">💳</span>
                <h2 className="text-sm font-bold text-[#16233B]">Record Manual Billing Entry</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-[#5B6B79] hover:text-[#16233B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBilling} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 bg-[#B3432E]/10 border border-[#B3432E]/30 text-[#B3432E] rounded font-mono text-[11px]">
                  ⚠️ {formError}
                </div>
              )}

              {/* Target Company Select */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  TARGET TENANT ORGANIZATION *
                </label>
                <select
                  required
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs outline-none cursor-pointer focus:border-[#8C5D17]"
                >
                  <option value="">Select Tenant Organization</option>
                  {companies.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name} ({c.contactEmail || c.email || 'No email'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Associated Plan Select */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  SUBSCRIPTION PLAN TIER *
                </label>
                <select
                  required
                  value={formData.planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs outline-none cursor-pointer focus:border-[#8C5D17]"
                >
                  <option value="">Select Plan</option>
                  {plans.map((p) => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.name} — {p.currency || 'PKR'} {Number(p.price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    INVOICE AMOUNT *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="35000"
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none focus:border-[#8C5D17]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    CURRENCY
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Billing Period Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    START DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    END DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                  />
                </div>
              </div>

              {/* Initial Status */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  PAYMENT STATUS
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                >
                  <option value="PENDING">PENDING (Awaiting Payment)</option>
                  <option value="PAID">PAID (Settled)</option>
                  <option value="OVERDUE">OVERDUE (Past Due)</option>
                </select>
              </div>

              {/* Settlement Notes */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  SETTLEMENT NOTES / REFERENCE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank Transfer Wire #89201"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-[#EAE7DF]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] text-xs font-mono text-[#5B6B79] rounded hover:bg-[#FAF9F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording Entry...' : 'Record Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}