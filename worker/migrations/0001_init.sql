-- Guide to Pali — D1 schema (v1)
-- Responsibility split:
--   users/sessions/profiles ........ identity + settings
--   chapters/lessons/exercises/achievements ... mirrored from /content (auto-synced by the Worker)
--   lesson_progress/exercise_results/chapter_progress ... where the learner is
--   xp_ledger/user_stats/daily_activity ... gamification (single source of truth)
--   user_achievements, vocab_mastery .... derived rewards / spaced repetition
--   notification_prefs/notifications .... in-app notification system
--   learning_events ..................... append-only learning history

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ───────── Identity ─────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  google_sub    TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE profiles (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name       TEXT,
  timezone           TEXT NOT NULL DEFAULT 'UTC',
  daily_goal_xp      INTEGER NOT NULL DEFAULT 30,
  theme              TEXT NOT NULL DEFAULT 'light',      -- light | dark | auto
  keyboard_os        TEXT NOT NULL DEFAULT 'auto',       -- auto | mac | win
  onboarded          INTEGER NOT NULL DEFAULT 0,
  resume_lesson_id   TEXT,                               -- where to continue
  resume_step        TEXT,                               -- JSON: {"step":"vocab","index":3}
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────── Content mirror (written only by the Worker content-sync) ─────────
CREATE TABLE chapters (
  id        TEXT PRIMARY KEY,
  number    INTEGER NOT NULL,
  title     TEXT NOT NULL,
  subtitle  TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL
);

CREATE TABLE lessons (
  id         TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  number     INTEGER NOT NULL,
  title      TEXT NOT NULL,
  minutes    INTEGER NOT NULL DEFAULT 10,
  xp_reward  INTEGER NOT NULL DEFAULT 50,
  published  INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL
);
CREATE INDEX idx_lessons_chapter ON lessons(chapter_id, sort);

CREATE TABLE exercises (
  id         TEXT PRIMARY KEY,                           -- e.g. l01.a
  lesson_id  TEXT NOT NULL REFERENCES lessons(id),
  kind       TEXT NOT NULL,                              -- to_english | to_pali
  item_count INTEGER NOT NULL,
  xp_per_item INTEGER NOT NULL DEFAULT 10
);
CREATE INDEX idx_exercises_lesson ON exercises(lesson_id);

CREATE TABLE achievements (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  rule_type   TEXT NOT NULL,                             -- see engine.js
  rule_value  TEXT NOT NULL,
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0
);

-- ───────── Progress ─────────
CREATE TABLE lesson_progress (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL REFERENCES lessons(id),
  status       TEXT NOT NULL DEFAULT 'in_progress',      -- in_progress | completed
  steps_done   TEXT NOT NULL DEFAULT '[]',               -- JSON array of step ids
  mastery      INTEGER NOT NULL DEFAULT 0,               -- highest quiz level passed (0-3)
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE exercise_results (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  TEXT NOT NULL REFERENCES exercises(id),
  best_correct INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, exercise_id)
);

CREATE TABLE chapter_progress (
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id        TEXT NOT NULL REFERENCES chapters(id),
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  lessons_total     INTEGER NOT NULL DEFAULT 0,
  completed_at      TEXT,
  PRIMARY KEY (user_id, chapter_id)
);

-- ───────── Gamification ─────────
CREATE TABLE xp_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,                              -- exercise | lesson | quiz | achievement | review | step
  ref        TEXT NOT NULL,                              -- idempotency key within reason
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, reason, ref)
);
CREATE INDEX idx_xp_user_time ON xp_ledger(user_id, created_at);

CREATE TABLE user_stats (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp       INTEGER NOT NULL DEFAULT 0,
  level          INTEGER NOT NULL DEFAULT 1,
  streak_current INTEGER NOT NULL DEFAULT 0,
  streak_best    INTEGER NOT NULL DEFAULT 0,
  last_active    TEXT,                                   -- local date YYYY-MM-DD in profile timezone
  goal_days      INTEGER NOT NULL DEFAULT 0              -- days the daily goal was met
);

CREATE TABLE daily_activity (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,                            -- local date
  xp           INTEGER NOT NULL DEFAULT 0,
  seconds      INTEGER NOT NULL DEFAULT 0,
  exercises    INTEGER NOT NULL DEFAULT 0,
  lessons      INTEGER NOT NULL DEFAULT 0,
  goal_met     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE user_achievements (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE vocab_mastery (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_key      TEXT NOT NULL,                           -- canonical pali form
  correct       INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  interval_days REAL NOT NULL DEFAULT 1,
  level         TEXT NOT NULL DEFAULT 'new',             -- new | learning | familiar | mastered
  next_review   TEXT,
  PRIMARY KEY (user_id, word_key)
);

-- ───────── Notifications ─────────
CREATE TABLE notification_prefs (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app          INTEGER NOT NULL DEFAULT 1,
  daily_reminder  INTEGER NOT NULL DEFAULT 1,
  streak_reminder INTEGER NOT NULL DEFAULT 1,
  continue_reminder INTEGER NOT NULL DEFAULT 1,
  achievements    INTEGER NOT NULL DEFAULT 1,
  reminder_hour   INTEGER NOT NULL DEFAULT 18            -- local hour 0-23
);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                              -- daily | streak | continue | achievement | chapter
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,
  dedupe_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at    TEXT,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- ───────── History ─────────
CREATE TABLE learning_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                              -- lesson_started | exercise_done | lesson_completed | quiz_level | review
  ref        TEXT,
  data       TEXT,                                       -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_user ON learning_events(user_id, created_at DESC);
