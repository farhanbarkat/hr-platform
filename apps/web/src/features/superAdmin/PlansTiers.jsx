import React, { useState } from 'react';
import { Card, Button, Input, DataTable } from '@repo/ui';

export default function PlansTiers() {
  const [plans, setPlans] = useState([
    { id: 'starter', name: 'Starter', price: '$199', period: '/mo', employeeLimit: 'Up to 50 employees', features: ['Standard Payroll', 'Time Tracker', 'Employee Portal'], activeCompanies: 24 },
    { id: 'pro', name: 'Business Pro', price: '$499', period: '/mo', employeeLimit: 'Up to 250 employees', features: ['Automated Tax', 'Multi-Level Approvals', 'Custom Policies'], activeCompanies: 46, badge: 'POPULAR' },
    { id: 'enterprise', name: 'Custom Enterprise', price: '$1,299', period: '/mo', employeeLimit: 'Unlimited employees', features: ['Dedicated Executive', 'Custom HRIS API', 'SLA Guarantee'], activeCompanies: 58 },
  ]);

  const [editModal, setEditModal] = useState({ open: false, plan: null });

  const tenantAssignments = [
    { id: '1', company: 'CloudLogic Inc', plan: 'Custom Enterprise', seats: '1,420', status: 'ACTIVE', effectiveDate: '2025-11-14' },
    { id: '2', company: 'Apex Technologies', plan: 'Business Pro', seats: '840', status: 'ACTIVE', effectiveDate: '2026-01-20' },
    { id: '3', company: 'Quantum Health', plan: 'Starter', seats: '210', status: 'TRIAL', effectiveDate: '2026-02-18' },
  ];

  const columns = [
    { key: 'company', label: 'Company Name', type: 'text' },
    { key: 'plan', label: 'Subscribed Tier', type: 'text' },
    { key: 'seats', label: 'Workforce Size', type: 'mono' },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'effectiveDate', label: 'Grandfathered Since', type: 'mono' },
  ];

  const badgeMap = { ACTIVE: 'green', TRIAL: 'amber' };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#D8D3C7] pb-4">
        <h1 className="text-xl font-bold font-mono text-[#16233B]">Plans & Tiers Configuration</h1>
        <p className="text-xs font-mono text-[#5B6B79] mt-0.5">Tier definitions & grandfathered contracts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <Card key={p.id} className="p-6 bg-white border border-[#D8D3C7] flex flex-col justify-between relative shadow-2xs">
            {p.badge && (
              <span className="absolute top-4 right-4 bg-[#B9812E]/15 border border-[#B9812E]/30 text-[#B9812E] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                {p.badge}
              </span>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase text-[#16233B]">{p.name}</h3>
                <p className="text-xs text-[#5B6B79] font-mono mt-0.5">{p.employeeLimit}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono text-[#16233B]">{p.price}</span>
                <span className="text-xs text-[#5B6B79] font-mono">{p.period}</span>
              </div>
              <ul className="pt-3 border-t border-[#F6F5F1] space-y-1.5 text-xs text-[#16233B]">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[#2E7D5B] font-bold">?</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-4 border-t border-[#F6F5F1] flex justify-between items-center mt-4">
              <span className="text-xs font-mono text-[#5B6B79]">{p.activeCompanies} Tenants</span>
              <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => setEditModal({ open: true, plan: { ...p } })}>Edit</Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold tracking-wider text-[#16233B] uppercase">Current Plan Distribution</h3>
        <DataTable columns={columns} data={tenantAssignments} badgeColorMap={badgeMap} />
      </div>

      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md p-6 bg-white space-y-4 border border-[#D8D3C7]">
            <h3 className="text-sm font-bold font-mono text-[#16233B]">Edit {editModal.plan.name}</h3>
            <div className="p-2.5 bg-[#C68A2E]/10 border border-[#C68A2E]/30 rounded text-[11px] text-[#16233B]">
              ?? Updating this tier will not affect existing tenants (grandfathered lock).
            </div>
            <Input label="Monthly Price" value={editModal.plan.price} onChange={(e) => setEditModal({ ...editModal, plan: { ...editModal.plan, price: e.target.value } })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditModal({ open: false, plan: null })}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                setPlans(plans.map(p => p.id === editModal.plan.id ? editModal.plan : p));
                setEditModal({ open: false, plan: null });
              }}>Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
