import * as THREE from '../lib/three.module.js';
import { RoundedBoxGeometry } from '../lib/RoundedBoxGeometry.js';

function organicNoise3D(x, y, z, seed = 0) {
  const s = seed * 13.37;
  return (
    Math.sin(x * 3.1 + s) * Math.cos(y * 2.9 - s * 0.7) * Math.sin(z * 3.3 + s * 0.4) * 0.55 +
    Math.sin(x * 7.4 - z * 6.8 + s * 1.3) * Math.cos(y * 7.1 + x * 5.9) * 0.28 +
    Math.sin(x * 15.2 + y * 14.7 - z * 16.1 + s * 2.1) * 0.17
  );
}

function createStadiumShape(width, depth, radius) {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const r = Math.min(radius, hw, hd);
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - r);
  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hd);
  s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + r);
  s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function createContactAO(textures, width, depth, opacity = 0.65) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: textures.contactAO,
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.005;
  return mesh;
}

// =========================================================================
// 1. MAGEWAPPA JAPANESE CEDAR BENTO BOX + STEAMED RICE + UMEBOSHI + LID
// =========================================================================
export function createBentoBox(textures) {
  const group = new THREE.Group();

  const W = 3.65;
  const D = 2.48;
  const R = 1.0;
  const H = 0.92;
  const wallT = 0.11;

  const cedarMat = new THREE.MeshStandardMaterial({
    map: textures.cedarMap,
    normalMap: textures.cedarNormal,
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughnessMap: textures.cedarRough,
    roughness: 0.76,
    metalness: 0.0
  });

  const cedarInnerMat = cedarMat.clone();
  cedarInnerMat.color = new THREE.Color(0xf6ead8);

  // Outer bentwood wall (extruded hollow oval stadium)
  const outerShape = createStadiumShape(W, D, R);
  const innerPath = createStadiumShape(W - wallT * 2, D - wallT * 2, R - wallT);
  outerShape.holes.push(innerPath);

  const wallGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: H,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 40
  });
  wallGeo.rotateX(-Math.PI / 2);
  const wallMesh = new THREE.Mesh(wallGeo, cedarMat);
  wallMesh.position.y = 0.06;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // Recessed cedar base bottom
  const floorShape = createStadiumShape(W - wallT * 1.5, D - wallT * 1.5, R - wallT * 0.75);
  const floorGeo = new THREE.ExtrudeGeometry(floorShape, {
    depth: 0.11,
    bevelEnabled: false,
    curveSegments: 36
  });
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, cedarInnerMat);
  floorMesh.position.y = 0.03;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Traditional cherry-bark (kabazaiku) vertical stitching seam on front outer wall
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x4e2518,
    roughness: 0.42,
    metalness: 0.04
  });
  for (let i = 0; i < 4; i++) {
    const stitch = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.12, 0.03, 2, 0.01), barkMat);
    stitch.position.set(-0.22 + i * 0.09, 0.25 + (i % 2) * 0.28, D * 0.5 + 0.012);
    group.add(stitch);
  }

  group.add(createContactAO(textures, W * 1.25, D * 1.28, 0.78));

  // Inner cedar divider (shikiri) separating left rice bed from right okazu compartment
  const divX = -0.22;
  const divider = new THREE.Mesh(
    new RoundedBoxGeometry(0.065, H * 0.82, D - wallT * 2.35, 3, 0.018),
    cedarInnerMat
  );
  divider.position.set(divX, 0.14 + H * 0.41, 0);
  divider.castShadow = true;
  divider.receiveShadow = true;
  group.add(divider);

  // NATURAL CRISP CURLED GREEN LEAF LETTUCE LINER (deep cup hugging inner right oval wall!)
  const leafGroup = new THREE.Group();
  const leafMat = new THREE.MeshPhysicalMaterial({
    map: textures.lettuceMap,
    normalMap: textures.lettuceNormal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.66,
    clearcoat: 0.06,
    clearcoatRoughness: 0.52,
    sheen: 0.2,
    sheenColor: new THREE.Color(0x88c85a),
    side: THREE.DoubleSide
  });

  // Single lush ruffled lettuce cup contoured cleanly to the oval right okazu compartment
  const ringGeo = new THREE.PlaneGeometry(1.78, 2.06, 26, 26);
  const lp = ringGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    let x = lp.getX(i);
    let y = lp.getY(i);
    const nx = x / 0.89; // -1 (divider side) .. +1 (curved outer right wall)
    const ny = y / 1.03;
    // Curve the outer-right half into the magewappa oval contour!
    if (nx > 0) {
      const rSq = nx * nx * 0.96 + ny * ny * 0.96;
      if (rSq > 1.0) {
        const sc = 1 / Math.sqrt(rSq);
        x *= sc;
        y *= sc;
      }
    }
    const edgeDist = Math.max(Math.abs(nx), Math.abs(ny));
    const ang = Math.atan2(ny, nx);
    const ruffle = Math.sin(ang * 15) * 0.055 * Math.pow(edgeDist, 1.8);
    const cup = Math.pow(edgeDist, 2.2) * 0.42;
    const midDip = -Math.max(0, 1 - edgeDist * 1.4) * 0.015;
    lp.setXYZ(i, x * (1 + ruffle * 0.35), y * (1 + ruffle * 0.35), cup + ruffle + midDip);
  }
  ringGeo.computeVertexNormals();
  const lMesh = new THREE.Mesh(ringGeo, leafMat);
  lMesh.rotation.x = -Math.PI / 2;
  lMesh.position.set(0.73, 0.205, 0.0);
  lMesh.receiveShadow = true;
  leafGroup.add(lMesh);
  group.add(leafGroup);

  // STEAMED WHITE RICE MOUND (left half of bento box)
  const riceGroup = new THREE.Group();
  const riceW = 1.46;
  const riceD = 2.08;
  const riceGeo = new THREE.BoxGeometry(riceW, 0.62, riceD, 24, 10, 24);
  const rPos = riceGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    let x = rPos.getX(i);
    let y = rPos.getY(i);
    let z = rPos.getZ(i);
    const nx = x / (riceW * 0.5);
    const nz = z / (riceD * 0.5);
    if (nx < 0) {
      const rSq = nx * nx * 0.94 + nz * nz;
      if (rSq > 1.0) {
        const s = 1 / Math.sqrt(rSq);
        x *= s;
        z *= s;
      }
    }
    if (y > 0) {
      const dome = Math.max(0, 1 - (nx * nx * 0.24 + nz * nz * 0.32)) * 0.13;
      const bumps = organicNoise3D(x * 2.2, y, z * 2.2, 7) * 0.036;
      y += dome + bumps;
    }
    rPos.setXYZ(i, x, y, z);
  }
  riceGeo.computeVertexNormals();

  const riceMat = new THREE.MeshPhysicalMaterial({
    map: textures.riceMap,
    normalMap: textures.riceNormal,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: textures.riceRough,
    roughness: 0.42,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34,
    sheen: 0.2,
    sheenColor: new THREE.Color(0xfff9ee)
  });

  const riceMesh = new THREE.Mesh(riceGeo, riceMat);
  riceMesh.position.set(-0.96, 0.44, 0);
  riceMesh.castShadow = true;
  riceMesh.receiveShadow = true;
  riceMesh.userData = { interactive: 'rice' };
  riceGroup.add(riceMesh);

  // Smoothly wrinkled pickled Umeboshi plum (high-res sphere + wrinkled normal map — zero low-poly facets!)
  const umeGeo = new THREE.SphereGeometry(0.22, 32, 24);
  const uPos = umeGeo.attributes.position;
  for (let i = 0; i < uPos.count; i++) {
    const vx = uPos.getX(i);
    const vy = uPos.getY(i);
    const vz = uPos.getZ(i);
    const softFold = 1 + Math.sin(vx * 16 + vz * 14) * 0.045 + Math.cos(vy * 14 - vx * 12) * 0.035;
    uPos.setXYZ(i, vx * softFold * 1.06, vy * softFold * 0.74, vz * softFold * 0.96);
  }
  umeGeo.computeVertexNormals();
  const umeMat = new THREE.MeshPhysicalMaterial({
    map: textures.umeMap,
    normalMap: textures.umeNormal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughness: 0.34,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28
  });
  const umeboshi = new THREE.Mesh(umeGeo, umeMat);
  umeboshi.position.set(-0.96, 0.87, 0.0);
  umeboshi.castShadow = true;
  umeboshi.userData = { interactive: 'rice' };
  riceGroup.add(umeboshi);

  // Naturally scattered toasted black sesame seeds sitting cleanly ON TOP of the rice dome!
  const sesameGeo = new THREE.SphereGeometry(0.026, 8, 6);
  sesameGeo.scale(1.65, 0.55, 0.85);
  const sesameMat = new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.28 });
  const sesameInst = new THREE.InstancedMesh(sesameGeo, sesameMat, 36);
  const dummy = new THREE.Object3D();
  // Deterministic natural scatter (not spoke-like radial lines!)
  let sSeed = 918273;
  const sRand = () => {
    sSeed = (sSeed * 1664525 + 1013904223) >>> 0;
    return sSeed / 4294967296;
  };
  let placed = 0;
  let guard = 0;
  while (placed < 36 && guard < 300) {
    guard++;
    const rx = (sRand() * 2 - 1) * 0.56;
    const rz = (sRand() * 2 - 1) * 0.84;
    // Stay outside umeboshi center & inside curved left oval wall
    if (rx * rx + rz * rz < 0.095) continue;
    const nx = rx / (riceW * 0.5);
    const nz = rz / (riceD * 0.5);
    if (nx < 0 && nx * nx * 0.94 + nz * nz > 0.82) continue;
    const sx = -0.96 + rx;
    const sz = rz;
    const domeY = 0.44 + 0.31 + Math.max(0, 1 - (nx * nx * 0.24 + nz * nz * 0.32)) * 0.13;
    dummy.position.set(sx, domeY + 0.022, sz);
    dummy.rotation.set((sRand() - 0.5) * 0.25, sRand() * Math.PI * 2, (sRand() - 0.5) * 0.25);
    dummy.updateMatrix();
    sesameInst.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  riceGroup.add(sesameInst);
  group.add(riceGroup);

  // BENTO LID (matching cedar magewappa overhanging lid)
  const lidGroup = new THREE.Group();
  const lidW = W + 0.16;
  const lidD = D + 0.16;
  const lidR = R + 0.08;
  const lidTopShape = createStadiumShape(lidW, lidD, lidR);
  const lidTopGeo = new THREE.ExtrudeGeometry(lidTopShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.028,
    bevelSegments: 3,
    curveSegments: 40
  });
  lidTopGeo.rotateX(-Math.PI / 2);
  const lidTop = new THREE.Mesh(lidTopGeo, cedarMat);
  lidTop.position.y = 0.24;
  lidTop.castShadow = true;
  lidTop.receiveShadow = true;
  lidGroup.add(lidTop);

  const lidRimShape = createStadiumShape(lidW, lidD, lidR);
  const lidRimHole = createStadiumShape(W + 0.02, D + 0.02, R + 0.01);
  lidRimShape.holes.push(lidRimHole);
  const lidRimGeo = new THREE.ExtrudeGeometry(lidRimShape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 40
  });
  lidRimGeo.rotateX(-Math.PI / 2);
  const lidRim = new THREE.Mesh(lidRimGeo, cedarMat);
  lidRim.castShadow = true;
  lidRim.receiveShadow = true;
  lidGroup.add(lidRim);

  const lidStitch = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 0.03, 2, 0.01), barkMat);
  lidStitch.position.set(-0.15, 0.13, lidD * 0.5 + 0.01);
  lidGroup.add(lidStitch);

  const lidAO = createContactAO(textures, lidW * 1.18, lidD * 1.18, 0.55);
  lidGroup.add(lidAO);

  return {
    boxGroup: group,
    riceGroup,
    umeboshi,
    lidGroup,
    lidAO,
    dims: { W, D, H, R }
  };
}

