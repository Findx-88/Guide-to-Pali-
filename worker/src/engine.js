// The learning engine. Every learner action funnels through `recordProgress`, which runs the whole chain:
//   save progress → award XP → update daily activity → update streak → update chapter progress
//   → check achievements → create notifications → return a snapshot the UI can animate from.
import manifest from '../../content/manifest.json';
import { HttpError, localDate, shiftDate } from './util.js';
import { notify } from './notifications.js';

const PASS_RATIO = 0.6;           // an exercise "counts" for lesson completion at this score
const STEP_XP = 5;                // reading a lesson step
const REVIEW_XP = 2;              // one correct flashcard answer (once per word per day)
const QUIZ_XP_PER_LEVEL = 25;
const MAX_ITEMS_PER_REQUEST = 100;

export const lessonIndex = new Map();
export const exerciseIndex = new Map();
for (const ch of manifest.chapters) {
  for (const l of ch.lessons) {
    lessonIndex.set(l.id, { ...l, chapterId: ch.id });
    for (const e of l.exercises) exerciseIndex.set(e.id, { ...e, lessonId: l.id });
  }
}

export const levelForXp = (xp) => Math.floor(Math.sqrt(xp / 60)) + 1;
export const xpForLevel = (level) => 60 * (level - 1) ** 2;

// ───────── Context & reading ─────────
async function loadCtx(env, userId) {
  const [profile, stats] = await Promise.all([
    env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first(),
    env.DB.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(userId).first(),
  ]);
  if (!profile || !stats) throw new HttpError(404, 'Profile missing');
  return { env, db: env.DB, userId, profile, stats, today: localDate(profile.timezone), events: [], newAchievements: [], xpAwarded: 0, flags: {} };
}

/** Streak as it should be *displayed* now: it lapses if yesterday was missed. */
export function effectiveStreak(stats, today) {
  if (!stats.last_active) return 0;
  return stats.last_active === today || stats.last_active === shiftDate(today, -1) ? stats.streak_current : 0;
}

// ───────── XP + streak + daily activity ─────────
async function award(ctx, amount, reason, ref) {
  if (amount <= 0) return 0;
  const res = await ctx.db.prepare('INSERT OR IGNORE INTO xp_ledger (user_id, amount, reason, ref) VALUES (?, ?, ?, ?)')
    .bind(ctx.userId, amount, reason, ref).run();
  if (!res.meta.changes) return 0;               // already awarded → idempotent
  ctx.stats.total_xp += amount;
  ctx.xpAwarded += amount;
  await ctx.db.prepare('UPDATE user_stats SET total_xp = ? WHERE user_id = ?').bind(ctx.stats.total_xp, ctx.userId).run();
  await bumpDay(ctx, { xp: amount });
  return amount;
}

async function bumpDay(ctx, { xp = 0, seconds = 0, exercises = 0, lessons = 0 }) {
  const { db, userId, today } = ctx;
  await db.prepare(
    `INSERT INTO daily_activity (user_id, day, xp, seconds, exercises, lessons) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET xp = xp + excluded.xp, seconds = seconds + excluded.seconds,
       exercises = exercises + excluded.exercises, lessons = lessons + excluded.lessons`
  ).bind(userId, today, xp, seconds, exercises, lessons).run();
}

async function touchStreak(ctx) {
  const s = ctx.stats;
  if (s.last_active === ctx.today) return;
  s.streak_current = s.last_active === shiftDate(ctx.today, -1) ? s.streak_current + 1 : 1;
  s.streak_best = Math.max(s.streak_best, s.streak_current);
  s.last_active = ctx.today;
  ctx.flags.streakExtended = true;
  await ctx.db.prepare('UPDATE user_stats SET streak_current = ?, streak_best = ?, last_active = ? WHERE user_id = ?')
    .bind(s.streak_current, s.streak_best, s.last_active, ctx.userId).run();
}

