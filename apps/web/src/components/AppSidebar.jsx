import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PERMISSIONS } from '../config/permissions.js';

const Icons = {
  Overview: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Workforce: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Departments: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Incharge: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    </svg>
  ),
  Attendance: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  ),
  Chat: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Leaves: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Payroll: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  Finance: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Ledger: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="13" y2="11" />
    </svg>
  ),
  Roles: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Settings: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),

  Loan: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 6V4m0 16v-2" />
    </svg>
  ),

  SignOut: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

export default function AppSidebar() {
  const { user, logout, hasPermission, hasAnyPermission, isSuperAdmin } =
    useAuth();
  const navigate = useNavigate();

  const isCompanyAdmin =
    user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN';

  const [resolvedCompanyName, setResolvedCompanyName] = useState(() => {
    return user?.companyName || user?.company?.name || 'Cloudlogic';
  });

  useEffect(() => {
    if (user?.companyName || user?.company?.name) {
      setResolvedCompanyName(user.companyName || user.company.name);
    }
  }, [user]);

  const operationsNav = [
    {
      label: 'Executive Overview',
      path: '/company-admin/overview',
      Icon: Icons.Overview,
      isAccessible: true,
    },
    {
      label: 'Workforce Directory',
      path: '/company-admin/employees',
      Icon: Icons.Workforce,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.EMPLOYEE.READ),
    },
    {
      label: 'Departments & Shifts',
      path: '/company-admin/departments',
      Icon: Icons.Departments,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.COMPANY.READ),
    },
    {
      label: 'Shift Incharge Desk',
      path: '/shift-incharge/dashboard',
      Icon: Icons.Incharge,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        user?.role === 'HR' ||
        user?.role === 'MANAGER' ||
        hasPermission(PERMISSIONS.ATTENDANCE.VIEW_TEAM),
    },
    {
      label: 'Time & Attendance',
      path: '/company-admin/attendance',
      Icon: Icons.Attendance,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.ATTENDANCE.READ),
    },
    {
      label: 'Direct Chat Desk',
      path: '/company-admin/communication',
      Icon: Icons.Chat,
      isAccessible: true,
    },
    {
      label: 'Leave Operations',
      path: '/company-admin/leaves',
      Icon: Icons.Leaves,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasAnyPermission([
          PERMISSIONS.LEAVE.VIEW_TEAM,
          PERMISSIONS.LEAVE.READ,
          PERMISSIONS.LEAVE.APPROVE_MANAGER,
          PERMISSIONS.LEAVE.APPROVE_HR,
        ]),
    },
    {
      label: 'Payroll & Compensation',
      path: '/company-admin/payroll',
      Icon: Icons.Payroll,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.PAYROLL.READ),
    },

    {
      label: 'Loan & Advances',
      path: '/company-admin/loans',
      Icon: Icons.Loan,
      isAccessible: true,
    },
  ];

  const platformNav = [
    {
      label: 'Executive Financials',
      path: '/company-admin/finance-overview',
      Icon: Icons.Finance,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.FINANCE.VIEW_DASHBOARD),
    },
    {
      label: 'Finance & Claims Desk',
      path: '/company-admin/finance',
      Icon: Icons.Ledger,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.FINANCE.VIEW_DASHBOARD),
    },
    {
      label: 'Roles & Delegation',
      path: '/company-admin/roles-capabilities',
      Icon: Icons.Roles,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasPermission(PERMISSIONS.COMPANY.CONFIGURE),
    },
    {
      label: 'Organization Settings',
      path: '/company-admin/settings',
      Icon: Icons.Settings,
      isAccessible:
        isSuperAdmin ||
        isCompanyAdmin ||
        hasAnyPermission([
          PERMISSIONS.SETTINGS.READ,
          PERMISSIONS.COMPANY.CONFIGURE,
          PERMISSIONS.SETTINGS.UPDATE,
        ]),
    },
  ];

  const visibleOperations = operationsNav.filter((i) => i.isAccessible);
  const visiblePlatform = platformNav.filter((i) => i.isAccessible);

  const renderItem = ({ label, path, Icon }) => (
    <NavLink
      key={path}
      to={path}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-[7px] text-[11px] font-sans transition-colors rounded-[3px] ${
          isActive
            ? 'bg-[#C98A2C] text-white font-medium shadow-xs'
            : 'text-[#8C9BAE] hover:text-[#D4DEEB] hover:bg-[#141F32]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-white' : 'text-[#6C7D93]'}>
            <Icon />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="w-[230px] shrink-0 bg-[#0B1320] min-h-screen text-[#8C9BAE] flex flex-col justify-between border-r border-[#162235] select-none font-sans">
      <div>
        <div className="p-3.5 pb-3 border-b border-[#162235]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#18263D] text-[#C98A2C] border border-[#273B5B] flex items-center justify-center font-serif font-bold text-xs">
              {resolvedCompanyName.charAt(0).toUpperCase()}
            </div>

            <div className="overflow-hidden">
              <h2 className="text-[11.5px] font-bold text-white tracking-wide truncate leading-tight">
                {resolvedCompanyName}
              </h2>

              <span className="inline-block px-1.5 py-[0.5px] bg-[#C98A2C]/15 text-[#E5B56A] border border-[#C98A2C]/30 text-[8px] font-mono tracking-wider rounded-[2px] uppercase mt-0.5 truncate max-w-[170px]">
                {user?.jobTitle ||
                  user?.designation ||
                  (user?.role ? String(user.role).replace('_', ' ') : 'STAFF')}
              </span>
            </div>
          </div>
        </div>

        {visibleOperations.length > 0 && (
          <>
            <div className="px-3 pt-3.5 pb-1">
              <span className="text-[8.5px] font-mono tracking-widest text-[#4E6178] uppercase font-semibold">
                OPERATIONS DIRECTORY
              </span>
            </div>

            <nav className="space-y-[1px] px-2">
              {visibleOperations.map(renderItem)}
            </nav>
          </>
        )}

        {visiblePlatform.length > 0 && (
          <>
            <div className="px-3 pt-4 pb-1">
              <span className="text-[8.5px] font-mono tracking-widest text-[#4E6178] uppercase font-semibold">
                PLATFORM ARCHITECTURE
              </span>
            </div>

            <nav className="space-y-[1px] px-2">
              {visiblePlatform.map(renderItem)}
            </nav>
          </>
        )}
      </div>

      <div className="p-3 border-t border-[#162235] bg-[#080E18] space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#18263D] border border-[#2B3E5E] flex items-center justify-center text-[10.5px] font-bold text-white">
              {user?.firstName?.charAt(0) ||
                user?.email?.charAt(0).toUpperCase() ||
                'A'}
            </div>

            <div className="overflow-hidden">
              <div className="text-[11px] font-bold text-white leading-tight truncate">
                {user?.firstName
                  ? `${user.firstName} ${user.lastName || ''}`
                  : user?.email?.split('@')[0] || 'Admin'}
              </div>

              <div className="text-[9px] text-[#556982] font-mono leading-tight truncate">
                {user?.email || 'admin@cloudlogic.com'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Sign Out"
            className="text-[#556982] hover:text-[#E05238] transition-colors p-1 cursor-pointer"
          >
            <Icons.SignOut />
          </button>
        </div>

        <button
          onClick={() => navigate('/employee/dashboard')}
          className="w-full py-1.5 px-2 bg-[#101A2B] hover:bg-[#16243C] text-[9.5px] font-mono text-[#8C9BAE] rounded-[3px] flex items-center justify-between border border-[#1C2C45] transition-all cursor-pointer"
        >
          <span>⇄ ESS Portal View</span>
          <span className="text-[#C98A2C] font-mono">&rarr;</span>
        </button>
      </div>
    </aside>
  );
}
