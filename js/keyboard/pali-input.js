// Pāli input layer. Three ways to type a diacritic, all routed through one `insertText`:
//   1. On-screen bar (touch-first; never steals focus, sits above the soft keyboard)
//   2. Type-ahead sequences: aa→ā  ii→ī  uu→ū  .m→ṃ  .n→ṇ  ~n→ñ  "n→ṅ  .t→ṭ  .d→ḍ  .l→ḷ  (Backspace undoes)
//   3. Desktop shortcut: Option/Alt + letter (kept from the original, but now safe)
//
// Why the old keyboard glitched (root causes, all fixed here):
//   • it wrote `el.value = …`, which wipes the browser undo stack and breaks IME/selection → we use
//     execCommand('insertText') / setRangeText + a real InputEvent
//   • no way to type on phones (no Alt key) → bar + sequences
//   • one global keydown listener tied to `document.activeElement` tag names; pages each wired their own copy
//     → single registry of opted-in fields
//   • `const PALI_KEY_MAP` never reached `window`, so the typing guide rendered an empty keyboard
//   • three diverging key maps → one table in map.js
import { LETTERS, BY_CODE, canonical, modifierLabel, isTouch } from './map.js';
import { convertTail } from './convert.js';
import { h } from '../dom.js';

let busy = false;            // true while WE are editing, so our own input events are ignored
let last = null;             // last auto-conversion, for Backspace-to-undo
let bar = null;
let activeField = null;
let lastField = null;         // last Pāli field the learner used (the floating panel inserts here)
let upper = false;           // shift state of the bar
let osPref = 'auto';

export const setOsPreference = (os) => { osPref = os; if (bar) renderBar(); document.dispatchEvent(new CustomEvent('pali:os', { detail: os })); };
/** Insert into the most recently used Pāli field. Returns false if there is none on screen. */
export function insertIntoLast(text) {
  if (!lastField || !lastField.isConnected) return false;
  insertText(lastField, text);
  return true;
}

/** Mark an <input>/<textarea> as a Pāli field. Idempotent. */
export function attachPali(el) {
  if (!el || el.dataset.pali) return el;
  el.dataset.pali = '1';
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('autocapitalize', 'off');
  el.setAttribute('spellcheck', 'false');
  el.setAttribute('enterkeyhint', el.getAttribute('enterkeyhint') || 'done');
  el.setAttribute('lang', 'pi');
  return el;
}

