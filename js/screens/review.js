// Flashcards — the original feature set, now with saved progress:
//   mode (Pāli→English / English→Pāli) · filter by lesson · New/Learning/Familiar/Mastered stats ·
//   flip, "Didn't know" / Skip / "Got it!" · keyboard shortcuts (Space flip · 1/← no · 2/→ yes · 3/↓ skip)
// Words you struggle with come first; mastered words fade to the back. Results sync via the review API.
import { h, animate, clear } from '../dom.js';
import { store, loadLexicon, applyProgress, refresh } from '../store.js';
import { api, sendProgress } from '../api.js';
import { icon } from '../ui/icons.js';
import { speakBtn } from '../ui/blocks.js';
import { celebrate } from '../ui/fx.js';
import { shuffle } from '../engine/quiz.js';

const LEVELS = { new: '🌱 New', learning: '🌿 Learning', familiar: '🌳 Familiar', mastered: '💎 Mastered' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export default async function flashcards({ lesson: lessonParam } = {}, ctx) {
  const [lexicon, { words }] = await Promise.all([loadLexicon(), api('/api/vocab')]);
  const prog = Object.fromEntries(words.map((w) => [w.word, w]));
  const today = store.state.today.date;
  const allLessonsList = store.manifest.chapters.flatMap((c) => c.lessons);
  // "My lessons" = every lesson the learner has opened. A beginner starts with their own words, not all 145.
  const started = new Set(Object.keys(store.state.lessons).map((id) => allLessonsList.find((l) => l.id === id)?.number).filter(Boolean));
  const startLesson = lessonParam ? (allLessonsList.find((l) => l.id === lessonParam)?.number ?? 'all') : started.size ? 'mine' : 1;

  const st = { mode: 'p-e', filter: startLesson, deck: [], i: 0, pending: [], flipped: false };
  const level = (e) => prog[e.id]?.level || 'new';

  const stats = h('div.fc-stats', {});
  const modeSel = h('select.sel.fc-mode', { 'aria-label': 'Study direction', onchange: (e) => { st.mode = e.target.value; build(); } },
    h('option', { value: 'p-e' }, 'Pāli → English'), h('option', { value: 'e-p' }, 'English → Pāli'));
  const filterRow = h('div.fchips', {});
  const arena = h('div.fc-arena');
  const page = h('div.page.review', {}, h('h1', {}, 'Vocabulary ', h('em', {}, 'Flashcards')),
    h('p.muted.fc-intro', {}, 'Words you struggle with come back more often; words you master fade to the back.'),
    h('div.fc-controls', {}, modeSel), filterRow, arena, stats);           // the card comes first; stats follow

  function paintFilters() {
    clear(filterRow);
    const mk = (val, label) => h('button.fchip', { type: 'button', 'aria-pressed': String(st.filter === val), onclick: () => { st.filter = val; paintFilters(); build(); } }, label);
    filterRow.append(...(started.size ? [mk('mine', 'My lessons')] : []), mk('all', 'All words'), ...store.manifest.chapters.flatMap((c) => c.lessons).filter((l) => l.published).map((l) => mk(l.number, `Lesson ${ROMAN[l.number] || l.number}`)));
  }

  const inScope = () => lexicon.filter((e) => st.filter === 'all' || (st.filter === 'mine' ? e.lessons.some((n) => started.has(n)) : e.lessons.includes(st.filter)));

  function paintStats() {
    const scope = inScope();
    const c = { new: 0, learning: 0, familiar: 0, mastered: 0 };
    scope.forEach((e) => c[level(e)]++);
    clear(stats).append(...[['Total words', scope.length], ['🌱 New', c.new], ['🌿 Learning', c.learning], ['🌳 Familiar', c.familiar], ['💎 Mastered', c.mastered]]
      .map(([l, n]) => h('div.fc-stat', {}, h('strong', {}, n), h('small', {}, l))));
  }

  function build() {
    flush();
    const rank = (e) => { const p = prog[e.id]; if (!p) return 0; if (p.nextReview && p.nextReview <= today) return 1; return p.level === 'mastered' ? 3 : 2; };
    st.deck = shuffle(inScope()).sort((a, b) => rank(a) - rank(b));       // new + due first, mastered last
    st.i = 0;
    paintStats();
    show();
  }

  function show() {
    clear(arena);
    if (!st.deck.length) {
      arena.append(h('div.empty', {}, icon('check', 44), h('h3', {}, 'No new words in this lesson'),
        h('p.muted', {}, 'This lesson practises endings you already know (for example narassa, narānaṃ, narasmiṃ, naresu) rather than new words.'),
        h('a.btn.btn-ghost', { href: '#/vocab/nara' }, icon('book', 16), 'See every form of nara')));
      return;
    }
    const e = st.deck[st.i % st.deck.length];
    const front = st.mode === 'p-e' ? { text: e.lemma, pali: true } : { text: e.meaning.join(', '), pali: false };
    const back = st.mode === 'p-e' ? { text: e.meaning.join(', '), pali: false } : { text: e.lemma, pali: true };
    st.flipped = false;
    const card = h('button.rcard', { type: 'button', 'aria-label': 'Reveal the answer', onclick: flip },
      h('div.rcard-face.front', {}, h('span.big' + (front.pali ? '.pali' : ''), {}, front.text), front.pali ? speakBtn(e.lemma, 22) : null, h('small.muted', {}, 'Tap to reveal'), h('small.fc-mastery', {}, LEVELS[level(e)])),
      h('div.rcard-face.back', {}, h('span.big' + (back.pali ? '.pali' : ''), {}, back.text), h('small.muted', {}, `Lesson ${ROMAN[e.lessons[0]] || e.lessons[0]}`), h('a.small', { href: `#/vocab/${encodeURIComponent(e.lemma)}`, onclick: (ev) => ev.stopPropagation() }, 'See all forms →')));
    const actions = h('div.fc-actions', {}, h('button.btn.btn-ghost.grow', { type: 'button', onclick: () => answer(false) }, '✗ Didn’t know'), h('button.btn.btn-ghost', { type: 'button', onclick: skip }, 'Skip →'), h('button.btn.btn-primary.grow', { type: 'button', onclick: () => answer(true) }, '✓ Got it!'));
    arena.append(h('div.rev-progress', {}, h('i', { style: { width: `${(st.i / st.deck.length) * 100}%` } })), h('p.fc-counter.muted.small.center', {}, `${st.i + 1} / ${st.deck.length}`), card, actions,
      h('p.muted.small.center.fc-keys', {}, 'Keys: Space flip · 1 / ← didn’t know · 2 / → got it · 3 / ↓ skip'));
    animate(card, [{ opacity: 0, transform: 'scale(.95) translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
  }

  const flip = () => { arena.querySelector('.rcard')?.classList.toggle('flipped'); st.flipped = !st.flipped; };
  const skip = () => { st.i = (st.i + 1) % Math.max(1, st.deck.length); show(); };

  function answer(correct) {
    if (!st.deck.length) return;
    const e = st.deck[st.i % st.deck.length];
    st.pending.push({ word: e.id, correct });
    // optimistic local mastery so the stats update immediately
    const p = prog[e.id] || (prog[e.id] = { word: e.id, level: 'new', streak: 0 });
    p.streak = correct ? (p.streak || 0) + 1 : 0;
    p.level = p.streak >= 5 ? 'mastered' : p.streak >= 3 ? 'familiar' : (correct || p.level !== 'new') ? 'learning' : 'new';
    if (st.pending.length >= 5) flush();
    st.i++;
    if (st.i >= st.deck.length) { flush(true); build(); return; }
    paintStats(); show();
  }

  let flushing = false;
  async function flush(celebrateIt = false) {
    if (!st.pending.length || flushing) return;
    const batch = st.pending.splice(0); flushing = true;
    try {
      const res = await sendProgress({ type: 'review', results: batch });
      if (res) { applyProgress(res); if (celebrateIt && (res.newAchievements?.length || res.xpAwarded)) celebrate({ title: 'Session <em>complete</em>', subtitle: 'Flashcards', xp: res.xpAwarded, badges: res.newAchievements || [], cta: 'Keep going' }); }
    } catch { st.pending.unshift(...batch); } finally { flushing = false; }
  }

  const onKey = (ev) => {
    if (!page.isConnected) return document.removeEventListener('keydown', onKey);
    if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); flip(); }
    else if (ev.key === '1' || ev.key === 'ArrowLeft') answer(false);
    else if (ev.key === '2' || ev.key === 'ArrowRight') answer(true);
    else if (ev.key === '3' || ev.key === 'ArrowDown') skip();
  };
  document.addEventListener('keydown', onKey);
  ctx?.onLeave(() => { document.removeEventListener('keydown', onKey); flush(); refresh().catch(() => {}); });

  paintFilters(); build();
  return page;
}
