import * as THREE from '../vendor/three.module.js';

// =========================================================================
// ITERATION 2: PHOTOREALISTIC ANATOMICAL FIRST-PERSON ADULT HANDS
// - Single seamless continuous sculpted mesh for Forearm -> Wrist -> Palm -> Knuckles (ZERO doll-joint seams!)
// - Proper opposing anatomical thumb (never sticks backward!)
// - Matte-satin realistic skin shading (no plastic clearcoat hotspot!) with warm sunset sheen & pore bump
// - Detailed fingernails with cuticle & subtle natural gloss
// - High-craft culinary tools (Y-peeler, forged Santoku knife, wooden spatula, stainless ladle, silver spoon)
// =========================================================================

function createNailMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf0cec2,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
  });
}

function createSkinMaterial(skinTextures) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf1d1be,
    map: skinTextures.map,
    bumpMap: skinTextures.bumpMap,
    bumpScale: 0.0026,
    roughnessMap: skinTextures.roughnessMap,
    roughness: 0.68, // Realistic human skin matte-satin (eliminates plastic glare!)
    metalness: 0.0,
    clearcoat: 0.0,
    sheen: 0.52,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xffaa7e), // Warm golden-peach backlit subsurface scatter feel!
  });
}

// Smooth tapered finger phalanx with organic dorsal-palmar flattening
function makePhalanx(rBase, rTip, length, mat, radialSegs = 14) {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(rTip, rBase, length, radialSegs, 5, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + length * 0.5) / length;
    // Slight slender waist between knuckles
    const waist = 1.0 - 0.09 * Math.sin(t * Math.PI);
    pos.setX(i, x * waist * 1.03);
    pos.setZ(i, z * waist * 0.90);
  }
  geo.computeVertexNormals();
  const cyl = new THREE.Mesh(geo, mat);
  cyl.position.y = length * 0.5;
  cyl.castShadow = true;
  cyl.receiveShadow = true;
  group.add(cyl);

  const joint = new THREE.Mesh(new THREE.SphereGeometry(rBase * 0.99, radialSegs, 10), mat);
  joint.scale.set(1.03, 0.94, 0.90);
  joint.castShadow = true;
  joint.receiveShadow = true;
  group.add(joint);

  return group;
}

