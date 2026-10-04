// Small shared hooks so screens never need to import main.js (which would re-run boot).
export const hooks = { signOut: async () => {} };

export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('pali.theme', theme); } catch { /* storage blocked */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12100E' : '#F5EDD8');
}
export const signOut = () => hooks.signOut();
