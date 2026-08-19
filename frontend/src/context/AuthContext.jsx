import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchMe, login as loginRequest, register as registerRequest, logout as logoutRequest } from '../api/auth';

const AuthContext = createContext(null);

/**
 * Gestiona la sesión del usuario:
 * - Al montar, intenta restaurar la sesión con GET /api/auth/me
 *   (las cookies httpOnly hacen que el navegador la envíe sola).
 * - status: 'loading' (aún no sabemos si hay sesión) | 'authenticated' | 'unauthenticated'
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(({ user: me }) => {
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: logged } = await loginRequest(email, password);
    setUser(logged);
    setStatus('authenticated');
    return logged;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { user: created } = await registerRequest(name, email, password);
    setUser(created);
    setStatus('authenticated');
    return created;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Aunque falle la petición, la sesión local se limpia igual
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
