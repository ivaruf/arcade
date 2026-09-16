import { createCustomizationStation, ACCESSORIES, accessoryPreviews } from './customization.js';
/* =============================================================================
 * main.js — the arcade floor: boot, movement, camera, and the coin.
 *
 * The room and the machines are 3D; the words are DOM. What lives here is the
 * part that is neither: the state the player is in, the physics of a small
 * gopher on a tiled floor, and the camera move that turns "standing in front of
 * a cabinet" into "playing the game".
 *
 * States, and the only legal moves between them:
 *
 *      boot -> title -> floor <-> paused
 *                         |
 *                         +-> diving -> playing -> rising -> floor
 *
 * `diving` and `rising` are the camera flying to the glass and back. They exist
 * as states rather than as an animation callback because input has to be dead
 * for their duration: a hop pressed halfway through a dive would otherwise be
 * waiting for you when you came back out of the game.
 *
 * Physics is a hand-rolled fixed set of rules, not an engine: horizontal
 * acceleration toward a target velocity, gravity, and circle-versus-box
 * pushout against a list of blockers. A box only blocks while the gopher is
 * below its top, which is what makes the dance pad something you hop onto and
 * the cabinets something you fly over.
 * ========================================================================== */

import { loadMachines } from './registry.js';
import {
  buildWorld, groundAt, insideSky, platformNear,
  SKY, SKY_LOOK, SPAWN,
} from './room.js';
import { raiseSigns } from './signs.js';
import { placeCabinets, setLit, animateCabinets } from './cabinets.js';
import { createGopher } from './gopher.js';
import * as input from './controls.js';
import * as sfx from './audio.js';
import { createLauncher, hashSlug, pushSlug, dropSlug } from './launcher.js';
import { setupScreen, registerWorker } from './screen.js';
import * as quality from './quality.js';

// ---------------------------------------------------------------------------
// Tuning. A gopher is about 0.8 m tall, so these are small numbers on purpose:
// the room is 17 x 13 m of walkable floor and crossing it should take a moment.
// ---------------------------------------------------------------------------

const WALK_SPEED = 3.4;
const SPRINT = 1.75;
const ACCEL = 20;
const DECEL = 24;
const JUMP = 5.2;
const GRAVITY = 16;

const FLY_SPEED = 6;
const FLY_ACCEL = 12;
const FLY_DECEL = 9;
const ASCEND = 4;
const DESCEND = 4.6;
const VERTICAL_RATE = 6;
const TAKEOFF_BOOST = 2.6;

const RADIUS = 0.32; // the gopher's collision circle
const TURN_RATE = 12;
const MAX_DT = 0.05;

/** How close to a cabinet's mark counts as standing at it. */
const REACH = 1.75;

/**
 * How long the gopher may fall before the cloud comes for it.
 *
 * This is the rule that makes the sky safe: there is no death, no damage and
 * no reset, because this is a launcher and you should not be able to get
 * stuck in one. Half a second is long enough for stepping off an edge to
 * register as a mistake and short enough that it never becomes a fall.
 */
const CATCH_AFTER = 0.5;

/**
 * The title shot orbits inside the room, so its radius has to be small enough
 * that the camera never reaches a wall: 6.4 m about the middle of an 18 x 14 m
 * floor keeps it indoors at every angle. Zooming out on the floor is capped for
 * the same reason — past about 8 m you are looking at the room from the car park.
 */
const CAMERA = { height: 0.62, radius: 5, beta: 1.16, titleRadius: 6.4, titleBeta: 1.25, maxRadius: 8 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const smooth = (t) => t * t * (3 - 2 * t);

function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

// Tell the watchdog in index.html that the modules parsed and are running.
// Set before anything that can throw, so a later failure reports itself
// through the boot card rather than being mistaken for a dead module.
window.__cloudnineBooted = true;

const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('stage'),
  boot: $('boot'),
  bootLine: $('boot-line'),
  title: $('title'),
  walkIn: $('walk-in'),
  hud: $('hud'),
  hudCount: $('hud-count'),
  hudRoom: $('hud-room'),
  prompt: $('prompt'),
  promptTitle: $('prompt-title'),
  promptCue: $('prompt-cue'),
  pause: $('pause'),
  resume: $('resume'),
  sound: $('sound'),
  music: $('music'),
  quality: $('quality'),
  touch: $('touch'),
  cabinet: $('cabinet'),
  pill: document.querySelector('.pill'),
};

const say = (text) => {
  ui.bootLine.textContent = text;
};

if (typeof BABYLON === 'undefined') {
  say('Babylon.js did not load. The floor needs the network the first time.');
  throw new Error('Babylon.js missing');
}

// ---------------------------------------------------------------------------
// Engine and scene
// ---------------------------------------------------------------------------

// Antialiasing stays on everywhere, which is not the obvious call on a tablet.
// Apple and Mali GPUs are tile-based: they resolve MSAA inside tile memory and
// never pay for it in bandwidth, so turning it off saves close to nothing and
// costs every thin mast and railing in the sky. Resolution is the knob that
// actually moves a frame here, and quality.js owns it.
const engine = new BABYLON.Engine(ui.canvas, true, { stencil: false, powerPreference: 'high-performance' });

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.05, 1);
scene.ambientColor = new BABYLON.Color3(0.08, 0.1, 0.14);
// Haze rather than a hard horizon, and the same colour is what the camera
// sees past the last cloud. dressTheSky() sets the real values at boot.
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogColor = new BABYLON.Color3(0.02, 0.03, 0.05);
scene.fogDensity = 0;

const cameraTarget = new BABYLON.TransformNode('cameraTarget', scene);
cameraTarget.position.set(0, 1.7, 0);

