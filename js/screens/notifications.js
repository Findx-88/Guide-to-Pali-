import { h } from '../dom.js';
import { api } from '../api.js';
import { store, refresh } from '../store.js';
import { icon } from '../ui/icons.js';

const ICON = { daily: 'sun', streak: 'flame', continue: 'path', achievement: 'star', chapter: 'wheel' };
const ago = (iso) => {
  const t = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export default async function notifications() {
  if (store.state.guest) {
    const { signInCard } = await import('./login.js');
    return h('div.page', {}, h('h1', {}, 'Notifi', h('em', {}, 'cations')),
      h('p.muted', {}, 'Sign in to save your progress, keep a daily streak, earn achievements and continue on any device. Reading the lessons is always free.'),
      signInCard(async () => location.reload()));
  }
  const { items } = await api('/api/notifications');
  const list = h('div.stack', {}, items.length ? items.map((n) =>
    h(n.link ? 'a.card.notif' : 'div.card.notif', { href: n.link, class: n.readAt ? '' : 'unread' },
      h('span.n-ic', {}, icon(ICON[n.type] || 'bell', 20)), h('div', {}, h('strong', {}, n.title), h('p.muted.small', {}, n.body)), h('small.muted', {}, ago(n.createdAt))))
    : h('div.empty', {}, icon('bell', 44), h('h3', {}, 'You’re all caught up'), h('p.muted', {}, 'Reminders and achievements will appear here.')));
  if (store.state.unread) api('/api/notifications/read', { method: 'POST', body: {} }).then(() => { store.state.unread = 0; refresh().catch(() => {}); }).catch(() => {});
  return h('div.page', {}, h('h1', {}, 'Notifi', h('em', {}, 'cations')), h('a.muted.small', { href: '#/profile' }, 'Manage reminders in Settings →'), list);
}
