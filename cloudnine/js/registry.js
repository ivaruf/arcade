/* =============================================================================
 * registry.js — which machines stand on the floor, and what is on their screens.
 *
 * games.json is the arcade's registry and stays the registry: a slug added
 * there gets a cabinet here with no other change. Everything else about a game
 * is read at runtime from the game's OWN hosted files, exactly as the 2D
 * launcher does it (arcade.js):
 *
 *   1. <base>/manifest.webmanifest       name, description, theme colour, icons
 *   2. else the page itself               <link rel=manifest>, or one
 *                                         meta-refresh / canonical hop
 *                                         (fishtank lives at /fishtank/client/)
 *   3. else the slug, prettified          a worse cabinet, never a broken one
 *
 * This duplicates ~70 lines of arcade.js. That is deliberate for a proof of
 * concept — arcade.js is a classic script on one IIFE and this is an ES module,
 * so sharing means converting the working launcher. If the 3D floor graduates,
 * lift the resolver out of arcade.js into one module and import it in both.
 *
 * WHERE the games are is the one thing we resolve differently, and it is what
 * makes localhost work with no configuration. The games are siblings of
 * /arcade/, so from this page they are two levels up — true both on
 * ivaruf.github.io and under `python3 -m http.server` in ~/projects/games. We
 * try that first and fall back to games.json's `origin` only if nothing
 * answers there, which keeps a locally served floor entirely offline while a
 * page served from somewhere else still finds the live games.
 * ========================================================================== */

const CONFIG_URL = '../games.json';

/** Games are siblings of the arcade, which is our grandparent. */
const SIBLINGS = new URL('../../', location.href).href;

const first = (...vals) => vals.find((v) => typeof v === 'string' && v.trim())?.trim() ?? '';

const prettify = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** "MAXGEAR — Gate Rush" -> ["MAXGEAR", "Gate Rush"] */
function splitTitle(name) {
  const parts = name.split(/\s+[—–:-]\s+/);
  return parts.length > 1 ? [parts[0], parts.slice(1).join(' ')] : [name, ''];
}

async function fetchText(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function fetchJSON(url) {
  const text = await fetchText(url);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Read one game from one candidate base URL. Returns null when nothing at that
 * base answers at all, so the caller can try the next candidate.
 */
async function describeAt(entry, base, depth = 0) {
  let manifestUrl = new URL('manifest.webmanifest', base).href;
  let manifest = await fetchJSON(manifestUrl);
  let page = null;

  if (!manifest) {
    const html = await fetchText(base);
    if (!html) return null;
    page = new DOMParser().parseFromString(html, 'text/html');
    const link = page.querySelector('link[rel~="manifest" i]');
    if (link?.getAttribute('href')) {
      manifestUrl = new URL(link.getAttribute('href'), base).href;
      manifest = await fetchJSON(manifestUrl);
    } else if (depth < 2) {
      // A bare redirect page. Follow it once, like the 2D launcher does.
      const refresh = page.querySelector('meta[http-equiv="refresh" i]')?.getAttribute('content') || '';
      const target =
        refresh.match(/url\s*=\s*['"]?([^'";]+)/i)?.[1] ||
        page.querySelector('link[rel="canonical"]')?.getAttribute('href');
      if (target) {
        const next = new URL(target.trim(), base).href;
        if (next !== base) return describeAt(entry, next, depth + 1);
      }
    }
  }

  const meta = (name) => page?.querySelector(`meta[name="${name}" i]`)?.getAttribute('content');
  const fullName = first(manifest?.name, manifest?.short_name, page?.title, prettify(entry.slug));
  let [title, tagline] = splitTitle(fullName);
  if (entry.name) title = entry.name;
  if (entry.tagline != null) tagline = entry.tagline;

  return {
    slug: entry.slug,
    url: entry.url || (manifest?.start_url ? new URL(manifest.start_url, manifestUrl).href : base),
    title,
    tagline,
    description: first(entry.description, manifest?.description, meta('description')),
    theme: first(entry.theme, manifest?.theme_color, manifest?.background_color, meta('theme-color')),
    accent: entry.accent || '',
    icon: entry.icon
      ? new URL(entry.icon, location.href).href
      : pickIcon(manifest, manifestUrl) || pageIcon(page, base),
  };
}

/** Prefer a plain ("any") icon, then the smallest one that is still >= 192px. */
function pickIcon(manifest, manifestUrl) {
  const icons = Array.isArray(manifest?.icons) ? manifest.icons.filter((i) => i && i.src) : [];
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
  const href = page?.querySelector('link[rel="apple-touch-icon"], link[rel~="icon" i]')?.getAttribute('href');
  return href ? new URL(href, base).href : '';
}

function fallback(entry, base) {
  return {
    slug: entry.slug,
    url: entry.url || base,
    title: entry.name || prettify(entry.slug),
    tagline: entry.tagline || '',
    description: entry.description || '',
    theme: entry.theme || '',
    accent: entry.accent || '',
    icon: '',
  };
}

/**
 * The machines, in games.json order. Never rejects and never returns an empty
 * list for a reachable games.json: a game we cannot read still gets a cabinet
 * with a monogram screen, because an arcade with a dark machine in it is still
 * an arcade.
 */
export async function loadMachines() {
  const cfg = (await fetchJSON(CONFIG_URL)) || {};
  const configured = String(cfg.origin || location.origin).replace(/\/?$/, '/');
  const slugs = Array.isArray(cfg.games) ? cfg.games : [];

  return Promise.all(
    slugs.map(async (g) => {
      const entry = typeof g === 'string' ? { slug: g } : { ...g };
      if (!entry.slug) return null;
      const path = entry.path || `${entry.slug}/`;
      const candidates = [new URL(path, SIBLINGS).href, new URL(path, configured).href];
      for (const base of candidates) {
        const found = await describeAt(entry, base);
        if (found) return found;
      }
      console.warn(`[cloudnine] nothing answered for ${entry.slug}; dark cabinet`);
      return fallback(entry, candidates[0]);
    }),
  ).then((list) => list.filter(Boolean));
}
