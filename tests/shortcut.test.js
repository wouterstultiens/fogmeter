import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStamp, parseStamps, parseSteps, plausible } from '../docs/js/shortcut.js';

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

test('parseStamps reads every stamp from an appended file', () => {
  const list = parseStamps('2026-09-28T22:41\n2026-09-28T23:58\n2026-09-29T00:12\n');
  assert.equal(list.length, 3);
  assert.equal(list[2].getHours(), 0);
  assert.deepEqual(parseStamps(''), []);
});

test('bed is the latest stamp in last night\'s 20:00–04:00 window', () => {
  const now = new Date(2026, 8, 29, 7, 30);
  const wake = new Date(2026, 8, 29, 7, 2);
  const at = (d, H, M) => new Date(2026, 8, d, H, M);
  const bed = [
    at(27, 23, 50), // two nights ago
    at(28, 15, 0), // afternoon timer
    at(28, 22, 41),
    at(29, 0, 12), // latest alarm set
    at(29, 6, 50), // morning, outside the window
  ];
  assert.equal(plausible({ wake, bed, steps: null }, now).bed.getTime(), at(29, 0, 12).getTime());
  assert.equal(plausible({ wake, bed: [at(29, 4, 0)], steps: null }, now).bed.getTime(), at(29, 4, 0).getTime());
  assert.equal(plausible({ wake, bed: [at(29, 4, 1), at(28, 19, 59)], steps: null }, now).bed, null);
  assert.equal(plausible({ wake, bed: [], steps: null }, now).bed, null);
});
