# The shop, and players without a server

**Status: a design, not a thing that exists.** §7 of the hub rules says to
design toward the cosmetics layer and not build it until asked, so nothing here
is implemented and nothing here is settled. The decisions at the bottom are the
owner's, and two of them cannot be taken back once taken.

The goal, in the owner's words:

> "we will be making custom skins / items that can carry trough games in the
> gaming hub. They will be cosmetic only and also only for people who wish to
> support the gaming hub."

> "users will be able to earn items trough gaming (think hats / glasses /
> trails that sort of thing) — or buy ingame, but **never to gain an in game
> advantage or unlock parts of the game for money**."

And the constraint that makes it interesting: **no backend and no database**,
not because we cannot have one, but because doing it without one is the part
worth learning. If the answer turns out to need a server, we will buy a server
— but this document is the argument that it does not.

Everything measured below was measured, on 2026-09-11, in Chrome 152. Numbers
from one browser are one browser; where that matters it says so.

---

## 1. Why a server normally exists, and how to not need one

A game backend does four jobs. Worth separating them, because only one of them
is actually hard here:

| job | why it usually needs a server | do we? |
| --- | --- | --- |
| remember what you own | somewhere durable to put it | no — see §2 |
| settle conflicts between devices | one source of truth | **no — see §3** |
| prove you paid | a webhook nobody can forge | no — see §6 |
| stop you cheating | the client is hostile | no — see §2 |

The third is solvable with signatures. The second is the interesting one, and
it is where the whole design turns.

## 2. Cheating: don't build a defence

Normally "the client owns the inventory" is fatal, because players forge items
and the economy dies. Ask who is harmed here. Cosmetics confer no advantage —
that is not a nice-to-have, it is §1 and §7 and it is the load-bearing fact of
this whole document. There are no leaderboards. fishtank's multiplayer is
host-authoritative and aimed at "my kid wants to show his friends".

So a player who opens devtools and grants themselves every hat harms nobody,
and was never going to pay. Building anti-cheat would cost real complexity to
protect something worth nothing to steal.

**Decision: no obfuscation, no checksums on earned items, no cheat detection.**
The inventory is readable and writable and that is fine. Say so in the code,
the way `fishtank/client/js/rendezvous.js` writes down the PeerJS trade, so
that the next reader knows it is a choice and not an oversight.

Paid items are different — not because forging them harms anyone, but because
paying for something anyone can type in makes paying feel stupid. They get a
signature (§6). That is a courtesy to the people who paid, not a security
boundary, and the code should say that too.

## 3. The idea that removes the database: the profile is a CRDT

A CRDT — conflict-free replicated data type — is a shape of data chosen so
that merging two copies needs no arbitration. No "who wins", no last-writer,
no server to ask. You just merge, and every replica lands in the same state no
matter what order things happened in.

That sounds academic until you look at what is actually in this profile:

- **items owned** — you never *un*-earn a hat. Only ever added.
- **achievements** — same.
- **what you are currently wearing** — a single choice, newest wins.

The first two are a **grow-only set** (a G-Set). Merging is `union`. The third
is a **last-write-wins register**: keep a timestamp beside the value and take
the newer one.

Both are *idempotent* (merging the same thing twice changes nothing),
*commutative* (order does not matter) and *associative* (grouping does not
matter). Those three properties together are what let you throw away the
server, because they mean there is no such thing as a conflict to resolve:

```
merge(A, B) === merge(B, A)
merge(A, merge(B, C)) === merge(merge(A, B), C)
merge(A, A) === A
```

Sync becomes "send my profile, receive theirs, merge both ways". Do it twice,
do it out of order, do it over a channel that duplicates messages — same
answer. **Once that is true, every transport is a valid sync channel**: a QR
code, a pasted string, a WebRTC connection, a file on a memory stick. You are
not building sync. You are building `merge`, and then anything that moves
bytes is sync.

### The rule that falls out of this, and it is not negotiable

**No spendable currency.** Coins are a counter, and counters do not merge: earn
10, spend 10 on a phone and 10 on a laptop while both are offline, merge, and
you have spent 20 you never had. Making that safe needs either a server or a
genuine distributed counter with per-replica bookkeeping, and the second is a
lot of machinery to support a thing §7 does not ask for.

Earned **unlocks** (grow-only) and **direct purchases** cover everything the
owner described. Anything that looks like a wallet is a sign the design has
drifted — and a wallet is also the shape that invites "buy coins, get random
item", which §1 forbids for better reasons than this one.

Note this is *not* the same as dam_break's budget or supermine's ore. Those are
in-fiction gameplay economies, they live in those games' own saves, and §7 says
to keep them entirely separate from this. They are allowed to be counters
because they never leave one device's save file.

## 4. What a profile looks like

A sketch, not a schema — and deliberately not naming the storage key, which is
decision (a) below:

