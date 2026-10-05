import { h, render, instructions, countdown, fmtTime } from './ui.js';
import { db, notesDb, requestPersistence } from './db.js';
import { getConfig, setConfig, APP_VERSION } from './config.js';
import { syncPending, testConnection, restoreAll } from './sync.js';
import { unlockTts, ttsVoiceName, primeMic, asrSupported, SpeechListener } from './speech.js';
import { localDateStr, dayIndex, wordListForDay, practiceList } from './schedule.js';
import { sleepContext } from './sleep.js';
import { speechTiming, validity, median } from './scoring.js';
import { captureFromUrl, currentShortcutData, clearShortcutData } from './shortcut.js';
import { runPvt, PVT_STIMULUS } from './tasks/pvt.js';
import { runSymbols } from './tasks/symbols.js';
import { encodeList, recallTask } from './tasks/verbal.js';
import { checkIn, yesterday, review } from './tasks/questions.js';
import { resultsView, sessionDetail } from './results.js';
import { noteScreen, pendingNotes } from './notes.js';
import { helpView } from './help.js';

let syncState = { status: 'idle' };
// Shortened timings for automated end-to-end tests only (?e2e in the URL).
const E2E = new URLSearchParams(location.search).has('e2e');
const DUR = E2E
  ? { pvt: 6000, symbols: 4, recall: 6 }
  : { pvt: undefined, symbols: undefined, recall: 30 };

// ---------------- home ----------------

async function home() {
  const sessions = await db.all();
  const today = localDateStr();
  const todays = sessions.filter((s) => s.date === today && s.kind !== 'practice');
  const doneValid = todays.some((s) => s.valid && s.kind === 'full');
  const lastInvalid = todays.length && !doneValid ? todays[todays.length - 1] : null;
  const backup = backupWarning(getConfig());

  // Everything tappable sits at the bottom, within thumb reach; Start is the lowest.
  render(
    h('h1', 'Fogmeter'),
    h('div.grow'),
    backup ? h('p.small.muted', backup) : null,
    h('button.link', { onclick: () => start(true) }, 'Oefenronde'),
    h('div.nav',
      h('button', { onclick: () => note() }, 'Notitie'),
      h('button', { onclick: () => results() }, 'Resultaten'),
      h('button', { onclick: () => settings() }, 'Instellingen'),
    ),
    doneValid
      ? h('div.card.center', h('h2', 'Vandaag gedaan ✓'))
      : [
        lastInvalid ? h('p.small', { style: { color: 'var(--warn)' } }, `Eerdere poging vandaag ongeldig (${lastInvalid.invalidReasons.join(', ') || 'kort'}). Je mag opnieuw.`) : null,
        h('button.primary.big', { onclick: () => start(false) }, 'Start'),
      ],
  );
}

// Only valid sessions "use up" notes, so a retake after an invalid session still gets them prefilled.
function lastSessionAt(sessions) {
  return sessions.filter((s) => s.kind !== 'practice' && s.valid).map((s) => s.startedAt).sort().pop() || null;
}

function note() {
  noteScreen(async (saved) => {
    await home();
    if (saved) syncPending().then((r) => { syncState = r; }).catch(() => {});
  });
}

// Only shown on the home screen when the backup needs attention.
function backupWarning(cfg) {
  if (!cfg.token) return 'Back-up staat uit (zie Instellingen).';
  if (syncState.status === 'error') return `Back-up mislukt: ${syncState.error}. Wordt later opnieuw geprobeerd.`;
  return null;
}

// ---------------- session ----------------

const TIMED = new Set(['encode', 'immediate', 'pvt', 'symbols', 'delayed']);
// After a few sessions you know the tasks: instruction screens then start by themselves.
const AUTO_START_AFTER = 3;
const AUTO_START_S = 4;

function prefillTimes() {
  const cfg = getConfig();
  const sc = currentShortcutData();
  const pick = (scDate, def) => (scDate ? [fmtTime(scDate), 'telefoon'] : [def, 'standaard']);
  const [wake, wakeSource] = pick(sc.wake, cfg.defaultWake);
  const [bed, bedSource] = pick(sc.bed, cfg.defaultBed);
  return { prefill: { wake, bed, wakeSource, bedSource }, steps: sc.steps };
}

