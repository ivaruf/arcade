# The sky — how it is built, and what the runtime expects of it

`cloud-world.glb` is the environment the arcade loads. `cloud-world.blend` is
the editable scene, `previews/environment/` holds the renders, and everything
under `source/` is the script that produces all three. **The scripts are the
source of truth; the GLB and the .blend are outputs.** Edit the scene by hand
in Blender and the next rebuild discards it.

This file used to be a changelog and the log is still here, at the bottom. The
part above it is a contract instead, because islands are now built by several
agents in parallel and the expensive failures are not in anyone's island — they
are in the seams between the model and the four runtime files that read it by
name. Those seams break *silently*. Nothing throws, nothing logs, the gears
simply stop turning.

## The model as it stands

```
1,033 primitives   110 materials   495,436 triangles   13.1 MB
  979 mesh objects, of which 440 are distinct geometries
    0 reused through glTF instancing
  729 nodes flat under one root — no island grouping in the scene graph
```

Three of those numbers are the shape of the problem. **Nothing is instanced**,
so the 539 repeated shapes — one sphere appears 44 times, a cylinder 26 — each
ship their own vertex buffer and take their own draw call. **The graph is
flat**, so no island can be culled, streamed, unloaded or swapped for a cheaper
version, because nothing in the file knows which island anything belongs to.
And **it is one binary file**, which is the ownership problem below.

## Who owns what

A `.glb` and a `.blend` are binary. They do not merge, they do not diff, and a
conflict resolves by one side losing everything. `cloud-world.glb` was rewritten
in ten of the last ten commits that touched it, twice in one day by different
agents. So while the world is one file:

> **One agent builds the sky at a time.** Whoever holds it says so and the
> others keep off `source/`, the `.glb` and the `.blend` until they are done.

This is a lock, not a design, and it is the reason the world wants splitting per
island. A per-island file makes this rule unnecessary rather than enforced:
one island, one file, one owner, and a cache key that only invalidates the
island that actually changed.

Runtime ownership is already clean and should stay that way. `js/room.js` owns
the world container, the platforms and the blockers; `js/cabinets.js` owns
everything cabinet-shaped; `js/gears.js` and `js/aquarium.js` each own their
one animated set; `js/signs.js` owns sign faces; `js/quality.js` owns every
render-cost decision. If an island needs new runtime behaviour it gets its own
module beside `gears.js`, rather than a branch inside `room.js`.

## The seams — where the runtime reads the model by name

Every row here is a string in a `.py` file that must match a string in a `.js`
file. Rename either side and the feature quietly stops, with no error anywhere.
**Check this table before renaming anything in Blender.**

| Runtime | Matches in the model | If it stops matching |
|---|---|---|
| `js/gears.js:13` | transform nodes named `GearRotor <name>` | the gear stands still |
| `js/gears.js:3-9` | the five rotors: `Main flywheel`, `Companion cog`, `Perimeter gear 18`, `Perimeter gear 12`, `Perimeter gear 9` | that gear stands still |
| `js/aquarium.js:27` | `Fishtank (clownfish\|blue-tang\|angelfish\|royal-gramma) <n>` | the fish freeze in place |
| `js/aquarium.js:35` | descendants named `Tail` or `PectoralPivot` | the fish swims without moving its fins |
| `js/room.js:208` | mesh prefixes `Tank water`, `Stool seat`, `Cart ore`, `Pavilion rim`, `Pergola rim` | a broad surface blooms into a white slab |
| `js/cabinets.js:290` | `Marquee lettering*`, `Screen pixel*` — deleted at load | baked art fights the dynamic art on the same surface |
| `js/cabinets.js:306` | material `Screen glass*` | the model's glass and our screen glow through each other |
| `js/cabinets.js:297` | material prefix from `spec.accentMaterial` | the cabinet loses its per-game colour |

The aquarium's index matters as well as its name: `aquarium.js` parses the
trailing number out of the node name and uses it to offset each fish's swim
phase. Numbering fish `1..6` is part of the contract, not decoration.

## Invariants

Things that are true today, that the runtime depends on, and that a rebuild
must not quietly change.

- **Animated nodes keep a local pivot.** `gears.js` rotates about the rotor
  node's own origin and `aquarium.js` clones each fish's rest pose. A pivot
  baked to world origin sends the gear into orbit.
- **Cloud shading is vertex colours**, not textures. The GLB carries no images
  at all — 0 textures across every model in `assets/3d/`. That is worth
  protecting: it is why the palette can be tinted per game later, and it is why
  materials are cheap.