```jsonc
{
  "v": 1,
  "id": "b3f1…",             // crypto.randomUUID(), made once, never shown
  "items": ["hat.crown", …], // G-Set: union on merge
  "got":   ["ach.flew-far"], // G-Set: union on merge
  "wear":  { "hat": ["hat.crown", 1757… ] },  // LWW: [value, timestamp]
  "at": 1757…                // last touched, for the humans reading it
}
```

`id` exists so two profiles can tell they are different people rather than the
same person on two devices, which matters when you hand a friend a hat rather
than syncing yourself. It is random, it is never sent anywhere, and it is not
an account.

Clock skew is the one wrinkle in LWW: two devices disagreeing about the time
means the "newer" choice may not be the later one. For *which hat am I
wearing*, being wrong costs a player one tap. Do not let anything important
depend on it.

## 5. Moving a profile between devices

Three transports, in the order worth building them. All three are the same
`merge` underneath.

### 5a. The continue code — build this first

The whole profile, gzipped, base64url'd, as a string you can read out, paste,
or show as a QR. It is arcade-native: consoles shipped password screens for
exactly this, and it doubles as the only backup that exists (§8).

Measured, with a deliberately fat profile — 30 items, 15 achievements, three
worn slots:

| | |
| --- | --- |
| profile as JSON | 738 B |
| gzipped (`CompressionStream`) | 276 B |
| gzip + base64url | 368 chars |
| with a 64-byte signature | 456 chars |
| QR version 40-L capacity | 2953 B |

So it fits with room to spare, and stays well inside the ~1000 characters that
scans comfortably off a screen. `CompressionStream` is in the browser already;
no library needed to *make* one.

**Encode it as a URL, not a bare string.** `BarcodeDetector` — the browser API
for reading a QR from a camera — is present in Chrome and absent in iOS Safari,
so building our own scanner would leave iPhones out. But every phone's built-in
Camera app reads a QR and offers to open a URL. Make the code
`https://ivaruf.github.io/arcade/#carry=<payload>` and the scanner problem
disappears into hardware the player already owns and already trusts. That one
detail is the difference between "works everywhere" and "works on Android".

### 5b. Pairing in the world — the fun one

We already own this. §8 and `fishtank/docs/P2P.md`: PeerJS for signalling,
namespaced room codes, two data channels, `BroadcastChannel` for two tabs in
one browser with no third party at all. `RTCPeerConnection` needs nothing
installed.

Your phone and your laptop join a private room, exchange profiles, merge both
ways. **No server ever holds your data** — the broker sees a room code and
connection metadata and never contents, which is a trade already written down
in `rendezvous.js` and should be written down again here.

And the reason to do it in the world rather than in a settings panel: §8 says a
cosmetic is *roster* data, not per-frame state, so the roster this needs is the
roster that already exists. Two gophers meet on the welcome cloud and bump into
each other to trade. Handing a friend a spare hat is then the same gesture as
syncing your own phone, which is a much better arcade than a Sync button.

Honest limits, both already documented in fishtank's README: no TURN, so
roughly one network pair in ten never connects; and two devices on one wifi
still need the internet to *find* each other, because the broker is on it.

### 5c. The wildcard: a passkey that carries the profile

This is the one worth an afternoon, because if it works it is ambient sync with
no pairing step and no server — the platform does it.

A WebAuthn credential (a passkey) syncs between your devices through iCloud
Keychain or Google Password Manager. The **`largeBlob` extension** lets you
store about a kilobyte of your own bytes alongside it. Our whole profile
gzipped was 276 bytes. So the passkey becomes the sync channel, and Apple and
Google do the moving.

The trick that makes this legal without a server: you are not authenticating
anyone. Normally the server issues a challenge and verifies the attestation.
Here nobody is being let in to anything, so you generate a random challenge
client-side, never verify it, and treat the credential purely as a keyring slot
that happens to sync. There is no account, no username that means anything, and
nothing to breach.

Measured: Chrome 152 reports `extension:largeBlob: true`, along with
`passkeyPlatformAuthenticator`, `hybridTransport` and `prf`. That is the
*client* saying it understands the extension — it is not the same as a given
authenticator honouring it, and it says nothing at all about Safari or iOS,
which is exactly where it needs to work. **Treat 5c as unproven until tried on
a real iPhone.** That test is the whole experiment.

If it works, 5a stays anyway as the backup and 5b stays anyway because trading
with a friend is the better half of it.

## 6. Paying, when you cannot take payment

You cannot take a card on a static site. You do not have to — link out to a
hosted checkout (Ko-fi, Gumroad, itch, a Stripe Payment Link) and let them be
the shop. The hard part is the entitlement coming *back*, which normally means
a webhook into a database.

Instead: **a signed grant.**

Hold an Ed25519 private key offline — on the owner's machine, never in the
repo, never on Pages. Per order, or per batch from the provider's order CSV, a
local script emits a link:

```
https://ivaruf.github.io/arcade/#grant=<payload>.<signature>
```

with a payload along the lines of
`{v:1, items:["scarf.gold"], ref:"gumroad-8f21", at:"2026-09-11"}`. The arcade
verifies it with `crypto.subtle.verify` against a public key baked into the
source, and merges the items in. No network call, no third party at runtime,
nothing to host, nothing to breach. The provider's fulfilment email delivers
the link.