const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 2, CAMERA.titleBeta, CAMERA.titleRadius, cameraTarget.position.clone(), scene);
camera.lockedTarget = cameraTarget;
camera.lowerRadiusLimit = 2.4;
camera.upperRadiusLimit = CAMERA.maxRadius;
// Beta is measured from straight up, so 1.5 stopped the camera a hair short of
// level with the gopher — you could never get UNDER it and look up, which is
// the one view flying actually wants. 2.6 is about 150 degrees: well below and
// looking up, and still short of the pole where an orbit camera's roll goes
// strange. Nothing under a cloud to clip into up here, so the same range works
// standing still as it does in the air.
camera.lowerBetaLimit = 0.62;
camera.upperBetaLimit = 2.6;
camera.wheelDeltaPercentage = 0.02;
camera.pinchDeltaPercentage = 0.0015;
camera.panningSensibility = 0;
camera.minZ = 0.08;
camera.maxZ = 60;
// `false` is noPreventDefault, so Babylon DOES call preventDefault on the
// camera's own pointer events. With `true` a drag on the canvas was left for
// the browser to interpret as well, and on a phone that means a text
// selection and the iOS magnifier coming up over the sky while you are trying
// to look around. Nothing on this page is text anyone wants to select — the
// CSS in style.css says so too, and this is the other half of it.
camera.attachControl(ui.canvas, false);
camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput'); // WASD is ours

const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
hemi.intensity = 0.55;
hemi.diffuse = new BABYLON.Color3(0.62, 0.72, 0.95);
hemi.groundColor = new BABYLON.Color3(0.1, 0.14, 0.2);

const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.35, -1, 0.28).normalize(), scene);
sun.position = new BABYLON.Vector3(4, 12, -4);
sun.intensity = 0.9;
sun.diffuse = new BABYLON.Color3(0.86, 0.92, 1);
sun.autoCalcShadowZBounds = true;

// Two pools of light down the room, so crossing the floor is not uniform.
// Held in a list because the lighter tier switches them off: a point light is
// not a local cost, it is another term in the shader of every lit pixel on
// screen, and four lights over an untextured PBR world is most of a frame.
const lamps = [-3.4, 2.6].map((z) => {
  const lamp = new BABYLON.PointLight(`lamp${z}`, new BABYLON.Vector3(0, 4.7, z), scene);
  lamp.intensity = 34;
  lamp.range = 16;
  lamp.diffuse = new BABYLON.Color3(0.55, 0.85, 0.82);
  lamp.specular = new BABYLON.Color3(0.2, 0.3, 0.35);
  return lamp;
});

// Only the gopher casts (gopher.js), so the map itself is a cheap pass at any
// size. What costs is the filter, which every receiving pixel in the sky runs.
const shadows = new BABYLON.ShadowGenerator(input.IS_TOUCH ? 1024 : 2048, sun);
shadows.filteringQuality = input.IS_TOUCH ? BABYLON.ShadowGenerator.QUALITY_LOW : BABYLON.ShadowGenerator.QUALITY_MEDIUM;
shadows.bias = 0.004;
shadows.normalBias = 0.03;

// The neon in this kit is emissive material, not lights. A glow layer is what
// turns that into the bloom the Blender renders have, and it costs one blur
// pass rather than a light per tube.
const glow = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 28, mainTextureRatio: 0.5 });
glow.intensity = 0.5;

/** Everything quality.js is allowed to turn down, in one place. */
const knobs = { engine, shadows, lamps, glow };
quality.apply(knobs);

// ---------------------------------------------------------------------------
// Player state, shared with the animation code
// ---------------------------------------------------------------------------

const state = {
  mode: 'walk', // 'walk' | 'fly'
  vx: 0, vy: 0, vz: 0,
  grounded: true,
  yaw: Math.PI,
  yawRate: 0,
  speed01: 0,
  vertical01: 0,
};

let phase = 'boot';
let time = 0;
let settleUntil = 0;

/**
 * A framing the camera drifts toward for a couple of seconds after something
 * changes what the player is doing: walking in, taking off, landing. On foot
 * the camera wants to be above and behind; on a cloud it wants to be level and
 * further out, both because that is the nicer shot and because a high camera
 * over a flying gopher ends up in the roof.
 */
let ease = { until: 0, beta: CAMERA.beta, radius: CAMERA.radius, alpha: null };
const easeCamera = (beta, radius, seconds, alpha = null) => {
  ease = { until: time + seconds, beta, radius, alpha };
};

/** Which platform the gopher is over, for the HUD. */
let platform = null;

/** How long it has been falling with nothing underneath. */
let falling = 0;

let stepPhase = 0;
let cabinets = [];
let customizationStation = null;
let nearCustomization = false;
let outfitCamera = null;
/** Width over height of the dresser's preview pane; fitOutfitPreview measures it. */
let outfitAspect = 1;
let gopher = null;
let blockers = [];
let near = null;

/**
 * The camera move in progress, or null. It is cleared the moment it finishes,
 * because a finished dive left lying around gets stepped through again by the
 * next frame and fires its arrival a second time — which launched the game
 * twice, pushed a second history entry and left two iframes in the document.
 */
let dive = null;

