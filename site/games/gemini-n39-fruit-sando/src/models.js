import * as THREE from 'three';
import { applySubsurface } from './materials.js';
import {
  createBreadCrumbTextures,
  createBreadCrustTextures,
  createStrawberryOuterTextures,
  createStrawberryCutTextures,
  createKiwiCutTextures,
  createMikanCutTextures,
  createMikanOuterTextures,
  createCreamTextures,
  createWoodTextures,
  createLinenTextures,
  createParchmentTextures,
  createBokehOrbTexture,
  createSkinTextures,
} from './textures.js';

export const BREAD_SIZE = 2.45;
export const BREAD_THICK = 0.34;

/**
 * Shared photorealistic PBR + SSS material library (all procedural textures <= 512px)
 */
export function createMaterialLibrary() {
  const crumbTex = createBreadCrumbTextures();
  const crustTex = createBreadCrustTextures();
  const strawOuterTex = createStrawberryOuterTextures();
  const strawCutTex = createStrawberryCutTextures();
  const kiwiCutTex = createKiwiCutTextures();
  const mikanCutTex = createMikanCutTextures();
  const mikanOuterTex = createMikanOuterTextures();
  const creamTex = createCreamTextures();
  const woodTex = createWoodTextures();
  const linenTex = createLinenTextures();
  const parchmentTex = createParchmentTextures();
  const bokehTex = createBokehOrbTexture();
  const skinTex = createSkinTextures();

  // Japanese milk bread crumb (soft velvety matte + warm golden edge SSS)
  const breadCrumb = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: crumbTex.map,
      normalMap: crumbTex.normalMap,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: crumbTex.roughnessMap,
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.25,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0xf7ead4),
      envMapIntensity: 0.52,
    }),
    { color: 0xf2ba72, intensity: 0.16, power: 3.2, ambient: 0.04, rim: 0.14 }
  );

  // Baked golden shokupan crust
  const breadCrust = new THREE.MeshPhysicalMaterial({
    map: crustTex.map,
    normalMap: crustTex.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.62,
  });

  // Rich glossy whipped cream (velvety dairy specular + sculpted shadow ridges + warm creamy backlit SSS!)
  const whippedCream = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xfffbf2),
      normalMap: creamTex.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      sheen: 0.18,
      sheenColor: new THREE.Color(0xfff8eb),
      envMapIntensity: 0.82,
    }),
    { color: 0xffd596, intensity: 0.26, power: 2.6, ambient: 0.06, rim: 0.24 }
  );

  // Ripe glistening crimson strawberry exterior (strong ruby SSS + mirror-wet clearcoat!)
  const strawberryOuter = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: strawOuterTex.map,
      normalMap: strawOuterTex.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      envMapIntensity: 1.45,
    }),
    { color: 0xe8121c, intensity: 0.72, power: 2.4, distortion: 0.45, ambient: 0.1, rim: 0.34 }
  );

  // Strawberry cut cross-section (luminous backlit deep Amaou crimson heart + juicy glaze!)
  const strawberryCut = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: strawCutTex.map,
      color: new THREE.Color(0xf2cbcb),
      normalMap: strawCutTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      envMapIntensity: 1.35,
    }),
    { color: 0xf21626, intensity: 0.85, power: 2.2, distortion: 0.48, ambient: 0.14, rim: 0.42 }
  );

  // Emerald kiwi flesh & cut face (translucent glowing jade-lime SSS + wet sheen!)
  const kiwiCut = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: kiwiCutTex.map,
      normalMap: kiwiCutTex.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.98,
      envMapIntensity: 1.6,
    }),
    { color: 0x86e018, intensity: 0.72, power: 2.2, distortion: 0.48, ambient: 0.1, rim: 0.36 }
  );

  // Peeled emerald kiwi outer flesh (smooth translucent jade green)
  const kiwiOuter = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x5da816),
      normalMap: kiwiCutTex.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.4,
    }),
    { color: 0x82dc18, intensity: 0.65, power: 2.3, distortion: 0.46, ambient: 0.09, rim: 0.3 }
  );

  // Peeled mandarin orange (mikan) exterior (radiant backlit amber-orange + fibrous sheen)
  const mikanOuter = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: mikanOuterTex.map,
      normalMap: mikanOuterTex.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.4,
    }),
    { color: 0xf57c04, intensity: 0.78, power: 2.1, distortion: 0.5, ambient: 0.11, rim: 0.36 }
  );

  // Mikan cut cross-section (glistening 10-petal amber juice vesicles!)
  const mikanCut = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: mikanCutTex.map,
      normalMap: mikanCutTex.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
      envMapIntensity: 1.75,
    }),
    { color: 0xf88208, intensity: 0.85, power: 2.1, distortion: 0.5, ambient: 0.12, rim: 0.4 }
  );

  // Silky knife-sliced whipped cream (ultra-smooth micro-dairy sheen for crisp flower cross-section!)
  const whippedCreamCut = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xfffbf4),
      normalMap: creamTex.normalMap,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
      sheen: 0.22,
      sheenColor: new THREE.Color(0xfff8eb),
      envMapIntensity: 0.78,
    }),
    { color: 0xffd596, intensity: 0.22, power: 2.6, ambient: 0.06, rim: 0.22 }
  );

  // Glistening 3D crystal-clear water/juice droplet material (clear wet sparkle, NOT opaque white beads!)
  const juiceDroplet = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    roughness: 0.015,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    transparent: true,
    opacity: 0.34,
    envMapIntensity: 3.1,
    depthWrite: false,
  });

  // Natural warm hinoki/oak cutting board (richer honey wood contrast under snowy cream!)
  const woodBoard = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    normalMap: woodTex.normalMap,
    color: new THREE.Color(0xc8a074),
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.44,
    envMapIntensity: 0.65,
  });

  // Darker oiled walnut for knife handle & accents
  const walnutWood = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    normalMap: woodTex.normalMap,
    color: new THREE.Color(0x5a371e),
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.85,
  });

  // Woven sunlit morning linen tablecloth (warm oat beige so white ceramic & cream pop!)
  const linenCloth = new THREE.MeshStandardMaterial({
    map: linenTex.map,
    normalMap: linenTex.normalMap,
    color: new THREE.Color(0xdccbb4),
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.45,
  });

  // Crinkled translucent bakery parchment paper
  const parchment = new THREE.MeshPhysicalMaterial({
    map: parchmentTex.map,
    normalMap: parchmentTex.normalMap,
    color: new THREE.Color(0xf4ead8),
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.68,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
    envMapIntensity: 0.6,
  });

  // Mirror-brushed Japanese stainless steel (knife blade & patisserie spatula)
  const steel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xd8dde4),
    roughness: 0.14,
    metalness: 0.95,
    clearcoat: 0.45,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.5,
  });

  // Handcrafted matte-ivory ceramic dish (warm stoneware cream)
  const ceramic = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xeae0d0),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.62,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.88,
  });

  // Clear sunlit kitchen glass (cream bowl & background carafe)
  const clearGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xedf4f2),
    roughness: 0.06,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.38,
    envMapIntensity: 1.9,
    depthWrite: false,
  });

  // Photorealistic warm human skin with subtle micro-pores & rose-peach backlit SSS
  const skin = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      map: skinTex.map,
      normalMap: skinTex.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      color: new THREE.Color(0xf4d2be),
      roughness: 0.52,
      metalness: 0.0,
      sheen: 0.26,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(0xffd7c2),
      clearcoat: 0.05,
      clearcoatRoughness: 0.58,
      envMapIntensity: 0.58,
    }),
    { color: 0xe64e38, intensity: 0.34, power: 2.5, distortion: 0.44, ambient: 0.08, rim: 0.26 }
  );

  // Soft natural fingernail
  const nail = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xeec7b8),
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.78,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.0,
  });

  // Soft cream linen cuff on wrist
  const cuff = new THREE.MeshStandardMaterial({
    map: linenTex.map,
    normalMap: linenTex.normalMap,
    color: new THREE.Color(0xe8decb),
    roughness: 0.9,
    envMapIntensity: 0.5,
  });

  // Fresh bright leaf green (for tiny mint/strawberry accent garnish on dish)
  const leafGreen = applySubsurface(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x2f751c),
      roughness: 0.36,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.9,
    }),
    { color: 0x6cd820, intensity: 0.52, power: 2.3, ambient: 0.08, rim: 0.28 }
  );

  // Soft warm ambient-occlusion shadow rim inside cream pockets behind cut fruit medallions
  const creamPocketAO = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xb8a38d),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  return {
    breadCrumb,
    breadCrust,
    whippedCream,
    whippedCreamCut,
    strawberryOuter,
    strawberryCut,
    kiwiCut,
    kiwiOuter,
    mikanOuter,
    mikanCut,
    juiceDroplet,
    woodBoard,
    walnutWood,
    linenCloth,
    parchment,
    steel,
    ceramic,
    clearGlass,
    skin,
    nail,
    cuff,
    leafGreen,
    creamPocketAO,
    bokehTex,
  };
}

