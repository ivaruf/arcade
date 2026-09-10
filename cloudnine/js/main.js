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
 *                         |
 *                         +-> leaving -> /arcade/
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
import { buildRoom, FLOOR, DOOR, SLOTS } from './room.js';
import { placeCabinets, setLit, animateCabinets } from './cabinets.js';
import { createGopher } from './gopher.js';
import * as input from './controls.js';
import * as sfx from './audio.js';
import { createLauncher, hashSlug, pushSlug, dropSlug } from './launcher.js';

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

/** Walk past this and you are leaving; the prompt starts a little before it. */
const EXIT_WARN = 5.7;

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

const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('stage'),
  boot: $('boot'),
  bootLine: $('boot-line'),
  title: $('title'),
  walkIn: $('walk-in'),
  hud: $('hud'),
  hudCount: $('hud-count'),
  prompt: $('prompt'),
  promptTitle: $('prompt-title'),
  promptCue: $('prompt-cue'),
  pause: $('pause'),
  resume: $('resume'),
  sound: $('sound'),
  music: $('music'),
  leave: $('leave'),
  touch: $('touch'),
  coinBtn: $('tbtn-coin'),
  cabinet: $('cabinet'),
  pill: document.querySelector('.pill'),
  fade: $('fade'),
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

const engine = new BABYLON.Engine(ui.canvas, true, { stencil: false, powerPreference: 'high-performance' });
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.05, 1);
scene.ambientColor = new BABYLON.Color3(0.08, 0.1, 0.14);

const cameraTarget = new BABYLON.TransformNode('cameraTarget', scene);
cameraTarget.position.set(0, 1.7, 0);

const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 2, CAMERA.titleBeta, CAMERA.titleRadius, cameraTarget.position.clone(), scene);
camera.lockedTarget = cameraTarget;
camera.lowerRadiusLimit = 2.4;
camera.upperRadiusLimit = CAMERA.maxRadius;
camera.lowerBetaLimit = 0.62;
camera.upperBetaLimit = 1.5;
camera.wheelDeltaPercentage = 0.02;
camera.pinchDeltaPercentage = 0.0015;
camera.panningSensibility = 0;
camera.minZ = 0.08;
camera.maxZ = 60;
camera.attachControl(ui.canvas, true);
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
for (const z of [-3.4, 2.6]) {
  const lamp = new BABYLON.PointLight(`lamp${z}`, new BABYLON.Vector3(0, 4.7, z), scene);
  lamp.intensity = 34;
  lamp.range = 16;
  lamp.diffuse = new BABYLON.Color3(0.55, 0.85, 0.82);
  lamp.specular = new BABYLON.Color3(0.2, 0.3, 0.35);
}

const shadows = new BABYLON.ShadowGenerator(input.IS_TOUCH ? 1024 : 2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = input.IS_TOUCH ? BABYLON.ShadowGenerator.QUALITY_LOW : BABYLON.ShadowGenerator.QUALITY_MEDIUM;
shadows.bias = 0.004;
shadows.normalBias = 0.03;

// The neon in this kit is emissive material, not lights. A glow layer is what
// turns that into the bloom the Blender renders have, and it costs one blur
// pass rather than a light per tube.
const glow = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 28, mainTextureRatio: 0.5 });
glow.intensity = 0.5;

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

/** Set once the room is loaded; see room.js for why the roof is removable. */
let roof = null;
let stepPhase = 0;
let cabinets = [];
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
  say('unlocking the doors…');
  const machinesPromise = loadMachines();
  const room = await buildRoom(scene, shadows);
  roof = room.roof;

  say('reading the machines…');
  const machines = await machinesPromise;

  say(`wheeling in ${machines.length} cabinet${machines.length === 1 ? '' : 's'}…`);
  cabinets = await placeCabinets(scene, shadows, machines, SLOTS);
  blockers = [...room.blockers, ...cabinets.flatMap((c) => c.blockers)];

  say('waking the gopher…');
  gopher = await createGopher(scene, shadows);
  gopher.pivot.position.set(0, 0, 4.6);
  gopher.pivot.rotation.y = state.yaw;

  // No environment map ships with this page, and a PBR material that is mostly
  // metal with nothing to reflect renders black. The kit only pushes past this
  // on brushed metal trim, so the metals are dialled back rather than faked.
  for (const mat of scene.materials) {
    if (mat instanceof BABYLON.PBRMaterial && mat.metallic > 0.25) {
      mat.metallic = 0.25;
      mat.roughness = Math.max(mat.roughness ?? 0.4, 0.42);
    }
  }

  ui.hudCount.textContent = `${machines.length} machines · 1 gopher`;
  ui.boot.hidden = true;

  engine.runRenderLoop(render);
  window.addEventListener('resize', () => engine.resize());

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
    sfx.startMusic();
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
  gopher.pivot.position.set(cabinet.stand.x, 0, cabinet.stand.z);
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
  ui.coinBtn.hidden = true;
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
    camera.upperBetaLimit = 1.5;
    camera.attachControl(ui.canvas, true);
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
  if (history.state?.cloudnine) dropSlug(); // popstate calls stepAway
  else stepAway();
}

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

  gopher.pivot.position.x += state.vx * dt;
  gopher.pivot.position.z += state.vz * dt;
}

/**
 * Circle against every blocker we are not already above, then the room. The
 * velocity component pointing into whatever we hit is removed, so sliding
 * along a row of cabinets feels like sliding rather than stopping dead.
 */
