import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { checkAnswer } = await import('../js/engine/checker.js');
const { buildLevel, createDrill, levelsAvailable } = await import('../js/engine/quiz.js');
const lesson = (n) => JSON.parse(readFileSync(new URL(`../content/lessons/lesson-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8'));

test('English answers ignore case, punctuation and articles', () => {
  const acc = ['The king eats.', 'A king eats.', 'Kings eat.'];
  assert.ok(checkAnswer('the king eats', acc, 'english').correct);
  assert.ok(checkAnswer('KING EATS!', acc, 'english').correct);
  assert.ok(checkAnswer('Kings eat', acc, 'english').correct);
  assert.ok(!checkAnswer('The king sleeps.', acc, 'english').correct);
  assert.ok(!checkAnswer('', acc, 'english').correct);
});

test('Pāli: lenient mode accepts missing marks but flags them; strict does not', () => {
  const acc = ['Kumārā bhuñjanti.'];
  const exact = checkAnswer('kumārā bhuñjanti', acc, 'pali');
  assert.deepEqual([exact.correct, exact.exact], [true, true]);
  const loose = checkAnswer('Kumara bhunjanti', acc, 'pali');
  assert.deepEqual([loose.correct, loose.exact], [true, false]);
  assert.ok(!checkAnswer('Kumara bhunjanti', acc, 'pali', { strict: true }).correct);
  assert.ok(!checkAnswer('Kumāro bhuñjanti', acc, 'pali').correct, 'wrong ending is wrong');
});

test('Pāli: pasted variants and decomposed marks still match', () => {
  assert.ok(checkAnswer('naraṁ', ['naraṃ'], 'pali', { strict: true }).correct);
  assert.ok(checkAnswer('nāra', ['nāra'], 'pali', { strict: true }).correct);
});

test('every lesson builds at least one playable quiz level', () => {
  for (let n = 1; n <= 11; n++) {
    const l = lesson(n);
    const levels = levelsAvailable(l).filter((x) => x.ok);
    assert.ok(levels.length >= 1, `lesson ${n} has a quiz`);
    for (const { level } of levels) {
      const qs = buildLevel(l, level);
      assert.ok(qs.length > 0, `lesson ${n} level ${level} has questions`);
      if (level === 1) for (const q of qs) {
        assert.ok(q.options.includes(q.answers[0]), 'correct option present');
        assert.equal(new Set(q.options).size, q.options.length, 'no duplicate options');
      }
    }
  }
});

test('drill repeats mistakes until answered correctly', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const d = createDrill(qs);
  d.answer(false);                       // a wrong → comes back
  while (!d.done) d.answer(true);
  assert.equal(d.attempts, 4);
  assert.equal(d.firstTryCorrect, 2);
  assert.equal(d.progress, 1);
});

test('every exercise answer and alternative is accepted by the checker (all lessons)', () => {
  for (let n = 1; n <= 11; n++) {
    const l = lesson(n);
    for (const ex of l.exercises) {
      const lang = ex.kind === 'to_pali' ? 'pali' : 'english';
      for (const [i, it] of ex.items.entries()) {
        const accepted = [it.answer, ...(it.alts || [])];
        for (const a of accepted) assert.ok(checkAnswer(a, accepted, lang, { strict: true }).correct, `L${n}${ex.id} #${i + 1}: "${a}"`);
        assert.ok(it.prompt.trim().length > 0);
      }
    }
  }
});
