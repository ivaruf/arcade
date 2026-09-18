/**
 * Answer a letter.
 *
 *   node tools/reply.mjs gc-7f3q-k2m9-4xb8 "You were right, the bullets were
 *   too fast. I slowed them down — it is in the game now. Thank you."
 *
 * Appends to mail/<id>.json, creating it on the first answer, and does nothing
 * else: no template, no build, no deploy. Committing and pushing is what
 * delivers it, the same as every other change here.
 *
 * It exists because the alternative is hand-editing JSON at the end of a long
 * day — one missing comma in a file the arcade fetches with no error handling
 * worth the name, and a child standing at the mailbox sees nothing at all.
 * This writes valid JSON or it writes nothing.
 *
 * What it will not do is echo back what the child wrote. Their half of the
 * thread lives in their own browser and in the Forminit inbox; the arcade
 * never republishes it. See js/mailbox.js.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ID = /^gc-[0-9abcdefghjkmnpqrstvwxyz]{4}-[0-9abcdefghjkmnpqrstvwxyz]{4}-[0-9abcdefghjkmnpqrstvwxyz]{4}$/;

const [id, ...rest] = process.argv.slice(2);
const text = rest.join(' ').trim();

if (!id || !text) {
  console.error('Usage: node tools/reply.mjs <mailbox id> "your answer"');
  process.exit(1);
}
// The id comes off a line in an inbox, read by eye and retyped. A typo here
// writes an answer nobody will ever fetch, and nothing would ever say so.
if (!ID.test(id)) {
  console.error(`Not a mailbox id: ${id}\nThey look like gc-7f3q-k2m9-4xb8 — three groups of four, no vowels.`);
  process.exit(1);
}

const file = resolve(HERE, '..', 'mail', `${id}.json`);
let thread = { replies: [] };
try {
  thread = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(thread.replies)) throw new Error('no replies array');
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error(`${file} exists but could not be read as a thread: ${err.message}`);
    process.exit(1);
  }
}

thread.replies.push({ at: new Date().toISOString(), text });
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(thread, null, 2)}\n`);

console.log(`${file}\n${thread.replies.length} answer${thread.replies.length === 1 ? '' : 's'} in this thread.`);
console.log('Commit and push to deliver it, then delete the letter from the inbox.');
