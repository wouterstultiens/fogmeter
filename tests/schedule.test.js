import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordListForDay, fluencyPrompt, dayIndex } from '../docs/js/schedule.js';
import { WORDS } from '../docs/js/data/words_nl.js';

const tagOf = new Map(WORDS.map(([w, t]) => [w, t]));

test('dayIndex counts calendar days from the epoch', () => {
  assert.equal(dayIndex('2026-09-01'), 0);
  assert.equal(dayIndex('2026-10-01'), 30);
  assert.equal(dayIndex('2027-03-28'), 208); // across DST
});

test('word lists: 12 unique words, no letter/category collision, no repeats within 90 days', () => {
  const lastSeen = new Map();
  for (let d = 0; d < 400; d++) {
    const list = wordListForDay(d);
    const p = fluencyPrompt(d);
    assert.equal(list.length, 12);
    assert.equal(new Set(list).size, 12);
    for (const w of list) {
      if (p.mode === 'letter') assert.notEqual(w[0].toUpperCase(), p.letter, `day ${d}: ${w}`);
      if (p.mode === 'category' && p.tag === 'animal') assert.ok(!['animal', 'bird', 'fish', 'insect'].includes(tagOf.get(w)), `day ${d}: ${w}`);
      else if (p.mode === 'category' && p.tag) assert.notEqual(tagOf.get(w), p.tag, `day ${d}: ${w}`);
      if (lastSeen.has(w)) assert.ok(d - lastSeen.get(w) >= 90, `${w} repeated after ${d - lastSeen.get(w)} days`);
      lastSeen.set(w, d);
    }
    const tags = list.map((w) => tagOf.get(w)).filter((t) => t !== 'other');
    assert.equal(new Set(tags).size, tags.length, `day ${d}: semantic cluster`);
  }
});

test('word lists are deterministic regardless of call order', () => {
  const a = wordListForDay(120).join();
  wordListForDay(5);
  assert.equal(wordListForDay(120).join(), a);
});

test('fluency alternates letter and category days', () => {
  assert.equal(fluencyPrompt(10).mode, 'letter');
  assert.equal(fluencyPrompt(11).mode, 'category');
  const cats = new Set();
  for (let d = 1; d < 120; d += 2) cats.add(fluencyPrompt(d).category);
  assert.equal(cats.size, 60); // no category repeats within 120 days
});
