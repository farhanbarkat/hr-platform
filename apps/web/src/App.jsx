import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth, resolveHomeRoute } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { PERMISSIONS } from './config/permissions.js';

import LoginScreen from './features/auth/LoginScreen.jsx';
import ComponentShowcase from './pages/ComponentShowcase.jsx';

// Super Admin Layout & Views
import SuperAdminLayout from './features/superAdmin/SuperAdminLayout.jsx';
import PlatformTelemetry from './features/superAdmin/PlatformTelemetry.jsx';
import TenantManagement from './features/superAdmin/TenantManagement.jsx';
import PlansTiers from './features/superAdmin/PlansTiers.jsx';
import BillingInvoices from './features/superAdmin/BillingInvoices.jsx';
import AuditLogs from './features/superAdmin/AuditLogs.jsx';
import SupportDesk from './features/superAdmin/SupportDesk.jsx';
import SystemSettings from './features/superAdmin/SystemSettings.jsx';

// Company Admin Layout & Views
import AppSidebar from './components/AppSidebar.jsx';
import ExecutiveOverview from './features/admin/ExecutiveOverview.jsx';
import WorkforceDirectory from './features/admin/WorkforceDirectory.jsx';
import DepartmentsShifts from './features/admin/DepartmentsShifts.jsx';
import LeaveOperations from './features/admin/LeaveOperations.jsx';
import AttendanceTracking from './features/admin/TimeAttendance.jsx';
import PayrollCompensation from './features/admin/PayrollCompensation.jsx';
import CompanyFinance from './features/admin/CompanyFinance.jsx';
import OrganizationSettings from './features/admin/OrganizationSettings.jsx';
import RoleCapabilityManager from './features/admin/RoleCapabilityManager.jsx';
import EmployeeDashboard from './features/ess/EmployeeDashboard.jsx';
import ShiftInchargeDashboard from './features/shifts/ShiftInchargeDashboard.jsx';
import DirectChatDesk from './features/communication/DirectChatDesk.jsx';
import { FinanceOperationsDesk } from './features/financeDashboard/index.js';

// Public Route Guard
function PublicOnlyRoute({ children }) {
  const {
    user,
    isAuthenticated,
    loading,
    resolveHomeRoute: getHome,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F7F6F2] font-mono text-xs text-[#B9812E]">
        Verifying platform session...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <Navigate to={getHome ? getHome() : resolveHomeRoute(user)} replace />
    );
  }

  return children;
}

