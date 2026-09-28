// Results: today's numbers vs. your normal, raw scores of every session (run-in included), 7-day trend
// chart, domain breakdown, a table of all sessions with per-session details, and quick notes.
import { h, fmtTime } from './ui.js';
import { computeIndices, rolling, median, RUN_IN, BASELINE_N } from './scoring.js';
import { heardBlock } from './tasks/questions.js';

const SERIES = [
  { key: 'obj', label: 'Testscores', color: '#3987e5', dash: '' },
  { key: 'subj', label: 'Hoe je je voelt', color: '#d95926', dash: '6 4' },
];
// A 7-day mean of a z-score (SD 1) varies by ~1/sqrt(7); ±2 of that ≈ ±0.76 is "normal wobble".
const BAND = 0.76;

/** onOpen(session): called when a table row is tapped (shows sessionDetail). */
export function resultsView(sessions, highlight = null, { notes = [], onOpen = null } = {}) {
  const ix = computeIndices(sessions);
  const days = ix.days;
  const today = highlight ? days.find((d) => d.session.id === highlight.id) : days[days.length - 1];
  return [
    phaseBanner(ix),
    today ? todayCard(today.session, days) : h('p.muted', 'Nog geen sessies.'),
    rawCard(ix),
    chartCard(ix),
    domainCard(ix),
    tableCard(sessions, onOpen),
    notesCard(notes),
  ];
}

function phaseBanner(ix) {
  if (ix.phase === 'runin') {
    return h('div.banner', `Inwerkperiode: sessie ${ix.fullCount} van ${RUN_IN}. Je leert de taken nog, dus deze sessies tellen niet mee voor je normaal. Alles wordt wel bewaard: zie Ruwe scores.`);
  }
  if (ix.phase === 'baseline') {
    return h('div.banner', `Basislijn: ${ix.baselineCount} van ${BASELINE_N} dagen. Dit wordt jouw "normaal". Verander nu nog niets aan je leefstijl.`);
  }
  return h('div.banner', 'Basislijn compleet. Je kunt experimenten gaan doen.');
}

function todayCard(s, days) {
  const prev = days.map((d) => d.session).filter((x) => x.id !== s.id && x.valid).slice(-14);
  const norm = (f) => median(prev.map(f).filter(Number.isFinite));
  const kpi = (label, val, unit, f, digits = 0) => {
    const n = prev.length >= 5 ? norm(f) : NaN;
    const delta = Number.isFinite(val) && Number.isFinite(n)
      ? h('div.d', { style: { color: 'var(--muted)' } }, `normaal ${fmt(n, digits)}${unit}`)
      : null;
    return h('div.kpi', h('div.v', Number.isFinite(val) ? `${fmt(val, digits)}${unit}` : '–'), h('div.l', label), delta);
  };
  const p = s.pvt?.summary;
  const items = [
    kpi('Reactietijd (mediaan)', p?.medianRT, ' ms', (x) => x.pvt?.summary?.medianRT),
    kpi('Missers (≥355 ms)', p?.lapses, '', (x) => x.pvt?.summary?.lapses),
  ];
  if (s.kind === 'full') {
    items.push(
      kpi('Symbolen (mediaan)', s.symbols?.summary?.medianRT, ' ms', (x) => x.symbols?.summary?.medianRT),
      kpi('Symbolen goed', s.symbols?.summary?.accuracy != null ? s.symbols.summary.accuracy * 100 : NaN, '%', (x) => (x.symbols?.summary?.accuracy ?? NaN) * 100),
      kpi('Woorden 1e keer', s.memory?.immediate, ' /12', (x) => x.memory?.immediate),
      kpi('Woorden 2e keer', s.memory?.delayed, ' /12', (x) => x.memory?.delayed),
    );
  }
  return h('div.card',
    h('div.row', h('h3.grow', `Sessie ${s.date}`), s.valid ? null : h('span.tag.warn', 'ongeldig')),
    s.valid ? null : h('p.small', { style: { color: 'var(--warn)' } }, `Ongeldig: ${s.invalidReasons.join(', ')}`),
    h('div.kpis', ...items),
    h('p.small.muted', 'Eén dag zegt weinig: ongeveer de helft is ruis. Kijk naar de week-trend.'),
  );
}

