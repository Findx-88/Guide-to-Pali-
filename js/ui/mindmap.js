// Interactive radial mind map, generated entirely from JSON:
//   { root: { id, label, sub?, detail?, lesson?, children: [...] }, links: [{ from, to, label }] }
// Tap a node to select it (highlights its relations + shows detail); tap ⊕ to expand a branch; drag to pan; pinch/wheel to zoom.
import { h, animate } from '../dom.js';
import { icon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); kids.forEach((k) => e.append(k)); return e; };
const RADII = [0, 175, 320, 450, 560];
const BRANCH_COLORS = ['#C8760A', '#2A6A5E', '#8B2500', '#B8962E', '#5B6E8C', '#7A4E8C'];

export function mindMap(data, { onOpenLesson } = {}) {
  // ── index the tree ──
  const nodes = new Map();
  (function walk(n, depth, parent, branch) {
    n._depth = depth; n._parent = parent; n._branch = branch;
    n._open = depth < 1;                        // root's children visible; deeper branches start collapsed
    nodes.set(n.id, n);
    (n.children || []).forEach((c, i) => walk(c, depth + 1, n, depth === 0 ? i : branch));
  })(data.root, 0, null, 0);

  const svg = sv('svg', { class: 'mm-svg', role: 'img', 'aria-label': `Mind map: ${data.root.label}` });
  const gLinks = sv('g', { class: 'mm-links' }), gEdges = sv('g', { class: 'mm-edges' }), gNodes = sv('g', { class: 'mm-nodes' });
  const world = sv('g', {}, gLinks, gEdges, gNodes);
  svg.append(world);
  const detail = h('div.mm-detail.card', {}, h('p.muted', {}, 'Tap any idea to see how it connects.'));
  const view = { x: 0, y: 0, k: 1 };
  let selected = null, W = 800, H = 600;

  const colorOf = (n) => (n._depth === 0 ? 'var(--saffron)' : BRANCH_COLORS[n._branch % BRANCH_COLORS.length]);
  const visible = (n) => !n._parent || (visible(n._parent) && n._parent._open);

  // ── layout: angle slices proportional to visible leaves ──
  const leaves = (n) => (!n._open || !n.children?.length ? 1 : n.children.reduce((a, c) => a + leaves(c), 0));
  function layout() {
    (function place(n, a0, a1) {
      const mid = (a0 + a1) / 2, r = RADII[Math.min(n._depth, RADII.length - 1)];
      n._x = n._depth === 0 ? 0 : Math.cos(mid) * r; n._y = n._depth === 0 ? 0 : Math.sin(mid) * r;
      if (n._open && n.children?.length) {
        const total = leaves(n); let a = a0;
        for (const c of n.children) { const span = ((a1 - a0) * leaves(c)) / total; place(c, a, a + span); a += span; }
      }
    })(data.root, -Math.PI / 2, (3 * Math.PI) / 2);
  }

  // ── draw ──
  const els = new Map();
  function nodeEl(n) {
    if (els.has(n.id)) return els.get(n.id);
    const w = Math.max(88, Math.min(200, Math.max(n.label.length * 8.2, (n.sub?.length || 0) * 6.3) + 28)), ht = n.sub ? 46 : 34;
    const g = sv('g', { class: `mm-node d${Math.min(n._depth, 3)}`, tabindex: '0', role: 'button', 'aria-label': n.label });
    const rect = sv('rect', { x: -w / 2, y: -ht / 2, width: w, height: ht, rx: n._depth === 0 ? 22 : 14 });
    rect.style.setProperty('--c', colorOf(n));
    const t = sv('text', { 'text-anchor': 'middle', y: n.sub ? -3 : 5 }); t.textContent = n.label;
    g.append(rect, t);
    if (n.sub) { const s = sv('text', { class: 'sub', 'text-anchor': 'middle', y: 13 }); s.textContent = n.sub; g.append(s); }
    if (n.children?.length && n._depth > 0) {          // the root is always open, so it gets no toggle
      const b = sv('g', { class: 'mm-toggle', transform: `translate(${w / 2 - 2},${-ht / 2 + 2})` }, sv('circle', { r: 9 }), sv('text', { 'text-anchor': 'middle', y: 4 }));
      b.querySelector('text').textContent = '+'; g.append(b); g._toggle = b;
      b.addEventListener('click', (e) => { e.stopPropagation(); toggle(n); });
    }
    g.addEventListener('click', () => select(n));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n); } });
    gNodes.append(g); els.set(n.id, g);
    return g;
  }

  function draw(first = false) {
    layout();
    gEdges.replaceChildren(); gLinks.replaceChildren();
    let order = 0;
    for (const n of nodes.values()) {
      const g = nodeEl(n);
      const show = visible(n);
      g.style.display = show ? '' : 'none';
      if (!show) { g.classList.remove('shown'); continue; }
      const px = n._parent ? n._parent._x : 0, py = n._parent ? n._parent._y : 0;
      g.style.transitionDelay = first ? `${order++ * 28}ms` : '0ms';
      if (!g.classList.contains('shown')) {                // grow out of the parent: set the start state, flush styles, then go
        g.style.transform = `translate(${px}px, ${py}px) scale(.4)`;
        g.getBoundingClientRect();
      }
      g.style.transform = `translate(${n._x}px, ${n._y}px) scale(1)`;
      g.classList.add('shown');
      if (g._toggle) g._toggle.querySelector('text').textContent = n._open ? '−' : '+';
      if (n._parent) {
        const p = n._parent, mx = (p._x + n._x) / 2, my = (p._y + n._y) / 2;
        const path = sv('path', { class: 'mm-edge', d: `M${p._x},${p._y} Q${mx * 1.04},${my * 1.04} ${n._x},${n._y}`, stroke: colorOf(n) });
        path.dataset.a = p.id; path.dataset.b = n.id;
        gEdges.append(path);
      }
    }
    for (const l of data.links || []) {
      const a = nodes.get(l.from), b = nodes.get(l.to);
      if (!a || !b || !visible(a) || !visible(b)) continue;
      const mx = (a._x + b._x) / 2 * 0.55, my = (a._y + b._y) / 2 * 0.55;
      const p = sv('path', { class: 'mm-link', d: `M${a._x},${a._y} Q${mx},${my} ${b._x},${b._y}` });
      p.dataset.a = l.from; p.dataset.b = l.to;
      gLinks.append(p);
    }
    restyle();
  }

  function restyle() {
    const rel = new Set();
    if (selected) {
      rel.add(selected.id);
      if (selected._parent) rel.add(selected._parent.id);
      (selected.children || []).forEach((c) => rel.add(c.id));
      (data.links || []).forEach((l) => { if (l.from === selected.id) rel.add(l.to); if (l.to === selected.id) rel.add(l.from); });
    }
    for (const [id, g] of els) { g.classList.toggle('sel', selected?.id === id); g.classList.toggle('dim', !!selected && !rel.has(id)); }
    gEdges.querySelectorAll('path').forEach((p) => p.classList.toggle('dim', !!selected && !(rel.has(p.dataset.a) && rel.has(p.dataset.b))));
    gLinks.querySelectorAll('path').forEach((p) => { const on = selected && (p.dataset.a === selected.id || p.dataset.b === selected.id); p.classList.toggle('on', !!on); p.classList.toggle('dim', !!selected && !on); });
  }

  function select(n) {
    selected = selected === n ? null : n;
    restyle();
    if (!selected) { detail.replaceChildren(h('p.muted', {}, 'Tap any idea to see how it connects.')); return; }
    const related = (data.links || []).filter((l) => l.from === n.id || l.to === n.id).map((l) => ({ node: nodes.get(l.from === n.id ? l.to : l.from), label: l.label }));
    detail.replaceChildren(
      h('p.eyebrow', {}, n._parent ? n._parent.label : 'Overview'), h('h3', {}, n.label), n.sub ? h('p.muted.small', {}, n.sub) : null,
      n.detail ? h('div.mm-detail-body', { html: n.detail }) : null,
      related.length ? h('div.mm-rel', {}, h('p.eyebrow.tight', {}, 'Connects to'), related.map((r) => h('button.chip-btn', { type: 'button', onclick: () => select(r.node) }, r.node.label, r.label ? h('small', {}, ` · ${r.label}`) : null))) : null,
      h('div.mm-actions', {}, n.children?.length ? h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => toggle(n) }, n._open ? 'Collapse' : 'Expand', ` (${n.children.length})`) : null,
        n.lesson ? h('a.btn.btn-primary.btn-sm', { href: `#/lesson/${n.lesson}`, onclick: () => onOpenLesson?.(n.lesson) }, 'Open lesson', icon('arrow', 16)) : null));
    animate(detail, [{ opacity: 0.4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260 });
  }
  function toggle(n) { n._open = !n._open; draw(); fit(); }

  // ── viewport: fit, pan, zoom ──
  const apply = () => world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  function fit() {
    const vis = [...nodes.values()].filter(visible);
    const xs = vis.map((n) => n._x), ys = vis.map((n) => n._y);
    const minX = Math.min(...xs) - 110, maxX = Math.max(...xs) + 110, minY = Math.min(...ys) - 50, maxY = Math.max(...ys) + 50;
    const k = Math.min(W / (maxX - minX), H / (maxY - minY), 1.15);
    view.k = k; view.x = W / 2 - ((minX + maxX) / 2) * k; view.y = H / 2 - ((minY + maxY) / 2) * k;
    world.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)'; apply();
    setTimeout(() => { world.style.transition = ''; }, 520);
  }
  function resize() { const r = svg.getBoundingClientRect(); W = r.width || 800; H = r.height || 600; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); }

  const pts = new Map(); let pinch = 0, moved = false;
  svg.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  svg.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) { moved = true; svg.setPointerCapture?.(e.pointerId); }
      view.x += dx; view.y += dy; apply();
    } else if (pts.size === 2) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); pinch = d; return;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  function zoomAt(cx, cy, f) {
    const r = svg.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    const k = Math.max(0.35, Math.min(2.6, view.k * f)), s = k / view.k;
    view.x = x - (x - view.x) * s; view.y = y - (y - view.y) * s; view.k = k; apply();
  }
  svg.addEventListener('click', (e) => { if (!moved && e.target === svg) { selected = null; restyle(); detail.replaceChildren(h('p.muted', {}, 'Tap any idea to see how it connects.')); } });

  const setAll = (open) => { nodes.forEach((n) => { if (n._depth > 0 && n.children?.length) n._open = open; }); data.root._open = true; draw(); fit(); };
  const controls = h('div.mm-controls', {},
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => setAll(true) }, 'Expand all'),
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => setAll(false) }, 'Collapse'),
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: fit }, 'Fit'));

  const el = h('div.mindmap', {}, controls, h('div.mm-canvas', {}, svg), detail);
  requestAnimationFrame(() => { resize(); draw(true); fit(); });
  new ResizeObserver(() => { resize(); fit(); }).observe(svg);
  return el;
}
