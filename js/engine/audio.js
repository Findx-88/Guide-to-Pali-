// Pronunciation helper (Web Speech API). Pāli has no TTS voice, so text is respelled phonetically for an
// Indian-English voice — ported unchanged from the original lesson pages, now shared and voice-cached.
const MAP = {
  cch: 'tch', jh: 'djh', 'ñj': 'ndj', 'ñc': 'nch', 'ṭh': 'th', 'ḍh': 'dh', kh: 'kh', gh: 'gh', th: 'th', dh: 'dh', ph: 'ph', bh: 'bh',
  'ā': 'aaa', 'ī': 'eee', 'ū': 'ooo', e: 'ay', o: 'oh',
  c: 'ch', j: 'dj', 'ñ': 'ny', 'ṅ': 'ng', 'ṭ': 't', 'ḍ': 'd', 'ṇ': 'n', 'ṃ': 'm', 'ḷ': 'l',
};
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
const RE = new RegExp(KEYS.join('|'), 'gi');

let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() || [];
  if (!vs.length) return;
  voice = vs.find((v) => /heera|kalpana|neerja/i.test(v.name)) || vs.find((v) => v.lang === 'en-IN') || vs.find((v) => v.lang === 'hi-IN') || vs.find((v) => v.lang.startsWith('en')) || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }

export const canSpeak = () => !!window.speechSynthesis;

export function speakPali(text) {
  if (!window.speechSynthesis) return;
  const phonetic = String(text).replace(/<[^>]+>/g, '').replace(RE, (m) => MAP[m.toLowerCase()] ?? m);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(phonetic);
  u.lang = 'en-IN'; u.rate = 0.85;
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
