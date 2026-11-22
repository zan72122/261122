import * as THREE from '../vendor/three.module.js';
import {
  createEggshellTextures,
  createSteamTexture,
  createCondensationTextures,
  createWarmGlowTexture,
} from './textures.js';
import {
  createPuddingMaterial,
  createCaramelGlazeMaterial,
  createCaramelLiquidMaterial,
  createCaramelPoolMaterial,
  createEggYolkMaterial,
  createAlbumenMaterial,
  createStudioGlassMaterial,
  createPorcelainMaterial,
  createMilkMaterial,
  createSteelMaterial,
  createStudioSkinMaterial,
  createIceMaterial,
  attachStaticSSS,
} from './materials.js';

/**
 * Helper: Thick-walled smooth glass mixing bowl via LatheGeometry
 */
export function createGlassMixingBowl(mixingTexture) {
  const group = new THREE.Group();

  // Outer + rounded lip + inner wall profile for authentic studio rim highlights
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.68, 0.0),
    new THREE.Vector2(0.95, 0.14),
    new THREE.Vector2(1.18, 0.46),
    new THREE.Vector2(1.28, 0.88),
    new THREE.Vector2(1.31, 1.04),
    new THREE.Vector2(1.285, 1.075), // rounded lip
    new THREE.Vector2(1.24, 1.04),
    new THREE.Vector2(1.205, 0.86),
    new THREE.Vector2(1.105, 0.46),
    new THREE.Vector2(0.88, 0.18),
    new THREE.Vector2(0.62, 0.075),
    new THREE.Vector2(0.0, 0.075),
  ];
  const bowlGeo = new THREE.LatheGeometry(pts, 64);
  const bowlMat = createStudioGlassMaterial({ transmission: 0.91, thickness: 0.28, roughness: 0.04 });
  const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  group.add(bowlMesh);

  // Liquid volume inside bowl (scales vertically as milk/egg enters)
  const liqGroup = new THREE.Group();
  liqGroup.position.y = 0.095;
  group.add(liqGroup);

  const liqTopGeo = new THREE.CircleGeometry(1.06, 56);
  liqTopGeo.rotateX(-Math.PI / 2);
  const liqMat = attachStaticSSS(
    new THREE.MeshPhysicalMaterial({
      map: mixingTexture,
      color: 0xffffff,
      roughness: 0.09,
      clearcoat: 0.95,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.15,
    }),
    { color: 0xffb84a, strength: 0.35, power: 2.6 }
  );
  const liqTop = new THREE.Mesh(liqTopGeo, liqMat);
  liqTop.receiveShadow = true;
  liqGroup.add(liqTop);

  // Curved lower liquid body matching interior bowl wall so side view through glass is realistic!
  const liqSidePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.60, 0.0),
    new THREE.Vector2(0.86, 0.11),
    new THREE.Vector2(1.06, 0.38),
    new THREE.Vector2(1.13, 0.62),
  ];
  const liqSideGeo = new THREE.LatheGeometry(liqSidePts, 48);
  const liqSideMat = attachStaticSSS(
    new THREE.MeshPhysicalMaterial({
      color: 0xf7eed8,
      roughness: 0.15,
      clearcoat: 0.7,
      envMapIntensity: 0.9,
    }),
    { color: 0xffb84a, strength: 0.42, power: 2.5 }
  );
  const liqSide = new THREE.Mesh(liqSideGeo, liqSideMat);
  liqGroup.add(liqSide);

  // Floating distinct translucent egg yolks inside the bowl (up to 2 eggs!)
  const yolkMat = createEggYolkMaterial();
  const albumenMat = createAlbumenMaterial();
  const yolks = [];
  for (let i = 0; i < 2; i++) {
    const yg = new THREE.Group();
    // Taut glossy flattened dome
    const yMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 36, 24), yolkMat);
    yMesh.scale.set(1.0, 0.68, 1.0);
    yMesh.position.y = 0.075;
    yMesh.castShadow = true;
    yg.add(yMesh);

    const albMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.04, 32), albumenMat);
    albMesh.position.y = 0.025;
    yg.add(albMesh);

    yg.visible = false;
    liqGroup.add(yg);
    yolks.push({ group: yg, yolk: yMesh, albumen: albMesh });
  }

  return { group, bowlMesh, liqGroup, liqTop, liqSide, liqSideMat, liqMat, yolks };
}

/**
 * Natural Farm Egg (whole + crackable split upper/lower shells + falling yolk)
 */
