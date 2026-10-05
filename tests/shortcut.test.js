import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStamps, parseSteps, sleepFromUse } from '../docs/js/shortcut.js';

const at = (day, H, M = 0) => new Date(2026, 8, day, H, M);
const hm = (d) => d && `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const now = at(29, 7, 20);

test('parseStamps reads every stamp, whatever the separators', () => {
  const s = parseStamps('2026-09-28T23:14\n2026-09-29 06.58,rubbish 2026-09-29T07:02\n-');
  assert.deepEqual(s.map(hm), ['28 23:14', '29 6:58', '29 7:02']);
  assert.deepEqual(parseStamps(''), []);
  assert.deepEqual(parseStamps(null), []);
});

test('parseSteps handles Dutch thousands separators and decimals', () => {
  assert.equal(parseSteps('8412'), 8412);
  assert.equal(parseSteps('8.412'), 8412);
  assert.equal(parseSteps('8,412'), 8412);
  assert.equal(parseSteps('8412,6'), 8413);
  assert.equal(parseSteps(''), null);
  assert.equal(parseSteps('abc'), null);
});

test('bed is the last use of the evening, wake the first use from 05:00', () => {
  const r = sleepFromUse([at(28, 19, 30), at(28, 22, 10), at(28, 22, 40), at(28, 23, 14), at(29, 6, 58), at(29, 7, 2)], now);
  assert.equal(hm(r.bed), '28 23:14');
  assert.equal(hm(r.wake), '29 6:58');
});

test('checking the time in the night is not the bedtime', () => {
  const r = sleepFromUse([at(28, 23, 5), at(29, 2, 10), at(29, 2, 11), at(29, 4, 40), at(29, 6, 30)], now);
  assert.equal(hm(r.bed), '28 23:05');
  assert.equal(hm(r.wake), '29 6:30');
});

test('a long gap in the early evening is not the bedtime', () => {
  const r = sleepFromUse([at(28, 18, 30), at(28, 21, 30), at(28, 22, 0), at(28, 23, 30), at(29, 6, 45)], now);
  assert.equal(hm(r.bed), '28 23:30');
});

test('no use after 21:00: the last evening use counts; nothing in the evening: unknown', () => {
  assert.equal(hm(sleepFromUse([at(28, 20, 15), at(29, 6, 45)], now).bed), '28 20:15');
  assert.equal(sleepFromUse([at(28, 14, 0), at(29, 6, 45)], now).bed, null);
});

test('no use this morning yet: wake unknown, bed still found', () => {
  const r = sleepFromUse([at(28, 23, 14)], now);
  assert.equal(r.wake, null);
  assert.equal(hm(r.bed), '28 23:14');
});

test('stamps older than 20 h or in the future are ignored', () => {
  const r = sleepFromUse([at(27, 23, 0), at(28, 6, 50), at(29, 8, 0)], now);
  assert.equal(r.wake, null);
  assert.equal(r.bed, null);
});

test('two checks in the night step back to the real bedtime; a long late session is the bedtime', () => {
  const r = sleepFromUse([at(28, 22, 50), at(29, 1, 30), at(29, 3, 40), at(29, 3, 42), at(29, 6, 50)], now);
  assert.equal(hm(r.bed), '28 22:50');
  const late = sleepFromUse([at(28, 22, 0), at(29, 0, 50), at(29, 1, 10), at(29, 1, 35), at(29, 6, 50)], now);
  assert.equal(hm(late.bed), '29 1:35');
});
