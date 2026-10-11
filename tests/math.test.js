import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemSource, ANSWER_DIGITS } from '../docs/js/tasks/math.js';
import { mulberry32 } from '../docs/js/schedule.js';

const digits = (n) => String(n).split('').map(Number);

test('arithmetic problems: three-digit answers, every step carries or borrows', () => {
  for (let i = 0; i < 3000; i++) {
    const next = problemSource(mulberry32(i)); // a fresh session each time: one session never repeats a problem
    const { op, a, b, answer } = next();
    assert.equal(String(answer).length, ANSWER_DIGITS, `${a} ${op} ${b}`);
    assert.ok(!digits(answer).includes(0) || op === '×', `${a} ${op} ${b} = ${answer}`);
    if (op === '×') {
      assert.equal(answer, a * b);
      assert.ok((a % 10) * b >= 10 && answer % 10 !== 0 && b >= 3);
    } else if (op === '+') {
      assert.equal(answer, a + b);
      assert.ok(a % 10 + b % 10 >= 10 && Math.floor(a / 10) % 10 + Math.floor(b / 10) + 1 >= 10);
    } else {
      assert.equal(answer, a - b);
      assert.ok(a % 10 < b % 10 && Math.floor(a / 10) % 10 - 1 < Math.floor(b / 10));
    }
  }
});

test('arithmetic problems come in balanced blocks of one of each kind', () => {
  const next = problemSource(mulberry32(2));
  for (let block = 0; block < 50; block++) {
    const ops = [next(), next(), next()].map((p) => p.op).sort().join('');
    assert.equal(ops, ['×', '+', '−'].sort().join(''));
  }
});

test('no problem twice in a session', () => {
  const next = problemSource(mulberry32(3));
  const keys = Array.from({ length: 60 }, () => { const p = next(); return `${p.a}${p.op}${p.b}`; });
  assert.equal(new Set(keys).size, keys.length);
});
