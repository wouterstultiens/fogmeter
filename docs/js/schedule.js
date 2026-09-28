// Deterministic daily word lists.
// Everything is derived from the calendar date so no history is needed on the device.
// IMPORTANT: once real data collection has started, do not reorder/edit WORDS or the seeds below.
// That would change which list belongs to which day.

import { WORDS } from './data/words_nl.js';

const EPOCH_UTC = Date.UTC(2026, 8, 1); // 2026-09-01
const LIST_LEN = 12;
const MAX_PER_TAG = { other: 2 }; // otherwise max one word per semantic category (no clusters)
const MIN_REPEAT_DAYS = 90;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 'YYYY-MM-DD' in local time. */
export function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000));
}

function fitsList([, tag], list) {
  return list.filter((e) => e[1] === tag).length < (MAX_PER_TAG[tag] ?? 1);
}

function pickList(queue, list = []) {
  const skipped = [];
  while (list.length < LIST_LEN && queue.length) {
    const e = queue.shift();
    if (fitsList(e, list)) list.push(e);
    else skipped.push(e);
  }
  // Skipped words go back to the front so they are used on a following day.
  queue.unshift(...skipped);
  return list;
}

let cache = { day: -1, queue: null };

function refill(day, current = []) {
  // Next seeded shuffle of the pool, minus words already queued, picked today or used too recently.
  const excluded = new Set([...cache.queue, ...current].map((e) => e[0]));
  const fresh = shuffle(WORDS, mulberry32(9000 + cache.cycle++))
    .filter((e) => !excluded.has(e[0]) && day - (cache.lastUsed.get(e[0]) ?? -1e9) >= MIN_REPEAT_DAYS);
  cache.queue.push(...fresh);
}

/**
 * Word list for a given day. Words are consumed from successive seeded shuffles of the pool;
 * a word never returns within MIN_REPEAT_DAYS.
 */
export function wordListForDay(day) {
  if (cache.day < 0 || day < cache.day) cache = { day: -1, queue: [], cycle: 0, lastUsed: new Map() };
  let list = null;
  for (let d = cache.day + 1; d <= day; d++) {
    if (cache.queue.length < LIST_LEN * 3) refill(d);
    list = pickList(cache.queue);
    for (let tries = 0; list.length < LIST_LEN && tries < 20; tries++) {
      // Queue held only words that don't fit today: top it up and continue.
      refill(d, list);
      list = pickList(cache.queue, list);
    }
    for (const e of list) cache.lastUsed.set(e[0], d);
    cache.day = d;
    cache.last = list;
  }
  if (!list) list = cache.last;
  return list.map((e) => e[0]);
}

/** Random list for practice runs, so practice never spoils a real day's list. */
export function practiceList() {
  return pickList(shuffle(WORDS, Math.random)).map((e) => e[0]);
}
