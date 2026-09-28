// Symbol Search (after M2C2 / Sliwinski 2018): which of the two bottom pairs appears on top?
import { h, taskScreen, sleep } from '../ui.js';
import { summarizeSymbols } from '../scoring.js';

export const SYMBOL_TRIALS = 30;
const ITI_MS = 400;

// 16 simple, clearly distinct shapes on a 0..100 viewBox.
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
const SHAPES = [
  '<circle cx="50" cy="50" r="40"/>',
  '<rect x="12" y="12" width="76" height="76"/>',
  ngon(3, 44),
  ngon(4, 44, 0),
  star(5, 46, 20),
  '<path d="M38 8h24v30h30v24H62v30H38V62H8V38h30z"/>',
  '<path d="M20 8 50 38 80 8 92 20 62 50 92 80 80 92 50 62 20 92 8 80 38 50 8 20z"/>',
  ngon(6, 44, 0),
  '<circle cx="50" cy="50" r="40" fill="none" stroke-width="14"/>',
  '<path d="M10 50a40 40 0 0 1 80 0z"/>',
  '<path d="M50 6 94 50 72 50 72 94 28 94 28 50 6 50z"/>',
  '<path d="M60 8a42 42 0 1 0 0 84 32 32 0 1 1 0-84z"/>',
  '<rect x="8" y="36" width="84" height="28"/>',
  '<path d="M10 20 50 60 90 20 90 48 50 88 10 48z"/>',
  ngon(3, 44, Math.PI / 2),
  '<path d="M8 8h36v36H8zM56 56h36v36H56z"/>',
];

function svg(i) {
  return `<svg viewBox="0 0 100 100" fill="currentColor" stroke="currentColor">${SHAPES[i]}</svg>`;
}

function pairEl(pair, cls = 'pair') {
  return h(`div.${cls}`, { html: svg(pair[0]) + svg(pair[1]) });
}

function sample(pool, n) {
  const a = pool.slice();
  const out = [];
  while (out.length < n) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
}

export function makeTrial(lure) {
  const all = SHAPES.map((_, i) => i);
  const six = sample(all, 6);
  const top = [[six[0], six[1]], [six[2], six[3]], [six[4], six[5]]];
  const unused = all.filter((i) => !six.includes(i));
  const target = top[Math.floor(Math.random() * 3)];
  let foil;
  if (lure) {
    // Shares exactly one symbol (in the same position) with one top pair.
    const src = top[Math.floor(Math.random() * 3)];
    const other = unused[Math.floor(Math.random() * unused.length)];
    foil = Math.random() < 0.5 ? [src[0], other] : [other, src[1]];
  } else {
    foil = sample(unused, 2);
  }
  const targetLeft = Math.random() < 0.5;
  return { top, target, foil, lure, targetLeft };
}

export function runSymbols({ trials: nTrials = SYMBOL_TRIALS } = {}) {
  // Exactly half the trials have a lure, in random order.
  const lures = Array.from({ length: nTrials }, (_, i) => i < nTrials / 2);
  lures.sort(() => Math.random() - 0.5);
  const topRow = h('div.sym-top');
  const bottomRow = h('div.sym-bottom');
  const count = h('span', '');
  const bar = h('div');
  const screen = taskScreen(h('div.topbar', h('span', 'Welk paar staat bovenaan?'), count), topRow, bottomRow, h('div.progress', bar));

  const results = [];
  const offsets = [];
  let misses = 0;

  return new Promise((resolve) => {
    let i = 0;
    let onset = 0;
    let current = null;
    let accepting = false;

    const onMissTap = (e) => {
      if (accepting && !e.target.closest('.option')) misses++;
    };
    screen.addEventListener('pointerdown', onMissTap);

    const show = async () => {
      if (i >= nTrials) {
        screen.removeEventListener('pointerdown', onMissTap);
        resolve({ trials: results, summary: summarizeSymbols(results), motor: { offsets, misses } });
        return;
      }
      current = makeTrial(lures[i]);
      count.textContent = `${i + 1}/${nTrials}`;
      bar.style.width = `${(i / nTrials) * 100}%`;
      topRow.replaceChildren(...current.top.map((p) => pairEl(p)));
      const left = pairEl(current.targetLeft ? current.target : current.foil, 'pair.option');
      const right = pairEl(current.targetLeft ? current.foil : current.target, 'pair.option');
      left.dataset.side = 'L';
      right.dataset.side = 'R';
      for (const el of [left, right]) el.addEventListener('pointerdown', onPick, { passive: false });
      bottomRow.replaceChildren(left, right);
      requestAnimationFrame((ts) => { onset = ts; accepting = true; });
    };

    async function onPick(e) {
      e.preventDefault();
      if (!accepting) return;
      accepting = false;
      const t = e.timeStamp > 0 && e.timeStamp < 1e11 ? e.timeStamp : performance.now();
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const off = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      offsets.push(Math.round(off * 10) / 10);
      const pickedLeft = el.dataset.side === 'L';
      results.push({
        rt: Math.round((t - onset) * 10) / 10,
        correct: pickedLeft === current.targetLeft,
        lure: current.lure,
        side: current.targetLeft ? 'L' : 'R',
      });
      topRow.replaceChildren();
      bottomRow.replaceChildren();
      i++;
      await sleep(ITI_MS);
      show();
    }

    show();
  });
}
