import { h, render, instructions, countdown, fmtTime } from './ui.js';
import { db, requestPersistence } from './db.js';
import { getConfig, setConfig, APP_VERSION } from './config.js';
import { syncPending, testConnection, restoreAll } from './sync.js';
import { SpeechListener, asrSupported, unlockTts, ttsVoiceName } from './speech.js';
import { localDateStr, dayIndex, fluencyPrompt, wordListForDay, practiceList, practicePrompt } from './schedule.js';
import { scoreRecall, scoreFluency, validity, computeIndices, median, RUN_IN } from './scoring.js';
import { captureFromUrl, currentShortcutData, clearShortcutData } from './shortcut.js';
import { runPvt } from './tasks/pvt.js';
import { runSymbols } from './tasks/symbols.js';
import { encodeList, freeResponse } from './tasks/verbal.js';
import { checkIn, yesterday, review } from './tasks/questions.js';
import { resultsView } from './results.js';
import { helpView } from './help.js';

let syncState = { status: 'idle' };
// Shortened timings for automated end-to-end tests only (?e2e in the URL).
const E2E = new URLSearchParams(location.search).has('e2e');
const DUR = E2E
  ? { pvt: 6000, symbols: 4, recall: 8, fluency: 8 }
  : { pvt: undefined, symbols: undefined, recall: 30, fluency: 60 };

// ---------------- home ----------------

async function home() {
  const sessions = await db.all();
  const today = localDateStr();
  const todays = sessions.filter((s) => s.date === today && s.kind !== 'practice');
  const doneValid = todays.some((s) => s.valid && s.kind === 'full');
  const ix = computeIndices(sessions);
  const sc = currentShortcutData();
  const cfg = getConfig();

  const phase = ix.phase === 'runin'
    ? `Inwerkperiode · sessie ${ix.fullCount + (doneValid ? 0 : 1)} van ${RUN_IN}`
    : ix.phase === 'baseline' ? `Basislijn · dag ${ix.baselineCount} van 28` : 'Meten';

  const lastInvalid = todays.length && !doneValid ? todays[todays.length - 1] : null;

  render(
    h('div.row', h('h1.grow', 'Fogmeter'), h('span.tag', phase)),
    h('p.muted', new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })),
    sc.raw
      ? h('div.banner', `Shortcut: ${sc.wake ? 'wakker ' + fmtTime(sc.wake) : 'geen wektijd'}${sc.steps != null ? ` · ${sc.steps.toLocaleString('nl-NL')} stappen` : ''}`)
      : null,
    doneValid
      ? h('div.card', h('h2', 'Vandaag gedaan ✓'), h('p.muted', 'Tot morgen. Consistentie is alles.'),
        h('button', { onclick: () => results() }, 'Bekijk resultaat'))
      : h('div.card',
        lastInvalid ? h('p.small', { style: { color: 'var(--warn)' } }, `Eerdere poging vandaag ongeldig (${lastInvalid.invalidReasons.join(', ') || 'kort'}). Je mag opnieuw.`) : null,
        h('p.muted', 'Na het mediteren. Nog geen thee. Niet storen aan, stil plekje.'),
        h('button.primary', { onclick: () => start('full', false) }, 'Start (± 7 min)'),
        h('button', { onclick: () => start('short', false) }, 'Korte versie (± 4 min, slechte dag)'),
      ),
    h('div.row.wrap',
      h('button.grow', { onclick: () => results() }, 'Resultaten'),
      h('button.grow', { onclick: () => settings() }, 'Instellingen'),
      h('button.grow', { onclick: () => help() }, 'Uitleg'),
    ),
    h('button.link', { onclick: () => start('full', true) }, 'Oefenronde (wordt niet opgeslagen)'),
    h('p.small.muted', syncLine(cfg)),
  );
}

function syncLine(cfg) {
  if (!cfg.token) return 'Back-up: uit (stel in bij Instellingen).';
  if (syncState.status === 'error') return `Back-up mislukt: ${syncState.error}. Wordt later opnieuw geprobeerd.`;
  if (syncState.status === 'ok') return 'Back-up: bijgewerkt.';
  return 'Back-up: …';
}

// ---------------- session ----------------

const TIMED = new Set(['encode', 'immediate', 'pvt', 'symbols', 'fluency', 'delayed']);

function primeMic() {
  // Triggers the microphone/speech permission prompt now instead of during a timed task.
  if (getConfig().inputMode !== 'speech' || !asrSupported()) return;
  try {
    const l = new SpeechListener();
    l.start();
    setTimeout(() => l.stop(), 400);
  } catch { /* ignore */ }
}

