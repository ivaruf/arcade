/* =============================================================================
 * cabinets.js — one machine per game, wearing that game's own colours.
 *
 * The Blender kit ships four cabinet kinds with their marquee lettering and
 * screen art baked in as meshes ("STAR HOP", nine chunky pixels). That is right
 * for a model kit and wrong for us: a machine here has to say SUPERMINE because
 * games.json says supermine. So on every instance we
 *
 *   - stamp the kind out of an AssetContainer with cloneMaterials on, which is
 *     the only reason a per-cabinet tint is possible at all: without it all six
 *     machines share one "Mint neon" material and tinting one tints the lot;
 *   - retint that accent material to the game's colour, so the cabinet's neon
 *     trim, side cheeks and marquee box match its icon;
 *   - dispose the baked lettering and screen pixels, and hang two of our own
 *     planes in their place, each carrying a canvas we draw once.
 *
 * Drawing "once" is the point. Six CRTs redrawn every frame is six canvas
 * uploads a frame for art that changes twice in a visit, so each screen has
 * exactly two states — attract, and lit up because the gopher is standing
 * there, which differ in brightness rather than in wording — and the living
 * part of the look is done for free by the glow layer plus a sine on
 * emissiveIntensity.
 *
 * Coordinates: everything below is cabinet-local and in this scene's axes, so
 * read the conversion block at the top of room.js before changing a number.
 * The screen faces local +Z, tilted 8 degrees back at the top to match the
 * bezel the model already has.
 * ========================================================================== */

import { container, footprintOf, blockerFor, PLACEMENT, SLOTS, PLATFORMS } from './room.js';

/**
 * One cabinet, in whatever colour the game is.
 *
 * The kit ships a racer with a seat and a dance kind with a floor pad, and
 * both were in rotation until the floor got crowded: a seat and a pad stick a
 * metre and a half into the room each, which is a lot of furniture to say
 * "this is a different game" when the marquee, the screen and the neon
 * already say it in that game's own colours. So every machine is the upright
 * now, and the variety is the tint.
 */
const KINDS = [{ kind: 'classic', accentMaterial: 'Mint neon', stand: 1.3, cinema: 1.25 }];
const DOUBLE = { kind: 'double', accentMaterial: 'Mint neon', stand: 1.55, cinema: 1.65, width: 2 };

/** The CRT, read off build_arcade.py's `Display` box and converted. */
const BASE_SCREEN = { y: 1.5, z: 0.288, width: 0.7, height: 0.49, tilt: 0.1396 };

/** The marquee box's front face, just in front of the lettering we remove. */
const BASE_MARQUEE = { y: 2.012, z: 0.337, width: 1.0, height: 0.2 };

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * A cabinet's neon. A manifest theme_color is the honest first choice, but most
 * of these games pick a near-black chrome colour for the browser bar, which
 * makes a terrible neon tube — so anything too dark, too pale or too grey is
 * rejected in favour of a hue hashed off the slug. Same input, same colour,
 * every visit.
 */
export function hueFor(game) {
  const stated = parseHex(game.accent) || parseHex(game.theme);
  if (stated) {
    const { h, s, l } = toHsl(stated);
    if (s > 0.22 && l > 0.16 && l < 0.82) return h * 360;
  }
  let hash = 0;
  for (const c of game.slug) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return hash % 360;
}

export const accentFor = (game) => BABYLON.Color3.FromHSV(hueFor(game), 0.72, 1);

/**
 * Push hues apart within a room.
 *
 * Now that every machine is the same upright, colour is the ONLY thing
 * distinguishing two cabinets standing side by side — and fishtank and
 * dam_break both derive a green, which under the aquarium's teal light became
 * two identical lime boxes. So each room's hues are separated to at least
 * SPREAD degrees, walking the list in floor-plan order and nudging any hue
 * that lands too near one already placed. Deterministic, and it only ever
 * moves the later machine, so the first game in a room keeps its own colour.
 */
