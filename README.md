# GOPHER CLOUD ARCADE

**https://ivaruf.github.io/arcade/** — one launcher for every game on the hub,
and it is a place rather than a page. Each game is a machine on its own cloud
in an open sky. Jump twice to ride the cloud, fly to whichever machine you
fancy, land, and press play: the camera pushes into the cabinet's screen until
the real game grows out of it.

Static files only — no build step, no dependencies, no backend. It is also an
installable PWA.

There used to be two doors: a grid of cards here and the sky one level down at
`/arcade/cloudnine/`. There is one door now. The grid is deleted and the sky
moved up; `/arcade/cloudnine/` is a redirect so old links still land.

## The sky

```
                       THE STEAMWORKS  +1.5 m
                       maxgear
                       (brass, rivets and steam)

  THE AQUARIUM  -2.5 m     THE WELCOME CLOUD  0 m      THE OUTCROP  -5.5 m
  fishtank, dam_break      arch, benches, the ring     supermine ×2
  (glass tank, stools)                                 (rock and a headframe)

                       THE QUIET CLOUD  +10 m
                       swirls
                       (pergola, nothing in it)
```

One island per side, ringing the cloud you arrive on, 18 to 19 m out — three
or four seconds of flight. That arrangement is the wayfinding: every game is
in view from where you land and none of them is behind you. The heights stay
uneven on purpose, so getting anywhere is a flight rather than a walk in a
straight line.

## What it does

- **Six machines, six real games.** `games.json` is the registry. A slug added
  there gets a machine wearing that game's own name on the marquee, its own
  icon on the CRT, and a neon tint derived from it. Which cloud it lands on is
  one line in `PLACEMENT`; anything unnamed takes the first free standing.
- **The cloud always comes back.** Walk off an edge and you fall for half a
  second — long enough to register as a mistake — and then the cloud is under
  you and you are flying. No damage, no reset, no way to get stuck, because
  this is a launcher and you should not be able to lose in one.
- **A name board on every platform's mast**, big enough to read from the
  welcome cloud and in that platform's own colour. Drawn at runtime, since only
  `games.json` knows what it should say. There used to be a signpost in the
  middle of the arrival island too, with an arm pointing at each platform; the
  islands ring the hub now, so it was pointing at things already in view.

## How it finds the games

`games.json` is the only thing you edit. Everything on a machine is read at
runtime from the game's own hosted files, in this order:

1. `<base>/manifest.webmanifest` — name, description, theme colour, icons.
2. Otherwise the page at `<base>/`: its `<link rel="manifest">`, or a
   meta-refresh / canonical redirect followed once (this is how fishtank,
   which lives at `/fishtank/client/`, is found), or its `<title>` and
   `<meta name="description">` / `theme-color`.
3. Otherwise the slug, prettified (`dam_break` becomes "Dam Break").

It degrades at every step, so a missing field gives a worse machine, never a
broken one. A game with no resolvable icon still gets a cabinet.

**Where** the games are is resolved differently, and it is what makes
localhost work with no configuration: they are siblings of `/arcade/`, so one
level up from this page — true both on `ivaruf.github.io` and under
`python3 -m http.server` in `~/projects/games`. That is tried first, and
`games.json`'s `origin` is the fallback when nothing answers locally.

### Adding a game

```json
"games": ["fishtank", "swirls", "my_new_game"]
```

An entry can be an object when the automatic answer is wrong:

```json
{ "slug": "my_new_game", "path": "my_new_game/dist/", "name": "Nicer Name",
  "tagline": "Short caps line", "description": "…", "theme": "#101820",
  "accent": "#ff3fa4", "icon": "https://…/icon.png", "url": "https://…/play/" }
```

Every field is optional except `slug`.

## One PWA opening another

A machine opens its game **inside the arcade**, in a same-origin iframe, so:

- the game's own service worker registers and serves it exactly as it would
  standalone, and an already-installed game plays offline in here;
- its `localStorage` and IndexedDB are the same ones it uses standalone, and
  the same ones the arcade sees — a future shared inventory can live in one
  namespaced key on this origin and be read by every game;
- fullscreen, gamepad, wake lock, pointer lock and motion sensors are
  delegated through the iframe's `allow` attribute.

`#play=<slug>` is the source of truth, so the back button and Android's back
gesture leave a game, and `…/arcade/#play=swirls` deep-links straight into one.

