// PVT-B: 3-minute psychomotor vigilance test (Basner et al. 2011).
// Stimulus: a millisecond counter starts in the box. Tap anywhere as fast as possible.
// Timing: onset = rAF frame timestamp of the frame that shows the counter; response = event.timeStamp.
// Both are on the performance.now() clock; the constant display/touch latency of the device cancels
// out because the same phone is always used.
import { h, taskScreen, skipButton } from '../ui.js';
import { summarizePvt } from '../scoring.js';

export const PVT_DURATION_MS = 180000;
const ISI_MIN = 1000;
const ISI_MAX = 4000;
const FEEDBACK_MS = 1000;
const FALSE_START_MS = 100;
const TIMEOUT_MS = 30000;

function eventTime(e) {
  // High-resolution event timestamps share performance.now()'s origin; guard against epoch-based ones.
  return e.timeStamp > 0 && e.timeStamp < 1e11 ? e.timeStamp : performance.now();
}

/** Resolves { trials, summary, frameMs, skipped }; after a skip the trials are incomplete. */
export function runPvt({ durationMs = PVT_DURATION_MS } = {}) {
  return new Promise((resolve) => {
    const counter = h('div.pvt-counter.hidden', '000');
    const msg = h('div.pvt-msg', '');
    const bar = h('div');
    let skipped = false;
    const skip = skipButton(() => { skipped = true; finish(); });
    const screen = taskScreen(h('div.pvt-box', counter), msg, skip, h('div.progress', bar));

    const trials = [];
    const frameDeltas = [];
    let state = 'wait'; // wait | stim | feedback | done
    let onsetAt = 0; // scheduled onset (performance.now clock)
    let onsetFrame = 0; // actual frame timestamp of onset
    let isi = 0;
    let lastFrame = 0;
    const t0 = performance.now();

    const schedule = (from) => {
      isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
      onsetAt = from + isi;
      state = 'wait';
    };

    const feedback = (text, warn = false) => {
      state = 'feedback';
      msg.textContent = text;
      msg.className = warn ? 'pvt-msg warn' : 'pvt-msg';
      setTimeout(() => {
        if (state === 'done') return;
        counter.classList.add('hidden');
        msg.textContent = '';
        if (performance.now() - t0 >= durationMs) finish();
        else schedule(performance.now());
      }, FEEDBACK_MS);
    };

    const onDown = (e) => {
      e.preventDefault();
      const t = eventTime(e);
      if (state === 'stim') {
        const rt = t - onsetFrame;
        counter.textContent = String(Math.max(0, Math.round(rt))).padStart(3, '0');
        if (rt < FALSE_START_MS) {
          trials.push({ type: 'fs', rt: round1(rt), isi: Math.round(isi), at: Math.round(onsetFrame - t0) });
          feedback('Te vroeg', true);
        } else {
          trials.push({ type: 'rt', rt: round1(rt), isi: Math.round(isi), at: Math.round(onsetFrame - t0) });
          feedback('');
        }
      } else if (state === 'wait') {
        trials.push({ type: 'fs', rt: null, isi: Math.round(isi), at: Math.round(t - t0) });
        counter.classList.add('hidden');
        feedback('Te vroeg', true);
      }
    };

    const loop = (ts) => {
      if (state === 'done') return;
      if (lastFrame) frameDeltas.push(ts - lastFrame);
      lastFrame = ts;
      const now = performance.now();
      bar.style.width = `${Math.min(100, ((now - t0) / durationMs) * 100)}%`;
      if (state === 'wait') {
        if (onsetAt - t0 >= durationMs) { finish(); return; }
        if (now >= onsetAt) {
          state = 'stim';
          onsetFrame = ts;
          counter.textContent = '000';
          counter.classList.remove('hidden');
        }
      } else if (state === 'stim') {
        const el = now - onsetFrame;
        counter.textContent = String(Math.max(0, Math.floor(el))).padStart(3, '0');
        if (el > TIMEOUT_MS) {
          trials.push({ type: 'timeout', rt: null, isi: Math.round(isi), at: Math.round(onsetFrame - t0) });
          feedback('Wakker blijven!', true);
        }
      }
      requestAnimationFrame(loop);
    };

    function finish() {
      if (state === 'done') return;
      state = 'done';
      screen.removeEventListener('pointerdown', onDown);
      const sorted = frameDeltas.slice().sort((a, b) => a - b);
      const frameMs = sorted.length ? round1(sorted[Math.floor(sorted.length / 2)]) : null;
      resolve({ trials, summary: summarizePvt(trials), frameMs, skipped });
    }

    screen.addEventListener('pointerdown', onDown, { passive: false });
    schedule(t0);
    requestAnimationFrame(loop);
  });
}

function round1(x) { return Math.round(x * 10) / 10; }
