// Mirrors content/manifest.json into D1 whenever the manifest version changes (on first request after a deploy).
// Content is authored as JSON in git; D1 holds a relational copy so progress can reference it with real keys.
import manifest from '../../content/manifest.json';

let syncedVersion = null;

export async function ensureContentSynced(env) {
  if (syncedVersion === manifest.version) return;
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'content_version'").first();
  if (row?.value !== manifest.version) {
    const db = env.DB;
    const stmts = [];
    let chapterSort = 0, lessonSort = 0;
    for (const ch of manifest.chapters) {
      stmts.push(db.prepare(
        `INSERT INTO chapters (id, number, title, subtitle, published, sort) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET number = excluded.number, title = excluded.title, subtitle = excluded.subtitle, published = excluded.published, sort = excluded.sort`
      ).bind(ch.id, ch.number, ch.title, ch.subtitle || null, ch.published ? 1 : 0, ++chapterSort));
      for (const l of ch.lessons) {
        stmts.push(db.prepare(
          `INSERT INTO lessons (id, chapter_id, number, title, minutes, xp_reward, published, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET chapter_id = excluded.chapter_id, number = excluded.number, title = excluded.title,
             minutes = excluded.minutes, xp_reward = excluded.xp_reward, published = excluded.published, sort = excluded.sort`
        ).bind(l.id, ch.id, l.number, l.title, l.minutes, l.xp, l.published ? 1 : 0, ++lessonSort));
        for (const e of l.exercises) {
          stmts.push(db.prepare(
            `INSERT INTO exercises (id, lesson_id, kind, item_count) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET lesson_id = excluded.lesson_id, kind = excluded.kind, item_count = excluded.item_count`
          ).bind(e.id, l.id, e.kind, e.items));
        }
      }
    }
    manifest.achievements.forEach((a, i) => stmts.push(db.prepare(
      `INSERT INTO achievements (id, name, description, icon, rule_type, rule_value, xp_reward, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, icon = excluded.icon,
         rule_type = excluded.rule_type, rule_value = excluded.rule_value, xp_reward = excluded.xp_reward, sort = excluded.sort`
    ).bind(a.id, a.name, a.description, a.icon, a.rule.type, String(a.rule.value), a.xp, i)));
    stmts.push(db.prepare("INSERT INTO meta (key, value) VALUES ('content_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(manifest.version));
    // D1 batches are transactional, and chunks keep us under per-batch limits.
    for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  }
  syncedVersion = manifest.version;
}
