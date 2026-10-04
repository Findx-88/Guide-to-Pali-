// Pāli morphology for the vocabulary search. Pure functions (no DOM) so every rule is unit-tested.
//   • nounForms(): all eight cases × singular/plural for masculine and neuter nouns in -a (the Primer's paradigm)
//   • verbForms(): present 3rd person, gerund, infinitive, present participle
//   • buildIndex()/search(): find a word by lemma, English meaning, OR any inflected form
import { stripMarks, canonical } from '../keyboard/map.js';

export const CASES = [
  { id: 'nom', name: 'Nominative',   abbr: 'Nom.', lesson: 1, job: 'subject — who does it' },
  { id: 'voc', name: 'Vocative',     abbr: 'Voc.', lesson: 8, job: 'calling out — “O …!”' },
  { id: 'acc', name: 'Accusative',   abbr: 'Acc.', lesson: 2, job: 'object, or place gone to' },
  { id: 'ins', name: 'Instrumental', abbr: 'Ins.', lesson: 3, job: 'by / with' },
  { id: 'abl', name: 'Ablative',     abbr: 'Abl.', lesson: 4, job: 'from' },
  { id: 'dat', name: 'Dative',       abbr: 'Dat.', lesson: 5, job: 'to / for' },
  { id: 'gen', name: 'Genitive',     abbr: 'Gen.', lesson: 6, job: 'of — possession' },
  { id: 'loc', name: 'Locative',     abbr: 'Loc.', lesson: 7, job: 'in / on / at' },
];
export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));
export const NUMBER_NAME = { sg: 'singular', pl: 'plural' };

// Endings are added to the stem without its final "a" (nara → nar + o). `*` marks an archaic alternative.
const M_ENDINGS = {
  nom: { sg: ['o'], pl: ['ā'] },
  voc: { sg: ['a'], pl: ['ā'] },
  acc: { sg: ['aṃ'], pl: ['e'] },
  ins: { sg: ['ena'], pl: ['ehi', 'ebhi*'] },
  abl: { sg: ['ā', 'amhā', 'asmā'], pl: ['ehi', 'ebhi*'] },
  dat: { sg: ['āya', 'assa'], pl: ['ānaṃ'] },
  gen: { sg: ['assa'], pl: ['ānaṃ'] },
  loc: { sg: ['e', 'amhi', 'asmiṃ'], pl: ['esu'] },
};
// Neuter nouns differ only in Nominative, Vocative and Accusative (as taught in Lesson VIII).
const N_OVERRIDES = {
  nom: { sg: ['aṃ'], pl: ['āni'] },
  voc: { sg: ['aṃ'], pl: ['āni'] },
  acc: { sg: ['aṃ'], pl: ['āni'] },
};

const caseOrder = CASES.map((c) => c.id);
const entry = (form, archaic = false) => ({ form, archaic });

/** @returns {{[case:string]: {sg: {form:string, archaic:boolean}[], pl: {form:string, archaic:boolean}[]}}} */
export function nounForms(lemma, gender = 'm') {
  const stem = lemma.replace(/a$/, '');
  const out = {};
  for (const c of caseOrder) {
    out[c] = {};
    for (const n of ['sg', 'pl']) {
      const endings = (gender === 'n' && N_OVERRIDES[c]?.[n]) || M_ENDINGS[c][n];
      out[c][n] = endings.map((e) => (e.endsWith('*') ? entry(stem + e.slice(0, -1), true) : entry(stem + e)));
    }
  }
  return out;
}

const uniq = (a) => [...new Set(a.filter(Boolean))];

/**
 * Verb forms. `irregular` (from content/lexicon-overrides.json) replaces what the regular pattern would give.
 * Regular -ati verbs: pacati → pacanti · pacitvā · pacituṃ · pacanta / pacamāna.
 */