const SPREAD = 42;
function spreadHues(hues) {
  const placed = [];
  return hues.map((hue) => {
    let h = ((hue % 360) + 360) % 360;
    for (let guard = 0; guard < 12; guard++) {
      const clash = placed.find((p) => {
        const d = Math.abs(p - h);
        return Math.min(d, 360 - d) < SPREAD;
      });
      if (clash === undefined) break;
      h = (h + SPREAD) % 360;
    }
    placed.push(h);
    return h;
  });
}

function parseHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return new BABYLON.Color3(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function toHsl(c) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d < 1e-6) return { h: 0, s: 0, l };
  let h = max === c.r ? ((c.g - c.b) / d) % 6 : max === c.g ? (c.b - c.r) / d + 2 : (c.r - c.g) / d + 4;
  h = ((h / 6) + 1) % 1;
  return { h, s: d / (1 - Math.abs(2 * l - 1) || 1), l };
}

const css = (c) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

// ---------------------------------------------------------------------------
// Screen and marquee art
// ---------------------------------------------------------------------------

/**
 * Load the game's icon so it can go on the CRT. It has to come through with
 * CORS: a canvas tainted by a no-CORS image cannot be uploaded as a WebGL
 * texture at all, which would cost us the whole screen rather than one picture.
 * Same-origin (the normal case, and every case on localhost) is unaffected.
 */
function loadIcon(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.info(`[cloudnine] no usable icon for the screen: ${src}`);
      resolve(null);
    };
    img.src = src;
  });
}

