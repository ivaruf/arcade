# ARCADE

A launcher for every game on `ivaruf.github.io`, hosted as one more GitHub
Pages site at **https://ivaruf.github.io/arcade/**. Static files only: no
build step, no dependencies. It is also an installable PWA that works offline.

## How it finds the games

`games.json` is the only thing you edit. Everything shown on a card is read at
runtime from the game's own hosted files, in this order:

1. `https://ivaruf.github.io/<slug>/manifest.webmanifest`: name, description,
   theme colour, icons, start URL.
2. Otherwise the page at `/<slug>/`: its `<link rel="manifest">`, or a
   meta-refresh / canonical redirect that is followed once (this is how
   fishtank, which lives at `/fishtank/client/`, is found), or its `<title>`,
   `<meta name="description">`, `<meta name="theme-color">` and `<link rel="icon">`.
3. Otherwise the slug, prettified (`dam_break` becomes "Dam Break").

The card's glow colour is sampled from the game's icon. Resolved metadata is
kept in `localStorage`, so the second visit paints instantly and offline and
refreshes in the background.

### Adding a game

Add its Pages path to `games.json`:

```json
"games": ["fishtank", "swirls", "my_new_game"]
```

An entry can also be an object when the automatic answer is wrong:

```json
{ "slug": "my_new_game", "path": "my_new_game/dist/", "name": "Nicer Name",
  "tagline": "Short caps line", "description": "…", "theme": "#101820",
  "accent": "#ff3fa4", "icon": "https://…/icon.png", "url": "https://…/play/" }
```

Every field is optional except `slug`. `path` is where to look for the game
(relative to `origin`), `url` is what PLAY opens if different.

## One PWA opening another

PLAY opens the game **inside the arcade**, in a full-window iframe, with a
small "◂ ARCADE" pill to get back. This works because every game is on the
same origin as the arcade, so:

- the game's own service worker registers and serves it exactly as it would
  standalone, and an already-installed game plays offline inside the arcade;
- the game's `localStorage` and IndexedDB are the same ones it uses standalone,
  and the same ones the arcade sees. A future shared inventory (skins, items)
  can live in one namespaced key on this origin and be read by every game;
- fullscreen, gamepad, wake lock, pointer lock and motion sensors are delegated
  to the iframe through its `allow` attribute.

The URL hash (`#play=swirls`) is the source of truth for the player, so the
browser back button and Android's back gesture leave the game, Escape does
too, and `…/arcade/#play=swirls` deep-links straight into a game.

Two things do not cross the frame boundary: the game's own install prompt
(install it from its own page, via the ↗ button) and its manifest `display`
mode (the arcade's applies). The ↗ button opens the game on its own page; from
the installed arcade that is an in-app browser sheet on iOS and a Custom Tab
on Android, both with a way back.

Once a game has been opened, its card shows an **offline ready** badge:
`navigator.serviceWorker.getRegistrations()` lists every worker on the origin,
so the arcade can see which games are cached.

## Developing locally

```sh
python3 -m http.server 8123
# open http://localhost:8123/
```

The launcher fetches the games' manifests from the live site; GitHub Pages
sends `access-control-allow-origin: *`, so that works from localhost too. The
in-arcade player also works locally. The offline badges do not, because the
games' service workers live on the other origin.

## Deploying

Push to `main` and serve GitHub Pages from the root of the branch. Bump
`VERSION` in `sw.js` on every deploy: the shell is cached per version and old
versions are dropped when the new worker activates. A new build appears on
the visit after it is deployed; the page is never reloaded underneath a
running game.

## Icons

`python3 tools/make-icons.py` regenerates `icons/` (needs Pillow).
