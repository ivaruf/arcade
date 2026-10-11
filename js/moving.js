/**
 * moving.js — two small tools for the sky's moving parts.
 *
 * Written for the performance push of 2026-10-11 (PERFORMANCE.md, lane B),
 * because the same two questions came up in seven files and the answers had
 * started to drift.
 *
 * `watch()` asks whether something is worth moving this frame. The budget is
 * blunt: nothing animates, re-uploads or recomputes a world matrix while it
 * is out of view or far away. Every animated set in the sky stands inside a
 * box that never moves (an island, a roof, a tank), so the test is one
 * distance and one frustum check against that fixed box: no bounding info of
 * a moving mesh is read, so a trail whose buffer is rewritten every frame is
 * asked about the same way as a gear. It allocates nothing per call.
 *
 * `foldRigid()` folds a group of flat-coloured parts that move as one into a
 * single draw call. The models carry no textures at all (ENVIRONMENT.md,
 * "Cloud shading is vertex colours"), so a fish that is six materials is six
 * colours: write each part's colour into its own vertices, give the group one
 * shared material, merge, and parent the result back under the node that
 * moves it. The pivot is untouched, so the animation does not notice
 * (ENVIRONMENT.md: animated nodes keep a local pivot).
 *
 * Neither is a framework. If a third question turns up, it probably belongs
 * in the file that asks it.
 */

/** Beyond this, a moving part is scenery: the budget's "≳30 m". */
export const FAR = 30;

/**
 * A test for one fixed world-space box, `lo`..`hi` ([x, y, z] each).
 * Returns `seen()`: true while the active camera is within `range` of the box
 * (nearest point, not centre, so a long roof is judged by its near end) and
 * the box is at least partly inside the frustum.
 *
 * WHY THE FRUSTUM IS OUR OWN. scene.frustumPlanes is rewritten whenever a
 * render target sets its own transform (the shadow map renders from the sun),
 * so what it holds between frames depends on render order. Six planes from
 * the camera's own cached view-projection cost next to nothing and are always
 * the camera's.
 *
 * `seen.distance` is left holding the camera's distance to the box from the
 * last call, for a caller that also wants to do less at range (neonfox.js
 * repaints its floor less often across the arena than standing on it).
 *
 * `hold` adds hysteresis to the distance: once seen, a part stays seen until
 * the camera is `hold` metres beyond `range`, so something that hides when far
 * does not flicker in and out on the line.
 */
export function watch(scene, lo, hi, { range = FAR, hold = 2 } = {}) {
  const B = BABYLON;
  const info = new B.BoundingInfo(new B.Vector3(...lo), new B.Vector3(...hi));
  const planes = Array.from({ length: 6 }, () => new B.Plane(0, 0, 0, 0));
  let was = true;
  function seen() {
    const cam = scene.activeCamera;
    // Before the first frame there is nothing to save, and a pose still has
    // to be set (tools/check-aquarium.mjs animates a scene it never renders).
    if (!cam || scene.getRenderId() === 0) return true;
    const p = cam.globalPosition;
    const dx = Math.max(lo[0] - p.x, 0, p.x - hi[0]);
    const dy = Math.max(lo[1] - p.y, 0, p.y - hi[1]);
    const dz = Math.max(lo[2] - p.z, 0, p.z - hi[2]);
    const r = range + (was ? hold : 0);
    const d2 = dx * dx + dy * dy + dz * dz;
    seen.distance = Math.sqrt(d2);
    if (d2 > r * r) return (was = false);
    B.Frustum.GetPlanesToRef(cam.getTransformationMatrix(), planes);
    // The frustum half carries no hysteresis: turning away hides nothing a
    // player could see, and turning back must resume at once.
    was = true;
    return info.isInFrustum(planes);
  }
  seen.distance = 0;
  return seen;
}

/** The flat colour a loaded or built material paints with. */
function colourOf(mat) {
  return mat.albedoColor || mat.diffuseColor || BABYLON.Color3.White();
}

/**
 * Paint each of `meshes` with its own material's colour as vertex colour,
 * switch them all to `material`, merge them into one mesh and parent it under
 * `node`, keeping its world placement. Returns the merged mesh, or null if
 * there was nothing to merge (fewer than two parts) or the merge failed, in
 * which case the parts are left as they were — a dearer fish, never a missing
 * one.
 *
 * `colourFor(mesh)` overrides the colour, for a caller that tints parts
 * (foxrace.js) and would otherwise make a tinted material only to read it.
 *
 * `material` should be white (albedo or diffuse 1, 1, 1): the vertex colour
 * multiplies it. Emissive parts do not belong here, because emission is a
 * material property and would be lost; leave them out and they keep their own
 * material and their own draw call.
 */
export function foldRigid(node, meshes, material, label, colourFor = (m) => colourOf(m.material)) {
  const B = BABYLON;
  const parts = meshes.filter((m) => m.material && m.getTotalVertices() > 0 && !m.isDisposed());
  if (parts.length < 2) return null;
  const was = parts.map((m) => m.material);
  for (const m of parts) {
    const c = colourFor(m);
    // A clone shares its geometry with the template; painting it would paint
    // every rider the same colour.
    m.makeGeometryUnique();
    const n = m.getTotalVertices();
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = c.r; rgba[i * 4 + 1] = c.g; rgba[i * 4 + 2] = c.b; rgba[i * 4 + 3] = 1;
    }
    m.setVerticesData(B.VertexBuffer.ColorKind, rgba, false);
    // Nothing here is textured, so UVs (which some parts have and some do
    // not, and MergeMeshes refuses to mix) are dead weight: keep only what
    // a flat-shaded vertex needs.
    for (const kind of m.getVerticesDataKinds()) {
      if (kind !== B.VertexBuffer.PositionKind && kind !== B.VertexBuffer.NormalKind &&
          kind !== B.VertexBuffer.ColorKind) m.removeVerticesData(kind);
    }
    m.material = material;
    m.computeWorldMatrix(true);
  }
  let one = null;
  try {
    one = B.Mesh.MergeMeshes(parts, true, true);
  } catch (error) {
    console.warn(`[arcade] could not fold ${label}; left as it was`, error);
  }
  if (!one) {
    parts.forEach((m, i) => { if (!m.isDisposed()) m.material = was[i]; });
    return null;
  }
  one.name = label;
  one.material = material;
  one.isPickable = false;
  one.receiveShadows = parts[0].receiveShadows;
  node.computeWorldMatrix(true);
  one.setParent(node);
  return one;
}

/**
 * A white copy of `mat` for foldRigid: same surface (roughness, sheen,
 * culling), colour supplied per vertex instead. Frozen, since nothing about
 * it changes after this.
 */
export function whiteCopy(mat, name) {
  const B = BABYLON;
  const white = mat.clone(name);
  if (white.albedoColor) white.albedoColor = B.Color3.White();
  if (white.diffuseColor) white.diffuseColor = B.Color3.White();
  if (white.emissiveColor) white.emissiveColor = B.Color3.Black();
  if ('metallic' in white && white.metallic != null) white.metallic = 0;
  white.freeze?.();
  return white;
}
