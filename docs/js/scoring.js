// Pure scoring functions (no DOM) so they can be unit-tested in Node.

const STOPWORDS = new Set([
  'de', 'het', 'een', 'en', 'of', 'eh', 'ehm', 'uh', 'uhm', 'um', 'hm', 'hmm', 'nog', 'ook', 'dan',
  'is', 'ja', 'nee', 'o', 'oh', 'ok', 'oke', 'okay', 'nou', 'eens', 'even', 'die', 'dat', 'wat',
  'ik', 'weet', 'niet', 'meer', 'maar', 'en', 'eeh', 'ehh', 'euh',
]);

export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

export function tokenize(text) {
  return String(text)
    .split(/[\s,.;:!?"'()\-/]+/)
    .map(normalize)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
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

/** Does a recognised token count as recalling `target`? Allows plural/diminutive and small ASR spelling slips. */
export function matchesWord(token, target) {
  const t = normalize(token), w = normalize(target);
  if (!t || !w) return false;
  if (t === w) return true;
  if (t.startsWith(w) && t.length - w.length <= 4) return true; // appels, bruggen, huisje
  if (w.length >= 5 && levenshtein(t, w) <= 1) return true;
  return false;
}

/** Returns which list positions were recalled and which tokens were intrusions. */
export function scoreRecall(tokens, words) {
  const recalled = words.map(() => false);
  const intrusions = [];
  for (const tok of tokens) {
    const idx = words.findIndex((w, i) => !recalled[i] && matchesWord(tok, w));
    if (idx >= 0) recalled[idx] = true;
    else if (!words.some((w) => matchesWord(tok, w))) intrusions.push(tok);
  }
  return { recalled, intrusions };
}

function sameStem(a, b) {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 3 && l.startsWith(s);
}

/**
 * events: [{w, t}] unique normalised words with first-seen time in ms since task start.
 * removed: words the user struck in review.
 */
export function scoreFluency(events, prompt, durationMs = 60000, removed = []) {
  const struck = new Set(removed);
  const sorted = events.slice().sort((a, b) => a.t - b.t);
  const valid = [];
  for (const e of sorted) {
    if (struck.has(e.w)) continue;
    if (prompt.mode === 'letter' && !e.w.startsWith(prompt.letter.toLowerCase())) continue;
    if (valid.some((v) => sameStem(v.w, e.w))) continue;
    valid.push(e);
  }
  const times = valid.map((e) => e.t);
  const gaps = [];
  let prevT = 0;
  for (const t of times) { gaps.push(t - prevT); prevT = t; }
  const interWord = gaps.slice(1);
  let blanks = gaps.filter((g) => g > 5000).length;
  if (durationMs - prevT > 5000) blanks += 1; // trailing silence
  return {
    valid: valid.length,
    words: valid.map((e) => e.w),
    first15: times.filter((t) => t <= 15000).length,
    firstLatencyMs: times.length ? Math.round(times[0]) : null,
    medianGapMs: interWord.length ? Math.round(median(interWord)) : null,
    blanks,
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
  fluency: (s) => s.fluency?.summary?.valid,
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
  for (const [k, f] of Object.entries(METRICS)) {
    if (k === 'fluency') continue;
    refs[k] = robustScale(base.map(f));
  }
  // Fluency forms differ in difficulty: separate reference per mode.
  const fluRef = {
    letter: robustScale(base.filter((s) => s.fluency?.prompt?.mode === 'letter').map(METRICS.fluency)),
    category: robustScale(base.filter((s) => s.fluency?.prompt?.mode === 'category').map(METRICS.fluency)),
  };

  const runInEnd = full[RUN_IN - 1]?.date;
  const out = days.map((s) => {
    const zz = {};
    for (const k of Object.keys(METRICS)) {
      zz[k] = k === 'fluency' ? z(METRICS.fluency(s), fluRef[s.fluency?.prompt?.mode]) : z(METRICS[k](s), refs[k]);
    }
    const domains = {
      attention: avg([zz.pvtSpeed, zz.pvtLapses]),
      speed: zz.symRT,
      memory: zz.memory,
      retrieval: zz.fluency,
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
