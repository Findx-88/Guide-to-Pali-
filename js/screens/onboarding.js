// First-run: name → daily goal → reminders. Three quick cards, then straight into Lesson 1.
import { h, animate, clear } from '../dom.js';
import { api } from '../api.js';
import { store, refresh } from '../store.js';
import { go } from '../router.js';
import { icon } from '../ui/icons.js';
import { GOALS, switchRow } from './profile.js';

export default function onboarding() {
  const s = store.state;
  const choice = { name: s.profile.name || '', goal: 30, inApp: true, hour: 18 };
  let step = 0;
  const stage = h('div.onb-stage');
  const dots = h('div.onb-dots', {}, [0, 1, 2].map(() => h('i')));
  const root = h('div.onboarding', {}, dots, stage);

  const cards = [
    () => h('div.onb-card', {}, h('div.login-lotus', {}, icon('lotus', 72)), h('h1', {}, 'Welcome, ', h('em', {}, choice.name || 'friend')),
      h('p.muted', {}, 'Let’s set up your practice. It takes ten seconds.'),
      h('label.field', {}, h('span', {}, 'What should we call you?'), h('input.ex-input', { value: choice.name, maxlength: 40, autocomplete: 'given-name', oninput: (e) => { choice.name = e.target.value; } }))),
    () => h('div.onb-card', {}, h('h2', {}, 'How much time feels ', h('em', {}, 'right?')), h('p.muted', {}, 'A small daily habit beats a long occasional session. You can change this any time.'),
      h('div.goal-opts.col', {}, GOALS.map((g) => h('button.goal-opt' + (choice.goal === g.xp ? '.on' : ''), { type: 'button', onclick: (e) => { stage.querySelectorAll('.goal-opt').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); choice.goal = g.xp; } },
        h('strong', {}, g.name), h('small', {}, g.min))))),
    () => h('div.onb-card', {}, h('h2', {}, 'A ', h('em', {}, 'gentle'), ' nudge'), h('p.muted', {}, 'One calm reminder a day, only if you haven’t practised yet. Never more.'),
      switchRow('Daily reminder', 'In-app notification', choice.inApp, (v) => { choice.inApp = v; }),
      h('label.field', {}, h('span', {}, 'Remind me around'), h('select.sel', { onchange: (e) => { choice.hour = Number(e.target.value); } },
        [8, 12, 18, 20, 21].map((hr) => h('option', { value: hr, selected: hr === choice.hour || null }, `${String(hr).padStart(2, '0')}:00`))))),
  ];

  async function show() {
    [...dots.children].forEach((d, k) => { d.className = k <= step ? 'on' : ''; });
    clear(stage).append(cards[step](), h('div.onb-foot', {},
      step > 0 ? h('button.btn.btn-ghost', { type: 'button', onclick: () => { step--; show(); } }, 'Back') : null,
      h('button.btn.btn-primary.grow', { type: 'button', onclick: next }, step === cards.length - 1 ? 'Begin lesson 1' : 'Continue', icon('arrow', 18))));
    animate(stage, [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
  }
  async function next() {
    if (step < cards.length - 1) { step++; return show(); }
    try {
      await api('/api/profile', { method: 'PATCH', body: { name: choice.name.trim() || s.profile.name, dailyGoal: choice.goal, onboarded: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      await api('/api/prefs', { method: 'PATCH', body: { inApp: choice.inApp, daily: choice.inApp, hour: choice.hour } });
      await refresh();
    } catch { /* non-fatal: defaults apply */ }
    go(s.resume.lessonId ? `/lesson/${s.resume.lessonId}` : '/home');
  }
  show();
  return root;
}
