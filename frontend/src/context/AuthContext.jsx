import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/**
 * Decode a JWT payload without verifying the signature.
 * Returns the parsed payload object, or null if the token is malformed.
 */
function decodeJwtPayload(token) {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;
    // atob requires standard base64; JWT uses base64url — replace URL-safe chars
    const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Returns true if the JWT stored in localStorage is expired or invalid.
 */
function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  // exp is in seconds; Date.now() is in milliseconds
  return payload.exp < Date.now() / 1000;
}

export function AuthProvider({ children }) {
  // 3.1.1 — reads localStorage on mount
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));

  // On mount, validate the stored JWT. If it is expired or missing, clear the
  // session and redirect to /login so the user is not stuck in a broken state.
  // AuthProvider sits outside BrowserRouter, so useNavigate is unavailable here;
  // window.location.href is used for the redirect instead.
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        const hadSession = token !== null || localStorage.getItem('user') !== null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        if (hadSession && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (data && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    };
    init();
  }, []);

  // Fix #18: wrap functions in useCallback so useMemo dependency array is correct
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    }
    return null;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, refreshUser, logout }), [user, login, register, refreshUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