async function settleDay(ctx) {
  const day = await ctx.db.prepare('SELECT xp, goal_met FROM daily_activity WHERE user_id = ? AND day = ?').bind(ctx.userId, ctx.today).first();
  if (day && !day.goal_met && day.xp >= ctx.profile.daily_goal_xp) {
    await ctx.db.batch([
      ctx.db.prepare('UPDATE daily_activity SET goal_met = 1 WHERE user_id = ? AND day = ?').bind(ctx.userId, ctx.today),
      ctx.db.prepare('UPDATE user_stats SET goal_days = goal_days + 1 WHERE user_id = ?').bind(ctx.userId),
    ]);
    ctx.stats.goal_days += 1;
    ctx.flags.goalMet = true;
  }
  const level = levelForXp(ctx.stats.total_xp);
  if (level !== ctx.stats.level) {
    if (level > ctx.stats.level) ctx.flags.levelUp = level;
    ctx.stats.level = level;
    await ctx.db.prepare('UPDATE user_stats SET level = ? WHERE user_id = ?').bind(level, ctx.userId).run();
  }
}

// ───────── Lesson / chapter progress ─────────
async function ensureLesson(ctx, lessonId) {
  const res = await ctx.db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)').bind(ctx.userId, lessonId).run();
  if (res.meta.changes) ctx.events.push(['lesson_started', lessonId, null]);
}

async function maybeCompleteLesson(ctx, lessonId) {
  const lesson = lessonIndex.get(lessonId);
  const row = await ctx.db.prepare('SELECT status FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').bind(ctx.userId, lessonId).first();
  if (!row || row.status === 'completed') return;

  const { results } = await ctx.db.prepare(
    `SELECT e.id, e.item_count, r.best_correct, r.total FROM exercises e
     LEFT JOIN exercise_results r ON r.exercise_id = e.id AND r.user_id = ? WHERE e.lesson_id = ?`
  ).bind(ctx.userId, lessonId).all();
  const done = results.length > 0 && results.every((e) => e.total > 0 && e.best_correct / e.total >= PASS_RATIO);
  if (!done) return;

  await ctx.db.prepare("UPDATE lesson_progress SET status = 'completed', completed_at = datetime('now') WHERE user_id = ? AND lesson_id = ?")
    .bind(ctx.userId, lessonId).run();
  await award(ctx, lesson.xp, 'lesson', lessonId);
  await bumpDay(ctx, { lessons: 1 });
  ctx.events.push(['lesson_completed', lessonId, null]);
  ctx.flags.lessonCompleted = lessonId;
  await refreshChapter(ctx, lesson.chapterId);

  // Move the resume pointer to whatever comes next.
  const next = nextLessonId(await completedSet(ctx));
  await ctx.db.prepare('UPDATE profiles SET resume_lesson_id = ?, resume_step = NULL, updated_at = datetime(\'now\') WHERE user_id = ?')
    .bind(next, ctx.userId).run();
}

async function completedSet(ctx) {
  const { results } = await ctx.db.prepare("SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND status = 'completed'").bind(ctx.userId).all();
  return new Set(results.map((r) => r.lesson_id));
}

export function nextLessonId(done) {
  for (const ch of manifest.chapters) {
    if (!ch.published) continue;
    for (const l of ch.lessons) if (l.published && !done.has(l.id)) return l.id;
  }
  return null;
}

async function refreshChapter(ctx, chapterId) {
  const ch = manifest.chapters.find((c) => c.id === chapterId);
  const published = ch.lessons.filter((l) => l.published);
  const done = await completedSet(ctx);
  const count = published.filter((l) => done.has(l.id)).length;
  const complete = published.length > 0 && count === published.length;
  const prev = await ctx.db.prepare('SELECT completed_at FROM chapter_progress WHERE user_id = ? AND chapter_id = ?').bind(ctx.userId, chapterId).first();
  await ctx.db.prepare(
    `INSERT INTO chapter_progress (user_id, chapter_id, lessons_completed, lessons_total, completed_at)
     VALUES (?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END)
     ON CONFLICT(user_id, chapter_id) DO UPDATE SET lessons_completed = excluded.lessons_completed,
       lessons_total = excluded.lessons_total, completed_at = COALESCE(chapter_progress.completed_at, excluded.completed_at)`
  ).bind(ctx.userId, chapterId, count, published.length, complete ? 1 : 0).run();
  if (complete && !prev?.completed_at) {
    ctx.flags.chapterCompleted = chapterId;
    await notify(ctx, 'chapter', `chapter:${chapterId}`, `Chapter ${ch.number} complete`, `You finished “${ch.title}”. Take a look at the recap while it is fresh.`, `#/chapter/${chapterId}`);
  }
}

