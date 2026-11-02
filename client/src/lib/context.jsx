import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from './api.js';

const GUEST_KEY = 'kaskita_guest';
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(GUEST_KEY);
    setUser(null);
    setGuest(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) { setReady(true); return; }
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const d = await api.post('/auth/login', { username, password }, { auth: false });
    tokenStore.set(d.token);
    localStorage.removeItem(GUEST_KEY);
    setGuest(false);
    setUser(d.user);
    return d.user;
  }, []);

  const enterGuest = useCallback(() => {
    localStorage.setItem(GUEST_KEY, '1');
    setGuest(true);
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    guest: !user && guest,
    isSuper: user?.role === 'superadmin',
    ready,
    login,
    logout,
    enterGuest,
  }), [user, guest, ready, login, logout, enterGuest]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

/* ---------- Theme ---------- */
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('kaskita_theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0a14' : '#f6f4ff');
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'error' ? '😵' : '🎉'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Data hook ---------- */
export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get(path));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
