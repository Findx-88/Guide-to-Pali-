// The floating "Pāli Typing" panel from the original site: collapsible, shortcut list, Mac/Windows switch,
// link to the full guide. Rows are also buttons: tap one to insert that letter in the answer box you last used.
import { h } from '../dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/fx.js';
import { LETTERS, modifierLabel } from './map.js';
import { insertIntoLast, setOsPreference } from './pali-input.js';

let widget = null;

export function mountTypingWidget() {
  if (widget) return;
  const collapsed = (() => { try { return localStorage.getItem('pali.kbw') !== 'open'; } catch { return true; } })();
  let os = store.state?.profile.keyboardOs || 'auto';
  const mods = [];

  const grid = h('div.pkw-grid', {}, LETTERS.map((l) => {
    const kbd = h('kbd', {}, `${modifierLabel(os)} + ${l.key.toUpperCase()}`);
    mods.push(kbd);
    return h('button.pkw-row', { type: 'button', title: `Insert ${l.name} (or type ${l.velthuis})`, onpointerdown: (e) => e.preventDefault(), onclick: () => { if (!insertIntoLast(l.lower)) toast('Tap an answer box first, then pick a letter', { icon: 'keyboard' }); } },
      kbd, h('span.pali', {}, l.lower), h('small', {}, l.velthuis));
  }));
  const osBtns = ['mac', 'win'].map((v) => h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => choose(v) }, v === 'mac' ? 'Mac (Option)' : 'Win (Alt)'));
  const resolved = () => (os === 'auto' ? (modifierLabel('auto') === '⌥' ? 'mac' : 'win') : os);
  function paint() { osBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(resolved() === ['mac', 'win'][i]))); mods.forEach((k, i) => { k.textContent = `${modifierLabel(os)} + ${LETTERS[i].key.toUpperCase()}`; }); }
  function choose(v) { os = v; setOsPreference(v); paint(); api('/api/profile', { method: 'PATCH', body: { keyboardOs: v } }).catch(() => {}); }
  document.addEventListener('pali:os', (e) => { os = e.detail; paint(); });

  const toggle = () => { const c = widget.classList.toggle('collapsed'); head.setAttribute('aria-expanded', String(!c)); try { localStorage.setItem('pali.kbw', c ? 'closed' : 'open'); } catch { /* ignore */ } };
  // On phones the collapsed panel is a small round “ā” button, so it never covers the lesson.
  const head = h('button.pkw-head', { type: 'button', 'aria-expanded': String(!collapsed), 'aria-label': 'Pāli typing help', onclick: toggle }, h('span.pkw-glyph', { 'aria-hidden': 'true' }, 'ā'), icon('keyboard', 18, 'pkw-ic'), h('span.pkw-label', {}, 'Pāli Typing'), icon('chevron', 16, 'pkw-chev'));
  widget = h('aside.pali-widget' + (collapsed ? '.collapsed' : ''), { 'aria-label': 'Pāli typing help' }, head,
    h('div.pkw-body', {}, h('div.pkw-os', {}, osBtns), grid,
      h('p.pkw-tip', {}, 'Or just type ', h('b', {}, 'aa'), ' → ā · ', h('b', {}, '.m'), ' → ṃ · ', h('b', {}, '~n'), ' → ñ'),
      h('a.pkw-link', { href: '#/typing' }, 'View full guide →')));
  document.body.append(widget);
  paint();
}

export const setWidgetVisible = (visible) => { if (widget) widget.hidden = !visible; };
