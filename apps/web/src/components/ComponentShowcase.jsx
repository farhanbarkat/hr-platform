import React, { useState } from 'react';
import { Sidebar, TopBar, Button } from '@repo/ui';

const DashboardIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
  </svg>
);
const TenantIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
  </svg>
);

export default function ComponentShowcase() {
  const [activeSuper, setActiveSuper] = useState('tenants');
  const [searchValue, setSearchValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(4);

  const superAdminSidebarProps = {
    productName: 'PLATFORM CORE',
    subtitle: 'SUPER ADMIN',
    badgeText: 'PROD V1.0.0',
    navItems: [
      { id: 'overview', label: 'System Overview', icon: <DashboardIcon />, active: activeSuper === 'overview', onClick: () => setActiveSuper('overview') },
      { id: 'tenants', label: 'Tenant Directory', icon: <TenantIcon />, active: activeSuper === 'tenants', onClick: () => setActiveSuper('tenants'), badge: '12' },
    ],
    user: { name: 'System Root', email: 'root@platform.io', initials: 'SR' },
    onLogout: () => alert('Logout clicked'),
  };

  return (
    <div className="min-h-screen bg-[#F6F5F1] p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold font-mono text-[#16233B]">
          SA-FE-002: Top Bar Component Verification
        </h1>
        <p className="text-xs font-mono text-[#5B6B79] mt-1">
          Paper background (#F6F5F1) + Ledger border (#D8D3C7) + Fully prop-driven controls
        </p>
      </div>

      {/* TopBar Showcase 1: Super Admin TopBar */}
      <div className="border border-[#D8D3C7] rounded-[8px] overflow-hidden bg-white shadow-xs">
        <div className="bg-[#E4E0D5] px-4 py-1.5 text-[11px] font-mono font-bold text-[#16233B]">
          Variant 1: Super Admin TopBar (Unread Badge: {unreadCount} + Help)
        </div>
        <TopBar
          searchPlaceholder="Search system tenants, audit logs..."
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          unreadCount={unreadCount}
          onNotificationsClick={() => setUnreadCount(0)}
          onHelpClick={() => alert('Opening Help Modal')}
        />
      </div>

      {/* TopBar Showcase 2: Company Admin TopBar with Action Button */}
      <div className="border border-[#D8D3C7] rounded-[8px] overflow-hidden bg-white shadow-xs">
        <div className="bg-[#E4E0D5] px-4 py-1.5 text-[11px] font-mono font-bold text-[#16233B]">
          Variant 2: Company Admin TopBar with Custom Action Button
        </div>
        <TopBar
          searchPlaceholder="Search employees by name, ID or department..."
          showNotifications={true}
          unreadCount={0}
          showHelp={false}
          actions={
            <Button variant="primary" className="text-xs py-1.5 px-3">
              + Add Employee
            </Button>
          }
        />
      </div>

      {/* Integrated Full Layout Shell Test */}
      <div className="border border-[#D8D3C7] rounded-[8px] overflow-hidden shadow-xs">
        <div className="bg-[#E4E0D5] px-4 py-1.5 text-[11px] font-mono font-bold text-[#16233B]">
          Variant 3: Combined Shell (Sidebar + TopBar + Main Area)
        </div>
        <div className="flex h-[420px]">
          <Sidebar {...superAdminSidebarProps} />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar
              searchPlaceholder="Quick jump to tenant..."
              unreadCount={2}
            />
            <main className="flex-1 p-6 bg-[#F6F5F1] overflow-y-auto">
              <div className="border-2 border-dashed border-[#D8D3C7] rounded-[8px] h-full flex items-center justify-center text-xs font-mono text-[#5B6B79]">
                Main Workspace Content Area
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}