export function createFarmEggSet() {
  const shellTex = createEggshellTextures();
  const shellMat = new THREE.MeshPhysicalMaterial({
    map: shellTex.map,
    bumpMap: shellTex.bumpMap,
    bumpScale: 0.008,
    roughness: 0.68,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.65,
    side: THREE.DoubleSide,
  });

  function buildOvoidPoints(startT, endT, steps = 22) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = startT + (endT - startT) * (i / steps);
      const a = t * Math.PI;
      // Asymmetric realistic egg curve (fuller bottom, gently tapered top)
      const r = Math.sin(a) * (0.285 - 0.055 * Math.cos(a));
      const y = -Math.cos(a) * 0.38;
      pts.push(new THREE.Vector2(Math.max(0.0005, r), y));
    }
    return pts;
  }

  function makeEgg() {
    const root = new THREE.Group();
    const wholeGeo = new THREE.LatheGeometry(buildOvoidPoints(0, 1, 32), 40);
    const whole = new THREE.Mesh(wholeGeo, shellMat);
    whole.castShadow = true;
    whole.receiveShadow = true;
    root.add(whole);

    // Split halves (shown during crack slow-mo!)
    const splitGroup = new THREE.Group();
    splitGroup.visible = false;
    const leftHalf = new THREE.Mesh(new THREE.LatheGeometry(buildOvoidPoints(0, 0.52, 18), 32), shellMat);
    const rightHalf = new THREE.Mesh(new THREE.LatheGeometry(buildOvoidPoints(0.48, 1.0, 18), 32), shellMat);
    leftHalf.castShadow = true;
    rightHalf.castShadow = true;

    // Slight organic crack teeth around equator
    [leftHalf, rightHalf].forEach((half, side) => {
      const pos = half.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (Math.abs(y) < 0.04) {
          const ang = Math.atan2(pos.getZ(i), pos.getX(i));
          const zig = Math.sin(ang * 9) * 0.022 + Math.cos(ang * 5) * 0.014;
          pos.setY(i, y + (side === 0 ? zig : -zig));
        }
      }
      half.geometry.computeVertexNormals();
    });

    splitGroup.add(leftHalf, rightHalf);
    root.add(splitGroup);

    return { root, whole, splitGroup, leftHalf, rightHalf };
  }

  const egg1 = makeEgg();
  const egg2 = makeEgg();

  // Falling slow-motion translucent egg yolk + glossy albumen teardrop
  const fallingYolkGroup = new THREE.Group();
  fallingYolkGroup.visible = false;
  const fYolk = new THREE.Mesh(new THREE.SphereGeometry(0.215, 36, 24), createEggYolkMaterial());
  fYolk.castShadow = true;
  const fTail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.14, 0.55, 20), createAlbumenMaterial());
  fTail.position.y = 0.25;
  fallingYolkGroup.add(fYolk, fTail);

  return { egg1, egg2, fallingYolkGroup, fYolk, fTail };
}

/**
 * Sleek Studio Glass Milk Carafe + Dynamic Pouring Milk Stream
 */
export function createMilkCarafe() {
  const group = new THREE.Group();

  const carafePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.56, 0.14),
    new THREE.Vector2(0.54, 0.58),
    new THREE.Vector2(0.42, 0.96),
    new THREE.Vector2(0.32, 1.24),
    new THREE.Vector2(0.37, 1.46),
    new THREE.Vector2(0.35, 1.48),
    new THREE.Vector2(0.295, 1.24),
    new THREE.Vector2(0.385, 0.95),
    new THREE.Vector2(0.50, 0.58),
    new THREE.Vector2(0.515, 0.15),
    new THREE.Vector2(0.42, 0.055),
    new THREE.Vector2(0.0, 0.055),
  ];
  const glassMesh = new THREE.Mesh(
    new THREE.LatheGeometry(carafePts, 48),
    createStudioGlassMaterial({ transmission: 0.92, thickness: 0.22 })
  );
  glassMesh.castShadow = true;
  group.add(glassMesh);

  // Creamy milk volume inside carafe
  const milkPts = [
    new THREE.Vector2(0.0, 0.065),
    new THREE.Vector2(0.41, 0.065),
    new THREE.Vector2(0.50, 0.15),
    new THREE.Vector2(0.485, 0.57),
    new THREE.Vector2(0.385, 0.90),
    new THREE.Vector2(0.0, 0.90),
  ];
  const milkMesh = new THREE.Mesh(new THREE.LatheGeometry(milkPts, 40), createMilkMaterial());
  group.add(milkMesh);

  // Dynamic parabolic milk stream ribbon (re-positioned in world space when pouring)
  const streamMat = createMilkMaterial();
  const streamCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.35, -0.25, 0),
    new THREE.Vector3(-0.62, -1.25, 0)
  );
  const streamGeo = new THREE.TubeGeometry(streamCurve, 24, 0.055, 14, false);
  const streamMesh = new THREE.Mesh(streamGeo, streamMat);
  streamMesh.visible = false;

  return { group, glassMesh, milkMesh, streamMesh, streamMat };
}

/**
 * Brushed Stainless-Steel Balloon Whisk (smooth 3D intertwined wires!)
 */
