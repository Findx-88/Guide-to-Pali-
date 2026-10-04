import test from 'node:test';
import assert from 'node:assert/strict';

// map.js touches `navigator`/`matchMedia` only inside functions, so it imports cleanly in Node.
const { SEQUENCES, LETTERS, canonical, stripMarks } = await import('../js/keyboard/map.js');
const { convertTail, applyEdit } = await import('../js/keyboard/convert.js');

const type = (s) => {                         // simulate typing character by character with auto-convert
  let v = '';
  for (const ch of s) {
    v += ch;
    const e = convertTail(v, v.length);
    if (e) v = applyEdit(v, e);
  }
  return v;
};

test('every letter has a lowercase and uppercase sequence', () => {
  for (const l of LETTERS) {
    assert.equal(SEQUENCES[l.velthuis], l.lower, `${l.velthuis} → ${l.lower}`);
    assert.ok(Object.values(SEQUENCES).includes(l.upper), `uppercase of ${l.lower} reachable`);
  }
});

test('typing real Pāli words', () => {
  assert.equal(type('naraa'), 'narā');
  assert.equal(type('braahma.na'), 'brāhmaṇa');
  assert.equal(type('Kumaaro dhaavati.'), 'Kumāro dhāvati.');
  assert.equal(type('bhu~njati'), 'bhuñjati');
  assert.equal(type('nara.m'), 'naraṃ');
  assert.equal(type('Aananda'), 'Ānanda');
  assert.equal(type('ma.t.ta'), 'maṭṭa');
  assert.equal(type('piiti'), 'pīti');
  assert.equal(type('suuriya'), 'sūriya');
  assert.equal(type('sa"nkhaara'), 'saṅkhāra');
  assert.equal(type('ka.laa'), 'kaḷā');
});

test('does not mangle ordinary text', () => {
  assert.equal(type('Naro bhasati'), 'Naro bhasati');
  assert.equal(type('3.n'), '3.n', 'dot after a digit is left alone');
  assert.equal(type('a a'), 'a a');
});

test('canonical() folds variants and decomposed marks', () => {
  assert.equal(canonical('nāra'), 'nāra');            // a + combining macron → ā
  assert.equal(canonical('naraṁ'), 'naraṃ');                // ṁ treated as ṃ
  assert.equal(canonical('ṃ'), 'ṃ');                  // m + combining dot below → ṃ
});

test('stripMarks() compares leniently', () => {
  assert.equal(stripMarks('Kumārā bhuñjanti'), 'kumara bhunjanti');
  assert.equal(stripMarks('naraṃ'), 'naram');
  assert.equal(stripMarks('ṭhāna ḍaṃsa ḷ'), 'thana damsa l');
});
