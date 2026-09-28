// "Now" check-in (before tests), "Yesterday" block (after tests) and the word-list review.
import { h, render, choiceScale } from '../ui.js';
import { detectListWords } from '../scoring.js';

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
 * End-of-session review, right after the second recall (the list is never shown before this).
 * Shows both transcripts and one row per list word with "1e / 2e keer" toggles, prefilled from
 * speech recognition. You only fix what it got wrong.
 * first/second: recallTask results. Resolves { first: boolean[], second: boolean[], auto, edits }.
 */
export function review(words, first, second) {
  return new Promise((resolve) => {
    const auto1 = detectListWords(first.speech.texts, words);
    const auto2 = detectListWords(second.speech.texts, words);
    const sel = [auto1.hit.slice(), auto2.hit.slice()];

    const counters = [h('span.tag', ''), h('span.tag', '')];
    const paint = () => {
      [first, second].forEach((r, k) => {
        const n = sel[k].filter(Boolean).length;
        counters[k].textContent = `${n} ✓ · ${r.taps.length} getikt`;
        counters[k].className = n === r.taps.length ? 'tag ok' : 'tag warn';
      });
    };
    const toggle = (k, i) => {
      const b = h('button.toggle', { type: 'button' }, '');
      const draw = () => { b.textContent = sel[k][i] ? '✓' : '–'; b.classList.toggle('selected', sel[k][i]); };
      b.addEventListener('click', () => { sel[k][i] = !sel[k][i]; draw(); paint(); });
      draw();
      return b;
    };

    const grid = h('div.review-grid', h('span'), h('span.hdr', '1e keer'), h('span.hdr', '2e keer'));
    words.forEach((w, i) => grid.append(h('span', w), toggle(0, i), toggle(1, i)));
    const heard = (label, r) => h('div.stack', { style: { gap: '4px' } },
      h('p.small', h('strong', label), ' ', r.speech.fatal ? h('span.muted', '(geen spraakherkenning)') : null),
      h('p.small.muted', r.speech.transcript || '—'));

    render(
      h('h2', 'Controle'),
      h('p.muted.small', 'Vooringevuld op basis van wat de app hoorde. Tik om te verbeteren. Het aantal ✓ hoort ongeveer gelijk te zijn aan je aantal tikken.'),
      h('div.card', grid, h('div.row', h('span.grow.small.muted', '1e / 2e keer'), counters[0], counters[1])),
      h('div.card', h('h3', 'Wat de app hoorde'), heard('1e keer:', first), heard('2e keer:', second)),
      h('button.primary', {
        onclick: () => resolve({
          first: sel[0],
          second: sel[1],
          auto: { first: auto1.hit, second: auto2.hit, extraFirst: auto1.extra, extraSecond: auto2.extra },
          edits: sel[0].filter((v, i) => v !== auto1.hit[i]).length + sel[1].filter((v, i) => v !== auto2.hit[i]).length,
        }),
      }, 'Opslaan'),
    );
    paint();
  });
}