/**
 * Helper: rounded organic shokupan square shape
 */
function makeShokupanShape(w = BREAD_SIZE, h = BREAD_SIZE, r = 0.28) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const s = new THREE.Shape();
  // Slight gentle bakery crown curve along top/sides so it feels authentically baked
  s.moveTo(-hw + r, -hh);
  s.quadraticCurveTo(0, -hh - 0.03, hw - r, -hh);
  s.quadraticCurveTo(hw + 0.02, -hh, hw, -hh + r);
  s.quadraticCurveTo(hw + 0.03, 0, hw, hh - r);
  s.quadraticCurveTo(hw + 0.02, hh, hw - r, hh);
  s.quadraticCurveTo(0, hh + 0.05, -hw + r, hh);
  s.quadraticCurveTo(-hw - 0.02, hh, -hw, hh - r);
  s.quadraticCurveTo(-hw - 0.03, 0, -hw, -hh + r);
  s.quadraticCurveTo(-hw - 0.02, -hh, -hw + r, -hh);
  return s;
}

/**
 * Creates a thick pillowy Japanese shokupan slice lying flat on XZ plane (Y up)
 */
export function createBreadSlice(mats, { size = BREAD_SIZE, thickness = BREAD_THICK } = {}) {
  const shape = makeShokupanShape(size, size, 0.26);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 0.07,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.032,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.center();
  // Rotate so the flat crumb face points UP (+Y)
  geo.rotateX(-Math.PI * 0.5);

  // Compute normals first so we can cleanly apply triplanar UVs:
  // Top/bottom crumb faces get planar (x, z), vertical perimeter crust faces get (x+z, y) -> ZERO crust streaking!
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = Math.abs(nrm.getY(i));
    // Gentle pillowy bread micro-undulation on top/bottom crumb
    const puff = Math.cos((x / size) * Math.PI) * Math.cos((z / size) * Math.PI) * 0.022;
    pos.setY(i, y + Math.sign(y || 1) * puff * ny);
    if (ny > 0.65) {
      uv.setXY(i, x / size + 0.5, z / size + 0.5);
    } else {
      const horiz = Math.abs(nrm.getX(i)) > Math.abs(nrm.getZ(i)) ? z : x;
      uv.setXY(i, horiz / size + 0.5, y / thickness + 0.5);
    }
  }
  geo.computeVertexNormals();

  // ExtrudeGeometry material groups: 0 = front/back crumb caps, 1 = perimeter crust
  const mesh = new THREE.Mesh(geo, [mats.breadCrumb, mats.breadCrust]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Dynamic sculptable whipped cream bed lying on top of the bottom bread slice.
 * Allows real-time tactile height sculpting with the spatula + dimpling when fruits land!
 */
export function createCreamBed(mats) {
  const group = new THREE.Group();
  const gridN = 28;
  const span = BREAD_SIZE * 0.88;
  const geo = new THREE.PlaneGeometry(span, span, gridN, gridN);
  geo.rotateX(-Math.PI * 0.5);

  const count = (gridN + 1) * (gridN + 1);
  const heights = new Float32Array(count);
  const targetHeights = new Float32Array(count);
  const basePos = new Float32Array(geo.attributes.position.array);

  // Start with a fresh inviting dollop right near the center so the child immediately sees cream!
  for (let i = 0; i < count; i++) {
    const x = basePos[i * 3];
    const z = basePos[i * 3 + 2];
    const d = Math.hypot(x + 0.12, z - 0.05);
    const initDollop = Math.max(0, 1 - d / 0.58);
    const h = Math.pow(initDollop, 1.65) * 0.24;
    heights[i] = h;
    targetHeights[i] = h;
  }

  const mesh = new THREE.Mesh(geo, mats.whippedCream);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Lush seamless pillowy cream cushion that fills cleanly between bottom & top bread during PRESS/SLICE!
  const oozeGroup = new THREE.Group();
  oozeGroup.visible = false;
  const fillGeo = new THREE.BoxGeometry(BREAD_SIZE * 0.94, 0.78, BREAD_SIZE * 0.94, 24, 12, 24);
  const fp = fillGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i);
    const y = fp.getY(i);
    const z = fp.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    // Softly round vertical corners & pillow-bulge waist outward like real squeezed whipped cream!
    const normY = y / 0.39; // -1..1
    const waistBulge = (1.0 - normY * normY) * 0.11;
    const wave = 1.0 + Math.sin(a * 6.0) * 0.02 + Math.cos(a * 10.0) * 0.012;
    const cornerPull = 1.0 - Math.pow(Math.max(0, r / (BREAD_SIZE * 0.66) - 0.72), 2) * 0.65;
    fp.setX(i, x * (1 + waistBulge) * wave * cornerPull);
    fp.setZ(i, z * (1 + waistBulge) * wave * cornerPull);
  }
  fillGeo.computeVertexNormals();
  const oozeMesh = new THREE.Mesh(fillGeo, mats.whippedCream);
  oozeMesh.position.y = 0.0;
  oozeMesh.castShadow = true;
  oozeMesh.receiveShadow = true;
  oozeGroup.add(oozeMesh);
  group.add(oozeGroup);

  let dirty = true;

  function applyGeometry() {
    const pos = geo.attributes.position;
    let changed = false;
    for (let i = 0; i < count; i++) {
      const diff = targetHeights[i] - heights[i];
      if (Math.abs(diff) > 0.0005) {
        heights[i] += diff * 0.28;
        changed = true;
      }
      const x = basePos[i * 3];
      const z = basePos[i * 3 + 2];
      // Organically scalloped spatula-spread edge falloff (never boxy!)
      const angle = Math.atan2(z, x);
      const rNorm = Math.hypot(x, z) / (span * 0.52);
      const organicR = rNorm / (0.94 + Math.sin(angle * 3.0) * 0.05 + Math.cos(angle * 5.0) * 0.03);
      const edgeMask = Math.max(0, 1 - Math.pow(Math.min(organicR, 1.0), 3.2));
      const h = heights[i] * (0.1 + 0.9 * edgeMask);
      // Push completely uncovered vertices slightly below bread top so zero z-fighting!
      const y = h < 0.012 ? -0.025 : h;
      pos.setY(i, y);
    }
    if (changed || dirty) {
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      dirty = false;
    }
  }

  function paint(localX, localZ, radius = 0.58, amount = 0.14, dirX = 1, dirZ = 0) {
    let added = 0;
    const maxH = 0.36;
    for (let i = 0; i < count; i++) {
      const vx = basePos[i * 3];
      const vz = basePos[i * 3 + 2];
      const dx = vx - localX;
      const dz = vz - localZ;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        const t = 1 - dist / radius;
        const smooth = t * t * (3 - 2 * t);
        // Add subtle realistic spatula swirl ridge perpendicular to stroke direction
        const perp = -dx * dirZ + dz * dirX;
        const ridge = Math.sin(perp * 15.0) * 0.018 * smooth;
        const prev = targetHeights[i];
        const next = Math.min(maxH, Math.max(prev + amount * smooth + ridge, 0.14 * smooth));
        if (next > prev) added += next - prev;
        targetHeights[i] = next;
      }
    }
    dirty = true;
    return added;
  }

  // Create a soft pillowy dimple + raised creamy ring around a newly placed fruit!
  function nestFruit(localX, localZ, radius = 0.42) {
    for (let i = 0; i < count; i++) {
      const vx = basePos[i * 3];
      const vz = basePos[i * 3 + 2];
      const d = Math.hypot(vx - localX, vz - localZ);
      if (d < radius * 1.45) {
        if (d < radius * 0.7) {
          targetHeights[i] = Math.max(0.08, targetHeights[i] * 0.65);
        } else {
          const ringT = 1 - Math.abs(d - radius * 1.02) / (radius * 0.45);
          if (ringT > 0) {
            targetHeights[i] = Math.min(0.42, targetHeights[i] + ringT * 0.12);
          }
        }
      }
    }
    dirty = true;
  }

  // Fill thick blanket over fruits when sandwiching
  function fillBlanket() {
    for (let i = 0; i < count; i++) {
      const vx = basePos[i * 3];
      const vz = basePos[i * 3 + 2];
      const d = Math.hypot(vx, vz);
      const dome = Math.max(0.28, 0.72 - d * 0.24);
      targetHeights[i] = Math.max(targetHeights[i], dome);
    }
    dirty = true;
  }

  function getCoverage() {
    let covered = 0;
    for (let i = 0; i < count; i++) {
      if (targetHeights[i] > 0.11) covered++;
    }
    return covered / count;
  }

  function getAverageThickness() {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += targetHeights[i];
    return sum / count;
  }

  function reset() {
    for (let i = 0; i < count; i++) {
      const x = basePos[i * 3];
      const z = basePos[i * 3 + 2];
      const d = Math.hypot(x + 0.12, z - 0.05);
      const initDollop = Math.max(0, 1 - d / 0.58);
      const h = Math.pow(initDollop, 1.65) * 0.24;
      heights[i] = h;
      targetHeights[i] = h;
    }
    oozeGroup.visible = false;
    dirty = true;
    applyGeometry();
  }

  applyGeometry();

  return {
    group,
    mesh,
    oozeGroup,
    paint,
    nestFruit,
    fillBlanket,
    getCoverage,
    getAverageThickness,
    update: applyGeometry,
    reset,
  };
}