Measured, both available: **Ed25519** (64-byte signature, 32-byte public key)
and **ECDSA P-256** (64-byte signature, 65-byte public key). Ed25519 is the
nicer choice — smaller key, no curve parameters to get wrong, no per-signature
randomness to leak a private key when it goes wrong. It is also the more
recent arrival in WebCrypto, so check Safari before committing; P-256 is the
conservative fallback and costs 33 bytes.

It **is** a bearer token: whoever holds the link holds the hat. That is the
same trade as §2 and the answer is the same — it is a cosmetic, sharing one
harms nobody, and a person who wanted to pay still pays.

### The receipt is the backup

This is the part that makes the no-database position defensible rather than
reckless. `localStorage` gets cleared, private windows forget, phones are
replaced. With no server we cannot restore anyone's purchase — **unless the
entitlement lives in something the player keeps.** The grant URL is exactly
that, re-clickable forever.

So the UI has to say, once, plainly, at the moment of purchase: *keep this
link, it is your receipt, it is the only copy.* Burying that would be the
dishonest version of this design.

## 7. Earning

Start with what the arcade can observe **on its own**: played all six machines,
visited every island, flew some absurd distance, found the quiet cloud. Zero
cross-repo work, ships immediately, and proves the inventory plumbing before
any game depends on it.

Then games opt in — and note that §7's open question about how shared hub code
reaches seven independent repos may already have been answered by accident.
`exit.js` is one file in this repo, included by one line per game, a classic
script that fails soft, versioned by this worker, and it survived a real
rollout on 2026-09-11. An `inventory.js` beside it would inherit a pattern that
already works rather than inventing one. That is decision (b) below, because
§7 says to ask.

## 8. The shop as a place

`machine-claw.glb` is still in the kit — "CLOUD CATCH open-frame prize machine
with toys and claw". The prize machine was removed from the welcome cloud on
2026-09-11 for having no purpose. This is the purpose, and it should come back
only with it.

**The guardrail, and it matters more than the theme:** a claw machine is
mechanically a loot box. If money buys random grabs, this is gambling, it
breaks §1's ban on dark patterns, and it does so in front of children. The
split that keeps it clean:

- **playing earns grabs** — the claw is where you spend what you earned;
- **money buys a named item you can see before you pay** — a shelf, not a
  gacha.

No timers, no daily login, no manufactured scarcity, no "one left!". §1 already
forbids all of it; a shop is just the first place where it becomes tempting.

## 9. What this deliberately cannot do

Written down so none of it is a surprise later:

- **No recovery from total loss.** Transfer is not durability. Lose every
  device without a saved continue code or grant link and the items are gone.
  Nothing without a server fixes this.
- **No revoking anything** — not a chargeback, not a refund, not a mistake.
- **No cross-device sync without the player's participation**, unless 5c works.
- **No moderation and no leaderboards**, which are server problems by nature.
- **Clock skew** can pick the wrong "currently wearing" (§4).
- **~10% of network pairs** never connect over P2P, and pairing needs both
  devices awake at once.

If any of those stops being acceptable, that is the signal to buy a database —
not a failure of this design, just the edge of it.

## 10. Decisions still open, and who they belong to

**(a) The storage key. Owner's, and irreversible.** §7 says it stays undecided
until there is real code in front of us, and that is right: a key holding
people's earned *and paid* items can never be renamed without wiping them.
`dam_break` still carries `dam-builder-save-v1` through a whole project rename
for exactly this reason. The §6 convention is `<slug>.<thing>.v<n>`, but this
one is not a game's key — it is the hub's — so even the prefix is a choice.

**(b) How shared code reaches the games.** §7 says ask before inventing an
answer. The `exit.js` pattern is the obvious candidate now that it exists and
has shipped, but it is still a decision.

**(c) Merchant of record.** Selling digital goods from Norway to wherever means
VAT and the EU's 14-day withdrawal right. Providers like Gumroad, Ko-fi and
itch can act as merchant of record and carry that; a raw Stripe Payment Link
generally leaves it with you. Worth settling before the first sale rather than
after. Not a code decision and not one to take from a design doc.

**(d) Ed25519 or P-256**, pending a Safari check (§6).

**(e) Whether paid items are visibly supporter items.** Recommended yes: it
makes a hacked-in hat socially pointless without a line of enforcement code.

## 11. The order I would build it

1. `merge` and the profile shape, with tests. No UI, no network, no shop. This
   is the whole design and it is about eighty lines.
2. The continue code (5a), which is the backup and the first real sync.
3. Earned items the arcade can see by itself (§7).
4. The claw machine, spending earned grabs (§8).
5. The passkey experiment (5c) on a real iPhone — the result decides whether
   this ever feels magic or merely works.
6. Pairing in the world (5b).
7. The shop shelf and signed grants (§6), last, because it is the only part
   that involves anyone's money.
