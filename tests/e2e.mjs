// End-to-end smoke test: makes a quick note, then plays one full session with shortened timings (?e2e)
// and a fake speech recogniser that returns deliberately messy transcripts (glued words, plurals, an
// intrusion), then opens the results and one session's details.
// Run: npm run serve (in another shell), then: node tests/e2e.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8080/';
const SHOTS = process.env.SHOTS || null;
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Fake Web Speech API: window.__emit(text) delivers a result to the active recogniser.
await page.addInitScript(() => {
  let active = null;
  class FakeRecognition {
    start() {
      active = this;
      this.results = [];
      setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 50);
    }
    stop() { setTimeout(() => this.onend?.(), 20); if (active === this) active = null; }
    abort() { if (active === this) active = null; }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  window.__emit = (text) => {
    if (!active) return false;
    const res = [{ transcript: text }];
    active.results.push(res);
    active.onresult?.({ results: active.results });
    return true;
  };
});

let shot = 0;
const snap = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${String(++shot).padStart(2, '0')}-${name}.png` }); };
const clickText = (t) => page.getByRole('button', { name: t, exact: true }).first().click();
const say = async (text) => { await page.waitForSelector('.dot.live'); await page.evaluate((t) => window.__emit(t), text); };

const wake = new Date(Date.now() - 20 * 60000);
await page.goto(`${BASE}?e2e&wake=${encodeURIComponent(stamp(wake))}&steps=8412`);
await page.waitForSelector('text=Fogmeter');
await snap('home');

// Quick note (as if made yesterday at work): text + optional rating.
await page.locator('button', { hasText: '+ Notitie' }).click();
await page.locator('textarea').fill('blanco moment in overleg');
await page.locator('.scale.s11 button').nth(6).click();
await snap('note');
await clickText('Bewaar');
await page.waitForSelector('text=1 sinds je laatste sessie');

await clickText('Start (± 6 min)');
await page.waitForSelector('text=Hoe helder voelt je hoofd nu?');
await page.locator('.scale.s11 button').nth(3).click();
await clickText('goed');
await snap('checkin');
await clickText('Verder');

// Word list: collect the words while they are shown.
await clickText('Start');
const words = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 25000) {
  const state = await page.evaluate(() => ({
    word: document.querySelector('.bigword')?.textContent || '',
    recall: !!document.querySelector('.mic'),
  }));
  if (state.word && state.word !== '+') words.add(state.word);
  if (state.recall) break;
  await page.waitForTimeout(100);
}
console.log('words seen:', [...words].join(', '));
if (words.size !== 12) throw new Error(`expected 12 words, saw ${words.size}`);
const list = [...words];

// First recall: recogniser glues two words together and hears one intrusion.
await say(`${list[0]}${list[1]}`);
await say(`${list[2]} banaan`);
await page.waitForTimeout(300);
await snap('recall');
const recallText = await page.locator('.task').textContent();
if (recallText.includes('banaan') || recallText.includes(list[3])) throw new Error('transcript or list shown during recall');
await clickText('Klaar');
await page.waitForSelector('text=Reactietest (3 min)', { timeout: 15000 });

// PVT: respond whenever the counter is visible.
await clickText('Start');
const pvtEnd = Date.now() + 20000;
while (Date.now() < pvtEnd) {
  if (await page.locator('text=Symbolen (± 1 min)').count()) break;
  if (await page.locator('.pvt-counter:not(.hidden)').count()) {
    await page.waitForTimeout(120);
    await page.mouse.click(195, 600);
  }
  await page.waitForTimeout(30);
}

// Symbol search: pick the option that appears on top.
await page.waitForSelector('text=Symbolen (± 1 min)');
await clickText('Start');
for (let i = 0; i < 4; i++) {
  await page.waitForSelector('.pair.option');
  const pick = await page.evaluate(() => {
    const top = [...document.querySelectorAll('.sym-top .pair')].map((p) => p.innerHTML);
    const opts = [...document.querySelectorAll('.pair.option')];
    return opts.findIndex((o) => top.includes(o.innerHTML));
  });
  if (i === 0) await snap('symbols');
  const box = await page.locator('.pair.option').nth(pick).boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 3, box.y + box.height / 2 - 2);
  await page.waitForTimeout(450);
}

// Second recall: a plural form and one normal word.
await page.waitForSelector('text=Woordenlijst, nog een keer', { timeout: 15000 });
await clickText('Start');
await say(`${list[0]}en`);
await say(list[5]);
// No "Klaar" here: let the timer run out.

// Review: prefilled from the transcripts; add one word the recogniser missed.
await page.waitForSelector('text=Controle', { timeout: 15000 });
const prefilled = await page.evaluate(() => [...document.querySelectorAll('.review-grid .toggle')].map((b) => b.classList.contains('selected')));
const marked = await page.locator('.transcript mark').allTextContents();
await snap('review');
await page.locator('.review-grid .toggle').nth(6 * 2 + 1).click(); // row 7, "2e keer"
await clickText('Opslaan');

// Yesterday (activity is skipped because steps came from the Shortcut)
await page.waitForSelector('text=Gisteren', { timeout: 15000 });
await page.locator('.scale.s11 button').nth(2).click();
await clickText('normaal');
const notePrefill = await page.locator('textarea').inputValue();
await page.locator('textarea').fill(`${notePrefill}\ntest: verder niets`);
await snap('yesterday');
await clickText('Verder');
await page.waitForSelector('text=Resultaten');
await snap('results');
const rawCharts = await page.locator('.mini svg').count();
await page.getByRole('heading', { name: 'Ruwe scores' }).scrollIntoViewIfNeeded();
await snap('results-raw');

// Session details from the table.
await page.locator('tr.tap').first().click();
await page.waitForSelector('text=Beeldverversing');
const detailText = await page.locator('#app').textContent();
await snap('detail');
await clickText('Terug');
await page.getByRole('heading', { name: 'Ruwe scores' }).waitFor();

const readStore = (name) => page.evaluate((store) => new Promise((res) => {
  const r = indexedDB.open('fogmeter');
  r.onsuccess = () => {
    const q = r.result.transaction(store).objectStore(store).getAll();
    q.onsuccess = () => res(q.result);
  };
}), name);
const saved = await readStore('sessions');
const notes = await readStore('notes');
const s = saved[saved.length - 1];
const firstAuto = prefilled.filter((_, i) => i % 2 === 0);
const secondAuto = prefilled.filter((_, i) => i % 2 === 1);
const checks = {
  kind: s.kind === 'full',
  wakeFromShortcut: s.now.wakeSource === 'shortcut',
  minutesSinceWake: s.context.minutesSinceWake >= 19 && s.context.minutesSinceWake <= 25,
  steps: s.context.steps24h === 8412,
  marked: marked.length === 4 && !marked.some((m) => m.includes('banaan')), // glued pair, word, plural, word
  prefillFirst: firstAuto.filter(Boolean).length === 3 && firstAuto[0] && firstAuto[1] && firstAuto[2],
  prefillSecond: secondAuto.filter(Boolean).length === 2 && secondAuto[0] && secondAuto[5],
  memoryImmediate: s.memory.immediate === 3,
  memoryDelayed: s.memory.delayed === 3,
  reviewEdits: s.memory.reviewEdits === 1,
  endedEarly: s.recall.first.endedEarly === true && s.recall.second.endedEarly === false,
  timing: s.recall.first.timing.firstWordMs !== null && s.recall.first.timing.onsets.filter((t) => t !== null).length === 3,
  timeline: s.recall.second.speech.timeline.length === 2,
  transcriptKept: s.recall.first.speech.transcript.includes('banaan'),
  intrusionSeen: s.memory.auto.extraFirst.includes('banaan'),
  pvtTrials: s.pvt.summary.n >= 1,
  symbolsCorrect: s.symbols.summary.accuracy === 1,
  yesterday: s.yesterday.dayFog === 2 && s.yesterday.stress === 2 && s.yesterday.note.endsWith('verder niets'),
  notePrefilled: /^\d\d:\d\d blanco moment in overleg$/.test(notePrefill) && s.yesterday.noteIds?.length === 1,
  noteSaved: notes.length === 1 && notes[0].fog === 6 && notes[0].text === 'blanco moment in overleg',
  rawCharts: rawCharts >= 5,
  detail: detailText.includes('Reactietest') && detailText.includes('banaan') && detailText.includes('Beeldverversing'),
  motor: s.motor.taps > 0,
};
console.log(JSON.stringify({ checks, valid: s.valid, reasons: s.invalidReasons, memory: s.memory, pvt: s.pvt.summary }, null, 1));
await page.getByRole('button', { name: 'Klaar' }).click();
// A session the robot made invalid (e.g. an early tap in the 6 s PVT) offers a retake instead.
await page.waitForSelector(s.valid ? 'text=Vandaag gedaan ✓' : 'text=Je mag opnieuw', { timeout: 10000 });
await snap('home-done');
console.log('errors:', errors);
await browser.close();
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
if (failed.length || errors.length) { console.error('FAILED:', failed, errors); process.exit(1); }
console.log('E2E OK');
