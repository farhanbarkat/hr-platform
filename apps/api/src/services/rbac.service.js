import { RolePermission } from '../models/rolePermission.model.js';
import { AccessLog } from '../models/accessLog.model.js';
import { getDefaultPermissionsForRole } from '../config/permissions.js';

/**
 * RBAC Service
 * 
 * Centralized permission resolution with company-level overrides.
 * Handles caching, logging, and self-approval prevention.
 */
class RBACService {
  constructor() {
    this.permissionCache = new Map(); // companyId:role -> { permissions, expiresAt }
    this.CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get effective permissions for a user in their company
   * Uses cache with 5-min TTL, falls back to DB, then defaults
   */
  async getUserPermissions(user) {
    const cacheKey = `${user.companyId}:${user.role}`;
    const now = Date.now();

    // Check cache
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.permissions;
    }

    // Fetch from DB (checks for company override)
    let permissions;
    try {
      permissions = await RolePermission.getEffectivePermissions(user.companyId, user.role);
    } catch (err) {
      console.error('RBAC: Failed to fetch permissions, using defaults:', err.message);
      permissions = getDefaultPermissionsForRole(user.role);
    }

    // Cache the result
    this.permissionCache.set(cacheKey, {
      permissions,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return permissions;
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(user, permission) {
    const permissions = await this.getUserPermissions(user);
    return permissions.includes(permission);
  }

  /**
   * Check multiple permissions (all must be present)
   */
  async hasAllPermissions(user, permissions) {
    const userPerms = await this.getUserPermissions(user);
    return permissions.every(p => userPerms.includes(p));
  }

  /**
   * Check multiple permissions (any can be present)
   */
  async hasAnyPermission(user, permissions) {
    const userPerms = await this.getUserPermissions(user);
    return permissions.some(p => userPerms.includes(p));
  }

  /**
   * Log an access attempt (allowed or denied)
   * Fire-and-forget - never blocks the request
   */
  async logAccessAttempt(data) {
    // Don't await - fire and forget
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

  /**
   * Check self-approval prevention
   * Returns { allowed: boolean, reason?: string }
   */
  checkSelfApproval(actorEmployeeId, targetEmployeeId, permission) {
    if (!actorEmployeeId || !targetEmployeeId) {
      // If either is missing, can't determine - allow but log
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

  /**
   * Invalidate cache for a company+role (call when override is updated)
   */
  invalidateCache(companyId, role) {
    const cacheKey = `${companyId}:${role}`;
    this.permissionCache.delete(cacheKey);
  }

  /**
   * Invalidate all cache for a company (call when company settings change)
   */
  invalidateCompanyCache(companyId) {
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }
}

export const rbacService = new RBACService();
