# GOPHER CLOUD ARCADE

A proof of concept: the same games the 2D launcher lists, each on its own cloud
in an open sky. Jump twice to ride the cloud, fly to whichever machine you
fancy, land, and press play — the camera pushes into the cabinet's screen until
the real game grows out of it.

Live at `/arcade/cloudnine/`. The 2D grid at `/arcade/` is untouched and
remains the dependable launcher; this is the other way in.

## The sky

```
                    THE QUIET CLOUD  +10 m          swirls
                          (pergola, nothing in it)

   THE AQUARIUM  -2.5 m                    THE SPEEDWAY  +1.5 m
   fishtank, dam_break                     maxgear
   (glass tank, four stools)               (chevrons and barriers)

                    THE WELCOME CLOUD  0 m
                    arch, signpost, way out

                          THE OUTCROP  -5.5 m
                          supermine, supermine_adventure
                          (rock slung under the cloud, a headframe)
```

Every platform is 17 to 22 m from the welcome cloud — three or four seconds of
flight. Small on purpose: you can see all of them from where you arrive, so
finding a game is never the puzzle. The flying is the fun.

## What it does

- **Six machines, six real games.** `../games.json` is still the registry. A
  slug added there gets a machine wearing that game's own name on the marquee,
  its own icon on the CRT, and a neon tint derived from it. Which cloud it
  lands on is one line in `PLACEMENT`; anything unnamed takes the first free
  standing anywhere.
- **The cloud always comes back.** Walk off an edge and you fall for half a
  second — long enough to register as a mistake — and then the cloud is under
  you and you are flying. There is no damage, no reset and no way to get
  stuck, because this is a launcher and you should not be able to lose in one.
- **Signs, because a sky has no corridors.** A signpost on the welcome cloud
  with one arm per platform, each turned to point at the real thing, and a
  name board on every platform's mast big enough to read from where you
  started. Both are drawn at runtime, since only `games.json` knows what they
  should say.
- **The way out is a ring** on the welcome cloud rather than a door. Standing
  in it offers; pressing the key leaves. Walking through a doorway could be an
  accident.

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
a PLAY button that only exists while a machine is within reach. A gamepad
works too: left stick walks, right stick looks, A hops, X or B plays,
Start pauses.

## Running it

Nothing to build. Serve the hub and open the page:

```sh
cd ~/projects/games
python3 -m http.server 8000
# http://127.0.0.1:8000/arcade/cloudnine/
```

Games are resolved as siblings of `/arcade/` on whatever origin is serving the
page, so a locally served hub finds its locally served games and needs no
network beyond the first load of Babylon. `games.json`'s `origin` is the
fallback when nothing answers locally. See the header of `js/registry.js`.

Babylon.js comes from jsDelivr, pinned to 8.56.2 with an integrity hash — the
same pin fishtank ships, so a visitor who has played that already has the
bytes. There is no vendored copy, so **the first visit needs the network**; the
boot card says so plainly if the script never arrives. After that the service
worker at `/arcade/` has everything, and the models and theme live in its
unversioned runtime cache so a launcher release does not evict nine megabytes.

## How it is put together

| File | Owns |
| --- | --- |
| `js/main.js` | Phases, movement, collision, the camera, the coin |
| `js/room.js` | The building as a union of boxes, the floor plans, the moods |
| `js/cabinets.js` | One machine per game: tint, marquee, CRT art, floor mark |
| `js/gopher.js` | Two models, one pivot, and all the procedural animation |
| `js/launcher.js` | The handover from cabinet screen to running game |
| `js/registry.js` | `games.json` → titles, icons, colours, URLs |
| `js/controls.js` | Keyboard, touch stick, gamepad, all answering the same questions |
| `js/audio.js` | The room synthesized, plus the theme on its own bus |

Read the header of `js/room.js` before touching any coordinate. Blender is
Z-up and the glTF loader mirrors X, and the two together are the only thing
standing between you and a CLOUD NINE sign behind your head. Everything the
game added since is authored in game coordinates by `build_world.py` and
converted on the way out, so those numbers and room.js's are the same numbers.

### The world is platforms and one box

There is no navmesh and no physics engine, and since the walls went there is
barely a world model at all. `PLATFORMS` are rectangles at heights — the
highest one at or below you is the ground, and off the edge there is simply
nothing, which is what the cloud-catch exists to answer. `SKY` is a single box
you cannot leave.

That is it. The previous version of this file described nine interlocking
volumes, arches, a skylight, a stairwell, a ceiling height per room, a roof to
hide when the camera rose past it, and a routine that walked the volume union
to stop the chase camera filming from inside a wall. Every one of those
existed because flight had been bolted onto a place with walls. Making the sky
the level deleted all of them, and nothing replaced them.

### The one thing that is not real

You cannot texture an iframe onto a mesh — WebGL cannot sample a live
document, and no trick makes it possible. So the game is never *on* the model.
What happens instead is that the CRT's corners are projected from 3D into
screen pixels and the game's iframe is revealed through a `clip-path` matching
that rectangle, scaled down to fit it, then both animate away. The cabinet
screen becomes the game's screen becomes the whole screen, and the only thing
that moved was a clip. `js/launcher.js` explains the mechanics.