// Build a seamless lofted Forearm -> Wrist -> Sculpted Palm mesh (zero seams!)
// Extends from y = -0.26 (mid-forearm) through y = 0.0 (wrist) to y = +0.092 (knuckle bridge)
function buildSeamlessArmAndPalmGeometry(side) {
  const radialSegs = 28;
  const rings = [
    { y: -0.26, rx: 0.044, rz: 0.036, ox: 0.0, oz: 0.002, flat: 0.10 },
    { y: -0.21, rx: 0.0415, rz: 0.0335, ox: 0.0, oz: 0.002, flat: 0.12 },
    { y: -0.16, rx: 0.0385, rz: 0.0305, ox: 0.0, oz: 0.0018, flat: 0.14 },
    { y: -0.11, rx: 0.0345, rz: 0.0265, ox: 0.0, oz: 0.0014, flat: 0.17 },
    { y: -0.06, rx: 0.0310, rz: 0.0225, ox: 0.0, oz: 0.0008, flat: 0.20 },
    { y: -0.02, rx: 0.0290, rz: 0.0195, ox: 0.0, oz: 0.0002, flat: 0.23 }, // Slender anatomical wrist
    { y: 0.005, rx: 0.0325, rz: 0.0190, ox: -side * 0.002, oz: -0.0005, flat: 0.26 },
    { y: 0.025, rx: 0.0385, rz: 0.0185, ox: -side * 0.003, oz: -0.0010, flat: 0.30 }, // Heel of hand
    { y: 0.048, rx: 0.0430, rz: 0.0170, ox: -side * 0.002, oz: -0.0010, flat: 0.34 }, // Mid palm
    { y: 0.068, rx: 0.0442, rz: 0.0156, ox: -side * 0.0005, oz: -0.0004, flat: 0.36 },
    { y: 0.084, rx: 0.0432, rz: 0.0138, ox: 0.0, oz: 0.0000, flat: 0.34 }, // Knuckle bridge
    { y: 0.094, rx: 0.0400, rz: 0.0112, ox: 0.0, oz: 0.0000, flat: 0.28 },
    { y: 0.101, rx: 0.0320, rz: 0.0065, ox: 0.0, oz: 0.0000, flat: 0.18 },
  ];

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < rings.length; r++) {
    const cfg = rings[r];
    const v = r / (rings.length - 1);
    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);

      // Superellipse-like cross-section for natural flat-backed anatomical hand!
      const signX = Math.sign(cs);
      const signZ = Math.sign(sn);
      const p = 1.0 - cfg.flat * 0.45;
      let x = signX * Math.pow(Math.abs(cs), p) * cfg.rx + cfg.ox;
      let z = signZ * Math.pow(Math.abs(sn), p) * cfg.rz + cfg.oz;

      // Subtle dorsal knuckle ridges & metacarpal tendons on back of hand (+Z)
      if (cfg.y > 0.025 && sn > 0.2) {
        const tendon = Math.sin((cs * 3.8) * Math.PI) * 0.0012 * sn;
        const knuckleBump = cfg.y > 0.07 ? Math.pow(Math.max(0, Math.cos(cs * 6.2)), 2) * 0.0018 * sn : 0;
        z += tendon + knuckleBump;
      }
      // Subtle palm hollow (-Z) and thenar muscle fullness on thumb side (-side)
      if (cfg.y > 0.0 && cfg.y < 0.07 && sn < -0.2) {
        const thumbSide = Math.max(0, -side * cs);
        z -= thumbSide * 0.0055 * (-sn);
      }

      positions.push(x, cfg.y, z);
      uvs.push(u * 2.0, v * 2.0);
    }
  }

  const stride = radialSegs + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * stride + s;
      const b = (r + 1) * stride + s;
      const c = (r + 1) * stride + (s + 1);
      const d = r * stride + (s + 1);
      // Outward-facing CCW winding: (b - a) x (d - a) points outward!
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Articulated 3-phalanx finger (extends along +Y locally, curls toward -Z palm)
function createFinger({ baseRadius, lengths, skinMat, nailMat }) {
  const root = new THREE.Group();
  const seg1 = new THREE.Group();
  const seg2 = new THREE.Group();
  const seg3 = new THREE.Group();

  const [l1, l2, l3] = lengths;
  const r0 = baseRadius;
  const r1 = baseRadius * 0.88;
  const r2 = baseRadius * 0.77;
  const r3 = baseRadius * 0.67;

  seg1.add(makePhalanx(r0, r1, l1, skinMat));
  root.add(seg1);

  seg2.position.y = l1;
  seg2.add(makePhalanx(r1 * 0.98, r2, l2, skinMat));
  seg1.add(seg2);

  seg3.position.y = l2;
  seg3.add(makePhalanx(r2 * 0.97, r3, l3 * 0.78, skinMat));

  // Tapered natural fingertip
  const tip = new THREE.Mesh(new THREE.SphereGeometry(r3 * 0.98, 12, 10), skinMat);
  tip.position.set(0, l3 * 0.78, -r3 * 0.08);
  tip.scale.set(1.02, 1.22, 0.88);
  tip.castShadow = true;
  tip.receiveShadow = true;
  seg3.add(tip);

  // Realistic fingernail on dorsal (+Z) surface of fingertip
  const nail = new THREE.Mesh(
    new THREE.SphereGeometry(r3 * 0.76, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
    nailMat
  );
  nail.rotation.x = Math.PI * 0.5;
  nail.scale.set(0.98, 0.36, 1.25);
  nail.position.set(0, l3 * 0.52, r3 * 0.66);
  seg3.add(nail);

  seg2.add(seg3);

  return {
    root,
    seg1,
    seg2,
    seg3,
    setCurl(c1, c2, c3, spread = 0) {
      seg1.rotation.x = -c1;
      seg1.rotation.z = spread;
      seg2.rotation.x = -c2;
      seg3.rotation.x = -c3;
    },
  };
}

// Build complete anatomically smooth adult hand + forearm + rolled linen cuff
// side: -1 = Left hand, +1 = Right hand
function buildHand(side, skinMat, nailMat, linenTextures) {
  const handRoot = new THREE.Group();
  const wristPivot = new THREE.Group();
  // Orient wristPivot so in handRoot space: fingers point forward (-Z), back of hand faces up (+Y), forearm goes back (+Z)
  wristPivot.rotation.x = -Math.PI * 0.5;
  handRoot.add(wristPivot);

  // 1. Single continuous sculpted Forearm + Wrist + Palm mesh (ZERO seams!)
  const armPalmGeo = buildSeamlessArmAndPalmGeometry(side);
  const armPalmMesh = new THREE.Mesh(armPalmGeo, skinMat);
  armPalmMesh.castShadow = true;
  armPalmMesh.receiveShadow = true;
  wristPivot.add(armPalmMesh);

  // 2. Four articulated fingers seated cleanly on knuckle ridge
  const fingerSpecs = [
    { name: 'index', x: -side * 0.030, y: 0.092, r: 0.0096, lengths: [0.039, 0.023, 0.018] },
    { name: 'middle', x: -side * 0.010, y: 0.096, r: 0.0100, lengths: [0.044, 0.026, 0.019] },
    { name: 'ring', x: side * 0.011, y: 0.093, r: 0.0093, lengths: [0.040, 0.023, 0.018] },
    { name: 'pinky', x: side * 0.029, y: 0.085, r: 0.0080, lengths: [0.031, 0.018, 0.015] },
  ];

  const fingers = {};
  for (const spec of fingerSpecs) {
    const f = createFinger({
      baseRadius: spec.r,
      lengths: spec.lengths,
      skinMat,
      nailMat,
    });
    f.root.position.set(spec.x, spec.y, 0.0);
    wristPivot.add(f.root);
    fingers[spec.name] = f;
  }

  // 3. Anatomically accurate Opposable Thumb!
  // Seated cleanly at the inner thumb web; order 'ZXY' rotates pad inward toward palm & index finger!
  const thumb = createFinger({
    baseRadius: 0.0112,
    lengths: [0.027, 0.023, 0.019],
    skinMat,
    nailMat,
  });
  thumb.root.position.set(-side * 0.036, 0.036, -0.005);
  thumb.root.rotation.order = 'ZXY';
  thumb.root.rotation.set(-0.20, -side * 0.92, side * 0.36);
  wristPivot.add(thumb.root);
  fingers.thumb = thumb;

  // 4. Rolled-up warm cream woven linen sleeve on mid-forearm (tactile lived-in home cooking look!)
  const linenMat = new THREE.MeshStandardMaterial({
    color: 0xe6dac7,
    map: linenTextures.map,
    bumpMap: linenTextures.bumpMap,
    bumpScale: 0.0032,
    roughness: 0.88,
    metalness: 0.0,
  });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.054, 0.22, 20, 4), linenMat);
  sleeve.scale.set(1.03, 1.0, 0.84);
  sleeve.position.set(0, -0.275, 0.002);
  sleeve.castShadow = true;
  sleeve.receiveShadow = true;
  wristPivot.add(sleeve);

  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.0445, 0.0085, 10, 24), linenMat);
  cuff.rotation.x = Math.PI * 0.5;
  cuff.scale.set(1.03, 0.84, 1.0);
  cuff.position.set(0, -0.172, 0.002);
  cuff.castShadow = true;
  cuff.receiveShadow = true;
  wristPivot.add(cuff);

  // Tool mount nestled inside palm grip
  const toolMount = new THREE.Group();
  toolMount.position.set(-side * 0.010, 0.068, -0.022);
  wristPivot.add(toolMount);

  return { root: handRoot, wrist: wristPivot, fingers, toolMount, side };
}

