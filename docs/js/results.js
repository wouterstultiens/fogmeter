// Results: today's numbers vs. your normal, 7-day trend chart, domain breakdown.
import { h } from './ui.js';
import { computeIndices, rolling, median, RUN_IN, BASELINE_N } from './scoring.js';

const SERIES = [
  { key: 'obj', label: 'Testscores', color: '#3987e5', dash: '' },
  { key: 'subj', label: 'Hoe je je voelt', color: '#d95926', dash: '6 4' },
];
// A 7-day mean of a z-score (SD 1) varies by ~1/sqrt(7); ±2 of that ≈ ±0.76 is "normal wobble".
const BAND = 0.76;

export function resultsView(sessions, highlight = null) {
  const ix = computeIndices(sessions);
  const days = ix.days;
  const today = highlight ? days.find((d) => d.session.id === highlight.id) : days[days.length - 1];
  return [
    phaseBanner(ix),
    today ? todayCard(today.session, days) : h('p.muted', 'Nog geen sessies.'),
    chartCard(ix),
    domainCard(ix),
    tableCard(days),
  ];
}

function phaseBanner(ix) {
  if (ix.phase === 'runin') {
    return h('div.banner', `Inwerkperiode: sessie ${ix.fullCount} van ${RUN_IN}. Je leert de taken nog; scores tellen nog niet mee.`);
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
      kpi('Woorden onthouden', s.memory ? s.memory.immediate + s.memory.delayed : NaN, ' /24', (x) => (x.memory ? x.memory.immediate + x.memory.delayed : NaN)),
      kpi('Woorden noemen', s.fluency?.summary?.valid, '', (x) => (x.fluency?.prompt?.mode === s.fluency?.prompt?.mode ? x.fluency?.summary?.valid : NaN)),
      kpi('Stiltes > 5 s', s.fluency?.summary?.blanks, '', (x) => x.fluency?.summary?.blanks),
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
    return h('div.card', h('h3', 'Week-trend'), h('p.muted.small', 'De grafiek verschijnt zodra de inwerkperiode voorbij is en er een week basislijn is.'));
  }
  return h('div.card.chart',
    h('h3', 'Week-trend (7-daags gemiddelde, t.o.v. jouw normaal)'),
    h('div.legend', ...SERIES.map((s) => h('span', h('i', { style: { background: s.color } }), s.label))),
    lineChart(lines),
    h('p.small.muted', 'Boven de 0 = beter dan jouw normaal. Het grijze vlak is normale schommeling; pas een week buiten het vlak is betekenisvol.'),
  );
}

function lineChart(lines) {
  const W = 340, H = 200, L = 34, R = 12, T = 12, B = 26;
  const dates = [...new Set(lines.flatMap((l) => l.pts.map((p) => p.date)))].sort();
  const t0 = Date.parse(dates[0]), t1 = Math.max(Date.parse(dates[dates.length - 1]), t0 + 6 * 86400000);
  const x = (d) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R);
  const lo = -2, hi = 2;
  const y = (v) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Week-trend van testscores en hoe je je voelt' });
  svg.append(el('rect', { x: L, y: y(BAND), width: W - L - R, height: y(-BAND) - y(BAND), fill: '#2a3039', rx: 4 }));
  for (const v of [-2, -1, 0, 1, 2]) {
    svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: v === 0 ? '#5b6573' : '#262c34', 'stroke-width': 1 }));
    const t = el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8d97a5' });
    t.textContent = v > 0 ? `+${v}` : String(v);
    svg.append(t);
  }
  const fmtD = (d) => { const [, m, dd] = d.split('-'); return `${+dd}/${+m}`; };
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
  ['retrieval', 'Woorden vinden (noemen)'],
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

function tableCard(days) {
  const recent = days.slice(-14).reverse();
  if (!recent.length) return null;
  const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  return h('details.card',
    h('summary', 'Tabel laatste 14 dagen'),
    h('div', { style: { overflowX: 'auto' } },
      h('table.small', { style: { width: '100%', borderCollapse: 'collapse' } },
        h('tr', ...['Datum', 'RT', 'Mis', 'Sym', 'Onth', 'Noem', 'Mist'].map((t) => h('th', { style: { textAlign: 'left', color: 'var(--muted)' } }, t))),
        ...recent.map((d) => {
          const s = d.session;
          return h('tr', { style: { opacity: s.valid ? 1 : 0.5 } },
            h('td', s.date.slice(5)),
            h('td', f(s.pvt?.summary?.medianRT)),
            h('td', f(s.pvt?.summary?.lapses)),
            h('td', f(s.symbols?.summary?.medianRT)),
            h('td', s.memory ? `${s.memory.immediate}+${s.memory.delayed}` : '–'),
            h('td', f(s.fluency?.summary?.valid)),
            h('td', f(s.now?.fog)),
          );
        }),
      ),
    ),
  );
}

function fmt(v, digits) {
  return Number(v).toLocaleString('nl-NL', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
