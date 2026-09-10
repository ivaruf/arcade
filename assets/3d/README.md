# Cloud Nine — static arcade model kit

Editable scene: `arcade.blend`. Preview images: `previews/`.
All assets are geometry and materials only. No gameplay, collision logic,
input handlers, navigation, or animation clips are included.

## Files

| Asset | Contents |
| --- | --- |
| `arcade-environment.glb` | Room and eight placed arcade machines; no gophers or ceiling |
| `arcade-room.glb` | Room, floor, trim, sign and benches; no machines |
| `arcade-ceiling.glb` | Optional ceiling and light strips, aligned to the room origin |
| `machine-classic.glb` | STAR HOP cabinet, joystick and buttons |
| `machine-racer.glb` | CLOUD RALLY cabinet, steering wheel and seat |
| `machine-dance.glb` | MOON STEP cabinet and raised dance pad |
| `machine-claw.glb` | CLOUD CATCH open-frame prize machine with toys and claw |
| `gopher-scarf.glb` | Original grounded scarf gopher |
| `gopher-scarf-cloud.glb` | Original cloud-riding scarf gopher |
| `arcade-props.glb` | Set dressing added for the CLOUD NINE game: token machine, planters, bin, entrance mat, A-frame sign, wall posters, bunting, and the street outside the entrance. Placed at final room positions — load it at the origin |

Choose the assembled environment OR the room plus individual machines to avoid
loading overlapping geometry. Add the ceiling if needed. Gophers are included as
scale references in the Blender scene, and are supplied separately as unchanged
GLB copies from `games/shelved/so-long-ollie/assets/`.

## Dimensions and orientation

Units are meters, matching the existing gopher. The room floor is 18 × 14 m,
with its top at height 0. Walls are 5.5 m tall. Machines are about 1.1 m wide and
2.2 m tall (the dance pad and racing seat extend farther forward). The central
floor aisle is 4.2 m wide, with open space above the machines for cloud flight.
The entrance is centered on the front wall. Decorative pieces are separate,
named meshes so later work can choose collision and interaction targets.

Blender uses Z up, cabinet fronts point -Y. GLB exports use Y up, with cabinet
fronts pointing +Z in glTF coordinates. Individual machines have a floor-level
origin at their cabinet center; the room and assembled scene share a floor-level
origin in the middle of the room. Use the importer's normal handedness conversion.
Materials are self-contained PBR materials with emissive trim. Screen art and
lettering are static meshes: no image downloads or external textures.

The saved Blender scene uses a cutaway presentation: the near wall, entrance
returns and ceiling are hidden for rendering. The GLBs contain complete room
walls and an entrance opening. The ceiling is exported separately. Preview
lights and cameras are only in the Blender file; add lighting in a future game.

## Rebuild

From this directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_arcade.py
```

This overwrites generated arcade GLBs, the Blender scene and preview images.
It preserves and imports the two gopher GLBs if present. Gopher model source is
also included as `source/gopher_scarf.py`; the gopher GLBs are supplied in their
original rest poses. Scarf movement from the earlier game is runtime code and
is not baked into these model files.

The set dressing is a second, independent script:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_extras.py
```

It writes only `arcade-props.glb` and deliberately touches neither
`arcade.blend`, the previews, nor anything `build_arcade.py` produces, so the
two can be run in either order. Its pieces are placed at final room positions
and reuse this kit's material names and values, so nothing in it looks like it
came from a different room. The collision boxes for the four solid pieces are
written by hand in `cloudnine/js/room.js`; move something here and move it
there too.
