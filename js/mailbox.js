/* =============================================================================
 * mailbox.js — the box on the welcome cloud you write to the arcade from, and
 * the correspondence that comes back to it.
 *
 * Both halves live here because they are one thing: an object standing in the
 * sky with two clips and a reach, and the panel that opens when you press
 * WRITE. Split across two files, neither half makes sense on its own.
 *
 * HOW A CONVERSATION IS STORED, which is the only clever thing in this file.
 * There is no database and no server, and yet the whole exchange reads back in
 * order, because it is kept in two places and joined on the device:
 *
 *   what the player wrote   never leaves this browser. Every posted letter is
 *                           kept in localStorage as it is sent, so their words
 *                           are never published anywhere — they exist in the
 *                           arcade's inbox at Forminit and nowhere else.
 *   what the arcade wrote   is `mail/<id>.json` in this repo, committed by
 *                           hand, fetched by id. It holds answers and nothing
 *                           else: no copy of the letter it answers.
 *
 * Sort the two by time and that is the thread. It means answering somebody
 * never involves republishing what a child said, which is worth more than the
 * few lines it saves.
 *
 * WHAT A LETTER CARRIES:
 *
 *     { message, game, version, mailbox }
 *
 * `mailbox` is the id below, and it is the whole reason an answer can find its
 * way back. No name, no account, no email — but it is not nothing, and the
 * parents page says so in as many words: letters from one device can be told
 * apart from letters from another, on purpose, because otherwise the arcade
 * could only ever shout into the room.
 *
 * WHAT THIS ID IS NOT is the cosmetics key. §7 of the hub's rules saves that
 * decision for the fishtank pilot, with real code in front of it, because a
 * key holding a player's earned items can never be renamed without wiping
 * them. This one names a correspondent and expires with the browser's storage.
 * If an inventory ever wants an identity it mints its own, and the two stay
 * strangers.
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
 * nothing running in a browser can enforce.
 *
 * WHAT IT RECORDS BEYOND THE LETTER, read off its own reply to a real post
 * rather than taken on trust: the sender's IP address, the user agent, the
 * referring page, and a location derived from that IP down to city and
 * coordinates. That is ordinary for a form backend and none of it is
 * something this page sends or can prevent — it is the postmark rather than
 * the letter — but it is more than "the message and an IP", and no setting
 * documented anywhere turns it off. It is why the parents page says plainly
 * that the service carrying a letter sees where it was posted from.
 *
 * Retention is a Pro-plan control; on the free tier there is none, so letters
 * sit in that inbox until they are deleted by hand. Deleting them after
 * reading is therefore a real habit with a real reason, not tidiness.
 * ========================================================================== */

import { container } from './room.js';
import { IS_TOUCH } from './controls.js';

/**
 * Where a posted letter goes. Not a secret and never was — it is one URL in a
 * file anybody can read, which is exactly why the service behind it has to be
 * one that expects that (see the trade above).
 *
 * Emptying it is the off switch, and a graceful one: the box still stands in
 * the world, old answers still read, and a letter can still be written and
 * kept on the device, but the panel says out loud that nothing is collecting
 * rather than swallowing what a child typed and thanking them for it.
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
 *  enough that nobody writes an essay into a box that answers by hand. */
const ROOM = 500;

/** Keys, per §6: slug-prefixed, dot-separated, versioned. */
const DRAFT = 'arcade.mailbox.draft.v1';
const DEVICE = 'arcade.mailbox.id.v1';
const SENT = 'arcade.mailbox.sent.v1';
const READ = 'arcade.mailbox.read.v1';

/** Answers, one committed file per correspondent. See mail/README.md. */
const MAIL = 'mail/';

// ---------------------------------------------------------------------------
// Storage, which is allowed to fail
// ---------------------------------------------------------------------------

/** Private mode and a full quota both throw, and a thread is not worth a crash. */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* nothing to do about it, and nothing to tell the player */ }
}

/**
 * No vowels, so an id can never come out as a word and can never be misread
 * between i, l, 1 and O, 0 — it gets typed into a filename by a human.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** 60 bits in three groups. Uniform because 256 divides evenly by 32. */