/** Insert text at the caret / over the selection, preserving undo history and firing a genuine input event. */
export function insertText(el, text) {
  if (!el || el.disabled || el.readOnly) return;
  busy = true;
  try {
    el.focus({ preventScroll: true });
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
    if (!ok || !el.value.includes(text)) {               // fallback (older Firefox): same result, no undo entry
      const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
      el.setRangeText(text, s, e, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  } finally { busy = false; }
}

function replaceRange(el, start, end, text) {
  busy = true;
  try {
    el.setSelectionRange(start, end);
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
    if (!ok) {
      el.setRangeText(text, start, end, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  } finally { busy = false; }
}

// ───────── 2. type-ahead sequences ─────────
function onInput(e) {
  const el = e.target;
  if (busy || !el.dataset?.pali || e.isComposing) return;
  if (e.inputType && e.inputType !== 'insertText' && e.inputType !== 'insertCompositionText') { last = null; return; }
  convertAtCaret(el);
}
function convertAtCaret(el) {
  if (el.selectionStart !== el.selectionEnd) return;
  const caret = el.selectionStart;
  const edit = convertTail(el.value, caret);
  if (!edit) { last = null; return; }
  replaceRange(el, edit.start, edit.end, edit.replacement);
  last = { el, end: edit.start + edit.replacement.length, raw: edit.raw, ch: edit.replacement };
}
function onBeforeInput(e) {                                // Backspace right after a conversion restores what was typed
  const el = e.target;
  if (busy || !last || last.el !== el || e.inputType !== 'deleteContentBackward') return;
  if (el.selectionStart === last.end && el.selectionEnd === last.end && el.value.slice(last.end - last.ch.length, last.end) === last.ch) {
    e.preventDefault();
    const { raw, end, ch } = last;
    last = null;
    replaceRange(el, end - ch.length, end, raw);
  }
}

// ───────── 3. desktop shortcut (Option/Alt + letter) ─────────
function onKeyDown(e) {
  const el = e.target;
  if (!el.dataset?.pali || e.isComposing) return;
  if (!e.altKey || e.metaKey) return;
  if (e.ctrlKey && !e.getModifierState?.('AltGraph')) return;   // Ctrl+Alt chords belong to the OS
  if (e.getModifierState?.('AltGraph')) return;                 // AltGr is used by many layouts for their own letters
  const l = BY_CODE[e.code];
  if (!l) return;
  e.preventDefault();                                           // also stops the browser menu bar / dead-key glitches
  insertText(el, e.shiftKey ? l.upper : l.lower);
  flashKey(l.lower);
}

// ───────── 1. on-screen bar ─────────
function renderBar() {
  if (!bar) return;
  bar.replaceChildren(
    h('button.pk-key.pk-shift', { type: 'button', 'aria-label': 'Toggle capital letters', 'aria-pressed': String(upper), onclick: () => { upper = !upper; renderBar(); } }, '⇧'),
    ...LETTERS.map((l) => h('button.pk-key', {
      type: 'button', 'aria-label': `Insert ${l.name}`, title: `${modifierLabel(osPref)} + ${l.key.toUpperCase()}  ·  or type ${l.velthuis}`,
      dataset: { ch: l.lower },
      onclick: () => { if (activeField) insertText(activeField, upper ? l.upper : l.lower); },
    }, upper ? l.upper : l.lower)),
  );
}
function flashKey(ch) {
  const k = bar?.querySelector(`[data-ch="${ch}"]`);
  if (!k) return;
  k.classList.add('hit');
  setTimeout(() => k.classList.remove('hit'), 160);
}
function placeBar() {                                       // keep the bar glued above the on-screen keyboard
  if (!bar) return;
  const vv = window.visualViewport;
  const offset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  bar.style.setProperty('--kb-off', `${offset}px`);   // consumed by CSS so the hidden state isn't overridden
}
function showFor(el) {
  activeField = el;
  lastField = el;
  bar.classList.add('open');
  document.documentElement.classList.add('pk-open');
  placeBar();
}
function hideBar() {
  activeField = null;
  bar.classList.remove('open');
  document.documentElement.classList.remove('pk-open');
}

export function mountPaliKeyboard({ os = 'auto' } = {}) {
  if (bar) return;
  osPref = os;
  bar = h('div.pk-bar', { role: 'toolbar', 'aria-label': 'Pāli letters' });
  // Keep the text field focused when a bar key is pressed (this removes the classic "keyboard flickers closed" glitch).
  bar.addEventListener('pointerdown', (e) => e.preventDefault());
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  document.body.append(bar);
  renderBar();

  document.addEventListener('focusin', (e) => { if (e.target.dataset?.pali) showFor(e.target); });
  document.addEventListener('focusout', (e) => {
    if (!e.target.dataset?.pali) return;
    setTimeout(() => { if (!document.activeElement?.dataset?.pali) hideBar(); }, 120);
  });
  document.addEventListener('input', onInput, true);
  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('compositionend', (e) => { if (e.target.dataset?.pali && !busy) convertAtCaret(e.target); }, true);
  window.visualViewport?.addEventListener('resize', placeBar);
  window.visualViewport?.addEventListener('scroll', placeBar);
  addEventListener('resize', placeBar);
  if (isTouch()) document.documentElement.classList.add('touch');
}

/** Clean text that came from typing or pasting. */
export const cleanPaliText = (s) => canonical(s).replace(/\s+/g, ' ').trim();