// ───────── Achievements ─────────
async function snapshot(ctx) {
  const { db, userId } = ctx;
  const [done, perfect, words, chapters] = await Promise.all([
    completedSet(ctx),
    db.prepare('SELECT COUNT(*) n FROM exercise_results WHERE user_id = ? AND total > 0 AND best_correct = total').bind(userId).first(),
    db.prepare("SELECT COUNT(*) n FROM vocab_mastery WHERE user_id = ? AND level = 'mastered'").bind(userId).first(),
    db.prepare('SELECT chapter_id FROM chapter_progress WHERE user_id = ? AND completed_at IS NOT NULL').bind(userId).all(),
  ]);
  return {
    lessons_completed: done.size,
    chapters: new Set(chapters.results.map((r) => r.chapter_id)),
    streak: ctx.stats.streak_best,
    total_xp: ctx.stats.total_xp,
    perfect_exercises: perfect.n,
    words_mastered: words.n,
    goal_days: ctx.stats.goal_days,
  };
}

const ruleMet = (rule, snap) => (rule.type === 'chapter_completed' ? snap.chapters.has(rule.value) : (snap[rule.type] ?? 0) >= rule.value);

async function checkAchievements(ctx) {
  for (let pass = 0; pass < 3; pass++) {               // an XP reward can unlock an XP-based badge
    const { results } = await ctx.db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').bind(ctx.userId).all();
    const have = new Set(results.map((r) => r.achievement_id));
    const snap = await snapshot(ctx);
    const fresh = manifest.achievements.filter((a) => !have.has(a.id) && ruleMet(a.rule, snap));
    if (!fresh.length) return;
    for (const a of fresh) {
      await ctx.db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').bind(ctx.userId, a.id).run();
      ctx.newAchievements.push({ id: a.id, name: a.name, description: a.description, icon: a.icon, xp: a.xp });
      await award(ctx, a.xp, 'achievement', a.id);
      await notify(ctx, 'achievement', `ach:${a.id}`, `Achievement: ${a.name}`, a.description, '#/profile');
    }
  }
}

