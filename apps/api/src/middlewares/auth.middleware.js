import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TOKEN_TYPES, verifyToken } from '../utils/token.util.js';

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