/** The cabinet the camera is parked at, for as long as it is parked there. */
let atMachine = null;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  say('rolling out the clouds…');
  const machinesPromise = loadMachines();
  const world = await buildWorld(scene);
  animateWorld = world.animate;

  say('reading the machines…');
  const machines = await machinesPromise;

  say(`wheeling in ${machines.length} cabinet${machines.length === 1 ? '' : 's'}…`);
  cabinets = await placeCabinets(scene, shadows, machines);
  customizationStation = createCustomizationStation(scene, shadows);
  blockers = [...world.blockers, customizationStation.blocker, ...cabinets.flatMap((c) => c.blockers)];
  raiseSigns(scene, cabinets);

  say('waking the gopher…');
  gopher = await createGopher(scene, shadows);
  gopher.pivot.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
  gopher.pivot.rotation.y = state.yaw;
  platform = platformNear(SPAWN.x, SPAWN.z);
  ui.hudRoom.textContent = platform?.name || '';

  // No environment map ships with this page, and a PBR material that is mostly
  // metal with nothing to reflect renders black. The kit only pushes past this
  // on brushed metal trim, so the metals are dialled back rather than faked.
  for (const mat of scene.materials) {
    if (mat instanceof BABYLON.PBRMaterial && mat.metallic > 0.25) {
      mat.metallic = 0.25;
      mat.roughness = Math.max(mat.roughness ?? 0.4, 0.42);
    }
  }

  ui.hudCount.textContent = `${cabinets.filter((c) => c.game).length} machines in the sky`;
  ui.boot.hidden = true;

  // Nothing on this floor swaps a texture or a blend mode after boot; the only
  // material change per frame is the screens' emissiveColor, which is a uniform
  // and keeps working. So stop Babylon re-checking 104 materials for shader
  // recompiles it is never going to need. Pure CPU, nothing visible.
  scene.blockMaterialDirtyMechanism = true;

  dressTheSky();
  engine.runRenderLoop(render);
  window.addEventListener('resize', () => engine.resize());
  // Fullscreen changes the viewport without firing resize on every browser,
  // so screen.js calls back rather than us hoping.
  setupScreen(() => engine.resize());

  // A #play= link is a link to a machine: skip the title and put a coin in.
  const wanted = cabinets.find((c) => c.game && c.game.slug === hashSlug());
  if (wanted) {
    enterFloor(false);
    standAt(wanted);
    startDive(wanted, true);
  } else {
    phase = 'title';
    ui.title.hidden = false;
  }
}

boot().catch((err) => {
  console.error('[cloudnine]', err);
  ui.boot.hidden = false;
  say(`The arcade did not open: ${err.message}`);
});

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

function enterFloor(withSound = true) {
  phase = 'floor';
  ui.title.hidden = true;
  ui.pause.hidden = true;
  ui.hud.hidden = false;
  settleUntil = time + 1.4;
  easeCamera(CAMERA.beta, CAMERA.radius, 1.6);
  if (withSound) {
    sfx.unlock();
    sfx.startAmbience();
    sfx.startMusic().then(paintAudio);
    sfx.duckMusic(false);
  }
}

function pause() {
  if (phase !== 'floor') return;
  phase = 'paused';
  input.clear();
  ui.pause.hidden = false;
  ui.prompt.hidden = true;
  sfx.click();
}

function unpause() {
  if (phase !== 'paused') return;
  phase = 'floor';
  ui.pause.hidden = true;
  sfx.click();
}

/** Put the gopher on a cabinet's mark, facing it, at a standstill. */
function standAt(cabinet) {
  gopher.pivot.position.set(cabinet.stand.x, cabinet.floor, cabinet.stand.z);
  platform = platformNear(cabinet.stand.x, cabinet.stand.z) || platform;
  state.yaw = cabinet.faceYaw;
  gopher.pivot.rotation.y = state.yaw;
  state.vx = state.vy = state.vz = 0;
  state.speed01 = 0;
  state.grounded = true;
  if (state.mode === 'fly') land(true);
}

// ---------------------------------------------------------------------------
// The coin: camera to the glass, then the game
// ---------------------------------------------------------------------------

function startDive(cabinet, silent = false) {
  phase = 'diving';
  atMachine = cabinet;
  input.clear();
  ui.prompt.hidden = true;
  setLit(cabinet, true);
  if (!silent) {
    sfx.unlock();
    sfx.coin();
  }

  // The arc camera can express the destination exactly: put the target on the
  // glass and the camera one cabinet-length out along the machine's facing.
  camera.lockedTarget = null;
  camera.detachControl();
  camera.lowerRadiusLimit = null;
  camera.upperRadiusLimit = null;
  camera.lowerBetaLimit = 0.01;
  camera.upperBetaLimit = Math.PI - 0.01;

  dive = {
    t: 0,
    duration: silent ? 0.01 : 0.95,
    out: false,
    from: {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
    },
    to: {
      alpha: cabinet.cameraAlpha,
      // Slightly below the screen's centre: a gopher looks UP at a cabinet.
      beta: Math.PI / 2 + 0.16,
      radius: cabinet.cameraRadius,
      target: cabinet.screenPoint.clone(),
    },
  };
}

function startRise() {
  if (!atMachine) return;
  phase = 'rising';
  const cabinet = atMachine;
  dive = {
    t: 0,
    duration: 0.8,
    out: true,
    from: {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
    },
    to: {
      alpha: cabinet.cameraAlpha,
      beta: CAMERA.beta,
      radius: CAMERA.radius,
      target: new BABYLON.Vector3(cabinet.stand.x, CAMERA.height, cabinet.stand.z),
    },
  };
}

