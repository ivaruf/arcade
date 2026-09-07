/* =============================================================================
 * ARCADE — the launcher.
 *
 * games.json lists the machines. Everything else about a game is read at
 * runtime from the game's OWN hosted files, so adding a game is one line:
 *
 *   1. <origin>/<slug>/manifest.webmanifest      name, description, colours, icons
 *   2. else <origin>/<slug>/  (the page itself)  <link rel=manifest>, or a
 *      meta-refresh / canonical redirect that is followed once (fishtank
 *      lives at /fishtank/client/), else <title>, <meta description>,
 *      <meta theme-color>, <link rel=icon>
 *   3. else the slug, prettified.
 *
 * Entries in games.json may be a plain slug string or an object with
 * overrides: { slug, path, url, name, tagline, description, theme, accent, icon }.
 *
 * Resolved metadata is kept in localStorage so the second visit paints
 * instantly and offline; it is refreshed in the background every visit.
 *
 * PLAY opens the game inside the arcade (an iframe on the same origin, so the
 * game's own service worker, storage and fullscreen all work). The ↗ link
 * opens the game on its own page. No build step, no dependencies.
 * ========================================================================== */
(() => {
  'use strict';

  const CONFIG_URL = './games.json';
  const META_KEY = 'arcade.meta.v1';
  const $ = (sel, root = document) => root.querySelector(sel);

  const grid = $('#grid');
  const status = $('#status');
  const tpl = $('#card-tpl');
  const player = $('#player');
  const frame = $('#frame');
  const pill = $('.pill');
  const exitBtn = $('#exit');
  const themeMeta = $('meta[name="theme-color"]');
  const ARCADE_THEME = themeMeta.content;

  /** slug -> game state (config entry + resolved metadata + card element) */
  const games = new Map();

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  boot().catch((err) => {
    console.error(err);
    status.textContent = `Could not read games.json (${err.message}).`;
    grid.setAttribute('aria-busy', 'false');
  });

  const cached = readMetaCache();

  async function boot() {
    const entries = await loadConfig();

    for (const entry of entries) {
      const game = { ...entry, ...(cached[entry.slug] || {}), resolved: !!cached[entry.slug] };
      game.card = cardFor(game);
      games.set(entry.slug, game);
      grid.appendChild(game.card);
    }

    syncFromUrl(); // a #play=slug link may want the player straight away

    const pending = entries.filter((e) => !cached[e.slug]).length;
    if (pending) status.textContent = `Reading ${pending} machine${pending === 1 ? '' : 's'}…`;

    await Promise.allSettled(
      entries.map(async (entry) => {
        const game = games.get(entry.slug);
        try {
          const meta = await resolveGame(entry);
          Object.assign(game, meta, { resolved: true });
          cached[entry.slug] = { ...meta, derivedAccent: game.derivedAccent || '' };
          update(game);
        } catch (err) {
          console.warn(`arcade: could not resolve ${entry.slug}`, err);
          if (!game.resolved) Object.assign(game, fallbackMeta(entry), { resolved: true });
          update(game);
        }
      }),
    );

    writeMetaCache(cached);
    status.textContent = '';
    grid.setAttribute('aria-busy', 'false');
    markOfflineReady();
  }

  async function loadConfig() {
    const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    const origin = String(cfg.origin || location.origin).replace(/\/?$/, '/');
    return (cfg.games || []).map((g) => {
      const entry = typeof g === 'string' ? { slug: g } : { ...g };
      if (!entry.slug) throw new Error('every game needs a slug');
      entry.base = new URL(entry.path || `${entry.slug}/`, origin).href;
      return entry;
    });
  }

  // ---------------------------------------------------------------------------
  // Resolving a game from its hosted files
  // ---------------------------------------------------------------------------

  const fetchText = async (url) => {
    try {
      const res = await fetch(url);
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };

  const fetchJSON = async (url) => {
    const text = await fetchText(url);
    if (text == null) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  async function resolveGame(entry, depth = 0) {
    const base = entry.base;
    let manifestUrl = new URL('manifest.webmanifest', base).href;
    let manifest = await fetchJSON(manifestUrl);
    let page = null;

    if (!manifest) {
      const html = await fetchText(base);
      if (html) {
        page = new DOMParser().parseFromString(html, 'text/html');
        const link = page.querySelector('link[rel~="manifest" i]');
        if (link?.getAttribute('href')) {
          manifestUrl = new URL(link.getAttribute('href'), base).href;
          manifest = await fetchJSON(manifestUrl);
        } else if (depth < 2) {
          // A bare redirect page (fishtank: "/fishtank/" -> "client/"). Follow it once.
          const refresh = page.querySelector('meta[http-equiv="refresh" i]')?.getAttribute('content') || '';
          const target =
            refresh.match(/url\s*=\s*['"]?([^'";]+)/i)?.[1] ||
            page.querySelector('link[rel="canonical"]')?.getAttribute('href');
          if (target) {
            const next = new URL(target.trim(), base).href;
            if (next !== base) return resolveGame({ ...entry, base: next }, depth + 1);
          }
        }
      }
    }

    if (!manifest && !page) throw new Error('unreachable');
    return describe(entry, manifest, manifestUrl, page);
  }

  function describe(entry, m, manifestUrl, page) {
    const first = (...vals) => vals.find((v) => typeof v === 'string' && v.trim())?.trim() ?? '';
    const meta = (name) => page?.querySelector(`meta[name="${name}" i]`)?.getAttribute('content');

    const fullName = first(m?.name, m?.short_name, page?.title, prettify(entry.slug));
    let [title, tagline] = splitTitle(fullName);
    if (entry.name) title = entry.name;
    if (entry.tagline != null) tagline = entry.tagline;

    const startUrl = m?.start_url ? new URL(m.start_url, manifestUrl).href : entry.base;
    const icon = entry.icon
      ? new URL(entry.icon, location.href).href
      : pickIcon(m, manifestUrl) || pageIcon(page, entry.base);

    return {
      url: entry.url || startUrl,
      title,
      tagline,
      description: first(entry.description, m?.description, meta('description')),
      theme: first(entry.theme, m?.theme_color, m?.background_color, meta('theme-color')),
      accent: entry.accent || '',
      icon: icon || '',
    };
  }

  function fallbackMeta(entry) {
    return {
      url: entry.url || entry.base,
      title: entry.name || prettify(entry.slug),
      tagline: entry.tagline || '',
      description: entry.description || '',
      theme: entry.theme || '',
      accent: entry.accent || '',
      icon: entry.icon ? new URL(entry.icon, location.href).href : '',
    };
  }

  /** Prefer a plain ("any") icon, then the smallest one that is still ≥192px. */
  function pickIcon(m, manifestUrl) {
    const icons = Array.isArray(m?.icons) ? m.icons.filter((i) => i && i.src) : [];
    const size = (i) => Math.max(0, ...String(i.sizes || '').split(/\s+/).map((s) => parseInt(s, 10) || 0));
    const special = (i) => (/maskable|monochrome/i.test(i.purpose || '') ? 1 : 0);
    const score = (i) => {
      const s = size(i);
      return s >= 192 ? s : 100000 - s;
    };
    icons.sort((a, b) => special(a) - special(b) || score(a) - score(b));
    return icons[0] ? new URL(icons[0].src, manifestUrl).href : '';
  }

  function pageIcon(page, base) {
    const link = page?.querySelector('link[rel="apple-touch-icon"], link[rel~="icon" i]');
    const href = link?.getAttribute('href');
    return href ? new URL(href, base).href : '';
  }

  const prettify = (slug) =>
    slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  /** "MAXGEAR — Gate Rush" -> ["MAXGEAR", "Gate Rush"] */
  function splitTitle(name) {
    const parts = name.split(/\s+[—–:-]\s+/);
    return parts.length > 1 ? [parts[0], parts.slice(1).join(' ')] : [name, ''];
  }

  // ---------------------------------------------------------------------------
  // Cards
  // ---------------------------------------------------------------------------

  function cardFor(game) {
    const card = tpl.content.firstElementChild.cloneNode(true);
    card.dataset.slug = game.slug;
    $('.play', card).addEventListener('click', () => play(game.slug));
    if (!game.resolved) Object.assign(game, fallbackMeta(game), { resolved: false });
    fill(card, game);
    return card;
  }

  function update(game) {
    fill(game.card, game);
  }

  function fill(card, g) {
    card.classList.toggle('pending', !g.resolved);
    card.style.setProperty('--theme', g.theme || '#141220');
    card.style.setProperty('--accent', g.accent || g.derivedAccent || hashedAccent(g.slug));

    $('.title', card).textContent = g.title;
    const tagline = $('.tagline', card);
    tagline.textContent = g.tagline || '';
    tagline.hidden = !g.tagline;
    $('.desc', card).textContent = g.description || '';
    $('.open', card).href = g.url;
    $('.play', card).setAttribute('aria-label', `Play ${g.title}`);

    const img = $('.icon', card);
    const mono = $('.monogram', card);
    if (g.icon) {
      if (img.dataset.src !== g.icon) {
        img.dataset.src = g.icon;
        loadIcon(img, g.icon, (loaded) => {
          if (g.accent) return;
          const accent = accentFrom(loaded);
          if (!accent) return;
          g.derivedAccent = accent;
          card.style.setProperty('--accent', accent);
          if (cached[g.slug]) {
            cached[g.slug].derivedAccent = accent;
            writeMetaCache(cached);
          }
        });
      }
      img.hidden = false;
      mono.hidden = true;
    } else {
      img.hidden = true;
      mono.hidden = false;
      mono.textContent = (g.title || '?').trim().charAt(0).toUpperCase();
    }
  }

  /**
   * Load with CORS first so the canvas may read its pixels for the accent
   * colour; if that fails (a host without CORS headers), load it plainly.
   */
  function loadIcon(img, src, onLoad) {
    img.crossOrigin = 'anonymous';
    img.onload = () => onLoad(img);
    img.onerror = () => {
      img.onerror = null;
      img.onload = null;
      img.removeAttribute('crossorigin');
      img.src = src;
    };
    img.src = src;
  }

  /** Saturation-weighted circular mean of the icon's hues, lifted to a neon. */
  function accentFrom(img) {
    try {
      const n = 24;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = n;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, n, n);
      const d = ctx.getImageData(0, 0, n, n).data;
      let x = 0, y = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const delta = max - min, l = (max + min) / 2;
        if (delta < 0.1) continue; // greys carry no hue
        const s = delta / (1 - Math.abs(2 * l - 1) || 1);
        let h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        h = ((h * 60) + 360) % 360;
        const weight = s * s * Math.max(0, 1 - Math.abs(l - 0.5) * 1.6);
        x += Math.cos((h * Math.PI) / 180) * weight;
        y += Math.sin((h * Math.PI) / 180) * weight;
        w += weight;
      }
      if (w < 0.4) return '';
      const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      return `hsl(${hue.toFixed(0)} 92% 64%)`;
    } catch {
      return '';
    }
  }

  function hashedAccent(slug) {
    let h = 0;
    for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 85% 62%)`;
  }

  /**
   * Same origin means navigator.serviceWorker.getRegistrations() lists every
   * game's worker too. A registered worker means the game has been opened
   * before and is cached for offline play.
   */
  async function markOfflineReady() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const scopes = regs.map((r) => r.scope);
      for (const g of games.values()) {
        const ready = scopes.some((s) => g.url.startsWith(s) && !location.href.startsWith(s));
        $('.badge', g.card).hidden = !ready;
      }
    } catch {
      /* not fatal */
    }
  }

  // ---------------------------------------------------------------------------
  // Player: the game runs in an iframe; the URL hash is the source of truth
  // so the back button (and Android's back gesture) leaves the game.
  // ---------------------------------------------------------------------------

  let dimTimer = 0;

  function play(slug) {
    if (hashSlug() === slug) return showPlayer(games.get(slug));
    history.pushState({ arcade: true }, '', `#play=${encodeURIComponent(slug)}`);
    showPlayer(games.get(slug));
  }

  function stop() {
    if (history.state?.arcade) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      hidePlayer();
    }
  }

  function showPlayer(game) {
    if (!game) return hidePlayer();
    const url = game.url || game.base;
    if (frame.src !== url) frame.src = url;
    frame.title = game.title;
    player.hidden = false;
    document.body.classList.add('playing');
    themeMeta.content = game.theme || ARCADE_THEME;
    document.title = `${game.title} · ARCADE`;
    wakePill();
    frame.addEventListener('load', () => frame.focus(), { once: true });
  }

  function hidePlayer() {
    if (player.hidden) return;
    frame.src = 'about:blank';
    player.hidden = true;
    document.body.classList.remove('playing');
    themeMeta.content = ARCADE_THEME;
    document.title = 'ARCADE';
  }

  function hashSlug() {
    const m = location.hash.match(/^#play=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function syncFromUrl() {
    const slug = hashSlug();
    if (slug && games.has(slug)) showPlayer(games.get(slug));
    else hidePlayer();
  }

  function wakePill() {
    pill.classList.remove('dim');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(() => pill.classList.add('dim'), 2500);
  }

  exitBtn.addEventListener('click', stop);
  pill.addEventListener('pointerenter', wakePill);
  pill.addEventListener('focusin', wakePill);
  window.addEventListener('popstate', syncFromUrl);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !player.hidden) stop();
  });

  // ---------------------------------------------------------------------------
  // Metadata cache
  // ---------------------------------------------------------------------------

  function readMetaCache() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function writeMetaCache(data) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(data));
    } catch {
      /* private mode, full, or disabled */
    }
  }

  // ---------------------------------------------------------------------------
  // Service worker: makes the launcher installable and available offline.
  // A new build is picked up on the NEXT visit; we never reload mid-game.
  // ---------------------------------------------------------------------------

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((reg) => reg.update().catch(() => {}))
        .catch((err) => console.warn('arcade: service worker failed', err));
    });
  }
})();
