// Pure scoring functions (no DOM) so they can be unit-tested in Node.

// ---------- matching speech transcripts against the known word list ----------

const FILLERS = new Set([
  'de', 'het', 'een', 'en', 'of', 'eh', 'ehm', 'uh', 'uhm', 'um', 'hm', 'hmm', 'nog', 'ook', 'dan',
  'is', 'ja', 'nee', 'o', 'oh', 'ok', 'oke', 'nou', 'even', 'die', 'dat', 'wat', 'ik', 'weet', 'niet',
  'meer', 'maar', 'eeh', 'euh', 'volgens', 'mij', 'was', 'er', 'ook',
]);

export function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

export function tokenize(text) {
  return String(text).split(/[\s,.;:!?"'()\-/]+/).map(normalize).filter((t) => t.length >= 2 && !FILLERS.has(t));
}

/** Rough Dutch sound-alike key: merges spellings a recogniser confuses (ij/ei, au/ou, dt/d/t, v/f, z/s, ch/g, double vowels). */
export function phoneticKey(word) {
  return normalize(word)
    .replace(/ij|y/g, 'ei')
    .replace(/auw|ouw|au/g, 'ou')
    .replace(/sch/g, 'sg')
    .replace(/ch/g, 'g')
    .replace(/ph/g, 'f')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/dt$|d$/g, 't')
    .replace(/v/g, 'f')
    .replace(/z/g, 's')
    .replace(/w/g, 'f')
    .replace(/([aeiou])\1+/g, '$1')
    .replace(/([^aeiou])\1+/g, '$1');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Does one recognised token count as `target`? Plural/diminutive forms and sound-alike slips count. */
export function tokenMatches(token, target) {
  const t = normalize(token), w = normalize(target);
  if (!t || !w) return false;
  if (t === w) return true;
  if (t.startsWith(w) && t.length - w.length <= 4) return true; // appels, bruggen, huisje
  const kt = phoneticKey(t), kw = phoneticKey(w);
  if (kt === kw) return true;
  if (kw.length >= 5 && levenshtein(kt, kw) <= 1) return true; // short words: too many real neighbours (kat/kast)
  if (kw.length >= 7 && levenshtein(kt, kw) <= 2) return true;
  return false;
}

/**
 * Which list words occur anywhere in the recogniser's output. `texts` = every transcript version seen
 * (finals, interims, alternatives). Because the list is known, run-together words ("appelfiets")
 * are found by searching the space-less text too.
 */
export function detectListWords(texts, words) {
  const tokens = [...new Set(texts.flatMap(tokenize))];
  const glued = texts.map((t) => phoneticKey(String(t).replace(/\s+/g, '')));
  const hit = words.map((w) => {
    if (tokens.some((t) => tokenMatches(t, w))) return true;
    const k = phoneticKey(w);
    return k.length >= 4 && glued.some((g) => g.includes(k));
  });
  const extra = tokens.filter((t) => !words.some((w) => tokenMatches(t, w)));
  return { hit, extra };
}

/**
 * Splits a transcript into words, marking the ones that count as a list word (for the review screen).
 * Returns [{ text, hit }] in order; run-together words ("appelfiets") are marked as a whole.
 */
export function markTranscript(text, words) {
  return String(text).split(/\s+/).filter(Boolean).map((chunk) => {
    const hit = tokenize(chunk).some((t) => words.some((w) => tokenMatches(t, w)))
      || words.some((w) => { const k = phoneticKey(w); return k.length >= 4 && phoneticKey(chunk).includes(k); });
    return { text: chunk, hit };
  });
}

// ---------- recall timing (from the recogniser's timestamps) ----------

export const BLANK_MS = 5000;

/**
 * Timing of spoken recall, derived from when the recogniser produced text.
 * timeline: [[ms since recall start, text]], one entry whenever the recognised text changed.
 * The recogniser lags speech by roughly half a second to a second; that lag is about the same every
 * day, so the numbers are comparable between sessions but not exact.
 * - firstSpeechMs: first recognised speech of any kind
 * - firstWordMs: first moment a list word was recognised
 * - medianGapMs: median time between successive newly recognised list words
 * - blanks: stretches > 5 s without any recognised speech (leading and trailing silence included)
 * - onsets: per list word, when it was first recognised (null if never)
 */
export function speechTiming(timeline, words, durationMs = 30000) {
  const events = (timeline || []).map(([t, text]) => ({ t: Math.max(0, Math.round(t)), text }))
    .sort((a, b) => a.t - b.t);
  const onsets = words.map(() => null);
  for (const e of events) {
    detectListWords([e.text], words).hit.forEach((x, i) => { if (x && onsets[i] === null) onsets[i] = e.t; });
  }
  const found = onsets.filter((t) => t !== null).sort((a, b) => a - b);
  const gaps = found.slice(1).map((t, i) => t - found[i]);
  let blanks = 0;
  let prev = 0;
  for (const e of events) { if (e.t - prev > BLANK_MS) blanks++; prev = e.t; }
  if (events.length && durationMs - prev > BLANK_MS) blanks++;
  return {
    firstSpeechMs: events.length ? events[0].t : null,
    firstWordMs: found.length ? found[0] : null,
    medianGapMs: gaps.length ? Math.round(median(gaps)) : null,
    blanks,
    onsets,
  };
}

// ---------- descriptive stats ----------

export function median(xs) {
  const a = xs.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function mean(xs) {
  const a = xs.filter(Number.isFinite);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
}

export function sd(xs) {
  const a = xs.filter(Number.isFinite);
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export const LAPSE_MS = 355;

/** PVT trials: [{type:'rt'|'fs'|'timeout', rt}] */
export function summarizePvt(trials) {
  const rts = trials.filter((t) => t.type === 'rt').map((t) => t.rt);
  const timeouts = trials.filter((t) => t.type === 'timeout').length;
  const speeds = rts.map((rt) => 1000 / rt).sort((a, b) => a - b);
  const n10 = Math.max(1, Math.round(speeds.length * 0.1));
  const m = mean(rts);
  return {
    n: rts.length,
    meanSpeed: round(mean(speeds), 3), // responses per second (mean 1/RT), primary
    medianRT: round(median(rts), 1),
    lapses: rts.filter((rt) => rt >= LAPSE_MS).length + timeouts,
    lapses500: rts.filter((rt) => rt >= 500).length + timeouts,
    falseStarts: trials.filter((t) => t.type === 'fs').length,
    slowest10Speed: round(mean(speeds.slice(0, n10)), 3),
    fastest10RT: round(mean(rts.slice().sort((a, b) => a - b).slice(0, n10)), 1),
    cvRT: round(sd(rts) / m, 4),
  };
}

/** Symbol search trials: [{rt, correct}] */
export function summarizeSymbols(trials) {
  const correct = trials.filter((t) => t.correct);
  return {
    n: trials.length,
    accuracy: round(correct.length / Math.max(1, trials.length), 3),
    medianRT: round(median(correct.map((t) => t.rt)), 1),
  };
}

export function round(x, d = 2) {
  if (!Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

// ---------- validity ----------

export function validity(session) {
  const reasons = [];
  if (session.flags?.interrupted) reasons.push('onderbroken');
  const p = session.pvt?.summary;
  if (p) {
    const responses = p.n + p.falseStarts;
    if (responses && p.falseStarts / responses > 0.1) reasons.push('te veel valse starts');
  }
  const s = session.symbols?.summary;
  if (s && s.accuracy < 0.75) reasons.push('symbolen < 75% goed');
  return { valid: reasons.length === 0, reasons };
}

// ---------- personal baseline & indices ----------

export const RUN_IN = 14;
export const BASELINE_N = 28;

/** Metric extractors, all signed so higher = better. */
export const METRICS = {
  pvtSpeed: (s) => s.pvt?.summary?.meanSpeed,
  pvtLapses: (s) => neg(s.pvt?.summary?.lapses),
  symRT: (s) => neg(logOrNull(s.symbols?.summary?.medianRT)),
  memory: (s) => (s.memory ? s.memory.immediate + s.memory.delayed : null),
  fogNow: (s) => neg(s.now?.fog),
  fogDay: (s) => neg(s.yesterday?.dayFog),
};

function neg(x) { return Number.isFinite(x) ? -x : null; }
function logOrNull(x) { return Number.isFinite(x) && x > 0 ? Math.log(x) : null; }

function robustScale(values) {
  const v = values.filter(Number.isFinite);
  if (v.length < 5) return null;
  const med = median(v);
  let scale = 1.4826 * median(v.map((x) => Math.abs(x - med)));
  if (!(scale > 0)) scale = sd(v);
  if (!(scale > 0)) return null;
  return { center: med, scale };
}

function z(x, ref) {
  if (!ref || !Number.isFinite(x)) return null;
  return Math.max(-3, Math.min(3, (x - ref.center) / ref.scale));
}

function avg(xs) {
  const a = xs.filter(Number.isFinite);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
}

/** Keep one session per date: the last valid full session, else the last session. */
export function dailySessions(sessions) {
  const byDate = new Map();
  for (const s of sessions.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const cur = byDate.get(s.date);
    const ok = s.valid && s.kind === 'full';
    if (!cur || ok || !(cur.valid && cur.kind === 'full')) byDate.set(s.date, s);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes phase, baseline references and per-day indices.
 * Returns { phase, runInDone, baselineCount, days:[{date, obj, subj, domains, session}] }
 */
export function computeIndices(sessions) {
  const days = dailySessions(sessions);
  const full = days.filter((s) => s.kind === 'full' && s.valid);
  const post = full.slice(RUN_IN);
  const base = post.slice(0, BASELINE_N);
  const phase = full.length < RUN_IN ? 'runin' : post.length < BASELINE_N ? 'baseline' : 'tracking';

  const refs = {};
  for (const [k, f] of Object.entries(METRICS)) refs[k] = robustScale(base.map(f));

  const runInEnd = full[RUN_IN - 1]?.date;
  const out = days.map((s) => {
    const zz = {};
    for (const k of Object.keys(METRICS)) {
      zz[k] = z(METRICS[k](s), refs[k]);
    }
    const domains = {
      attention: avg([zz.pvtSpeed, zz.pvtLapses]),
      speed: zz.symRT,
      memory: zz.memory,
    };
    const usable = s.valid;
    return {
      date: s.date,
      session: s,
      runIn: !runInEnd || s.date <= runInEnd,
      obj: usable && s.kind === 'full' ? avg(Object.values(domains)) : null,
      subj: avg([zz.fogNow, zz.fogDay]),
      domains,
      z: zz,
    };
  });

  return { phase, fullCount: full.length, baselineCount: base.length, refs, days: out };
}

/** 7-day rolling mean over calendar days (needs at least `minN` values in the window). */
export function rolling(days, key, windowDays = 7, minN = 4) {
  return days.map((d) => {
    const end = Date.parse(d.date);
    const vals = days
      .filter((x) => { const t = Date.parse(x.date); return t <= end && t > end - windowDays * 86400000; })
      .map((x) => x[key])
      .filter(Number.isFinite);
    return { date: d.date, value: vals.length >= minN ? avg(vals) : null };
  });
}
