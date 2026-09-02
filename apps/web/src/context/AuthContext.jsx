import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient.js';
import { tokenStorage } from '../lib/tokenStorage.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStorage.getUser());
  const [token, setToken] = useState(() => tokenStorage.getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = () => {
      const storedToken = tokenStorage.getAccessToken();
      const storedUser = tokenStorage.getUser();

      if (storedToken && storedUser) {
        setUser(storedUser);
        setToken(storedToken);
      } else {
        tokenStorage.clearAll();
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    };

    initAuth();

    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { data } = response.data;

      // Agar role/user ke liye 2FA required hai
      if (data.requires2FA) {
        let setupData = null;

        // Agar user pehle se enrolled nahi hai (first time setup)
        if (!data.isEnrolled) {
          try {
            const setupRes = await apiClient.post(
              '/auth/2fa/setup',
              {},
              { headers: { Authorization: `Bearer ${data.challengeToken}` } }
            );
            setupData = setupRes.data?.data;
          } catch (e) {
            console.error('2FA setup init error:', e);
          }
        }

        return {
          requires2FA: true,
          challengeToken: data.challengeToken,
          isEnrolled: data.isEnrolled,
          qrCodeUrl: setupData?.qrCodeUrl || null,
          secret: setupData?.secret || null,
        };
      }

      // Normal direct login
      tokenStorage.setAccessToken(data.accessToken);
      tokenStorage.setRefreshToken(data.refreshToken);
      tokenStorage.setUser(data.user);

      setUser(data.user);
      setToken(data.accessToken);

      return { requires2FA: false, user: data.user };
    } catch {
      throw new Error('Email or password is incorrect.');
    }
  };

 const verify2FA = async (challengeToken, code, isEnrolled = true) => {
    try {
      // Backend routes: /auth/2fa/confirm (first time) ya /auth/2fa/verify-login (already enrolled)
      const endpoint = !isEnrolled ? '/auth/2fa/confirm' : '/auth/2fa/verify-login';
      
      const response = await apiClient.post(
        endpoint,
        { code },
        { headers: { Authorization: `Bearer ${challengeToken}` } }
      );

      const { data } = response.data;

      if (data?.accessToken) {
        tokenStorage.setAccessToken(data.accessToken);
        tokenStorage.setRefreshToken(data.refreshToken);
        tokenStorage.setUser(data.user);

        setUser(data.user);
        setToken(data.accessToken);
      }

      return data?.user;
    } catch {
      throw new Error('Invalid or expired verification code. Please try again.');
    }
  };

  const logout = () => {
    tokenStorage.clearAll();
    setUser(null);
    setToken(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (!Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions = []) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (!Array.isArray(user.permissions)) return false;
    return permissions.some((p) => user.permissions.includes(p));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        verify2FA,
        logout,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}