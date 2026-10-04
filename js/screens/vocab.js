// Vocabulary — search any word (dictionary form, ANY inflected form, or English) and see its meaning,
// its lessons and every grammatical form. Searching "narasmiṃ" answers: nara · man · locative singular.
import { h, clear, animate } from '../dom.js';
import { store, loadLexicon, loadAllLessons, loadJson, findLesson } from '../store.js';
import { icon } from '../ui/icons.js';
import { speakBtn } from '../ui/blocks.js';
import { attachPali } from '../keyboard/pali-input.js';
import { stripMarks, canonical } from '../keyboard/map.js';
import { CASES, CASE_BY_ID, NUMBER_NAME, VERB_ROWS, nounForms, verbForms, buildIndex, search, describe } from '../engine/morph.js';

const POS_LABEL = { noun: 'noun', verb: 'verb', adj: 'adjective', other: 'word' };
const GENDER_LABEL = { m: 'masculine', n: 'neuter' };
const MAX_RESULTS = 40;
const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export default async function vocab({ q = '' } = {}) {
  const [lexicon, lessons] = await Promise.all([loadLexicon(), loadAllLessons()]);
  const index = buildIndex(lexicon);
  const corpus = buildCorpus(lessons);
  const state = { text: decodeURIComponent(q), pos: 'all', lesson: 'all', kase: null, open: new Set() };

  const input = attachPali(h('input.vocab-input', { type: 'search', value: state.text, placeholder: 'Search a Pāli word, any form of it, or English…', 'aria-label': 'Search vocabulary', enterkeyhint: 'search' }));
  const clearBtn = h('button.icon-btn.clear', { type: 'button', 'aria-label': 'Clear search', hidden: !state.text, onclick: () => { input.value = ''; state.text = ''; input.focus(); run(); } }, icon('x', 20));
  const results = h('div.vocab-results', { 'aria-live': 'polite' });
  const summary = h('p.vocab-summary.muted.small');

  const chips = (items, key, empty = 'all') => h('div.fchips', {}, items.map(([val, label]) => {
    const b = h('button.fchip', { type: 'button', 'aria-pressed': String(state[key] === val), onclick: () => { state[key] = state[key] === val && val !== empty ? (key === 'kase' ? null : empty) : val; paintChips(); run(); } }, label);
    b.dataset.key = key; b.dataset.val = String(val);
    return b;
  }));
  const posChips = chips([['all', 'All'], ['noun', 'Nouns'], ['verb', 'Verbs'], ['adj', 'Adjectives']], 'pos');
  const caseChips = chips(CASES.map((c) => [c.id, c.abbr.replace('.', '')]), 'kase', null);
  const lessonSel = h('select.sel.vocab-lesson', { 'aria-label': 'Filter by lesson', onchange: (e) => { state.lesson = e.target.value; run(); } },
    h('option', { value: 'all' }, 'All lessons'),
    ...store.manifest.chapters.flatMap((c) => c.lessons.filter((l) => l.published).map((l) => h('option', { value: l.number }, `Lesson ${roman[l.number] || l.number} · ${l.title}`))));

  function paintChips() {
    for (const b of [...posChips.children, ...caseChips.children]) b.setAttribute('aria-pressed', String(state[b.dataset.key] === (b.dataset.val === 'null' ? null : b.dataset.val)));
  }

  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.text = input.value; clearBtn.hidden = !state.text; run(); }, 130); });

  function run() {
    const hasQuery = state.text.trim().length > 0;
    const list = search(index, state.text, { pos: state.pos, lesson: state.lesson, kase: state.kase });
    clear(results);
    if (!hasQuery && !state.kase) {
      summary.textContent = `${list.length} words from ${lessons.length} lessons. Tap a word to see all its forms.`;
      results.append(...browse(list));
      return;
    }
    summary.textContent = list.length ? `${list.length} word${list.length === 1 ? '' : 's'} found${list.length > MAX_RESULTS ? ` — showing the first ${MAX_RESULTS}` : ''}` : '';
    if (!list.length) {
      results.append(h('div.empty', {}, icon('book', 44), h('h3', {}, 'No word found'), h('p.muted', {}, `Nothing matches “${state.text}”. Try the dictionary form (e.g. nara), another form (narasmiṃ) or an English word (man).`)));
      return;
    }
    const auto = list.length <= 3;
    list.slice(0, MAX_RESULTS).forEach((r, i) => results.append(card(r, { open: auto || state.open.has(r.entry.id), animateIn: i < 8 })));
  }

  // Browse: grouped by lesson, like the original glossary.
  function browse(list) {
    const groups = new Map();
    for (const r of list) for (const n of r.entry.lessons.slice(0, 1)) { if (!groups.has(n)) groups.set(n, []); groups.get(n).push(r); }
    return [...groups.keys()].sort((a, b) => a - b).map((n) => {
      const info = store.manifest.chapters.flatMap((c) => c.lessons).find((l) => l.number === n);
      return h('section.vgroup', {}, h('div.vgroup-title', {}, h('h2', {}, `Lesson ${roman[n] || n}`), h('span', {}, info?.title || '')),
        h('div.vgrid', {}, groups.get(n).map((r) => card(r, { open: state.open.has(r.entry.id), compact: true }))));
    });
  }

  function card(r, { open = false, compact = false, animateIn = false } = {}) {
    const e = r.entry;
    const formHits = r.matches.filter((m) => m.via === 'form');
    const el = h('article.vcard' + (open ? '.open' : '') + (compact ? '.compact' : ''), { dataset: { id: e.id } });
    const head = h('button.vcard-head', { type: 'button', 'aria-expanded': String(open), onclick: () => { const o = el.classList.toggle('open'); head.setAttribute('aria-expanded', String(o)); o ? state.open.add(e.id) : state.open.delete(e.id); if (o && !el.querySelector('.vdetail')) el.append(detail(r)); } },
      h('span.vlemma', {}, e.lemma), h('span.vtags', {}, h('span.vtag', {}, posText(e)), ...e.lessons.map((n) => h('span.vtag.lesson', {}, `L${n}`))),
      h('span.vmeaning', {}, e.meaning.join(', ')), icon('chevron', 18, 'vchev'));
    el.append(head);
    if (formHits.length) el.append(matchBanner(e, formHits));
    if (r.focus.case && (e.pos === 'noun' || e.pos === 'adj')) el.append(focusLine(e, r.focus));
    if (open) el.append(detail(r));
    if (animateIn) animate(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
    return el;
  }

  const posText = (e) => (e.pos === 'noun' || e.pos === 'adj') && e.gender ? `${GENDER_LABEL[e.gender]} ${POS_LABEL[e.pos]}` : POS_LABEL[e.pos];

  /** “narasmiṃ — locative singular of nara (man)” */
  function matchBanner(e, hits) {
    const byForm = new Map();
    for (const m of hits) { if (!byForm.has(m.row.form)) byForm.set(m.row.form, []); byForm.get(m.row.form).push(describe(m.row)); }
    return h('div.vmatch', {}, [...byForm].map(([form, names]) => h('p', {}, icon('sparkle', 16), h('span.pali.big', {}, form), ' is the ', h('strong', {}, names.join(' · ')), ' of ', h('strong.pali', {}, e.lemma), ' — “', e.meaning[0], '”',
      names.length > 1 ? h('small.muted', {}, ' (several readings are possible; context decides)') : null)));
  }

  function focusLine(e, focus) {
    const t = nounForms(e.lemma, e.gender || 'm')[focus.case];
    const parts = ['sg', 'pl'].filter((n) => !focus.number || focus.number === n).map((n) => h('span', {}, h('small', {}, `${NUMBER_NAME[n]} `), h('span.pali', {}, t[n].map((f) => f.form).join(' / '))));
    return h('p.vfocus', {}, h('strong', {}, CASE_BY_ID[focus.case].name), ': ', parts.flatMap((p, i) => (i ? [' · ', p] : [p])));
  }

  function detail(r) {
    const e = r.entry;
    const hits = new Set(r.matches.filter((m) => m.via === 'form').map((m) => `${m.row.case}|${m.row.number}|${m.row.form}|${m.row.verbForm || ''}`));
    const body = h('div.vdetail', {},
      h('div.vtop', {}, speakBtn(e.lemma, 20), h('p.muted', {}, e.lessons.map((n) => { const li = store.manifest.chapters.flatMap((c) => c.lessons).find((l) => l.number === n); return li ? h('a.lesson-link', { href: `#/lesson/${li.id}` }, `Lesson ${roman[n] || n}`) : `Lesson ${n}`; })
        .flatMap((x, i) => (i ? [' · ', x] : [x])))),
      e.note ? h('p.small.muted', {}, e.note) : null,
      e.pos === 'noun' || e.pos === 'adj' ? nounTable(e, r) : e.pos === 'verb' ? verbTable(e, hits) : null,
      examples(e));
    return body;
  }

  function nounTable(e, r) {
    const t = nounForms(e.lemma, e.gender || 'm');
    const hit = (c, n, f) => r.matches.some((m) => m.via === 'form' && m.row.case === c && m.row.number === n && m.row.form === f);
    const tbl = h('div.tbl-wrap', {}, h('table.tbl.forms', {},
      h('caption', {}, `${e.lemma} — ${e.meaning[0]} (${e.gender === 'n' ? 'neuter' : 'masculine'} in -a)`),
      h('thead', {}, h('tr', {}, h('th', {}, 'Case'), h('th', {}, 'Singular'), h('th', {}, 'Plural'))),
      h('tbody', {}, CASES.map((c) => h('tr', { class: r.focus.case === c.id ? 'focus-row' : '' },
        h('td', {}, h('strong', {}, c.name), h('small', {}, `${c.job} · L${c.lesson}`)),
        ...['sg', 'pl'].map((n) => h('td', {}, t[c.id][n].map((f, i) => h('span', { class: 'form' + (hit(c.id, n, f.form) ? ' hit' : '') + (f.archaic ? ' archaic' : ''), title: f.archaic ? 'archaic alternative' : '' }, f.form, i < t[c.id][n].length - 1 ? ' / ' : '')))))))));
    const wrap = h('div', {}, tbl);
    if (e.pos === 'adj') wrap.append(h('p.small.muted', {}, `As an adjective it agrees with its noun. Neuter: ${nounForms(e.lemma, 'n').nom.sg[0].form} (nom./acc. sg.), ${nounForms(e.lemma, 'n').nom.pl[0].form} (pl.).`));
    return wrap;
  }

  function verbTable(e, hits) {
    const v = verbForms(e.lemma, e.irregular || {});
    const rowsData = VERB_ROWS.map((vr) => {
      const forms = vr.id === 'pres-sg' ? v.present.sg : vr.id === 'pres-pl' ? v.present.pl : vr.id === 'participle' ? v.participle : v[vr.id];
      return { vr, forms };
    });
    return h('div.tbl-wrap', {}, h('table.tbl.forms', {}, h('caption', {}, `${e.lemma} — ${e.meaning.join(', ')} (verb)`),
      h('thead', {}, h('tr', {}, h('th', {}, 'Form'), h('th', {}, 'Pāli'))),
      h('tbody', {}, rowsData.map(({ vr, forms }) => h('tr', {}, h('td', {}, h('strong', {}, vr.label), h('small', {}, `${vr.hint} · L${vr.lesson}`)),
        h('td', {}, forms.length ? forms.map((f, i) => h('span', { class: 'form' + ([...hits].some((k) => k.endsWith(`|${f}|${vr.id}`)) ? ' hit' : '') }, f, i < forms.length - 1 ? ' / ' : '')) : h('span.muted', {}, '—')))))));
  }

  function examples(e) {
    const forms = new Set((index.rowsById.get(e.id) || []).map((r) => stripMarks(r.form)));
    const hits = [];
    for (const s of corpus) {
      const tokens = s.tokens;
      if (tokens.some((t) => forms.has(t))) { hits.push(s); if (hits.length >= 3) break; }
    }
    if (!hits.length) return h('p.small.muted.noex', {}, 'No example sentence in the lessons yet.');
    return h('div.vex', {}, h('p.eyebrow.tight', {}, 'In the lessons'),
      hits.map((s) => h('a.vex-row', { href: `#/lesson/${s.lessonId}` }, h('span.vex-pali', { html: highlight(s.pali, forms) }), h('span.vex-en', {}, s.english), h('small', {}, `Lesson ${roman[s.lesson] || s.lesson}`))));
  }

  const page = h('div.page.vocab', {},
    h('header.vhead', {}, h('p.eyebrow', {}, 'Master glossary'), h('h1', {}, 'Expand your ', h('em', {}, 'Lexicon')),
      h('p.muted', {}, 'Every Pāli word in the course. Search a word, any inflected form of it, or its English meaning, and see all its grammatical forms and which lesson it comes from.')),
    h('div.vsearch', {}, h('div.vsearch-box', {}, icon('book', 20), input, clearBtn)),
    h('div.vfilters', {}, posChips,
      h('div.vfilter-row', {}, h('span.small.muted', {}, 'Highlight case:'), caseChips), lessonSel,
      h('p.vhint.small.muted', {}, 'Try: ', ...['narasmiṃ', 'gantvā', 'man', 'nara locative', 'phalāni'].flatMap((x, i) => [i ? ' · ' : '', h('button.link', { type: 'button', onclick: () => { input.value = x; state.text = x; clearBtn.hidden = false; run(); } }, x)]))),
    summary, results, await alphabet());
  paintChips();
  run();
  return page;
}

