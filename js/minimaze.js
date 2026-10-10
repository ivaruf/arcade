/** A floating wooden tilt board. The display follows MiniMaze's first maze,
 * “Roll”; its clear eastern lane leads straight to the playable cabinet. */
export function createMiniMazeIsland(scene, island) {
  const B = BABYLON;
  const floor = island.y;
  const blockers = [];
  function material(name, colour, shine = .04) {
    const mat = new B.StandardMaterial(`MiniMaze ${name}`, scene);
    mat.diffuseColor = B.Color3.FromHexString(colour);
    mat.specularColor = new B.Color3(shine, shine, shine);
    return mat;
  }
  const walnut = material('walnut', '#674127');
  const maple = material('smoked maple', '#85613f', 0);
  const deck = material('matte walnut deck', '#684c36', 0);
  const grain = material('grain', '#4d3829');
  const brass = material('brass', '#9a783f', .25);
  const steel = material('steel', '#d2dce1', .95);
  const dark = material('cup interior', '#39291d');
  function box(name, x, y, z, width, height, depth, mat, solid = false) {
    const mesh = B.MeshBuilder.CreateBox(`MiniMaze ${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
    if (solid) blockers.push({ x, z, hx: width / 2, hz: depth / 2, base: y - height / 2, top: y + height / 2 });
    return mesh;
  }
  const cx = (island.x[0] + island.x[1]) / 2;
  const cz = (island.z[0] + island.z[1]) / 2;
  const width = island.x[1] - island.x[0];
  const depth = island.z[1] - island.z[0];
  box('floating walnut base', cx, floor - .4, cz, width, .8, depth, walnut);
  box('brass reveal', cx, floor - .16, cz, width + .04, .08, depth + .04, brass);
  box('maple deck', cx, floor - .06, cz, width, .12, depth, deck);
  for (let x = island.x[0] + .6; x < island.x[1]; x += .6) {
    box('plank seam', x, floor + .003, cz, .014, .006, depth - .08, grain);
  }
  // Low border on three sides; the entire hub-facing edge is open to land on.
  for (const x of [island.x[0] + .12, island.x[1] - .12]) {
    box('side rim', x, floor + .18, cz, .24, .36, depth, walnut, true);
  }
  box('back rim', cx, floor + .18, island.z[1] - .12, width, .36, .24, walnut, true);
  box('sign mast', cx, floor + 2.6, cz + 4.3, .16, 5.2, .16, brass, true);

  // Recessed screw heads and dark runners give the board a crafted underside.
  for (const x of [cx - 5.1, cx + 5.1]) {
    box('underside runner', x, floor - .95, cz, .38, .3, depth - .6, walnut);
    for (const z of [cz - 4.25, cz + 4.25]) {
      const screw = B.MeshBuilder.CreateCylinder('MiniMaze brass screw', { diameter: .16, height: .015, tessellation: 12 }, scene);
      screw.position.set(x, floor + .012, z);
      screw.material = brass;
      screw.isPickable = false;
      screw.freezeWorldMatrix();
      box('screw slot', x, floor + .022, z, .09, .008, .018, dark);
    }
  }
  // A subtle brass route inlay leads along the open lane to the cabinet.
  for (let z = cz - 4; z < cz + 1; z += .65) {
    box('route inlay', cx + 3, floor + .008, z, .10, .012, .25, brass);
  }
  // Spare marbles sit in a felt-lined tray behind the maze.
  const felt = material('tray felt', '#28483d', 0);
  box('spares table', cx - 3, floor + .4, cz + 3.5, 2.1, .8, 1.0, walnut, true);
  box('tray felt', cx - 3, floor + .81, cz + 3.5, 1.9, .025, .8, felt);
  for (const z of [cz + 3.04, cz + 3.96]) {
    box('tray lip', cx - 3, floor + .88, z, 2.1, .16, .08, brass, true);
  }
  for (const x of [cx - 3.65, cx - 3, cx - 2.35]) {
    const spare = B.MeshBuilder.CreateSphere('MiniMaze spare marble', { diameter: .34, segments: 12 }, scene);
    spare.position.set(x, floor + 1, cz + 3.5);
    spare.material = steel;
    spare.isPickable = false;
    spare.freezeWorldMatrix();
  }

  // A tabletop-scale copy keeps the walking route open beside the exhibit.
  const cell = .55, ox = cx - 4.9, oz = cz - 2.3;
  const grid = ['#########', '#S......#', '#######.#', '#.......#', '#.#######', '#......G#', '#########'];
  const tableY = floor + .8;
  box('maze plinth', ox + 4 * cell, floor + .4, oz + 3 * cell, 5.15, .8, 4.05, walnut, true);
  box('maze bed', ox + 4 * cell, tableY + .02, oz + 3 * cell, 5.1, .04, 4, maple);
  grid.forEach((row, z) => {
    // Join each contiguous wall into one mesh.
    for (let x = 0; x < row.length;) {
      if (row[x] !== '#') { x++; continue; }
      const start = x;
      while (row[x] === '#') x++;
      box('maze wall', ox + (start + (x - start - 1) / 2) * cell,
        tableY + .17, oz + z * cell, (x - start) * cell, .3, cell, walnut, true);
    }
  });
  // Brass tilt wheels on the table's front edge, safely away from the lane.
  for (const x of [ox + 1.1, ox + 3.3]) {
    const wheel = B.MeshBuilder.CreateCylinder('MiniMaze tilt wheel', { diameter: .42, height: .18, tessellation: 20 }, scene);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, floor + .43, oz - .48);
    wheel.material = brass;
    wheel.isPickable = false;
    wheel.freezeWorldMatrix();
    box('wheel grip', x, floor + .43, oz - .58, .06, .28, .06, walnut);
  }
  const goalX = ox + 7 * cell, goalZ = oz + 5 * cell;
  const cup = B.MeshBuilder.CreateTorus('MiniMaze brass goal cup', { diameter: .36, thickness: .06, tessellation: 24 }, scene);
  cup.position.set(goalX, tableY + .07, goalZ);
  cup.material = brass;
  const inside = B.MeshBuilder.CreateCylinder('MiniMaze goal recess', { diameter: .30, height: .012, tessellation: 24 }, scene);
  inside.position.set(goalX, tableY + .047, goalZ);
  inside.material = dark;
  for (const mesh of [cup, inside]) { mesh.isPickable = false; mesh.freezeWorldMatrix(); }
  const marble = B.MeshBuilder.CreateSphere('MiniMaze rolling steel marble', { diameter: .32, segments: 16 }, scene);
  marble.material = steel;
  marble.isPickable = false;
  const path = [[1, 1], [7, 1], [7, 3], [1, 3], [1, 5], [7, 5]];
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = lengths.reduce((sum, n) => sum + n, 0);
  let elapsed = 0;
  function animate(dt) {
    elapsed = (elapsed + dt * 1.8) % (total + 3);
    let distance = Math.min(elapsed, total);
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
    const t = Math.min(1, distance / lengths[segment]);
    const a = path[segment], b = path[segment + 1];
    marble.position.set(ox + (a[0] + (b[0] - a[0]) * t) * cell,
      tableY + .20, oz + (a[1] + (b[1] - a[1]) * t) * cell);
  }
  animate(0);
  return { blockers, animate };
}
