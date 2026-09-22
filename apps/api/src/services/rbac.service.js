import { RolePermission } from '../models/rolePermission.model.js';
import { RoleCapabilityOverride } from '../models/roleCapabilityOverride.model.js';
import { Employee } from '../models/employee.model.js';
import { AccessLog } from '../models/accessLog.model.js';
import { getDefaultPermissionsForRole } from '../config/permissions.js';
import { CustomRole } from '../models/customRole.model.js';

class RBACService {
  constructor() {
    this.rolePermissionCache = new Map();
    this.userOverrideCache = new Map();
    this.CACHE_TTL_MS = 5 * 60 * 1000;
  }

  // 1. Fetch Base Role Permissions (with caching)
  async getBaseRolePermissions(companyId, role) {
    const cacheKey = `${companyId}:${role}`;
    const now = Date.now();

    const cached = this.rolePermissionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.permissions;
    }

    let permissions;
    try {
      if (RolePermission && typeof RolePermission.getEffectivePermissions === 'function') {
        permissions = await RolePermission.getEffectivePermissions(companyId, role);
      }
      if (!permissions || permissions.length === 0) {
        permissions = getDefaultPermissionsForRole(role);
      }
    } catch (err) {
      console.error('RBAC: Failed to fetch base role permissions, using defaults:', err.message);
      permissions = getDefaultPermissionsForRole(role);
    }

    this.rolePermissionCache.set(cacheKey, {
      permissions,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return permissions;
  }

  // 2. Fetch Effective Permissions (Base Role + Custom Role + Individual Overrides)
  async getUserPermissions(user) {
    if (!user) return [];

    // Super Admin aur Company Admin direct bypass
    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') {
      return getDefaultPermissionsForRole(user.role);
    }

    const companyId = user.companyId;
    const userId = user._id || user.id;

    // Check user-level cached permissions
    const userCacheKey = `${companyId}:${userId}`;
    const now = Date.now();
    const userCached = this.userOverrideCache.get(userCacheKey);
    if (userCached && userCached.expiresAt > now) {
      return userCached.permissions;
    }

    // Step A: Base Role Permissions
    const basePermissions = await this.getBaseRolePermissions(companyId, user.role);
    let effectivePermissions = new Set(basePermissions);

    try {
      // Step B: Resolve Employee Record
      let employee = null;
      if (user.employeeId) {
        employee = await Employee.findById(user.employeeId).select('_id customRoleId');
      } else {
        employee = await Employee.findOne({
          $or: [{ userId }, { email: user.email }],
          companyId,
        }).select('_id customRoleId');
      }

      // Step C: Agar user ke paas Custom Role (e.g. HOD, Supervisor) hai toh uske permissions add karein
      const customRoleId = user.customRoleId || employee?.customRoleId;
      if (customRoleId) {
        const customRoleDoc = await CustomRole.findOne({
          _id: customRoleId,
          companyId,
          isActive: true,
        }).lean();

        if (customRoleDoc && Array.isArray(customRoleDoc.permissions)) {
          customRoleDoc.permissions.forEach((perm) => effectivePermissions.add(perm));
        }
      }

      // Step D: Individual Capability Overrides (Granted (+) aur Removed (-))
      if (employee?._id) {
        const override = await RoleCapabilityOverride.findOne({
          companyId,
          employeeId: employee._id,
        }).lean();

        if (override) {
          if (Array.isArray(override.grantedPermissions)) {
            override.grantedPermissions.forEach((perm) => effectivePermissions.add(perm));
          }
          if (Array.isArray(override.removedPermissions)) {
            override.removedPermissions.forEach((perm) => effectivePermissions.delete(perm));
          }
        }
      }
    } catch (err) {
      console.error('RBAC: Error resolving custom role & overrides:', err.message);
    }

    const finalPermissions = Array.from(effectivePermissions);

    // User cache update
    this.userOverrideCache.set(userCacheKey, {
      permissions: finalPermissions,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return finalPermissions;
  }

  async hasPermission(user, permission) {
    if (!user) return false;

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

  // Cache Invalidation Functions
  invalidateRoleCache(companyId, role) {
    const cacheKey = `${companyId}:${role}`;
    this.rolePermissionCache.delete(cacheKey);
  }

  invalidateUserCache(companyId, userId) {
    const userCacheKey = `${companyId}:${userId}`;
    this.userOverrideCache.delete(userCacheKey);
  }

  invalidateCompanyCache(companyId) {
    for (const key of this.rolePermissionCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        this.rolePermissionCache.delete(key);
      }
    }
    for (const key of this.userOverrideCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        this.userOverrideCache.delete(key);
      }
    }
  }
}

export const rbacService = new RBACService();