export function createBalloonWhisk() {
  const group = new THREE.Group();
  const steelMat = createSteelMaterial(false);
  const brightWireMat = createSteelMaterial(true);

  // Sleek tapered handle extending upward
  const handlePts = [
    new THREE.Vector2(0.058, 0.0),
    new THREE.Vector2(0.072, 0.25),
    new THREE.Vector2(0.088, 1.05),
    new THREE.Vector2(0.078, 1.38),
    new THREE.Vector2(0.03, 1.44),
    new THREE.Vector2(0.0, 1.44),
  ];
  const handle = new THREE.Mesh(new THREE.LatheGeometry(handlePts, 28), steelMat);
  handle.position.y = 0.72;
  handle.castShadow = true;
  group.add(handle);

  // 6 smooth balloon wire loops reaching downward to y = 0
  const loops = 6;
  for (let i = 0; i < loops; i++) {
    const ang = (i / loops) * Math.PI;
    const width = 0.24 + (i % 2) * 0.045;
    const pts = [];
    const segs = 20;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const theta = t * Math.PI * 2;
      // Teardrop balloon contour
      const y = (1 - Math.cos(theta)) * 0.38;
      const w = Math.sin(theta) * width * Math.pow(Math.sin(t * Math.PI), 0.35);
      const x = Math.cos(ang) * w;
      const z = Math.sin(ang) * w;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const wireGeo = new THREE.TubeGeometry(curve, 28, 0.011, 8, false);
    const wire = new THREE.Mesh(wireGeo, brightWireMat);
    wire.castShadow = true;
    group.add(wire);
  }

  return group;
}

/**
 * Thick Heatproof Studio Glass Pudding Cup + Rising Custard Core + Frost Layer + Steamer Dome
 */
