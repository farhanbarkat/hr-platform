import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generate2FAChallengeToken,
  hashToken,
} from '../utils/token.util.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const MANDATORY_2FA_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR'];

const getChallengeUserId = (req) => req.challengeUser?._id;

/**
 * @desc    Login Step 1 (Password verification)
 * @route   POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password +twoFactorSecret'
  );
  const GENERIC_ERROR = 'Email or password is incorrect.';

  if (!user) {
    throw new ApiError(401, GENERIC_ERROR);
  }

  if (user.isLocked()) {
    throw new ApiError(423, 'Account is temporarily locked.');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await user.save();
    throw new ApiError(401, GENERIC_ERROR);
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  const isMandatory = MANDATORY_2FA_ROLES.includes(user.role);
  const requires2FA = isMandatory || user.isTwoFactorEnabled;

  if (requires2FA) {
    const challengeToken = generate2FAChallengeToken(user);
    return res.status(200).json(
      new ApiResponse(
        200,
        { requires2FA: true, isEnrolled: user.isTwoFactorEnabled, challengeToken },
        '2FA verification required.'
      )
    );
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshTokens.push({ tokenHash: hashToken(refreshToken) });
  await user.save();

  return res
    .status(200)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user, accessToken }, 'User logged in successfully.'));
});

/**
 * @desc    Setup 2FA - Generates Secret & QR Code
 * @route   POST /api/v1/auth/2fa/setup
 */
/**
 * @desc    Setup 2FA - Generates Secret & QR Code via Challenge Token
 * @route   POST /api/v1/auth/2fa/setup
 */
/**
 * @desc    Setup 2FA - Generates Secret & QR Code
 * @route   POST /api/v1/auth/2fa/setup
 */
export const setup2FA = asyncHandler(async (req, res) => {
  const user = await User.findById(getChallengeUserId(req));
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const secret = speakeasy.generateSecret({
    length: 20,
    name: `HR Platform (${user.email})`,
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  const plainRecoveryCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex')
  );

  const hashedRecoveryCodes = plainRecoveryCodes.map((code) => ({
    codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    used: false,
  }));

  user.twoFactorSecret = secret.base32;
  user.twoFactorRecoveryCodes = hashedRecoveryCodes;
  await user.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { qrCodeUrl, secret: secret.base32, recoveryCodes: plainRecoveryCodes },
      '2FA setup initialized.'
    )
  );
});

/**
 * @desc    Confirm 2FA Setup
 * @route   POST /api/v1/auth/2fa/confirm
 */
export const confirm2FASetup = asyncHandler(async (req, res) => {
  const { code } = req.body || {};
  const user = await User.findById(getChallengeUserId(req)).select('+twoFactorSecret');

  if (!code) {
    throw new ApiError(400, 'Verification code is required.');
  }

  if (!user || !user.twoFactorSecret) {
    throw new ApiError(400, 'Please initialize 2FA setup first.');
  }

  const isValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: code,
    window: 1,
  });

  if (!isValid) {
    throw new ApiError(400, 'Invalid TOTP code provided.');
  }

  user.isTwoFactorEnabled = true;
  await user.save();

  return res.status(200).json(new ApiResponse(200, {}, '2FA successfully enabled.'));
});

/**
 * @desc    Verify TOTP or Recovery Code during Login Step 2
 * @route   POST /api/v1/auth/2fa/verify-login
 */



export const verify2FALogin = asyncHandler(async (req, res) => {
  const { code, recoveryCode } = req.body;

  if (!code && !recoveryCode) {
    throw new ApiError(
      400,
      'Verification code or recovery code is required.'
    );
  }

  // Strictly select twoFactorSecret & twoFactorRecoveryCodes
  const user = await User.findById(getChallengeUserId(req)).select(
    '+twoFactorSecret +twoFactorRecoveryCodes'
  );

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  let isValid = false;

  // 1. Verify Active TOTP Code
  if (code && user.twoFactorSecret) {
    isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1, // Time drift allowance
    });
  }

  // 2. Fallback: Verify Backup Recovery Code
  if (!isValid && recoveryCode) {
    const hashedCode = crypto
      .createHash('sha256')
      .update(recoveryCode)
      .digest('hex');

    const matchedIndex = user.twoFactorRecoveryCodes.findIndex(
      (rc) => rc.codeHash === hashedCode && !rc.used
    );

    if (matchedIndex !== -1) {
      isValid = true;
      user.twoFactorRecoveryCodes[matchedIndex].used = true;
      await user.save();
    }
  }

  if (!isValid) {
    throw new ApiError(401, 'Invalid 2FA code or recovery code.');
  }

  // Issue final Access & Refresh Tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshTokens.push({ tokenHash: hashToken(refreshToken) });
  await user.save();

  return res
    .status(200)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user, accessToken },
        '2FA verified and login complete.'
      )
    );
});

/**
 * @desc    Refresh Token Handler
 * @route   POST /api/v1/auth/refresh
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Refresh token missing.');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const incomingHash = hashToken(incomingRefreshToken);
  const tokenIndex = user.refreshTokens.findIndex((t) => t.tokenHash === incomingHash);

  if (tokenIndex === -1) {
    user.refreshTokens = [];
    await user.save();
    throw new ApiError(403, 'Invalid refresh token detected.');
  }

  user.refreshTokens.splice(tokenIndex, 1);

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshTokens.push({ tokenHash: hashToken(newRefreshToken) });
  await user.save();

  return res
    .status(200)
    .cookie('refreshToken', newRefreshToken, cookieOptions)
    .json(new ApiResponse(200, { accessToken: newAccessToken }, 'Tokens refreshed.'));
});

/**
 * @desc    Logout Handler
 * @route   POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (incomingRefreshToken) {
    const incomingHash = hashToken(incomingRefreshToken);
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: { tokenHash: incomingHash } },
    });
  }

  return res
    .status(200)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, {}, 'Logged out successfully.'));
});
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform, deviceId } = req.body;
  const userId = req.user._id;

  if (!token || !platform) {
    throw new ApiError(400, 'Push token and platform are required.');
  }

  await User.findByIdAndUpdate(userId, {
    $pull: { pushTokens: { deviceId } }, // Remove old token for this device if exists
  });

  await User.findByIdAndUpdate(userId, {
    $push: {
      pushTokens: {
        token,
        platform: platform.toLowerCase(),
        deviceId: deviceId || null,
        updatedAt: new Date(),
      },
    },
  });

  return res.status(200).json(
    new ApiResponse(200, { registered: true }, 'Device token registered successfully.')
  );
});