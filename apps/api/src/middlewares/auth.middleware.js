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
    const decoded = verifyToken(
      token,
      process.env.JWT_ACCESS_SECRET,
      TOKEN_TYPES.ACCESS
    );
    req.user = decoded;
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