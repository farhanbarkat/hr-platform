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

  clearTokens: () => {
    inMemoryAccessToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
  },
};