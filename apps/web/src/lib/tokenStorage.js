// apps/web/src/lib/tokenStorage.js

const ACCESS_KEYS = ['accessToken', 'token', 'apex_access_token'];
const REFRESH_KEYS = ['refreshToken', 'apex_refresh_token'];
const USER_KEYS = ['user', 'apex_user_session'];

export const tokenStorage = {
  // 1. Get Access Token (checks canonical and legacy fallback keys)
  getAccessToken: () => {
    try {
      for (const key of ACCESS_KEYS) {
        const value = localStorage.getItem(key);
        if (value && value !== 'undefined' && value !== 'null') {
          return value;
        }
      }
      return null;
    } catch (e) {
      console.error('[tokenStorage] Error retrieving access token:', e);
      return null;
    }
  },

  // 2. Set Access Token (persists to primary and backward-compatible keys)
  setAccessToken: (token) => {
    try {
      if (token) {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('token', token); // compatibility key
      } else {
        tokenStorage.removeAccessToken();
      }
    } catch (e) {
      console.error('[tokenStorage] Error saving access token:', e);
    }
  },

  removeAccessToken: () => {
    try {
      ACCESS_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error('[tokenStorage] Error removing access token:', e);
    }
  },

  // 3. Get Refresh Token
  getRefreshToken: () => {
    try {
      for (const key of REFRESH_KEYS) {
        const value = localStorage.getItem(key);
        if (value && value !== 'undefined' && value !== 'null') {
          return value;
        }
      }
      return null;
    } catch (e) {
      console.error('[tokenStorage] Error retrieving refresh token:', e);
      return null;
    }
  },

  // 4. Set Refresh Token
  setRefreshToken: (token) => {
    try {
      if (token) {
        localStorage.setItem('refreshToken', token);
      } else {
        REFRESH_KEYS.forEach((key) => localStorage.removeItem(key));
      }
    } catch (e) {
      console.error('[tokenStorage] Error saving refresh token:', e);
    }
  },

  // 5. Get User Object (with robust parsing & validation)
  getUser: () => {
    try {
      let rawUser = null;
      for (const key of USER_KEYS) {
        const val = localStorage.getItem(key);
        if (val && val !== 'undefined' && val !== 'null') {
          rawUser = val;
          break;
        }
      }

      if (!rawUser) return null;

      const parsed = JSON.parse(rawUser);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch (e) {
      console.error('[tokenStorage] Error parsing user profile from storage:', e);
      return null;
    }
  },

  // 6. Set User Object
  setUser: (user) => {
    try {
      if (user && typeof user === 'object') {
        const serialized = JSON.stringify(user);
        localStorage.setItem('user', serialized);
        localStorage.setItem('apex_user_session', serialized);
      } else {
        USER_KEYS.forEach((key) => localStorage.removeItem(key));
      }
    } catch (e) {
      console.error('[tokenStorage] Error saving user profile:', e);
    }
  },

  // 7. Boolean Utility Helpers
  hasValidToken: () => {
    return Boolean(tokenStorage.getAccessToken());
  },

  hasUser: () => {
    return Boolean(tokenStorage.getUser());
  },

  // 8. Purge All Session Tokens & Profiles
  clearTokens: () => {
    try {
      [...ACCESS_KEYS, ...REFRESH_KEYS, ...USER_KEYS].forEach((k) =>
        localStorage.removeItem(k)
      );
    } catch (e) {
      console.error('[tokenStorage] Error purging storage keys:', e);
    }
  },

  clearAll: () => {
    tokenStorage.clearTokens();
  },
};

export default tokenStorage;