// =========================================================================
// PHOTOREALISTIC CULINARY TOOLS
// =========================================================================
function createTools(woodTextures) {
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdce2e8,
    metalness: 0.90,
    roughness: 0.20,
  });
  const polishedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xeef2f6,
    metalness: 0.95,
    roughness: 0.10,
  });
  const darkWalnutMat = new THREE.MeshStandardMaterial({
    color: 0x3b2416,
    map: woodTextures.map,
    roughness: 0.48,
    metalness: 0.04,
  });
  const beechMat = new THREE.MeshStandardMaterial({
    color: 0xc89a64,
    map: woodTextures.map,
    bumpMap: woodTextures.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.60,
  });

  // 1. Gleaming Stainless Y-Peeler (extended slightly forward so blade is clearly visible on the carrot!)
  const peeler = new THREE.Group();
  const pHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0072, 0.11, 14), darkWalnutMat);
  pHandle.scale.set(1.15, 1.0, 0.72);
  pHandle.castShadow = true;
  peeler.add(pHandle);
  const pCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.0082, 0.0088, 0.018, 14), steelMat);
  pCollar.position.y = 0.062;
  peeler.add(pCollar);
  const armCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.070, 0),
    new THREE.Vector3(-0.022, 0.094, 0.004),
    new THREE.Vector3(-0.030, 0.132, 0.004),
  ]);
  const armCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.070, 0),
    new THREE.Vector3(0.022, 0.094, 0.004),
    new THREE.Vector3(0.030, 0.132, 0.004),
  ]);
  const armL = new THREE.Mesh(new THREE.TubeGeometry(armCurveL, 12, 0.0030, 8, false), steelMat);
  const armR = new THREE.Mesh(new THREE.TubeGeometry(armCurveR, 12, 0.0030, 8, false), steelMat);
  armL.castShadow = true;
  armR.castShadow = true;
  peeler.add(armL, armR);
  const bladeBar = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.009, 0.0020), polishedSteelMat);
  bladeBar.position.set(0, 0.130, 0.004);
  bladeBar.rotation.x = 0.28;
  bladeBar.castShadow = true;
  peeler.add(bladeBar);
  peeler.rotation.set(0.28, 0, 0.06);
  peeler.position.set(0.0, 0.022, -0.004);

  // 2. Forged Japanese Santoku Kitchen Knife (handle tucked snugly inside palm grip!)
  const knife = new THREE.Group();
  const kHandle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.098, 0.022), darkWalnutMat);
  kHandle.position.set(0, -0.002, 0);
  kHandle.castShadow = true;
  knife.add(kHandle);
  for (let i = 0; i < 3; i++) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0023, 0.0023, 0.0165, 10), polishedSteelMat);
    rivet.rotation.z = Math.PI * 0.5;
    rivet.position.set(0, -0.030 + i * 0.028, 0);
    knife.add(rivet);
  }
  const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.016, 0.023), polishedSteelMat);
  bolster.position.set(0, 0.052, 0);
  knife.add(bolster);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(0.185, 0.003);
  bladeShape.quadraticCurveTo(0.204, 0.012, 0.206, 0.031);
  bladeShape.quadraticCurveTo(0.194, 0.048, 0.152, 0.049);
  bladeShape.lineTo(0, 0.047);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.0022,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0007,
    bevelSegments: 2,
  });
  bladeGeo.rotateY(-Math.PI * 0.5);
  bladeGeo.rotateX(-Math.PI * 0.5);
  const bladeMesh = new THREE.Mesh(bladeGeo, steelMat);
  bladeMesh.position.set(0.001, 0.058, 0.016);
  bladeMesh.castShadow = true;
  bladeMesh.receiveShadow = true;
  knife.add(bladeMesh);
  const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.184, 0.0032), polishedSteelMat);
  edgeStrip.position.set(0, 0.148, -0.030);
  knife.add(edgeStrip);
  knife.position.set(0.004, 0.012, -0.006);

  // 3. Wooden Cooking Spatula (Kibera)
  const spatula = new THREE.Group();
  const spShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.008, 0.24, 12), beechMat);
  spShaft.scale.set(1.2, 1.0, 0.65);
  spShaft.position.set(0, 0.08, 0);
  spShaft.castShadow = true;
  spatula.add(spShaft);
  const paddleGeo = new THREE.BoxGeometry(0.054, 0.095, 0.0065);
  const pdPos = paddleGeo.attributes.position;
  for (let i = 0; i < pdPos.count; i++) {
    const y = pdPos.getY(i);
    const x = pdPos.getX(i);
    if (y > 0) {
      pdPos.setZ(i, pdPos.getZ(i) * 0.42);
      pdPos.setY(i, y + x * 0.15);
    } else {
      pdPos.setX(i, x * 0.38);
    }
  }
  paddleGeo.computeVertexNormals();
  const paddle = new THREE.Mesh(paddleGeo, beechMat);
  paddle.position.set(0, 0.225, 0.003);
  paddle.rotation.x = -0.14;
  paddle.castShadow = true;
  spatula.add(paddle);
  spatula.position.set(0.004, 0.015, -0.005);

  // 4. Stainless Steel Curry Ladle
  const ladle = new THREE.Group();
  const lShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0062, 0.26, 12), polishedSteelMat);
  lShaft.scale.set(1.3, 1.0, 0.55);
  lShaft.position.set(0, 0.095, 0);
  lShaft.castShadow = true;
  ladle.add(lShaft);
  const bowlGroup = new THREE.Group();
  bowlGroup.position.set(0, 0.235, -0.022);
  bowlGroup.rotation.x = 0.68;
  const bowlGeo = new THREE.SphereGeometry(0.048, 24, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
  const bowlMat = polishedSteelMat.clone();
  bowlMat.side = THREE.DoubleSide;
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  bowlGroup.add(bowl);

  const ladleFillMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c2b0d,
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 0.92,
    clearcoatRoughness: 0.10,
  });
  const ladleFill = new THREE.Mesh(new THREE.CircleGeometry(0.044, 22), ladleFillMat);
  ladleFill.rotation.x = -Math.PI * 0.5;
  ladleFill.position.y = -0.004;
  ladleFill.visible = false;
  bowlGroup.add(ladleFill);

  const ladleCarrot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.010, 0.011, 14),
    new THREE.MeshPhysicalMaterial({ color: 0xe66a1d, roughness: 0.22, clearcoat: 0.8 })
  );
  ladleCarrot.position.set(-0.012, -0.001, 0.008);
  ladleCarrot.rotation.set(0.4, 0.3, 0.6);
  ladleCarrot.visible = false;
  bowlGroup.add(ladleCarrot);

  const ladlePotato = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 14, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xd9a857, roughness: 0.28, clearcoat: 0.75 })
  );
  ladlePotato.scale.set(1.1, 0.85, 0.95);
  ladlePotato.position.set(0.014, -0.002, -0.006);
  ladlePotato.visible = false;
  bowlGroup.add(ladlePotato);

  ladle.add(bowlGroup);
  ladle.userData = { bowlGroup, ladleFill, ladleCarrot, ladlePotato };
  ladle.position.set(0.004, 0.015, -0.004);

  // 5. Polished Silver Japanese Curry Spoon
  const spoon = new THREE.Group();
  const sHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0072, 0.145, 12), polishedSteelMat);
  sHandle.scale.set(1.4, 1.0, 0.35);
  sHandle.position.set(0, 0.045, 0);
  sHandle.castShadow = true;
  spoon.add(sHandle);
  const sBowlGeo = new THREE.SphereGeometry(0.025, 18, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
  const sBowlMat = polishedSteelMat.clone();
  sBowlMat.side = THREE.DoubleSide;
  const sBowl = new THREE.Mesh(sBowlGeo, sBowlMat);
  sBowl.scale.set(0.84, 0.55, 1.50);
  sBowl.rotation.x = Math.PI * 0.5;
  sBowl.position.set(0, 0.142, -0.006);
  sBowl.castShadow = true;
  spoon.add(sBowl);

  const spoonBite = new THREE.Group();
  spoonBite.position.set(0, 0.144, 0.005);
  const biteRice = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.46 })
  );
  biteRice.scale.set(1.0, 1.25, 0.72);
  biteRice.position.set(0.005, 0.004, 0.002);
  const biteCurry = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 10), ladleFillMat);
  biteCurry.scale.set(1.05, 1.15, 0.72);
  biteCurry.position.set(-0.005, -0.004, 0.004);
  const biteCarrot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.008, 0.009, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xec6d1c, roughness: 0.2, clearcoat: 0.8 })
  );
  biteCarrot.position.set(-0.004, 0.006, 0.010);
  spoonBite.add(biteRice, biteCurry, biteCarrot);
  spoonBite.visible = false;
  spoon.add(spoonBite);
  spoon.userData = { spoonBite };
  spoon.position.set(0.004, 0.015, -0.004);

  return { peeler, knife, spatula, ladle, spoon };
}