async function prefillTimes(sessions) {
  const cfg = getConfig();
  const sc = currentShortcutData();
  const prev = sessions.filter((s) => s.now?.bedTime).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).pop();
  const pick = (scDate, prevVal, def) => {
    if (scDate) return [fmtTime(scDate), 'shortcut'];
    if (prevVal) return [prevVal, 'vorige keer'];
    return [def, 'standaard'];
  };
  const [wake, wakeSource] = pick(sc.wake, prev?.now?.wakeTime, cfg.defaultWake);
  const [bed, bedSource] = pick(sc.bed, prev?.now?.bedTime, cfg.defaultBed);
  return { prefill: { wake, bed, wakeSource, bedSource }, steps: sc.steps };
}

function sleepContext(startedAt, bedTime, wakeTime) {
  const at = (base, hhmm) => { const [H, M] = hhmm.split(':').map(Number); const d = new Date(base); d.setHours(H, M, 0, 0); return d; };
  let wakeAt = at(startedAt, wakeTime);
  if (wakeAt > startedAt) wakeAt = new Date(wakeAt - 86400000);
  let bedAt = at(wakeAt, bedTime);
  if (bedAt >= wakeAt) bedAt = new Date(bedAt - 86400000);
  return {
    wakeAt: wakeAt.toISOString(),
    bedAt: bedAt.toISOString(),
    timeInBedMin: Math.round((wakeAt - bedAt) / 60000),
    minutesSinceWake: Math.round((startedAt - wakeAt) / 60000),
  };
}