/**
 * Helper: sprinkle glistening 3D micro dew/juice droplets onto a fruit mesh group
 */
function addJuiceDroplets(group, mats, positions) {
  const dropGeo = new THREE.SphereGeometry(1, 8, 8);
  for (const [x, y, z, r] of positions) {
    const d = new THREE.Mesh(dropGeo, mats.juiceDroplet);
    d.position.set(x, y, z);
    d.scale.set(r, r * 0.72, r);
    group.add(d);
  }
}

/**
 * Photorealistic ripe hulled Japanese Strawberry (Amaou/Tochiotome shape!)
 */
export function createStrawberry(mats, scale = 1.0) {
  const group = new THREE.Group();
  // Organic plump strawberry profile (LatheGeometry, base hulled flat, tapering to rounded ruby tip at +Y)
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.32, 0.07),
    new THREE.Vector2(0.35, 0.19),
    new THREE.Vector2(0.33, 0.34),
    new THREE.Vector2(0.26, 0.49),
    new THREE.Vector2(0.16, 0.63),
    new THREE.Vector2(0.06, 0.71),
    new THREE.Vector2(0.0, 0.73),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  // Subtle organic heart asymmetry so it looks hand-picked, never lathe-mechanical
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const lobe = 1.0 + Math.cos(a * 2) * 0.055 + Math.sin(a * 3) * 0.025;
    pos.setX(i, x * lobe);
    pos.setZ(i, z * (2 - lobe * 0.96));
    if (y > 0.4) {
      pos.setX(i, pos.getX(i) + (y - 0.4) * 0.04);
    }
  }
  geo.computeVertexNormals();
  geo.translate(0, -0.34, 0);

  const body = new THREE.Mesh(geo, mats.strawberryOuter);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Subtle pale-pink hulled stem base cap
  const hullCap = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    mats.strawberryCut
  );
  hullCap.rotation.x = Math.PI * 0.5;
  hullCap.position.y = -0.338;
  group.add(hullCap);

  // Glistening 3D morning dew/juice droplets catching window backlight!
  addJuiceDroplets(group, mats, [
    [0.24, -0.06, 0.22, 0.024],
    [-0.22, 0.08, 0.21, 0.02],
    [0.14, 0.21, 0.16, 0.018],
    [-0.1, -0.15, 0.3, 0.022],
    [0.29, -0.12, -0.12, 0.019],
    [0.04, 0.31, 0.11, 0.016],
  ]);

  group.scale.setScalar(scale);
  group.userData.fruitType = 'strawberry';
  return group;
}

/**
 * Photorealistic peeled Emerald Kiwi chunk/half (soft rounded beveled rim — juicy translucent jade!)
 */
export function createKiwiPiece(mats, scale = 1.0) {
  const group = new THREE.Group();
  // Smooth organic rounded-edge peeled kiwi profile via LatheGeometry (no harsh 90-degree cylinder corners!)
  const pts = [
    new THREE.Vector2(0.0, -0.13),
    new THREE.Vector2(0.29, -0.13),
    new THREE.Vector2(0.35, -0.105),
    new THREE.Vector2(0.375, -0.05),
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.375, 0.05),
    new THREE.Vector2(0.35, 0.105),
    new THREE.Vector2(0.29, 0.13),
    new THREE.Vector2(0.0, 0.13),
  ];
  const bodyGeo = new THREE.LatheGeometry(pts, 28);
  bodyGeo.scale(1.08, 1.0, 0.92);
  const body = new THREE.Mesh(bodyGeo, mats.kiwiOuter);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Glossy translucent emerald cut face caps cleanly nestled on top & bottom
  const capGeo = new THREE.CircleGeometry(0.34, 28);
  capGeo.rotateX(-Math.PI * 0.5);
  capGeo.scale(1.08, 1.0, 0.92);
  const topCap = new THREE.Mesh(capGeo, mats.kiwiCut);
  topCap.position.y = 0.131;
  topCap.receiveShadow = true;
  const botCap = new THREE.Mesh(capGeo, mats.kiwiCut);
  botCap.rotation.x = Math.PI;
  botCap.position.y = -0.131;
  group.add(topCap, botCap);

  // Crystal-clear wet droplets on the emerald face
  addJuiceDroplets(group, mats, [
    [0.16, 0.135, 0.11, 0.022],
    [-0.19, 0.135, 0.06, 0.019],
    [0.05, 0.135, -0.18, 0.017],
    [-0.08, 0.135, 0.19, 0.016],
  ]);

  group.scale.setScalar(scale);
  group.userData.fruitType = 'kiwi';
  return group;
}

/**
 * Photorealistic whole peeled Japanese Mikan (Mandarin Orange) with real 10-segment lobes!
 */
export function createMikan(mats, scale = 1.0) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.41, 30, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const rXZ = Math.hypot(x, z);
    // Authentic 10-segment plump citrus scalloping + oblate mandarin silhouette
    const segLobe = 1.0 + Math.abs(Math.sin(a * 5.0)) * 0.065 * (rXZ / 0.41);
    const dimple = Math.exp(-rXZ * rXZ * 18.0) * 0.045;
    pos.setX(i, x * segLobe);
    pos.setZ(i, z * segLobe);
    pos.setY(i, y * 0.72 - Math.sign(y || 1) * dimple);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mats.mikanOuter);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Glistening amber citrus droplets
  addJuiceDroplets(group, mats, [
    [0.24, 0.16, 0.24, 0.024],
    [-0.22, 0.19, 0.18, 0.021],
    [0.08, 0.25, 0.21, 0.019],
    [0.32, 0.05, -0.14, 0.02],
  ]);

  group.scale.setScalar(scale);
  group.userData.fruitType = 'mikan';
  return group;
}

/**
 * Helper: Heart/Tulip Blossom 2D shape for Strawberry Flower Cross-Section!
 */
function makeTulipBlossomShape(w = 0.44, h = 0.56) {
  const s = new THREE.Shape();
  s.moveTo(0, -h * 0.46);
  s.bezierCurveTo(w * 0.56, -h * 0.42, w * 0.62, h * 0.08, w * 0.34, h * 0.38);
  s.bezierCurveTo(w * 0.16, h * 0.54, w * 0.05, h * 0.56, 0, h * 0.56);
  s.bezierCurveTo(-w * 0.05, h * 0.56, -w * 0.16, h * 0.54, -w * 0.34, h * 0.38);
  s.bezierCurveTo(-w * 0.62, h * 0.08, -w * 0.56, -h * 0.42, 0, -h * 0.46);
  return s;
}

/**
 * Helper: Leaf/Petal 2D shape for Emerald Kiwi Leaf Cross-Section!
 */
function makeKiwiLeafShape(w = 0.26, h = 0.52) {
  const s = new THREE.Shape();
  s.moveTo(0, -h * 0.5);
  s.bezierCurveTo(w * 0.68, -h * 0.22, w * 0.64, h * 0.24, 0, h * 0.5);
  s.bezierCurveTo(-w * 0.64, h * 0.24, -w * 0.68, -h * 0.22, 0, -h * 0.5);
  return s;
}

/**
 * Normalizes planar UVs of a 2D ExtrudeGeometry/ShapeGeometry into [0,1]x[0,1]
 */
function normalizeShapeUVs(geo, width, height) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const dx = Math.max(0.001, bb.max.x - bb.min.x);
  const dy = Math.max(0.001, bb.max.y - bb.min.y);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / dx, (pos.getY(i) - bb.min.y) / dy);
  }
  uv.needsUpdate = true;
}

/**
 * Builds one half ('front' or 'back', mirrored cleanly) of the sliced Fruit Sandwich
 * with a TRUE, LUSCIOUS, DYNAMIC 3D FLOWER CROSS-SECTION (お花の断面) driven by the
 * exact fruits & cream thickness the child created!
 *
 * Coordinate convention for each half:
 * - Centered horizontally on X (width = BREAD_SIZE)
 * - Total height = bottom bread + thick cream & flower cross-section + top bread (~1.38 units tall!)
 * - Cut face lies at local z = +halfDepth * 0.5 facing +Z (for the hero display half!)
 *   Wait: to keep both halves crystal clear when they part & tilt open toward the camera,
 *   we build each half with its cut cross-section face at local z = 0 facing +Z (and bulk extending to -Z)!
 */
