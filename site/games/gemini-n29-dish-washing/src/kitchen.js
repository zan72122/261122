import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import {
  createBrushedSteelTextures,
  createSubwayTileTextures,
  createWoodCounterTextures,
  createSpongeTextures,
  createWindowGardenTexture,
  createDetergentLabelTexture,
} from './textures.js';

export function createKitchen(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const steelTex = createBrushedSteelTextures();
  const tileTex = createSubwayTileTextures();
  const woodTex = createWoodCounterTextures();
  const spongeTex = createSpongeTextures();
  const gardenTex = createWindowGardenTexture();
  const labelTex = createDetergentLabelTexture();

  // Materials
  const steelMat = new THREE.MeshStandardMaterial({
    map: steelTex.map,
    roughnessMap: steelTex.roughnessMap,
    color: 0xbac2ca,
    metalness: 0.82,
    roughness: 0.36,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fa,
    metalness: 0.96,
    roughness: 0.08,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.004,
    roughness: 0.44,
    metalness: 0.02,
  });

  const tileMat = new THREE.MeshStandardMaterial({
    map: tileTex.map,
    bumpMap: tileTex.bumpMap,
    bumpScale: 0.008,
    roughnessMap: tileTex.roughnessMap,
    roughness: 0.25,
    metalness: 0.04,
  });

  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0xf0ebe3,
    roughness: 0.55,
    metalness: 0.02,
  });

  // ------------------------------------------------------------------
  // 1. Countertop with real recessed stainless sink opening
  // Sink opening: x in [-0.43, 0.43], z in [-0.28, 0.28], depth = 0.24
  // ------------------------------------------------------------------
  const counterThick = 0.042;
  const sinkW = 0.86;
  const sinkD = 0.56;
  const sinkDepth = 0.24;

  const counterParts = [
    // Left counter slab
    { w: 1.3, d: 1.06, x: -0.43 - 0.65, z: 0.02 },
    // Right counter slab (supports dish rack)
    { w: 1.3, d: 1.06, x: 0.43 + 0.65, z: 0.02 },
    // Back counter strip behind sink
    { w: sinkW, d: 0.26, x: 0, z: -0.28 - 0.13 },
    // Front counter strip in front of sink
    { w: sinkW, d: 0.27, x: 0, z: 0.28 + 0.135 },
  ];

  for (const p of counterParts) {
    const geo = new RoundedBoxGeometry(p.w, counterThick, p.d, 2, 0.007);
    const mesh = new THREE.Mesh(geo, woodMat);
    mesh.position.set(p.x, -counterThick * 0.5, p.z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);
  }

  // Lower cabinet front panel
  const cabinetFront = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 0.1), cabinetMat);
  cabinetFront.position.set(0, -0.49, 0.46);
  cabinetFront.receiveShadow = true;
  root.add(cabinetFront);

  // Stainless steel sink basin (4 walls + bottom + rim flange)
  const sinkGroup = new THREE.Group();
  root.add(sinkGroup);

  const wallThick = 0.018;
  // Bottom
  const sinkBottom = new THREE.Mesh(new THREE.BoxGeometry(sinkW + 0.04, wallThick, sinkD + 0.04), steelMat);
  sinkBottom.position.set(0, -sinkDepth - wallThick * 0.5, 0);
  sinkBottom.receiveShadow = true;
  sinkGroup.add(sinkBottom);

  // Back wall (slightly recessed below rim so zero z-fighting with countertop!)
  const sinkBack = new THREE.Mesh(new THREE.BoxGeometry(sinkW + 0.02, sinkDepth + 0.008, wallThick), steelMat);
  sinkBack.position.set(0, -sinkDepth * 0.5 - 0.006, -sinkD * 0.5 - wallThick * 0.5 + 0.004);
  sinkBack.receiveShadow = true;
  sinkGroup.add(sinkBack);

  // Front wall
  const sinkFront = new THREE.Mesh(new THREE.BoxGeometry(sinkW + 0.02, sinkDepth + 0.008, wallThick), steelMat);
  sinkFront.position.set(0, -sinkDepth * 0.5 - 0.006, sinkD * 0.5 + wallThick * 0.5 - 0.004);
  sinkFront.receiveShadow = true;
  sinkGroup.add(sinkFront);

  // Left wall
  const sinkLeft = new THREE.Mesh(new THREE.BoxGeometry(wallThick, sinkDepth + 0.008, sinkD + 0.01), steelMat);
  sinkLeft.position.set(-sinkW * 0.5 - wallThick * 0.5 + 0.004, -sinkDepth * 0.5 - 0.006, 0);
  sinkLeft.receiveShadow = true;
  sinkGroup.add(sinkLeft);

  // Right wall
  const sinkRight = new THREE.Mesh(new THREE.BoxGeometry(wallThick, sinkDepth + 0.008, sinkD + 0.01), steelMat);
  sinkRight.position.set(sinkW * 0.5 + wallThick * 0.5 - 0.004, -sinkDepth * 0.5 - 0.006, 0);
  sinkRight.receiveShadow = true;
  sinkGroup.add(sinkRight);

  // Raised stainless rim flange overlapping sink edge cleanly (no seam!)
  const rimThick = 0.011;
  const rimWidth = 0.036;
  const rims = [
    { w: sinkW + rimWidth * 2 - 0.012, d: rimWidth, x: 0, z: -sinkD * 0.5 - rimWidth * 0.5 + 0.008 },
    { w: sinkW + rimWidth * 2 - 0.012, d: rimWidth, x: 0, z: sinkD * 0.5 + rimWidth * 0.5 - 0.008 },
    { w: rimWidth, d: sinkD + 0.004, x: -sinkW * 0.5 - rimWidth * 0.5 + 0.008, z: 0 },
    { w: rimWidth, d: sinkD + 0.004, x: sinkW * 0.5 + rimWidth * 0.5 - 0.008, z: 0 },
  ];
  for (const r of rims) {
    const rm = new THREE.Mesh(new RoundedBoxGeometry(r.w, rimThick, r.d, 2, 0.004), steelMat);
    rm.position.set(r.x, rimThick * 0.45, r.z);
    rm.receiveShadow = true;
    sinkGroup.add(rm);
  }

  // Drain strainer in sink bottom (center-back)
  const drainPos = new THREE.Vector3(0.0, -sinkDepth + 0.002, -0.09);
  const drainOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.052, 0.008, 28), chromeMat);
  drainOuter.position.copy(drainPos);
  sinkGroup.add(drainOuter);

  const drainHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.009, 24),
    new THREE.MeshStandardMaterial({ color: 0x1b2025, roughness: 0.7, metalness: 0.4 })
  );
  drainHole.position.copy(drainPos);
  drainHole.position.y += 0.001;
  sinkGroup.add(drainHole);

  // Strainer cross bars
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.003, 0.006), chromeMat);
    bar.position.copy(drainPos);
    bar.position.y += 0.0055;
    bar.rotation.y = (i * Math.PI) / 4;
    sinkGroup.add(bar);
  }

  // Interactive Rubber Drain Plug (starts resting on sink bottom right next to drain, tap to plug/unplug!)
  const drainPlugGroup = new THREE.Group();
  const plugOpenPos = new THREE.Vector3(-0.22, -sinkDepth + 0.011, -0.15);
  const plugClosedPos = new THREE.Vector3(drainPos.x, -sinkDepth + 0.011, drainPos.z);
  drainPlugGroup.position.copy(plugOpenPos);

  const plugRubberMat = new THREE.MeshStandardMaterial({
    color: 0x3b8f9c,
    roughness: 0.52,
    metalness: 0.04,
  });
  const plugDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.02, 24), plugRubberMat);
  plugDisc.castShadow = true;
  plugDisc.receiveShadow = true;
  drainPlugGroup.add(plugDisc);

  const plugLip = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.005, 10, 24), plugRubberMat);
  plugLip.rotation.x = Math.PI / 2;
  plugLip.position.y = 0.007;
  drainPlugGroup.add(plugLip);

  // Chrome pull ring on top of drain plug (clear affordance!)
  const plugRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 10, 20), chromeMat);
  plugRing.position.set(0, 0.022, 0);
  plugRing.rotation.x = 0.25;
  plugRing.castShadow = true;
  drainPlugGroup.add(plugRing);

  // Invisible generous hit target for small fingers
  const plugHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  plugHit.userData.interactive = 'drainPlug';
  drainPlugGroup.add(plugHit);
  sinkGroup.add(drainPlugGroup);

  // Also allow tapping directly on the drain hole itself to toggle plug
  const drainHoleHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  drainHoleHit.position.copy(drainPos);
  drainHoleHit.userData.interactive = 'drainPlug';
  sinkGroup.add(drainHoleHit);

  // ------------------------------------------------------------------
  // 2. Open Kitchen Backdrop (Peninsula counter + Side tile walls + Bright window)
  // ------------------------------------------------------------------
  const backdropGroup = new THREE.Group();
  root.add(backdropGroup);

  // Raised dining peninsula bar behind sink (low enough so Mama stands clearly behind it)
  const barWall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 0.08), tileMat);
  barWall.position.set(0, 0.07, -0.52);
  barWall.receiveShadow = true;
  backdropGroup.add(barWall);

  const barCap = new THREE.Mesh(new RoundedBoxGeometry(3.84, 0.032, 0.18, 2, 0.006), woodMat);
  barCap.position.set(0, 0.148, -0.56);
  barCap.receiveShadow = true;
  barCap.castShadow = true;
  backdropGroup.add(barCap);

  // Side subway-tile walls framing the kitchen nicely
  const leftTileWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 2.6), tileMat);
  leftTileWall.position.set(-1.55, 0.75, -0.4);
  leftTileWall.receiveShadow = true;
  backdropGroup.add(leftTileWall);

  const rightTileWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 2.6), tileMat);
  rightTileWall.position.set(1.55, 0.75, -0.4);
  rightTileWall.receiveShadow = true;
  backdropGroup.add(rightTileWall);

  // Distant warm kitchen / dining room back wall with a large bright sunlit garden window
  const backWallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.85 });
  const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), backWallMat);
  backWallLeft.position.set(-1.55, 0.85, -1.75);
  backdropGroup.add(backWallLeft);

  const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), backWallMat);
  backWallRight.position.set(1.55, 0.85, -1.75);
  backdropGroup.add(backWallRight);

  const backWallBottom = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.12), backWallMat);
  backWallBottom.position.set(0, -0.1, -1.75);
  backdropGroup.add(backWallBottom);

  const backWallTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 0.12), backWallMat);
  backWallTop.position.set(0, 1.75, -1.75);
  backdropGroup.add(backWallTop);

  // Sunlit window garden view
  const windowView = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 1.35),
    new THREE.MeshBasicMaterial({ map: gardenTex })
  );
  windowView.position.set(0, 0.88, -1.82);
  backdropGroup.add(windowView);

  // Wooden cutting board & ceramic utensil crock on back right bar for warm real-kitchen atmosphere
  const cutBoard = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.018, 0.16, 2, 0.005), woodMat);
  cutBoard.position.set(0.64, 0.25, -0.62);
  cutBoard.rotation.x = 1.35;
  cutBoard.rotation.z = -0.06;
  cutBoard.castShadow = true;
  backdropGroup.add(cutBoard);

  // White wood window frame & mullions
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.35, 0.06), frameMat);
  vMullion.position.set(0, 0.88, -1.76);
  backdropGroup.add(vMullion);
  const hMullion = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.045, 0.06), frameMat);
  hMullion.position.set(0, 0.96, -1.76);
  backdropGroup.add(hMullion);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.05, 0.16), frameMat);
  sill.position.set(0, 0.24, -1.72);
  backdropGroup.add(sill);

  // Small potted kitchen herb plant on far right bar corner (adds homey realism without clutter)
  const potGroup = new THREE.Group();
  potGroup.position.set(0.98, 0.164, -0.56);
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.044, 0.095, 18),
    new THREE.MeshStandardMaterial({ color: 0xc87a57, roughness: 0.72 })
  );
  pot.position.y = 0.048;
  pot.castShadow = true;
  potGroup.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x45843c, roughness: 0.55 });
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), leafMat);
    leaf.scale.set(0.65, 1.3, 0.45);
    leaf.position.set(Math.cos(ang) * 0.035, 0.115 + (i % 3) * 0.022, Math.sin(ang) * 0.035);
    leaf.rotation.set(0.35, ang, 0.3);
    leaf.castShadow = true;
    potGroup.add(leaf);
  }
  backdropGroup.add(potGroup);

  // ------------------------------------------------------------------
  // 3. Chrome Gooseneck Kitchen Faucet & Interactive Lever
  // ------------------------------------------------------------------
  const faucetGroup = new THREE.Group();
  faucetGroup.position.set(0.0, 0.0, -0.35);
  root.add(faucetGroup);

  // Base escutcheon & pillar
  const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.052, 0.028, 28), chromeMat);
  faucetBase.position.y = 0.014;
  faucetBase.castShadow = true;
  faucetGroup.add(faucetBase);

  const faucetBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.14, 24), chromeMat);
  faucetBody.position.y = 0.085;
  faucetBody.castShadow = true;
  faucetGroup.add(faucetBody);

  // Curved gooseneck spout reaching over the center dish
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.13, 0),
    new THREE.Vector3(0, 0.34, 0.01),
    new THREE.Vector3(0, 0.44, 0.14),
    new THREE.Vector3(0, 0.42, 0.26),
    new THREE.Vector3(0, 0.34, 0.31),
  ]);
  const spoutGeo = new THREE.TubeGeometry(spoutCurve, 32, 0.016, 16, false);
  const spoutMesh = new THREE.Mesh(spoutGeo, chromeMat);
  spoutMesh.castShadow = true;
  faucetGroup.add(spoutMesh);

  // Aerator nozzle tip
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.018, 0.032, 20), chromeMat);
  nozzle.position.set(0, 0.33, 0.312);
  nozzle.rotation.x = 0.14;
  nozzle.castShadow = true;
  faucetGroup.add(nozzle);

  // World position where water exits the faucet
  const waterNozzleWorld = new THREE.Vector3(0, 0.316, -0.35 + 0.315);

  // Interactive Lever Handle (right side of faucet, big and unmistakable)
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.032, 0.095, 0.0);
  faucetGroup.add(leverPivot);

  const leverJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.042, 18), chromeMat);
  leverJoint.rotation.z = Math.PI / 2;
  leverJoint.position.x = 0.018;
  leverPivot.add(leverJoint);

  // Curved thick lever arm + vivid water-blue collar ring so kids spot it instantly
  const leverArm = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.022, 0.024, 2, 0.008), chromeMat);
  leverArm.position.set(0.072, 0.0, 0.018);
  leverArm.rotation.y = -0.22;
  leverArm.castShadow = true;
  leverPivot.add(leverArm);

  const leverTipBlue = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 14, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0x2ca9e8,
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 1.0,
    })
  );
  leverTipBlue.position.set(0.125, 0.0, 0.03);
  leverPivot.add(leverTipBlue);

  // Generous invisible hitbox covering faucet lever & head
  const faucetHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.32, 0.24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  faucetHit.position.set(0.08, 0.18, 0.12);
  faucetHit.userData.interactive = 'faucet';
  faucetGroup.add(faucetHit);

  // ------------------------------------------------------------------
  // 4. Dish Detergent Bottle (Translucent emerald liquid + white pump)
  // ------------------------------------------------------------------
  const soapBottleGroup = new THREE.Group();
  soapBottleGroup.position.set(-0.52, 0.0, 0.02);
  root.add(soapBottleGroup);

  const bottleLiquidMat = new THREE.MeshPhysicalMaterial({
    color: 0x45cc6d,
    roughness: 0.12,
    metalness: 0.0,
    transmission: 0.55,
    thickness: 0.12,
    ior: 1.38,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
  });

  // Ergonomic bottle body (LatheGeometry for smooth realistic silhouette)
  const bottlePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.056, 0.0),
    new THREE.Vector2(0.062, 0.02),
    new THREE.Vector2(0.064, 0.13),
    new THREE.Vector2(0.056, 0.19),
    new THREE.Vector2(0.03, 0.225),
    new THREE.Vector2(0.024, 0.245),
    new THREE.Vector2(0.0, 0.245),
  ];
  const bottleBody = new THREE.Mesh(new THREE.LatheGeometry(bottlePts, 28), bottleLiquidMat);
  bottleBody.castShadow = true;
  bottleBody.receiveShadow = true;
  soapBottleGroup.add(bottleBody);

  // Front label wrap (wordless citrus + bubbles)
  const labelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0645, 0.063, 0.105, 24, 1, true, -0.75, 1.5),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.35 })
  );
  labelMesh.position.y = 0.095;
  labelMesh.rotation.y = 0.2;
  soapBottleGroup.add(labelMesh);

  // White collar
  const pumpPlasticMat = new THREE.MeshStandardMaterial({ color: 0xfafbf9, roughness: 0.24 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.03, 20), pumpPlasticMat);
  collar.position.y = 0.252;
  collar.castShadow = true;
  soapBottleGroup.add(collar);

  // Pressable Pump Head (points right toward sponge!)
  const pumpHead = new THREE.Group();
  pumpHead.position.set(0, 0.285, 0);
  soapBottleGroup.add(pumpHead);

  const pumpStem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.042, 16), pumpPlasticMat);
  pumpStem.position.y = -0.01;
  pumpHead.add(pumpStem);

  const pumpCap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.023, 0.024, 20), pumpPlasticMat);
  pumpCap.position.y = 0.016;
  pumpCap.castShadow = true;
  pumpHead.add(pumpCap);

  // Spout pointing right-front toward sponge
  const pumpNozzle = new THREE.Mesh(new RoundedBoxGeometry(0.088, 0.016, 0.018, 2, 0.005), pumpPlasticMat);
  pumpNozzle.position.set(0.042, 0.015, 0.016);
  pumpNozzle.rotation.y = -0.35;
  pumpNozzle.rotation.z = -0.14;
  pumpNozzle.castShadow = true;
  pumpHead.add(pumpNozzle);

  // Green soap bead peeking at nozzle tip
  const nozzleDrop = new THREE.Mesh(
    new THREE.SphereGeometry(0.0085, 12, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x4ee076, roughness: 0.08, clearcoat: 1.0 })
  );
  nozzleDrop.position.set(0.081, 0.005, 0.031);
  pumpHead.add(nozzleDrop);

  // Generous soap bottle hitbox
  const soapHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.38, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  soapHit.position.y = 0.18;
  soapHit.userData.interactive = 'soapBottle';
  soapBottleGroup.add(soapHit);

  // ------------------------------------------------------------------
  // 5. Realistic Two-Layer Dish Sponge (Yellow porous foam + green scrub pad)
  // ------------------------------------------------------------------
  const spongeHomePos = new THREE.Vector3(-0.34, 0.032, 0.25);
  const spongeGroup = new THREE.Group();
  spongeGroup.position.copy(spongeHomePos);
  root.add(spongeGroup);

  // Small stainless sponge holder tray on front-left rim
  const spongeTray = new THREE.Mesh(
    new RoundedBoxGeometry(0.185, 0.01, 0.13, 2, 0.004),
    steelMat
  );
  spongeTray.position.set(spongeHomePos.x, 0.006, spongeHomePos.z);
  spongeTray.receiveShadow = true;
  root.add(spongeTray);

  const spongeMeshGroup = new THREE.Group();
  spongeGroup.add(spongeMeshGroup);

  const yellowSpongeMat = new THREE.MeshStandardMaterial({
    map: spongeTex.yMap,
    bumpMap: spongeTex.yBumpMap,
    bumpScale: 0.012,
    roughness: 0.92,
    metalness: 0.0,
  });

  const greenPadMat = new THREE.MeshStandardMaterial({
    map: spongeTex.gMap,
    bumpMap: spongeTex.gBumpMap,
    bumpScale: 0.014,
    roughness: 0.96,
    metalness: 0.0,
  });

  const yellowLayer = new THREE.Mesh(
    new RoundedBoxGeometry(0.145, 0.038, 0.098, 3, 0.01),
    yellowSpongeMat
  );
  yellowLayer.position.y = 0.012;
  yellowLayer.castShadow = true;
  yellowLayer.receiveShadow = true;
  spongeMeshGroup.add(yellowLayer);

  const greenLayer = new THREE.Mesh(
    new RoundedBoxGeometry(0.147, 0.016, 0.10, 2, 0.005),
    greenPadMat
  );
  greenLayer.position.y = -0.012;
  greenLayer.castShadow = true;
  greenLayer.receiveShadow = true;
  spongeMeshGroup.add(greenLayer);

  // Glossy green soap puddle on top of sponge (scales up when detergent is pumped!)
  const soapPuddle = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 16, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0x52e078,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.85,
    })
  );
  soapPuddle.scale.set(1.2, 0.25, 0.9);
  soapPuddle.position.set(0, 0.031, 0);
  soapPuddle.visible = false;
  spongeMeshGroup.add(soapPuddle);

  // Generous sponge hitbox
  const spongeHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.18),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  spongeHit.userData.interactive = 'sponge';
  spongeGroup.add(spongeHit);

  // ------------------------------------------------------------------
  // 6. Stainless Wire Dish Drying Rack (Right side — visible goal!)
  // ------------------------------------------------------------------
  const rackGroup = new THREE.Group();
  rackGroup.position.set(0.64, 0.0, -0.02);
  root.add(rackGroup);

  const trayMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f7,
    roughness: 0.24,
    metalness: 0.04,
  });

  // Drainboard tray under rack
  const rackTray = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.016, 0.48, 2, 0.006), trayMat);
  rackTray.position.y = 0.008;
  rackTray.receiveShadow = true;
  rackTray.castShadow = true;
  rackGroup.add(rackTray);

  // Lip draining water back toward sink
  const drainLip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.12), trayMat);
  drainLip.position.set(-0.23, 0.011, 0.0);
  drainLip.rotation.z = 0.1;
  rackGroup.add(drainLip);

  const wireGeoH = new THREE.CylinderGeometry(0.0045, 0.0045, 0.39, 8);
  const wireGeoD = new THREE.CylinderGeometry(0.0045, 0.0045, 0.44, 8);
  const wirePost = new THREE.CylinderGeometry(0.0055, 0.0055, 0.14, 8);

  // 4 corner posts
  const corners = [
    [-0.19, -0.21],
    [0.19, -0.21],
    [-0.19, 0.21],
    [0.19, 0.21],
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(wirePost, chromeMat);
    post.position.set(cx, 0.082, cz);
    post.castShadow = true;
    rackGroup.add(post);
  }

  // Top & bottom perimeter rails
  for (const ry of [0.028, 0.148]) {
    for (const rz of [-0.21, 0.21]) {
      const rail = new THREE.Mesh(wireGeoH, chromeMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, ry, rz);
      rackGroup.add(rail);
    }
    for (const rx of [-0.19, 0.19]) {
      const rail = new THREE.Mesh(wireGeoD, chromeMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(rx, ry, 0);
      rackGroup.add(rail);
    }
  }

  // Plate divider arches (creates clear visual slots for clean dishes!)
  const slotPositions = [];
  for (let i = 0; i < 6; i++) {
    const zPos = -0.17 + i * 0.068;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.004, 8, 16, Math.PI), chromeMat);
    arch.position.set(-0.02, 0.028, zPos);
    arch.scale.set(2.4, 1.65, 1.0);
    rackGroup.add(arch);

    if (i < 5) {
      slotPositions.push(new THREE.Vector3(0.64 - 0.01, 0.155, -0.02 + zPos + 0.034));
    }
  }

  // Bottom support wires
  for (let i = -3; i <= 3; i++) {
    const w = new THREE.Mesh(wireGeoD, chromeMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(i * 0.052, 0.024, 0);
    rackGroup.add(w);
  }

  // Generous rack hitbox for dropping/tapping clean dishes
  const rackHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.34, 0.54),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  rackHit.position.set(0, 0.15, 0);
  rackHit.userData.interactive = 'dishRack';
  rackGroup.add(rackHit);

  // Helper to get world position of soap pump tip
  function getSoapNozzleWorld(out = new THREE.Vector3()) {
    nozzleDrop.getWorldPosition(out);
    return out;
  }

  return {
    root,
    sinkGroup,
    sinkBounds: {
      minX: -sinkW * 0.5,
      maxX: sinkW * 0.5,
      minZ: -sinkD * 0.5,
      maxZ: sinkD * 0.5,
      bottomY: -sinkDepth,
      rimY: 0,
    },
    drainPos,
    drainPlugGroup,
    plugOpenPos,
    plugClosedPos,
    faucetGroup,
    leverPivot,
    waterNozzleWorld,
    soapBottleGroup,
    pumpHead,
    nozzleDrop,
    getSoapNozzleWorld,
    spongeGroup,
    spongeMeshGroup,
    spongeHomePos,
    soapPuddle,
    rackGroup,
    slotPositions,
  };
}
