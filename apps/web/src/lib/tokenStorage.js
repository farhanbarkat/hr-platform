let inMemoryAccessToken = null;

export const tokenStorage = {
  getAccessToken: () => inMemoryAccessToken || localStorage.getItem('access_token'),
  
  setAccessToken: (token) => {
    inMemoryAccessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  },

  getRefreshToken: () => localStorage.getItem('refresh_token'),

  setRefreshToken: (token) => {
    if (token) {
      localStorage.setItem('refresh_token', token);
    } else {
      localStorage.removeItem('refresh_token');
    }
  },

  getUser: () => {
    try {
      const user = localStorage.getItem('auth_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  },

  clearAll: () => {
    inMemoryAccessToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
  },
};