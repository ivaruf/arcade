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

Every game in the arcade has a quit of its own, in its own colours and its own
words. What they share is one line in the `<head>`:

```html
<script src="../arcade/exit.js" defer></script>
```

**`exit.js` draws nothing.** The button belongs to the game — a generic chip
dropped into six different games is the thing §2 of the hub rules warns about,
and an earlier version of this file did exactly that before being talked out of
it. What a game cannot work out for itself is what quitting should *do*, and
that is what the file is for.

It is a **classic script, not a module**, on purpose: a game loading it takes a
runtime dependency on this repo, and a failed fetch inside a module graph
aborts the whole graph. Deferred and classic, `/arcade/` being unreachable
costs the game its quit button and nothing else — which is why every game
checks for `window.ArcadeExit` before building one.

### The three ways a game is open

| how it was opened | what quit means |
| --- | --- |
| in the arcade | an iframe with the launcher behind it — hand the player back to the floor |
| installed | its own PWA window — close it |
| an ordinary tab | a script may not close it, so say so honestly |

`ArcadeExit.quit()` tells them apart and does the right one. It returns a
promise resolving to `'arcade'` or `'refused'`; there is deliberately no
`'closed'`, because if the window really closes the page stops existing and
nothing could observe it. So a game handles only the outcomes where it is still
alive to handle them.

`ArcadeExit.verb({ arcade, app, tab })` picks the label, so six games do not
each guess differently and none promises something that will not happen.

```js
if (window.ArcadeExit) {
  button.textContent = ArcadeExit.verb({ arcade: '◂ BACK TO THE ARCADE', app: '✕ CLOSE' });
  button.addEventListener('click', () => ArcadeExit.quit().then((how) => {
    if (how === 'refused') button.textContent = 'CLOSE THIS TAB YOURSELF';
  }));
}
```

`framed()`, `inArcade()`, `standalone()` and `leave()` are there too, for a
game wiring something more specific — `fishtank` uses `leave()` from the quit
it already had.

### The launcher pills are a fallback now

Both launchers still carry their own pill, but it starts `hidden`. After the
iframe loads, each asks the framed game whether it has `ArcadeExit` and shows
the pill **only if it does not**. In normal play the pill is gone, because the
game's own quit is better dressed and better worded than ours could be. But
`games.json` is open: a slug can be added whose repo has never heard of
`exit.js`, and a game with no way out and no pill is a trap rather than a worse
card.

### How leaving works

Each launcher publishes its own way out as `window.arcadeLeave`, and `leave()`
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

Where each game puts it, as of now: `supermine` and `supermine_adventure` in
the pause card under a hairline (the adventure arms it twice, like everything
else there that throws a run away); `dam_break` on the title and level screens,
so leaving is never three taps deep; `maxgear` on the title and pause menus;
`swirls` across the foot of the gear panel; `fishtank` in the pause menu it
already had.

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
