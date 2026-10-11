import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordListForDay, dayIndex, practiceList, syllables } from '../docs/js/schedule.js';
import { WORDS } from '../docs/js/data/words_nl.js';

const tagOf = new Map(WORDS.map(([w, t]) => [w, t]));

test('dayIndex counts calendar days from the epoch', () => {
  assert.equal(dayIndex('2026-09-01'), 0);
  assert.equal(dayIndex('2026-10-01'), 30);
  assert.equal(dayIndex('2027-03-28'), 208); // across DST
});

test('word lists: 12 unique words, no semantic clusters, no repeats within 90 days', () => {
  const lastSeen = new Map();
  for (let d = 0; d < 500; d++) {
    const list = wordListForDay(d);
    assert.equal(list.length, 12);
    assert.equal(new Set(list).size, 12);
    for (const w of list) {
      if (lastSeen.has(w)) assert.ok(d - lastSeen.get(w) >= 90, `${w} repeated after ${d - lastSeen.get(w)} days`);
      lastSeen.set(w, d);
    }
    const tags = list.map((w) => tagOf.get(w)).filter((t) => t !== 'other');
    assert.equal(new Set(tags).size, tags.length, `day ${d}: semantic cluster`);
  }
});

test('lists from before the syllable balance are unchanged', () => {
  assert.equal(wordListForDay(dayIndex('2026-09-29')).join(' '),
    'gevel helling nek vaas rits eitje majoor slagboom ruit douche eik beer');
  assert.equal(wordListForDay(dayIndex('2026-10-11')).join(' '),
    'strandtent dal hout spook wezel raaf oksel snoer dwarsfluit kapstok boerka zonlicht');
});

test('from 2026-10-12 every list has 5 one-syllable and 7 two-syllable words', () => {
  for (let d = dayIndex('2026-10-12'); d < 500; d++) {
    const n = wordListForDay(d).map(syllables);
    assert.equal(n.filter((s) => s === 1).length, 5, `day ${d}`);
    assert.equal(n.filter((s) => s === 2).length, 7, `day ${d}`);
  }
});

test('syllables: vowel groups, ij as one vowel, exceptions', () => {
  assert.equal(syllables('kat'), 1);
  assert.equal(syllables('sneeuw'), 1);
  assert.equal(syllables('ijs'), 1);
  assert.equal(syllables('wezel'), 2);
  assert.equal(syllables('douche'), 1);
  assert.equal(syllables('viool'), 2);
  for (const [w] of WORDS) assert.ok([1, 2].includes(syllables(w)), w);
});

test('practice lists are balanced too', () => {
  const n = practiceList().map(syllables);
  assert.equal(n.filter((s) => s === 1).length, 5);
});

test('word lists are deterministic regardless of call order', () => {
  const a = wordListForDay(120).join();
  wordListForDay(5);
  assert.equal(wordListForDay(120).join(), a);
});

test('practice lists have 12 words', () => {
  assert.equal(practiceList().length, 12);
});
