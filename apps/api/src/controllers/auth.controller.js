import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../utils/token.util.js';





/**
 * @desc    Login User (Generates Access + Refresh Tokens, handles account lockout)
 * @route   POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Generic Error Message to avoid user enumeration
  const GENERIC_ERROR = 'Email or password is incorrect.';

  if (!user) {
    throw new ApiError(401, GENERIC_ERROR);
  }

  // Check Account Lockout
  if (user.isLocked()) {
    throw new ApiError(
      423,
      'Account is temporarily locked due to 5 consecutive failed login attempts. Try again after 15 minutes.'
    );
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    user.failedLoginAttempts += 1;

    // Lock account for 15 minutes on 5th failed attempt
    if (user.failedLoginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await user.save();
    throw new ApiError(401, GENERIC_ERROR);
  }

  // Reset Lockout Counters on successful login
  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  // Token Generation
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Hash & Store Refresh Token for Revocation capability
  const tokenHash = hashToken(refreshToken);
  user.refreshTokens.push({ tokenHash });
  await user.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        accessToken,
        refreshToken,
      },
      'User logged in successfully.'
    )
  );
});

/**
 * @desc    Exchange Refresh Token for new Access Token (Token Rotation)
 * @route   POST /api/v1/auth/refresh
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: incomingRefreshToken } = req.body;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Refresh token required.');
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
    // Refresh Token reuse / theft detected -> invalidate ALL tokens for safety
    user.refreshTokens = [];
    await user.save();
    throw new ApiError(403, 'Invalid refresh token detected. Security alert triggered.');
  }

  // Token Rotation: Remove old token hash and replace with new
  user.refreshTokens.splice(tokenIndex, 1);

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  const newHash = hashToken(newRefreshToken);

  user.refreshTokens.push({ tokenHash: newHash });
  await user.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      'Tokens refreshed successfully.'
    )
  );
});

/**
 * @desc    Logout User (Invalidate Refresh Token)
 * @route   POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken: incomingRefreshToken } = req.body;

  if (incomingRefreshToken) {
    const incomingHash = hashToken(incomingRefreshToken);
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: { tokenHash: incomingHash } },
    });
  }

  return res.status(200).json(new ApiResponse(200, {}, 'Logged out successfully.'));
});