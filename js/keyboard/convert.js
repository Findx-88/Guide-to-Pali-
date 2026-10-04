// Pure text logic for auto-conversion (no DOM) so it can be unit-tested in Node.
import { SEQUENCES } from './map.js';

/**
 * Look at the two characters before the caret. If they form a known sequence ("aa", ".m", "~n" …)
 * return the edit that replaces them with the single Pāli letter.
 */
export function convertTail(value, caret) {
  if (caret < 2) return null;
  const raw = value.slice(caret - 2, caret);
  const replacement = SEQUENCES[raw];
  if (!replacement) return null;
  // Don't convert inside a URL/number-ish context like "3.m" — require the dot-sequences to follow a letter.
  if (raw[0] === '.' && caret >= 3 && /[\d/]/.test(value[caret - 3])) return null;
  return { start: caret - 2, end: caret, replacement, raw };
}

/** Apply an edit produced by convertTail (used by tests and as a no-undo fallback). */
export function applyEdit(value, edit) {
  return value.slice(0, edit.start) + edit.replacement + value.slice(edit.end);
}
