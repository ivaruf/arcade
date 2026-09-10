/* =============================================================================
 * gopher.js — the player: two models, one pivot, and no animation clips.
 *
 * The scarf gopher has no baked animation and does not need any: it ships as a
 * named node hierarchy (Body, Head, ArmL, LegR, Tail, ScarfTailUpper …) and
 * everything it does here is arithmetic on those nodes. The contract is the
 * node NAMES, and any of them may be missing — a model that lacks a Tail
 * simply does not wag.
 *
 * Two forms share the pivot: on foot, and riding the cloud after a second jump
 * in mid-air. The cloud model is a separate GLB with the same node names plus
 * `Cloud`, so swapping form is swapping which holder is enabled.
 *
 * Every animated write is `rest + offset` or `rest × factor`, never `+=`. That
 * is what lets the same node be driven by the run cycle one frame and the
 * reaching-for-the-coin-slot pose the next without drift.
 *
 * The scarf is the one piece of real simulation: its two ribbon meshes are
 * deformed on the CPU against a world-space airflow that lags the gopher's
 * velocity, so it trails behind a turn and lifts on a climb. It survives a
 * form change because the wind lives out here, not on the character.
 * ========================================================================== */

const ASSETS = '../assets/3d/';
const TAU = Math.PI * 2;

/** The node names we animate. Missing ones are skipped, not an error. */
const CONTRACT = [
  'Gopher', 'Body', 'Head', 'ArmL', 'ArmR', 'LegL', 'LegR', 'Tail',
  'EyeL', 'EyeR', 'Scarf', 'ScarfTailUpper', 'ScarfTailLower', 'Cloud',
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const randomRange = (lo, hi) => lo + Math.random() * (hi - lo);
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function importModel(name, scene) {
  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', ASSETS, `${name}.glb`, scene);
    if (result.meshes.length) return result;
  } catch (err) {
    console.warn(`[cloudnine] ${name}.glb did not load`, err);
  }
  return null;
}

/**
 * Look up the contract nodes, convert any quaternion rotation to Euler — the
 * glTF loader sets rotationQuaternion, and while it is set every write to
 * `.rotation` is silently ignored — then remember the rest transform.
 */
function captureRest(root, label) {
  const byName = new Map();
  for (const node of root.getDescendants(false)) if (!byName.has(node.name)) byName.set(node.name, node);

  const parts = {};
  const missing = [];
  for (const name of CONTRACT) {
    const node = byName.get(name);
    if (!(node instanceof BABYLON.TransformNode)) {
      parts[name] = null;
      missing.push(name);
      continue;
    }
    if (node.rotationQuaternion) {
      node.rotation = node.rotationQuaternion.toEulerAngles();
      node.rotationQuaternion = null;
    }
    parts[name] = { node, pos: node.position.clone(), rot: node.rotation.clone(), scl: node.scaling.clone() };
  }
  if (missing.length) console.info(`[cloudnine] ${label} has no ${missing.join(', ')}`);
  return parts;
}

/**
 * Wrap a loaded model as a form:  pivot -> holder -> __root__
 * The loader's `__root__` carries the handedness conversion in its own
 * transform, so we hang it under a holder and never touch it.
 */
function makeForm(name, pivot, root, meshes, groups, scene, shadows) {
  const holder = new BABYLON.TransformNode(`form:${name}`, scene);
  holder.parent = pivot;
  root.parent = holder;

  for (const g of groups || []) g.stop(); // procedural only
  for (const m of meshes) {
    m.isPickable = false;
    if (shadows && m.getTotalVertices?.() > 0) shadows.addShadowCaster(m, false);
  }

  const parts = captureRest(root, name);

  // Keep the authored ribbon geometry, then take a private copy so the two
  // forms cannot deform each other's vertices.
  for (const key of ['ScarfTailUpper', 'ScarfTailLower']) {
    const part = parts[key];
    const mesh = part?.node;
    if (!mesh?.getVerticesData) continue;
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) continue;
    mesh.makeGeometryUnique();
    part.cloth = {
      rest: Float32Array.from(positions),
      positions: Float32Array.from(positions),
      normals: new Float32Array(positions.length),
      indices: mesh.getIndices(),
      length: Math.max(...positions.filter((_, i) => i % 3 === 0)),
    };
    mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, part.cloth.positions, true);
    mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, part.cloth.normals, true);
  }
  return { name, holder, parts, lift: 0 };
}

