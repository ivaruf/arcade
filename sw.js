/* =============================================================================
 * ARCADE service worker — installable launcher that also works offline.
 *
 * Two caches:
 *   arcade-shell-<VERSION>  the launcher's own files, precached on install.
 *                           Bump VERSION on every deploy; old shells are
 *                           dropped on activate.
 *   arcade-runtime          the games' manifests and icons (same origin,
 *                           outside this scope), and anything heavy in scope:
 *                           the models, the theme and Babylon. Cached as they
 *                           are seen, and it survives version bumps — which is
 *                           the whole point of keeping them out of the shell.
 *                           Nine megabytes of gopher should not be downloaded
 *                           again because a stylesheet changed.
 *
 * Both are stale-while-revalidate: answer from cache at once, refresh from
 * the network in the background. A new build therefore shows up on the visit
 * AFTER it is deployed, which is fine for a launcher, and we never reload a
 * page that may have a game running inside it.
 *
 * Navigations into the games themselves never come through here: an iframe
 * at /swirls/ is controlled by swirls' own worker, not this one.
 * ========================================================================== */

importScripts('./js/version.js');
const VERSION = self.GOPHER_CLOUD_VERSION;
const SHELL = `arcade-shell-${VERSION}`;
const RUNTIME = 'arcade-runtime';

/**
 * Precached on install: the page, its modules, its stylesheet and its icons.
 *
 * The models, the theme and Babylon itself are NOT here. They are megabytes,
 * and the runtime cache picks them up the first time they are fetched, so it
 * survives a version bump — nine megabytes of gopher should not be downloaded
 * again because a stylesheet changed. The cost of that trade is honest and
 * worth writing down: the arcade needs ONE online visit before it works
 * offline, because a sky with no clouds in it is not a sky.
 */
const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './exit.js',
  // Has to be IN the cache, not merely deployed: the players this rescues are
  // the ones whose browser has stopped asking this origin for anything.
  './moved.js',
  './games.json',
  './manifest.webmanifest',
  './js/main.js',
  './js/parents.js',
  './js/parents-scroll.js',
  './css/parents-scroll.css',
  './assets/images/parents-gopher.png',
  './js/seating.js',
  './js/pets.js',
  './js/room.js',
  './js/minimaze.js',
  './assets/games/minimaze.svg',
  './js/aquarium.js',
  './js/gears.js',
  './js/swirls.js',
  './js/neonfox.js',
  './js/foxrace.js',
  './js/cabinets.js',
  './js/gopher.js',
  './js/customization.js',
  './js/wardrobe.js',
  './js/mailbox.js',
  './js/dispenser.js',
  './js/launcher.js',
  './js/registry.js',
  './js/controls.js',
  './js/audio.js',
  './js/quality.js',
  './js/signs.js',
  './js/version.js',
  './js/screen.js',
  './js/install.js',
  // NeonFox's cabinet art. Held here rather than fetched from the game so the
  // screen is right before the game is published, and so a cabinet never
  // depends on a round trip to another origin to have a face.
  './assets/games/neonfox-192.png',
  './assets/games/lobbots-192.png',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/** Big binaries live in the unversioned cache. See the header. */
const HEAVY = /\.(glb|mp3|m4a|ogg|wav)$/i;

/**
 * Heavy files fetched on install anyway, into the runtime cache. Exactly the
 * URLs room.js asks for, query string and all, because the cache keys on it:
 * `lobbots-island.glb?v=3` here and `?v=1` there is two different files and
 * the precache would be dead weight. tools/check-registry.mjs holds the two
 * in step. Best effort: a model that fails to arrive must not fail the
 * install, it is simply fetched the first time it is wanted as before.
 *
 * Why the island and not the rest: it is the newest thing in the sky and
 * the one an old visitor has never fetched, so it is the one a returning
 * player would otherwise meet as an empty patch of air on their first
 * visit — and miss entirely offline.
 */
const PRELOAD_HEAVY = [
  './assets/3d/lobbots-island.glb?v=3',
  './assets/3d/dam-island.glb?v=1',
  './assets/3d/adventure-island.glb?v=1',
  './assets/3d/supermine-island.glb?v=1',
  './assets/3d/neonfox-island.glb?v=1',
  './assets/3d/neonfox-rider.glb?v=1',
];

/**
 * `cache: 'reload'` on everything the install stores. Without it the
 * precache reads through the browser's HTTP cache, and GitHub Pages lets that
 * keep a file for ten minutes — so a worker installed straight after a deploy
 * could file yesterday's room.js under today's version and serve it for the
 * whole of that release. That is how a deployed island stayed invisible.
 */
const fresh = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES.map(fresh)))
      .then(() => caches.open(RUNTIME))
      .then((cache) => Promise.all(PRELOAD_HEAVY.map((url) =>
        cache.match(url).then((hit) => hit || cache.add(fresh(url))).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('arcade-shell-') && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // local dev against the live site: pass through

  // Mail never goes near a cache. Everything else here is stale-while-
  // revalidate, which answers from yesterday and refreshes for tomorrow — fine
  // for a stylesheet and wrong for an answer somebody is standing at the box
  // waiting to read. It is one small request per visit, on purpose.
  if (url.pathname.includes('/mail/')) return;

  const inScope = url.href.startsWith(self.registration.scope);
  if (req.mode === 'navigate' && !inScope) return;

  const shell = inScope && !HEAVY.test(url.pathname);
  event.respondWith(staleWhileRevalidate(event, req, shell ? SHELL : RUNTIME));
});

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: false });

  // The background refresh revalidates with the server rather than reading
  // the HTTP cache, for the same reason as the install: otherwise "refresh"
  // can mean "copy the stale file into the cache again". A navigation
  // request cannot be re-initialised, so that one is rebuilt from its URL.
  const revalidate = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(req, { cache: 'no-cache' });
  const refresh = revalidate
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const fresh = await refresh;
  if (fresh) return fresh;

  // Offline and never seen: for the shell, fall back to the launcher page.
  if (req.mode === 'navigate') {
    const shell = await cache.match('./index.html');
    if (shell) return shell;
  }
  return Response.error();
}