function mint() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
  return `gc-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

/**
 * The name this browser answers to, minted on the first letter and never
 * before: somebody who walks up, reads the box and walks away is given no
 * identifier at all, because they have not asked for an answer.
 */
function deviceId(create = false) {
  let id = load(DEVICE, '');
  if (!id && create) {
    id = mint();
    save(DEVICE, id);
  }
  return id;
}

/** Answers are hand-written JSON, so the time is an ISO string a person typed. */
const stamp = (at) => (typeof at === 'number' ? at : Date.parse(at) || 0);

/** No file is the ordinary case: most correspondents have no answer waiting. */
async function fetchAnswers(id) {
  if (!id) return [];
  try {
    const answer = await fetch(`${MAIL}${id}.json`, { cache: 'no-store' });
    if (!answer.ok) return [];
    const data = await answer.json();
    return Array.isArray(data?.replies) ? data.replies : [];
  } catch {
    return [];
  }
}

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
    /** Up means an answer is waiting, which is what a flag on a box is for. */
    raiseFlag() {
      if (flagUp) return;
      flagUp = true;
      swing(flagClip, true);
    },
    lowerFlag() {
      if (!flagUp) return;
      flagUp = false;
      swing(flagClip, false);
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
// The correspondence
// ---------------------------------------------------------------------------

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * Wire up the panel. `subjects` is what a letter can be about, which is the
 * arcade itself plus whatever machines are actually on the floor — the same
 * list the cabinets were built from, so a game added to games.json turns up
 * here without anyone editing this file.
 *
 * `onShut` closes the world side of things (phase, camera, the door) and
 * `onRead` drops the flag; this module only ever asks.
 */
export function createLetterPanel({ subjects, onShut, onRead }) {
  const el = document.getElementById('mailbox-dialog');
  const text = document.getElementById('letter-text');
  const room = document.getElementById('letter-room');
  const status = document.getElementById('letter-status');
  const post = document.getElementById('letter-post');
  const shut = document.getElementById('letter-shut');
  const choices = document.getElementById('letter-subjects');
  const thread = document.getElementById('letter-thread');

  text.maxLength = ROOM;
  let subject = 'arcade';
  let sending = false;
  let postedAt = 0;
  /** Everything this browser has sent, which is the player's half of the thread. */
  let sent = load(SENT, []);
  let answers = [];

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

  /**
   * Counted when something changes, never asked for. updatePrompt reads this
   * once a frame for as long as the gopher stands at the box, and parsing JSON
   * out of localStorage sixty times a second to answer "is the flag up" is the
   * sort of thing that only shows up on somebody else's phone.
   */
  let unread = 0;
  function recount() {
    const read = load(READ, 0);
    unread = answers.reduce((n, a) => n + (stamp(a.at) > read ? 1 : 0), 0);
  }

  function note(item) {
    const article = document.createElement('article');
    article.className = `note ${item.mine ? 'mine' : 'theirs'}`;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `${item.mine ? 'You' : 'The arcade'} · ${when.format(item.at)}`;
    const body = document.createElement('p');
    body.textContent = item.text;
    article.append(who, body);
    return article;
  }

  /** The join: their half out of localStorage, ours off the wire, one order. */
  function drawThread() {
    const items = [
      ...sent.map((s) => ({ at: stamp(s.at), mine: true, text: s.text })),
      ...answers.map((a) => ({ at: stamp(a.at), mine: false, text: a.text })),
    ].sort((a, b) => a.at - b.at);

    thread.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'letter-empty';
      empty.textContent = 'Nothing in the box yet. Write the first letter and I will write back.';
      thread.append(empty);
      return;
    }
    for (const item of items) thread.append(note(item));
    // Newest at the bottom, the way a conversation reads.
    thread.scrollTop = thread.scrollHeight;
  }

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
    if (Date.now() - postedAt < 30000) {
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
      // The wrapping is Forminit's. Flat JSON is refused outright
      // (INVALID_JSON), and so is flat form-encoding, which wants
      // fi-text-<name> instead — so there is no vendor-neutral shape to retreat
      // to and no point pretending otherwise. The blocks become the form's
      // schema on the first submission. This is the one place a change of
      // service is felt.
      const answer = await fetch(POST_TO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          blocks: [
            { type: 'text', name: 'message', value: message },
            { type: 'text', name: 'game', value: subject },
            { type: 'text', name: 'mailbox', value: deviceId(true) },
            { type: 'text', name: 'version', value: globalThis.GOPHER_CLOUD_VERSION },
          ],
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
      // Kept here and nowhere else: this is the player's half of the thread,
      // and the arcade never has to publish it back to show them the exchange.
      sent = [...sent, { at: postedAt, game: subject, text: message }];
      save(SENT, sent);
      text.value = '';
      remember('');
      drawThread();
      say('It is in the box. I will write back here.', 'good');
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

  const remember = (value) => save(DRAFT, value);
  const recall = () => load(DRAFT, '') || '';

  /** Reading the box is what marks answers read, so the flag means something. */
  function markRead() {
    const newest = answers.reduce((max, a) => Math.max(max, stamp(a.at)), 0);
    if (newest > load(READ, 0)) {
      save(READ, newest);
      onRead?.();
    }
    recount();
  }

  text.addEventListener('input', () => { remember(text.value); paint(); });
  post.addEventListener('click', send);
  shut.addEventListener('click', () => onShut());
  el.addEventListener('cancel', (event) => { event.preventDefault(); onShut(); });

  return {
    /** Called once at boot, off the critical path: true if the flag goes up. */
    async checkMail() {
      answers = await fetchAnswers(deviceId());
      recount();
      return unread > 0;
    },
    hasUnread: () => unread > 0,
    open() {
      text.value = recall();
      say(POST_TO ? '' : 'The post is not collecting from this box yet. Write your letter — it will keep.');
      paint();
      // Open the dialog BEFORE drawing the thread. A hidden element has no
      // scrollHeight, so scrolling to the newest letter while the panel is
      // still display:none silently does nothing and the box opens showing
      // the oldest thing in it.
      el.showModal();
      drawThread();
      markRead();
      // On a tablet, focusing the sheet throws the on-screen keyboard over the
      // panel before the player has read a word of it. Let them tap the paper.
      if (!IS_TOUCH) text.focus();
      // An answer that landed since boot should not wait for the next visit.
      fetchAnswers(deviceId()).then((fresh) => {
        if (fresh.length === answers.length) return;
        answers = fresh;
        drawThread();
        markRead();
        say('An answer just came in.', 'good');
      });
    },
    close() {
      el.close();
    },
  };
}