function chartCard(ix) {
  const post = ix.days.filter((d) => !d.runIn);
  const lines = SERIES.map((s) => ({ ...s, pts: rolling(post, s.key).filter((p) => p.value !== null) }));
  if (ix.phase === 'runin' || lines.every((l) => l.pts.length < 2)) {
    return h('div.card', h('h3', 'Week-trend t.o.v. jouw normaal'), h('p.muted.small', 'Verschijnt zodra de inwerkperiode voorbij is en er een week basislijn is. Tot dan: zie Ruwe scores.'));
  }
  return h('div.card.chart',
    h('h3', 'Week-trend (7-daags gemiddelde, t.o.v. jouw normaal)'),
    h('div.legend', ...SERIES.map((s) => h('span', h('i', { style: { background: s.color } }), s.label))),
    lineChart(lines),
    h('p.small.muted', 'Boven de 0 = beter dan jouw normaal. Het grijze vlak is normale schommeling; pas een week buiten het vlak is betekenisvol.'),
  );
}

const el = (tag, attrs) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const fmtD = (d) => { const [, m, dd] = d.split('-'); return `${+dd}/${+m}`; };

function lineChart(lines) {
  const W = 340, H = 200, L = 34, R = 12, T = 12, B = 26;
  const dates = [...new Set(lines.flatMap((l) => l.pts.map((p) => p.date)))].sort();
  const t0 = Date.parse(dates[0]), t1 = Math.max(Date.parse(dates[dates.length - 1]), t0 + 6 * 86400000);
  const x = (d) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R);
  const lo = -2, hi = 2;
  const y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Week-trend van testscores en hoe je je voelt' });
  svg.append(el('rect', { x: L, y: y(BAND), width: W - L - R, height: y(-BAND) - y(BAND), fill: '#2a3039', rx: 4 }));
  for (const v of [-2, -1, 0, 1, 2]) {
    svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: v === 0 ? '#5b6573' : '#262c34', 'stroke-width': 1 }));
    const t = el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8d97a5' });
    t.textContent = v > 0 ? `+${v}` : String(v);
    svg.append(t);
  }
  for (const d of [dates[0], dates[dates.length - 1]]) {
    const t = el('text', { x: x(d), y: H - 8, 'text-anchor': d === dates[0] ? 'start' : 'end', 'font-size': 11, fill: '#8d97a5' });
    t.textContent = fmtD(d);
    svg.append(t);
  }
  for (const l of lines) {
    if (!l.pts.length) continue;
    const dAttr = l.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    svg.append(el('path', { d: dAttr, fill: 'none', stroke: l.color, 'stroke-width': 2, 'stroke-dasharray': l.dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const last = l.pts[l.pts.length - 1];
    svg.append(el('circle', { cx: x(last.date), cy: y(last.value), r: 4, fill: l.color, stroke: '#181c22', 'stroke-width': 2 }));
  }

  // Crosshair + tooltip (touch and mouse).
  const cross = el('line', { y1: T, y2: H - B, stroke: '#8d97a5', 'stroke-width': 1, visibility: 'hidden' });
  svg.append(cross);
  const tip = h('div.small', { style: { minHeight: '20px', color: 'var(--muted)' } }, 'Tik op de grafiek voor waarden.');
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = dates[0];
    for (const d of dates) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d;
    cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best)); cross.setAttribute('visibility', 'visible');
    const vals = lines.map((l) => { const p = l.pts.find((q) => q.date === best); return `${l.label}: ${p ? (p.value >= 0 ? '+' : '') + p.value.toFixed(2) : '–'}`; });
    tip.textContent = `${fmtD(best)} · ${vals.join(' · ')}`;
  };
  svg.addEventListener('pointerdown', onMove);
  svg.addEventListener('pointermove', onMove);
  return h('div', svg, tip);
}

const DOMAINS = [
  ['attention', 'Aandacht (reactietest)'],
  ['speed', 'Verwerkingssnelheid (symbolen)'],
  ['memory', 'Geheugen (woordenlijst)'],
];

function domainCard(ix) {
  if (ix.phase === 'runin') return null;
  const recent = ix.days.filter((d) => !d.runIn).slice(-7);
  const rows = DOMAINS.map(([k, label]) => {
    const vals = recent.map((d) => d.domains[k]).filter(Number.isFinite);
    const m = vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return h('div.row', h('span.grow', label), h('strong', m === null ? '–' : `${m >= 0 ? '+' : ''}${m.toFixed(2)}`));
  });
  return h('div.card', h('h3', 'Per onderdeel, laatste 7 dagen'), ...rows, h('p.small.muted', 'In standaarddeviaties t.o.v. jouw basislijn. ±0,3 is klein, ±0,8 is groot.'));
}

// ---------- raw scores (no baseline needed, so visible from the first session) ----------