function updateDive(dt) {
  dive.t = Math.min(1, dive.t + dt / dive.duration);
  const k = smooth(dive.t);
  // The fourth argument is `cloneAlphaBetaRadius`, and it is not optional for
  // us: without it setTarget rebuilds alpha, beta and radius from the camera's
  // current position, so every frame would throw away the three values we set
  // on the next two lines and the dive would never arrive.
  camera.setTarget(BABYLON.Vector3.Lerp(dive.from.target, dive.to.target, k), false, false, true);
  camera.alpha = lerpAngle(dive.from.alpha, dive.to.alpha, k);
  camera.beta = dive.from.beta + (dive.to.beta - dive.from.beta) * k;
  camera.radius = dive.from.radius + (dive.to.radius - dive.from.radius) * k;

  if (dive.t < 1) return;
  const { out, to } = dive;
  dive = null; // consumed: see the note where it is declared

  if (!out) {
    phase = 'playing';
    sfx.boot();
    sfx.stopAmbience();
    sfx.duckMusic(true);
    ui.hud.hidden = true;
    ui.touch.hidden = true;
    pushSlug(atMachine.game.slug);
    launcher.open(atMachine);
  } else {
    // Give the camera its rig and its limits back.
    cameraTarget.position.copyFrom(to.target);
    camera.lockedTarget = cameraTarget;
    camera.lowerRadiusLimit = 2.4;
    camera.upperRadiusLimit = CAMERA.maxRadius;
    camera.lowerBetaLimit = 0.62;
    camera.upperBetaLimit = 2.6;
    camera.attachControl(ui.canvas, false); // noPreventDefault: see the rig above
    setLit(atMachine, false);
    atMachine = null;
    enterFloor();
    if (input.IS_TOUCH) ui.touch.hidden = false;
  }
}

/** Leave whatever machine is running and come back to the floor. */
async function stepAway() {
  if (phase !== 'playing') return;
  phase = 'rising';
  sfx.back();
  await launcher.close(render);
  sfx.unlock();
  sfx.startAmbience();
  startRise();
}

/**
 * The one way out of a game, wherever the request came from. It goes through
 * the history entry rather than straight to stepAway so the pill, Escape and
 * the back button all leave exactly the same trail.
 */
function leaveGame() {
  if (phase !== 'playing') return;
  if (history.state?.cloudnine) {
    dropSlug(); // popstate calls stepAway
    return;
  }
  // A deep link straight to #play=<slug> pushed nothing, so there is no entry
  // of ours to unwind and going back would leave the arcade altogether. Clear
  // the hash where it stands — or the URL keeps claiming a game while the
  // gopher is on the cloud, and a reload drops the player straight back in —
  // and then step away directly, since no popstate is coming to do it for us.
  dropSlug();
  stepAway();
}

// Published for the game inside the cabinet. Every game's own quit button
// calls this through exit.js, and it has to be this function rather than
// history.back(): the branch above is the whole point, and a deep link
// straight to #play=<slug> has no entry of ours to unwind.
window.arcadeLeave = leaveGame;

const launcher = createLauncher({
  engine,
  scene,
  canvas: ui.canvas,
  root: ui.cabinet,
  pill: ui.pill,
  onLeft: leaveGame,
});

// ---------------------------------------------------------------------------
// Walking, hopping, flying
// ---------------------------------------------------------------------------

/** Camera forward on the floor plane, from the orbit angle. */
const cameraForward = () => ({ x: -Math.cos(camera.alpha), z: -Math.sin(camera.alpha) });

function accelerateToward(tx, tz, maxDelta) {
  const dx = tx - state.vx;
  const dz = tz - state.vz;
  const d = Math.hypot(dx, dz);
  if (d <= maxDelta || d < 1e-9) {
    state.vx = tx;
    state.vz = tz;
    return;
  }
  state.vx += (dx / d) * maxDelta;
  state.vz += (dz / d) * maxDelta;
}

function steer(dt, maxSpeed, accel, decel) {
  const axes = input.moveAxes();
  const fwd = cameraForward();
  // Right is (fwd.z, -fwd.x) in this handedness.
  const dirX = fwd.x * axes.y + fwd.z * axes.x;
  const dirZ = fwd.z * axes.y - fwd.x * axes.x;
  const len = Math.hypot(dirX, dirZ);
  const strength = Math.min(1, len);

  if (len > 1e-6) accelerateToward((dirX / len) * maxSpeed * strength, (dirZ / len) * maxSpeed * strength, accel * dt);
  else accelerateToward(0, 0, decel * dt);

  const pos = gopher.pivot.position;
  const fromX = pos.x;
  const fromZ = pos.z;
  pos.x += state.vx * dt;
  pos.z += state.vz * dt;
  return { fromX, fromZ };
}

/**
 * Circle against every blocker we are not already above, then the room. The
 * velocity component pointing into whatever we hit is removed, so sliding
 * along a row of cabinets feels like sliding rather than stopping dead.
 */
function collide(pos, fromX, fromZ) {
  for (const b of blockers) {
    if (pos.y >= b.top) continue; // above it: hop or fly over
    // Below the floor it stands on: a bench on the cloud deck is not in your
    // way while you are in the basement under it.
    if (pos.y < (b.base ?? 0) - 0.6) continue;
    const cx = clamp(pos.x, b.x - b.hx, b.x + b.hx);
    const cz = clamp(pos.z, b.z - b.hz, b.z + b.hz);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= RADIUS * RADIUS) continue;

    let nx;
    let nz;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = dx / d;
      nz = dz / d;
      pos.x += nx * (RADIUS - d);
      pos.z += nz * (RADIUS - d);
    } else {
      // Dead inside the box: leave through the nearest face.
      const left = pos.x - (b.x - b.hx);
      const right = b.x + b.hx - pos.x;
      const behind = pos.z - (b.z - b.hz);
      const ahead = b.z + b.hz - pos.z;
      const m = Math.min(left, right, behind, ahead);
      if (m === left) { nx = -1; nz = 0; pos.x = b.x - b.hx - RADIUS; }
      else if (m === right) { nx = 1; nz = 0; pos.x = b.x + b.hx + RADIUS; }
      else if (m === behind) { nx = 0; nz = -1; pos.z = b.z - b.hz - RADIUS; }
      else { nx = 0; nz = 1; pos.z = b.z + b.hz + RADIUS; }
    }
    const into = state.vx * nx + state.vz * nz;
    if (into < 0) {
      state.vx -= nx * into;
      state.vz -= nz * into;
    }
  }

  confine(pos, fromX, fromZ);
}

