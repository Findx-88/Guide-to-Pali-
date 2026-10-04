// Tiny DOM helpers. `h('div.card', { onclick }, 'text', child)` — no framework, no build step.
export function h(tag, props, ...children) {
  const [head, ...classes] = tag.split('.');
  const [name, id] = head.split('#');                     // 'main#view.view' → <main id="view" class="view">
  const el = document.createElement(name || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (el) => { el.textContent = ''; return el; };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Run an animation via the Web Animations API; resolves when finished (or immediately under reduced motion). */
export function animate(el, keyframes, options) {
  if (!el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const a = el.animate(keyframes, { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both', ...options });
  // Persist the end state as inline style, then release the animation — finished-but-held animations keep
  // compositor layers alive (and stalled headless screenshots).
  return a.finished.then(() => {
    try { a.commitStyles(); a.cancel(); } catch { /* element detached */ }
    // A leftover identity transform (e.g. "translateY(0px)") would make this element the containing block for
    // every position:fixed child inside it (floating buttons would scroll away), so drop resting values.
    if (/^(none|translate[XY]?\(0(px)?\)|translate\(0(px)?(, 0(px)?)?\)|scale\(1\)|matrix\(1, 0, 0, 1, 0, 0\))$/.test(el.style.transform)) el.style.transform = '';
    if (el.style.opacity === '1') el.style.opacity = '';
  }).catch(() => {});
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

/** Centre `child` inside a horizontally scrolling `strip` WITHOUT moving the page vertically
 *  (scrollIntoView would also scroll the document and fight the reader's own scrolling). */
export function centerInStrip(strip, child) {
  if (!strip || !child) return;
  const left = child.offsetLeft - strip.clientWidth / 2 + child.offsetWidth / 2;
  // Instant on purpose: Chrome runs one smooth scroll at a time, so a smooth strip scroll would cancel
  // the page's own smooth scroll (tapping "Exercise B" used to stop half-way down).
  strip.scrollLeft = Math.max(0, left);
}