/** A brown capsule wearing the contract's names. Last resort, never blank. */
function placeholder(pivot, scene, shadows) {
  const fur = new BABYLON.StandardMaterial('placeholderFur', scene);
  fur.diffuseColor = new BABYLON.Color3(0.48, 0.32, 0.18);
  fur.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

  const root = new BABYLON.TransformNode('Gopher', scene);
  const body = BABYLON.MeshBuilder.CreateCapsule('Body', { height: 0.62, radius: 0.22 }, scene);
  body.position.y = 0.42;
  body.material = fur;
  body.parent = root;
  const head = new BABYLON.TransformNode('Head', scene);
  head.position.y = 0.68;
  head.parent = root;
  const headMesh = BABYLON.MeshBuilder.CreateSphere('HeadMesh', { diameter: 0.36 }, scene);
  headMesh.material = fur;
  headMesh.parent = head;
  for (const [name, x, y, len, r] of [['ArmL', -0.24, 0.56, 0.28, 0.06], ['ArmR', 0.24, 0.56, 0.28, 0.06],
    ['LegL', -0.11, 0.2, 0.26, 0.075], ['LegR', 0.11, 0.2, 0.26, 0.075]]) {
    const joint = new BABYLON.TransformNode(name, scene);
    joint.position.set(x, y, 0);
    joint.parent = root;
    const mesh = BABYLON.MeshBuilder.CreateCapsule(`${name}Mesh`, { height: len, radius: r }, scene);
    mesh.position.y = -len / 2 + r;
    mesh.material = fur;
    mesh.parent = joint;
  }
  return makeForm('placeholder', pivot, root, root.getChildMeshes(), [], scene, shadows);
}

/** A fat white ellipsoid, for when the cloud model is the thing that is missing. */
function proceduralCloud(pivot, scene, shadows) {
  const mat = new BABYLON.StandardMaterial('cloudMat', scene);
  mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  mat.emissiveColor = new BABYLON.Color3(0.25, 0.26, 0.3);
  mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

  const cloud = new BABYLON.TransformNode('Cloud', scene);
  cloud.parent = pivot;
  const base = BABYLON.MeshBuilder.CreateSphere('CloudBase', { diameter: 1, segments: 12 }, scene);
  base.scaling.set(0.95, 0.3, 0.6);
  base.position.y = 0.15;
  base.material = mat;
  base.parent = cloud;
  if (shadows) shadows.addShadowCaster(base, false);
  return cloud;
}

// ---------------------------------------------------------------------------
// The character
// ---------------------------------------------------------------------------

