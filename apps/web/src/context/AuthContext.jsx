import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../lib/apiClient.js';
import { tokenStorage } from '../lib/tokenStorage.js';
import { getDefaultPermissionsForRole, hasUserPermission } from '../config/permissions.js';

export const AuthContext = createContext(null);

/**
 * Pure Capability-Driven SaaS Landing Resolver
 * Role title par nahi, user ke granted capabilities array par decide karta hai.
 */
export const resolveHomeRoute = (user) => {
  if (!user) return '/login';

  const role = String(user.role || '').trim().toUpperCase();

  // 1. Root Platform Super Admin
  if (role === 'SUPER_ADMIN' || user.isSuperAdmin) {
    return '/super-admin/telemetry';
  }

  // 2. Tenant Owner / System Administrator
  if (['COMPANY_ADMIN', 'ADMIN'].includes(role) || user.isCompanyOwner) {
    return '/company-admin/overview';
  }

  // Compile active permission strings
  const permsList = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : getDefaultPermissionsForRole(role);

  const permissionsSet = new Set(permsList);

  // 3. Management / Administrative Authority
  const managementCapabilities = [
    'employee.read',
    'employee.create',
    'leave.read',
    'leave.approve_hr',
    'leave.approve_manager',
    'attendance.read',
    'payroll.read',
    'payroll.run',
    'company.read',
    'company.configure',
    'finance.view_dashboard',
    'settings.read',
  ];

  const hasManagementPower = managementCapabilities.some((cap) => permissionsSet.has(cap));
  if (hasManagementPower) {
    return '/company-admin/overview';
  }

  // 4. Shift Incharge / Floor Lead
  if (permissionsSet.has('attendance.view_team')) {
    return '/shift-incharge/dashboard';
  }

  // 5. Standard Staff (ESS Portal)
  return '/employee/dashboard';
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStorage.getUser());
  const [token, setToken] = useState(() => tokenStorage.getAccessToken());
  const [loading, setLoading] = useState(true);

  // 1. Initial Session Hydration
  const hydrateSession = useCallback(async () => {
    const storedToken = tokenStorage.getAccessToken();
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.get('/auth/me');
      const payload = res.data?.data || res.data;
      const freshUser = payload.user || payload;

      if (freshUser) {
        // Guarantee permissions array exists
        if (!Array.isArray(freshUser.permissions) || freshUser.permissions.length === 0) {
          freshUser.permissions = getDefaultPermissionsForRole(freshUser.role);
        }
        setUser(freshUser);
        tokenStorage.setUser(freshUser);
      }
    } catch (err) {
      console.warn('Session hydration failed:', err.message);
      const cached = tokenStorage.getUser();
      if (!cached) {
        tokenStorage.clearTokens();
        setUser(null);
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateSession();
    const handleSessionExpired = () => logout();
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [hydrateSession]);

  // 2. Login Flow
  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const payload = response.data?.data || response.data || {};

      if (payload.requires2FA || payload.challengeToken || payload.mfaRequired) {
        return {
          requires2FA: true,
          challengeToken: payload.challengeToken || payload.tempToken,
          isEnrolled: payload.isEnrolled ?? (payload.qrCode ? false : true),
          qrCode: payload.qrCode || payload.qrCodeDataUrl || null,
          secret: payload.secret || null,
        };
      }

      const accessToken = payload.accessToken || payload.token;
      const refreshToken = payload.refreshToken;
      let userData = payload.user || payload.employee;

      if (!accessToken || !userData) {
        throw new Error('Malformed login response: Missing token or user object.');
      }

      if (!Array.isArray(userData.permissions) || userData.permissions.length === 0) {
        userData.permissions = getDefaultPermissionsForRole(userData.role);
      }

      tokenStorage.setAccessToken(accessToken);
      if (refreshToken) tokenStorage.setRefreshToken(refreshToken);
      tokenStorage.setUser(userData);

      setToken(accessToken);
      setUser(userData);

      return {
        requires2FA: false,
        user: userData,
        homeRoute: resolveHomeRoute(userData),
      };
    } catch (error) {
      throw error;
    }
  };

  // 3. 2FA Verification Flow
  const verify2FA = async (challengeToken, code, isEnrolled = true) => {
    setLoading(true);
    try {
      const endpoint = !isEnrolled ? '/auth/2fa/confirm' : '/auth/2fa/verify-login';
      const cleanCode = String(code).trim();

      const response = await apiClient.post(
        endpoint,
        { totpToken: cleanCode, code: cleanCode },
        { headers: { Authorization: `Bearer ${challengeToken}` } }
      );

      const payload = response.data?.data || response.data || {};
      const accessToken = payload.accessToken || payload.token;
      let userData = payload.user;

      if (accessToken && userData) {
        if (!Array.isArray(userData.permissions) || userData.permissions.length === 0) {
          userData.permissions = getDefaultPermissionsForRole(userData.role);
        }

        tokenStorage.setAccessToken(accessToken);
        if (payload.refreshToken) tokenStorage.setRefreshToken(payload.refreshToken);
        tokenStorage.setUser(userData);

        setToken(accessToken);
        setUser(userData);
      }

      setLoading(false);
      return { user: userData, homeRoute: resolveHomeRoute(userData) };
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    tokenStorage.clearTokens();
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const isSuperAdmin = useMemo(() => {
    return String(user?.role || '').trim().toUpperCase() === 'SUPER_ADMIN';
  }, [user]);

  const isCompanyAdmin = useMemo(() => {
    const r = String(user?.role || '').trim().toUpperCase();
    return isSuperAdmin || r === 'COMPANY_ADMIN' || r === 'ADMIN' || Boolean(user?.isCompanyOwner);
  }, [user, isSuperAdmin]);

  const hasPermission = useCallback(
    (requiredPermission) => {
      if (!user) return false;
      if (isSuperAdmin || isCompanyAdmin) return true;
      return hasUserPermission(user, requiredPermission);
    },
    [user, isSuperAdmin, isCompanyAdmin]
  );

  const hasAnyPermission = useCallback(
    (permissions = []) => {
      if (!user) return false;
      if (isSuperAdmin || isCompanyAdmin) return true;
      if (!Array.isArray(permissions) || permissions.length === 0) return true;
      return permissions.some((perm) => hasPermission(perm));
    },
    [user, isSuperAdmin, isCompanyAdmin, hasPermission]
  );

  const hasAllPermissions = useCallback(
    (permissions = []) => {
      if (!user) return false;
      if (isSuperAdmin || isCompanyAdmin) return true;
      if (!Array.isArray(permissions) || permissions.length === 0) return true;
      return permissions.every((perm) => hasPermission(perm));
    },
    [user, isSuperAdmin, isCompanyAdmin, hasPermission]
  );

  const hasRole = useCallback(
    (roleOrRoles) => {
      if (!user) return false;
      const currentRole = String(user.role || '').trim().toUpperCase();
      if (Array.isArray(roleOrRoles)) {
        return roleOrRoles.map((r) => String(r).trim().toUpperCase()).includes(currentRole);
      }
      return currentRole === String(roleOrRoles).trim().toUpperCase();
    },
    [user]
  );

  const contextValue = useMemo(
    () => ({
      user,
      token,
      loading,
      isLoading: loading,
      isAuthenticated: Boolean(token && user),
      isSuperAdmin,
      isCompanyAdmin,
      login,
      verify2FA,
      logout,
      hasRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      resolveHomeRoute: () => resolveHomeRoute(user),
    }),
    [
      user,
      token,
      loading,
      isSuperAdmin,
      isCompanyAdmin,
      hasRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}