const COLORS = ['#3987e5', '#d95926'];
const RAW = [
  { title: 'Reactietijd, mediaan (ms)', hint: 'lager = sneller', series: [{ label: 'reactietijd', f: (s) => s.pvt?.summary?.medianRT }] },
  { title: 'Missers, ≥ 355 ms', hint: 'lager = beter', min0: true, series: [{ label: 'missers', f: (s) => s.pvt?.summary?.lapses }] },
  { title: 'Symbolen, mediaan (ms)', hint: 'lager = sneller', series: [{ label: 'symbolen', f: (s) => s.symbols?.summary?.medianRT }] },
  {
    title: 'Woorden onthouden (van 12)', hint: 'hoger = beter', ticks: [0, 6, 12],
    series: [{ label: '1e keer', f: (s) => s.memory?.immediate }, { label: '2e keer', f: (s) => s.memory?.delayed }],
  },
  {
    title: 'Mist (0–10)', hint: 'lager = helderder', ticks: [0, 5, 10],
    series: [{ label: 'nu', f: (s) => s.now?.fog }, { label: 'gisteren overdag', f: (s) => s.yesterday?.dayFog }],
  },
  { title: 'Tijd in bed (uur)', digits: 1, series: [{ label: 'tijd in bed', f: (s) => s.context?.timeInBedMin / 60 }] },
];

function rawCard(ix) {
  const days = ix.days;
  if (!days.length) return null;
  const runIn = days.filter((d) => d.runIn);
  const runInEnd = runIn.length ? runIn[runIn.length - 1].date : null;
  const domain = [days[0].date, days[days.length - 1].date];
  return h('div.card.chart',
    h('h3', 'Ruwe scores'),
    h('p.small.muted', 'Alle sessies, zonder vergelijking met je normaal. Grijze achtergrond = inwerkperiode (daar word je vanzelf beter). Open rondje = ongeldige sessie. Tik op een grafiek voor de waarden.'),
    ...RAW.map((spec) => miniChart(spec, days, domain, runInEnd)),
  );
}

function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function miniChart(spec, days, domain, runInEnd) {
  const series = spec.series.map((sr, k) => ({
    ...sr,
    color: COLORS[k],
    pts: days.map((d) => ({ date: d.date, value: sr.f(d.session), valid: d.session.valid })).filter((p) => Number.isFinite(p.value)),
  }));
  const vals = series.flatMap((sr) => sr.pts.map((p) => p.value));
  if (!vals.length) return null;

  const W = 340, H = 118, L = 36, R = 10, T = 8, B = 20;
  let ticks = spec.ticks;
  if (!ticks) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const step = niceStep((hi - lo) / 2);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    if (spec.min0) lo = Math.max(0, lo);
    ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  }
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const t0 = Date.parse(domain[0]);
  const t1 = Math.max(Date.parse(domain[1]), t0 + 6 * 86400000);
  const x = (d) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title });
  if (runInEnd) {
    const x1 = Math.min(W - R, x(runInEnd) + 4);
    svg.append(el('rect', { x: L, y: T, width: Math.max(0, x1 - L), height: H - T - B, fill: '#20262e', rx: 3 }));
  }
  for (const v of ticks) {
    svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#262c34', 'stroke-width': 1 }));
    const t = el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8d97a5' });
    t.textContent = fmt(v, 0);
    svg.append(t);
  }
  for (const d of [...new Set([domain[0], domain[1]])]) {
    const t = el('text', { x: x(d), y: H - 5, 'text-anchor': d === domain[0] ? 'start' : 'end', 'font-size': 11, fill: '#8d97a5' });
    t.textContent = fmtD(d);
    svg.append(t);
  }
  for (const sr of series) {
    if (sr.pts.length > 1) {
      const dAttr = sr.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
      svg.append(el('path', { d: dAttr, fill: 'none', stroke: sr.color, 'stroke-width': 1.5, 'stroke-linejoin': 'round', opacity: 0.8 }));
    }
    for (const p of sr.pts) {
      svg.append(el('circle', {
        cx: x(p.date), cy: y(p.value), r: 3,
        fill: p.valid ? sr.color : '#181c22', stroke: sr.color, 'stroke-width': 1.5,
      }));
    }
  }

  const cross = el('line', { y1: T, y2: H - B, stroke: '#8d97a5', 'stroke-width': 1, visibility: 'hidden' });
  svg.append(cross);
  const dates = [...new Set(series.flatMap((sr) => sr.pts.map((p) => p.date)))].sort();
  const tip = h('span.small.muted', spec.hint || '');
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = dates[0];
    for (const d of dates) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d;
    cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best)); cross.setAttribute('visibility', 'visible');
    const vals2 = series.map((sr) => {
      const p = sr.pts.find((q) => q.date === best);
      return `${series.length > 1 ? `${sr.label} ` : ''}${p ? fmt(p.value, spec.digits || 0) : '–'}`;
    });
    tip.textContent = `${fmtD(best)} · ${vals2.join(' · ')}`;
  };
  svg.addEventListener('pointerdown', onMove);
  svg.addEventListener('pointermove', onMove);

  return h('div.mini',
    h('div.row', h('span.small.grow', h('strong', spec.title)),
      series.length > 1 ? h('div.legend', ...series.map((sr) => h('span', h('i', { style: { background: sr.color } }), sr.label))) : null),
    svg,
    tip,
  );
}