// =========================================================================
// 2. SPECKLED STONEWARE CERAMIC PREP DISHES
// =========================================================================
export function createCeramicPlate(textures, radiusX = 1.28, radiusZ = 1.08) {
  const group = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.0, 0.02),
    new THREE.Vector2(0.68, 0.025),
    new THREE.Vector2(0.86, 0.08),
    new THREE.Vector2(0.98, 0.21),
    new THREE.Vector2(1.01, 0.24),
    new THREE.Vector2(0.95, 0.245),
    new THREE.Vector2(0.82, 0.12),
    new THREE.Vector2(0.65, 0.068),
    new THREE.Vector2(0.0, 0.062)
  ];
  const geo = new THREE.LatheGeometry(pts, 44);
  geo.scale(radiusX, 1.0, radiusZ);

  const mat = new THREE.MeshPhysicalMaterial({
    map: textures.ceramicMap,
    normalMap: textures.ceramicNormal,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughness: 0.22,
    clearcoat: 0.88,
    clearcoatRoughness: 0.11,
    envMapIntensity: 1.25
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const rimGeo = new THREE.TorusGeometry(0.98, 0.028, 10, 44);
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.scale(radiusX, 1.0, radiusZ);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x87674c, roughness: 0.52 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.238;
  group.add(rim);

  group.add(createContactAO(textures, radiusX * 2.25, radiusZ * 2.25, 0.62));
  return group;
}

// =========================================================================
// 3. FOUR HYPER-DISTINCT PHOTOREALISTIC INGREDIENTS
// =========================================================================

// A. TAMAGOYAKI (卵焼き) — silky pillowy Japanese rolled omelette slice
export function createTamagoyaki(textures, variant = 0) {
  const group = new THREE.Group();
  const w = 0.68;
  const h = 0.44;
  const d = 0.34;

  // High-subdivision smoothly pillowed rolled omelette prism (zero blocky edges!)
  const boxGeo = new THREE.BoxGeometry(w, h, d, 22, 16, 12);
  const bp = boxGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i);
    let y = bp.getY(i);
    let z = bp.getZ(i);
    const nx = x / (w * 0.5);
    const ny = y / (h * 0.5);
    const nz = z / (d * 0.5);
    // Super-ellipsoid soft hand-rolled omelette pillow rounding
    const rXY = Math.pow(Math.abs(nx), 3.2) + Math.pow(Math.abs(ny), 2.8);
    if (rXY > 0.62) {
      const pull = 1 / Math.pow(rXY / 0.62, 0.2);
      x *= pull;
      y *= pull;
    }
    const zRound = Math.max(0, Math.abs(nz) - 0.62) / 0.38;
    const edgePull = 1 - zRound * zRound * (Math.abs(nx) * 0.09 + Math.abs(ny) * 0.09);
    x *= edgePull;
    y *= edgePull;
    const n = organicNoise3D(x * 3.8, y * 3.8, z * 3.8, 20 + variant * 7) * 0.01;
    bp.setXYZ(i, x + n, y + n, z + n * 0.4);
  }
  boxGeo.computeVertexNormals();

  const cutMat = new THREE.MeshPhysicalMaterial({
    map: textures.tamagoCutMap,
    normalMap: textures.tamagoCutNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.tamagoCutRough,
    roughness: 0.42,
    clearcoat: 0.24,
    clearcoatRoughness: 0.34,
    sheen: 0.28,
    sheenColor: new THREE.Color(0xffe485)
  });

  const skinMat = new THREE.MeshPhysicalMaterial({
    map: textures.tamagoSkinMap,
    normalMap: textures.tamagoSkinNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.54,
    clearcoat: 0.16,
    clearcoatRoughness: 0.44
  });

  const mesh = new THREE.Mesh(boxGeo, [skinMat, skinMat, skinMat, skinMat, cutMat, cutMat]);
  mesh.position.y = h * 0.44;
  mesh.rotation.x = -0.3;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return { group, gripWidth: 0.4, heightOffset: 0.22 };
}

