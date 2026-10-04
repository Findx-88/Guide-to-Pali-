// Renders lesson/recap content blocks. Content HTML is authored by the site owner in /content (trusted).
//   heading · prose · callout · rule · table · html · list · mistakes · pairs
import { h } from '../dom.js';
import { icon } from './icons.js';
import { speakPali, canSpeak } from '../engine/audio.js';

export const speakBtn = (text, size = 18) => canSpeak()
  ? h('button.speak', { type: 'button', 'aria-label': 'Hear pronunciation', onclick: (e) => { e.stopPropagation(); speakPali(text); } }, icon('speaker', size))
  : null;

export function renderBlock(b) {
  switch (b.type) {
    case 'heading':
      return h('div.blk.heading', {}, b.eyebrow ? h('p.eyebrow', {}, b.eyebrow) : null, h(b.level === 3 ? 'h3' : 'h2', { html: b.html }));
    case 'prose':
      return h('p.blk.prose', { html: b.html });
    case 'callout':
      return h('div.blk.callout', {}, icon('sparkle', 20), h('p', { html: b.html }));
    case 'rule':
      return h('div.blk.rule', {}, h('p.rule-title', { html: b.title }), b.formulas.map((f) => h('p.rule-formula', { html: f })));
    case 'table':
      return h('div.blk.tbl-wrap', {}, h('table.tbl', {},
        b.caption ? h('caption', { html: b.caption }) : null,
        h('thead', {}, h('tr', {}, b.head.map((c) => h('th', { html: c })))),
        h('tbody', {}, b.rows.map((r) => h('tr', {}, r.map((c) => h('td', { html: c })))))));
    case 'list':
      return h('ul.blk.list', {}, b.items.map((i) => h('li', { html: i })));
    case 'mistakes':
      return h('div.blk.mistakes', {}, b.items.map((m) => h('div.mistake', {},
        h('div.m-bad', {}, icon('x', 16), h('span', { html: m.wrong })),
        h('div.m-good', {}, icon('check', 16), h('span', { html: m.right })),
        m.why ? h('p.m-why', { html: m.why }) : null)));
    case 'pairs':        // Pāli ⇄ English rows, e.g. sentence patterns / examples
      return h('div.blk.pairs', {}, b.items.map((p) => h('div.pair', {}, h('div.pair-pali', {}, h('span.pali', { html: p.pali }), speakBtn(p.pali.replace(/<[^>]+>/g, ''))), h('div.pair-en', { html: p.english }))));
    case 'html':
    default:
      return h('div.blk', { html: b.html });
  }
}

export const renderBlocks = (blocks) => blocks.map(renderBlock);