## Assets

Models come from `../assets/3d/`, which is a static kit with its own
[README](../assets/3d/README.md):

- `cloud-world.glb` — the whole sky: five platforms and their structures at
  final positions, built by `../assets/3d/source/build_clouds.py`
- `machine-classic.glb` — the one cabinet kind, stamped out of an
  `AssetContainer` with materials cloned so each machine can take its game's
  colour. The kit's racer and dance cabinets are not used: a seat and a floor
  pad each stick a metre and a half into a nine-metre platform.
- `gopher-scarf.glb`, `gopher-scarf-cloud.glb` — the player, in both forms

**The clouds are metaballs, not spheres.** This is the one place in the hub
where primitives were not good enough: scattered UV spheres read as a heap of
balls however many you use, because each keeps its own silhouette, and a flat
slab with spheres round the rim reads as a table with a doily. Metaball
elements merge into a single surface with soft saddles between the lobes,
which is what makes a thing look like cloud. Their radius has to exceed their
spacing or they never fuse — that is the whole trick, and getting it wrong
gives you the heap of lumps you were trying to avoid.

`audio/theme.m4a` is the room's theme, looped with `loopStart` set past the
decoder's priming silence so the seam is inaudible. It has its own switch in
the pause menu, separate from the room's synthesized sound, and it ducks
rather than restarts while a game has the machine.

## Installing it

It is a PWA in its own right: manifest, icons, and it registers the launcher's
own worker at `/arcade/` rather than a second one, so the grid and the sky
share one cache and one version number. Its manifest scope is `../` on purpose
— scoped to this directory, the WAY OUT ring would throw an installed player
out of the app and into a browser tab.

`display: fullscreen`, `orientation: landscape`. On a touch device held
upright you get a rotate prompt instead of a squeezed sky, and its button goes
fullscreen *and* pins landscape in one tap — a page may only pin its
orientation while fullscreen, which is why `js/screen.js` owns both. Where a
browser cannot pin, only the button's label changes; where there is no
fullscreen at all, both buttons hide and the prompt stands on its own.

The icon is the owner's drawing, at `icons/source/gopher-cloud.png`, with the
set derived from it by `tools/make-icons.py`.

## Known limits

These are honest, not oversights.

- **One online visit before it works offline**, because Babylon is not
  vendored and the models are 2.5 MB.
- **Nothing is merged.** About 400 meshes, world matrices frozen and picking
  off, one glow pass. Comfortable on a laptop and fine on a recent tablet; if
  it needs to be cheaper, merging each cabinet into one multi-material mesh is
  the next move, and the reason it was not done here is that the glTF loader's
  mirrored root makes `MergeMeshes` a coin toss on winding order.
- **The floor plans hold seventeen machines** across four rooms. Beyond that a
  game gets no cabinet. `SLOTS` in `js/room.js` is a floor plan, not a limit on
  the arcade.
- **Collision boxes are written by hand** to match `build_world.py`. Move a
  bench in one and it walks through you in the other. They are next to each
  other in both files and both say so, which is the best that a proof of
  concept gets without deriving them from the mesh.
- **The registry logic is duplicated** from `arcade.js` — about 70 lines. It is
  deliberate: `arcade.js` is a classic script on one IIFE and this is an ES
  module, so sharing means converting the working launcher. If this graduates,
  lift the resolver into one module and import it in both.
- **`Escape` only leaves a game when this page has focus**, which it usually
  does not once the game has loaded. The `◂ FLOOR` pill is the way out, and the
  back button works too.

## Playtest checklist

1. Title card shows over the room, camera drifting. **Walk in.**
2. Walk to a back-wall machine — the mark under you lights, the callout names
   the game, the gopher turns to face it and reaches up.
3. `E`. Coin drops, camera to the glass, the game appears **on the cabinet screen**,
   then opens out. Play it.
4. `◂ FLOOR`. The game shrinks back into the cabinet and the camera pulls out.
   The HUD is back, the URL hash is clear, no iframe is left behind.
5. Back button from inside a game leaves it the same way.
6. Jump, jump again — cloud. Fly over the machines. Land.
7. Walk down the stairs in the corner of the hall — the descent should be
   smooth, no hopping between treads. The mine: dark, warm, ore glowing on the
   walls.
8. Back up the stairs. Through the arch on the west side into the
   aquarium: teal light, a tank the length of the wall, four stools.
9. In the middle of the hall, take off and hold `Space`. Out through the
   skylight, over the roof, and forward to the cloud deck. The sky should be
   sky, not black.
10. Sound: the theme, plus blips from machines across the room — but only in
    the hall and the aquarium. Footsteps in time with the feet, the coin, the
    tube striking, the stairs underfoot. Both switches in the pause menu do
    what they say and survive a reload. There is no drone anywhere; if you
    hear a steady hum you are on a cached build, so reload.
11. Walk out of the entrance. The room dims and you are at `/arcade/`.
12. `#play=supermine` in the URL should land you straight in that game, which
    now means straight into the mine.
