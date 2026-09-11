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

Everything measured below was measured, on 2026-09-11, in Chrome 152 — the
crypto, the compression, the profile sizes, and the two licence endpoints,
which were called for real from a browser rather than read about. Numbers from
one browser are one browser; where that matters it says so.

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

This rule bites harder than it first looks, and the first version of this
document broke it two sections later by having the claw machine spend "earned
grabs". Grabs are a counter. Arcade tickets are a counter. Anything you
accumulate and spend is a counter, however charming the theme, and it fails
for the ethical reason before it fails for the technical one — see §7a.

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
  "id": "b3f1…",              // crypto.randomUUID(), made once
  "name": "Bramble",          // chosen by the player; the only field that
                              // is ever shown to anybody else (§4a)

  // The three grow-only sets. Everything else is derived from them.
  "earned":    ["dam.held-90s", "sky.found-quiet-cloud"],
  "claimed":   { "dam.held-90s": "hat.crown" },   // feat -> item chosen
  "purchased": ["scarf.gold"],                    // via a signed grant (§6)

  "wear": { "hat": ["hat.crown", 1757… ] },  // LWW: [value, timestamp]
  "at": 1757…                 // last touched, for the humans reading it
}
```

**What you own** is derived: the values of `claimed`, union `purchased` (union
`extra`, which only exists to settle a rare merge — see below).
**What is waiting for you** is derived too: `earned` minus the keys of
`claimed`. Nothing stores a list of owned items, because a derived value
cannot drift out of step with the thing it is derived from.

### Why three sets and not one

They could be collapsed into a single `items` list. They should not be, and the
reason is not tidiness — the three have **different provenance and different
recovery guarantees**, and the code needs to be able to tell them apart:

| | how it got there | if it is lost |
| --- | --- | --- |
| `earned` | you did something in a game | play again — annoying, not unfair |
| `claimed` | you chose it at the counter | as above |
| `purchased` | somebody paid money | **cannot be recovered without the receipt (§6)** |

That last row is the entire reason to keep them separate. A lost earned hat is
a shrug; a lost paid one is a person out of pocket with nothing to show, and no
server to ask. So `purchased` is the only set that has to be treated as
precious — it is what the grant link restores, it is what the "keep this, it is
your receipt" line is about, and it is what makes a supporter item renderable
as a supporter item without a second flag (decision (e)).

The sets are allowed to overlap. A hat that can be either earned or bought
appearing in both is harmless: union is union.

### The one conflict, and the generous answer

`earned` and `purchased` are plain sets and merge by union with nothing to
decide. `claimed` is a map, which is grow-only only as long as each key is
written once — and there is exactly one way to break that: claim the same feat
on two devices while both are offline, and pick a different item each time.

The tempting fix is a timestamp tiebreak, which drags clock skew (§4) into the
one place it would actually cost something. The better fix is to notice what is
being fought over: two cosmetic hats, worth nothing to anybody (§2).

**On conflict, grant both.** `claimed` keeps whichever item id sorts lower, so
every replica agrees without consulting a clock; the other item goes into
`extra`, a fourth grow-only set that exists for this and nothing else and
merges by union like the others. Owned then reads: values of `claimed`, union
`purchased`, union `extra`.

Nobody loses a hat they picked, the structure stays grow-only, and a whole
class of distributed-systems problem is closed by being generous instead of
being clever — which is available precisely because the thing being fought over
is worth nothing (§2). It is also rare enough that it may never happen to
anyone; it is written down so that if it does, the answer is already decided.

`id` exists so two profiles can tell they are different people rather than the
same person on two devices, which matters when you hand a friend a hat rather
than syncing yourself. It is random and it is not an account. It goes to a peer
only during a trade, and nowhere else, ever.

The profile does not exist at all until the player has chosen a `name` — see
§4a, which is the rule that makes all of this consented rather than assumed.

Clock skew is the one wrinkle in LWW: two devices disagreeing about the time
means the "newer" choice may not be the later one. For *which hat am I
wearing*, being wrong costs a player one tap. Do not let anything important
depend on it.

## 4a. Who earns things: the name on the save file

**Only a player who has chosen a name earns anything.** Until then the arcade
is anonymous: it plays, it keeps nothing, and it has written nothing to disk.

This looks like it contradicts §1's "no accounts". It does not, and the
distinction is worth being exact about, because the whole privacy posture of
the hub rests on it. There is no server, no credential, no password, no
recovery, no verification and nothing transmitted. It is **a name on a save
file**, the way every console game did it before 2005. What it buys is
consent: a profile exists because somebody asked for one, not because they
loaded a page.

Signing up is one act — pick a name, and `crypto.randomUUID()` is written
beside it. That is the whole ceremony.

Three things keep it an invitation rather than a toll gate:

- **It never gates playing.** Only earning. Anyone can fly, fall, and play
  every machine in the sky forever without being asked for anything.
- **The ask comes at the motivated moment.** Not on the title card, which is
  exactly the friction §1 exists to prevent. The instant somebody does
  something earnable while anonymous is the good moment: *"The dam held.
  That's worth something — who shall I put it under?"* They are already
  pleased and the question explains itself. Hold that pending item **in memory
  only**, never written to disk, so a player who says no has genuinely had
  nothing stored about them. Say yes in the same session and you keep what you
  just did.
- **Guest state is visible.** A precondition nobody can see is a nasty
  surprise: play well for an hour, discover none of it counted. The HUD
  already names where you are standing; a quiet "playing as a guest" line
  beside it costs nothing and removes the surprise entirely.

### The name is the one thing that leaves the device

Everything else here stays local. A name does not: a P2P trade shows it to
another human (§5b). §8 of the hub rules already says to validate guest input
and check names against an allowlist, and that applies to this.

Beyond validating and length-capping, **suggest names rather than presenting an
empty box.** A list of gopher-ish suggestions with a shuffle button is
friendlier, and for a hub that children play it makes the path of least
resistance something other than typing a real name. An empty field with a
blinking cursor is a small invitation to do the wrong thing.

### What it buys back

Pairing becomes honest. Two devices meet, compare ids, and the arcade can ask
the right question instead of guessing: *"This is Ada's arcade — sync, or
trade?"* Same id means one person on two devices; different id means two
people. Without a name, that difference is invisible to the human being asked.

A grant link (§6) clicked by someone with no profile follows the same rule as
anything else earnable: hold it, ask for a name, then apply it.

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

**The data model does not care which provider it is.** `purchased` is a
grow-only set that only ever asks "did something I trust say this?" — so the
issuing mechanism can start as a person with a script and become an automated
issuer, or a real backend, without touching the profile, migrating anything, or
invalidating a single receipt. Choose the provider on tax and checkout-quality
grounds (decision (c)), not technical ones. Nothing here locks that in.

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

### Who takes the money: Lemon Squeezy, for now

**Settled 2026-09-11, provisionally and while testing.** Gumroad is the
fallback. The decision is worth less than it looks, and that is by design: see
the paragraph above — `purchased` only asks whether something it trusts said
so, so the provider can be swapped without migrating a profile or invalidating
a receipt. This is a reversible decision wearing the costume of an
irreversible one.

Both are **merchant of record**, which is the thing that actually matters
(§10c): they are the legal seller, and they calculate, collect and remit VAT
and sales tax worldwide. Selling from Norway to wherever without that is a tax
administration problem no hobby project should take on.

And both can be verified from a static page, which was measured rather than
assumed — one POST each, dummy data, from a real browser origin:

```
POST api.lemonsqueezy.com/v1/licenses/validate   -> 404 {"valid":false,"error":"license_key not found."}
POST api.gumroad.com/v2/licenses/verify          -> 404 {"success":false,"message":"That license does not exist…"}
```

CORS permits reading both. **So automatic fulfilment with no backend is real**,
not a hope: the buyer pastes the key their receipt gave them, the arcade asks
the provider, `purchased` gains the item. Neither endpoint needs a secret, so
nothing has to be hidden and there is nothing a static page cannot do.

The usual objection to verifying a licence client-side is that a user can stub
the response. That is the same objection §2 already answered: stubbing it gets
you a cosmetic hat that confers nothing on you and costs nobody anything.

On price, Lemon Squeezy is roughly 5% + $0.50 (plus about 1.5% international)
against Gumroad's 10% + $0.50 with card processing on top — about $0.95 versus
$1.70 on a $7 sale. At the volume this hub will see that difference is tens of
dollars a year and is *not* why it was chosen; it was chosen because it is at
least as good on everything that is not price. If sales ever become real money,
revisit it deliberately rather than because something forced you.

**Price a supporter unlock at $5–10, not $2 a hat.** The fixed per-sale fee is
what decides that: it eats a tenth of a $7 sale and nearly half of a $2 one.
That happens to be the healthier shape anyway — one adult-sized act of support
rather than a catalogue of small impulses in a hub that children play, which is
the thing §1 exists to keep out.

### Keep your own order records, whoever it is

A licence key is only worth something while the issuer's endpoint answers. Both
of these are fine today; neither is promised in five years — Lemon Squeezy in
particular is owned by Stripe, which has since launched its own merchant-of-
record product built by the same team and described as the successor.

So the provider's API is a **convenience for day one, not the durable
artifact**. Export the order list and keep it. The permanent fallback is
issuing a signed grant by hand (above) against a key we control, verified
offline, forever. That is what makes "the receipt is the backup" true rather
than aspirational, and it is the reason none of this is a lock-in.

### Stripe, and why not

Stripe direct is the obvious name to reach for and the weakest fit here, for
two reasons that are both about it being the most bring-your-own-server of
them.

Fulfilment first: a Payment Link can redirect to a page we host and append a
`session_id`, but *verifying* that id means calling Stripe with a secret key,
which cannot live in a static page. The redirect proves nothing on its own —
anyone could type one — so fulfilment reverts to manual grants.

Tax second, and larger: Stripe is a payment processor, not a merchant of
record, so VAT and the EU's 14-day withdrawal right stay with us. That is the
whole problem the two above solve.

### It is a bearer token

Whoever holds the link holds the hat. That is the
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

## 7a. Tickets, and why there are none

Arcade tickets are the obvious fit for a place like this: win, get tickets,
walk to the counter, choose a prize. The first version of this document
smuggled them in as "earned grabs" for the claw machine and did not notice.

They are out, and the reason is worth keeping because it is not squeamishness.
It is about **what the reward measures**. Tickets reward volume: play more, the
number goes up, eventually a prize. The number becomes the goal, and a player's
relationship with a game quietly turns into tickets-per-minute. An earned item
rewards a moment — *the dam held for ninety seconds*, *you found the quiet
cloud*, *you dug to five hundred metres*.

> Tickets remember how long you played. An item remembers what you did.

Everything grim about real redemption arcades — punishing exchange rates,
near-misses, the nine-thousand-ticket bear — is engineering of the gap between
the number and the prize. Nobody would build those on purpose, but the shape
invites them: once a counter exists somebody has to choose its rate, and every
rate is a decision about how long to keep a person playing. That is the machine
§1 is describing when it bans dark patterns.

Be fair to tickets, though, because they buy one genuinely good thing:
**choice**. The walk to the counter, weighing the big bear against three small
things, is the actual pleasure of a redemption arcade. Pure achievements throw
that away — you get the item the designer picked, and a less skilled player may
never reach it at all. So the goal is not to drop tickets. It is to **keep the
choosing and lose the counting**.

### What replaces them: earn the thing, claim it at the counter

The item is won outright in the game, and waits at the arcade to be collected.
Three details make that work rather than being tickets with extra steps:

- **The set is finite.** A collection ends; a treadmill does not. Knowing there
  are twelve things to find in supermine is a different feeling from knowing
  tickets accrue for ever.
- **Nothing expires, ever.** The moment a claim has a deadline you have
  invented FOMO. It waits indefinitely. There is no notification either: it is
  a pull, not a push.
- **The choosing moves to the counter.** You earned *a claim*; which item you
  take is yours to pick. That is where the ticket-counter pleasure lives, with
  no exchange rate to tune and nothing to grind.

And it costs nothing architecturally, which is the pleasing part. `earned` and
`claimed` are both grow-only sets; pending is the difference between them. Both
merge by union, so a claim won on a phone is waiting at the counter on a laptop
with no counter anywhere in sight — and §3's rule is kept rather than bent.

## 8. The shop as a place

`machine-claw.glb` is still in the kit — "CLOUD CATCH open-frame prize machine
with toys and claw". The prize machine was removed from the welcome cloud on
2026-09-11 for having no purpose. This is the purpose, and it should come back
only with it.

**The guardrail, and it matters more than the theme:** a claw machine is
mechanically a loot box. If money buys random grabs this is gambling, it breaks
§1's ban on dark patterns, and it does so in front of children. The split that
keeps it clean:

- **the claw is how you choose, not how you gamble.** You come to it holding a
  claim you already earned (§7a), you steer it to the toy you want, and it
  never misses. Skill that can fail is a slot machine; a claw that always
  works is a nice way to point at things.
- **money buys a named item you can see before you pay** — a shelf, not a
  gacha.

Nothing is bought with anything that accumulates, because nothing accumulates
(§3, §7a).

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

**(c) Merchant of record. SETTLED 2026-09-11: Lemon Squeezy, provisionally,
while testing** — Gumroad the fallback if onboarding stalls, which is the one
reported friction. Both are merchant of record and both were measured to be
verifiable from a static page (§6). Reversible by construction, and the reason
it needed settling at all is that selling from Norway to wherever without a
merchant of record is a tax problem no hobby project should own.

**(d) Ed25519 or P-256**, pending a Safari check (§6).

**(e) Whether paid items are visibly supporter items.** Recommended yes: it
makes a hacked-in hat socially pointless without a line of enforcement code.

**(f) Multiple profiles on one device.** A shared family iPad is a real case
here. Profiles keyed by id allow it and the data model already does, but
whether there is a switcher is a product call rather than a technical one.

## 11. The order I would build it

1. `merge` and the profile shape, with tests. No UI, no network, no shop. This
   is the whole design and it is about eighty lines.
2. Choosing a name (§4a) — the smallest possible ceremony, and the thing that
   decides a profile exists at all.
3. The continue code (5a), which is the backup and the first real sync.
4. Earned items the arcade can see by itself (§7), and claims waiting at the
   counter (§7a).
5. The claw machine as the way to choose a claim (§8).
6. The passkey experiment (5c) on a real iPhone — the result decides whether
   this ever feels magic or merely works.
7. Pairing in the world (5b).
8. The shop shelf and signed grants (§6), last, because it is the only part
   that involves anyone's money.
