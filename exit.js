/* =============================================================================
 * exit.js — "back to the arcade", for a game running inside the arcade.
 *
 * One line in a game's <head> and it gets a way out that only exists when it
 * is being framed by the arcade. Standalone, it does nothing at all and adds
 * no markup:
 *
 *     <script src="../arcade/exit.js" defer></script>
 *
 * (fishtank is a directory deeper, so `../../arcade/exit.js` there.)
 *
 * IT IS A CLASSIC SCRIPT, NOT A MODULE, AND THAT IS DELIBERATE. A game loading
 * this is taking a runtime dependency on another repo's file, and a failed
 * fetch of any static dependency in a module graph aborts the whole graph —
 * which is how a filename once turned fishtank into a blank screen (§2 of the
 * hub's CLAUDE.md). As a plain deferred script, /arcade/ being unreachable
 * costs the game a button and nothing else.
 *
 * WHY THE GAMES NEED THIS WHEN THE ARCADE ALREADY HAS A PILL
 * ----------------------------------------------------------
 * The launcher's own "◂ ARCADE" pill lives OUTSIDE the iframe, so a game that
 * takes fullscreen on one of its own elements covers it completely: the
 * fullscreen element belongs to the top-level document and paints over
 * everything the arcade drew. A player in a fullscreen game has no way back
 * except the browser's own gesture. This button is inside the game, so it goes
 * fullscreen with it.
 *
 * HOW LEAVING WORKS
 * -----------------
 * The launcher publishes its own way out as `window.arcadeLeave`, and this
 * calls it. Both launchers live in this repository beside this file, so that
 * is one repo's contract rather than seven — and it has to be the launcher's
 * own function, because leaving is not simply `history.back()`:
 *
 *   arriving by PLAY or by flying to a machine pushes a `#play=<slug>` entry,
 *   and the way out is to unwind it so the back button, Escape and the pill
 *   all leave the same trail;
 *
 *   arriving by DEEP LINK (`…/arcade/#play=swirls`, which the README
 *   advertises) pushes nothing, and `history.back()` would take the player
 *   out of the arcade altogether — the opposite of what the button says. Both
 *   launchers already handle this: `stop()` in arcade.js and `leaveGame()` in
 *   cloudnine/js/main.js each check `history.state` and unload directly when
 *   there is no entry of theirs to unwind.
 *
 * `history.back()` stays as the fallback. It is the older contract, it is what
 * fishtank's own quit already does, and it is what a launcher served from a
 * cache older than this file still understands — the shell and the games are
 * cached by separate service workers, so an old launcher framing a new game is
 * a real state during a rollout, not a hypothetical.
 *
 * A game that pushes its own history entries should call `ArcadeExit.leave()`
 * from its own quit handler instead of relying on this button, and pass
 * `data-no-button` so there is only one way out on screen.
 *
 * WHY A TAB ON THE LEFT EDGE AND NOT A CHIP IN A CORNER
 * ----------------------------------------------------
 * Because there is no free corner in this hub, and that was measured rather
 * than guessed. Every game puts its HUD inside one full-viewport `fixed` root
 * and hangs readouts off its corners, so a corner chip lands on somebody's
 * numbers. In gameplay, at 1280x800:
 *
 *   supermine            `.sm-topbar` is 1260 px wide across the whole top —
 *                        both top corners. Bottom-left carries the debug line.
 *   supermine_adventure  `.sm-ah-strip` top-left, sound and pause buttons
 *                        top-right.
 *   dam_break            ALL FOUR: level name and objective top-left, budget
 *                        top-right, material and tool buttons bottom-left,
 *                        RELEASE WATER bottom-right.
 *   swirls               gear and next, bottom-right.
 *
 * The middle of the left edge, however, is free in every one of them — HUDs
 * cluster in corners and along edges and leave the middle of an edge alone. So
 * this is a drawer-handle tab there instead, which also happens to be the
 * direction "back" means. One placement that works everywhere beats a
 * per-game corner setting that has to be re-checked whenever a game's HUD
 * moves.
 *
 * The one place it can still be crowded is maxgear, whose `#stats-strip` is a
 * vertical rail growing down the left edge from y=66 with a 100vh-200px cap.
 * It reaches the middle only with a dozen-plus power-ups collected, and then
 * only clips one pill of a rail that is itself `overflow: hidden`. Worth
 * knowing; not worth a second placement rule.
 * ========================================================================== */
