// Word-list encoding and the say-aloud-and-tap recall screen (with background speech recognition).
import { h, taskScreen, sleep } from '../ui.js';
import { say, SpeechListener, asrSupported } from '../speech.js';

export const WORD_MS = 1500; // onset-to-onset per word
const WORD_VISIBLE_MS = 1250;

/** Shows the list one word at a time (written + spoken). */
export async function encodeList(words) {
  const word = h('div.bigword', '');
  const bar = h('div');
  taskScreen(h('div.topbar', h('span', 'Onthoud de woorden'), h('span', '')), word, h('div.progress', bar));
  word.textContent = '+';
  await sleep(1000);
  const t0 = performance.now();
  for (let i = 0; i < words.length; i++) {
    // Drift-free schedule: wait until this word's planned onset.
    const wait = t0 + i * WORD_MS - performance.now();
    if (wait > 0) await sleep(wait);
    word.textContent = words[i];
    say(words[i]);
    bar.style.width = `${((i + 1) / words.length) * 100}%`;
    await sleep(WORD_VISIBLE_MS);
    word.textContent = '';
  }
  await sleep(Math.max(0, t0 + words.length * WORD_MS - performance.now()));
}

const DEBOUNCE_MS = 250; // nobody says two words within 250 ms: treat as an accidental double tap

const MIC_WAIT_MAX_MS = 2500; // start the clock anyway if the microphone takes longer than this

const LIGHT = {
  starting: ['Microfoon start…', ''],
  listening: ['Praat maar', 'live'],
  restarting: ['Luistert…', 'live'],
  off: ['Geen spraakherkenning: alleen tikken telt', 'off'],
};

/**
 * Timed recall: say each word aloud and tap once per word, while speech recognition listens in
 * the background. The clock starts once the microphone is actually on, so the first word isn't lost.
 * The transcript is only shown in the end-of-session review (the list is never shown in between).
 * Resolves { taps, undone, durationMs, endedEarly, speech: {transcript, texts, errors, fatal, restarts} }.
 */
export function recallTask({ title, subtitle = '', seconds, hints = [] }) {
  return new Promise((resolve) => {
    const taps = [];
    let undone = 0;
    let ended = false;
    let t0 = null;
    let tick = null;
    const timer = h('div.timer', fmt(seconds));
    const count = h('div.tapcount', '0');
    const bar = h('div');
    const dot = h('span.dot');
    const lightLabel = h('span', '');
    const pad = h('button.tappad', { type: 'button' }, count, h('span.small', 'tik per woord'));
    const undo = h('button.link', { type: 'button', onclick: () => { if (taps.length) { taps.pop(); undone++; paint(); } } }, 'Oeps, laatste tik weg');
    const done = h('button', { onclick: () => end(true) }, 'Klaar');
    taskScreen(
      h('div.topbar', h('span', subtitle), timer),
      h('div.prompt', title),
      h('p.muted.small.center', { style: { margin: '8px 0 6px' } }, 'Zeg elk woord hardop en tik één keer per woord.'),
      h('div.listen', { style: { margin: '0 0 16px' } }, dot, lightLabel),
      pad,
      h('div.row', { style: { marginTop: '14px', gap: '24px' } }, undo, done),
      h('div.progress', bar),
    );

    const setLight = (state) => {
      const [label, cls] = LIGHT[state] || LIGHT.off;
      lightLabel.textContent = label;
      dot.className = `dot ${cls}`;
      if ((state === 'listening' || state === 'off') && t0 === null) startClock();
    };

    let listener = null;
    if (asrSupported()) {
      listener = new SpeechListener({ hints, onState: setLight });
      listener.start();
      setTimeout(() => { if (t0 === null) startClock(); }, MIC_WAIT_MAX_MS);
    } else {
      setLight('off');
    }

    function startClock() {
      t0 = performance.now();
      tick = setInterval(() => {
        const el = (performance.now() - t0) / 1000;
        timer.textContent = fmt(Math.max(0, Math.ceil(seconds - el)));
        bar.style.width = `${Math.min(100, (el / seconds) * 100)}%`;
        if (el >= seconds) end(false);
      }, 100);
    }

    const paint = () => { count.textContent = String(taps.length); };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (ended) return;
      if (t0 === null) startClock(); // tapping means you've started talking
      const t = Math.max(0, (e.timeStamp > 0 && e.timeStamp < 1e11 ? e.timeStamp : performance.now()) - t0);
      if (taps.length && t - taps[taps.length - 1] < DEBOUNCE_MS) return;
      taps.push(Math.round(t));
      paint();
      pad.classList.remove('flash');
      void pad.offsetWidth;
      pad.classList.add('flash');
    }, { passive: false });

    async function end(early) {
      if (ended) return;
      ended = true;
      clearInterval(tick);
      done.disabled = true;
      const durationMs = t0 === null ? 0 : Math.round(performance.now() - t0);
      const speech = listener ? await listener.stop() : { transcript: '', texts: [], errors: ['unsupported'], fatal: 'unsupported', restarts: 0 };
      resolve({ taps, undone, durationMs, endedEarly: early, speech });
    }
  });
}

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
