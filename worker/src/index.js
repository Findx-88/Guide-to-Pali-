import { HttpError, corsHeaders, json, validTimezone } from './util.js';
import { authenticate, createSession, upsertUser, verifyGoogleIdToken } from './auth.js';
import { ensureContentSynced } from './content-sync.js';
import { readState, recordProgress } from './engine.js';
import { runReminders } from './notifications.js';

const bodyOf = async (request) => {
  try { return await request.json(); } catch { throw new HttpError(400, 'Invalid JSON body'); }
};

async function route(request, env, url) {
  const { pathname: path } = url;
  const method = request.method;

  if (path === '/api/health') return json({ ok: true });

  // ───────── Auth (public) ─────────
  if (path === '/api/auth/google' && method === 'POST') {
    const { credential, timezone } = await bodyOf(request);
    const claims = await verifyGoogleIdToken(credential, env);
    const user = await upsertUser(env, claims, validTimezone(timezone) ? timezone : 'UTC');
    return json({ token: await createSession(env, user.id) });
  }
  // Local development only: set DEV_LOGIN=1 in worker/.dev.vars. Never set it in production.
  if (path === '/api/auth/dev' && method === 'POST' && env.DEV_LOGIN === '1') {
    const { email = 'dev@example.com', name = 'Dev Learner', timezone } = await bodyOf(request);
    const user = await upsertUser(env, { sub: `dev:${email}`, email, name }, validTimezone(timezone) ? timezone : 'UTC');
    return json({ token: await createSession(env, user.id) });
  }

  // ───────── Everything below needs a session ─────────
  const session = await authenticate(request, env);
  const userId = session.id;

  if (path === '/api/auth/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    return json({ ok: true });
  }

  if (path === '/api/state' && method === 'GET') {
    const state = await readState(env, userId);
    return json({ user: { name: session.name, email: session.email, avatar: session.avatar_url }, ...state });
  }

  if (path === '/api/progress' && method === 'POST') {
    return json(await recordProgress(env, userId, await bodyOf(request)));
  }

  if (path === '/api/profile' && method === 'PATCH') {
    const b = await bodyOf(request);
    const sets = [], vals = [];
    const put = (col, v) => { sets.push(`${col} = ?`); vals.push(v); };
    if (typeof b.name === 'string') put('display_name', b.name.trim().slice(0, 40));
    if (b.dailyGoal !== undefined) put('daily_goal_xp', Math.max(10, Math.min(200, Math.round(Number(b.dailyGoal)) || 30)));
    if (['light', 'dark', 'auto'].includes(b.theme)) put('theme', b.theme);
    if (['auto', 'mac', 'win'].includes(b.keyboardOs)) put('keyboard_os', b.keyboardOs);
    if (typeof b.timezone === 'string' && validTimezone(b.timezone)) put('timezone', b.timezone);
    if (b.onboarded !== undefined) put('onboarded', b.onboarded ? 1 : 0);
    if (sets.length) await env.DB.prepare(`UPDATE profiles SET ${sets.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`).bind(...vals, userId).run();
    return json({ ok: true });
  }

  if (path === '/api/prefs' && method === 'PATCH') {
    const b = await bodyOf(request);
    const map = { inApp: 'in_app', daily: 'daily_reminder', streak: 'streak_reminder', resume: 'continue_reminder', achievements: 'achievements' };
    const sets = [], vals = [];
    for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) { sets.push(`${col} = ?`); vals.push(b[k] ? 1 : 0); }
    if (b.hour !== undefined) { sets.push('reminder_hour = ?'); vals.push(Math.max(0, Math.min(23, Math.floor(Number(b.hour)) || 18))); }
    if (sets.length) await env.DB.prepare(`UPDATE notification_prefs SET ${sets.join(', ')} WHERE user_id = ?`).bind(...vals, userId).run();
    return json({ ok: true });
  }

  if (path === '/api/notifications' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, type, title, body, link, created_at AS createdAt, read_at AS readAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40'
    ).bind(userId).all();
    return json({ items: results });
  }
  if (path === '/api/notifications/read' && method === 'POST') {
    const { ids } = await bodyOf(request);
    if (Array.isArray(ids) && ids.length) {
      const safe = ids.slice(0, 100).map(Number).filter(Number.isInteger);
      await env.DB.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL AND id IN (${safe.map(() => '?').join(',') || 'NULL'})`).bind(userId, ...safe).run();
    } else {
      await env.DB.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").bind(userId).run();
    }
    return json({ ok: true });
  }

  if (path === '/api/vocab' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT word_key AS word, level, streak, next_review AS nextReview FROM vocab_mastery WHERE user_id = ?').bind(userId).all();
    return json({ words: results });
  }

  if (path === '/api/history' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT type, ref, data, created_at AS at FROM learning_events WHERE user_id = ? ORDER BY id DESC LIMIT 50').bind(userId).all();
    return json({ events: results.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null })) });
  }

  throw new HttpError(404, 'Not found');
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      await ensureContentSynced(env);
      const res = await route(request, env, new URL(request.url));
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      res.headers.set('cache-control', 'no-store');
      return res;
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      return json({ error: status === 500 ? 'Something went wrong on our side.' : err.message }, status, cors);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureContentSynced(env).then(() => runReminders(env)));
  },
};
