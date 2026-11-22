import * as THREE from 'three';
import { createSkinTextures, createFabricTextures } from './textures.js';
import { BOARD_Y } from './environment.js';

// Photorealistic Anatomical Articulated 3D Human Hands + Seated Family Ensemble
// Fix Round 3 upgrades:
// - Fixed shoulder-to-wrist forearm kinematics: arms angle cleanly OUTWARD & BACKWARD into
//   real cozy winter-clothed family torsos/shoulders seated behind the table on the tatami!
// - ZERO floating sleeve tubes, ZERO intersecting sleeves!
// - Realistic horizontal/angled chopstick grip hugging the mochi sides cleanly!
// - Child's resting hands positioned cleanly clear of the soy-sauce dish & nori tray!

function createSkinMaterial(seed, baseRGB) {
  const tex = createSkinTextures(seed, baseRGB);
  return new THREE.MeshPhysicalMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: tex.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    sheen: 0.26,
    sheenRoughness: 0.74,
    sheenColor: new THREE.Color(0xe6967a),
    clearcoat: 0.03,
    clearcoatRoughness: 0.70,
  });
}

function createNailMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe0bab0),
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
  });
}

function makeOrganicPhalanx(rBase, rTip, length, isDistal = false) {
  const pts = [];
  if (isDistal) {
    pts.push(new THREE.Vector2(0.001, -rBase * 0.45));
    pts.push(new THREE.Vector2(rBase * 0.88, -rBase * 0.28));
    pts.push(new THREE.Vector2(rBase * 1.04, 0.0));
    pts.push(new THREE.Vector2(rBase * 0.94, length * 0.34));
    pts.push(new THREE.Vector2(rTip * 1.02, length * 0.74));
    pts.push(new THREE.Vector2(rTip * 0.82, length * 0.96));
    pts.push(new THREE.Vector2(rTip * 0.45, length * 1.06));
    pts.push(new THREE.Vector2(0.001, length * 1.10));
  } else {
    pts.push(new THREE.Vector2(0.001, -rBase * 0.48));
    pts.push(new THREE.Vector2(rBase * 0.90, -rBase * 0.30));
    pts.push(new THREE.Vector2(rBase * 1.06, 0.0));
    pts.push(new THREE.Vector2(rBase * 0.96, length * 0.26));
    pts.push(new THREE.Vector2((rBase + rTip) * 0.46, length * 0.56));
    pts.push(new THREE.Vector2(rTip * 1.04, length * 0.96));
    pts.push(new THREE.Vector2(rTip * 0.82, length + rTip * 0.34));
    pts.push(new THREE.Vector2(0.001, length + rTip * 0.46));
  }
  const geo = new THREE.LatheGeometry(pts, 14);
  geo.scale(1.0, 1.0, 0.86);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeSmoothAnatomicalPalm(mirror) {
  const geo = new THREE.SphereGeometry(0.50, 26, 18);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i) / 0.50;
    const sy = pos.getY(i) / 0.50;
    const sz = pos.getZ(i) / 0.50;

    const z01 = (sz + 1) * 0.5;
    const widthProfile = 0.72 + Math.pow(z01, 0.72) * 0.34;
    const softRect = 1.0 + 0.10 * Math.pow(Math.abs(sx * sz), 1.5);

    let x = sx * 0.48 * widthProfile * softRect;
    let y = sy * 0.175 * (0.88 + 0.18 * (1 - Math.abs(sx)));
    let z = sz * 0.52 * softRect;

    const arch = (1.0 - sx * sx) * 0.042;
    y += arch;

    const thumbPad = Math.max(0, -sx * mirror) * Math.max(0, 0.35 - sz);
    if (sy < 0) y -= thumbPad * 0.085;
    x -= thumbPad * 0.06 * mirror;

    if (sz > 0.15) {
      z -= Math.max(0, sx * mirror) * 0.095 * ((sz - 0.15) / 0.85);
    }

    if (sy > 0.1 && sz > 0.35) {
      const kRidge = Math.exp(-Math.pow((sz - 0.78) * 4.0, 2));
      const kBumps = 0.5 + 0.5 * Math.cos((sx * 3.1 + 0.3) * Math.PI);
      y += kRidge * kBumps * 0.022 * sy;
    }

    const finalZ = z + 0.42;
    pos.setXYZ(i, x, y, finalZ);
    uv.setXY(i, x * 1.15 + 0.5, finalZ * 1.15 + 0.2);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRealisticHand(options = {}) {
  const {
    side = 'right',
    scale = 1.0,
    skinSeed = 901,
    skinRGB = [214, 162, 134],
    sleeveBase = '#d6c5b3',
    sleeveAccent = '#b8a28d',
    sleevePattern = 'knit',
    hasChopsticks = false,
    sleeveLength = 4.6,
    wristBend = 0.0, // Anatomical wrist dorsiflexion: slopes forearm up toward seated shoulder while palm rests flat on table!
  } = options;

  const mirror = side === 'left' ? -1 : 1;
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const skinMat = createSkinMaterial(skinSeed, skinRGB);
  const nailMat = createNailMaterial();
  const fabTex = createFabricTextures(skinSeed + 50, sleeveBase, sleeveAccent, sleevePattern);
  const sleeveMat = new THREE.MeshStandardMaterial({
    map: fabTex.map,
    normalMap: fabTex.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.90,
    metalness: 0.0,
  });

  const wristPivot = new THREE.Group();
  root.add(wristPivot);

  // Arm pivot bends anatomically at the wrist so the forearm & sleeve slope naturally up toward the person's shoulder
  // while the palm & fingers rest flat and gracefully on the wooden table!
  const armPivot = new THREE.Group();
  armPivot.rotation.x = wristBend;
  wristPivot.add(armPivot);

  // Smooth Wrist & Forearm
  const wristPts = [
    new THREE.Vector2(0.001, -1.40),
    new THREE.Vector2(0.35, -1.30),
    new THREE.Vector2(0.32, -0.76),
    new THREE.Vector2(0.28, -0.24),
    new THREE.Vector2(0.30, 0.08),
    new THREE.Vector2(0.24, 0.22),
    new THREE.Vector2(0.001, 0.24),
  ];
  const forearmGeo = new THREE.LatheGeometry(wristPts, 18);
  forearmGeo.scale(1.16, 1.0, 0.68);
  forearmGeo.rotateX(Math.PI / 2);
  const forearm = new THREE.Mesh(forearmGeo, skinMat);
  forearm.position.set(0, -0.01, 0.0);
  forearm.castShadow = true;
  forearm.receiveShadow = true;
  armPivot.add(forearm);

  // Draped winter garment sleeve with soft closed rounded shoulder cap
  const sleevePts = [
    new THREE.Vector2(0.001, -sleeveLength - 0.35),
    new THREE.Vector2(0.55, -sleeveLength - 0.15),
    new THREE.Vector2(0.62, -sleeveLength * 0.72),
    new THREE.Vector2(0.52, -sleeveLength * 0.42),
    new THREE.Vector2(0.45, -1.45),
    new THREE.Vector2(0.41, -0.90),
    new THREE.Vector2(0.43, -0.74),
    new THREE.Vector2(0.36, -0.66),
    new THREE.Vector2(0.29, -0.76),
  ];
  const sleeveGeo = new THREE.LatheGeometry(sleevePts, 20);
  sleeveGeo.scale(1.12, 1.0, 0.80);
  sleeveGeo.rotateX(Math.PI / 2);
  const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeve.position.set(0, 0.02, 0.0);
  sleeve.castShadow = true;
  sleeve.receiveShadow = true;
  armPivot.add(sleeve);

  // Silky-Smooth Anatomical Palm
  const palmGroup = new THREE.Group();
  wristPivot.add(palmGroup);

  const palmMesh = new THREE.Mesh(makeSmoothAnatomicalPalm(mirror), skinMat);
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  palmGroup.add(palmMesh);

  const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), skinMat);
  thenar.scale.set(0.95, 0.60, 1.42);
  thenar.position.set(-0.25 * mirror, -0.045, 0.30);
  thenar.rotation.y = 0.28 * mirror;
  thenar.castShadow = true;
  palmGroup.add(thenar);

  const fingerDefs = [
    { name: 'index',  x: -0.29, z: 0.84, y: 0.01, len: [0.38, 0.25, 0.20], r: [0.098, 0.084, 0.072, 0.058], spread: -0.04 },
    { name: 'middle', x: -0.09, z: 0.88, y: 0.024, len: [0.42, 0.27, 0.21], r: [0.102, 0.088, 0.075, 0.060], spread:  0.00 },
    { name: 'ring',   x:  0.11, z: 0.85, y: 0.01, len: [0.39, 0.25, 0.20], r: [0.095, 0.082, 0.070, 0.055], spread:  0.032 },
    { name: 'pinky',  x:  0.29, z: 0.77, y: -0.015, len: [0.30, 0.19, 0.16], r: [0.082, 0.070, 0.060, 0.048], spread:  0.078 },
  ];

  const fingers = {};

  for (const def of fingerDefs) {
    const mcp = new THREE.Group();
    mcp.position.set(def.x * mirror, def.y, def.z);
    mcp.rotation.y = def.spread * mirror;
    palmGroup.add(mcp);

    const seg1 = new THREE.Mesh(makeOrganicPhalanx(def.r[0], def.r[1], def.len[0], false), skinMat);
    seg1.castShadow = true;
    seg1.receiveShadow = true;
    mcp.add(seg1);

    const pip = new THREE.Group();
    pip.position.set(0, 0, def.len[0]);
    mcp.add(pip);

    const seg2 = new THREE.Mesh(makeOrganicPhalanx(def.r[1], def.r[2], def.len[1], false), skinMat);
    seg2.castShadow = true;
    seg2.receiveShadow = true;
    pip.add(seg2);

    const dip = new THREE.Group();
    dip.position.set(0, 0, def.len[1]);
    pip.add(dip);

    const seg3 = new THREE.Mesh(makeOrganicPhalanx(def.r[2], def.r[3], def.len[2], true), skinMat);
    seg3.castShadow = true;
    seg3.receiveShadow = true;
    dip.add(seg3);

    const nail = new THREE.Mesh(
      new THREE.SphereGeometry(def.r[3] * 0.90, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48),
      nailMat
    );
    nail.scale.set(0.84, 0.30, 1.38);
    nail.position.set(0, def.r[3] * 0.68, def.len[2] * 0.62);
    dip.add(nail);

    fingers[def.name] = { mcp, pip, dip, baseSpread: def.spread * mirror };
  }

  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.36 * mirror, -0.05, 0.38);
  thumbBase.rotation.set(0.24, -0.32 * mirror, 0.54 * mirror);
  palmGroup.add(thumbBase);

  const tSeg1 = new THREE.Mesh(makeOrganicPhalanx(0.125, 0.104, 0.35, false), skinMat);
  tSeg1.castShadow = true;
  thumbBase.add(tSeg1);

  const thumbIp = new THREE.Group();
  thumbIp.position.set(0, 0, 0.35);
  thumbBase.add(thumbIp);

  const tSeg2 = new THREE.Mesh(makeOrganicPhalanx(0.104, 0.080, 0.27, true), skinMat);
  tSeg2.castShadow = true;
  thumbIp.add(tSeg2);

  const tNail = new THREE.Mesh(
    new THREE.SphereGeometry(0.076, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48),
    nailMat
  );
  tNail.scale.set(0.88, 0.30, 1.38);
  tNail.position.set(0, 0.056, 0.17);
  thumbIp.add(tNail);

  fingers.thumb = { base: thumbBase, ip: thumbIp };

  // --- Wooden Lacquered Chopsticks (塗り箸) gripping cleanly horizontally across the mochi sides! ---
  let chopsticks = null;
  if (hasChopsticks) {
    chopsticks = new THREE.Group();
    const stickMat = new THREE.MeshPhysicalMaterial({
      color: 0x35190d,
      roughness: 0.26,
      clearcoat: 0.55,
    });
    const stickGeo = new THREE.CylinderGeometry(0.020, 0.042, 2.20, 10);
    stickGeo.rotateX(Math.PI / 2);

    const stickLeft = new THREE.Mesh(stickGeo, stickMat);
    stickLeft.position.set(-0.32 * mirror, -0.14, 1.08);
    stickLeft.rotation.set(0.14, 0.14 * mirror, 0);
    stickLeft.castShadow = true;

    const stickRight = new THREE.Mesh(stickGeo, stickMat);
    stickRight.position.set(-0.02 * mirror, -0.18, 1.08);
    stickRight.rotation.set(0.14, -0.14 * mirror, 0);
    stickRight.castShadow = true;

    chopsticks.add(stickLeft, stickRight);
    chopsticks.visible = false;
    palmGroup.add(chopsticks);
    chopsticks.userData = { stickLeft, stickRight };
  }

  function setPose(poseName = 'relaxed', amount = 1.0) {
    const fList = [fingers.index, fingers.middle, fingers.ring, fingers.pinky];
    if (poseName === 'pinch') {
      fingers.index.mcp.rotation.x = 0.62 * amount;
      fingers.index.pip.rotation.x = 0.70 * amount;
      fingers.index.dip.rotation.x = 0.36 * amount;
      fingers.middle.mcp.rotation.x = 0.70 * amount;
      fingers.middle.pip.rotation.x = 0.72 * amount;
      fingers.middle.dip.rotation.x = 0.38 * amount;
      fingers.ring.mcp.rotation.x = 0.88 * amount;
      fingers.ring.pip.rotation.x = 0.92 * amount;
      fingers.ring.dip.rotation.x = 0.45 * amount;
      fingers.pinky.mcp.rotation.x = 0.96 * amount;
      fingers.pinky.pip.rotation.x = 0.96 * amount;
      fingers.pinky.dip.rotation.x = 0.45 * amount;
      fingers.thumb.base.rotation.set(0.46 * amount, (-0.20 - 0.08 * amount) * mirror, (0.72 * amount) * mirror);
      fingers.thumb.ip.rotation.x = 0.34 * amount;
    } else if (poseName === 'cup') {
      fList.forEach((f, idx) => {
        const c = (0.42 + idx * 0.06) * amount;
        f.mcp.rotation.x = c;
        f.pip.rotation.x = c * 1.12;
        f.dip.rotation.x = c * 0.62;
      });
      fingers.thumb.base.rotation.set(0.30, -0.28 * mirror, 0.56 * mirror);
      fingers.thumb.ip.rotation.x = 0.24;
    } else if (poseName === 'chopsticks') {
      fingers.index.mcp.rotation.x = 0.44;
      fingers.index.pip.rotation.x = 0.50;
      fingers.index.dip.rotation.x = 0.24;
      fingers.middle.mcp.rotation.x = 0.54;
      fingers.middle.pip.rotation.x = 0.58;
      fingers.middle.dip.rotation.x = 0.26;
      fingers.ring.mcp.rotation.x = 0.86;
      fingers.ring.pip.rotation.x = 0.92;
      fingers.ring.dip.rotation.x = 0.45;
      fingers.pinky.mcp.rotation.x = 0.96;
      fingers.pinky.pip.rotation.x = 0.96;
      fingers.pinky.dip.rotation.x = 0.45;
      fingers.thumb.base.rotation.set(0.36, -0.24 * mirror, 0.62 * mirror);
      fingers.thumb.ip.rotation.x = 0.20;
      if (chopsticks) {
        chopsticks.visible = true;
        // Gently pinch tips around the mochi
        chopsticks.userData.stickLeft.rotation.y = (0.16 - amount * 0.08) * mirror;
        chopsticks.userData.stickRight.rotation.y = (-0.16 + amount * 0.08) * mirror;
      }
    } else if (poseName === 'open') {
      fList.forEach((f, idx) => {
        f.mcp.rotation.x = 0.16 + idx * 0.03;
        f.pip.rotation.x = 0.18 + idx * 0.04;
        f.dip.rotation.x = 0.10;
      });
      fingers.thumb.base.rotation.set(0.18, -0.38 * mirror, 0.42 * mirror);
      fingers.thumb.ip.rotation.x = 0.12;
    } else {
      fList.forEach((f, idx) => {
        const c = 0.36 + idx * 0.07;
        f.mcp.rotation.x = c;
        f.pip.rotation.x = c * 1.08;
        f.dip.rotation.x = c * 0.58;
      });
      fingers.thumb.base.rotation.set(0.28, -0.32 * mirror, 0.52 * mirror);
      fingers.thumb.ip.rotation.x = 0.22;
    }
    if (chopsticks && poseName !== 'chopsticks') {
      chopsticks.visible = false;
    }
  }

  setPose('relaxed');

  return {
    root,
    wristPivot,
    palmGroup,
    fingers,
    chopsticks,
    sleeveMat,
    setPose,
  };
}