// ───────── Public: one entry point for every learner action ─────────
export async function recordProgress(env, userId, body) {
  const ctx = await loadCtx(env, userId);
  const { db } = ctx;

  switch (body.type) {
    case 'step': {
      const lesson = lessonIndex.get(body.lessonId);
      if (!lesson || typeof body.step !== 'string') throw new HttpError(400, 'Unknown lesson or step');
      await ensureLesson(ctx, lesson.id);
      const row = await db.prepare('SELECT steps_done FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').bind(ctx.userId, lesson.id).first();
      const steps = new Set(JSON.parse(row.steps_done));
      if (!steps.has(body.step)) {
        steps.add(body.step);
        await db.prepare('UPDATE lesson_progress SET steps_done = ? WHERE user_id = ? AND lesson_id = ?').bind(JSON.stringify([...steps]), ctx.userId, lesson.id).run();
        await award(ctx, STEP_XP, 'step', `${lesson.id}:${body.step}`);
      }
      await touchStreak(ctx);
      break;
    }

    case 'exercise': {
      const ex = exerciseIndex.get(body.exerciseId);
      if (!ex) throw new HttpError(400, 'Unknown exercise');
      const total = ex.items;
      const correct = Math.max(0, Math.min(total, Math.floor(Number(body.correct))));
      if (!Number.isFinite(correct)) throw new HttpError(400, 'Invalid score');
      await ensureLesson(ctx, ex.lessonId);
      const prev = await db.prepare('SELECT best_correct FROM exercise_results WHERE user_id = ? AND exercise_id = ?').bind(ctx.userId, ex.id).first();
      const best = Math.max(prev?.best_correct ?? 0, correct);
      await db.prepare(
        `INSERT INTO exercise_results (user_id, exercise_id, best_correct, total, attempts) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(user_id, exercise_id) DO UPDATE SET best_correct = ?, total = ?, attempts = attempts + 1, updated_at = datetime('now')`
      ).bind(ctx.userId, ex.id, best, total, best, total).run();
      // XP only for *new* best correct answers: practising never farms XP.
      const gained = best - (prev?.best_correct ?? 0);
      for (let i = (prev?.best_correct ?? 0) + 1; i <= best; i++) await award(ctx, 10, 'exercise', `${ex.id}#${i}`);
      await bumpDay(ctx, { exercises: 1, seconds: Math.min(3600, Math.max(0, Number(body.seconds) || 0)) });
      ctx.events.push(['exercise_done', ex.id, { correct, total, best }]);
      ctx.flags.exercise = { id: ex.id, correct, total, best, gained };
      await touchStreak(ctx);
      await maybeCompleteLesson(ctx, ex.lessonId);
      break;
    }

    case 'quiz': {
      const lesson = lessonIndex.get(body.lessonId);
      const level = Math.floor(Number(body.level));
      if (!lesson || ![1, 2, 3].includes(level)) throw new HttpError(400, 'Invalid quiz result');
      await ensureLesson(ctx, lesson.id);
      await db.prepare('UPDATE lesson_progress SET mastery = MAX(mastery, ?) WHERE user_id = ? AND lesson_id = ?').bind(level, ctx.userId, lesson.id).run();
      await award(ctx, QUIZ_XP_PER_LEVEL * level, 'quiz', `${lesson.id}:L${level}`);
      ctx.events.push(['quiz_level', lesson.id, { level }]);
      await touchStreak(ctx);
      break;
    }

    case 'review': {
      const items = Array.isArray(body.results) ? body.results.slice(0, MAX_ITEMS_PER_REQUEST) : [];
      for (const it of items) {
        const key = String(it.word || '').slice(0, 80);
        if (!key) continue;
        const w = (await db.prepare('SELECT * FROM vocab_mastery WHERE user_id = ? AND word_key = ?').bind(ctx.userId, key).first())
          || { correct: 0, streak: 0, interval_days: 1 };
        if (it.correct) { w.correct++; w.streak++; w.interval_days = Math.min(w.interval_days * 2.5, 60); }
        else { w.streak = 0; w.interval_days = 1; }
        const level = w.streak >= 5 ? 'mastered' : w.streak >= 3 ? 'familiar' : w.correct > 0 ? 'learning' : 'new';
        const next = shiftDate(ctx.today, Math.max(1, Math.round(w.interval_days)));
        await db.prepare(
          `INSERT INTO vocab_mastery (user_id, word_key, correct, streak, interval_days, level, next_review) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, word_key) DO UPDATE SET correct = excluded.correct, streak = excluded.streak,
             interval_days = excluded.interval_days, level = excluded.level, next_review = excluded.next_review`
        ).bind(ctx.userId, key, w.correct, w.streak, w.interval_days, level, next).run();
        if (it.correct) await award(ctx, REVIEW_XP, 'review', `${ctx.today}:${key}`);
      }
      if (items.length) { ctx.events.push(['review', null, { n: items.length }]); await touchStreak(ctx); }
      break;
    }

    case 'position': {
      if (!lessonIndex.has(body.lessonId)) throw new HttpError(400, 'Unknown lesson');
      await db.prepare("UPDATE profiles SET resume_lesson_id = ?, resume_step = ?, updated_at = datetime('now') WHERE user_id = ?")
        .bind(body.lessonId, body.step ? JSON.stringify(body.step).slice(0, 500) : null, ctx.userId).run();
      return { ok: true };
    }

    default:
      throw new HttpError(400, 'Unknown progress type');
  }

  await settleDay(ctx);
  await checkAchievements(ctx);
  await settleDay(ctx);                                  // achievement XP may cross the daily goal / a level
  if (ctx.events.length) {
    await db.batch(ctx.events.map(([type, ref, data]) =>
      db.prepare('INSERT INTO learning_events (user_id, type, ref, data) VALUES (?, ?, ?, ?)').bind(ctx.userId, type, ref, data ? JSON.stringify(data) : null)));
  }

  const today = await db.prepare('SELECT xp, goal_met FROM daily_activity WHERE user_id = ? AND day = ?').bind(ctx.userId, ctx.today).first();
  return {
    ok: true,
    xpAwarded: ctx.xpAwarded,
    totalXp: ctx.stats.total_xp,
    level: ctx.stats.level,
    levelProgress: { from: xpForLevel(ctx.stats.level), to: xpForLevel(ctx.stats.level + 1) },
    streak: effectiveStreak(ctx.stats, ctx.today),
    today: { xp: today?.xp ?? 0, goal: ctx.profile.daily_goal_xp, goalMet: !!today?.goal_met },
    ...ctx.flags,
    newAchievements: ctx.newAchievements,
  };
}

