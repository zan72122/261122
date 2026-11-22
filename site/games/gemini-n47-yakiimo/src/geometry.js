import * as THREE from '../vendor/three.module.js';

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Smooth continuous 3D spatial noise so non-indexed geometry vertices at identical positions
// ALWAYS displace identically (zero ripped/shattered stone faces!)
function spatialRockNoise(x, y, z, seed) {
  const a = Math.sin(x * 3.7 + seed * 1.3) * Math.cos(y * 3.1 - seed * 0.7) * Math.sin(z * 3.5 + seed * 2.1);
  const b = Math.sin(x * 7.3 - z * 6.1 + seed) * Math.cos(y * 6.8 + x * 4.2) * 0.45;
  const c = Math.cos(z * 11.2 + y * 9.4 - seed * 1.9) * 0.18;
  return 1.0 + (a * 0.16 + b * 0.11 + c * 0.06);
}

// Evaluate organic sweet potato radius at normalized u in [-1, 1] and angle theta
function potatoProfile(u, theta, variant = 0) {
  const au = Math.abs(u);
  const baseTaper = Math.pow(Math.max(0, 1 - Math.pow(au, 2.25)), 0.56);
  const girth = variant === 1 ? 0.245 : 0.212;
  const lump1 = 1 + Math.sin(u * 4.2 + 0.8 + variant) * 0.06;
  const lump2 = 1 + Math.cos(theta * 2 + u * 2.5) * 0.05 + Math.sin(theta * 3 - u * 3.1) * 0.028;
  const radius = Math.max(0.012, girth * baseTaper * lump1 * lump2);
  const bendY = Math.sin(u * Math.PI * 0.5) * 0.018 + (1 - u * u) * 0.028;
  const bendZ = Math.sin(u * 2.1 + variant) * 0.016;
  return { radius, bendY, bendZ };
}

function fractureOffset(rNorm, theta) {
  return (
    Math.sin(theta * 3.0 + 0.5) * 0.020 * rNorm +
    Math.cos(theta * 5.0 - 1.1) * 0.013 * rNorm +
    Math.sin(rNorm * 8.0 + theta * 2.0) * 0.011 * (1 - rNorm * 0.3)
  );
}

/**
 * Builds one half of a photorealistic sculpted sweet potato with:
 * - Outer organic skin mesh
 * - Inner high-detail jagged fibrous golden cross-section cap with CORRECT outward normals!
 */
function buildPotatoHalfGeometry(side, variant = 0) {
  const halfLen = variant === 1 ? 0.50 : 0.58;
  const segU = 22;
  const segT = 32;

  const skinPos = [];
  const skinUV = [];
  const skinIdx = [];

  for (let iu = 0; iu <= segU; iu++) {
    const t = iu / segU;
    const u = side * t;
    const xBase = u * halfLen;

    for (let it = 0; it <= segT; it++) {
      const v = it / segT;
      const theta = v * Math.PI * 2;
      const prof = potatoProfile(u, theta, variant);
      const fOff = fractureOffset(1.0, theta) * Math.pow(1 - t, 3.0);
      const x = xBase + fOff;
      const y = prof.bendY + Math.cos(theta) * prof.radius;
      const z = prof.bendZ + Math.sin(theta) * prof.radius;

      skinPos.push(x, y, z);
      skinUV.push((u * 0.5 + 0.5) * 1.35, v * 1.0);
    }
  }

  for (let iu = 0; iu < segU; iu++) {
    for (let it = 0; it < segT; it++) {
      const a = iu * (segT + 1) + it;
      const b = (iu + 1) * (segT + 1) + it;
      const c = (iu + 1) * (segT + 1) + (it + 1);
      const d = iu * (segT + 1) + (it + 1);
      if (side > 0) {
        skinIdx.push(a, d, b, b, d, c);
      } else {
        skinIdx.push(a, b, d, b, c, d);
      }
    }
  }

  const skinGeo = new THREE.BufferGeometry();
  skinGeo.setAttribute('position', new THREE.Float32BufferAttribute(skinPos, 3));
  skinGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skinUV, 2));
  skinGeo.setIndex(skinIdx);
  skinGeo.computeVertexNormals();

  // --- Jagged Fibrous Cross-Section Cap ---
  // Left half (side = -1): cap faces +X!
  // Right half (side = +1): cap faces -X!
  const capRings = 12;
  const capPos = [];
  const capUV = [];
  const capIdx = [];
  const prof0 = potatoProfile(0, 0, variant);

  for (let ir = 0; ir <= capRings; ir++) {
    const rNorm = ir / capRings;
    for (let it = 0; it <= segT; it++) {
      const v = it / segT;
      const theta = v * Math.PI * 2;
      const prof = potatoProfile(0, theta, variant);
      const r = prof.radius * rNorm;
      // Organic uneven fibrous fracture relief (smoothly vanishes at center pole rNorm=0 -> ZERO pinch artifact!)
      const poleSmooth = rNorm * rNorm;
      const crumble =
        ((Math.sin(theta * 4 + rNorm * 5) * 0.013 + Math.cos(theta * 7 - rNorm * 7) * 0.008) *
          poleSmooth +
          (1 - rNorm * rNorm) * 0.026) *
        -side;
      const x = fractureOffset(rNorm, theta) * poleSmooth + crumble;
      const y = prof0.bendY + Math.cos(theta) * r;
      const z = prof0.bendZ + Math.sin(theta) * r;

      capPos.push(x, y, z);
      capUV.push(0.5 + Math.cos(theta) * 0.48 * rNorm, 0.5 + Math.sin(theta) * 0.48 * rNorm);
    }
  }

  // Note: around X axis, (cos theta, sin theta) in (Y, Z) goes clockwise looking from +X,
  // so radial-outward x tangent-increasing points along +X when (a, b, d) -> verify:
  // b - a = (0, cos, sin) [dr], d - a = (0, -sin, cos) [dtheta].
  // dr x dtheta = (cos*cos - sin*(-sin), 0, 0) = (+1, 0, 0) -> points strictly +X!
  // Therefore:
  //   left half (side < 0, cap must face +X): (a, b, d), (b, c, d)
  //   right half (side > 0, cap must face -X): (a, d, b), (b, d, c)
  for (let ir = 0; ir < capRings; ir++) {
    for (let it = 0; it < segT; it++) {
      const a = ir * (segT + 1) + it;
      const b = (ir + 1) * (segT + 1) + it;
      const c = (ir + 1) * (segT + 1) + (it + 1);
      const d = ir * (segT + 1) + (it + 1);
      if (side < 0) {
        capIdx.push(a, b, d, b, c, d);
      } else {
        capIdx.push(a, d, b, b, d, c);
      }
    }
  }

  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
  capGeo.setAttribute('uv', new THREE.Float32BufferAttribute(capUV, 2));
  capGeo.setIndex(capIdx);
  capGeo.computeVertexNormals();

  return { skinGeo, capGeo, halfLen };
}

