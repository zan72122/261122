import * as THREE from '../vendor/three.module.min.js';
import {
  createWallTileTextures,
  createFloorTileTextures,
  createWoodTexture,
  createTerryTexture,
} from './textures.js';

export const TUB = {
  centerX: 0.0,
  centerZ: 0.25,
  outerHalfX: 2.12,
  outerHalfZ: 1.24,
  innerHalfX: 1.82,
  innerHalfZ: 0.96,
  floorY: 0.27,
  rimY: 1.26,
  drainX: 1.12,
  drainZ: 0.25,
};

/**
 * Superellipse radial metric inside the tub inner basin.
 * Returns r in [0, 1] for points inside the rim, > 1 outside.
 */
export function tubSuperellipseR(worldX, worldZ) {
  const nx = (worldX - TUB.centerX) / TUB.innerHalfX;
  const nz = (worldZ - TUB.centerZ) / TUB.innerHalfZ;
  return Math.pow(Math.pow(Math.abs(nx), 2.8) + Math.pow(Math.abs(nz), 2.4), 1 / 2.6);
}

/**
 * Exact Y height of the tub interior basin floor/wall at (worldX, worldZ)
 */
export function tubInnerY(worldX, worldZ) {
  const r = Math.min(1.0, tubSuperellipseR(worldX, worldZ));
  // Flat gently sloped bottom up to r=0.66, then smooth curved porcelain walls up to rimY
  if (r <= 0.64) {
    return TUB.floorY + 0.04 * (r / 0.64) * (r / 0.64);
  }
  const t = (r - 0.64) / 0.36;
  return TUB.floorY + 0.04 + (TUB.rimY - TUB.floorY - 0.04) * Math.pow(t, 1.55);
}

/**
 * Maps world (x, z) inside the tub to dynamic canvas UV (u, v in [0, 1])
 */
export function worldToTubUV(worldX, worldZ) {
  const u = (worldX - TUB.centerX) / (TUB.innerHalfX * 2) + 0.5;
  const v = (worldZ - TUB.centerZ) / (TUB.innerHalfZ * 2) + 0.5;
  return { u, v };
}

/**
 * Clamp a world (x, z) point cleanly inside the tub basin with margin
 */
export function clampInsideTub(worldX, worldZ, maxR = 0.88) {
  const dx = (worldX - TUB.centerX) / TUB.innerHalfX;
  const dz = (worldZ - TUB.centerZ) / TUB.innerHalfZ;
  const r = Math.pow(Math.pow(Math.abs(dx), 2.8) + Math.pow(Math.abs(dz), 2.4), 1 / 2.6);
  if (r <= maxR || r < 0.0001) {
    return { x: worldX, z: worldZ };
  }
  const scale = maxR / r;
  return {
    x: TUB.centerX + dx * scale * TUB.innerHalfX,
    z: TUB.centerZ + dz * scale * TUB.innerHalfZ,
  };
}

/**
 * Build a superellipse parametric point on angle theta (0..2pi)
 */
function superellipsePoint(theta, halfX, halfZ, expX = 2.8, expZ = 2.4) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / expX) * halfX;
  const z = Math.sign(s) * Math.pow(Math.abs(s), 2 / expZ) * halfZ;
  return { x, z };
}

/**
 * Parametric sculpted porcelain inner basin geometry with exact planar top-down UVs
 */
