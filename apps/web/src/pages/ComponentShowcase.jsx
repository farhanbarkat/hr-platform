import React, { useState, useEffect } from 'react';
import {
  Sidebar,
  TopBar,
  StatCard,
  AreaTrendChart,
  DonutChart,
  DataTable,
  Button,
  Card,
  Input,
} from '@repo/ui';

export default function ComponentShowcase() {
  const [clock, setClock] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [impersonateModal, setImpersonateModal] = useState({ open: false, company: null, reason: '' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(`${now.toUTCString().split(' ')[4]} UTC | ${now.toLocaleTimeString()}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // SA-FE-006: Audit Columns & Badges
  const auditColumns = [
    { key: 'timestamp', label: 'Timestamp', type: 'mono' },
    { key: 'actor', label: 'Actor', type: 'actor' },
    { key: 'tenant', label: 'Tenant Target', type: 'text' },
    { key: 'event', label: 'Event Action', type: 'badge' },
    { key: 'action', label: 'Action', type: 'action', align: 'right', actionLabel: 'View Log', onAction: (r) => alert(`Viewing log: ${r.id}`) },
  ];

  const auditData = [
    { id: '1', timestamp: '2026-09-03 14:12', actorName: 'Sarah Connor', actorEmail: 'admin@apex.io', tenant: 'Apex Corp', event: 'PROVISIONED' },
    { id: '2', timestamp: '2026-09-03 13:45', actorName: 'Root System', actorEmail: 'root@platform.io', tenant: 'GlobalTech', event: 'IMPERSONATION' },
    { id: '3', timestamp: '2026-09-03 11:20', actorName: 'John Miller', actorEmail: 'jm@cloudlogic.com', tenant: 'CloudLogic', event: 'APPROVED' },
    { id: '4', timestamp: '2026-09-03 09:05', actorName: 'David Lee', actorEmail: 'd.lee@quantum.org', tenant: 'Quantum Inc', event: 'SUSPENDED' },
  ];

  const badgeMap = {
    PROVISIONED: 'green',
    APPROVED: 'green',
    IMPERSONATION: 'blue',
    SUSPENDED: 'red',
    ACTIVE: 'green',
    TRIAL: 'amber',
    DEACTIVATED: 'red',
  };

  // SA-FE-008: Companies Data
  const companyColumns = [
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
        <div className="flex items-center justify-end gap-2 font-mono text-xs">
          <button
            onClick={() => alert(`Status toggled for ${row.name}`)}
            className={`cursor-pointer ${row.status === 'ACTIVE' ? 'text-[#B3432E]' : 'text-[#2E7D5B]'}`}
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

  const companyData = [
    { id: '1', name: 'CloudLogic Inc', employeeCount: 1420, plan: 'Enterprise', status: 'ACTIVE', onboardedDate: '2025-11-14' },
    { id: '2', name: 'Apex Technologies', employeeCount: 840, plan: 'Professional', status: 'ACTIVE', onboardedDate: '2026-01-20' },
    { id: '3', name: 'Quantum Health', employeeCount: 210, plan: 'Starter', status: 'TRIAL', onboardedDate: '2026-02-18' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F5F1] p-6 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#D8D3C7] pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-[#16233B]">
            SA-FE-006, SA-FE-007, SA-FE-008 Verification Suite
          </h1>
          <p className="text-xs font-mono text-[#5B6B79] mt-0.5">{clock}</p>
        </div>
        <Button variant="primary" onClick={() => setWizardOpen(true)}>
          + Onboard New Company
        </Button>
      </div>

      {/* SA-FE-007: StatCards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Active Tenants" value="128" deltaText="+12% vs last month" deltaVariant="success" caption="Verified instances" />
        <StatCard label="Aggregate Headcount" value="14,250" deltaText="+1,240 this month" deltaVariant="success" caption="Managed workforce" />
        <StatCard label="Gross Monthly Run-Rate" value="$48,200" deltaText="+8.4%" deltaVariant="success" caption="MRR across tier contracts" />
        <StatCard label="Platform Health" value="99.98%" deltaText="Healthy" deltaVariant="neutral" caption="Core API uptime (30d)" />
      </div>

      {/* SA-FE-006: Audit Log DataTable */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold tracking-wider text-[#16233B] uppercase">
          SA-FE-006: Critical Audit Activity (Data Table with Event Badges)
        </h3>
        <DataTable columns={auditColumns} data={auditData} badgeColorMap={badgeMap} />
      </div>

      {/* SA-FE-008: Tenant Management DataTable */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold tracking-wider text-[#16233B] uppercase">
          SA-FE-008: Tenant Directory (Company List with Status & Impersonate)
        </h3>
        <DataTable columns={companyColumns} data={companyData} badgeColorMap={badgeMap} />
      </div>

      {/* Wizard Modal Test */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg p-6 bg-white space-y-5 border border-[#D8D3C7]">
            <div className="flex justify-between items-center border-b border-[#D8D3C7] pb-3">
              <h3 className="text-sm font-bold font-mono text-[#16233B]">
                Onboarding Wizard (Step {step}/3)
              </h3>
              <button onClick={() => setWizardOpen(false)} className="text-[#5B6B79]">?</button>
            </div>
            {step === 1 && <Input label="Legal Company Name" placeholder="e.g. Apex Corp" />}
            {step === 2 && <Input label="Primary Admin Email" placeholder="admin@apex.io" />}
            {step === 3 && <p className="text-xs font-mono text-[#5B6B79]">Ready to provision Enterprise instance.</p>}
            <div className="flex justify-between pt-3 border-t border-[#D8D3C7]">
              <Button variant="secondary" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>Back</Button>
              {step < 3 ? (
                <Button variant="primary" onClick={() => setStep((s) => s + 1)}>Next</Button>
              ) : (
                <Button variant="primary" onClick={() => { setWizardOpen(false); setStep(1); }}>Provision</Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Impersonation Modal Test */}
      {impersonateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6 bg-white space-y-4 border border-[#D8D3C7]">
            <h3 className="text-sm font-bold font-mono text-[#16233B]">
              Impersonate {impersonateModal.company?.name}
            </h3>
            <Input
              label="Mandatory Audit Reason"
              placeholder="e.g. Investigating payroll issue"
              value={impersonateModal.reason}
              onChange={(e) => setImpersonateModal({ ...impersonateModal, reason: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setImpersonateModal({ open: false, company: null, reason: '' })}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!impersonateModal.reason.trim()}
                onClick={() => {
                  alert(`Impersonating session started: ${impersonateModal.reason}`);
                  setImpersonateModal({ open: false, company: null, reason: '' });
                }}
              >
                Start Session
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