// --- Family Ensemble Controller (家族の手が複数フレームに入る群像構図) ---
export class FamilyHandsEnsemble {
  constructor(scene) {
    this.scene = scene;

    // 1. Child Player's Hands (Foreground Bottom — clear of both board & soy/nori!)
    this.childRight = createRealisticHand({
      side: 'right',
      scale: 0.78,
      skinSeed: 911,
      skinRGB: [222, 174, 148],
      sleeveBase: '#dec8bb',
      sleeveAccent: '#c4a493',
      sleevePattern: 'knit',
      sleeveLength: 6.2,
    });
    this.childRight.root.position.set(0.18, 0.34, 3.92);
    this.childRight.root.rotation.set(0.12, Math.PI + 0.14, 0.05);
    scene.add(this.childRight.root);

    this.childLeft = createRealisticHand({
      side: 'left',
      scale: 0.78,
      skinSeed: 917,
      skinRGB: [222, 174, 148],
      sleeveBase: '#dec8bb',
      sleeveAccent: '#c4a493',
      sleevePattern: 'knit',
      sleeveLength: 6.2,
    });
    this.childLeft.root.position.set(-2.12, 0.34, 3.86);
    this.childLeft.root.rotation.set(0.12, Math.PI - 0.16, -0.05);
    scene.add(this.childLeft.root);

    this.childTargetR = this.childRight.root.position.clone();
    this.childTargetL = this.childLeft.root.position.clone();
    this.childRotR = this.childRight.root.rotation.clone();
    this.childRotL = this.childLeft.root.rotation.clone();

    // 2. Grandma (Left side of table — warm indigo kasuri hanten sleeve entering cleanly from left edge!)
    this.grandma = {
      id: 'grandma',
      mainHand: createRealisticHand({
        side: 'right',
        scale: 0.88,
        skinSeed: 925,
        skinRGB: [204, 155, 126],
        sleeveBase: '#233447',
        sleeveAccent: '#63758a',
        sleevePattern: 'kasuri',
        hasChopsticks: true,
        sleeveLength: 6.8,
      }),
      helperHand: createRealisticHand({
        side: 'left',
        scale: 0.88,
        skinSeed: 928,
        skinRGB: [204, 155, 126],
        sleeveBase: '#233447',
        sleeveAccent: '#63758a',
        sleevePattern: 'kasuri',
        sleeveLength: 6.8,
      }),
      restMainPos: new THREE.Vector3(-4.52, 0.25, 1.56),
      restMainRot: new THREE.Euler(0.12, 1.24, -0.04),
      restHelpPos: new THREE.Vector3(-4.26, 0.25, -0.26),
      restHelpRot: new THREE.Euler(0.12, 1.78, 0.04),
      state: 'idle',
      stateTimer: 0,
      bracingBoard: false,
      beckonTimer: 0,
      servedMochi: null,
      servedPlatePos: null,
    };
    this.grandma.mainHand.root.position.copy(this.grandma.restMainPos);
    this.grandma.mainHand.root.rotation.copy(this.grandma.restMainRot);
    this.grandma.helperHand.root.position.copy(this.grandma.restHelpPos);
    this.grandma.helperHand.root.rotation.copy(this.grandma.restHelpRot);
    scene.add(this.grandma.mainHand.root, this.grandma.helperHand.root);

    // 3. Dad (Top-Left across table — charcoal-brown knit sleeves with natural wrist dorsiflexion!)
    this.dad = {
      id: 'dad',
      mainHand: createRealisticHand({
        side: 'right',
        scale: 0.92,
        skinSeed: 937,
        skinRGB: [194, 144, 114],
        sleeveBase: '#3b322c',
        sleeveAccent: '#564a42',
        sleevePattern: 'knit',
        hasChopsticks: true,
        sleeveLength: 8.2,
        wristBend: 0.38,
      }),
      helperHand: createRealisticHand({
        side: 'left',
        scale: 0.92,
        skinSeed: 941,
        skinRGB: [194, 144, 114],
        sleeveBase: '#3b322c',
        sleeveAccent: '#564a42',
        sleevePattern: 'knit',
        sleeveLength: 8.2,
        wristBend: 0.38,
      }),
      // Palms rest flat & naturally on tabletop (rotX = 0.08) while forearms slope gracefully out top edge,
      // shoulder-width apart (never converging into a V!)
      restMainPos: new THREE.Vector3(-2.82, 0.27, -2.56),
      restMainRot: new THREE.Euler(0.08, 0.06, -0.04),
      restHelpPos: new THREE.Vector3(-1.02, 0.27, -2.66),
      restHelpRot: new THREE.Euler(0.08, -0.04, 0.04),
      state: 'idle',
      stateTimer: 0,
      beckonTimer: 0,
      fanTimer: 0,
      servedMochi: null,
      servedPlatePos: null,
    };
    this.dad.mainHand.root.position.copy(this.dad.restMainPos);
    this.dad.mainHand.root.rotation.copy(this.dad.restMainRot);
    this.dad.helperHand.root.position.copy(this.dad.restHelpPos);
    this.dad.helperHand.root.rotation.copy(this.dad.restHelpRot);
    scene.add(this.dad.mainHand.root, this.dad.helperHand.root);

    // 4. Mom (Top-Right across table — sage-olive linen sleeves with natural wrist dorsiflexion!)
    this.mom = {
      id: 'mom',
      mainHand: createRealisticHand({
        side: 'right',
        scale: 0.86,
        skinSeed: 949,
        skinRGB: [216, 166, 138],
        sleeveBase: '#6f7c66',
        sleeveAccent: '#9da994',
        sleevePattern: 'linen',
        hasChopsticks: true,
        sleeveLength: 8.2,
        wristBend: 0.38,
      }),
      helperHand: createRealisticHand({
        side: 'left',
        scale: 0.86,
        skinSeed: 953,
        skinRGB: [216, 166, 138],
        sleeveBase: '#6f7c66',
        sleeveAccent: '#9da994',
        sleevePattern: 'linen',
        sleeveLength: 8.2,
        wristBend: 0.38,
      }),
      restMainPos: new THREE.Vector3(0.78, 0.27, -2.64),
      restMainRot: new THREE.Euler(0.08, 0.04, -0.04),
      restHelpPos: new THREE.Vector3(2.54, 0.27, -2.44),
      restHelpRot: new THREE.Euler(0.08, -0.08, 0.05),
      state: 'idle',
      stateTimer: 0,
      beckonTimer: 0,
      hintTimer: 0,
      hintMode: 'mound',
      servedMochi: null,
      servedPlatePos: null,
    };
    this.mom.mainHand.root.position.copy(this.mom.restMainPos);
    this.mom.mainHand.root.rotation.copy(this.mom.restMainRot);
    this.mom.helperHand.root.position.copy(this.mom.restHelpPos);
    this.mom.helperHand.root.rotation.copy(this.mom.restHelpRot);
    scene.add(this.mom.mainHand.root, this.mom.helperHand.root);

    this.members = [this.grandma, this.dad, this.mom];
    this.celebrationTimer = 0;
  }

