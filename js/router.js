// Hash router (works on any static host with no rewrite rules). Routes: '/lesson/:id' → params.id
const routes = [];
let current = null;

export function route(pattern, handler, { immersive = false, tab = null, typing = false } = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, handler, immersive, tab, typing });
}

export const go = (path) => { if (location.hash === '#' + path) resolve(); else location.hash = path; };
export const replace = (path) => location.replace('#' + path);
export const currentPath = () => location.hash.replace(/^#/, '') || '/home';

export function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    current = { path, params, ...r };
    router.onChange?.(current);
    return;
  }
  replace('/home');
}

export const router = { onChange: null, start() { addEventListener('hashchange', resolve); resolve(); } };
export const getCurrent = () => current;
