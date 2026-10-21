# Performance — smooth on old devices

The owner's bar, 2026-10-11: *"I need the arcade to run smooth as silk on
older devices as well."* This file is the contract for getting there and for
staying there: the budgets, how they are measured, and — while the work is in
flight — which agent owns which file. When a lane finds the plan wrong, the
answer is ratified here, not just fixed in code.

## Where it stands (measured 2026-10-10, HEAD 45d376b)

Headless Chrome on SwiftShader, 960×600, `file://`, vendored Babylon 8.56.2.
"CPU" is Babylon's per-frame CPU time (SceneInstrumentation) — draw-call
submission and active-mesh evaluation, the half that carries over to a real
device. SwiftShader's frame interval is fill cost on a CPU and only good for
comparisons.

| view | draw calls | active meshes | CPU ms |
|---|---|---|---|
| title (welcome cloud) | 870 | 332 | 6.7 |
| near NeonFox | 563 | 167 | 5.2 |
| near MiniMaze | 526 | 143 | 4.7 |
| near Zoodoku | 457 | 108 | 4.5 |
| overview (whole sky) | 2,213 | 1,022 | 12.8 |
| title at 75ae8ae (2026-10-02) | 770 | 291 | 4.9 |

Scene: 2,257 meshes, 756 materials, 980 meshes in the shadow caster list
(~170 enabled). Every frame spends ~2 ms just *evaluating* which of 2,257
meshes are active, before drawing anything. The glow layer draws every active
mesh a second time (it must — see quality.js on depth), so every draw call
counts twice. Per-module `animate()` JS is ~0.2 ms in total: **the cost is
meshes, materials and draw calls, not animation code.** The iPad 8 was earlier
confirmed fill-bound (ENVIRONMENT.md "A lighter sky"), so pixels matter too.

Biggest single items: five rebuilt island GLBs with one material per mesh
(~210 meshes that cannot merge); the pet companion machine (148 unfrozen
meshes, 208k triangles); the fox race (75 meshes, never culled trails, runs
unseen); nine identical take-home machines (15k triangles of brass each, not
instanced); ~730 hidden wardrobe accessory meshes built up front and all in the
shadow caster list; MiniMaze's 72 unmerged boxes; the NeonFox floor canvas
re-uploaded 24×/s from anywhere in the sky.

## Budgets (the definition of done)

Measured with the committed bench (below), lighter tier unless stated:

- **Title view ≤ 400 draw calls and ≤ 3.0 ms CPU.** Every island view ≤ 300
  draw calls. Overview ≤ 1,000.
- **Scene ≤ 900 meshes, ≤ 250 materials.** Shadow caster list = what can
  actually cast right now, nothing hidden in it.
- **Nothing animates, re-uploads or recomputes a world matrix while out of
  view or far away** (≳30 m, or outside the frustum).
