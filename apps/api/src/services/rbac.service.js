import { Employee } from '../models/employee.model.js';
import { AccessLog } from '../models/accessLog.model.js';
import { getDefaultPermissionsForRole } from '../config/permissions.js';
import mongoose from 'mongoose';

class RBACService {
  constructor() {
    this.rolePermissionCache = new Map();
    this.userOverrideCache = new Map();
    this.CACHE_TTL_MS = 5 * 60 * 1000;
  }

  /**
   * Resolve one user's permissions for the current request context.
   * Employee, custom role, and capability override data are loaded through
   * one aggregation; route middleware only reads the resulting array.
   */
  async getEffectivePermissions(user, companyId = user?.companyId) {
    if (!user) return [];

    const role = String(user.role || 'EMPLOYEE').toUpperCase();
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN' || user.isCompanyOwner) {
      return ['*'];
    }

    const effectiveBase = getDefaultPermissionsForRole(role);
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return effectiveBase;
    }

    const userObjectId = user._id || user.id;
    const employeeMatch = [];
    if (user.email) employeeMatch.push({ email: String(user.email).toLowerCase() });
    if (mongoose.Types.ObjectId.isValid(userObjectId)) {
      const objectId = new mongoose.Types.ObjectId(userObjectId);
      employeeMatch.push({ userId: objectId }, { _id: objectId });
    }

    if (employeeMatch.length === 0) return effectiveBase;

    try {
      const [resolved] = await Employee.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), $or: employeeMatch } },
        { $project: { customRoleId: 1, _id: 1, companyId: 1 } },
        {
          $lookup: {
            from: 'customroles',
            let: { roleId: '$customRoleId', tenantId: '$companyId' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$_id', '$$roleId'] },
                { $eq: ['$companyId', '$$tenantId'] },
                { $eq: ['$isActive', true] },
              ] } } },
              { $project: { permissions: 1 } },
            ],
            as: 'customRole',
          },
        },
        {
          $lookup: {
            from: 'rolecapabilityoverrides',
            let: { employeeId: '$_id', tenantId: '$companyId' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$employeeId', '$$employeeId'] },
                { $eq: ['$companyId', '$$tenantId'] },
              ] } } },
              { $project: { grantedPermissions: 1, removedPermissions: 1 } },
              { $limit: 1 },
            ],
            as: 'override',
          },
        },
        { $limit: 1 },
      ]);

      const customPermissions = resolved?.customRole?.[0]?.permissions;
      const permissions = new Set(
        Array.isArray(customPermissions) ? customPermissions : effectiveBase
      );
      const override = resolved?.override?.[0];
      for (const permission of override?.grantedPermissions || []) permissions.add(permission);
      for (const permission of override?.removedPermissions || []) permissions.delete(permission);
      return [...permissions];
    } catch (error) {
      console.error('RBAC: Failed to resolve effective permissions:', error.message);
      return effectiveBase;
    }
  }

  async getUserPermissions(user) {
    return this.getEffectivePermissions(user);
  }

  async hasPermission(user, permission) {
    if (!user) return false;
    const permissions = Array.isArray(user.permissions)
      ? user.permissions
      : await this.getEffectivePermissions(user);
    return permissions.includes('*') || permissions.includes(permission);
  }

  async hasAllPermissions(user, permissions) {
    const userPerms = Array.isArray(user?.permissions)
      ? user.permissions
      : await this.getEffectivePermissions(user);
    return userPerms.includes('*') || permissions.every((p) => userPerms.includes(p));
  }

  async hasAnyPermission(user, permissions) {
    const userPerms = Array.isArray(user?.permissions)
      ? user.permissions
      : await this.getEffectivePermissions(user);
    return userPerms.includes('*') || permissions.some((p) => userPerms.includes(p));
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