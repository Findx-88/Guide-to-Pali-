// One answer checker for the whole app (the old site had two that disagreed).
//   • English: case/punctuation/articles ignored (Pāli has no articles, so they are never testable).
//   • Pāli:    typed text is canonicalised (NFC, ṁ→ṃ). In "lenient" mode (practice exercises) a missing diacritic
//              is accepted but flagged; in "strict" mode (mastery quiz levels 2–3) diacritics must be exact.
import { canonical, stripMarks } from '../keyboard/map.js';

const normEnglish = (s) => canonical(s).toLowerCase()
  .replace(/[.,!?;:"“”‘’()]/g, ' ').replace(/\b(a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
const normPali = (s) => canonical(s).toLowerCase().replace(/[.,!?;:"“”‘’()]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * @param {string} input   what the learner typed
 * @param {string[]} accepted  every accepted answer (first = display answer)
 * @param {'english'|'pali'} lang  language of the *answer*
 * @param {{strict?: boolean}} opts
 * @returns {{correct: boolean, exact: boolean, expected: string}}
 */
export function checkAnswer(input, accepted, lang, { strict = false } = {}) {
  const expected = accepted[0];
  const typed = lang === 'pali' ? normPali(input) : normEnglish(input);
  if (!typed) return { correct: false, exact: false, expected };

  if (lang === 'english') {
    const ok = accepted.some((a) => normEnglish(a) === typed);
    return { correct: ok, exact: ok, expected };
  }
  if (accepted.some((a) => normPali(a) === typed)) return { correct: true, exact: true, expected };
  if (!strict && accepted.some((a) => stripMarks(a).replace(/[.,!?;:"“”‘’()]/g, ' ').replace(/\s+/g, ' ').trim() === stripMarks(typed))) {
    return { correct: true, exact: false, expected };      // right word, marks missing → accept + teach
  }
  return { correct: false, exact: false, expected };
}

/** Exercise item → who answers in which language. `to_english` items answer in English, `to_pali` in Pāli. */
export const answerLang = (exerciseKind) => (exerciseKind === 'to_pali' ? 'pali' : 'english');
export const acceptedFor = (item) => [item.answer, ...(item.alts || [])];