export function verbForms(lemma, irregular = {}) {
  const regular = lemma.endsWith('ati');
  const stem = regular ? lemma.slice(0, -3) : null;           // pac-
  const base = lemma.replace(/ti$/, '');                      // paca-
  const pl = irregular.pres3pl ? [irregular.pres3pl] : [regular ? `${stem}anti` : lemma.replace(/ti$/, 'nti')];
  const gerund = irregular.gerund ?? (regular ? [`${stem}itvā`] : []);
  const infinitive = irregular.infinitive ?? (regular ? [`${stem}ituṃ`] : []);
  const participle = irregular.participle === null ? [] : [irregular.participle ?? `${base}nta`].map((p) => p);
  return {
    present: { sg: [lemma], pl },
    gerund: uniq(gerund),
    infinitive: uniq(infinitive),
    participle: participle.length ? uniq([participle[0], participle[0].replace(/nta$/, 'māna')]) : [],
  };
}

export const VERB_ROWS = [
  { id: 'pres-sg', label: 'Present, 3rd singular', hint: 'he / she / it …s', lesson: 1 },
  { id: 'pres-pl', label: 'Present, 3rd plural', hint: 'they …', lesson: 1 },
  { id: 'gerund', label: 'Gerund', hint: 'having …ed', lesson: 9 },
  { id: 'infinitive', label: 'Infinitive', hint: 'to …', lesson: 10 },
  { id: 'participle', label: 'Present participle', hint: '… -ing (agrees with its noun)', lesson: 11 },
];

// ───────── searching ─────────
/**
 * lexicon: [{ id, lemma, pos: 'noun'|'verb'|'adj'|'other', gender, meaning: string[], lessons: number[], irregular? }]
 * Every analysis row: { id (entry id), form, kind: 'noun'|'verb', case?, number?, verbForm?, archaic }
 */
export function formsOf(e) {
  if (e.pos === 'noun' || e.pos === 'adj') {
    const t = nounForms(e.lemma, e.gender || 'm');
    const rows = [];
    for (const c of caseOrder) for (const n of ['sg', 'pl']) for (const f of t[c][n]) rows.push({ form: f.form, kind: 'noun', case: c, number: n, archaic: f.archaic });
    return rows;
  }
  if (e.pos === 'verb') {
    const v = verbForms(e.lemma, e.irregular || {});
    const rows = [];
    v.present.sg.forEach((f) => rows.push({ form: f, kind: 'verb', verbForm: 'pres-sg' }));
    v.present.pl.forEach((f) => rows.push({ form: f, kind: 'verb', verbForm: 'pres-pl' }));
    v.gerund.forEach((f) => rows.push({ form: f, kind: 'verb', verbForm: 'gerund' }));
    v.infinitive.forEach((f) => rows.push({ form: f, kind: 'verb', verbForm: 'infinitive' }));
    v.participle.forEach((f) => rows.push({ form: f, kind: 'verb', verbForm: 'participle' }));
    return rows;
  }
  return [{ form: e.lemma, kind: 'other' }];
}

export function buildIndex(lexicon) {
  const byForm = new Map();                    // stripped form → analyses[]
  const rowsById = new Map();
  for (const e of lexicon) {
    const rows = formsOf(e).map((r) => ({ ...r, id: e.id }));
    rowsById.set(e.id, rows);
    for (const r of rows) {
      const k = stripMarks(r.form);
      if (!byForm.has(k)) byForm.set(k, []);
      byForm.get(k).push(r);
    }
  }
  return { lexicon, byForm, rowsById, byId: new Map(lexicon.map((e) => [e.id, e])) };
}

const CASE_WORDS = {
  nominative: 'nom', nom: 'nom', vocative: 'voc', voc: 'voc', accusative: 'acc', acc: 'acc',
  instrumental: 'ins', ins: 'ins', inst: 'ins', ablative: 'abl', abl: 'abl', dative: 'dat', dat: 'dat',
  genitive: 'gen', gen: 'gen', locative: 'loc', loc: 'loc',
};
const NUMBER_WORDS = { singular: 'sg', sg: 'sg', plural: 'pl', pl: 'pl' };