// ---------- all sessions ----------

function tableCard(sessions, onOpen) {
  const rows = sessions.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (!rows.length) return null;
  const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  const th = (t) => h('th', { style: { textAlign: 'left', color: 'var(--muted)', fontWeight: 600 } }, t);
  return h('div.card',
    h('h3', `Alle sessies (${rows.length})`),
    onOpen ? h('p.small.muted', 'Tik op een rij voor alle details.') : null,
    h('div', { style: { overflowX: 'auto' } },
      h('table.small.sessions',
        h('tr', ...['Datum', 'RT', 'Mis', 'Sym', 'Woorden', 'Mist', ''].map(th)),
        ...rows.map((s) => h('tr', {
          style: { opacity: s.valid ? 1 : 0.5 },
          class: onOpen ? 'tap' : null,
          onclick: onOpen ? () => onOpen(s) : null,
        }, ...[
          `${fmtD(s.date)} ${fmtTime(new Date(s.startedAt))}`,
          f(s.pvt?.summary?.medianRT),
          f(s.pvt?.summary?.lapses),
          f(s.symbols?.summary?.medianRT),
          s.memory ? `${s.memory.immediate}+${s.memory.delayed}` : '–',
          f(s.now?.fog),
          onOpen ? '›' : '',
        ].map((v) => h('td', v)))),
      ),
    ),
  );
}

function notesCard(notes) {
  if (!notes.length) return null;
  const rows = notes.slice().sort((a, b) => b.at.localeCompare(a.at));
  return h('div.card',
    h('h3', `Notities (${rows.length})`),
    ...rows.map((n) => h('p.small',
      h('span.muted', `${fmtD(n.date)} ${fmtTime(new Date(n.at))}`),
      n.fog != null ? ` · helder ${n.fog}/10` : '',
      n.text ? ` · ${n.text}` : '')),
  );
}

// ---------- one session, everything ----------

const SLEEP_Q = ['', 'zeer slecht', 'slecht', 'redelijk', 'goed', 'zeer goed'];
const ACTIVITY = ['geen', 'licht', 'flink'];
const STRESS = ['', 'laag', 'normaal', 'hoog'];

