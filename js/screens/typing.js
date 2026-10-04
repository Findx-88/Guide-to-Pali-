// Typing guide — the interactive visual keyboard from the original site, generated from the shared key map
// (so it can never drift from what the inputs really do). Press Option/Alt + a letter in the box to see the key light up.
import { h } from '../dom.js';
import { store } from '../store.js';
import { LETTERS, BY_CODE, modifierLabel, isTouch } from '../keyboard/map.js';
import { attachPali } from '../keyboard/pali-input.js';
import { icon } from '../ui/icons.js';

const ROWS = [
  [['Backquote', '`'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'], ['Equal', '='], ['Backspace', '⌫', 'wide']],
  [['Tab', '⇥', 'wide'], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\']],
  [['CapsLock', '⇪', 'wide'], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'], ['Quote', "'"], ['Enter', '⏎', 'wide']],
  [['ShiftLeft', '⇧', 'xwide'], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', '⇧', 'xwide']],
  [['ControlLeft', 'Ctrl', 'wide'], ['AltLeft', 'ALT', 'wide'], ['Space', '', 'space'], ['AltRight', 'ALT', 'wide']],
];

export default function typing(_params, ctx) {
  const os = store.state?.profile.keyboardOs || 'auto';
  const mod = modifierLabel(os);
  const dot = h('span.kdot');
  const label = h('span', {}, `${mod} not held`);
  const field = attachPali(h('textarea.ex-input.big', { rows: 3, placeholder: `Click here, hold ${mod} and press a highlighted letter… or type  bhikkhu, brāhmaṇa, saṅgha`, 'aria-label': 'Typing practice' }));

  const keys = new Map();
  const kb = h('div.kbv', { role: 'img', 'aria-label': 'Keyboard showing which keys type Pāli letters' }, ROWS.map((row) =>
    h('div.kbv-row', {}, row.map(([code, text, size]) => {
      const l = BY_CODE[code];
      const k = h('div.kbv-key' + (l ? '.pali-key' : '.dim') + (size ? '.' + size : ''), { dataset: { code } },
        l ? [h('small', {}, l.upper), h('span.pali', {}, l.lower)] : (code.startsWith('Alt') ? h('span', {}, mod) : text));
      keys.set(code, k);
      return k;
    }))));

  const flash = (code) => { const k = keys.get(code); if (!k) return; k.classList.add('active'); setTimeout(() => k.classList.remove('active'), 220); };
  const setMod = (on) => { dot.classList.toggle('on', on); label.textContent = on ? `${mod} held — special letters active` : `${mod} not held`; ['AltLeft', 'AltRight'].forEach((c) => keys.get(c)?.classList.toggle('active', on)); };
  const down = (e) => { if (e.key === 'Alt') setMod(true); };
  const up = (e) => { if (e.key === 'Alt') setMod(false); };
  field.addEventListener('keydown', (e) => { if (e.altKey && BY_CODE[e.code]) flash(e.code); });
  const blur = () => setMod(false);
  window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
  ctx?.onLeave(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); });

  return h('div.page.typing', {},
    h('a.back', { href: '#/profile' }, icon('back', 18), 'Settings'),
    h('p.eyebrow', {}, 'Typing guide'), h('h1', {}, 'Typing ', h('em', {}, 'Pāli')),
    h('p.muted', {}, `Hold ${mod} (${os === 'win' ? 'Alt' : os === 'mac' ? 'Option' : 'Option on Mac, Alt on Windows'}) and press a letter to insert the marked character. Highlighted keys show what each one types. Add Shift for a capital.`),
    h('div.card.kbv-card', {}, h('div.modbar', {}, dot, label), kb, field),
    h('div.card', {}, h('h3', {}, 'No Alt key? Two other ways'),
      h('p.muted', {}, isTouch() ? 'On a phone or tablet a row of Pāli letters appears above your keyboard whenever you tap an answer box.' : 'A row of Pāli letters appears at the bottom whenever you click an answer box, and the floating “Pāli Typing” panel lets you insert a letter with one click.'),
      h('p.muted', {}, 'Or type two keys and they turn into one letter. Backspace right away undoes it:'),
      h('div.letter-grid', {}, LETTERS.map((l) => h('div.lg', {}, h('span.pali', {}, l.lower), h('kbd', {}, l.velthuis)))),
      h('p.muted.small', {}, 'Capitals work too: Aa → Ā.')),
    h('div.card', {}, h('h3', {}, `All shortcuts (${mod} + key)`), h('div.letter-grid', {}, LETTERS.map((l) => h('div.lg', {}, h('span.pali', {}, l.lower), h('kbd', {}, `${mod} ${l.key.toUpperCase()}`))))));
}
