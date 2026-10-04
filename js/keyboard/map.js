// SINGLE SOURCE OF TRUTH for Pāli input. The shortcuts, the on-screen bar, the typing guide and the
// auto-convert rules are all generated from this table (previously there were three diverging copies).
export const LETTERS = [
  { lower: 'ā', upper: 'Ā', code: 'KeyA', key: 'a', name: 'long a',          velthuis: 'aa' },
  { lower: 'ī', upper: 'Ī', code: 'KeyI', key: 'i', name: 'long i',          velthuis: 'ii' },
  { lower: 'ū', upper: 'Ū', code: 'KeyU', key: 'u', name: 'long u',          velthuis: 'uu' },
  { lower: 'ṃ', upper: 'Ṃ', code: 'KeyM', key: 'm', name: 'niggahīta (anusvāra)', velthuis: '.m' },
  { lower: 'ṅ', upper: 'Ṅ', code: 'KeyG', key: 'g', name: 'velar nasal',     velthuis: '"n' },
  { lower: 'ñ', upper: 'Ñ', code: 'KeyJ', key: 'j', name: 'palatal nasal',   velthuis: '~n' },
  { lower: 'ṭ', upper: 'Ṭ', code: 'KeyT', key: 't', name: 'retroflex t',     velthuis: '.t' },
  { lower: 'ḍ', upper: 'Ḍ', code: 'KeyD', key: 'd', name: 'retroflex d',     velthuis: '.d' },
  { lower: 'ṇ', upper: 'Ṇ', code: 'KeyN', key: 'n', name: 'retroflex n',     velthuis: '.n' },
  { lower: 'ḷ', upper: 'Ḷ', code: 'KeyL', key: 'l', name: 'retroflex l',     velthuis: '.l' },
];

export const BY_CODE = Object.fromEntries(LETTERS.map((l) => [l.code, l]));

/** Two-key sequences that turn into one letter as you type (Velthuis-style, works on every keyboard). */
export const SEQUENCES = (() => {
  const seq = {};
  for (const l of LETTERS) {
    const [a, b] = l.velthuis;
    seq[a + b] = l.lower;
    if (/[a-z]/.test(a)) {
      seq[a.toUpperCase() + b] = l.upper;               // "Aa" → Ā  (sentence-initial)
      seq[a.toUpperCase() + b.toUpperCase()] = l.upper; // "AA" → Ā
    } else {
      seq[a + b.toUpperCase()] = l.upper;               // ".M" → Ṃ
    }
  }
  return seq;
})();

/** Variant spellings people paste or type that we treat as the canonical letter. */
const CANONICAL = { 'ṁ': 'ṃ', 'Ṁ': 'Ṃ', 'ŋ': 'ṃ', 'ṅ': 'ṅ' };

/** Normalise any typed/pasted Pāli to canonical NFC form (decomposed marks → precomposed). */
export function canonical(text) {
  return String(text).normalize('NFC').replace(/[ṁṀŋ]/g, (c) => CANONICAL[c]);
}

/** Strip every diacritic: ā→a, ṃ→m, ñ→n … (used for lenient comparison only). */
export function stripMarks(text) {
  return canonical(text).toLowerCase()
    .replace(/[āàáâ]/g, 'a').replace(/[īìíî]/g, 'i').replace(/[ūùúû]/g, 'u')
    .replace(/[ṃṁ]/g, 'm').replace(/[ṅñṇ]/g, 'n').replace(/ṭ/g, 't').replace(/ḍ/g, 'd').replace(/ḷ/g, 'l');
}

export const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export const modifierLabel = (os = 'auto') => ((os === 'auto' ? isApple() : os === 'mac') ? '⌥' : 'Alt');
