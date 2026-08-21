import { rbacService } from '../services/rbac.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Middleware factory: requirePermission(permission, options)
 * 
 * @param {string} permission - Permission string from config/permissions.js
 * @param {Object} options
 *   @param {string} options.resourceType - For logging: 'leave' | 'loan' | 'shift_swap' | 'payroll' | 'expense' | 'advance' | 'other'
 *   @param {Function} options.getTargetEmployeeId - Function(req) => employeeId to check self-approval
 *   @param {boolean} options.skipSelfApprovalCheck - Default false
 * 
 * Usage:
 * router.post('/leave/:id/approve', verifyJWT, requirePermission('leave.approve_manager', {
 *   resourceType: 'leave',
 *   getTargetEmployeeId: (req) => req.params.employeeId || req.body.employeeId
 * }), leaveController.approve);
 */
export const requirePermission = (permission, options = {}) => {
  const {
    resourceType = 'other',
    getTargetEmployeeId = null,
    skipSelfApprovalCheck = false,
  } = options;

  return asyncHandler(async (req, res, next) => {
    const user = req.user;
    // 💡 Fallback check: req.companyId ya user.companyId
    const companyId = req.companyId || user?.companyId;
    const userId = user?._id || user?.id;

    if (!user || !userId) {
      throw new ApiError(401, 'Authentication required: User not found.');
    }

    if (!companyId && user.role !== 'SUPER_ADMIN') {
      throw new ApiError(401, 'Authentication required: Company context missing.');
    }

    // Check permission
    const hasPerm = await rbacService.hasPermission(user, permission);

    // Prepare log data
    const logData = {
      companyId: companyId || null,
      userId,
      permission,
      allowed: hasPerm,
      resourceType,
      // resourceId: req.params.id || req.body?._id || null,
      targetEmployeeId: getTargetEmployeeId ? getTargetEmployeeId(req) : null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { role: user.role },
    };

    // Log the attempt (fire and forget)
    rbacService.logAccessAttempt(logData);

    if (!hasPerm) {
      throw new ApiError(403, `Access denied: requires permission '${permission}'`);
    }

    // Self-approval check
    if (!skipSelfApprovalCheck && getTargetEmployeeId && user.employeeId) {
      const targetEmployeeId = getTargetEmployeeId(req);
      if (targetEmployeeId) {
        const selfCheck = rbacService.checkSelfApproval(
          user.employeeId,
          targetEmployeeId,
          permission
        );

        if (!selfCheck.allowed) {
          rbacService.logAccessAttempt({
            ...logData,
            allowed: false,
            metadata: { ...logData.metadata, reason: selfCheck.reason },
          });

          throw new ApiError(403, selfCheck.reason);
        }
      }
    }

    next();
  });
};

/**
 * Middleware: requireAnyPermission(permissions, options)
 * Allows if user has ANY of the given permissions
 */
export const requireAnyPermission = (permissions, options = {}) => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;
    const companyId = req.companyId;

    if (!user || !companyId) {
      throw new ApiError(401, 'Authentication required.');
    }

    const hasPerm = await rbacService.hasAnyPermission(user, permissions);

    const logData = {
      companyId,
      userId: user._id,
      permission: permissions.join('|'),
      allowed: hasPerm,
      resourceType: options.resourceType || 'other',
      resourceId: req.params.id || req.body._id || null,
      targetEmployeeId: options.getTargetEmployeeId ? options.getTargetEmployeeId(req) : null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { role: user.role, checkedPermissions: permissions },
    };

    rbacService.logAccessAttempt(logData);

    if (!hasPerm) {
      throw new ApiError(403, `Access denied: requires one of [${permissions.join(', ')}]`);
    }

    next();
  });
};

/**
 * Middleware: requireAllPermissions(permissions, options)
 * Allows only if user has ALL of the given permissions
 */
export const requireAllPermissions = (permissions, options = {}) => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;
    const companyId = req.companyId;

    if (!user || !companyId) {
      throw new ApiError(401, 'Authentication required.');
    }

    const hasPerm = await rbacService.hasAllPermissions(user, permissions);

    const logData = {
      companyId,
      userId: user._id,
      permission: permissions.join('&'),
      allowed: hasPerm,
      resourceType: options.resourceType || 'other',
      resourceId: req.params.id || req.body._id || null,
      targetEmployeeId: options.getTargetEmployeeId ? options.getTargetEmployeeId(req) : null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { role: user.role, checkedPermissions: permissions },
    };

    rbacService.logAccessAttempt(logData);

    if (!hasPerm) {
      throw new ApiError(403, `Access denied: requires all of [${permissions.join(', ')}]`);
    }

    next();
  });
};

/**
 * Middleware: requireRole(roles, options)
 * Convenience middleware for role-based checks (uses default role permissions)
 * @param {string|string[]} roles - Single role or array of allowed roles
 */
export const requireRole = (roles, options = {}) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return asyncHandler(async (req, res, next) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Authentication required.');
    }

    const hasRole = allowedRoles.includes(user.role);

    if (!hasRole) {
      rbacService.logAccessAttempt({
        companyId: req.companyId,
        userId: user._id,
        permission: `role:${allowedRoles.join('|')}`, 
        allowed: false,
        resourceType: options.resourceType || 'other',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { role: user.role, requiredRoles: allowedRoles },
      });

      throw new ApiError(403, `Access denied: requires one of roles [${allowedRoles.join(', ')}]`);
    }

    next();
  });
};