  getMember(id) {
    return this.members.find((m) => m.id === id);
  }

  setBoardBracing(bracing) {
    this.grandma.bracingBoard = bracing;
  }

  triggerBeckon(id) {
    const m = this.getMember(id);
    if (m && m.state === 'idle') m.beckonTimer = 1.2;
  }

  triggerKinakoFan() {
    if (this.mom.state === 'idle') this.mom.fanTimer = 1.5;
    if (this.dad.state === 'idle') this.dad.fanTimer = 1.2;
  }

  triggerIdleHint(mode = 'mound') {
    if (this.mom.state === 'idle') {
      this.mom.hintTimer = 2.4;
      this.mom.hintMode = mode;
    }
  }

  triggerCelebration() {
    this.celebrationTimer = 2.8;
  }

  triggerServeReaction(id, mochiPiece, plateWorldPos, onBridgeUpdate) {
    const m = this.getMember(id);
    if (!m) return;
    m.state = 'enjoy';
    m.stateTimer = 0;
    m.servedMochi = mochiPiece;
    m.servedPlatePos = plateWorldPos.clone();
    m.onBridgeUpdate = onBridgeUpdate || null;
  }

  setChildPose(mode, worldPos = null, rollPhase = 0) {
    if (mode === 'stretch' && worldPos) {
      // Pinching right onto the right-front flank of the pulled mochi while keeping the stretched bridge 100% open!
      this.childTargetR.set(worldPos.x + 0.54, worldPos.y + 0.16, worldPos.z + 0.80);
      this.childRotR.set(0.16, Math.PI + 0.42, 0.22);
      this.childRight.setPose('pinch', 1.0);

      this.childTargetL.set(-2.36, BOARD_Y + 0.24, 2.58);
      this.childRotL.set(0.12, Math.PI - 0.34, -0.06);
      this.childLeft.setPose('open', 1.0);
    } else if (mode === 'roll' && worldPos) {
      const ox = Math.cos(rollPhase) * 0.18;
      const oz = Math.sin(rollPhase) * 0.12;
      const pat = Math.abs(Math.sin(rollPhase * 1.5)) * 0.12;
      this.childTargetR.set(worldPos.x + 0.78 + ox, worldPos.y + 0.26 + pat, worldPos.z + 0.84 + oz);
      this.childRotR.set(0.20, Math.PI + 0.48, 0.22);
      this.childRight.setPose('cup', 1.0);

      this.childTargetL.set(worldPos.x - 0.78 - ox, worldPos.y + 0.26 + (0.12 - pat), worldPos.z + 0.86 - oz);
      this.childRotL.set(0.20, Math.PI - 0.48, -0.22);
      this.childLeft.setPose('cup', 1.0);
    } else if (mode === 'carry' && worldPos) {
      this.childTargetR.set(worldPos.x + 0.44, worldPos.y + 0.34, worldPos.z + 0.98);
      this.childRotR.set(0.18, Math.PI + 0.24, 0.16);
      this.childRight.setPose('cup', 0.9);

      this.childTargetL.set(-2.12, 0.34, 3.86);
      this.childRotL.set(0.12, Math.PI - 0.16, -0.05);
      this.childLeft.setPose('relaxed');
    } else {
      this.childTargetR.set(0.18, 0.34, 3.92);
      this.childRotR.set(0.12, Math.PI + 0.14, 0.05);
      this.childRight.setPose('relaxed');

      this.childTargetL.set(-2.12, 0.34, 3.86);
      this.childRotL.set(0.12, Math.PI - 0.16, -0.05);
      this.childLeft.setPose('relaxed');
    }
  }

