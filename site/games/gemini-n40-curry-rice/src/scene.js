import * as THREE from '../vendor/three.module.js';

// =========================================================================
// EVENING SUNLIT JAPANESE HOME KITCHEN ENVIRONMENT
// - Low-angle warm western sunlight streaming from left window with wooden blind slats
// - Brushed stainless-steel counter, solid hinoki cutting board, glazed tile backsplash
// - Gas stove burner with flickering realistic blue/orange flame ring + cast-iron Dutch oven
// - Glass water carafe, wooden spice shelf, woven veggie basket (for physical zero-text replay!)
// - Drifting golden dust motes & volumetric western sunbeam shafts
// =========================================================================

export function buildKitchenEnvironment(scene, textures) {
  const envGroup = new THREE.Group();
  scene.add(envGroup);

  // -----------------------------------------------------------------------
  // 1. EVENING WESTERN SUNLIGHT RIG (signature warm-key / cool-dusk-fill!)
  // -----------------------------------------------------------------------
  // Low golden western sun pouring from left-back kitchen window
  const sunLight = new THREE.DirectionalLight(0xff9f4a, 3.6);
  sunLight.position.set(-2.35, 1.05, -0.65);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 5.2;
  const d = 0.85;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.015;
  scene.add(sunLight);

  // Soft warm golden kitchen pendant fill from overhead (keeps hands & pot interior richly readable)
  const kitchenLight = new THREE.PointLight(0xffd2a0, 1.35, 3.2, 1.5);
  kitchenLight.position.set(0.12, 0.92, 0.16);
  scene.add(kitchenLight);

  // Cool dusty-twilight bounce from kitchen room on right/front (photographic color contrast!)
  const hemiLight = new THREE.HemisphereLight(0xffbe88, 0x3b4158, 0.72);
  scene.add(hemiLight);

  const coolFill = new THREE.DirectionalLight(0x98b0dc, 0.55);
  coolFill.position.set(1.6, 0.9, 1.5);
  scene.add(coolFill);

  // Warm under-pot gas flame glow light (dynamically animated when stove is on!)
  const flameGlow = new THREE.PointLight(0xff7722, 0.0, 0.75, 2.0);
  flameGlow.position.set(0.24, 0.03, -0.08);
  scene.add(flameGlow);

  // -----------------------------------------------------------------------
  // 2. COUNTERTOP, BACKSPLASH & WESTERN WINDOW WITH BLIND SLATS
  // -----------------------------------------------------------------------
  // Brushed stainless-steel Japanese kitchen counter
  const counterMat = new THREE.MeshStandardMaterial({
    map: textures.stainless.map,
    roughnessMap: textures.stainless.roughnessMap,
    bumpMap: textures.stainless.bumpMap,
    bumpScale: 0.0012,
    metalness: 0.78,
    roughness: 0.36,
  });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 1.35), counterMat);
  counter.position.set(0, -0.03, 0.02);
  counter.receiveShadow = true;
  envGroup.add(counter);

  // Raised stainless backsplash lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.045, 0.03), counterMat);
  lip.position.set(0, 0.022, -0.52);
  lip.receiveShadow = true;
  envGroup.add(lip);

  // Ceramic subway-tile kitchen wall
  const tileMat = new THREE.MeshStandardMaterial({
    map: textures.tile.map,
    bumpMap: textures.tile.bumpMap,
    bumpScale: 0.004,
    roughnessMap: textures.tile.roughnessMap,
    roughness: 0.28,
    metalness: 0.02,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), tileMat);
  backWall.position.set(0, 0.72, -0.535);
  backWall.receiveShadow = true;
  envGroup.add(backWall);

  // Left wall with glowing sunset window & wooden slats casting real evening shadow bars!
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), tileMat);
  sideWall.position.set(-1.18, 0.72, 0.05);
  sideWall.rotation.y = Math.PI * 0.5;
  sideWall.receiveShadow = true;
  envGroup.add(sideWall);

  // Glowing golden sunset sky pane in the left window
  const windowPane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.85),
    new THREE.MeshBasicMaterial({ color: 0xffb15c })
  );
  windowPane.position.set(-1.16, 0.56, -0.06);
  windowPane.rotation.y = Math.PI * 0.5;
  envGroup.add(windowPane);

  // Wooden window frame & venetian blind slats (casts crisp dappled western light onto counter & wall!)
  const woodFrameMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a22,
    map: textures.wood.map,
    roughness: 0.65,
  });
  const slatGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.96), woodFrameMat);
    slat.position.set(-1.10, 0.24 + i * 0.125, -0.06);
    slat.rotation.z = 0.22;
    slat.castShadow = true;
    slatGroup.add(slat);
  }
  envGroup.add(slatGroup);

  // Soft edge-faded volumetric golden sunset light shafts (ZERO rectangular plane edges!)
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 128;
  beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d');
  const bg = bctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  bg.addColorStop(0, 'rgba(255, 185, 105, 1.0)');
  bg.addColorStop(0.55, 'rgba(255, 165, 80, 0.35)');
  bg.addColorStop(1, 'rgba(255, 150, 65, 0.0)');
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 128, 128);
  const beamTex = new THREE.CanvasTexture(beamCanvas);

  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.38), beamMat);
    beam.position.set(-0.32 + i * 0.18, 0.36 - i * 0.06, -0.18 + i * 0.14);
    beam.rotation.set(0.2, 0.35, -0.34);
    envGroup.add(beam);
  }

  // Soft circular bokeh dust motes drifting lazily in the golden sunset shafts (NEVER hard squares!)
  const moteCount = 38;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 1.1;
    motePos[i * 3 + 1] = 0.08 + Math.random() * 0.48;
    motePos[i * 3 + 2] = -0.32 + Math.random() * 0.60;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    map: beamTex,
    color: 0xffd698,
    size: 0.015,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  envGroup.add(dustMotes);

  // -----------------------------------------------------------------------
  // 3. LIVED-IN JAPANESE KITCHEN BACKGROUND DETAILS (wooden shelf, spice jars, oil bottle)
  // -----------------------------------------------------------------------
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.024, 0.14), woodFrameMat);
  shelf.position.set(0.05, 0.42, -0.45);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  envGroup.add(shelf);

  // Small ceramic salt/spice jars & amber glass oil bottle on shelf
  const jarColors = [0xd8c9b0, 0x9c4b2d, 0x455847, 0xd4a448];
  jarColors.forEach((col, i) => {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.028, 0.068 + (i % 2) * 0.018, 14),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.28, clearcoat: 0.6 })
    );
    jar.position.set(-0.34 + i * 0.11, 0.468, -0.44);
    jar.castShadow = true;
    envGroup.add(jar);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 12), woodFrameMat);
    lid.position.set(-0.34 + i * 0.11, 0.508 + (i % 2) * 0.009, -0.44);
    envGroup.add(lid);
  });

  // Smooth sculpted dark-amber glass olive/sesame oil bottle with wooden cork!
  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a1c07,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const bottlePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.031, 0.0),
    new THREE.Vector2(0.032, 0.012),
    new THREE.Vector2(0.030, 0.115),
    new THREE.Vector2(0.025, 0.138),
    new THREE.Vector2(0.013, 0.158),
    new THREE.Vector2(0.011, 0.196),
    new THREE.Vector2(0.013, 0.200),
  ];
  const oilBottle = new THREE.Mesh(new THREE.LatheGeometry(bottlePts, 22), bottleMat);
  oilBottle.position.set(0.46, 0.0, -0.36);
  oilBottle.castShadow = true;
  envGroup.add(oilBottle);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0095, 0.018, 12), woodFrameMat);
  cork.position.set(0.46, 0.206, -0.36);
  envGroup.add(cork);

  // Folded woven linen kitchen cloth (fukin) resting naturally beside the workspace for lived-in warmth
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0xd9cbb6,
    map: textures.linen.map,
    bumpMap: textures.linen.bumpMap,
    bumpScale: 0.004,
    roughness: 0.92,
  });
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.010, 0.22), clothMat);
  cloth.position.set(-0.54, 0.005, 0.10);
  cloth.rotation.y = 0.12;
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  envGroup.add(cloth);

  // -----------------------------------------------------------------------
  // 4. HINOKI WOODEN CUTTING BOARD (Zone 1: left-center foreground)
  // -----------------------------------------------------------------------
  const boardGroup = new THREE.Group();
  boardGroup.position.set(-0.22, 0.0, 0.08);
  const boardMat = new THREE.MeshStandardMaterial({
    map: textures.wood.map,
    bumpMap: textures.wood.bumpMap,
    bumpScale: 0.0028,
    roughnessMap: textures.wood.roughnessMap,
    roughness: 0.72,
    metalness: 0.0,
  });
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.026, 0.27), boardMat);
  boardMesh.position.y = 0.013;
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  boardGroup.add(boardMesh);
  envGroup.add(boardGroup);

  // -----------------------------------------------------------------------
  // 5. GAS STOVE & HEAVY CAST-IRON DUTCH OVEN POT (Zone 2: right-center)
  // -----------------------------------------------------------------------
  const potCenter = new THREE.Vector3(0.24, 0.016, -0.07);
  const potRadius = 0.138;
  const potHeight = 0.118;

  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(potCenter.x, 0.0, potCenter.z);
  envGroup.add(stoveGroup);

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x262423,
    bumpMap: textures.castIron.bumpMap,
    bumpScale: 0.0024,
    roughnessMap: textures.castIron.roughnessMap,
    roughness: 0.68,
    metalness: 0.42,
  });

  // Dark enamel stove burner base plate
  const stovePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.192, 0.008, 32), ironMat);
  stovePlate.position.y = 0.004;
  stovePlate.receiveShadow = true;
  stoveGroup.add(stovePlate);

  // Iron 6-prong trivet grate (Gotoku)
  const trivetRing = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.006, 8, 24), ironMat);
  trivetRing.rotation.x = Math.PI * 0.5;
  trivetRing.position.y = 0.016;
  stoveGroup.add(trivetRing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.014, 0.008), ironMat);
    prong.position.set(Math.cos(a) * 0.125, 0.015, Math.sin(a) * 0.125);
    prong.rotation.y = -a;
    stoveGroup.add(prong);
  }

  // Animated realistic blue-with-amber-tip Gas Flame Ring under pot!
  const flameGroup = new THREE.Group();
  flameGroup.position.y = 0.013;
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x3b8bff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tipMat = new THREE.MeshBasicMaterial({
    color: 0xff8c2b,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameJets = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.0085, 0.026, 6), flameMat);
    jet.position.set(Math.cos(a) * 0.095, 0.004, Math.sin(a) * 0.095);
    jet.rotation.z = -Math.cos(a) * 0.85;
    jet.rotation.x = Math.sin(a) * 0.85;
    flameGroup.add(jet);
    flameJets.push(jet);

    if (i % 2 === 0) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.018, 5), tipMat);
      tip.position.set(Math.cos(a) * 0.108, 0.008, Math.sin(a) * 0.108);
      flameGroup.add(tip);
    }
  }
  flameGroup.visible = false;
  stoveGroup.add(flameGroup);

  // Heavy Cast-Iron Enamel Dutch Oven Pot (deep rustic terracotta-maroon outside, dark matte iron inside!)
  const potGroup = new THREE.Group();
  potGroup.position.copy(potCenter);
  envGroup.add(potGroup);

  const potOuterMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a2a24, // Deep artisanal dark bronze-charcoal enamel (looks ultra photographic!)
    bumpMap: textures.castIron.bumpMap,
    bumpScale: 0.002,
    roughness: 0.42,
    metalness: 0.25,
    clearcoat: 0.35,
    clearcoatRoughness: 0.38,
  });
  const potInnerMat = new THREE.MeshStandardMaterial({
    color: 0x2a2725,
    bumpMap: textures.castIron.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.52,
    metalness: 0.22,
    side: THREE.BackSide,
  });
  const potRimMat = new THREE.MeshStandardMaterial({
    color: 0x4b4440,
    roughness: 0.48,
    metalness: 0.45,
  });

  // Outer pot wall
  const outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(potRadius, potRadius * 0.94, potHeight, 36, 1, true),
    potOuterMat
  );
  outerWall.position.y = potHeight * 0.5;
  outerWall.castShadow = true;
  outerWall.receiveShadow = true;
  potGroup.add(outerWall);

  // Inner pot wall
  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(potRadius - 0.007, potRadius * 0.94 - 0.007, potHeight, 36, 1, true),
    potInnerMat
  );
  innerWall.position.y = potHeight * 0.5;
  innerWall.receiveShadow = true;
  potGroup.add(innerWall);

  // Thick cast-iron pot bottom
  const potFloor = new THREE.Mesh(
    new THREE.CircleGeometry(potRadius * 0.935, 32),
    new THREE.MeshStandardMaterial({ color: 0x262321, roughness: 0.46, metalness: 0.25 })
  );
  potFloor.rotation.x = -Math.PI * 0.5;
  potFloor.position.y = 0.011;
  potFloor.receiveShadow = true;
  potGroup.add(potFloor);

  // Thick rolled cast-iron top rim
  const potRim = new THREE.Mesh(new THREE.TorusGeometry(potRadius - 0.0035, 0.0055, 10, 38), potRimMat);
  potRim.rotation.x = Math.PI * 0.5;
  potRim.position.y = potHeight;
  potRim.castShadow = true;
  potRim.receiveShadow = true;
  potGroup.add(potRim);

  // Two forged side loop handles (left & right)
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0068, 10, 18, Math.PI), potOuterMat);
    h.position.set(s * (potRadius + 0.002), potHeight * 0.78, 0);
    h.rotation.z = -s * Math.PI * 0.5;
    h.rotation.y = s * 0.05;
    h.castShadow = true;
    potGroup.add(h);
  }

  // -----------------------------------------------------------------------
  // 6. GLASS WATER CARAFE (used to pour shimmering water into the sizzling pot!)
  // -----------------------------------------------------------------------
  const carafeGroup = new THREE.Group();
  carafeGroup.position.set(0.56, 0.0, -0.04);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf4fa,
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.78,
    thickness: 0.02,
    ior: 1.48,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.65,
  });
  const carafePts = [
    new THREE.Vector2(0.0, 0.004),
    new THREE.Vector2(0.044, 0.004),
    new THREE.Vector2(0.048, 0.065),
    new THREE.Vector2(0.032, 0.132),
    new THREE.Vector2(0.038, 0.165),
  ];
  const carafeBody = new THREE.Mesh(new THREE.LatheGeometry(carafePts, 24), glassMat);
  carafeBody.castShadow = true;
  carafeGroup.add(carafeBody);

  // Sparkling water inside carafe
  const carafeWaterMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6eef8,
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.58,
  });
  const carafeWater = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.095, 20), carafeWaterMat);
  carafeWater.position.y = 0.052;
  carafeGroup.add(carafeWater);

  // Pouring water stream cylinder (visible while pouring into pot!)
  const waterStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0085, 0.24, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0xe6f6ff,
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.72,
    })
  );
  waterStream.visible = false;
  envGroup.add(waterStream);
  envGroup.add(carafeGroup);

  // -----------------------------------------------------------------------
  // 7. WOVEN VEGGIE BASKET (holds fresh carrot & potato — physical zero-text replay affordance!)
  // -----------------------------------------------------------------------
  const basketGroup = new THREE.Group();
  basketGroup.position.set(-0.56, 0.0, -0.18);
  const basketMat = new THREE.MeshStandardMaterial({
    color: 0x8f6840,
    map: textures.linen.map,
    bumpMap: textures.linen.bumpMap,
    bumpScale: 0.005,
    roughness: 0.88,
  });
  const basketBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.092, 0.068, 0.048, 20, 1, true),
    basketMat
  );
  basketBowl.material.side = THREE.DoubleSide;
  basketBowl.position.y = 0.024;
  basketBowl.castShadow = true;
  basketBowl.receiveShadow = true;
  basketGroup.add(basketBowl);
  const basketBase = new THREE.Mesh(new THREE.CircleGeometry(0.068, 18), basketMat);
  basketBase.rotation.x = -Math.PI * 0.5;
  basketBase.position.y = 0.004;
  basketGroup.add(basketBase);

  // Mini fresh carrot & potato nestled inside basket (signals fresh veggies ready for another round!)
  const miniCarrot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.017, 0.11, 12),
    new THREE.MeshStandardMaterial({ map: textures.carrot.skinMap, roughness: 0.65 })
  );
  miniCarrot.rotation.set(0.18, 0.35, 1.38);
  miniCarrot.position.set(-0.006, 0.036, 0.01);
  miniCarrot.castShadow = true;
  basketGroup.add(miniCarrot);

  const miniPotato = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 14, 10),
    new THREE.MeshStandardMaterial({ map: textures.potato.skinMap, roughness: 0.78 })
  );
  miniPotato.scale.set(1.25, 0.85, 0.95);
  miniPotato.position.set(0.024, 0.028, -0.018);
  miniPotato.castShadow = true;
  basketGroup.add(miniPotato);
  envGroup.add(basketGroup);

  return {
    envGroup,
    boardGroup,
    potGroup,
    potCenter,
    potRadius,
    potHeight,
    flameGroup,
    flameJets,
    flameGlow,
    carafeGroup,
    carafeWater,
    waterStream,
    basketGroup,
    dustMotes,
    update(dt, time, stoveOn) {
      // Gently drift golden evening dust motes
      const attr = dustMotes.geometry.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        let x = attr.getX(i) + Math.sin(time * 0.4 + i) * 0.005 * dt;
        let y = attr.getY(i) + Math.cos(time * 0.35 + i * 1.7) * 0.004 * dt;
        if (x > 0.6) x = -0.6;
        attr.setXY(i, x, y);
      }
      attr.needsUpdate = true;

      // Animate realistic flickering blue-orange gas stove flames
      flameGroup.visible = stoveOn;
      if (stoveOn) {
        const flicker = 0.88 + Math.sin(time * 24) * 0.08 + Math.cos(time * 37) * 0.06;
        flameGlow.intensity = 0.65 * flicker;
        for (let i = 0; i < flameJets.length; i++) {
          const s = 0.85 + Math.sin(time * 22 + i * 1.9) * 0.18;
          flameJets[i].scale.set(1, s, 1);
        }
      } else {
        flameGlow.intensity = 0;
      }
    },
  };
}
