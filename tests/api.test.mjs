// Integration test for the learning engine. Requires `wrangler dev --port 8787` with DEV_LOGIN=1.
//   cd worker && npx wrangler dev --port 8787   (then, in another shell)   npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const API = process.env.API || 'http://localhost:8787';
const manifest = JSON.parse(readFileSync(new URL('../content/manifest.json', import.meta.url), 'utf8'));
const lesson1 = manifest.chapters[0].lessons[0];
const email = `t${Date.now()}@example.com`;
let token;

const call = async (path, method = 'GET', body, tok = token) => {
  const res = await fetch(API + path, {
    method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

test('requires login', async () => {
  assert.equal((await call('/api/state', 'GET', null, null)).status, 401);
  assert.equal((await call('/api/state', 'GET', null, 'bogus')).status, 401);
});

test('dev login creates a profile', async () => {
  const r = await call('/api/auth/dev', 'POST', { email, name: 'Test Learner', timezone: 'Asia/Colombo' }, null);
  assert.equal(r.status, 200);
  token = r.body.token;
  const s = await call('/api/state');
  assert.equal(s.body.stats.totalXp, 0);
  assert.equal(s.body.resume.lessonId, 'l01');
  assert.equal(s.body.profile.timezone, 'Asia/Colombo');
});

test('exercise awards XP once, starts streak, never farms XP', async () => {
  const ex = lesson1.exercises[0];
  const r1 = await call('/api/progress', 'POST', { type: 'exercise', exerciseId: ex.id, correct: ex.items });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.xpAwarded >= ex.items * 10, true);
  assert.equal(r1.body.streak, 1);
  const r2 = await call('/api/progress', 'POST', { type: 'exercise', exerciseId: ex.id, correct: ex.items });
  assert.equal(r2.body.xpAwarded, 0, 'repeating the same score must not award XP again');
  assert.ok(r1.body.newAchievements.some((a) => a.id === 'perfect_1'));
});

test('completing all exercises completes the lesson, chapter progress and unlocks next', async () => {
  for (const ex of lesson1.exercises.slice(1)) await call('/api/progress', 'POST', { type: 'exercise', exerciseId: ex.id, correct: ex.items });
  const s = await call('/api/state');
  assert.equal(s.body.lessons.l01.status, 'completed');
  assert.equal(s.body.chapters.ch1.done, 1);
  assert.equal(s.body.resume.lessonId, 'l02');
  assert.ok(s.body.achievements.first_words);
});

test('rejects bad input', async () => {
  assert.equal((await call('/api/progress', 'POST', { type: 'exercise', exerciseId: 'nope' })).status, 400);
  assert.equal((await call('/api/progress', 'POST', { type: 'wat' })).status, 400);
});

test('quiz XP is idempotent per level', async () => {
  const a = await call('/api/progress', 'POST', { type: 'quiz', lessonId: 'l01', level: 1 });
  const b = await call('/api/progress', 'POST', { type: 'quiz', lessonId: 'l01', level: 1 });
  assert.equal(a.body.xpAwarded >= 25, true);
  assert.equal(b.body.xpAwarded, 0);
});

test('review updates spaced repetition', async () => {
  const r = await call('/api/progress', 'POST', { type: 'review', results: [{ word: 'naro', correct: true }, { word: 'gacchati', correct: false }] });
  assert.equal(r.status, 200);
  const v = await call('/api/vocab');
  assert.equal(v.body.words.length, 2);
});

test('notifications: list, mark read', async () => {
  const n = await call('/api/notifications');
  assert.ok(n.body.items.length > 0, 'achievement notifications expected');
  await call('/api/notifications/read', 'POST', {});
  const s = await call('/api/state');
  assert.equal(s.body.unread, 0);
});

test('prefs gate notifications', async () => {
  await call('/api/prefs', 'PATCH', { achievements: false });
  const before = (await call('/api/notifications')).body.items.length;
  const ex = manifest.chapters[0].lessons[1].exercises[0];
  await call('/api/progress', 'POST', { type: 'exercise', exerciseId: ex.id, correct: ex.items });
  const after = (await call('/api/notifications')).body.items.length;
  assert.equal(after, before);
});

test('logout invalidates the session', async () => {
  await call('/api/auth/logout', 'POST');
  assert.equal((await call('/api/state')).status, 401);
});

test('finishing every lesson completes both chapters and unlocks their achievements', async () => {
  const r = await call('/api/auth/dev', 'POST', { email: `full${Date.now()}@example.com`, name: 'Full Run', timezone: 'UTC' }, null);
  const tok = r.body.token;
  let chapterDone = [];
  for (const ch of manifest.chapters) for (const l of ch.lessons) for (const ex of l.exercises) {
    const res = await call('/api/progress', 'POST', { type: 'exercise', exerciseId: ex.id, correct: ex.items }, tok);
    assert.equal(res.status, 200, `${ex.id}`);
    if (res.body.chapterCompleted) chapterDone.push(res.body.chapterCompleted);
  }
  assert.deepEqual(chapterDone, manifest.chapters.map((c) => c.id), 'each chapter reported complete exactly once');
  const s = await call('/api/state', 'GET', null, tok);
  const total = manifest.chapters.reduce((n, c) => n + c.lessons.length, 0);
  for (const c of manifest.chapters) assert.equal(s.body.chapters[c.id].done, c.lessons.length);
  assert.ok(s.body.achievements.chapter_one && s.body.achievements.chapter_two && s.body.achievements.perfect_10);
  assert.equal(s.body.resume.lessonId, null, 'nothing left to resume');
  assert.ok(s.body.stats.level > 1, `level up after ${total} lessons`);
});
