// Public landing page (signed-out). The original home page's content, unchanged, in the clean layout.
import { h } from '../dom.js';
import { store } from '../store.js';
import { icon } from '../ui/icons.js';
import { signInCard } from './login.js';

export default function landing(onSignedIn) {
  const goSignIn = (e) => { e?.preventDefault(); document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const roman = ['', 'I', 'II', 'III', 'IV', 'V'];
  const first = store.manifest.chapters.flatMap((c) => c.lessons).slice(0, 5);

  return h('div.landing', {},
    h('header.land-nav', {}, h('a.brand', { href: '#' }, icon('lotus', 26), h('span', {}, 'Guide to ', h('em', {}, 'Pāli'))), h('a.btn.btn-primary.btn-sm', { href: '#signin', onclick: goSignIn }, 'Sign in')),

    h('section.hero', {}, h('div.hero-left', {},
      h('p.eyebrow', {}, 'A step-by-step primer'),
      h('h1', {}, 'Learn the ', h('em', {}, 'Sacred'), ' Language of the Dhamma'),
      h('p.hero-sub', {}, 'Pāli, as taught by Lily de Silva'),
      h('p.hero-desc', {}, 'Pāli is the language of the Theravāda Buddhist canon — the texts in which the Buddha’s teachings were first recorded. This guided course follows the structure of Lily de Silva’s beloved ', h('em', {}, 'Pāli Primer'), ', teaching grammar through sentence composition, step by patient step.'),
      h('div.hero-actions', {}, h('a.btn.btn-primary', { href: '#signin', onclick: goSignIn }, 'Start Learning'), h('a.btn.btn-ghost', { href: '#curriculum', onclick: (e) => { e.preventDefault(); document.getElementById('curriculum')?.scrollIntoView({ behavior: 'smooth' }); } }, 'View All Lessons'))),
      h('div.hero-right', {}, h('div.manuscript.card', { id: 'curriculum' },
        h('p.eyebrow', {}, 'Pāli Primer · Table of Contents'), h('p.ms-pali', {}, 'Namo Tassa ', h('em', {}, 'Bhagavato')),
        first.map((l) => h('div.ms-row', {}, h('span.ms-num', {}, roman[l.number] || l.number), h('span.ms-name', {}, l.title), h('span.ms-badge', {}, 'Active'))),
        h('div.ms-row', {}, h('span.ms-num', {}, '···'), h('span.ms-name.muted', {}, '27 more lessons'), h('span.ms-badge.off', {}, '· · ·')),
        h('p.ms-foot', {}, 'Following the method of Lily de Silva, M.A., Ph.D.')),
        h('div.stat-banner', {}, [['32', 'Lessons'], ['8', 'Cases'], ['400+', 'Vocabulary words']].map(([n, l]) => h('div.sb', {}, h('strong', {}, n), h('small', {}, l)))))),

    h('section.land-sec', {}, h('div.land-two', {},
      h('div', {}, h('h2', {}, 'Grammar through ', h('em', {}, 'composition')), h('p', {}, 'Unlike traditional grammar books that demand rote memorisation of declension tables, this course follows Lily de Silva’s approach: ', h('strong', {}, 'learn by forming sentences'), '.')),
      h('div', {}, h('h2', {}, 'A primer long ', h('em', {}, 'overdue')), h('p', {}, 'The ', h('em', {}, 'Pāli Primer'), ' remains the gold standard for introductory study. This platform preserves her pedagogical structure while adding structured exercises and progress tracking.'))),
      h('blockquote.pull', {}, h('p', {}, '“Straight away we got down to making sentences which became longer, more interesting and complex.”'), h('cite', {}, '— Lily de Silva')),
      h('div.land-three', {},
        h('div.card', {}, h('h3', {}, 'Cumulative Learning'), h('p.muted', {}, 'Cases are introduced one by one, mastering each function before moving forward.')),
        h('div.card', {}, h('h3', {}, 'High-Frequency Vocabulary'), h('p.muted', {}, 'Most frequently used words in the Pāli canon.')),
        h('div.card.author', {}, h('p.eyebrow', {}, 'Based on the work of'), h('h3', {}, 'Lily de Silva'), h('p.muted', {}, 'Author of the ', h('em', {}, 'Pāli Primer'), '. Her teaching method has guided thousands of students into the language of the Dhamma.')))),

    h('section.land-sec', {}, h('div.land-three', {},
      h('div.card.feat', {}, icon('book', 30), h('h3', {}, 'Structured Grammar Lessons'), h('p.muted', {}, 'Each lesson presents one grammatical form with clear tables, worked examples, and translations — both Pāli to English and English to Pāli.')),
      h('div.card.feat', {}, icon('cards', 30), h('h3', {}, 'Spaced Repetition Flashcards'), h('p.muted', {}, 'Practise vocabulary with intelligent flashcards. Words you struggle with reappear more often. Track mastery from New → Learning → Familiar → Mastered.')),
      h('div.card.feat', {}, icon('keyboard', 30), h('h3', {}, 'Searchable Vocabulary'), h('p.muted', {}, 'A full glossary of all Pāli words introduced across every lesson — searchable by Pāli or English, and by any grammatical form, with every case shown.')))),

    h('section.land-cta', {}, h('p.eyebrow', {}, 'Begin your journey'), h('h2', {}, 'Namo Tassa ', h('em', {}, 'Bhagavato')),
      h('p.muted', {}, 'Homage to the Blessed One. Open Lesson I and form your first Pāli sentence — today.'), signInCard(onSignedIn)),

    h('footer.land-foot', {}, h('p.brand-foot', {}, 'Guide to ', h('em', {}, 'Pāli')), h('p', {}, 'Based on ', h('em', {}, 'Pāli Primer'), ' by Lily de Silva, Vipassana Research Institute, 1991.'), h('p.pali', {}, 'Sabbe sattā bhavantu sukhitattā')));
}