// B. KARAAGE (からあげ) — plump, organic crispy fried chicken thigh chunk using normalized CUBE-SPHERE (ZERO UV pole pinch!)
export function createKaraage(textures, variant = 0) {
  const group = new THREE.Group();

  // Normalized Cube-Sphere (14x14x14) guarantees 100% uniform UV density with ZERO pinched pole on top!
  const geo = new THREE.BoxGeometry(1, 1, 1, 14, 14, 14);
  const pos = geo.attributes.position;
  const seed = 55 + variant * 23;
  const R = 0.35;
  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i);
    const by = pos.getY(i);
    const bz = pos.getZ(i);
    // Project cube onto smooth unit sphere
    const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
    const nx = bx / len;
    const ny = by / len;
    const nz = bz / len;

    // Organic plump fried chicken thigh meat lobes + crisp fried batter ridges
    const lobe1 = Math.sin(nx * 2.7 + seed) * Math.cos(nz * 2.3) * 0.16;
    const lobe2 = Math.cos(ny * 3.2 + nx * 2.9 - seed * 0.6) * 0.12;
    const bump = Math.sin(nx * 6.8 + ny * 6.2 - nz * 6.5 + seed) * 0.055;
    const scale = R * (1.0 + lobe1 + lobe2 + bump);

    let x = nx * scale * (1.18 + (variant % 2) * 0.06);
    let y = ny * scale * 0.84;
    let z = nz * scale * (0.96 - (variant % 2) * 0.04);
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.3;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xebcda8),
    map: textures.karaageMap,
    normalMap: textures.karaageNormal,
    normalScale: new THREE.Vector2(2.7, 2.7),
    bumpMap: textures.karaageBump,
    bumpScale: 0.04,
    roughnessMap: textures.karaageRough,
    roughness: 0.72,
    metalness: 0.0,
    clearcoat: 0.26,
    clearcoatRoughness: 0.34
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.25;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return { group, gripWidth: 0.48, heightOffset: 0.26 };
}

