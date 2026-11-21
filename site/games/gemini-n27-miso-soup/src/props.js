import * as THREE from 'three';
import {
  sculptClay,
  createPlumpBoxGeometry,
  makeClayMaterial,
  makeGlossClayMaterial,
  ClaySpring,
  applySquash,
} from './clay.js';

/**
 * Creates a single plump white clay tofu cube (used both on the palm & floating in soup/bowls)
 */
export function createTofuCubeMesh(size = 0.34, seed = 301) {
  const geo = createPlumpBoxGeometry(size, size * 0.86, size, size * 0.24, 3);
  sculptClay(geo, size * 0.025, 6.0, seed);
  const mat = makeGlossClayMaterial(0xfffdf6, {
    roughness: 0.34,
    clearcoat: 0.32,
    bumpScale: 0.008,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates a wavy, ruffled emerald clay wakame leaf (starts curled small, scales up to bloom!)
 */
export function createWakameLeafMesh(seed = 401) {
  const group = new THREE.Group();
  const mat = makeGlossClayMaterial(0x1f6e43, {
    roughness: 0.36,
    clearcoat: 0.42,
    bumpScale: 0.012,
  });
  const matLight = makeGlossClayMaterial(0x2e8c56, {
    roughness: 0.34,
    clearcoat: 0.44,
    bumpScale: 0.01,
  });

  // 3 plump undulating lobes joined together like real soft wakame
  const lobes = [
    { x: 0, z: 0, rx: 0.26, rz: 0.14, ry: 0.045, rotY: 0.1, mat },
    { x: 0.16, z: 0.08, rx: 0.19, rz: 0.12, ry: 0.04, rotY: 0.75, mat: matLight },
    { x: -0.15, z: -0.06, rx: 0.18, rz: 0.11, ry: 0.04, rotY: -0.6, mat: matLight },
  ];
  lobes.forEach((l, i) => {
    const g = new THREE.SphereGeometry(1, 10, 8);
    g.scale(l.rx, l.ry, l.rz);
    sculptClay(g, 0.018, 8.0, seed + i * 7);
    const m = new THREE.Mesh(g, l.mat);
    m.position.set(l.x, 0, l.z);
    m.rotation.y = l.rotY;
    m.rotation.z = (i - 1) * 0.18;
    m.castShadow = true;
    group.add(m);
  });
  return group;
}

/**
 * Stage 0: Sky-blue glazed clay Water Pitcher + pouring ribbon stream
 */
export class ClayWaterPitcher {
  constructor(scene) {
    this.homePos = new THREE.Vector3(-2.32, 0.0, 0.52);
    this.group = new THREE.Group();
    this.group.position.copy(this.homePos);
    scene.add(this.group);

    this.spring = new ClaySpring(190, 11);
    this.isPouring = false;
    this.pourTilt = 0;
    this.visibleAmount = 1;

    // Plump pitcher body
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.54, 0.0),
      new THREE.Vector2(0.66, 0.36),
      new THREE.Vector2(0.60, 0.90),
      new THREE.Vector2(0.47, 1.28),
      new THREE.Vector2(0.53, 1.44),
      new THREE.Vector2(0.44, 1.46),
      new THREE.Vector2(0.39, 1.28),
    ];
    const bodyGeo = new THREE.LatheGeometry(pts, 26);
    sculptClay(bodyGeo, 0.014, 3.0, 310);
    const pitcherMat = makeGlossClayMaterial(0x5eb8e4, {
      roughness: 0.28,
      clearcoat: 0.55,
      bumpScale: 0.012,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeo, pitcherMat);
    body.rotation.y = Math.PI;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.interactId = 'pitcher';
    this.group.add(body);

    // Cute white clay polka band around the middle
    const bandGeo = new THREE.TorusGeometry(0.63, 0.055, 8, 24);
    sculptClay(bandGeo, 0.008, 4.0, 311);
    const band = new THREE.Mesh(bandGeo, makeClayMaterial(0xf7f2e7, { roughness: 0.62 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.62;
    band.userData.interactId = 'pitcher';
    this.group.add(band);

    // Soft rounded clay pouring lip pointing cleanly outward right (toward the pot!)
    const spoutGeo = new THREE.CapsuleGeometry(0.125, 0.2, 8, 12);
    sculptClay(spoutGeo, 0.008, 4.0, 312);
    const spout = new THREE.Mesh(spoutGeo, pitcherMat);
    spout.position.set(0.57, 1.38, 0);
    spout.rotation.z = -Math.PI * 0.4;
    spout.scale.set(0.95, 1.0, 0.72);
    spout.userData.interactId = 'pitcher';
    this.group.add(spout);

    // Chunky clay handle on the left
    const handleGeo = new THREE.TorusGeometry(0.38, 0.095, 10, 20, Math.PI * 1.15);
    sculptClay(handleGeo, 0.012, 4.0, 313);
    const handle = new THREE.Mesh(handleGeo, makeGlossClayMaterial(0x499ec9, { roughness: 0.34 }));
    handle.position.set(-0.56, 0.85, 0);
    handle.rotation.z = Math.PI * 0.45;
    handle.castShadow = true;
    handle.userData.interactId = 'pitcher';
    this.group.add(handle);

    // Visible shimmering aqua water inside top of pitcher!
    const topWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 20),
      makeGlossClayMaterial(0x9beeff, { roughness: 0.1, clearcoat: 0.9 })
    );
    topWater.rotation.x = -Math.PI / 2;
    topWater.position.y = 1.32;
    topWater.userData.interactId = 'pitcher';
    this.group.add(topWater);

    // Animated chunky clay water pouring stream (world space child of scene)
    this.streamGroup = new THREE.Group();
    this.streamGroup.visible = false;
    scene.add(this.streamGroup);
    const streamMat = makeGlossClayMaterial(0x88e6fa, {
      roughness: 0.1,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    this.streamBeads = [];
    for (let i = 0; i < 11; i++) {
      const m = new THREE.Mesh(
        sculptClay(new THREE.SphereGeometry(0.11, 10, 8), 0.01, 5.0, 320 + i),
        streamMat
      );
      this.streamGroup.add(m);
      this.streamBeads.push(m);
    }
  }

  getSpoutWorldPos(target = new THREE.Vector3()) {
    target.set(0.68, 1.44, 0);
    return this.group.localToWorld(target);
  }

  update(dt, time, liquidWorldY) {
    const sq = this.spring.step(dt);
    applySquash(this.group, sq * 0.1, this.visibleAmount);

    const targetTilt = this.isPouring ? -0.92 : 0;
    this.pourTilt += (targetTilt - this.pourTilt) * Math.min(1, dt * 10);
    this.group.rotation.z = this.pourTilt;

    if (this.isPouring && this.visibleAmount > 0.5) {
      this.streamGroup.visible = true;
      const start = this.getSpoutWorldPos();
      const end = new THREE.Vector3(
        Math.min(0.45, Math.max(-0.45, start.x + 0.32)),
        liquidWorldY,
        Math.min(0.45, Math.max(-0.45, start.z))
      );
      for (let i = 0; i < this.streamBeads.length; i++) {
        const t = ((i / this.streamBeads.length) + time * 2.6) % 1;
        const x = start.x + (end.x - start.x) * t;
        const z = start.z + (end.z - start.z) * t;
        const y = start.y * (1 - t * t) + end.y * (t * t);
        const bead = this.streamBeads[i];
        bead.position.set(x, y, z);
        const wobble = 0.85 + Math.sin(time * 18 + i) * 0.2;
        bead.scale.set(0.75 * wobble, 1.35, 0.75 * wobble);
      }
    } else {
      this.streamGroup.visible = false;
    }
  }
}

/**
 * Stage 0: Wooden clay Dashi Tray holding plump folded dark-green Kombu + golden Dashi bonito pack
 */
export class ClayDashiProp {
  constructor(scene) {
    this.homePos = new THREE.Vector3(2.26, 0.0, 0.52);
    this.trayGroup = new THREE.Group();
    this.trayGroup.position.copy(this.homePos);
    scene.add(this.trayGroup);

    // Warm ceramic-wood saucer with chunky rolled clay rim
    const dishGeo = new THREE.CylinderGeometry(0.8, 0.66, 0.16, 22);
    sculptClay(dishGeo, 0.015, 3.0, 340);
    const dishMat = makeClayMaterial(0xe7c99b, { roughness: 0.72 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.y = 0.08;
    dish.castShadow = true;
    dish.receiveShadow = true;
    dish.userData.interactId = 'dashi';
    this.trayGroup.add(dish);

    const dishRim = new THREE.Mesh(
      sculptClay(new THREE.TorusGeometry(0.78, 0.07, 8, 24), 0.01, 4.0, 349),
      makeClayMaterial(0xdcb782, { roughness: 0.74 })
    );
    dishRim.rotation.x = Math.PI / 2;
    dishRim.position.y = 0.16;
    dishRim.userData.interactId = 'dashi';
    this.trayGroup.add(dishRim);

    // Draggable dashi bundle (plump dark-green kombu ribbon + golden bonito pouch!)
    this.bundleHomePos = new THREE.Vector3(2.26, 0.22, 0.52);
    this.bundle = new THREE.Group();
    this.bundle.position.copy(this.bundleHomePos);
    scene.add(this.bundle);

    this.spring = new ClaySpring(190, 11);
    this.dropped = false;

    // Glossy deep-green folded clay Kombu (昆布)
    const kombuMat = makeGlossClayMaterial(0x1f4f32, { roughness: 0.34, clearcoat: 0.42 });
    const k1 = new THREE.Mesh(
      sculptClay(createPlumpBoxGeometry(0.78, 0.12, 0.44, 0.05, 3), 0.016, 5.0, 341),
      kombuMat
    );
    k1.position.set(-0.08, 0.07, 0.06);
    k1.rotation.y = 0.25;
    k1.castShadow = true;
    k1.userData.interactId = 'dashi';
    this.bundle.add(k1);

    const k2 = new THREE.Mesh(
      sculptClay(createPlumpBoxGeometry(0.62, 0.1, 0.34, 0.04, 3), 0.014, 5.2, 342),
      kombuMat
    );
    k2.position.set(0.08, 0.15, -0.04);
    k2.rotation.y = -0.35;
    k2.rotation.z = 0.08;
    k2.castShadow = true;
    k2.userData.interactId = 'dashi';
    this.bundle.add(k2);

    // Plump golden-amber bonito flakes / dashi cushion perched on top (tells "golden dashi!" visually)
    const bonitoMat = makeClayMaterial(0xf3ba54, { roughness: 0.62, emissive: 0xd98a1a, emissiveIntensity: 0.12 });
    const flakeOffsets = [
      [0.14, 0.25, 0.1, 0.3, 0.22],
      [-0.12, 0.27, 0.04, 0.28, -0.35],
      [0.02, 0.31, -0.08, 0.26, 0.55],
      [0.18, 0.24, -0.1, 0.22, -0.2],
      [-0.18, 0.23, 0.12, 0.23, 0.8],
    ];
    flakeOffsets.forEach(([x, y, z, r, rot], i) => {
      const fGeo = new THREE.SphereGeometry(r, 10, 8);
      fGeo.scale(1.15, 0.42, 0.85);
      sculptClay(fGeo, 0.018, 6.0, 345 + i);
      const fm = new THREE.Mesh(fGeo, bonitoMat);
      fm.position.set(x, y, z);
      fm.rotation.y = rot;
      fm.castShadow = true;
      fm.userData.interactId = 'dashi';
      this.bundle.add(fm);
    });
  }

  createFloatingKombuCopy() {
    const g = new THREE.Group();
    const mat = makeGlossClayMaterial(0x1f5636, { roughness: 0.3, clearcoat: 0.45 });
    const leaf = new THREE.Mesh(
      sculptClay(createPlumpBoxGeometry(0.75, 0.09, 0.4, 0.04, 3), 0.018, 5.0, 351),
      mat
    );
    g.add(leaf);
    return g;
  }

  reset() {
    this.dropped = false;
    this.bundle.visible = true;
    this.bundle.position.copy(this.bundleHomePos);
    this.bundle.rotation.set(0, 0, 0);
    this.bundle.scale.setScalar(1);
    this.trayGroup.visible = true;
    this.trayGroup.scale.setScalar(1);
  }

  update(dt) {
    const sq = this.spring.step(dt);
    if (!this.dropped && this.bundle.visible) {
      applySquash(this.bundle, sq * 0.1, 1);
    }
  }
}

/**
 * Stage 1: Giant Plump Clay Left Hand cradling a 3x3 jiggly snowy-white Tofu Block + Kid-Friendly Clay Knife
 */
export class ClayTofuPalmStage {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    // Big warm peach-clay left hand + forearm entering smoothly from left
    this.handGroup = new THREE.Group();
    this.handGroup.position.set(-4.5, 2.08, 0.35);
    this.root.add(this.handGroup);

    const skinMat = makeClayMaterial(0xf8cfb4, { roughness: 0.72, bumpScale: 0.014 });
    const sleeveMat = makeClayMaterial(0xea937d, { roughness: 0.82 });

    // Seamless rounded clay wrist & plump cozy rolled sleeve cuff (zero sharp edges!)
    const wristGeo = new THREE.CapsuleGeometry(0.40, 0.95, 10, 14);
    sculptClay(wristGeo, 0.016, 2.4, 410);
    const wrist = new THREE.Mesh(wristGeo, skinMat);
    wrist.rotation.z = Math.PI / 2;
    wrist.scale.set(0.72, 1.0, 1.08);
    wrist.position.set(-1.12, -0.14, 0.02);
    wrist.castShadow = true;
    this.handGroup.add(wrist);

    const sleeveGeo = new THREE.CapsuleGeometry(0.52, 1.3, 10, 16);
    sculptClay(sleeveGeo, 0.02, 2.2, 411);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.rotation.z = Math.PI / 2;
    sleeve.scale.set(0.84, 1.0, 1.06);
    sleeve.position.set(-2.35, -0.14, 0.02);
    sleeve.castShadow = true;
    this.handGroup.add(sleeve);

    const cuffRing = new THREE.Mesh(
      sculptClay(new THREE.TorusGeometry(0.48, 0.13, 10, 20), 0.012, 3.6, 413),
      makeClayMaterial(0xf5e8d6, { roughness: 0.8 })
    );
    cuffRing.rotation.y = Math.PI / 2;
    cuffRing.scale.set(1.06, 0.85, 1.0);
    cuffRing.position.set(-1.68, -0.14, 0.02);
    cuffRing.castShadow = true;
    this.handGroup.add(cuffRing);

    // Wide, plump, gently cupped clay palm!
    const palmGeo = new THREE.SphereGeometry(0.88, 20, 14);
    palmGeo.scale(1.18, 0.34, 1.04);
    sculptClay(palmGeo, 0.02, 2.6, 412);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0.0, -0.14, 0.0);
    palm.castShadow = true;
    palm.receiveShadow = true;
    palm.userData.interactId = 'tofuPalm';
    this.handGroup.add(palm);

    // 4 chunky rounded clay fingers extending to the right (softly cupped & tapered!)
    const fingerSpecs = [
      { z: -0.50, len: 0.66, r: 0.15, yOff: 0.04, rotY: 0.12 },
      { z: -0.17, len: 0.78, r: 0.16, yOff: 0.0, rotY: 0.03 },
      { z: 0.17, len: 0.72, r: 0.155, yOff: 0.0, rotY: -0.04 },
      { z: 0.48, len: 0.56, r: 0.138, yOff: 0.05, rotY: -0.12 },
    ];
    fingerSpecs.forEach((f, idx) => {
      const fGeo = new THREE.CapsuleGeometry(f.r, f.len, 8, 12);
      sculptClay(fGeo, 0.014, 4.0, 415 + idx);
      const fm = new THREE.Mesh(fGeo, skinMat);
      fm.rotation.z = Math.PI / 2 - 0.14;
      fm.rotation.y = f.rotY;
      fm.position.set(0.86 + f.len * 0.24, -0.06 + f.yOff, f.z);
      fm.castShadow = true;
      fm.receiveShadow = true;
      fm.userData.interactId = 'tofuPalm';
      this.handGroup.add(fm);
    });

    // Plump soft clay thumb nestled gently on the front-left rim of the palm
    const thumbGeo = new THREE.CapsuleGeometry(0.16, 0.42, 8, 12);
    sculptClay(thumbGeo, 0.012, 4.0, 420);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.rotation.z = Math.PI / 2 - 0.16;
    thumb.rotation.y = -0.52;
    thumb.position.set(0.08, -0.04, 0.78);
    thumb.castShadow = true;
    thumb.userData.interactId = 'tofuPalm';
    this.handGroup.add(thumb);

    // 3x3 Snowy-white Jiggly Clay Tofu Block sitting right on the palm!
    this.tofuGroup = new THREE.Group();
    this.tofuGroup.position.set(0.06, 0.30, 0.0);
    this.handGroup.add(this.tofuGroup);

    this.cubes = [];
    this.cubeSize = 0.38;
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const mesh = createTofuCubeMesh(this.cubeSize, 430 + (ix + 1) * 3 + (iz + 1));
        mesh.userData.interactId = 'tofu';
        this.tofuGroup.add(mesh);
        this.cubes.push({
          mesh,
          ix,
          iz,
          spring: new ClaySpring(160, 8.5),
          slideDelay: 0,
          falling: false,
          dropped: false,
          fallPos: new THREE.Vector3(),
          fallVel: new THREE.Vector3(),
        });
      }
    }

    // Subtle cut-guide seam indentation markers (only appear softly on the tofu surface as tactile ridges, zero UI!)
    this.cutsX = 0; // 0, 1, 2
    this.cutsZ = 0; // 0, 1, 2
    this.totalCuts = 0; // 0..4
    this.tiltingToDump = false;
    this.dumpProgress = 0;
    this.handTiltX = 0;
    this.handSpring = new ClaySpring(160, 10);

    // Chunky, kid-friendly rounded clay kitchen knife (包丁) clearly visible right beside the tofu!
    this.knifeGroup = new THREE.Group();
    this.knifeHomePos = new THREE.Vector3(1.52, 2.48, 0.52);
    this.knifeGroup.position.copy(this.knifeHomePos);
    this.root.add(this.knifeGroup);

    // Rounded friendly cream-silver clay blade
    const bladeGeo = createPlumpBoxGeometry(0.11, 0.42, 1.05, 0.05, 3);
    sculptClay(bladeGeo, 0.008, 5.0, 450);
    const bladeMat = makeGlossClayMaterial(0xe7ebf0, { roughness: 0.25, clearcoat: 0.55 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0, -0.35);
    blade.castShadow = true;
    blade.userData.interactId = 'knife';
    this.knifeGroup.add(blade);

    // Plump warm wooden clay handle
    const handleGeo = new THREE.CapsuleGeometry(0.125, 0.52, 8, 12);
    sculptClay(handleGeo, 0.01, 4.5, 451);
    const handle = new THREE.Mesh(handleGeo, makeClayMaterial(0xc98b52, { roughness: 0.72 }));
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.06, 0.52);
    handle.castShadow = true;
    handle.userData.interactId = 'knife';
    this.knifeGroup.add(handle);

    // Cute brass collar ring on handle
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.135, 0.135, 0.1, 14),
      makeClayMaterial(0xe9c26b, { roughness: 0.5 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.06, 0.2);
    this.knifeGroup.add(collar);

    this.knifeAnim = null; // { t, dur, axis, offset }
  }

  enter() {
    this.root.visible = true;
    this.cutsX = 0;
    this.cutsZ = 0;
    this.totalCuts = 0;
    this.tiltingToDump = false;
    this.dumpProgress = 0;
    this.handTiltX = 0;
    this.handGroup.position.set(-2.3, 1.96, 0.35);
    this.handGroup.rotation.set(0, 0, 0);
    this.knifeGroup.visible = true;
    this.knifeGroup.position.copy(this.knifeHomePos);
    this.knifeGroup.rotation.set(0, 0, 0);
    this.knifeAnim = null;

    this.cubes.forEach((c) => {
      if (c.mesh.parent !== this.tofuGroup) {
        this.tofuGroup.add(c.mesh);
      }
      c.mesh.visible = true;
      c.falling = false;
      c.dropped = false;
      c.mesh.rotation.set(0, 0, 0);
      c.mesh.scale.setScalar(1);
    });
    this._updateCubeLayout(0.016, 0);
  }

  exit() {
    this.root.visible = false;
  }

  performNextCut(swipeDirX = 0, swipeDirZ = 0) {
    if (this.tiltingToDump || this.knifeAnim) return false;
    if (this.totalCuts >= 4) {
      this.startDumpToPot();
      return 'dump';
    }

    // Choose cut axis naturally based on swipe direction if both axes remain, else next remaining axis
    let axis;
    if (this.cutsX < 2 && this.cutsZ < 2) {
      axis = Math.abs(swipeDirX) > Math.abs(swipeDirZ) * 1.2 ? 'z' : 'x';
    } else if (this.cutsX < 2) {
      axis = 'x';
    } else {
      axis = 'z';
    }

    let cutPos = 0;
    if (axis === 'x') {
      cutPos = this.cutsX === 0 ? -0.195 : 0.195;
      this.cutsX++;
    } else {
      cutPos = this.cutsZ === 0 ? -0.195 : 0.195;
      this.cutsZ++;
    }
    this.totalCuts++;

    this.knifeAnim = {
      t: 0,
      dur: 0.34,
      axis,
      cutPos,
      appliedSplit: false,
    };
    return 'cut';
  }

  startDumpToPot() {
    if (this.tiltingToDump) return;
    this.tiltingToDump = true;
    this.dumpProgress = 0;
    this.knifeGroup.visible = false;
    // Stagger each cube's slide off the palm (front row falls first!)
    this.cubes.forEach((c, idx) => {
      c.slideDelay = (1 - c.iz) * 0.14 + (c.ix + 1) * 0.07 + idx * 0.02;
    });
  }

  jiggleTofu() {
    this.cubes.forEach((c) => {
      c.spring.impulse(3.5 + Math.random() * 2.5);
    });
    this.handSpring.impulse(2.0);
  }

  _updateCubeLayout(dt, time) {
    const gapX1 = this.cutsX >= 1 ? 0.085 : 0;
    const gapX2 = this.cutsX >= 2 ? 0.085 : 0;
    const gapZ1 = this.cutsZ >= 1 ? 0.085 : 0;
    const gapZ2 = this.cutsZ >= 2 ? 0.085 : 0;
    const step = this.cubeSize * 0.96;

    for (const c of this.cubes) {
      if (c.falling || c.dropped) continue;
      let tx = c.ix * step;
      if (c.ix === -1) tx -= gapX1;
      if (c.ix === 1) tx += gapX2;
      if (c.ix === 0) tx += (gapX2 - gapX1) * 0.25;

      let tz = c.iz * step;
      if (c.iz === -1) tz -= gapZ1;
      if (c.iz === 1) tz += gapZ2;
      if (c.iz === 0) tz += (gapZ2 - gapZ1) * 0.25;

      c.mesh.position.x += (tx - c.mesh.position.x) * Math.min(1, dt * 14);
      c.mesh.position.z += (tz - c.mesh.position.z) * Math.min(1, dt * 14);
      c.mesh.position.y = 0;

      const sq = c.spring.step(dt);
      const eagerWobble = this.totalCuts >= 4 ? Math.sin(time * 7 + c.ix + c.iz) * 0.045 : 0;
      applySquash(c.mesh, sq * 0.12 + eagerWobble, 1);
    }
  }

  update(dt, time, kitchen, onCubeSplash, onAllDumped) {
    if (!this.root.visible) return;

    // Smoothly bring clay palm into center right over the steaming pot
    const targetHandX = this.tiltingToDump && this.dumpProgress > 1.35 ? -4.8 : -0.12;
    const targetHandY = this.totalCuts >= 4 && !this.tiltingToDump
      ? 1.92 + Math.sin(time * 4.2) * 0.05
      : 1.96 + Math.sin(time * 2.1) * 0.025;
    this.handGroup.position.x += (targetHandX - this.handGroup.position.x) * Math.min(1, dt * 8.5);
    this.handGroup.position.y += (targetHandY - this.handGroup.position.y) * Math.min(1, dt * 8);

    const hSq = this.handSpring.step(dt);
    this.handGroup.position.y -= hSq * 0.02;

    // Tilt palm smoothly when dumping cubes into the pot!
    const targetTiltX = this.tiltingToDump ? -0.68 : (this.totalCuts >= 4 ? -0.14 : 0);
    this.handTiltX += (targetTiltX - this.handTiltX) * Math.min(1, dt * 6.5);
    this.handGroup.rotation.x = this.handTiltX;
    this.handGroup.rotation.z = this.tiltingToDump ? -0.22 : 0;

    // Animate knife slicing arc!
    if (this.knifeAnim) {
      const a = this.knifeAnim;
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      const handCenter = this.handGroup.position;

      // Press down smoothly through tofu at p = 0.45
      const downCurve = Math.sin(p * Math.PI);
      const yPos = handCenter.y + 0.92 - downCurve * 0.62;
      if (a.axis === 'x') {
        this.knifeGroup.rotation.set(0.15 * downCurve, 0, 0);
        this.knifeGroup.position.set(
          handCenter.x + 0.08 + a.cutPos,
          yPos,
          handCenter.z + 0.55 - p * 0.35
        );
      } else {
        this.knifeGroup.rotation.set(0.15 * downCurve, Math.PI / 2, 0);
        this.knifeGroup.position.set(
          handCenter.x + 0.55 - p * 0.35,
          yPos,
          handCenter.z + a.cutPos
        );
      }

      if (p >= 0.46 && !a.appliedSplit) {
        a.appliedSplit = true;
        this.jiggleTofu();
      }
      if (p >= 1) {
        this.knifeAnim = null;
      }
    } else if (this.knifeGroup.visible) {
      // Gentle hovering anticipation beside the tofu
      const hoverX = this.totalCuts >= 4 ? 2.2 : 1.48;
      const hoverY = 2.46 + Math.sin(time * 3.1) * 0.06;
      this.knifeGroup.position.x += (hoverX - this.knifeGroup.position.x) * Math.min(1, dt * 7);
      this.knifeGroup.position.y += (hoverY - this.knifeGroup.position.y) * Math.min(1, dt * 7);
      this.knifeGroup.position.z += (0.54 - this.knifeGroup.position.z) * Math.min(1, dt * 7);
      const targetRotY = this.cutsX >= 2 ? Math.PI * 0.38 : 0.16;
      this.knifeGroup.rotation.y += (targetRotY - this.knifeGroup.rotation.y) * Math.min(1, dt * 7);
      this.knifeGroup.rotation.x += (0.08 - this.knifeGroup.rotation.x) * Math.min(1, dt * 7);
    }

    this._updateCubeLayout(dt, time);

    // Handle cubes sliding off tilted palm & splashing into pot!
    if (this.tiltingToDump) {
      this.dumpProgress += dt;
      const liquidWorldY = kitchen.getLiquidWorldY();
      let droppedCount = 0;

      for (const c of this.cubes) {
        if (c.dropped) {
          droppedCount++;
          continue;
        }
        if (!c.falling && this.dumpProgress >= c.slideDelay + 0.14) {
          c.falling = true;
          const worldPos = new THREE.Vector3();
          c.mesh.getWorldPosition(worldPos);
          this.root.attach(c.mesh);
          c.fallPos.copy(worldPos);
          c.fallVel.set((Math.random() - 0.5) * 0.45, 0.25, -0.45 + (Math.random() - 0.5) * 0.3);
        }
        if (c.falling) {
          c.fallVel.y -= 9.5 * dt;
          c.fallPos.addScaledVector(c.fallVel, dt);
          c.mesh.position.copy(c.fallPos);
          c.mesh.rotation.x += dt * 4.5;
          c.mesh.rotation.z += dt * 3.2;

          if (c.fallPos.y <= liquidWorldY + 0.04) {
            c.falling = false;
            c.dropped = true;
            c.mesh.visible = false;
            // Create a slightly smaller plump tofu cube floating inside the pot!
            const soupCube = createTofuCubeMesh(0.28, 470 + droppedCount);
            const lx = Math.max(-0.78, Math.min(0.78, c.fallPos.x - kitchen.potGroup.position.x));
            const lz = Math.max(-0.78, Math.min(0.78, c.fallPos.z - kitchen.potGroup.position.z));
            kitchen.addFloatingTofu(soupCube, lx, lz);
            kitchen.spawnSplash(lx, lz, 4);
            if (onCubeSplash) onCubeSplash(droppedCount);
            droppedCount++;
          }
        }
      }

      if (droppedCount >= this.cubes.length && this.dumpProgress > 1.75) {
        if (onAllDumped) onAllDumped();
      }
    }
  }
}

/**
 * Stage 2: Ceramic bowl of dark curled dried wakame buds that bloom hugely in the soup!
 */
export class ClayWakameDish {
  constructor(scene) {
    this.homePos = new THREE.Vector3(2.08, 0.0, 0.52);
    this.group = new THREE.Group();
    this.group.position.copy(this.homePos);
    this.group.visible = false;
    scene.add(this.group);

    // Cream & sage hand-pinched clay bowl (DoubleSide + thick rolled rim!)
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.56, 0),
      new THREE.Vector2(0.86, 0.22),
      new THREE.Vector2(0.94, 0.44),
      new THREE.Vector2(0.84, 0.46),
      new THREE.Vector2(0.70, 0.18),
      new THREE.Vector2(0, 0.14),
    ];
    const bowlGeo = new THREE.LatheGeometry(pts, 26);
    sculptClay(bowlGeo, 0.014, 3.2, 510);
    const bowl = new THREE.Mesh(
      bowlGeo,
      makeGlossClayMaterial(0xdbe8ce, { roughness: 0.34, clearcoat: 0.45, side: THREE.DoubleSide })
    );
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    bowl.userData.interactId = 'wakameDish';
    this.group.add(bowl);

    const bowlRim = new THREE.Mesh(
      sculptClay(new THREE.TorusGeometry(0.89, 0.065, 10, 26), 0.01, 4.0, 511),
      makeGlossClayMaterial(0xf5efe0, { roughness: 0.36 })
    );
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.y = 0.44;
    bowlRim.userData.interactId = 'wakameDish';
    this.group.add(bowlRim);

    // 5 chunky dark-emerald dried wakame buds (fureru wakame!)
    this.buds = [];
    const offsets = [
      [-0.28, 0.24, 0.18],
      [0.26, 0.25, 0.22],
      [0.0, 0.32, -0.02],
      [-0.24, 0.25, -0.22],
      [0.25, 0.24, -0.18],
    ];
    const driedMat = makeClayMaterial(0x133824, { roughness: 0.78 });
    offsets.forEach(([x, y, z], idx) => {
      const bud = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const pieceGeo = new THREE.TorusGeometry(0.11, 0.048, 7, 12, Math.PI * 1.45);
        sculptClay(pieceGeo, 0.01, 7.0, 520 + idx * 5 + k);
        const pm = new THREE.Mesh(pieceGeo, driedMat);
        pm.rotation.set(k * 1.1, k * 1.8, idx * 0.7);
        pm.position.set((k - 1) * 0.05, k * 0.03, (k - 1) * 0.03);
        pm.castShadow = true;
        pm.userData.interactId = 'wakameBud';
        pm.userData.budIndex = idx;
        bud.add(pm);
      }
      const home = new THREE.Vector3(this.homePos.x + x, this.homePos.y + y, this.homePos.z + z);
      bud.position.copy(home);
      bud.visible = false;
      scene.add(bud);
      this.buds.push({
        mesh: bud,
        home,
        used: false,
        flying: false,
        flyT: 0,
        flyStart: new THREE.Vector3(),
        flyTarget: new THREE.Vector3(),
        spring: new ClaySpring(180, 10),
      });
    });
  }

  show() {
    this.group.visible = true;
    this.group.scale.setScalar(0.65);
    this.buds.forEach((b) => {
      b.used = false;
      b.flying = false;
      b.mesh.visible = true;
      b.mesh.position.copy(b.home);
      b.mesh.scale.setScalar(1);
    });
  }

  hide() {
    this.group.visible = false;
    this.buds.forEach((b) => {
      b.mesh.visible = false;
    });
  }

  launchBudToPot(bud, targetWorldPos) {
    bud.used = true;
    bud.flying = true;
    bud.flyT = 0;
    bud.flyStart.copy(bud.mesh.position);
    bud.flyTarget.copy(targetWorldPos);
  }

  getNextUnusedBud() {
    return this.buds.find((b) => !b.used);
  }

  update(dt, time, kitchen, onBudLanded) {
    if (!this.group.visible) return;
    const s = this.group.scale.x + (1 - this.group.scale.x) * Math.min(1, dt * 8);
    this.group.scale.setScalar(s);

    for (const b of this.buds) {
      if (b.flying) {
        b.flyT += dt * 2.5;
        const t = Math.min(1, b.flyT);
        const arc = Math.sin(t * Math.PI) * 1.15;
        b.mesh.position.lerpVectors(b.flyStart, b.flyTarget, t);
        b.mesh.position.y += arc;
        b.mesh.rotation.x += dt * 7;
        b.mesh.rotation.y += dt * 5;
        if (t >= 1) {
          b.flying = false;
          b.mesh.visible = false;
          const lx = Math.max(-0.7, Math.min(0.7, b.flyTarget.x - kitchen.potGroup.position.x));
          const lz = Math.max(-0.7, Math.min(0.7, b.flyTarget.z - kitchen.potGroup.position.z));
          const leaf = createWakameLeafMesh(560 + Math.floor(Math.random() * 100));
          kitchen.addFloatingWakame(leaf, lx, lz);
          kitchen.spawnSplash(lx, lz, 4);
          if (onBudLanded) onBudLanded();
        }
      } else if (!b.used && b.mesh.visible) {
        const sq = b.spring.step(dt);
        const idleBob = Math.sin(time * 3.0 + b.home.x * 4) * 0.015;
        b.mesh.position.y += (b.home.y + idleBob - b.mesh.position.y) * Math.min(1, dt * 8);
        applySquash(b.mesh, sq * 0.1, 1);
      }
    }
  }
}

