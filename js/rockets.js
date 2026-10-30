/* =============================================================================
 * rockets.js — a launch pad on the welcome cloud, and three free rockets.
 *
 * THE POINT OF IT. A feel test, built 2026-10-30, for an idea that is still
 * mostly TBD: the arcade may one day put on paid "shows" (a fireworks display
 * that ends with a thank-you across the sky), and before any of that is worth
 * designing, a single rocket has to feel good. So these are free, there is no
 * counter, no currency and nothing to collect: walk up, press E, watch.
 * If the shows ever happen, the rule they live under is that they are watched,
 * never played, and that no price ever appears inside the sky.
 *
 * WHAT IS HERE. A round plinth at the north edge of the cloud with three tubes
 * leaning out over the edge — aimed away from where people stand, as real ones
 * are, and also the only way the bursts land in front of a camera that is
 * standing behind the gopher. Each tube holds one rocket with its own burst:
 *
 *      0  gold peony    a full sphere that sags as it fades
 *      1  ring          a tilted halo, cyan and pink
 *      2  willow        slow green-gold trails that droop, with a crackle
 *
 * A tube refills a few seconds after its rocket has burst, so three presses in
 * a row is a little salvo and a fourth has to wait. That wait is the pad being
 * reloaded, not a timer to sell around: there is nothing to buy.
 *
 * COST (PERFORMANCE.md). The plinth and tubes never move and fold into one
 * draw call per material through room.js mergeStatic. The rockets are two
 * meshes each and hidden while flying is not happening. The particle systems
 * — the only expensive part — are not built at boot: the first press builds
 * them ("nothing built up front that only appears on demand"), and a sky
 * nobody launches from never pays for them.
 *
 * WHY STANDARD BLENDING. The sky is a daytime blue (room.js SKY_LOOK.air), and
 * additive sparks on mid-blue wash out to pale cyan. Alpha-blended sparks in
 * saturated colours read as cartoon daytime fireworks instead, which is what
 * this sky is.
 * ========================================================================== */
import { mergeStatic } from './room.js';

/** Where the pad stands; room.js FURNITURE is not used, the blocker is ours. */
const PAD = { x: 1.4, z: 4.25 };
/** Where the gopher stands to launch, and how near counts. Kept clear of the
 *  pets' reach (3.3, 2.3) and of the spawn point (0, 2.6). */
const STAND = { x: 1.4, z: 3.2, reach: 0.8 };

const FLIGHT = 1.35; // seconds from tube to burst
const RELOAD = 4.5; // seconds from burst to a fresh rocket in the tube
const GROW = 0.35; // a fresh rocket slides up out of the tube over this long

/** Each tube's lean: fanned in x, out over the north edge in z. */
const TUBES = [-0.42, 0, 0.42].map((x) => ({ x, dir: [x * 0.6, 1, 0.95] }));

const STYLES = [
  { body: '#d9423a', nose: '#f6c945', kind: 'peony' },
  { body: '#2fb7c9', nose: '#f05aa6', kind: 'ring' },
  { body: '#3e9a4f', nose: '#f2e7a0', kind: 'willow' },
];