// C. BROCCOLI (ブロッコリー) — fibrous stem + ~70 smooth rounded granular micro-florets (ZERO faceted polygons, compact fit!)
export function createBroccoli(textures, variant = 0) {
  const group = new THREE.Group();
  const seed = 88 + variant * 23;

  const stemMat = new THREE.MeshPhysicalMaterial({
    color: 0x6aa54a,
    roughness: 0.52,
    clearcoat: 0.16,
    clearcoatRoughness: 0.44
  });
  const cutStemMat = new THREE.MeshStandardMaterial({
    color: 0xbad990,
    roughness: 0.44
  });

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.02, 0.0),
    new THREE.Vector3(variant % 2 === 0 ? 0.03 : -0.03, 0.17, 0.015),
    new THREE.Vector3(0.0, 0.32, 0.0)
  ]);
  const mainStem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 10, 0.095, 10, false), stemMat);
  mainStem.castShadow = true;
  mainStem.receiveShadow = true;
  group.add(mainStem);

  const capMesh = new THREE.Mesh(new THREE.CircleGeometry(0.092, 12), cutStemMat);
  capMesh.rotation.x = Math.PI / 2;
  capMesh.position.y = 0.02;
  group.add(capMesh);

  const branchAngles = [0.2, 1.45, 2.75, 4.0, 5.25];
  const branchTips = [];
  branchAngles.forEach((ang, idx) => {
    const r = 0.145 + (idx % 2) * 0.035;
    const tip = new THREE.Vector3(Math.cos(ang) * r, 0.37 + (idx % 3) * 0.028, Math.sin(ang) * r);
    branchTips.push(tip);
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.19, 0),
      new THREE.Vector3(tip.x * 0.55, 0.28, tip.z * 0.55),
      tip
    ]);
    const bMesh = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 6, 0.044, 8, false), stemMat);
    bMesh.castShadow = true;
    group.add(bMesh);
  });
  branchTips.push(new THREE.Vector3(0, 0.44, 0));

  // Smooth rounded SphereGeometry sub-florets (10x8 = silky smooth macro silhouette & blazing fast iPhone FPS!)
  const budGeo = new THREE.SphereGeometry(0.088, 10, 8);
  const bp = budGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const y = bp.getY(i);
    const z = bp.getZ(i);
    const n = 1 + Math.sin(x * 24 + seed) * Math.cos(z * 24) * 0.1;
    bp.setXYZ(i, x * n, y * n * 0.9, z * n);
  }
  budGeo.computeVertexNormals();

  const budMat = new THREE.MeshPhysicalMaterial({
    map: textures.broccoliMap,
    normalMap: textures.broccoliNormal,
    normalScale: new THREE.Vector2(2.6, 2.6),
    bumpMap: textures.broccoliBump,
    bumpScale: 0.028,
    roughness: 0.7,
    sheen: 0.32,
    sheenColor: new THREE.Color(0x52a644),
    clearcoat: 0.12,
    clearcoatRoughness: 0.48
  });

  const floretsPerTip = 12;
  const totalBuds = branchTips.length * floretsPerTip;
  const budInst = new THREE.InstancedMesh(budGeo, budMat, totalBuds);
  budInst.castShadow = true;
  budInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let k = 0;
  branchTips.forEach((tip, tIdx) => {
    for (let j = 0; j < floretsPerTip; j++) {
      const phi = Math.acos(1 - ((j + 0.5) / floretsPerTip) * 0.85);
      const theta = j * 2.39996 + tIdx * 1.15 + seed;
      const rad = 0.04 + (j / floretsPerTip) * 0.12;
      const bx = tip.x + Math.sin(phi) * Math.cos(theta) * rad;
      const by = tip.y + Math.cos(phi) * rad * 0.86;
      const bz = tip.z + Math.sin(phi) * Math.sin(theta) * rad;

      const s = 0.72 + ((j * 17 + tIdx * 13) % 10) / 10 * 0.42;
      dummy.position.set(bx, by, bz);
      dummy.rotation.set(theta * 0.5, phi * 1.3, theta * 0.3);
      dummy.scale.set(s, s * 0.9, s);
      dummy.updateMatrix();
      budInst.setMatrixAt(k, dummy.matrix);

      const lift = (by - 0.32) * 0.45 + (j % 3) * 0.04;
      color.setRGB(
        Math.min(1, 0.72 + lift * 0.48),
        Math.min(1, 0.86 + lift * 0.32),
        Math.min(1, 0.66 + lift * 0.16)
      );
      budInst.setColorAt(k, color);
      k++;
    }
  });
  budInst.instanceMatrix.needsUpdate = true;
  if (budInst.instanceColor) budInst.instanceColor.needsUpdate = true;
  group.add(budInst);

  group.children.forEach((c) => {
    c.rotation.z = variant % 2 === 0 ? 0.28 : -0.26;
    c.rotation.x = 0.18;
    c.position.y += 0.06;
  });

  return { group, gripWidth: 0.4, heightOffset: 0.29 };
}