/**
 * Keep the gopher inside the sky. One box now, where the building needed a
 * union of nine: the only thing out here to be stopped by is the edge of the
 * world, and it stops you softly on whichever axis you crossed so flying
 * along the boundary slides rather than sticks.
 */
function confine(pos, fromX, fromZ) {
  if (insideSky(pos.x, pos.y, pos.z)) return;
  if (insideSky(fromX, pos.y, pos.z)) {
    pos.x = fromX;
    state.vx = 0;
    return;
  }
  if (insideSky(pos.x, pos.y, fromZ)) {
    pos.z = fromZ;
    state.vz = 0;
    return;
  }
  pos.x = fromX;
  pos.z = fromZ;
  state.vx = 0;
  state.vz = 0;
}

function faceTravel(dt, minSpeed) {
  const speed = Math.hypot(state.vx, state.vz);
  const previous = state.yaw;
  if (speed > minSpeed) state.yaw = lerpAngle(state.yaw, Math.atan2(state.vx, state.vz), 1 - Math.exp(-TURN_RATE * dt));
  state.yawRate = damp(state.yawRate, wrapAngle(state.yaw - previous) / dt, 10, dt);
  gopher.pivot.rotation.y = state.yaw;
  return speed;
}

function takeOff() {
  state.mode = 'fly';
  state.grounded = false;
  state.vy = Math.max(state.vy, TAKEOFF_BOOST);
  gopher.use('fly');
  gopher.squash();
  sfx.takeoff();
  easeCamera(1.42, 6.2, 2.4);
}

function land(silent = false) {
  state.mode = 'walk';
  state.grounded = true;
  state.vy = 0;
  state.vertical01 = 0;
  const under = groundAt(gopher.pivot.position.x, gopher.pivot.position.z, gopher.pivot.position.y);
  if (under !== -Infinity) gopher.pivot.position.y = under;
  falling = 0;
  gopher.use('walk');
  gopher.squash();
  easeCamera(CAMERA.beta, CAMERA.radius, 1.8);
  if (!silent) sfx.land();
}

function updateWalk(dt) {
  const { fromX, fromZ } = steer(dt, WALK_SPEED * (input.sprintHeld() ? SPRINT : 1), ACCEL, DECEL);
  const pos = gopher.pivot.position;
  collide(pos, fromX, fromZ);

  if (input.tookHop()) {
    if (state.grounded) {
      state.vy = JUMP;
      state.grounded = false;
      gopher.squash();
      sfx.hop();
    } else {
      takeOff();
      return;
    }
  }

  const ground = groundAt(pos.x, pos.z, pos.y);
  if (state.grounded && ground === -Infinity) state.grounded = false;

  if (!state.grounded) {
    state.vy -= GRAVITY * dt;
    pos.y += state.vy * dt;
    if (ground !== -Infinity && pos.y <= ground) {
      pos.y = ground;
      state.vy = 0;
      state.grounded = true;
      falling = 0;
      gopher.squash();
      sfx.land();
    } else if (state.vy < 0) {
      // Walked off a cloud. Fall for a beat so it registers as a mistake,
      // then the cloud comes and you are flying — never a death, never a
      // reset, because this is a launcher and you should not be able to get
      // stuck in one.
      falling += dt;
      if (falling >= CATCH_AFTER) {
        takeOff();
        return;
      }
    }
  } else {
    falling = 0;
  }

  const speed = faceTravel(dt, 0.3);
  state.speed01 = clamp(speed / WALK_SPEED, 0, 1.75);

  // Footsteps come off the run cycle rather than a timer, so they land with
  // the feet at any speed.
  if (state.grounded && state.speed01 > 0.12) {
    stepPhase += dt * (3 + 4 * state.speed01);
    if (stepPhase >= 1) {
      stepPhase -= 1;
      sfx.step();
    }
  } else {
    stepPhase = 0.6;
  }
}

function updateFly(dt) {
  input.tookHop(); // Space means "rise" up here; swallow the edge
  const { fromX, fromZ } = steer(dt, FLY_SPEED, FLY_ACCEL, FLY_DECEL);
  const pos = gopher.pivot.position;

  const up = input.isDown('Space') || input.isDown('pad:hop');
  const down = input.sprintHeld();
  state.vy = damp(state.vy, up && !down ? ASCEND : down && !up ? -DESCEND : 0, VERTICAL_RATE, dt);

  // No lids up here. The only limit is the top of the sky.
  pos.y += state.vy * dt;
  if (pos.y > SKY.y[1]) {
    pos.y = SKY.y[1];
    state.vy = Math.min(state.vy, 0);
  }

  collide(pos, fromX, fromZ);
  const speed = faceTravel(dt, 0.3);
  state.speed01 = clamp(speed / FLY_SPEED, 0, 1);
  state.vertical01 = clamp(state.vy / ASCEND, -1, 1);

  const under = groundAt(pos.x, pos.z, pos.y);
  if (under !== -Infinity && pos.y <= under) land();
  if (pos.y < SKY.y[0] + 0.5) {
    // Nothing down here but sky. Stop the descent rather than let the world
    // run out underneath somebody enjoying themselves.
    pos.y = SKY.y[0] + 0.5;
    state.vy = Math.max(state.vy, 0);
  }
}

// ---------------------------------------------------------------------------
// What the gopher is standing in front of
// ---------------------------------------------------------------------------

function findNear() {
  if (state.mode !== 'walk' || !state.grounded) return null;
  const pos = gopher.pivot.position;
  let best = null;
  let bestDistance = REACH;
  for (const cabinet of cabinets) {
    if (!cabinet.game) continue;
    const d = Math.hypot(pos.x - cabinet.stand.x, pos.z - cabinet.stand.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = cabinet;
    }
  }
  return best;
}

