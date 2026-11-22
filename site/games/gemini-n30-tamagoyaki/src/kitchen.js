import * as THREE from '../vendor/three.module.min.js';
import {
  createWoodTextures,
  createTileTexture,
  createCeramicTexture,
  createPanSurfaceTexture,
  createEggshellController,
  createRiceTexture,
  createBowlLiquidController,
} from './textures.js';

// Builds the entire photorealistic sunlit Japanese home kitchen & interactive cooking props
export function buildKitchen(scene) {
  const kitchen = {
    hitTargets: [], // interactive meshes & invisible generous hit volumes
    wobbles: new Map(), // object3D -> { amp, phase } for gentle feedback on inactive props
  };

  function registerHit(mesh, info) {
    mesh.userData = { ...mesh.userData, ...info };
    kitchen.hitTargets.push(mesh);
    return mesh;
  }

  // --- Shared procedural PBR textures ---
  const oakTex = createWoodTextures('oak');
  oakTex.map.repeat.set(3.2, 1.4);
  oakTex.bumpMap.repeat.set(3.2, 1.4);

  const hinokiTex = createWoodTextures('hinoki');
  const walnutTex = createWoodTextures('walnut');
  const bentoWoodTex = createWoodTextures('bento');
  const tileTex = createTileTexture();
  const bowlCeramicTex = createCeramicTexture('#efe7d8', '#68523e', 512);
  const darkCeramicTex = createCeramicTexture('#435364', '#262e38', 612);
  const panSurfaceTex = createPanSurfaceTexture();
  const riceTex = createRiceTexture();

  // --- 1. Sunlit Oak Countertop & Warm Japanese Kitchen Background ---
  const counterMat = new THREE.MeshStandardMaterial({
    map: oakTex.map,
    bumpMap: oakTex.bumpMap,
    bumpScale: 0.012,
    roughness: 0.48,
    metalness: 0.02,
  });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.24, 2.75), counterMat);
  counter.position.set(0.3, -0.12, 0.35);
  counter.receiveShadow = true;
  scene.add(counter);

  // Subtle front oak apron edge beneath counter
  const underCounter = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 1.8, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x3f2d20, roughness: 0.85 })
  );
  underCounter.position.set(0.3, -1.14, 0.32);
  scene.add(underCounter);

  // Warm cream subway-tile backsplash wall behind the companion
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 6.2),
    new THREE.MeshStandardMaterial({
      map: tileTex,
      roughness: 0.28,
      metalness: 0.04,
    })
  );
  backWall.position.set(0.4, 2.0, -2.55);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Natural oak floating kitchen shelf in soft background depth
  const shelfMat = new THREE.MeshStandardMaterial({
    map: walnutTex.map,
    roughness: 0.56,
  });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.08, 0.44), shelfMat);
  shelf.position.set(0.3, 1.82, -2.30);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  scene.add(shelf);

  // Soft-focus atmospheric background kitchen props on shelf (ceramics, teapot, herb pot)
  const shelfPropSpecs = [
    { x: -2.6, type: 'jar', col: 0xe9e1d2 },
    { x: -2.15, type: 'jar', col: 0xc9d4c5 },
    { x: -1.1, type: 'plant' },
    { x: 1.05, type: 'teapot', col: 0x45545e },
    { x: 1.65, type: 'jar', col: 0xe6d6bc },
    { x: 2.55, type: 'plant' },
  ];
  for (const sp of shelfPropSpecs) {
    if (sp.type === 'jar') {
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.125, 0.28, 16),
        new THREE.MeshStandardMaterial({ color: sp.col, roughness: 0.32 })
      );
      jar.position.set(sp.x, 2.0, -2.26);
      scene.add(jar);
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.115, 0.04, 16),
        shelfMat
      );
      lid.position.set(sp.x, 2.15, -2.26);
      scene.add(lid);
    } else if (sp.type === 'teapot') {
      const pot = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 16, 14),
        new THREE.MeshStandardMaterial({ color: sp.col, roughness: 0.34 })
      );
      pot.scale.set(1.1, 0.85, 1.1);
      pot.position.set(sp.x, 1.98, -2.24);
      scene.add(pot);
    } else {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.075, 0.16, 14),
        new THREE.MeshStandardMaterial({ color: 0xb86e4b, roughness: 0.78 })
      );
      pot.position.set(sp.x, 1.94, -2.25);
      scene.add(pot);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x5c8549, roughness: 0.68 });
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), leafMat);
        leaf.scale.set(0.7, 1.15, 0.7);
        leaf.position.set(sp.x + Math.cos(ang) * 0.06, 2.08 + (k % 2) * 0.05, -2.25 + Math.sin(ang) * 0.06);
        scene.add(leaf);
      }
    }
  }

  // --- 2. ZONE 1: Ceramic Mixing Bowl, 3 Eggs, Chopsticks, Mix-in Seasoning Dishes ---
  const ZONE1_X = -1.55;
  kitchen.bowlHomePos = new THREE.Vector3(ZONE1_X, 0, 0.32);
  kitchen.bowlPourPos = new THREE.Vector3(-0.92, 0.0, 0.24);

  // Handcrafted ceramic stoneware mixing bowl (LatheGeometry)
  const bowlGroup = new THREE.Group();
  bowlGroup.position.copy(kitchen.bowlHomePos);
  scene.add(bowlGroup);
  kitchen.bowlGroup = bowlGroup;

  const bowlPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.32, 0.05),
    new THREE.Vector2(0.41, 0.15),
    new THREE.Vector2(0.445, 0.27),
    new THREE.Vector2(0.432, 0.285),
    new THREE.Vector2(0.405, 0.275),
    new THREE.Vector2(0.37, 0.16),
    new THREE.Vector2(0.28, 0.065),
    new THREE.Vector2(0.0, 0.032),
  ];
  const bowlGeo = new THREE.LatheGeometry(bowlPts, 36);
  const bowlMat = new THREE.MeshStandardMaterial({
    map: bowlCeramicTex,
    roughness: 0.26,
    metalness: 0.04,
  });
  const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  bowlGroup.add(bowlMesh);

  // Subtle dark stoneware rim ring accent
  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.425, 0.012, 10, 36),
    new THREE.MeshStandardMaterial({ color: 0x7c5d43, roughness: 0.42 })
  );
  rimRing.rotation.x = Math.PI * 0.5;
  rimRing.position.y = 0.28;
  bowlGroup.add(rimRing);

  // Generous invisible bowl hit collider
  const bowlHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.42, 0.34, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bowlHit.position.y = 0.17;
  bowlGroup.add(bowlHit);
  registerHit(bowlHit, { hitType: 'bowl' });

  // Dynamic liquid surface inside mixing bowl
  kitchen.bowlLiquidCtrl = createBowlLiquidController();
  const liquidGeo = new THREE.CircleGeometry(0.365, 32);
  liquidGeo.rotateX(-Math.PI * 0.5);
  const liquidMat = new THREE.MeshStandardMaterial({
    map: kitchen.bowlLiquidCtrl.texture,
    roughness: 0.12,
    metalness: 0.04,
    transparent: true,
    opacity: 0.96,
  });
  const bowlLiquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  bowlLiquidMesh.position.y = 0.06;
  bowlLiquidMesh.visible = false;
  bowlGroup.add(bowlLiquidMesh);
  kitchen.bowlLiquidMesh = bowlLiquidMesh;

  // Glossy 3D yolks inside the bowl (visible after cracking, dissolve smoothly as player whisks!)
  const yolkMat = new THREE.MeshStandardMaterial({
    color: 0xff9214,
    roughness: 0.09,
    metalness: 0.02,
  });
  const albumenMat = new THREE.MeshStandardMaterial({
    color: 0xfff7e4,
    roughness: 0.08,
    transparent: true,
    opacity: 0.52,
  });
  kitchen.bowlYolks = [];
  for (let i = 0; i < 4; i++) {
    const yg = new THREE.Group();
    const whitePool = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), albumenMat);
    whitePool.scale.set(1.15, 0.14, 1.05);
    yg.add(whitePool);

    const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.066, 18, 14), yolkMat);
    yolk.scale.set(1.0, 0.66, 1.0);
    yolk.position.y = 0.028;
    yg.add(yolk);

    yg.visible = false;
    bowlGroup.add(yg);
    kitchen.bowlYolks.push(yg);
  }

  // Glossy falling egg stream mesh (visible when pouring from bowl into pan!)
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.52, 0),
    new THREE.Vector3(0.18, 0.36, 0.02),
    new THREE.Vector3(0.30, 0.12, 0.02),
  ]);
  const pourStream = new THREE.Mesh(
    new THREE.TubeGeometry(streamCurve, 16, 0.036, 10, false),
    new THREE.MeshStandardMaterial({
      color: 0xffc633,
      roughness: 0.14,
      metalness: 0.02,
    })
  );
  pourStream.visible = false;
  scene.add(pourStream);
  kitchen.pourStream = pourStream;

  // Curved ceramic egg tray + 3 big organic farm-fresh eggs
  const eggTrayGroup = new THREE.Group();
  eggTrayGroup.position.set(ZONE1_X - 0.78, 0, 0.42);
  scene.add(eggTrayGroup);
  kitchen.eggTrayGroup = eggTrayGroup;

  const trayBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.27, 0.045, 24),
    new THREE.MeshStandardMaterial({ map: walnutTex.map, roughness: 0.55 })
  );
  trayBase.scale.set(0.88, 1, 1.28);
  trayBase.position.y = 0.022;
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  eggTrayGroup.add(trayBase);

  // Build authentic ovoid egg shape (top half + bottom half so it genuinely cracks open!)
  const eggLowerPts = [];
  const eggUpperPts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const ang = t * Math.PI;
    const y = -Math.cos(ang) * 0.095;
    const taper = 1 - 0.19 * Math.max(0, -Math.cos(ang));
    const r = Math.sin(ang) * 0.072 * taper;
    if (t <= 0.5) eggLowerPts.push(new THREE.Vector2(r, y));
    if (t >= 0.5) eggUpperPts.push(new THREE.Vector2(r, y));
  }
  const lowerHalfGeo = new THREE.LatheGeometry(eggLowerPts, 22);
  const upperHalfGeo = new THREE.LatheGeometry(eggUpperPts, 22);

  const eggColors = ['#d7a179', '#e5be9b', '#f2e6d6'];
  const eggOffsets = [
    new THREE.Vector3(-0.07, 0.125, -0.14),
    new THREE.Vector3(0.08, 0.125, 0.01),
    new THREE.Vector3(-0.06, 0.125, 0.16),
  ];

  kitchen.eggs = [];
  for (let i = 0; i < 3; i++) {
    const egGroup = new THREE.Group();
    const homePos = eggTrayGroup.position.clone().add(eggOffsets[i]);
    egGroup.position.copy(homePos);
    scene.add(egGroup);

    const shellCtrl = createEggshellController(eggColors[i], 31 + i * 17);
    const shellMat = new THREE.MeshStandardMaterial({
      map: shellCtrl.texture,
      roughness: 0.46,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    const lowerMesh = new THREE.Mesh(lowerHalfGeo, shellMat);
    lowerMesh.castShadow = true;
    lowerMesh.receiveShadow = true;
    egGroup.add(lowerMesh);

    const upperMesh = new THREE.Mesh(upperHalfGeo, shellMat);
    upperMesh.castShadow = true;
    upperMesh.receiveShadow = true;
    egGroup.add(upperMesh);

    // Inner glossy yolk visible right as shell splits open
    const dropYolk = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), yolkMat);
    dropYolk.visible = false;
    egGroup.add(dropYolk);

    // Enlarged hit sphere for effortless 5-year-old tapping
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.135, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    egGroup.add(hit);
    registerHit(hit, { hitType: 'egg', eggIndex: i });

    kitchen.eggs.push({
      index: i,
      group: egGroup,
      lowerMesh,
      upperMesh,
      dropYolk,
      shellCtrl,
      homePos,
      state: 'tray', // tray | lifted | cracked1 | splitting | done
      animT: 0,
      isDoubleYolk: false,
    });
  }

  // Wooden Japanese Saibashi (cooking chopsticks) resting beside the bowl
  const chopsticksGroup = new THREE.Group();
  kitchen.chopsticksHomePos = new THREE.Vector3(ZONE1_X + 0.56, 0.03, 0.34);
  chopsticksGroup.position.copy(kitchen.chopsticksHomePos);
  scene.add(chopsticksGroup);
  kitchen.chopsticksGroup = chopsticksGroup;

  const stickMat = new THREE.MeshStandardMaterial({
    map: hinokiTex.map,
    color: 0xd9a86e,
    roughness: 0.52,
  });
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.66, 10), stickMat);
    s.position.set(i * 0.032 - 0.016, 0, 0);
    s.rotation.z = i === 0 ? 0.045 : -0.045;
    s.castShadow = true;
    chopsticksGroup.add(s);
  }
  // Rest horizontally on counter initially
  chopsticksGroup.rotation.set(Math.PI * 0.5, 0.18, 0);

  const stickHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.72, 0.22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  chopsticksGroup.add(stickHit);
  registerHit(stickHit, { hitType: 'chopsticks' });

  // 3 Tactile Optional Mix-In Vessels behind the bowl (Negi, Nori, Dashi!)
  kitchen.mixins = {};

  // Mix-in A: Chopped green Negi (scallions) in small indigo ceramic dish
  const negiGroup = new THREE.Group();
  negiGroup.position.set(ZONE1_X - 0.66, 0, -0.22);
  scene.add(negiGroup);
  const dishGeo = new THREE.CylinderGeometry(0.145, 0.105, 0.075, 22);
  const negiDish = new THREE.Mesh(
    dishGeo,
    new THREE.MeshStandardMaterial({ map: darkCeramicTex, roughness: 0.28 })
  );
  negiDish.position.y = 0.038;
  negiDish.castShadow = true;
  negiGroup.add(negiDish);
  const negiMat1 = new THREE.MeshStandardMaterial({ color: 0x458b31, roughness: 0.52 });
  const negiMat2 = new THREE.MeshStandardMaterial({ color: 0x76b84b, roughness: 0.48 });
  for (let i = 0; i < 18; i++) {
    const bit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.014, 8),
      i % 2 === 0 ? negiMat1 : negiMat2
    );
    const a = i * 2.39;
    const r = Math.sqrt(i / 18) * 0.088;
    bit.position.set(Math.cos(a) * r, 0.075 + (i % 3) * 0.008, Math.sin(a) * r);
    bit.rotation.set(Math.sin(i) * 0.4, i, Math.cos(i) * 0.4);
    negiGroup.add(bit);
  }
  const negiHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.18, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  negiHit.position.y = 0.08;
  negiGroup.add(negiHit);
  registerHit(negiHit, { hitType: 'mixin', mixinType: 'negi' });
  kitchen.mixins.negi = negiGroup;

  // Mix-in B: Dark roasted Nori seaweed strips on ceramic plate
  const noriGroup = new THREE.Group();
  noriGroup.position.set(ZONE1_X - 0.16, 0, -0.44);
  scene.add(noriGroup);
  const noriDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.11, 0.042, 22),
    new THREE.MeshStandardMaterial({ map: bowlCeramicTex, roughness: 0.26 })
  );
  noriDish.position.y = 0.021;
  noriDish.castShadow = true;
  noriGroup.add(noriDish);
  const noriMat = new THREE.MeshStandardMaterial({ color: 0x1c2c1a, roughness: 0.72 });
  for (let i = 0; i < 7; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.042), noriMat);
    strip.position.set((i - 3) * 0.012, 0.046 + i * 0.005, (i % 2 - 0.5) * 0.03);
    strip.rotation.y = (i - 3) * 0.24;
    noriGroup.add(strip);
  }
  const noriHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.16, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  noriHit.position.y = 0.08;
  noriGroup.add(noriHit);
  registerHit(noriHit, { hitType: 'mixin', mixinType: 'nori' });
  kitchen.mixins.nori = noriGroup;

  // Mix-in C: Small glass cruet of golden sweet Dashi / Mirin
  const dashiGroup = new THREE.Group();
  dashiGroup.position.set(ZONE1_X + 0.44, 0, -0.26);
  scene.add(dashiGroup);
  const dashiLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.095, 0.15, 18),
    new THREE.MeshStandardMaterial({ color: 0xd08924, roughness: 0.12, metalness: 0.05 })
  );
  dashiLiquid.position.y = 0.085;
  dashiGroup.add(dashiLiquid);
  const dashiGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.105, 0.24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.38,
    })
  );
  dashiGlass.position.y = 0.12;
  dashiGlass.castShadow = true;
  dashiGroup.add(dashiGlass);
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.036, 0.048, 14),
    new THREE.MeshStandardMaterial({ color: 0xb58654, roughness: 0.85 })
  );
  cork.position.y = 0.255;
  dashiGroup.add(cork);
  const dashiHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.30, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  dashiHit.position.y = 0.14;
  dashiGroup.add(dashiHit);
  registerHit(dashiHit, { hitType: 'mixin', mixinType: 'dashi' });
  kitchen.mixins.dashi = dashiGroup;

  // --- 3. ZONE 2: Built-in Japanese Gas Stove & Rectangular Tamagoyaki Pan ---
  const ZONE2_X = 0.0;
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(ZONE2_X, 0, 0.24);
  scene.add(stoveGroup);
  kitchen.stoveGroup = stoveGroup;

  // Brushed stainless steel recessed stove top
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcfd3d6,
    roughness: 0.30,
    metalness: 0.78,
  });
  const stovePlate = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.042, 1.32), steelMat);
  stovePlate.position.y = 0.021;
  stovePlate.receiveShadow = true;
  stoveGroup.add(stovePlate);

  // Recessed black enamel burner well
  const burnerWell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.38, 0.022, 28),
    new THREE.MeshStandardMaterial({ color: 0x222327, roughness: 0.45, metalness: 0.45 })
  );
  burnerWell.position.y = 0.038;
  stoveGroup.add(burnerWell);

  // Cast-iron burner cap & 6 radial trivet arms
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1e1f22,
    roughness: 0.68,
    metalness: 0.48,
  });
  const burnerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.035, 22), ironMat);
  burnerCap.position.y = 0.062;
  stoveGroup.add(burnerCap);

  const trivetRing = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.022, 8, 28), ironMat);
  trivetRing.rotation.x = Math.PI * 0.5;
  trivetRing.position.y = 0.095;
  stoveGroup.add(trivetRing);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.028), ironMat);
    arm.position.set(Math.cos(ang) * 0.28, 0.096, Math.sin(ang) * 0.28);
    arm.rotation.y = -ang;
    stoveGroup.add(arm);
  }

  // Animated realistic blue-and-orange gas flame jets around the burner!
  const flameGroup = new THREE.Group();
  flameGroup.position.y = 0.068;
  stoveGroup.add(flameGroup);
  kitchen.flameGroup = flameGroup;
  kitchen.flamePetals = [];

  const blueFlameMat = new THREE.MeshBasicMaterial({
    color: 0x3ba8ff,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const orangeTipMat = new THREE.MeshBasicMaterial({
    color: 0xff8a24,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const petal = new THREE.Group();
    petal.position.set(Math.cos(ang) * 0.28, 0, Math.sin(ang) * 0.28);
    petal.rotation.y = -ang;

    const blue = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.14, 7), blueFlameMat);
    blue.rotation.z = -1.12;
    blue.position.set(0.055, 0.022, 0);
    petal.add(blue);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.075, 6), orangeTipMat);
    tip.rotation.z = -1.0;
    tip.position.set(0.095, 0.036, 0);
    petal.add(tip);

    flameGroup.add(petal);
    kitchen.flamePetals.push({ group: petal, tip, phase: i * 0.72 });
  }

  // Warm under-pan gas glow point light (zero shadow cost, adds photorealistic burner bounce!)
  const flameLight = new THREE.PointLight(0x4ea4ff, 0.8, 1.5);
  flameLight.position.set(0, 0.12, 0);
  stoveGroup.add(flameLight);
  kitchen.flameLight = flameLight;

  // Physical Gas Stove Heat Dial Knob (front-left of stove: Low / Medium / High!)
  const knobGroup = new THREE.Group();
  knobGroup.position.set(-0.56, 0.042, 0.52);
  stoveGroup.add(knobGroup);
  kitchen.stoveKnobGroup = knobGroup;

  const knobBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.022, 22), ironMat);
  knobBezel.position.y = 0.011;
  knobGroup.add(knobBezel);

  // Color heat indicator ring around knob (no text/numbers!)
  const heatRingMat = new THREE.MeshStandardMaterial({
    color: 0xff9d2e,
    emissive: 0xff7b14,
    emissiveIntensity: 0.65,
    roughness: 0.3,
  });
  const heatRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.011, 8, 24), heatRingMat);
  heatRing.rotation.x = Math.PI * 0.5;
  heatRing.position.y = 0.026;
  knobGroup.add(heatRing);
  kitchen.heatRingMat = heatRingMat;

  const knobDial = new THREE.Group();
  knobDial.position.y = 0.05;
  knobGroup.add(knobDial);
  kitchen.stoveKnobDial = knobDial;

  const dialBody = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.078, 0.058, 22), steelMat);
  dialBody.castShadow = true;
  knobDial.add(dialBody);

  const dialBar = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.032, 0.13), ironMat);
  dialBar.position.y = 0.035;
  knobDial.add(dialBar);

  const dialDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff6229 })
  );
  dialDot.position.set(0, 0.054, -0.048);
  knobDial.add(dialDot);

  const knobHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.16, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  knobHit.position.y = 0.06;
  knobGroup.add(knobHit);
  registerHit(knobHit, { hitType: 'stoveKnob' });

  // HERO RECTANGULAR TAMAGOYAKI PAN (玉子焼き器)
  const panGroup = new THREE.Group();
  panGroup.position.set(0, 0.12, 0.0);
  stoveGroup.add(panGroup);
  kitchen.panGroup = panGroup;

  const panOuterMat = new THREE.MeshStandardMaterial({
    color: 0xb86f42, // warm hammered copper-bronze exterior
    roughness: 0.28,
    metalness: 0.78,
  });
  const panInnerMat = new THREE.MeshStandardMaterial({
    map: panSurfaceTex,
    roughness: 0.34,
    metalness: 0.22,
  });

  // Flat thick bottom plate
  const panW = 0.78;
  const panL = 0.96;
  const panWallH = 0.115;
  const wallT = 0.036;

  const panBottom = new THREE.Mesh(new THREE.BoxGeometry(panW, 0.028, panL), panOuterMat);
  panBottom.castShadow = true;
  panBottom.receiveShadow = true;
  panGroup.add(panBottom);

  const panFloor = new THREE.Mesh(new THREE.PlaneGeometry(panW - 0.05, panL - 0.05), panInnerMat);
  panFloor.rotation.x = -Math.PI * 0.5;
  panFloor.position.y = 0.015;
  panFloor.receiveShadow = true;
  panGroup.add(panFloor);

  // Left & Right raised rectangular pan walls
  const sideWallGeo = new THREE.BoxGeometry(wallT, panWallH, panL);
  [-panW * 0.5, panW * 0.5].forEach((wx) => {
    const w = new THREE.Mesh(sideWallGeo, panOuterMat);
    w.position.set(wx, panWallH * 0.44, 0);
    w.castShadow = true;
    panGroup.add(w);

    const wIn = new THREE.Mesh(new THREE.BoxGeometry(0.012, panWallH - 0.014, panL - 0.04), panInnerMat);
    wIn.position.set(wx > 0 ? wx - 0.016 : wx + 0.016, panWallH * 0.44, 0);
    panGroup.add(wIn);
  });

  // Far back wall (-Z) & authentic sloped front rolling lip (+Z)
  const backWallPan = new THREE.Mesh(new THREE.BoxGeometry(panW + wallT, panWallH, wallT), panOuterMat);
  backWallPan.position.set(0, panWallH * 0.44, -panL * 0.5);
  backWallPan.castShadow = true;
  panGroup.add(backWallPan);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(panW + wallT, panWallH * 0.92, wallT), panOuterMat);
  frontLip.position.set(0, panWallH * 0.36, panL * 0.5 + 0.024);
  frontLip.rotation.x = 0.48; // authentic sloped tamagoyaki rolling edge!
  frontLip.castShadow = true;
  panGroup.add(frontLip);

  // Steel neck & turned dark walnut pan handle extending cleanly front-left
  const handleGroup = new THREE.Group();
  handleGroup.position.set(-0.22, 0.075, panL * 0.5 + 0.04);
  handleGroup.rotation.y = -0.34;
  panGroup.add(handleGroup);

  const neckSteel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.028, 0.16), steelMat);
  neckSteel.position.set(0, 0.01, 0.07);
  neckSteel.rotation.x = -0.18;
  handleGroup.add(neckSteel);

  const handleWood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.040, 0.46, 14),
    new THREE.MeshStandardMaterial({ map: walnutTex.map, roughness: 0.44 })
  );
  handleWood.rotation.x = Math.PI * 0.5 - 0.18;
  handleWood.position.set(0, 0.055, 0.35);
  handleWood.castShadow = true;
  handleGroup.add(handleWood);

  // Pan interior coordinate container for TamagoyakiSystem
  const panInteriorGroup = new THREE.Group();
  panInteriorGroup.position.set(0, 0.015, 0);
  panGroup.add(panInteriorGroup);
  kitchen.panInteriorGroup = panInteriorGroup;

  // Generous invisible pan interaction hit box
  const panHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.32, 1.12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  panHit.position.y = 0.14;
  panGroup.add(panHit);
  registerHit(panHit, { hitType: 'pan' });

  // Silicone & Wood Rectangular Tamagoyaki Spatula resting beside the pan
  const spatulaGroup = new THREE.Group();
  kitchen.spatulaHomePos = new THREE.Vector3(0.78, 0.04, 0.32);
  spatulaGroup.position.copy(kitchen.spatulaHomePos);
  scene.add(spatulaGroup);
  kitchen.spatulaGroup = spatulaGroup;

  const spatBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.014, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.42 })
  );
  spatBlade.position.set(0, 0.008, -0.14);
  spatBlade.castShadow = true;
  spatulaGroup.add(spatBlade);

  const spatNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.16, 10), steelMat);
  spatNeck.rotation.x = Math.PI * 0.5 - 0.2;
  spatNeck.position.set(0, 0.028, 0.03);
  spatulaGroup.add(spatNeck);

  const spatHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.34, 12),
    new THREE.MeshStandardMaterial({ map: hinokiTex.map, roughness: 0.48 })
  );
  spatHandle.rotation.x = Math.PI * 0.5 - 0.12;
  spatHandle.position.set(0, 0.056, 0.25);
  spatHandle.castShadow = true;
  spatulaGroup.add(spatHandle);

  const spatHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.18, 0.72),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  spatHit.position.set(0, 0.06, 0.08);
  spatulaGroup.add(spatHit);
  registerHit(spatHit, { hitType: 'spatula' });

  // --- 4. ZONE 3: Hinoki Cutting Board, Santoku Knife, Bentwood Bento Box & Extras ---
  const boardGroup = new THREE.Group();
  boardGroup.position.set(1.48, 0.0, 0.34);
  scene.add(boardGroup);
  kitchen.boardGroup = boardGroup;
  kitchen.boardCenter = new THREE.Vector3(1.48, 0.072, 0.34);

  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.072, 0.74),
    new THREE.MeshStandardMaterial({
      map: hinokiTex.map,
      bumpMap: hinokiTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.54,
    })
  );
  boardMesh.position.y = 0.036;
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  boardGroup.add(boardMesh);

  const boardHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.06, 0.34, 0.84),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  boardHit.position.y = 0.17;
  boardGroup.add(boardHit);
  registerHit(boardHit, { hitType: 'board' });

  // Realistic Japanese Santoku Kitchen Knife (rests neatly behind-left of board when not slicing!)
  const knifeGroup = new THREE.Group();
  kitchen.knifeHomePos = new THREE.Vector3(1.10, 0.088, -0.14);
  knifeGroup.position.copy(kitchen.knifeHomePos);
  knifeGroup.rotation.y = Math.PI * 0.45;
  scene.add(knifeGroup);
  kitchen.knifeGroup = knifeGroup;

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(0.42, 0.005);
  bladeShape.quadraticCurveTo(0.46, 0.04, 0.42, 0.098);
  bladeShape.lineTo(0, 0.105);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.007, bevelEnabled: false });
  bladeGeo.center();
  bladeGeo.rotateY(Math.PI * 0.5); // edge runs along Z
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xe6ebef,
    roughness: 0.16,
    metalness: 0.92,
  });
  const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
  bladeMesh.position.set(0, 0.01, -0.14);
  bladeMesh.castShadow = true;
  knifeGroup.add(bladeMesh);

  const knifeHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.029, 0.28, 12),
    new THREE.MeshStandardMaterial({ map: walnutTex.map, roughness: 0.44 })
  );
  knifeHandle.rotation.x = Math.PI * 0.5;
  knifeHandle.position.set(0, 0.036, 0.21);
  knifeHandle.castShadow = true;
  knifeGroup.add(knifeHandle);

  const knifeHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.22, 0.72),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  knifeGroup.add(knifeHit);
  registerHit(knifeHit, { hitType: 'knife' });

  // GORGEOUS TRADITIONAL JAPANESE BENTWOOD BENTO BOX (曲げわっぱ)
  const bentoGroup = new THREE.Group();
  bentoGroup.position.set(2.74, 0.0, 0.24);
  scene.add(bentoGroup);
  kitchen.bentoGroup = bentoGroup;

  const bentoWallMat = new THREE.MeshStandardMaterial({
    map: bentoWoodTex.map,
    roughness: 0.46,
    metalness: 0.02,
  });
  const bentoLacquerMat = new THREE.MeshStandardMaterial({
    color: 0x8f241c, // deep glossy Japanese urushi red lacquer inside!
    roughness: 0.18,
    metalness: 0.06,
  });

  // Oval bentwood outer shell + red lacquered interior floor
  const bentoOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.50, 0.19, 36, 1, true), bentoWallMat);
  bentoOuter.scale.set(1.22, 1, 0.88);
  bentoOuter.position.y = 0.095;
  bentoOuter.castShadow = true;
  bentoOuter.receiveShadow = true;
  bentoGroup.add(bentoOuter);

  const bentoInnerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.495, 0.48, 0.185, 36, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9b281e, roughness: 0.2, side: THREE.BackSide })
  );
  bentoInnerWall.scale.set(1.20, 1, 0.86);
  bentoInnerWall.position.y = 0.095;
  bentoGroup.add(bentoInnerWall);

  const bentoRim = new THREE.Mesh(new THREE.TorusGeometry(0.508, 0.018, 10, 36), bentoWallMat);
  bentoRim.rotation.x = Math.PI * 0.5;
  bentoRim.scale.set(1.21, 0.87, 1);
  bentoRim.position.y = 0.19;
  bentoGroup.add(bentoRim);

  const bentoFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.032, 32), bentoLacquerMat);
  bentoFloor.scale.set(1.20, 1, 0.86);
  bentoFloor.position.y = 0.018;
  bentoFloor.receiveShadow = true;
  bentoGroup.add(bentoFloor);

  // Left half of bento: plump steamed white rice with sesame + crimson umeboshi plum!
  const riceMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.37, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.MeshStandardMaterial({ map: riceTex, roughness: 0.42 })
  );
  riceMound.scale.set(0.76, 0.42, 0.96);
  riceMound.position.set(-0.24, 0.032, 0);
  riceMound.receiveShadow = true;
  bentoGroup.add(riceMound);

  const umeboshi = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xc9252d, roughness: 0.28 })
  );
  umeboshi.scale.set(1.05, 0.72, 1.0);
  umeboshi.position.set(-0.26, 0.185, 0.01);
  bentoGroup.add(umeboshi);

  // Ruffled crisp green lettuce leaf divider (tucked cleanly against rice mound!)
  const lettuceMat = new THREE.MeshStandardMaterial({
    color: 0x5ca834,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), lettuceMat);
    leaf.scale.set(0.22, 0.92, 0.92);
    leaf.position.set(-0.02 + (i % 2) * 0.015, 0.125, -0.20 + i * 0.135);
    leaf.rotation.set(0.18 * (i - 1.5), 0.25 * (i % 2 ? 1 : -1), 0.20);
    bentoGroup.add(leaf);
  }

  // Glossy cherry tomatoes (upper-right of bento)
  const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xd9241b, roughness: 0.12, metalness: 0.04 });
  [
    [0.20, 0.105, -0.25],
    [0.35, 0.10, -0.20],
  ].forEach(([tx, ty, tz]) => {
    const tom = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 14), tomatoMat);
    tom.position.set(tx, ty, tz);
    tom.castShadow = true;
    bentoGroup.add(tom);
  });

  // Cute broccoli floret tucked beside tomatoes
  const brocMat = new THREE.MeshStandardMaterial({ color: 0x2f752b, roughness: 0.72 });
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), brocMat);
    const a = (i / 5) * Math.PI * 2;
    f.position.set(0.09 + Math.cos(a) * 0.032, 0.125 + (i % 2) * 0.015, -0.24 + Math.sin(a) * 0.032);
    bentoGroup.add(f);
  }

  // Cute Red Octopus Wiener Sausage (タコさんウインナー!)
  const wienerGroup = new THREE.Group();
  wienerGroup.position.set(0.46, 0.10, -0.05);
  wienerGroup.rotation.set(0.2, -0.4, 0.15);
  bentoGroup.add(wienerGroup);
  const wienerMat = new THREE.MeshStandardMaterial({ color: 0xc93a2b, roughness: 0.24 });
  const wHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.055, 8, 12), wienerMat);
  wHead.position.y = 0.03;
  wienerGroup.add(wHead);
  for (let l = 0; l < 6; l++) {
    const a = (l / 6) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 6, 8), wienerMat);
    leg.position.set(Math.cos(a) * 0.042, -0.018, Math.sin(a) * 0.042);
    leg.rotation.z = -Math.cos(a) * 0.65;
    leg.rotation.x = Math.sin(a) * 0.65;
    wienerGroup.add(leg);
  }

  // Inviting open tamagoyaki slots centered cleanly inside the parchment cup on lower-right!
  kitchen.bentoSlots = [
    new THREE.Vector3(0.18, 0.125, 0.06),
    new THREE.Vector3(0.35, 0.125, 0.08),
    new THREE.Vector3(0.19, 0.125, 0.24),
    new THREE.Vector3(0.35, 0.125, 0.23),
    new THREE.Vector3(0.27, 0.245, 0.15), // 5th piece cozy nested on top!
  ];

  // Subtle parchment paper bento cup lining the open tamagoyaki space (visual "fill me!" affordance)
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xfbf4e4,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const bentoCup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.06, 20, 1, true), cupMat);
  bentoCup.scale.set(1.22, 1, 0.96);
  bentoCup.position.set(0.26, 0.065, 0.15);
  bentoGroup.add(bentoCup);

  const bentoHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.34, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bentoHit.position.y = 0.16;
  bentoGroup.add(bentoHit);
  registerHit(bentoHit, { hitType: 'bento' });

  // Playful Red Ketchup Squeeze Bottle clearly visible beside bento without touching rim!
  const ketchupGroup = new THREE.Group();
  ketchupGroup.position.set(3.46, 0.0, 0.44);
  scene.add(ketchupGroup);
  kitchen.ketchupGroup = ketchupGroup;

  const kBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.082, 0.26, 18),
    new THREE.MeshStandardMaterial({ color: 0xd92b24, roughness: 0.24 })
  );
  kBody.position.y = 0.13;
  kBody.castShadow = true;
  ketchupGroup.add(kBody);
  const kLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.076, 0.080, 0.09, 18),
    new THREE.MeshStandardMaterial({ color: 0xfbf3df, roughness: 0.65 })
  );
  kLabel.position.y = 0.13;
  ketchupGroup.add(kLabel);
  const kNozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.038, 0.095, 14),
    new THREE.MeshStandardMaterial({ color: 0xec3b30, roughness: 0.28 })
  );
  kNozzle.position.y = 0.305;
  ketchupGroup.add(kNozzle);
  const kHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.38, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  kHit.position.y = 0.18;
  ketchupGroup.add(kHit);
  registerHit(kHit, { hitType: 'ketchup' });

  // Cute Wooden Bento Flag Picks Cup beside bento
  const picksGroup = new THREE.Group();
  picksGroup.position.set(3.26, 0.0, -0.22);
  scene.add(picksGroup);
  kitchen.picksGroup = picksGroup;
  const pCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.056, 0.12, 16),
    new THREE.MeshStandardMaterial({ map: bowlCeramicTex, roughness: 0.28 })
  );
  pCup.position.y = 0.06;
  pCup.castShadow = true;
  picksGroup.add(pCup);
  const pCols = [0xe85a4f, 0x4ea86a, 0xf2a93b];
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.004, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0xe6c89a, roughness: 0.6 })
    );
    st.position.set((i - 1) * 0.022, 0.14, (i % 2 - 0.5) * 0.02);
    st.rotation.z = (i - 1) * 0.16;
    picksGroup.add(st);
    const fl = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.04, 0.006),
      new THREE.MeshStandardMaterial({ color: pCols[i], roughness: 0.55 })
    );
    fl.position.set((i - 1) * 0.036 + 0.026, 0.23, (i % 2 - 0.5) * 0.02);
    picksGroup.add(fl);
  }
  const pHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.30, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pHit.position.y = 0.14;
  picksGroup.add(pHit);
  registerHit(pHit, { hitType: 'picks' });

  // Fresh Replay Egg Basket (slides into Zone 3 left after tasting so tapping fresh eggs replays seamlessly with zero text!)
  const replayBasket = new THREE.Group();
  replayBasket.position.set(1.36, 0.0, 0.36);
  replayBasket.visible = false;
  scene.add(replayBasket);
  kitchen.replayBasket = replayBasket;

  const basketRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.20, 0.13, 22),
    new THREE.MeshStandardMaterial({ map: bentoWoodTex.map, roughness: 0.72 })
  );
  basketRim.position.y = 0.065;
  basketRim.castShadow = true;
  replayBasket.add(basketRim);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const eMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 16, 14),
      new THREE.MeshStandardMaterial({ color: eggColors[i], roughness: 0.45 })
    );
    eMesh.scale.set(1, 1.32, 1);
    eMesh.position.set(Math.cos(a) * 0.095, 0.155, Math.sin(a) * 0.095);
    eMesh.castShadow = true;
    replayBasket.add(eMesh);
  }
  const replayHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.30, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  replayHit.position.y = 0.14;
  replayBasket.add(replayHit);
  registerHit(replayHit, { hitType: 'replayEggs' });

  return kitchen;
}
