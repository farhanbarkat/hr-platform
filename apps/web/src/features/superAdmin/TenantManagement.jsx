import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';

export default function TenantManagement() {
  const location = useLocation();

  // State Management
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Form matching image fields exactly
  const [formData, setFormData] = useState({
    legalName: '',
    slug: '',
    baseCurrency: 'USD',
    defaultTimezone: 'America/New_York',
    adminFullName: '',
    adminEmail: '',
    subscriptionTier: 'BUSINESS',
  });

  // Check if routed from PlatformTelemetry with auto-open intent
  useEffect(() => {
    if (location.state?.openOnboardModal) {
      setShowProvisionModal(true);
    }
  }, [location.state]);

  // Auto-generate tenant slug from legal name
  const handleNameChange = (e) => {
    const name = e.target.value;
    const derivedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    setFormData((prev) => ({
      ...prev,
      legalName: name,
      slug: derivedSlug,
    }));
  };

  // 1. Fetch live tenants strictly from backend
  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/super-admin/companies', {
        params: { page: 1, limit: 100, search },
      });

      const payload = res.data?.data || res.data || [];
      const list = Array.isArray(payload)
        ? payload
        : payload.companies || payload.docs || [];

      setTenants(list);
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // 2. Submit Provisioning Form
  const handleProvisionTenant = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessNotice('');
    setSubmitting(true);

    try {
      // Backend payload structure matching standard model
      const payload = {
        name: formData.legalName.trim(),
        slug: formData.slug.trim(),
        currency: formData.baseCurrency,
        timezone: formData.defaultTimezone,
        adminName: formData.adminFullName.trim(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        plan: formData.subscriptionTier,
        tier: formData.subscriptionTier,
      };

      await apiClient.post('/super-admin/companies', payload);

      setSuccessNotice(`Tenant "${formData.legalName}" provisioned successfully!`);
      setShowProvisionModal(false);
      setFormData({
        legalName: '',
        slug: '',
        baseCurrency: 'USD',
        defaultTimezone: 'America/New_York',
        adminFullName: '',
        adminEmail: '',
        subscriptionTier: 'BUSINESS',
      });
      fetchTenants();
    } catch (err) {
      console.error('Provisioning Error:', err);
      setFormError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to provision tenant organization. Verify admin email uniqueness.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Toggle Status (Active / Suspended)
  const handleToggleStatus = async (tenantId, currentStatus) => {
    try {
      const nextStatus = !currentStatus;
      await apiClient.patch(`/super-admin/companies/${tenantId}/status`, {
        isActive: nextStatus,
        status: nextStatus ? 'ACTIVE' : 'SUSPENDED',
      });

      setTenants((prev) =>
        prev.map((t) =>
          t._id === tenantId ? { ...t, isActive: nextStatus, status: nextStatus ? 'ACTIVE' : 'SUSPENDED' } : t
        )
      );
    } catch (err) {
      console.error('Failed to change tenant status:', err);
      alert('Failed to update tenant status.');
    }
  };

  // Filter list
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.slug || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.contactEmail || t.adminEmail || '').toLowerCase().includes(search.toLowerCase());

    const isTenantActive = t.isActive ?? t.status === 'ACTIVE';
    if (statusFilter === 'ACTIVE') return matchesSearch && isTenantActive;
    if (statusFilter === 'SUSPENDED') return matchesSearch && !isTenantActive;
    return matchesSearch;
  });

  return (
    <div className="space-y-5 max-w-[1380px] mx-auto select-none font-sans text-[#16233B]">
      {/* Top Banner Notice */}
      {successNotice && (
        <div className="p-3.5 bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34] text-xs font-mono rounded flex justify-between items-center animate-fade-in">
          <span>✓ {successNotice}</span>
          <button onClick={() => setSuccessNotice('')} className="cursor-pointer text-sm">✕</button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#16233B]">
            Tenant Management
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Provision isolated tenant enclaves, configure platform subscriptions, and enforce lifecycle controls.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowProvisionModal(true);
          }}
          className="inline-flex items-center gap-2 bg-[#B9812E] hover:bg-[#a57227] text-white text-xs font-mono font-medium px-4 py-2.5 rounded-[4px] shadow-2xs transition-all cursor-pointer w-fit"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>Provision New Tenant</span>
        </button>
      </div>

      {/* Filter & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded border border-[#D8D3C7]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Filter by company name, slug or admin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-1.5 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C7] rounded w-full sm:w-80 outline-none focus:border-[#B9812E]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono w-full sm:w-auto justify-end">
          <span className="text-[#5B6B79]">STATUS:</span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-[#16233B] text-white font-bold' : 'bg-[#FAF9F6] text-[#5B6B79]'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-2.5 py-1 rounded cursor-pointer ${
              statusFilter === 'ACTIVE' ? 'bg-[#2E7D5B] text-white font-bold' : 'bg-[#FAF9F6] text-[#5B6B79]'
            }`}
          >
            ACTIVE
          </button>
          <button
            onClick={() => setStatusFilter('SUSPENDED')}
            className={`px-2.5 py-1 rounded cursor-pointer ${
              statusFilter === 'SUSPENDED' ? 'bg-[#B3432E] text-white font-bold' : 'bg-[#FAF9F6] text-[#5B6B79]'
            }`}
          >
            SUSPENDED
          </button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded border border-[#D8D3C7] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF9F6] border-b border-[#D8D3C7] text-[10px] font-mono uppercase text-[#5B6B79] tracking-wider">
                <th className="py-3 px-4">Organization Name</th>
                <th className="py-3 px-4">Tenant Slug</th>
                <th className="py-3 px-4">Base Currency</th>
                <th className="py-3 px-4">Timezone</th>
                <th className="py-3 px-4">Plan Tier</th>
                <th className="py-3 px-4 text-right">Status / Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE7DF] text-xs font-sans">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center font-mono text-xs text-[#5B6B79]">
                    Hydrating platform tenant registry...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center font-mono text-xs text-[#5B6B79]">
                    No matching tenants provisioned. Click "+ Provision New Tenant" to start.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isActive = t.isActive ?? t.status === 'ACTIVE';
                  return (
                    <tr key={t._id} className="hover:bg-[#FAF9F6]/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#16233B]">{t.name}</div>
                        <div className="text-[10px] font-mono text-[#5B6B79]">
                          {t.contactEmail || t.adminEmail || 'admin@organization.com'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#5B6B79]">
                        /{t.slug || 'tenant'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#16233B]">
                        {t.currency || 'USD'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#5B6B79]">
                        {t.timezone || 'America/New_York'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#FAF6EC] border border-[#E9DFBA] text-[#B9812E] font-mono text-[10px] font-bold uppercase">
                          {t.plan || t.tier || 'Business'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleToggleStatus(t._id, isActive)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-[#D8D3C7] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8D3C7] after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#2E7D5B]"></div>
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: PROVISION NEW TENANT ORGANIZATION (EXACT MATCH TO ATTACHED IMAGE)  */}
      {/* ========================================================================= */}
      {showProvisionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#D8D3C7] shadow-2xl w-full max-w-[560px] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 px-6 border-b border-[#EAE7DF] bg-[#FAF9F6] flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="text-base">🏢</span>
                <h2 className="text-base font-bold text-[#16233B]">
                  Provision New Tenant Organization
                </h2>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-sm text-[#5B6B79] hover:text-[#16233B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleProvisionTenant} className="p-6 space-y-5 text-xs">
              {formError && (
                <div className="p-3 bg-[#B3432E]/10 border border-[#B3432E]/30 text-[#B3432E] rounded font-mono text-[11px]">
                  ⚠️ {formError}
                </div>
              )}

              {/* Row 1: Legal Name & Tenant Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                    LEGAL COMPANY NAME
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tech Nova Corp"
                    value={formData.legalName}
                    onChange={handleNameChange}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs text-[#16233B] outline-none focus:border-[#B9812E]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                      TENANT SLUG
                    </label>
                    <span className="text-[9px] font-mono text-[#9E9B93]">auto-derived</span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-[#9E9B93] text-xs">🔗</span>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded font-mono text-xs text-[#5B6B79] outline-none focus:border-[#B9812E]"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Base Currency & Default Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                    BASE CURRENCY
                  </label>
                  <select
                    value={formData.baseCurrency}
                    onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none cursor-pointer"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="PKR">PKR - Pakistani Rupee</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="AED">AED - UAE Dirham</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                    DEFAULT TIMEZONE
                  </label>
                  <select
                    value={formData.defaultTimezone}
                    onChange={(e) => setFormData({ ...formData, defaultTimezone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none cursor-pointer"
                  >
                    <option value="America/New_York">America/New_York</option>
                    <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Admin Full Name & Admin Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                    ADMIN FULL NAME
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={formData.adminFullName}
                    onChange={(e) => setFormData({ ...formData, adminFullName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs text-[#16233B] outline-none focus:border-[#B9812E]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                    ADMIN EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@technova.com"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none focus:border-[#B9812E]"
                  />
                </div>
              </div>

              {/* Row 4: Subscription Tier */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#5B6B79]">
                  SUBSCRIPTION TIER
                </label>
                <select
                  value={formData.subscriptionTier}
                  onChange={(e) => setFormData({ ...formData, subscriptionTier: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none cursor-pointer"
                >
                  <option value="STARTER">Starter (15 Seats)</option>
                  <option value="BUSINESS">Business (50 Seats)</option>
                  <option value="ENTERPRISE">Custom Enterprise (Unlimited)</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t border-[#EAE7DF]">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 bg-white border border-[#D8D3C7] text-xs font-mono text-[#5B6B79] rounded hover:bg-[#FAF9F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#B9812E] hover:bg-[#a57227] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-60"
                >
                  <span>{submitting ? 'Provisioning...' : 'Provision Company'}</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}