export async function createGopher(scene, shadows) {
  const pivot = new BABYLON.TransformNode('gopher', scene);

  const walkImport = await importModel('gopher-scarf', scene);
  const forms = {};
  let fallbackCloud = null;

  if (walkImport) {
    const root = walkImport.meshes.find((m) => m.name === '__root__') || walkImport.meshes[0];
    forms.walk = makeForm('walk', pivot, root, walkImport.meshes, walkImport.animationGroups, scene, shadows);
  } else {
    console.warn('[cloudnine] gopher-scarf.glb missing; placeholder gopher');
    forms.walk = placeholder(pivot, scene, shadows);
  }

  const flyImport = await importModel('gopher-scarf-cloud', scene);
  if (flyImport) {
    const root = flyImport.meshes.find((m) => m.name === '__root__') || flyImport.meshes[0];
    forms.fly = makeForm('fly', pivot, root, flyImport.meshes, flyImport.animationGroups, scene, shadows);
  } else {
    forms.fly = forms.walk;
    fallbackCloud = proceduralCloud(pivot, scene, shadows);
  }

  const anim = {
    phase: 0, run: 0, air: 0, squash: 0, reach: 0,
    pitch: 0, roll: 0,
    blinkTimer: randomRange(2.5, 5), blinkLeft: 0,
    wind: BABYLON.Vector3.Zero(), windSpeed: 0, clothPhase: 0,
  };

  let active = null;

  function use(which) {
    const next = forms[which];
    for (const form of new Set([forms.walk, forms.fly])) form.holder.setEnabled(form === next);
    if (fallbackCloud) fallbackCloud.setEnabled(which === 'fly');
    next.lift = which === 'fly' && fallbackCloud ? 0.28 : 0;
    next.holder.rotation.set(0, 0, 0);
    next.holder.position.set(0, next.lift, 0);
    active = next;
  }
  use('walk');

  // -- writes are always rest + offset, so nothing accumulates --------------
  const rot = (p, x, y, z) => p && p.node.rotation.set(p.rot.x + x, p.rot.y + y, p.rot.z + z);
  const pos = (p, x, y, z) => p && p.node.position.set(p.pos.x + x, p.pos.y + y, p.pos.z + z);
  const scl = (p, x, y, z) => p && p.node.scaling.set(p.scl.x * x, p.scl.y * y, p.scl.z * z);

  function blinkAndBreathe(P, t, dt) {
    anim.blinkTimer -= dt;
    if (anim.blinkTimer <= 0) {
      anim.blinkLeft = 0.12;
      anim.blinkTimer = randomRange(2.5, 5);
    }
    let eye = 1;
    if (anim.blinkLeft > 0) {
      anim.blinkLeft -= dt;
      eye = 0.1;
    }
    scl(P.EyeL, 1, eye, 1);
    scl(P.EyeR, 1, eye, 1);
  }

  function walkPose(P, t, dt, state) {
    anim.run = damp(anim.run, state.speed01, 10, dt);
    anim.air = damp(anim.air, state.grounded ? 0 : 1, 14, dt);
    const run = anim.run;
    const idle = 1 - Math.min(run, 1);
    const ground = 1 - anim.air;

    if (state.speed01 >= 0.05) anim.phase += dt * (6 + 8 * state.speed01);
    const s = Math.sin(anim.phase);
    const s2 = Math.sin(anim.phase * 2);

    // Reaching up for the coin slot: on tiptoe, both arms overhead.
    const reach = anim.reach;
    const legSwing = s * 0.9 * run * ground;
    const armSwing = s * 0.6 * run;
    const tuck = -0.9 * anim.air;
    rot(P.LegL, legSwing + tuck, 0, 0);
    rot(P.LegR, -legSwing + tuck, 0, 0);
    rot(P.ArmL, -armSwing * (1 - reach) - 2.3 * reach, 0, -0.35 * reach);
    rot(P.ArmR, armSwing * (1 - reach) - 2.3 * reach, 0, 0.35 * reach);

    const breath = Math.sin(t * TAU * 1.5) * 0.015 * idle;
    pos(P.Body, 0, Math.abs(s) * 0.06 * run + 0.05 * reach, 0);
    scl(P.Body, 1 - breath, 1 + breath + 0.04 * reach, 1);

    const headPitch = 0.12 * run + s2 * 0.05 * run + Math.sin(t * 0.9) * 0.03 * idle - 0.3 * reach;
    rot(P.Head, headPitch, Math.sin(t * 0.5) * 0.06 * idle, Math.sin(t * 0.7) * 0.05 * idle);
    rot(P.Tail, 0, s2 * 0.35 * run + Math.sin(t * 2.2) * (0.25 * idle + 0.5 * reach), 0);

    blinkAndBreathe(P, t, dt);
    active.holder.rotation.set(0, 0, 0);
    active.holder.position.set(0, active.lift + 0.04 * reach, 0);
  }

  function flyPose(P, t, dt, state) {
    anim.run = damp(anim.run, 0, 10, dt);
    anim.air = damp(anim.air, 0, 14, dt);
    const rise = Math.max(0, state.vertical01);
    const sink = Math.max(0, -state.vertical01);

    const bob = Math.sin(t * 2.4) * 0.05 + Math.sin(t * 3.7) * 0.02;
    anim.pitch = damp(anim.pitch, 0.22 * state.speed01 - 0.18 * state.vertical01, 6, dt);
    anim.roll = damp(anim.roll, clamp(-state.yawRate * 0.22, -0.4, 0.4), 6, dt);
    active.holder.rotation.set(anim.pitch, 0, anim.roll);
    active.holder.position.set(0, active.lift + bob, 0);

    const flap = Math.sin(t * 13) * 0.35 * rise;
    rot(P.LegL, -1.2, 0, 0);
    rot(P.LegR, -1.2, 0, 0);
    rot(P.ArmL, -0.5 - 0.3 * state.speed01, 0, -0.55 - flap);
    rot(P.ArmR, -0.5 - 0.3 * state.speed01, 0, 0.55 + flap);

    const breath = Math.sin(t * TAU * 1.2) * 0.012;
    pos(P.Body, 0, 0, 0);
    scl(P.Body, 1 - breath, 1 + breath, 1);
    rot(P.Head, -0.28 * rise + 0.22 * sink + Math.sin(t * 1.1) * 0.03, Math.sin(t * 0.6) * 0.08 * (1 - state.speed01), 0);
    rot(P.Tail, 0, Math.sin(t * (3 + 4 * state.speed01)) * 0.35, 0);

    const pulse = 1 + Math.sin(t * 3.1) * 0.03;
    scl(P.Cloud, pulse, 1 / pulse, pulse);
    if (fallbackCloud) {
      fallbackCloud.scaling.set(pulse, 1 / pulse, pulse);
      fallbackCloud.position.y = bob;
      fallbackCloud.rotation.set(anim.pitch, pivot.rotation.y, anim.roll);
    }
    blinkAndBreathe(P, t, dt);
  }

  /**
   * The scarf. Airflow is the negated velocity, smoothed, in world space; each
   * ribbon transforms it into its own local frame (which already includes the
   * glTF handedness flip, the rider's bank and the current heading) and bends
   * along its length. The first centimetre next to the knot is held stiff so
   * the ribbon leaves the collar outward instead of through the chest.
   */
  function scarfPose(P, dt, state) {
    const wind = anim.wind;
    wind.x = damp(wind.x, -state.vx, 5, dt);
    wind.y = damp(wind.y, -state.vy, 5, dt);
    wind.z = damp(wind.z, -state.vz, 5, dt);
    anim.windSpeed = damp(anim.windSpeed, Math.hypot(state.vx, state.vy, state.vz), 5, dt);
    const tempo = Math.min(anim.windSpeed / 7, 1.5);
    anim.clothPhase = (anim.clothPhase + dt * (2.5 + 12 * tempo)) % TAU;

    ['ScarfTailUpper', 'ScarfTailLower'].forEach((key, tail) => {
      const part = P[key];
      if (!part?.cloth) return;
      const mesh = part.node;
      const cloth = part.cloth;
      const local = BABYLON.Vector3.TransformNormal(wind, BABYLON.Matrix.Invert(mesh.computeWorldMatrix(true)));
      const horizontal = Math.hypot(local.x, local.z);
      const pull = 1 - Math.exp(-horizontal / 1.8);
      const angle = Math.atan2(local.z, local.x) * pull;
      const lift = clamp(local.y * 0.055, -0.35, 0.35);
      for (let i = 0; i < cloth.rest.length; i += 3) {
        const x = cloth.rest[i];
        const u = clamp(x / cloth.length, 0, 1);
        const bend = angle * (1 - Math.exp(-u * 7));
        const ripple = Math.sin(anim.clothPhase - u * 5 + tail * 1.8) * (0.008 + 0.045 * tempo) * u * u;
        cloth.positions[i] = x * (0.22 + 0.78 * Math.cos(bend));
        cloth.positions[i + 1] = cloth.rest[i + 1] + x * (-0.7 * (1 - pull) + lift) * u + ripple;
        cloth.positions[i + 2] = cloth.rest[i + 2] + x * 0.78 * Math.sin(bend) + ripple * 0.35;
      }
      BABYLON.VertexData.ComputeNormals(cloth.positions, cloth.indices, cloth.normals);
      mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, cloth.positions, true);
      mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, cloth.normals);
    });
  }

  return {
    pivot,
    get form() {
      return active.name;
    },
    use,
    squash() {
      anim.squash = 1;
    },
    /** 0..1: how far into the reach-for-the-coin-slot pose we are. */
    setReach(target, dt) {
      anim.reach = damp(anim.reach, target, 9, dt);
    },
    animate(t, dt, state) {
      if (!active) return;
      const P = active.parts;
      if (state.mode === 'fly') flyPose(P, t, dt, state);
      else walkPose(P, t, dt, state);
      scarfPose(P, dt, state);

      anim.squash = Math.max(0, anim.squash - dt / 0.18);
      const k = Math.sin(anim.squash * Math.PI);
      pivot.scaling.set(1 + 0.1 * k, 1 - 0.15 * k, 1 + 0.1 * k);
    },
  };
}
