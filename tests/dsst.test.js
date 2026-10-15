import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKey, digitSource, SYMBOLS } from '../docs/js/tasks/dsst.js';
import { mulberry32 } from '../docs/js/schedule.js';

test('the key uses all nine symbols once, in a new order each day', () => {
  const keys = Array.from({ length: 50 }, (_, i) => makeKey(mulberry32(i)));
  for (const k of keys) assert.deepEqual(k.slice().sort(), SYMBOLS.map((_, i) => i));
  assert.ok(new Set(keys.map((k) => k.join())).size > 45);
});

test('digits come in balanced blocks of 1–9, never the same twice in a row', () => {
  const next = digitSource(mulberry32(5));
  const seq = Array.from({ length: 9 * 40 }, next);
  for (let b = 0; b < 40; b++) assert.deepEqual(seq.slice(b * 9, b * 9 + 9).sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
});
