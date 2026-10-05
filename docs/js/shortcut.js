// Data handed over by the iOS Shortcut via URL parameters, e.g.
//   ?use=2026-09-28T22:51%0A2026-09-28T23:14%0A2026-09-29T06:58&steps=8412
// `use` is the phone-use log of yesterday and today (one file per day, never emptied): one stamp per time a
// logged app (Safari, Obsidian, Todoist, Clock) opened or closed. Bed and wake times are derived from it. Values are kept for the rest of the morning, then the URL is
// cleaned.

const KEY = 'fogmeter.shortcut';
const MAX_AGE_MS = 4 * 3600 * 1000;
const WAKE_FROM_HOUR = 5;
const EVENING_HOUR = 21;
const SLEEP_GAP_MIN = 90;
const NIGHT_CHECK_HOUR = 1;
const NIGHT_CHECK_MIN = 20;
const STAMP = /(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2})[:.](\d{2})/g;

/** Parses every 'YYYY-MM-DD HH:MM' (or 'T', or '.' as time separator) in the text, in any separator. */
export function parseStamps(str) {
  return [...String(str ?? '').matchAll(STAMP)]
    .map((m) => new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))
    .filter((d) => !Number.isNaN(d.getTime()));
}

/** Parses a step count like '8412', '8.412', '8,412' or '8412.6'. */
export function parseSteps(str) {
  if (str == null || str === '') return null;
  const s = String(str).trim();
  const n = /^\d{1,3}([.,]\d{3})+$/.test(s) ? Number(s.replace(/[.,]/g, '')) : Math.round(Number(s.replace(',', '.')));
  return Number.isFinite(n) && n >= 0 && n < 200000 ? n : null;
}

/**
 * Bed and wake time from the phone-use stamps of the last 20 h before `now`.
 * - wake: first use from 05:00 this morning.
 * - bed: the use (from 21:00 the evening before) where the longest gap until waking starts. A short burst of use
 *   (≤ 20 min) after 01:00 with ≥ 90 min quiet before it is checking the time in the night, so the bedtime is
 *   the use before it. No use after 21:00: the last use from 18:00.
 * Either is null when the log doesn't say.
 */
export function sleepFromUse(stamps, now = new Date()) {
  const t = stamps.filter((d) => d <= now && now - d <= 20 * 3600000).sort((a, b) => a - b);
  const morning = new Date(now);
  morning.setHours(WAKE_FROM_HOUR, 0, 0, 0);
  if (morning > now) morning.setDate(morning.getDate() - 1);
  const wake = t.find((d) => d >= morning) || null;

  const night = t.filter((d) => d < (wake || now));
  const evening = new Date(morning);
  evening.setDate(evening.getDate() - 1);
  evening.setHours(EVENING_HOUR, 0, 0, 0);
  const late = night.filter((d) => d >= evening);
  if (!late.length) {
    const last = night.at(-1);
    return { wake, bed: last && evening - last <= 3 * 3600000 ? last : null };
  }
  const min = (a, b) => (b - a) / 60000;
  const gapAfter = (i) => min(late[i], late[i + 1] || wake || now);
  let k = late.reduce((best, _, i) => (gapAfter(i) > gapAfter(best) ? i : best), 0);
  const deepNight = new Date(morning);
  deepNight.setHours(NIGHT_CHECK_HOUR, 0, 0, 0);
  for (;;) {
    let c = k;
    while (c > 0 && min(late[c - 1], late[c]) < SLEEP_GAP_MIN) c--;
    const nightCheck = c > 0 && late[c] >= deepNight && min(late[c], late[k]) <= NIGHT_CHECK_MIN;
    if (!nightCheck) break;
    k = c - 1;
  }
  return { wake, bed: late[k] };
}

export function captureFromUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.has('use') && !q.has('steps')) return;
  const data = { use: q.get('use') || '', steps: q.get('steps') || null, receivedAt: Date.now() };
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  history.replaceState(null, '', location.pathname);
}

function readRaw() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

/** Returns {wake: Date|null, bed: Date|null, steps: number|null, raw}. */
export function currentShortcutData(now = new Date()) {
  const raw = readRaw();
  if (!raw || now - raw.receivedAt > MAX_AGE_MS) return { wake: null, bed: null, steps: null, raw: null };
  return { ...sleepFromUse(parseStamps(raw.use), now), steps: parseSteps(raw.steps), raw };
}

export function clearShortcutData() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
}
