/* =============================================================================
 * tools/perf/probe.js — the instrument bench.sh puts inside a measuring copy.
 *
 * A classic script, loaded straight after Babylon and before js/main.js, into
 * a STAGED copy of the arcade (bench.sh builds it; the real index.html is
 * never touched). It does not patch a line of the game. Everything it needs
 * it takes from Babylon itself, which is the point: the scratch probe this
 * replaced found main.js's loop by exact string match, and so broke the first
 * time anybody tidied main.js — which during a performance push is every day.
 *
 *   - The engine announces itself through Engine.prototype.runRenderLoop,
 *     which main.js calls once boot() has built everything. That is "booted".
 *   - The scene is EngineStore.LastCreatedScene; there is only one.
 *   - Babylon's own SceneInstrumentation supplies draw calls, CPU frame time
 *     and active-mesh evaluation time — the same counters the numbers in
 *     PERFORMANCE.md were taken with, so old and new rows are comparable.
 *   - JS outside the renderer (every module's animate(), the gopher, input)
 *     is the render-loop callback's time minus Scene.render's, both wrapped
 *     here at the prototype. No per-module split: that needed source patches,
 *     and the baseline already showed all of it together is ~0.2 ms.
 *   - Views: the title shot, a close-up of the gopher (for its shadow), each
 *     island, the whole sky. Listed in views() below.
 *   - The camera is the probe's own, not main.js's. The title shot drifts,
 *     the chase rig follows the gopher, and two writers on one camera is a
 *     fight; a second camera made active for the run simply wins, and
 *     everything that reads scene.activeCamera (glow, shadows, culling)
 *     follows it.
 *
 * Output is console lines prefixed "PERF ", which headless Chrome writes to
 * stderr and report.mjs reads back:
 *   PERF STATIC {...}         scene totals, once
 *   PERF VIEW <name> {...}    one per view
 *   PERF SHOT <name> i/n ...  a PNG of the canvas in 60 KB base64 slices —
 *                             the console is the only channel out of a
 *                             headless page that needs no server
 *   PERF ERROR / REJECT ...   anything that went wrong on the page
 *   PERF DONE                 bench.sh stops polling and kills Chrome
 *
 * Query parameters it reads (bench.sh sets them):
 *   perfviews=title,neonfox   only these views (default: all)
 *   perfshots=1               also capture a screenshot of each view
 *   perfms=3500               how long each view is measured
 *
 * This is a measuring tape, not a test: nothing here passes or fails.
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof BABYLON === 'undefined') {
    console.log('PERF ERROR Babylon did not load before the probe');
    console.log('PERF DONE');
    return;
  }
  const params = new URLSearchParams(location.search);
  const only = (params.get('perfviews') || '').split(',').filter(Boolean);
  const wantShots = params.get('perfshots') === '1';
  const measureMs = Number(params.get('perfms')) || 3500;

  const log = (s) => console.log('PERF ' + s);
  window.addEventListener('error', (e) =>
    log('ERROR ' + (e.message || e) + ' ' + (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', (e) =>
    log('REJECT ' + String((e.reason && (e.reason.stack || e.reason)) || e).slice(0, 400)));

  // --- timing hooks, at the prototype so no game file is edited -----------
  let loopMs = 0;
  let sceneMs = 0;
  const render = BABYLON.Scene.prototype.render;
  BABYLON.Scene.prototype.render = function (...args) {
    const t = performance.now();
    const r = render.apply(this, args);
    sceneMs += performance.now() - t;
    return r;
  };
  const run = BABYLON.Engine.prototype.runRenderLoop;
  let started = false;
  BABYLON.Engine.prototype.runRenderLoop = function (fn) {
    // The launcher stops and restarts the loop with the same function; wrap
    // every time so the JS figure never silently stops counting.
    const wrapped = function () {
      const t = performance.now();
      fn();
      loopMs += performance.now() - t;
    };
    if (!started) {
      started = true;
      log('BOOTED ' + Math.round(performance.now()));
      setTimeout(() => main(this).catch((e) => { log('ERROR probe ' + (e.stack || e)); log('DONE'); }), 3000);
    }
    return run.call(this, wrapped);
  };

  // --- the fixed views ----------------------------------------------------
  // Three keep the exact cameras PERFORMANCE.md's baseline was taken from, so
  // those rows stay comparable across the whole push. The rest are generated
  // the same way from room.js's PLATFORMS: 13.5 m out from the island toward
  // the welcome cloud, 6 m up, looking at the deck — roughly how you see an
  // island as you fly in to it.
  const LEGACY = {
    neonfox: [[-9, 9, -8], [-19, 3.5, -18]],
    minimaze: [[-9, 17, 9], [-19, 12.5, 18]],
    zoodoku: [[10, 12, 9], [20, 7, 18]],
  };
  async function views() {
    const a = Math.PI / 2, b = 1.25, r = 6.4; // main.js's title framing, held still
    const out = [{ n: 'title', pos: [r * Math.cos(a) * Math.sin(b), 1.7 + r * Math.cos(b), r * Math.sin(a) * Math.sin(b)], tgt: [0, 1.7, 0] }];
    let platforms = [];
    let spawn = { x: 0, y: 0, z: 2.6 };
    try {
      // Same URL main.js imported, so the same module instance: no second world.
      const room = await import(new URL('js/room.js', location.href).href);
      platforms = room.PLATFORMS || [];
      spawn = room.SPAWN || spawn;
    } catch (e) {
      log('ERROR could not read PLATFORMS from js/room.js: ' + e);
    }
    // The gopher where it arrives, close enough to judge its shadow's edge.
    // The sun leans toward -x/+z, so the camera stands off the other way.
    out.push({ n: 'gopher', pos: [spawn.x + 1.1, spawn.y + 1.2, spawn.z + 2.2], tgt: [spawn.x - 0.3, spawn.y + 0.15, spawn.z + 0.5] });
    for (const p of platforms) {
      if (p.id === 'welcome' || p.id === 'mine_bridge') continue;
      if (LEGACY[p.id]) { out.push({ n: p.id, pos: LEGACY[p.id][0], tgt: LEGACY[p.id][1] }); continue; }
      const cx = (p.x[0] + p.x[1]) / 2, cz = (p.z[0] + p.z[1]) / 2;
      const d = Math.hypot(cx, cz) || 1;
      out.push({ n: p.id, pos: [cx - (cx / d) * 13.5, p.y + 6, cz - (cz / d) * 13.5], tgt: [cx, p.y + 1.5, cz] });
    }
    out.push({ n: 'overview', pos: [0, 30, -40], tgt: [0, 2, 0] });
    return only.length ? out.filter((v) => only.includes(v.n)) : out;
  }

  // --- scene totals ---------------------------------------------------------
  function totals(scene) {
    const sg = scene.lights.map((l) => l.getShadowGenerator && l.getShadowGenerator()).find(Boolean);
    const casters = sg ? sg.getShadowMap().renderList || [] : [];
    const drawable = (m) => m.isEnabled() && m.isVisible && m.getTotalVertices && m.getTotalVertices() > 0;
    let enabled = 0, unfrozen = 0, enabledCasters = 0;
    for (const m of scene.meshes) {
      if (!drawable(m)) continue;
      enabled++;
      if (!m.isWorldMatrixFrozen) unfrozen++;
    }
    for (const m of casters) if (drawable(m)) enabledCasters++;
    const pbr = scene.materials.filter((m) => m.getClassName() === 'PBRMaterial').length;
    return {
      meshes: scene.meshes.length, drawable: enabled, unfrozen,
      materials: scene.materials.length, pbr, frozenMaterials: scene.materials.filter((m) => m.isFrozen).length,
      textures: scene.textures.length, casters: casters.length, enabledCasters,
      shadowRefresh: sg ? sg.getShadowMap().refreshRate : null,
      // How much sky the one shadow map is stretched over, in metres, and so
      // how big a texel is — the whole story of a blocky shadow.
      shadowMap: sg ? sg.getShadowMap().getSize().width : null,
      shadowSpan: sg ? +(sg.getLight().shadowFrustumSize ||
        Math.max(sg.getLight().orthoRight - sg.getLight().orthoLeft, sg.getLight().orthoTop - sg.getLight().orthoBottom)).toFixed(2) : null,
      shadowFilter: sg ? sg.filter : null,
      scaling: scene.getEngine().getHardwareScalingLevel(),
      render: [scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight()],
    };
  }

  /** Top contributors to the active list, by the mesh's root node name. */
  function topActive(scene) {
    const counts = Object.create(null);
    const list = scene.getActiveMeshes();
    for (let i = 0; i < list.length; i++) {
      let n = list.data[i];
      while (n.parent && n.parent.name !== '__root__') n = n.parent;
      const k = n.name.replace(/[\s._-]*\d+$/, '').slice(0, 48);
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 12);
  }

  function measure(scene, inst, ms) {
    return new Promise((resolve) => {
      let frames = 0, dc = 0, act = 0, tris = 0, cpu = 0, evalT = 0, rt = 0;
      loopMs = 0; sceneMs = 0;
      const intervals = [];
      const t0 = performance.now();
      let last = t0;
      const obs = scene.onAfterRenderObservable.add(() => {
        frames++;
        const now = performance.now();
        intervals.push(now - last);
        last = now;
        dc += inst.drawCallsCounter.current;
        const a = scene.getActiveMeshes();
        act += a.length;
        cpu += inst.frameTimeCounter.current;
        evalT += inst.activeMeshesEvaluationTimeCounter.current;
        rt += inst.renderTargetsRenderTimeCounter.current;
        if (frames === 1) for (let i = 0; i < a.length; i++) tris += a.data[i].getTotalIndices() / 3;
      });
      setTimeout(() => {
        scene.onAfterRenderObservable.remove(obs);
        const f = Math.max(frames, 1);
        intervals.sort((x, y) => x - y);
        const pct = (q) => +(intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * q))] || 0).toFixed(1);
        resolve({
          frames,
          drawCalls: Math.round(dc / f), activeMeshes: Math.round(act / f), activeTris: Math.round(tris),
          cpuMs: +(cpu / f).toFixed(2), evalMs: +(evalT / f).toFixed(2), rtMs: +(rt / f).toFixed(2),
          jsMs: +((loopMs - sceneMs) / f).toFixed(2),
          intervalMs: +((performance.now() - t0) / f).toFixed(1), p50: pct(0.5), p95: pct(0.95),
          top: topActive(scene),
        });
      }, ms);
    });
  }

  /** One PNG of the canvas as Babylon drew it, glow included, out in slices. */
  async function shot(engine, cam, name) {
    const data = await BABYLON.Tools.CreateScreenshotAsync(engine, cam, { precision: 1 });
    const b64 = data.slice(data.indexOf(',') + 1);
    const size = 60000;
    const n = Math.ceil(b64.length / size);
    for (let i = 0; i < n; i++) log(`SHOT ${name} ${i + 1}/${n} ${b64.slice(i * size, (i + 1) * size)}`);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function main(engine) {
    const scene = BABYLON.EngineStore.LastCreatedScene || engine.scenes[0];
    const inst = new BABYLON.SceneInstrumentation(scene);
    inst.captureFrameTime = true;
    inst.captureActiveMeshesEvaluationTime = true;
    inst.captureRenderTargetsRenderTime = true;
    log('STATIC ' + JSON.stringify(totals(scene)));

    const main = scene.activeCamera;
    const cam = new BABYLON.UniversalCamera('perf camera', new BABYLON.Vector3(0, 5, 5), scene);
    cam.minZ = main.minZ; cam.maxZ = main.maxZ; cam.fov = main.fov;
    scene.activeCamera = cam;

    for (const v of await views()) {
      cam.position.set(...v.pos);
      cam.setTarget(new BABYLON.Vector3(...v.tgt));
      await wait(1200); // let anything that streams or compiles on first sight settle
      const res = await measure(scene, inst, measureMs);
      log('VIEW ' + v.n + ' ' + JSON.stringify(res));
      if (wantShots) await shot(engine, cam, v.n).catch((e) => log('ERROR shot ' + v.n + ' ' + e));
    }
    log('END ' + JSON.stringify(totals(scene)));
    log('DONE');
  }
})();