export function createSlicedSandwichHalf(mats, { fruits = [], creamThickness = 0.28, mirrorX = false } = {}) {
  const root = new THREE.Group();
  const halfDepth = BREAD_SIZE * 0.495;
  const fillingH = THREE.MathUtils.clamp(0.92 + creamThickness * 0.45, 0.96, 1.14);
  const breadT = BREAD_THICK * 0.88;
  const totalH = fillingH + breadT * 2;

  // Inner pivot shifted so bottom sits neatly at y = 0
  const body = new THREE.Group();
  body.position.y = totalH * 0.5;
  root.add(body);

  // 1. Half-slice Shokupan bread helper (cut face FLUSH at z = 0, bulk extending cleanly to -Z!)
  function makeHalfBread(yOffset) {
    const hw = BREAD_SIZE * 0.5;
    const r = 0.24;
    const s = new THREE.Shape();
    // Clean straight cut edge along y = 0; rounded crust back edge at y = +halfDepth.
    // Rotating by -PI/2 around X maps shape +Y -> -Z (behind cut plane) and extrusion +Z -> +Y!
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, halfDepth - r);
    s.quadraticCurveTo(hw, halfDepth, hw - r, halfDepth);
    s.quadraticCurveTo(0, halfDepth + 0.03, -hw + r, halfDepth);
    s.quadraticCurveTo(-hw, halfDepth, -hw, halfDepth - r);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: breadT - 0.036,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 8,
    });
    // CRITICAL: -PI/2 maps shape +Y -> -Z (away from viewer) so cut edge sits FLUSH at z = 0!
    geo.rotateX(-Math.PI * 0.5);
    geo.translate(0, -(breadT - 0.036) * 0.5, 0);
    // Clean triplanar UVs (prevents vertical crust streaking!)
    geo.computeVertexNormals();
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      if (Math.abs(n.getY(i)) > 0.65) {
        uv.setXY(i, x / BREAD_SIZE + 0.5, z / BREAD_SIZE + 0.5);
      } else {
        const horiz = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? z : x;
        uv.setXY(i, horiz / BREAD_SIZE + 0.5, y / breadT + 0.5);
      }
    }
    uv.needsUpdate = true;

    const m = new THREE.Mesh(geo, [mats.breadCrumb, mats.breadCrust]);
    m.position.y = yOffset;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  const bottomBread = makeHalfBread(-(fillingH * 0.5 + breadT * 0.5));
  const topBread = makeHalfBread(fillingH * 0.5 + breadT * 0.5);
  body.add(bottomBread, topBread);

  // Clean fluffy milk-bread crumb cut-edge strip flush at z = +0.021 with aspect-correct round bread pore UVs!
  const cutBreadFaceGeo = new THREE.PlaneGeometry(BREAD_SIZE * 0.99, breadT * 0.98);
  const cbUv = cutBreadFaceGeo.attributes.uv;
  const aspectV = (breadT * 0.98) / (BREAD_SIZE * 0.99);
  for (let i = 0; i < cbUv.count; i++) {
    cbUv.setXY(i, cbUv.getX(i) * 1.0, cbUv.getY(i) * aspectV);
  }
  cbUv.needsUpdate = true;
  const cutBottomFace = new THREE.Mesh(cutBreadFaceGeo, mats.breadCrumb);
  cutBottomFace.position.set(0, -(fillingH * 0.5 + breadT * 0.5), 0.021);
  const cutTopFace = new THREE.Mesh(cutBreadFaceGeo, mats.breadCrumb);
  cutTopFace.position.set(0, fillingH * 0.5 + breadT * 0.5, 0.021);
  body.add(cutBottomFace, cutTopFace);

  // Subtle soft contact-shadow strip right under the top shokupan overhang & above bottom bread (real macro depth!)
  const overhangShadowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x9a8268),
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const topContactAO = new THREE.Mesh(new THREE.PlaneGeometry(BREAD_SIZE * 0.96, 0.075), overhangShadowMat);
  topContactAO.position.set(0, fillingH * 0.5 - 0.025, 0.0205);
  const botContactAO = new THREE.Mesh(new THREE.PlaneGeometry(BREAD_SIZE * 0.96, 0.055), overhangShadowMat);
  botContactAO.position.set(0, -fillingH * 0.5 + 0.02, 0.0205);
  body.add(topContactAO, botContactAO);

  // 2. Lush, pillowy snow-white whipped cream filling block (silky organic knife-cut face flush at z = +0.018!)
  const creamW = BREAD_SIZE * 0.97;
  const creamGeo = new THREE.BoxGeometry(creamW, fillingH + 0.03, halfDepth * 0.96, 20, 12, 10);
  const cp = creamGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const z = cp.getZ(i);
    const normZ = (z + halfDepth * 0.48) / (halfDepth * 0.96); // 0 at back, 1 at cut face
    const normX = Math.abs(x) / (creamW * 0.5);
    const bulgeY = Math.cos((y / fillingH) * Math.PI) * 0.068;
    if (normZ < 0.92) {
      cp.setX(i, x * (1 + bulgeY * (1 - normZ * 0.45)));
      cp.setZ(i, z - bulgeY * (1 - normZ) * 0.35);
    } else {
      // Gently pillow-bevel the left/right edges of the cut cream face so it never looks like a hard cardboard box!
      const edgeSoft = Math.pow(Math.max(0, normX - 0.84) / 0.16, 2) * 0.032;
      const microWave = Math.sin(x * 4.5 + y * 5.2) * 0.004;
      cp.setZ(i, z - edgeSoft + microWave);
    }
  }
  creamGeo.computeVertexNormals();
  const creamBlock = new THREE.Mesh(creamGeo, mats.whippedCreamCut);
  creamBlock.position.set(0, 0, -halfDepth * 0.48 + 0.018);
  creamBlock.castShadow = true;
  creamBlock.receiveShadow = true;
  body.add(creamBlock);

  // 3. THE STAR OF THE SHOW: Glistening 3D Backlit FLOWER CROSS-SECTION (お花の断面)!
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, 0, 0.021);
  body.add(faceGroup);

  const sorted = [...fruits].sort((a, b) => a.x - b.x);
  const strawberries = sorted.filter((f) => f.type === 'strawberry');
  const kiwis = sorted.filter((f) => f.type === 'kiwi');
  const mikans = sorted.filter((f) => f.type === 'mikan');

  // Subtle convex dome helper for cut fruit faces -> catches juicy crescent specular highlights instead of flat mirror glare!
  function addMicroConvexity(geo, radius, dome = 0.016) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (z > 0.005) {
        const r = Math.hypot(p.getX(i), p.getY(i));
        const t = Math.max(0, 1 - (r / Math.max(radius, 0.01)) ** 2);
        p.setZ(i, z + t * dome);
      }
    }
    geo.computeVertexNormals();
  }

  function addPocketShadow(x, y, rx, ry, rotZ = 0) {
    const aoGeo = new THREE.CircleGeometry(1, 20);
    const ao = new THREE.Mesh(aoGeo, mats.creamPocketAO);
    ao.scale.set(rx, ry, 1);
    ao.position.set(mirrorX ? -x : x, y - 0.014, 0.003);
    ao.rotation.z = mirrorX ? -rotZ : rotZ;
    faceGroup.add(ao);
  }

  function addStrawberryPetal(x, y, rotZ, scale = 1.0, zBump = 0.014) {
    addPocketShadow(x, y, 0.25 * scale, 0.31 * scale, rotZ);
    const shape = makeTulipBlossomShape(0.42 * scale, 0.52 * scale);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
      curveSegments: 16,
    });
    normalizeShapeUVs(geo, 0.42 * scale, 0.52 * scale);
    addMicroConvexity(geo, 0.28 * scale, 0.018);
    const m = new THREE.Mesh(geo, [mats.strawberryCut, mats.strawberryOuter]);
    m.position.set(mirrorX ? -x : x, y, zBump);
    m.rotation.z = mirrorX ? -rotZ : rotZ;
    m.castShadow = true;
    faceGroup.add(m);

    addJuiceDroplets(m, mats, [
      [0.08 * scale, 0.07 * scale, 0.044, 0.016],
      [-0.09 * scale, -0.04 * scale, 0.042, 0.014],
      [0.02 * scale, 0.14 * scale, 0.042, 0.013],
    ]);
  }

  function addKiwiLeaf(x, y, rotZ, scale = 1.0, mode = 'leaf', zBump = 0.011) {
    if (mode === 'round') {
      addPocketShadow(x, y, 0.29 * scale, 0.29 * scale, 0);
      const geo = new THREE.CylinderGeometry(0.27 * scale, 0.27 * scale, 0.032, 24);
      geo.rotateX(Math.PI * 0.5);
      addMicroConvexity(geo, 0.28 * scale, 0.014);
      const m = new THREE.Mesh(geo, [mats.kiwiOuter, mats.kiwiCut, mats.kiwiCut]);
      m.position.set(mirrorX ? -x : x, y, zBump + 0.008);
      m.rotation.z = mirrorX ? -rotZ : rotZ;
      faceGroup.add(m);
      addJuiceDroplets(m, mats, [
        [0.09 * scale, 0.05 * scale, 0.026, 0.015],
        [-0.07 * scale, -0.08 * scale, 0.026, 0.013],
      ]);
      return;
    }
    const w = (mode === 'stem' ? 0.13 : 0.28) * scale;
    const h = (mode === 'stem' ? 0.44 : 0.48) * scale;
    addPocketShadow(x, y, w * 0.58, h * 0.54, rotZ);
    const shape = makeKiwiLeafShape(w, h);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.009,
      bevelSegments: 2,
      curveSegments: 12,
    });
    normalizeShapeUVs(geo, w, h);
    addMicroConvexity(geo, h * 0.48, 0.013);
    const m = new THREE.Mesh(geo, [mats.kiwiCut, mats.kiwiOuter]);
    m.position.set(mirrorX ? -x : x, y, zBump);
    m.rotation.z = mirrorX ? -rotZ : rotZ;
    faceGroup.add(m);
    if (mode !== 'stem') {
      addJuiceDroplets(m, mats, [
        [0.03 * scale, 0.06 * scale, 0.038, 0.014],
        [-0.03 * scale, -0.05 * scale, 0.038, 0.012],
      ]);
    }
  }

  function addMikanBlossom(x, y, scale = 1.0, zBump = 0.016) {
    addPocketShadow(x, y, 0.33 * scale, 0.33 * scale, 0);
    const geo = new THREE.CylinderGeometry(0.31 * scale, 0.31 * scale, 0.034, 28);
    geo.rotateX(Math.PI * 0.5);
    addMicroConvexity(geo, 0.32 * scale, 0.018);
    const m = new THREE.Mesh(geo, [mats.mikanOuter, mats.mikanCut, mats.mikanCut]);
    m.position.set(mirrorX ? -x : x, y, zBump + 0.01);
    m.rotation.z = 0.22;
    faceGroup.add(m);
    addJuiceDroplets(m, mats, [
      [0.11 * scale, 0.09 * scale, 0.028, 0.017],
      [-0.12 * scale, 0.04 * scale, 0.028, 0.015],
      [0.02 * scale, -0.13 * scale, 0.028, 0.014],
    ]);
  }

  // Signature Japanese "Ohana Fruit Sando" floral composition — stems connect seamlessly into blossoms!
  const hasBlossom = strawberries.length > 0 || mikans.length > 0;
  const hasLeaf = kiwis.length > 0;

  if (sorted.length === 0) {
    addStrawberryPetal(0, 0.14, 0, 1.02);
    addKiwiLeaf(0.0, -0.19, 0.0, 0.94, 'stem', 0.008);
    addKiwiLeaf(-0.36, -0.2, 0.78, 0.96, 'leaf', 0.012);
    addKiwiLeaf(0.36, -0.2, -0.78, 0.96, 'leaf', 0.012);
  } else if (hasBlossom && hasLeaf) {
    const blossoms = [...strawberries, ...mikans].sort((a, b) => a.x - b.x);
    const bCount = Math.min(blossoms.length, 3);
    if (bCount === 1) {
      const b = blossoms[0];
      if (b.type === 'strawberry') addStrawberryPetal(0, 0.14, 0, 1.08, 0.018);
      else addMikanBlossom(0, 0.12, 1.05, 0.019);
      addKiwiLeaf(0.0, -0.19, 0.0, 0.98, 'stem', 0.008);
      addKiwiLeaf(-0.42, -0.19, 0.76, 1.0, 'leaf', 0.013);
      addKiwiLeaf(0.42, -0.19, -0.76, 1.0, 'leaf', 0.013);
    } else if (bCount === 2) {
      blossoms.slice(0, 2).forEach((b, idx) => {
        const bx = idx === 0 ? -0.44 : 0.44;
        const by = 0.13;
        if (b.type === 'strawberry') addStrawberryPetal(bx, by, idx === 0 ? 0.14 : -0.14, 0.96, 0.018);
        else addMikanBlossom(bx, by, 0.94, 0.019);
        addKiwiLeaf(bx * 0.94, -0.19, idx === 0 ? -0.1 : 0.1, 0.88, 'stem', 0.008);
      });
      addKiwiLeaf(-0.78, -0.16, 0.68, 0.92, 'leaf', 0.013);
      addKiwiLeaf(0.78, -0.16, -0.68, 0.92, 'leaf', 0.013);
      addKiwiLeaf(0.0, -0.16, 0.0, 0.84, 'leaf', 0.012);
    } else {
      const xs = [-0.62, 0.0, 0.62];
      const ys = [0.09, 0.17, 0.09];
      blossoms.slice(0, 3).forEach((b, idx) => {
        if (b.type === 'strawberry') addStrawberryPetal(xs[idx], ys[idx], -xs[idx] * 0.34, 0.86, 0.018);
        else addMikanBlossom(xs[idx], ys[idx], 0.84, 0.019);
      });
      addKiwiLeaf(0.0, -0.19, 0.0, 0.95, 'stem', 0.008);
      addKiwiLeaf(-0.44, -0.2, 0.72, 0.95, 'leaf', 0.013);
      addKiwiLeaf(0.44, -0.2, -0.72, 0.95, 'leaf', 0.013);
    }
  } else {
    const count = Math.min(sorted.length, 4);
    sorted.slice(0, count).forEach((f, idx) => {
      const spreadX = count === 1 ? 0 : ((idx / (count - 1)) - 0.5) * Math.min(1.22, count * 0.44);
      const y = count >= 3 && idx === Math.floor(count / 2) ? 0.08 : -0.02;
      if (f.type === 'strawberry') {
        addStrawberryPetal(spreadX, y + 0.04, -spreadX * 0.36, count <= 2 ? 1.02 : 0.88);
      } else if (f.type === 'mikan') {
        addMikanBlossom(spreadX, y, count <= 2 ? 1.02 : 0.88);
      } else {
        addKiwiLeaf(spreadX, y, -spreadX * 0.25, count <= 2 ? 1.05 : 0.88, 'round');
      }
    });
  }

  // Interactive bite state support (0 = intact, 1..3 = progressive realistic nibbles!)
  root.userData.bites = 0;
  root.userData.applyBite = (biteLevel) => {
    root.userData.bites = biteLevel;
    if (biteLevel === 0) {
      body.scale.set(1, 1, 1);
      body.rotation.z = 0;
      root.visible = true;
    } else if (biteLevel === 1) {
      // First cheerful nibble: shrinks slightly + tilts playfully as if corner bitten
      body.scale.set(0.86, 0.88, 0.9);
      body.rotation.z = mirrorX ? 0.06 : -0.06;
    } else if (biteLevel === 2) {
      // Big second bite!
      body.scale.set(0.62, 0.68, 0.72);
      body.rotation.z = mirrorX ? -0.08 : 0.08;
    } else {
      // All eaten! Delicious!
      root.visible = false;
    }
  };

  return root;
}

