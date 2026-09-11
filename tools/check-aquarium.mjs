/** Run: node tools/check-aquarium.mjs ../fishtank/node_modules */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createAquariumSwimmers } from '../js/aquarium.js';
const require = createRequire(import.meta.url);
if (!process.argv[2]) throw new Error('Pass a node_modules directory containing babylonjs and babylonjs-loaders.');
const dependencies = resolve(process.argv[2]);
const B = require(resolve(dependencies, 'babylonjs'));
require(resolve(dependencies, 'babylonjs-loaders'));
globalThis.BABYLON = B;
const engine = new B.NullEngine();
const scene = new B.Scene(engine);
new B.FreeCamera('check', B.Vector3.Zero(), scene);
B.SceneLoader.OnPluginActivatedObservable.add((loader) => { loader.skipMaterials = true; });
const bytes = new Uint8Array(readFileSync(new URL('../assets/3d/cloud-world.glb', import.meta.url)));
let timeout;
try {
  const held = await Promise.race([
    B.SceneLoader.LoadAssetContainerAsync('', bytes, scene, undefined, '.glb'),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('GLB import timed out')), 15000); }),
  ]);
  clearTimeout(timeout);
  held.addAllToScene();
  const swimmers = createAquariumSwimmers(held);
  const fish = held.transformNodes.filter((n) => /^Fishtank (clownfish|blue-tang|angelfish|royal-gramma) \d+$/.test(n.name));
  assert.equal(fish.length, 6);
  for (const mesh of held.meshes) if (!swimmers.movingMeshes.has(mesh)) mesh.freezeWorldMatrix();
  const firstPositions = fish.map((f) => f.position.clone());
  let maximumTravel = 0;
  for (let i = 0; i < 1800; i++) {
    swimmers.animate(1 / 30);
    for (const [index, f] of fish.entries()) {
      maximumTravel = Math.max(maximumTravel, B.Vector3.Distance(f.position, firstPositions[index]));
      for (const mesh of f.getChildMeshes()) {
        assert(!mesh.isWorldMatrixFrozen, `${mesh.name} is frozen`);
        mesh.computeWorldMatrix(true);
        const { minimumWorld: low, maximumWorld: high } = mesh.getBoundingInfo().boundingBox;
        assert(low.x >= -21.56 && high.x <= -19.64, `${f.name} crossed tank side`);
        assert(low.z >= -8.6 && high.z <= -1.4, `${f.name} crossed tank end`);
        assert(low.y >= -1.77 && high.y <= .93, `${f.name} crossed sand or waterline`);
      }
    }
  }
  assert(maximumTravel > .5, 'Fish did not swim');
  scene.render();
  console.log('PASS: six real GLB fish animate, remain unfrozen and stay inside the aquarium for a simulated minute.');
} finally {
  clearTimeout(timeout);
  scene.dispose();
  engine.dispose();
}