export const FINGER_POSES = {
  relaxed: {
    thumb: [0.18, 0.14, 0.10, -0.10],
    index: [0.28, 0.34, 0.20, -0.05],
    middle: [0.34, 0.40, 0.24, 0.0],
    ring: [0.42, 0.46, 0.28, 0.04],
    pinky: [0.50, 0.52, 0.34, 0.08],
  },
  gripTool: {
    thumb: [0.38, 0.32, 0.22, -0.22],
    index: [0.95, 1.12, 0.68, -0.06],
    middle: [1.18, 1.28, 0.78, 0.0],
    ring: [1.26, 1.32, 0.84, 0.04],
    pinky: [1.32, 1.34, 0.86, 0.08],
  },
  pinchPeeler: {
    thumb: [0.32, 0.28, 0.18, -0.20],
    index: [0.68, 0.76, 0.45, -0.08],
    middle: [1.08, 1.22, 0.72, 0.0],
    ring: [1.24, 1.28, 0.82, 0.04],
    pinky: [1.30, 1.30, 0.84, 0.08],
  },
  holdVeggie: {
    thumb: [0.28, 0.24, 0.16, -0.18],
    index: [0.58, 0.70, 0.44, -0.08],
    middle: [0.64, 0.76, 0.48, 0.0],
    ring: [0.72, 0.82, 0.52, 0.05],
    pinky: [0.80, 0.84, 0.56, 0.10],
  },
  catPaw: {
    thumb: [0.38, 0.34, 0.24, -0.24],
    index: [0.52, 1.24, 0.92, -0.04],
    middle: [0.56, 1.28, 0.95, 0.0],
    ring: [0.62, 1.24, 0.90, 0.04],
    pinky: [0.68, 1.18, 0.84, 0.08],
  },
  pinchRoux: {
    thumb: [0.42, 0.34, 0.24, -0.22],
    index: [0.76, 0.80, 0.52, -0.06],
    middle: [0.50, 0.58, 0.36, 0.04],
    ring: [0.62, 0.68, 0.44, 0.08],
    pinky: [0.72, 0.74, 0.50, 0.12],
  },
  openSupport: {
    thumb: [0.16, 0.12, 0.08, -0.10],
    index: [0.22, 0.26, 0.16, -0.05],
    middle: [0.26, 0.30, 0.18, 0.0],
    ring: [0.32, 0.34, 0.20, 0.05],
    pinky: [0.38, 0.38, 0.24, 0.10],
  },
};

