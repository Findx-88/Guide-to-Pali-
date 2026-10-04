// One-off migration: legacy hand-written lesson HTML -> content/lessons/lesson-NN.json
// Kept in the repo so the migration is reproducible; not part of the normal build.
import { load } from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const SRC = process.argv[2] || '.';
const OUT = 'content/lessons';
mkdirSync(OUT, { recursive: true });

const clean = ($el) => {
  const c = $el.clone();
  c.find('.audio-btn, button, svg').remove();
  c.find('[style]').removeAttr('style');
  return c.html().replace(/\s+/g, ' ').trim();
};
const text = ($el) => $el.clone().find('.audio-btn, button').remove().end().text().replace(/\s+/g, ' ').trim();

function grabObject(src, name) {
  const start = src.indexOf(`window.${name} =`);
  if (start < 0) return null;
  const open = src.indexOf('{', start);
  let depth = 0, i = open, inStr = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) break;
  }
  return vm.runInNewContext('(' + src.slice(open, i + 1) + ')');
}

const split = (s, re) => s.split(re).map((x) => x.trim()).filter(Boolean);

function blocksFrom($, section) {
  const blocks = [];
  let eyebrow = null;
  section.children().each((_, node) => {
    const $n = $(node);
    const cls = $n.attr('class') || '';
    if ($n.is('p') && cls.includes('section-eyebrow')) { eyebrow = text($n); return; }
    if ($n.is('h2') || cls.includes('section-heading')) {
      blocks.push({ type: 'heading', level: 2, eyebrow, html: clean($n) }); eyebrow = null; return;
    }
    if ($n.is('h3')) { blocks.push({ type: 'heading', level: 3, html: clean($n) }); return; }
    if (cls.includes('prose')) { blocks.push({ type: 'prose', html: clean($n) }); return; }
    if (cls.includes('highlight-box')) { blocks.push({ type: 'callout', html: clean($n.find('p').first().length ? $n.find('p').first() : $n) }); return; }
    if (cls.includes('rule-box')) {
      blocks.push({
        type: 'rule',
        title: clean($n.find('.rule-text').first()),
        formulas: $n.find('.rule-formula').map((__, f) => clean($(f))).get(),
      });
      return;
    }
    if (cls.includes('decl-table-wrap')) {
      const t = $n.find('table');
      blocks.push({
        type: 'table',
        caption: clean(t.find('caption')),
        head: t.find('thead th').map((__, th) => clean($(th))).get(),
        rows: t.find('tbody tr').map((__, tr) => [$(tr).find('td').map((___, td) => clean($(td))).get()]).get(),
      });
      return;
    }
    if ($n.is('div') && ($n.find('.section-header').length || cls.includes('section-header'))) return;
    const html = clean($n);
    if (html) { blocks.push({ type: 'html', html }); console.warn(`  ! fallback html block (<${node.tagName} class="${cls}">)`); }
  });
  return blocks;
}

for (let n = 1; n <= 8; n++) {
  const file = `${SRC}/guide-to-pali-lesson${n}.html`;
  const raw = readFileSync(file, 'utf8');
  const $ = load(raw);
  console.log(`Lesson ${n}`);

  const scripts = $('script').map((_, s) => $(s).html() || '').get().join('\n');
  const answers = grabObject(scripts, 'lessonAnswers') || { a: [], b: [] };
  const data = grabObject(scripts, 'lessonData') || { vocab: [], sentences: [] };

  const tags = $('.lh-meta .lh-tag').map((_, t) => text($(t))).get().filter((t) => t !== 'Start');
  const minutes = parseInt(text($('.time-badge')).replace(/\D/g, ''), 10) || 15;

  // Revision
  let revision = null;
  const rev = $('#revision .revision-section');
  if (rev.length) {
    revision = {
      title: text(rev.find('.revision-title')),
      summaryHtml: clean(rev.find('.revision-summary')),
      connectionHtml: clean(rev.find('.revision-connection')),
      questions: rev.find('.revision-q').map((_, q) => ({
        q: clean($(q).find('.rq-text')),
        a: clean($(q).find('.rq-answer')).replace(/^→\s*/, ''),
      })).get(),
    };
  }

  // Teaching sections (grammar, neuter, ...)
  const teach = [];
  $('section.lesson-section').each((_, s) => {
    const id = $(s).attr('id');
    if (['revision', 'vocabulary', 'examples', 'exercise-a', 'exercise-b'].includes(id)) return;
    teach.push({ id, title: text($(s).find('.section-heading').first()), blocks: blocksFrom($, $(s)) });
  });

  // Vocabulary: display grid is canonical; merge extra English glosses from lessonData
  const vocab = [];
  $('#vocabulary .vocab-col').each((_, col) => {
    const group = text($(col).find('h3').first()) || 'Words';
    $(col).find('.vocab-item').each((__, it) => {
      const pali = split(text($(it).find('.vocab-pali')), /\s*\/\s*/);
      let english = split(text($(it).find('.vocab-eng')), /\s*,\s*/);
      const match = (data.vocab || []).find((v) => v.pali.some((p) => pali.includes(p)));
      if (match) english = [...new Set([...english, ...match.english])];
      vocab.push({ group, pali, english });
    });
  });
  // Lessons whose vocab lives only in lessonData
  if (!vocab.length) for (const v of data.vocab || []) vocab.push({ group: 'Words', pali: v.pali, english: v.english });

  const examples = $('#examples .example-row').map((_, r) => ({
    pali: clean($(r).find('.ex-pali')),
    english: text($(r).find('.ex-english')),
  })).get();

  const exercises = ['a', 'b'].map((id) => {
    const sec = $(`#exercise-${id}`);
    if (!sec.length) return null;
    const items = sec.find('.ex-item').map((i, it) => {
      const a = (answers[id] || [])[i] || {};
      return { prompt: text($(it).find('.ex-source')), answer: a.main || '', alts: a.alts || [] };
    }).get();
    const instruction = text(sec.find('.exercise-instruction'));
    return { id, kind: id === 'a' ? 'to_english' : 'to_pali', instruction, items };
  }).filter(Boolean);

  const lesson = {
    id: `l${String(n).padStart(2, '0')}`,
    number: n,
    chapter: 1,
    title: text($('.lh-title')),
    subtitle: text($('.lh-subtitle')),
    tags,
    minutes,
    revision,
    teach,
    vocab,
    examples,
    sentences: data.sentences || [],
    exercises,
  };
  writeFileSync(`${OUT}/lesson-${String(n).padStart(2, '0')}.json`, JSON.stringify(lesson, null, 2) + '\n');
  console.log(`  title="${lesson.title}" teach=${teach.length} vocab=${vocab.length} examples=${examples.length} sentences=${lesson.sentences.length} exercises=${exercises.map((e) => e.items.length).join('+')}`);
}
