// Chapter hub: overview · Understanding (recap) · Mind map. All driven by content/recap + content/mindmaps JSON.
import { h, animate, clear, centerInStrip } from '../dom.js';
import { store, loadJson, loadLesson, isDone } from '../store.js';
import { icon } from '../ui/icons.js';
import { renderBlocks, speakBtn } from '../ui/blocks.js';
import { ring } from '../ui/widgets.js';
import { mindMap } from '../ui/mindmap.js';

export default async function chapter({ id, view = 'overview' }) {
  const c = store.manifest.chapters.find((x) => x.id === id);
  if (!c) throw new Error('Chapter not found');
  const done = c.lessons.filter((l) => isDone(l.id)).length;

  const tabs = h('div.seg-tabs', { role: 'tablist' }, [['overview', 'Overview'], ['recap', 'Recap'], ['map', 'Mind map']].map(([key, label]) =>
    h('a.seg-tab', { href: `#/chapter/${id}${key === 'overview' ? '' : '/' + key}`, role: 'tab', 'aria-selected': String(view === key), class: view === key ? 'active' : '' }, label)));
  const body = h('div.chapter-body');
  const page = h('div.page.chapter', {}, h('a.back', { href: '#/learn' }, icon('back', 18), 'Lessons'),
    h('p.eyebrow', {}, 'Chapter ', c.number), h('h1', {}, c.title), h('p.muted', {}, c.blurb || c.subtitle), tabs, body);

  if (view === 'recap') body.append(await recapView(c));
  else if (view === 'map') body.append(await mapView(c));
  else body.append(overview(c, done));
  return page;
}

function overview(c, done) {
  return h('div.reveal-in', {},
    h('div.card.ch-prog', {}, ring({ value: done / (c.lessons.length || 1), size: 84, stroke: 9, center: h('span.ring-n', {}, `${done}/${c.lessons.length}`) }),
      h('div', {}, h('h3', {}, done === c.lessons.length ? 'Chapter complete' : `${c.lessons.length - done} lesson${c.lessons.length - done === 1 ? '' : 's'} to go`),
        h('p.muted.small', {}, 'Recap and mind map are always available — handy before a new lesson.'))),
    h('div.two', {}, c.recap ? h('a.card.tile', { href: `#/chapter/${c.id}/recap` }, icon('book', 28), h('strong', {}, 'Chapter recap'), h('small', {}, 'Concepts, grammar, vocabulary, rules and mistakes')) : null,
      c.mindmap ? h('a.card.tile', { href: `#/chapter/${c.id}/map` }, icon('map', 28), h('strong', {}, 'Mind map'), h('small', {}, 'See how every idea connects')) : null),
    h('h3.sec-title', {}, 'Lessons'),
    h('div.stack', {}, c.lessons.map((l) => h(l.published ? 'a.card.row' : 'div.card.row.off', { href: l.published ? `#/lesson/${l.id}` : null },
      h('span.row-n', {}, isDone(l.id) ? icon('check', 18) : l.number), h('div', {}, h('strong', {}, l.title), h('small.muted', {}, l.subtitle)), icon(l.published ? 'chevron' : 'lock', 18)))));
}

// ───────── recap ─────────
async function recapView(c) {
  if (!c.recap) return h('p.muted', {}, 'The recap for this chapter is coming soon.');
  const data = await loadJson(c.recap);
  const secs = data.sections;
  const nav = h('nav.recap-nav', { 'aria-label': 'Recap sections' }, secs.map((s) => h('a.rn-chip', { href: `#${s.id}`, dataset: { sec: s.id }, onclick: (e) => { e.preventDefault(); document.getElementById(`rc-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, icon(s.icon || 'book', 16), s.title)));
  const wrap = h('div.recap', {}, data.intro ? h('p.recap-intro', { html: data.intro }) : null, nav);

  for (const s of secs) {
    const sec = h('section.recap-sec.card', { id: `rc-${s.id}` }, h('div.rs-head', {}, icon(s.icon || 'book', 22), h('h2', {}, s.title)));
    for (const b of s.blocks) sec.append(...await expand(b));
    wrap.append(sec);
  }
  // scroll-spy + reveal
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) {
      en.target.classList.add('seen');
      nav.querySelectorAll('.rn-chip').forEach((a) => a.classList.toggle('active', `rc-${a.dataset.sec}` === en.target.id));
      centerInStrip(nav, nav.querySelector('.rn-chip.active'));
    }
  }, { rootMargin: '-35% 0px -55% 0px' });
  requestAnimationFrame(() => wrap.querySelectorAll('.recap-sec').forEach((s) => io.observe(s)));
  return wrap;
}

/** Recap-only block types that pull from the lesson files, so vocabulary is never retyped. */
async function expand(b) {
  if (b.type === 'vocab_from_lessons') {
    const out = [];
    for (const id of b.lessons) {
      const l = await loadLesson(id).catch(() => null);
      if (!l || !l.vocab.length) continue;
      out.push(h('h3.group', {}, `Lesson ${l.number} · ${l.title}`),
        h('div.vocab-chips', {}, l.vocab.map((v) => h('span.vchip', {}, h('span.pali', {}, v.pali.join(' / ')), h('small', {}, v.english.join(', ')), speakBtn(v.pali[0], 14)))));
    }
    return out;
  }
  if (b.type === 'steps') {      // numbered "how to build a sentence" walkthrough
    return [h('ol.steps', {}, b.items.map((it, i) => h('li', { style: { '--i': i } }, h('span.step-n', {}, i + 1), h('div', { html: it })))) ];
  }
  if (b.type === 'takeaways') {
    return [h('ul.takeaways', {}, b.items.map((it, i) => h('li', { style: { '--i': i } }, icon('check', 18), h('span', { html: it }))))];
  }
  return renderBlocks([b]);
}

// ───────── mind map ─────────
async function mapView(c) {
  if (!c.mindmap) return h('p.muted', {}, 'The mind map for this chapter is coming soon.');
  const data = await loadJson(c.mindmap);
  return h('div', {}, h('p.muted.small', {}, 'Drag to move, pinch or scroll to zoom. Tap an idea to see what it connects to; tap + to open a branch.'), mindMap(data));
}