// ───────── Read model for the dashboard ─────────
export async function readState(env, userId) {
  const ctx = await loadCtx(env, userId);
  const { db } = ctx;
  const [lp, er, cp, ua, today, unread, prefs, recent] = await Promise.all([
    db.prepare('SELECT lesson_id, status, steps_done, mastery FROM lesson_progress WHERE user_id = ?').bind(userId).all(),
    db.prepare('SELECT exercise_id, best_correct, total FROM exercise_results WHERE user_id = ?').bind(userId).all(),
    db.prepare('SELECT chapter_id, lessons_completed, lessons_total, completed_at FROM chapter_progress WHERE user_id = ?').bind(userId).all(),
    db.prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?').bind(userId).all(),
    db.prepare('SELECT xp, seconds, goal_met FROM daily_activity WHERE user_id = ? AND day = ?').bind(userId, ctx.today).first(),
    db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(userId).first(),
    db.prepare('SELECT * FROM notification_prefs WHERE user_id = ?').bind(userId).first(),
    db.prepare('SELECT day, xp, goal_met FROM daily_activity WHERE user_id = ? AND day >= ? ORDER BY day').bind(userId, shiftDate(ctx.today, -27)).all(),
  ]);
  const done = new Set(lp.results.filter((r) => r.status === 'completed').map((r) => r.lesson_id));
  const resume = ctx.profile.resume_lesson_id && lessonIndex.has(ctx.profile.resume_lesson_id) && !done.has(ctx.profile.resume_lesson_id)
    ? ctx.profile.resume_lesson_id : nextLessonId(done);
  return {
    profile: {
      name: ctx.profile.display_name, timezone: ctx.profile.timezone, dailyGoal: ctx.profile.daily_goal_xp,
      theme: ctx.profile.theme, keyboardOs: ctx.profile.keyboard_os, onboarded: !!ctx.profile.onboarded,
    },
    stats: {
      totalXp: ctx.stats.total_xp, level: ctx.stats.level, levelProgress: { from: xpForLevel(ctx.stats.level), to: xpForLevel(ctx.stats.level + 1) },
      streak: effectiveStreak(ctx.stats, ctx.today), bestStreak: ctx.stats.streak_best, goalDays: ctx.stats.goal_days,
    },
    today: { date: ctx.today, xp: today?.xp ?? 0, seconds: today?.seconds ?? 0, goalMet: !!today?.goal_met },
    resume: { lessonId: resume, step: ctx.profile.resume_lesson_id === resume && ctx.profile.resume_step ? JSON.parse(ctx.profile.resume_step) : null },
    lessons: Object.fromEntries(lp.results.map((r) => [r.lesson_id, { status: r.status, steps: JSON.parse(r.steps_done), mastery: r.mastery }])),
    exercises: Object.fromEntries(er.results.map((r) => [r.exercise_id, { best: r.best_correct, total: r.total }])),
    chapters: Object.fromEntries(cp.results.map((r) => [r.chapter_id, { done: r.lessons_completed, total: r.lessons_total, completedAt: r.completed_at }])),
    achievements: Object.fromEntries(ua.results.map((r) => [r.achievement_id, r.unlocked_at])),
    activity: recent.results,
    unread: unread.n,
    prefs: prefs && { inApp: !!prefs.in_app, daily: !!prefs.daily_reminder, streak: !!prefs.streak_reminder, resume: !!prefs.continue_reminder, achievements: !!prefs.achievements, hour: prefs.reminder_hour },
  };
}
