import api from './api';

const decodeToken = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
};

/**
 * dose-2.96: client-side profile bars matching server updateProfile.
 * Require non-empty trimmed displayName when provided; avatarUrl must be
 * empty (clear) or a valid http(s) URL. Reject early so Settings never
 * posts junk the controller would 400.
 */
function normalizeUpdateProfile(data) {
  if (data == null || typeof data !== 'object') return null;
  const out = {};
  if (Object.prototype.hasOwnProperty.call(data, 'displayName')) {
    if (data.displayName == null || typeof data.displayName !== 'string') return null;
    const trimmed = data.displayName.trim();
    if (!trimmed || trimmed.length > 100) return null;
    out.displayName = trimmed;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'avatarUrl')) {
    if (data.avatarUrl === null || data.avatarUrl === '') {
      out.avatarUrl = '';
    } else if (typeof data.avatarUrl !== 'string') {
      return null;
    } else {
      const raw = data.avatarUrl.trim();
      if (!raw) {
        out.avatarUrl = '';
      } else {
        try {
          const u = new URL(raw);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
          out.avatarUrl = raw;
        } catch {
          return null;
        }
      }
    }
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}

export const authService = {
  register: async (username, email, password, displayName) => {
    const response = await api.post('/auth/register', { username, email, password, displayName });
    if (response.data.token) localStorage.setItem('token', response.data.token);
    return response.data;
  },
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    if (response.data.token) localStorage.setItem('token', response.data.token);
    return response.data;
  },
  /**
   * Soft logout: clear token and notify AuthContext/Player via auth:logout.
   * Do not hard-reload; SPA routes to /login after user state clears.
   */
  logout: () => {
    localStorage.removeItem('token');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'user_logout' } }));
    }
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
  updateProfile: async (data) => {
    const normalized = normalizeUpdateProfile(data);
    if (normalized === null) {
      return Promise.reject(new Error('Invalid profile payload'));
    }
    const response = await api.put('/auth/profile', normalized);
    return response.data;
  },
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/auth/stats');
    return response.data;
  },
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const payload = decodeToken(token);
    if (!payload?.exp) return false;
    return (payload.exp * 1000) > (Date.now() - 60000);
  },
};