// ───────── helpers ─────────
function buildCorpus(lessons) {
  const out = [];
  const strip = (s) => s.replace(/<[^>]+>/g, '');
  const tok = (s) => strip(s).split(/[^\p{L}]+/u).filter(Boolean).map(stripMarks);
  const add = (lesson, pali, english) => { if (pali && english) out.push({ lesson: lesson.number, lessonId: lesson.id, pali: strip(pali), english: strip(english), tokens: tok(pali) }); };
  for (const l of lessons) {
    for (const x of l.examples || []) add(l, x.pali, x.english);
    for (const s of l.sentences || []) add(l, s.dir === 'p2e' ? s.pali[0] : s.pali[0], s.english[0]);
    for (const ex of l.exercises || []) for (const it of ex.items) ex.kind === 'to_english' ? add(l, it.prompt, it.answer) : add(l, it.answer, it.prompt);
  }
  return out;
}

function highlight(pali, forms) {
  return pali.replace(/[\p{L}]+/gu, (w) => (forms.has(stripMarks(w)) ? `<mark>${w}</mark>` : w));
}

async function alphabet() {
  const data = await loadJson('content/alphabet.json').catch(() => null);
  if (!data) return h('div');
  return h('section.alphabet.card', {}, h('p.eyebrow', {}, 'Quick reference'), h('h2', {}, 'The Pāli alphabet'),
    data.groups.map((g) => h('div.agroup', {}, h('h4', {}, g.name), h('div.arow', {}, g.letters.map(([l, kind]) => h('div.acell', {}, h('span.pali', {}, l), h('small', {}, kind))))) ),
    h('p.muted.small', {}, data.note));
}
