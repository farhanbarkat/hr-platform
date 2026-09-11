import { apiClient } from '../lib/apiClient.js';
import { tokenStorage } from '../lib/tokenStorage.js';
import { getDefaultPermissionsForRole } from '../config/permissions.js';
import { getRedirectPathByRole } from '../lib/roleRedirect.js';

export const authService = {
  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    const payload = response.data?.data || response.data || {};

    // 2FA Challenge
    if (payload.requires2FA || payload.challengeToken) {
      return {
        requires2FA: true,
        challengeToken: payload.challengeToken || payload.accessToken,
        isEnrolled: payload.isEnrolled ?? true,
      };
    }

    const accessToken = payload.accessToken || payload.token;
    let user = payload.user || payload.employee;

    // Attach base permissions matrix if missing from database
    if (user && (!Array.isArray(user.permissions) || user.permissions.length === 0)) {
      user.permissions = getDefaultPermissionsForRole(user.role);
    }

    if (accessToken) tokenStorage.setAccessToken(accessToken);
    if (payload.refreshToken) tokenStorage.setRefreshToken(payload.refreshToken);
    if (user) tokenStorage.setUser(user);

    return {
      requires2FA: false,
      user,
      homeRoute: getRedirectPathByRole(user),
    };
  },

  verify2FA: async (challengeToken, totpToken) => {
    const cleanCode = String(totpToken).trim();
    const response = await apiClient.post(
      '/auth/2fa/verify-login',
      { totpToken: cleanCode, code: cleanCode },
      {
        headers: {
          Authorization: `Bearer ${challengeToken}`,
        },
      }
    );

    const payload = response.data?.data || response.data || {};
    const accessToken = payload.accessToken || payload.token;
    let user = payload.user;

    if (user && (!Array.isArray(user.permissions) || user.permissions.length === 0)) {
      user.permissions = getDefaultPermissionsForRole(user.role);
    }

    if (accessToken) tokenStorage.setAccessToken(accessToken);
    if (payload.refreshToken) tokenStorage.setRefreshToken(payload.refreshToken);
    if (user) tokenStorage.setUser(user);

    return {
      user,
      homeRoute: getRedirectPathByRole(user),
    };
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    const payload = response.data?.data || response.data;
    let user = payload.user || payload;

    if (user && (!Array.isArray(user.permissions) || user.permissions.length === 0)) {
      user.permissions = getDefaultPermissionsForRole(user.role);
    }

    if (user) tokenStorage.setUser(user);
    return user;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Graceful offline logout
    } finally {
      tokenStorage.clearTokens();
    }
  },
};

export default authService;