/* =============================================================================
 * launcher.js — handing the screen over to the actual game.
 *
 * This is the whole point of the room, so it is worth being precise about what
 * is real. You cannot texture an iframe onto a mesh: WebGL has no way to sample
 * a live document, and there is no trick that makes it possible. What you CAN
 * do is put the document exactly where the mesh was.
 *
 * So: the CRT's four corners are projected from 3D into screen pixels, and the
 * game's iframe — full size, laid out for the final viewport all along — is
 * revealed through a clip-path inset matching that rectangle, then the inset
 * animates away. The cabinet screen becomes the game's screen becomes the
 * whole screen, and the only thing that moved was a clip.
 *
 * Coming back reverses it, which is why the camera stays parked in front of the
 * glass the entire time the game is running. The 3D render loop stops while a
 * game has the machine — a browser game does not want to share a GPU with an
 * arcade — but the scene is kept alive so stepping away is instant.
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

const identity = BABYLON.Matrix.Identity();

/** Kept in step with the arcade's own iframe: gamepads and motion included. */
const ALLOW = 'fullscreen; autoplay; gamepad; screen-wake-lock; accelerometer; gyroscope; pointer-lock; xr-spatial-tracking';

/** Never dwell forever on the cabinet screen if a game is slow to paint. */
const DWELL_AFTER_LOAD = 420;
const DWELL_CEILING = 2400;

export function createLauncher({ engine, scene, canvas, root, pill, onLeft }) {
  let current = null;
  let frame = null;
  let dimTimer = 0;

  /**
   * The mesh's screen rectangle in CSS pixels. Babylon projects into drawing
   * buffer pixels, which are not CSS pixels once devicePixelRatio or the
   * engine's hardware scaling gets involved — hence the ratio.
   */
  function rectOf(mesh) {
    const viewport = scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const transform = scene.getTransformMatrix();
    const scale = canvas.clientWidth / engine.getRenderWidth() || 1;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
      const p = BABYLON.Vector3.Project(corner, identity, transform, viewport);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return {
      left: minX * scale,
      top: minY * scale,
      right: maxX * scale,
      bottom: maxY * scale,
    };
  }

  function insetFor(mesh) {
    const r = rectOf(mesh);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // A CRT has a corner radius; borrowing it here is what stops the reveal
    // looking like a div appearing.
    return `inset(${r.top.toFixed(1)}px ${(w - r.right).toFixed(1)}px ${(h - r.bottom).toFixed(1)}px ${r.left.toFixed(1)}px round 10px)`;
  }

  /**
   * The iframe is always the full viewport, because that is the size the game
   * should lay itself out for. Clipping it to the CRT alone would therefore
   * show the middle of a full-size page rather than a small screen, so during
   * the dwell it is also scaled down and slid so that the WHOLE game fits
   * inside the glass. Uniform scale, because a squashed game looks broken
   * rather than distant.
   */
  function shrinkFor(mesh) {
    const r = rectOf(mesh);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const k = Math.min((r.right - r.left) / w, (r.bottom - r.top) / h);
    const dx = (r.left + r.right) / 2 - w / 2;
    const dy = (r.top + r.bottom) / 2 - h / 2;
    return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${k.toFixed(4)})`;
  }

  function wakePill() {
    pill.classList.remove('dim');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(() => pill.classList.add('dim'), 2600);
  }

  /**
   * Open the machine. `cabinet.screenMesh` must still be where the camera is
   * looking, which it is: whoever called this has already flown the camera in.
   *
   * The starting clip is applied while the overlay is still `hidden`. That is
   * the whole trick, and doing it any other way does not animate: an element
   * that was not being rendered has no before-change style, so becoming
   * visible with a clip already on it starts no transition, and the change one
   * frame later has something to transition FROM. Toggling `transition: none`
   * around the first assignment instead ends up snapping straight to the end.
   *
   * `dwell` is the beat where the game is running inside the cabinet's glass,
   * at cabinet size, before the glass becomes the whole screen. It is the best
   * thing in the room and it costs a setTimeout.
   */
  function open(cabinet) {
    current = cabinet;

    frame = document.createElement('iframe');
    frame.title = cabinet.game.title;
    frame.setAttribute('allow', ALLOW);
    frame.setAttribute('allowfullscreen', '');
    frame.style.transform = shrinkFor(cabinet.screenMesh);
    frame.src = cabinet.game.url;

    root.style.clipPath = insetFor(cabinet.screenMesh);
    root.insertBefore(frame, pill);
    root.hidden = false;
    void root.offsetWidth; // commit the clip and the shrink as current style

    // Hold on the cabinet screen until the game has something to show, so the
    // beat is always "the machine is running it", never a black rectangle.
    let opened = false;
    const reveal = () => {
      if (opened || current !== cabinet) return;
      opened = true;
      root.style.clipPath = 'inset(0 round 0)';
      frame.style.transform = 'none';
      // The floor keeps rendering around the opening clip; it stops once the
      // game owns the viewport, which is also when the iframe wants the GPU.
      setTimeout(() => {
        if (current === cabinet) engine.stopRenderLoop();
      }, 620);
    };
    frame.addEventListener('load', () => setTimeout(reveal, DWELL_AFTER_LOAD), { once: true });
    setTimeout(reveal, DWELL_CEILING);
  }

  /** Give the machine back. Resolves once the floor is on screen again. */
  function close(render) {
    if (!current) return Promise.resolve();
    const cabinet = current;
    current = null;

    engine.runRenderLoop(render);
    // One render so the projection below uses this frame's camera rather than
    // whatever the matrices held before the game took over.
    scene.render();
    root.style.clipPath = insetFor(cabinet.screenMesh);
    frame.style.transform = shrinkFor(cabinet.screenMesh);
    const leaving = frame;
    frame = null;

    return new Promise((resolve) => {
      setTimeout(() => {
        leaving.remove(); // the only sure way to stop a game's audio and rAF
        root.hidden = true;
        // Reset while hidden, for the same reason open() sets it while hidden.
        root.style.clipPath = 'inset(0 round 0)';
        resolve();
      }, 560);
    });
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
  history.pushState({ cloudnine: true }, '', `#play=${encodeURIComponent(slug)}`);
}

export function dropSlug() {
  if (history.state?.cloudnine) history.back();
  else history.replaceState(null, '', location.pathname + location.search);
}
