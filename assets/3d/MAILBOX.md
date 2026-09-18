# Feedback mailbox

The model. `js/mailbox.js` is what stands it up on the welcome cloud, gives it
a blocker and a reach, and drives the two clips; it also owns the letter panel.
Message storage and networking are still nobody's: see `POST_TO` there.

- `mailbox.glb`: self-contained PBR model, default door closed / flag down.
- `mailbox.blend`: editable geometry, independent animation tracks and studio setup.
- `previews/mailbox.png`: studio preview with the flag raised; not the default pose.
- `source/build_mailbox.py`: reproducible generator.

Classic petrol-enamel arched shell, hollow interior, walnut post and braces,
brass opening rim, envelope plaque, latch handle, hinge pin, rivets and a red
mail indicator. No external textures or fonts are required.

Units are metres; origin is on the ground below the post. Approximately 0.8 m
wide, 1.1 m deep and 2 m tall with flag raised. Blender uses Z up and the door
faces -Y. glTF uses Y up, door +Z before an engine's handedness conversion.

## The clips, and how the arcade drives them

`MailFlagPivot` is the right-side indicator axle; local X rotation 0 is down,
+pi/2 is up. `MailFlagRaise` animates only this pivot over 0.8 seconds.
`MailboxDoorPivot` sits along the front lower hinge; `MailboxDoorOpen` rotates
only this pivot from closed to 90 degrees open over 0.8 seconds. Both clips
are independent. Play them once rather than looping; reverse for lowering or
closing, or drive the pivots directly. Do not auto-play all imported clips.

Both warnings are real. Babylon's glTF loader starts the first clip it finds on
import, so the door swings itself open on boot unless every group is stopped
and both pivots put back to identity by hand — stopping alone leaves them
wherever the clip had reached. Reversing is `start(false, 1, clip.to,
clip.from)`, measured rather than assumed: forward runs 0 to 90 degrees in
0.83 s and holds open, reversed it comes back to 0 and holds shut.

In the arcade the door follows the letter panel, open while you are writing and
shut when you step away, and the flag goes up only when a letter is actually
posted — where an unread-mail state would have gone, a posted-letter state went
instead. It stays up for the rest of the visit.

## Rebuild

From `assets/3d`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_mailbox.py -- --preview
```

The script writes `mailbox.glb`, `mailbox.blend` and optional `previews/mailbox.png`.
Studio lights/camera are in the .blend only, not the GLB. No game files change.
