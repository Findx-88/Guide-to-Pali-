// Validates /content and builds content/manifest.json — the single contract shared
// by the static app (renders navigation) and the Worker (validates progress, syncs D1).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const errors = [];
const fail = (m) => errors.push(m);

const chapters = readdirSync('content/chapters').filter((f) => f.endsWith('.json')).sort().map((f) => read(`content/chapters/${f}`));
const lessonFiles = readdirSync('content/lessons').filter((f) => f.endsWith('.json')).sort();
const lessons = lessonFiles.map((f) => ({ file: f, ...read(`content/lessons/${f}`) }));
const achievements = read('content/achievements.json');

const ids = new Set();
const unique = (id, what) => { if (ids.has(id)) fail(`duplicate id ${id} (${what})`); ids.add(id); };

for (const c of chapters) {
  unique(c.id, 'chapter');
  for (const key of ['recap', 'mindmap']) if (c[key] && !existsSync(c[key])) (process.argv.includes('--strict') ? fail : console.warn)(`${c.id}: missing ${key} file ${c[key]}`);
}

// Mind maps: unique node ids, links point at real nodes, lesson references exist.
const lessonIds = new Set(lessons.map((l) => l.id));
for (const c of chapters) {
  if (!c.mindmap || !existsSync(c.mindmap)) continue;
  const map = read(c.mindmap), nodeIds = new Set();
  (function walk(n) {
    if (nodeIds.has(n.id)) fail(`${c.id} mindmap: duplicate node id ${n.id}`);
    nodeIds.add(n.id);
    if (n.lesson && !lessonIds.has(n.lesson)) fail(`${c.id} mindmap: node ${n.id} links to unknown lesson ${n.lesson}`);
    (n.children || []).forEach(walk);
  })(map.root);
  for (const l of map.links || []) if (!nodeIds.has(l.from) || !nodeIds.has(l.to)) fail(`${c.id} mindmap: link ${l.from} → ${l.to} references a missing node`);
}

const manifestChapters = chapters.map((c) => ({
  id: c.id, number: c.number, title: c.title, subtitle: c.subtitle, blurb: c.blurb,
  published: c.published !== false, recap: c.recap || null, mindmap: c.mindmap || null, lessons: [],
}));

for (const l of lessons) {
  unique(l.id, `lesson ${l.file}`);
  const ch = manifestChapters.find((c) => c.number === l.chapter);
  if (!ch) { fail(`${l.id}: unknown chapter ${l.chapter}`); continue; }
  const exercises = (l.exercises || []).map((e) => {
    const exId = `${l.id}.${e.id}`;
    unique(exId, 'exercise');
    e.items.forEach((it, i) => { if (!it.prompt || !it.answer) fail(`${exId} item ${i + 1}: empty prompt/answer`); });
    return { id: exId, kind: e.kind, items: e.items.length };
  });
  if (!l.teach?.length && !l.vocab?.length) fail(`${l.id}: no teaching content`);
  ch.lessons.push({
    id: l.id, number: l.number, title: l.title, subtitle: l.subtitle, summary: l.summary || l.subtitle, minutes: l.minutes || 10,
    xp: l.xp || 50, published: l.published !== false, tags: l.tags || [], file: `content/lessons/${l.file}`,
    vocab: (l.vocab || []).length, exercises,
  });
}
manifestChapters.forEach((c) => c.lessons.sort((a, b) => a.number - b.number));

const achIds = new Set();
achievements.forEach((a) => { if (achIds.has(a.id)) fail(`duplicate achievement ${a.id}`); achIds.add(a.id); });

if (errors.length) { console.error('Content validation failed:\n - ' + errors.join('\n - ')); process.exit(1); }

// ───────── Lexicon: one entry per dictionary word, derived from every lesson's vocabulary ─────────
// Forms (all cases, verb forms) are generated in the browser by js/engine/morph.js; this file holds facts only.
const overrides = read('content/lexicon-overrides.json');
const neuter = new Set(overrides.neuter), alsoNeuter = new Set(overrides.alsoNeuter);
const strip = (w) => w.normalize('NFC').toLowerCase();
const lex = new Map();
for (const l of lessons.slice().sort((a, b) => a.number - b.number)) {
  for (const v of l.vocab || []) {
    for (const lemma of v.pali) {
      const id = strip(lemma);
      const group = (v.group || '').toLowerCase();
      let pos = 'other';
      if (group.includes('verb') || lemma.endsWith('ti')) pos = 'verb';
      else if (group.includes('adjective')) pos = 'adj';
      else if (lemma.endsWith('a')) pos = 'noun';
      const cur = lex.get(id) || { id, lemma, pos, gender: pos === 'verb' || pos === 'other' ? null : (neuter.has(id) || group.includes('neuter') || l.id === 'l08' ? 'n' : 'm'), meaning: [], lessons: [], group: v.group };
      for (const m of v.english) if (!cur.meaning.includes(m)) cur.meaning.push(m);
      if (!cur.lessons.includes(l.number)) cur.lessons.push(l.number);
      lex.set(id, cur);
    }
  }
}
for (const x of overrides.extraLessons) {
  const e = lex.get(strip(x.pali));
  if (e) { if (!e.lessons.includes(x.lesson)) e.lessons.push(x.lesson); e.lessons.sort((a, b) => a - b); }
  else fail(`lexicon extraLessons: ${x.pali} is not in any lesson`);
}
for (const e of lex.values()) {
  if (e.pos === 'verb' && overrides.verbs[e.id]) e.irregular = overrides.verbs[e.id];
  if (alsoNeuter.has(e.id)) e.note = 'In other Pāli texts this word can also be neuter.';
  e.lessons.sort((a, b) => a - b);
}
const lexicon = [...lex.values()].sort((a, b) => a.lemma.localeCompare(b.lemma, 'pi'));
writeFileSync('content/lexicon.json', JSON.stringify(lexicon, null, 1) + '\n');
console.log(`lexicon: ${lexicon.length} words (${lexicon.filter((e) => e.pos === 'noun').length} nouns, ${lexicon.filter((e) => e.pos === 'verb').length} verbs, ${lexicon.filter((e) => e.pos === 'adj').length} adjectives)`);

const body = { chapters: manifestChapters, achievements };
const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);
writeFileSync('content/manifest.json', JSON.stringify({ version, ...body }, null, 2) + '\n');
console.log(`manifest v${version}: ${manifestChapters.length} chapters, ${lessons.length} lessons, ${achievements.length} achievements`);
