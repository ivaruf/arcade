# The take-home machine

A small machine that stands beside a cabinet and hands you a copy of the game
to keep. `js/dispenser.js` places it, gives it a reach and opens the card; this
file is the contract the model has to meet so it can drop in without a code
change.

**Until `dispenser.glb` exists, the arcade draws five boxes in its place** and
says so once in the console. Nothing is broken meanwhile, and nothing has to be
switched on when the model lands: the loader prefers the file if it is there.

## The file

```
assets/3d/dispenser.glb          shipped
assets/3d/dispenser.blend        editable, alongside it
assets/3d/source/build_dispenser.py   the source of truth, committed
assets/3d/previews/dispenser.png      optional studio render
```

Per the hub rules: the script is the truth and the `.glb` is its output, drawn
procedurally with no external textures or fonts, and exported with
`export_yup=True`, `use_selection=True`, `export_cameras=False`,
`export_lights=False` so studio lighting never leaks into the shipped model.

## Shape and orientation

- **Units are metres.** Origin on the ground, centred on the footprint.
- **Envelope: about 0.70 m wide, 0.80 m deep, 1.95 m tall.** The code's blocker
  is 0.70 × 0.80 and its top is 1.95; a model that outgrows that will be walked
  through at the corners. Smaller is fine, bigger needs a line changed in
  `dispenser.js`.
- **The front faces -Y in Blender**, which is +Z once glTF's Y-up conversion and
  Babylon's handedness are through with it — the same convention the mailbox
  uses, and the same one cabinets use ("a cabinet at yaw 0 faces +Z"). The
  arcade turns it to face the way the cabinet beside it faces.
- It stands on the neon arena platform beside the NeonFox double cabinet, so it
  is seen from the front and the two sides. The back may be plain.

## What it should read as

A cabinet's smaller sibling, in the same kit: petrol enamel, aged brass trim,
and one lit element. Not a vending machine full of crisps — something that
hands over a *copy*: a slot, a window with something waiting behind it, a
cartridge or a card or a little glowing disc.

Its neighbour is NeonFox, whose accent is `#39daf2`. A cyan tube or panel ties
the two together without the machine becoming NeonFox's own — it will stand
beside other cabinets later if the idea works.

## Animation, if any

None is required and the code plays none. If you author clips:

- Name them, keep each pivot local, and keep them independent.
- **Do not rely on auto-play.** Babylon's glTF loader starts the first clip it
  finds on import; `dispenser.js` stops every group as it lands, exactly as the
  mailbox does, so a clip only ever runs when something asks it to.
- Tell me the pivot and clip names and I will drive them: an obvious one is the
  slot lighting up or something dropping into the tray as the card opens.

## Rebuild

From `assets/3d`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_dispenser.py -- --preview
```

## Instancing

One model, possibly several machines. The loader keeps the container and stamps
a copy per machine (`instantiateModelsToScene`), so geometry and materials are
shared — author it once, at one level of detail, and do not duplicate it per
game.
