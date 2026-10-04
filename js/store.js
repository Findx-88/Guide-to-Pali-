// Client state: content manifest (static JSON) + learner state (server). The server is the source of truth;
// `applyProgress` patches the local copy instantly from each progress response so the UI never waits.
import { api, bus } from './api.js';

export const store = {
  manifest: null,
  state: null,
  lessonCache: new Map(),
  events: new EventTarget(),
};

const emit = (name) => store.events.dispatchEvent(new Event(name));
export const on = (name, fn) => { store.events.addEventListener(name, fn); return () => store.events.removeEventListener(name, fn); };

export async function loadManifest() {
  if (store.manifest) return store.manifest;
  const res = await fetch('content/manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load the course. Please refresh.');
  store.manifest = await res.json();
  return store.manifest;
}

export async function loadLesson(id) {
  if (store.lessonCache.has(id)) return store.lessonCache.get(id);
  const meta = findLesson(id)?.lesson;
  if (!meta) throw new Error('Lesson not found');
  const res = await fetch(meta.file, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load this lesson.');
  const data = await res.json();
  store.lessonCache.set(id, data);
  return data;
}

export async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load content.');
  return res.json();
}

let lexiconPromise = null;
export const loadLexicon = () => (lexiconPromise ||= loadJson('content/lexicon.json'));
export async function loadAllLessons() {
  const ids = allLessons().map((l) => l.id);
  return Promise.all(ids.map((id) => loadLesson(id).catch(() => null))).then((a) => a.filter(Boolean));
}

export async function refresh() {
  store.state = await api('/api/state');
  emit('state');
  return store.state;
}

/** Merge the snapshot returned by POST /api/progress into local state immediately. */
export function applyProgress(res) {
  if (!res || !store.state) return;
  const s = store.state;
  s.stats.totalXp = res.totalXp; s.stats.level = res.level; s.stats.levelProgress = res.levelProgress; s.stats.streak = res.streak;
  s.today.xp = res.today.xp; s.today.goalMet = res.today.goalMet;
  for (const a of res.newAchievements || []) s.achievements[a.id] = new Date().toISOString();
  emit('state');
}

export function findLesson(id) {
  for (const chapter of store.manifest?.chapters || []) {
    const lesson = chapter.lessons.find((l) => l.id === id);
    if (lesson) return { chapter, lesson };
  }
  return null;
}

export function allLessons() {
  return (store.manifest?.chapters || []).flatMap((c) => c.lessons.map((l) => ({ ...l, chapterId: c.id, chapterNumber: c.number })));
}

export const lessonStatus = (id) => store.state?.lessons[id]?.status || 'new';
export const isDone = (id) => lessonStatus(id) === 'completed';

bus.addEventListener('auth:lost', () => emit('auth:lost'));
