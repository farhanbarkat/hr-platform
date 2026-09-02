import axios from 'axios';
import { tokenStorage } from './tokenStorage.js';

// Base Axios instance pointing to backend v1 API routes
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Refresh state & pending request queue
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Request Interceptor: Automatically attaches Bearer Access Token
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: Catches 401, silently refreshes token, and retries once
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Reject immediately if not 401 or if this request was already retried
    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Do not attempt token refresh on login or direct refresh calls
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue concurrent requests while token refresh is executing
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const storedRefreshToken = tokenStorage.getRefreshToken();

      if (!storedRefreshToken) {
        throw new Error('No refresh token available');
      }

      // Call backend refresh endpoint
      const response = await axios.post('/api/v1/auth/refresh-token', {
        refreshToken: storedRefreshToken,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data?.data || {};

      if (!accessToken) {
        throw new Error('Refresh response missing access token');
      }

      // Store rotated tokens
      tokenStorage.setAccessToken(accessToken);
      if (newRefreshToken) {
        tokenStorage.setRefreshToken(newRefreshToken);
      }

      processQueue(null, accessToken);

      // Retry original failed request
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clearTokens();

      // Clean redirect notification with session expired message
      window.dispatchEvent(
        new CustomEvent('auth:session-expired', {
          detail: { message: 'Your session has expired. Please log in again.' },
        })
      );

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);