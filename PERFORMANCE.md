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

## Lanes (2026-10-11) — one file, one owner

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

## Ratified

(Filled in as lanes report.)
