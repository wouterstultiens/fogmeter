// "Now" check-in (before tests), "Yesterday" block (after tests) and the word-list review.
import { h, render, choiceScale, slider } from '../ui.js';
import { detectListWords, markTranscript } from '../scoring.js';
import { AWAKE } from '../sleep.js';

/** 0–10 "how clear" slider, the same everywhere it is asked. extra: element at the end of its row. */
export const claritySlider = (onPick, extra = null) => slider(onPick, { anchors: ['heel mistig', 'heel helder'], extra });
const SLEEP_Q = ['zeer slecht', 'slecht', 'redelijk', 'goed', 'zeer goed'].map((label, i) => ({ label, value: i + 1 }));

/**
 * prefill: { bed:'HH:MM', wake:'HH:MM', bedSource, wakeSource } (source: 'shortcut' | 'vorige keer' | 'standaard')
 * Resolves { clarity, sleepQuality, bedTime, wakeTime, bedSource, wakeSource, awakeMin }.
 * awakeMin ("Wakker gelegen") starts at 0 every morning, never at yesterday's value.
 * "Overslaan" resolves the same, with null for unanswered questions and skipped: true.
 */
export function checkIn(prefill, { practice = false } = {}) {
  return new Promise((resolve) => {
    const ans = { clarity: null, sleepQuality: null, awakeMin: 0 };
    const next = h('button.primary', { disabled: true, onclick: () => submit() }, 'Verder');
    const update = () => { next.disabled = ans.clarity === null || ans.sleepQuality === null; };

    const bed = h('input', { type: 'time', value: prefill.bed });
    const wake = h('input', { type: 'time', value: prefill.wake });
    const srcTag = (s) => h(`span.tag${s === 'shortcut' ? '.ok' : ''}`, s === 'shortcut' ? 'via Shortcut' : s);

    render(
      practice ? h('div.banner.practice', 'Oefenronde: wordt niet opgeslagen') : null,
      h('h2', 'Nu'),
      h('div.card',
        h('p', 'Hoe helder voelt je hoofd nu?'),
        claritySlider((v) => { ans.clarity = v; update(); }),
      ),
      h('div.card',
        h('p', 'Hoe goed was je slaap, los van de lengte?'),
        choiceScale(SLEEP_Q, 's5', (v) => { ans.sleepQuality = v; update(); }),
      ),
      h('div.card',
        h('p', 'Slaaptijden'),
        h('div.row', h('span.grow', 'Lichten uit'), srcTag(prefill.bedSource), bed),
        h('div.row', h('span.grow', 'Wakker'), srcTag(prefill.wakeSource), wake),
        h('p', 'Wakker gelegen'),
        choiceScale(AWAKE, 's5', (v) => { ans.awakeMin = v; }, 0),
      ),
      next,
      h('button.link.muted', { onclick: () => submit(true) }, 'Overslaan'),
    );

    function submit(skipped = false) {
      resolve({
        ...ans,
        ...(skipped ? { skipped: true } : {}),
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

/**
 * steps: number|null. When steps come from the Shortcut the activity question is left out.
 * notePrefill: { text, ids } from quick notes made since the last session; fills the note.
 * "n.v.t." (dayNa) answers the clarity question without a number.
 * "Overslaan" resolves with what was filled in so far and skipped: true.
 */
export function yesterday({ steps = null, notePrefill = null } = {}) {
  return new Promise((resolve) => {
    const ans = { dayClarity: null, dayNa: false, activity: null, stress: null };
    const needActivity = steps == null;
    const submit = (skipped = false) => resolve({
      ...ans,
      note: note.value.trim(),
      ...(notePrefill ? { noteIds: notePrefill.ids } : {}),
      ...(skipped ? { skipped: true } : {}),
    });
    const next = h('button.primary', { disabled: true, onclick: () => submit() }, 'Verder');
    const update = () => {
      next.disabled = (ans.dayClarity === null && !ans.dayNa) || ans.stress === null || (needActivity && ans.activity === null);
    };
    const note = h('textarea');
    if (notePrefill) note.value = notePrefill.text;

    const na = h('button', {
      type: 'button',
      onclick: () => {
        ans.dayNa = !ans.dayNa;
        na.classList.toggle('selected', ans.dayNa);
        if (ans.dayNa) { ans.dayClarity = null; clarity.set(null); }
        update();
      },
    }, 'n.v.t.');
    const clarity = claritySlider((v) => { ans.dayClarity = v; ans.dayNa = false; na.classList.remove('selected'); update(); }, na);

    render(
      h('h2', 'Gisteren'),
      h('div.card', h('p', 'Hoe helder was je hoofd?'), clarity),
      needActivity ? h('div.card', h('p', 'Beweging'), choiceScale(ACTIVITY, 's3', (v) => { ans.activity = v; update(); })) : null,
      h('div.card', h('p', 'Stress / werkdruk'), choiceScale(STRESS, 's3', (v) => { ans.stress = v; update(); })),
      h('div.card', h('p', 'Notitie'), note),
      next,
      h('button.link.muted', { onclick: () => submit(true) }, 'Overslaan'),
    );
  });
}

/**
 * End-of-session review, right after the second recall (the list is never shown before this).
 * On top: what the app heard, with recognised list words marked. Below: one row per list word with
 * "1e / 2e keer" toggles, prefilled from speech recognition. You only fix what it got wrong.
 * first/second: recallTask results; second is null when the second recall was skipped (then there is
 * only a "1e keer" column). Resolves { first: boolean[], second: boolean[]|null, auto, edits }.
 */
export function review(words, first, second) {
  return new Promise((resolve) => {
    const recalls = second ? [first, second] : [first];
    const autos = recalls.map((r) => detectListWords(r.speech.texts, words));
    const sel = autos.map((a) => a.hit.slice());

    const counters = recalls.map(() => h('span.tag', ''));
    const paint = () => sel.forEach((v, k) => { counters[k].textContent = `${k + 1}e keer: ${v.filter(Boolean).length}`; });
    const toggle = (k, i) => {
      const b = h('button.toggle', { type: 'button' }, '');
      const draw = () => { b.textContent = sel[k][i] ? '✓' : '–'; b.classList.toggle('selected', sel[k][i]); };
      b.addEventListener('click', () => { sel[k][i] = !sel[k][i]; draw(); paint(); });
      draw();
      return b;
    };

    const grid = h('div.review-grid', { style: second ? null : { gridTemplateColumns: '1fr auto' } },
      h('span'), ...recalls.map((_, k) => h('span.hdr', `${k + 1}e keer`)));
    words.forEach((w, i) => grid.append(h('span', w), ...recalls.map((_, k) => toggle(k, i))));

    render(
      h('h2', 'Controle'),
      h('p.muted.small', 'Klopt een vinkje niet? Tik om te verbeteren.'),
      h('div.card', h('h3', 'Wat de app hoorde'), ...recalls.map((r, k) => heardBlock(`${k + 1}e keer`, r, words, autos[k].hit))),
      h('div.card', grid, h('div.row', h('span.grow'), ...counters)),
      h('button.primary', {
        onclick: () => resolve({
          first: sel[0],
          second: sel[1] || null,
          auto: { first: autos[0].hit, second: autos[1]?.hit || null, extraFirst: autos[0].extra, extraSecond: autos[1]?.extra || null },
          edits: sel.reduce((n, v, k) => n + v.filter((x, i) => x !== autos[k].hit[i]).length, 0),
        }),
      }, 'Opslaan'),
    );
    paint();
  });
}

/** One recall's transcript with list words marked, plus list words heard only in interim guesses. */
export function heardBlock(label, r, words, hit) {
  const title = h('p.small', h('strong', `${label}:`));
  if (r.speech.fatal) {
    return h('div.stack', { style: { gap: '4px' } }, title, h('p.small.muted', 'Geen spraakherkenning. Vink zelf aan welke woorden je noemde.'));
  }
  const parts = markTranscript(r.speech.transcript || '', words);
  const onlyInterim = words.filter((w, i) => hit[i] && !parts.some((p) => markTranscript(p.text, [w])[0].hit));
  return h('div.stack', { style: { gap: '4px' } },
    title,
    h('p.transcript', parts.length ? parts.flatMap((p, i) => [i ? ' ' : null, p.hit ? h('mark', p.text) : p.text]) : h('span.muted', '(niets gehoord)')),
    onlyInterim.length ? h('p.small.muted', `Ook gehoord in een tussenversie: ${onlyInterim.join(', ')}`) : null,
  );
}
