// Data handed over by the iOS Shortcut via URL parameters, e.g.
//   ?wake=2026-09-29 07:02&bed=2026-09-28 23:14&steps=8412
// `bed` may hold several stamps (the Shortcut appends one every time the Clock app is closed);
// the latest one in last night's 20:00–04:00 window counts as bedtime.
// Values are kept for the rest of the morning (sessionStorage), then the URL is cleaned.

const KEY = 'fogmeter.shortcut';
const MAX_AGE_MS = 4 * 3600 * 1000;

/** Parses 'YYYY-MM-DD HH:MM' (or 'T', or '.' as time separator). Returns a Date or null. */
export function parseStamp(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses every 'YYYY-MM-DD HH:MM' stamp in a text (any separator between stamps). */
export function parseStamps(str) {
  if (!str) return [];
  const re = /\d{4}-\d{1,2}-\d{1,2}[ T]+\d{1,2}[:.]\d{2}/g;
  return (String(str).match(re) || []).map(parseStamp).filter(Boolean);
}

/** Bedtime window: 20:00 up to and including 04:00. */
export function inBedWindow(d) {
  const min = d.getHours() * 60 + d.getMinutes();
  return min >= 20 * 60 || min <= 4 * 60;
}

/** Parses a step count like '8412', '8.412', '8,412' or '8412.6'. */
export function parseSteps(str) {
  if (str == null || str === '') return null;
  const s = String(str).trim();
  const n = /^\d{1,3}([.,]\d{3})+$/.test(s) ? Number(s.replace(/[.,]/g, '')) : Math.round(Number(s.replace(',', '.')));
  return Number.isFinite(n) && n >= 0 && n < 200000 ? n : null;
}

/**
 * Decides which handed-over values are plausible for a session starting at `now`:
 * wake within the last 6 h; bed = the latest stamp (one Date or a list) within the last 20 h
 * that falls in the 20:00–04:00 window and before waking up.
 */
export function plausible({ wake, bed, steps }, now = new Date()) {
  const ago = (d) => (now - d) / 3600000;
  const okWake = wake && ago(wake) >= 0 && ago(wake) <= 6 ? wake : null;
  const until = okWake || now;
  const beds = (Array.isArray(bed) ? bed : [bed])
    .filter((d) => d && ago(d) <= 20 && d < until && inBedWindow(d))
    .sort((a, b) => a - b);
  return { wake: okWake, bed: beds.pop() || null, steps: steps ?? null };
}

export function captureFromUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.has('wake') && !q.has('bed') && !q.has('steps')) return;
  const data = {
    wake: q.get('wake') || null,
    bed: q.get('bed') || null,
    steps: q.get('steps') || null,
    receivedAt: Date.now(),
  };
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  history.replaceState(null, '', location.pathname);
}

/** Returns plausible {wake: Date|null, bed: Date|null, steps: number|null, raw}. */
export function currentShortcutData(now = new Date()) {
  let raw = null;
  try { raw = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
  if (!raw || now - raw.receivedAt > MAX_AGE_MS) return { wake: null, bed: null, steps: null, raw: null };
  return { ...plausible({ wake: parseStamp(raw.wake), bed: parseStamps(raw.bed), steps: parseSteps(raw.steps) }, now), raw };
}

export function clearShortcutData() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
}
