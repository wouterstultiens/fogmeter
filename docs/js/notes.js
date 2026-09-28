// Quick notes: optional, any time of day (a blank moment at work, the evening, ...).
// Text + an optional "how clear right now" rating. The next morning the texts prefill "Iets bijzonders?";
// the ratings are kept separately so the morning "yesterday" question stays the same measure every day.
import { h, render, choiceScale, fmtTime } from './ui.js';
import { notesDb } from './db.js';
import { localDateStr } from './schedule.js';
import { APP_VERSION } from './config.js';
import { FOG } from './tasks/questions.js';

const MAX_AGE_MS = 48 * 3600000;

/**
 * Notes with text made since the last session (and at most 48 h ago), oldest first.
 * Returns { text, ids } for the morning's "Iets bijzonders?" field, or null if there are none.
 */
export function pendingNotes(notes, lastSessionAt, now = new Date()) {
  const cutoff = new Date(now.getTime() - MAX_AGE_MS).toISOString();
  const since = lastSessionAt && lastSessionAt > cutoff ? lastSessionAt : cutoff;
  const list = notes.filter((n) => n.text && n.at > since && n.at <= now.toISOString())
    .sort((a, b) => a.at.localeCompare(b.at));
  if (!list.length) return null;
  return { text: list.map((n) => noteLine(n, now)).join('\n'), ids: list.map((n) => n.id) };
}

/** "15:20 blanco moment" for today/yesterday, "za 15:20 blanco moment" for older notes. */
export function noteLine(n, now = new Date()) {
  const at = new Date(n.at);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const recent = [localDateStr(now), localDateStr(yest)].includes(localDateStr(at));
  const day = recent ? '' : `${at.toLocaleDateString('nl-NL', { weekday: 'short' })} `;
  return `${day}${fmtTime(at)} ${n.text}`;
}

/** The quick-note screen. onDone(saved: boolean). */
export async function noteScreen(onDone) {
  let fog = null;
  const text = h('textarea', { placeholder: 'bv. blanco moment in overleg, hoofdpijn, laat gegeten, slecht geslapen…' });
  const save = h('button.primary', { disabled: true, onclick: () => submit() }, 'Bewaar');
  const update = () => { save.disabled = !text.value.trim() && fog === null; };
  text.addEventListener('input', update);
  const scale = choiceScale(FOG, 's11', (v) => { fog = v; update(); });
  const clear = h('button.link', {
    type: 'button',
    onclick: () => { fog = null; scale.querySelectorAll('button').forEach((b) => b.classList.remove('selected')); update(); },
  }, 'Geen cijfer');

  const recent = (await notesDb.all())
    .filter((n) => n.at > new Date(Date.now() - MAX_AGE_MS).toISOString())
    .sort((a, b) => b.at.localeCompare(a.at));

  render(
    h('div.row', h('h1.grow', 'Notitie'), h('button', { onclick: () => onDone(false) }, 'Annuleer')),
    h('div.card', h('p', 'Wat is er?'), text),
    h('div.card',
      h('p', 'Hoe helder voelt je hoofd nu? (optioneel)'),
      scale,
      h('div.anchors', h('span', 'helemaal helder'), h('span', 'extreem mistig')),
      h('div.row', clear),
    ),
    save,
    h('p.small.muted', 'Je tekst staat morgenochtend al ingevuld bij "Iets bijzonders?". Het cijfer wordt apart bewaard.'),
    recent.length
      ? h('div.card', h('h3', 'Laatste 48 uur'), ...recent.map((n) => h('p.small', noteLine(n), n.fog != null ? h('span.muted', ` · ${n.fog}/10`) : null)))
      : null,
  );
  text.focus();

  async function submit() {
    save.disabled = true;
    const at = new Date();
    const p = (x) => String(x).padStart(2, '0');
    await notesDb.put({
      id: `${localDateStr(at)}_${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`,
      date: localDateStr(at),
      at: at.toISOString(),
      tzOffsetMin: -at.getTimezoneOffset(),
      fog,
      text: text.value.trim(),
      appVersion: APP_VERSION,
      synced: false,
    });
    onDone(true);
  }
}
