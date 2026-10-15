// Digit Symbol Substitution (DSST), as in the NASA Cognition battery and smartphone DSST studies: a key of nine
// symbols over the digits 1–9 at the top, one symbol in the middle, tap its digit. Fixed 90 s.
// Processing speed with a working-memory part (the key is looked up, then partly held): after the PVT the
// test most hurt by a night without sleep (d 0.68 vs 1.00; Basner 2015), and in daily smartphone use it tracked
// how well people could concentrate that day (Perzl 2024). Many short answers (~60–80 a session), so a lucky or
// unlucky mix of items barely moves the score, and there are no shortcuts like with sums.
// Always the same nine symbols, so every day is equally hard; only which digit belongs to which symbol is new
// each day, so the key can't be learned across days.
import { h, taskScreen, sleep, skipButton } from '../ui.js';
import { summarizeDsst } from '../scoring.js';

export const DSST_MS = 90000;
const ITI_MS = 150;

const poly = (pts) => `<polygon points="${pts}"/>`;
function star(n, r1, r2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return poly(pts.join(' '));
}
function ngon(n, r, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (2 * Math.PI * i) / n;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return poly(pts.join(' '));
}

// Nine clearly different shapes on a 0..100 viewBox (no near-twins like circle/hexagon, two triangles or triangle/arrow).
// Fixed forever: changing them changes the difficulty.
export const SYMBOLS = [
  '<rect x="14" y="14" width="72" height="72"/>', // square
  ngon(3, 46), // triangle
  star(5, 48, 20), // star
  '<path d="M38 8h24v30h30v24H62v30H38V62H8V38h30z"/>', // plus
  '<path d="M20 8 50 38 80 8 92 20 62 50 92 80 80 92 50 62 20 92 8 80 38 50 8 20z"/>', // cross
  '<circle cx="50" cy="50" r="36" fill="none" stroke-width="16"/>', // ring
  '<path d="M8 66a42 42 0 0 1 84 0z"/>', // half circle
  '<path d="M8 8h36v36H8zM56 56h36v36H56z"/>', // two squares
  '<path d="M10 20 50 60 90 20 90 48 50 88 10 48z"/>', // chevron
];

export function symbolSvg(i) {
  return `<svg viewBox="0 0 100 100" fill="currentColor" stroke="currentColor" stroke-width="0">${SYMBOLS[i]}</svg>`;
}

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Today's key: key[d − 1] is the symbol for digit d. */
export function makeKey(rand = Math.random) {
  return shuffle(SYMBOLS.map((_, i) => i), rand);
}

/**
 * Endless digit source in shuffled blocks of 1–9, so every digit (and key position) comes up equally often wherever
 * the time runs out, and never the same digit twice in a row.
 */
export function digitSource(rand = Math.random) {
  let block = [];
  let last = 0;
  return () => {
    if (!block.length) {
      do block = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand); while (block[0] === last);
    }
    last = block.shift();
    return last;
  };
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Resolves { key, trials, summary, motor }, or { skipped: true }. A symbol still open when the time is up is dropped. */
export function runDsst({ durationMs = DSST_MS } = {}) {
  const key = makeKey();
  const next = digitSource();
  const keyRow = h('div.dsst-key', ...key.map((sym, i) => h('div.dsst-cell', { 'data-sym': sym },
    h('div', { html: symbolSvg(sym) }), h('div.dsst-digit', String(i + 1)))));
  const probe = h('div.dsst-probe');
  const bar = h('div');
  const keys = KEYS.map((k) => h('button.key', { type: 'button', 'data-key': k }, k));
  let stop = null;
  const skip = skipButton(() => stop(true));
  const screen = taskScreen(
    h('div.topbar', h('span', 'Welk cijfer hoort erbij?')), skip,
    keyRow,
    h('div.dsst-mid', probe),
    h('div.keypad', ...keys),
    h('div.progress', bar),
  );

  const results = [];
  const offsets = [];
  let misses = 0;

  return new Promise((resolve) => {
    let digit = 0;
    let onset = 0;
    let accepting = false;
    let stopped = false;
    const t0 = performance.now();

    const onMissTap = (e) => {
      if (accepting && !e.target.closest('.key, .skip')) misses++;
    };
    screen.addEventListener('pointerdown', onMissTap);

    const tick = setInterval(() => {
      const left = durationMs - (performance.now() - t0);
      bar.style.width = `${Math.min(100, ((durationMs - left) / durationMs) * 100)}%`;
      if (left <= 0) stop(false);
    }, 250);

    stop = (skipped) => {
      if (stopped) return;
      stopped = true;
      accepting = false;
      clearInterval(tick);
      screen.removeEventListener('pointerdown', onMissTap);
      if (skipped) resolve({ skipped: true });
      else resolve({ key, trials: results, summary: summarizeDsst(results), motor: { offsets, misses } });
    };

    const show = () => {
      if (stopped) return;
      digit = next();
      probe.innerHTML = symbolSvg(key[digit - 1]);
      probe.dataset.sym = key[digit - 1];
      requestAnimationFrame((ts) => { onset = ts; accepting = true; });
    };

    async function onKey(e) {
      e.preventDefault();
      if (!accepting) return;
      accepting = false;
      const t = e.timeStamp > 0 && e.timeStamp < 1e11 ? e.timeStamp : performance.now();
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      offsets.push(Math.round(Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) * 10) / 10);
      const answer = Number(el.dataset.key);
      results.push({ digit, answer, correct: answer === digit, rt: Math.round((t - onset) * 10) / 10 });
      probe.innerHTML = '';
      delete probe.dataset.sym;
      await sleep(ITI_MS);
      show();
    }

    for (const b of keys) b.addEventListener('pointerdown', onKey, { passive: false });
    show();
  });
}