- **No allocation per frame** in any `animate()`.
- On a real old device (the owner's iPad, `?perf=1`): steady 60 fps on the
  welcome cloud and while flying, with the adaptive resolution governor never
  dropping below 1.0× on that device. The owner judges this one.
- **No blocky shadows on any tier.** A player's own words, 2026-10-11: he
  does not like the "minecraft" shadow. The lighter tier gets its savings
  from texel density and cheap filtering, never from stair-stepped edges.
- **Looks the same.** Before/after screenshots of each view must match to the
  eye. A saving that changes the look is a design decision, and is asked.

## Measuring

- `tools/perf/` (lane D) — the headless bench, committed so every number above
  can be reproduced: builds a measurement copy of the tree with a probe
  injected, holds a lock so only one Chrome runs at a time, prints one line per
  view. Not a test suite and not run on commit; a measuring tape.
- `?perf=1` (lane D) — an on-device overlay: fps, frame ms, draw calls, active
  meshes, current resolution. This is how the owner measures the iPad, and it
  is the number that actually matters. Joins `?q=` and `?scale=` (quality.js).

## Lanes (2026-10-11, finished) — one file, one owner

| lane | owns |
|---|---|
| **A — island models** | `assets/3d/source/{lobbots_island,dam_island_v2,supermine_island_v2,adventure_island_v2,neonfox_island_v2}.py` and the `.glb`/`.blend` they emit |
| **B — moving parts** | `js/foxrace.js`, `js/neonfox.js`, `js/minimaze.js`, `js/zoodoku.js`, `js/aquarium.js`, `js/swirls.js`, `js/gears.js` |
| **C — machines & wardrobe** | `js/pets.js`, `js/wardrobe.js`, `js/gopher.js`, `js/customization.js`, `js/dispenser.js`, `js/cabinets.js`, `js/mailbox.js`, `js/parents.js`, `js/signs.js` |
| **D — pipeline & measurement** | `js/main.js`, `js/quality.js`, `js/room.js`, `js/launcher.js`, `tools/perf/*` |
| integrator | `PERFORMANCE.md`, `sw.js`, `js/version.js`, `README.md`, `assets/3d/ENVIRONMENT.md`, every `?v=` bump |

Need a change in a file you don't own? Put it in your report; the integrator
or the owning lane makes it. Nobody commits — the integrator commits per lane.
Nobody starts a server. Blender runs outside the sandbox. One headless Chrome
at a time: use the shared bench, which holds the lock.

## After the push (2026-10-11, d5a23dc)

`tools/perf/bench.sh`, lighter tier, 960×513, scale 1:

| view | draw calls | active | CPU ms | was |
|---|---|---|---|---|
| title | 490 | 233 | 3.07 | 870 / 6.7 |
| near NeonFox | 269 | 104 | 2.13 | 563 / 5.2 |
| near MiniMaze | 190 | 65 | 1.72 | 526 / 4.7 |
| near Zoodoku | 255 | 100 | 1.88 | 457 / 4.5 |
| mine / water / race | 334 / 319 / 319 | | ~2.1 | |
| overview | 1,204 | 668 | 5.31 | 2,213 / 12.8 |

Scene 2,257 → 917 meshes, 756 → 405 materials, 980 → 199 shadow casters
(all enabled). Still over budget: title draw calls (490/400), three island
views by up to 34, the overview, and materials — glow materials are the floor
of the island GLBs (one per glow colour), and the glow pass doubles every
draw. The next levers, if the owner's iPad says they are needed: an emissive
palette texture per island (breaks "0 textures"), merging near-identical glow
colours (a look change), or per-island culling (measured 0.2–0.3 ms here).

## Geometry Pong's court (2026-10-12)

The first island added after the push, built to the rules below from the
start (`js/geometrypong.js`). Same bench, same settings, before → after:

| view | draw calls | active | CPU ms |
|---|---|---|---|
| near Geometry Pong (new) | 192 | 68 | 1.77 |
| title | 487 → 495 | 233 → 237 | 3.12 → 3.30 |
| near Dam Break (below it) | 209 → 213 | 75 → 77 | 1.73 → 1.82 |
| overview | 1,177 → 1,223 | 656 → 681 | 5.09 → 5.16 |

Scene 914 → 966 meshes (the court's 40 still meshes merge to 8; the rest is its cabinet, take-home machine and sign), 402 → 418 materials.
Its still parts are one vertex-coloured matte plus one material per neon
colour; six paddles and two balls are the only movers, a ball's colour is a
material swap, and nothing casts. One thing worth keeping: its seal barriers
appear only on a goal, and built switched off their first frame cost a
~150 ms hitch (bench CPU mean 1.8 → 5.1 ms with goals forced), so they are
built switched on, hidden in the slab, and switched off once the court has
been drawn. Anything that appears on demand wants the same warm-up.

## HEIST's night bank (2026-10-21)

The second island built to the rules from the start (`js/heist.js`). Same
bench, same settings, before (3a1bf6a) → after (cf608f2):

| view | draw calls | active | CPU ms |
|---|---|---|---|
| near HEIST (new) | 292 | 120 | 1.95 |
| title | 495 → 495 | 237 → 237 | 2.87 → 2.81 |
| near the gyro hangar (below it) | 317 → 318 | 131 → 132 | 2.06 → 1.92 |
| overview | 1,236 → 1,269 | 688 → 723 | 4.22 → 4.30 |

Scene 966 → 1,014 meshes, 418 → 433 materials, shadow casters 211 → 226 (the
cabinet and take-home machine, as everywhere else; the island itself casts
nothing). The island is eleven meshes: some two hundred still pieces — street, kerbs,
bank, columns, windows, lasers, the thief on the roof — merge to five (one
vertex-coloured matte, four glow colours), and the movers are the vault door,
its dial, and the police car's body, headlights and two lamps. A lamp's flash
is a material swap to one unlit lens material. Its own view is under the 300
budget, but only just, and most of that is the neighbours in shot: the island
is 11 of the 120 active meshes, its cabinet and machine 29. The title view does
not see it. One look note: the gold behind the vault door was first the pale
window gold, and a two-metre disc of it bloomed to white; the loot is a deeper
mustard glow on a dark interior instead, which reads as gold and not as a lamp.

## Ratified

- **Islands carry flat colour as vertex colours (COLOR_0, linear)**, with
  four shading classes (matte, satin, metal, gloss) plus one material per glow
  colour. Glow reads one `emissiveColor` per material, so that is the floor.
  The class materials have main.js's metal clamp baked in.
- **Nothing animates unseen.** Every animated set asks `js/moving.js`
  `watch()` whether its fixed box is in the frustum and within ~30 m; rigid
  multi-part things fold with `foldRigid()` under their own pivots.
- **Wardrobe items are built on first wear** and are shadow casters only while
  worn. Folding is opt-in, because fishtank refits eyewear mesh by mesh.
- **Identical machines are instances**, not thin instances: thin instances
  share one bounding box, which would draw all nine machines from anywhere.
- **The shadow map follows the gopher** (20 m square, whole-texel steps,
  casters outside skipped). Distant take-home machines cast no shadow until
  approached. The full tier's shadow is crisper than before.
- **The lighter tier has a resolution governor** (1.25 → 0.75, hysteresis,
  ignores boot, dives and stalls) and trimmed PBR terms that only matter with
  an environment map. StandardMaterial was rejected: up to 83% of pixels
  changed.
- **Handing over to a game is a curtain**, not a clip-path zoom: the 3D loop
  stops, an opacity-only cover fades in, the iframe is built under it, and the
  cover lifts after load (launcher.js header).
- The fox race's roof is still a third alpha-blended material: it is the point
  of the roof. Owner's call.
