# Gopher Cloud Arcade — environment facelift

The active sky environment is `cloud-world.glb`. `cloud-world.blend` is the
editable scene; `previews/environment/` contains the overall view and close-ups.
The indoor room kit and all cabinet and gopher GLBs are unchanged.

## What changed

- Five closed, smoothly shaded cloud islands with broad landing surfaces,
  rounded contours and gradual color shading toward the underside.
- Arrival arch with layered signage, fitted post shoes, readable text,
  circular portal trim and slatted cedar benches.
- Arched conservatory with transparent roof panes, metal ribs and column bases.
- Clear aquarium with six original Fishtank fish: clownfish, blue tang,
  angelfish and royal gramma. Plants and driftwood also come from Fishtank.
- Braced timber mine headframe, spoked pulley, lantern cages and riveted cart
  with wheels, plus faceted rock under the island.
- Open cedar pergola, climbing greenery, fitted benches and subtle light strips.
- Raceway fasteners and rubber trim; beacon lights now sit on their masts.

The mine landing area is now 16 × 12 m. The headframe, rails and cart sit
3.5 m farther west and 1 m farther back, with matching collision positions.
Its beacon and perimeter lamps follow the enlarged island. Cabinet positions
and the other four platforms are unchanged. Decorative cloud contours extend beyond
playable rectangles. Fish meshes remain static in the GLB. `cloudnine/js/aquarium.js` supplies slow
swimming loops, light bobbing and fin movement at runtime. There is no feeding,
predation or Fishtank game simulation. Cabinet and gopher objects in the Blender scene are preview references;
they are not baked into `cloud-world.glb`.

## Rebuild

Run from `assets/3d`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_clouds.py
python3 source/check_environment.py
```

`build_clouds.py` builds the layout, then applies `source/polish_environment.py`
before export. The finishing pass reuses source GLBs under `source/fishtank/`;
it does not require access to the separate Fishtank checkout.

To regenerate the editable scene and five previews as well:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/render_environment.py
```

The GLB contains PBR materials and embedded resources. Clear aquarium panels and
roof panes use alpha blending. The cloud shading uses vertex colors, supported
by the existing Babylon glTF importer. Preview lighting is Blender-only; the
running game retains its existing lighting, camera, dynamic signs and screens.

## Fishtank source provenance

The GLBs under `source/fishtank/` are unchanged copies from:

- `games/fishtank/client/assets/models/`: `clownfish.glb`, `blue-tang.glb`,
  `angelfish.glb`, `royal-gramma.glb`.
- `games/fishtank/client/assets/scenery/`: `broadleaf-plant.glb`,
  `branching-driftwood.glb`.

The environment builder scales and poses these copies. The arcade animates
only the six named fish hierarchies, leaving the surrounding scenery static.

## In-game visual check

Fly between the islands and inspect landing surfaces near their edges. Check
that the aquarium fish remain visible through the glazing and that the dynamic
cabinet screens and signs are clear. Blender previews and GLB structure have
been checked; the final browser lighting and transparency should be playtested.

## Swimming check

The lightweight engine check uses the existing Babylon dependencies in Fishtank:

```sh
# From the arcade repository root:
node cloudnine/tools/check-aquarium.mjs ../fishtank/node_modules
```

It imports the real GLB into Babylon's NullEngine without materials and simulates
a minute of swimming, checking that every fish mesh remains within the tank.
This checks transforms and containment, not browser rendering.
