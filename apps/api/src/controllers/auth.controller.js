import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { Employee } from '../models/employee.model.js';
import { RoleCapabilityOverride } from '../models/roleCapabilityOverride.model.js';
import { CustomRole } from '../models/customRole.model.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/permissions.js';
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
 * Helper to resolve dynamic effective permissions during login/token generation
 */
const resolveUserPermissionsForToken = async (user) => {
  const baseRole = String(user.role || 'EMPLOYEE').toUpperCase();
  if (baseRole === 'SUPER_ADMIN' || user.isCompanyOwner) {
    return ['*'];
  }

  try {
    const employee = await Employee.findOne({
      $or: [{ userId: user._id }, { email: user.email }],
      companyId: user.companyId,
    }).populate('customRoleId');

    let effectivePermissions = [];

    if (employee?.customRoleId?.permissions && Array.isArray(employee.customRoleId.permissions)) {
      effectivePermissions = [...employee.customRoleId.permissions];
    } else {
      effectivePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    }

    if (employee) {
      const override = await RoleCapabilityOverride.findOne({
        companyId: user.companyId,
        employeeId: employee._id,
      });

      if (override) {
        const granted = override.grantedPermissions || [];
        const removed = new Set(override.removedPermissions || []);

        granted.forEach((p) => {
          if (!effectivePermissions.includes(p)) effectivePermissions.push(p);
        });

        if (removed.size > 0) {
          effectivePermissions = effectivePermissions.filter((perm) => !removed.has(perm));
        }
      }
    }

    return effectivePermissions;
  } catch (err) {
    console.error('Error resolving token permissions:', err);
    return DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  }
};

/**
 * @desc    Login Step 1 (Password verification & 2FA evaluation)
 * @route   POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +twoFactorSecret +twoFactorRecoveryCodes'
  );

  const GENERIC_ERROR = 'Email or password is incorrect.';

  if (!user) {
    throw new ApiError(401, GENERIC_ERROR);
  }

  if (user.isLocked && typeof user.isLocked === 'function' && user.isLocked()) {
    throw new ApiError(423, 'Account is temporarily locked due to repeated failed attempts. Please try again later.');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await user.save();
    throw new ApiError(401, GENERIC_ERROR);
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  const hasEnrolledSecret = Boolean(user.twoFactorSecret);
  const requires2FA = (user.isTwoFactorEnabled || MANDATORY_2FA_ROLES.includes(user.role)) && hasEnrolledSecret;

  if (requires2FA) {
    const challengeToken = generate2FAChallengeToken(user);
    return res.status(200).json(
      new ApiResponse(
        200,
        { requires2FA: true, isEnrolled: true, challengeToken },
        '2FA verification required.'
      )
    );
  }

  // ✅ Attach resolved dynamic permissions to user object before generating tokens
  const permissions = await resolveUserPermissionsForToken(user);
  user.permissions = permissions;

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ tokenHash: hashToken(refreshToken) });
  await user.save();

  const userResponse = user.toObject();
  userResponse.permissions = permissions;
  delete userResponse.password;
  delete userResponse.twoFactorSecret;
  delete userResponse.twoFactorRecoveryCodes;
  delete userResponse.refreshTokens;

  return res
    .status(200)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: userResponse, accessToken },
        'User logged in successfully.'
      )
    );
});

/**
 * @desc    Setup 2FA - Generates Secret & QR Code
 * @route   POST /api/v1/auth/2fa/setup
 */
export const setup2FA = asyncHandler(async (req, res) => {
  const userId = getChallengeUserId(req) || req.user?._id;
  const user = await User.findById(userId);

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
  const userId = getChallengeUserId(req) || req.user?._id;
  const user = await User.findById(userId).select('+twoFactorSecret');

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
    throw new ApiError(400, 'Verification code or recovery code is required.');
  }

  const userId = getChallengeUserId(req);
  if (!userId) {
    throw new ApiError(401, 'Invalid or expired 2FA challenge session. Please log in again.');
  }

  const user = await User.findById(userId).select(
    '+twoFactorSecret +twoFactorRecoveryCodes'
  );

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  let isValid = false;

  if (code && user.twoFactorSecret) {
    isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: String(code).trim(),
      window: 1,
    });
  }

  if (!isValid && recoveryCode) {
    const hashedCode = crypto
      .createHash('sha256')
      .update(String(recoveryCode).trim())
      .digest('hex');

    const matchedIndex = (user.twoFactorRecoveryCodes || []).findIndex(
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

  const permissions = await resolveUserPermissionsForToken(user);
  user.permissions = permissions;

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ tokenHash: hashToken(refreshToken) });
  await user.save();

  const userResponse = user.toObject();
  userResponse.permissions = permissions;
  delete userResponse.password;
  delete userResponse.twoFactorSecret;
  delete userResponse.twoFactorRecoveryCodes;
  delete userResponse.refreshTokens;

  return res
    .status(200)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: userResponse, accessToken },
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
  const tokenIndex = (user.refreshTokens || []).findIndex((t) => t.tokenHash === incomingHash);

  if (tokenIndex === -1) {
    user.refreshTokens = [];
    await user.save();
    throw new ApiError(403, 'Invalid refresh token detected.');
  }

  user.refreshTokens.splice(tokenIndex, 1);

  const permissions = await resolveUserPermissionsForToken(user);
  user.permissions = permissions;

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

  if (incomingRefreshToken && req.user?._id) {
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

/**
 * @desc    Register Device Push Token
 * @route   POST /api/v1/auth/device-token
 */
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform, deviceId } = req.body;
  const userId = req.user._id;

  if (!token || !platform) {
    throw new ApiError(400, 'Push token and platform are required.');
  }

  await User.findByIdAndUpdate(userId, {
    $pull: { pushTokens: { deviceId } },
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

/**
 * @desc    Get current authenticated session user & permissions
 * @route   GET /api/v1/auth/me
 * @access  Private (verifyJWT)
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  let user = await User.findById(req.user?._id)
    .populate('companyId', 'name slug country currency')
    .lean();

  if (!user) {
    throw new ApiError(404, 'Active user session not found.');
  }

  const permissions = await resolveUserPermissionsForToken(user);
  user.permissions = permissions;

  delete user.password;
  delete user.twoFactorSecret;
  delete user.twoFactorRecoveryCodes;
  delete user.refreshTokens;

  return res.status(200).json(
    new ApiResponse(
      200,
      user,
      'Current authenticated user profile retrieved successfully.'
    )
  );
});