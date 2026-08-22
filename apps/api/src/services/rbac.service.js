import { RolePermission } from '../models/rolePermission.model.js';
import { AccessLog } from '../models/accessLog.model.js';
import { getDefaultPermissionsForRole } from '../config/permissions.js';

class RBACService {
  constructor() {
    this.permissionCache = new Map();
    this.CACHE_TTL_MS = 5 * 60 * 1000;
  }

  async getUserPermissions(user) {
    if (!user) return [];

    // 1. Super Admin aur Company Admin ke paas automatically saari permissions hain
    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') {
      return getDefaultPermissionsForRole(user.role);
    }

    const cacheKey = `${user.companyId}:${user.role}`;
    const now = Date.now();

    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.permissions;
    }

    let permissions;
    try {
      if (RolePermission && typeof RolePermission.getEffectivePermissions === 'function') {
        permissions = await RolePermission.getEffectivePermissions(user.companyId, user.role);
      }
      if (!permissions || permissions.length === 0) {
        permissions = getDefaultPermissionsForRole(user.role);
      }
    } catch (err) {
      console.error('RBAC: Failed to fetch permissions, using defaults:', err.message);
      permissions = getDefaultPermissionsForRole(user.role);
    }

    this.permissionCache.set(cacheKey, {
      permissions,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return permissions;
  }

  async hasPermission(user, permission) {
    if (!user) return false;

    // Direct Bypass for Admins
    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') {
      return true;
    }

    const permissions = await this.getUserPermissions(user);
    return permissions.includes(permission);
  }

  async hasAllPermissions(user, permissions) {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN') return true;
    const userPerms = await this.getUserPermissions(user);
    return permissions.every((p) => userPerms.includes(p));
  }

  async hasAnyPermission(user, permissions) {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN') return true;
    const userPerms = await this.getUserPermissions(user);
    return permissions.some((p) => userPerms.includes(p));
  }

  async logAccessAttempt(data) {
    if (AccessLog && typeof AccessLog.logAttempt === 'function') {
      AccessLog.logAttempt({
        companyId: data.companyId,
        userId: data.userId,
        permission: data.permission,
        allowed: data.allowed,
        resourceType: data.resourceType || 'other',
        resourceId: data.resourceId || null,
        targetEmployeeId: data.targetEmployeeId || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata || {},
      });
    }
  }

  checkSelfApproval(actorEmployeeId, targetEmployeeId, permission) {
    if (!actorEmployeeId || !targetEmployeeId) {
      return { allowed: true };
    }

    if (actorEmployeeId.toString() === targetEmployeeId.toString()) {
      return {
        allowed: false,
        reason: `Self-approval not allowed for ${permission}`,
      };
    }

    return { allowed: true };
  }

  invalidateCache(companyId, role) {
    const cacheKey = `${companyId}:${role}`;
    this.permissionCache.delete(cacheKey);
  }

  invalidateCompanyCache(companyId) {
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }
}

export const rbacService = new RBACService();