/* =============================================================================
 * exit.js — what "quit" means for a game in this hub, answered once.
 *
 * One line in a game's <head>:
 *
 *     <script src="../arcade/exit.js" defer></script>
 *
 * (fishtank is a directory deeper, so `../../arcade/exit.js` there.)
 *
 * It draws NOTHING. The button belongs to the game, in the game's own colours
 * and the game's own words — a generic chip dropped into six different games
 * is exactly the thing §2 of the hub's CLAUDE.md warns about, and an earlier
 * version of this file did it before being talked out of it. What the games
 * cannot each work out for themselves is what quitting should DO, because the
 * answer depends on how the page was opened, so that is what lives here.
 *
 * IT IS A CLASSIC SCRIPT, NOT A MODULE, AND THAT IS DELIBERATE. A game loading
 * this is taking a runtime dependency on another repo's file, and a failed
 * fetch of any static dependency in a module graph aborts the whole graph —
 * which is how a filename once turned fishtank into a blank screen (§2 again).
 * As a plain deferred script, /arcade/ being unreachable costs the game its
 * quit button and nothing else, which is why every game should check that
 * `window.ArcadeExit` is there before showing one.
 *
 * THE THREE WAYS A GAME IS OPEN, AND WHAT QUIT MEANS IN EACH
 * ---------------------------------------------------------
 *   in the arcade    an iframe with the launcher behind it. Quitting hands the
 *                    player back to the floor they came from.
 *   installed        its own PWA window, no tab strip, nothing behind it.
 *                    Quitting means closing the window.
 *   an ordinary tab  a tab the player opened and can close. A script may not
 *                    close it, so quitting can only say so honestly.
 *
 * `quit()` tells them apart and does the right one. It cannot always succeed —
 * see the note on its promise — so it reports back rather than pretending.
 *
 * HOW LEAVING THE ARCADE WORKS
 * ----------------------------
 * The launcher publishes its own way out as `window.arcadeLeave`, and this
 * calls it. The launcher lives in this repository beside this file, so that is
 * one repo's contract rather than seven — and it has to be the launcher's own
 * function, because leaving is not simply `history.back()`:
 *
 *   arriving by flying to a machine pushes a `#play=<slug>` entry, and the way
 *   out is to unwind it so the back button, Escape and the game's own quit all
 *   leave the same trail;
 *
 *   arriving by DEEP LINK (`…/arcade/#play=swirls`, which the README
 *   advertises) pushes nothing, and `history.back()` would take the player out
 *   of the arcade altogether — the opposite of what the button says.
 *   `leaveGame()` in js/main.js checks `history.state`, clears the hash where
 *   it stands and unloads directly when there is no entry of ours to unwind.
 *
 * `history.back()` stays as the fallback. It is the older contract, it is what
 * fishtank's own quit did before this existed, and it is what a launcher
 * served from a cache older than this file still understands — the shell and
 * the games are cached by separate service workers, so an old launcher framing
 * a new game is a real state during a rollout, not a hypothetical.
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
   * Running as an installed app rather than in a browser tab.
   *
   * `display-mode` covers every desktop and Android install and honours
   * whichever display the manifest asked for; `navigator.standalone` is the
   * iOS-only answer for a page added to the home screen, which matches no
   * display-mode query at all. A game framed by the arcade inherits the
   * ARCADE's display mode, not its own, so that is ruled out first — otherwise
   * a game played inside the installed arcade would think it was installed.
   */
  function standalone() {
    if (framed()) return false;
    try {
      if (navigator.standalone === true) return true;
      return ['standalone', 'fullscreen', 'minimal-ui'].some(
        (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
      );
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

  /**
   * Quit, whatever that means here. The one call a game's own button needs.
   *
   * Returns a promise resolving to what actually happened:
   *
   *   'arcade'    handed back to the launcher; the game is being unloaded.
   *   'refused'   we asked the browser to close the window and it declined,
   *               which it does for any window a script did not itself open.
   *               The game is still running and should say so in its own
   *               words rather than looking broken.
   *
   * There is deliberately no 'closed'. If the window really does close, this
   * page stops existing and the promise never settles — nothing could observe
   * it anyway. So a game wires the button to `.then(...)` and only ever has to
   * handle the two outcomes where it is still alive to handle them.
   */
  function quit() {
    if (inArcade()) {
      leave();
      return Promise.resolve('arcade');
    }
    try {
      window.close();
    } catch {
      // Some browsers throw rather than ignoring it. Same outcome either way.
    }
    // Still here a moment later means it was refused. A quarter of a second is
    // long enough for a close that is going to happen to have happened, and
    // short enough that the game's own message does not feel like a lag.
    return new Promise((resolve) => setTimeout(() => resolve('refused'), 250));
  }

  /**
   * What a quit button should SAY, so six games do not each guess differently
   * and none of them promise something that will not happen. The game supplies
   * its own vocabulary; this only picks which of them applies.
   *
   *   verb({ arcade: 'Back to the arcade', app: 'Close', tab: 'End run' })
   */
  function verb(words) {
    if (inArcade()) return words.arcade;
    if (standalone()) return words.app;
    return words.tab ?? words.app;
  }

  window.ArcadeExit = { framed, inArcade, standalone, leave, quit, verb };
})();
