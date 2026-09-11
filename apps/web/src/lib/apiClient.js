import axios from 'axios';
import { tokenStorage } from './tokenStorage.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

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
 * Request Interceptor: Injects Bearer Token & Active Tenant ID
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach active company ID header if user belongs to tenant
    const user = tokenStorage.getUser();
    const companyId = user?.companyId || user?.company?._id;
    if (companyId && !config.headers['x-tenant-id']) {
      config.headers['x-tenant-id'] = companyId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: 401 Silent Token Rotation
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    if (!originalRequest || !error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh-token') ||
      originalRequest.url?.includes('/auth/2fa')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
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
        throw new Error('No refresh token present in secure storage');
      }

      const response = await axios.post(
        `${BASE_URL}/auth/refresh-token`,
        { refreshToken: storedRefreshToken },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
      );

      const payload = response.data?.data || response.data || {};
      const newAccessToken = payload.accessToken || payload.token;
      const newRefreshToken = payload.refreshToken;

      if (!newAccessToken) {
        throw new Error('Access token missing from rotation response');
      }

      tokenStorage.setAccessToken(newAccessToken);
      if (newRefreshToken) {
        tokenStorage.setRefreshToken(newRefreshToken);
      }

      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clearTokens();

      window.dispatchEvent(
        new CustomEvent('auth:session-expired', {
          detail: { message: 'Your security session has expired. Please authenticate again.' },
        })
      );

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;