// D. CHERRY TOMATO (ミニトマト) — taut glossy ruby skin with real kitchen-window reflection + curled thick calyx + crystal clear dewdrops!
export function createCherryTomato(textures, variant = 0) {
  const group = new THREE.Group();

  const geo = new THREE.SphereGeometry(0.305, 36, 28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    y *= 0.93;
    if (y > 0.17 && r < 0.15) {
      const dimp = 1 - r / 0.15;
      y -= dimp * dimp * 0.046;
    }
    const subtle = 1 + organicNoise3D(x * 3.1, y * 3.1, z * 3.1, 130 + variant * 11) * 0.024;
    pos.setXYZ(i, x * subtle, y * subtle, z * subtle);
  }
  geo.computeVertexNormals();

  // Hyper-glossy taut cherry tomato skin showing crystal-clear kitchen window pane reflection!
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: textures.tomatoMap,
    normalMap: textures.tomatoNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughness: 0.075,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    reflectivity: 1.0,
    envMapIntensity: 2.2,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xff4a24)
  });

  const body = new THREE.Mesh(geo, skinMat);
  body.position.y = 0.282;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Realistic 3D extruded 5-sepal star calyx (ヘタ) with natural thickness & graceful curl
  const calyxGroup = new THREE.Group();
  calyxGroup.position.set(0, 0.54, 0);
  const calyxMat = new THREE.MeshStandardMaterial({
    color: 0x2d5e1e,
    roughness: 0.56
  });

  const stemNub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.09, 10), calyxMat);
  stemNub.position.y = 0.042;
  stemNub.rotation.z = 0.18;
  calyxGroup.add(stemNub);

  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + variant * 0.5;
    const sepalShape = new THREE.Shape();
    sepalShape.moveTo(0, 0);
    sepalShape.quadraticCurveTo(0.036, 0.055, 0.006, 0.185);
    sepalShape.quadraticCurveTo(-0.026, 0.065, 0, 0);
    const sGeo = new THREE.ExtrudeGeometry(sepalShape, {
      depth: 0.011,
      bevelEnabled: false,
      curveSegments: 8
    });
    const sp = sGeo.attributes.position;
    for (let j = 0; j < sp.count; j++) {
      const sy = sp.getY(j);
      const sz = sp.getZ(j);
      const bend = -sy * sy * 1.48 + Math.max(0, sy - 0.1) * 0.58;
      sp.setZ(j, sz + bend);
    }
    sGeo.computeVertexNormals();
    const sepal = new THREE.Mesh(sGeo, calyxMat);
    sepal.rotation.x = Math.PI / 2;
    sepal.rotation.z = ang;
    sepal.position.y = 0.016;
    sepal.castShadow = true;
    calyxGroup.add(sepal);
  }
  group.add(calyxGroup);

  // Crystal-clear transparent morning water dewdrops (glossy specular highlight, NOT milky dots!)
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xb81218,
    roughness: 0.01,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 3.2
  });
  const dropAngles = [
    [0.52, 0.7, 0.018],
    [1.42, 0.56, 0.013],
    [2.6, 0.64, 0.015],
    [-0.9, 0.52, 0.012],
    [0.18, 0.42, 0.011]
  ];
  dropAngles.forEach(([az, el, rad]) => {
    const dGeo = new THREE.SphereGeometry(rad, 12, 10);
    dGeo.scale(1.0, 0.58, 1.0);
    const drop = new THREE.Mesh(dGeo, dropMat);
    const R = 0.292;
    const dx = Math.cos(az) * Math.sin(el) * R;
    const dy = 0.282 + Math.cos(el) * R * 0.93;
    const dz = Math.sin(az) * Math.sin(el) * R;
    drop.position.set(dx, dy, dz);
    drop.lookAt(dx * 2, (dy - 0.282) * 2 + 0.282, dz * 2);
    drop.rotateX(Math.PI / 2);
    group.add(drop);
  });

  group.children.forEach((c) => {
    c.rotation.z = variant % 2 === 0 ? 0.2 : -0.18;
    c.rotation.x = 0.14;
  });

  return { group, gripWidth: 0.54, heightOffset: 0.28 };
}

