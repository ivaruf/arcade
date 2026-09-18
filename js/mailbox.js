/* =============================================================================
 * mailbox.js — the box on the welcome cloud you post a letter to the arcade in,
 * and the letter you write in it.
 *
 * Both halves live here because they are one thing: an object standing in the
 * sky with two clips and a reach, and the panel that opens when you press
 * WRITE. Split across two files, neither half makes sense on its own.
 *
 * WHAT A LETTER CARRIES, and nothing else:
 *
 *     { game, version, message }
 *
 * No key, no session id, no fingerprint, no name, no address. Nothing that
 * points back at whoever wrote it — deliberately, because the people writing
 * are children and the parents page promises exactly this. It is also why the
 * arcade cannot write back: a letter with no return address has no reply
 * route, and the answer is meant to go up on the board where everyone can read
 * it. Do not add an identifier "just for threading". The day a letter can be
 * tied to a player, the promise on the parents page is a lie, and the shared
 * key namespace the hub is deliberately saving for the cosmetics pilot has
 * been chosen by accident, for a feedback form.
 *
 * THE TRADE, written where the next reader will find it, the way fishtank's
 * rendezvous.js does for its broker: whatever POST_TO points at is a third
 * party. It sees the message text and the IP address that sent it, and no
 * promise of ours binds it. Against that, it needs nothing running and nothing
 * paid for, nobody has to sign up to write, and a box that cannot be written
 * to is not a mailbox.
 *
 * The one chosen, on 2026-09-18, is FORMINIT (forminit.com, formerly
 * Getform.io, running since 2015). What decided it, in order: submissions are
 * stored inside the EEA, on AWS in Ireland, so letters from Norwegian children
 * never leave it; its free tier keeps them indefinitely rather than ageing
 * them out of the archive after thirty days, which is what ruled out the
 * better-known alternative; and its public mode wants no API key, so this page
 * holds no secret it would only be pretending to keep. The rate limiting and
 * spam filtering are its own, which is the point — they are the controls
 * nothing running in a browser can enforce. Retention is set in its dashboard
 * rather than here, and is deliberately finite.
 * ========================================================================== */

import { container } from './room.js';
import { IS_TOUCH } from './controls.js';

/**
 * Where a posted letter goes. Not a secret and never was — it is one URL in a
 * file anybody can read, which is exactly why the service behind it has to be
 * one that expects that (see the trade above).
 *
 * Emptying it is the off switch, and a graceful one: the box still stands in
 * the world and a letter can still be written and kept on the device, but the
 * panel says out loud that nothing is collecting rather than swallowing what a
 * child typed and thanking them for it.
 */
export const POST_TO = 'https://forminit.com/f/9st7655jtog';

/**
 * South-west corner of the welcome cloud, on the same wall as the parents sign
 * and the dresser and facing the same way they do (+X, into the island), so it
 * joins a row that already exists rather than starting a new one. Moving it is
 * this constant plus the stand and blocker below.
 */
const SPOT = { x: -4.9, z: 4.2, yaw: Math.PI / 2 };

/** Where the gopher stands to reach the door: a step out in front of it. */
const STAND = { x: -3.85, z: 4.2 };

/** How long a letter is allowed to be. Long enough to explain a bug, short
 *  enough that nobody writes an essay into a box with no reply. */
const ROOM = 500;

/** Draft key per §6: slug-prefixed, dot-separated, versioned. */
const DRAFT = 'arcade.mailbox.draft.v1';

// ---------------------------------------------------------------------------
// The object
// ---------------------------------------------------------------------------

/**
 * Stand the mailbox up. Async because it is the one piece of furniture on this
 * island that is a real model rather than a handful of boxes: the flag and the
 * door are animated, and hand-building those in code would be worse than the
 * 500 KB.
 */
