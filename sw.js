/* =============================================================================
 * ARCADE service worker — installable launcher that also works offline.
 *
 * Two caches:
 *   arcade-shell-<VERSION>  the launcher's own files, precached on install.
 *                           Bump VERSION on every deploy; old shells are
 *                           dropped on activate.
 *   arcade-runtime          the games' manifests and icons (same origin,
 *                           outside this scope). Cached as they are seen so
 *                           the grid paints offline. Survives version bumps.
 *
 * Both are stale-while-revalidate: answer from cache at once, refresh from
 * the network in the background. A new build therefore shows up on the visit
 * AFTER it is deployed, which is fine for a launcher, and we never reload a
 * page that may have a game running inside it.
 *
 * Navigations into the games themselves never come through here: an iframe
 * at /swirls/ is controlled by swirls' own worker, not this one.
 * ========================================================================== */

const VERSION = 'v1.0.0';
const SHELL = `arcade-shell-${VERSION}`;
const RUNTIME = 'arcade-runtime';

const SHELL_FILES = [
  './',
  './index.html',
  './arcade.css',
  './arcade.js',
  './games.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

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

  event.respondWith(staleWhileRevalidate(event, req, inScope ? SHELL : RUNTIME));
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
