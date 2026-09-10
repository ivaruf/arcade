# CLOUD NINE — the arcade floor

A proof of concept: the same games the 2D launcher lists, in a building you
walk around as the scarf gopher. Walk up to a machine and press play, and the
camera pushes into the cabinet's screen until the real game grows out of it.

Live at `/arcade/cloudnine/`. The 2D grid at `/arcade/` is untouched and
remains the dependable launcher; this is the other door into the same room.

![the arcade floor](../assets/3d/previews/arcade-interior.png)

## Four floors

```
        ╔═══════════════════════╗
        ║  CLOUD DECK     +9m   ║  swirls — open sky, fly up to it
        ╚══════════╦════════════╝
                   ║  skylight
 ╔═════════════╗ ╔═╩═════════════════╗
 ║  AQUARIUM   ╠═╣  MAIN HALL    0m  ║  maxgear, the door to the street
 ║  fishtank   ║ ║                   ║
 ║  dam_break  ║ ╚═════════╦═════════╝
 ╚═════════════╝           ║  cage lift
        ╔══════════════════╩════╗
        ║  LOWER LEVEL    -5m   ║  supermine, supermine_adventure
        ╚═══════════════════════╝
```

Each space has its own light, its own air and its own sound. The mine is dark,
warm and fogged and lit mostly by its own ore; the aquarium is lit by the tank;
the cloud deck is bright, hazy and quiet, with no machines going off across the
room because that is not what it is for.

## What it does

- **Six cabinets, six real games.** `../games.json` is still the registry. A
  slug added there gets a machine, wearing that game's own name on the
  marquee, that game's own icon on the CRT, and a neon tint derived from it.
  Nothing is hardcoded per game. Which room it goes in is one line in
  `PLACEMENT`; anything not named there lands in the hall.
- **Ride the cage down.** Step into the lift in the corner of the hall, stand
  still for a beat, and it takes you to the mine. Step in when it is at the
  other end and it comes to you.
- **Fly up to the deck.** The middle of the hall's roof is open. Take off, rise
  through it, and the building drops away — the cloud deck is the only room
  with no other way in.
- **Play the machine.** `E` (or the on-screen PLAY button, or X on a pad) at a
  machine drops a coin, flies the camera to the glass, boots the tube, and then
  the game — the actual game, in an iframe — appears *on the cabinet screen* at
  cabinet size for a beat before it opens out to fill the viewport. Stepping
  away reverses the whole move.
- **Ride the cloud.** Jump, then jump again in the air, and the gopher swaps to
  the cloud-riding model and flies over the machines. Hold `Space` to rise,
  `Shift` to sink, touch the floor to land.
- **Walk out.** The entrance is a real exit: walk through it and you are back
  at the 2D launcher.

## Controls

| Input | On foot | On the cloud |
| --- | --- | --- |
| `W` `A` `S` `D` / arrows | Walk, relative to the camera | Fly |
| `Space` | Hop. Again in the air to take off | Hold to rise |
| `Shift` | Sprint | Hold to sink |
| `E` / `Enter` | Play the machine you are standing at | — |
| `Escape` | Pause; or leave a running game | Pause |
| Drag / wheel | Orbit / zoom | Same |

The lift needs no button: stand on the cage and wait. The cloud deck needs no
lift: it is up through the skylight and there is no other way.

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

### The world is a union of boxes

There is no navmesh and no physics engine. `VOLUMES` are boxes you may be
inside — the gaps between them are the walls — and `PLATFORMS` are rectangles
at a height, the highest one below you being the ground. That is the whole
model, and it is why none of the interesting bits needed special cases:

- an **archway** is a small box bridging two rooms;
- a **hole in the floor** is three rectangles that do not cover it;
- **falling through the skylight** into the hall is the ground query finding
  the hall floor because the roof rectangles have a gap;
- the **lift** is one extra platform whose height changes.

The camera uses the same union: it walks out along its own chase direction
until the sample leaves the boxes, and stops there. Rooms carry the chase
distance that suits them, so a 5 m camera in the hall becomes 3 m in the shaft
without anyone noticing it happen.

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

- `arcade-room.glb`, `arcade-ceiling.glb` — the building
- `machine-classic.glb`, `machine-racer.glb`, `machine-dance.glb` — the three
  cabinet kinds, cycled across the games and stamped out of one `AssetContainer`
  each with materials cloned so a per-cabinet tint is possible
- `machine-claw.glb` — prize machines, scenery only
- `gopher-scarf.glb`, `gopher-scarf-cloud.glb` — the player, in both forms
- `arcade-props.glb` — set dressing added for this game, built by
  `../assets/3d/source/build_extras.py`

`audio/theme.m4a` is the room's theme, looped with `loopStart` set past the
decoder's priming silence so the seam is inaudible. It has its own switch in
the pause menu, separate from the room's synthesized sound, and it ducks
rather than restarts while a game has the machine.

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
7. Stand in the cage in the corner of the hall. It should set off by itself
   after about half a second, ride down, and NOT immediately take you back up.
   Walk out into the mine: dark, warm, ore glowing on the walls.
8. Back in the cage, wait, ride up. Through the arch on the west side into the
   aquarium: teal light, a tank the length of the wall, four stools.
9. In the middle of the hall, take off and hold `Space`. Out through the
   skylight, over the roof, and forward to the cloud deck. The sky should be
   sky, not black.
10. Sound: the theme, plus blips from machines across the room — but only in
    the hall and the aquarium. Footsteps in time with the feet, the coin, the
    tube striking, the cage clanking off. Both switches in the pause menu do
    what they say and survive a reload. There is no drone anywhere; if you
    hear a steady hum you are on a cached build, so reload.
11. Walk out of the entrance. The room dims and you are at `/arcade/`.
12. `#play=supermine` in the URL should land you straight in that game, which
    now means straight into the mine.