export async function createMailbox(scene, shadows) {
  const root = new BABYLON.TransformNode('Mailbox', scene);
  root.position.set(SPOT.x, 0, SPOT.z);
  root.rotation.y = SPOT.yaw;

  let doorClip = null;
  let flagClip = null;
  let flagUp = false;

  try {
    const held = await container('mailbox.glb', scene);
    held.addAllToScene();

    // The glTF loader starts the first clip it finds the moment it lands, which
    // here is the door swinging itself open on boot. Stop everything and put
    // both pivots back to their bind pose by hand: stopping alone leaves them
    // wherever the clip had got to, and frame 0 is closed and flag-down.
    for (const clip of held.animationGroups) clip.stop();
    for (const node of held.transformNodes) {
      if (/^(MailboxDoorPivot|MailFlagPivot)$/.test(node.name)) {
        node.rotationQuaternion = BABYLON.Quaternion.Identity();
        node.rotation.setAll(0);
      }
    }
    doorClip = held.animationGroups.find((c) => c.name === 'MailboxDoorOpen') || null;
    flagClip = held.animationGroups.find((c) => c.name === 'MailFlagRaise') || null;

    for (const node of held.rootNodes) node.parent = root;
    for (const mesh of held.meshes) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      shadows?.addShadowCaster(mesh, false);
    }
  } catch (err) {
    // A missing model costs the arcade a nice object, never the island. Name
    // the file that did not arrive, because the next person to see this will
    // be looking at a mailbox made of four boxes and wondering why.
    console.warn('[cloudnine] mailbox.glb did not load; standing in a plain box', err);
    plainMailbox(root, scene, shadows);
  }

  /** Both clips run once and hold their last frame; reversed, they close. */
  const swing = (clip, forward) => {
    if (!clip) return;
    clip.stop();
    clip.start(false, 1, forward ? clip.from : clip.to, forward ? clip.to : clip.from);
  };

  return {
    // Measured off the GLB rather than guessed: the box overhangs its post
    // toward the door, so the footprint is not centred on the post itself.
    blocker: { x: -4.81, z: 4.23, hx: .6, hz: .4, base: 0, top: 1.85 },
    inReach(p) {
      return Math.abs(p.y) < .3 && Math.hypot(p.x - STAND.x, p.z - STAND.z) < 1.05;
    },
    openDoor() { swing(doorClip, true); },
    closeDoor() { swing(doorClip, false); },
    /** Up means a letter is waiting for the post, and it stays up for the visit. */
    raiseFlag() {
      if (flagUp) return;
      flagUp = true;
      swing(flagClip, true);
    },
  };
}

/** The same silhouette in four boxes, for the visit where the model is blocked
 *  or missing. No clips: a door that cannot open beats a blank island. */
function plainMailbox(root, scene, shadows) {
  const B = BABYLON;
  const paint = (name, hex, metal) => {
    const m = new B.PBRMaterial(name, scene);
    m.albedoColor = B.Color3.FromHexString(hex).toLinearSpace();
    m.metallic = metal; m.roughness = .6;
    return m;
  };
  const teal = paint('Plain mailbox enamel', '#0a2b30', .25);
  const wood = paint('Plain mailbox post', '#3d1d0d', 0);
  const box = (name, w, h, d, x, y, z, mat) => {
    const m = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.parent = root; m.position.set(x, y, z); m.material = mat; m.isPickable = false;
    shadows?.addShadowCaster(m, false);
    return m;
  };
  box('Plain mailbox post', .12, 1.15, .12, 0, .575, -.1, wood);
  box('Plain mailbox body', .66, .44, 1.0, 0, 1.37, .09, teal);
  box('Plain mailbox roof', .68, .1, 1.0, 0, 1.62, .09, teal);
  box('Plain mailbox flag', .04, .3, .12, -.37, 1.5, -.42, paint('Plain mailbox flag', '#a80a12', .1));
}

// ---------------------------------------------------------------------------
// The letter
// ---------------------------------------------------------------------------

/**
 * Wire up the panel. `subjects` is what the letter can be about, which is the
 * arcade itself plus whatever machines are actually on the floor — the same
 * list the cabinets were built from, so a game added to games.json turns up
 * here without anyone editing this file.
 *
 * `onShut` closes the world side of things (phase, camera, the door); this
 * module only ever asks.
 */