- **Cabinet and gopher objects in the .blend are preview references.** They are
  not exported. The runtime stands up its own from `machine-*.glb`.
- **Printed sign faces stay out of the glow layer**, or the lettering blooms
  into an unreadable smear.
- **Alpha blending is only on the two glazing materials** — `Clear aquarium
  glazing` and `Smoked pavilion glazing`. Transparent surfaces do not sort
  reliably against each other; adding a third is a decision, not a detail.
- **The glow layer keeps every mesh in the scene.** This one was learned the
  expensive way and is the easiest to undo by accident, so it has its own
  section below.

### Do not restrict the glow layer to emissive meshes

A `GlowLayer` renders the scene into its own texture to build the bloom, and
the obvious optimisation is to hand it only the ~60 meshes that have any
emissive at all rather than letting it walk all 1,033 to find them. That is a
real 90% cut in the pass. It also makes the neon shine straight through the
clouds.

The thousand other meshes are not waste. They render black into that texture,
but they still write **depth**, and depth is the only thing hiding a tube
behind a cloud. Name only the emissive ones and nothing occludes them any more:
the sky keeps its bloom and loses its solidity. It reads as a flicker, because
what comes through is the near-cabinet pulse in `cabinets.js:493`.

If that pass ever needs to be cheaper, the honest lever is `mainTextureRatio` —
fewer pixels in the glow texture, every occluder still in it. The reasoning is
repeated in `js/quality.js` next to where the code used to be.

## Collision is kept by hand, and that is the known debt

`js/room.js` carries `FURNITURE` (blocker boxes) and `BEACONS` (mast positions)
as literal coordinates, "kept by hand in step with build_clouds.py". Platform
bounds live there too. Nothing checks them. Move a boiler in Blender, forget the
matching box, and the gopher walks through it — or worse, stops dead in front
of nothing.

At five islands this is survivable and has already been got wrong more than
once. It does not survive one island per game, so **the island builder should
emit its own collision data** rather than expecting a human to mirror it.
Until it does, moving anything solid in a `.py` file means editing `room.js` in
the same commit, and the commit message should say so.

## Rebuild

From `assets/3d`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_clouds.py
python3 source/check_environment.py
```

`build_clouds.py` builds the layout, then applies the finishing passes —
`steampunk_island.py`, `dam_island.py`, `island_flooring.py` and
`polish_environment.py` — before export. The finishing pass reuses the GLBs
under `source/fishtank/` and needs no access to the fishtank checkout.

To regenerate the editable scene and the previews as well:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/render_environment.py
```

Add `-- --no-render` to rebuild the GLB and `.blend` without spending the time
on previews. Blender must run **outside the sandbox**; a sandboxed background
process crashes.

**A rebuild is a deploy.** The GLB is fetched with a `?v=` tag from
`js/room.js`, so a new model means a new tag *and* a `VERSION` bump in `sw.js`.
Forget either and players keep the old sky; at 13 MB, remember that everyone
re-downloads all of it for any change to any island.

## Checks

Both are cheap and neither is a browser:

```sh
python3 assets/3d/source/check_environment.py        # GLB structure
node tools/check-aquarium.mjs ../fishtank/node_modules
```

`check-aquarium.mjs` imports the real GLB into Babylon's `NullEngine` without
materials and simulates a minute of swimming, checking every fish stays inside
the tank. It checks transforms and containment, not rendering. Everything about
lighting, transparency and frame rate is a playtest, and most entries in the log
below say plainly that no playtest was run — keep that honesty.

## Where this is going

One island per game, generated rather than authored, because the arcade's best
property is the one `js/registry.js` states at the top: *a slug added to
games.json gets a cabinet here with no other change.* Hand-built islands would
make every new game a day of Blender work before anyone could play it.

Two things are settled and can be built against. **The world splits into a kit
plus per-island files**, which fixes ownership, cache invalidation and the flat
graph together. And **per-game identity comes from `cabinets.js:63` —
`hueFor()`**, which already tries the game's stated colour, rejects it when it
is not a real identity colour, and falls back to a hash of the slug. That
rejection matters: every hub game's `theme_color` today is a near-black chrome
colour, so manifest-driven theming alone would give thirty identical dark
islands.

Everything else — the archetype list, the layout format, how blockers are
emitted — gets written **here, once the kit exists** and there is real code to
describe. Writing it now would be inventing answers before anything is in front
of us, and the house rule is the other way round: ratify a decision into the
document once something real forces it.