export class FirstPersonHands {
  constructor(skinTextures, linenTextures, woodTextures) {
    this.group = new THREE.Group();
    const skinMat = createSkinMaterial(skinTextures);
    const nailMat = createNailMaterial();

    this.left = buildHand(-1, skinMat, nailMat, linenTextures);
    this.right = buildHand(1, skinMat, nailMat, linenTextures);
    this.group.add(this.left.root, this.right.root);

    this.tools = createTools(woodTextures);
    for (const key of Object.keys(this.tools)) {
      this.tools[key].visible = false;
      this.right.toolMount.add(this.tools[key]);
    }
    this.activeTool = null;

    this.leftTargetPos = new THREE.Vector3(-0.36, 0.10, 0.18);
    this.leftTargetRot = new THREE.Euler(-0.18, -0.45, -0.30, 'YXZ');
    this.rightTargetPos = new THREE.Vector3(-0.04, 0.12, 0.24);
    this.rightTargetRot = new THREE.Euler(-0.30, 0.50, 0.35, 'YXZ');

    this.left.root.position.copy(this.leftTargetPos);
    this.left.root.rotation.copy(this.leftTargetRot);
    this.right.root.position.copy(this.rightTargetPos);
    this.right.root.rotation.copy(this.rightTargetRot);

    this.leftPoseName = 'holdVeggie';
    this.rightPoseName = 'pinchPeeler';
    this._leftCur = this._clonePose(FINGER_POSES.holdVeggie);
    this._rightCur = this._clonePose(FINGER_POSES.pinchPeeler);
    this._applyPose(this.left, this._leftCur);
    this._applyPose(this.right, this._rightCur);

    this.time = 0;
  }