export function createPuddingCupAndSteamer(custardTextures) {
  const cupGroup = new THREE.Group();

  // Classic tall Japanese purin glass mold (tapered frustum with thick base & rounded rim)
  const cupPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.56, 0.0),
    new THREE.Vector2(0.64, 0.08),
    new THREE.Vector2(0.79, 1.18),
    new THREE.Vector2(0.85, 1.25),
    new THREE.Vector2(0.84, 1.29),
    new THREE.Vector2(0.76, 1.26),
    new THREE.Vector2(0.73, 1.15),
    new THREE.Vector2(0.58, 0.14),
    new THREE.Vector2(0.52, 0.10),
    new THREE.Vector2(0.0, 0.10),
  ];
  const cupGlass = new THREE.Mesh(
    new THREE.LatheGeometry(cupPts, 56),
    createStudioGlassMaterial({ transmission: 0.93, thickness: 0.32, roughness: 0.04 })
  );
  cupGlass.castShadow = true;
  cupGlass.receiveShadow = true;
  cupGroup.add(cupGlass);

  // Golden custard fill inside the glass cup (grows upward during pour & glows warm during steam)
  const fillPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.51, 0.0),
    new THREE.Vector2(0.57, 0.06),
    new THREE.Vector2(0.715, 1.06),
    new THREE.Vector2(0.0, 1.06),
  ];
  const fillMat = attachStaticSSS(
    new THREE.MeshPhysicalMaterial({
      map: custardTextures.map,
      roughnessMap: custardTextures.roughnessMap,
      color: 0xfff8e2,
      roughness: 0.14,
      clearcoat: 0.96,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.0,
    }),
    { color: 0xffb220, strength: 0.85, power: 2.2, wrapBoost: 0.34 }
  );
  const fillMesh = new THREE.Mesh(new THREE.LatheGeometry(fillPts, 48), fillMat);
  fillMesh.position.y = 0.11;
  fillMesh.scale.set(1, 0.001, 1);
  fillMesh.visible = false;
  cupGroup.add(fillMesh);

  // Rich dark-amber caramel layer resting at bottom of cup (visibly crowns the inverted pudding in Stage 5!)
  const baseCaramelMat = createCaramelLiquidMaterial();
  const baseCaramel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.585, 0.545, 0.20, 48),
    baseCaramelMat
  );
  baseCaramel.position.y = 0.205;
  baseCaramel.visible = false;
  cupGroup.add(baseCaramel);

  // Frost / condensation overlay jacket (appears smoothly during Stage 4 Chilling!)
  const condTex = createCondensationTextures();
  const frostPts = [
    new THREE.Vector2(0.645, 0.08),
    new THREE.Vector2(0.798, 1.18),
    new THREE.Vector2(0.848, 1.24),
  ];
  const frostMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ff,
    roughnessMap: condTex.roughnessMap,
    bumpMap: condTex.bumpMap,
    bumpScale: 0.025,
    roughness: 0.48,
    clearcoat: 0.65,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const frostMesh = new THREE.Mesh(new THREE.LatheGeometry(frostPts, 48), frostMat);
  cupGroup.add(frostMesh);

  // Rising suction air-bubble sphere (climbs up inner wall right before slow-mo unmold!)
  const airBubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.65,
    })
  );
  airBubble.visible = false;
  cupGroup.add(airBubble);

  // === STEAMER BASE & GLASS DOME LID (Stage 3) ===
  const steamerGroup = new THREE.Group();
  steamerGroup.visible = false;

  const baseRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.52, 0.16, 56),
    new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.42, metalness: 0.55 })
  );
  baseRing.position.y = 0.08;
  baseRing.receiveShadow = true;
  steamerGroup.add(baseRing);

  // Soft diffused warm amber heating glow disc (no harsh graphic ring!)
  const glowRingMat = new THREE.MeshBasicMaterial({
    map: createWarmGlowTexture(),
    color: 0xff9a38,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowRing = new THREE.Mesh(new THREE.PlaneGeometry(2.68, 2.68), glowRingMat);
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.165;
  steamerGroup.add(glowRing);

  // Glass steamer dome lid with dark walnut spherical knob
  const domeGroup = new THREE.Group();
  const domeGeo = new THREE.SphereGeometry(1.38, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.50);
  const domeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0f5fa,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.19,
    depthWrite: false,
    envMapIntensity: 1.7,
  });
  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  domeMesh.scale.set(1, 1.18, 1);
  domeMesh.position.y = 0.16;
  domeGroup.add(domeMesh);

  // Subtle frosted glass dome bottom lip seated flush on the steamer base (zero dark bar across cup!)
  const domeRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.016, 12, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.18,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.34,
    })
  );
  domeRim.rotation.x = Math.PI / 2;
  domeRim.position.y = 0.17;
  domeGroup.add(domeRim);

  // Tactile dark wooden/slate lid knob
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.36, metalness: 0.08 })
  );
  knob.scale.set(1.1, 0.78, 1.1);
  knob.position.y = 1.78;
  knob.castShadow = true;
  domeGroup.add(knob);
  steamerGroup.add(domeGroup);

  // === ICE BATH & CRYSTAL ICE CUBES (Stage 4) ===
  const iceBathGroup = new THREE.Group();
  iceBathGroup.visible = false;

  const basinPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.42, 0.0),
    new THREE.Vector2(1.56, 0.42),
    new THREE.Vector2(1.52, 0.44),
    new THREE.Vector2(1.38, 0.07),
    new THREE.Vector2(0.0, 0.07),
  ];
  const basin = new THREE.Mesh(
    new THREE.LatheGeometry(basinPts, 56),
    new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.34, metalness: 0.32 })
  );
  basin.receiveShadow = true;
  iceBathGroup.add(basin);

  const coldWater = new THREE.Mesh(
    new THREE.CircleGeometry(1.46, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xbce4ff,
      roughness: 0.04,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 1.6,
    })
  );
  coldWater.rotation.x = -Math.PI / 2;
  coldWater.position.y = 0.32;
  iceBathGroup.add(coldWater);

  // 14 smooth beveled organic melted crystal ice cubes (superellipsoid rounded cubes!)
  const iceMat = createIceMaterial();
  const iceCubes = [];
  const iceBaseGeo = new THREE.SphereGeometry(0.185, 22, 16);
  const ip = iceBaseGeo.attributes.position;
  for (let i = 0; i < ip.count; i++) {
    const x = ip.getX(i), y = ip.getY(i), z = ip.getZ(i);
    // Superellipsoid squircle morph (exponent ~0.42 creates smooth wet melted ice cube edges!)
    const sx = Math.sign(x) * Math.pow(Math.abs(x / 0.185), 0.52) * 0.18;
    const sy = Math.sign(y) * Math.pow(Math.abs(y / 0.185), 0.52) * 0.155;
    const sz = Math.sign(z) * Math.pow(Math.abs(z / 0.185), 0.52) * 0.18;
    // Slight organic melt dimple
    const melt = 1.0 + 0.045 * Math.sin(sx * 18 + sz * 15);
    ip.setXYZ(i, sx * melt, sy * melt, sz * melt);
  }
  iceBaseGeo.computeVertexNormals();

  for (let i = 0; i < 14; i++) {
    const cube = new THREE.Mesh(iceBaseGeo, iceMat);
    const ang = (i / 14) * Math.PI * 2 + (i % 2) * 0.14;
    const rad = 1.04 + (i % 3) * 0.11;
    cube.userData = {
      targetPos: new THREE.Vector3(Math.cos(ang) * rad, 0.25 + (i % 2) * 0.06, Math.sin(ang) * rad),
      rot: new THREE.Euler(i * 0.5, ang + 0.4, i * 0.35),
      dropped: false,
      dropT: 0,
    };
    cube.visible = false;
    cube.castShadow = true;
    iceBathGroup.add(cube);
    iceCubes.push(cube);
  }

  return {
    cupGroup,
    cupGlass,
    fillMesh,
    fillMat,
    baseCaramel,
    frostMat,
    airBubble,
    steamerGroup,
    domeGroup,
    domeMat,
    glowRingMat,
    iceBathGroup,
    iceCubes,
  };
}

/**
 * Minimalist High-Fire White Porcelain Dessert Plate
 */
export function createPorcelainPlate() {
  const pts = [
    new THREE.Vector2(0.0, 0.025),
    new THREE.Vector2(0.95, 0.025),
    new THREE.Vector2(1.02, 0.0), // porcelain foot ring
    new THREE.Vector2(1.08, 0.0),
    new THREE.Vector2(1.15, 0.035),
    new THREE.Vector2(1.62, 0.145),
    new THREE.Vector2(1.78, 0.225),
    new THREE.Vector2(1.76, 0.255),
    new THREE.Vector2(1.56, 0.17),
    new THREE.Vector2(1.12, 0.082),
    new THREE.Vector2(0.0, 0.075),
  ];
  const plate = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), createPorcelainMaterial());
  plate.castShadow = true;
  plate.receiveShadow = true;
  return plate;
}

/**
 * HERO SOFT-BODY PUDDING + BAKED CARAMEL CROWN + DYNAMIC 3D OOZING CARAMEL DRIPS + PLATE POOL
 */
