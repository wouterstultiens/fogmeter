// Speech input (Web Speech API, Dutch) and text-to-speech.

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function asrSupported() {
  return !!Recognition;
}

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture']);

/**
 * Listens for the whole recall window and keeps everything the recogniser ever proposed.
 * - iOS stops after pauses: we restart immediately (with back-off if it keeps erroring).
 * - Every interim version and every alternative is kept, because the word list is known and
 *   matching against all guesses catches words the final transcript dropped or garbled.
 * onState('starting' | 'listening' | 'restarting' | 'off') drives the "you can talk now" light.
 */
export class SpeechListener {
  constructor({ lang = 'nl-NL', hints = [], onState, onText } = {}) {
    this.lang = lang;
    this.hints = hints;
    this.onState = onState;
    this.onText = onText;
    this.latest = []; // latest full transcript per recogniser instance
    this.seen = new Set(); // every transcript/alternative string seen
    this.errors = [];
    this.fatal = null;
    this.running = false;
    this.restarts = 0;
    this.failStreak = 0;
  }

  start() {
    this.t0 = performance.now();
    this.running = true;
    this.onState?.('starting');
    this._spawn();
  }

  _spawn() {
    if (!this.running) return;
    const rec = new Recognition();
    const slot = this.latest.push('') - 1;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    // Contextual biasing where the browser supports it (ignored elsewhere).
    try {
      if (this.hints.length && 'phrases' in rec && window.SpeechRecognitionPhrase) {
        rec.phrases = this.hints.map((p) => new window.SpeechRecognitionPhrase(p, 5));
      }
    } catch { /* not supported */ }
    let gotAudio = false;
    rec.onaudiostart = () => { gotAudio = true; this.failStreak = 0; this.onState?.('listening'); };
    rec.onstart = () => { if (!gotAudio) this.onState?.('listening'); };
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        text += ' ' + res[0].transcript;
        for (let a = 0; a < res.length; a++) if (res[a]?.transcript) this.seen.add(res[a].transcript.trim());
      }
      this.latest[slot] = text.trim();
      this.seen.add(text.trim());
      this.onText?.(this.transcript());
    };
    rec.onerror = (e) => {
      this.errors.push(e.error);
      if (FATAL.has(e.error)) { this.fatal = e.error; this.onState?.('off'); }
      else if (e.error !== 'no-speech' && e.error !== 'aborted') this.failStreak++;
    };
    rec.onend = () => {
      if (!this.running || this.fatal) return;
      if (this.restarts++ > 60) { this.onState?.('off'); return; }
      this.onState?.('restarting');
      const delay = Math.min(2000, this.failStreak * 250);
      setTimeout(() => this._spawn(), delay);
    };
    this.rec = rec;
    try { rec.start(); } catch (err) { this.fatal = String(err); this.onState?.('off'); }
  }

  /** Readable transcript: latest text of each recogniser instance. */
  transcript() {
    return this.latest.filter(Boolean).join(' · ');
  }

  /** Every string the recogniser proposed (for matching against the known list). */
  allTexts() {
    return [...this.seen];
  }

  /** Stops listening; waits briefly so the final result can still arrive. */
  async stop() {
    this.running = false;
    const rec = this.rec;
    try { rec?.stop(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 1000));
    try { rec?.abort(); } catch { /* ignore */ }
    this.onState?.('off');
    return { transcript: this.transcript(), texts: this.allTexts(), errors: [...new Set(this.errors)], fatal: this.fatal, restarts: this.restarts };
  }
}

// ---------- text-to-speech ----------

let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'nl-NL') || voices.find((v) => v.lang?.startsWith('nl')) || null;
}

/** Must be called from a user gesture (iOS unlocks speech synthesis on first use). */
export function unlockTts() {
  if (!('speechSynthesis' in window)) return;
  voice = pickVoice();
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function ttsVoiceName() {
  voice = voice || pickVoice();
  return voice ? voice.name : null;
}

export function say(word) {
  if (!('speechSynthesis' in window)) return;
  voice = voice || pickVoice();
  if (!voice) return; // no Dutch voice: visual only, rather than English pronunciation
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1;
  speechSynthesis.speak(u);
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}

/** Starts and immediately stops a recogniser so the permission prompt appears before any timed task. */
export function primeMic() {
  if (!Recognition) return;
  try {
    const rec = new Recognition();
    rec.lang = 'nl-NL';
    rec.onerror = () => {};
    rec.start();
    setTimeout(() => { try { rec.abort(); } catch { /* ignore */ } }, 600);
  } catch { /* ignore */ }
}