export function createLetterPanel({ subjects, onShut, onPosted }) {
  const el = document.getElementById('mailbox-dialog');
  const text = document.getElementById('letter-text');
  const room = document.getElementById('letter-room');
  const status = document.getElementById('letter-status');
  const post = document.getElementById('letter-post');
  const shut = document.getElementById('letter-shut');
  const choices = document.getElementById('letter-subjects');

  text.maxLength = ROOM;
  let subject = 'arcade';
  let sending = false;
  let postedAt = 0;

  for (const option of [{ slug: 'arcade', title: 'The arcade' }, ...subjects]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.title;
    button.dataset.slug = option.slug;
    button.setAttribute('aria-pressed', String(option.slug === subject));
    button.addEventListener('click', () => {
      subject = option.slug;
      for (const other of choices.children) {
        other.setAttribute('aria-pressed', String(other.dataset.slug === subject));
      }
    });
    choices.append(button);
  }

  /** Private mode and a full quota both throw; a lost draft is not worth a crash. */
  const remember = (value) => {
    try {
      if (value) localStorage.setItem(DRAFT, value); else localStorage.removeItem(DRAFT);
    } catch { /* nothing to do about it, and nothing to tell the player */ }
  };
  const recall = () => {
    try { return localStorage.getItem(DRAFT) || ''; } catch { return ''; }
  };

  function paint() {
    const written = text.value.trim().length;
    room.textContent = written
      ? `room for ${ROOM - text.value.length} more`
      : `room for ${ROOM} letters`;
    post.disabled = sending || !written || !POST_TO;
  }

  function say(message, tone = '') {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  async function send() {
    const message = text.value.trim();
    if (!message || sending || !POST_TO) return;
    // The only rate limit the page can enforce, and it is a speed bump rather
    // than a defence: anything running in the browser is the player's to edit.
    // Real limiting belongs at whatever POST_TO is, which is the one part of
    // this that can hold something the player cannot see.
    if (Date.now() - postedAt < 20000) {
      say('One letter at a time — give the post a minute to get going.');
      return;
    }
    sending = true;
    paint();
    say('Posting…');
    try {
      // application/json is not a CORS-safelisted content type, so this is a
      // preflighted request and the service has to answer an OPTIONS before it
      // ever sees the letter. Every form backend worth using does; if one does
      // not, the fix is x-www-form-urlencoded, which is a simple request and
      // skips the preflight, rather than anything in this page.
      //
      // Three flat fields, which is what every form backend takes. A service
      // wanting some envelope of its own gets adapted HERE and nowhere else.
      const answer = await fetch(POST_TO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          game: subject,
          version: globalThis.GOPHER_CLOUD_VERSION,
          message,
        }),
      });
      // The relay's own rate limit, which is the one that actually holds:
      // nothing in this page can. It is not a fault, so it does not get the
      // voice of one.
      if (answer.status === 429) {
        say('The post is busy just now. Give it a minute and send it again.');
        return;
      }
      if (!answer.ok) throw new Error(`post refused with ${answer.status}`);
      postedAt = Date.now();
      text.value = '';
      remember('');
      say('It is in the box, and the flag is up. Thank you!', 'good');
      onPosted?.();
    } catch (err) {
      // Keep the letter. Somebody wrote it, the sky was quiet, and losing it
      // on the way out of a failed fetch is the rudest thing this could do.
      console.warn('[cloudnine] the letter did not get out', err);
      say('It would not go — the sky is quiet. Your letter is still here, so try again in a bit.', 'bad');
    } finally {
      sending = false;
      paint();
    }
  }

  text.addEventListener('input', () => { remember(text.value); paint(); });
  post.addEventListener('click', send);
  shut.addEventListener('click', () => onShut());
  el.addEventListener('cancel', (event) => { event.preventDefault(); onShut(); });

  return {
    open() {
      text.value = recall();
      say(POST_TO ? '' : 'The post is not collecting from this box yet. Write your letter — it will keep.');
      paint();
      el.showModal();
      // On a tablet, focusing the sheet throws the on-screen keyboard over the
      // panel before the player has read a word of it. Let them tap the paper.
      if (!IS_TOUCH) text.focus();
    },
    close() {
      el.close();
    },
  };
}
