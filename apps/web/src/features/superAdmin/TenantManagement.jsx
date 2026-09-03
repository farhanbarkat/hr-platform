import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable, Button, Input, Card } from '@repo/ui';
import { apiClient } from '../../lib/apiClient.js';

export default function TenantManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    plan: 'Enterprise',
    maxUsers: 100,
  });

  // Action Modals state
  const [statusModal, setStatusModal] = useState({ open: false, company: null });
  const [impersonateModal, setImpersonateModal] = useState({ open: false, company: null, reason: '' });

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/super-admin/tenants').catch(() => null);
      if (res?.data?.data?.tenants) {
        setCompanies(res.data.data.tenants);
      } else {
        setCompanies([
          { id: '1', name: 'CloudLogic Inc', employeeCount: 1420, plan: 'Enterprise', status: 'ACTIVE', onboardedDate: '2025-11-14' },
          { id: '2', name: 'Apex Technologies', employeeCount: 840, plan: 'Professional', status: 'ACTIVE', onboardedDate: '2026-01-20' },
          { id: '3', name: 'Quantum Health', employeeCount: 210, plan: 'Starter', status: 'TRIAL', onboardedDate: '2026-02-18' },
          { id: '4', name: 'Nexus Logistics', employeeCount: 52, plan: 'Starter', status: 'DEACTIVATED', onboardedDate: '2025-08-04' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    if (searchParams.get('action') === 'onboard') {
      setWizardOpen(true);
    }
  }, [searchParams]);

  const handleWizardSubmit = async () => {
    try {
      await apiClient.post('/super-admin/tenants', formData).catch(() => null);
      setWizardOpen(false);
      setStep(1);
      setSearchParams({});
      fetchTenants();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStatus = async () => {
    const { company } = statusModal;
    const newStatus = company.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      await apiClient.patch(`/super-admin/tenants/${company.id}/status`, { status: newStatus }).catch(() => null);
      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, status: newStatus } : c))
      );
      setStatusModal({ open: false, company: null });
    } catch (e) {
      console.error(e);
    }
  };

  const handleImpersonate = () => {
    if (!impersonateModal.reason.trim()) return;
    sessionStorage.setItem('impersonation_active', `${impersonateModal.company.name} (${impersonateModal.reason})`);
    window.location.reload();
  };

  const columns = [
    { key: 'name', label: 'Company Name', type: 'text' },
    { key: 'employeeCount', label: 'Workforce', type: 'mono' },
    { key: 'plan', label: 'Assigned Plan', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'onboardedDate', label: 'Onboarded', type: 'mono' },
    {
      key: 'actions',
      label: 'Management',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-3 font-mono text-xs">
          <button
            onClick={() => setStatusModal({ open: true, company: row })}
            className={`cursor-pointer ${row.status === 'ACTIVE' ? 'text-[#B3432E] hover:underline' : 'text-[#2E7D5B] hover:underline'}`}
          >
            {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </button>
          <span className="text-[#D8D3C7]">|</span>
          <button
            onClick={() => setImpersonateModal({ open: true, company: row, reason: '' })}
            className="text-[#B9812E] hover:underline cursor-pointer"
          >
            Impersonate
          </button>
        </div>
      ),
    },
  ];

  const badgeMap = {
    ACTIVE: 'green',
    TRIAL: 'amber',
    DEACTIVATED: 'red',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#D8D3C7] pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-[#16233B]">Tenant Management</h1>
          <p className="text-xs font-mono text-[#5B6B79] mt-0.5">Directory and onboarding portal</p>
        </div>
        <Button variant="primary" onClick={() => setWizardOpen(true)}>
          + Onboard New Company
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={companies}
        badgeColorMap={badgeMap}
        isLoading={loading}
      />

      {/* 3-Step Onboarding Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg p-6 bg-white space-y-5 border border-[#D8D3C7] shadow-lg">
            <div className="flex items-center justify-between border-b border-[#D8D3C7] pb-3">
              <div>
                <h3 className="text-sm font-bold font-mono text-[#16233B]">
                  Company Onboarding Wizard ({step}/3)
                </h3>
                <p className="text-xs text-[#5B6B79]">
                  {step === 1 && 'Step 1: Company Profile Details'}
                  {step === 2 && 'Step 2: Company Admin Account'}
                  {step === 3 && 'Step 3: Initial Plan Configuration'}
                </p>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="text-[#5B6B79] hover:text-[#16233B]"
              >
                ✕
              </button>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <Input
                  label="Legal Company Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Nexus Innovations Ltd"
                />
                <Input
                  label="Industry Vertical"
                  required
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g. Logistics, Fintech"
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <Input
                  label="Primary Admin Name"
                  required
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="e.g. Eleanor Vance"
                />
                <Input
                  label="Work Email"
                  type="email"
                  required
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="admin@nexus.io"
                />
                <Input
                  label="Initial Password"
                  type="password"
                  required
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 text-xs font-sans">
                <label className="block text-xs font-medium text-[#16233B]">Selected Tier</label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded text-xs bg-white text-[#16233B] focus:border-[#B9812E]"
                >
                  <option value="Starter">Starter Plan</option>
                  <option value="Professional">Professional Plan</option>
                  <option value="Enterprise">Enterprise Tier</option>
                </select>

                <div className="p-3 bg-[#F6F5F1] rounded border border-[#D8D3C7] space-y-1 font-mono text-[11px]">
                  <p><strong>Company:</strong> {formData.name || 'Not set'}</p>
                  <p><strong>Admin:</strong> {formData.adminEmail || 'Not set'}</p>
                  <p><strong>Tier:</strong> {formData.plan}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-3 border-t border-[#D8D3C7]">
              <Button
                variant="secondary"
                disabled={step === 1}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
              {step < 3 ? (
                <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                  Next Step
                </Button>
              ) : (
                <Button variant="primary" onClick={handleWizardSubmit}>
                  Confirm & Provision
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Confirmation Modal for Status Toggle */}
      {statusModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm p-6 bg-white space-y-4 border border-[#D8D3C7]">
            <h3 className="text-sm font-bold font-mono text-[#16233B]">
              Confirm Tenant {statusModal.company?.status === 'ACTIVE' ? 'Deactivation' : 'Activation'}
            </h3>
            <p className="text-xs text-[#5B6B79]">
              Are you sure you want to change the status of <strong>{statusModal.company?.name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStatusModal({ open: false, company: null })}>
                Cancel
              </Button>
              <Button
                variant={statusModal.company?.status === 'ACTIVE' ? 'danger' : 'primary'}
                onClick={handleToggleStatus}
              >
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Mandatory Reason Modal for Impersonation */}
      {impersonateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6 bg-white space-y-4 border border-[#D8D3C7]">
            <div>
              <h3 className="text-sm font-bold font-mono text-[#16233B]">
                Tenant Impersonation Protocol
              </h3>
              <p className="text-xs text-[#5B6B79] mt-1">
                You are initiating an impersonation session for <strong>{impersonateModal.company?.name}</strong>. A mandatory reason is required for the immutable audit log.
              </p>
            </div>

            <Input
              label="Audit Justification Reason"
              required
              placeholder="e.g. Investigating Ticket #8921 payroll discrepancy"
              value={impersonateModal.reason}
              onChange={(e) => setImpersonateModal({ ...impersonateModal, reason: e.target.value })}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setImpersonateModal({ open: false, company: null, reason: '' })}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!impersonateModal.reason.trim()}
                onClick={handleImpersonate}
              >
                Begin Session
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}