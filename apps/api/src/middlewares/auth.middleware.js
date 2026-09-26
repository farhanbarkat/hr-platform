import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TOKEN_TYPES, verifyToken } from '../utils/token.util.js';
import { RoleCapabilityOverride } from '../models/roleCapabilityOverride.model.js';
import { Employee } from '../models/employee.model.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/permissions.js';

const getBearerToken = (req) => {
  const authorizationHeader = req.header('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorizationHeader.slice(7).trim();
};

const getChallengeTokenFromRequest = (req) => {
  return (
    req.body?.challengeToken ||
    req.query?.challengeToken ||
    getBearerToken(req)
  );
};

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken || getBearerToken(req);

  if (!token) {
    throw new ApiError(401, 'Unauthorized: access token missing.');
  }

  try {
    let decoded;

    // First try decoding standard access token
    try {
      decoded = verifyToken(
        token,
        process.env.JWT_ACCESS_SECRET,
        TOKEN_TYPES.ACCESS
      );
    } catch (tokenUtilErr) {
      // Fallback: If it's an impersonation token created via jwt.sign directly
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Ensure it's a valid impersonation token before letting it pass
      if (!decoded.isImpersonating) {
        throw tokenUtilErr;
      }
    }

    // Attach decoded info to req
    req.user = decoded;

    // Set companyId context (if impersonating, use target company ID)
    req.companyId = decoded.impersonatedCompanyId || decoded.companyId;

    next();
  } catch (error) {
    throw new ApiError(401, 'Unauthorized: Token expired or invalid.');
  }
});

export const verify2FAChallenge = asyncHandler(async (req, res, next) => {
  const challengeToken = getChallengeTokenFromRequest(req);

  if (!challengeToken) {
    throw new ApiError(400, 'Challenge token is required.');
  }

  try {
    const decoded = verifyToken(
      challengeToken,
      process.env.JWT_ACCESS_SECRET,
      TOKEN_TYPES.CHALLENGE_2FA
    );

    req.challengeUser = decoded;
    next();
  } catch (error) {
    throw new ApiError(401, '2FA challenge session expired. Please log in again.');
  }
});

/**
 * Resolves user's effective permissions:
 * 1. If CustomRole is assigned (TICKET-005F) -> uses CustomRole.permissions array
 * 2. If no CustomRole -> falls back to base system role default permissions (TICKET-004)
 * 3. If subtractive RoleCapabilityOverride exists (TICKET-005E) -> removes those permissions
 */
export const getUserEffectivePermissions = async (companyId, userId, userEmail, userRole) => {
  try {
    // 1. Flexible Employee lookup (companyId optional ya loose rakhein taake query fail na ho)
    const query = {
      $or: [
        ...(userId ? [{ userId }, { _id: userId }] : []),
        ...(userEmail ? [{ email: userEmail }] : [])
      ]
    };

    if (companyId) {
      query.companyId = companyId;
    }

    let employee = await Employee.findOne(query).populate('customRoleId');

    // Fallback: Agar companyId ke sath nahi mila toh bina companyId ke dhoond lein
    if (!employee && companyId) {
      delete query.companyId;
      employee = await Employee.findOne(query).populate('customRoleId');
    }

    let effectivePermissions = [];

    // 2. Custom Role Priority
    if (employee?.customRoleId?.permissions && Array.isArray(employee.customRoleId.permissions)) {
      effectivePermissions = [...employee.customRoleId.permissions];
    } else {
      // 3. Base System Role Fallback from config
      effectivePermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
    }

    // 4. Check RoleCapabilityOverride collection directly using employee._id or userId
    if (employee) {
      const override = await RoleCapabilityOverride.findOne({
        $or: [
          { employeeId: employee._id },
          ...(userId ? [{ employeeId: userId }] : [])
        ]
      }).select('grantedPermissions removedPermissions');

      if (override) {
        const granted = override.grantedPermissions || [];
        const removed = new Set(override.removedPermissions || []);

        // Add extra granted powers
        granted.forEach(p => {
          if (!effectivePermissions.includes(p)) effectivePermissions.push(p);
        });

        // Remove revoked powers
        if (removed.size > 0) {
          effectivePermissions = effectivePermissions.filter(
            (perm) => !removed.has(perm)
          );
        }
      }
    }

    return effectivePermissions;
  } catch (err) {
    console.error('Error resolving effective permissions:', err);
    return DEFAULT_ROLE_PERMISSIONS[userRole] || [];
  }
};
/**
 * Checks if a specific permission has been revoked/subtracted for this employee
 */