function createTubInnerBasinGeometry() {
  const segs = 64;
  const rings = 18;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Center vertex
  positions.push(0, TUB.floorY, 0);
  uvs.push(0.5, 0.5);

  for (let ri = 1; ri <= rings; ri++) {
    const r = ri / rings;
    for (let si = 0; si <= segs; si++) {
      const theta = (si / segs) * Math.PI * 2;
      const p = superellipsePoint(theta, TUB.innerHalfX * r, TUB.innerHalfZ * r);
      const y = tubInnerY(TUB.centerX + p.x, TUB.centerZ + p.z);
      positions.push(p.x, y, p.z);

      const u = p.x / (TUB.innerHalfX * 2) + 0.5;
      const v = p.z / (TUB.innerHalfZ * 2) + 0.5;
      uvs.push(u, 1 - v); // flip V for canvas top-down
    }
  }

  // Center fan
  for (let si = 0; si < segs; si++) {
    indices.push(0, 1 + si + 1, 1 + si);
  }

  // Ring quads
  const stride = segs + 1;
  for (let ri = 1; ri < rings; ri++) {
    const rowA = 1 + (ri - 1) * stride;
    const rowB = 1 + ri * stride;
    for (let si = 0; si < segs; si++) {
      const a = rowA + si;
      const b = rowA + si + 1;
      const c = rowB + si;
      const d = rowB + si + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Parametric loft helper for tub outer shell / rim with guaranteed outward-facing normals
 */
function createTubProfileGeometry(profile) {
  const segs = 64;
  const positions = [];
  const indices = [];
  const stride = segs + 1;

  for (let pi = 0; pi < profile.length; pi++) {
    const { s, y } = profile[pi];
    for (let si = 0; si <= segs; si++) {
      const theta = (si / segs) * Math.PI * 2;
      const p = superellipsePoint(theta, TUB.innerHalfX * s, TUB.innerHalfZ * s);
      positions.push(p.x, y, p.z);
    }
  }

  for (let pi = 0; pi < profile.length - 1; pi++) {
    const rowA = pi * stride;
    const rowB = (pi + 1) * stride;
    for (let si = 0; si < segs; si++) {
      const a = rowA + si;
      const b = rowA + si + 1;
      const c = rowB + si;
      const d = rowB + si + 1;
      // Outward-facing CCW winding!
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createTubRimGeometry() {
  return createTubProfileGeometry([
    { s: 0.99, y: TUB.rimY - 0.02 },
    { s: 1.03, y: TUB.rimY + 0.048 },
    { s: 1.11, y: TUB.rimY + 0.058 },
    { s: 1.178, y: TUB.rimY - 0.005 },
    { s: 1.175, y: TUB.rimY - 0.085 },
    { s: 1.142, y: TUB.rimY - 0.13 },
  ]);
}

function createTubOuterBodyGeometry() {
  return createTubProfileGeometry([
    { s: 1.142, y: TUB.rimY - 0.12 },
    { s: 1.132, y: 0.92 },
    { s: 1.102, y: 0.58 },
    { s: 1.038, y: 0.30 },
    { s: 0.92, y: 0.15 },
    { s: 0.65, y: 0.12 },
  ]);
}

/**
 * Builds the entire handcrafted miniature bathroom diorama and returns references to interactive assemblies.
 */
export function buildDiorama(scene, tubSurface, mirrorTexture) {
  const root = new THREE.Group();
  scene.add(root);

  const wallTex = createWallTileTextures();
  const floorTex = createFloorTileTextures();
  const woodTex = createWoodTexture();
  const terryPink = createTerryTexture('#df859d');
  const terryMint = createTerryTexture('#91cbbd');

  // Shared miniature-photography PBR materials
  const matWood = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.58,
    metalness: 0.04,
  });

  const matPorcelain = new THREE.MeshPhysicalMaterial({
    color: 0xfdfcf9,
    roughness: 0.12,
    metalness: 0.02,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });

  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xf2f5f8,
    roughness: 0.12,
    metalness: 0.95,
  });

  const matBrass = new THREE.MeshStandardMaterial({
    color: 0xdcb464,
    roughness: 0.24,
    metalness: 0.85,
  });

  // 1. Warm studio tabletop under the diorama box (for authentic scale-model framing)
  const studioTable = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: 0xd6cabd,
      roughness: 0.88,
      metalness: 0.0,
    })
  );
  studioTable.rotation.x = -Math.PI / 2;
  studioTable.position.y = -0.28;
  studioTable.receiveShadow = true;
  root.add(studioTable);

  // 2. Miniature Diorama Plinth (wood base with ceramic tiled top)
  const plinthBase = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.28, 6.2), matWood);
  plinthBase.position.set(0.15, -0.14, 0.45);
  plinthBase.receiveShadow = true;
  plinthBase.castShadow = true;
  root.add(plinthBase);

  const floorTiles = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.04, 5.8),
    new THREE.MeshStandardMaterial({
      map: floorTex.map,
      bumpMap: floorTex.bumpMap,
      bumpScale: 0.02,
      roughness: 0.26,
      metalness: 0.05,
    })
  );
  floorTiles.position.set(0.15, 0.01, 0.45);
  floorTiles.receiveShadow = true;
  root.add(floorTiles);

  // 3. L-shaped miniature diorama tiled walls with thick walnut/birch scale-model cross-section borders
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex.map,
    bumpMap: wallTex.bumpMap,
    bumpScale: 0.025,
    roughness: 0.18,
    metalness: 0.04,
  });

  // Back wall backing (wood box) + inner tile face
  const backWallWood = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.7, 0.24), matWood);
  backWallWood.position.set(0.15, 1.72, -2.53);
  backWallWood.castShadow = true;
  backWallWood.receiveShadow = true;
  root.add(backWallWood);

  const backWallTile = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.45, 0.06), wallMat);
  backWallTile.position.set(0.15, 1.74, -2.39);
  backWallTile.receiveShadow = true;
  root.add(backWallTile);

  // Left wall backing (wood box) + inner tile face
  const leftWallWood = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.7, 6.2), matWood);
  leftWallWood.position.set(-4.03, 1.72, 0.45);
  leftWallWood.castShadow = true;
  leftWallWood.receiveShadow = true;
  root.add(leftWallWood);

  const leftWallTile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.45, 5.8), wallMat);
  leftWallTile.position.set(-3.89, 1.74, 0.45);
  leftWallTile.receiveShadow = true;
  root.add(leftWallTile);

  // Subtle decorative pastel tile wainscoting stripe along back & left walls
  const trimMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7e9d7,
    roughness: 0.2,
    clearcoat: 0.6,
  });
  const backTrim = new THREE.Mesh(new THREE.BoxGeometry(8.22, 0.09, 0.09), trimMat);
  backTrim.position.set(0.15, 1.55, -2.35);
  root.add(backTrim);
  const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 5.82), trimMat);
  leftTrim.position.set(-3.85, 1.55, 0.45);
  root.add(leftTrim);

  // 4. Hero Sculpted Vintage Enamel & Porcelain Clawfoot Bathtub
  const tubGroup = new THREE.Group();
  tubGroup.position.set(TUB.centerX, 0, TUB.centerZ);
  root.add(tubGroup);

  const matEnamelOuter = new THREE.MeshPhysicalMaterial({
    color: 0x8cc6ce,
    roughness: 0.16,
    metalness: 0.04,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
  });

  const tubRim = new THREE.Mesh(createTubRimGeometry(), matPorcelain);
  tubRim.castShadow = true;
  tubRim.receiveShadow = true;
  tubGroup.add(tubRim);

  const tubOuter = new THREE.Mesh(createTubOuterBodyGeometry(), matEnamelOuter);
  tubOuter.castShadow = true;
  tubOuter.receiveShadow = true;
  tubGroup.add(tubOuter);

  // Soft studio contact AO shadow under the bathtub so it sits solidly on the tiled floor
  const aoShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({
      color: 0x3b2f24,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    })
  );
  aoShadow.rotation.x = -Math.PI / 2;
  aoShadow.scale.set(2.05, 1.18, 1);
  aoShadow.position.set(0, 0.032, 0.04);
  tubGroup.add(aoShadow);

  const tubInnerMat = new THREE.MeshPhysicalMaterial({
    map: tubSurface.map,
    roughnessMap: tubSurface.roughnessMap,
    roughness: 0.9, // modulated by roughnessMap (#202020 clean -> glossy, #d0d0d0 dirty -> matte)
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.14,
  });
  const tubInner = new THREE.Mesh(createTubInnerBasinGeometry(), tubInnerMat);
  tubInner.receiveShadow = true;
  tubInner.name = 'tub_inner';
  tubGroup.add(tubInner);

  // 4 charming porcelain-and-brass miniature claw feet under the tub
  const footOffsets = [
    [-1.42, -0.78],
    [1.42, -0.78],
    [-1.42, 0.78],
    [1.42, 0.78],
  ];
  const footGeo = new THREE.SphereGeometry(0.16, 14, 10);
  for (const [fx, fz] of footOffsets) {
    const foot = new THREE.Mesh(footGeo, matBrass);
    foot.scale.set(1.15, 0.72, 1.0);
    foot.position.set(fx, 0.1, fz);
    foot.castShadow = true;
    tubGroup.add(foot);
  }

  // Wide porcelain back-right corner ledge built onto the tub rim for Mama Duck & Soap Pump!
  const ledgeLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.14, 24), matPorcelain);
  ledgeLeft.position.set(-1.68, TUB.rimY - 0.02, -0.82);
  ledgeLeft.castShadow = true;
  ledgeLeft.receiveShadow = true;
  tubGroup.add(ledgeLeft);

  const ledgeRight = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.56, 0.14, 24), matPorcelain);
  ledgeRight.position.set(1.54, TUB.rimY - 0.02, -0.86);
  ledgeRight.castShadow = true;
  ledgeRight.receiveShadow = true;
  tubGroup.add(ledgeRight);

  // 5. Recessed Brass Drain Grate + Overflow Plate + Interactive Drain Plug on Beaded Chain
  const drainRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 12, 24), matBrass);
  drainRing.rotation.x = Math.PI / 2;
  drainRing.position.set(TUB.drainX, TUB.floorY + 0.025, TUB.drainZ);
  root.add(drainRing);

  const drainHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 20),
    new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.9 })
  );
  drainHole.rotation.x = -Math.PI / 2;
  drainHole.position.set(TUB.drainX, TUB.floorY + 0.018, TUB.drainZ);
  root.add(drainHole);

  // Overflow plate on inner right wall
  const overflowPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 18), matChrome);
  overflowPlate.rotation.z = Math.PI / 2;
  overflowPlate.position.set(TUB.centerX + TUB.innerHalfX - 0.06, 0.96, TUB.centerZ);
  root.add(overflowPlate);

  // Interactive Rubber & Brass Drain Plug
  const drainPlugGroup = new THREE.Group();
  const plugBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.14, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b444c, roughness: 0.45 })
  );
  plugBody.castShadow = true;
  drainPlugGroup.add(plugBody);

  const plugCap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.04, 16), matBrass);
  plugCap.position.y = 0.055;
  drainPlugGroup.add(plugCap);

  const plugRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16), matBrass);
  plugRing.position.y = 0.11;
  drainPlugGroup.add(plugRing);

  drainPlugGroup.position.set(TUB.drainX - 0.34, TUB.floorY + 0.05, TUB.drainZ + 0.18);
  root.add(drainPlugGroup);

  // Beaded chain connecting overflow plate -> drain plug (updated dynamically)
  const chainBeads = [];
  const beadGeo = new THREE.SphereGeometry(0.022, 8, 8);
  for (let i = 0; i < 14; i++) {
    const bead = new THREE.Mesh(beadGeo, matBrass);
    root.add(bead);
    chainBeads.push(bead);
  }
  const chainAnchor = new THREE.Vector3(TUB.centerX + TUB.innerHalfX - 0.08, 0.95, TUB.centerZ);

  function updatePlugChain() {
    const plugTop = new THREE.Vector3(
      drainPlugGroup.position.x,
      drainPlugGroup.position.y + 0.13,
      drainPlugGroup.position.z
    );
    const mid = chainAnchor.clone().lerp(plugTop, 0.52);
    mid.y = Math.min(chainAnchor.y, plugTop.y) - 0.14;
    mid.y = Math.max(TUB.floorY + 0.06, mid.y);
    const curve = new THREE.QuadraticBezierCurve3(chainAnchor, mid, plugTop);
    for (let i = 0; i < chainBeads.length; i++) {
      const t = i / (chainBeads.length - 1);
      chainBeads[i].position.copy(curve.getPoint(t));
    }
  }
  updatePlugChain();

  // 6. Big Sculptural Chrome Bathtub Faucet (Right rim of tub, pointing LEFT into tub!)
  const faucetGroup = new THREE.Group();
  faucetGroup.position.set(TUB.centerX + TUB.outerHalfX + 0.08, TUB.rimY, TUB.centerZ);
  root.add(faucetGroup);

  // Tall chrome deck pedestal
  const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 22), matChrome);
  faucetBase.position.y = 0.06;
  faucetBase.castShadow = true;
  faucetGroup.add(faucetBase);

  const faucetPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.56, 20), matChrome);
  faucetPillar.position.y = 0.36;
  faucetPillar.castShadow = true;
  faucetGroup.add(faucetPillar);

  // Curved gooseneck spout arching into the tub
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.54, 0),
    new THREE.Vector3(-0.24, 0.72, 0),
    new THREE.Vector3(-0.56, 0.66, 0),
    new THREE.Vector3(-0.68, 0.44, 0),
  ]);
  const spoutMesh = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 20, 0.085, 14, false), matChrome);
  spoutMesh.castShadow = true;
  faucetGroup.add(spoutMesh);

  const spoutNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.08, 16), matChrome);
  spoutNozzle.position.set(-0.68, 0.42, 0);
  faucetGroup.add(spoutNozzle);

  // Big tactile coral-red ceramic faucet lever handle on top!
  const faucetHandlePivot = new THREE.Group();
  faucetHandlePivot.position.set(0.0, 0.64, 0);
  faucetGroup.add(faucetHandlePivot);

  const handleCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), matChrome);
  handleCap.castShadow = true;
  faucetHandlePivot.add(handleCap);

  const handleStick = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.065, 0.32, 8, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0xff6b6b,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    })
  );
  handleStick.rotation.z = Math.PI / 2 - 0.25;
  handleStick.position.set(-0.22, 0.09, 0);
  handleStick.castShadow = true;
  faucetHandlePivot.add(handleStick);

  // Warm/cold tiny enamel dots on handle cap for miniature authenticity
  const dotRed = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5252 })
  );
  dotRed.position.set(-0.12, 0.08, 0.07);
  faucetHandlePivot.add(dotRed);
  const dotBlue = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x4fc3f7 })
  );
  dotBlue.position.set(-0.12, 0.08, -0.07);
  faucetHandlePivot.add(dotBlue);

  const faucetSpoutWorldPos = new THREE.Vector3(
    faucetGroup.position.x - 0.68,
    faucetGroup.position.y + 0.38,
    faucetGroup.position.z
  );

  // 7. Big Chrome Handheld Shower Head + Wall Cradle + Flexing Ribbed Hose
  const showerWallPipePos = new THREE.Vector3(-1.55, 1.56, -2.26);
  const showerRestPos = new THREE.Vector3(-1.55, 2.26, -2.02);

  // Wall mixer fixture & bracket
  const wallMixer = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 18), matChrome);
  wallMixer.rotation.x = Math.PI / 2;
  wallMixer.position.copy(showerWallPipePos);
  wallMixer.castShadow = true;
  root.add(wallMixer);

  const wallCradle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 16), matChrome);
  wallCradle.rotation.x = Math.PI / 2;
  wallCradle.position.set(-1.55, 2.22, -2.26);
  wallCradle.castShadow = true;
  root.add(wallCradle);

  // Handheld Shower Wand (BIG & unmistakable!)
  const showerHeadGroup = new THREE.Group();
  showerHeadGroup.position.copy(showerRestPos);
  root.add(showerHeadGroup);

  const showerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.66, 16), matChrome);
  showerHandle.position.set(0, -0.26, 0);
  showerHandle.castShadow = true;
  showerHeadGroup.add(showerHandle);

  const showerNeck = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), matChrome);
  showerNeck.position.set(0, 0.08, 0.04);
  showerHeadGroup.add(showerNeck);

  // Wide round glossy shower head disc
  const showerDiscBack = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.14, 24), matChrome);
  showerDiscBack.rotation.x = Math.PI / 2 + 0.45;
  showerDiscBack.position.set(0, 0.22, 0.18);
  showerDiscBack.castShadow = true;
  showerHeadGroup.add(showerDiscBack);

  const showerFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 24),
    new THREE.MeshStandardMaterial({ color: 0x73d7ee, roughness: 0.35, metalness: 0.1 })
  );
  showerFace.rotation.x = 0.45;
  showerFace.position.set(0, 0.19, 0.245);
  showerHeadGroup.add(showerFace);

  // Tiny silicone spray nozzles on the shower face
  const nozzleDotGeo = new THREE.SphereGeometry(0.018, 6, 6);
  const nozzleDotMat = new THREE.MeshStandardMaterial({ color: 0xe6fbff, roughness: 0.3 });
  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 6 : 12;
    const rad = ring === 0 ? 0.09 : 0.18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const dot = new THREE.Mesh(nozzleDotGeo, nozzleDotMat);
      dot.position.set(Math.cos(a) * rad, 0.19 + Math.sin(a) * rad * Math.cos(0.45), 0.252 - Math.sin(a) * rad * Math.sin(0.45));
      showerHeadGroup.add(dot);
    }
  }

  // Flexing Shower Hose Mesh (updated each frame when shower moves)
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8e0,
    roughness: 0.26,
    metalness: 0.82,
  });
  let hoseGeo = new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(showerWallPipePos, new THREE.Vector3(-1.55, 1.35, -1.9), showerRestPos),
    20,
    0.036,
    8,
    false
  );
  const showerHose = new THREE.Mesh(hoseGeo, hoseMat);
  showerHose.castShadow = true;
  root.add(showerHose);

  function updateShowerHose() {
    const handleBottom = new THREE.Vector3(0, -0.58, 0).applyMatrix4(showerHeadGroup.matrixWorld);
    const mid1 = new THREE.Vector3(
      (showerWallPipePos.x + handleBottom.x) * 0.5 - 0.15,
      Math.min(showerWallPipePos.y, handleBottom.y) - 0.48,
      (showerWallPipePos.z + handleBottom.z) * 0.5 + 0.12
    );
    mid1.y = Math.max(0.32, mid1.y);
    const curve = new THREE.QuadraticBezierCurve3(showerWallPipePos, mid1, handleBottom);
    const newGeo = new THREE.TubeGeometry(curve, 18, 0.036, 8, false);
    showerHose.geometry.dispose();
    showerHose.geometry = newGeo;
  }

  // 8. Pink Soap Pump Bottle (Interactive! Gives rainbow mega-bubbles!)
  const soapBottleGroup = new THREE.Group();
  soapBottleGroup.position.set(-1.68, TUB.rimY + 0.05, -0.57);
  root.add(soapBottleGroup);

  const soapBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.23, 0.52, 20),
    new THREE.MeshPhysicalMaterial({
      color: 0xff85ac,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    })
  );
  soapBody.position.y = 0.26;
  soapBody.castShadow = true;
  soapBottleGroup.add(soapBody);

  // Cute glossy pearl band around bottle (no text!)
  const soapBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.222, 0.228, 0.18, 20),
    new THREE.MeshStandardMaterial({ color: 0xfff8fa, roughness: 0.35 })
  );
  soapBand.position.y = 0.26;
  soapBottleGroup.add(soapBand);

  // Bubble emblem embossed on bottle
  const bubbleEmb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xffc8dc, roughness: 0.1, clearcoat: 1 })
  );
  bubbleEmb.position.set(0.06, 0.27, 0.21);
  bubbleEmb.scale.set(1, 1, 0.4);
  soapBottleGroup.add(bubbleEmb);

  const soapPumpHead = new THREE.Group();
  soapPumpHead.position.y = 0.54;
  soapBottleGroup.add(soapPumpHead);

  const pumpNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.14, 14), matChrome);
  pumpNeck.position.y = 0.06;
  soapPumpHead.add(pumpNeck);

  const pumpTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 14), matPorcelain);
  pumpTop.position.y = 0.15;
  pumpTop.castShadow = true;
  soapPumpHead.add(pumpTop);

  const pumpNozzle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.055), matPorcelain);
  pumpNozzle.position.set(0.11, 0.15, 0.04);
  pumpNozzle.rotation.y = -0.35;
  soapPumpHead.add(pumpNozzle);

  // 9. Wooden Wall Shelf (Holds baby ducks, fizzy bath bombs, and toy boat!)
  const shelfY = 1.72;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.11, 0.58), matWood);
  shelf.position.set(1.15, shelfY, -2.06);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  root.add(shelf);

  // Two cute brass brackets under shelf
  for (const bx of [0.1, 2.2]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.36), matBrass);
    bracket.position.set(bx, shelfY - 0.18, -2.16);
    root.add(bracket);
  }

  // 10. Steamy Rounded Bathroom Mirror on Back Wall (clears when sprayed!)
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(-0.22, 2.58, -2.32);
  root.add(mirrorGroup);

  const mirrorFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.09, 32), matWood);
  mirrorFrame.rotation.x = Math.PI / 2;
  mirrorFrame.castShadow = true;
  mirrorGroup.add(mirrorFrame);

  const mirrorGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 32),
    new THREE.MeshPhysicalMaterial({
      map: mirrorTexture.map,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
    })
  );
  mirrorGlass.position.z = 0.052;
  mirrorGroup.add(mirrorGlass);

  // 11. Miniature Terrycloth Bathmat + Wooden Bath Stool + Towel Rail (Miniature Photography richness!)
  const bathMat = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.06, 1.08),
    new THREE.MeshStandardMaterial({
      map: terryPink.map,
      bumpMap: terryPink.bumpMap,
      bumpScale: 0.03,
      roughness: 0.92,
    })
  );
  bathMat.position.set(-0.05, 0.05, 2.15);
  bathMat.castShadow = true;
  bathMat.receiveShadow = true;
  root.add(bathMat);

  // Miniature birch bath stool on left side
  const stoolGroup = new THREE.Group();
  stoolGroup.position.set(-2.95, 0.03, 0.95);
  stoolGroup.rotation.y = 0.22;
  root.add(stoolGroup);

  const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.1, 20), matWood);
  stoolTop.position.y = 0.62;
  stoolTop.castShadow = true;
  stoolTop.receiveShadow = true;
  stoolGroup.add(stoolTop);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.64, 10), matWood);
    leg.position.set(Math.cos(a) * 0.28, 0.31, Math.sin(a) * 0.28);
    leg.rotation.z = -Math.cos(a) * 0.12;
    leg.rotation.x = Math.sin(a) * 0.12;
    leg.castShadow = true;
    stoolGroup.add(leg);
  }

  // Folded mint terry towel on the stool
  const foldedTowel = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.16, 0.42),
    new THREE.MeshStandardMaterial({
      map: terryMint.map,
      bumpMap: terryMint.bumpMap,
      bumpScale: 0.03,
      roughness: 0.9,
    })
  );
  foldedTowel.position.set(0, 0.74, 0);
  foldedTowel.rotation.y = -0.18;
  foldedTowel.castShadow = true;
  stoolGroup.add(foldedTowel);

  // Left-wall towel bar + hanging folded pink towel
  const towelBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 12), matChrome);
  towelBar.rotation.x = Math.PI / 2;
  towelBar.position.set(-3.68, 2.02, 0.35);
  towelBar.castShadow = true;
  root.add(towelBar);

  const wallTowel = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.85, 0.96),
    new THREE.MeshStandardMaterial({
      map: terryPink.map,
      bumpMap: terryPink.bumpMap,
      bumpScale: 0.03,
      roughness: 0.9,
    })
  );
  wallTowel.position.set(-3.66, 1.62, 0.35);
  wallTowel.castShadow = true;
  root.add(wallTowel);

  // Tiny potted miniature eucalyptus plant on left corner of shelf for cozy real-miniature scale
  const potGroup = new THREE.Group();
  potGroup.position.set(-2.95, 0.03, -1.55);
  root.add(potGroup);
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.2, 0.42, 16),
    new THREE.MeshStandardMaterial({ color: 0xd98a6c, roughness: 0.65 })
  );
  pot.position.y = 0.21;
  pot.castShadow = true;
  potGroup.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6ea67c, roughness: 0.55 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), leafMat);
    leaf.scale.set(1.2, 0.55, 0.75);
    leaf.position.set(Math.cos(a) * 0.16, 0.48 + (i % 3) * 0.14, Math.sin(a) * 0.16);
    leaf.rotation.y = -a;
    leaf.rotation.z = 0.4;
    leaf.castShadow = true;
    potGroup.add(leaf);
  }

  return {
    root,
    tubGroup,
    tubInner,
    faucetGroup,
    faucetHandlePivot,
    faucetSpoutWorldPos,
    showerHeadGroup,
    showerRestPos,
    updateShowerHose,
    soapBottleGroup,
    soapPumpHead,
    drainPlugGroup,
    updatePlugChain,
    mirrorGroup,
    shelfY: shelfY + 0.055,
  };
}