## Provenance

The GLBs under `source/fishtank/` are unchanged copies from:

- `games/fishtank/client/assets/models/`: `clownfish.glb`, `blue-tang.glb`,
  `angelfish.glb`, `royal-gramma.glb`
- `games/fishtank/client/assets/scenery/`: `broadleaf-plant.glb`,
  `branching-driftwood.glb`

The builder scales and poses these copies. The arcade animates only the six
named fish hierarchies; the surrounding scenery stays static. There is no
feeding, predation or fishtank simulation here — these are display fish.

---

# History

Entries are in the order they were built. They record what changed and, where
it applies, that no playtest was run.

## Environment facelift

Five closed, smoothly shaded cloud islands with broad landing surfaces, rounded
contours and gradual colour shading toward the underside. Arrival arch with
layered signage, fitted post shoes, readable text, circular portal trim and
slatted cedar benches. Arched conservatory with transparent roof panes, metal
ribs and column bases. Clear aquarium with six Fishtank fish. Braced timber mine
headframe, spoked pulley, lantern cages and riveted cart with wheels, plus
faceted rock under the island. Open cedar pergola, climbing greenery, fitted
benches and subtle light strips. Raceway fasteners and rubber trim; beacon
lights on their masts.

The mine landing area is 16 × 12 m, with the headframe, rails and cart 3.5 m
farther west and 1 m farther back. Decorative cloud contours extend beyond the
playable rectangles. Fish meshes are static in the GLB; `js/aquarium.js` supplies
the swimming at runtime.

## Maxgear steamworks

The racing cloud became a copper-and-cedar steam workshop: riveted decking, a
banded boiler with pressure gauge and furnace grille, chimney, perimeter pipes
and valves, and exposed flywheels below the landing deck. Both cabinet positions
and the open central approach were preserved, and a boiler collision box added.
Built by `source/steampunk_island.py`. The preview PNGs predate it. No playtest.

## Sign refresh and arrival route

Island beacons got sharper textures, enamel faces, solid brass frames and
clearer typography, with multi-line titles where a name needs it. Cabinet
marquees got larger textures. Printed sign faces were excluded from the glow
layer.

The directional signpost on the welcome cloud is gone, geometry and runtime arms
alike: the four game islands now sit at the compass points around the welcome
cloud, so each is already in view on arrival and an arm pointing at it pointed
at something you could see. The across-the-path arch and hint panel became a
compact welcome board on the right edge at x=4.95, z=-3.25, and its footprint
replaced the old arch posts. No playtest, no preview regeneration.

## Flooring

All five playable islands got full flooring at their existing collision height:
limestone at arrival, oak in the steamworks, teal glazed tiles at the aquarium,
slate at the mine, cedar on the quiet terrace. Recessed joints, solid
foundations and metal edging define the landing areas; cloud billows stay
visible underneath. `source/island_flooring.py` runs at the end of the build and
groups floor pieces into shared meshes by material. No gameplay coordinates
changed. No playtest.

## Maxgear cabinet clearance

The boiler moved to the southwest corner and the piping on the eastern approach
was removed. Three large exposed brass gears and bearing supports sit at the
southern edge, with paired steam pistons beside the boiler, and collision bounds
followed. Cabinet locations and orientation unchanged. No playtest.

## Moving gears and rear signs

All five Maxgear gears got centred rotor nodes in the GLB, and `js/gears.js`
turns them slowly — adjacent gears in opposite directions, smaller gears faster.
Fixed axles, supports and the deck stay still.

All four game-island signs and their masts moved to the far edge relative to the
central welcome cloud, leaving each entrance open, with the faces still pointing
back at the hub. No playtest.

## Dam Break reservoir island

Dam Break got a dedicated northeast island at (18, 1, -18) with an 11 × 11 m
limestone landing area and its sign at the far edge. Enter from the southwest
and follow the western lane past the reservoir to the cabinet at (15, -20.3),
facing south along that lane. The diorama is centered at (20, -19.7), with its
collision bounds moved alongside it. Fishtank kept the aquarium island.

The miniature holds a concrete dam, raised reservoir, retaining banks, crown
walkway and handrail, three closed spillway gates, stepped buttresses, a lower
channel, stilling pool and control hut. The water is static scenery. Built by
`source/dam_island.py`; bounds, machine assignment, sign position and collision
are defined in `js/room.js`. No playtest.

## The way out is gone