/**
 * Patisserie Offset Stainless Spatula with warm wooden handle
 */
export function createSpatula(mats) {
  const group = new THREE.Group();

  // Warm smooth walnut handle
  const handleGeo = new THREE.CapsuleGeometry(0.11, 0.95, 8, 16);
  handleGeo.rotateZ(Math.PI * 0.5);
  const handle = new THREE.Mesh(handleGeo, mats.walnutWood);
  handle.position.set(0.78, 0.14, 0);
  handle.castShadow = true;
  group.add(handle);

  // Brass/steel ferrule collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.16, 16), mats.steel);
  collar.rotation.z = Math.PI * 0.5;
  collar.position.set(0.24, 0.14, 0);
  group.add(collar);

  // Offset cranked neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.028, 0.15), mats.steel);
  neck.position.set(0.06, 0.08, 0);
  neck.rotation.z = 0.42;
  neck.castShadow = true;
  group.add(neck);

  // Sleek rounded patisserie spatula blade
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -0.14);
  bladeShape.lineTo(-1.02, -0.14);
  bladeShape.absarc(-1.02, 0, 0.14, -Math.PI * 0.5, Math.PI * 0.5, true);
  bladeShape.lineTo(0, 0.14);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  bladeGeo.rotateX(Math.PI * 0.5);
  const blade = new THREE.Mesh(bladeGeo, mats.steel);
  blade.position.set(-0.08, 0.02, 0);
  blade.castShadow = true;
  group.add(blade);

  // Fresh glossy dollop of whipped cream on the tip of the spatula blade!
  const tipCream = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mats.whippedCream);
  tipCream.scale.set(1.5, 0.45, 0.95);
  tipCream.position.set(-0.88, 0.06, 0);
  group.add(tipCream);

  group.userData.tipCream = tipCream;
  return group;
}

/**
 * Gleaming Japanese Stainless Steel Fruit-Sando Knife
 */
