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

const VERSION = 'v2.7.5'; // Preserve NeonFox floor texture colors instead of adding white.
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
  './games.json',
  './manifest.webmanifest',
  './js/main.js',
  './js/room.js',
  './js/aquarium.js',
  './js/gears.js',
  './js/swirls.js',
  './js/neonfox.js',
  './js/cabinets.js',
  './js/gopher.js',
  './js/customization.js',
  './js/launcher.js',
  './js/registry.js',
  './js/controls.js',
  './js/audio.js',
  './js/quality.js',
  './js/signs.js',
  './js/screen.js',
  './js/install.js',
  // NeonFox's cabinet art. Held here rather than fetched from the game so the
  // screen is right before the game is published, and so a cabinet never
  // depends on a round trip to another origin to have a face.
  './assets/games/neonfox-192.png',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/** Big binaries live in the unversioned cache. See the header. */
const HEAVY = /\.(glb|mp3|m4a|ogg|wav)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
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

  const inScope = url.href.startsWith(self.registration.scope);
  if (req.mode === 'navigate' && !inScope) return;

  const shell = inScope && !HEAVY.test(url.pathname);
  event.respondWith(staleWhileRevalidate(event, req, shell ? SHELL : RUNTIME));
});

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: false });

  const refresh = fetch(req)
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