function updatePrompt(dt) {
  nearCustomization = state.mode === 'walk' && state.grounded && customizationStation.inReach(gopher.pivot.position);
  const previous = near;
  near = findNear();
  if (previous && previous !== near) setLit(previous, false);
  if (near) setLit(near, true);
  gopher.setReach(near ? 1 : 0, dt);

  // Standing still at a machine, the gopher turns to face it. Without this it
  // keeps whatever heading it arrived on and ends up reaching for a coin slot
  // over its shoulder.
  if (near && state.speed01 < 0.2) {
    state.yaw = lerpAngle(state.yaw, near.faceYaw, 1 - Math.exp(-7 * dt));
    gopher.pivot.rotation.y = state.yaw;
  }

  // There is no way out of the sky, on purpose. A ring on the welcome cloud
  // used to close an INSTALLED arcade, and it worked once per launch at best:
  // a browser only lets a page close a window whose session history holds a
  // single entry, and playing any machine pushes a #play entry that going back
  // never removes — so from the first game onward window.close() was refused
  // for the rest of the session, and on iOS it is refused from the start. A
  // way out that works for the first thirty seconds is worse than none, so
  // the arcade closes the way every installed app does: from the system. The
  // games keep their own quit (exit.js), which hands them back to the sky.
  if (near) {
    ui.prompt.hidden = false;
    ui.promptTitle.textContent = near.game.title;
    ui.promptCue.innerHTML = input.IS_TOUCH ? 'tap <kbd>PLAY</kbd>' : '<kbd>E</kbd> play game';
  } else if (nearCustomization) {
    ui.prompt.hidden = false;
    ui.promptTitle.textContent = 'Dresser';
    ui.promptCue.innerHTML = input.IS_TOUCH ? 'tap <kbd>DRESS</kbd>' : '<kbd>E</kbd> customize gopher';
  } else {
    ui.prompt.hidden = true;
  }

  // The one button under UP says what the gopher can actually do from here.
  // Being at a machine beats everything, because it is the point of the place;
  // otherwise the air means sink and the ground means run.
  input.setAction(near ? 'play' : nearCustomization ? 'dress' : state.mode === 'fly' ? 'descend' : 'run');
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/** True while a finger or the mouse is dragging the orbit: then it is theirs. */
let dragging = false;
scene.onPointerObservable.add((info) => {
  if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) dragging = true;
  else if (info.type === BABYLON.PointerEventTypes.POINTERUP) dragging = false;
});

function updateCamera(dt) {
  // While a coin is in the machine the camera belongs to updateDive, and two
  // things writing alpha in one frame is a fight neither wins.
  if (phase === 'customizing') {
    // Back off far enough that a gopher's width fits across the preview pane,
    // whatever shape the dialog left it — a tall column beside the drawer, or
    // a short band above it on a phone. fitOutfitPreview measures the pane;
    // guessing the split a second time here is how the two used to disagree.
    camera.radius = Math.max(2.8, .50 / (Math.tan(camera.fov / 2) * outfitAspect));
    return;
  }
  if (phase === 'diving' || phase === 'playing' || phase === 'rising') return;

  const look = input.lookState();
  if (look.x || look.y) {
    camera.alpha -= look.x * dt;
    camera.beta = clamp(camera.beta - look.y * dt, camera.lowerBetaLimit, camera.upperBetaLimit);
  }

  if (phase === 'title') {
    // A slow drift around the middle of the room while the title is up.
    camera.alpha += dt * 0.055;
    cameraTarget.position.x = damp(cameraTarget.position.x, 0, 2, dt);
    cameraTarget.position.y = damp(cameraTarget.position.y, 1.7, 2, dt);
    cameraTarget.position.z = damp(cameraTarget.position.z, 0, 2, dt);
    camera.radius = damp(camera.radius, CAMERA.titleRadius, 2, dt);
    camera.beta = damp(camera.beta, CAMERA.titleBeta, 2, dt);
    return;
  }

  const p = gopher.pivot.position;
  // Right after walking in, the rig eases from the wide title shot to the
  // gopher's shoulder instead of snapping.
  const rate = time < settleUntil ? 3 : 14;
  cameraTarget.position.x = damp(cameraTarget.position.x, p.x, rate, dt);
  cameraTarget.position.z = damp(cameraTarget.position.z, p.z, rate, dt);
  cameraTarget.position.y = damp(cameraTarget.position.y, p.y + CAMERA.height, Math.min(rate, 8), dt);

  // Drift toward the framing this activity wants, unless the player is
  // dragging the camera themselves — then it is theirs.
  if (time < ease.until && !dragging) {
    camera.radius = damp(camera.radius, ease.radius, 2.5, dt);
    camera.beta = damp(camera.beta, ease.beta, 2.5, dt);
    if (ease.alpha != null) camera.alpha = lerpAngle(camera.alpha, ease.alpha, 1 - Math.exp(-2.5 * dt));
  }
}

/**
 * Which platform the gopher is over. Only the HUD cares now — there are no
 * per-room camera distances or lighting presets left to switch, which is most
 * of what deleting the walls bought.
 */
function updatePlatform() {
  const found = platformNear(gopher.pivot.position.x, gopher.pivot.position.z);
  const name = found ? found.name : 'The open sky';
  if (found !== platform || ui.hudRoom.textContent !== name) {
    platform = found;
    ui.hudRoom.textContent = name;
  }
}

/**
 * The sky, applied once. The building damped a lighting preset per room; up
 * here there is one set of weather and the platforms differ by their own
 * materials, so this runs at boot and never again.
 */
