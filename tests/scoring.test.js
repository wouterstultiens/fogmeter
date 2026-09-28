import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize, tokenMatches, detectListWords, phoneticKey, markTranscript, speechTiming, summarizePvt, summarizeSymbols,
  validity, computeIndices, rolling, RUN_IN,
} from '../docs/js/scoring.js';

test('tokenize normalises and drops fillers', () => {
  assert.deepEqual(tokenize('Eh, de Appel en  een Café!'), ['appel', 'cafe']);
});

test('phoneticKey merges Dutch sound-alike spellings', () => {
  assert.equal(phoneticKey('ijs'), phoneticKey('eis'));
  assert.equal(phoneticKey('hand'), phoneticKey('hant'));
  assert.equal(phoneticKey('vis'), phoneticKey('fis'));
  assert.equal(phoneticKey('boom'), phoneticKey('bom'));
});

test('tokenMatches accepts plurals, diminutives and recogniser slips, not different words', () => {
  assert.ok(tokenMatches('appels', 'appel'));
  assert.ok(tokenMatches('huisje', 'huis'));
  assert.ok(tokenMatches('bruggen', 'brug'));
  assert.ok(tokenMatches('fietz', 'fiets'));
  assert.ok(tokenMatches('pauw', 'pouw'));
  assert.ok(!tokenMatches('kat', 'kast'));
  assert.ok(!tokenMatches('boom', 'boot'));
  assert.ok(!tokenMatches('hond', 'kont'));
});

test('detectListWords finds run-together words and words only in interim guesses', () => {
  const words = ['appel', 'fiets', 'lamp', 'zadel', 'kerk'];
  const texts = [
    'appelfiets', // recogniser glued two words together
    'lampje zon', // diminutive + an intrusion
    'zadeltje', // interim guess the final version dropped
  ];
  const r = detectListWords(texts, words);
  assert.deepEqual(r.hit, [true, true, true, true, false]);
  assert.ok(r.extra.includes('zon'));
});

test('markTranscript marks list words, including glued and plural forms', () => {
  const parts = markTranscript('Appelfiets eh lampen zon', ['appel', 'fiets', 'lamp']);
  assert.deepEqual(parts, [
    { text: 'Appelfiets', hit: true },
    { text: 'eh', hit: false },
    { text: 'lampen', hit: true },
    { text: 'zon', hit: false },
  ]);
});

test('speechTiming: first speech, first list word, gaps between new words, blanks', () => {
  const words = ['appel', 'fiets', 'lamp'];
  const timeline = [
    [1200, 'eh'], // speech, but no list word yet
    [2000, 'eh appel'],
    [3500, 'eh appel fiets'],
    [12000, 'lamp'], // new recogniser instance after a long pause
  ];
  const t = speechTiming(timeline, words, 30000);
  assert.equal(t.firstSpeechMs, 1200);
  assert.equal(t.firstWordMs, 2000);
  assert.deepEqual(t.onsets, [2000, 3500, 12000]);
  assert.equal(t.medianGapMs, (1500 + 8500) / 2);
  assert.equal(t.blanks, 2); // 3.5 s→12 s, and 12 s→30 s trailing silence
});

test('speechTiming: early end is not a trailing blank; nothing heard gives nulls', () => {
  assert.equal(speechTiming([[1000, 'appel']], ['appel'], 4000).blanks, 0);
  assert.equal(speechTiming([[6000, 'appel']], ['appel'], 8000).blanks, 1); // leading silence
  const none = speechTiming([], ['appel'], 30000);
  assert.equal(none.firstSpeechMs, null);
  assert.equal(none.firstWordMs, null);
  assert.equal(none.blanks, 0);
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
