import { h, animate } from '../dom.js';
import { icon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

/** Animated progress ring. `center` is a node or string shown inside. */
export function ring({ value = 0, size = 96, stroke = 9, center = null, tone = 'saffron' }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const track = svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, class: 'ring-track' });
  const bar = svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round', class: `ring-bar ${tone}`,
    'stroke-dasharray': c, 'stroke-dashoffset': c, transform: `rotate(-90 ${size / 2} ${size / 2})` });
  const s = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' });
  s.append(track, bar);
  const el = h('div.ring', { style: { width: `${size}px`, height: `${size}px` } }, s, h('div.ring-center', {}, center));
  const v = Math.max(0, Math.min(1, value));
  requestAnimationFrame(() => animate(bar, [{ strokeDashoffset: c }, { strokeDashoffset: c * (1 - v) }], { duration: 900, easing: 'cubic-bezier(.22,1,.36,1)', delay: 120 }));
  el.update = (nv) => { bar.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, nv))); };
  return el;
}

/** Last 7 local days as dots. `activity` = [{day, xp, goal_met}] */
export function weekStrip(activity, todayStr) {
  const byDay = Object.fromEntries((activity || []).map((a) => [a.day, a]));
  const days = [];
  const base = new Date(`${todayStr}T12:00:00`);
  for (let i = 6; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); days.push(d); }
  return h('div.week', {}, days.map((d, i) => {
    const key = d.toLocaleDateString('en-CA');
    const a = byDay[key];
    const cls = a?.goal_met ? 'is-goal' : a?.xp > 0 ? 'is-some' : '';
    return h('div.wd' + (i === 6 ? '.today' : '') + (cls ? '.' + cls : ''), { style: { '--i': i }, title: a ? `${a.xp} XP` : 'No practice' },
      h('span.wd-dot', {}, a?.xp > 0 ? icon('check', 14) : null), h('span.wd-l', {}, d.toLocaleDateString(undefined, { weekday: 'narrow' })));
  }));
}

export const sheetHost = () => document.body;

/** Bottom sheet (mobile) / centered dialog (desktop). Returns {close, el}. */
export function openSheet({ title, content, actions = [] }) {
  const back = h('div.sheet-back');
  const sheet = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Details' },
    h('div.sheet-grab'), title ? h('h3', {}, title) : null, h('div.sheet-body', {}, content), actions.length ? h('div.sheet-actions', {}, actions) : null);
  const close = () => { back.classList.remove('in'); sheet.classList.remove('in'); setTimeout(() => { back.remove(); sheet.remove(); }, 260); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', close);
  document.addEventListener('keydown', esc);
  document.body.append(back, sheet);
  requestAnimationFrame(() => { back.classList.add('in'); sheet.classList.add('in'); });
  return { close, el: sheet };
}

export const greeting = () => { const hr = new Date().getHours(); return hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; };
