/** Registry regression: bundled cabinet art must survive missing game metadata.
 * Run from any directory with node tools/check-registry.mjs. No server needed.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../games.json', import.meta.url)));
const entry = config.games.find((game) => game.slug === 'lobbots');
assert.ok(entry, 'Lobbots is registered');
globalThis.location = new URL('http://localhost:8000/arcade/');
let available = false;
globalThis.fetch = async (url) => {
  if (url === './games.json') return { ok: true, text: async () => JSON.stringify({ ...config, games: [entry] }) };
  if (available && String(url).endsWith('/manifest.webmanifest')) {
    return { ok: true, text: async () => JSON.stringify({ name: 'LOBBOTS', start_url: './' }) };
  }
  return { ok: false };
};
const { loadMachines } = await import('../js/registry.js');
const [offline] = await loadMachines();
assert.equal(offline.icon, 'http://localhost:8000/arcade/assets/games/lobbots-192.png');
assert.equal(offline.url, 'http://localhost:8000/lobbots/');
assert.equal(offline.tagline, 'Big robots, bigger lobs.');
assert.ok(offline.description);
available = true;
const [online] = await loadMachines();
assert.equal(online.icon, offline.icon);
assert.equal(online.url, offline.url);
await readFile(new URL(`../${entry.icon}`, import.meta.url));
// The worker preloads the island under exactly the URL room.js requests; the
// runtime cache keys on the query string, so a version bumped on one side and
// not the other silently turns the preload into dead weight.
const room = await readFile(new URL('../js/room.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const asked = room.match(/container\('(lobbots-island\.glb\?v=[^']+)'/);
assert.ok(asked, 'room.js loads the Lobbots island');
assert.ok(sw.includes(`'./assets/3d/${asked[1]}'`), `sw.js preloads ${asked[1]}`);
console.log('Registry artwork and launch URLs pass with reachable and missing manifests.');
console.log(`The worker preloads the island room.js asks for (${asked[1]}).`);