// Company Admin Shell Layout
function CompanyAdminShell() {
  return (
    <div className="flex min-h-screen bg-[#F7F6F2]">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const {
    user,
    isAuthenticated,
    loading,
    resolveHomeRoute: getHome,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F7F6F2] font-mono text-xs text-[#B9812E]">
        Loading application enclave...
      </div>
    );
  }

  return (
    <Routes>
      {/* 1. Public Authentication Route */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginScreen />
          </PublicOnlyRoute>
        }
      />

      <Route path="/dev/components" element={<ComponentShowcase />} />

      {/* ESS Dashboard */}
      <Route
        path="/employee/dashboard"
        element={
          <ProtectedRoute>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      {/* 2. Super Admin Protected Routes */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<Navigate to="/super-admin/telemetry" replace />}
        />
        <Route path="telemetry" element={<PlatformTelemetry />} />
        <Route path="tenants" element={<TenantManagement />} />
        <Route path="plans" element={<PlansTiers />} />
        <Route path="billing" element={<BillingInvoices />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="support" element={<SupportDesk />} />
        <Route path="settings" element={<SystemSettings />} />
      </Route>

      {/* 3. Company Admin Protected Routes (Dynamic SaaS Capability Gates) */}
      <Route
        path="/company-admin"
        element={
          <ProtectedRoute
            checkAccess={(authUser, hasAnyPerm) => {
              const role = String(authUser.role || '').toUpperCase();
              if (['COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(role) || authUser.isCompanyOwner) {
                return true;
              }
              return hasAnyPerm([
                'employee.read',
                'employee.create',
                'leave.read',
                'leave.view_team',
                'leave.approve_hr',
                'leave.approve_manager',
                'attendance.read',
                'attendance.view_team',
                'payroll.read',
                'payroll.run',
                'company.read',
                'company.configure',
                'finance.view_dashboard',
                'settings.read',
              ]);
            }}
          >
            <CompanyAdminShell />
          </ProtectedRoute>
        }
      >
        {/* Default Overview Landing */}
        <Route
          index
          element={<Navigate to="/company-admin/overview" replace />}
        />
        <Route path="overview" element={<ExecutiveOverview />} />

        {/* Workforce Directory */}
        <Route
          path="employees"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.EMPLOYEE.READ}>
              <WorkforceDirectory />
            </ProtectedRoute>
          }
        />

        {/* Roles & Delegation */}
        <Route
          path="roles-capabilities"
          element={
            <ProtectedRoute
              allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}
              requiredPermissions={[PERMISSIONS.COMPANY.CONFIGURE]}
            >
              <RoleCapabilityManager />
            </ProtectedRoute>
          }
        />

        {/* Departments & Shifts */}
        <Route
          path="departments"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.COMPANY.READ}>
              <DepartmentsShifts />
            </ProtectedRoute>
          }
        />

        {/* Shift Incharge Live Floor Monitoring */}
        <Route
          path="shift-incharge"
          element={
            <ProtectedRoute>
              <ShiftInchargeDashboard />
            </ProtectedRoute>
          }
        />

        {/* Attendance Tracking */}
        <Route
          path="attendance"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.ATTENDANCE.READ}>
              <AttendanceTracking />
            </ProtectedRoute>
          }
        />

        {/* Direct Chat Desk Integration (TICKET-034) */}
        <Route
          path="communication"
          element={
            <ProtectedRoute>
              <DirectChatDesk />
            </ProtectedRoute>
          }
        />

        {/* Leave Operations */}
        <Route
          path="leaves"
          element={
            <ProtectedRoute
              requiredPermissions={[
                PERMISSIONS.LEAVE.VIEW_TEAM,
                PERMISSIONS.LEAVE.READ,
              ]}
            >
              <LeaveOperations />
            </ProtectedRoute>
          }
        />

        {/* Payroll & Compensation */}
        <Route
          path="payroll"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.PAYROLL.READ}>
              <PayrollCompensation />
            </ProtectedRoute>
          }
        />

        {/* 1. Executive Macro Financial Overview */}
        <Route
          path="finance-overview"
          element={
            <ProtectedRoute
              requiredPermission={PERMISSIONS.FINANCE.VIEW_DASHBOARD}
            >
              <CompanyFinance />
            </ProtectedRoute>
          }
        />

        {/* 2. Operational Finance & Expense Claims Desk */}
        <Route
          path="finance"
          element={
            <ProtectedRoute
              requiredPermission={PERMISSIONS.FINANCE.VIEW_DASHBOARD}
            >
              <FinanceOperationsDesk />
            </ProtectedRoute>
          }
        />

        {/* Organization Settings */}
        <Route
          path="settings"
          element={
            <ProtectedRoute
              requiredPermissions={[
                PERMISSIONS.SETTINGS.READ,
                PERMISSIONS.COMPANY.CONFIGURE,
                PERMISSIONS.SETTINGS.UPDATE,
              ]}
            >
              <OrganizationSettings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 4. Global Alias for Shift Incharge Dashboard */}
      <Route
        path="/shift-incharge/dashboard"
        element={
          <ProtectedRoute>
            <CompanyAdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<ShiftInchargeDashboard />} />
      </Route>

      {/* 5. Backward Compatibility Aliases for '/admin/*' */}
      <Route
        path="/admin/*"
        element={
          <Navigate
            to={
              user ? (getHome ? getHome() : resolveHomeRoute(user)) : '/login'
            }
            replace
          />
        }
      />

      {/* 6. Root Entry Point */}
      <Route
        path="/"
        element={
          isAuthenticated && user ? (
            <Navigate
              to={getHome ? getHome() : resolveHomeRoute(user)}
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* 7. Catch-All Route */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              user ? (getHome ? getHome() : resolveHomeRoute(user)) : '/login'
            }
            replace
          />
        }
      />
    </Routes>
  );
}