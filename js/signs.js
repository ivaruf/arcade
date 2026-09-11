/* =============================================================================
 * signs.js — the name board on each platform.
 *
 * There used to be a signpost on the welcome cloud too, with one arm per
 * platform turned to point at the real thing. It is gone, and what removed it
 * was not code: the four game islands now sit at the compass points AROUND the
 * welcome cloud, one per side, so every one of them is already in view from
 * where you arrive. Arms pointing at things you can see are clutter, and the
 * middle of the arrival island is the last place to put clutter.
 *
 * What remains is the beacons: a board on the mast of every platform, big
 * enough to read from the welcome cloud, in that platform's own colour. So you
 * do not hunt for a game — you look around, read the four boards, and fly.
 *
 * They are built here rather than in Blender for the same reason the cabinet
 * marquees are: only games.json knows what they should say, and a slug added
 * there has to grow a board without anyone opening Blender.
 *
 * Every board is TWO single-sided planes back to back rather than one
 * double-sided one. A double-sided plane shows the same UVs from behind, so
 * half the time you would be reading the text mirrored — which is exactly the
 * sort of thing that looks like a rendering bug rather than a sign.
 * ========================================================================== */

import { BEACONS, PLATFORMS } from './room.js';

const css = (c) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

/** Fit full titles by sizing the type, rather than truncating game names. */
function lettering(ctx, label, x, y, width, size, weight = 650) {
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const measured = ctx.measureText(label).width;
  if (measured > width) ctx.font = `${weight} ${size * width / measured}px system-ui, sans-serif`;
  ctx.fillText(label, x, y);
}

/** Enamel face, brass reveal and a solid backing; distinct front/back faces. */
function board(name, texture, width, height, scene, reverseTexture = texture) {
  const node = new BABYLON.TransformNode(name, scene);
  const edge = new BABYLON.StandardMaterial(`${name}:edge`, scene);
  edge.diffuseColor = new BABYLON.Color3(.34, .26, .15);
  edge.specularColor = new BABYLON.Color3(.22, .19, .13);
  const body = BABYLON.MeshBuilder.CreateBox(`${name}:frame`, { width: width + .065, height: height + .065, depth: .09 }, scene);
  body.material = edge; body.parent = node; body.isPickable = false;
  for (const [turn, image] of [[0, texture], [Math.PI, reverseTexture]]) {
    image.hasAlpha = false;
    image.anisotropicFilteringLevel = 8;
    image.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    const mat = new BABYLON.StandardMaterial(`${name}:ink:${turn}`, scene);
    mat.diffuseTexture = image; mat.emissiveTexture = image;
    mat.emissiveColor = BABYLON.Color3.White();
    mat.disableLighting = true; mat.specularColor = BABYLON.Color3.Black();
    const face = BABYLON.MeshBuilder.CreatePlane(`${name}:face`, { width, height }, scene);
    face.rotation.y = turn; face.position.z = turn === 0 ? -.047 : .047;
    face.material = mat; face.isPickable = false; face.parent = node;
    // Keep printed lettering crisp while the surrounding neon still glows.
    for (const layer of scene.effectLayers || []) if (layer.addExcludedMesh) layer.addExcludedMesh(face);
  }
  return node;
}

function enamel(ctx, w, h, tint) {
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, '#193639'); wash.addColorStop(1, '#0c2025');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#9d8966'; ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = tint; ctx.fillRect(w * .1, h * .08, w * .8, 3);
  for (const x of [21, w - 21]) for (const y of [21, h - 21]) {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = '#c2ae87'; ctx.fill();
  }
}

function drawBeacon(ctx, w, h, titles, subtitle, tint) {
  enamel(ctx, w, h, tint);
  ctx.fillStyle = '#c3b291';
  lettering(ctx, subtitle.replace(/^The /, '').toUpperCase(), w / 2, h * .23, w * .83, h * .09, 550);
  ctx.fillStyle = '#fff8e9';
  titles.forEach((title, i) => lettering(ctx, title, w / 2, h * (.57 + (i - (titles.length - 1) / 2) * .24), w * .85, h * (titles.length > 1 ? .18 : .27)));
  ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(w / 2, h * .88, 3, 0, Math.PI * 2); ctx.fill();
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

  // ---- the beacons --------------------------------------------------------
  for (const [id, mast] of Object.entries(BEACONS)) {
    const here = byPlatform.get(id);
    if (!here?.length) continue;
    const platform = PLATFORMS.find((p) => p.id === id);
    const tint = css(here[0].accent);

    const texture = new BABYLON.DynamicTexture(`beacon:${id}`, { width: 1536, height: 512 }, scene, true);
    drawBeacon(
      texture.getContext(),
      1536, 512,
      here.map((c) => c.game.title),
      platform?.name || '',
      tint,
    );
    texture.update();

    const sign = board(`beacon:${id}`, texture, 4.8, 1.6, scene);
    sign.position.set(mast.x, mast.y + mast.top + 0.9, mast.z);
    // Face the welcome cloud, which is where anyone reading it is standing.
    sign.rotation.y = Math.atan2(-mast.x, -mast.z) + Math.PI;
  }
}
