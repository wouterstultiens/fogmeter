// "Now" check-in (before tests), "Yesterday" block (after tests) and the end-of-session review.
import { h, render, choiceScale } from '../ui.js';
import { matchesWord } from '../scoring.js';

const FOG = Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: i }));
const SLEEP_Q = ['zeer slecht', 'slecht', 'redelijk', 'goed', 'zeer goed'].map((label, i) => ({ label, value: i + 1 }));

/**
 * prefill: { bed:'HH:MM', wake:'HH:MM', bedSource, wakeSource } (source: 'shortcut' | 'vorige keer' | 'standaard')
 * Resolves { fog, sleepQuality, bedTime, wakeTime, bedSource, wakeSource }.
 */
export function checkIn(prefill, { practice = false } = {}) {
  return new Promise((resolve) => {
    const ans = { fog: null, sleepQuality: null };
    const next = h('button.primary', { disabled: true, onclick: () => submit() }, 'Verder');
    const update = () => { next.disabled = ans.fog === null || ans.sleepQuality === null; };

    const bed = h('input', { type: 'time', value: prefill.bed });
    const wake = h('input', { type: 'time', value: prefill.wake });
    const srcTag = (s) => h(`span.tag${s === 'shortcut' ? '.ok' : ''}`, s === 'shortcut' ? 'via Shortcut' : s);

    render(
      practice ? h('div.banner.practice', 'Oefenronde: wordt niet opgeslagen') : null,
      h('h2', 'Nu'),
      h('div.card',
        h('p', 'Hoe helder voelt je hoofd nu?'),
        choiceScale(FOG, 's11', (v) => { ans.fog = v; update(); }),
        h('div.anchors', h('span', 'helemaal helder'), h('span', 'extreem mistig')),
      ),
      h('div.card',
        h('p', 'Hoe heb je geslapen?'),
        choiceScale(SLEEP_Q, 's5', (v) => { ans.sleepQuality = v; update(); }),
      ),
      h('div.card',
        h('p', 'Slaaptijden'),
        h('div.row', h('span.grow', 'Lichten uit'), srcTag(prefill.bedSource), bed),
        h('div.row', h('span.grow', 'Wakker'), srcTag(prefill.wakeSource), wake),
        h('p.small.muted', 'Klopt het? Dan hoef je niets te doen.'),
      ),
      next,
    );

    function submit() {
      resolve({
        ...ans,
        bedTime: bed.value || prefill.bed,
        wakeTime: wake.value || prefill.wake,
        bedSource: bed.value !== prefill.bed ? 'handmatig' : prefill.bedSource,
        wakeSource: wake.value !== prefill.wake ? 'handmatig' : prefill.wakeSource,
      });
    }
  });
}

const ACTIVITY = [{ label: 'geen', value: 0 }, { label: 'licht', value: 1 }, { label: 'flink', value: 2 }];
const STRESS = [{ label: 'laag', value: 1 }, { label: 'normaal', value: 2 }, { label: 'hoog', value: 3 }];

