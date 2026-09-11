import React, { useState, useEffect } from 'react';
import { Sidebar, TopBar } from '@repo/ui';
import PlatformTelemetry from '../features/superAdmin/PlatformTelemetry.jsx';

export default function ComponentShowcase() {
  const [activeTab, setActiveTab] = useState('telemetry');

  const navItems = [
    { id: 'telemetry', label: 'Platform Telemetry', active: activeTab === 'telemetry', onClick: () => setActiveTab('telemetry') },
    { id: 'tenants', label: 'Tenant Management', active: activeTab === 'tenants', onClick: () => setActiveTab('tenants') },
    { id: 'plans', label: 'Plans & Tiers', active: activeTab === 'plans', onClick: () => setActiveTab('plans') },
    { id: 'billing', label: 'Billing & Invoices', active: activeTab === 'billing', onClick: () => setActiveTab('billing') },
    { id: 'audit', label: 'Audit Logs', active: activeTab === 'audit', onClick: () => setActiveTab('audit') },
    { id: 'support', label: 'Support Desk', active: activeTab === 'support', onClick: () => setActiveTab('support') },
    { id: 'settings', label: 'System Settings', active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
  ];

  return (
    <div className="flex min-h-screen bg-[#F6F5F1] text-[#16233B]">
      <Sidebar
        productName="PLATFORM CORE"
        subtitle="SUPER ADMIN"
        badgeText="PROD V1.0.0"
        navItems={navItems}
        user={{
          name: 'Alex Vance',
          email: 'alex.v@platform.io',
          initials: 'AV',
        }}
        onLogout={() => alert('Logout clicked')}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar searchPlaceholder="Search commands..." />
        <main className="flex-1 p-8 overflow-y-auto">
          <PlatformTelemetry />
        </main>
      </div>
    </div>
  );
}
