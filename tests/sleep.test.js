import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sleepContext, AWAKE } from '../docs/js/sleep.js';

const started = new Date(2026, 9, 4, 7, 30);

test('time in bed spans midnight; time awake in the night comes off the estimated sleep', () => {
  const c = sleepContext(started, '23:00', '07:00', 60);
  assert.equal(c.timeInBedMin, 480);
  assert.equal(c.awakeMin, 60);
  assert.equal(c.sleepMin, 420);
  assert.equal(c.minutesSinceWake, 30);
});

test('unknown awake time (sessions before 1.5) leaves the sleep estimate unknown, not equal to time in bed', () => {
  const c = sleepContext(started, '23:00', '07:00');
  assert.equal(c.awakeMin, null);
  assert.equal(c.sleepMin, null);
});

test('sleep estimate never goes below zero', () => {
  assert.equal(sleepContext(started, '06:00', '07:00', 90).sleepMin, 0);
});

test('"Wakker gelegen" starts with "geen" = 0 minutes', () => {
  assert.deepEqual(AWAKE[0], { label: 'geen', value: 0 });
});