The WAY OUT doorway on the welcome cloud — two posts, a lintel, the sign and the
portal rings in the floor — came out of `build_clouds.py` and
`polish_environment.py`. It closed an installed arcade, and a browser only lets
a page close a window whose session history holds a single entry, which the
first game played ends for the rest of the session. Nothing should point at a
spot that can do nothing, so the geometry went with the code. It never had a
collision box, so `js/room.js` lost only the `HOME` constant. No playtest.

## A lighter sky

`js/quality.js` arrived with two tiers over one scene, after the arcade ran
smooth on an S23 and choppy on an iPad 8. The geometry was not why: with no
textures anywhere, the cost is pixels shaded times lights reaching them. The
lighter tier renders at 1.25× rather than 2×, drops the two point lamps, and
filters the shadow with one tap instead of many. Touch starts there; the pause
menu overrides it live. Confirmed fillrate-bound on the iPad, which is the good
answer — the model's draw calls were not the limit.

A first attempt also restricted the glow layer to emissive meshes and was
reverted; see the invariant above.

## Scenery before the cabinet

Swirls sits at (0, 20), facing the northern entrance. Walk through the leafy
pergola and across the circular floor inlay before reaching the machine, with
the benches to either side and the sign behind it. Its old entrance slot is
removed. Both this cabinet and Dam Break retain standing space inside their
islands; the editable Blender scene includes their updated reference positions.
No playtesting or preview rendering was performed.

## Supermine Adventure outpost

Supermine keeps the original outcrop. Supermine Adventure has its own 12 × 12 m
slate-floored cloud at (20, -5.5, 18), with its own rear game sign. A level,
2.4 m wide timber bridge connects the outcrop’s south edge to the new island’s
north entrance. Its floor and continuous side rails have matching runtime
collision definitions; the two ends stay open.

Walk past the Cloud Mining Co. assay office and amethyst, copper ore and quartz
specimens to reach the Adventure cabinet at (22, 20.5), facing the bridge.
The scenic office has timber siding, a seamed gable roof, framed windows,
lanterns, a company nameboard and sample crates. Built in
`source/adventure_island.py`; the office is a solid decorative building.
The editable scene includes both games’ updated reference cabinets.
No playtesting or preview rendering was performed.

## Supermine working mine

`source/supermine_island.py` replaces the old headframe with a static 3D
interpretation of the upgraded machine in `supermine/js/vehicle.js`: tracked
gunmetal chassis, safety-yellow cab, cutting drum, twin spiral drill bits,
hydraulics, exhaust stacks, rear hopper and collector conveyor. A cut rock face
with gold seams sits ahead of the bits. Gold nuggets and bullion, emeralds and
purple crystal heaps, a loaded ore wagon and compact work lights dress the mine.

The rig is parked lengthwise along the north edge, centered at (17.5, -3.7),
with the cut face moved with its drill bits. Walk straight through the central
arrival lane to the cabinet, or turn south toward the Adventure bridge. Model footprints
and runtime collisions change together. Existing Adventure and other islands
are preserved. No playtesting or preview rendering was performed.

## Max-Gear gyro hangar

`source/maxgear_ship.py` adds a static 3D version of the gyro-wedge drawn in
`maxgear/js/player.js`: arrow hull, brass edging, domed porthole, eight-tooth
tail gyro, auxiliary barrels and cyan engine cores. Landing struts rest on
a lit maintenance dais in the southern half of the island. A diagnostics
console, alloy floor panels and thin perimeter conduits give the deck a
spacecraft-hangar finish while retaining the original moving gear machinery.

The north/east approach to the arcade remains clear. Display and console
colliders are kept in `js/room.js`; the unused second cabinet slot is removed.
No playtesting or preview rendering was performed.

## Living Swirls around the quiet cloud

`js/swirls.js` adapts Aurora Veil and Still Orbits from the actual Swirls
`effects.js`: matching mint/blue/violet and pink palettes, curling aurora
spines, elliptical orbit trails and slow precession. Three auroras and two
small constellations float outside the island perimeter, clear of the pergola,
entrance, rear sign and cabinet. These are decorative 3D adaptations rather
than the full canvas simulation.

The world update drives a fixed number of reusable meshes at 30 Hz; no new
textures, point lights, collision boxes or Blender export are required.
The module is precached with the arcade shell. No playtesting was performed.

## Welcome-cloud dressing station

`js/customization.js` builds the small Silly Stuff stand at (-3.5, 0, 1.8)
and the gopher's round pink sunglasses and top hat. Head-local accessories
are attached to both walking and flying forms. Two independent in-memory
booleans allow either item, both or neither; reloading resets both to off.
There is no storage, account or gameplay-stat change.