export function createKnife(mats) {
  const group = new THREE.Group();

  // Mirror-polished Santoku/Petty fruit-sando blade
  const bShape = new THREE.Shape();
  bShape.moveTo(0, -0.18);
  bShape.lineTo(-2.35, -0.18);
  bShape.quadraticCurveTo(-2.72, -0.12, -2.85, 0.18);
  bShape.lineTo(0, 0.24);
  bShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  bladeGeo.translate(0, 0, -0.014);
  const blade = new THREE.Mesh(bladeGeo, mats.steel);
  blade.castShadow = true;
  group.add(blade);

  // Subtle cream kiss smear along blade (shown during/after cut)
  const smear = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.048), mats.whippedCream);
  smear.position.set(-1.35, -0.08, 0);
  smear.visible = false;
  group.add(smear);

  // Polished bolster
  const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.18), mats.steel);
  bolster.position.set(0.11, 0.04, 0);
  group.add(bolster);

  // Ergonomic dark walnut handle
  const hGeo = new THREE.CapsuleGeometry(0.14, 1.12, 8, 16);
  hGeo.rotateZ(Math.PI * 0.5);
  const handle = new THREE.Mesh(hGeo, mats.walnutWood);
  handle.scale.set(1.0, 1.15, 0.82);
  handle.position.set(0.84, 0.06, 0);
  handle.castShadow = true;
  group.add(handle);

  group.userData.creamSmear = smear;
  return group;
}

/**
 * Photorealistic Seamless Sculpted 3D Human Right Hand
 * Continuous lofted palm+wrist+forearm & seamless tapered fingers (zero mechanical capsule seams!)
 */
export function createRealisticHand(mats) {
  const root = new THREE.Group();
  const handRig = new THREE.Group();
  root.add(handRig);

  // 1. Continuous anatomical palm + narrow wrist + graceful forearm via sculpted LatheGeometry (ZERO wrist seam!)
  const armProfile = [
    new THREE.Vector2(0.0, -0.58), // front knuckle arch
    new THREE.Vector2(0.32, -0.55),
    new THREE.Vector2(0.49, -0.42), // broad knuckles
    new THREE.Vector2(0.52, -0.18), // palm center
    new THREE.Vector2(0.47, 0.16),  // heel of palm
    new THREE.Vector2(0.34, 0.44),  // smooth tapered wrist
    new THREE.Vector2(0.33, 0.72),
    new THREE.Vector2(0.37, 1.35),  // forearm
    new THREE.Vector2(0.4, 1.85),
  ];
  const palmGeo = new THREE.LatheGeometry(armProfile, 28);
  palmGeo.rotateZ(-Math.PI * 0.5); // axis along +X (knuckles at -0.55, forearm at +1.85)
  const pp = palmGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i);
    const y = pp.getY(i);
    const z = pp.getZ(i);
    // Flatten palm gracefully (thinner in Y, wider in Z across knuckles, rounder at wrist/forearm)
    const tArm = THREE.MathUtils.clamp((x + 0.55) / 1.4, 0, 1);
    const yScale = THREE.MathUtils.lerp(0.42, 0.72, tArm);
    const zScale = THREE.MathUtils.lerp(1.02, 0.88, tArm);
    // Subtle anatomical arch on back of hand
    const arch = Math.max(0, 1 - Math.abs(x + 0.1) * 1.4) * 0.04;
    pp.setY(i, y * yScale + arch);
    pp.setZ(i, z * zScale);
  }
  palmGeo.computeVertexNormals();
  const palm = new THREE.Mesh(palmGeo, mats.skin);
  palm.castShadow = true;
  palm.receiveShadow = true;
  handRig.add(palm);

  // Soft cream morning linen blouse sleeve cuff overlapping forearm seamlessly
  const cuffGeo = new THREE.CylinderGeometry(0.46, 0.52, 1.9, 24);
  cuffGeo.rotateZ(Math.PI * 0.5);
  const cuff = new THREE.Mesh(cuffGeo, mats.cuff);
  cuff.scale.set(1, 0.72, 0.98);
  cuff.position.set(2.35, 0.02, 0.02);
  cuff.castShadow = true;
  handRig.add(cuff);

  // 2. Seamless Continuous Tapered Anatomical Fingers (real smooth skin bend via vertex deformation!)
  function makeSeamlessFinger(length, baseRadius, zOffset, xOffset, isThumb = false) {
    const rootG = new THREE.Group();
    rootG.position.set(xOffset, 0.0, zOffset);

    const segsLen = 18;
    const radialSegs = 14;
    const geo = new THREE.CylinderGeometry(baseRadius * 0.64, baseRadius, length, radialSegs, segsLen, false);
    // Add rounded fingertip cap at top (+Y before rotate)
    geo.translate(0, length * 0.5, 0);
    const pos = geo.attributes.position;
    const restPos = new Float32Array(pos.array);

    // Sculpt smooth anatomical taper + gentle knuckle contours + rounded fingertip
    for (let i = 0; i < pos.count; i++) {
      const rx = restPos[i * 3];
      const ry = restPos[i * 3 + 1]; // 0 at base -> length at tip
      const rz = restPos[i * 3 + 2];
      const t = THREE.MathUtils.clamp(ry / length, 0, 1);
      // Soft fingertip dome rounding
      let rMod = 1.0;
      if (t > 0.88) {
        const u = (t - 0.88) / 0.12;
        rMod = Math.sqrt(Math.max(0.02, 1 - u * u * 0.92));
      } else {
        // Delicate anatomical knuckle swell at t = 0.44 and t = 0.74
        rMod += Math.exp(-Math.pow((t - 0.44) / 0.09, 2)) * 0.055;
        rMod += Math.exp(-Math.pow((t - 0.74) / 0.08, 2)) * 0.04;
      }
      // Slightly oval cross-section (wider horizontally than thick vertically)
      restPos[i * 3] = rx * rMod * 0.88;
      restPos[i * 3 + 2] = rz * rMod * 1.02;
    }

    const mesh = new THREE.Mesh(geo, mats.skin);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rootG.add(mesh);

    // Natural manicured glossy fingernail anchored dynamically to fingertip
    const nailGeo = new THREE.SphereGeometry(baseRadius * 0.56, 12, 10);
    nailGeo.scale(1.3, 0.22, 0.78);
    const nail = new THREE.Mesh(nailGeo, mats.nail);
    rootG.add(nail);

    handRig.add(rootG);

    function applyCurl(curl) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const lx = restPos[i * 3];     // local thickness (+Y in hand space)
        const ly = restPos[i * 3 + 1]; // along finger (-X in hand space)
        const lz = restPos[i * 3 + 2]; // width (Z)
        const t = THREE.MathUtils.clamp(ly / length, 0, 1);
        // Smooth continuous curved bend (zero sharp kinks!)
        const theta = curl * (0.28 * t + 0.95 * t * t);
        const cx = -ly * Math.cos(theta * 0.55) + lx * Math.sin(theta);
        const cy = -ly * Math.sin(theta * 0.55) + lx * Math.cos(theta);
        p.setXYZ(i, cx, cy, lz);
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();

      // Position nail smoothly on curved fingertip
      const tTip = 0.89;
      const thetaTip = curl * (0.28 * tTip + 0.95 * tTip * tTip);
      const tipLy = length * tTip;
      const tipOff = baseRadius * 0.58;
      nail.position.set(
        -tipLy * Math.cos(thetaTip * 0.55) + tipOff * Math.sin(thetaTip),
        -tipLy * Math.sin(thetaTip * 0.55) + tipOff * Math.cos(thetaTip),
        0
      );
      nail.rotation.z = thetaTip;
    }

    applyCurl(0.3);
    return { rootG, applyCurl, isThumb };
  }

  const indexF = makeSeamlessFinger(0.96, 0.118, -0.32, -0.44);
  const middleF = makeSeamlessFinger(1.06, 0.122, -0.1, -0.48);
  const ringF = makeSeamlessFinger(0.96, 0.115, 0.12, -0.45);
  const pinkyF = makeSeamlessFinger(0.76, 0.098, 0.32, -0.38);
  const thumb = makeSeamlessFinger(0.78, 0.14, -0.38, 0.06, true);
  thumb.rootG.rotation.y = 0.58;
  thumb.rootG.rotation.x = 0.25;

  const fingers = [indexF, middleF, ringF, pinkyF];

  const targetCurls = [0.28, 0.34, 0.4, 0.46];
  const curCurls = [0.28, 0.34, 0.4, 0.46];
  let thumbTarget = 0.32;
  let thumbCur = 0.32;
  let tiltTarget = new THREE.Euler(0.15, 0, 0.15);

  function setPose(pose) {
    if (pose === 'spatula') {
      targetCurls[0] = 0.48;
      targetCurls[1] = 0.72;
      targetCurls[2] = 0.82;
      targetCurls[3] = 0.88;
      thumbTarget = 0.45;
      tiltTarget.set(0.24, 0.12, 0.18);
    } else if (pose === 'pinch') {
      targetCurls[0] = 0.68;
      targetCurls[1] = 0.48;
      targetCurls[2] = 0.62;
      targetCurls[3] = 0.72;
      thumbTarget = 0.62;
      tiltTarget.set(0.3, 0.16, 0.36);
    } else if (pose === 'press') {
      targetCurls[0] = 0.1;
      targetCurls[1] = 0.12;
      targetCurls[2] = 0.14;
      targetCurls[3] = 0.16;
      thumbTarget = 0.18;
      tiltTarget.set(0.05, 0.05, 0.02);
    } else if (pose === 'knife') {
      targetCurls[0] = 0.58;
      targetCurls[1] = 0.85;
      targetCurls[2] = 0.92;
      targetCurls[3] = 0.96;
      thumbTarget = 0.55;
      tiltTarget.set(0.28, 0.08, 0.14);
    } else {
      targetCurls[0] = 0.24;
      targetCurls[1] = 0.3;
      targetCurls[2] = 0.36;
      targetCurls[3] = 0.42;
      thumbTarget = 0.26;
      tiltTarget.set(0.16, 0.08, 0.2);
    }
  }

  function update(dt, time) {
    const k = 1 - Math.exp(-10 * dt);
    for (let i = 0; i < 4; i++) {
      curCurls[i] = THREE.MathUtils.lerp(curCurls[i], targetCurls[i], k);
      const breathe = Math.sin(time * 2.1 + i * 0.4) * 0.022;
      fingers[i].applyCurl(curCurls[i] + breathe);
    }
    thumbCur = THREE.MathUtils.lerp(thumbCur, thumbTarget, k);
    thumb.applyCurl(thumbCur);

    handRig.rotation.x = THREE.MathUtils.lerp(handRig.rotation.x, tiltTarget.x, k);
    handRig.rotation.y = THREE.MathUtils.lerp(handRig.rotation.y, tiltTarget.y, k);
    handRig.rotation.z = THREE.MathUtils.lerp(handRig.rotation.z, tiltTarget.z, k);
  }

  root.scale.setScalar(1.06);
  return { root, handRig, setPose, update };
}