function dressTheSky() {
  hemi.intensity = SKY_LOOK.hemi;
  hemi.diffuse = BABYLON.Color3.FromArray(SKY_LOOK.hemiColour);
  hemi.groundColor = BABYLON.Color3.FromArray(SKY_LOOK.groundColour);
  sun.intensity = SKY_LOOK.sun;
  glow.intensity = SKY_LOOK.glow;
  scene.fogDensity = SKY_LOOK.fog;
  scene.fogColor = BABYLON.Color3.FromArray(SKY_LOOK.air);
  scene.clearColor = new BABYLON.Color4(...SKY_LOOK.air, 1);
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let animateWorld = () => {};

function render() {
  const dt = Math.min(engine.getDeltaTime() / 1000, MAX_DT);
  if (dt > 0) {
    time += dt;
    input.pollGamepad();

    if (input.tookPause()) {
      if (phase === 'floor') pause();
      else if (phase === 'paused') unpause();
      else if (phase === 'customizing') closeCustomization();
    }

    if (phase === 'floor') {
      if (state.mode === 'fly') updateFly(dt);
      else updateWalk(dt);
      updatePlatform();
      updatePrompt(dt);
      // Read the coin edge unconditionally, even with nothing in reach. Guarding
      // the read behind `near` short-circuits it, which banks the press: hit E in
      // the middle of the room and the next machine you walk up to would start
      // by itself.
      // One read of the coin edge, wherever the gopher is standing: guarding
      // it behind `near` short-circuits and banks the press for later.
      const coin = input.tookCoin();
      if (near && coin) startDive(near);
      else if (nearCustomization && coin) openCustomization();
      // Other machines carry across the sky from the platforms that have
      // them; the quiet cloud is supposed to be quiet.
      if (platform?.id !== 'calm') sfx.tickAmbience(dt);
    } else if (phase === 'diving' || phase === 'rising') {
      if (dive) updateDive(dt);
    } else {
      input.tookCoin();
      input.tookHop();
      if (phase === 'paused') sfx.tickAmbience(dt);
    }

    updateCamera(dt);
    if (gopher) gopher.animate(time, dt, state);
    animateCabinets(cabinets, near, time);
    animateWorld(dt);
  }
  scene.render();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

input.attachKeyboard(window);
if (input.attachTouch(ui.touch)) ui.touch.hidden = phase !== 'floor';

ui.walkIn.addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  enterFloor();
  // The title shot has been drifting for however long the player watched it,
  // and movement is relative to the camera — so hand them a camera that is
  // behind the gopher and looking into the room, or "forward" is sideways.
  easeCamera(CAMERA.beta, CAMERA.radius, 1.8, Math.PI / 2);
  if (input.IS_TOUCH) ui.touch.hidden = false;
});

ui.resume.addEventListener('click', unpause);
ui.pauseBtn = $('pause-btn');
ui.pauseBtn.addEventListener('click', () => (phase === 'paused' ? unpause() : pause()));

/** Both switches read as a label plus a state, and say so to a screen reader. */
const paintToggle = (el, label, on) => {
  el.textContent = `${label}: ${on ? 'on' : 'off'}`;
  el.setAttribute('aria-pressed', String(on));
};
const paintAudio = () => {
  paintToggle(ui.sound, 'Room sound', sfx.isEnabled());
  if (sfx.isMusicAvailable()) {
    ui.music.disabled = false;
    paintToggle(ui.music, 'Theme music', sfx.isMusicEnabled());
  } else {
    // The theme could not be fetched or decoded. Saying so beats a switch that
    // claims to be on over silence.
    ui.music.disabled = true;
    ui.music.textContent = 'Theme music: unavailable';
    ui.music.setAttribute('aria-pressed', 'false');
  }
};
paintAudio();

ui.sound.addEventListener('click', () => {
  sfx.unlock();
  sfx.setEnabled(!sfx.isEnabled());
  paintAudio();
  if (sfx.isEnabled()) {
    sfx.startAmbience();
    sfx.click();
  } else {
    sfx.stopAmbience();
  }
});

ui.music.addEventListener('click', () => {
  sfx.unlock();
  sfx.setMusicEnabled(!sfx.isMusicEnabled());
  paintAudio();
  sfx.startMusic().then(paintAudio);
  sfx.click();
});

/**
 * How hard the sky pushes. It lives in the pause menu rather than the HUD
 * because it is set once and then never thought about again, and because a
 * frame rate is the one thing a player can judge for themselves — so this is
 * a switch to feel the difference with, not a number to be told.
 */
const paintQuality = () => {
  const lighter = quality.tier() === 'lighter';
  ui.quality.textContent = quality.probing()
    ? `Sky detail: ${Math.round(quality.pixels() * 100) / 100}x (from the link)`
    : `Sky detail: ${lighter ? 'runs lighter' : 'full'}`;
  ui.quality.setAttribute('aria-pressed', String(!lighter));
  ui.quality.disabled = quality.probing();
};
paintQuality();

ui.quality.addEventListener('click', () => {
  quality.setTier(quality.tier() === 'lighter' ? 'full' : 'lighter', knobs);
  paintQuality();
  sfx.click();
});

// The hash is the source of truth, so back / Escape / the pill all agree.
window.addEventListener('popstate', () => {
  if (!hashSlug() && phase === 'playing') stepAway();
});

/**
 * Escape out of a running game cannot come through the render loop, because
 * the loop is stopped while the game has the machine. It also only arrives at
 * all when this page rather than the iframe has focus — which is exactly why
 * the FLOOR pill exists. The key is the shortcut; the pill is the way out.
 */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && phase === 'playing') leaveGame();
});