/**
 * Stage 3 & 4: Wooden-hooped Miso Barrel + Chunky Clay Ladle (お玉) + Dissolvable Glossy Miso Lump + Wooden Stirrer
 */
export class ClayMisoAndLadle {
  constructor(scene) {
    // 1. Miso wooden barrel (お味噌の桶 — big & cleanly separated from pot handle!)
    this.tubHomePos = new THREE.Vector3(2.42, 0, 0.55);
    this.tubGroup = new THREE.Group();
    this.tubGroup.position.copy(this.tubHomePos);
    this.tubGroup.visible = false;
    scene.add(this.tubGroup);

    const tubGeo = new THREE.CylinderGeometry(0.80, 0.72, 0.96, 24, 3);
    sculptClay(tubGeo, 0.016, 2.8, 610);
    const tubMesh = new THREE.Mesh(tubGeo, makeClayMaterial(0xc88d55, { roughness: 0.78 }));
    tubMesh.position.y = 0.48;
    tubMesh.castShadow = true;
    tubMesh.receiveShadow = true;
    tubMesh.userData.interactId = 'misoTub';
    this.tubGroup.add(tubMesh);

    // Two woven bamboo clay hoops around barrel
    [0.25, 0.70].forEach((hy, idx) => {
      const hoop = new THREE.Mesh(
        sculptClay(new THREE.TorusGeometry(0.79, 0.054, 8, 24), 0.009, 4.0, 612 + idx),
        makeClayMaterial(0x9a6434, { roughness: 0.8 })
      );
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      this.tubGroup.add(hoop);
    });

    // Rich glossy caramel clay miso filling inside the barrel!
    const fillGeo = new THREE.SphereGeometry(0.75, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45);
    sculptClay(fillGeo, 0.022, 4.0, 615);
    const misoMat = makeGlossClayMaterial(0x9f541d, { roughness: 0.26, clearcoat: 0.58 });
    const misoFill = new THREE.Mesh(fillGeo, misoMat);
    misoFill.scale.set(1, 0.36, 1);
    misoFill.position.y = 0.88;
    misoFill.userData.interactId = 'misoTub';
    this.tubGroup.add(misoFill);

    // 2. Chunky Clay Ladle (お玉) — used for Stage 3 (dissolve miso) AND Stage 4 (serve soup to family!)
    this.ladleGroup = new THREE.Group();
    this.ladleGroup.visible = false;
    scene.add(this.ladleGroup);

    const ladleBowlMat = makeGlossClayMaterial(0xf2e4cc, { roughness: 0.34, clearcoat: 0.42, side: THREE.DoubleSide });
    const ladleHandleMat = makeClayMaterial(0xd5794d, { roughness: 0.68 });

    // Thick cupped ladle head
    const cupGeo = new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52);
    sculptClay(cupGeo, 0.012, 4.0, 620);
    this.ladleCup = new THREE.Mesh(cupGeo, ladleBowlMat);
    this.ladleCup.castShadow = true;
    this.ladleCup.userData.interactId = 'ladle';
    this.ladleGroup.add(this.ladleCup);

