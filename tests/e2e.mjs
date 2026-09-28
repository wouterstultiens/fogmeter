// End-to-end smoke test: plays one full session (typed answers, shortened timings via ?e2e).
// Run: node tests/e2e.mjs   (needs playwright + a local server on :8080, see package.json "serve")
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
await page.addInitScript(() => localStorage.setItem('fogmeter.config', JSON.stringify({ inputMode: 'typed' })));

let shot = 0;
const snap = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${String(++shot).padStart(2, '0')}-${name}.png` }); };
const clickText = (t) => page.getByRole('button', { name: t, exact: true }).first().click();

const wake = new Date(Date.now() - 20 * 60000);
await page.goto(`${BASE}?e2e&wake=${encodeURIComponent(stamp(wake))}&steps=8412`);
await page.waitForSelector('text=Fogmeter');
await snap('home');

await clickText('Start (± 7 min)');
await page.waitForSelector('text=Hoe helder voelt je hoofd nu?');
await page.locator('.scale.s11 button').nth(3).click();
await clickText('goed');
await snap('checkin');
await clickText('Verder');

// Word list: collect the words while they are shown.
await clickText('Start');
const words = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 22000) {
  const w = (await page.locator('.bigword').textContent().catch(() => '')) || '';
  if (w && w !== '+') words.add(w);
  if (words.size >= 12 && !(await page.locator('.bigword').count())) break;
  if (await page.locator('.prompt').count()) break;
  await page.waitForTimeout(150);
}
console.log('words seen:', [...words].join(', '));
if (words.size !== 12) throw new Error(`expected 12 words, saw ${words.size}`);

const typeWords = async (list) => {
  const input = page.locator('.task input[type=text]');
  await input.waitFor();
  for (const w of list) await input.type(`${w} `);
};
const list = [...words];
await typeWords([list[0], list[1], list[2], 'banaan']);
await snap('recall');
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

// Fluency
await page.waitForSelector('text=Woorden noemen (1 min)');
await clickText('Start');
const prompt = await page.locator('.prompt').textContent();
const letter = (prompt.match(/letter ([A-Z])/) || [])[1];
const fluWords = letter ? [`${letter}ak`, `${letter}oos`, `${letter}ier`].map((w) => w.toLowerCase()) : ['koe', 'paard', 'schaap'];
await typeWords(fluWords);
await snap('fluency');

// Delayed recall
await page.waitForSelector('text=Woordenlijst, nog een keer', { timeout: 15000 });
await clickText('Start');
await typeWords([list[0], list[5]]);

// Yesterday (activity is skipped because steps came from the Shortcut)
await page.waitForSelector('text=Gisteren', { timeout: 15000 });
await page.locator('.scale.s11 button').nth(2).click();
await clickText('normaal');
await page.locator('textarea').fill('test: niets bijzonders');
await snap('yesterday');
await clickText('Verder');

// Review
await page.waitForSelector('text=Controle');
await snap('review');
await clickText('Opslaan');
await page.waitForSelector('text=Resultaten');
await snap('results');

const saved = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('fogmeter');
  r.onsuccess = () => {
    const q = r.result.transaction('sessions').objectStore('sessions').getAll();
    q.onsuccess = () => res(q.result);
  };
}));
const s = saved[saved.length - 1];
const checks = {
  kind: s.kind === 'full',
  wakeFromShortcut: s.now.wakeSource === 'shortcut',
  minutesSinceWake: s.context.minutesSinceWake >= 19 && s.context.minutesSinceWake <= 25,
  steps: s.context.steps24h === 8412,
  memoryImmediate: s.memory.immediate === 3,
  memoryDelayed: s.memory.delayed === 2,
  intrusion: s.memory.intrusionsImmediate === 1,
  pvtTrials: s.pvt.summary.n >= 1,
  symbolsCorrect: s.symbols.summary.accuracy === 1,
  fluency: s.fluency.summary.valid === 3,
  yesterday: s.yesterday.dayFog === 2 && s.yesterday.stress === 2 && s.yesterday.note.startsWith('test'),
  motor: s.motor.taps > 0,
};
console.log(JSON.stringify({ checks, valid: s.valid, reasons: s.invalidReasons, pvt: s.pvt.summary, symbols: s.symbols.summary, fluency: s.fluency.summary }, null, 1));
await page.getByRole('button', { name: 'Klaar' }).click();
await page.waitForSelector('text=Vandaag gedaan ✓');
await snap('home-done');
console.log('errors:', errors);
await browser.close();
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
if (failed.length || errors.length) { console.error('FAILED:', failed, errors); process.exit(1); }
console.log('E2E OK');
