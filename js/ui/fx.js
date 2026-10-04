// Delight layer: XP count-ups, confetti, toasts, level-up bursts. Everything honours prefers-reduced-motion.
import { h, animate, reducedMotion, sleep, haptic } from '../dom.js';
import { icon } from './icons.js';

export function countUp(el, from, to, ms = 900) {
  if (reducedMotion() || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

let toastHost;
export function toast(message, { icon: ic, tone = '', ms = 3200 } = {}) {
  if (!toastHost) { toastHost = h('div.toast-host', { 'aria-live': 'polite' }); document.body.append(toastHost); }
  const t = h('div.toast' + (tone ? '.' + tone : ''), {}, ic ? icon(ic, 20) : null, h('span', {}, message));
  toastHost.append(t);
  animate(t, [{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
  setTimeout(() => animate(t, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 240 }).then(() => t.remove()), ms);
}

/** Floating "+10 XP" that rises from an element. */
export function floatXp(anchor, amount) {
  if (!amount) return;
  const r = anchor.getBoundingClientRect();
  const f = h('div.float-xp', { style: { left: `${r.left + r.width / 2}px`, top: `${r.top}px` } }, `+${amount} XP`);
  document.body.append(f);
  animate(f, [{ opacity: 0, transform: 'translate(-50%, 0) scale(.8)' }, { opacity: 1, transform: 'translate(-50%, -26px) scale(1.05)', offset: 0.25 }, { opacity: 0, transform: 'translate(-50%, -70px) scale(1)' }], { duration: 1100 }).then(() => f.remove());
}

const COLORS = ['#C8760A', '#E8972A', '#8B2500', '#B8962E', '#F5E0B0', '#2A6A5E', '#D4AF50'];
export async function confetti({ count = 140, duration = 2600 } = {}) {
  if (reducedMotion()) return;
  const c = h('canvas.confetti', { 'aria-hidden': 'true' });
  c.width = innerWidth; c.height = innerHeight;
  document.body.append(c);
  const ctx = c.getContext('2d');
  const ps = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.55,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 15 - 5, w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: COLORS[(Math.random() * COLORS.length) | 0],
  }));
  const t0 = performance.now();
  await new Promise((done) => {
    const frame = (t) => {
      const k = (t - t0) / duration;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.vy += 0.34; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
        ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      k < 1 ? requestAnimationFrame(frame) : done();
    };
    requestAnimationFrame(frame);
  });
  c.remove();
}

/** Full-screen celebration card. `rows` = [{label, value}], `badges` = new achievements. */
export async function celebrate({ title, subtitle, xp = 0, rows = [], badges = [], cta = 'Continue', onDone }) {
  haptic(30);
  const xpEl = h('span.cel-xp-n', {}, '0');
  const overlay = h('div.celebrate', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.cel-card', {},
      h('div.cel-lotus', {}, icon('lotus', 64)),
      h('p.eyebrow', {}, subtitle || 'Well done'),
      h('h2', { html: title }),
      xp ? h('div.cel-xp', {}, '+', xpEl, ' XP') : null,
      rows.length ? h('div.cel-rows', {}, rows.map((r) => h('div.cel-row', {}, h('span', {}, r.label), h('strong', {}, r.value)))) : null,
      badges.length ? h('div.cel-badges', {}, badges.map((b, i) => h('div.cel-badge', { style: { animationDelay: `${0.5 + i * 0.15}s` } }, icon(b.icon, 28), h('div', {}, h('strong', {}, b.name), h('small', {}, b.description))))) : null,
      h('button.btn.btn-primary.btn-block', { onclick: close }, cta),
    ));
  function close() { overlay.classList.add('out'); setTimeout(() => { overlay.remove(); onDone?.(); }, 220); }
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('in'));
  confetti();
  await sleep(350);
  countUp(xpEl, 0, xp, 1000);
  overlay.querySelector('button')?.focus();
}