export function createHeroPudding(custardTextures, softBodyUniforms) {
  const group = new THREE.Group();

  // Classic tall patisserie purin profile (height = 1.18, base radius = 0.78, rounded crown radius = 0.58)
  const H = 1.18;
  const profile = [];
  const segsY = 34;
  for (let i = 0; i <= segsY; i++) {
    const t = i / segsY;
    let r, y;
    if (t < 0.06) {
      // Soft wet meniscus flare at porcelain plate contact
      const k = t / 0.06;
      r = THREE.MathUtils.lerp(0.80, 0.77, k);
      y = k * 0.06;
    } else if (t < 0.80) {
      // Gently tapered classic purin sides with subtle organic curve
      const k = (t - 0.06) / 0.74;
      r = THREE.MathUtils.lerp(0.77, 0.59, k) + Math.sin(k * Math.PI) * 0.015;
      y = 0.06 + k * 0.94;
    } else {
      // Smooth rounded domed crown
      const k = (t - 0.80) / 0.20;
      const ang = k * (Math.PI * 0.5);
      r = Math.cos(ang) * 0.59;
      y = 1.00 + Math.sin(ang) * 0.18;
    }
    profile.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }

  const puddingGeo = new THREE.LatheGeometry(profile, 72);
  // Flip V so top of custard texture aligns with crown of pudding
  const uv = puddingGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, 1.0 - uv.getY(i));
  }
  const puddingMat = createPuddingMaterial(custardTextures, softBodyUniforms);
  const puddingMesh = new THREE.Mesh(puddingGeo, puddingMat);
  puddingMesh.castShadow = true;
  puddingMesh.receiveShadow = true;
  group.add(puddingMesh);

  // === PER-PIXEL SMOOTH ROUNDED SOFT-BODY CARAMEL GLAZE + VISCOUS DRIPS ===
  // Uses exact pudding LatheGeometry profile at higher smooth resolution + fragment-shader bulbous drip boundary
  // so every drip has razor-smooth rounded liquid teardrops hugging the wobbling soft-body pudding!
  const caramelMat = createCaramelGlazeMaterial(softBodyUniforms);
  const caramelProfile = [];
  const cSegsY = 46;
  for (let i = 0; i <= cSegsY; i++) {
    const t = i / cSegsY;
    let r, y;
    if (t < 0.06) {
      const k = t / 0.06;
      r = THREE.MathUtils.lerp(0.80, 0.77, k);
      y = k * 0.06;
    } else if (t < 0.80) {
      const k = (t - 0.06) / 0.74;
      r = THREE.MathUtils.lerp(0.77, 0.59, k) + Math.sin(k * Math.PI) * 0.015;
      y = 0.06 + k * 0.94;
    } else {
      const k = (t - 0.80) / 0.20;
      const ang = k * (Math.PI * 0.5);
      r = Math.cos(ang) * 0.59;
      y = 1.00 + Math.sin(ang) * 0.18;
    }
    caramelProfile.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }
  const caramelGeo = new THREE.LatheGeometry(caramelProfile, 96);
  const caramelCapMesh = new THREE.Mesh(caramelGeo, caramelMat);
  caramelCapMesh.castShadow = true;
  group.add(caramelCapMesh);

  function setCaramelFlow(flowProgress) {
    const p = THREE.MathUtils.clamp(flowProgress, 0, 1);
    if (caramelMat.userData.caramelUniforms) {
      caramelMat.userData.caramelUniforms.uCaramelFlow.value = p;
    }
  }
  setCaramelFlow(0.0);

  // Expanding mirror-gloss feathered amber caramel pool on the porcelain plate!
  const poolGeo = new THREE.CircleGeometry(1.42, 64);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = createCaramelPoolMaterial();
  const caramelPool = new THREE.Mesh(poolGeo, poolMat);
  caramelPool.position.y = 0.084;
  caramelPool.scale.set(0.62, 1, 0.62);
  caramelPool.visible = false;
  group.add(caramelPool);

  return {
    group,
    puddingMesh,
    puddingMat,
    caramelCapMesh,
    caramelMat,
    caramelPool,
    setCaramelFlow,
  };
}

/**
 * Glass & Copper Caramel Sauce Pitcher + Glowing Backlit Viscous Pouring Ribbon
 */
