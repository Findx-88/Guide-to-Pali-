// In-app notifications. Every producer goes through `notify`, which enforces the user's preferences
// and a dedupe key so the same event can never create two notifications.
import { localDate, localHour, shiftDate } from './util.js';

const PREF_FOR_TYPE = { daily: 'daily_reminder', streak: 'streak_reminder', continue: 'continue_reminder', achievement: 'achievements', chapter: 'achievements' };

export async function notify(ctx, type, dedupeKey, title, body, link) {
  const prefs = await ctx.db.prepare('SELECT * FROM notification_prefs WHERE user_id = ?').bind(ctx.userId).first();
  if (!prefs || !prefs.in_app || !prefs[PREF_FOR_TYPE[type]]) return false;
  const res = await ctx.db.prepare('INSERT OR IGNORE INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(ctx.userId, type, title, body, link || null, dedupeKey).run();
  return res.meta.changes > 0;
}

/**
 * Hourly cron. At most ONE reminder per user per local day, only at the hour they chose,
 * only if they have not practised yet today, and only for learners active in the last 14 days
 * (so lapsed users are never nagged forever).
 */
export async function runReminders(env, now = new Date()) {
  const { results } = await env.DB.prepare(
    `SELECT p.user_id, p.timezone, p.display_name, p.resume_lesson_id, s.streak_current, s.last_active, n.*
     FROM profiles p JOIN user_stats s ON s.user_id = p.user_id JOIN notification_prefs n ON n.user_id = p.user_id
     WHERE n.in_app = 1 AND (n.daily_reminder = 1 OR n.streak_reminder = 1 OR n.continue_reminder = 1)`
  ).all();

  let sent = 0;
  for (const u of results) {
    if (localHour(u.timezone, now) !== u.reminder_hour) continue;
    const today = localDate(u.timezone, now);
    if (u.last_active === today) continue;                               // already practised
    if (u.last_active && u.last_active < shiftDate(today, -14)) continue; // lapsed: stop nagging

    let type, title, body, link = u.resume_lesson_id ? `#/lesson/${u.resume_lesson_id}` : '#/home';
    const name = u.display_name ? `, ${u.display_name}` : '';
    if (u.streak_reminder && u.streak_current > 0 && u.last_active === shiftDate(today, -1)) {
      type = 'streak'; title = `Keep your ${u.streak_current}-day streak`;
      body = `Five quiet minutes today will keep it going${name}.`;
    } else if (u.continue_reminder && u.resume_lesson_id) {
      type = 'continue'; title = 'Pick up where you left off';
      body = 'Your lesson is waiting at the exact step you stopped.';
    } else if (u.daily_reminder) {
      type = 'daily'; title = 'Time for today’s Pāli';
      body = 'A few minutes is all it takes. Your next lesson is ready.';
    } else continue;

    const res = await env.DB.prepare('INSERT OR IGNORE INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(u.user_id, type, title, body, link, `reminder:${today}`).run();     // one reminder per local day
    if (res.meta.changes) sent++;
  }
  return sent;
}