  _clonePose(p) {
    return {
      thumb: [...p.thumb],
      index: [...p.index],
      middle: [...p.middle],
      ring: [...p.ring],
      pinky: [...p.pinky],
    };
  }

  setTool(toolName) {
    this.activeTool = toolName;
    for (const [k, mesh] of Object.entries(this.tools)) {
      mesh.visible = k === toolName;
    }
  }

  setLadleFilled(filled, showChunks = true) {
    const { ladleFill, ladleCarrot, ladlePotato } = this.tools.ladle.userData;
    ladleFill.visible = filled;
    ladleCarrot.visible = filled && showChunks;
    ladlePotato.visible = filled && showChunks;
  }

  setSpoonBite(visible) {
    this.tools.spoon.userData.spoonBite.visible = visible;
  }

  setLeftTarget(pos, rot, poseName = 'holdVeggie') {
    this.leftTargetPos.copy(pos);
    this.leftTargetRot.copy(rot);
    this.leftPoseName = poseName;
  }

  setRightTarget(pos, rot, poseName = 'gripTool') {
    this.rightTargetPos.copy(pos);
    this.rightTargetRot.copy(rot);
    this.rightPoseName = poseName;
  }

  _lerpPose(cur, target, alpha) {
    for (const k of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      for (let i = 0; i < 4; i++) {
        cur[k][i] += (target[k][i] - cur[k][i]) * alpha;
      }
    }
  }