export function createCaramelPitcher() {
  const group = new THREE.Group();

  // Sleek flared sauce pitcher
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.46, 0.16),
    new THREE.Vector2(0.43, 0.62),
    new THREE.Vector2(0.37, 0.84),
    new THREE.Vector2(0.42, 0.92),
    new THREE.Vector2(0.39, 0.94),
    new THREE.Vector2(0.34, 0.84),
    new THREE.Vector2(0.39, 0.62),
    new THREE.Vector2(0.41, 0.16),
    new THREE.Vector2(0.32, 0.05),
    new THREE.Vector2(0.0, 0.05),
  ];
  // Sleek flared studio glass pitcher with warm gleaming copper accent collar & handle
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 48),
    createStudioGlassMaterial({ transmission: 0.95, thickness: 0.14, roughness: 0.022, envMapIntensity: 1.85 })
  );
  body.castShadow = true;
  group.add(body);

  // Gleaming burnished copper collar band & handle (catches rich warm studio rim highlights!)
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xe69462,
    roughness: 0.18,
    metalness: 0.86,
    clearcoat: 0.55,
    envMapIntensity: 1.85,
  });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.024, 14, 48), copperMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.82;
  group.add(collar);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.38, 0.78, 0),
    new THREE.Vector3(0.70, 0.72, 0),
    new THREE.Vector3(0.70, 0.28, 0),
    new THREE.Vector3(0.43, 0.19, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 24, 0.034, 12, false), copperMat);
  handle.castShadow = true;
  group.add(handle);

  // Luminous backlit golden-amber caramel glowing inside the crystal glass pitcher!
  const innerCaramelMat = attachStaticSSS(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x521c03),
      roughness: 0.02,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    }),
    { color: 0xff8c14, strength: 1.9, power: 1.5, wrapBoost: 0.36 }
  );
  const innerCaramel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.40, 0.54, 36),
    innerCaramelMat
  );
  innerCaramel.position.y = 0.34;
  group.add(innerCaramel);

  // Glowing backlit tapering viscous caramel pouring ribbon (necking down gracefully with gravity!)
  const ribbonCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.24, -0.22, 0),
    new THREE.Vector3(-0.42, -0.98, 0)
  );
  const segs = 28;
  const radSegs = 14;
  const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, segs, 0.036, radSegs, false);
  // Sculpt realistic viscous tapering: wider at pitcher lip -> slender glossy thread mid-air -> soft puddle flare at crown impact!
  const rPos = ribbonGeo.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const center = ribbonCurve.getPoint(t);
    const scale = t < 0.82
      ? THREE.MathUtils.lerp(1.15, 0.58, t / 0.82)
      : THREE.MathUtils.lerp(0.58, 1.55, (t - 0.82) / 0.18);
    for (let j = 0; j <= radSegs; j++) {
      const idx = i * (radSegs + 1) + j;
      const vx = rPos.getX(idx) - center.x;
      const vy = rPos.getY(idx) - center.y;
      const vz = rPos.getZ(idx) - center.z;
      rPos.setXYZ(idx, center.x + vx * scale, center.y + vy * scale, center.z + vz * scale);
    }
  }
  ribbonGeo.computeVertexNormals();
  const ribbonMat = createCaramelLiquidMaterial();
  const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonMesh.visible = false;

  return { group, innerCaramel, ribbonMesh };
}

/**
 * Gleaming Silver Studio Dessert Spoon + Trembling Scooped Custard Bite
 */
export function createSilverSpoon(custardTextures) {
  const group = new THREE.Group();
  const silverMat = createSteelMaterial(true);

  // Curved spoon bowl
  const bowlGeo = new THREE.SphereGeometry(0.24, 28, 18, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44);
  bowlGeo.scale(0.82, 0.42, 1.38);
  const bowl = new THREE.Mesh(bowlGeo, silverMat);
  bowl.castShadow = true;
  group.add(bowl);

  // Tapered sculptural handle
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, 0.28),
    new THREE.Vector3(0, 0.05, 0.75),
    new THREE.Vector3(0, 0.14, 1.48),
    new THREE.Vector3(0, 0.16, 1.85),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 20, 0.036, 10, false);
  stemGeo.scale(1.45, 0.42, 1.0);
  const stem = new THREE.Mesh(stemGeo, silverMat);
  stem.castShadow = true;
  group.add(stem);

  // Scooped glossy custard + seamless glazed caramel bite resting in the spoon bowl
  const biteGroup = new THREE.Group();
  biteGroup.position.set(0, 0.055, 0.02);
  biteGroup.visible = false;

  const biteCustard = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 32, 24),
    attachStaticSSS(
      new THREE.MeshPhysicalMaterial({
        map: custardTextures.map,
        color: 0xfff9e2,
        roughness: 0.14,
        clearcoat: 0.98,
        clearcoatRoughness: 0.05,
      }),
      { color: 0xffbc32, strength: 0.85, power: 2.2, wrapBoost: 0.34 }
    )
  );
  biteCustard.scale.set(0.92, 0.72, 1.24);
  biteCustard.castShadow = true;
  biteGroup.add(biteCustard);

  // Smooth rounded caramel glaze cap sitting cleanly on top of the scooped custard (zero polygon sawteeth!)
  const glazePts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const ang = t * Math.PI * 0.44;
    const r = Math.sin(ang) * 0.184;
    const y = Math.cos(ang) * 0.184;
    glazePts.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }
  const biteCaramel = new THREE.Mesh(
    new THREE.LatheGeometry(glazePts, 44),
    createCaramelLiquidMaterial()
  );
  biteCaramel.scale.set(0.93, 0.74, 1.25);
  biteCaramel.position.y = 0.008;
  biteGroup.add(biteCaramel);

  group.add(biteGroup);

  return { group, biteGroup };
}

/**
 * Sculpted Photorealistic Articulated 3D Studio Hand (warm SSS skin under studio rim light!)
 * Used to hold/crack eggs, pour, guide the whisk, lift the cup, AND gently demonstrate after 9.5s idle!
 */
