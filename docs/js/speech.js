// Speech input (Web Speech API, Dutch) and text-to-speech.
import { tokenize } from './scoring.js';

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function asrSupported() {
  return !!Recognition;
}

/**
 * Collects unique spoken words with the time each was first heard.
 * iOS stops recognition after pauses and sometimes repeats results, so we restart automatically
 * and keep, per recognition instance, only its latest transcript (drops interim guesses that got revised).
 */
export class SpeechListener {
  constructor({ lang = 'nl-NL', onChange } = {}) {
    this.lang = lang;
    this.onChange = onChange;
    this.instances = []; // latest token list per instance
    this.firstSeen = new Map();
    this.errors = [];
    this.fatal = null;
    this.running = false;
  }

  start() {
    this.t0 = performance.now();
    this.running = true;
    this._spawn();
  }

  _spawn() {
    if (!this.running) return;
    const rec = new Recognition();
    const slot = this.instances.push([]) - 1;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += ' ' + e.results[i][0].transcript;
      const toks = tokenize(text);
      const now = performance.now() - this.t0;
      for (const t of toks) if (!this.firstSeen.has(t)) this.firstSeen.set(t, now);
      this.instances[slot] = toks;
      this.onChange?.(this.words().length);
    };
    rec.onerror = (e) => {
      this.errors.push(e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
        this.fatal = e.error;
        this.onChange?.(this.words().length);
      }
    };
    rec.onend = () => {
      if (this.running && !this.fatal) setTimeout(() => this._spawn(), 30);
    };
    this.rec = rec;
    try { rec.start(); } catch (err) { this.fatal = String(err); }
  }

  /** Unique words (union over instances) with first-seen time, in order heard. */
  words() {
    const set = new Set(this.instances.flat());
    return [...set].map((w) => ({ w, t: Math.round(this.firstSeen.get(w) ?? 0) })).sort((a, b) => a.t - b.t);
  }

  /** Stops listening; waits briefly so the final result can still arrive. */
  async stop() {
    this.running = false;
    const rec = this.rec;
    try { rec?.stop(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 1200));
    try { rec?.abort(); } catch { /* ignore */ }
    return this.words();
  }
}

/** Typed fallback with the same interface: each word is committed on space/enter. */
export class TypedListener {
  constructor({ input, onChange } = {}) {
    this.input = input;
    this.onChange = onChange;
    this.list = [];
    this.fatal = null;
    this.errors = [];
  }

  start() {
    this.t0 = performance.now();
    const commit = () => {
      const toks = tokenize(this.input.value);
      const t = Math.round(performance.now() - this.t0);
      for (const w of toks) if (!this.list.some((x) => x.w === w)) this.list.push({ w, t });
      this.input.value = '';
      this.onChange?.(this.list.length, this.list);
    };
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === ',') { e.preventDefault(); commit(); }
    });
    this.commit = commit;
    this.input.focus();
  }

  words() { return this.list.slice(); }

  async stop() {
    this.commit?.();
    return this.words();
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
