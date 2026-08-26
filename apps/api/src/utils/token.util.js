import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  CHALLENGE_2FA: '2fa_challenge',
};

const signToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

export const generateAccessToken = (user) => {
  return signToken(
    {
      _id: user._id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      tokenType: TOKEN_TYPES.ACCESS,
    },
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRY || '15m'
  );
};

export const generateRefreshToken = (user) => {
  return signToken(
    {
      _id: user._id,
      companyId: user.companyId,
      tokenType: TOKEN_TYPES.REFRESH,
    },
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRY || '7d'
  );
};

export const generate2FAChallengeToken = (user) => {
  return signToken(
    {
      _id: user._id,
      role: user.role,
      tokenType: TOKEN_TYPES.CHALLENGE_2FA,
    },
    process.env.JWT_ACCESS_SECRET,
    '30m'
  );
};

export const verifyToken = (token, secret, expectedTokenType) => {
  const decoded = jwt.verify(token, secret);

  if (expectedTokenType && decoded?.tokenType !== expectedTokenType) {
    throw new Error(`Invalid token type: expected ${expectedTokenType}.`);
  }

  return decoded;
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};