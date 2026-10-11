/* =============================================================================
 * launcher.js — handing the screen over to the actual game.
 *
 * THE HANDOVER IS A CURTAIN, AND IT USED TO BE A ZOOM. Until 2026-10-11 the
 * game's iframe was revealed through a clip-path shaped like the cabinet's
 * glass, scaled down to fit it, and then both animated open to the whole
 * screen while the 3D sky kept rendering around it. It was the prettiest
 * moment in the room and it chopped on most devices, for reasons that add up
 * rather than compete: a clip-path animation is repainted on the main thread
 * every frame (it is not one the compositor can run alone), the thing being
 * repainted was a full-size document that was busy booting a game — parsing
 * modules, building a canvas, sometimes starting Babylon — and the arcade was
 * still drawing a thousand meshes underneath. Three jobs on one thread, each
 * one enough to drop frames on an old tablet.
 *
 * So the handover now does one thing at a time, and nothing it animates costs
 * the main thread anything:
 *
 *   1. The camera has finished its dive (main.js). The 3D loop STOPS at once;
 *      a WebGL canvas keeps showing its last frame, so the sky is still there,
 *      frozen, costing nothing.
 *   2. A cover in the game's own colours, with its icon and name, fades in
 *      over that frozen frame. Opacity only: the compositor runs it.
 *   3. Only once the cover is up is the iframe built, underneath it, so the
 *      game boots with the whole device to itself and nothing on screen is
 *      waiting on it.
 *   4. When the game has loaded and had a moment to paint, the cover fades
 *      out (opacity again) and the game is simply there.
 *
 * Leaving is the same curtain the other way: cover in over the game, iframe
 * removed, one fresh frame of the sky rendered, cover out. The camera stays
 * parked in front of the glass the whole time so that frame is the right one.
 *
 * The URL hash is the source of truth, same contract as the 2D launcher, so
 * Escape, the back button and Android's back gesture all leave the game, and
 * #play=<slug> is a link straight to a machine.
 *
 * The iframe is BUILT for each game and thrown away afterwards, rather than
 * being a fixed element we repoint. Assigning `src` to an iframe that already
 * has a document pushes a session history entry, which lands in front of our
 * own pushState and makes the first press of the back button do nothing
 * visible. An iframe's *first* navigation replaces its initial about:blank
 * instead of pushing, so a new element per game keeps the back button honest —
 * and disposing it is also the only certain way to stop a game's audio and
 * animation frames when the player steps away.
 * ========================================================================== */

/** Kept in step with the arcade's own iframe: gamepads and motion included. */
const ALLOW = 'fullscreen; autoplay; gamepad; screen-wake-lock; accelerometer; gyroscope; pointer-lock; xr-spatial-tracking';

/**
 * How long the curtain takes, kept in step with `.curtain` in style.css. The
 * timers below are a backstop for `transitionend`, which a backgrounded tab or
 * reduced motion may never deliver.
 */
const FADE = 320;

/**
 * After the iframe's `load`, a beat for the game's first frames to land before
 * the cover lifts — `load` means its scripts ran, not that it has painted.
 * And a ceiling, so a game that never fires `load` (a stalled request, a
 * service worker gone wrong) still gets shown rather than hidden forever.
 */
const SETTLE_AFTER_LOAD = 350;
const LOAD_CEILING = 8000;