What does not cross the frame: the game's own install prompt, and its manifest
`display` mode (the arcade's applies).

## Every game's own way out

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
| in the arcade | an iframe with the launcher behind it — hand the player back to the sky |
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

`framed()`, `inArcade()`, `standalone()` and `leave()` are there too. The
arcade loads `exit.js` itself for `standalone()` alone: an installed window can
be closed and a tab cannot, and that is what decides whether the way-out ring
on the welcome cloud exists at all.

Where each game puts its button: `supermine` and `supermine_adventure` in the
pause card under a hairline (the adventure arms it twice, like everything there
that throws a run away); `dam_break` on the title and level screens;
`maxgear` on the title and pause menus; `swirls` across the foot of the gear
panel; `fishtank` in the pause menu it already had.

### The FLOOR pill is a fallback

The launcher still carries its own `◂ FLOOR` pill, but it starts `hidden`.
After the iframe loads, the launcher asks the framed game whether it has
`ArcadeExit` and shows the pill **only if it does not**. In normal play the
pill is gone, because the game's own quit is better dressed and better worded
than ours could be. But `games.json` is open: a slug can be added whose repo
has never heard of `exit.js`, and a game with no way out and no pill is a trap
rather than a worse card.

### How leaving works

The launcher publishes its own way out as `window.arcadeLeave`, and `leave()`
calls it. Both live in this repository, so that is one repo's contract rather
than seven — and it has to be the launcher's function rather than plain
`history.back()`, because leaving is not one thing:

- arriving by flying to a machine **pushes** a `#play=<slug>` entry, and the
  way out is to unwind it so the back button, Escape and the game's own quit
  all leave the same trail;
- arriving by **deep link** pushes nothing, and `history.back()` would take the
  player out of the arcade altogether. `leaveGame()` in `js/main.js` checks
  `history.state`, clears the hash where it stands, and unloads directly.

`history.back()` remains the fallback, for a launcher served from a cache older
than `exit.js` — the shell and the games are cached by separate workers, so an
old launcher framing a new game is a real state during a rollout.

## Controls

| Input | On a cloud | In the air |
| --- | --- | --- |
| `W` `A` `S` `D` / arrows | Walk, relative to the camera | Fly |
| `Space` | Hop. Again in the air to take off | Hold to rise |
| `Shift` | Sprint | Hold to sink |
| `E` / `Enter` | Play the machine you are standing at | — |
| `Escape` | Pause; or leave a running game | Pause |
| Drag / wheel | Orbit / zoom | Same |

Flying is the only way between platforms, which is the point. Landing is the
only way to play a machine, which is why walking still matters.

Touch gets a floating stick on the left half, hop and sprint on the right, and
a PLAY button that only exists while a machine is within reach. A gamepad works
too: left stick walks, right stick looks, A hops, X or B plays, Start pauses.

## Running it

Nothing to build. Serve the hub and open the page:

```sh
cd ~/projects/games
python3 -m http.server 8000
# http://127.0.0.1:8000/arcade/
```

Babylon.js comes from jsDelivr, pinned to 8.56.2 with an integrity hash — the
same pin fishtank ships, so a visitor who has played that already has the
bytes. There is no vendored copy, so **the first visit needs the network**; the
boot card says so plainly if the script never arrives.

## How it is put together

| File | Owns |
| --- | --- |
| `js/main.js` | Phases, movement, collision, the camera, the coin |
| `js/room.js` | The platforms, the sky box, the placements, the mood |
| `js/cabinets.js` | One machine per game: tint, marquee, CRT art, floor mark |
| `js/gopher.js` | Two models, one pivot, and all the procedural animation |
| `js/launcher.js` | The handover from cabinet screen to running game |
| `js/registry.js` | `games.json` → titles, icons, colours, URLs |
| `js/signs.js` | Each platform's name board |
| `js/controls.js` | Keyboard, touch stick, gamepad, all answering the same questions |
| `js/audio.js` | The sky synthesized, plus the theme on its own bus |
| `js/screen.js` | Fullscreen, the landscape lock, and the worker registration |
| `js/aquarium.js` | The fish in the tank |

Read the header of `js/room.js` before touching any coordinate. Blender is Z-up
and the glTF loader mirrors X, and the two together are the only thing standing
between you and a sign facing backwards. Everything is authored in game
coordinates by `assets/3d/source/build_clouds.py` and converted on the way out,
so those numbers and `room.js`'s are the same numbers.

### The world is platforms and one box

There is no navmesh and no physics engine. `PLATFORMS` are rectangles at
heights — the highest one at or below you is the ground, and off the edge there
is simply nothing, which is what the cloud-catch exists to answer. `SKY` is a
single box you cannot leave. That is the whole world model.

An earlier version of this file described nine interlocking volumes, arches, a
skylight, a stairwell, a ceiling height per room and a roof to hide when the
camera rose past it. Every one existed because flight had been bolted onto a
place with walls. Making the sky the level deleted all of them.

### The one thing that is not real

You cannot texture an iframe onto a mesh — WebGL cannot sample a live document,
and no trick makes it possible. So the game is never *on* the model. The CRT's
corners are projected from 3D into screen pixels and the game's iframe is
revealed through a `clip-path` matching that rectangle, scaled down to fit it,
then both animate away. The cabinet screen becomes the game's screen becomes
the whole screen, and the only thing that moved was a clip. `js/launcher.js`
explains the mechanics.

## Assets

Models come from `assets/3d/`, which is a static kit with its own
[README](assets/3d/README.md):

- `cloud-world.glb` — the whole sky: five platforms and their structures at
  final positions, built by `assets/3d/source/build_clouds.py`
- `machine-classic.glb` — the one cabinet kind, stamped out of an
  `AssetContainer` with materials cloned so each machine takes its game's
  colour. The kit's racer and dance cabinets are not used: a seat and a floor
  pad each stick a metre and a half into a nine-metre platform.
- `gopher-scarf.glb`, `gopher-scarf-cloud.glb` — the player, in both forms

**The clouds are metaballs, not spheres.** This is the one place in the hub
where primitives were not good enough: scattered UV spheres read as a heap of
balls however many you use, because each keeps its own silhouette, and a flat
slab with spheres round the rim reads as a table with a doily. Metaball
elements merge into a single surface with soft saddles between the lobes, which
is what makes a thing look like cloud. Their radius has to exceed their spacing
or they never fuse — that is the whole trick.

`audio/theme.m4a` is the theme, looped with `loopStart` set past the decoder's
priming silence so the seam is inaudible. It has its own switch in the pause
menu, separate from the synthesized sound, and it ducks rather than restarts
while a game has the machine.

## Installing it

Manifest, icons, and one service worker at `/arcade/`. `display: fullscreen`,
`orientation: landscape`. On a touch device held upright you get a rotate
prompt instead of a squeezed sky, and its button goes fullscreen *and* pins
landscape in one tap — a page may only pin its orientation while fullscreen,
which is why `js/screen.js` owns both. Where a browser cannot pin, only the
button's label changes; where there is no fullscreen at all, both buttons hide
and the prompt stands on its own.

Installed, the way-out ring on the welcome cloud closes the app. In a tab there
is nothing a script may close, so the ring is not there at all.

## Deploying

Push to `main`; Pages serves the root of the branch. **Bump `VERSION` in
`sw.js` on every deploy** and keep the one-line comment describing the release.

Two caches, and the split matters: `arcade-shell-<VERSION>` holds the page, its
modules, its stylesheet and its icons, and is dropped on every bump.
`arcade-runtime` holds the games' manifests and icons and everything heavy in
scope — the models, the theme, Babylon — and survives bumps, so a stylesheet
change does not re-download nine megabytes of gopher.

Both are stale-while-revalidate: answer from cache at once, refresh in the
background. A new build appears on the visit *after* it is deployed, and the
page is never reloaded underneath a running game.

## Icons

```sh
python3 tools/make-icons.py
```

The motif is the owner's drawing of the gopher on a cloud, committed at
`icons/source/gopher-cloud.png`, and the script crops, masks, pads and resizes
rather than drawing. That is a deliberate exception to §4 of the hub rules: the
icon set is still reproducible from committed inputs by one command, which was
the point of the rule; Pillow drawing it was not.

## Known limits

These are honest, not oversights.

- **One online visit before it works offline**, because Babylon is not vendored
  and the models are 2.5 MB. This matters more than it used to: there is no
  longer a lightweight grid to fall back to, so a device that cannot reach
  jsDelivr, or cannot run WebGL, cannot reach the games from here at all.
- **Nothing is merged.** About 400 meshes, world matrices frozen and picking
  off, one glow pass. Comfortable on a laptop and fine on a recent tablet; if it
  needs to be cheaper, merging each cabinet into one multi-material mesh is the
  next move, and the reason it was not done is that the glTF loader's mirrored
  root makes `MergeMeshes` a coin toss on winding order.
- **`SLOTS` in `js/room.js` is a floor plan, not a limit on the arcade.** It
  holds two machines per platform; beyond that a game gets no cabinet.
- **Collision boxes are written by hand** to match `build_clouds.py`. Move a
  bench in one and it walks through you in the other. They sit next to each
  other in both files and both say so.
- **`Escape` only leaves a game when this page has focus**, which it usually
  does not once the game has loaded. The game's own quit is the way out, and
  the back button works too.

## Playtest checklist

1. Title card over the sky, camera drifting. **Walk in.**
2. Turn a full circle on the welcome cloud: all four islands should be in
   view, one per side, each with its name board readable from here.
3. Jump, jump again — the cloud comes under you and you are flying. Walk off an
   edge instead: you fall for about half a second and it catches you.
4. Fly to a machine and land. The mark under you lights, the callout names the
   game, the gopher turns to face it.
5. `E`. Coin drops, camera to the glass, the game appears **on the cabinet
   screen**, then opens out. Play it.
6. Quit from inside the game, using the game's own button. It shrinks back into
   the cabinet, the HUD returns, the URL hash is clear and no iframe is left.
   No `◂ FLOOR` pill should have been on screen while it was running.
7. Back button from inside a game leaves it the same way.
8. `…/arcade/#play=supermine` lands straight in that game; quitting puts you at
   the outcrop rather than throwing you out of the arcade.
9. On a phone: drag anywhere to look around. No text selection, no magnifier.
   Held upright you get the rotate prompt; its button goes fullscreen and turns
   the sky in one tap.
10. Sound: the theme, plus blips from machines near you. Both switches in the
    pause menu do what they say and survive a reload.
11. `…/arcade/cloudnine/` still arrives here.
