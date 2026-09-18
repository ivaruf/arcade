/* =============================================================================
 * controls.js — one set of intentions, three ways of expressing them.
 *
 * The game asks this module four questions a frame: which way, is sprint held,
 * was hop pressed, was the coin pressed. Keyboard, touch stick and gamepad all
 * answer the same questions, so nothing downstream knows or cares which is in
 * use — and all three can be live at once, which is what a tablet with a pad
 * paired to it actually looks like.
 *
 * Hop and coin are EDGES, read once and cleared, because "jump again in the
 * air to become a cloud" depends on a second press rather than a held key.
 * ========================================================================== */

const held = new Set();
const edges = { hop: false, coin: false, pause: false };

/** The touch stick: x is right, y is forward, each -1..1. */
const stick = { active: false, x: 0, y: 0 };

/** A gamepad's left stick, kept apart so neither input can zero the other. */
const pad = { active: false, x: 0, y: 0 };

/** Camera nudge from a gamepad's right stick, in radians per second. */
const look = { x: 0, y: 0 };

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const DEAD = 0.18;

const deaden = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export const isDown = (code) => held.has(code);
export const sprintHeld = () => held.has('ShiftLeft') || held.has('ShiftRight') || held.has('pad:sprint');

/** Read and clear. Call each exactly once a frame. */
export function tookHop() {
  const was = edges.hop;
  edges.hop = false;
  return was;
}
export function tookCoin() {
  const was = edges.coin;
  edges.coin = false;
  return was;
}
export function tookPause() {
  const was = edges.pause;
  edges.pause = false;
  return was;
}

export const lookState = () => look;

export function press(code) {
  if (held.has(code)) return;
  held.add(code);
  if (code === 'Space' || code === 'pad:hop') edges.hop = true;
  if (code === 'KeyE' || code === 'Enter' || code === 'pad:coin') edges.coin = true;
}

export const release = (code) => held.delete(code);

/** Drop everything: used when a game takes over, and on window blur. */
export function clear() {
  held.clear();
  stick.active = pad.active = false;
  stick.x = stick.y = pad.x = pad.y = 0;
  look.x = look.y = 0;
  edges.hop = edges.coin = edges.pause = false;
}

/**
 * Direction the player is asking for. An analog stick wins over the keys while
 * it is deflected, because partial deflection has to mean walking slowly.
 */
export function moveAxes() {
  if (stick.active) return stick;
  if (pad.active) return pad;
  return {
    x: (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0),
    y: (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

export function attachKeyboard(target = window) {
  target.addEventListener('keydown', (e) => {
    if (e.target.closest?.('dialog[open]')) return;
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') {
      edges.pause = true;
      return;
    }
    press(e.code);
  });
  target.addEventListener('keyup', (e) => release(e.code));
  window.addEventListener('blur', clear);
}

// ---------------------------------------------------------------------------
// Touch: a stick that appears wherever the thumb lands, plus real buttons
// ---------------------------------------------------------------------------

/** Coarse pointer, or a touch screen small enough to be held. */
export const IS_TOUCH =
  window.matchMedia?.('(pointer: coarse)').matches ||
  ((navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && Math.min(innerWidth, innerHeight) < 900);

export function attachTouch(root) {
  if (!IS_TOUCH || !root) return false;
  root.hidden = false;
  root.removeAttribute('aria-hidden');

  const zone = root.querySelector('.stick-zone');
  const base = root.querySelector('.stick-base');
  const knob = root.querySelector('.stick-knob');
  const RADIUS = 44;
  let pointerId = null;
  let centre = { x: 0, y: 0 };

  const place = (x, y) => {
    const r = zone.getBoundingClientRect();
    base.style.left = `${x - r.left}px`;
    base.style.top = `${y - r.top}px`;
  };
  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const rest = () => {
    const r = zone.getBoundingClientRect();
    place(r.left + 96, r.bottom - 96);
    setKnob(0, 0);
  };
  rest();

  zone.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    e.preventDefault();
    pointerId = e.pointerId;
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no capture */
    }
    centre = { x: e.clientX, y: e.clientY };
    place(centre.x, centre.y);
    setKnob(0, 0);
    base.classList.add('live');
    stick.active = true;
    stick.x = stick.y = 0;
  });

  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    let dx = e.clientX - centre.x;
    let dy = e.clientY - centre.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx *= RADIUS / d;
      dy *= RADIUS / d;
    }
    setKnob(dx, dy);
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    if (mag < 0.12) {
      stick.x = stick.y = 0;
      return;
    }
    const k = ((mag - 0.12) / 0.88) / mag; // rescale past the dead zone
    stick.x = nx * k;
    stick.y = -ny * k; // screen up is forward
  });

  const letGo = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    stick.active = false;
    stick.x = stick.y = 0;
    base.classList.remove('live');
    rest();
  };
  zone.addEventListener('pointerup', letGo);
  zone.addEventListener('pointercancel', letGo);
  window.addEventListener('resize', () => {
    if (!stick.active) rest();
  });

  const bind = (selector, code) => {
    const el = root.querySelector(selector);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* as above */
      }
      el.classList.add('active');
      press(code);
    });
    const up = () => {
      el.classList.remove('active');
      release(code);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  bind('.tbtn-hop', 'Space');
  bindAction(root.querySelector('#tbtn-action'));
  return true;
}

