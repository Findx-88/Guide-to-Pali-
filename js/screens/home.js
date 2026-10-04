import { h } from '../dom.js';
import { store, findLesson, isDone } from '../store.js';
import { api } from '../api.js';
import { icon } from '../ui/icons.js';
import { ring, weekStrip, greeting } from '../ui/widgets.js';
import { sectionLabel } from './lesson-page.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

export default async function home() {
  const s = store.state;
  const goal = s.profile.dailyGoal;
  const pct = Math.min(1, s.today.xp / goal);
  const left = Math.max(0, goal - s.today.xp);

  // ── Today's plan: one card, numbered steps, one main button ──
  const resumeId = s.resume.lessonId;
  const hasWords = Object.keys(s.lessons).length > 0;
  const steps = [];
  let primary;
  if (resumeId) {
    const { lesson } = findLesson(resumeId);
    const started = !!s.lessons[resumeId];
    const sec = s.resume.step?.section;
    steps.push({ href: `#/lesson/${resumeId}`, title: `Lesson ${ROMAN[lesson.number] || lesson.number} · ${lesson.title}`,
      note: started ? (sec ? `Continue at ${sectionLabel(sec)}` : 'Pick up where you left off') : `About ${lesson.minutes} minutes`, minutes: lesson.minutes });
    primary = { href: `#/lesson/${resumeId}`, label: started ? `Continue Lesson ${ROMAN[lesson.number] || lesson.number}` : `Start Lesson ${ROMAN[lesson.number] || lesson.number}` };
  }
  const reviewNote = h('small', {}, 'About 2 minutes');
  if (hasWords || !resumeId) steps.push({ href: '#/review', title: 'Review your words', note: reviewNote, minutes: 2 });
  if (!primary) primary = { href: '#/review', label: 'Review your words' };
  const minutes = steps.reduce((n, st) => n + st.minutes, 0);

  const plan = h('section.card.plan', {},
    h('div.plan-head', {}, h('p.eyebrow', {}, s.today.goalMet ? 'Today’s goal is met — keep going if you like' : 'Today’s plan'), h('span.muted.small', {}, `≈ ${minutes} min`)),
    resumeId ? null : h('p.muted', {}, 'Every available lesson is complete. Keep your words fresh while new lessons are written.'),
    h('ol.plan-steps', {}, steps.map((st, i) => h('li', {}, h('a', { href: st.href }, h('span.plan-n', {}, i + 1), h('span.plan-t', {}, h('strong', {}, st.title), typeof st.note === 'string' ? h('small', {}, st.note) : st.note), icon('chevron', 18))))),
    h('a.btn.btn-primary.btn-block', { href: primary.href }, primary.label, icon('arrow', 18)));

  // fill in how many words are due (loads in the background)
  api('/api/vocab').then(({ words }) => {
    const due = words.filter((w) => w.nextReview && w.nextReview <= s.today.date).length;
    reviewNote.textContent = due ? `${due} word${due === 1 ? '' : 's'} due · about 2 minutes` : 'A few cards · about 2 minutes';
  }).catch(() => {});

  const chapters = store.manifest.chapters.filter((c) => c.published).map((c) => {
    const done = c.lessons.filter((l) => isDone(l.id)).length;
    return h('a.card.chap', { href: `#/chapter/${c.id}` },
      ring({ value: c.lessons.length ? done / c.lessons.length : 0, size: 56, stroke: 6, center: h('span.ring-n', {}, `${done}/${c.lessons.length}`) }),
      h('div', {}, h('p.eyebrow', {}, 'Chapter ', c.number), h('strong', {}, c.title), h('p.muted.small', {}, c.subtitle)), icon('chevron', 20));
  });

  return h('div.page.home', {},
    h('section.hello', {}, h('p.muted', {}, greeting(), ','), h('h1', {}, s.profile.name || s.user.name?.split(' ')[0] || 'friend', h('span.wave', {}, icon('lotus', 30)))),
    h('section.card.goal', {},
      ring({ value: pct, size: 112, stroke: 11, tone: s.today.goalMet ? 'teal' : 'saffron',
        center: h('div.goal-c', {}, h('strong', {}, s.today.xp), h('small', {}, `/ ${goal} XP`)) }),
      h('div.goal-text', {},
        h('p.eyebrow', {}, 'Today’s goal'),
        h('h3', {}, s.today.goalMet ? 'Goal complete. Sādhu!' : `${left} XP to go`),
        h('p.muted.small', {}, s.stats.streak > 0 ? `${s.stats.streak}-day streak${s.today.xp === 0 ? ' · practise today to keep it' : ''}` : 'Start a streak with a few minutes today'),
      ),
      weekStrip(s.activity, s.today.date)),
    plan,
    h('section', {}, h('h3.sec-title', {}, 'Your chapters'), h('div.stack', {}, chapters)),
  );
}