  update(dt, time) {
    const smooth = Math.min(1, dt * 11.0);
    const breath = Math.sin(time * 1.9) * 0.016;

    this.childRight.root.position.lerp(this.childTargetR, smooth);
    this.childRight.root.position.y += breath * 0.5;
    this.childRight.root.rotation.x += (this.childRotR.x - this.childRight.root.rotation.x) * smooth;
    this.childRight.root.rotation.y += (this.childRotR.y - this.childRight.root.rotation.y) * smooth;
    this.childRight.root.rotation.z += (this.childRotR.z - this.childRight.root.rotation.z) * smooth;

    this.childLeft.root.position.lerp(this.childTargetL, smooth);
    this.childLeft.root.position.y += breath * 0.5;
    this.childLeft.root.rotation.x += (this.childRotL.x - this.childLeft.root.rotation.x) * smooth;
    this.childLeft.root.rotation.y += (this.childRotL.y - this.childLeft.root.rotation.y) * smooth;
    this.childLeft.root.rotation.z += (this.childRotL.z - this.childLeft.root.rotation.z) * smooth;

    if (this.celebrationTimer > 0) {
      this.celebrationTimer = Math.max(0, this.celebrationTimer - dt);
    }

    this.members.forEach((m, idx) => {
      const mSmooth = Math.min(1, dt * 7.5);
      const tMain = m.restMainPos.clone();
      const tHelp = m.restHelpPos.clone();
      const rMain = m.restMainRot.clone();
      const rHelp = m.restHelpRot.clone();

      const ph = idx * 2.1;
      tMain.y += Math.sin(time * 1.6 + ph) * 0.016;
      tHelp.y += Math.cos(time * 1.5 + ph) * 0.015;

      if (m.state === 'enjoy' && m.servedPlatePos) {
        m.stateTimer += dt;
        const t = m.stateTimer;
        const p = m.servedPlatePos;
        const inward = m.id === 'grandma' ? new THREE.Vector3(-1.35, 0, 0.25) : new THREE.Vector3(-0.42, 0, -1.48);

        if (t < 0.7) {
          const u = t / 0.7;
          const ease = u * u * (3 - 2 * u);
          tMain.lerp(new THREE.Vector3(p.x + inward.x, p.y + 0.58, p.z + inward.z), ease);
          rMain.x = 0.16;
          rMain.y = m.id === 'grandma' ? 1.38 : 0.12;
          m.mainHand.setPose('chopsticks', 0.35 + ease * 0.65);
          tHelp.y += 0.12 * ease;
          m.helperHand.setPose('open');
        } else if (t < 2.0) {
          const u = (t - 0.7) / 1.3;
          const lift = Math.sin(u * Math.PI);
          tMain.set(p.x + inward.x, p.y + 0.58 + lift * 0.58, p.z + inward.z);
          rMain.x = 0.12 - lift * 0.08;
          rMain.y = m.id === 'grandma' ? 1.38 : 0.12;
          m.mainHand.setPose('chopsticks', 1.0);

          if (m.servedMochi) {
            const liftY = p.y + 0.09 + lift * 0.48;
            m.servedMochi.group.position.set(p.x, liftY, p.z);
            if (m.onBridgeUpdate) {
              m.onBridgeUpdate(
                new THREE.Vector3(p.x, p.y + 0.12, p.z),
                new THREE.Vector3(p.x, liftY + 0.12, p.z),
                lift * 0.62,
                m.servedMochi.kinakoAmount
              );
            }
          }
          tHelp.y += 0.16 + Math.abs(Math.sin(t * 9.0)) * 0.14;
          m.helperHand.setPose('open');
        } else if (t < 3.1) {
          if (m.servedMochi) {
            m.servedMochi.group.position.set(p.x, p.y + 0.09, p.z);
            if (m.onBridgeUpdate) m.onBridgeUpdate(null);
          }
          const clap = Math.abs(Math.sin((t - 2.0) * 12.0));
          const mid = tMain.clone().lerp(tHelp, 0.5);
          mid.y += 0.36;
          tMain.lerp(mid, 0.42 - clap * 0.18);
          tHelp.lerp(mid, 0.42 - clap * 0.18);
          rMain.z = -0.46;
          rHelp.z = 0.46;
          rMain.y = m.restMainRot.y + 0.06;
          rHelp.y = m.restHelpRot.y - 0.06;
          m.mainHand.setPose('open');
          m.helperHand.setPose('open');
        } else {
          m.state = 'idle';
          m.servedMochi = null;
          if (m.onBridgeUpdate) m.onBridgeUpdate(null);
          m.mainHand.setPose('relaxed');
          m.helperHand.setPose('relaxed');
        }
      } else if (this.celebrationTimer > 0) {
        const clap = Math.abs(Math.sin(time * 11.5 + ph));
        const mid = tMain.clone().lerp(tHelp, 0.5);
        mid.y += 0.36;
        tMain.lerp(mid, 0.40 - clap * 0.16);
        tHelp.lerp(mid, 0.40 - clap * 0.16);
        rMain.z = -0.44;
        rHelp.z = 0.44;
        rMain.y = m.restMainRot.y + 0.06;
        rHelp.y = m.restHelpRot.y - 0.06;
        m.mainHand.setPose('open');
        m.helperHand.setPose('open');
      } else {
        m.mainHand.setPose('relaxed');
        m.helperHand.setPose('relaxed');

        if (m.id === 'grandma' && m.bracingBoard) {
          tHelp.set(-2.90, BOARD_Y + 0.18, -0.18);
          rHelp.set(0.12, 1.56, 0.05);
          m.helperHand.setPose('open');
        }

        if (m.fanTimer > 0) {
          m.fanTimer = Math.max(0, m.fanTimer - dt);
          const wave = Math.sin(time * 14.0 + ph);
          tHelp.y += 0.42;
          tHelp.z += 0.28;
          rHelp.z += wave * 0.38;
          rHelp.x = -0.10;
          m.helperHand.setPose('open');
        }

        if (m.beckonTimer > 0) {
          m.beckonTimer = Math.max(0, m.beckonTimer - dt);
          const w = Math.sin(time * 11.0);
          tMain.y += 0.22 + Math.abs(w) * 0.12;
          rMain.x = 0.20 + w * 0.18;
          m.mainHand.setPose('open');
        }

        if (m.id === 'mom' && m.hintTimer > 0) {
          m.hintTimer = Math.max(0, m.hintTimer - dt);
          const u = Math.sin((m.hintTimer / 2.4) * Math.PI);
          if (m.hintMode === 'mound') {
            tMain.lerp(new THREE.Vector3(-0.90, BOARD_Y + 0.50, -0.40), u * 0.85);
            rMain.x = 0.22;
            m.mainHand.setPose('pinch', u * 0.7);
          } else {
            tMain.lerp(new THREE.Vector3(1.50, 0.36 + Math.abs(Math.sin(time * 8)) * 0.16, -2.05), u * 0.8);
            m.mainHand.setPose('open');
          }
        }
      }

      m.mainHand.root.position.lerp(tMain, mSmooth);
      m.mainHand.root.rotation.x += (rMain.x - m.mainHand.root.rotation.x) * mSmooth;
      m.mainHand.root.rotation.y += (rMain.y - m.mainHand.root.rotation.y) * mSmooth;
      m.mainHand.root.rotation.z += (rMain.z - m.mainHand.root.rotation.z) * mSmooth;

      m.helperHand.root.position.lerp(tHelp, mSmooth);
      m.helperHand.root.rotation.x += (rHelp.x - m.helperHand.root.rotation.x) * mSmooth;
      m.helperHand.root.rotation.y += (rHelp.y - m.helperHand.root.rotation.y) * mSmooth;
      m.helperHand.root.rotation.z += (rHelp.z - m.helperHand.root.rotation.z) * mSmooth;
    });
  }
}
