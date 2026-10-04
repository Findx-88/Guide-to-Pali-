import { h } from '../dom.js';
import { api, setToken } from '../api.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/fx.js';

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };

function loadGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.append(s);
  });
}

export function signInCard(onSignedIn) {
  const cfg = window.PALI_CONFIG;
  const gbtn = h('div.google-slot');
  const msg = h('p.login-msg.muted', { 'aria-live': 'polite' });

  async function exchange(path, body) {
    try {
      const { token } = await api(path, { method: 'POST', auth: false, body: { ...body, timezone: tz() } });
      setToken(token);
      await onSignedIn();
    } catch (e) { msg.textContent = e.message; toast(e.message, { tone: 'bad' }); }
  }

  const configured = cfg.googleClientId && !cfg.googleClientId.startsWith('REPLACE_');
  if (configured) {
    loadGoogle().then(() => {
      google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: (r) => exchange('/api/auth/google', { credential: r.credential }), ux_mode: 'popup' });
      google.accounts.id.renderButton(gbtn, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(320, innerWidth - 64) });
    }).catch((e) => { msg.textContent = e.message; });
  } else {
    gbtn.append(h('p.muted.small', {}, 'Google sign-in is not configured yet. Add your Google client ID in config.js.'));
  }

  const dev = cfg.devLogin ? h('form.dev-login', { onsubmit: (e) => { e.preventDefault(); exchange('/api/auth/dev', { email: e.target.email.value, name: e.target.name.value }); } },
    h('p.eyebrow', {}, 'Local development'),
    h('input', { name: 'email', type: 'email', value: 'dev@example.com', 'aria-label': 'Email' }),
    h('input', { name: 'name', value: 'Dev Learner', 'aria-label': 'Name' }),
    h('button.btn.btn-ghost.btn-block', { type: 'submit' }, 'Continue as test learner')) : null;

  return h('div.login-card.card', { id: 'signin' }, h('h2', {}, 'Sign in to begin'),
    h('p.muted', {}, 'Sign in with Google so your progress is saved and you can continue anywhere.'), gbtn, msg, dev,
    h('p.fine', {}, 'We only use your name, email and picture to set up your learning profile.'));
}

export default function login(onSignedIn) {
  return h('div.login', {}, h('div.login-hero', {}, h('div.login-lotus', {}, icon('lotus', 96)), h('p.eyebrow', {}, 'A step-by-step primer'),
    h('h1', {}, 'Learn to read ', h('em', {}, 'Pāli'))), signInCard(onSignedIn));
}