/** Pull grammar words ("locative", "pl") out of a query: "nara locative" → { text: 'nara', case: 'loc' }. */
export function parseQuery(q) {
  const words = canonical(q).trim().split(/\s+/).filter(Boolean);
  let kase = null, number = null;
  const rest = [];
  for (const w of words) {
    const lw = w.toLowerCase().replace(/[.,]$/, '');
    if (CASE_WORDS[lw] && words.length > 1) kase = CASE_WORDS[lw];
    else if (NUMBER_WORDS[lw] && words.length > 1) number = NUMBER_WORDS[lw];
    else rest.push(w);
  }
  return { text: rest.join(' '), case: kase, number };
}

/**
 * Returns [{ entry, matches: [{row, via}], rank }] sorted best first.
 *   via: 'form'    — the query is an inflected form (shows its case/number)
 *        'lemma'   — the query is (the start of) the dictionary word
 *        'meaning' — the query is found in the English meaning
 */
export function search(index, rawQuery, { pos = 'all', lesson = 'all', kase = null } = {}) {
  const { text, case: qCase, number: qNumber } = parseQuery(rawQuery);
  const q = stripMarks(text);
  const focusCase = kase || qCase;
  const found = new Map();
  const add = (id, match, rank) => {
    const cur = found.get(id) || { entry: index.byId.get(id), matches: [], rank: 99 };
    if (match && !cur.matches.some((m) => m.row?.form === match.row?.form && m.via === match.via && m.row?.case === match.row?.case && m.row?.number === match.row?.number)) cur.matches.push(match);
    cur.rank = Math.min(cur.rank, rank);
    found.set(id, cur);
  };

  if (q) {
    // Exact-diacritic matches win ("narā" = a form); if the learner typed no marks, fall back to loose matching.
    const qExact = canonical(text).toLowerCase();
    const rows = index.byForm.get(q) || [];
    const exactRows = rows.filter((r) => canonical(r.form).toLowerCase() === qExact);
    for (const r of exactRows.length ? exactRows : rows) {
      const lemma = index.byId.get(r.id).lemma;
      if (canonical(lemma).toLowerCase() === qExact) add(r.id, { via: 'lemma' }, 1);      // the dictionary word itself
      else if (!exactRows.length && stripMarks(lemma) === q) continue;                      // "nara" typed without marks: not "narā"
      else add(r.id, { row: r, via: 'form' }, 0);
    }
    for (const e of index.lexicon) {
      const lem = stripMarks(e.lemma);
      if (lem === q) add(e.id, { via: 'lemma' }, 1);
      else if (lem.startsWith(q)) add(e.id, { via: 'lemma' }, 2);
      else if (e.meaning.some((m) => new RegExp(`(^|[^a-z])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(m.toLowerCase()))) add(e.id, { via: 'meaning' }, 3);
      else if (lem.includes(q) && q.length > 2) add(e.id, { via: 'lemma' }, 4);
    }
  } else if (focusCase) {
    for (const e of index.lexicon) if (e.pos === 'noun' || e.pos === 'adj') add(e.id, { via: 'lemma' }, 5);
  } else {
    for (const e of index.lexicon) add(e.id, { via: 'lemma' }, 6);
  }

  let results = [...found.values()];
  if (pos !== 'all') results = results.filter((r) => r.entry.pos === pos);
  if (lesson !== 'all') results = results.filter((r) => r.entry.lessons.includes(Number(lesson)));
  if (qCase && q) results = results.filter((r) => r.entry.pos === 'noun' || r.entry.pos === 'adj' || r.matches.some((m) => m.via === 'form'));
  results.sort((a, b) => a.rank - b.rank || a.entry.lemma.localeCompare(b.entry.lemma, 'pi'));
  return results.map((r) => ({ ...r, focus: { case: focusCase, number: qNumber } }));
}

/** Plain-language description of one analysis: “Locative singular”. */
export function describe(row) {
  if (!row) return '';
  if (row.kind === 'noun') return `${CASE_BY_ID[row.case].name} ${NUMBER_NAME[row.number]}`;
  if (row.kind === 'verb') return VERB_ROWS.find((v) => v.id === row.verbForm)?.label || '';
  return '';
}
