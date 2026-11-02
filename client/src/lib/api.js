const TOKEN_KEY = 'kaskita_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const API_BASE = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '') : '';

export async function api(path, { method = 'GET', body, auth = true } = {}, retryCount = 0) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (netErr) {
    if (method === 'GET' && retryCount < 1) {
      await new Promise((r) => setTimeout(r, 600));
      return api(path, { method, body, auth }, retryCount + 1);
    }
    const err = new Error('Koneksi internet atau server terganggu');
    err.status = 0;
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    // Auto-retry once on 5xx serverless cold start / DB reconnect
    if (method === 'GET' && [500, 502, 503, 504].includes(res.status) && retryCount < 1) {
      await new Promise((r) => setTimeout(r, 600));
      return api(path, { method, body, auth }, retryCount + 1);
    }

    if (res.status === 401 && auth && token) {
      onUnauthorized();
    }

    const errMsg = data?.message || (res.status === 500 ? 'Koneksi database/server sedang sibuk, silakan klik lagi 🙏' : `Request gagal (${res.status})`);
    const err = new Error(errMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

api.get = (p, o) => api(p, { ...o, method: 'GET' });
api.post = (p, body, o) => api(p, { ...o, method: 'POST', body });
api.put = (p, body, o) => api(p, { ...o, method: 'PUT', body });
api.del = (p, o) => api(p, { ...o, method: 'DELETE' });