export function createStudioHand() {
  const root = new THREE.Group();
  const skinMat = createStudioSkinMaterial();
  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4d8ca,
    roughness: 0.22,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
  });

  // Seamless organic palm-to-wrist-to-sleeve loft (zero cylinder step seam!)
  // Built as a continuous sculpted Lathe deformed anatomically into a human palm + wrist!
  const handProfile = [
    new THREE.Vector2(0.001, -0.34), // distal knuckles front edge
    new THREE.Vector2(0.28, -0.30),
    new THREE.Vector2(0.37, -0.14), // broad palm
    new THREE.Vector2(0.36, 0.14),  // heel of palm
    new THREE.Vector2(0.28, 0.36),  // tapered wrist
    new THREE.Vector2(0.26, 0.62),  // forearm
    new THREE.Vector2(0.27, 0.72),
  ];
  const palmWristGeo = new THREE.LatheGeometry(handProfile, 36);
  // Rotate so length lies along +Z (wrist toward +Z, knuckles toward -Z), flatten dorsal/palmar thickness organically!
  palmWristGeo.rotateX(Math.PI / 2);
  const pwPos = palmWristGeo.attributes.position;
  for (let i = 0; i < pwPos.count; i++) {
    const x = pwPos.getX(i);
    const y = pwPos.getY(i);
    const z = pwPos.getZ(i);
    const isPalm = THREE.MathUtils.smoothstep(-z, -0.35, 0.25);
    const yFlat = THREE.MathUtils.lerp(0.74, 0.44, isPalm);
    const xWide = THREE.MathUtils.lerp(1.02, 1.08, isPalm);
    pwPos.setXYZ(i, x * xWide, y * yFlat, z);
  }
  palmWristGeo.computeVertexNormals();
  const palmWrist = new THREE.Mesh(palmWristGeo, skinMat);
  palmWrist.castShadow = true;
  root.add(palmWrist);

  // Authentic matte obsidian-charcoal studio chef's jacket sleeve cuff (fades naturally into black backdrop!)
  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f1014,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.45,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(0x2d3038),
  });
  const sleevePts = [
    new THREE.Vector2(0.265, 0.56),
    new THREE.Vector2(0.295, 0.58),
    new THREE.Vector2(0.325, 1.25),
    new THREE.Vector2(0.36, 2.20),
  ];
  const sleeveGeo = new THREE.LatheGeometry(sleevePts, 32);
  sleeveGeo.rotateX(Math.PI / 2);
  sleeveGeo.scale(1.04, 0.82, 1.0);
  const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeve.castShadow = true;
  root.add(sleeve);

  // Seamless continuous tapered organic finger with closed smooth dome tip (ZERO separate tipBall seam!)
  function makeSeamlessFinger(len, baseRad, xOff, zOff, yaw = 0, defaultCurl = 0.55) {
    const base = new THREE.Group();
    base.position.set(xOff, 0.0, zOff);
    base.rotation.y = yaw;

    const segsLen = 28;
    const segsRad = 16;
    const curvePts = [
      new THREE.Vector3(0, 0, 0.08),
      new THREE.Vector3(0, -len * 0.04 * defaultCurl, -len * 0.34),
      new THREE.Vector3(0, -len * 0.22 * defaultCurl, -len * 0.68),
      new THREE.Vector3(0, -len * 0.46 * defaultCurl, -len * 0.96),
      new THREE.Vector3(0, -len * 0.52 * defaultCurl, -len * 1.02),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const geo = new THREE.TubeGeometry(curve, segsLen, baseRad, segsRad, false);

    const pos = geo.attributes.position;
    for (let i = 0; i <= segsLen; i++) {
      const t = i / segsLen;
      const c = curve.getPoint(t);
      // Smooth hemispherical fingertip closure baked directly into the continuous tube!
      const tipCap = t > 0.86 ? Math.sqrt(Math.max(0.0004, 1.0 - Math.pow((t - 0.86) / 0.14, 2))) : 1.0;
      const taper = THREE.MathUtils.lerp(1.08, 0.72, Math.min(1, t / 0.88)) * tipCap;
      const knuckle = 1.0 + 0.035 * Math.exp(-Math.pow((t - 0.36) * 9, 2)) + 0.025 * Math.exp(-Math.pow((t - 0.66) * 10, 2));
      for (let j = 0; j <= segsRad; j++) {
        const idx = i * (segsRad + 1) + j;
        const vx = (pos.getX(idx) - c.x) * taper * knuckle;
        const vy = (pos.getY(idx) - c.y) * taper * knuckle * 0.88;
        const vz = (pos.getZ(idx) - c.z) * taper * knuckle;
        pos.setXYZ(idx, c.x + vx, c.y + vy, c.z + vz);
      }
    }
    geo.computeVertexNormals();
    const fingerMesh = new THREE.Mesh(geo, skinMat);
    fingerMesh.castShadow = true;
    base.add(fingerMesh);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(baseRad * 0.44, 12, 10), nailMat);
    nail.scale.set(0.85, 0.18, 1.15);
    nail.position.copy(curve.getPoint(0.84)).add(new THREE.Vector3(0, baseRad * 0.30, 0.02));
    nail.rotation.x = defaultCurl * 0.72;
    base.add(nail);

    return { base };
  }

  const fingers = {
    index: makeSeamlessFinger(0.68, 0.080, -0.23, -0.22, 0.07, 0.62),
    middle: makeSeamlessFinger(0.75, 0.082, -0.07, -0.26, 0.01, 0.66),
    ring: makeSeamlessFinger(0.69, 0.078, 0.09, -0.24, -0.04, 0.70),
    pinky: makeSeamlessFinger(0.56, 0.068, 0.24, -0.18, -0.10, 0.72),
    thumb: makeSeamlessFinger(0.55, 0.094, -0.34, 0.08, 0.62, 0.48),
  };
  fingers.thumb.base.rotation.z = -0.32;

  Object.values(fingers).forEach((f) => root.add(f.base));

  // Pose controller: smoothly adjusts base finger pitch for pinch / grip / point / open
  function setPose(poseName, amount = 1.0) {
    const t = amount;
    if (poseName === 'pinch') {
      fingers.index.base.rotation.x = 0.26 * t;
      fingers.thumb.base.rotation.x = 0.22 * t;
      fingers.middle.base.rotation.x = 0.36 * t;
      fingers.ring.base.rotation.x = 0.44 * t;
      fingers.pinky.base.rotation.x = 0.50 * t;
    } else if (poseName === 'grip') {
      Object.values(fingers).forEach((f) => {
        f.base.rotation.x = 0.38 * t;
      });
      fingers.thumb.base.rotation.x = 0.22 * t;
    } else if (poseName === 'point') {
      fingers.index.base.rotation.x = -0.18 * t;
      fingers.middle.base.rotation.x = 0.52 * t;
      fingers.ring.base.rotation.x = 0.58 * t;
      fingers.pinky.base.rotation.x = 0.62 * t;
      fingers.thumb.base.rotation.x = 0.28 * t;
    } else {
      Object.values(fingers).forEach((f) => {
        f.base.rotation.x = 0.04 * t;
      });
    }
  }

  setPose('open', 1.0);
  return { root, fingers, setPose };
}

