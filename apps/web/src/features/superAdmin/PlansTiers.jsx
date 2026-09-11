import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function PlansTiers() {
  const [plans, setPlans] = useState([]);
  const [tenantAssignments, setTenantAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTenant, setSearchTenant] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Form payload matching exact backend controller expectations
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    employeeLimit: 100,
    price: 35000,
    currency: 'PKR',
    billingCycle: 'MONTHLY',
    features: ['payroll', 'attendance', 'custom-reports'],
  });

  const availableFeatures = [
    { id: 'payroll', label: 'Automated Payroll & Payslips' },
    { id: 'attendance', label: 'Time Tracking & Biometrics' },
    { id: 'custom-reports', label: 'Custom Reports & Analytics' },
    { id: 'audit-logs', label: 'Audit Logging & Compliance' },
    { id: 'multi-approvals', label: 'Multi-Level Approval Matrix' },
    { id: 'api-access', label: 'Dedicated HRIS API Integration' },
    { id: 'priority-support', label: '24/7 Priority SLA Support' },
  ];

  // 1. Fetch live plans and active tenant contracts
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [plansRes, companiesRes] = await Promise.allSettled([
        apiClient.get('/super-admin/advanced/plans').catch(() => apiClient.get('/super-admin/plans')),
        apiClient.get('/super-admin/companies?limit=100'),
      ]);

      // Handle Plans
      if (plansRes.status === 'fulfilled') {
        const payload = plansRes.value.data?.data || plansRes.value.data || [];
        const rawPlans = Array.isArray(payload) ? payload : payload.plans || [];
        setPlans(rawPlans);
      }

      // Handle Companies & Utilization
      if (companiesRes.status === 'fulfilled') {
        const cData = companiesRes.value.data?.data || companiesRes.value.data || [];
        const compList = Array.isArray(cData) ? cData : cData.companies || cData.docs || [];

        const mappedAssignments = compList.map((comp) => {
          const seatLimit = comp.maxEmployees || comp.seatLimit || 150;
          const currentHeadcount = comp.headcount || comp.employeeCount || 14;
          const pct = Math.min(100, Math.round((currentHeadcount / seatLimit) * 100));

          return {
            id: comp._id || comp.id,
            name: comp.name || 'Unnamed Tenant',
            slug: comp.slug ? `TEN-${comp.slug.toUpperCase().slice(0, 8)}` : 'TEN-STARK-01',
            tier: comp.subscriptionPlan || comp.plan || 'Business Pro',
            headcount: currentHeadcount,
            seatLimit: seatLimit,
            utilization: pct,
            price: comp.planPrice ? `PKR ${comp.planPrice.toLocaleString()}` : 'PKR 35,000',
            renewalDate: comp.createdAt ? new Date(comp.createdAt).toISOString().split('T')[0] : '2026-11-01',
          };
        });

        setTenantAssignments(mappedAssignments);
      }
    } catch (err) {
      console.error('Error fetching plans data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle Feature selection
  const toggleFeature = (featureId) => {
    setFormData((prev) => {
      const exists = prev.features.includes(featureId);
      return {
        ...prev,
        features: exists
          ? prev.features.filter((f) => f !== featureId)
          : [...prev.features, featureId],
      };
    });
  };

  // 2. Submit New Plan (Hits exact controller POST /advanced/plans)
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const generatedCode = formData.code.trim()
      ? formData.code.trim().toUpperCase()
      : formData.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-');

    const payload = {
      name: formData.name.trim(),
      code: generatedCode,
      employeeLimit: Number(formData.employeeLimit),
      price: Number(formData.price),
      currency: formData.currency,
      billingCycle: formData.billingCycle,
      features: formData.features,
    };

    try {
      // Primary: advanced route
      await apiClient.post('/super-admin/advanced/plans', payload).catch(async (err) => {
        if (err.response?.status === 404) {
          // Secondary fallback
          return await apiClient.post('/super-admin/plans', payload);
        }
        throw err;
      });

      setSuccessNotice(`Plan "${formData.name}" created successfully!`);
      setShowCreateModal(false);
      setFormData({
        name: '',
        code: '',
        employeeLimit: 100,
        price: 35000,
        currency: 'PKR',
        billingCycle: 'MONTHLY',
        features: ['payroll', 'attendance', 'custom-reports'],
      });
      loadData();
    } catch (err) {
      console.error('Plan creation failed:', err);
      setFormError(
        err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to create plan.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Update Existing Plan
  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setFormError('');
    setActionLoading(true);

    try {
      const planId = selectedPlan._id || selectedPlan.id;
      const payload = {
        name: selectedPlan.name,
        price: Number(selectedPlan.price),
        employeeLimit: Number(selectedPlan.employeeLimit),
        currency: selectedPlan.currency || 'PKR',
        billingCycle: selectedPlan.billingCycle || 'MONTHLY',
      };

      await apiClient.put(`/super-admin/advanced/plans/${planId}`, payload).catch(() => {
        return apiClient.put(`/super-admin/plans/${planId}`, payload);
      });

      setSuccessNotice(`Plan "${selectedPlan.name}" updated successfully.`);
      setShowEditModal(false);
      setSelectedPlan(null);
      loadData();
    } catch (err) {
      console.error('Plan update failed:', err);
      setFormError(err.response?.data?.message || 'Failed to update plan.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Assignments
  const filteredAssignments = tenantAssignments.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTenant.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-[1380px] mx-auto select-none font-sans text-[#16233B] pb-12">
      {/* Top Banner Notice */}
      {successNotice && (
        <div className="p-3.5 bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34] text-xs font-mono rounded flex justify-between items-center">
          <span>✓ {successNotice}</span>
          <button onClick={() => setSuccessNotice('')} className="cursor-pointer text-sm">✕</button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B9812E]" />
            <span className="text-[10px] font-mono tracking-widest text-[#B9812E] uppercase font-bold">
              GLOBAL ENTITLEMENTS
            </span>
          </div>
          <h1 className="text-[26px] font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Subscription Plans
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5 max-w-2xl leading-relaxed">
            Configure global subscription tiers, seat thresholds, and tenant plan allocations across the ledger network.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-semibold px-4 py-2.5 rounded-[4px] shadow-sm transition-all cursor-pointer w-fit"
        >
          <span className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-xs leading-none">
            +
          </span>
          <span>CREATE PLAN TIER</span>
        </button>
      </div>

      {/* Dynamic Tier Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {loading && plans.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-xs font-mono text-[#728294]">
            Hydrating subscription tiers from ledger...
          </div>
        ) : plans.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-xs font-mono text-[#728294]">
            No subscription plans created yet. Click "+ CREATE PLAN TIER" to configure one.
          </div>
        ) : (
          plans.map((p, idx) => {
            const isPopular = idx === 1 || p.code?.includes('PRO') || p.isPopular;
            return (
              <div
                key={p._id || p.id}
                className={`bg-white rounded-lg p-7 flex flex-col justify-between shadow-xs relative transition-all ${
                  isPopular
                    ? 'border-2 border-[#8C5D17] shadow-md scale-[1.02]'
                    : 'border border-[#E3DED4]'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 right-6 bg-[#FAF4E8] border border-[#E5B56A] text-[#8C5D17] text-[9.5px] font-mono font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                    MOST POPULAR
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold font-serif text-[#16233B]">{p.name}</h3>
                    <span className="text-[10px] font-mono text-[#8C5D17] font-semibold">
                      [{p.code || 'CODE'}]
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-2xl font-bold font-serif text-[#16233B]">
                      {p.currency || 'PKR'} {Number(p.price || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-[#728294] font-mono">
                      /{p.billingCycle?.toLowerCase() === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </div>

                  {/* Seat Limit Box */}
                  <div className="p-3 bg-[#FAF8F5] border border-[#EFECE6] rounded space-y-0.5">
                    <span className="text-[10px] font-mono uppercase text-[#728294] block font-semibold">
                      Seat Limit
                    </span>
                    <span className="text-xs font-bold text-[#16233B]">
                      Up to {p.employeeLimit || 100} Users
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="pt-2 space-y-2 text-xs text-[#4E5D6F]">
                    {p.features && p.features.length > 0 ? (
                      p.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2.5">
                          <span className="w-4 h-4 rounded-full border border-[#2E7D5B] text-[#2E7D5B] flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                          <span className="capitalize">{feat.replace(/-/g, ' ')}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 h-4 rounded-full border border-[#2E7D5B] text-[#2E7D5B] flex items-center justify-center text-[10px] font-bold">✓</span>
                        <span>Standard Workforce Portal</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-[#F4F1EA]">
                  <button
                    onClick={() => {
                      setSelectedPlan(p);
                      setShowEditModal(true);
                    }}
                    className={`w-full py-2.5 text-xs font-mono font-bold rounded cursor-pointer transition-all uppercase tracking-wider ${
                      isPopular
                        ? 'bg-[#8C5D17] hover:bg-[#784F14] text-white shadow-xs'
                        : 'bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D8D3C7] text-[#16233B]'
                    }`}
                  >
                    MANAGE TIER
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Table: Active Tenant Plan Assignments */}
      <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4F1EA]">
          <div className="flex items-center gap-2">
            <span className="text-base">📑</span>
            <h2 className="text-sm font-bold text-[#111C2E]">Active Tenant Plan Assignments</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchTenant}
                onChange={(e) => setSearchTenant(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none w-56 focus:border-[#8C5D17]"
              />
              <span className="absolute left-2.5 top-2 text-[#728294] text-xs">🔍</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-mono uppercase text-[#728294] border-b border-[#E3DED4] pb-2">
                <th className="py-2.5 px-3">Company & Slug</th>
                <th className="py-2.5 px-4">Assigned Tier</th>
                <th className="py-2.5 px-4">Headcount Utilization</th>
                <th className="py-2.5 px-4">Billing Value</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F1EA] text-xs font-sans">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center font-mono text-[#728294]">
                    Loading tenant contracts and assignments...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center font-mono text-[#728294]">
                    No active tenant contracts registered.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[#111C2E]">{item.name}</div>
                      <div className="text-[10px] font-mono text-[#728294]">{item.slug}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#FAF4E8] text-[#8C5D17] border border-[#E8D4B5] font-mono text-[10px] font-semibold">
                        {item.tier}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span>
                          {item.headcount} / {item.seatLimit} Seats
                        </span>
                        <span className="font-bold text-[#728294]">{item.utilization}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EFECE6] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.utilization > 90 ? 'bg-[#B83E28]' : 'bg-[#8C5D17]'
                          }`}
                          style={{ width: `${item.utilization}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold font-mono text-[#111C2E]">{item.price}</div>
                      <div className="text-[10px] font-mono text-[#728294]">
                        Renews: {item.renewalDate}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => alert(`Managing seat limits for ${item.name}`)}
                        className="text-xs font-mono font-medium text-[#8C5D17] hover:underline cursor-pointer"
                      >
                        Adjust Seats &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE CUSTOM SUBSCRIPTION PLAN TIER                              */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#D8D3C7] shadow-2xl w-full max-w-[520px] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#EAE7DF] bg-[#FAF9F6] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#16233B]">Create Custom Plan Tier</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-[#5B6B79] hover:text-[#16233B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 bg-[#B3432E]/10 border border-[#B3432E]/30 text-[#B3432E] rounded font-mono text-[11px]">
                  ⚠️ {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    PLAN NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Pro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    PLAN CODE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ENT-PRO"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono uppercase outline-none focus:border-[#8C5D17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    PRICE *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
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

                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    BILLING CYCLE
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                  >
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  EMPLOYEE SEAT THRESHOLD *
                </label>
                <input
                  type="number"
                  required
                  value={formData.employeeLimit}
                  onChange={(e) => setFormData({ ...formData, employeeLimit: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                />
              </div>

              {/* Feature Matrix Checkboxes */}
              <div className="space-y-1.5 pt-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  ENTITLEMENT FEATURES
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#FAF9F6] p-3 border border-[#EAE7DF] rounded max-h-36 overflow-y-auto">
                  {availableFeatures.map((feat) => (
                    <label key={feat.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={formData.features.includes(feat.id)}
                        onChange={() => toggleFeature(feat.id)}
                        className="accent-[#8C5D17]"
                      />
                      <span>{feat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#EAE7DF]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] text-xs font-mono text-[#5B6B79] rounded hover:bg-[#FAF9F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-bold shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save & Publish Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT EXISTING PLAN TIER                                           */}
      {/* ========================================================================= */}
      {showEditModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#D8D3C7] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#EAE7DF] bg-[#FAF9F6] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#16233B]">Modify {selectedPlan.name}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-xs text-[#5B6B79] hover:text-[#16233B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} className="p-6 space-y-4 text-xs">
              <div className="p-2.5 bg-[#FAF4E8] border border-[#E8D4B5] text-[#8C5D17] text-[11px] rounded font-mono">
                Modifications will apply to upcoming billing cycles.
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={selectedPlan.name}
                  onChange={(e) => setSelectedPlan({ ...selectedPlan, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    Price ({selectedPlan.currency || 'PKR'})
                  </label>
                  <input
                    type="number"
                    value={selectedPlan.price}
                    onChange={(e) => setSelectedPlan({ ...selectedPlan, price: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] font-bold text-[#5B6B79] uppercase block">
                    Seat Limit
                  </label>
                  <input
                    type="number"
                    value={selectedPlan.employeeLimit}
                    onChange={(e) => setSelectedPlan({ ...selectedPlan, employeeLimit: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#EAE7DF]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] text-xs font-mono text-[#5B6B79] rounded hover:bg-[#FAF9F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-bold shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}