async function start(kind, practice) {
  unlockTts();
  primeMic();
  const cfg = getConfig();
  const startedAt = new Date();
  const date = localDateStr(startedAt);
  const day = dayIndex(date);
  const prompt = practice ? practicePrompt() : fluencyPrompt(day);
  const words = practice ? practiceList(prompt) : wordListForDay(day);
  const sessions = await db.all();
  const { prefill, steps } = await prefillTimes(sessions);

  const flags = { interrupted: false, interruptedDuring: [], inputModes: {} };
  let current = 'checkin';
  const onVis = () => {
    if (document.hidden && TIMED.has(current)) { flags.interrupted = true; flags.interruptedDuring.push(current); }
  };
  document.addEventListener('visibilitychange', onVis);

  const motorOffsets = [];
  const onTap = (e) => {
    const t = e.target.closest?.('[data-target]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    motorOffsets.push(Math.round(Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) * 10) / 10);
  };
  document.addEventListener('pointerdown', onTap, true);

  const now = await checkIn(prefill, { practice });
  const s = {
    id: `${date}_${fmtTime(startedAt).replace(':', '')}`,
    date,
    kind: practice ? 'practice' : kind,
    appVersion: APP_VERSION,
    startedAt: startedAt.toISOString(),
    tzOffsetMin: -startedAt.getTimezoneOffset(),
    device: { ua: navigator.userAgent, w: screen.width, h: screen.height, dpr: devicePixelRatio, standalone: !!navigator.standalone },
    now,
    context: { ...sleepContext(startedAt, now.bedTime, now.wakeTime), steps24h: steps, wakeSource: now.wakeSource, bedSource: now.bedSource },
    flags,
  };

  if (kind === 'full') {
    current = 'encode-instr';
    await instructions('Woordenlijst', [
      'Je ziet en hoort 12 woorden. Onthoud er zoveel mogelijk.',
      'Daarna noem je ze hardop op. Aan het eind van de sessie vraag ik ze nóg een keer.',
    ], 'Start', null, unlockTts);
    current = 'encode';
    await encodeList(words);
    current = 'immediate';
    const imm = await freeResponse({ title: 'Noem alle woorden die je nog weet', subtitle: 'Woordenlijst', seconds: DUR.recall, inputMode: cfg.inputMode });
    flags.inputModes.immediate = imm.mode;
    s.words = words;
    s.tts = ttsVoiceName();
    s.recall = { immediate: imm };
  }

  current = 'pvt-instr';
  await instructions('Reactietest (3 min)', [
    'Tik zo snel mogelijk ergens op het scherm zodra de teller begint te lopen.',
    'Niet tikken vóór de teller loopt. Houd de telefoon zoals altijd, zelfde hand.',
  ]);
  await countdown(3);
  current = 'pvt';
  const pvt = await runPvt({ durationMs: DUR.pvt });
  s.pvt = { trials: pvt.trials, summary: pvt.summary };
  s.context.frameMs = pvt.frameMs;
  flags.lowFrameRate = pvt.frameMs != null && pvt.frameMs > 25;

  if (kind === 'full') {
    current = 'symbols-instr';
    await instructions('Symbolen (± 1 min)', [
      'Bovenaan staan drie paren symbolen. Onderaan twee paren.',
      'Tik zo snel mogelijk op het onderste paar dat precies zo bovenaan staat.',
    ]);
    await countdown(3);
    current = 'symbols';
    const sym = await runSymbols({ trials: DUR.symbols });
    s.symbols = { trials: sym.trials, summary: sym.summary };
    motorOffsets.push(...sym.motor.offsets);
    s.motor = { symbolMisses: sym.motor.misses };

    current = 'fluency-instr';
    await instructions('Woorden noemen (1 min)', [
      prompt.mode === 'letter'
        ? 'Je krijgt zo een letter. Noem 60 seconden lang hardop zoveel mogelijk woorden die daarmee beginnen.'
        : 'Je krijgt zo een categorie. Noem 60 seconden lang hardop zoveel mogelijk woorden die erbij horen.',
      prompt.mode === 'letter'
        ? 'Geen namen van personen of plaatsen, en niet hetzelfde woord in een andere vorm (bal, ballen).'
        : 'Niet hetzelfde woord in een andere vorm (bal, ballen).',
    ]);
    current = 'fluency';
    const flu = await freeResponse({ title: prompt.label, subtitle: 'Woorden noemen', seconds: DUR.fluency, inputMode: cfg.inputMode, allowDone: false });
    flags.inputModes.fluency = flu.mode;

    current = 'delayed-instr';
    await instructions('Woordenlijst, nog een keer', ['Noem nu opnieuw alle woorden van de lijst van het begin die je nog weet.']);
    current = 'delayed';
    const del = await freeResponse({ title: 'Noem alle woorden van de lijst', subtitle: 'Woordenlijst', seconds: DUR.recall, inputMode: cfg.inputMode });
    flags.inputModes.delayed = del.mode;
    s.recall.delayed = del;
    s.fluency = { prompt, heard: flu.words, mode: flu.mode, errors: flu.errors };
  }

  current = 'yesterday';
  document.removeEventListener('visibilitychange', onVis);
  s.yesterday = await yesterday({ steps });

  if (kind === 'full') {
    current = 'review';
    const immW = s.recall.immediate.words.map((x) => x.w);
    const delW = s.recall.delayed.words.map((x) => x.w);
    const rev = await review({ words, immediate: immW, delayed: delW, fluency: { prompt, words: s.fluency.heard } });
    const autoImm = scoreRecall(immW, words);
    const autoDel = scoreRecall(delW, words);
    const immN = rev.immediate.filter(Boolean).length;
    const delN = rev.delayed.filter(Boolean).length;
    s.memory = {
      immediate: immN,
      delayed: delN,
      retention: immN ? Math.round((delN / immN) * 100) / 100 : null,
      intrusionsImmediate: autoImm.intrusions.length,
      intrusionsDelayed: autoDel.intrusions.length,
      recalledImmediate: rev.immediate,
      recalledDelayed: rev.delayed,
      reviewEdits: rev.edits,
    };
    s.fluency.removed = rev.fluencyRemoved;
    s.fluency.summary = scoreFluency(s.fluency.heard, prompt, DUR.fluency * 1000, rev.fluencyRemoved);
  }

  document.removeEventListener('pointerdown', onTap, true);
  s.motor = { ...(s.motor || {}), medianOffsetPx: motorOffsets.length ? median(motorOffsets) : null, taps: motorOffsets.length };
  s.finishedAt = new Date().toISOString();
  const v = validity(s);
  s.valid = v.valid;
  s.invalidReasons = v.reasons;

  if (practice) {
    render(
      h('div.banner.practice', 'Oefenronde: niet opgeslagen'),
      ...resultsView([s], s),
      h('button.primary', { onclick: () => home() }, 'Terug'),
    );
    return;
  }

  await db.put({ ...s, synced: false });
  if (s.context.wakeSource === 'shortcut') clearShortcutData();
  await results(s);
  syncState = await syncPending();
}

// ---------------- results / settings / help ----------------

async function results(highlight = null) {
  const sessions = (await db.all()).filter((s) => s.kind !== 'practice');
  render(
    h('div.row', h('h1.grow', 'Resultaten'), h('button', { onclick: () => home() }, 'Klaar')),
    ...resultsView(sessions, highlight),
  );
}

function help() {
  render(h('div.row', h('h1.grow', 'Uitleg'), h('button', { onclick: () => home() }, 'Terug')), ...helpView());
}

function settings() {
  const cfg = getConfig();
  const out = h('p.small.muted', '');
  const token = h('input', { type: 'password', value: cfg.token, placeholder: 'github_pat_…', autocomplete: 'off' });
  const repo = h('input', { type: 'text', value: cfg.repo, autocapitalize: 'none', spellcheck: false });
  const wake = h('input', { type: 'time', value: cfg.defaultWake });
  const bed = h('input', { type: 'time', value: cfg.defaultBed });
  const mode = h('select', {}, h('option', { value: 'speech' }, 'Spreken'), h('option', { value: 'typed' }, 'Typen'));
  mode.value = cfg.inputMode;
  const save = () => setConfig({ token: token.value.trim(), repo: repo.value.trim(), defaultWake: wake.value, defaultBed: bed.value, inputMode: mode.value });
  const act = (label, fn) => h('button', {
    onclick: async () => {
      save();
      out.textContent = '…';
      try { out.textContent = await fn(); } catch (e) { out.textContent = `Fout: ${e.message || e}`; }
    },
  }, label);

  render(
    h('div.row', h('h1.grow', 'Instellingen'), h('button', { onclick: () => { save(); home(); } }, 'Klaar')),
    h('div.card',
      h('h3', 'Antwoorden'),
      h('label.field', 'Woorden opnoemen via', mode),
      h('p.small.muted', asrSupported() ? 'Spraakherkenning is beschikbaar in deze browser.' : 'Spraakherkenning is niet beschikbaar: typen wordt gebruikt.'),
      act('Microfoon testen (5 s)', micTest),
    ),
    h('div.card',
      h('h3', 'Standaard slaaptijden'),
      h('div.row', h('span.grow', 'Lichten uit'), bed),
      h('div.row', h('span.grow', 'Wakker'), wake),
      h('p.small.muted', 'Alleen gebruikt als er nog geen vorige sessie of Shortcut-tijd is.'),
    ),
    h('div.card',
      h('h3', 'Back-up naar GitHub (privé-repo)'),
      h('label.field', 'Repository', repo),
      h('label.field', 'Token', token),
      h('div.row.wrap', act('Test verbinding', async () => `Verbonden met ${await testConnection()} ✓`),
        act('Nu synchroniseren', async () => { syncState = await syncPending(); return syncState.status === 'ok' ? `${syncState.count} sessie(s) geüpload ✓` : syncState.status === 'off' ? 'Geen token ingesteld.' : `Fout: ${syncState.error}`; }),
        act('Herstellen vanaf GitHub', async () => `${await restoreAll()} sessie(s) hersteld.`)),
      h('p.small.muted', 'Zie Uitleg voor het aanmaken van de repo en het token.'),
    ),
    h('div.card',
      h('h3', 'Data'),
      act('Exporteer alles (JSON)', exportAll),
      h('p.small.muted', `Versie ${APP_VERSION}`),
    ),
    out,
  );
}

async function micTest() {
  if (!asrSupported()) return 'Spraakherkenning niet beschikbaar in deze browser.';
  const l = new SpeechListener();
  l.start();
  await new Promise((r) => setTimeout(r, 5000));
  const words = await l.stop();
  if (l.fatal) return `Fout: ${l.fatal}. Sta microfoon en spraakherkenning toe voor deze site.`;
  return words.length ? `Gehoord: ${words.map((w) => w.w).join(', ')}` : 'Niets gehoord. Zeg een paar woorden tijdens de test.';
}

async function exportAll() {
  const sessions = await db.all();
  const blob = new Blob([JSON.stringify(sessions, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `fogmeter-${localDateStr()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  return `${sessions.length} sessies geëxporteerd.`;
}

// ---------------- boot ----------------

async function boot() {
  captureFromUrl();
  if (E2E) history.replaceState(null, '', location.pathname);
  await requestPersistence();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // If Safari cleared local storage, pull history back from the backup.
  const cfg = getConfig();
  if (cfg.token && (await db.all()).length === 0) {
    try { await restoreAll(); } catch { /* offline or not set up */ }
  }
  await home();
  syncPending().then((r) => { syncState = r; }).catch(() => {});
}

boot();
