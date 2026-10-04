// Lesson page — the WHOLE lesson on one scrollable page, as in the original site:
//   header · sticky section tabs · revision · grammar · vocabulary · examples · exercises A/B · sidebar
// Practice (the three mastery levels) comes last, after the learner has read everything.
import { h, animate, clear, haptic, centerInStrip } from '../dom.js';
import { store, loadLesson, findLesson, applyProgress, refresh, isDone } from '../store.js';
import { api, sendProgress } from '../api.js';
import { icon } from '../ui/icons.js';
import { renderBlocks, speakBtn } from '../ui/blocks.js';
import { floatXp, celebrate, toast } from '../ui/fx.js';
import { checkAnswer, answerLang, acceptedFor } from '../engine/checker.js';
import { attachPali } from '../keyboard/pali-input.js';
import { levelsAvailable } from '../engine/quiz.js';
import { requireAccount } from '../session.js';

const WORD = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

export const sectionLabel = (id = '') => ({ revision: 'Revision', grammar: 'Grammar', vocabulary: 'Vocabulary', examples: 'Examples', 'exercise-a': 'Exercise A', 'exercise-b': 'Exercise B', practise: 'Practise' }[id] || (id.startsWith('grammar') ? 'Grammar' : id));

export default async function lessonPage({ id }, ctx) {
  const found = findLesson(id);
  if (!found) throw new Error('Lesson not found');
  const { chapter, lesson: meta } = found;
  const lesson = await loadLesson(id);
  const state = store.state;
  const mastery = state.lessons[id]?.mastery || 0;
  const levels = levelsAvailable(lesson);

  // ───────── sections (id → label → node) ─────────
  const sections = [];
  if (lesson.revision) sections.push({ id: 'revision', label: 'Revision', node: revisionSection(lesson.revision), step: 'revise' });
  (lesson.teach || []).forEach((t, i) => sections.push({
    id: i === 0 ? 'grammar' : `grammar-${i + 1}`, label: i === 0 ? 'Grammar' : (t.title || `Part ${i + 1}`),
    node: h('section.lsec', {}, renderBlocks(t.blocks)), step: `learn-sec-${i + 1}`,
  }));
  if (lesson.vocab?.length) sections.push({ id: 'vocabulary', label: 'Vocabulary', node: vocabSection(lesson, id), step: 'vocab' });
  if (lesson.examples?.length) sections.push({ id: 'examples', label: 'Examples', node: examplesSection(lesson), step: 'examples' });
  const exercises = (lesson.exercises || []).map((ex) => exerciseSection(lesson, ex, id));
  exercises.forEach((e, i) => sections.push({ id: `exercise-${lesson.exercises[i].id}`, label: `Exercise ${lesson.exercises[i].id.toUpperCase()}`, node: e.node }));
  if (levels.some((l) => l.ok)) sections.push({ id: 'practise', label: 'Practise', node: practiseSection() });

  const secEls = sections.map((s) => h('section.lblock', { id: `sec-${s.id}`, dataset: { sec: s.id, step: s.step || '' } }, s.node));

  // ───────── header ─────────
  const chapterDots = h('div.cdots', {}, chapter.lessons.map((l) => h('a.cdot' + (l.id === id ? '.cur' : '') + (isDone(l.id) ? '.done' : ''), { href: `#/lesson/${l.id}`, title: `Lesson ${l.number}: ${l.title}` }, ROMAN[l.number] || l.number)));
  const statusBox = h('div.lstatus', { 'aria-live': 'polite' });
  const strip = h('nav.lstrip', { 'aria-label': 'Lesson sections' }, sections.map((s) => h('a.ltab', { href: `#sec-${s.id}`, dataset: { sec: s.id }, onclick: (e) => { e.preventDefault(); scrollTo(s.id); } }, s.label)));
  const header = h('header.lheader', {},
    h('nav.crumbs', {}, h('a', { href: '#/learn' }, 'Lessons'), h('span', {}, '/'), h('a', { href: `#/chapter/${chapter.id}` }, `Chapter ${chapter.number}`), h('span', {}, '/'), `Lesson ${ROMAN[meta.number] || meta.number}`),
    h('p.eyebrow', {}, `Lesson ${WORD[meta.number] || meta.number}`), h('h1', {}, lesson.title),
    h('p.muted.lsub', {}, lesson.subtitle),
    h('div.lmeta', {}, h('span.time', {}, icon('ring', 16), `~${lesson.minutes} minutes`), ...(lesson.tags || []).filter((t) => !['New', 'Start', 'Active'].includes(t)).map((t) => h('span.vtag', {}, t))),
    chapterDots, statusBox);

  // ───────── sidebar ─────────
  const next = chapter.lessons.find((l) => l.number === meta.number + 1) || store.manifest.chapters.flatMap((c) => c.lessons).find((l) => l.number === meta.number + 1);
  const aside = h('aside.lside', {},
    lesson.reference?.length ? h('div.card.refcard', {}, h('p.eyebrow', {}, 'Reference'), h('table.suffix', {}, h('tbody', {}, lesson.reference.map((r) => h('tr', {}, h('td', {}, r.label), h('td.end', {}, r.ending), h('td.ex', {}, r.example)))))) : null,
    h('a.card.nextcard', { href: next && next.published ? `#/lesson/${next.id}` : `#/chapter/${chapter.id}` }, h('p.eyebrow', {}, next ? 'Ready for the next step?' : 'Chapter overview'),
      h('h3', {}, next ? `Lesson ${ROMAN[next.number] || next.number}` : 'Recap & mind map'), h('p.muted.small', {}, next ? next.title : chapter.title), icon('arrow', 20)));

  const root = h('div.lpage', {}, h('div.lmain', {}, header, strip, h('main.lsections', {}, secEls)), aside);
  renderStatus();

  // ───────── behaviour: scroll-spy, "read" XP, resume position ─────────
  function scrollTo(secId) { document.getElementById(`sec-${secId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  let current = null, posTimer;
  const seenSteps = new Set(), timers = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const sec = en.target.dataset.sec, step = en.target.dataset.step;
      if (en.isIntersecting) {
        if (sec !== current) {
          current = sec;
          strip.querySelectorAll('.ltab').forEach((t) => t.classList.toggle('active', t.dataset.sec === sec));
          centerInStrip(strip, strip.querySelector('.ltab.active'));
          clearTimeout(posTimer);
          posTimer = setTimeout(() => api('/api/progress', { method: 'POST', body: { type: 'position', lessonId: id, step: { section: sec } } }).catch(() => {}), 1500);
        }
        if (step && !seenSteps.has(step)) timers.set(step, setTimeout(async () => {          // stayed on this section ~1.5s → counts as read
          seenSteps.add(step);
          const res = await sendProgress({ type: 'step', lessonId: id, step }).catch(() => null);
          if (res) { applyProgress(res); if (res.xpAwarded) floatXp(strip, res.xpAwarded); }
        }, 1500));
      } else if (step) { clearTimeout(timers.get(step)); }
    }
  }, { rootMargin: '-20% 0px -55% 0px' });
  requestAnimationFrame(() => root.querySelectorAll('.lblock').forEach((b) => io.observe(b)));
  ctx.onLeave(() => { io.disconnect(); clearTimeout(posTimer); timers.forEach(clearTimeout); refresh().catch(() => {}); });

  // resume where the learner stopped (any device)
  const resumeSec = state.resume.lessonId === id ? state.resume.step?.section : null;
  if (resumeSec && sections.some((s) => s.id === resumeSec) && resumeSec !== sections[0].id) setTimeout(() => scrollTo(resumeSec), 450);
  return root;

  // ───────── "what completes this lesson" (60% on each exercise — the same rule the server uses) ─────────
  function renderStatus() {
    clear(statusBox);
    if (store.state.lessons[id]?.status === 'completed') {
      statusBox.append(h('p.lstatus-done', {}, icon('check', 16), 'Lesson complete. Your progress is saved.'));
      return;
    }
    statusBox.append(h('p.lstatus-title', {}, 'To complete this lesson, score 60% on each exercise:'),
      h('div.lstatus-items', {}, (lesson.exercises || []).map((ex) => {
        const r = store.state.exercises[`${id}.${ex.id}`];
        const need = Math.ceil(ex.items.length * 0.6);
        const ok = r && r.best >= need;
        return h('a.lstatus-item' + (ok ? '.ok' : ''), { href: `#sec-exercise-${ex.id}`, onclick: (e) => { e.preventDefault(); scrollTo(`exercise-${ex.id}`); } },
          ok ? icon('check', 14) : h('span.dot'), `Exercise ${ex.id.toUpperCase()}`,
          h('small', {}, r ? `${r.best} / ${ex.items.length}${ok ? '' : ` · need ${need}`}` : `need ${need} of ${ex.items.length}`));
      })));
  }

  function practiseSection() {
    return h('section.lsec.practise', {}, h('p.eyebrow', {}, 'Practise'), h('h2', {}, 'Make it ', h('em', {}, 'stick')),
      h('p.muted', {}, 'You have read the lesson. Three short rounds help you remember it. Each one repeats any answer you miss until you get it right.'),
      h('div.plevels', {}, levels.map((l) => {
        const passed = mastery >= l.level;
        return h(l.ok ? 'a.plevel' : 'div.plevel.off', { href: l.ok ? `#/quiz/${id}/${l.level}` : null },
          h('span.pl-n' + (passed ? '.passed' : ''), {}, passed ? icon('check', 16) : l.level),
          h('span.pl-t', {}, h('strong', {}, `Level ${l.level} · ${l.name}`), h('small', {}, l.desc)),
          h('span.pl-go', {}, passed ? h('span.pl-badge', {}, 'Passed') : l.ok ? h('span.pl-badge.start', {}, 'Start') : icon('lock', 16)));
      })));
  }

  // ───────── section builders ─────────
  function revisionSection(r) {
    return h('section.lsec.revision', {}, h('p.eyebrow', {}, 'Before we begin'), h('h2', { html: r.title }), h('p', { html: r.summaryHtml }),
      r.connectionHtml ? h('div.blk.callout', {}, icon('sparkle', 20), h('p', { html: r.connectionHtml })) : null,
      r.questions.length ? h('p.eyebrow.tight', {}, 'Tap to reveal answers') : null,
      h('div.qa', {}, r.questions.map((q) => { const c = h('button.qa-card', { type: 'button', 'aria-expanded': 'false', onclick: () => { c.classList.toggle('open'); c.setAttribute('aria-expanded', c.classList.contains('open')); } }, h('span.qa-q', { html: q.q }), h('span.qa-a', { html: q.a })); return c; })));
  }

  function vocabSection(l, lessonId) {
    const groups = new Map();
    for (const v of l.vocab) { if (!groups.has(v.group)) groups.set(v.group, []); groups.get(v.group).push(v); }
    return h('section.lsec', {}, h('div.lsec-head', {}, h('div', {}, h('p.eyebrow', {}, `Lesson ${ROMAN[l.number] || l.number}`), h('h2', {}, h('em', {}, 'Vocabulary'))),
      h('div.lsec-actions', {}, h('a.btn.btn-ghost.btn-sm', { href: `#/review/${lessonId}` }, icon('cards', 16), 'Practise with flashcards'), h('a.btn.btn-ghost.btn-sm', { href: '#/vocab' }, icon('book', 16), 'Search all words'))),
      h('div.vocab-cols', {}, [...groups].map(([name, words]) => h('div.vcol', {}, h('h3.group', {}, name),
        words.map((w) => h('a.vrow', { href: `#/vocab/${encodeURIComponent(w.pali[0])}`, title: 'See all forms of this word' }, h('span.vp.pali', {}, w.pali.join(' / ')), h('span.ve', {}, w.english.join(', ')), speakBtn(w.pali.join(', '), 16)))))));
  }

  function examplesSection(l) {
    return h('section.lsec', {}, h('p.eyebrow', {}, 'Examples'), h('h2', {}, 'Seen in ', h('em', {}, 'sentences')),
      h('div.pairs', {}, l.examples.map((e) => h('div.pair', {}, h('div.pair-pali', {}, h('span.pali', { html: e.pali }), speakBtn(e.pali.replace(/<[^>]+>/g, ''))), h('div.pair-en', {}, e.english)))));
  }

  // ───────── in-page exercises: a ✓ per item, Check all, Reset, live score ─────────
  function exerciseSection(l, ex, lessonId) {
    const lang = answerLang(ex.kind);
    const exId = `${lessonId}.${ex.id}`;
    const results = new Map();                 // index → correct?
    let submittedCorrect = -1, submitTimer, startedAt = Date.now();
    const score = h('strong', {}, '—');
    const status = h('p.ex-status.small.muted');
    const prevBest = state.exercises[exId];

    const rows = ex.items.map((it, i) => {
      const input = h('input.ex-input', { type: 'text', placeholder: lang === 'pali' ? 'Your Pāli…' : 'Translation…', 'aria-label': `Answer ${i + 1}` });
      if (lang === 'pali') attachPali(input);
      const fb = h('div.ex-fb', { 'aria-live': 'polite' });
      const row = h('div.exrow', {}, h('div.exrow-top', {},
        h('span.exn', {}, i + 1),
        h('span.exsrc', { class: lang === 'english' ? 'pali' : '' }, it.prompt, lang === 'english' ? speakBtn(it.prompt, 16) : null),
        h('div.exin', {}, input, h('button.excheck', { type: 'button', 'aria-label': `Check answer ${i + 1}`, onclick: () => check(i) }, icon('arrow', 18)))), fb);
      input.addEventListener('focus', () => { if (!requireAccount()) input.blur(); });     // guests: sign in when they start answering
      input.addEventListener('input', () => { row.classList.remove('good', 'bad'); input.classList.remove('good', 'bad'); fb.className = 'ex-fb'; fb.textContent = ''; results.delete(i); paint(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(i); input.closest('.exrow').nextElementSibling?.querySelector('.ex-input')?.focus(); } });
      return { it, input, fb, row };
    });

    function check(i) {
      if (!requireAccount()) return;
      const { it, input, fb, row } = rows[i];
      if (!input.value.trim()) { animate(input, [{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200 }); return; }
      const res = checkAnswer(input.value, acceptedFor(it), lang, { strict: false });
      results.set(i, res.correct);
      row.classList.remove('good', 'bad'); row.classList.add(res.correct ? 'good' : 'bad'); input.classList.add(res.correct ? 'good' : 'bad');
      clear(fb);
      if (res.correct) fb.append(...[icon('check', 16), h('span', {}, res.exact ? 'Correct!' : 'Correct — mind the marks: '), res.exact ? null : h('strong.pali', {}, res.expected)].filter(Boolean));
      else { fb.append(icon('x', 16), h('span', {}, 'Answer: '), h('strong', { class: lang === 'pali' ? 'pali' : '' }, res.expected)); haptic([15, 30, 15]); }
      fb.className = 'ex-fb show ' + (res.correct ? 'good' : 'bad');
      animate(fb, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
      paint();
      queueSubmit();
    }
    function paint() {
      const correct = [...results.values()].filter(Boolean).length;
      score.textContent = results.size ? `${correct} / ${ex.items.length}` : '—';
    }
    function checkAll() { if (!requireAccount()) return; rows.forEach((_, i) => { if (rows[i].input.value.trim()) check(i); }); if (![...rows].some((r) => r.input.value.trim())) toast('Type an answer first', { icon: 'keyboard' }); }
    function reset() { rows.forEach(({ input, fb, row }, i) => { input.value = ''; input.classList.remove('good', 'bad'); row.classList.remove('good', 'bad'); fb.className = 'ex-fb'; fb.textContent = ''; }); results.clear(); submittedCorrect = -1; startedAt = Date.now(); status.textContent = ''; paint(); }

    // Once every item is answered, save the score (server keeps your best and awards XP for new best answers only).
    function queueSubmit() { clearTimeout(submitTimer); if (results.size === ex.items.length) submitTimer = setTimeout(submit, 450); }
    async function submit() {
      const correct = [...results.values()].filter(Boolean).length;
      if (correct === submittedCorrect) return;
      submittedCorrect = correct;
      let res = null;
      try { res = await sendProgress({ type: 'exercise', exerciseId: exId, correct, seconds: Math.round((Date.now() - startedAt) / 1000) }); } catch (e) { toast(e.message, { tone: 'bad' }); return; }
      if (!res) { status.textContent = 'Saved on this device. It will sync when you are back online.'; return; }
      applyProgress(res);
      const prevRec = store.state.exercises[exId];
      store.state.exercises[exId] = { best: Math.max(correct, prevRec?.best || 0), total: ex.items.length };
      renderStatus();
      status.textContent = res.xpAwarded ? `Saved · +${res.xpAwarded} XP` : `Saved · best ${Math.max(correct, prevBest?.best || 0)} / ${ex.items.length}`;
      if (res.xpAwarded) floatXp(score, res.xpAwarded);
      if (res.lessonCompleted) { await refresh().catch(() => {}); renderStatus(); }
      if (res.lessonCompleted || res.chapterCompleted || res.newAchievements?.length) {
        const ch = res.chapterCompleted ? store.manifest.chapters.find((c) => c.id === res.chapterCompleted) : null;
        celebrate({ title: ch ? `Chapter ${ch.number} <em>complete</em>` : res.lessonCompleted ? `Lesson ${l.number} <em>complete</em>` : 'Achievement <em>unlocked</em>', subtitle: ch ? ch.title : l.title, xp: res.xpAwarded, badges: res.newAchievements || [],
          rows: [{ label: 'Streak', value: `${res.streak} day${res.streak === 1 ? '' : 's'}` }, { label: 'Level', value: res.level }], cta: 'Continue' });
      } else if (res.levelUp) toast(`Level ${res.levelUp} reached`, { icon: 'star' });
    }

    const node = h('section.lsec.exsec', {}, h('div.exhead', {}, h('div', {}, h('p.eyebrow', {}, `Exercise ${ex.id.toUpperCase()}`), h('p.exinstr', {}, ex.instruction)), h('p.exscore', {}, 'Score: ', score)),
      h('div.exlist', {}, rows.map((r) => r.row)),
      h('div.exactions', {}, h('button.btn.btn-primary', { type: 'button', onclick: checkAll }, 'Check all'), h('button.btn.btn-ghost', { type: 'button', onclick: reset }, 'Reset')), status);
    if (prevBest) status.textContent = `Your best: ${prevBest.best} / ${prevBest.total}`;
    return { node };
  }
}