(() => {
  'use strict';

  /**
   * Are we inside something? A cross-origin parent throws on access, which is
   * itself the answer — so the catch returns true rather than swallowing it.
   */
  function framed() {
    try {
      return window.top !== window.self;
    } catch {
      return true;
    }
  }

  /**
   * Inside the ARCADE specifically, rather than inside any old page.
   *
   * Every game is served from the same origin as the arcade, so the parent's
   * path is readable and this is a fact rather than a guess. If it ever is not
   * readable we are framed by something cross-origin, which is not the arcade,
   * and the honest answer is no.
   */
  function inArcade() {
    if (!framed()) return false;
    try {
      return /\/arcade(\/|$)/.test(window.parent.location.pathname);
    } catch {
      return false;
    }
  }

  /**
   * Hand the player back to whichever launcher framed us.
   *
   * Straight through to the launcher's own function where there is one — see
   * the header for why the history entry alone is not enough — and same-origin
   * throughout, which is the same access `inArcade()` above already relies on.
   */
  function leave() {
    if (!framed()) return false;
    try {
      const ask = window.parent.arcadeLeave;
      if (typeof ask === 'function') {
        ask();
        return true;
      }
    } catch {
      // Cross-origin parent. Not the arcade, but the history entry may still
      // be the right thing for whatever it is.
    }
    history.back();
    return true;
  }

  // Published before the early return, so a game can ask the question and wire
  // its own menu item even when it has told us not to draw a button.
  window.ArcadeExit = { framed, inArcade, leave };

  if (!inArcade()) return;
  if (document.currentScript?.hasAttribute('data-no-button')) return;

  const build = () => {
    if (document.getElementById('arcade-exit')) return;

    const button = document.createElement('button');
    button.id = 'arcade-exit';
    button.type = 'button';
    // The arrow carries the meaning visually and the word confirms it; both are
    // aria-hidden so a screen reader gets the one clean label instead of
    // "left-pointing triangle ARCADE".
    button.setAttribute('aria-label', 'Back to the arcade');
    button.title = 'Back to the arcade';

    const arrow = document.createElement('span');
    arrow.textContent = '◂';
    arrow.setAttribute('aria-hidden', 'true');

    const word = document.createElement('span');
    word.textContent = 'ARCADE';
    word.setAttribute('aria-hidden', 'true');

    // Inline styles, because this belongs to the arcade rather than to the
    // game and must not depend on — or collide with — the game's stylesheet.
    Object.assign(button.style, {
      position: 'fixed',
      zIndex: '2147483000',
      // Welded to the left edge, vertically centred: see the header for why
      // this is the only placement free in every game.
      left: 'env(safe-area-inset-left, 0px)',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      margin: '0',
      // A comfortable touch target on a tablet, which is the common case here.
      minHeight: '52px',
      padding: '0 9px 0 7px',
      border: '1px solid rgba(255,255,255,.24)',
      borderLeft: '0',
      borderRadius: '0 12px 12px 0',
      background: 'rgba(8,10,18,.62)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#eef2ee',
      font: '600 11px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      letterSpacing: '.14em',
      cursor: 'pointer',
      opacity: '0.5',
      transition: 'opacity .2s ease, border-color .2s ease',
      // The game below is the point; this must never eat its input.
      touchAction: 'manipulation',
    });
    arrow.style.fontSize = '13px';
    Object.assign(word.style, {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      maxWidth: '0',
      opacity: '0',
      transition: 'max-width .22s ease, opacity .22s ease',
    });

    button.append(arrow, word);

    // Collapsed it is just an arrow at the edge of the screen. It says its own
    // name on arrival for a few seconds — which is when the player has just
    // been dropped into a game and might want straight back out — and then
    // shrinks away, because in-play chrome competes with the game for
    // attention (§2 of the hub's CLAUDE.md).
    let held = false;
    const open = (sticky) => {
      if (sticky) held = true;
      word.style.maxWidth = '64px';
      word.style.opacity = '1';
      button.style.opacity = '1';
      button.style.borderColor = 'rgba(255,255,255,.55)';
    };
    const shut = () => {
      if (held) return;
      word.style.maxWidth = '0';
      word.style.opacity = '0';
      button.style.opacity = '0.5';
      button.style.borderColor = 'rgba(255,255,255,.24)';
    };

    button.addEventListener('pointerenter', () => open(false));
    button.addEventListener('pointerleave', shut);
    button.addEventListener('focus', () => open(true));
    button.addEventListener('blur', () => {
      held = false;
      shut();
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      leave();
    });

    document.body.appendChild(button);

    open(false);
    setTimeout(shut, 3600);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})();
