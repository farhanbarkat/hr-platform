import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, TopBar } from '@repo/ui';
import { useAuth } from '../../context/AuthContext.jsx';

const NavIcons = {
  Telemetry: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  Tenants: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
    </svg>
  ),
  Plans: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Billing: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Audit: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  Support: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [impersonationReason, setImpersonationReason] = useState(() =>
    sessionStorage.getItem('impersonation_active')
  );

  const navItems = [
    { id: 'telemetry', label: 'Platform Telemetry', icon: <NavIcons.Telemetry />, active: location.pathname === '/admin/telemetry', onClick: () => navigate('/admin/telemetry') },
    { id: 'tenants', label: 'Tenant Management', icon: <NavIcons.Tenants />, active: location.pathname.startsWith('/admin/tenants'), onClick: () => navigate('/admin/tenants') },
    { id: 'plans', label: 'Plans & Tiers', icon: <NavIcons.Plans />, active: location.pathname === '/admin/plans', onClick: () => navigate('/admin/plans') },
    { id: 'billing', label: 'Billing & Invoices', icon: <NavIcons.Billing />, active: location.pathname === '/admin/billing', onClick: () => navigate('/admin/billing') },
    { id: 'audit', label: 'Audit Logs', icon: <NavIcons.Audit />, active: location.pathname === '/admin/audit', onClick: () => navigate('/admin/audit') },
    { id: 'support', label: 'Support Desk', icon: <NavIcons.Support />, active: location.pathname === '/admin/support', onClick: () => navigate('/admin/support') },
    { id: 'settings', label: 'System Settings', icon: <NavIcons.Settings />, active: location.pathname === '/admin/settings', onClick: () => navigate('/admin/settings') },
  ];

  return (
    <div className="flex h-screen bg-[#F6F5F1] overflow-hidden">
      <Sidebar
        productName="PLATFORM CORE"
        subtitle="SUPER ADMIN"
        badgeText="PROD V1.0.0"
        navItems={navItems}
        user={{
          name: user?.fullName || user?.name || 'System Root',
          email: user?.email || 'root@platform.io',
          initials: 'SA',
        }}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Security Impersonation Banner */}
        {impersonationReason && (
          <div className="bg-[#B9812E] text-[#0E1826] px-4 py-2 flex items-center justify-between text-xs font-mono font-semibold">
            <span>⚠️ ACTIVE IMPERSONATION SESSION — Reason: {impersonationReason}</span>
            <button
              onClick={() => {
                sessionStorage.removeItem('impersonation_active');
                setImpersonationReason(null);
                window.location.reload();
              }}
              className="bg-[#0E1826] text-white px-2 py-0.5 rounded text-[11px] hover:bg-[#16233B]"
            >
              Exit Impersonation
            </button>
          </div>
        )}

        <TopBar searchPlaceholder="Search platform entities, tenants, logs..." />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}