#!/usr/bin/env node
/* =============================================================================
 * tools/perf/bench.mjs — the two halves of bench.sh that are easier in JS.
 *
 *   node bench.mjs stage  <arcade-src> <hub> <stage-dir> <babylon-dir> <probe.js>
 *   node bench.mjs report <out-dir>
 *
 * STAGE builds the measuring copy: a directory that holds an `arcade/` whose
 * every entry is a symlink to the real tree except index.html, plus a symlink
 * to every sibling game so `../<slug>/` resolves exactly as it does on Pages.
 * index.html is the one file rewritten, and only in three places:
 *
 *   - the two jsDelivr <script> tags point at a local Babylon instead. The CDN
 *     is slow from here and sometimes absent, and a 7 MB script per run is the
 *     slowest part of a bench. Their integrity attributes go too, because SRI
 *     on a file:// script fails closed. The vendored copy must be the version
 *     index.html pins, or the numbers describe a different renderer — checked.
 *   - probe.js is added straight after the loaders, before js/main.js.
 *   - an image from an unroutable address keeps the page "loading" for ever,
 *     which stops headless Chrome deciding the page is done and exiting
 *     before the probe has finished. bench.sh kills it on PERF DONE instead.
 *
 * Nothing in js/ is touched, so the probe survives any edit to the game.
 *
 * REPORT reads Chrome's stderr, pulls out the PERF lines, writes perf.jsonl
 * and any screenshots, and prints one line per view.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'stage') stage(...args);
else if (cmd === 'report') report(...args);
else {
  console.error('usage: bench.mjs stage <src> <hub> <stage> <babylon-dir> <probe> | report <out>');
  process.exit(2);
}

function stage(src, hub, dir, babylon, probe) {
  fs.rmSync(dir, { recursive: true, force: true });
  const arcade = path.join(dir, 'arcade');
  fs.mkdirSync(arcade, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name === 'index.html' || name === '.git') continue;
    fs.symlinkSync(path.join(src, name), path.join(arcade, name));
  }
  for (const name of fs.readdirSync(hub)) {
    const full = path.join(hub, name);
    if (name === 'arcade' || name.startsWith('.') || !fs.statSync(full).isDirectory()) continue;
    fs.symlinkSync(full, path.join(dir, name));
  }

  let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  const tag = (pkg) => new RegExp(`<script\\s[^>]*src="https://cdn\\.jsdelivr\\.net/npm/${pkg}@([\\d.]+)/[^"]+"[^>]*>\\s*</script>`);
  const core = html.match(tag('babylonjs'));
  const loaders = html.match(tag('babylonjs-loaders'));
  if (!core || !loaders) {
    console.error('stage: could not find the jsDelivr Babylon <script> tags in index.html — has the pin moved?');
    process.exit(1);
  }
  const local = (f) => `file://${path.resolve(babylon, f)}`;
  for (const f of ['babylon.js', 'loaders.js']) {
    if (!fs.existsSync(path.join(babylon, f))) {
      console.error(`stage: ${path.join(babylon, f)} missing — pass -b <dir with babylon.js and loaders.js>`);
      process.exit(1);
    }
  }
  const head = fs.readFileSync(path.join(babylon, 'babylon.js'), 'utf8').slice(0, 4e6);
  if (!head.includes(`"${core[1]}"`)) {
    console.error(`stage: WARNING ${babylon}/babylon.js does not look like ${core[1]}, the version index.html pins`);
  }
  html = html.replace(core[0], `<script src="${local('babylon.js')}"></script>`);
  html = html.replace(loaders[0], `<script src="${local('loaders.js')}"></script>\n<script src="file://${path.resolve(probe)}"></script>`);
  const hang = '<img alt="" hidden src="http://10.255.255.1/perf-hold-open.png">';
  html = html.includes('</body>') ? html.replace('</body>', `${hang}\n</body>`) : `${html}\n${hang}\n`;
  fs.writeFileSync(path.join(arcade, 'index.html'), html);
}

function report(out) {
  const raw = fs.readFileSync(path.join(out, 'stderr.txt'), 'utf8');
  const lines = [];
  for (const m of raw.matchAll(/INFO:CONSOLE[^\]]*\] "PERF (.*)", source: /g)) lines.push(m[1]);
  const shots = new Map();
  const rows = [];
  let stat = null;
  let end = null;
  const problems = [];
  for (const l of lines) {
    const sp = l.indexOf(' ');
    const kind = sp < 0 ? l : l.slice(0, sp);
    const rest = sp < 0 ? '' : l.slice(sp + 1);
    if (kind === 'SHOT') {
      const [name, part, data] = rest.split(' ');
      const [i, n] = part.split('/').map(Number);
      if (!shots.has(name)) shots.set(name, { n, parts: [] });
      shots.get(name).parts[i - 1] = data;
    } else if (kind === 'VIEW') {
      const s = rest.indexOf(' ');
      rows.push([rest.slice(0, s), JSON.parse(rest.slice(s + 1))]);
    } else if (kind === 'STATIC') stat = JSON.parse(rest);
    else if (kind === 'END') end = JSON.parse(rest);
    else if (kind === 'ERROR' || kind === 'REJECT') problems.push(l.slice(0, 300));
  }
  fs.writeFileSync(path.join(out, 'perf.jsonl'),
    lines.filter((l) => !l.startsWith('SHOT ')).join('\n') + '\n');
  for (const [name, { n, parts }] of shots) {
    if (parts.filter(Boolean).length !== n) { problems.push(`shot ${name}: ${parts.filter(Boolean).length}/${n} slices`); continue; }
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(parts.join(''), 'base64'));
  }

  const label = path.basename(out);
  if (stat) {
    console.log(`## ${label}  meshes ${stat.meshes} (drawable ${stat.drawable}, unfrozen ${stat.unfrozen})  ` +
      `materials ${stat.materials} (pbr ${stat.pbr}, frozen ${stat.frozenMaterials})  ` +
      `casters ${stat.casters} (enabled ${stat.enabledCasters})  scaling ${stat.scaling} ${stat.render.join('x')}`);
    if (stat.shadowMap) {
      console.log(`   shadow map ${stat.shadowMap}px over ${stat.shadowSpan} m = ${(stat.shadowSpan / stat.shadowMap * 100).toFixed(1)} cm/texel, filter ${stat.shadowFilter}`);
    }
  }
  console.log('view          draws  active  tris(k)   cpu  eval    rt    js  interval  p95');
  for (const [n, d] of rows) {
    console.log(`${n.padEnd(12)} ${String(d.drawCalls).padStart(6)} ${String(d.activeMeshes).padStart(7)} ` +
      `${(d.activeTris / 1000).toFixed(0).padStart(8)} ${d.cpuMs.toFixed(2).padStart(5)} ${d.evalMs.toFixed(2).padStart(5)} ` +
      `${d.rtMs.toFixed(2).padStart(5)} ${d.jsMs.toFixed(2).padStart(5)} ${d.intervalMs.toFixed(1).padStart(9)} ${d.p95.toFixed(1).padStart(5)}`);
  }
  if (end && stat && (end.meshes !== stat.meshes || end.enabledCasters !== stat.enabledCasters)) {
    console.log(`(after the run: meshes ${end.meshes}, enabled casters ${end.enabledCasters})`);
  }
  if (shots.size) console.log(`screenshots: ${[...shots.keys()].map((n) => path.join(out, `${n}.png`)).join(' ')}`);
  for (const p of problems) console.log(p);
  if (!lines.includes('DONE')) console.log('(no PERF DONE: the page timed out or never booted — see stderr.txt)');
}