async function start(practice) {
  // Both need the user gesture of this tap (iOS): speech synthesis unlock + microphone permission.
  unlockTts();
  primeMic();
  const startedAt = new Date();
  const date = localDateStr(startedAt);
  const words = practice ? practiceList() : wordListForDay(dayIndex(date));
  const sessions = await db.all();
  const { prefill, steps } = prefillTimes();
  const experienced = sessions.filter((x) => x.kind === 'full').length >= AUTO_START_AFTER;
  // Resolves 'start' or 'skip'.
  const intro = (title, lines) => instructions(title, lines, { autoSeconds: experienced && !E2E ? AUTO_START_S : 0, skippable: true });

  const flags = { interrupted: false, interruptedDuring: [] };
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
  // Parts skipped with "Overslaan" (see SKIP_STAGES); a skipped part simply has no score today.
  const skipped = now.skipped ? ['checkin'] : [];
  const s = {
    id: `${date}_${fmtTime(startedAt).replace(':', '')}`,
    date,
    kind: practice ? 'practice' : 'full',
    appVersion: APP_VERSION,
    startedAt: startedAt.toISOString(),
    tzOffsetMin: -startedAt.getTimezoneOffset(),
    device: { ua: navigator.userAgent, w: screen.width, h: screen.height, dpr: devicePixelRatio, standalone: !!navigator.standalone },
    now,
    context: { ...sleepContext(startedAt, now.bedTime, now.wakeTime, now.awakeMin), steps24h: steps, wakeSource: now.wakeSource, bedSource: now.bedSource },
    flags,
    skipped,
  };

  // Skipping the list itself or the first recall drops the whole word list for today.
  let first = null;
  current = 'encode-instr';
  if (await intro('Woordenlijst', [
    'Je ziet en hoort 12 woorden. Onthoud er zoveel mogelijk.',
    'Daarna zeg je ze hardop, in elke volgorde. Later in de sessie vraag ik ze nog een keer.',
  ]) === 'start') {
    current = 'encode';
    if (!(await encodeList(words)).skipped) {
      current = 'immediate';
      const r = await recallTask({ title: 'Noem alle woorden die je nog weet', subtitle: 'Woordenlijst · 1e keer', seconds: DUR.recall, hints: words });
      if (!r.skipped) first = r;
    }
  }
  if (first) {
    s.words = words;
    s.tts = ttsVoiceName();
  } else {
    skipped.push('words');
  }

  current = 'pvt-instr';
  if (await intro('Reactietest (3 min)', [
    'Tik zo snel mogelijk ergens op het scherm zodra de teller begint te lopen.',
    'Niet tikken vóór de teller loopt. Houd de telefoon zoals altijd, zelfde hand.',
    'Zet automatische helderheid uit en gebruik elke dag dezelfde schermhelderheid.',
  ]) === 'skip') {
    skipped.push('pvt');
  } else {
    await countdown(3);
    current = 'pvt';
    const pvt = await runPvt({ durationMs: DUR.pvt });
    s.context.frameMs = pvt.frameMs;
    flags.lowFrameRate = pvt.frameMs != null && pvt.frameMs > 25;
    if (pvt.skipped) skipped.push('pvt');
    else s.pvt = { trials: pvt.trials, summary: pvt.summary, stimulus: PVT_STIMULUS };
  }

  current = 'symbols-instr';
  if (await intro('Symbolen (± 1 min)', [
    'Bovenaan staan drie paren symbolen. Onderaan twee paren.',
    'Tik zo snel mogelijk op het onderste paar dat precies zo bovenaan staat.',
  ]) === 'skip') {
    skipped.push('symbols');
  } else {
    await countdown(3);
    current = 'symbols';
    const sym = await runSymbols({ trials: DUR.symbols });
    if (sym.skipped) {
      skipped.push('symbols');
    } else {
      s.symbols = { trials: sym.trials, summary: sym.summary };
      motorOffsets.push(...sym.motor.offsets);
      s.motor = { symbolMisses: sym.motor.misses };
    }
  }

  if (first) {
    current = 'delayed-instr';
    let second = null;
    if (await intro('Woordenlijst, nog een keer', ['Noem opnieuw alle woorden van de lijst van het begin die je nog weet. Zeg ze hardop.']) === 'start') {
      current = 'delayed';
      const r = await recallTask({ title: 'Noem alle woorden van de lijst', subtitle: 'Woordenlijst · 2e keer', seconds: DUR.recall, hints: words });
      if (!r.skipped) second = r;
    }
    if (!second) skipped.push('delayed');

    current = 'review';
    const rev = await review(words, first, second);
    const n1 = rev.first.filter(Boolean).length;
    const n2 = second ? rev.second.filter(Boolean).length : null;
    const keep = (r) => ({ durationMs: r.durationMs, endedEarly: r.endedEarly, speech: r.speech, timing: speechTiming(r.speech.timeline, words, r.durationMs) });
    s.recall = { first: keep(first), second: second ? keep(second) : null };
    s.memory = {
      immediate: n1,
      delayed: n2,
      retention: n1 && n2 !== null ? Math.round((n2 / n1) * 100) / 100 : null,
      recalledFirst: rev.first,
      recalledSecond: rev.second,
      auto: rev.auto,
      reviewEdits: rev.edits,
    };
  }

  current = 'yesterday';
  document.removeEventListener('visibilitychange', onVis);
  const notePrefill = practice ? null : pendingNotes(await notesDb.all(), lastSessionAt(sessions));
  s.yesterday = await yesterday({ steps, notePrefill });
  if (s.yesterday.skipped) skipped.push('yesterday');

  document.removeEventListener('pointerdown', onTap, true);
  s.motor = { ...(s.motor || {}), medianOffsetPx: motorOffsets.length ? median(motorOffsets) : null, taps: motorOffsets.length };
  s.finishedAt = new Date().toISOString();
  const v = validity(s);
  s.valid = v.valid;
  s.invalidReasons = v.reasons;

  if (practice) {
    const show = () => render(
      h('div.banner.practice', 'Oefenronde: niet opgeslagen'),
      ...resultsView([s], s, { onOpen: (x) => detail(x, show) }),
      h('button.primary', { onclick: () => home() }, 'Terug'),
    );
    show();
    return;
  }

  await db.put({ ...s, synced: false });
  if (s.context.wakeSource === 'telefoon' || s.context.bedSource === 'telefoon') clearShortcutData();
  await results(s);
  syncState = await syncPending();
}