export const isPermissionOverridden = async (companyId, userId, userEmail, permissionKey) => {
  if (!companyId || !permissionKey) return false;

  const employee = await Employee.findOne({
    $or: [{ userId }, { email: userEmail }],
    companyId,
  }).select('_id');

  if (!employee) return false;

  const override = await RoleCapabilityOverride.findOne({
    companyId,
    employeeId: employee._id,
  }).select('removedPermissions');

  if (override && override.removedPermissions && override.removedPermissions.includes(permissionKey)) {
    return true;
  }

  return false;
};

/**
 * Dynamic Permission Authorization Guard (Works for Base Roles AND Custom Roles)
 * Usage: router.get('/path', authorizePermission('attendance.view_team'), handler)
 */
export const authorizePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Unauthorized request.');
      }

      // Super Admin bypass
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const companyId = req.companyId || req.user.companyId;
      const userPermissions = await getUserEffectivePermissions(
        companyId,
        req.user._id,
        req.user.email,
        req.user.role
      );

      if (!userPermissions.includes('*') && !userPermissions.includes(requiredPermission)) {
        throw new ApiError(
          403,
          `Access denied: Missing required permission '${requiredPermission}'.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Role & Capability Authorization Middleware
 * Supports:
 *   - authorizeRoles('HR', 'ADMIN', 'MANAGER')
 *   - authorizeRoles(['HR', 'MANAGER'], 'payroll.approve')
 */
/**
 * Fully Flexible Role & Capability Authorization Middleware
 * Yeh static roles ke sath-sath user ki dynamic effective permissions ko bhi check karta hai.
 */
export const authorizeRoles = (...args) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Unauthorized request.');
      }

      let allowedRoles = [];
      let requiredPermission = null;

      if (args.length === 2 && Array.isArray(args[0]) && typeof args[1] === 'string') {
        allowedRoles = args[0];
        requiredPermission = args[1];
      } else {
        allowedRoles = args.flat();
      }

      const companyId = req.companyId || req.user.companyId;

      // 1. Fetch live effective permissions (Custom Roles + Overrides)
      const userPermissions = await getUserEffectivePermissions(
        companyId,
        req.user._id,
        req.user.email,
        req.user.role
      );

      // 2. Super Admin or Wildcard permission bypass
      if (req.user.role === 'SUPER_ADMIN' || userPermissions.includes('*')) {
        return next();
      }

      // 3. Check if user's base role is in allowed roles list
      const hasAllowedRole = allowedRoles.length === 0 || allowedRoles.includes(req.user.role);

      // 4. Flexible Check: Agar user ka role allowed hai OR uske paas required permission hai OR koi bhi management capability active hai
      if (hasAllowedRole) {
        return next();
      }

      if (requiredPermission && userPermissions.includes(requiredPermission)) {
        return next();
      }

      // 5. Automatic Route-Based Fallback Permission Check (Agar route path se match karni ho)
      const path = req.baseUrl || req.path || '';
      let inferredPermission = null;
      if (path.includes('employee')) inferredPermission = 'employee.read';
      else if (path.includes('attendance')) inferredPermission = 'attendance.read';
      else if (path.includes('leave')) inferredPermission = 'leave.read';
      else if (path.includes('task')) inferredPermission = 'tasks.read';

      if (inferredPermission && userPermissions.includes(inferredPermission)) {
        return next();
      }

      throw new ApiError(
        403,
        `Access denied: Insufficient permissions or role (${req.user?.role}) for this operation.`
      );
    } catch (error) {
      next(error);
    }
  };
};