export function sessionDetail(s) {
  const kv = (label, value) => h('div.kv', h('span.muted', label), h('span', value == null || value === '' ? '–' : value));
  const n = (v, d = 0, unit = '') => (Number.isFinite(v) ? `${fmt(v, d)}${unit}` : '–');
  const sec = (ms) => (Number.isFinite(ms) ? `${fmt(ms / 1000, 1)} s` : '–');
  const card = (title, ...rows) => h('div.card', h('h3', title), ...rows);
  const out = [];

  const dur = s.finishedAt ? (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000 : NaN;
  const flags = [];
  if (s.flags?.interrupted) flags.push(`onderbroken (${s.flags.interruptedDuring.join(', ')})`);
  if (s.flags?.lowFrameRate) flags.push('lage beeldverversing');
  out.push(card(`${s.date} · ${fmtTime(new Date(s.startedAt))}`,
    s.valid ? h('span.tag.ok', { style: { alignSelf: 'flex-start' } }, 'geldig')
      : h('p.small', { style: { color: 'var(--warn)' } }, `Ongeldig: ${s.invalidReasons.join(', ')}`),
    kv('Soort', { full: 'volledig', short: 'kort', practice: 'oefenronde' }[s.kind] || s.kind),
    kv('Duur', n(dur, 1, ' min')),
    kv('Bijzonderheden', flags.join(', ') || 'geen'),
    kv('App-versie', s.appVersion),
  ));

  const c = s.context || {};
  out.push(card('Nu',
    kv('Mist nu', n(s.now?.fog, 0, ' / 10')),
    kv('Slaapkwaliteit', SLEEP_Q[s.now?.sleepQuality]),
    kv('Lichten uit', `${s.now?.bedTime || '–'} (${s.now?.bedSource || '?'})`),
    kv('Wakker', `${s.now?.wakeTime || '–'} (${s.now?.wakeSource || '?'})`),
    kv('Tijd in bed', Number.isFinite(c.timeInBedMin) ? `${Math.floor(c.timeInBedMin / 60)}:${String(c.timeInBedMin % 60).padStart(2, '0')} uur` : '–'),
    kv('Minuten sinds wakker', n(c.minutesSinceWake)),
  ));

  if (s.words && s.memory) {
    const m = s.memory;
    const grid = h('div.review-grid', h('span'), h('span.hdr', '1e keer'), h('span.hdr', '2e keer'));
    const mark = (v) => h('span.center', { style: { color: v ? 'var(--good)' : 'var(--muted)' } }, v ? '✓' : '–');
    s.words.forEach((w, i) => grid.append(h('span', w), mark(m.recalledFirst?.[i]), mark(m.recalledSecond?.[i])));
    const timing = (r) => r?.timing || {};
    const t1 = timing(s.recall?.first), t2 = timing(s.recall?.second);
    const rows = [
      kv('Goed 1e / 2e keer', `${m.immediate} / ${m.delayed}`),
      kv('Door jou verbeterd', `${m.reviewEdits ?? 0} vinkje(s)`),
      kv('Eerste woord 1e / 2e keer', `${sec(t1.firstWordMs ?? t1.firstLatencyMs)} / ${sec(t2.firstWordMs ?? t2.firstLatencyMs)}`),
      kv('Stiltes > 5 s 1e / 2e keer', `${t1.blanks ?? '–'} / ${t2.blanks ?? '–'}`),
    ];
    if (s.recall?.first?.taps) rows.push(kv('Getikt 1e / 2e keer (v1.0)', `${s.recall.first.taps.length} / ${s.recall.second.taps.length}`));
    out.push(card('Woordenlijst', grid, ...rows,
      s.recall?.first?.speech ? heardBlock('1e keer', s.recall.first, s.words, m.auto?.first || []) : null,
      s.recall?.second?.speech ? heardBlock('2e keer', s.recall.second, s.words, m.auto?.second || []) : null,
    ));
  }

  const p = s.pvt?.summary;
  if (p) {
    out.push(card('Reactietest',
      kv('Reacties', n(p.n)),
      kv('Mediaan', n(p.medianRT, 0, ' ms')),
      kv('Snelste 10%', n(p.fastest10RT, 0, ' ms')),
      kv('Traagste 10%', n(p.slowest10Speed ? 1000 / p.slowest10Speed : NaN, 0, ' ms')),
      kv('Missers ≥ 355 / ≥ 500 ms', `${p.lapses} / ${p.lapses500}`),
      kv('Te vroeg', n(p.falseStarts)),
      kv('Snelheid (gem. 1/RT)', n(p.meanSpeed, 2, ' /s')),
      kv('Variabiliteit (CV)', n(p.cvRT * 100, 1, '%')),
      kv('Beeldverversing', Number.isFinite(c.frameMs) ? `${fmt(c.frameMs, 1)} ms (${Math.round(1000 / c.frameMs)} Hz)` : '–'),
    ));
  }

  const sy = s.symbols?.summary;
  if (sy) {
    out.push(card('Symbolen',
      kv('Opgaven', n(sy.n)),
      kv('Goed', n(sy.accuracy * 100, 0, '%')),
      kv('Mediaan (goede)', n(sy.medianRT, 0, ' ms')),
    ));
  }

  const y = s.yesterday;
  if (y) {
    out.push(card('Gisteren',
      kv('Mist overdag', y.dayOff ? 'vrije dag' : n(y.dayFog, 0, ' / 10')),
      Number.isFinite(c.steps24h) ? kv('Stappen', c.steps24h.toLocaleString('nl-NL')) : kv('Beweging', ACTIVITY[y.activity]),
      kv('Stress / werkdruk', STRESS[y.stress]),
      h('p.small', { style: { whiteSpace: 'pre-wrap' } }, y.note || h('span.muted', 'Geen notitie.')),
    ));
  }

  if (s.motor) {
    out.push(card('Automatisch',
      kv('Tik-afwijking (mediaan)', n(s.motor.medianOffsetPx, 1, ' px')),
      kv('Gemeten tikken', n(s.motor.taps)),
    ));
  }
  return out;
}

function fmt(v, digits) {
  return Number(v).toLocaleString('nl-NL', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
