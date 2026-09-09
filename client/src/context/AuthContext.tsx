import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import api, { refreshAuthToken } from '../lib/api';
import { debounce } from '../lib/debounce';
import {
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  setAuthSession,
  type StoredUser,
} from '../lib/authStorage';

export type User = StoredUser;

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<User>;
  register: (data: Record<string, string>) => Promise<{ email: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearAuthSession();
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();

      if (!storedToken) {
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setToken(storedToken);
      if (storedUser) setUser(storedUser);

      try {
        let activeToken = storedToken;
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          activeToken = refreshed;
          if (!cancelled) setToken(refreshed);
        }

        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (cancelled) return;

        if (res.data.user) {
          setUser(res.data.user);
          setAuthSession(activeToken, res.data.user);
        } else {
          logout();
        }
      } catch (err) {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          logout();
        }
        /* Network errors: keep cached session so the portal stays open offline */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrapSession();

    const refreshOnFocus = debounce(() => {
      if (getStoredToken()) void refreshAuthToken();
    }, 5000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshOnFocus();
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      setAuthSession(res.data.token, res.data.user);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) {
        throw new Error('SERVER_OFFLINE');
      }
      throw err;
    }
  };

  const resetPassword = async (token: string, password: string) => {
    const res = await api.post('/auth/reset-password', { token, password });
    if (res.data.token && res.data.user) {
      setAuthSession(res.data.token, res.data.user);
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data.user as User;
    }
    throw new Error('PASSWORD_RESET_LOGIN_UNAVAILABLE');
  };

  const register = async (data: Record<string, string>) => {
    const res = await api.post('/auth/register', data);
    return { email: res.data.email as string };
  };

  const verifyOtp = async (email: string, code: string) => {
    const res = await api.post('/auth/verify-otp', { email, code });
    setAuthSession(res.data.token, res.data.user);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const updateUser = (updated: User) => {
    setUser(updated);
    const currentToken = getStoredToken();
    if (currentToken) setAuthSession(currentToken, updated);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, resetPassword, register, verifyOtp, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
