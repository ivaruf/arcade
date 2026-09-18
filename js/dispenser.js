/* =============================================================================
 * dispenser.js — the take-home machine that stands beside a cabinet.
 *
 * A game played in the arcade is inside an iframe, and a framed document CANNOT
 * be installed: `beforeinstallprompt` only fires for a top-level page and a
 * framed manifest is ignored outright. So nothing in here installs anything.
 * What it does is send you to the game's own front door and then say, in the
 * words your particular device uses, what to do when you get there.
 *
 * It is an object rather than a menu entry on purpose. "Install this as an app"
 * is a settings sentence; a little machine beside the cabinet that hands you a
 * copy to take home is the same offer in the arcade's own language, asked at
 * the moment somebody has just decided they like the game next to it.
 *
 * ONE MACHINE, ON PURPOSE. NeonFox has one and the other six do not. This is a
 * concept being tried rather than a feature being rolled out: if it reads well
 * beside one cabinet, MACHINES below grows; if it does not, this file is
 * deleted and nothing else has to be unpicked.
 *
 * WHY THE DEVICE SNIFFING IS DUPLICATED. install.js asks the same question
 * about the arcade and explains the iPad trap at length — read it there. It
 * cannot be imported: it is a plain IIFE behind its own <script> tag rather
 * than a module, deliberately, so that a filename some blocklist dislikes takes
 * the install offer down and not the whole sky (hub CLAUDE.md §2). The two
 * copies must agree; if the trap is ever refined, refine both.
 * ========================================================================== */

import { container } from './room.js';

/**
 * Where the machines stand, in world metres. `yaw` faces the way the cabinet
 * beside it faces — Babylon's 0 looks down +Z — and `y` is the platform's own
 * height, because a reach that ignores height is a reach through a cloud.
 *
 * The NeonFox cabinet is the double at (-22, -18) facing +X, and its own reach
 * is 1.75m from a stand 1.55m out. This sits far enough along the same wall
 * that the two never both answer to E: three metres between the two standing
 * places, against 2.8 of combined reach. Closer looks tidier and costs the
 * player a machine that sometimes plays the game instead.
 */
const MACHINES = [
  { slug: 'neonfox', title: 'NeonFox', x: -22, z: -21, y: 2, yaw: Math.PI / 2 },
];

/** How far out in front the gopher stands, and how close it has to be. */
const STEP = 1.1;
const REACH = 1.05;

/** Same three answers as install.js, and the same iPad trap. See the header. */
const UA = navigator.userAgent || '';
const IPAD = /iPad/.test(UA) || (/Macintosh/.test(UA) && (navigator.maxTouchPoints || 0) > 1);
const IOS = IPAD || /iPhone|iPod/.test(UA);
const DEVICE = IOS ? 'ios' : /Android/.test(UA) ? 'android' : 'desktop';