export function createLauncher({ engine, scene, canvas, root, pill, onLeft }) {
  let current = null;
  let frame = null;
  let dimTimer = 0;
  // Whether the framed game has said it has its own way out. Per game, so it
  // is cleared in open() rather than only in close(): a machine opened, left
  // and reopened must be asked again, and a game with no exit.js following one
  // that had it must not inherit the answer.
  let announced = false;

  // The curtain, built once. Its contents are repainted per game in open().
  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML =
    '<img class="curtain-icon" alt="" decoding="async">' +
    '<p class="curtain-title"></p>' +
    '<span class="curtain-dots"><i></i><i></i><i></i></span>';
  const curtainIcon = curtain.querySelector('.curtain-icon');
  const curtainTitle = curtain.querySelector('.curtain-title');
  root.insertBefore(curtain, pill);

  /** Fade the curtain to `up` (true = covering). Resolves when it is there. */
  let fadeToken = 0;
  function fade(up) {
    const token = ++fadeToken;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        curtain.removeEventListener('transitionend', onEnd);
        resolve(token === fadeToken);
      };
      const onEnd = (e) => {
        if (e.target === curtain && e.propertyName === 'opacity') finish();
      };
      curtain.addEventListener('transitionend', onEnd);
      setTimeout(finish, FADE + 120);
      curtain.classList.toggle('up', up);
    });
  }

  function wakePill() {
    pill.classList.remove('dim');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(() => pill.classList.add('dim'), 2600);
  }

  /**
   * Open the machine. Whoever calls this has already flown the camera to the
   * glass; from here nothing in 3D moves again until close().
   */
  function open(cabinet) {
    current = cabinet;
    announced = false;

    // 1. Freeze the sky. Its last frame stays on the canvas.
    engine.stopRenderLoop();

    // 2. The cover, in the game's colours, starting transparent. Set while the
    //    root is still hidden and committed with a reflow, so becoming visible
    //    and fading in are two different style changes and the fade animates.
    const game = cabinet.game;
    curtain.style.setProperty('--curtain-bg', game.theme || '#0b1018');
    curtain.style.setProperty('--curtain-accent', game.accent || '#12d9b8');
    curtainTitle.textContent = game.title || '';
    if (game.icon) {
      curtainIcon.src = game.icon;
      curtainIcon.hidden = false;
    } else {
      curtainIcon.removeAttribute('src');
      curtainIcon.hidden = true;
    }
    curtain.classList.remove('up');
    root.hidden = false;
    void root.offsetWidth;

    fade(true).then(() => {
      if (current !== cabinet) return;
      // 3. Only now does the game start, underneath a still screen.
      frame = document.createElement('iframe');
      frame.title = game.title;
      frame.setAttribute('allow', ALLOW);
      frame.setAttribute('allowfullscreen', '');
      frame.src = game.url;
      root.insertBefore(frame, curtain);

      // 4. Lift the cover once it has loaded and had a beat to paint.
      let shown = false;
      const reveal = () => {
        if (shown || current !== cabinet) return;
        shown = true;
        // Decided HERE and not on `load`: exit.js announces itself by
        // postMessage, which was measured arriving AFTER the iframe's load
        // event. Nobody can see the pill until the game is on screen anyway.
        offerPillIfTheGameHasNoQuit();
        fade(false);
      };
      frame.addEventListener('load', () => setTimeout(reveal, SETTLE_AFTER_LOAD), { once: true });
      setTimeout(reveal, LOAD_CEILING);
    });
  }

  /**
   * The FLOOR pill is a safety net now, not furniture.
   *
   * Every game in the arcade has its own quit, in its own colours and its own
   * words, so a second control out here was just clutter over the top of it —
   * and ours could only ever be generic. But `games.json` is open: a slug can
   * be added whose repo has never heard of `../arcade/exit.js`, and a game with no way
   * out and no pill is a trap rather than a worse card. So we ask the frame
   * whether the game has the arcade's exit API, and show the pill only when it
   * does not.
   *
   * TWO WAYS OF ASKING, BECAUSE ONE OF THEM CANNOT ALWAYS BE ASKED. Reading
   * `contentWindow.ArcadeExit` is a fact when the game is same-origin, and it
   * THROWS when it is not — and a cross-origin game is not a game without a
   * quit, it is a game we cannot interrogate. That happens for real whenever
   * the arcade is served from somewhere the games are not its siblings (a
   * local server rooted elsewhere, a fork, a preview), because the registry
   * then falls back to games.json's `origin` and frames the live game. So
   * exit.js also announces itself by postMessage as it loads, `announced`
   * below records it, and either answer is proof enough.
   */
  function offerPillIfTheGameHasNoQuit() {
    let hasOwnQuit = announced;
    if (!hasOwnQuit) {
      try {
        hasOwnQuit = !!frame?.contentWindow?.ArcadeExit;
      } catch {
        hasOwnQuit = false;
      }
    }
    pill.hidden = hasOwnQuit;
    if (!hasOwnQuit) wakePill();
  }

  /**
   * What the framed game has told us about itself, cleared for every game.
   *
   * `exit-ready` is exit.js saying it ran, which is the cross-origin half of
   * the question above. `leave` is a game asking to be dismissed when it could
   * not reach `window.arcadeLeave` directly — same request, same answer, just
   * the only route out of a cross-origin frame.
   *
   * `event.source` is checked against the iframe we opened, so this listens to
   * the game on the machine and to nothing else on the internet. Both messages
   * are requests rather than data, so there is nothing here to trust or spend.
   */
  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const what = event.data?.arcade;
    if (what === 'exit-ready') {
      announced = true;
      pill.hidden = true;
    } else if (what === 'leave') {
      onLeft();
    }
  });

  /** Give the machine back. Resolves once the floor is on screen again. */
  async function close(render) {
    if (!current) return;
    current = null;
    pill.hidden = true; // back to hidden for whatever opens next

    // Cover the game, THEN take it away: removing a running document is a
    // hitch of its own, and it should happen where nobody can see it.
    await fade(true);
    if (current) return; // a new machine was opened meanwhile; it owns the root
    const leaving = frame;
    frame = null;
    leaving?.remove(); // the only sure way to stop a game's audio and rAF

    // One fresh frame of the sky under the cover before it lifts, and the
    // loop running again so the lift reveals a live room, not a still.
    engine.runRenderLoop(render);
    scene.render();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (current) return;
    await fade(false);
    if (current) return;
    root.hidden = true;
  }

  pill.addEventListener('pointerenter', wakePill);
  pill.addEventListener('focusin', wakePill);
  root.querySelector('#step-away').addEventListener('click', () => onLeft());

  return {
    open,
    close,
    get playing() {
      return !!current;
    },
    get cabinet() {
      return current;
    },
  };
}

/** #play=<slug>, the same contract the 2D launcher uses. */
export const hashSlug = () => {
  const m = location.hash.match(/^#play=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

export function pushSlug(slug) {
  // A deep link arrives with the hash already set and the dive it triggers
  // ends here like any other, so pushing would stack a second identical entry.
  // Leave it alone in that case: the entry is already the one we want, and
  // marking it as ours would tell leaveGame() to unwind an entry that is the
  // first in the session — taking the player out of the arcade rather than
  // back to the sky. `dropSlug` handles the unmarked entry correctly.
  if (hashSlug() === slug) return;
  history.pushState({ cloudnine: true }, '', `#play=${encodeURIComponent(slug)}`);
}

export function dropSlug() {
  if (history.state?.cloudnine) history.back();
  else history.replaceState(null, '', location.pathname + location.search);
}
