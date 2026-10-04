// Mastery quiz builder (pure functions). Three levels, each "drill until perfect":
//   L1 multiple choice · L2 type the word (strict diacritics) · L3 translate sentences (strict)
// Lessons without a vocabulary list (e.g. the Genitive/Locative lessons) fall back to sentences.

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const vocabQs = (lesson) => lesson.vocab.flatMap((v) => [
  { id: `v:${v.pali[0]}:p2e`, kind: 'word', dir: 'p2e', prompt: v.pali[0], answers: v.english, word: v.pali[0], display: v.english[0] },
  { id: `v:${v.pali[0]}:e2p`, kind: 'word', dir: 'e2p', prompt: v.english[0], answers: v.pali, word: v.pali[0], display: v.pali[0] },
]);
const sentenceQs = (lesson) => (lesson.sentences || []).map((s, i) => (s.dir === 'p2e'
  ? { id: `s:${i}`, kind: 'sentence', dir: 'p2e', prompt: s.pali[0], answers: s.english, display: s.english[0] }
  : { id: `s:${i}`, kind: 'sentence', dir: 'e2p', prompt: s.english[0], answers: s.pali, display: s.pali[0] }));

export function levelsAvailable(lesson) {
  const hasVocab = lesson.vocab?.length >= 2;
  const hasSent = lesson.sentences?.length >= 2;
  return [
    { level: 1, name: 'Recognise', desc: hasVocab ? 'Pick the right meaning' : 'Pick the right translation', ok: hasVocab || hasSent },
    { level: 2, name: 'Recall', desc: 'Type the word, marks and all', ok: hasVocab },
    { level: 3, name: 'Compose', desc: 'Translate whole sentences', ok: hasSent },
  ];
}

export function buildLevel(lesson, level, rnd = Math.random) {
  const hasVocab = lesson.vocab?.length >= 2;
  let pool;
  if (level === 3) pool = sentenceQs(lesson);
  else pool = hasVocab ? vocabQs(lesson) : sentenceQs(lesson);
  if (level === 1) {
    pool = pool.map((q) => ({ ...q, mode: 'choice', options: options(q, pool, rnd) }));
  } else {
    pool = pool.map((q) => ({ ...q, mode: 'type', strict: true }));
  }
  return shuffle(pool, rnd);
}

function options(q, pool, rnd) {
  const same = pool.filter((o) => o.dir === q.dir && o.id !== q.id);
  const taken = new Set(q.answers.map((a) => a.toLowerCase()));
  const distractors = [];
  for (const o of shuffle(same, rnd)) {
    const text = o.answers[0];
    if (taken.has(text.toLowerCase()) || o.answers.some((a) => taken.has(a.toLowerCase()))) continue;
    taken.add(text.toLowerCase());
    distractors.push(text);
    if (distractors.length === 3) break;
  }
  return shuffle([q.answers[0], ...distractors], rnd);
}

/**
 * Drill queue: a wrong answer comes back a few cards later until it is answered correctly.
 * Returns a tiny state machine so the UI stays dumb.
 */
export function createDrill(questions) {
  const queue = [...questions];
  const total = questions.length;
  const firstTry = new Map();          // id → boolean (was the first attempt right?)
  let answered = 0;
  return {
    total,
    get current() { return queue[0]; },
    get done() { return queue.length === 0; },
    get progress() { return total === 0 ? 1 : (total - new Set(queue.map((q) => q.id)).size) / total; },
    get firstTryCorrect() { return [...firstTry.values()].filter(Boolean).length; },
    get firstTry() { return firstTry; },
    get attempts() { return answered; },
    answer(correct) {
      const q = queue.shift();
      answered++;
      if (!firstTry.has(q.id)) firstTry.set(q.id, correct);
      if (!correct) queue.splice(Math.min(queue.length, 3), 0, q);   // retry soon, not at the very end
      return q;
    },
  };
}