// =========================================================================
// 4. FUROSHIKI WOVEN LINEN WRAPPING CLOTH (Zero lid clipping, oval-fitted wrap + sculpted knot!)
// =========================================================================
export function createFuroshiki(textures, boxDims) {
  const group = new THREE.Group();

  const clothMat = new THREE.MeshPhysicalMaterial({
    map: textures.clothMap,
    normalMap: textures.clothNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.55,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(0xfff1e4),
    side: THREE.DoubleSide
  });

  // Base diamond cloth laid neatly beneath the box
  const baseSize = 5.1;
  const baseGeo = new THREE.PlaneGeometry(baseSize, baseSize, 16, 16);
  const bp = baseGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const y = bp.getY(i);
    bp.setZ(i, Math.sin(x * 2.4 + y * 1.9) * 0.015);
  }
  baseGeo.computeVertexNormals();
  const baseMatMesh = new THREE.Mesh(baseGeo, clothMat);
  baseMatMesh.rotation.x = -Math.PI / 2;
  baseMatMesh.rotation.z = Math.PI / 4;
  baseMatMesh.position.y = 0.022;
  baseMatMesh.receiveShadow = true;
  group.add(baseMatMesh);

  function makeFlap(width, length, flipSign = 1) {
    const pivot = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-width * 0.5, 0);
    shape.lineTo(width * 0.5, 0);
    shape.quadraticCurveTo(width * 0.28, length * 0.55, 0, length);
    shape.quadraticCurveTo(-width * 0.28, length * 0.55, -width * 0.5, 0);

    const geo = new THREE.ShapeGeometry(shape, 12);
    const uv = geo.attributes.uv;
    const gp = geo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const px = gp.getX(i);
      const py = gp.getY(i);
      uv.setXY(i, px / width + 0.5, py / length);
      gp.setZ(i, Math.sin(px * 4.0) * 0.024 * (py / length) * flipSign);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, clothMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    return { pivot, mesh };
  }

  const { W, D, H, R } = boxDims;
  const topY = H + 0.36;

  const frontFlap = makeFlap(W * 1.04, 2.4, 1);
  frontFlap.pivot.position.set(0, 0.035, D * 0.5 + 0.16);
  frontFlap.pivot.rotation.x = Math.PI / 2;
  group.add(frontFlap.pivot);

  const backFlap = makeFlap(W * 1.04, 2.4, -1);
  backFlap.pivot.position.set(0, 0.035, -(D * 0.5 + 0.16));
  backFlap.pivot.rotation.y = Math.PI;
  backFlap.pivot.rotation.x = Math.PI / 2;
  group.add(backFlap.pivot);

  const leftFlap = makeFlap(D * 1.15, 2.6, 1);
  leftFlap.pivot.position.set(-(W * 0.5 + 0.16), 0.04, 0);
  leftFlap.pivot.rotation.y = -Math.PI / 2;
  leftFlap.pivot.rotation.x = Math.PI / 2;
  group.add(leftFlap.pivot);

  const rightFlap = makeFlap(D * 1.15, 2.6, -1);
  rightFlap.pivot.position.set(W * 0.5 + 0.16, 0.04, 0);
  rightFlap.pivot.rotation.y = Math.PI / 2;
  rightFlap.pivot.rotation.x = Math.PI / 2;
  group.add(rightFlap.pivot);

  // Oval-stadium cloth wrap shell cleanly enclosing BOTH box & overhanging lid with ZERO poke-through!
  const shellShape = createStadiumShape(W + 0.36, D + 0.36, R + 0.18);
  const wrapShellGeo = new THREE.ExtrudeGeometry(shellShape, {
    depth: topY - 0.14,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.1,
    bevelSegments: 6,
    curveSegments: 36
  });
  wrapShellGeo.rotateX(-Math.PI / 2);
  // Normalize UVs smoothly across the oval cloth wrap so gingham weave drapes naturally!
  const wPos = wrapShellGeo.attributes.position;
  const wUv = wrapShellGeo.attributes.uv;
  for (let i = 0; i < wPos.count; i++) {
    const x = wPos.getX(i);
    const y = wPos.getY(i);
    const z = wPos.getZ(i);
    // Subtle organic fabric pull creases toward the central top knot
    const crease = Math.sin(Math.atan2(z, x) * 6.0) * 0.016 * Math.max(0, y / topY);
    wPos.setY(i, y + crease);
    wUv.setXY(i, (x + y * 0.45) * 0.26 + 0.5, (z + y * 0.45) * 0.26 + 0.5);
  }
  wrapShellGeo.computeVertexNormals();
  const wrapShell = new THREE.Mesh(wrapShellGeo, clothMat);
  wrapShell.position.y = 0.14;
  wrapShell.castShadow = true;
  wrapShell.receiveShadow = true;
  wrapShell.visible = false;
  group.add(wrapShell);

  // Sculptural Furoshiki Bow Knot (真結び) with ZERO UV pole seams & authentic draped linen ribbons!
  const knotGroup = new THREE.Group();
  knotGroup.position.set(0, topY + 0.13, 0);
  knotGroup.scale.setScalar(0.001);
  knotGroup.visible = false;

  // Soft shadow decal directly under the tied knot for grounding!
  const knotAO = createContactAO(textures, 1.35, 0.9, 0.48);
  knotAO.position.y = 0.015;
  knotGroup.add(knotAO);

  // Central gathered fabric knot cushion (cube-sphere -> ZERO radial UV pinch on top!)
  const coreGeo = new THREE.BoxGeometry(1, 1, 1, 10, 10, 10);
  const cp = coreGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const bx = cp.getX(i);
    const by = cp.getY(i);
    const bz = cp.getZ(i);
    const l = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
    const nx = bx / l;
    const ny = by / l;
    const nz = bz / l;
    const fold = 1 + Math.sin(nx * 7 + nz * 5) * 0.06;
    cp.setXYZ(i, nx * 0.32 * fold, ny * 0.17 * fold, nz * 0.25 * fold);
  }
  coreGeo.computeVertexNormals();
  const coreMesh = new THREE.Mesh(coreGeo, clothMat);
  coreMesh.position.y = 0.09;
  coreMesh.castShadow = true;
  knotGroup.add(coreMesh);

  // Gracefully folded draped linen cloth ears (thin tapered folded fabric tails, NOT stuffed pillows!)
  for (let side of [-1, 1]) {
    const earGeo = new THREE.BoxGeometry(1, 1, 1, 12, 8, 4);
    const ep = earGeo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const bx = ep.getX(i); // -0.5 .. 0.5
      const by = ep.getY(i); // -0.5 .. 0.5
      const bz = ep.getZ(i); // -0.5 .. 0.5
      const t = bx + 0.5; // 0 (tucked inside knot) -> 1 (flared outer corner tip)
      // Narrow pinch at knot, wide graceful cloth flare in middle, soft rounded diamond tip
      const widthEnv = Math.sin(Math.pow(t, 0.65) * Math.PI) * 0.44 + (1 - t) * 0.08;
      const thick = 0.055 * (1 - t * 0.55) + Math.abs(by) * 0.03;
      const archY = Math.sin(t * Math.PI * 0.78) * 0.34 - t * t * 0.12;
      const pleatZ = Math.sin(by * Math.PI * 2.2) * 0.045 * t;
      ep.setXYZ(i, t * 0.96, archY + bz * thick, by * widthEnv * 2 + pleatZ);
    }
    earGeo.computeVertexNormals();
    const ear = new THREE.Mesh(earGeo, clothMat);
    ear.position.set(side * 0.12, 0.08, side * 0.02);
    ear.scale.x = side;
    ear.rotation.y = side * 0.24;
    ear.rotation.z = side * 0.08;
    ear.castShadow = true;
    ear.receiveShadow = true;
    knotGroup.add(ear);
  }
  group.add(knotGroup);

  function setFoldState(unfold, fold1, fold2) {
    group.visible = unfold > 0.005;
    const u = Math.min(1, Math.max(0, unfold));
    baseMatMesh.scale.setScalar(0.3 + u * 0.7);
    baseMatMesh.visible = fold2 < 0.72;

    const f1 = Math.min(1, Math.max(0, fold1));
    const f2 = Math.min(1, Math.max(0, fold2));
    const ease1 = f1 * f1 * (3 - 2 * f1);
    const ease2 = f2 * f2 * (3 - 2 * f2);

    frontFlap.pivot.rotation.x = Math.PI / 2 - ease1 * (Math.PI / 2 + 1.05);
    frontFlap.pivot.position.y = 0.035 + ease1 * (topY * 0.86);
    frontFlap.pivot.visible = f2 < 0.65;

    backFlap.pivot.rotation.x = Math.PI / 2 - ease1 * (Math.PI / 2 + 1.05);
    backFlap.pivot.position.y = 0.035 + ease1 * (topY * 0.86);
    backFlap.pivot.visible = f2 < 0.65;

    leftFlap.pivot.rotation.x = Math.PI / 2 - ease2 * (Math.PI / 2 + 1.08);
    leftFlap.pivot.position.y = 0.04 + ease2 * (topY * 0.9);
    leftFlap.pivot.visible = f2 < 0.88;

    rightFlap.pivot.rotation.x = Math.PI / 2 - ease2 * (Math.PI / 2 + 1.08);
    rightFlap.pivot.position.y = 0.04 + ease2 * (topY * 0.9);
    rightFlap.pivot.visible = f2 < 0.88;

    const shellT = Math.min(1, f1 * 0.45 + f2 * 0.75);
    if (shellT > 0.15) {
      wrapShell.visible = true;
      const st = Math.min(1, (shellT - 0.15) / 0.85);
      wrapShell.scale.set(0.97 + st * 0.03, 0.2 + st * 0.8, 0.97 + st * 0.03);
      wrapShell.position.y = 0.14 * wrapShell.scale.y;
    } else {
      wrapShell.visible = false;
    }

    if (f2 > 0.48) {
      knotGroup.visible = true;
      const kt = Math.min(1, (f2 - 0.48) / 0.52);
      const spring = 1 - Math.pow(1 - kt, 3) * Math.cos(kt * Math.PI * 1.15);
      knotGroup.scale.setScalar(Math.max(0.01, spring));
    } else {
      knotGroup.visible = false;
    }
  }

  setFoldState(0, 0, 0);

  return {
    group,
    frontFlap,
    backFlap,
    leftFlap,
    rightFlap,
    knotGroup,
    setFoldState
  };
}