/**
 * Complete photorealistic sweet potato rig with:
 * - Seamless whole -> cracked open golden fibrous cross-sections turning boldly toward the macro camera!
 * - Subtle glossy amber honey glazes & delicate stretchy starch fibers
 */
export function createSweetPotatoRig(skinTextures, fleshTextures) {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTextures.raw.map,
    normalMap: skinTextures.raw.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: skinTextures.raw.roughnessMap,
    roughness: 0.74,
    metalness: 0.02,
  });

  const fleshMat = new THREE.MeshStandardMaterial({
    map: fleshTextures.map,
    normalMap: fleshTextures.normalMap,
    normalScale: new THREE.Vector2(1.85, 1.85),
    roughnessMap: fleshTextures.roughnessMap,
    roughness: 0.36,
    metalness: 0.02,
    emissive: new THREE.Color('#ff9d1a'),
    emissiveMap: fleshTextures.map,
    emissiveIntensity: 0.24, // steaming-hot backlit golden glow!
    side: THREE.DoubleSide,
  });

  // Delicate dark-amber glistening translucent caramelized honey glaze (subtle & realistic, never beads!)
  const honeyMat = new THREE.MeshPhysicalMaterial({
    color: '#7a3406',
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.0,
  });

  const fiberMat = new THREE.MeshStandardMaterial({
    color: '#ffd052',
    emissive: '#e08414',
    emissiveIntensity: 0.28,
    roughness: 0.42,
    transparent: true,
    opacity: 0.0,
  });

  const leftPivot = new THREE.Group();
  const rightPivot = new THREE.Group();
  root.add(leftPivot, rightPivot);

  const honeyDrops = [];
  const fibers = [];

  for (let i = 0; i < 10; i++) {
    const fGeo = new THREE.CylinderGeometry(0.0022, 0.0014, 1.0, 5, 1);
    fGeo.rotateZ(Math.PI / 2);
    const fMesh = new THREE.Mesh(fGeo, fiberMat);
    const ang = (i / 10) * Math.PI * 2 + hash(i) * 0.4;
    const rad = 0.04 + hash(i + 19) * 0.11;
    fMesh.userData = {
      y: 0.02 + Math.cos(ang) * rad,
      z: Math.sin(ang) * rad,
      snapAt: 0.32 + hash(i + 41) * 0.35,
    };
    fMesh.visible = false;
    root.add(fMesh);
    fibers.push(fMesh);
  }

  let leftSkinMesh, leftCapMesh, rightSkinMesh, rightCapMesh;
  let leftBites = 0;
  let rightBites = 0;

  function rebuildVariant(variant = 0) {
    leftBites = 0;
    rightBites = 0;

    while (leftPivot.children.length) leftPivot.remove(leftPivot.children[0]);
    while (rightPivot.children.length) rightPivot.remove(rightPivot.children[0]);
    honeyDrops.length = 0;

    const leftG = buildPotatoHalfGeometry(-1, variant);
    const rightG = buildPotatoHalfGeometry(1, variant);

    leftSkinMesh = new THREE.Mesh(leftG.skinGeo, skinMat);
    leftSkinMesh.castShadow = true;
    leftSkinMesh.receiveShadow = true;
    leftCapMesh = new THREE.Mesh(leftG.capGeo, fleshMat);
    leftCapMesh.castShadow = true;
    leftCapMesh.receiveShadow = true;
    leftCapMesh.visible = false;

    rightSkinMesh = new THREE.Mesh(rightG.skinGeo, skinMat);
    rightSkinMesh.castShadow = true;
    rightSkinMesh.receiveShadow = true;
    rightCapMesh = new THREE.Mesh(rightG.capGeo, fleshMat);
    rightCapMesh.castShadow = true;
    rightCapMesh.receiveShadow = true;
    rightCapMesh.visible = false;

    leftPivot.add(leftSkinMesh, leftCapMesh);
    rightPivot.add(rightSkinMesh, rightCapMesh);

    // Subtle flat glossy caramelized honey syrup streaks near fracture rim (micro-scale!)
    const dropGeo = new THREE.SphereGeometry(0.012, 8, 6);
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1;
      const u = side * (0.04 + hash(i * 3.1) * 0.28);
      const theta = -0.8 + hash(i * 7.3) * 1.6; // upper front hemisphere where syrup glistens
      const prof = potatoProfile(u, theta, variant);
      const drop = new THREE.Mesh(dropGeo, honeyMat);
      drop.position.set(
        u * leftG.halfLen,
        prof.bendY + Math.cos(theta) * (prof.radius * 0.99),
        prof.bendZ + Math.sin(theta) * (prof.radius * 0.99)
      );
      const s = 0.7 + hash(i * 11.7) * 0.9;
      drop.scale.set(s * 1.6, s * 0.28, s * 1.0);
      (side < 0 ? leftPivot : rightPivot).add(drop);
      honeyDrops.push(drop);
    }

    setSplit(0);
    setRoasted(false);
  }

  function setRoasted(isRoasted) {
    const tex = isRoasted ? skinTextures.roasted : skinTextures.raw;
    skinMat.map = tex.map;
    skinMat.normalMap = tex.normalMap;
    skinMat.roughnessMap = tex.roughnessMap;
    skinMat.normalScale.set(isRoasted ? 1.45 : 1.0, isRoasted ? 1.45 : 1.0);
    skinMat.needsUpdate = true;
    honeyMat.opacity = isRoasted ? 0.65 : 0.0;
    honeyDrops.forEach((d) => (d.visible = isRoasted));
  }

  function setSplit(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const showCap = p > 0.015;
    leftCapMesh.visible = showCap;
    rightCapMesh.visible = showCap;

    // CRITICAL: Rotate BOTH golden fractured cross-sections TOWARD the front macro camera (+Z)!
    // Left half cap faces +X -> negative Y rotation turns +X toward +Z!
    // Right half cap faces -X -> positive Y rotation turns -X toward +Z!
    const sep = p * 0.14;
    const tiltY = p * 0.74; // ~42 degrees outward toward camera -> breathtaking golden interior view!
    const tiltZ = p * 0.18; // gentle upward crack presentation

    leftPivot.position.set(-sep, p * 0.08, p * 0.02);
    leftPivot.rotation.set(0.10 * p, -tiltY, -tiltZ);

    rightPivot.position.set(sep, p * 0.08, p * 0.02);
    rightPivot.rotation.set(0.10 * p, tiltY, tiltZ);

    fibers.forEach((f) => {
      if (p > 0.03 && p < f.userData.snapAt) {
        f.visible = true;
        const span = Math.max(0.01, sep * 2.0);
        f.scale.set(span, 1 - p * 0.5, 1 - p * 0.5);
        f.position.set(0, f.userData.y + p * 0.08, f.userData.z + 0.03);
        fiberMat.opacity = Math.min(0.85, (1 - p / f.userData.snapAt) * 1.1);
      } else {
        f.visible = false;
      }
    });
  }

  function takeBite(side) {
    if (side < 0) {
      if (leftBites >= 3) return false;
      leftBites++;
      const remain = Math.max(0, 1 - leftBites * 0.34);
      if (remain <= 0.05) leftPivot.visible = false;
      else leftPivot.scale.set(remain, 0.88 + remain * 0.12, 0.88 + remain * 0.12);
      return true;
    } else {
      if (rightBites >= 3) return false;
      rightBites++;
      const remain = Math.max(0, 1 - rightBites * 0.34);
      if (remain <= 0.05) rightPivot.visible = false;
      else rightPivot.scale.set(remain, 0.88 + remain * 0.12, 0.88 + remain * 0.12);
      return true;
    }
  }

  function resetBites() {
    leftBites = 0;
    rightBites = 0;
    leftPivot.visible = true;
    rightPivot.visible = true;
    leftPivot.scale.set(1, 1, 1);
    rightPivot.scale.set(1, 1, 1);
  }

  function getHalfCenterWorld(side, target = new THREE.Vector3()) {
    const pivot = side < 0 ? leftPivot : rightPivot;
    target.set(-side * 0.02, 0.05, 0.02);
    pivot.localToWorld(target);
    return target;
  }

  rebuildVariant(0);

  return {
    root,
    leftPivot,
    rightPivot,
    rebuildVariant,
    setRoasted,
    setSplit,
    takeBite,
    resetBites,
    getHalfCenterWorld,
    getBitesRemaining: () => (leftPivot.visible ? 3 - leftBites : 0) + (rightPivot.visible ? 3 - rightBites : 0),
    isHalfVisible: (side) => (side < 0 ? leftPivot.visible : rightPivot.visible),
  };
}

