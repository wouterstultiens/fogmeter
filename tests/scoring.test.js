import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize, matchesWord, scoreRecall, scoreFluency, summarizePvt, summarizeSymbols,
  validity, computeIndices, rolling, RUN_IN,
} from '../docs/js/scoring.js';

test('tokenize normalises and drops fillers', () => {
  assert.deepEqual(tokenize('Eh, de Appel en  een Café!'), ['appel', 'cafe']);
});

test('matchesWord accepts plurals, diminutives and one-letter ASR slips', () => {
  assert.ok(matchesWord('appels', 'appel'));
  assert.ok(matchesWord('huisje', 'huis'));
  assert.ok(matchesWord('bruggen', 'brug'));
  assert.ok(matchesWord('fietz', 'fiets'));
  assert.ok(!matchesWord('kat', 'kast'));
  assert.ok(!matchesWord('boom', 'boot'));
});

test('scoreRecall marks each list word once and reports intrusions', () => {
  const r = scoreRecall(['appel', 'appels', 'fiets', 'zon'], ['appel', 'fiets', 'lamp']);
  assert.deepEqual(r.recalled, [true, true, false]);
  assert.deepEqual(r.intrusions, ['zon']);
});

test('scoreFluency: letter rule, same-stem dedupe, blanks and timing', () => {
  const ev = [
    { w: 'dak', t: 1000 }, { w: 'daken', t: 2000 }, { w: 'deur', t: 3000 },
    { w: 'appel', t: 4000 }, { w: 'dorp', t: 20000 }, { w: 'duif', t: 21000 },
  ];
  const s = scoreFluency(ev, { mode: 'letter', letter: 'D' }, 60000);
  assert.equal(s.valid, 4); // dak, deur, dorp, duif
  assert.equal(s.first15, 2);
  assert.equal(s.firstLatencyMs, 1000);
  assert.equal(s.blanks, 2); // 3s→20s gap, and 21s→60s trailing silence
  const removed = scoreFluency(ev, { mode: 'letter', letter: 'D' }, 60000, ['dorp']);
  assert.equal(removed.valid, 3);
});

test('summarizePvt: speed, lapses incl. timeouts, false starts', () => {
  const trials = [
    { type: 'rt', rt: 250 }, { type: 'rt', rt: 250 }, { type: 'rt', rt: 400 },
    { type: 'rt', rt: 600 }, { type: 'fs', rt: null }, { type: 'timeout', rt: null },
  ];
  const s = summarizePvt(trials);
  assert.equal(s.n, 4);
  assert.equal(s.lapses, 3); // 400, 600, timeout
  assert.equal(s.lapses500, 2);
  assert.equal(s.falseStarts, 1);
  assert.equal(s.medianRT, 325);
  assert.equal(s.meanSpeed, Math.round(((4 + 4 + 2.5 + 1000 / 600) / 4) * 1000) / 1000);
});

test('summarizeSymbols uses correct trials for RT', () => {
  const s = summarizeSymbols([{ rt: 1000, correct: true }, { rt: 3000, correct: false }, { rt: 1200, correct: true }]);
  assert.equal(s.accuracy, 0.667);
  assert.equal(s.medianRT, 1100);
});

test('validity flags interruptions, false starts and low accuracy', () => {
  assert.deepEqual(validity({ flags: {}, pvt: { summary: { n: 60, falseStarts: 2 } } }).valid, true);
  const bad = validity({ flags: { interrupted: true }, pvt: { summary: { n: 50, falseStarts: 10 } }, symbols: { summary: { accuracy: 0.6 } } });
  assert.equal(bad.valid, false);
  assert.equal(bad.reasons.length, 3);
});

function fakeSession(i, jitter = 0) {
  const d = new Date(Date.UTC(2026, 9, 1 + i));
  const date = d.toISOString().slice(0, 10);
  return {
    id: `${date}_0730`, date, kind: 'full', valid: true, startedAt: `${date}T07:30:00Z`,
    now: { fog: 3 + (i % 3) }, yesterday: { dayFog: 4 },
    pvt: { summary: { meanSpeed: 3.5 + jitter + (i % 5) * 0.05, lapses: 2 + (i % 3) } },
    symbols: { summary: { medianRT: 1500 - (i % 4) * 20 } },
    memory: { immediate: 7 + (i % 2), delayed: 6 + (i % 3) },
    fluency: { prompt: { mode: i % 2 ? 'category' : 'letter' }, summary: { valid: 14 + (i % 4) } },
  };
}

test('computeIndices: phases and a bad day scoring below zero', () => {
  const few = Array.from({ length: 5 }, (_, i) => fakeSession(i));
  assert.equal(computeIndices(few).phase, 'runin');

  const many = Array.from({ length: RUN_IN + 20 }, (_, i) => fakeSession(i));
  const bad = fakeSession(RUN_IN + 20, -1); // much slower PVT
  bad.pvt.summary.lapses = 12;
  bad.memory = { immediate: 3, delayed: 1 };
  const ix = computeIndices([...many, bad]);
  assert.equal(ix.phase, 'baseline');
  const last = ix.days[ix.days.length - 1];
  assert.ok(last.obj < -1, `obj ${last.obj}`);
  assert.ok(ix.days[RUN_IN + 5].obj > -1);
  const roll = rolling(ix.days.filter((d) => !d.runIn), 'obj');
  assert.ok(roll.some((r) => r.value !== null));
});

test('dailySessions prefers a valid full session over an invalid retake', () => {
  const a = fakeSession(0); a.valid = false; a.id += 'a';
  const b = fakeSession(0); b.startedAt = b.startedAt.replace('07:30', '07:45'); b.id += 'b';
  const ix = computeIndices([a, b]);
  assert.equal(ix.days.length, 1);
  assert.equal(ix.days[0].session.id, b.id);
});
