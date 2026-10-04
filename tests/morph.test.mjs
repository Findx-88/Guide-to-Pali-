import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { nounForms, verbForms, buildIndex, search, parseQuery, describe: say, CASES } = await import('../js/engine/morph.js');
const lexicon = JSON.parse(readFileSync(new URL('../content/lexicon.json', import.meta.url), 'utf8'));
const index = buildIndex(lexicon);
const forms = (t, c, n) => t[c][n].map((f) => f.form);

test('nara declines exactly as the Primer teaches (all eight cases)', () => {
  const t = nounForms('nara', 'm');
  assert.deepEqual(forms(t, 'nom', 'sg'), ['naro']);
  assert.deepEqual(forms(t, 'nom', 'pl'), ['narā']);
  assert.deepEqual(forms(t, 'voc', 'sg'), ['nara']);
  assert.deepEqual(forms(t, 'acc', 'sg'), ['naraṃ']);
  assert.deepEqual(forms(t, 'acc', 'pl'), ['nare']);
  assert.deepEqual(forms(t, 'ins', 'sg'), ['narena']);
  assert.deepEqual(forms(t, 'ins', 'pl'), ['narehi', 'narebhi']);
  assert.deepEqual(forms(t, 'abl', 'sg'), ['narā', 'naramhā', 'narasmā']);
  assert.deepEqual(forms(t, 'dat', 'sg'), ['narāya', 'narassa']);
  assert.deepEqual(forms(t, 'dat', 'pl'), ['narānaṃ']);
  assert.deepEqual(forms(t, 'gen', 'sg'), ['narassa']);
  assert.deepEqual(forms(t, 'loc', 'sg'), ['nare', 'naramhi', 'narasmiṃ']);
  assert.deepEqual(forms(t, 'loc', 'pl'), ['naresu']);
  assert.ok(t.ins.pl[1].archaic, 'narebhi is flagged archaic');
});

test('neuter nouns differ only in Nom / Voc / Acc', () => {
  const t = nounForms('phala', 'n');
  assert.deepEqual(forms(t, 'nom', 'sg'), ['phalaṃ']);
  assert.deepEqual(forms(t, 'acc', 'pl'), ['phalāni']);
  assert.deepEqual(forms(t, 'ins', 'sg'), ['phalena']);
  assert.deepEqual(forms(t, 'loc', 'pl'), ['phalesu']);
});

test('verb forms: regular pattern and irregular overrides', () => {
  const p = verbForms('pacati');
  assert.deepEqual([p.present.pl[0], p.gerund[0], p.infinitive[0], p.participle[0], p.participle[1]], ['pacanti', 'pacitvā', 'pacituṃ', 'pacanta', 'pacamāna']);
  const g = verbForms('gacchati', { gerund: ['gantvā'], infinitive: ['gantuṃ'] });
  assert.deepEqual([g.present.pl[0], g.gerund[0], g.infinitive[0], g.participle[0]], ['gacchanti', 'gantvā', 'gantuṃ', 'gacchanta']);
  const d = verbForms('dadāti', { pres3pl: 'dadanti', gerund: ['datvā'], infinitive: ['dātuṃ'], participle: 'dadanta' });
  assert.equal(d.present.pl[0], 'dadanti');
  assert.deepEqual(verbForms('sakkoti', { pres3pl: 'sakkonti', gerund: [], infinitive: [], participle: null }).participle, []);
});

test('searching an inflected form identifies word, meaning and case', () => {
  const r = search(index, 'narasmiṃ');
  assert.equal(r[0].entry.id, 'nara');
  assert.deepEqual(r[0].matches.filter((m) => m.via === 'form').map((m) => say(m.row)), ['Locative singular']);
  assert.deepEqual(r[0].entry.meaning, ['man', 'person']);
});

test('diacritics are optional in the search box', () => {
  assert.equal(search(index, 'narasmim')[0].entry.id, 'nara');
  assert.equal(search(index, 'kumaro')[0].entry.id, 'kumāra');
  assert.equal(search(index, 'bhikkhu').length, 0);
});

test('ambiguous forms list every analysis', () => {
  const r = search(index, 'narā').find((x) => x.entry.id === 'nara');
  const names = r.matches.filter((m) => m.via === 'form').map((m) => say(m.row)).sort();
  assert.deepEqual(names, ['Ablative singular', 'Nominative plural', 'Vocative plural']);
  const g = search(index, 'narassa')[0].matches.map((m) => say(m.row)).sort();
  assert.deepEqual(g, ['Dative singular', 'Genitive singular']);
});

test('typing the dictionary word is not mislabelled as a grammatical form', () => {
  const r = search(index, 'nara')[0];
  assert.equal(r.entry.id, 'nara');
  assert.ok(r.matches.every((m) => m.via !== 'form'));
});

test('English search and verb forms', () => {
  assert.ok(search(index, 'man').some((r) => r.entry.id === 'nara' && r.matches.some((m) => m.via === 'meaning')));
  const g = search(index, 'gantvā')[0];
  assert.equal(g.entry.id, 'gacchati');
  assert.equal(say(g.matches[0].row), 'Gerund');
  assert.equal(search(index, 'disvā')[0].entry.id, 'passati');
  assert.equal(search(index, 'daṭṭhuṃ')[0].entry.id, 'passati');
});

test('grammar words narrow the search: "nara locative"', () => {
  const p = parseQuery('nara locative');
  assert.deepEqual([p.text, p.case], ['nara', 'loc']);
  const r = search(index, 'nara locative');
  assert.equal(r[0].entry.id, 'nara');
  assert.equal(r[0].focus.case, 'loc');
  assert.equal(parseQuery('man').case, null);
});

test('every lexicon word produces at least one form and no empty strings', () => {
  for (const e of lexicon) {
    const rows = index.rowsById.get(e.id);
    assert.ok(rows.length > 0, e.id);
    for (const r of rows) assert.ok(r.form && !/undefined/.test(r.form), `${e.id}: ${r.form}`);
  }
  assert.equal(CASES.length, 8);
});