/* ---------------------------------------------------------------------------
 * The action button
 * ---------------------------------------------------------------------------
 * UP never changes meaning, so it is a plain `bind`. The button under it does,
 * and it has to change its KEY and its GLYPH together or the two drift apart
 * and the thumb lies to the player.
 *
 * Note that run and descend are the same key. `updateFly` reads sprintHeld()
 * as "sink", which was already true before this button existed — so the only
 * thing that differs between a cloud and the open air is what the glyph says.
 * Only PLAY is a different key, and it is the one that is a tap rather than a
 * hold, which is why the code is captured at press time rather than swapped
 * underneath a thumb that is already down.
 * ------------------------------------------------------------------------ */

const ACTIONS = {
  read:    { code: 'KeyE', glyph: 'READ', label: 'Read sign' },
  sit:     { code: 'KeyE', glyph: 'SIT', label: 'Sit down' },
  stand:   { code: 'KeyE', glyph: 'STAND', label: 'Stand up' },
  pets:    { code: 'KeyE', glyph: 'PETS', label: 'Choose a pet' },
  dress:   { code: 'KeyE', glyph: 'DRESS', label: 'Customize gopher' },
  write:   { code: 'KeyE', glyph: 'WRITE', label: 'Write a letter' },
  run:     { code: 'ShiftLeft', glyph: '\u00bb',  label: 'Run' },
  descend: { code: 'ShiftLeft', glyph: '\u25bc',  label: 'Descend' },
  play:    { code: 'KeyE',      glyph: 'PLAY',     label: 'Play game' },
};

let actionEl = null;
let action = ACTIONS.run;
let actionHeld = null; // the code actually pressed, so we release that one

function bindAction(el) {
  if (!el) return;
  actionEl = el;
  paintAction();

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* as above */
    }
    el.classList.add('active');
    actionHeld = action.code;
    press(actionHeld);
  });
  const up = () => {
    el.classList.remove('active');
    // Release what was pressed, not what the button says NOW: the gopher can
    // leave the ground between a thumb going down and coming up again, and a
    // ShiftLeft left held down would sink it for ever.
    if (actionHeld) release(actionHeld);
    actionHeld = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function paintAction() {
  if (!actionEl) return;
  actionEl.textContent = action.glyph;
  actionEl.setAttribute('aria-label', action.label);
  // Every nearby tap interaction uses E; run/descend remain unhighlighted.
  actionEl.classList.toggle('is-play', action.code === 'KeyE');
}

/**
 * What the action button means right now: 'run', 'descend' or 'play'. Called
 * every frame by main.js, which is the only place that knows where the gopher
 * is standing; a no-op when nothing changed, so it is free to call.
 */
export function setAction(name) {
  const next = ACTIONS[name] || ACTIONS.run;
  if (next === action) return;
  action = next;
  paintAction();
}

// ---------------------------------------------------------------------------
// Gamepad. Polled, because the API has no button events.
//
// The arcade iframe already advertises `gamepad` in its allow list, so a pad
// works inside the launcher too. Nothing here assumes a pad exists.
// ---------------------------------------------------------------------------

const padEdge = { hop: false, coin: false, pause: false, sprint: false };

export function pollGamepad() {
  const pads = navigator.getGamepads?.();
  if (!pads) return;
  const live = Array.from(pads).find((p) => p && p.connected);
  if (!live) {
    pad.active = false;
    pad.x = pad.y = look.x = look.y = 0;
    return;
  }

  const [lx = 0, ly = 0, rx = 0, ry = 0] = live.axes;
  pad.x = deaden(lx);
  pad.y = -deaden(ly);
  pad.active = pad.x !== 0 || pad.y !== 0;

  look.x = deaden(rx) * 2.4;
  look.y = deaden(ry) * 1.2;

  const down = (i) => !!live.buttons[i]?.pressed;
  const latch = (name, pressed, code) => {
    if (pressed && !padEdge[name]) press(code);
    else if (!pressed && padEdge[name]) release(code);
    padEdge[name] = pressed;
  };
  latch('hop', down(0), 'pad:hop'); // A / cross
  latch('coin', down(2) || down(1), 'pad:coin'); // X / square, or B / circle
  latch('sprint', down(10) || down(6) || down(7), 'pad:sprint'); // stick click or a trigger
  if (down(9) && !padEdge.pause) edges.pause = true; // start
  padEdge.pause = down(9);
}
