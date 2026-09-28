// Word-list encoding, spoken/typed recall (immediate + delayed) and verbal fluency.
import { h, taskScreen, sleep } from '../ui.js';
import { SpeechListener, TypedListener, asrSupported, say } from '../speech.js';

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

/**
 * Timed free-response screen. mode 'speech' falls back to typing if speech recognition fails.
 * Returns { words:[{w,t}], mode, errors }.
 */
export function freeResponse({ title, subtitle = '', seconds, inputMode, allowDone = true }) {
  return new Promise((resolve) => {
    const useSpeech = inputMode === 'speech' && asrSupported();
    const timer = h('div.timer', fmt(seconds));
    const status = h('div.listen');
    const typedWrap = h('div.stack', { style: { width: '100%', maxWidth: '420px' } });
    const bar = h('div');
    const done = allowDone ? h('button', { style: { marginTop: '28px' }, onclick: () => end() }, 'Klaar') : null;
    taskScreen(
      h('div.topbar', h('span', subtitle), timer),
      h('div.prompt', title),
      status,
      typedWrap,
      done,
      h('div.progress', bar),
    );

    let listener;
    let typed;
    let usedMode = useSpeech ? 'speech' : 'typed';
    let ended = false;

    const startTyped = (carry = [], fallback = false) => {
      usedMode = fallback ? 'mixed' : 'typed';
      status.replaceChildren(h('span.small', 'Typ elk woord en druk op spatie.'));
      const input = h('input', { type: 'text', autocapitalize: 'none', autocomplete: 'off', spellcheck: false, enterkeyhint: 'next' });
      const chips = h('div.typed-list');
      typedWrap.replaceChildren(input, chips);
      typed = new TypedListener({
        input,
        onChange: (n, list) => chips.replaceChildren(...list.map((x) => h('span.tag', x.w))),
      });
      typed.carry = carry;
      typed.start();
    };

    if (useSpeech) {
      const dot = h('span.dot.live');
      const label = h('span', 'Luistert… 0 woorden');
      status.replaceChildren(dot, label);
      listener = new SpeechListener({
        onChange: (n) => {
          label.textContent = `Luistert… ${n} woorden`;
          if (listener.fatal && !typed) {
            const carry = listener.words();
            listener.stop();
            startTyped(carry, true);
          }
        },
      });
      listener.start();
    } else {
      startTyped();
    }

    const t0 = performance.now();
    const tick = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      timer.textContent = fmt(Math.max(0, Math.ceil(seconds - el)));
      bar.style.width = `${Math.min(100, (el / seconds) * 100)}%`;
      if (el >= seconds) end();
    }, 200);

    async function end() {
      if (ended) return;
      ended = true;
      clearInterval(tick);
      status.replaceChildren(h('span.muted', 'Even afronden…'));
      if (done) done.disabled = true;
      let words = [];
      const errors = listener ? listener.errors : [];
      if (typed) {
        const offset = listener ? Math.round(performance.now() - listener.t0) - Math.round(performance.now() - typed.t0) : 0;
        const tw = (await typed.stop()).map((x) => ({ w: x.w, t: x.t + offset }));
        words = mergeUnique(typed.carry || [], tw);
      } else if (listener) {
        words = await listener.stop();
      }
      resolve({ words, mode: usedMode, errors: [...new Set(errors)], durationMs: Math.round(performance.now() - t0) });
    }
  });
}

function mergeUnique(a, b) {
  const seen = new Set();
  return [...a, ...b].filter((x) => (seen.has(x.w) ? false : seen.add(x.w))).sort((x, y) => x.t - y.t);
}

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