/**
 * Deformable photorealistic crinkled silver aluminum foil sheet & twisted-end parcel.
 * Roomier radius (0.258) ensures zero skin poke-through when wrapped!
 */
export function createAluminumFoilRig(foilTextures) {
  const segX = 28;
  const segZ = 22;
  const geo = new THREE.PlaneGeometry(1.58, 1.38, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const count = posAttr.count;
  const baseU = new Float32Array(count);
  const baseV = new Float32Array(count);
  const crinkle = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    baseU[i] = x / (1.58 * 0.5);
    baseV[i] = z / (1.38 * 0.5);
    crinkle[i] = (hash(i * 1.73 + 5) - 0.5) * 0.022;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f4f5f7'),
    normalMap: foilTextures.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: foilTextures.roughnessMap,
    roughness: 0.25,
    metalness: 0.88,
    side: THREE.DoubleSide,
    envMapIntensity: 1.45,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  let currentWrap = 0;
  let currentPeel = 0;

  function updateDeform(wrapProgress, peelProgress = 0) {
    currentWrap = Math.max(0, Math.min(1, wrapProgress));
    currentPeel = Math.max(0, Math.min(1, peelProgress));
    const w = currentWrap;
    const peel = currentPeel;

    for (let i = 0; i < count; i++) {
      const u = baseU[i];
      const v = baseV[i];
      const cr = crinkle[i];

      const flatX = u * 0.82;
      const flatZ = v * 0.65;
      const edgeCurl = Math.pow(Math.abs(v), 2.4) * 0.085 + Math.pow(Math.abs(u), 2.6) * 0.04;
      const flatY = -0.205 + edgeCurl + cr * 0.55;

      const au = Math.abs(u);
      const endPinch = Math.max(0, (au - 0.65) / 0.35);
      // Generous clearance radius (0.262) so potato never pokes through when fully wrapped!
      const bodyRadius = 0.262 * Math.pow(Math.max(0.08, 1 - Math.pow(Math.min(0.95, au * 0.94), 2.3)), 0.44);
      const rWrap =
        bodyRadius * (1 - endPinch * 0.72) +
        Math.pow(endPinch, 2.2) * 0.072 +
        cr * (1.1 + endPinch * 1.4);

      const maxAngle = Math.PI * (1.12 - peel * 0.56);
      const twist = endPinch * 1.75 * Math.sign(u || 1) * (1 - peel * 0.88);
      const theta = -Math.PI * 0.5 + v * maxAngle + twist;

      const wrapX = u * (0.78 - endPinch * 0.02) + Math.sin(v * 5 + u * 3) * 0.008;
      // Keep peeled aluminum foil sitting cleanly ON TOP of the wooden slab as a gleaming crinkled cradle!
      const wrapY = Math.max(-0.205, 0.015 + Math.sin(theta) * rWrap - peel * 0.015);
      const wrapZ = Math.cos(theta) * rWrap * (1 + peel * 0.58);

      const localW = Math.max(
        0,
        Math.min(1, (w * 1.35 - Math.abs(u) * 0.22 - (1 - Math.abs(v)) * 0.1) / 0.85)
      );
      const s = localW * localW * (3 - 2 * localW);

      posAttr.setXYZ(
        i,
        flatX + (wrapX - flatX) * s,
        flatY + (wrapY - flatY) * s,
        flatZ + (wrapZ - flatZ) * s
      );
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function setSoot(level) {
    const t = Math.max(0, Math.min(1, level));
    if (t > 0.05) {
      if (mat.map !== foilTextures.sootMap) {
        mat.map = foilTextures.sootMap;
        mat.needsUpdate = true;
      }
      const c = 1.0 - t * 0.28;
      mat.color.setRGB(c + t * 0.04, c, c - t * 0.03);
      mat.roughness = 0.25 + t * 0.20;
      mat.metalness = 0.88 - t * 0.14;
    } else {
      if (mat.map !== null) {
        mat.map = null;
        mat.needsUpdate = true;
      }
      mat.color.set('#f4f5f7');
      mat.roughness = 0.24;
      mat.metalness = 0.89;
    }
  }

  updateDeform(0, 0);

  return {
    mesh,
    updateDeform,
    setSoot,
    getWrap: () => currentWrap,
    getPeel: () => currentPeel,
  };
}

/**
 * Anatomically graceful, warm sunlit realistic hands with slender tapered curving fingers
 * hugging the outer skin of the steaming sweet potato, with cozy ribbed autumn knit sleeves
 * angled naturally from the viewer's lower-left and lower-right corners!
 */
export function createWarmHandsRig(knitTextures, skinTextures) {
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTextures.map,
    normalMap: skinTextures.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: '#e5b293',
    roughness: 0.64,
    metalness: 0.0,
    sheen: 0.44,
    sheenColor: new THREE.Color('#ff8c4a'),
    sheenRoughness: 0.72,
    emissive: new THREE.Color('#421608'),
    emissiveIntensity: 0.14,
  });

  const nailMat = new THREE.MeshStandardMaterial({
    color: '#ecc6b2',
    roughness: 0.30,
    metalness: 0.0,
  });

  const knitMat = new THREE.MeshStandardMaterial({
    map: knitTextures.map,
    normalMap: knitTextures.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.94,
    metalness: 0.0,
  });

  // Helper: smoothly tapered organic finger segment (never fat uniform sausage cylinders!)
  function taperedSegment(rBase, rTip, len, side) {
    const g = new THREE.CylinderGeometry(rTip, rBase, len, 10, 1);
    // Rotate so base is at 0 and tip extends along -side * X
    g.rotateZ(side > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(-side * len * 0.5, 0, 0);
    return g;
  }

  function buildSingleHand(side) {
    // side = -1 left hand, +1 right hand
    const hand = new THREE.Group();

    // Natural slim gently arched dorsum/palm
    const palmGeo = new THREE.SphereGeometry(0.118, 18, 14);
    palmGeo.scale(1.18, 0.44, 0.96);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.castShadow = true;
    palm.receiveShadow = true;
    hand.add(palm);

    // Soft thenar pad (thumb muscle contour)
    const thenarGeo = new THREE.SphereGeometry(0.068, 12, 10);
    thenarGeo.scale(1.15, 0.65, 0.85);
    const thenar = new THREE.Mesh(thenarGeo, skinMat);
    thenar.position.set(side * 0.01, -0.025, 0.072);
    hand.add(thenar);

    // Natural wrist & slim cozy ribbed autumn knit sleeve extending smoothly sideways/back out of frame
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.10, -0.02, -0.01);
    armGroup.rotation.z = -side * 0.14;
    armGroup.rotation.y = -side * 0.25;

    const wristGeo = new THREE.CylinderGeometry(0.068, 0.078, 0.14, 14);
    wristGeo.rotateZ(Math.PI / 2);
    const wrist = new THREE.Mesh(wristGeo, skinMat);
    wrist.position.set(side * 0.03, 0, 0);
    armGroup.add(wrist);

    const cuffGeo = new THREE.CylinderGeometry(0.098, 0.122, 0.62, 18);
    cuffGeo.rotateZ(Math.PI / 2);
    const cuff = new THREE.Mesh(cuffGeo, knitMat);
    cuff.position.set(side * 0.35, 0, 0);
    cuff.castShadow = true;
    armGroup.add(cuff);

    const rimGeo = new THREE.TorusGeometry(0.092, 0.024, 10, 20);
    rimGeo.rotateY(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, knitMat);
    rim.position.set(side * 0.065, 0, 0);
    armGroup.add(rim);

    hand.add(armGroup);

    // 4 slender tapered fingers wrapping smoothly around the upper-outer skin of the sweet potato!
    const fingerSpecs = [
      { z: -0.070, y: 0.012, len1: 0.088, len2: 0.072, r: 0.0195, yaw: -0.10, pitch1: 0.24, pitch2: 0.48 },
      { z: -0.022, y: 0.018, len1: 0.098, len2: 0.078, r: 0.0205, yaw: -0.03, pitch1: 0.20, pitch2: 0.45 },
      { z: 0.026, y: 0.015, len1: 0.092, len2: 0.074, r: 0.0195, yaw: 0.04, pitch1: 0.22, pitch2: 0.46 },
      { z: 0.068, y: 0.008, len1: 0.074, len2: 0.060, r: 0.0170, yaw: 0.12, pitch1: 0.28, pitch2: 0.50 },
    ];

    fingerSpecs.forEach((f) => {
      const fGroup = new THREE.Group();
      fGroup.position.set(-side * 0.095, f.y, f.z);
      fGroup.rotation.y = side * f.yaw;

      const kn = new THREE.Mesh(new THREE.SphereGeometry(f.r * 1.02, 8, 6), skinMat);
      fGroup.add(kn);

      const p1 = new THREE.Group();
      p1.rotation.z = side * f.pitch1;
      const s1 = new THREE.Mesh(taperedSegment(f.r, f.r * 0.86, f.len1, side), skinMat);
      s1.castShadow = true;
      p1.add(s1);

      const midJoint = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.86, 8, 6), skinMat);
      midJoint.position.set(-side * f.len1, 0, 0);
      p1.add(midJoint);

      const p2 = new THREE.Group();
      p2.position.set(-side * f.len1, 0, 0);
      p2.rotation.z = side * f.pitch2;
      const s2 = new THREE.Mesh(taperedSegment(f.r * 0.85, f.r * 0.66, f.len2, side), skinMat);
      s2.castShadow = true;
      p2.add(s2);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.66, 8, 6), skinMat);
      tip.position.set(-side * f.len2, 0, 0);
      p2.add(tip);

      const nailGeo = new THREE.SphereGeometry(f.r * 0.54, 8, 6);
      nailGeo.scale(1.15, 0.26, 0.78);
      const nail = new THREE.Mesh(nailGeo, nailMat);
      nail.position.set(-side * (f.len2 - f.r * 0.2), f.r * 0.56, 0);
      p2.add(nail);

      p1.add(p2);
      fGroup.add(p1);
      hand.add(fGroup);
    });

    // Opposing natural thumb gently cradling the lower-front rim of the roasted potato skin
    const thumbGroup = new THREE.Group();
    thumbGroup.position.set(-side * 0.045, -0.025, 0.095);
    thumbGroup.rotation.y = side * 0.42;
    thumbGroup.rotation.z = side * 0.14;
    const t1 = new THREE.Mesh(taperedSegment(0.024, 0.019, 0.095, side), skinMat);
    t1.castShadow = true;
    const tTip = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), skinMat);
    tTip.position.set(-side * 0.095, 0, 0);
    thumbGroup.add(t1, tTip);
    hand.add(thumbGroup);

    return hand;
  }

  const pairGroup = new THREE.Group();
  const leftHand = buildSingleHand(-1);
  const rightHand = buildSingleHand(1);
  pairGroup.add(leftHand, rightHand);
  pairGroup.visible = false;

  const hintHand = buildSingleHand(1);
  hintHand.scale.setScalar(0.85);
  hintHand.visible = false;

  function setHoldSplit(splitProgress, alpha = 1) {
    pairGroup.visible = alpha > 0.01;
    const p = splitProgress;
    const approach = (1 - alpha) * 0.46;
    // Wrap gracefully over the top-outer curve of BOTH potato halves so natural warm hands & slender fingers hug the roasted skin snugly!
    const xOut = 0.43 + p * 0.09 + approach;
    const yHold = 0.14 + p * 0.06;
    const zBack = -0.06 - p * 0.24;

    leftHand.position.set(-xOut, yHold, zBack);
    leftHand.rotation.set(0.22, -0.14 - p * 0.38, 0.28 - p * 0.12);

    rightHand.position.set(xOut, yHold, zBack);
    rightHand.rotation.set(0.22, 0.14 + p * 0.38, -0.28 + p * 0.12);
  }

  return { pairGroup, leftHand, rightHand, hintHand, setHoldSplit };
}