    const cupRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 8, 22),
      ladleBowlMat
    );
    cupRim.rotation.x = Math.PI / 2;
    cupRim.position.y = 0.01;
    cupRim.userData.interactId = 'ladle';
    this.ladleGroup.add(cupRim);

    // Long plump handle rising gently upward-right so fingers never block the ladle bowl!
    const handleGeo = new THREE.CapsuleGeometry(0.085, 1.55, 8, 12);
    sculptClay(handleGeo, 0.01, 4.0, 621);
    const lHandle = new THREE.Mesh(handleGeo, ladleHandleMat);
    lHandle.position.set(0.68, 0.88, 0.14);
    lHandle.rotation.z = -0.62;
    lHandle.rotation.x = 0.12;
    lHandle.castShadow = true;
    lHandle.userData.interactId = 'ladle';
    this.ladleGroup.add(lHandle);

    // Big glossy scoop of caramel clay miso perched inside the ladle (Stage 3)
    const lumpGeo = new THREE.SphereGeometry(0.32, 16, 12);
    sculptClay(lumpGeo, 0.025, 4.5, 622);
    this.misoLump = new THREE.Mesh(lumpGeo, misoMat);
    this.misoLump.position.set(0, 0.05, 0);
    this.misoLump.castShadow = true;
    this.misoLump.userData.interactId = 'ladle';
    this.ladleGroup.add(this.misoLump);

    // Cute clay wooden stirrer chopsticks paired with ladle while dissolving miso!
    this.stirrerGroup = new THREE.Group();
    this.stirrerGroup.visible = false;
    const chopMat = makeClayMaterial(0xd8a363, { roughness: 0.72 });
    [-0.07, 0.07].forEach((ox, idx) => {
      const stick = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, 1.15, 6, 10),
        chopMat
      );
      stick.position.set(ox, 0.56, 0);
      stick.rotation.z = idx === 0 ? -0.1 : 0.06;
      stick.castShadow = true;
      this.stirrerGroup.add(stick);
    });
    this.ladleGroup.add(this.stirrerGroup);

    // Scooped soup + mini tofu + mini wakame inside ladle (visible when carrying soup to family bowls in Stage 4!)
    this.ladleSoupGroup = new THREE.Group();
    this.ladleSoupGroup.visible = false;
    this.ladleGroup.add(this.ladleSoupGroup);

    const ladleSoupDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 18),
      makeGlossClayMaterial(0xd58a3b, { roughness: 0.18, clearcoat: 0.7 })
    );
    ladleSoupDisc.rotation.x = -Math.PI / 2;
    ladleSoupDisc.position.y = -0.04;
    this.ladleSoupGroup.add(ladleSoupDisc);

    const miniTofu1 = createTofuCubeMesh(0.16, 630);
    miniTofu1.position.set(-0.1, 0.02, 0.06);
    miniTofu1.rotation.set(0.3, 0.5, 0.2);
    this.ladleSoupGroup.add(miniTofu1);

    const miniTofu2 = createTofuCubeMesh(0.14, 631);
    miniTofu2.position.set(0.12, 0.01, -0.06);
    miniTofu2.rotation.set(-0.2, 0.9, 0.1);
    this.ladleSoupGroup.add(miniTofu2);

    const miniWakame = createWakameLeafMesh(632);
    miniWakame.scale.setScalar(0.55);
    miniWakame.position.set(0.02, 0.03, 0.04);
    this.ladleSoupGroup.add(miniWakame);

    // Animated soup pour stream from ladle into family bowl
    this.pourStream = new THREE.Group();
    this.pourStream.visible = false;
    scene.add(this.pourStream);
    const streamMat = makeGlossClayMaterial(0xd58a3b, { roughness: 0.18, clearcoat: 0.7 });
    this.pourDrops = [];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), streamMat);
      this.pourStream.add(d);
      this.pourDrops.push(d);
    }

    this.spring = new ClaySpring(180, 11);
    this.misoInPot = false;
    this.dissolveProgress = 0; // 0..1
    this.stirAngle = 0;
  }

  enterMisoStage() {
    this.tubGroup.visible = true;
    this.tubGroup.scale.setScalar(0.65);
    this.ladleGroup.visible = true;
    this.ladleGroup.position.set(2.42, 1.1, 0.55);
    this.ladleGroup.rotation.set(0, 0, 0);
    this.misoLump.visible = true;
    this.misoLump.scale.setScalar(1);
    this.stirrerGroup.visible = false;
    this.ladleSoupGroup.visible = false;
    this.pourStream.visible = false;
    this.misoInPot = false;
    this.dissolveProgress = 0;
  }

  enterServeStage(potWorldPos) {
    this.tubGroup.visible = false;
    this.misoLump.visible = false;
    this.stirrerGroup.visible = false;
    this.ladleGroup.visible = true;
    this.ladleSoupGroup.visible = true;
    this.ladleGroup.position.set(potWorldPos.x + 0.12, potWorldPos.y + 1.15, potWorldPos.z + 0.05);
    this.ladleGroup.rotation.set(0, 0, 0);
  }

  hideAll() {
    this.tubGroup.visible = false;
    this.ladleGroup.visible = false;
    this.pourStream.visible = false;
  }

  updateTub(dt) {
    if (!this.tubGroup.visible) return;
    const s = this.tubGroup.scale.x + (1 - this.tubGroup.scale.x) * Math.min(1, dt * 8);
    this.tubGroup.scale.setScalar(s);
  }

  updatePourStream(active, startWorld, endWorld, time) {
    this.pourStream.visible = active;
    if (!active) return;
    for (let i = 0; i < this.pourDrops.length; i++) {
      const t = ((i / this.pourDrops.length) + time * 3.0) % 1;
      const d = this.pourDrops[i];
      d.position.set(
        startWorld.x + (endWorld.x - startWorld.x) * t,
        startWorld.y * (1 - t * t) + endWorld.y * (t * t),
        startWorld.z + (endWorld.z - startWorld.z) * t
      );
      d.scale.set(0.72, 1.25, 0.72);
    }
  }
}
