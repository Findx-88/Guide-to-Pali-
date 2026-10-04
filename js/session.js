// Small shared hooks so screens never need to import main.js (which would re-run boot).
export const hooks = { signOut: async () => {} };

export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('pali.theme', theme); } catch { /* storage blocked */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12100E' : '#F5EDD8');
}
export const signOut = () => hooks.signOut();

/**
 * Call before anything that saves progress (checking answers, practice levels, flashcards).
 * Signed in → true. Guest → shows the sign-in popup and returns false. After signing in the page reloads
 * on the same screen, so the learner continues exactly where they were.
 */
export function requireAccount(message = 'Sign in to check your answers and save your progress.') {
  if (localStorageToken()) return true;
  Promise.all([import('./ui/widgets.js'), import('./screens/login.js'), import('./dom.js')]).then(([{ openSheet }, { signInCard }, { h }]) => {
    openSheet({ title: 'Sign in to continue', content: h('div.signin-sheet', {}, h('p.muted', {}, message), signInCard(async () => location.reload())) });
  });
  return false;
}
function localStorageToken() { try { return localStorage.getItem('pali.token'); } catch { return null; } }
