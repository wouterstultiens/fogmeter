import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingNotes, noteLine } from '../docs/js/notes.js';

const at = (d, hh, mm) => { const x = new Date(d); x.setHours(hh, mm, 0, 0); return x; };
const note = (date, text, fog = null) => ({ id: date.toISOString(), at: date.toISOString(), date: '', text, fog });

test('pendingNotes: text notes since the last session, oldest first', () => {
  const now = at(new Date(2026, 9, 10), 7, 30);
  const lastSession = at(new Date(2026, 9, 9), 7, 25).toISOString();
  const notes = [
    note(at(new Date(2026, 9, 9), 21, 5), 'laat gegeten'),
    note(at(new Date(2026, 9, 9), 15, 20), 'blanco moment in overleg', 6),
    note(at(new Date(2026, 9, 9), 16, 0), '', 4), // rating only: nothing to prefill
    note(at(new Date(2026, 9, 9), 7, 0), 'voor de vorige sessie'),
  ];
  const r = pendingNotes(notes, lastSession, now);
  assert.equal(r.text, '15:20 blanco moment in overleg\n21:05 laat gegeten');
  assert.equal(r.ids.length, 2);
  assert.equal(pendingNotes([], lastSession, now), null);
});

test('pendingNotes: never older than 48 h, even after skipped days', () => {
  const now = at(new Date(2026, 9, 10), 7, 30);
  const notes = [note(at(new Date(2026, 9, 5), 12, 0), 'oud'), note(at(new Date(2026, 9, 8), 12, 0), 'eergisteren')];
  const r = pendingNotes(notes, null, now);
  assert.deepEqual(r.ids, [notes[1].id]);
  assert.match(r.text, /^\S+ 12:00 eergisteren$/); // older than yesterday: weekday prefix
  assert.equal(noteLine(notes[1], now).endsWith('12:00 eergisteren'), true);
});