function collide(pos) {
  for (const b of blockers) {
    if (pos.y >= b.top) continue; // above it: hop or fly over
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

  pos.x = clamp(pos.x, -FLOOR.halfX, FLOOR.halfX);
  if (pos.z < -FLOOR.halfZ) {
    pos.z = -FLOOR.halfZ;
    state.vz = 0;
  }
  // The front wall has a doorway in it, so how far forward you may go depends
  // on whether you are aiming at the door.
  const throughDoor = Math.abs(pos.x) < DOOR.halfX && state.mode === 'walk';
  const limit = throughDoor ? DOOR.exitZ : FLOOR.halfZ;
  if (pos.z > limit) {
    pos.z = limit;
    state.vz = 0;
  }
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
  gopher.pivot.position.y = 0;
  gopher.use('walk');
  gopher.squash();
  easeCamera(CAMERA.beta, CAMERA.radius, 1.8);
  if (!silent) sfx.land();
}

function updateWalk(dt) {
  steer(dt, WALK_SPEED * (input.sprintHeld() ? SPRINT : 1), ACCEL, DECEL);
  const pos = gopher.pivot.position;
  collide(pos);

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

  if (!state.grounded) {
    state.vy -= GRAVITY * dt;
    pos.y += state.vy * dt;
    if (pos.y <= 0) {
      pos.y = 0;
      state.vy = 0;
      state.grounded = true;
      gopher.squash();
      sfx.land();
    }
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
  steer(dt, FLY_SPEED, FLY_ACCEL, FLY_DECEL);
  const pos = gopher.pivot.position;

  const up = input.isDown('Space') || input.isDown('pad:hop');
  const down = input.sprintHeld();
  state.vy = damp(state.vy, up && !down ? ASCEND : down && !up ? -DESCEND : 0, VERTICAL_RATE, dt);
  pos.y += state.vy * dt;
  if (pos.y > FLOOR.ceiling) {
    pos.y = FLOOR.ceiling;
    state.vy = Math.min(state.vy, 0);
  }

  collide(pos);
  const speed = faceTravel(dt, 0.3);
  state.speed01 = clamp(speed / FLY_SPEED, 0, 1);
  state.vertical01 = clamp(state.vy / ASCEND, -1, 1);

  if (pos.y <= 0) land();
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

  const leaving = state.mode === 'walk' && gopher.pivot.position.z > EXIT_WARN && Math.abs(gopher.pivot.position.x) < DOOR.halfX;

  if (near) {
    ui.prompt.hidden = false;
    ui.prompt.classList.remove('leaving');
    ui.promptTitle.textContent = near.game.title;
    ui.promptCue.innerHTML = input.IS_TOUCH ? 'tap <kbd>COIN</kbd>' : '<kbd>E</kbd> insert coin';
    ui.coinBtn.hidden = !input.IS_TOUCH;
  } else if (leaving) {
    ui.prompt.hidden = false;
    ui.prompt.classList.add('leaving');
    ui.promptTitle.textContent = 'The way out';
    ui.promptCue.textContent = 'keep walking to leave the arcade';
    ui.coinBtn.hidden = true;
  } else {
    ui.prompt.hidden = true;
    ui.coinBtn.hidden = true;
  }

  // Actually walking out of the door.
  if (leaving && gopher.pivot.position.z >= DOOR.exitZ - 0.02) leaveArcade();
}

function leaveArcade() {
  if (phase === 'leaving') return;
  phase = 'leaving';
  input.clear();
  sfx.back();
  sfx.stopAmbience();
  sfx.stopMusic();
  ui.prompt.hidden = true;
  ui.fade.hidden = false;

  // Leave when the room has finished going dark, driven off the fade's own
  // transition rather than a timer set to a number that has to be kept equal
  // to the CSS. It is also the only version that works everywhere: a plain
  // setTimeout here is throttled away in a headless renderer, whereas anything
  // frame-driven runs exactly as long as the fade the player can see. The
  // rAF deadline is the backstop for a browser that never sends transitionend
  // — reduced motion, or a tab hidden halfway through.
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    location.href = '../';
  };
  ui.fade.addEventListener('transitionend', go, { once: true });
  const deadline = performance.now() + 1200;
  const tick = () => {
    if (gone) return;
    if (performance.now() >= deadline) go();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(() => {
    ui.fade.classList.add('out');
    requestAnimationFrame(tick);
  });
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
  if (roof) roof.setEnabled(camera.position.y < FLOOR.wallTop);

  // While a coin is in the machine the camera belongs to updateDive, and two
  // things writing alpha in one frame is a fight neither wins.
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

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

function render() {
  const dt = Math.min(engine.getDeltaTime() / 1000, MAX_DT);
  if (dt > 0) {
    time += dt;
    input.pollGamepad();

    if (input.tookPause()) {
      if (phase === 'floor') pause();
      else if (phase === 'paused') unpause();
    }

    if (phase === 'floor') {
      if (state.mode === 'fly') updateFly(dt);
      else updateWalk(dt);
      updatePrompt(dt);
      // Read the coin edge unconditionally, even with nothing in reach. Guarding
      // the read behind `near` short-circuits it, which banks the press: hit E in
      // the middle of the room and the next machine you walk up to would start
      // by itself.
      const coin = input.tookCoin();
      if (near && coin) startDive(near);
      sfx.tickAmbience(dt);
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
ui.leave.addEventListener('click', leaveArcade);

/** Both switches read as a label plus a state, and say so to a screen reader. */
const paintToggle = (el, label, on) => {
  el.textContent = `${label}: ${on ? 'on' : 'off'}`;
  el.setAttribute('aria-pressed', String(on));
};
const paintAudio = () => {
  paintToggle(ui.sound, 'Room sound', sfx.isEnabled());
  paintToggle(ui.music, 'Theme music', sfx.isMusicEnabled());
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
// Service worker: the launcher's worker already covers /arcade/, so there is
// nothing to register here. It caches this page and these assets the first
// time they are asked for.
// ---------------------------------------------------------------------------
