// Mastery quiz: three levels, each drilled until every item is answered correctly.
import { h, animate, clear, haptic } from '../dom.js';
import { store, loadLesson, findLesson, applyProgress, refresh } from '../store.js';
import { sendProgress } from '../api.js';
import { go } from '../router.js';
import { icon } from '../ui/icons.js';
import { speakBtn } from '../ui/blocks.js';
import { celebrate, floatXp, toast } from '../ui/fx.js';
import { checkAnswer } from '../engine/checker.js';
import { attachPali } from '../keyboard/pali-input.js';
import { buildLevel, createDrill, levelsAvailable } from '../engine/quiz.js';
import { isGuest } from '../store.js';
import { requireAccount } from '../session.js';

export default async function quiz({ id, level }, ctx) {
  level = Number(level);
  if (isGuest()) { requireAccount('Sign in to start the practice rounds and save your progress.'); go(`/lesson/${id}`); return h('div'); }
  const lesson = await loadLesson(id);
  const info = levelsAvailable(lesson).find((l) => l.level === level);
  if (!info?.ok) { go(`/lesson/${id}`); return h('div'); }
  const drill = createDrill(buildLevel(lesson, level));
  let checked = false, busy = false;

  const fill = h('i');
  const stage = h('div.stage');
  const footer = h('footer.lesson-foot');
  const root = h('div.lesson-player.quiz', {},
    h('header.lesson-head', {},
      h('button.icon-btn', { type: 'button', 'aria-label': 'Leave quiz', onclick: () => go(`/lesson/${id}`) }, icon('x', 24)),
      h('div.lesson-meta', {}, h('div.bar', {}, fill), h('span.step-label', {}, `Level ${level} · ${info.name}`))),
    stage, footer);

  const feedback = h('div.feedback');
  const btn = h('button.btn.btn-primary.grow', { type: 'button' }, 'Check');
  footer.append(btn, feedback);
  let input;

  function render() {
    fill.style.width = `${Math.max(4, drill.progress * 100)}%`;
    if (drill.done) return complete();
    checked = false;
    const q = drill.current;
    footer.classList.remove('good', 'bad'); feedback.className = 'feedback'; clear(feedback);
    btn.textContent = q.mode === 'choice' ? 'Choose an answer' : 'Check'; btn.className = 'btn btn-primary grow'; btn.disabled = q.mode === 'choice';
    const pali = q.dir === 'p2e';
    const promptEl = h('div.ex-prompt' + (pali ? '.pali-prompt' : ''), {}, h('span', { class: pali ? 'pali' : '' }, q.prompt), pali ? speakBtn(q.prompt, 22) : null);
    const card = h('div.ex-card', {}, h('p.ex-n', {}, pali ? 'What does this mean?' : q.kind === 'word' ? 'How do you say this in Pāli?' : 'Write this in Pāli'), promptEl);
    if (q.mode === 'choice') {
      card.append(h('div.options', {}, q.options.map((o) => h('button.option', { type: 'button', onclick: (e) => choose(e.currentTarget, o) }, o))));
    } else {
      input = h('input.ex-input', { type: 'text', placeholder: pali ? 'Type the English…' : 'Type in Pāli, with marks…', 'aria-label': 'Your answer' });
      if (!pali) attachPali(input);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onAction(); } });
      card.append(input);
      setTimeout(() => input.focus({ preventScroll: true }), 120);
    }
    clear(stage).append(h('div.card-step.ex', {}, card));
    animate(card, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
  }

  function verdict(correct, expected, note) {
    checked = true;
    footer.classList.add(correct ? 'good' : 'bad');
    feedback.append(icon(correct ? 'check' : 'x', 22), h('div', {}, h('strong', {}, correct ? 'Correct' : 'Not quite'), correct ? (note ? h('p.small', {}, note) : null) : h('p.small', {}, 'Answer: ', h('span.pali', {}, expected))));
    feedback.classList.add('show');
    animate(feedback, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 240 });
    btn.disabled = false; btn.textContent = 'Continue'; btn.className = 'btn grow ' + (correct ? 'btn-good' : 'btn-bad');
    haptic(correct ? 12 : [20, 40, 20]);
    drill.answer(correct);
    if (correct) floatXp(btn, 0);
  }

  function choose(el, option) {
    if (checked) return;
    const q = drill.current;
    const ok = q.answers.some((a) => a.toLowerCase() === option.toLowerCase());
    stage.querySelectorAll('.option').forEach((o) => { o.disabled = true; if (q.answers.some((a) => a.toLowerCase() === o.textContent.toLowerCase())) o.classList.add('good'); });
    el.classList.add(ok ? 'good' : 'bad');
    verdict(ok, q.answers[0]);
  }

  function onAction() {
    if (checked) return render();
    const q = drill.current;
    if (q.mode === 'choice') return;
    if (!input.value.trim()) return;
    const lang = q.dir === 'p2e' ? 'english' : 'pali';
    const r = checkAnswer(input.value, q.answers, lang, { strict: q.strict });
    input.disabled = true; input.classList.add(r.correct ? 'good' : 'bad');
    verdict(r.correct, q.answers[0]);
  }
  btn.addEventListener('click', onAction);

  async function complete() {
    if (busy) return; busy = true;
    clear(footer); clear(stage).append(h('div.loading', {}, h('span.spinner')));
    const words = [...drill.firstTry].filter(([k]) => k.startsWith('v:')).map(([k, ok]) => ({ word: k.split(':')[1], correct: ok }));
    let res = null;
    try {
      if (words.length) await sendProgress({ type: 'review', results: words });
      res = await sendProgress({ type: 'quiz', lessonId: id, level });
    } catch (e) { toast(e.message, { tone: 'bad' }); }
    if (res) applyProgress(res);
    await refresh().catch(() => {});
    const nextOk = levelsAvailable(lesson).find((l) => l.level > level && l.ok);
    clear(stage).append(h('div.card-step.finish', {}, h('div.finish-badge', {}, icon('check', 44)), h('h2', {}, `Level ${level} cleared`),
      h('p.muted', {}, `${drill.firstTryCorrect} of ${drill.total} right on the first try.`)));
    footer.append(h('a.btn.btn-ghost', { href: `#/lesson/${id}` }, 'Back to lesson'),
      nextOk ? h('a.btn.btn-primary.grow', { href: `#/quiz/${id}/${nextOk.level}` }, `Level ${nextOk.level}: ${nextOk.name}`, icon('arrow', 18)) : h('a.btn.btn-primary.grow', { href: '#/home' }, 'Done'));
    celebrate({ title: `Level ${level} <em>mastered</em>`, subtitle: info.name, xp: res?.xpAwarded || 0, badges: res?.newAchievements || [], cta: 'Continue' });
  }

  render();
  return root;
}
