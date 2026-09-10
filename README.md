# ARCADE

A launcher for every game on `ivaruf.github.io`, hosted as one more GitHub
Pages site at **https://ivaruf.github.io/arcade/**. Static files only: no
build step, no dependencies. It is also an installable PWA that works offline.

There are two doors into the same set of games. This page is the grid, and it
is the dependable one. **[CLOUD NINE](cloudnine/)** at `/arcade/cloudnine/` is
a proof of concept of the other: an actual arcade floor you walk around as the
gopher, where each machine is one of these games and putting a coin in one
opens it out of the cabinet's screen. It has its own
[README](cloudnine/README.md); nothing about it changes how this page works.

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

## Giving a game its own way out

The launcher's "◂ ARCADE" pill lives outside the iframe, so a game that takes
fullscreen on one of its own elements paints over it — the fullscreen element
belongs to the top-level document and covers everything the arcade drew. A
player in a fullscreen game then has no way back but the browser's own gesture.

One line in the game's `<head>` fixes that, and does nothing at all when the
game is played standalone:

```html
<script src="../arcade/exit.js" defer></script>
```

It is a **classic script, not a module**, on purpose: a game loading it takes a
runtime dependency on this repo, and a failed fetch inside a module graph
aborts the whole graph. Deferred and classic, `/arcade/` being unreachable
costs the game a button and nothing else.

### Where it sits

A tab welded to the middle of the game's **left edge**, collapsed to an arrow
after saying its own name for a few seconds. That placement was measured, not
chosen: there is no free corner in this hub. Every game hangs its HUD off the
corners of one full-viewport `fixed` root, and in gameplay at 1280×800
`dam_break` occupies **all four** — level name top-left, budget top-right,
materials bottom-left, RELEASE WATER bottom-right. `supermine`'s top bar spans
1260 px, taking both top corners. The middle of the left edge is free in every
one of them, and it is also the direction "back" means.

### How leaving works

Each launcher publishes its own way out as `window.arcadeLeave`, and the tab
calls it. Both launchers are in this repository beside `exit.js`, so that is
one repo's contract rather than seven — and it has to be their function rather
than plain `history.back()`, because leaving is not one thing:

- arriving by PLAY, or by flying to a machine, **pushes** a `#play=<slug>`
  entry, and the way out is to unwind it so the pill, Escape and the back
  button all leave the same trail;
- arriving by **deep link** (`…/arcade/#play=swirls`) pushes nothing, so
  `history.back()` would take the player out of the arcade altogether — the
  opposite of what the button says. `stop()` in `arcade.js` and `leaveGame()`
  in `cloudnine/js/main.js` each check `history.state`, clear the hash where it
  stands and unload directly in that case.

`history.back()` remains the fallback. It is the older contract, and it is what
a launcher served from a cache older than `exit.js` still understands — the
shell and the games are cached by separate service workers, so an old launcher
framing a new game is a real state during a rollout.

A game with its own pause menu should put the item there instead and suppress
the default button:

```html
<script src="../arcade/exit.js" defer data-no-button></script>
```

`window.ArcadeExit` then offers `framed()`, `inArcade()` and `leave()`. It is
published whether or not the button is drawn, so the menu item can appear only
when there is an arcade to go back to. `fishtank` is the one game doing this
today: it already had a quit that knew it might be framed, so it passes
`data-no-button` and calls `ArcadeExit.leave()` from that.

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

Two caches, and the split matters: `arcade-shell-<VERSION>` holds this
launcher's own files plus the 3D floor's code, and is dropped on every version
bump. `arcade-runtime` holds the games' manifests and icons and anything heavy
in scope — the 3D floor's models and its theme — and survives version bumps,
so a stylesheet change does not re-download nine megabytes of gopher.

## Icons

`python3 tools/make-icons.py` regenerates this launcher's `icons/` — a motif
drawn procedurally, per §4 of the hub rules (needs Pillow).

`python3 cloudnine/tools/make-icons.py` regenerates the cloud arcade's, and is
the exception: its motif is the owner's drawing of the gopher on a cloud,
committed at `cloudnine/icons/source/gopher-cloud.png`. Pillow cannot draw
that, so the script crops, masks, pads and resizes instead. The icon set is
still reproducible from committed inputs by one command, which was the point of
the rule; the drawing-it-ourselves part was not.
