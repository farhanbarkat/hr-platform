import { PERMISSIONS, hasUserPermission } from '../config/permissions.js';

/**
 * Enterprise Permission & Role Resolver for App Landing
 * Fallback priority: Super Admin -> Management Permissions -> ESS
 */
export const getRedirectPathByRole = (userOrRole) => {
  if (!userOrRole) return '/login';

  const user = typeof userOrRole === 'object' ? userOrRole : { role: userOrRole, permissions: [] };
  const role = String(user.role || '').trim().toUpperCase();

  // 1. Super Admin Enclave
  if (role === 'SUPER_ADMIN') {
    return '/super-admin/telemetry';
  }

  // 2. Tenant Executive / Management with Permissions
  if (['COMPANY_ADMIN', 'ADMIN', 'HR', 'HR_MANAGER', 'MANAGER'].includes(role)) {
    return '/company-admin/overview';
  }

  // 3. Granular Permission Checks (Custom Roles)
  if (
    hasUserPermission(user, PERMISSIONS.PAYROLL.READ) ||
    hasUserPermission(user, PERMISSIONS.EMPLOYEE.READ) ||
    hasUserPermission(user, PERMISSIONS.ATTENDANCE.READ)
  ) {
    return '/company-admin/overview';
  }

  // 4. Default Employee Self Service Portal
  return '/employee/dashboard';
};