/* =============================================================================
 * signs.js — the signpost and the name boards.
 *
 * An open sky has no corridors to lead you anywhere, so the wayfinding has to
 * be explicit or the arcade becomes a hunt. Two things do it:
 *
 *   the signpost   on the welcome cloud, one arm per platform, each arm
 *                  turned to point at the real thing and reading the names of
 *                  the games on it
 *   the beacons    a board on the mast of every platform, big enough to read
 *                  from the welcome cloud, in that platform's colour
 *
 * Both are built here rather than in Blender for the same reason the cabinet
 * marquees are: only games.json knows what they should say, and a slug added
 * there has to grow an arm without anyone opening Blender.
 *
 * Every board is TWO single-sided planes back to back rather than one
 * double-sided one. A double-sided plane shows the same UVs from behind, so
 * half the time you would be reading the text mirrored — which is exactly the
 * sort of thing that looks like a rendering bug rather than a sign.
 * ========================================================================== */

import { SIGNPOST, BEACONS, PLATFORMS } from './room.js';

const css = (c) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

/** Squeeze a string until it fits rather than letting it run off the board. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * A flat board carrying `texture`, readable from both sides. `parent` gets the
 * position and rotation; the two planes just hang on it.
 */
function board(name, texture, width, height, scene) {
  const node = new BABYLON.TransformNode(name, scene);
  const mat = new BABYLON.StandardMaterial(`${name}:mat`, scene);
  mat.diffuseTexture = texture;
  mat.emissiveTexture = texture;
  mat.emissiveColor = new BABYLON.Color3(0.85, 0.85, 0.85);
  mat.specularColor = BABYLON.Color3.Black();
  mat.disableLighting = true;
  texture.hasAlpha = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;

  for (const turn of [0, Math.PI]) {
    const face = BABYLON.MeshBuilder.CreatePlane(`${name}:face`, { width, height }, scene);
    face.rotation.y = turn;
    face.material = mat;
    face.isPickable = false;
    face.parent = node;
  }
  return node;
}

/** One arm of the signpost: a name, an arrow, and the platform's colour. */
function drawArm(ctx, w, h, label, tint, pointsRight) {
  ctx.clearRect(0, 0, w, h);

  // The plank, with a pointed end on whichever side it aims at.
  const tip = h * 0.42;
  ctx.beginPath();
  if (pointsRight) {
    ctx.moveTo(0, 0);
    ctx.lineTo(w - tip, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w - tip, h);
    ctx.lineTo(0, h);
  } else {
    ctx.moveTo(w, 0);
    ctx.lineTo(tip, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(tip, h);
    ctx.lineTo(w, h);
  }
  ctx.closePath();
  ctx.fillStyle = '#0a0e1c';
  ctx.fill();
  ctx.lineWidth = Math.max(3, h * 0.055);
  ctx.strokeStyle = tint;
  ctx.stroke();

  ctx.fillStyle = '#eef2ee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
  ctx.letterSpacing = `${Math.round(h * 0.05)}px`;
  ctx.fillText(fit(ctx, label.toUpperCase(), w * 0.72), w * (pointsRight ? 0.45 : 0.55), h * 0.54);
}

/** A platform's name board, for reading from a long way off. */
function drawBeacon(ctx, w, h, title, subtitle, tint) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,14,28,.92)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.16);
  ctx.fill();
  ctx.lineWidth = Math.max(4, h * 0.05);
  ctx.strokeStyle = tint;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4f8f4';
  ctx.font = `700 ${Math.round(h * 0.34)}px system-ui, sans-serif`;
  ctx.letterSpacing = `${Math.round(h * 0.04)}px`;
  ctx.fillText(fit(ctx, title.toUpperCase(), w * 0.88), w / 2, h * (subtitle ? 0.38 : 0.5));

  if (subtitle) {
    ctx.fillStyle = tint;
    ctx.font = `500 ${Math.round(h * 0.19)}px system-ui, sans-serif`;
    ctx.letterSpacing = `${Math.round(h * 0.02)}px`;
    ctx.fillText(fit(ctx, subtitle.toUpperCase(), w * 0.88), w / 2, h * 0.72);
  }
}

/**
 * Put up every sign in the sky. `cabinets` is what the machines actually
 * ended up as, so the signs describe the arcade that exists rather than the
 * one games.json hoped for.
 */
export function raiseSigns(scene, cabinets) {
  const byPlatform = new Map();
  for (const cabinet of cabinets) {
    if (!cabinet.game) continue;
    if (!byPlatform.has(cabinet.room)) byPlatform.set(cabinet.room, []);
    byPlatform.get(cabinet.room).push(cabinet);
  }

  // ---- the signpost -------------------------------------------------------
  // Arms are stacked down the mast in the order the platforms are declared,
  // so the arrangement is stable between visits.
  let level = 0;
  for (const platform of PLATFORMS) {
    const here = byPlatform.get(platform.id);
    if (!here?.length) continue;

    const tint = css(here[0].accent);
    const label = here.map((c) => c.game.title).join(' · ');
    const dx = platform.x[0] / 2 + platform.x[1] / 2 - SIGNPOST.x;
    const dz = platform.z[0] / 2 + platform.z[1] / 2 - SIGNPOST.z;

    const width = 2.0;
    const height = 0.46;
    const texture = new BABYLON.DynamicTexture(`arm:${platform.id}`, { width: 512, height: 118 }, scene, true);
    // The arm hangs off one side of the mast, so which way the point goes
    // decides which half of the plank the text sits on.
    drawArm(texture.getContext(), 512, 118, label, tint, true);
    texture.update();

    const arm = board(`signarm:${platform.id}`, texture, width, height, scene);
    // Local +X is the plank's length; turn it so +X aims at the platform.
    arm.rotation.y = Math.atan2(-dz, dx);
    arm.position.set(
      SIGNPOST.x + (dx / Math.hypot(dx, dz)) * (width / 2 + 0.1),
      SIGNPOST.y + SIGNPOST.top - 0.42 - level * 0.56,
      SIGNPOST.z + (dz / Math.hypot(dx, dz)) * (width / 2 + 0.1),
    );
    level += 1;
  }

  // ---- the beacons --------------------------------------------------------
  for (const [id, mast] of Object.entries(BEACONS)) {
    const here = byPlatform.get(id);
    if (!here?.length) continue;
    const platform = PLATFORMS.find((p) => p.id === id);
    const tint = css(here[0].accent);

    const texture = new BABYLON.DynamicTexture(`beacon:${id}`, { width: 640, height: 200 }, scene, true);
    drawBeacon(
      texture.getContext(),
      640, 200,
      here.map((c) => c.game.title).join('  +  '),
      platform?.name || '',
      tint,
    );
    texture.update();

    const sign = board(`beacon:${id}`, texture, 4.2, 1.31, scene);
    sign.position.set(mast.x, mast.y + mast.top + 0.9, mast.z);
    // Face the welcome cloud, which is where anyone reading it is standing.
    sign.rotation.y = Math.atan2(-mast.x, -mast.z) + Math.PI;
  }
}
