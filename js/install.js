/* =============================================================================
 * install.js — "keep this on your device", asked once and never again.
 *
 * The arcade is a real PWA: a manifest, an icon, a service worker, and a
 * `display: fullscreen` that only ever takes effect once it is installed. None
 * of that helps if nobody is ever told, and "how do I install a web page" has a
 * different answer on every device — so this file holds the whole of that
 * question, and index.html holds the drawings it chooses between.
 *
 * FOUR DEVICES, FOUR ANSWERS
 * --------------------------
 *   already installed  Nothing. Not a button, not a row. Offering to install
 *                      the thing you are standing inside is noise.
 *   desktop            Nothing either, and that is a deliberate call by the
 *                      owner rather than a gap: the arcade runs perfectly in a
 *                      desktop tab and nobody has asked for it in a window.
 *                      Chrome's own omnibox install icon is still there for
 *                      anyone who wants it — we simply do not push it.
 *   Android            Chrome hands us a real `beforeinstallprompt`. We keep it
 *                      and spend it on one tap of a button the player pressed
 *                      on purpose. If the event never comes — Firefox has no
 *                      such API, and Chrome fires it once per visit at most —
 *                      the drawing of the ⋮ menu takes over.
 *   iPhone / iPad      Safari has no install API AT ALL. There is no event to
 *                      wait for and no method to call, so the only honest thing
 *                      is a picture of the Share button and two short steps.
 *
 * IT IS AN OFFER, NOT A NAG
 * -------------------------
 * Nothing here opens by itself. The title card grows one extra row next to
 * "Walk in" — install on the left of the decision, play in the browser on the
 * right — and that row can be sent away for good with the × beside it or with
 * "Not now" inside the card. Either writes `arcade.install.v1` and the row
 * never comes back.
 *
 * What dismissal must NOT do is destroy the feature, which is why the pause
 * menu keeps a permanent way in. Somebody who waves the offer away in week one
 * and wants it in week three should not have to clear their site data to find
 * it. Closing the card with Escape or a tap on the scrim deliberately writes
 * nothing: that is "I was reading", not "no".
 *
 * WHY IT IS ITS OWN <script type="module"> TAG
 * --------------------------------------------
 * Same reasoning as exit.js's, one file over. A failed fetch anywhere in a
 * module graph aborts the entire graph, and a filename is a blocklist somebody
 * else writes (hub CLAUDE.md §2). Imported by main.js, an `install.js` that
 * some filter list decides it dislikes would take the whole arcade down with
 * it. As a separate tag the worst case is that the install offer quietly does
 * not appear, and the sky still opens.
 * ========================================================================== */