/**
 * Photorealistic outdoor autumn bonfire clearing with:
 * - Solid continuous-noise granite fieldstones (ZERO shattered polygons!)
 * - Textured cracked glowing charcoal embers nestled in wood ash
 * - Rich multi-layered backlit autumn maple/ginkgo trees & volumetric golden sunbeams
 */
export function createBonfireEnvironment(textures) {
  const group = new THREE.Group();

  // 1. Sculpted autumn clearing terrain
  const groundGeo = new THREE.PlaneGeometry(28, 28, 64, 64);
  groundGeo.rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i);
    const z = gPos.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    const pitDip = -0.14 * Math.exp(-Math.pow(r / 1.12, 2));
    const berm = 0.055 * Math.exp(-Math.pow((r - 1.52) / 0.55, 2));
    const hills =
      (Math.sin(x * 0.38 + 0.5) * Math.cos(z * 0.34) * 0.16 +
        Math.sin(x * 0.9 - z * 0.8) * 0.04) *
      Math.min(1, Math.max(0, (r - 2.0) / 3.0));
    gPos.setY(i, pitDip + berm + hills);
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.ground.map,
    normalMap: textures.ground.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: textures.ground.roughnessMap,
    roughness: 0.94,
    metalness: 0.0,
    emissive: new THREE.Color('#ff5510'),
    emissiveMap: textures.ground.emissiveMap,
    emissiveIntensity: 0.9,
  });

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // 2. Natural ring of 14 SOLID organic mossy granite river stones (continuous 3D spatial noise!)
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone.map,
    normalMap: textures.stone.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughness: 0.86,
    metalness: 0.03,
  });

  const numStones = 14;
  for (let i = 0; i < numStones; i++) {
    const ang = (i / numStones) * Math.PI * 2 + (hash(i * 5) - 0.5) * 0.15;
    const rad = 1.22 + (hash(i * 9) - 0.5) * 0.11;
    const baseR = 0.23 + hash(i * 13) * 0.085;
    const sGeo = new THREE.SphereGeometry(baseR, 18, 14);
    const sp = sGeo.attributes.position;
    for (let k = 0; k < sp.count; k++) {
      const vx = sp.getX(k);
      const vy = sp.getY(k);
      const vz = sp.getZ(k);
      const inv = 1 / Math.max(0.001, baseR);
      const n = spatialRockNoise(vx * inv, vy * inv, vz * inv, i * 3.7 + 1.1);
      // Flatten underside slightly like a heavy stone settled into forest soil
      const flatBottom = vy < 0 ? 0.72 : 1.0;
      sp.setXYZ(k, vx * n * 1.18, vy * n * 0.66 * flatBottom, vz * n * 1.04);
    }
    sGeo.computeVertexNormals();
    const stone = new THREE.Mesh(sGeo, stoneMat);
    stone.position.set(Math.cos(ang) * rad, 0.055 + hash(i * 7) * 0.03, Math.sin(ang) * rad);
    stone.rotation.set((hash(i * 2) - 0.5) * 0.25, ang + hash(i * 3), (hash(i * 4) - 0.5) * 0.25);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // 3. Charred firewood logs & textured glowing cracked charcoal embers
  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.bark.map,
    normalMap: textures.bark.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    emissive: new THREE.Color('#ff4808'),
    emissiveMap: textures.bark.emissiveMap,
    emissiveIntensity: 0.85,
    roughness: 0.92,
  });

  const logSpecs = [
    { pos: [-0.30, 0.02, -0.08], rot: [0.18, 0.4, 1.38], len: 1.06, r: 0.092 },
    { pos: [0.26, 0.04, 0.12], rot: [-0.22, -0.65, 1.34], len: 1.00, r: 0.086 },
    { pos: [0.05, 0.03, -0.26], rot: [1.32, 0.3, 0.25], len: 0.94, r: 0.080 },
    { pos: [-0.14, 0.01, 0.22], rot: [1.44, -0.5, -0.18], len: 0.86, r: 0.070 },
    { pos: [0.16, -0.02, -0.04], rot: [0.35, 1.2, 1.48], len: 0.78, r: 0.066 },
  ];
  logSpecs.forEach((ls, idx) => {
    const lGeo = new THREE.CylinderGeometry(ls.r * 0.85, ls.r, ls.len, 12, 5);
    const lp = lGeo.attributes.position;
    for (let k = 0; k < lp.count; k++) {
      const vx = lp.getX(k);
      const vy = lp.getY(k);
      const vz = lp.getZ(k);
      const n = spatialRockNoise(vx * 8, vy * 3, vz * 8, idx * 4.3);
      lp.setX(k, vx * (0.94 + (n - 1) * 0.5));
      lp.setZ(k, vz * (0.94 + (n - 1) * 0.5));
    }
    lGeo.computeVertexNormals();
    const log = new THREE.Mesh(lGeo, barkMat);
    log.position.set(...ls.pos);
    log.rotation.set(...ls.rot);
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
  });

  // Realistic textured charcoal & ember chunks (dark ashy crust with glowing red-orange cracks!)
  const coalMat = new THREE.MeshStandardMaterial({
    map: textures.charcoal.map,
    normalMap: textures.charcoal.normalMap,
    normalScale: new THREE.Vector2(1.6, 1.6),
    emissive: new THREE.Color('#ff5510'),
    emissiveMap: textures.charcoal.emissiveMap,
    emissiveIntensity: 1.5,
    roughness: 0.95,
  });

  // Central wood-ash & ember mound bed
  const ashMoundGeo = new THREE.SphereGeometry(0.86, 16, 10);
  ashMoundGeo.scale(1.0, 0.16, 1.0);
  const ashMound = new THREE.Mesh(ashMoundGeo, coalMat);
  ashMound.position.set(0, -0.10, 0);
  ashMound.receiveShadow = true;
  group.add(ashMound);

  // 28 charcoal ember chunks instanced into ONE draw call!
  const coalBaseGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const cp = coalBaseGeo.attributes.position;
  for (let k = 0; k < cp.count; k++) {
    const n = spatialRockNoise(cp.getX(k) * 16, cp.getY(k) * 16, cp.getZ(k) * 16, 2.9);
    cp.setXYZ(k, cp.getX(k) * n * 1.35, cp.getY(k) * n * 0.58, cp.getZ(k) * n * 1.05);
  }
  coalBaseGeo.computeVertexNormals();
  const coalInst = new THREE.InstancedMesh(coalBaseGeo, coalMat, 28);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 28; i++) {
    const ang = hash(i * 11) * Math.PI * 2;
    const rad = Math.sqrt(hash(i * 17)) * 0.72;
    const sc = 0.72 + hash(i * 23) * 0.68;
    dummy.position.set(Math.cos(ang) * rad, -0.05 + hash(i * 29) * 0.06, Math.sin(ang) * rad);
    dummy.rotation.set(hash(i) * 3, hash(i + 5) * 3, hash(i + 9) * 3);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    coalInst.setMatrixAt(i, dummy.matrix);
  }
  coalInst.receiveShadow = true;
  group.add(coalInst);

  // 4. Rustic weathered cedar preparation board in foreground
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    normalMap: textures.wood.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.78,
    metalness: 0.02,
  });

  const boardGroup = new THREE.Group();
  boardGroup.position.set(0.88, 0.14, 2.08);
  boardGroup.rotation.y = -0.26;

  const slabGeo = new THREE.BoxGeometry(2.05, 0.16, 1.38, 10, 2, 8);
  const slPos = slabGeo.attributes.position;
  for (let i = 0; i < slPos.count; i++) {
    const x = slPos.getX(i);
    const y = slPos.getY(i);
    const z = slPos.getZ(i);
    const edge = Math.max(Math.abs(x) / 1.025, Math.abs(z) / 0.69);
    const bevel = edge > 0.85 && y > 0 ? -0.02 : 0;
    const organic = (spatialRockNoise(x * 2, y * 2, z * 2, 19) - 1) * 0.04;
    slPos.setXYZ(i, x + organic, y + bevel, z + organic);
  }
  slabGeo.computeVertexNormals();
  const slabMesh = new THREE.Mesh(slabGeo, woodMat);
  slabMesh.castShadow = true;
  slabMesh.receiveShadow = true;
  boardGroup.add(slabMesh);

  const legGeo = new THREE.CylinderGeometry(0.11, 0.125, 0.24, 12);
  const leg1 = new THREE.Mesh(legGeo, barkMat);
  leg1.position.set(-0.68, -0.14, 0);
  const leg2 = new THREE.Mesh(legGeo, barkMat);
  leg2.position.set(0.68, -0.14, 0);
  boardGroup.add(leg1, leg2);
  group.add(boardGroup);

  // 5. Rustic wooden basket of spare sweet potatoes on left-foreground edge
  const basketGroup = new THREE.Group();
  basketGroup.position.set(-1.95, 0.18, 1.55);
  basketGroup.rotation.y = 0.42;

  const basketMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    normalMap: textures.wood.normalMap,
    color: '#9e7048',
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const basketWall = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.32, 16, 1, true), basketMat);
  basketWall.castShadow = true;
  basketWall.receiveShadow = true;
  basketGroup.add(basketWall);

  const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.032, 8, 20), basketMat);
  basketRim.rotation.x = Math.PI / 2;
  basketRim.position.y = 0.16;
  basketGroup.add(basketRim);

  const basketBottom = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), basketMat);
  basketBottom.rotation.x = -Math.PI / 2;
  basketBottom.position.y = -0.14;
  basketGroup.add(basketBottom);

  const sparePotatoMat = new THREE.MeshStandardMaterial({
    map: textures.potatoSkin.raw.map,
    normalMap: textures.potatoSkin.raw.normalMap,
    roughnessMap: textures.potatoSkin.raw.roughnessMap,
    roughness: 0.74,
  });
  const spareGeo = new THREE.SphereGeometry(0.14, 14, 10);
  spareGeo.scale(2.15, 0.88, 0.92);
  [
    [-0.08, 0.05, 0.06, 0.25, 0.4, 0.15],
    [0.10, 0.07, -0.08, -0.18, -0.6, -0.22],
    [0.02, 0.14, 0.02, 0.12, 1.1, 0.32],
  ].forEach((sc) => {
    const sp = new THREE.Mesh(spareGeo, sparePotatoMat);
    sp.position.set(sc[0], sc[1], sc[2]);
    sp.rotation.set(sc[3], sc[4], sc[5]);
    sp.castShadow = true;
    basketGroup.add(sp);
  });
  group.add(basketGroup);

  // 6. Interactive small pinecones scattered near the clearing
  const pinecones = [];
  const coneMat = new THREE.MeshStandardMaterial({ color: '#5a3622', roughness: 0.88 });
  [
    [-1.45, 0.055, 0.55],
    [-1.12, 0.05, 1.85],
    [1.75, 0.055, 0.48],
    [2.15, 0.05, 1.35],
    [-0.45, 0.05, 2.35],
  ].forEach((cp, idx) => {
    const cGeo = new THREE.ConeGeometry(0.06, 0.13, 8, 3);
    cGeo.rotateZ(Math.PI * 0.42);
    const cone = new THREE.Mesh(cGeo, coneMat);
    cone.position.set(cp[0], cp[1], cp[2]);
    cone.rotation.y = hash(idx * 17) * Math.PI * 2;
    cone.castShadow = true;
    cone.userData = { velY: 0, spin: 0, baseY: cp[1] };
    group.add(cone);
    pinecones.push(cone);
  });

  // 7. Photorealistic Autumn Park Woodland Backdrop — graceful branching silhouettes + fine-leaf backlit boughs!
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#251711',
    normalMap: textures.bark.normalMap,
    roughness: 0.94,
  });

  // Low misty distant autumn hills with atmospheric sunset haze gradient (lets blazing golden sunset glow openly between the trees!)
  const ridgeGeo = new THREE.PlaneGeometry(58, 3.6, 64, 4);
  const rPos = ridgeGeo.attributes.position;
  const rColors = new Float32Array(rPos.count * 3);
  for (let i = 0; i < rPos.count; i++) {
    const x = rPos.getX(i);
    const y = rPos.getY(i);
    const tY = (y + 1.8) / 3.6; // 0 bottom -> 1 crest
    if (y > 0) {
      const valleyDip = 1.0 - 0.72 * Math.exp(-Math.pow(x / 6.2, 2));
      const h1 = (Math.sin(x * 0.20 + 0.8) * 0.5 + 0.5) * 1.45 + (Math.cos(x * 0.52 - 1.2) * 0.5 + 0.5) * 0.55;
      const h2 = Math.sin(x * 1.35) * 0.14;
      rPos.setY(i, (y / 1.8) * (0.35 + (h1 + h2) * valleyDip));
    }
    // Warm dusky base fading into sunlit golden-amber hazy crest
    const nearSun = Math.exp(-Math.pow(x / 7.5, 2));
    rColors[i * 3] = 0.26 + tY * (0.28 + nearSun * 0.34);
    rColors[i * 3 + 1] = 0.15 + tY * (0.16 + nearSun * 0.22);
    rColors[i * 3 + 2] = 0.12 + tY * (0.09 + nearSun * 0.08);
  }
  ridgeGeo.setAttribute('color', new THREE.BufferAttribute(rColors, 3));
  ridgeGeo.computeVertexNormals();
  const ridgeMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: true,
    transparent: true,
    opacity: 0.76,
  });
  const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
  ridgeMesh.position.set(0, 0.65, -18.5);
  group.add(ridgeMesh);

  // Natural gracefully arching dry autumn grass tufts clustered organically around fence posts & tree bases (1 draw call!)
  const bladeGeo = new THREE.PlaneGeometry(0.028, 0.30, 1, 4);
  bladeGeo.translate(0, 0.15, 0);
  const bp = bladeGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const by = bp.getY(i);
    const u = by / 0.30;
    // Taper to fine tip & arch naturally outward
    bp.setX(i, bp.getX(i) * (1 - u * 0.88));
    bp.setZ(i, u * u * 0.12);
  }
  bladeGeo.computeVertexNormals();
  const bladeMat = new THREE.MeshStandardMaterial({
    color: '#6b4c28',
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const grassCount = 160;
  const grassInst = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
  // 20 natural clumps tucked near fence posts & trees (never uniform toothpicks!)
  const clumpAnchors = [];
  for (let i = -4; i <= 4; i++) {
    clumpAnchors.push([i * 1.75 + (hash(i + 20) - 0.5) * 0.45, -5.35 + Math.abs(i) * 0.22]);
  }
  clumpAnchors.push([-4.7, -4.4], [5.0, -4.0], [-2.7, -5.9], [2.9, -5.5], [-3.6, -3.5], [3.8, -3.2]);
  for (let i = 0; i < grassCount; i++) {
    const anchor = clumpAnchors[i % clumpAnchors.length];
    const ang = hash(i * 17) * Math.PI * 2;
    const spread = Math.sqrt(hash(i * 19)) * 0.34;
    dummy.position.set(anchor[0] + Math.cos(ang) * spread, -0.02, anchor[1] + Math.sin(ang) * spread);
    dummy.rotation.set(0.15 + hash(i * 5) * 0.35, ang, (hash(i * 7) - 0.5) * 0.35);
    const gs = 0.65 + hash(i * 23) * 0.85;
    dummy.scale.set(gs, gs * (0.75 + hash(i * 29) * 0.65), gs);
    dummy.updateMatrix();
    grassInst.setMatrixAt(i, dummy.matrix);
  }
  group.add(grassInst);

  // Fine-leaf photographic backlit canopy materials (muted realistic crimson, burnt amber, sunlit ochre)
  const canopyTints = ['#c9441e', '#da7b22', '#e4aa34', '#9e2a18', '#cc5b1c'];
  const canopyMats = canopyTints.map(
    (col) =>
      new THREE.SpriteMaterial({
        map: textures.particles.foliageClusterTex,
        color: col,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      })
  );

  const treeCoords = [
    [-4.8, -4.6, 0.95],
    [-2.7, -6.2, 0.88],
    [-6.6, -2.0, 1.12],
    [2.9, -5.8, 0.90],
    [5.1, -4.2, 1.05],
    [6.8, -1.6, 1.08],
    [-1.6, -8.8, 0.85],
    [1.8, -9.0, 0.85],
  ];

  treeCoords.forEach((tc, idx) => {
    const [tx, tz, sc] = tc;
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, -0.15, tz);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * sc, 0.25 * sc, 4.5 * sc, 8), trunkMat);
    trunk.position.y = 2.15 * sc;
    trunk.rotation.z = (hash(idx * 7) - 0.5) * 0.08;
    tGroup.add(trunk);

    for (let b = 0; b < 3; b++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.036 * sc, 0.088 * sc, 2.3 * sc, 6), trunkMat);
      const side = b === 0 ? -1 : b === 1 ? 1 : (idx % 2 === 0 ? -0.4 : 0.4);
      br.position.set(side * 0.68 * sc, (2.8 + b * 0.44) * sc, b === 2 ? 0.35 : 0);
      br.rotation.z = -side * (0.64 + hash(idx + b) * 0.24);
      tGroup.add(br);
    }

    // 4 large fine-leaf photographic canopy boughs per tree (32 total -> half the draw calls & 10x more realistic!)
    for (let c = 0; c < 4; c++) {
      const sp = new THREE.Sprite(canopyMats[(idx + c) % canopyMats.length]);
      const sz = (3.4 + hash(idx * 19 + c) * 1.45) * sc;
      sp.scale.set(sz * 1.28, sz * 0.96, 1);
      sp.position.set(
        (hash(idx * 31 + c) - 0.5) * 2.6 * sc,
        (3.45 + hash(idx * 41 + c) * 1.45) * sc,
        (hash(idx * 53 + c) - 0.5) * 1.1 * sc
      );
      tGroup.add(sp);
    }
    group.add(tGroup);
  });

  // Low rustic wooden park rail fence along far edge of clearing
  const fenceGroup = new THREE.Group();
  fenceGroup.position.set(0, 0, -5.4);
  for (let i = -4; i <= 4; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.06, 0.85, 7), trunkMat);
    post.position.set(i * 1.75, 0.32, Math.abs(i) * 0.22);
    post.rotation.z = (hash(i + 10) - 0.5) * 0.05;
    fenceGroup.add(post);
  }
  const railGeo = new THREE.CylinderGeometry(0.032, 0.036, 13.5, 7);
  railGeo.rotateZ(Math.PI / 2);
  const rail1 = new THREE.Mesh(railGeo, trunkMat);
  rail1.position.set(0, 0.58, 0.32);
  const rail2 = new THREE.Mesh(railGeo, trunkMat);
  rail2.position.set(0, 0.28, 0.32);
  fenceGroup.add(rail1, rail2);
  group.add(fenceGroup);

  // Soft golden magic-hour setting sun halo & subtle volumetric crepuscular sunbeams streaming through clearing!
  const sunGlowMat = new THREE.SpriteMaterial({
    map: textures.particles.sunGlowTex,
    color: '#ffd894',
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sunGlow = new THREE.Sprite(sunGlowMat);
  sunGlow.position.set(0.15, 2.05, -13.5);
  sunGlow.scale.set(13.5, 10.5, 1);
  group.add(sunGlow);

  return {
    group,
    groundMat,
    barkMat,
    coalMat,
    boardGroup,
    basketGroup,
    pinecones,
    sunGlow,
    boardTopWorld: new THREE.Vector3(0.88, 0.44, 2.08),
  };
}
