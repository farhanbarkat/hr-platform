import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, resolveHomeRoute } from '../context/AuthContext.jsx';
import { tokenStorage } from '../lib/tokenStorage.js';

/**
 * Enterprise Route Guard
 * Supports:
 * - requiredPermission: 'payroll.read'
 * - requiredPermissions: ['payroll.read', 'payroll.run'] (any match)
 * - allowedRoles / requiredRole: ['COMPANY_ADMIN', 'HR']
 */
export const ProtectedRoute = ({
  children,
  requiredRole,
  allowedRoles,
  requiredPermission,
  requiredPermissions,
}) => {
  const location = useLocation();
  const {
    user: contextUser,
    token: contextToken,
    loading,
    hasRole,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
  } = useAuth();

  // 1. Loading State (Hydration ke waqt block nahi karega)
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F6F2] font-mono text-xs text-[#1D2530] space-y-2 select-none">
        <div className="w-8 h-8 rounded-full border-2 border-[#8C5D17] border-t-transparent animate-spin" />
        <span className="text-[#8C5D17] font-semibold">Authenticating Enclave Session...</span>
      </div>
    );
  }

  // 2. Token & User Verification
  const token = contextToken || tokenStorage.getAccessToken();
  let user = contextUser || tokenStorage.getUser();

  if (typeof user === 'string') {
    try {
      user = JSON.parse(user);
    } catch {
      user = null;
    }
  }

  // Unauthenticated -> Login par bhejein with return state
  if (!token || !user) {
    console.warn('[Guard] Blocked: No active token or user profile found.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Super Admin Bypass (Super Admin har route aur permission par authorized hai)
  if (isSuperAdmin || String(user.role || '').toUpperCase() === 'SUPER_ADMIN') {
    return children ? children : <Outlet />;
  }

  // 4. Role-Based Verification
  const targetRoles = [];
  if (Array.isArray(allowedRoles)) {
    targetRoles.push(...allowedRoles.map((r) => String(r).trim().toUpperCase()));
  }
  if (requiredRole) {
    targetRoles.push(String(requiredRole).trim().toUpperCase());
  }

  if (targetRoles.length > 0 && !hasRole(targetRoles)) {
    console.warn(
      `[Guard] Blocked: Role mismatch. Required: [${targetRoles.join(', ')}], Current: ${user.role}`
    );
    const home = resolveHomeRoute(user);
    if (location.pathname === home) return children ? children : <Outlet />;
    return <Navigate to={home} replace />;
  }

  // 5. Granular Single Permission Verification ('resource.action')
  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.warn(`[Guard] Blocked: Missing mandatory permission "${requiredPermission}"`);
    const home = resolveHomeRoute(user);
    if (location.pathname === home) return children ? children : <Outlet />;
    return <Navigate to={home} replace />;
  }

  // 6. Multiple Permissions Verification (At least one required)
  if (Array.isArray(requiredPermissions) && requiredPermissions.length > 0) {
    if (!hasAnyPermission(requiredPermissions)) {
      console.warn(`[Guard] Blocked: Missing all matching permissions in:`, requiredPermissions);
      const home = resolveHomeRoute(user);
      if (location.pathname === home) return children ? children : <Outlet />;
      return <Navigate to={home} replace />;
    }
  }

  return children ? children : <Outlet />;
};

/**
 * UI Element Permission Gate Component
 * Screen ke andar buttons / actions ko permission ke mutabiq hide karne ke liye
 * Example: <Can permission="payroll.run"><button>Execute Batch</button></Can>
 */
export const Can = ({
  permission,
  permissions,
  role,
  roles,
  children,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission, hasRole, isSuperAdmin } = useAuth();

  if (isSuperAdmin) return <>{children}</>;

  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  if (Array.isArray(permissions) && permissions.length > 0 && !hasAnyPermission(permissions)) {
    return fallback;
  }

  if (role && !hasRole(role)) {
    return fallback;
  }

  if (Array.isArray(roles) && roles.length > 0 && !hasRole(roles)) {
    return fallback;
  }

  return <>{children}</>;
};

export default ProtectedRoute;