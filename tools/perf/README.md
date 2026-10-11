# tools/perf — the arcade's measuring tape

A headless-Chrome bench for the sky. It loads the arcade, flies its own camera
to a fixed set of views — the title shot, a close-up of the gopher (for its
shadow), every island, the whole sky — holds each one still for a few seconds
and prints what a frame cost there. It is how every number in
`PERFORMANCE.md` is taken, so anybody can take them again.

**It is not a test suite.** Nothing passes or fails, it is not run on commit,
and it proves nothing about how the arcade feels on a real tablet — that is
`?perf=1` on the device itself (`js/quality.js`). What it is good for is
comparing two trees on one machine: before and after a change.

```sh
tools/perf/bench.sh before                         # the tree it lives in
tools/perf/bench.sh -s /path/to/other/arcade after # any other copy
tools/perf/bench.sh -x -v title,gopher shots       # plus a PNG of each view
tools/perf/bench.sh -q full -p scale=0.5 halfres   # the full tier, half the pixels
```

Output lands in `$TMPDIR/arcade-perf/<label>/`: `perf.jsonl` (every view in
full, including which meshes were active), `stderr.txt` (Chrome's own log, for
when something went wrong) and `<view>.png` with `-x`. The printed table:

| column | what it is |
|---|---|
| draws | draw calls per frame, every pass: main, glow, shadow map |
| active | meshes that survived culling and were drawn in the main pass |
| tris(k) | triangles in those meshes |
| cpu | Babylon's whole frame on the CPU, ms (SceneInstrumentation) |
| eval | the part of that spent deciding which meshes are active |
| rt | the part spent drawing render targets (glow, shadow map) |
| js | everything outside `scene.render()` — every module's `animate()` |
| interval / p95 | wall-clock ms per frame, mean and 95th percentile |

The header line gives scene totals (meshes, materials, shadow casters) and the
shadow map's texel size, which is what decides whether a shadow looks blocky.

## Reading the numbers

Chrome renders on SwiftShader here — the GPU is emulated on the CPU — so the
`interval` is enormous (100–500 ms) and only means something next to another
run's `interval`: it is a proxy for fill cost, which is what an old tablet
runs out of. `cpu`, `eval`, `draws` and `active` are real: draw-call
submission and culling cost the same kind of work on a tablet, only slower.
Runs are taken at a fixed 1× resolution (`scale=1`, which also switches off the
resolution governor) and on the lighter tier unless `-q full`, because the
budgets are written against it.

Two runs of the same tree differ by a few percent in `cpu` and `interval`;
anything smaller than that is noise. Screenshots differ wherever something
animates (fish, foxes, number blocks), so compare them by eye or with a diff
that you then look at.

## How it works, and why

- **Nothing in the game is patched.** `bench.mjs stage` builds a copy whose
  every file is a symlink to the real tree except `index.html`, which gets a
  local Babylon instead of jsDelivr and `probe.js` before `js/main.js`. The
  probe finds everything through Babylon itself (`Engine.runRenderLoop` says
  boot finished, `EngineStore.LastCreatedScene` is the scene,
  `SceneInstrumentation` counts), so editing `main.js` cannot break it.
- **Babylon comes from `../neonfox/vendor/`** — the same 8.56.2 that
  `index.html` pins, already on disk, so nothing 8 MB is committed here. `-b`
  points elsewhere; the stage step warns if the version does not match.
- **One Chrome at a time**, through a lock directory that records its owner's
  pid and is taken over if that process has died. Two SwiftShader Chromes at
  once hang this Mac and spoil each other's numbers. `PERF_LOCK` moves it.
- **Poll and kill.** Headless Chrome does not exit by itself here, so the
  script waits for the probe's `PERF DONE` and kills the Chrome it started,
  found by its fresh `--user-data-dir` (fresh every run, or a cached copy of
  yesterday's files gets measured).
- **Views** are listed in `probe.js`. Three of them (neonfox, minimaze,
  zoodoku) keep the exact cameras of the 2026-10-10 baseline; the others are
  generated from `PLATFORMS` in `js/room.js`, so a new island is measured
  without anybody editing the probe.

`PERF_PROBE=<file>` swaps in a different probe for a one-off experiment, and
`CHROME=<binary>` a different browser.
