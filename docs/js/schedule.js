// Deterministic daily stimulus schedule: word lists and fluency prompts.
// Everything is derived from the calendar date so no history is needed on the device.
// IMPORTANT: once real data collection has started, do not reorder/edit WORDS, CATEGORIES,
// LETTERS or the seeds below. That would change which list belongs to which day.

import { WORDS, CATEGORIES, LETTERS } from './data/words_nl.js';

const EPOCH_UTC = Date.UTC(2026, 8, 1); // 2026-09-01
const LIST_LEN = 12;
const MAX_PER_TAG = { other: 2 };

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

const LETTER_ORDER = shuffle(LETTERS, mulberry32(101));
const CATEGORY_ORDER = shuffle(CATEGORIES, mulberry32(202));

/** Letter and category days alternate; each rotates through its own shuffled order. */
export function fluencyPrompt(day) {
  const k = Math.floor(day / 2);
  if (day % 2 === 0) {
    const letter = LETTER_ORDER[k % LETTER_ORDER.length];
    return { mode: 'letter', letter, tag: null, label: `Woorden die beginnen met de letter ${letter}` };
  }
  const cat = CATEGORY_ORDER[k % CATEGORY_ORDER.length];
  return { mode: 'category', category: cat.name, tag: cat.tag, label: `Noem zoveel mogelijk: ${cat.name}` };
}

function fitsList(entry, list, prompt) {
  const [word, tag] = entry;
  if (prompt.mode === 'letter' && word[0].toUpperCase() === prompt.letter) return false;
  if (prompt.mode === 'category' && prompt.tag && tag === prompt.tag) return false;
  const sameTag = list.filter((e) => e[1] === tag).length;
  return sameTag < (MAX_PER_TAG[tag] ?? 1);
}

function pickList(queue, prompt) {
  const list = [];
  const skipped = [];
  while (list.length < LIST_LEN && queue.length) {
    const e = queue.shift();
    if (fitsList(e, list, prompt)) list.push(e);
    else skipped.push(e);
  }
  // Skipped words go back to the front so they are used on a following day.
  queue.unshift(...skipped);
  return list;
}

let cache = { day: -1, queue: null };

/**
 * Word list for a given day. Words are consumed from a seeded shuffle of the pool, so a word
 * only comes back after the whole pool (~100 days) has been used.
 */
export function wordListForDay(day) {
  if (cache.day < 0 || day < cache.day) cache = { day: -1, queue: [], cycle: 0 };
  let list = null;
  for (let d = cache.day + 1; d <= day; d++) {
    if (cache.queue.length < LIST_LEN * 3) {
      cache.queue.push(...shuffle(WORDS, mulberry32(9000 + cache.cycle++)));
    }
    list = pickList(cache.queue, fluencyPrompt(d));
    cache.day = d;
    cache.last = list;
  }
  if (!list) list = cache.last;
  return list.map((e) => e[0]);
}

/** Random list for practice runs, so practice never spoils a real day's list. */
export function practiceList(prompt) {
  const q = shuffle(WORDS, Math.random);
  return pickList(q, prompt).map((e) => e[0]);
}

export function practicePrompt() {
  return fluencyPrompt(Math.floor(Math.random() * 1000));
}
