// Lessons page — the original lesson list (chapters, filters, "coming soon" roadmap) in the clean layout.
import { h, clear } from '../dom.js';
import { store, isDone, loadJson } from '../store.js';
import { icon } from '../ui/icons.js';
import { ring } from '../ui/widgets.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII'];
const FILTERS = [['all', 'All'], ['available', 'Available'], ['completed', 'Completed'], ['soon', 'Coming soon']];

export default async function lessonsPage() {
  const s = store.state;
  const nextId = s.resume.lessonId;
  const road = await loadJson('content/roadmap.json').catch(() => ({ chapters: [] }));
  const st = { filter: 'all' };

  const totalPlanned = store.manifest.chapters.reduce((n, c) => n + c.lessons.length, 0) + road.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const doneCount = store.manifest.chapters.flatMap((c) => c.lessons).filter((l) => isDone(l.id)).length;

  const body = h('div.lessons-body');
  const filterRow = h('div.fchips', { role: 'tablist' }, FILTERS.map(([val, label]) => h('button.fchip', { type: 'button', role: 'tab', 'aria-pressed': String(val === 'all'), dataset: { val }, onclick: () => { st.filter = val; filterRow.querySelectorAll('.fchip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === val))); paint(); } }, label)));
  const statusOf = (l) => (!l.published ? 'soon' : isDone(l.id) ? 'completed' : l.id === nextId ? 'current' : s.lessons[l.id] ? 'started' : 'available');
  const matches = (status) => st.filter === 'all' || (st.filter === 'available' && status !== 'completed' && status !== 'soon') || (st.filter === 'completed' && status === 'completed') || (st.filter === 'soon' && status === 'soon');

  function lessonRow(l) {
    const status = statusOf(l);
    const action = { completed: 'Review', current: 'Continue', started: 'Continue', available: 'Start', soon: 'Coming soon' }[status];
    const row = h(status === 'soon' ? 'div.lrow.soon' : 'a.lrow', { href: status === 'soon' ? null : `#/lesson/${l.id}`, class: status },
      h('span.lnum', {}, status === 'completed' ? icon('check', 18) : ROMAN[l.number] || l.number),
      h('span.lbody', {}, h('strong', {}, l.title), h('small', {}, l.summary || l.subtitle || ''), h('span.ltags', {}, (l.tags || []).filter((t) => !['New', 'Start', 'Active'].includes(t)).map((t) => h('span.vtag', {}, t)))),
      h('span.laction', { class: status }, action, status === 'soon' ? null : icon('chevron', 16)));
    return row;
  }

  function chapterBlock(c) {
    const lessons = c.lessons.map((l) => ({ ...l, published: l.published !== false })).filter((l) => matches(statusOf(l)));
    if (!lessons.length) return null;
    const done = c.lessons.filter((l) => isDone(l.id)).length;
    return h('section.chapter-sec', {}, h('div.chapter-head.card', {},
      ring({ value: c.lessons.length ? done / c.lessons.length : 0, size: 58, stroke: 7, center: h('span.ring-n', {}, `${done}/${c.lessons.length}`) }),
      h('div', {}, h('p.eyebrow', {}, 'Chapter ', c.number), h('h2', {}, c.title), h('p.muted.small', {}, c.subtitle)),
      h('a.btn.btn-ghost.btn-sm', { href: `#/chapter/${c.id}` }, icon('map', 16), 'Recap')), h('div.stack.lrows', {}, lessons.map(lessonRow)));
  }

  function roadmapBlock(c) {
    if (!(st.filter === 'all' || st.filter === 'soon')) return null;
    return h('section.chapter-sec.planned', {}, h('div.chapter-head.card', {}, h('span.lock-ic', {}, icon('lock', 22)),
      h('div', {}, h('p.eyebrow', {}, 'Chapter ', c.number, ' · Lessons ', c.range), h('h2', {}, c.title), h('p.muted.small', {}, 'Coming soon'))),
      h('div.stack.lrows', {}, c.lessons.map((l) => lessonRow({ ...l, id: `planned-${l.number}`, published: false }))));
  }

  function paint() {
    clear(body);
    const blocks = [...store.manifest.chapters.map(chapterBlock), ...road.chapters.map(roadmapBlock)].filter(Boolean);
    body.append(...(blocks.length ? blocks : [h('div.empty', {}, icon('book', 40), h('h3', {}, 'Nothing here'), h('p.muted', {}, 'No lessons match this filter.'))]));
  }

  paint();
  return h('div.page.lessons', {}, h('p.eyebrow', {}, 'The curriculum'), h('h1', {}, 'All ', h('em', {}, 'lessons')),
    h('p.muted', {}, `${doneCount} of ${totalPlanned} lessons complete. Follow the Pāli Primer of Lily de Silva, one calm lesson at a time.`), filterRow, body);
}
