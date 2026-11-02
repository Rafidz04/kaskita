const TOKEN_KEY = 'kaskita_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const API_BASE = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '') : '';

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && auth && token) onUnauthorized();
    throw new Error(data?.message || `Request gagal (${res.status})`);
  }
  return data;
}

api.get = (p, o) => api(p, { ...o, method: 'GET' });
api.post = (p, body, o) => api(p, { ...o, method: 'POST', body });
api.put = (p, body, o) => api(p, { ...o, method: 'PUT', body });
api.del = (p, o) => api(p, { ...o, method: 'DELETE' });
