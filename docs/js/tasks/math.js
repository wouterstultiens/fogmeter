// Mental arithmetic, typed on a keypad, for a fixed 2 minutes. Every problem has more than one step, so a part
// result must be held while the rest is worked out: that loads working memory, which sleep loss hits harder than
// plain speed (Lim & Dinges 2010). Too many different problems to answer from memory.
// Every answer has three digits, so it is submitted on the third digit and each problem costs the same taps.
import { h, taskScreen, sleep, skipButton } from '../ui.js';
import { summarizeMath } from '../scoring.js';

export const MATH_MS = 120000;
export const ANSWER_DIGITS = 3;
const ITI_MS = 300;

const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/** ab × m: the units carry, answer 3 digits and never round (47 × 8 = 376). */
function multiplication(rand) {
  for (;;) {
    const a = int(rand, 2, 9) * 10 + int(rand, 2, 9), m = int(rand, 3, 9);
    const answer = a * m;
    if ((a % 10) * m < 10 || answer < 100 || answer % 10 === 0) continue;
    return { op: '×', a, b: m, answer };
  }
}

/** abc + de: carries into the tens and the hundreds, no zero digits in the answer (386 + 47 = 433). */
function addition(rand) {
  for (;;) {
    const ha = int(rand, 1, 8), ta = int(rand, 1, 9), ua = int(rand, 1, 9);
    const tb = int(rand, 1, 9), ub = int(rand, 2, 9);
    if (ua + ub < 11 || ta + tb + 1 < 11) continue;
    const a = ha * 100 + ta * 10 + ua, b = tb * 10 + ub;
    return { op: '+', a, b, answer: a + b };
  }
}

/** abc − de: borrows from the tens and the hundreds, answer ≥ 100 (432 − 57 = 375). */
function subtraction(rand) {
  for (;;) {
    const ha = int(rand, 2, 9), ta = int(rand, 1, 8), ua = int(rand, 1, 8);
    const tb = int(rand, ta, 9), ub = int(rand, ua + 1, 9);
    const a = ha * 100 + ta * 10 + ua, b = tb * 10 + ub;
    return { op: '−', a, b, answer: a - b };
  }
}

const KINDS = [multiplication, addition, subtraction];
export const OPS = { '×': 'mul', '+': 'add', '−': 'sub' };

/**
 * Endless problem source in blocks of one of each kind (shuffled within the block), so the mix is balanced
 * wherever the time runs out. No problem twice in a session.
 */
export function problemSource(rand = Math.random) {
  const seen = new Set();
  let block = [];
  return () => {
    if (!block.length) {
      block = KINDS.slice();
      for (let i = block.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [block[i], block[j]] = [block[j], block[i]];
      }
    }
    const make = block.shift();
    for (;;) {
      const p = make(rand);
      const key = `${p.a}${p.op}${p.b}`;
      if (!seen.has(key)) { seen.add(key); return p; }
    }
  };
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];

/** Resolves { trials, summary, motor }, or { skipped: true }. A problem still open when the time is up is dropped. */
export function runMath({ durationMs = MATH_MS } = {}) {
  const next = problemSource();
  const problemEl = h('div.math-problem');
  const answerEl = h('div.math-answer');
  const bar = h('div');
  const keys = KEYS.map((k) => (k ? h('button.key', { type: 'button', 'data-key': k }, k) : h('span')));
  let stop = null;
  const skip = skipButton(() => stop(true));
  const screen = taskScreen(
    h('div.topbar', h('span', 'Reken uit')), skip,
    h('div.math-top', problemEl, answerEl),
    h('div.keypad', ...keys),
    h('div.progress', bar),
  );

  const results = [];
  const offsets = [];
  let misses = 0;

  return new Promise((resolve) => {
    let p = null;
    let onset = 0;
    let typed = '';
    let firstKeyAt = null;
    let corrections = 0;
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
      else resolve({ trials: results, summary: summarizeMath(results), motor: { offsets, misses } });
    };

    const show = () => {
      if (stopped) return;
      p = next();
      typed = '';
      firstKeyAt = null;
      corrections = 0;
      problemEl.textContent = `${p.a} ${p.op} ${p.b}`;
      answerEl.textContent = '';
      requestAnimationFrame((ts) => { onset = ts; accepting = true; });
    };

    async function onKey(e) {
      e.preventDefault();
      if (!accepting) return;
      const t = e.timeStamp > 0 && e.timeStamp < 1e11 ? e.timeStamp : performance.now();
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      offsets.push(Math.round(Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) * 10) / 10);
      const k = el.dataset.key;
      if (k === '⌫') {
        if (typed) { typed = typed.slice(0, -1); corrections++; }
        answerEl.textContent = typed;
        return;
      }
      typed += k;
      answerEl.textContent = typed;
      if (firstKeyAt === null) firstKeyAt = t;
      if (typed.length < ANSWER_DIGITS) return;
      accepting = false;
      results.push({
        op: OPS[p.op],
        a: p.a,
        b: p.b,
        answer: Number(typed),
        correct: Number(typed) === p.answer,
        rt: Math.round((t - onset) * 10) / 10,
        firstKeyRt: Math.round((firstKeyAt - onset) * 10) / 10,
        corrections,
      });
      await sleep(120); // let the last digit be seen
      problemEl.textContent = '';
      answerEl.textContent = '';
      await sleep(ITI_MS);
      show();
    }

    for (const b of keys) if (b.dataset?.key) b.addEventListener('pointerdown', onKey, { passive: false });
    show();
  });
}
