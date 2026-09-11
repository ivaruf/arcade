/* =============================================================================
 * screen.js — fullscreen, and the orientation lock that comes with it.
 *
 * NOT called fullscreen.js, and don't rename it back. uBlock Origin's DEFAULT
 * lists carry a rule banning that exact basename anywhere under github.io —
 * GitHub Pages hosts a lot of adware, some of it using that filename, so the
 * rule never looks inside the file. fishtank shipped a
 * `fullscreen.js`, it was an import of main.js, and because a failed fetch of
 * any static dependency aborts the entire module graph it did not lose its
 * fullscreen button — it was a blank screen for every visitor running uBlock.
 * The name was the only thing wrong with it. See §2 of the hub's CLAUDE.md.
 *
 * The two features are one module because the browser makes them one: a page
 * may only pin its orientation while fullscreen, so landscape is something we
 * can offer *after* going fullscreen and never before. That is why the "turn
 * your device sideways" overlay carries the same button as the HUD — one tap
 * goes fullscreen and pins landscape, so a phone held upright starts playing
 * instead of being told to rotate.
 *
 * Every part of this is optional and absent is not an error. iPhone Safari has
 * no element fullscreen and no orientation lock at all: there the buttons stay
 * hidden and the overlay's instruction stands on its own, which is exactly how
 * it behaved before this file existed.
 * ========================================================================== */

/**
 * @param onResize called after every fullscreen change, on the next frame —
 *        the viewport is a different size and the engine has to be told.
 */
export function setupScreen(onResize) {
  const button = document.getElementById('fullscreen');
  const rotateButton = document.getElementById('rotate-go');
  const rotateLabel = document.getElementById('rotate-go-label');
  const note = document.getElementById('rotate-note');
  const root = document.documentElement;

  if (!document.fullscreenEnabled || !root.requestFullscreen) return;
  button.hidden = false;

  /**
   * Whether this browser can pin the orientation decides what the overlay's
   * button may promise, not whether it appears: where locking works the tap
   * turns the sky for you, and where it does not (iPad Safari) fullscreen is
   * still worth having once the device is turned. Only the label changes, so
   * the button never claims something it cannot do.
   */
  const canPin = typeof screen.orientation?.lock === 'function';
  if (rotateButton) {
    rotateLabel.textContent = canPin ? 'Play in landscape' : 'Or play fullscreen';
    rotateButton.hidden = false;
  }

  let pinned = false;

  async function pin(active) {
    if (!canPin) return;
    try {
      if (active) {
        await screen.orientation.lock('landscape');
        pinned = true;
      } else if (pinned) {
        // Leaving fullscreen: give the orientation back, or the device stays
        // sideways in the menu for reasons the player cannot see.
        screen.orientation.unlock();
        pinned = false;
      }
    } catch {
      // Refused. Some phones will not lock at all and a few refuse while
      // physically held the other way round. The overlay still says which way.
      pinned = false;
      if (active && note) {
        note.textContent = 'This device will not lock sideways — please turn it.';
        note.hidden = false;
      }
    }
  }

  function sync() {
    const active = !!document.fullscreenElement;
    const label = active ? 'Leave fullscreen' : 'Go fullscreen';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
    button.title = label;
    button.textContent = active ? '⤡' : '⤢';

    // Only after the state has actually changed: asking for the lock alongside
    // requestFullscreen races the transition and is refused.
    pin(active);
    requestAnimationFrame(onResize);
  }

  async function toggle(trigger) {
    trigger.disabled = true;
    if (note) note.hidden = true;
    try {
      // The whole page, not the canvas: the HUD, the callout and both touch
      // sticks are DOM and have to come with it.
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      if (trigger === rotateButton && note) {
        note.textContent = 'Fullscreen was refused. Please turn the device instead.';
        note.hidden = false;
      }
    } finally {
      trigger.disabled = false;
    }
  }

  button.addEventListener('click', () => toggle(button));
  rotateButton?.addEventListener('click', () => toggle(rotateButton));
  document.addEventListener('fullscreenchange', sync);
  sync();
}

/**
 * Make this page installable in its own right.
 *
 * It was already cached — the launcher's worker at /arcade/ covers this
 * directory — but only if you had been to the launcher first. Arriving here
 * directly left the page uncontrolled, and an uncontrolled page is not
 * installable however good its manifest is. So it registers the SAME worker
 * rather than a second one: `../sw.js` sits in /arcade/, which is the widest
 * scope it is allowed to claim, and claiming it means the 2D grid and the sky
 * share one cache and one version number instead of quietly evicting each
 * other's files.
 *
 * Fire and forget. Service workers need a secure context, so plain-http LAN
 * testing skips this and everything else still works.
 */
export function registerWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => reg.update().catch(() => {}))
      .catch((err) => console.info('[cloudnine] offline support unavailable:', err.message));
  });
}
