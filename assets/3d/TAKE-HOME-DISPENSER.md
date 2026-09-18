# TAKE IT HOME cartridge dispenser

Standalone concept model, with teal enamel, satin brass, three display cartridges,
a house emblem, a chunky button and a delivery tray. **Wired up 2026-09-18** beside the NeonFox cabinet; see the section at the
bottom and `js/dispenser.js`. DISPENSER.md, which asked for a `dispenser.glb`
of different dimensions, has been deleted — this file is the model and this is
its name.

Files: `take-home-dispenser.glb`, editable `take-home-dispenser.blend`,
`source/build_take_home.py`, and `previews/take-home-dispenser.png`.
The source is procedural; text is converted to mesh before export. The build
uses a local system font with Blender's built-in font as fallback.

Units are metres, origin at ground level, approximately 0.72 m wide, 0.74 m deep
including the tray, and 1.25 m tall. Front is Blender -Y (glTF +Z); glTF exports
Y-up. Check the importing engine's handedness when placing it.

## Parts for future animation

- `TakeHomeDispenser`: whole model root.
- `InstallButtonPivot`: translate local Blender +Y slightly to press inward.
- `DeliveryFlapPivot`: rotate local Blender +X to swing the flap inward.
- `DispenseCartridgePivot`: tray cartridge; translate toward Blender -Y to
  dispense. Preserve its rest rotation (X = 90 degrees).
- `DisplayCartridge1`, `DisplayCartridge2`, `DisplayCartridge3`: separate display items.

Axes above describe the Blender source; account for Y-up conversion in runtime.
There are no baked animation clips. The material `Dispenser accent - recolor per game`
controls the mint accents. Glazing uses alpha blending. Studio lights and camera
are saved only in the Blender file, not exported to GLB.

## Rebuild

From `assets/3d`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_take_home.py -- --preview
```

Omit `--preview` to skip rendering. The GLB was checked for required pivots,
finite transforms and accessor bounds, embedded buffers, and absence of exported
cameras and animation clips. No game playtesting was performed.

## Wired up

`js/dispenser.js` places one of these on the neon arena at (-22, -21) facing the
way the NeonFox cabinet does, three metres along the wall from it so that E
never means "play" when somebody meant "take".

Measured off the GLB rather than taken from the prose above, because the code
has to agree with the file and not with a description of it: 0.720 wide, 0.746
deep, 1.242 tall, bounds x -0.36..0.36, y 0..1.242, z -0.300..0.445. The tray
puts the centre 7cm forward of the post, so the collision box is offset rather
than symmetric.

`Dispenser accent - recolor per game` does exactly what it says: the accent is
cloned per machine and painted the game's own colour, `#39daf2` for NeonFox.

**The pivots are driven from code**, since no clips ship. Directions were
measured on the imported file rather than derived from Blender's axes, because
the Y-up conversion and Babylon's mirrored `__root__` both sit in between:

| pivot | motion |
| --- | --- |
| `InstallButtonPivot` | local -Z 14mm and straight back out |
| `DeliveryFlapPivot` | rotate local X by +0.55 rad, which swings it inward |
| `DispenseCartridgePivot` | local +Z by 110mm, out into the tray; its 90-degree rest rotation is never touched |

Rest values are read off the nodes on first use, so nudging a pivot in the
source and rebuilding moves the animation with it rather than leaving it
animating from a number written down here.

The whole performance runs when the card opens and reverses when it shuts, so
the machine is never left standing open behind the player.
