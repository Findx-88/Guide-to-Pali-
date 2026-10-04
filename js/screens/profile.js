import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { store, refresh, allLessons, isDone } from '../store.js';
import { icon, hasIcon } from '../ui/icons.js';
import { toast } from '../ui/fx.js';
import { ring } from '../ui/widgets.js';
import { setOsPreference } from '../keyboard/pali-input.js';
import { applyTheme, signOut } from '../session.js';

export const GOALS = [
  { xp: 20, name: 'Casual', min: '≈ 5 min' }, { xp: 30, name: 'Regular', min: '≈ 10 min' },
  { xp: 50, name: 'Serious', min: '≈ 15 min' }, { xp: 80, name: 'Intense', min: '≈ 25 min' },
];

export const switchRow = (label, hint, checked, onChange) => {
  const input = h('input', { type: 'checkbox', checked: checked || null, role: 'switch', onchange: (e) => onChange(e.target.checked) });
  return h('label.switch-row', {}, h('span', {}, h('strong', {}, label), hint ? h('small.muted', {}, hint) : null), input, h('span.switch'));
};

async function save(path, body) {
  try { await api(path, { method: 'PATCH', body }); await refresh(); } catch (e) { toast(e.message, { tone: 'bad' }); }
}

export default async function profile() {
  const s = store.state;
  const need = s.stats.levelProgress.to - s.stats.levelProgress.from;
  const into = s.stats.totalXp - s.stats.levelProgress.from;
  const doneCount = allLessons().filter((l) => isDone(l.id)).length;

  const achievements = store.manifest.achievements.map((a) => {
    const got = s.achievements[a.id];
    return h('div.ach' + (got ? '.got' : ''), { title: `${a.name}: ${a.description}` }, h('span.ach-ic', {}, icon(hasIcon(a.icon) ? a.icon : 'star', 26)), h('strong', {}, a.name), h('small', {}, a.description));
  });

  const theme = h('div.seg-tabs', {}, [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['auto', 'Auto', 'sparkle']].map(([v, label, ic]) =>
    h('button.seg-tab' + (s.profile.theme === v ? '.active' : ''), { type: 'button', onclick: async (e) => {
      applyTheme(v); theme.querySelectorAll('.seg-tab').forEach((b) => b.classList.remove('active')); e.currentTarget.classList.add('active'); save('/api/profile', { theme: v });
    } }, icon(ic, 16), label)));

  const goals = h('div.goal-opts', {}, GOALS.map((g) => h('button.goal-opt' + (s.profile.dailyGoal === g.xp ? '.on' : ''), { type: 'button', onclick: (e) => {
    goals.querySelectorAll('.goal-opt').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); save('/api/profile', { dailyGoal: g.xp }); },
  }, h('strong', {}, g.name), h('small', {}, `${g.xp} XP · ${g.min}`))));

  const p = s.prefs;
  const hourSel = h('select.sel', { 'aria-label': 'Reminder time', onchange: (e) => save('/api/prefs', { hour: Number(e.target.value) }) },
    Array.from({ length: 24 }, (_, hr) => h('option', { value: hr, selected: hr === p.hour || null }, `${String(hr).padStart(2, '0')}:00`)));

  const osSel = h('select.sel', { 'aria-label': 'Keyboard shortcut style', onchange: (e) => { setOsPreference(e.target.value); save('/api/profile', { keyboardOs: e.target.value }); } },
    [['auto', 'Detect automatically'], ['mac', 'Mac (Option ⌥)'], ['win', 'Windows / Linux (Alt)']].map(([v, t]) => h('option', { value: v, selected: v === s.profile.keyboardOs || null }, t)));

  const avatar = s.user.avatar ? h('img.avatar', { src: s.user.avatar, alt: '', referrerpolicy: 'no-referrer' }) : h('div.avatar.letter', {}, (s.profile.name || '?')[0]);

  return h('div.page.profile', {},
    h('section.card.me', {}, avatar, h('div', {}, h('h2', {}, s.profile.name || s.user.name), h('p.muted.small', {}, s.user.email)),
      ring({ value: need ? into / need : 1, size: 76, stroke: 8, center: h('div.goal-c', {}, h('small', {}, 'Level'), h('strong', {}, s.stats.level)) })),
    h('section.stats', {}, [[s.stats.streak, 'Day streak', 'flame'], [s.stats.bestStreak, 'Best streak', 'target'], [s.stats.totalXp, 'Total XP', 'star'], [doneCount, 'Lessons done', 'check']].map(([n, l, ic]) =>
      h('div.stat-tile.card', {}, icon(ic, 20), h('strong', {}, n), h('small', {}, l)))),
    h('h3.sec-title', {}, 'Achievements'), h('section.ach-grid', {}, achievements),
    h('h3.sec-title', {}, 'Settings'),
    h('section.card.settings', {},
      h('div.set-block', {}, h('h4', {}, 'Appearance'), theme),
      h('div.set-block', {}, h('h4', {}, 'Daily goal'), goals),
      h('div.set-block', {}, h('h4', {}, 'Reminders'),
        switchRow('In-app notifications', 'Gentle nudges and achievements', p.inApp, (v) => save('/api/prefs', { inApp: v })),
        switchRow('Daily reminder', 'One a day, at your chosen time', p.daily, (v) => save('/api/prefs', { daily: v })),
        switchRow('Streak reminder', 'Only when your streak is at risk', p.streak, (v) => save('/api/prefs', { streak: v })),
        switchRow('Continue reminder', 'When a lesson is waiting', p.resume, (v) => save('/api/prefs', { resume: v })),
        switchRow('Achievements', 'Celebrate milestones', p.achievements, (v) => save('/api/prefs', { achievements: v })),
        h('div.field-row', {}, h('span', {}, 'Remind me around'), hourSel)),
      h('div.set-block', {}, h('h4', {}, 'Typing'), h('div.field-row', {}, h('span', {}, 'Shortcut style'), osSel), h('a.btn.btn-ghost.btn-sm', { href: '#/typing' }, icon('keyboard', 16), 'Typing guide')),
      h('div.set-block', {}, h('button.btn.btn-ghost.btn-block', { type: 'button', onclick: signOut }, icon('logout', 18), 'Sign out'))));
}
