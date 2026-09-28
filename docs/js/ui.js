// Tiny DOM helpers.

export const app = () => document.getElementById('app');

/** h('div.card', {onclick}, child, ...) */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = {};
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function render(...nodes) {
  const root = app();
  root.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
  window.scrollTo(0, 0);
  return root;
}

/** Full-screen task layer; returns the element. */
export function taskScreen(...children) {
  const el = h('div.task', ...children);
  render(el);
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

/**
 * Instruction screen with a single start button; resolves 'start' on tap.
 * autoSeconds > 0: starts by itself after that many seconds (tap to start sooner).
 * skippable: adds a small "Overslaan" link below the button; resolves 'skip' when tapped.
 */
export function instructions(title, lines, { buttonLabel = 'Start', autoSeconds = 0, skippable = false } = {}) {
  return new Promise((resolve) => {
    let timer = null;
    let done = false;
    const go = (how) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      resolve(how);
    };
    const btn = h('button.primary', { style: { marginTop: '12px' }, onclick: () => go('start') }, buttonLabel);
    taskScreen(
      h('div.stack', { style: { maxWidth: '440px', width: '100%' } },
        h('h2', title),
        ...lines.map((l) => h('p.muted', l)),
        btn,
        skippable ? h('button.link.muted', { onclick: () => go('skip') }, 'Overslaan') : null,
      ),
    );
    if (autoSeconds > 0) {
      let left = autoSeconds;
      btn.textContent = `${buttonLabel} (${left})`;
      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) go('start');
        else btn.textContent = `${buttonLabel} (${left})`;
      }, 1000);
    }
  });
}

/**
 * Small "Overslaan" button for a running task (top right). It needs two taps: the first only arms it
 * for 3 s, so a stray tap during a task never skips it. Reacts on pointerdown, like the tasks do; the
 * tap is not swallowed, so an accidental hit during the reaction test still counts as a response.
 */
export function skipButton(onSkip) {
  let armed = null;
  const b = h('button.skip', { type: 'button' }, 'Overslaan');
  b.addEventListener('pointerdown', () => {
    if (armed) { clearTimeout(armed); onSkip(); return; }
    b.textContent = 'Tik nog eens';
    b.classList.add('armed');
    armed = setTimeout(() => { armed = null; b.textContent = 'Overslaan'; b.classList.remove('armed'); }, 3000);
  });
  return b;
}

export async function countdown(from = 3) {
  const el = h('div.countdown');
  taskScreen(el);
  for (let i = from; i > 0; i--) {
    el.textContent = String(i);
    await sleep(1000);
  }
}

/** Single-choice button scale. options: [{label, value}] */
export function choiceScale(options, cls, onPick, selected = null) {
  const wrap = h(`div.scale.${cls}`);
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', 'data-target': '1' }, o.label);
    if (selected !== null && o.value === selected) b.classList.add('selected');
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      onPick(o.value);
    });
    return b;
  });
  wrap.append(...buttons);
  return wrap;
}

/**
 * 0–max rating slider. Starts empty (no thumb), so no default or earlier answer anchors the rating.
 * Tap or drag anywhere on the track; custom because an iOS <input type=range> only moves by dragging
 * its thumb. anchors: [left, right] labels under the track. extra: element placed at the end of the row.
 * el.set(value | null) sets or clears it from outside without calling onPick.
 */
export function slider(onPick, { max = 10, anchors = [], extra = null } = {}) {
  let value = null;
  const thumb = h('div.thumb');
  const rail = h('div.rail', ...Array.from({ length: max + 1 }, (_, i) => h('span.tick', { style: { left: `${(i / max) * 100}%` } })), thumb);
  const track = h('div.track', { role: 'slider', tabindex: 0, 'aria-valuemin': 0, 'aria-valuemax': max }, rail);
  const readout = h('span.slider-value');
  const el = h('div.slider',
    h('div.grow', track, anchors.length ? h('div.anchors', ...anchors.map((a) => h('span', a))) : null),
    readout,
    extra,
  );
  const draw = () => {
    track.classList.toggle('unset', value === null);
    thumb.style.left = `${((value ?? 0) / max) * 100}%`;
    readout.textContent = value === null ? '–' : String(value);
    if (value === null) track.removeAttribute('aria-valuenow');
    else track.setAttribute('aria-valuenow', value);
  };
  const pick = (v) => {
    v = Math.max(0, Math.min(max, v));
    if (v === value) return;
    value = v;
    draw();
    onPick(v);
  };
  const fromX = (e) => { const r = rail.getBoundingClientRect(); return Math.round(((e.clientX - r.left) / r.width) * max); };
  track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); pick(fromX(e)); });
  track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) pick(fromX(e)); });
  track.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (step) { e.preventDefault(); pick((value ?? Math.round(max / 2)) + step); }
  });
  el.set = (v) => { value = v; draw(); };
  draw();
  return el;
}

export function fmtTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}`;
}
