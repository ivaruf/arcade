# The arcade's half of the post

One file per correspondent, named after the mailbox id that rode along with
their letter: `gc-7f3q-k2m9-4xb8.json`. It holds **only what the arcade wrote
back**.

```json
{ "replies": [
  { "at": "2026-09-19T08:12:00.000Z", "text": "You were right, the bullets were too fast. I slowed them down — it is in the game now. Thank you for telling me." }
] }
```

## Answering

```sh
node tools/reply.mjs gc-7f3q-k2m9-4xb8 "Your answer"
git add mail && git commit && git push
```

Pushing is what delivers it. Then delete the letter from the Forminit inbox —
the free plan has no retention period, so that habit is the only one there is,
and the parents page promises it.

## Why there is no copy of their letter here

Their half of the thread is in their own browser, kept as it was typed, and the
arcade joins the two by time when the panel opens. So answering never involves
republishing what a child wrote, and their words exist in exactly two places:
their device, and the inbox you delete them from.

## What this directory is not

**Not private.** GitHub Pages will not list this directory, so nobody can
browse it, but anyone holding an id can fetch that file. Write answers you
would be content to have read out loud. Real privacy would mean encrypting
each answer to a device key, and then answering mail would need a script and a
keyring rather than a sentence.

**Not cached.** `sw.js` passes `/mail/` straight through to the network, so an
answer lands on the next visit rather than the one after it. Nothing here needs
a version bump: answering the post is a content push, not a release.

**Not a history.** If a player clears their browser storage, their id and their
half of the thread go with it, and the file here is orphaned — answers to
somebody who can no longer find them. Deleting an orphan is safe; nothing in
the arcade points at it.

## Threads that live on one machine

A browser on `localhost` gets its own id, because storage is per origin. Answer
it and you have a real conversation that only exists on the machine it happened
on — the live site could never serve that file to the device that wants it.

Those files are listed in `.gitignore` one by one, not by pattern: ignoring
`mail/` would quietly stop every real answer from ever being delivered. The
first conversation this mailbox ever held is one of them.