Approach the stand and press E / touch DRESS. A native modal provides live
toggles, a front camera view and Done / Escape exit, pausing movement while
open. The counter has a matching blocker and sits beside the starter path.
The station is runtime geometry; no Blender rebuild is needed. Accessory unit
checks and syntax checks passed. No playtesting was performed.

The dressing room now presents an eight-item inventory beside a dedicated live
camera viewport. Hat, sunglasses, monocle, mustache, bow tie, clown nose, gold
hoops and alien antennae can all be selected independently, including together.
Cards show selected states; rotate buttons inspect the result and Clear removes
every item. The camera viewport is restored on exit. Selection still lives only
in the current page. No playtesting.

## Dresser machine and equipment slots

The welcome station is now an enclosed Dresser machine with illuminated side
casings, a recessed mannequin display, a button deck and a named marquee. Its
blocker covers the full shell. Inventory images are rendered on demand from
the same meshes worn by the gopher, using a temporary shared preview renderer
that is disposed after its eight photos are cached in memory. No icon stand-ins.

Equipment enforces one item per slot in the gopher state: hat/antennae share
Head; sunglasses/monocle share Eyes; mustache, nose, bow tie and earrings use
Mouth, Nose, Neck and Ears. Selecting another item replaces the previous item
in that slot and updates both forms. Choices remain session-only.
No playtesting was performed.

The Dresser now sits at (-4.9, 0, 2.3), facing inward from the welcome cloud’s
west edge. Its shell has rounded pillars, eight chunky buttons, three levers,
twin needle gauges, a large adjustment dial, cooling fins, external brass
pipes and a ready beacon. Controls are decorative; the inventory interaction
is unchanged. The rotated collision box and approach point match the new
placement, leaving the central route and the nearby bench clear.

The Dresser and the worn accessories are PBR materials, like every prop the
GLBs bring in. They were StandardMaterials first and rendered pure white with
cyan fringes: the two intensity-34 point lamps are tuned for PBR's inverse-
square falloff, and StandardMaterial reads them through Babylon's linear range
falloff instead, which from the dresser's spot is 15-20x per lamp. Capping the
material at its first two lights (sky and sun) only held by creation order, so
the machine now simply speaks the world's material and is lit by all four
lights the way its neighbours are. Not playtested; `paint()` in
`js/customization.js` carries the reasoning.

## NeonFox island

NeonFox uses the published URL slug `neonfox`; its local source folder was
`trailblazers` when the display assets were imported. Its dedicated
12 × 12 m cloud at (-19, 2, -18) has a rear sign, alloy flooring and a
miniature neon trail arena on the north side. Two decorative riders use
the real fox/orb model from `trailblazers/models/fox-detailed.glb`, frozen
and simplified for display; the source copy lives under `source/neonfox/`.

`source/build_double_cabinet.py` makes `machine-double.glb` from the classic
cabinet with a double-width shared screen and two separate joystick/button
banks. Runtime screen size, standing/camera distance and footprint match
the wide shell. Its single entry launches NeonFox's existing game/lobby;
the game owns multiplayer. The southeast entrance and central route stay clear.
Rebuild the double cabinet before `render_environment.py`. No playtesting.

Fishtank also uses the double cabinet, with two control banks and a shared
screen. It keeps its aquarium-island position at (4, -21); the wider footprint
and standing distance leave the aquarium, stools and arrival route clear.
The Blender reference scene and generator use the matching double cabinet.

## NeonFox floor arena

The miniature display and fox riders are replaced by an open midnight-blue
12 × 12 grid across the whole island. `source/neonfox_island.py` supplies the
slab and static grid; `js/neonfox.js` overlays its surface 4 mm above collision
height with the game's grid styling and six player colors. Fading trails follow
smooth bounded paths at different speeds, drawn into one 768 px texture at
24 Hz. They remain in the floor, with no foxes or raised obstacles.
The old display collider is removed; the rear sign and double cabinet stay put.
The display is unlit and excluded individually from glow to preserve its dark
background under arcade lighting. No global glow filtering changes.
Blender outputs rebuilt without rendering; no playtesting.

The NeonFox display uses a black `emissiveColor`: StandardMaterial adds this
color to `emissiveTexture`, so white clips the entire floor to white even with
lighting disabled. The texture alone now supplies emission. No Blender rebuild
is needed for this material correction; no playtesting.