  _applyPose(hand, cur, breathe = 0) {
    const s = hand.side;
    for (const k of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const f = hand.fingers[k];
      const v = cur[k];
      const micro = breathe * (k === 'index' ? 0.03 : k === 'pinky' ? 0.045 : 0.02);
      f.setCurl(v[0] + micro, v[1] + micro * 0.8, v[2] + micro * 0.6, v[3] * s);
    }
  }

  update(dt, snapFast = false) {
    this.time += dt;
    const posLerp = snapFast ? 1.0 : Math.min(1, dt * 15);
    const rotLerp = snapFast ? 1.0 : Math.min(1, dt * 13);
    const poseLerp = snapFast ? 1.0 : Math.min(1, dt * 11);

    const breathY = Math.sin(this.time * 1.9) * 0.0018;
    const breathR = Math.sin(this.time * 1.5 + 0.7) * 0.010;

    this.left.root.position.lerp(
      new THREE.Vector3(this.leftTargetPos.x, this.leftTargetPos.y + breathY, this.leftTargetPos.z),
      posLerp
    );
    this.right.root.position.lerp(
      new THREE.Vector3(this.rightTargetPos.x, this.rightTargetPos.y - breathY * 0.7, this.rightTargetPos.z),
      posLerp
    );

    const qL = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.leftTargetRot.x + breathR, this.leftTargetRot.y, this.leftTargetRot.z, 'YXZ')
    );
    const qR = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.rightTargetRot.x - breathR, this.rightTargetRot.y, this.rightTargetRot.z, 'YXZ')
    );
    this.left.root.quaternion.slerp(qL, rotLerp);
    this.right.root.quaternion.slerp(qR, rotLerp);

    this._lerpPose(this._leftCur, FINGER_POSES[this.leftPoseName] || FINGER_POSES.relaxed, poseLerp);
    this._lerpPose(this._rightCur, FINGER_POSES[this.rightPoseName] || FINGER_POSES.relaxed, poseLerp);
    this._applyPose(this.left, this._leftCur, Math.sin(this.time * 2.1));
    this._applyPose(this.right, this._rightCur, Math.sin(this.time * 2.3 + 1.2));
  }
}