/** steps: number|null. When steps come from the Shortcut the activity question is skipped. */
export function yesterday({ steps = null } = {}) {
  return new Promise((resolve) => {
    const ans = { dayFog: null, dayOff: false, activity: null, stress: null };
    const needActivity = steps == null;
    const next = h('button.primary', { disabled: true, onclick: () => resolve({ ...ans, note: note.value.trim() }) }, 'Verder');
    const update = () => {
      next.disabled = (ans.dayFog === null && !ans.dayOff) || ans.stress === null || (needActivity && ans.activity === null);
    };
    const note = h('textarea', { placeholder: 'bv. ziek, laat gegeten, geen thee, slecht geslapen, meditatie overgeslagen, blanco moment op werk…' });

    const fogScale = choiceScale(FOG, 's11', (v) => { ans.dayFog = v; ans.dayOff = false; off.classList.remove('selected'); update(); });
    const off = h('button', {
      type: 'button',
      onclick: () => {
        ans.dayOff = !ans.dayOff;
        off.classList.toggle('selected', ans.dayOff);
        if (ans.dayOff) { ans.dayFog = null; fogScale.querySelectorAll('button').forEach((b) => b.classList.remove('selected')); }
        update();
      },
    }, 'Vrije dag');

    render(
      h('h2', 'Gisteren'),
      h('div.card',
        h('p', 'Hoe helder was je hoofd overdag (op je werk)?'),
        fogScale,
        h('div.anchors', h('span', 'helemaal helder'), h('span', 'extreem mistig')),
        h('div.row', off),
      ),
      needActivity
        ? h('div.card', h('p', 'Beweging'), choiceScale(ACTIVITY, 's3', (v) => { ans.activity = v; update(); }))
        : h('div.card', h('div.row', h('span.grow', 'Stappen (laatste 24 uur)'), h('span.tag.ok', 'via Shortcut'), h('strong', steps.toLocaleString('nl-NL')))),
      h('div.card', h('p', 'Stress / werkdruk'), choiceScale(STRESS, 's3', (v) => { ans.stress = v; update(); })),
      h('div.card', h('p', 'Iets bijzonders? (optioneel)'), note),
      next,
    );
  });
}

/**
 * End-of-session check of what speech recognition heard. Shown only after delayed recall,
 * so the list is never re-exposed before it is tested.
 */
export function review({ words, immediate, delayed, fluency }) {
  return new Promise((resolve) => {
    const imm = words.map((w) => immediate.some((t) => matchesWord(t, w)));
    const del = words.map((w) => delayed.some((t) => matchesWord(t, w)));
    const autoImm = imm.slice();
    const autoDel = del.slice();
    const removed = new Set();

    const toggle = (arr, i) => {
      const b = h('button.toggle', { type: 'button' }, '');
      const paint = () => { b.textContent = arr[i] ? '✓' : '–'; b.classList.toggle('selected', arr[i]); };
      b.addEventListener('click', () => { arr[i] = !arr[i]; paint(); });
      paint();
      return b;
    };

    const grid = h('div.review-grid', h('span'), h('span.hdr', 'direct'), h('span.hdr', 'later'));
    words.forEach((w, i) => grid.append(h('span', w), toggle(imm, i), toggle(del, i)));

    const extra = (list) => list.filter((t) => !words.some((w) => matchesWord(t, w)));
    const heard = (label, list) => (list.length ? h('p.small.muted', `${label} gehoord: ${list.join(', ')}`) : null);

    const fluChips = h('div.chips', ...fluency.words.map((x) => {
      const c = h('button.chip', { type: 'button' }, x.w);
      c.addEventListener('click', () => {
        if (removed.has(x.w)) removed.delete(x.w); else removed.add(x.w);
        c.classList.toggle('struck', removed.has(x.w));
      });
      return c;
    }));

    render(
      h('h2', 'Controle'),
      h('p.muted.small', 'Klopt wat de app heeft gehoord? Tik om te verbeteren. Meestal hoeft er niets te veranderen.'),
      h('div.card',
        h('h3', 'Woordenlijst'),
        grid,
        heard('Ook', extra(immediate.concat(delayed)).filter((v, i, a) => a.indexOf(v) === i)),
      ),
      h('div.card',
        h('h3', `Woorden noemen: ${fluency.prompt.mode === 'letter' ? 'letter ' + fluency.prompt.letter : fluency.prompt.category}`),
        fluency.words.length ? fluChips : h('p.muted', 'Geen woorden gehoord.'),
        h('p.small.muted', 'Tik op woorden die niet gelden (namen, verkeerd gehoord) om ze door te strepen.'),
      ),
      h('button.primary', {
        onclick: () => resolve({
          immediate: imm, delayed: del,
          edits: imm.filter((v, i) => v !== autoImm[i]).length + del.filter((v, i) => v !== autoDel[i]).length,
          fluencyRemoved: [...removed],
        }),
      }, 'Opslaan'),
    );
  });
}
