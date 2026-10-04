// App boot + shell (top bar, tab bar, view transitions).
import { h, animate, clear } from './dom.js';
import { getToken, setToken, flushOutbox, bus, api } from './api.js';
import { store, loadManifest, refresh, on } from './store.js';
import { route, router, go, replace, getCurrent } from './router.js';
import { icon } from './ui/icons.js';
import { countUp } from './ui/fx.js';
import { mountPaliKeyboard, setOsPreference } from './keyboard/pali-input.js';
import { applyTheme, hooks } from './session.js';
import { mountTypingWidget, setWidgetVisible } from './keyboard/widget.js';

const screens = {
  home: () => import('./screens/home.js'),
  learn: () => import('./screens/path.js'),
  lesson: () => import('./screens/lesson-page.js'),
  quiz: () => import('./screens/quiz.js'),
  review: () => import('./screens/review.js'),
  vocab: () => import('./screens/vocab.js'),
  chapter: () => import('./screens/chapter.js'),
  profile: () => import('./screens/profile.js'),
  notifications: () => import('./screens/notifications.js'),
  typing: () => import('./screens/typing.js'),
  onboarding: () => import('./screens/onboarding.js'),
};

const root = document.getElementById('app');
let shell = null;
let leaveFns = [];

// ───────── shell ─────────
function buildShell() {
  const streakN = h('span', {}, '0');
  const xpN = h('span', {}, '0');
  const bell = h('a.chip.chip-bell', { href: '#/notifications', 'aria-label': 'Notifications' }, icon('bell', 20), h('span.dot', { hidden: true }));
  const topbar = h('header.topbar', {},
    h('a.brand', { href: '#/home', 'aria-label': 'Guide to Pāli home' }, icon('lotus', 26), h('span', {}, 'Guide to ', h('em', {}, 'Pāli'))),
    h('div.chips', {},
      h('div.chip.chip-streak', { title: 'Day streak' }, icon('flame', 18), streakN),
      h('div.chip.chip-xp', { title: 'Total XP' }, icon('star', 18), xpN),
      bell,
    ));
  const tabs = [['home', 'Home', 'home'], ['learn', 'Lessons', 'path'], ['vocab', 'Vocabulary', 'book'], ['review', 'Flashcards', 'cards'], ['profile', 'Me', 'user']];
  const tabbar = h('nav.tabbar', { 'aria-label': 'Main' }, tabs.map(([key, label, ic]) =>
    h('a.tab', { href: `#/${key}`, dataset: { tab: key } }, icon(ic, 24), h('span', {}, label))));
  const view = h('main#view.view', { tabindex: '-1' });
  const el = h('div.shell', {}, topbar, view, tabbar);
  return { el, view, streakN, xpN, bell, tabbar, topbar, lastXp: 0 };
}

function syncChrome() {
  if (!shell || !store.state) return;
  const s = store.state;
  shell.streakN.textContent = s.stats.streak;
  shell.el.querySelector('.chip-streak').classList.toggle('lit', s.stats.streak > 0);
  countUp(shell.xpN, shell.lastXp, s.stats.totalXp, 700);
  shell.lastXp = s.stats.totalXp;
  shell.bell.querySelector('.dot').hidden = !s.unread;
}

async function show({ params, immersive, tab, typing, handler, path }) {
  leaveFns.forEach((f) => { try { f(); } catch { /* ignore */ } });
  leaveFns = [];
  shell.el.classList.toggle('immersive', !!immersive);
  setWidgetVisible(!immersive && !!typing);              // only where the learner actually types Pāli
  document.documentElement.classList.toggle('is-immersive', !!immersive);
  shell.tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  const ctx = { onLeave: (fn) => leaveFns.push(fn), path };
  clear(shell.view).append(h('div.loading', {}, h('span.spinner')));
  try {
    const mod = await handler();
    const node = await mod.default(params, ctx);
    clear(shell.view).append(node);
    shell.view.scrollTo?.(0, 0); window.scrollTo(0, 0);
    animate(node, immersive
      ? [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }]
      : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360 });
  } catch (err) {
    console.error(err);
    clear(shell.view).append(h('div.empty', {}, h('h2', {}, 'Something went wrong'), h('p.muted', {}, err.message || 'Please try again.'),
      h('button.btn.btn-primary', { onclick: () => location.reload() }, 'Reload')));
  }
}

function startApp() {
  shell = buildShell();
  clear(root).append(shell.el);
  mountTypingWidget();
  setWidgetVisible(false);
  syncChrome();
  on('state', syncChrome);

  const r = (p, key, opts = {}) => route(p, screens[key], opts);
  r('/home', 'home', { tab: 'home' });
  r('/learn', 'learn', { tab: 'learn' });
  r('/review', 'review', { tab: 'review' });
  r('/vocab', 'vocab', { tab: 'vocab', typing: true });
  r('/vocab/:q', 'vocab', { tab: 'vocab', typing: true });
  r('/profile', 'profile', { tab: 'profile' });
  r('/notifications', 'notifications', { tab: 'home' });
  r('/typing', 'typing', { tab: 'profile', typing: true });
  r('/chapter/:id', 'chapter', { tab: 'learn' });
  r('/chapter/:id/:view', 'chapter', { tab: 'learn' });
  r('/lesson/:id', 'lesson', { tab: 'learn', typing: true });
  r('/review/:lesson', 'review', { tab: 'review' });
  r('/quiz/:id/:level', 'quiz', { immersive: true });
  r('/welcome', 'onboarding', { immersive: true });

  router.onChange = (cur) => show({ ...cur, path: cur.path });
  if (!store.state.profile.onboarded && location.hash !== '#/welcome') location.hash = '/welcome';
  router.start();
}

async function showLogin() {
  const { default: landing } = await import('./screens/landing.js');
  shell = null;
  setWidgetVisible(false);
  document.documentElement.classList.remove('is-immersive');
  clear(root).append(landing(async () => { await boot(); }));
}

hooks.signOut = async function signOut() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already gone */ }
  setToken(null);
  store.state = null;
  location.hash = '';
  await showLogin();
};

async function boot() {
  try {
    await loadManifest();
    if (!getToken()) return showLogin();
    await refresh();
    applyTheme(store.state.profile.theme);
    setOsPreference(store.state.profile.keyboardOs);
    startApp();
    flushOutbox().then(refresh).catch(() => {});
  } catch (err) {
    if (err.status === 401 || !getToken()) return showLogin();
    clear(root).append(h('div.empty.boot-error', {}, h('h2', {}, 'We couldn’t reach the server'),
      h('p.muted', {}, err.message), h('button.btn.btn-primary', { onclick: () => location.reload() }, 'Try again')));
  }
}

bus.addEventListener('auth:lost', () => showLogin());
addEventListener('online', () => store.state && refresh().catch(() => {}));
document.addEventListener('visibilitychange', () => { if (!document.hidden && store.state) refresh().catch(() => {}); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (store.state?.profile.theme === 'auto') applyTheme('auto'); });

applyTheme((() => { try { return localStorage.getItem('pali.theme') || 'light'; } catch { return 'light'; } })());
mountPaliKeyboard();
boot();
