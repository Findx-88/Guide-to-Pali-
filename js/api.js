// API client. Session token lives in localStorage; failed progress writes go to an outbox and are retried —
// the server is idempotent, so replays are safe.
const cfg = () => window.PALI_CONFIG;
const TOKEN_KEY = 'pali.token';
const OUTBOX_KEY = 'pali.outbox';

export const bus = new EventTarget();
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = getToken();
  if (auth && !token) throw new ApiError(401, 'Sign in required');      // guest browsing: nothing to fetch or save
  if (auth && token) headers.authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(cfg().apiBase + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'You appear to be offline.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) { setToken(null); bus.dispatchEvent(new Event('auth:lost')); }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed');
  return data;
}

// ───────── Progress outbox ─────────
const readOutbox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; } };
const writeOutbox = (q) => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q.slice(-200))); } catch { /* ignore */ } };

/** POST learner progress. Returns the server snapshot, or null if queued for later (offline). */
export async function sendProgress(event) {
  if (!getToken()) return null;                                            // guests: reading is free, nothing is saved
  try {
    return await api('/api/progress', { method: 'POST', body: event });
  } catch (e) {
    if (e.status === 0) { writeOutbox([...readOutbox(), event]); return null; }
    throw e;
  }
}

export async function flushOutbox() {
  const q = readOutbox();
  if (!q.length || !getToken()) return;
  const rest = [];
  for (const ev of q) {
    try { await api('/api/progress', { method: 'POST', body: ev }); }
    catch (e) { if (e.status === 0) rest.push(ev); /* 4xx: drop an event the server will never accept */ }
  }
  writeOutbox(rest);
}
addEventListener('online', () => flushOutbox().then(() => bus.dispatchEvent(new Event('outbox:flushed'))));
