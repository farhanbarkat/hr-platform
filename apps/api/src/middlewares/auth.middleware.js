import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TOKEN_TYPES, verifyToken } from '../utils/token.util.js';
import { rbacService } from '../services/rbac.service.js';

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
    const decoded = verifyToken(
      token,
      process.env.JWT_ACCESS_SECRET,
      TOKEN_TYPES.ACCESS
    );

    // Attach decoded info to req
    req.user = decoded;

    // Set companyId context (if impersonating, use target company ID)
    req.companyId = decoded.impersonatedCompanyId || decoded.companyId;
    req.user = {
      ...decoded,
      companyId: req.companyId,
      permissions: await rbacService.getEffectivePermissions(decoded, req.companyId),
    };

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
  return rbacService.getEffectivePermissions({
    _id: userId,
    email: userEmail,
    role: userRole,
    companyId,
  }, companyId);
};
/**
 * Checks if a specific permission has been revoked/subtracted for this employee
 */
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

      const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
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

      const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];

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