// One-off: recover the sidebar "Reference" quick-tables from the original lesson pages into the lesson JSON.
import { load } from 'cheerio';
import { readFileSync, writeFileSync } from 'node:fs';
for (let n = 1; n <= 8; n++) {
  const $ = load(readFileSync(`legacy/guide-to-pali-lesson${n}.html`, 'utf8'));
  const rows = $('.suffix-table tr').map((_, tr) => {
    const td = $(tr).find('td').map((__, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    return td.length >= 2 ? { label: td[0], ending: td[1], example: td[2] || '' } : null;
  }).get().filter(Boolean);
  const f = `content/lessons/lesson-0${n}.json`;
  const lesson = JSON.parse(readFileSync(f, 'utf8'));
  lesson.reference = rows;
  writeFileSync(f, JSON.stringify(lesson, null, 2) + '\n');
  console.log(`L${n}: ${rows.length} reference rows`, rows.slice(0, 2).map((r) => `${r.label} ${r.ending}`).join(' | '));
}
