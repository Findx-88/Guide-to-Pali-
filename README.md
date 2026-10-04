# Guide to Pāli

Learn to read Pāli in a few calm minutes a day. Google sign-in, saved progress on every device, XP, streaks, achievements, a spaced-repetition review, chapter recaps and interactive mind maps.

## How it fits together

```
 git push ──► Hostinger (static site)              Cloudflare Worker + D1 (the API)
              index.html, js/, css/, content/  ◄──►  worker/  (/api/*, cron reminders)
```

| Part | Where | Notes |
|---|---|---|
| App (no build step) | repo root: `index.html`, `js/`, `css/`, `config.js` | Hash routes (`#/home`, `#/lesson/l01`), so no server rewrites are needed. |
| Lessons, recaps, mind maps | `content/` (JSON) | **The only thing you edit to add content.** |
| API + database | `worker/` | Cloudflare Worker + D1. Auth, progress, XP, streaks, achievements, notifications. |
| Tests | `tests/` | `npm test` (offline), `npm run test:api` (needs the worker running). |

## What is on each page

| Page | What it does |
|---|---|
| **Landing** (signed out) | The original home page: hero, table of contents, Lily de Silva, features, sign-in. |
| **Home** | Daily goal ring, streak, and one "Today's plan" card (next lesson, then a short word review) with a single button. |
| **Lessons** | Chapters with All / Available / Completed / Coming soon filters. |
| **Lesson** | The whole lesson on one page: revision, grammar, vocabulary, examples, Exercise A and B (type, ✓ per item, Check all, Reset, score), sidebar reference table. A line under the title shows what completes the lesson (60% on each exercise). The three practice levels come last, after the reading. |
| **Vocabulary** | Search a Pāli word, **any inflected form of it**, or English. Shows meaning, lesson(s), all eight cases (or verb forms), and example sentences. Searching `narasmiṃ` answers *locative singular of nara*; `nara locative` highlights the locative. |
| **Flashcards** | Starts with words from the lessons you have opened; Pāli ⇄ English, filter by lesson, mastery stats, spaced repetition saved to your account. |
| **Typing guide + floating "Pāli Typing" panel** | Interactive keyboard, shortcut list, Mac/Windows switch; click a row to insert a letter. Shown only on pages where you type; on phones it is a small round “ā” button. A letter bar and `aa`→`ā` typing work on phones. |
| **Chapter recap / mind map** | Concepts, grammar, vocabulary, rules, mistakes, takeaways, and an interactive map per chapter. |

## How the vocabulary search stays correct

`content/lexicon.json` is **generated** from the vocabulary in the lesson files (`npm run content:build`), so there is one copy of every word. All forms are produced by `js/engine/morph.js` from the endings the Primer teaches (including `-ebhi` and the locative `-mhi`) and are covered by `tests/morph.test.mjs`. Facts that cannot be guessed (which nouns are neuter, irregular gerunds such as `gantvā`, `disvā`) live in `content/lexicon-overrides.json`.

Your original site files are kept for reference in `legacy/` (local only, not deployed, not committed).

## Adding content (no code changes)

1. **New lesson**: copy `content/lessons/lesson-11.json` to `lesson-12.json`, change `id` (`l12`), `number`, `chapter`, and the content. Block types: `heading, prose, callout, rule, table, list, mistakes, pairs`.
2. **New chapter**: add `content/chapters/chapter-03.json` (copy chapter-02). Add `recap` and `mindmap` files (copy the Chapter 2 ones).
3. Run `npm run content:build -- --strict` (validates everything and rewrites `content/manifest.json`), then commit and push.
4. The Worker syncs the new lessons into D1 by itself on its first request after it is redeployed. Achievements live in `content/achievements.json` (data, not code).

Hide an unfinished lesson with `"published": false`.

## Local development

```bash
npm install
cp worker/.dev.vars.example worker/.dev.vars     # enables local email-only sign-in
npm run db:migrate:local
npm run dev:api        # Worker on :8787
npm run dev:web        # site on :5173  →  http://localhost:5173
npm test && npm run test:api
```

## One-time deployment

**A. Google sign-in.** Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* → Web application. Under *Authorized JavaScript origins* add your site (e.g. `https://yourdomain.com`) and `http://localhost:5173`. Put the client ID in **`config.js`** and in **`worker/wrangler.toml`** (`GOOGLE_CLIENT_ID`). It is public, not a secret.

**B. API.**
```bash
cd worker
npx wrangler login                       # or set CLOUDFLARE_API_TOKEN (Workers + D1 edit)
npx wrangler d1 create guide-to-pali     # paste the printed database_id into wrangler.toml
npm run db:migrate:remote                # from the repo root
npx wrangler deploy                      # prints https://guide-to-pali-api.<you>.workers.dev
```
Then set `ALLOWED_ORIGINS` in `wrangler.toml` to your site (e.g. `https://yourdomain.com`) and redeploy.

**C. Site.** Put the Worker URL in `config.js` (`apiBase`), commit, push. Hostinger deploys the static files as it does today.

To deploy the Worker automatically from git too, connect the repo in Cloudflare (Workers & Pages → Create → Import a repository) with the deploy command `cd worker && npx wrangler deploy`.

> Never put `DEV_LOGIN` in production, and never commit an API token. `.dev.vars` is gitignored.

## Daily loop (how the pieces talk)

Complete an exercise → `POST /api/progress` → the Worker saves the result → awards XP once (idempotent) → updates the daily goal and streak → updates chapter progress → unlocks achievements → creates notifications → returns one snapshot the UI animates from. An hourly cron adds at most one gentle reminder per user per local day.