/** The attract screen, and the same screen once somebody is standing there. */
function drawScreen(ctx, w, h, game, accent, icon, lit) {
  const tint = css(accent);
  ctx.clearRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, lit ? '#101a2c' : '#080c16');
  sky.addColorStop(1, '#04060c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // A pool of the cabinet's own colour behind the art.
  const pool = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.52);
  pool.addColorStop(0, tint);
  pool.addColorStop(1, 'transparent');
  ctx.globalAlpha = lit ? 0.34 : 0.2;
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  const artSize = Math.round(h * 0.42);
  const artY = Math.round(h * 0.13);
  if (icon) {
    ctx.save();
    const r = artSize * 0.22;
    const x = (w - artSize) / 2;
    ctx.beginPath();
    ctx.roundRect(x, artY, artSize, artSize, r);
    ctx.clip();
    ctx.drawImage(icon, x, artY, artSize, artSize);
    ctx.restore();
  } else {
    // No readable icon: a monogram, the same fallback the 2D launcher uses.
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.9;
    ctx.font = `600 ${artSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((game.title || '?').trim().charAt(0).toUpperCase(), w / 2, artY + artSize / 2);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#eef2ee';
  ctx.font = `600 ${Math.round(h * 0.115)}px system-ui, sans-serif`;
  ctx.fillText(fit(ctx, (game.title || '').toUpperCase(), w * 0.88), w / 2, h * 0.71);

  if (game.tagline) {
    ctx.fillStyle = 'rgba(217,219,191,.6)';
    ctx.font = `400 ${Math.round(h * 0.062)}px system-ui, sans-serif`;
    ctx.fillText(fit(ctx, game.tagline, w * 0.86), w / 2, h * 0.79);
  }

  ctx.fillStyle = lit ? '#ffd08a' : 'rgba(250,145,16,.55)';
  ctx.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
  ctx.fillText('PLAY  GAME', w / 2, h * 0.93);

  // Scanlines and a soft tube edge, baked in rather than animated.
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(2, h * 0.012);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.globalAlpha = 1;
}

function drawMarquee(ctx, w, h, game, accent) {
  ctx.fillStyle = '#10282d'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b6a27b'; ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, w - 14, h - 14);
  ctx.fillStyle = css(accent); ctx.fillRect(w * .08, h * .13, w * .84, 3);
  ctx.fillStyle = '#fff5df'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.letterSpacing = '0px'; ctx.shadowBlur = 0;
  let size = h * .45;
  ctx.font = `650 ${size}px system-ui, sans-serif`;
  const title = game.title || '';
  const measured = ctx.measureText(title).width;
  if (measured > w * .86) size *= w * .86 / measured;
  ctx.font = `650 ${size}px system-ui, sans-serif`;
  ctx.fillText(title, w / 2, h * .55);
}

/** Squeeze a string down until it fits, then let the canvas ellipsise nothing. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) cut = cut.slice(0, -1);
  return cut + '…';
}

// ---------------------------------------------------------------------------
// Building one machine
// ---------------------------------------------------------------------------

function panel(name, { width, height }, scene) {
  const mesh = BABYLON.MeshBuilder.CreatePlane(name, { width, height }, scene);
  // Babylon planes look down -Z; a cabinet's front is +Z, so every one of these
  // turns to face out. The half-turn also puts the texture the right way round.
  mesh.rotation.y = Math.PI;
  mesh.isPickable = false;
  return mesh;
}

function emissivePanel(name, texture, scene) {
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseTexture = texture;
  mat.emissiveTexture = texture;
  mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  mat.specularColor = BABYLON.Color3.Black();
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  return mat;
}

/**
 * One cabinet: geometry, tint, screens, floor decal, collision boxes, and the
 * poses the rest of the game needs — where the gopher stands, and where the
 * camera goes when a coin drops.
 */
async function machine(scene, shadows, held, spec, game, slot) {
  const SCREEN = { ...BASE_SCREEN, width: BASE_SCREEN.width * (spec.width || 1) };
  const MARQUEE = { ...BASE_MARQUEE, width: BASE_MARQUEE.width * (spec.width || 1) };
  const floor = slot.floor ?? 0;
  const holder = new BABYLON.TransformNode(`cabinet:${game ? game.slug : spec.kind}`, scene);
  holder.position.set(slot.x, floor, slot.z);
  holder.rotation.y = slot.yaw;

  const stamped = held.instantiateModelsToScene((name) => name, true);
  for (const root of stamped.rootNodes) root.parent = holder;

  const accent = game ? BABYLON.Color3.FromHSV(slot.hue ?? hueFor(game), 0.72, 1) : null;
  for (const node of holder.getChildMeshes()) {
    node.isPickable = false;
    node.receiveShadows = true;

    // The baked marquee word and the nine screen pixels are about to be
    // replaced by our own, so they go rather than fight for the same surface.
    if (game && (node.name.startsWith('Marquee lettering') || node.name.startsWith('Screen pixel'))) {
      node.dispose();
      continue;
    }

    const mat = node.material;
    if (!mat) continue;
    if (accent && mat.name.startsWith(spec.accentMaterial)) {
      mat.albedoColor = accent.scale(0.85);
      // Side cheeks and the marquee box are a lot of surface for a tube this
      // bright: at full value the glow layer blooms a whole cabinet into one
      // white slab. This much is still unmistakably neon.
      mat.emissiveColor = accent.scale(0.42);
    }
    // The model's own screen glass sits behind our plane; darken it so the two
    // do not both glow through each other at a grazing angle.
    if (game && mat.name.startsWith('Screen glass')) {
      mat.albedoColor = new BABYLON.Color3(0.01, 0.02, 0.03);
      mat.emissiveColor = BABYLON.Color3.Black();
    }
  }

  // A blocker carries the floor it stands on, so a machine in the basement
  // does not also block the hall five metres above it.
  const blockers = footprintOf(spec.kind).map((local) => {
    const b = blockerFor(slot, local);
    b.top += floor;
    b.base = floor;
    return b;
  });
  const cabinet = { game, kind: spec.kind, holder, slot, blockers, accent, screenMesh: null };

  if (!game) {
    // Decor. The prize machine is mostly emissive perspex, which under the
    // glow layer turns the whole cabinet into a white lantern and pulls the
    // eye off the machines that matter — so its light is taken right down.
    // It is scenery, and scenery recedes.
    //
    // Once per material, not once per mesh: four window posts share one
    // "Periwinkle", and scaling it four times would leave it black.
    const dimmed = new Set();
    for (const node of holder.getChildMeshes()) {
      const mat = node.material;
      if (mat?.emissiveColor && !dimmed.has(mat)) {
        mat.emissiveColor.scaleInPlace(0.22);
        dimmed.add(mat);
      }
      node.freezeWorldMatrix();
    }
    return cabinet;
  }

  // ---- the CRT ----
  const icon = await loadIcon(game.icon);
  const screenTex = new BABYLON.DynamicTexture(`crt:${game.slug}`, { width: 512 * (spec.width || 1), height: 360 }, scene, true);
  screenTex.hasAlpha = false;
  const screen = panel(`crt:${game.slug}`, SCREEN, scene);
  screen.parent = holder;
  screen.position.set(0, SCREEN.y, SCREEN.z);
  screen.rotation.x = SCREEN.tilt;
  screen.material = emissivePanel(`crtMat:${game.slug}`, screenTex, scene);

  // ---- the marquee ----
  const marqueeTex = new BABYLON.DynamicTexture(`marquee:${game.slug}`, { width: 1024 * (spec.width || 1), height: 204 }, scene, true);
  const marquee = panel(`marquee:${game.slug}`, MARQUEE, scene);
  marquee.parent = holder;
  marquee.position.set(0, MARQUEE.y, MARQUEE.z);
  marquee.material = emissivePanel(`marqueeMat:${game.slug}`, marqueeTex, scene);
  const mctx = marqueeTex.getContext();
  drawMarquee(mctx, marqueeTex.getSize().width, 204, game, accent);
  marqueeTex.anisotropicFilteringLevel = 8;
  marqueeTex.update();
  for (const layer of scene.effectLayers || []) if (layer.addExcludedMesh) layer.addExcludedMesh(marquee);

  // ---- the spot on the floor that says stand here ----
  const decal = BABYLON.MeshBuilder.CreateDisc(`decal:${game.slug}`, { radius: 0.62, tessellation: 28 }, scene);
  decal.parent = holder;
  decal.position.set(0, 0.014, spec.stand);
  decal.rotation.x = Math.PI / 2;
  decal.isPickable = false;
  const decalMat = new BABYLON.StandardMaterial(`decalMat:${game.slug}`, scene);
  decalMat.emissiveColor = accent;
  decalMat.diffuseColor = BABYLON.Color3.Black();
  decalMat.specularColor = BABYLON.Color3.Black();
  decalMat.disableLighting = true;
  decalMat.alpha = 0.16;
  decal.material = decalMat;

  // The gopher's mark, and the camera's, both in world space so the game loop
  // never has to think about cabinet-local axes again.
  const front = new BABYLON.Vector3(Math.sin(slot.yaw), 0, Math.cos(slot.yaw));
  Object.assign(cabinet, {
    screenMesh: screen,
    screenTex,
    decalMat,
    icon,
    // Not `false`: setLit refuses to redraw a screen that is already in the
    // state asked for, and the first call has to get through.
    lit: null,
    room: slot.room || 'hall',
    floor,
    stand: new BABYLON.Vector3(slot.x + front.x * spec.stand, floor, slot.z + front.z * spec.stand),
    screenPoint: new BABYLON.Vector3(
      slot.x + front.x * SCREEN.z,
      floor + SCREEN.y,
      slot.z + front.z * SCREEN.z,
    ),
    /** ArcRotateCamera pose that ends up dead in front of the glass. */
    cameraAlpha: Math.atan2(front.z, front.x),
    cameraRadius: spec.cinema,
    /** Facing the machine means facing along -front. */
    faceYaw: Math.atan2(-front.x, -front.z),
  });

  setLit(cabinet, false);
  for (const node of holder.getChildMeshes()) {
    if (node !== screen && node !== marquee && node !== decal) node.freezeWorldMatrix();
  }
  return cabinet;
}

/** Redraw a screen only when it actually changes state. */
export function setLit(cabinet, lit) {
  if (!cabinet.screenTex || cabinet.lit === lit) return;
  cabinet.lit = lit;
  const { width, height } = cabinet.screenTex.getSize();
  drawScreen(cabinet.screenTex.getContext(), width, height, cabinet.game, cabinet.accent, cabinet.icon, lit);
  cabinet.screenTex.update();
  if (cabinet.decalMat) cabinet.decalMat.alpha = lit ? 0.5 : 0.16;
}

/**
 * Give every game a standing. A game goes to the room PLACEMENT names for it,
 * or the hall; if that room is full it falls back to the hall, and only if the
 * hall is full too does it go without a machine. Returns slots tagged with
 * their room and floor height.
 */
function floorPlan(games) {
  const free = Object.fromEntries(Object.entries(SLOTS).map(([id, list]) => [id, [...list]]));
  const heightOf = (id) => PLATFORMS.find((p) => p.id === id)?.y ?? 0;
  const plan = [];
  for (const game of games) {
    // Its own platform if PLACEMENT names one and it has room; otherwise the
    // first platform anywhere with a free standing, so a slug added to
    // games.json still gets a machine without anybody editing a floor plan.
    const wanted = PLACEMENT[game.slug];
    const room = free[wanted]?.length ? wanted : Object.keys(free).find((id) => free[id].length);
    const slot = free[room]?.shift();
    if (!slot) {
      console.info(`[cloudnine] no standing left for ${game.slug}; it has no machine`);
      continue;
    }
    plan.push({ game, slot: { ...slot, room, floor: heightOf(room) } });
  }

  // Colour is the only thing telling two identical uprights apart, so no two
  // machines in one room are allowed to share a hue.
  for (const room of new Set(plan.map((e) => e.slot.room))) {
    const here = plan.filter((e) => e.slot.room === room);
    const hues = spreadHues(here.map((e) => hueFor(e.game)));
    here.forEach((entry, i) => {
      entry.slot.hue = hues[i];
    });
  }
  return plan;
}

/**
 * Fill the floor plan. Machines are loaded one kind at a time and stamped as
 * many times as needed, so six cabinets cost three GLB downloads.
 */
export async function placeCabinets(scene, shadows, games) {
  const containers = new Map();
  const need = async (kind) => {
    if (!containers.has(kind)) containers.set(kind, await container(`machine-${kind}.glb${kind === 'double' ? '?v=side-clearance-2' : ''}`, scene));
    return containers.get(kind);
  };

  const cabinets = [];
  const plan = floorPlan(games);
  for (let i = 0; i < plan.length; i++) {
    const spec = ['neonfox', 'fishtank'].includes(plan[i].game.slug) ? DOUBLE : KINDS[i % KINDS.length];
    try {
      cabinets.push(await machine(scene, shadows, await need(spec.kind), spec, plan[i].game, plan[i].slot));
    } catch (err) {
      console.error(`[cloudnine] could not stand up a cabinet for ${plan[i].game.slug}`, err);
    }
  }

  return cabinets;
}

/**
 * Per-frame life for the machines: the glass breathes, and the one the gopher
 * is standing at breathes harder. No canvas work, so this is a handful of
 * float writes however many cabinets there are.
 */
export function animateCabinets(cabinets, near, t) {
  for (const c of cabinets) {
    if (!c.screenMesh) continue;
    const mat = c.screenMesh.material;
    const pulse = 0.86 + Math.sin(t * 1.7 + c.slot.x) * 0.08;
    mat.emissiveColor.set(pulse, pulse, pulse);
    if (c === near) {
      const flicker = 1.05 + Math.sin(t * 9) * 0.09;
      mat.emissiveColor.set(flicker, flicker, flicker);
    }
  }
}

export { TAU };
