// Word-list encoding and the spoken recall screen (speech recognition, checked at the end of the session).
import { h, taskScreen, sleep, skipButton } from '../ui.js';
import { say, SpeechListener, asrSupported } from '../speech.js';

export const WORD_MS = 1500; // onset-to-onset per word
const WORD_VISIBLE_MS = 1250;

/** Shows the list one word at a time (written + spoken). Resolves { skipped }. */
export async function encodeList(words) {
  const word = h('div.bigword', '');
  const bar = h('div');
  let skipped = false;
  let onSkip;
  const skipping = new Promise((r) => { onSkip = r; });
  const pause = (ms) => Promise.race([sleep(ms), skipping]);
  const skip = skipButton(() => { skipped = true; onSkip(); });
  taskScreen(h('div.topbar', h('span', 'Onthoud de woorden'), h('span', '')), skip, word, h('div.progress', bar));
  word.textContent = '+';
  await pause(1000);
  const t0 = performance.now();
  for (let i = 0; i < words.length && !skipped; i++) {
    // Drift-free schedule: wait until this word's planned onset.
    const wait = t0 + i * WORD_MS - performance.now();
    if (wait > 0) await pause(wait);
    if (skipped) break;
    word.textContent = words[i];
    say(words[i]);
    bar.style.width = `${((i + 1) / words.length) * 100}%`;
    await pause(WORD_VISIBLE_MS);
    word.textContent = '';
  }
  if (!skipped) await pause(Math.max(0, t0 + words.length * WORD_MS - performance.now()));
  return { skipped };
}

const MIC_WAIT_MAX_MS = 2500; // start the clock anyway if the microphone takes longer than this

const LIGHT = {
  starting: ['Microfoon start…', ''],
  listening: ['Luistert, praat maar', 'live'],
  restarting: ['Luistert…', 'live'],
  off: ['Geen spraakherkenning: noem ze toch hardop, je vinkt ze aan het eind zelf aan', 'off'],
};

const MIC_ICON = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';

/**
 * Timed spoken recall: say each word aloud; speech recognition listens.
 * The clock starts once the microphone is actually on, so the first word isn't lost.
 * Nothing of what was heard is shown here (no text, no count): that would reveal which words count.
 * The microphone circle only lights up when the recogniser hears something.
 * Resolves { durationMs, endedEarly, speech: {transcript, texts, timeline, errors, fatal, restarts} },
 * with timeline times in ms since the clock started, or { skipped: true }.
 */
export function recallTask({ title, subtitle = '', seconds, hints = [] }) {
  return new Promise((resolve) => {
    let ended = false;
    let t0 = null;
    let tick = null;
    const timer = h('div.timer', fmt(seconds));
    const bar = h('div');
    const dot = h('span.dot');
    const lightLabel = h('span', '');
    const mic = h('div.mic', { html: MIC_ICON });
    const done = h('button', { style: { marginTop: '28px', minWidth: '160px' }, onclick: () => end(true) }, 'Klaar');
    taskScreen(
      h('div.topbar', h('span', subtitle), timer),
      skipButton(() => end(true, true)),
      h('div.prompt', title),
      h('p.muted.small.center', { style: { margin: '8px 0 28px' } }, 'Zeg elk woord hardop en duidelijk. Geen woorden meer? Tik op Klaar.'),
      mic,
      h('div.listen', { style: { marginTop: '14px' } }, dot, lightLabel),
      done,
      h('div.progress', bar),
    );

    const setLight = (state) => {
      const [label, cls] = LIGHT[state] || LIGHT.off;
      lightLabel.textContent = label;
      dot.className = `dot ${cls}`;
      mic.classList.toggle('live', cls === 'live');
      if ((state === 'listening' || state === 'off') && t0 === null) startClock();
    };
    const heard = () => {
      mic.classList.remove('heard');
      void mic.offsetWidth;
      mic.classList.add('heard');
    };

    let listener = null;
    if (asrSupported()) {
      listener = new SpeechListener({ hints, onState: setLight, onText: heard });
      listener.start();
      setTimeout(() => { if (t0 === null) startClock(); }, MIC_WAIT_MAX_MS);
    } else {
      setLight('off');
    }

    function startClock() {
      if (ended) return;
      t0 = performance.now();
      tick = setInterval(() => {
        const el = (performance.now() - t0) / 1000;
        timer.textContent = fmt(Math.max(0, Math.ceil(seconds - el)));
        bar.style.width = `${Math.min(100, (el / seconds) * 100)}%`;
        if (el >= seconds) end(false);
      }, 100);
    }

    async function end(early, skipped = false) {
      if (ended) return;
      ended = true;
      clearInterval(tick);
      done.disabled = true;
      if (skipped) {
        await listener?.stop();
        resolve({ skipped: true });
        return;
      }
      const start = t0 ?? performance.now();
      const durationMs = t0 === null ? 0 : Math.round(performance.now() - t0);
      const speech = listener
        ? await listener.stop()
        : { transcript: '', texts: [], timeline: [], errors: ['unsupported'], fatal: 'unsupported', restarts: 0 };
      speech.timeline = speech.timeline.map(([t, text]) => [Math.max(0, Math.round(t - start)), text]);
      resolve({ durationMs, endedEarly: early, speech });
    }
  });
}

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