// ---------------- results / settings / help ----------------

async function results(highlight = null) {
  const sessions = (await db.all()).filter((s) => s.kind !== 'practice');
  const notes = await notesDb.all();
  const onOpen = (s) => {
    const y = window.scrollY;
    detail(s, async () => { await results(highlight); window.scrollTo(0, y); });
  };
  render(
    h('div.row', h('h1.grow', 'Resultaten'), h('button', { onclick: () => home() }, 'Klaar')),
    ...resultsView(sessions, highlight, { notes, onOpen }),
  );
}

function detail(s, back) {
  render(
    h('div.row', h('h1.grow', 'Sessie'), h('button', { onclick: () => back() }, 'Terug')),
    ...sessionDetail(s),
  );
}

function help() {
  render(h('div.row', h('h1.grow', 'Uitleg'), h('button', { onclick: () => settings() }, 'Terug')), ...helpView());
}

function settings() {
  const cfg = getConfig();
  const out = h('p.small.muted', '');
  const token = h('input', { type: 'password', value: cfg.token, placeholder: 'github_pat_…', autocomplete: 'off' });
  const repo = h('input', { type: 'text', value: cfg.repo, autocapitalize: 'none', spellcheck: false });
  const wake = h('input', { type: 'time', value: cfg.defaultWake });
  const bed = h('input', { type: 'time', value: cfg.defaultBed });
  const save = () => setConfig({ token: token.value.trim(), repo: repo.value.trim(), defaultWake: wake.value, defaultBed: bed.value });
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
      h('h3', 'Spraakherkenning'),
      h('p.small.muted', asrSupported()
        ? 'Beschikbaar. Tijdens het opnoemen luistert de app mee; aan het eind controleer je wat hij hoorde.'
        : 'Niet beschikbaar in deze browser: je vinkt aan het eind zelf aan welke woorden je noemde.'),
      act('Microfoon testen (5 s)', micTest),
    ),
    h('div.card',
      h('h3', 'Standaard slaaptijden'),
      h('div.row', h('span.grow', 'Lichten uit'), bed),
      h('div.row', h('span.grow', 'Wakker'), wake),
      h('p.small.muted', 'Gebruikt als de Shortcut geen tijd doorgeeft.'),
    ),
    h('div.card',
      h('h3', 'Back-up naar GitHub (privé-repo)'),
      h('label.field', 'Repository', repo),
      h('label.field', 'Token', token),
      h('div.row.wrap', act('Test verbinding', async () => `Verbonden met ${await testConnection()} ✓`),
        act('Nu synchroniseren', async () => { syncState = await syncPending(); return syncState.status === 'ok' ? `${syncState.count} sessie(s) geüpload ✓` : syncState.status === 'off' ? 'Geen token ingesteld.' : `Fout: ${syncState.error}`; }),
        act('Herstellen vanaf GitHub', async () => `${await restoreAll()} sessie(s) hersteld.`)),
    ),
    h('div.card',
      h('h3', 'Data'),
      act('Exporteer alles (JSON)', exportAll),
      h('p.small.muted', `Versie ${APP_VERSION}`),
    ),
    h('button', { onclick: () => { save(); help(); } }, 'Uitleg (Shortcut, back-up, spraak)'),
    out,
  );
}

async function micTest() {
  if (!asrSupported()) return 'Spraakherkenning niet beschikbaar in deze browser.';
  const l = new SpeechListener();
  l.start();
  await new Promise((r) => setTimeout(r, 5000));
  const res = await l.stop();
  if (res.fatal) return `Fout: ${res.fatal}. Sta microfoon en spraakherkenning toe voor deze site.`;
  return res.transcript ? `Gehoord: ${res.transcript}` : 'Niets gehoord. Zeg een paar woorden tijdens de test.';
}

async function exportAll() {
  const sessions = await db.all();
  const notes = await notesDb.all();
  const data = { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, sessions, notes };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `fogmeter-${localDateStr()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  return `${sessions.length} sessies en ${notes.length} notities geëxporteerd.`;
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
