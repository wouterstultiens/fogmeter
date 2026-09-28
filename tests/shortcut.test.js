import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStamp, parseSteps, plausible } from '../docs/js/shortcut.js';

test('parseStamp accepts T, space and dot separators', () => {
  assert.equal(parseStamp('2026-09-29T07:02').getHours(), 7);
  assert.equal(parseStamp('2026-09-29 07.02').getMinutes(), 2);
  assert.equal(parseStamp('rubbish'), null);
  assert.equal(parseStamp(''), null);
});

test('parseSteps handles Dutch thousands separators and decimals', () => {
  assert.equal(parseSteps('8412'), 8412);
  assert.equal(parseSteps('8.412'), 8412);
  assert.equal(parseSteps('8,412'), 8412);
  assert.equal(parseSteps('8412,6'), 8413);
  assert.equal(parseSteps(''), null);
  assert.equal(parseSteps('abc'), null);
});

test('plausible rejects stale wake and bed stamps', () => {
  const now = new Date(2026, 8, 29, 7, 30);
  const p = plausible({ wake: new Date(2026, 8, 29, 7, 2), bed: new Date(2026, 8, 28, 23, 10), steps: 5 }, now);
  assert.ok(p.wake && p.bed);
  const stale = plausible({ wake: new Date(2026, 8, 28, 7, 2), bed: new Date(2026, 8, 29, 6, 0), steps: null }, now);
  assert.equal(stale.wake, null);
  assert.equal(stale.bed, null);
});