/** True when the arcade is itself an installed app, which changes the advice. */
function inStandaloneArcade() {
  try {
    return window.ArcadeExit?.standalone() === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The object
// ---------------------------------------------------------------------------

/**
 * Stand the machines up. The model is Astra's (assets/3d/DISPENSER.md holds the
 * contract it has to meet); until it lands, and on any visit where it fails to
 * load, the procedural stand-in below has the same silhouette and the same
 * reach, because a missing asset must cost the arcade a nice object and never
 * the platform it stands on.
 */
export async function createDispensers(scene, shadows) {
  let held = null;
  try {
    held = await container('dispenser.glb', scene);
  } catch {
    // Not an error worth a stack trace: for now this file is expected to be
    // absent. It says so once, quietly, and the boxes take over.
    console.info('[cloudnine] dispenser.glb not here yet; using the plain one');
  }

  const built = MACHINES.map((spec) => {
    const root = new BABYLON.TransformNode(`Take-home machine (${spec.slug})`, scene);
    root.position.set(spec.x, spec.y, spec.z);
    root.rotation.y = spec.yaw;

    if (held) {
      const copy = held.instantiateModelsToScene((name) => `${spec.slug}:${name}`, false);
      for (const node of copy.rootNodes) node.parent = root;
      for (const group of copy.animationGroups) group.stop();
      for (const mesh of root.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        shadows?.addShadowCaster(mesh, false);
      }
    } else {
      plainDispenser(root, scene, shadows);
    }

    const stand = {
      x: spec.x + Math.sin(spec.yaw) * STEP,
      z: spec.z + Math.cos(spec.yaw) * STEP,
    };
    return {
      spec,
      stand,
      // Turned with the machine: 0.7 across the front, 0.8 deep, and the yaws
      // here are right angles, so swapping the half-extents is exact.
      blocker: {
        x: spec.x, z: spec.z,
        hx: Math.abs(0.35 * Math.cos(spec.yaw)) + Math.abs(0.40 * Math.sin(spec.yaw)),
        hz: Math.abs(0.35 * Math.sin(spec.yaw)) + Math.abs(0.40 * Math.cos(spec.yaw)),
        base: spec.y, top: spec.y + 1.95,
      },
      inReach(p) {
        return Math.abs(p.y - spec.y) < .3 && Math.hypot(p.x - stand.x, p.z - stand.z) < REACH;
      },
    };
  });

  return {
    blockers: built.map((m) => m.blocker),
    /** The machine the gopher is standing at, or null. */
    near(position) {
      for (const machine of built) if (machine.inReach(position)) return machine.spec;
      return null;
    },
  };
}

/** A cabinet's little sibling in five boxes: a body, a hood, a window, a slot
 *  and a light. No clips, because a machine that cannot whirr still dispenses. */
function plainDispenser(root, scene, shadows) {
  const B = BABYLON;
  const paint = (name, hex, metal, glow) => {
    const m = new B.PBRMaterial(name, scene);
    m.albedoColor = B.Color3.FromHexString(hex).toLinearSpace();
    m.metallic = metal; m.roughness = .5;
    if (glow) m.emissiveColor = B.Color3.FromHexString(glow).toLinearSpace().scale(.6);
    return m;
  };
  const shell = paint('Dispenser enamel', '#123039', .3);
  const brass = paint('Dispenser trim', '#b9a06e', .4);
  const glass = paint('Dispenser window', '#0a1c24', .1, '#39daf2');
  const box = (name, w, h, d, x, y, z, mat) => {
    const m = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.parent = root; m.position.set(x, y, z); m.material = mat; m.isPickable = false;
    shadows?.addShadowCaster(m, false);
    return m;
  };
  box('Dispenser body', .7, 1.55, .58, 0, .775, 0, shell);
  box('Dispenser hood', .78, .12, .66, 0, 1.61, 0, brass);
  box('Dispenser window', .5, .72, .04, 0, 1.12, .30, glass);
  box('Dispenser slot', .34, .06, .05, 0, .52, .30, brass);
  box('Dispenser foot', .74, .07, .62, 0, .035, 0, brass);
}

// ---------------------------------------------------------------------------
// The card it hands you
// ---------------------------------------------------------------------------

/**
 * Three devices, three honest answers, and one caveat that only bites inside an
 * installed arcade: a link out of the arcade's own scope opens in a Custom Tab
 * on Android, which offers no install at all. Saying so is better than handing
 * somebody steps that lead to a menu without the item in it.
 */
function steps(title) {
  if (DEVICE === 'ios') {
    return [
      `${title} opens in Safari.`,
      'Tap the Share button — the square with an arrow out of it.',
      'Choose "Add to Home Screen".',
    ];
  }
  if (DEVICE === 'android') {
    return [
      `${title} opens in your browser.`,
      'Tap the ⋮ menu, top right.',
      'Choose "Install app", or "Add to Home screen".',
    ];
  }
  return [
    `${title} opens in a new tab.`,
    'Look in the address bar for the install button — a little screen with an arrow.',
    'Chrome and Edge have one. Firefox does not, and that is not your fault.',
  ];
}

export function createTakeawayPanel({ onShut }) {
  const el = document.getElementById('takeaway-dialog');
  const heading = document.getElementById('takeaway-title');
  const blurb = document.getElementById('takeaway-blurb');
  const list = document.getElementById('takeaway-steps');
  const note = document.getElementById('takeaway-note');
  const go = document.getElementById('takeaway-go');
  const shut = document.getElementById('takeaway-shut');
  let game = null;

  go.addEventListener('click', () => {
    if (!game) return;
    // The game's own front door, one level up out of /arcade/. A new tab
    // rather than this one: the arcade is probably mid-session behind this
    // card, and taking somebody out of it to read an instruction is rude.
    window.open(`../${game.slug}/`, '_blank', 'noopener');
  });
  shut.addEventListener('click', () => onShut());
  el.addEventListener('cancel', (event) => { event.preventDefault(); onShut(); });

  return {
    open(spec) {
      game = spec;
      heading.textContent = `Take ${spec.title} home`;
      blurb.textContent =
        `${spec.title} can live on your device like anything else on it: its own icon, no address bar, and it keeps working when the internet does not.`;
      list.replaceChildren(...steps(spec.title).map((line) => {
        const item = document.createElement('li');
        item.textContent = line;
        return item;
      }));
      note.textContent = DEVICE === 'android' && inStandaloneArcade()
        ? 'You are in the installed arcade, so this opens in a plain browser window — and that kind of window has no install button. If the menu does not offer it, open the arcade in Chrome itself and come back to this machine.'
        : '';
      note.hidden = !note.textContent;
      go.textContent = `Open ${spec.title} on its own`;
      el.showModal();
    },
    close() { el.close(); },
  };
}
