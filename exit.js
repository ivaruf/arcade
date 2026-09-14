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
 *   framed           an iframe with a launcher behind it. Quitting hands the
 *                    player back to the floor they came from. Note FRAMED and
 *                    not "in the arcade": whether the thing behind us is the
 *                    arcade is a question we can fail to answer, and being
 *                    framed is not. See `quit()`.
 *   installed        its own PWA window, no tab strip, nothing behind it.
 *                    Quitting means closing the window.
 *   an ordinary tab  no script may close it — but the arcade is a URL, and a
 *                    game that loaded this file can always go there. Quitting
 *                    means going back to the arcade the long way round.
 *
 * `quit()` tells them apart and does the right one. Only the installed case
 * can fail, and it reports back rather than pretending.
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
   * Hand the player back to whichever launcher framed us. Three ways, in
   * descending order of how sure each one is:
   *
   *   1. the launcher's own function, read straight off the parent. Only
   *      same-origin, but then it is exact — see the header for why the
   *      history entry alone is not enough.
   *   2. a postMessage asking it to. This is the one that survives a
   *      CROSS-ORIGIN parent, which is not a hypothetical: the arcade's
   *      registry falls back to games.json's `origin`, so an arcade served
   *      from anywhere the games are not siblings frames the LIVE game, and
   *      every property of `window.parent` throws from in here. launcher.js
   *      answers this message and checks it came from the frame it opened.
   *   3. `history.back()`, the oldest contract of the three, and still the
   *      only thing that works when we are framed by something that has never
   *      heard of any of this.
   *
   * The broadcast target is '*' deliberately. We cannot know the parent's
   * origin when we cannot read it, and the message carries no data — it is a
   * request to be dismissed, which is not a secret worth pinning an origin on.
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
      // Cross-origin parent. Nothing on it is readable, so ask it out loud.
    }
    try {
      window.parent.postMessage({ arcade: 'leave' }, '*');
    } catch {
      // postMessage across origins does not throw, so this is belt and braces.
    }
    // ...and only if nothing answers, the blunt one. It has to be LAST and it
    // has to be LATE, because it is second best twice over: a launcher that
    // heard the message unwinds its own entry, and doing both would leave
    // twice. Worse, `history.back()` is outright wrong for a player who
    // arrived by deep link — `…/arcade/#play=swirls` pushes no entry of the
    // arcade's to unwind, so back() takes them out of the arcade altogether,
    // which is the opposite of what the button says. That is the whole reason
    // `window.parent.arcadeLeave` exists.
    //
    // A launcher that handled the message has removed this iframe well before
    // the timer fires, and removing an iframe destroys its timers with it —
    // so this runs only when nothing was listening. launcher.js takes 560ms to
    // pull the frame; the margin is deliberate.
    setTimeout(() => history.back(), 900);
    return true;
  }

  /**
   * Where the arcade is, worked out from where THIS FILE was loaded from.
   *
   * A game says `<script src="../arcade/exit.js">`, so the directory this
   * script came out of is the arcade, and that is true on ivaruf.github.io, on
   * localhost, in a fork and from a directory two deep (fishtank loads it as
   * `../../arcade/exit.js`). Hard-coding `../arcade/` would get fishtank
   * wrong, and hard-coding the live URL would break every local copy.
   *
   * `document.currentScript` is the script element while the script is
   * running, deferred ones included, which is why this is read at the top of
   * the IIFE and not inside the function that wants it.
   */
  const HERE = document.currentScript && document.currentScript.src;
  const ARCADE = HERE ? new URL('./', HERE).href : '';

  /**
   * Quit, whatever that means here. The one call a game's own button needs.
   *
   * THE ORDER OF THESE THREE TESTS IS THE WHOLE FIX. It used to ask
   * `inArcade()` first and fall through to `window.close()` for everything
   * else, and both halves of that were wrong:
   *
   *   - `inArcade()` is a test we can FAIL TO ANSWER. It reads the parent's
   *     path, which throws for a cross-origin parent, and the honest answer to
   *     "is that the arcade?" is then no. But being framed at all is knowable
   *     either way, and a framed page is one a script can never close — so the
   *     fallback ran `window.close()` inside an iframe, where it does nothing,
   *     and 250ms later the game apologised for a browser that had refused
   *     nothing. That is the "close this tab yourself" every player in a
   *     locally-served or forked arcade hit on a button labelled BACK.
   *
   *   - and in an ordinary tab there was never anything to close either, so
   *     the button's only possible outcome was the same apology. But the
   *     arcade is a URL. A game that can load `../arcade/exit.js` can also go
   *     to `../arcade/`, and a navigation always works.
   *
   * So: framed means LEAVE, installed means CLOSE (its own window, which is
   * the one case where closing is the honest verb), and a tab means GO. Only
   * the installed branch can fail, and only on iOS.
   *
   * Returns a promise resolving to what actually happened:
   *
   *   'arcade'    handed back to the launcher; the game is being unloaded.
   *   'home'      navigating to the arcade; likewise on its way out.
   *   'refused'   we asked the browser to close the window and it declined.
   *               The game is still running and should say so in its own words
   *               rather than looking broken.
   *
   * There is deliberately no 'closed'. If the window really does close, this
   * page stops existing and the promise never settles — nothing could observe
   * it anyway. So a game wires the button to `.then(...)` and only ever has to
   * handle the outcomes where it is still alive to handle them, which is why
   * every one of them tests for 'refused' and ignores the rest.
   */
  function quit() {
    if (framed()) {
      leave();
      return Promise.resolve('arcade');
    }
    if (standalone()) {
      try {
        window.close();
      } catch {
        // Some browsers throw rather than ignoring it. Same outcome either way.
      }
      // Still here a moment later means it was refused — an installed app on
      // iOS, mostly. A quarter of a second is long enough for a close that is
      // going to happen to have happened, and short enough that the game's own
      // message does not feel like a lag.
      return new Promise((resolve) => setTimeout(() => resolve('refused'), 250));
    }
    // An ordinary tab. Nothing to close, but somewhere to go.
    if (ARCADE) location.href = ARCADE;
    return Promise.resolve('home');
  }

  /**
   * What a quit button should SAY, so six games do not each guess differently
   * and none of them promise something that will not happen. The game supplies
   * its own vocabulary; this only picks which of them applies.
   *
   *   verb({ arcade: 'Back to the arcade', app: 'Close' })
   *
   * It answers the same three questions as `quit()`, in the same order, so the
   * label and the action can never disagree — which they did, and that is how
   * a button reading "close swirls" came to be the one that took you back.
   *
   * `words.tab` is LEGACY and ignored. Every game still passes one and none of
   * them needs to: the tab case is a navigation to the arcade now, so it wears
   * the arcade's word. Passing it costs nothing and removing it from six repos
   * buys nothing, so it stays accepted and unread.
   */
  function verb(words) {
    if (framed()) return words.arcade;
    if (standalone()) return words.app;
    return ARCADE ? words.arcade : (words.tab ?? words.app);
  }

  /**
   * Tell the launcher we are here, for the one question it cannot answer by
   * looking: whether the game it just framed has a way out of its own.
   *
   * It reads `contentWindow.ArcadeExit` to decide whether to show its own
   * FLOOR pill, and that read THROWS against a cross-origin frame — so the
   * arcade that most needs the pill hidden (the game does have a quit; we are
   * standing in it) is exactly the one where it appeared. A message crosses
   * origins where a property read cannot. Sent once, on load, carrying nothing
   * but the fact that this file ran.
   */
  if (framed()) {
    try {
      window.parent.postMessage({ arcade: 'exit-ready' }, '*');
    } catch {
      // Nothing to do about it, and nothing breaks: the pill appears, which is
      // the safety net behaving exactly as designed.
    }
  }

  window.ArcadeExit = { framed, inArcade, standalone, leave, quit, verb };
})();