/**
 * Sunlit Morning Kitchen Studio Environment:
 * - Warm woven linen table + pale hinoki cutting board + crinkled bakery parchment
 * - Glass bowl brimming with glossy swirled whipped cream
 * - Matte-ivory ceramic fruit plate
 * - Dreamy sunlit morning window behind with sheer billowing curtains, glowing carafe,
 *   herb sprigs, volumetric sunbeams, and luminous backlit bokeh orbs (玉ボケ)!
 * - Wooden bakery keepsake stand in back-right bokeh for completed fruit sandos!
 */
export function createKitchenEnvironment(mats) {
  const env = new THREE.Group();

  // 1. Sunlit woven morning linen tablecloth
  const tableGeo = new THREE.PlaneGeometry(24, 20);
  tableGeo.rotateX(-Math.PI * 0.5);
  const table = new THREE.Mesh(tableGeo, mats.linenCloth);
  table.position.set(0, -0.26, -1.5);
  table.receiveShadow = true;
  env.add(table);

  // 2. Pale Hinoki Wood Cutting Board (with chamfered edges & artisan handle)
  const bw = 4.6;
  const bd = 3.6;
  const bShape = new THREE.Shape();
  const br = 0.24;
  bShape.moveTo(-bw * 0.5 + br, -bd * 0.5);
  bShape.lineTo(bw * 0.5 - br, -bd * 0.5);
  bShape.quadraticCurveTo(bw * 0.5, -bd * 0.5, bw * 0.5, -bd * 0.5 + br);
  bShape.lineTo(bw * 0.5, bd * 0.5 - br);
  bShape.quadraticCurveTo(bw * 0.5, bd * 0.5, bw * 0.5 - br, bd * 0.5);
  bShape.lineTo(-bw * 0.5 + br, bd * 0.5);
  bShape.quadraticCurveTo(-bw * 0.5, bd * 0.5, -bw * 0.5, bd * 0.5 - br);
  bShape.lineTo(-bw * 0.5, -bd * 0.5 + br);
  bShape.quadraticCurveTo(-bw * 0.5, -bd * 0.5, -bw * 0.5 + br, -bd * 0.5);

  const boardGeo = new THREE.ExtrudeGeometry(bShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  boardGeo.rotateX(Math.PI * 0.5);
  const board = new THREE.Mesh(boardGeo, mats.woodBoard);
  // Top face of cutting board sits cleanly at y = 0.0 (bevelThickness = 0.03)
  board.position.set(-0.08, -0.03, 0.05);
  board.receiveShadow = true;
  board.castShadow = true;
  env.add(board);

  // 3. Crinkled Bakery Parchment Paper right on top of the cutting board (cleanly above y = 0 -> ZERO clipping!)
  const parchGeo = new THREE.PlaneGeometry(3.15, 3.0, 12, 12);
  parchGeo.rotateX(-Math.PI * 0.5);
  const pp = parchGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i);
    const z = pp.getZ(i);
    const edgeLift = Math.pow(Math.hypot(x, z) / 2.2, 3) * 0.035;
    pp.setY(i, edgeLift + Math.sin(x * 3.1 + z * 2.4) * 0.005);
  }
  parchGeo.computeVertexNormals();
  const parchment = new THREE.Mesh(parchGeo, mats.parchment);
  parchment.position.set(-0.15, 0.016, 0.05);
  parchment.rotation.y = 0.03;
  parchment.receiveShadow = true;
  env.add(parchment);

  // 4. Clear Glass Bowl brimming with glossy sculpted whipped cream (left side of board)
  const creamBowl = new THREE.Group();
  creamBowl.position.set(-2.32, -0.02, 0.45);
  const bowlPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.45, 0.0),
    new THREE.Vector2(0.68, 0.16),
    new THREE.Vector2(0.84, 0.48),
    new THREE.Vector2(0.88, 0.72),
    new THREE.Vector2(0.82, 0.73),
    new THREE.Vector2(0.76, 0.46),
    new THREE.Vector2(0.46, 0.08),
    new THREE.Vector2(0.0, 0.08),
  ];
  const bowlGlass = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 28), mats.clearGlass);
  creamBowl.add(bowlGlass);

  // Swirled glossy whipped cream mountain inside the glass bowl
  const bowlCreamGeo = new THREE.SphereGeometry(0.76, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.65);
  const bcp = bowlCreamGeo.attributes.position;
  for (let i = 0; i < bcp.count; i++) {
    const x = bcp.getX(i);
    const y = bcp.getY(i);
    const z = bcp.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const swirl = Math.sin(a * 4 + r * 6) * 0.045;
    const peak = Math.exp(-r * r * 6) * 0.24;
    bcp.setY(i, y * 0.52 + swirl + peak);
  }
  bowlCreamGeo.computeVertexNormals();
  const bowlCream = new THREE.Mesh(bowlCreamGeo, mats.whippedCream);
  bowlCream.position.y = 0.34;
  bowlCream.castShadow = true;
  bowlCream.receiveShadow = true;
  creamBowl.add(bowlCream);
  env.add(creamBowl);

  // 5. Handcrafted Matte-Ivory Ceramic Fruit Dish (right side of board — easy one-finger reach!)
  const fruitDish = new THREE.Group();
  fruitDish.position.set(2.38, -0.02, 0.32);
  const dishPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.78, 0.0),
    new THREE.Vector2(1.06, 0.08),
    new THREE.Vector2(1.18, 0.24),
    new THREE.Vector2(1.13, 0.26),
    new THREE.Vector2(0.95, 0.1),
    new THREE.Vector2(0.0, 0.08),
  ];
  const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 32), mats.ceramic);
  dishMesh.scale.set(0.92, 1.0, 1.24);
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  fruitDish.add(dishMesh);

  // Subtle decorative fresh green mint sprig tucked at the far edge of the dish
  for (let i = 0; i < 3; i++) {
    const leafGeo = new THREE.SphereGeometry(0.16, 10, 8);
    leafGeo.scale(1.4, 0.14, 0.72);
    const leaf = new THREE.Mesh(leafGeo, mats.leafGreen);
    leaf.position.set(0.56 + i * 0.08, 0.19, -0.82 + i * 0.14);
    leaf.rotation.set(0.2, 0.6 + i * 0.7, 0.18);
    fruitDish.add(leaf);
  }
  env.add(fruitDish);

  // 6. Sunlit Wooden Bakery Keepsake Stand in back-right bokeh ("遊びの記憶"!)
  const keepsakeStand = new THREE.Group();
  keepsakeStand.position.set(2.85, -0.24, -2.55);
  const standFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 0.45, 20), mats.woodBoard);
  standFoot.position.y = 0.22;
  const standTop = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.12, 0.12, 26), mats.woodBoard);
  standTop.position.y = 0.48;
  standTop.receiveShadow = true;
  keepsakeStand.add(standFoot, standTop);
  const keepsakeSlots = new THREE.Group();
  keepsakeSlots.position.y = 0.54;
  keepsakeStand.add(keepsakeSlots);
  env.add(keepsakeStand);

  // 7. BACKLIT SUNLIT MORNING WINDOW + SHEER CURTAINS + GLASS CARAFE + GIANT BOKEH ORBS!
  const backdrop = new THREE.Group();
  backdrop.position.set(0, 0, -5.8);
  env.add(backdrop);

  // Rich warm Japanese morning café timber/plaster wall (creates lush contrast so glowing bokeh orbs & sunlit window POP!)
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x9b8267),
    roughness: 0.92,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(28, 16), wallMat);
  backWall.position.set(0, 4.5, -0.4);
  backdrop.add(backWall);

  // Warm sunlit morning window panes (balanced HDR so they glow softly without blowing out the whole screen!)
  const windowGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.42, 1.24, 0.96),
  });
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 7.6), windowGlowMat);
  windowPane.position.set(-1.1, 4.2, -0.2);
  backdrop.add(windowPane);

  // Extra radiant upper-left morning sun bloom patch inside window
  const sunPatch = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 28),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.45) })
  );
  sunPatch.position.set(-2.9, 5.2, -0.1);
  backdrop.add(sunPatch);

  // Warm cedar wooden window mullions (silhouetted café-window structure in dreamy shallow bokeh!)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x7c5a3d, roughness: 0.68 });
  const vFrame1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 8.2, 0.28), frameMat);
  vFrame1.position.set(-1.1, 4.2, 0.05);
  const vFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 8.2, 0.28), frameMat);
  vFrameL.position.set(-5.7, 4.2, 0.05);
  const vFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 8.2, 0.28), frameMat);
  vFrameR.position.set(3.5, 4.2, 0.05);
  const hFrame1 = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.26, 0.28), frameMat);
  hFrame1.position.set(-1.1, 3.8, 0.05);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.35, 1.4), mats.walnutWood);
  sill.position.set(-1.1, 0.35, 0.45);
  backdrop.add(vFrame1, vFrameL, vFrameR, hFrame1, sill);

  // Billowing sheer sunlit linen curtain (draped on far left & right)
  const curtainMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xeae0cf),
    roughness: 0.88,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  function makeCurtain(xPos) {
    const cGeo = new THREE.PlaneGeometry(3.4, 9.2, 10, 14);
    const p = cGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, Math.sin(x * 3.2 + y * 0.4) * 0.35);
    }
    cGeo.computeVertexNormals();
    const c = new THREE.Mesh(cGeo, curtainMat);
    c.position.set(xPos, 4.4, 0.65);
    return c;
  }
  const leftCurtain = makeCurtain(-5.4);
  const rightCurtain = makeCurtain(3.7);
  backdrop.add(leftCurtain, rightCurtain);

  // Background sunlit props on the table/windowsill (out-of-focus -> dreamy photographic depth!)
  // Glass water carafe catching blazing backlit highlights
  const carafePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.55, 0),
    new THREE.Vector2(0.68, 0.65),
    new THREE.Vector2(0.36, 1.65),
    new THREE.Vector2(0.42, 2.2),
  ];
  const carafe = new THREE.Mesh(new THREE.LatheGeometry(carafePts, 20), mats.clearGlass);
  carafe.position.set(-3.45, -0.25, -3.2);
  env.add(carafe);

  // Bright water highlight glint inside carafe (becomes huge golden-white 玉ボケ in DoF!)
  const carafeGlint = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.8, 2.0) })
  );
  carafeGlint.position.set(-3.32, 0.72, -3.15);
  env.add(carafeGlint);

  // Out-of-focus sunlit green morning foliage sprigs outside/near window (gives warm green-gold bokeh orbs!)
  const foliageGroup = new THREE.Group();
  foliageGroup.position.set(-3.6, 1.1, -4.4);
  for (let i = 0; i < 18; i++) {
    const fLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.36 + (i % 3) * 0.12, 10, 8), mats.leafGreen);
    fLeaf.scale.set(1.35, 0.48, 0.9);
    fLeaf.position.set(
      Math.cos(i * 1.7) * 1.9,
      Math.sin(i * 1.3) * 1.2 + 0.9,
      Math.sin(i * 2.1) * 0.6
    );
    fLeaf.rotation.set(i * 0.4, i * 0.8, i * 0.3);
    foliageGroup.add(fLeaf);
  }
  // Right-side warm foliage sprig for balanced depth!
  for (let i = 0; i < 10; i++) {
    const fLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.32 + (i % 2) * 0.1, 10, 8), mats.leafGreen);
    fLeaf.scale.set(1.25, 0.45, 0.85);
    fLeaf.position.set(
      6.6 + Math.cos(i * 1.5) * 1.2,
      Math.sin(i * 1.2) * 0.9 + 0.8,
      Math.sin(i * 1.9) * 0.5
    );
    foliageGroup.add(fLeaf);
  }
  env.add(foliageGroup);

  // 8. Luminous Floating Morning Bokeh Orbs (玉ボケ) — crisp golden/ivory/emerald optical discs in background!
  const bokehOrbs = [];
  const bokehConfigs = [
    [-4.2, 2.4, -4.3, 1.18, 0xffe49e, 0.95],
    [-2.7, 1.85, -4.6, 1.48, 0xffd780, 0.9],
    [-1.4, 2.9, -4.8, 1.25, 0xfff0c2, 0.92],
    [-0.3, 1.65, -4.5, 1.12, 0xffe29c, 0.86],
    [1.3, 2.35, -4.7, 1.52, 0xffdf92, 0.9],
    [2.9, 1.85, -4.4, 1.22, 0xffd284, 0.88],
    [4.2, 2.75, -4.9, 1.36, 0xffeecc, 0.88],
    [-2.1, 1.05, -4.1, 0.96, 0xffe096, 0.8],
    [0.7, 1.15, -4.3, 0.92, 0xbcf088, 0.68],
    [2.2, 1.0, -4.2, 0.98, 0xffb89c, 0.72],
    [-3.6, 1.3, -4.4, 1.1, 0xb8ee80, 0.7],
    [0.15, 2.85, -4.9, 1.62, 0xfff2cc, 0.92],
    [-0.95, 0.85, -4.4, 0.88, 0xffdc8e, 0.75],
    [3.5, 1.15, -4.5, 1.08, 0xffe4a0, 0.82],
    [-2.5, 3.4, -5.0, 1.38, 0xfff4d4, 0.9],
    [1.8, 3.4, -5.0, 1.32, 0xffe8b0, 0.88],
  ];

  for (let i = 0; i < bokehConfigs.length; i++) {
    const [bx, by, bz, sc, colHex, op] = bokehConfigs[i];
    const spMat = new THREE.SpriteMaterial({
      map: mats.bokehTex,
      color: new THREE.Color(colHex).multiplyScalar(1.35),
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(spMat);
    sp.position.set(bx, by, bz);
    sp.scale.set(sc, sc, 1);
    env.add(sp);
    bokehOrbs.push({ sprite: sp, baseX: bx, baseY: by, phase: i * 1.37, speed: 0.35 + (i % 4) * 0.12 });
  }

  // Soft Volumetric Morning Sunbeams slanting from upper-left window
  const beamGeo = new THREE.PlaneGeometry(2.6, 8.5);
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 64;
  beamCanvas.height = 128;
  const bCtx = beamCanvas.getContext('2d');
  const bGrad = bCtx.createLinearGradient(0, 0, 0, 128);
  bGrad.addColorStop(0, 'rgba(255, 244, 214, 0.0)');
  bGrad.addColorStop(0.25, 'rgba(255, 244, 214, 0.22)');
  bGrad.addColorStop(0.7, 'rgba(255, 240, 200, 0.09)');
  bGrad.addColorStop(1, 'rgba(255, 240, 200, 0.0)');
  bCtx.fillStyle = bGrad;
  bCtx.fillRect(0, 0, 64, 128);
  // Horizontal soft falloff
  bCtx.globalCompositeOperation = 'destination-in';
  const hGrad = bCtx.createLinearGradient(0, 0, 64, 0);
  hGrad.addColorStop(0, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.5, 'rgba(0,0,0,1)');
  hGrad.addColorStop(1, 'rgba(0,0,0,0)');
  bCtx.fillStyle = hGrad;
  bCtx.fillRect(0, 0, 64, 128);
  const beamTex = new THREE.CanvasTexture(beamCanvas);
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(-2.6 + i * 1.9, 3.2, -3.6 - i * 0.4);
    beam.rotation.set(0.18, 0.12, -0.36);
    env.add(beam);
  }

  function updateAmbient(time) {
    // Gentle sunlit breeze in sheer curtains & shimmering bokeh orbs
    leftCurtain.rotation.y = Math.sin(time * 0.7) * 0.05;
    rightCurtain.rotation.y = Math.cos(time * 0.62) * 0.045;
    for (const b of bokehOrbs) {
      b.sprite.position.x = b.baseX + Math.sin(time * b.speed + b.phase) * 0.18;
      b.sprite.position.y = b.baseY + Math.cos(time * b.speed * 0.8 + b.phase) * 0.14;
    }
  }

  return {
    env,
    board,
    parchment,
    creamBowl,
    bowlCream,
    fruitDish,
    keepsakeSlots,
    updateAmbient,
  };
}