export function createRockets(scene, sfx) {
  const B = BABYLON;
  const root = new B.TransformNode('Rocket pad', scene);
  root.position.set(PAD.x, 0, PAD.z);

  // PBR, like everything else on the welcome cloud, and not for looks: the two
  // lamps over this cloud (main.js) burn at intensity 34, a physical value
  // that a StandardMaterial takes literally. The first build of this pad was
  // Standard and came out solid white under them.
  function paint(name, hex, glowing = false) {
    const m = new B.PBRMaterial(`Rocket pad ${name}`, scene);
    m.albedoColor = B.Color3.FromHexString(hex).toLinearSpace();
    m.metallic = 0;
    m.roughness = 0.55;
    if (glowing) m.emissiveColor = B.Color3.FromHexString(hex).toLinearSpace().scale(0.55);
    return m;
  }
  const navy = paint('navy', '#1d2a4a');
  const rim = paint('rim', '#4fd8e8', true);
  const tubeMat = paint('tube', '#2b2f3a');
  const band = paint('tube band', '#f6c945');

  const plinth = B.MeshBuilder.CreateCylinder('Rocket pad plinth', { diameter: 1.5, height: 0.22, tessellation: 28 }, scene);
  plinth.parent = root; plinth.position.y = 0.11; plinth.material = navy;
  const ring = B.MeshBuilder.CreateTorus('Rocket pad rim', { diameter: 1.48, thickness: 0.07, tessellation: 32 }, scene);
  ring.parent = root; ring.position.y = 0.22; ring.material = rim;

  const up = new B.Vector3(0, 1, 0);
  const tubes = TUBES.map((spec, i) => {
    const dir = new B.Vector3(...spec.dir).normalize();
    const q = new B.Quaternion();
    B.Quaternion.FromUnitVectorsToRef(up, dir, q);
    const foot = new B.Vector3(spec.x, 0.22, -0.05);
    const tube = B.MeshBuilder.CreateCylinder('Rocket pad tube', { diameter: 0.2, height: 0.9, tessellation: 14 }, scene);
    tube.parent = root; tube.material = tubeMat;
    tube.rotationQuaternion = q.clone();
    tube.position.copyFrom(foot.add(dir.scale(0.45)));
    const stripe = B.MeshBuilder.CreateCylinder('Rocket pad tube band', { diameter: 0.215, height: 0.06, tessellation: 14 }, scene);
    stripe.parent = root; stripe.material = band;
    stripe.rotationQuaternion = q.clone();
    stripe.position.copyFrom(foot.add(dir.scale(0.8)));
    return { dir, q, foot, style: STYLES[i] };
  });

  for (const m of root.getChildMeshes(false)) { m.isPickable = false; m.receiveShadows = true; }
  const merged = mergeStatic(root.getChildMeshes(false), { cell: 1e6, label: 'Rocket pad' });
  for (const m of [...merged, ...root.getChildMeshes(false)]) m.freezeWorldMatrix();

  // The rockets: a body and a nose, under a node that does the flying. World
  // space, not under the pad, so a flight is just a position.
  const rockets = tubes.map((tube, i) => {
    const node = new B.TransformNode(`Rocket ${i}`, scene);
    node.rotationQuaternion = tube.q.clone();
    const body = B.MeshBuilder.CreateCylinder(`Rocket ${i} body`, { diameter: 0.15, height: 0.5, tessellation: 12 }, scene);
    body.parent = node; body.material = paint(`rocket ${i} body`, tube.style.body);
    const nose = B.MeshBuilder.CreateCylinder(`Rocket ${i} nose`, { diameterTop: 0, diameterBottom: 0.17, height: 0.2, tessellation: 12 }, scene);
    nose.parent = node; nose.position.y = 0.35; nose.material = paint(`rocket ${i} nose`, tube.style.nose, true);
    for (const m of [body, nose]) m.isPickable = false;
    // Resting: the bottom third inside the tube, the rest showing.
    const rest = new B.Vector3(PAD.x, 0, PAD.z).addInPlace(tube.foot).addInPlace(tube.dir.scale(0.78));
    node.position.copyFrom(rest);
    return {
      node, body, tube, rest,
      state: 'ready', // ready | flying | gone | growing
      t: 0,
      from: rest.clone(),
      to: new B.Vector3(),
      wobble: 0,
      trail: null, burst: null,
    };
  });

  // ---------------------------------------------------------------------------
  // Particles, built on the first launch and never again
  // ---------------------------------------------------------------------------

  let spark = null;
  function sparkTexture() {
    if (spark) return spark;
    spark = new B.DynamicTexture('Rocket spark', { width: 64, height: 64 }, scene, false);
    const ctx = spark.getContext();
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    spark.hasAlpha = true;
    spark.update();
    return spark;
  }

  const c4 = (hex, a = 1) => { const c = B.Color3.FromHexString(hex); return new B.Color4(c.r, c.g, c.b, a); };

  function makeTrail(rocket) {
    const ps = new B.ParticleSystem('Rocket trail', 240, scene);
    ps.particleTexture = sparkTexture();
    ps.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
    // The body, not the node: an emitter has to be a mesh or a point. The box
    // and the directions are in the body's own space, so the sparks leave
    // from its tail and stream backwards along whatever lean it flies at.
    ps.emitter = rocket.body;
    ps.minEmitBox = new B.Vector3(-0.03, -0.25, -0.03);
    ps.maxEmitBox = new B.Vector3(0.03, -0.25, 0.03);
    ps.direction1 = new B.Vector3(-0.35, -1, -0.35);
    ps.direction2 = new B.Vector3(0.35, -1, 0.35);
    ps.minEmitPower = 0.6; ps.maxEmitPower = 1.6;
    ps.minLifeTime = 0.25; ps.maxLifeTime = 0.6;
    ps.minSize = 0.08; ps.maxSize = 0.18;
    ps.emitRate = 160;
    ps.gravity = new B.Vector3(0, -2, 0);
    ps.addColorGradient(0, c4('#fff3b0'));
    ps.addColorGradient(0.4, c4('#ff9a3c', 0.9));
    ps.addColorGradient(1, c4('#7a7f8c', 0));
    return ps;
  }

  /**
   * Babylon's drag is not air resistance: it scales each step a spark takes
   * (by 1 - drag) and never touches its velocity. So a constant drag is just
   * a slower burst. Ramped over the spark's life it does what a real shell
   * does, flying out fast and then hanging in the air while it burns.
   */
  function slowing(ps, hang) {
    ps.addDragGradient(0, 0);
    ps.addDragGradient(0.35, hang * 0.75);
    ps.addDragGradient(1, hang);
  }

  function makeBurst(rocket) {
    const kind = rocket.tube.style.kind;
    const ps = new B.ParticleSystem(`Rocket burst ${kind}`, 420, scene);
    ps.particleTexture = sparkTexture();
    ps.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
    ps.emitter = new B.Vector3();
    ps.createSphereEmitter(0.12, 0);
    ps.emitRate = 0;
    if (kind === 'peony') {
      ps.minEmitPower = 7; ps.maxEmitPower = 8.5;
      ps.minLifeTime = 1.3; ps.maxLifeTime = 1.9;
      ps.minSize = 0.22; ps.maxSize = 0.34;
      ps.gravity = new B.Vector3(0, -2.6, 0);
      slowing(ps, 0.85);
      ps.addColorGradient(0, c4('#fffbe6'));
      ps.addColorGradient(0.15, c4('#ffd23f'));
      ps.addColorGradient(0.65, c4('#ff6b2c', 0.95));
      ps.addColorGradient(1, c4('#b0303a', 0));
    } else if (kind === 'ring') {
      ps.minEmitPower = 8; ps.maxEmitPower = 8.6;
      ps.minLifeTime = 1.2; ps.maxLifeTime = 1.6;
      ps.minSize = 0.24; ps.maxSize = 0.34;
      ps.gravity = new B.Vector3(0, -1.6, 0);
      slowing(ps, 0.88);
      // Each spark takes a colour somewhere between these two, so the halo is
      // cyan, pink and every lilac between.
      ps.color1 = c4('#38e1f0'); ps.color2 = c4('#ff5fb4');
      ps.colorDead = c4('#ffffff', 0);
      // A circle in a plane tipped toward the camera, so it reads as a ring
      // and not as a line seen edge on. The tilt is re-rolled per burst.
      ps.startDirectionFunction = (world, dir) => {
        const a = Math.random() * Math.PI * 2;
        const x = Math.cos(a), y = Math.sin(a);
        dir.set(x, y * halo.cos, y * halo.sin);
      };
    } else {
      ps.minEmitPower = 4.5; ps.maxEmitPower = 6;
      ps.minLifeTime = 2.4; ps.maxLifeTime = 3.2;
      ps.minSize = 0.16; ps.maxSize = 0.26;
      ps.gravity = new B.Vector3(0, -3.4, 0);
      slowing(ps, 0.9);
      ps.addColorGradient(0, c4('#ffffff'));
      ps.addColorGradient(0.12, c4('#f6e27a'));
      ps.addColorGradient(0.55, c4('#7ed957', 0.9));
      ps.addColorGradient(1, c4('#2f6b3a', 0));
      ps.addSizeGradient(0, 0.3);
      ps.addSizeGradient(1, 0.12);
    }
    ps.start();
    return ps;
  }
  /** The ring's plane, rolled fresh for every ring burst. */
  const halo = { cos: 1, sin: 0 };

  // ---------------------------------------------------------------------------
  // Flying
  // ---------------------------------------------------------------------------

  const tmp = new B.Vector3();

  function launch() {
    const rocket = rockets.find((r) => r.state === 'ready');
    if (!rocket) return false;
    if (!rocket.trail) rocket.trail = makeTrail(rocket);
    rocket.state = 'flying';
    rocket.t = 0;
    rocket.from.copyFrom(rocket.rest);
    // Up its tube's lean to a height of its own, so a salvo spreads out.
    const height = 6.2 + Math.random() * 1.6;
    const k = (height - rocket.rest.y) / rocket.tube.dir.y;
    rocket.to.copyFrom(rocket.rest).addInPlace(rocket.tube.dir.scale(k));
    rocket.to.x += (Math.random() - 0.5) * 1.2;
    rocket.wobble = Math.random() * Math.PI * 2;
    rocket.trail.start();
    sfx.rocketLaunch();
    return true;
  }

  function burst(rocket) {
    rocket.node.setEnabled(false);
    rocket.trail.stop();
    if (!rocket.burst) rocket.burst = makeBurst(rocket);
    const kind = rocket.tube.style.kind;
    if (kind === 'ring') {
      const tilt = 0.5 + Math.random() * 0.6;
      halo.cos = Math.cos(tilt); halo.sin = Math.sin(tilt);
    }
    rocket.burst.emitter.copyFrom(rocket.node.position);
    rocket.burst.manualEmitCount = kind === 'ring' ? 180 : kind === 'willow' ? 260 : 340;
    sfx.rocketBurst(kind);
    rocket.state = 'gone';
    rocket.t = 0;
  }

  function animate(dt) {
    for (const r of rockets) {
      if (r.state === 'ready') continue;
      r.t += dt;
      if (r.state === 'flying') {
        const k = Math.min(1, r.t / FLIGHT);
        // Fast off the tube, easing into the apex the way a rocket coasts.
        const e = 1 - (1 - k) * (1 - k);
        B.Vector3.LerpToRef(r.from, r.to, e, tmp);
        tmp.x += Math.sin(r.wobble + r.t * 11) * 0.06 * k;
        r.node.position.copyFrom(tmp);
        if (k >= 1) burst(r);
      } else if (r.state === 'gone' && r.t >= RELOAD) {
        r.state = 'growing';
        r.t = 0;
        r.node.position.copyFrom(r.rest);
        r.node.scaling.setAll(0.01);
        r.node.setEnabled(true);
      } else if (r.state === 'growing') {
        const k = Math.min(1, r.t / GROW);
        r.node.scaling.setAll(Math.max(0.01, k));
        // Rise out of the tube rather than appear on top of it.
        r.node.position.copyFrom(r.rest).addInPlace(r.tube.dir.scale((k - 1) * 0.3));
        if (k >= 1) r.state = 'ready';
      }
    }
  }

  return {
    blocker: { x: PAD.x, z: PAD.z, hx: 0.75, hz: 0.75, base: 0, top: 1.5 },
    inReach(p) { return Math.abs(p.y) < 0.3 && Math.hypot(p.x - STAND.x, p.z - STAND.z) < STAND.reach; },
    /** How many are in their tubes right now. */
    loaded: () => rockets.filter((r) => r.state === 'ready').length,
    /** Whether a rocket is up or has just burst: the camera keeps watching. */
    busy: () => rockets.some((r) => r.state === 'flying' || (r.state === 'gone' && r.t < 2.6)),
    launch,
    animate,
  };
}
