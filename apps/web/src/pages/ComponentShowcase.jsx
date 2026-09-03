import React, { useState } from 'react';
import { Sidebar } from '@repo/ui';

// Mock SVG icons
const DashboardIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
  </svg>
);
const TenantIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
  </svg>
);
const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const PayrollIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function ComponentShowcase() {
  const [activeSuper, setActiveSuper] = useState('tenants');
  const [activeCompany, setActiveCompany] = useState('payroll');

  // Configuration A: Super Admin Props
  const superAdminProps = {
    productName: 'PLATFORM CORE',
    subtitle: 'SUPER ADMIN',
    badgeText: 'PROD V1.0.0',
    navItems: [
      { id: 'overview', label: 'System Overview', icon: <DashboardIcon />, active: activeSuper === 'overview', onClick: () => setActiveSuper('overview') },
      { id: 'tenants', label: 'Tenant Directory', icon: <TenantIcon />, active: activeSuper === 'tenants', onClick: () => setActiveSuper('tenants'), badge: '12' },
    ],
    user: {
      name: 'System Root',
      email: 'root@platform.io',
      initials: 'SR',
    },
    onLogout: () => alert('Logout clicked'),
  };

  // Configuration B: Company Admin Props (Reused verbatim, completely different data)
  const companyAdminProps = {
    productName: 'CLOUDFLOW HR',
    subtitle: 'COMPANY ADMIN',
    badgeText: 'ENTERPRISE',
    navItems: [
      { id: 'workforce', label: 'Employees', icon: <UsersIcon />, active: activeCompany === 'workforce', onClick: () => setActiveCompany('workforce') },
      { id: 'payroll', label: 'Payroll & Ledger', icon: <PayrollIcon />, active: activeCompany === 'payroll', onClick: () => setActiveCompany('payroll') },
    ],
    user: {
      name: 'Sarah Connor',
      email: 'admin@cloudlogic.com',
      initials: 'SC',
    },
    onLogout: () => alert('Logout clicked'),
  };

  return (
    <div className="min-h-screen bg-[#F6F5F1] p-6 space-y-6">
      <h1 className="text-xl font-bold font-mono text-[#16233B]">
        SA-FE-001: Sidebar Navigation Verification
      </h1>

      <div className="flex gap-8 items-start">
        {/* Render 1: Super Admin */}
        <div className="border border-[#D8D3C7] rounded-[8px] overflow-hidden shadow-sm">
          <div className="bg-[#E4E0D5] px-3 py-1.5 text-[11px] font-mono font-bold text-[#16233B]">
            Scenario 1: Super Admin Configuration
          </div>
          <div className="h-[520px]">
            <Sidebar {...superAdminProps} />
          </div>
        </div>

        {/* Render 2: Company Admin */}
        <div className="border border-[#D8D3C7] rounded-[8px] overflow-hidden shadow-sm">
          <div className="bg-[#E4E0D5] px-3 py-1.5 text-[11px] font-mono font-bold text-[#16233B]">
            Scenario 2: Company Admin Configuration (Verbatim Reuse)
          </div>
          <div className="h-[520px]">
            <Sidebar {...companyAdminProps} />
          </div>
        </div>
      </div>
    </div>
  );
}