(() => {
  'use strict';

  /** §6: `<slug>.<thing>.v<n>`. Holds 'later' or 'installed'; either hides the
   *  title-card row. The distinction is kept because it costs nothing and the
   *  next person to read this will want to know which one happened. */
  const KEY = 'arcade.install.v1';

  // ---------------------------------------------------------------------------
  // Which device is this
  // ---------------------------------------------------------------------------

  const UA = navigator.userAgent || '';
  const TOUCHES = navigator.maxTouchPoints || 0;

  /**
   * THE IPAD TRAP. Since iPadOS 13 Safari asks for the desktop site by default
   * and reports "Mozilla/5.0 (Macintosh; Intel Mac OS X ...)" — no "iPad"
   * anywhere in it — so sniffing for /iPad/ alone misses every modern tablet
   * and quietly files it under "desktop", where this file shows nothing at all.
   *
   * The tell is the touch screen: a real Mac reports maxTouchPoints 0 even with
   * a trackpad, because a trackpad is not a touch screen, while an iPad reports
   * 5. A Mac claiming to have multi-touch is an iPad in a false beard.
   */
  const IPAD = /iPad/.test(UA) || (/Macintosh/.test(UA) && TOUCHES > 1);
  const IOS = IPAD || /iPhone|iPod/.test(UA);
  const ANDROID = /Android/.test(UA);
  const KIND = IOS ? 'ios' : ANDROID ? 'android' : 'desktop';

  /**
   * Are we already running as an installed app?
   *
   * exit.js answers this for the whole hub and answers it properly — including
   * `navigator.standalone`, which is the iOS-only signal that matches no
   * display-mode query — so it is not re-derived here.
   *
   * If `window.ArcadeExit` is missing the file failed to load, and the choice
   * is which way to be wrong. We fall through to "a browser tab", because being
   * wrong that way costs an installed visitor one dismissible row they can send
   * away with one tap, while being wrong the other way means nobody is ever
   * offered the install at all.
   */
  function installed() {
    try {
      return window.ArcadeExit?.standalone() === true;
    } catch {
      return false;
    }
  }

  const answered = () => {
    try {
      return localStorage.getItem(KEY) || '';
    } catch {
      // Private mode, or a browser with site data switched off. Then the offer
      // comes back next visit, which is the harmless half of this failure.
      return '';
    }
  };

  const answer = (value) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* nothing to do about it, and nothing to tell the player. */
    }
  };

  // ---------------------------------------------------------------------------
  // The browser's own install prompt, caught before it is thrown away
  // ---------------------------------------------------------------------------

  /**
   * Chrome fires `beforeinstallprompt` once it decides the page is installable,
   * and the event is only useful if we call preventDefault on it and hold on to
   * the object — otherwise it is gone and `prompt()` can never be called.
   *
   * Listening is registered before anything else in this file for that reason:
   * the event does not wait for us to finish looking up DOM nodes.
   *
   * Only Android keeps it. On desktop we deliberately leave the event alone so
   * Chrome's own omnibox affordance behaves exactly as it normally would.
   */
  let browserPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    if (KIND !== 'android') return;
    event.preventDefault();
    browserPrompt = event;
  });

  // ---------------------------------------------------------------------------
  // The chrome it drives. All of it is in index.html; none of it is built here.
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const dom = {
    offer: $('install-offer'),
    open: $('install-open'),
    openLabel: $('install-open-label'),
    hide: $('install-hide'),
    fromPause: $('install-pause'),
    veil: $('install'),
    now: $('install-now'),
    go: $('install-go'),
    ios: $('install-ios'),
    iosWhere: $('install-ios-where'),
    android: $('install-android'),
    close: $('install-close'),
  };

  // A page that does not carry this markup is not an error worth shouting
  // about — it is simply not the arcade's title screen.
  if (!dom.offer || !dom.veil || !dom.fromPause) return;

  const card = dom.veil.querySelector('.card');
  let opener = null;

  /**
   * Show or hide the two ways in, from scratch, every time something changes.
   *
   * The pause menu's entry survives dismissal on purpose — see the header. The
   * title card's row does not.
   */
  function refresh() {
    const said = answered();
    // `installed()` cannot notice an install that happened in THIS tab — the
    // display mode of a page already open never changes — so the remembered
    // 'installed' stands in for it until the next load.
    const offerable = KIND !== 'desktop' && !installed() && said !== 'installed';
    dom.fromPause.hidden = !offerable;
    dom.offer.hidden = !offerable || said !== '';
  }

  // Word the offer for the device holding it. "Install" is a promise Safari
  // cannot keep — there is no install on iOS, there is a home screen — and a
  // button that says one thing and does another is worse than a longer label.
  if (KIND === 'ios') {
    dom.openLabel.textContent = 'Add to home screen';
    dom.iosWhere.textContent = IPAD
      ? 'in the row of buttons at the top'
      : 'in the bar at the bottom of the screen';
  } else {
    dom.openLabel.textContent = 'Install on your device';
  }

  refresh();

  // ---------------------------------------------------------------------------
  // Opening, closing, and the one tap that matters
  // ---------------------------------------------------------------------------

  function openCard(from) {
    opener = from || null;

    // Exactly one body, chosen now rather than at load: on Android the answer
    // depends on whether the browser has handed us a prompt yet, and that can
    // land any time after boot.
    const oneTap = KIND === 'android' && !!browserPrompt;
    dom.now.hidden = !oneTap;
    dom.ios.hidden = KIND !== 'ios';
    dom.android.hidden = !(KIND === 'android' && !oneTap);

    dom.veil.hidden = false;
    (oneTap ? dom.go : dom.close).focus();
  }

  /** Close and say nothing. Escape and the scrim mean "I was reading". */
  function closeCard() {
    dom.veil.hidden = true;
    // Only back to a button that is still on screen: "Not now" hides the very
    // row that opened this, and focusing into a hidden panel strands the ring.
    if (opener && opener.offsetParent !== null) opener.focus();
    opener = null;
  }

  /** Close and mean it. The title row does not come back. */
  function notNow() {
    answer('later');
    refresh();
    closeCard();
  }

  dom.open.addEventListener('click', () => openCard(dom.open));
  dom.fromPause.addEventListener('click', () => openCard(dom.fromPause));
  dom.hide.addEventListener('click', notNow);
  dom.close.addEventListener('click', notNow);

  // The scrim is the whole viewport; only a tap on the scrim itself, never one
  // that bubbled up out of the card, counts as a tap outside.
  dom.veil.addEventListener('click', (e) => {
    if (e.target === dom.veil) closeCard();
  });

  dom.go.addEventListener('click', async () => {
    const ask = browserPrompt;
    // Spent either way: the event object is single-use, and a second prompt()
    // on it throws. Clearing it first also means the next open falls through to
    // the ⋮ drawing, which is the right guide once the sheet has been seen.
    browserPrompt = null;
    if (!ask) return closeCard();

    // Hand the screen to the browser's own sheet rather than stacking our
    // panel behind it.
    closeCard();
    try {
      ask.prompt();
      const choice = await ask.userChoice;
      // Saying no to Chrome's own dialog is as clear a no as our own "Not now",
      // and asking again next visit would be exactly the nagging §1 forbids.
      if (choice && choice.outcome === 'dismissed') answer('later');
      refresh();
    } catch {
      // Some builds reject prompt() when it is called too late. The manual
      // guide is still there behind the same button.
      refresh();
    }
  });

  /**
   * Escape closes this, and must not also reach the floor.
   *
   * controls.js listens for keydown on `window` and turns Escape into the pause
   * toggle, so an uncaught Escape here would close the card AND unpause the
   * arcade underneath it in one keystroke. Capture phase on window runs before
   * that listener, so stopping it here settles it.
   */
  window.addEventListener(
    'keydown',
    (e) => {
      if (dom.veil.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCard();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      // An iPad with a keyboard attached is a real visitor, and the buttons
      // behind the scrim are still focusable, so Tab would wander onto a
      // "Walk in" nobody can see. Two or three buttons is a short enough list
      // to cycle by hand; a general focus trap is not something this earns.
      const stops = [...card.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const on = document.activeElement;
      const outside = !card.contains(on);
      if (e.shiftKey && (outside || on === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || on === last)) {
        e.preventDefault();
        first.focus();
      }
    },
    true,
  );

  // Installed while the tab is still open — Android fires this whether the
  // install came from our button or from the browser's own menu. Everything
  // about the offer goes away at once; the running session is untouched.
  window.addEventListener('appinstalled', () => {
    browserPrompt = null;
    answer('installed');
    if (!dom.veil.hidden) closeCard();
    refresh();
  });
})();