// A tab that goes away mid-run should not keep humming.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    input.clear();
    sfx.stopAmbience();
    sfx.duckMusic(true);
  } else if (phase === 'floor' || phase === 'paused') {
    sfx.startAmbience();
    sfx.duckMusic(false);
  }
});

// ---------------------------------------------------------------------------
// Installable in its own right. The launcher's worker already covers this
// directory, but only once you have been to the launcher — arriving here
// directly left the page uncontrolled, and an uncontrolled page cannot be
// installed however good its manifest is. screen.js registers that same
// worker rather than a second one; see its header.
// ---------------------------------------------------------------------------
registerWorker();

// Dress-up is a local modal, not a game launch or a persisted profile.
const outfitDialog = $('customize-dialog');
const inventory = $('outfit-items');
const outfitPane = outfitDialog.querySelector('.outfit-preview');

/**
 * Put the render where the dialog left a hole for it, whatever shape that is.
 *
 * The preview half is a column beside the drawer on a desktop, a band above it
 * on an upright phone and a narrower column on a phone turned sideways, and
 * which one applies is decided by a media query in style.css. Measuring the
 * pane we were given — rather than hard-coding the same fractions a second
 * time here — means the two cannot drift apart, and it re-fits for free when
 * the phone is turned or Safari's URL bar slides away, neither of which tells
 * this file anything except through the box changing.
 *
 * Babylon's viewport is normalised against the render target and measures y
 * from the BOTTOM, which is the one conversion worth doing carefully.
 *
 * Watched with a ResizeObserver rather than window.resize: turning a phone,
 * Safari's URL bar sliding away and entering fullscreen all move this box, and
 * only some of them are a resize event. The box changing is the one signal
 * that is true in every case.
 */
function fitOutfitPreview() {
  if (phase !== 'customizing') return;
  const stage = ui.canvas.getBoundingClientRect();
  const pane = outfitPane.getBoundingClientRect();
  if (!stage.width || !stage.height || !pane.width || !pane.height) return;
  camera.viewport = new BABYLON.Viewport(
    (pane.left - stage.left) / stage.width,
    (stage.bottom - pane.bottom) / stage.height,
    pane.width / stage.width,
    pane.height / stage.height,
  );
  outfitAspect = pane.width / pane.height;
}
new ResizeObserver(fitOutfitPreview).observe(outfitPane);
for (const item of ACCESSORIES) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'outfit-item'; button.dataset.accessory = item.id;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="item-photo"><img alt="" hidden/><span class="item-photo-status">Loading preview…</span></span><span>${item.label}</span><small>${item.slotLabel} slot</small>`;
  button.addEventListener('click', () => {
    if (phase !== 'customizing') return;
    gopher.setAccessory(item.id, !gopher.getAccessories()[item.id]); paintOutfit(); sfx.click();
  });
  inventory.append(button);
}
function paintOutfit() {
  const worn = gopher.getAccessories();
  for (const button of inventory.children) button.setAttribute('aria-pressed', String(worn[button.dataset.accessory]));
  const count = Object.values(worn).filter(Boolean).length;
  $('outfit-count').textContent = count ? `${count} ${count === 1 ? 'item' : 'items'} selected` : 'Nothing on yet';
  $('outfit-clear').disabled = count === 0;
  $('outfit-slots').textContent = [...new Set(ACCESSORIES.map(i => i.slot))].map(slot => {
    const items = ACCESSORIES.filter(i => i.slot === slot);
    return `${items[0].slotLabel}: ${items.find(i => worn[i.id])?.label || 'empty'}`;
  }).join(' · ');
}
function openCustomization() {
  if (phase !== 'floor' || !nearCustomization) return;
  phase = 'customizing'; input.clear(); ui.prompt.hidden = true;
  document.body.classList.add('dressing-room');
  state.vx = state.vz = 0; state.speed01 = 0;
  gopher.pivot.position.copyFrom(customizationStation.stand);
  state.yaw = 0; gopher.pivot.rotation.y = 0;
  outfitCamera = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius, viewport: camera.viewport };
  camera.detachControl();
  camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
  cameraTarget.position.copyFrom(gopher.pivot.position);
  cameraTarget.position.y += .85;
  camera.alpha = Math.PI / 2; camera.beta = 1.30;
  // The pane has no box until the dialog is open, so the fit comes after it.
  paintOutfit(); outfitDialog.showModal(); fitOutfitPreview(); inventory.firstElementChild.focus();
  accessoryPreviews().then(images => {
    for (const button of inventory.children) {
      const image = button.querySelector('img');
      image.src = images[button.dataset.accessory]; image.hidden = false;
      button.querySelector('.item-photo-status').hidden = true;
    }
  }).catch(error => {
    console.warn('[dresser] Item preview unavailable', error);
    for (const status of inventory.querySelectorAll('.item-photo-status')) status.textContent = 'Preview unavailable';
  });
}
function closeCustomization() {
  if (phase !== 'customizing') return;
  outfitDialog.close(); input.clear(); phase = 'floor';
  document.body.classList.remove('dressing-room');
  Object.assign(camera, outfitCamera); outfitCamera = null;
  camera.attachControl(ui.canvas, false); ui.canvas.focus();
}
$('outfit-clear').addEventListener('click', () => {
  if (phase !== 'customizing') return;
  for (const item of ACCESSORIES) gopher.setAccessory(item.id, false);
  paintOutfit();
});
for (const [id, direction] of [['outfit-left', -1], ['outfit-right', 1]]) {
  $(id).addEventListener('click', () => {
    if (phase !== 'customizing') return;
    state.yaw += direction * Math.PI / 6;
    gopher.pivot.rotation.y = state.yaw;
  });
}
$('customize-done').addEventListener('click', closeCustomization);
outfitDialog.addEventListener('cancel', event => { event.preventDefault(); closeCustomization(); });
