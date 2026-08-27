import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TOKEN_TYPES, verifyToken } from '../utils/token.util.js';
import { RoleCapabilityOverride } from '../models/roleCapabilityOverride.model.js';
import { Employee } from '../models/employee.model.js';

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
    return true; // Yes, permission is explicitly revoked/removed
  }

  return false;
};

/**
 * Role & Capability Authorization Middleware
 * Supports:
 *   - authorizeRoles('HR', 'ADMIN', 'MANAGER')
 *   - authorizeRoles(['HR', 'MANAGER'], 'PAYROLL_APPROVE')
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

      // 1. Role Check
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        throw new ApiError(
          403,
          `Role (${req.user?.role || 'UNKNOWN'}) is not allowed to access this resource.`
        );
      }

      // 2. Subtractive Role Capability Override Check (TICKET-005E)
      const permissionToCheck = requiredPermission || req.requiredPermission;
      if (permissionToCheck) {
        const companyId = req.companyId || req.user.companyId;
        const isRestricted = await isPermissionOverridden(
          companyId,
          req.user._id,
          req.user.email,
          permissionToCheck
        );

        if (isRestricted) {
          throw new ApiError(
            403,
            `Access denied: Permission '${permissionToCheck}' has been restricted for your account.`
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};