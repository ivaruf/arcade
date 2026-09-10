/* =============================================================================
 * ARCADE service worker — installable launcher that also works offline.
 *
 * Two caches:
 *   arcade-shell-<VERSION>  the launcher's own files, precached on install.
 *                           Bump VERSION on every deploy; old shells are
 *                           dropped on activate.
 *   arcade-runtime          the games' manifests and icons (same origin,
 *                           outside this scope), and anything heavy in scope:
 *                           the 3D floor's models and its theme. Cached as
 *                           they are seen, and it survives version bumps —
 *                           which is the whole point of keeping them out of
 *                           the shell. Nine megabytes of gopher should not be
 *                           re-downloaded because a stylesheet changed.
 *
 * Both are stale-while-revalidate: answer from cache at once, refresh from
 * the network in the background. A new build therefore shows up on the visit
 * AFTER it is deployed, which is fine for a launcher, and we never reload a
 * page that may have a game running inside it.
 *
 * Navigations into the games themselves never come through here: an iframe
 * at /swirls/ is controlled by swirls' own worker, not this one.
 * ========================================================================== */

const VERSION = 'v1.3.1'; // Larger mine island and peaceful aquarium swimming
const SHELL = `arcade-shell-${VERSION}`;
const RUNTIME = 'arcade-runtime';

/**
 * Precached on install, so both launchers work on a cold offline start. The 3D
 * floor's models, its theme and Babylon itself are NOT here: they are megabytes
 * and they are picked up by the runtime cache the first time the floor is
 * opened. That means the 3D floor needs one online visit before it works
 * offline, while the 2D grid works offline immediately — the right trade for a
 * launcher that has to be dependable and an experiment that has to be big.
 */
const SHELL_FILES = [
  './',
  './index.html',
  './arcade.css',
  './arcade.js',
  './games.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './cloudnine/',
  './cloudnine/index.html',
  './cloudnine/css/style.css',
  './cloudnine/manifest.webmanifest',
  './cloudnine/js/main.js',
  './cloudnine/js/room.js',
  './cloudnine/js/aquarium.js',
  './cloudnine/js/cabinets.js',
  './cloudnine/js/gopher.js',
  './cloudnine/js/launcher.js',
  './cloudnine/js/registry.js',
  './cloudnine/js/controls.js',
  './cloudnine/js/audio.js',
  './cloudnine/js/signs.js',
  './cloudnine/js/screen.js',
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
