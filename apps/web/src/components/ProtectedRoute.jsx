import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, resolveHomeRoute } from '../context/AuthContext.jsx';
import { tokenStorage } from '../lib/tokenStorage.js';

export const ProtectedRoute = ({
  children,
  requiredRole,
  allowedRoles,
  requiredPermission,
  requiredPermissions,
  checkAccess,
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
    isCompanyAdmin,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F6F2] font-mono text-xs text-[#1D2530] space-y-2 select-none">
        <div className="w-8 h-8 rounded-full border-2 border-[#8C5D17] border-t-transparent animate-spin" />
        <span className="text-[#8C5D17] font-semibold">Authenticating Enclave Session...</span>
      </div>
    );
  }

  const token = contextToken || tokenStorage.getAccessToken();
  let user = contextUser || tokenStorage.getUser();

  if (typeof user === 'string') {
    try {
      user = JSON.parse(user);
    } catch {
      user = null;
    }
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super Admin universal bypass
  if (isSuperAdmin || String(user.role || '').toUpperCase() === 'SUPER_ADMIN') {
    return children ? children : <Outlet />;
  }

  // 1. Dynamic Access Function Gate
  if (typeof checkAccess === 'function') {
    const granted = checkAccess(user, hasAnyPermission, hasPermission);
    if (!granted) {
      const home = resolveHomeRoute(user);
      if (location.pathname === home) return children ? children : <Outlet />;
      return <Navigate to={home} replace />;
    }
    return children ? children : <Outlet />;
  }

  // 2. Granular Single Permission Verification
  if (requiredPermission && !hasPermission(requiredPermission)) {
    const home = resolveHomeRoute(user);
    if (location.pathname === home) return children ? children : <Outlet />;
    return <Navigate to={home} replace />;
  }

  // 3. Multiple Permissions Verification (At least one match)
  if (Array.isArray(requiredPermissions) && requiredPermissions.length > 0) {
    if (!hasAnyPermission(requiredPermissions)) {
      const home = resolveHomeRoute(user);
      if (location.pathname === home) return children ? children : <Outlet />;
      return <Navigate to={home} replace />;
    }
  }

  // 4. Fallback Role Verification
  const targetRoles = [];
  if (Array.isArray(allowedRoles)) {
    targetRoles.push(...allowedRoles.map((r) => String(r).trim().toUpperCase()));
  }
  if (requiredRole) {
    targetRoles.push(String(requiredRole).trim().toUpperCase());
  }

  if (targetRoles.length > 0 && !hasRole(targetRoles)) {
    const home = resolveHomeRoute(user);
    if (location.pathname === home) return children ? children : <Outlet />;
    return <Navigate to={home} replace />;
  }

  return children ? children : <Outlet />;
};

export const Can = ({
  permission,
  permissions,
  role,
  roles,
  children,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission, hasRole, isSuperAdmin, isCompanyAdmin } = useAuth();

  if (isSuperAdmin || isCompanyAdmin) return <>{children}</>;

  if (permission && !hasPermission(permission)) return fallback;
  if (Array.isArray(permissions) && permissions.length > 0 && !hasAnyPermission(permissions)) return fallback;
  if (role && !hasRole(role)) return fallback;
  if (Array.isArray(roles) && roles.length > 0 && !hasRole(roles)) return fallback;

  return <>{children}</>;
};

export default ProtectedRoute;