/**
 * Rim-Lit Volumetric-Feel Steam & Sinking Cold Mist Particle System
 * Hot steam rises upward; cold mist sinks gently downward (hidden thermal physics!)
 */
export function createVaporSystem(count = 36) {
  const group = new THREE.Group();
  const tex = createSteamTexture();
  const particles = [];

  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xfff8ec,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    group.add(sprite);
    particles.push({
      sprite,
      mat,
      life: Math.random(),
      speed: 0.45 + Math.random() * 0.45,
      driftX: (Math.random() - 0.5) * 0.38,
      driftZ: (Math.random() - 0.5) * 0.38,
      angle: Math.random() * Math.PI * 2,
      baseScale: 0.65 + Math.random() * 0.85,
    });
  }

  function update(dt, { active, mode = 'steam', origin = new THREE.Vector3(0, 1.1, 0), intensity = 1.0 }) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!active && p.mat.opacity < 0.008) {
        p.sprite.visible = false;
        continue;
      }
      p.sprite.visible = true;
      p.life += dt * p.speed * (mode === 'cold' ? 0.62 : 0.78);
      if (p.life >= 1.0) {
        if (active) {
          p.life -= 1.0;
          p.angle = Math.random() * Math.PI * 2;
        } else {
          p.mat.opacity = 0;
          p.sprite.visible = false;
          continue;
        }
      }
      const t = p.life;
      if (mode === 'steam') {
        // Hot steam billows upward & expands into rim light!
        const r = 0.25 + t * 0.78;
        p.sprite.position.set(
          origin.x + Math.cos(p.angle + t * 1.4) * r * 0.6 + p.driftX * t,
          origin.y + t * 2.45,
          origin.z + Math.sin(p.angle + t * 1.4) * r * 0.6 + p.driftZ * t
        );
        const s = p.baseScale * (0.45 + t * 1.45);
        p.sprite.scale.set(s, s * 1.15, 1);
        p.mat.color.setHex(0xfff5e6);
        const env = Math.sin(t * Math.PI) * (1 - t * 0.35);
        p.mat.opacity = env * 0.34 * intensity;
      } else {
        // Cold vapor sinks gently downward & spreads over dark slate table!
        const r = 0.58 + t * 1.35;
        p.sprite.position.set(
          origin.x + Math.cos(p.angle) * r,
          Math.max(0.14, origin.y - t * 0.92),
          origin.z + Math.sin(p.angle) * r
        );
        const s = p.baseScale * (0.55 + t * 1.35);
        p.sprite.scale.set(s * 1.35, s * 0.65, 1);
        p.mat.color.setHex(0xcce8ff);
        const env = Math.sin(t * Math.PI);
        p.mat.opacity = env * 0.26 * intensity;
      }
    }
  }

  function clear() {
    for (let i = 0; i < particles.length; i++) {
      particles[i].mat.opacity = 0;
      particles[i].sprite.visible = false;
    }
  }

  return { group, update, clear };
}
