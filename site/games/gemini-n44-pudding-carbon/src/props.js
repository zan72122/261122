import * as THREE from 'three';
import { YolkSoftBody, createPuddingGeometry, PuddingSoftBody } from './softbody.js';
import { createHeroPuddingMaterial } from './materials.js';

/**
 * Heavy Patisserie Glass Mixing Bowl with live swirling batter surface & soft-body raw yolks
 */
export function createMixingBowl(materials) {
  const group = new THREE.Group();

  // Thick-walled glass bowl profile (outer curve -> thick rounded lip -> inner curve)
  const pts = [];
  const R = 0.50;
  const H = 0.31;
  const wall = 0.024;
  // Foot center -> foot outer
  pts.push(new THREE.Vector2(0.0, 0.0));
  pts.push(new THREE.Vector2(0.22, 0.0));
  pts.push(new THREE.Vector2(0.23, 0.025));
  // Outer parabolic wall
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const ang = t * Math.PI * 0.46;
    const rx = 0.21 + Math.sin(ang) * (R - 0.21);
    const ry = 0.025 + (1 - Math.cos(ang)) * (H - 0.025);
    pts.push(new THREE.Vector2(rx, ry));
  }
  // Rounded thick glass rim
  pts.push(new THREE.Vector2(R + 0.008, H + 0.012));
  pts.push(new THREE.Vector2(R - wall * 0.5, H + 0.018));
  pts.push(new THREE.Vector2(R - wall, H + 0.008));
  // Inner smooth parabolic wall
  for (let i = 18; i >= 0; i--) {
    const t = i / 18;
    const ang = t * Math.PI * 0.46;
    const rx = (0.19 + Math.sin(ang) * (R - wall - 0.19)) * (i === 0 ? 0 : 1);
    const ry = 0.036 + (1 - Math.cos(ang)) * (H - 0.032);
    pts.push(new THREE.Vector2(rx, ry));
  }

  const bowlGeo = new THREE.LatheGeometry(pts, 64);
  const bowlMesh = new THREE.Mesh(bowlGeo, materials.glass);
  bowlMesh.renderOrder = 3;
  group.add(bowlMesh);

  // Dynamic Batter / Milk Surface Disc inside bowl
  const surfSegs = 48;
  const surfRings = 16;
  const surfGeo = new THREE.RingGeometry(0.001, 1.0, surfSegs, surfRings);
  surfGeo.rotateX(-Math.PI / 2);
  // Fix planar UVs (0..1 across disc) so swirling canvas texture maps cleanly!
  const sPos = surfGeo.attributes.position;
  const sUv = surfGeo.attributes.uv;
  const baseSurfPos = new Float32Array(sPos.array.length);
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i);
    const z = sPos.getZ(i);
    baseSurfPos[i * 3] = x;
    baseSurfPos[i * 3 + 1] = 0;
    baseSurfPos[i * 3 + 2] = z;
    sUv.setXY(i, 0.5 + x * 0.49, 0.5 + z * 0.49);
  }
  const batterMesh = new THREE.Mesh(surfGeo, materials.batter);
  batterMesh.visible = false;
  batterMesh.receiveShadow = true;
  batterMesh.renderOrder = 1;
  group.add(batterMesh);

  // Viscous raw albumen (egg white) pool at bottom before mixing
  const albGeo = new THREE.CylinderGeometry(0.19, 0.16, 0.022, 36);
  const albumenMesh = new THREE.Mesh(albGeo, materials.albumen);
  albumenMesh.position.y = 0.048;
  albumenMesh.visible = false;
  albumenMesh.renderOrder = 2;
  group.add(albumenMesh);

  // Up to 3 Soft-Body Egg Yolks inside the bowl!
  const yolks = [];
  for (let i = 0; i < 3; i++) {
    const ysb = new YolkSoftBody(materials.yolk, 0.088);
    ysb.mesh.visible = false;
    ysb.mesh.renderOrder = 2;
    group.add(ysb.mesh);
    yolks.push(ysb);
  }

  function innerRadiusAtY(y) {
    const t = THREE.MathUtils.clamp((y - 0.038) / (H - 0.035), 0.02, 0.96);
    const cosA = THREE.MathUtils.clamp(1 - t, 0.1, 1.0);
    const ang = Math.acos(cosA);
    return 0.175 + Math.sin(ang) * (R - wall - 0.185);
  }

  function updateLiquidSurface(fillAmount, vortexStrength = 0, wavePhase = 0) {
    if (fillAmount <= 0.01) {
      batterMesh.visible = false;
      return 0.045;
    }
    batterMesh.visible = true;
    const baseY = THREE.MathUtils.lerp(0.065, 0.245, THREE.MathUtils.clamp(fillAmount, 0, 1.05));
    const maxR = innerRadiusAtY(baseY) * 0.992;

    const arr = sPos.array;
    for (let i = 0; i < sPos.count; i++) {
      const bx = baseSurfPos[i * 3];
      const bz = baseSurfPos[i * 3 + 2];
      const r01 = Math.hypot(bx, bz);
      const ang = Math.atan2(bz, bx);
      // Centrifugal vortex depression in center + meniscus climb at glass wall + stirring wave!
      const vortexY = vortexStrength * (r01 * r01 * 0.042 - 0.022);
      const rippleY = vortexStrength * 0.009 * Math.sin(r01 * 12 - wavePhase * 2 + ang * 2);
      arr[i * 3] = bx * maxR;
      arr[i * 3 + 1] = vortexY + rippleY;
      arr[i * 3 + 2] = bz * maxR;
    }
    sPos.needsUpdate = true;
    surfGeo.computeVertexNormals();
    batterMesh.position.y = baseY;
    return baseY;
  }

  return {
    group,
    bowlMesh,
    batterMesh,
    albumenMesh,
    yolks,
    updateLiquidSurface,
    rimHeight: H,
    outerRadius: R,
  };
}

/**
 * Avian Ovoid Farm Egg (Whole + 2-Piece Cracking Shell Halves)
 */
export function createFarmEggProp(materials, scale = 1.0) {
  const group = new THREE.Group();

  // Whole egg lathe profile (ordered BOTTOM to TOP so normals face OUTWARD!)
  const wholePts = [];
  for (let i = 28; i >= 0; i--) {
    const t = (i / 28) * Math.PI; // PI bottom .. 0 top apex
    const asym = 1.0 - 0.15 * Math.cos(t); // Slightly tapered top, fuller base
    const r = Math.sin(t) * 0.095 * asym * scale;
    const y = Math.cos(t) * 0.128 * scale;
    wholePts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const wholeGeo = new THREE.LatheGeometry(wholePts, 40);
  const wholeMesh = new THREE.Mesh(wholeGeo, materials.eggshell);
  wholeMesh.castShadow = true;
  wholeMesh.receiveShadow = true;
  group.add(wholeMesh);

  // Cracking Top & Bottom Shell Halves (visible during crack open!)
  const crackGroup = new THREE.Group();
  crackGroup.visible = false;
  group.add(crackGroup);

  function buildHalfShell(isTop) {
    const halfGroup = new THREE.Group();
    const hPts = [];
    const startI = isTop ? 14 : 28;
    const endI = isTop ? 0 : 14;
    for (let i = startI; i >= endI; i--) {
      const t = (i / 28) * Math.PI;
      const asym = 1.0 - 0.15 * Math.cos(t);
      const r = Math.sin(t) * 0.095 * asym * scale;
      const y = Math.cos(t) * 0.128 * scale;
      hPts.push(new THREE.Vector2(Math.max(0, r), y));
    }
    const gOuter = new THREE.LatheGeometry(hPts, 36);
    // Add organic jagged fracture teeth along the equatorial rim!
    const pArr = gOuter.attributes.position.array;
    for (let k = 0; k < pArr.length; k += 3) {
      if (Math.abs(pArr[k + 1]) < 0.014 * scale) {
        const ang = Math.atan2(pArr[k + 2], pArr[k]);
        const jag = (Math.sin(ang * 7) * 0.006 + Math.cos(ang * 13) * 0.004) * scale;
        pArr[k + 1] += jag;
      }
    }
    gOuter.computeVertexNormals();

    const outerM = new THREE.Mesh(gOuter, materials.eggshell);
    outerM.castShadow = true;
    const innerM = new THREE.Mesh(gOuter, materials.eggshellInner);
    halfGroup.add(outerM, innerM);
    return halfGroup;
  }

  const topHalf = buildHalfShell(true);
  const bottomHalf = buildHalfShell(false);
  crackGroup.add(topHalf, bottomHalf);

  return { group, wholeMesh, crackGroup, topHalf, bottomHalf };
}

/**
 * French Glass Milk Carafe with Pouring Spout & Dynamic Tilting Milk Volume
 */
export function createMilkCarafe(materials) {
  const group = new THREE.Group();

  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.155, 0),
    new THREE.Vector2(0.165, 0.03),
    new THREE.Vector2(0.172, 0.14),
    new THREE.Vector2(0.132, 0.28),
    new THREE.Vector2(0.105, 0.38),
    new THREE.Vector2(0.128, 0.45),
    new THREE.Vector2(0.120, 0.46),
    new THREE.Vector2(0.096, 0.38),
    new THREE.Vector2(0.122, 0.28),
    new THREE.Vector2(0.158, 0.14),
    new THREE.Vector2(0.142, 0.025),
    new THREE.Vector2(0, 0.025),
  ];
  const glassGeo = new THREE.LatheGeometry(pts, 48);
  // Pinch pouring lip on -X side (towards center bowl!)
  const gPos = glassGeo.attributes.position.array;
  for (let i = 0; i < gPos.length; i += 3) {
    const y = gPos[i + 1];
    if (y > 0.39 && gPos[i] < -0.02) {
      const lipFactor = (y - 0.39) / 0.07;
      const dirFactor = Math.max(0, -gPos[i] / 0.13);
      gPos[i] -= lipFactor * dirFactor * 0.032;
      gPos[i + 1] += lipFactor * dirFactor * 0.012;
    }
  }
  glassGeo.computeVertexNormals();

  const carafeMesh = new THREE.Mesh(glassGeo, materials.glass);
  carafeMesh.renderOrder = 3;
  group.add(carafeMesh);

  // Inner milk column
  const milkGeo = new THREE.CylinderGeometry(0.118, 0.152, 0.30, 36, 1, false);
  milkGeo.translate(0, 0.15, 0);
  const milkMesh = new THREE.Mesh(milkGeo, materials.milk);
  milkMesh.position.y = 0.028;
  milkMesh.castShadow = true;
  milkMesh.renderOrder = 1;
  group.add(milkMesh);

  // Spout world anchor helper
  const spoutAnchor = new THREE.Object3D();
  spoutAnchor.position.set(-0.152, 0.455, 0);
  group.add(spoutAnchor);

  function setMilkLevel(level01) {
    const lv = THREE.MathUtils.clamp(level01, 0.05, 1.0);
    milkMesh.scale.set(0.96 + lv * 0.04, lv, 0.96 + lv * 0.04);
    milkMesh.visible = level01 > 0.03;
  }

  return { group, carafeMesh, milkMesh, spoutAnchor, setMilkLevel };
}

/**
 * Patissier Balloon Whisk (Dark Walnut Handle + 6 Stainless Steel Wire Loops)
 */
export function createBalloonWhisk(materials) {
  const group = new THREE.Group();
  // Pivot is at bottom tip of whisk wires (y = 0) so tilting around bowl bottom feels natural!
  const handleGeo = new THREE.CylinderGeometry(0.022, 0.017, 0.24, 20);
  const handle = new THREE.Mesh(handleGeo, materials.darkWood);
  handle.position.y = 0.33;
  handle.castShadow = true;
  group.add(handle);

  const ferruleGeo = new THREE.CylinderGeometry(0.018, 0.015, 0.035, 20);
  const ferrule = new THREE.Mesh(ferruleGeo, materials.silver);
  ferrule.position.y = 0.205;
  group.add(ferrule);

  const loopCount = 6;
  for (let i = 0; i < loopCount; i++) {
    const ang = (i / loopCount) * Math.PI;
    const curvePts = [];
    for (let s = 0; s <= 20; s++) {
      const t = s / 20; // 0 ferrule -> 0.5 bottom belly -> 1 ferrule
      const sinT = Math.sin(t * Math.PI);
      const width = Math.pow(sinT, 0.78) * 0.072 * (t < 0.5 ? 1 : -1);
      const y = 0.20 - Math.sin(t * Math.PI) * 0.195;
      curvePts.push(new THREE.Vector3(Math.cos(ang) * width, y, Math.sin(ang) * width));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const wireGeo = new THREE.TubeGeometry(curve, 24, 0.0028, 8, false);
    const wire = new THREE.Mesh(wireGeo, materials.silver);
    group.add(wire);
  }

  return { group, handle };
}

/**
 * Fluted Crystal Pudding Mold Cup (with Caramel Layer, Rising Custard, Condensation Beads & Release Tab)
 */
export function createFlutedPuddingCup(materials) {
  const group = new THREE.Group();

  // Outer fluted glass cup (matches hero pudding proportions + glass wall thickness)
  const RBottom = 0.265;
  const RTop = 0.375;
  const H = 0.39;
  const wall = 0.022;

  const cupPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(RBottom, 0),
    new THREE.Vector2(RBottom + 0.01, 0.03),
    new THREE.Vector2(RTop, H),
    new THREE.Vector2(RTop + 0.012, H + 0.014),
    new THREE.Vector2(RTop - wall, H + 0.014),
    new THREE.Vector2(RBottom - wall + 0.01, 0.032),
    new THREE.Vector2(0, 0.032),
  ];
  const cupGeo = new THREE.LatheGeometry(cupPts, 72);
  // Add gentle 12-flute external/internal scalloped ribs matching the pudding!
  const cPos = cupGeo.attributes.position.array;
  for (let i = 0; i < cPos.length; i += 3) {
    const x = cPos[i];
    const y = cPos[i + 1];
    const z = cPos[i + 2];
    const r = Math.hypot(x, z);
    if (r > 0.06 && y > 0.03 && y < H - 0.01) {
      const theta = Math.atan2(z, x);
      const flute = 1.0 + 0.018 * Math.cos(12 * theta) * Math.sin(((y - 0.03) / (H - 0.04)) * Math.PI);
      cPos[i] *= flute;
      cPos[i + 2] *= flute;
    }
  }
  cupGeo.computeVertexNormals();

  const cupMesh = new THREE.Mesh(cupGeo, materials.glass);
  cupMesh.renderOrder = 4;
  group.add(cupMesh);

  // Brass/Amber Vacuum-Release Pin at outer base (points UP when cup is flipped upside-down!)
  const tabGeo = new THREE.CylinderGeometry(0.018, 0.026, 0.036, 20);
  const tabMesh = new THREE.Mesh(tabGeo, materials.brass);
  tabMesh.position.y = -0.016;
  group.add(tabMesh);

  // Dark Amber Caramel Layer resting at bottom inside cup
  const carGeo = new THREE.CylinderGeometry(RBottom - wall + 0.008, RBottom - wall, 0.036, 48);
  const caramelLayer = new THREE.Mesh(carGeo, materials.caramel);
  caramelLayer.position.y = 0.05;
  caramelLayer.renderOrder = 1;
  group.add(caramelLayer);

  // Rising Custard Fill inside cup (scales smoothly from 0 -> 1 during pouring & puffs slightly when steamed!)
  const fillGeo = new THREE.CylinderGeometry(RTop - wall - 0.008, RBottom - wall + 0.008, H - 0.085, 60, 8);
  fillGeo.translate(0, (H - 0.085) * 0.5, 0);
  const fillMat = materials.batter.clone();
  const custardFill = new THREE.Mesh(fillGeo, fillMat);
  custardFill.position.y = 0.066;
  custardFill.scale.set(1, 0.001, 1);
  custardFill.visible = false;
  custardFill.renderOrder = 2;
  group.add(custardFill);

  // Glass Condensation / Frost Beads (appear during steaming & chilling!)
  const beadsGroup = new THREE.Group();
  beadsGroup.visible = false;
  const beadGeo = new THREE.SphereGeometry(0.0065, 8, 6);
  for (let i = 0; i < 42; i++) {
    const t = 0.15 + ((i * 29) % 100) / 100 * 0.78;
    const ang = i * 2.39996;
    const rr = THREE.MathUtils.lerp(RBottom, RTop, t) + 0.002;
    const b = new THREE.Mesh(beadGeo, materials.ice);
    b.position.set(Math.cos(ang) * rr, t * H, Math.sin(ang) * rr);
    b.scale.set(1, 1.25, 0.55);
    beadsGroup.add(b);
  }
  group.add(beadsGroup);

  function setCustardFill(fill01, steamed01 = 0, richColor = null) {
    if (fill01 <= 0.01) {
      custardFill.visible = false;
      return;
    }
    custardFill.visible = true;
    const puff = 1.0 + Math.sin(steamed01 * Math.PI * 0.75) * 0.055;
    const radFit = THREE.MathUtils.lerp(0.76, 1.0, fill01);
    custardFill.scale.set(radFit, fill01 * puff, radFit);
    if (richColor) {
      fillMat.color.copy(richColor);
    }
    // Roughen slightly from liquid sheen (0.04) to silky set custard (0.12) as it steams
    fillMat.roughness = THREE.MathUtils.lerp(0.045, 0.125, steamed01);
  }

  return {
    group,
    cupMesh,
    tabMesh,
    caramelLayer,
    custardFill,
    beadsGroup,
    setCustardFill,
    height: H,
  };
}

/**
 * Studio Glass Steamer Dome Cloche with Turned Dark-Wood & Brass Knob
 */
export function createSteamerCloche(materials) {
  const group = new THREE.Group();

  const domePts = [];
  const R = 0.45;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; // 0 bottom skirt .. 1 top crown
    let r, y;
    if (t < 0.25) {
      const k = t / 0.25;
      r = R;
      y = k * 0.16;
    } else {
      const ang = ((t - 0.25) / 0.75) * Math.PI * 0.5;
      r = Math.cos(ang) * R;
      y = 0.16 + Math.sin(ang) * 0.38;
    }
    domePts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const domeGeo = new THREE.LatheGeometry(domePts, 56);
  const domeMesh = new THREE.Mesh(domeGeo, materials.glass);
  domeMesh.renderOrder = 5;
  group.add(domeMesh);

  // Brass rim band at bottom of dome
  const rimGeo = new THREE.TorusGeometry(R, 0.011, 12, 56);
  rimGeo.rotateX(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, materials.brass);
  rimMesh.position.y = 0.012;
  group.add(rimMesh);

  // Brass collar + dark walnut knob on top
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.025, 24), materials.brass);
  collar.position.y = 0.545;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.048, 24, 18), materials.darkWood);
  knob.scale.set(1.15, 0.82, 1.15);
  knob.position.y = 0.585;
  knob.castShadow = true;
  group.add(collar, knob);

  return { group, domeMesh, knob };
}

/**
 * Crystal Chiller Ring with Faceted Translucent Ice Cubes
 */
export function createIceBathRing(materials) {
  const group = new THREE.Group();

  const trayPts = [
    new THREE.Vector2(0.28, 0.0),
    new THREE.Vector2(0.50, 0.0),
    new THREE.Vector2(0.54, 0.13),
    new THREE.Vector2(0.52, 0.135),
    new THREE.Vector2(0.48, 0.02),
    new THREE.Vector2(0.29, 0.02),
  ];
  const trayGeo = new THREE.LatheGeometry(trayPts, 48);
  const trayMesh = new THREE.Mesh(trayGeo, materials.glass);
  trayMesh.renderOrder = 3;
  group.add(trayMesh);

  // 14 irregular glistening ice cubes nestled around the ring
  const cubeGeo = new THREE.BoxGeometry(0.095, 0.082, 0.092, 2, 2, 2);
  // Bevel/organic-warp ice cube vertices slightly
  const cp = cubeGeo.attributes.position.array;
  for (let i = 0; i < cp.length; i += 3) {
    const len = Math.hypot(cp[i], cp[i + 1], cp[i + 2]) || 1;
    const round = 0.88 + 0.12 * (1 / len * 0.08);
    cp[i] *= round;
    cp[i + 1] *= round;
    cp[i + 2] *= round;
  }
  cubeGeo.computeVertexNormals();

  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const rad = 0.39 + (i % 2) * 0.035;
    const iceMesh = new THREE.Mesh(cubeGeo, materials.ice);
    iceMesh.position.set(Math.cos(ang) * rad, 0.062 + (i % 3) * 0.014, Math.sin(ang) * rad);
    iceMesh.rotation.set(i * 0.7, ang + 0.4, i * 0.5);
    iceMesh.scale.setScalar(0.85 + (i % 4) * 0.1);
    iceMesh.renderOrder = 2;
    group.add(iceMesh);
  }

  return { group };
}

/**
 * Handcrafted Stoneware Dessert Plate + Dynamic Rippling Caramel Pool
 */
export function createDessertPlateAndPool(materials) {
  const group = new THREE.Group();

  const R = 0.68;
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.40, 0.018),
    new THREE.Vector2(0.56, 0.032),
    new THREE.Vector2(R, 0.082),
    new THREE.Vector2(R + 0.012, 0.095),
    new THREE.Vector2(R - 0.018, 0.102),
    new THREE.Vector2(0.52, 0.044),
    new THREE.Vector2(0.36, 0.030),
    new THREE.Vector2(0.0, 0.028),
  ];
  const plateGeo = new THREE.LatheGeometry(pts, 72);
  // Planar top-down UVs so radial ceramic glaze & iron rim texture align 100%!
  const pPos = plateGeo.attributes.position;
  const pUv = plateGeo.attributes.uv;
  for (let i = 0; i < pPos.count; i++) {
    const x = pPos.getX(i);
    const z = pPos.getZ(i);
    pUv.setXY(i, 0.5 + (x / (R + 0.02)) * 0.49, 0.5 + (z / (R + 0.02)) * 0.49);
  }

  const plateMesh = new THREE.Mesh(plateGeo, materials.plate);
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  // Expanding Glossy Caramel Pool in the plate well (smooth domed liquid meniscus!)
  const poolPts = [];
  for (let i = 18; i >= 0; i--) {
    const f = i / 18; // 1 outer edge -> 0 center
    // Lathe from bottom outer edge UP to center dome so normals point UP/OUTWARD!
    const r = f;
    const h = Math.pow(Math.max(0, 1 - f * f), 0.45) * 0.013;
    poolPts.push(new THREE.Vector2(r, h));
  }
  const poolGeo = new THREE.LatheGeometry(poolPts, 64);
  // Subtle organic liquid lobes
  const pArr2 = poolGeo.attributes.position.array;
  for (let i = 0; i < pArr2.length; i += 3) {
    const ang = Math.atan2(pArr2[i + 2], pArr2[i]);
    const lobe = 1.0 + Math.sin(ang * 5 + 0.7) * 0.03 + Math.cos(ang * 9) * 0.018;
    pArr2[i] *= lobe;
    pArr2[i + 2] *= lobe;
  }
  poolGeo.computeVertexNormals();
  const poolBase = new Float32Array(poolGeo.attributes.position.array);
  const poolMesh = new THREE.Mesh(poolGeo, materials.caramelPool || materials.caramel);
  poolMesh.position.y = 0.029;
  poolMesh.scale.set(0.35, 1, 0.35);
  poolMesh.visible = false;
  poolMesh.receiveShadow = true;
  poolMesh.renderOrder = 2;
  group.add(poolMesh);

  let poolRipplePhase = 0;
  let poolRippleAmp = 0;

  function updatePool(dt, radiusScale, impulse = 0) {
    poolRippleAmp = Math.min(1.0, poolRippleAmp + impulse);
    poolRippleAmp *= Math.max(0, 1 - dt * 2.8);
    poolRipplePhase += dt * 16.0;

    const r = THREE.MathUtils.clamp(radiusScale, 0.34, 0.54);
    poolMesh.scale.set(r, 1, r);

    if (poolRippleAmp > 0.01) {
      const pos = poolGeo.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < pos.count; i++) {
        const bx = poolBase[i * 3];
        const by = poolBase[i * 3 + 1];
        const bz = poolBase[i * 3 + 2];
        const d = Math.hypot(bx, bz);
        const wave = by > 0 ? Math.sin(d * 18 - poolRipplePhase) * 0.0045 * poolRippleAmp : 0;
        const lobe = 1.0 + Math.sin(Math.atan2(bz, bx) * 7 + 0.8) * 0.035;
        arr[i * 3] = bx * lobe;
        arr[i * 3 + 1] = by + wave;
        arr[i * 3 + 2] = bz * lobe;
      }
      pos.needsUpdate = true;
      poolGeo.computeVertexNormals();
    }
  }

  return { group, plateMesh, poolMesh, updatePool, wellY: 0.032 };
}

/**
 * Miniature Hammered-Copper Caramel Saucier Pan
 */
export function createCopperSaucier(materials) {
  const group = new THREE.Group();

  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.145, 0.045),
    new THREE.Vector2(0.165, 0.115),
    new THREE.Vector2(0.172, 0.122),
    new THREE.Vector2(0.156, 0.122),
    new THREE.Vector2(0.134, 0.048),
    new THREE.Vector2(0.10, 0.012),
    new THREE.Vector2(0, 0.012),
  ];
  const panGeo = new THREE.LatheGeometry(pts, 44);
  // Pinch pouring spout on -X side
  const pArr = panGeo.attributes.position.array;
  for (let i = 0; i < pArr.length; i += 3) {
    if (pArr[i + 1] > 0.09 && pArr[i] < -0.04) {
      const f = (pArr[i + 1] - 0.09) / 0.035;
      pArr[i] -= f * 0.028;
    }
  }
  panGeo.computeVertexNormals();

  const panMesh = new THREE.Mesh(panGeo, materials.copper);
  panMesh.castShadow = true;
  group.add(panMesh);

  // Inner molten caramel pool
  const carPool = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.11, 0.055, 32), materials.caramel);
  carPool.position.y = 0.055;
  group.add(carPool);

  // Long angled brass handle on +X side
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.155, 0.095, 0),
    new THREE.Vector3(0.28, 0.145, 0),
    new THREE.Vector3(0.42, 0.195, 0),
  ]);
  const handleGeo = new THREE.TubeGeometry(handleCurve, 16, 0.012, 12, false);
  const handleMesh = new THREE.Mesh(handleGeo, materials.brass);
  handleMesh.castShadow = true;
  group.add(handleMesh);

  const spoutAnchor = new THREE.Object3D();
  spoutAnchor.position.set(-0.185, 0.115, 0);
  group.add(spoutAnchor);

  const gripAnchor = new THREE.Object3D();
  gripAnchor.position.set(0.35, 0.17, 0.02);
  group.add(gripAnchor);

  return { group, panMesh, carPool, handleMesh, spoutAnchor, gripAnchor };
}

/**
 * Heirloom Mirror-Silver Dessert Spoon + Quivering Scooped Pudding Bite
 */
export function createSilverSpoon(materials) {
  const group = new THREE.Group();

  // Concave spoon bowl centered near origin so tip slices naturally!
  const bowlGeo = new THREE.SphereGeometry(0.075, 28, 20, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
  bowlGeo.scale(1.35, 0.36, 0.88);
  bowlGeo.translate(0, 0.022, 0);
  const bowlMesh = new THREE.Mesh(bowlGeo, materials.silver);
  bowlMesh.material = materials.silver.clone();
  bowlMesh.material.side = THREE.DoubleSide;
  bowlMesh.castShadow = true;
  group.add(bowlMesh);

  // Graceful curved silver handle extending along +X/+Y
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.088, 0.016, 0),
    new THREE.Vector3(0.18, 0.032, 0),
    new THREE.Vector3(0.32, 0.072, 0),
    new THREE.Vector3(0.45, 0.095, 0),
  ]);
  const neckGeo = new THREE.TubeGeometry(neckCurve, 24, 0.0095, 10, false);
  // Flatten handle into classic teardrop silver flatware profile
  const nArr = neckGeo.attributes.position.array;
  for (let i = 0; i < nArr.length; i += 3) {
    const x = nArr[i];
    const widen = THREE.MathUtils.smoothstep(x, 0.22, 0.44);
    nArr[i + 2] *= 1.0 + widen * 1.65;
  }
  neckGeo.computeVertexNormals();
  const handleMesh = new THREE.Mesh(neckGeo, materials.silver);
  handleMesh.castShadow = true;
  group.add(handleMesh);

  const gripAnchor = new THREE.Object3D();
  gripAnchor.position.set(0.36, 0.08, 0.02);
  group.add(gripAnchor);

  // Quivering Scooped Pudding Bite sitting inside spoon bowl!
  const biteGroup = new THREE.Group();
  biteGroup.position.set(-0.008, 0.012, 0);
  biteGroup.visible = false;
  group.add(biteGroup);

  const biteCustGeo = new THREE.SphereGeometry(0.062, 24, 18);
  biteCustGeo.scale(1.18, 0.72, 0.85);
  const biteCust = new THREE.Mesh(biteCustGeo, materials.batter);
  biteCust.position.y = 0.028;
  biteCust.castShadow = true;

  const biteCarGeo = new THREE.SphereGeometry(0.052, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
  biteCarGeo.scale(1.15, 0.45, 0.85);
  const biteCar = new THREE.Mesh(biteCarGeo, materials.caramel);
  biteCar.position.y = 0.052;
  biteGroup.add(biteCust, biteCar);

  let biteJiggle = 0;
  let biteVel = 0;

  function triggerBiteJiggle(vel = 2.5) {
    biteVel += vel;
  }

  function updateBite(dt) {
    if (!biteGroup.visible) return;
    biteVel += (-320 * biteJiggle - 4.2 * biteVel) * Math.min(dt, 0.04);
    biteJiggle = THREE.MathUtils.clamp(biteJiggle + biteVel * Math.min(dt, 0.04), -0.35, 0.35);
    const sy = 1 + biteJiggle;
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    biteGroup.scale.set(sxz, sy, sxz);
  }

  return { group, bowlMesh, handleMesh, biteGroup, biteCust, gripAnchor, triggerBiteJiggle, updateBite };
}

/**
 * Fresh Wet Ruby Strawberries + Pinch Bowl (Optional Reward Garnish!)
 */
export function createStrawberrySet(materials) {
  const container = new THREE.Group();

  // Small dark stoneware pinch bowl
  const bPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.165, 0.075),
    new THREE.Vector2(0.155, 0.08),
    new THREE.Vector2(0.10, 0.015),
    new THREE.Vector2(0, 0.015),
  ];
  const bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(bPts, 36), materials.chefApron);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  container.add(bowlMesh);

  // Heart-shaped conical strawberry geometry (BOTTOM tip to TOP crown so normals face OUTWARD!)
  const sPts = [];
  for (let i = 22; i >= 0; i--) {
    const t = i / 22; // 1 pointed tip .. 0 rounded crown
    const shoulder = Math.sin(Math.pow(t, 0.62) * Math.PI);
    const taper = 1.0 - Math.pow(t, 1.35) * 0.55;
    const r = shoulder * taper * 0.068;
    const y = (1.0 - t) * 0.118;
    sPts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const berryGeo = new THREE.LatheGeometry(sPts, 32);

  function buildSingleBerry() {
    const bg = new THREE.Group();
    const flesh = new THREE.Mesh(berryGeo, materials.strawberry);
    flesh.castShadow = true;
    bg.add(flesh);

    // 6 fresh green calyx leaves curving gracefully over the berry shoulder
    for (let l = 0; l < 6; l++) {
      const ang = (l / 6) * Math.PI * 2;
      const leafGeo = new THREE.ConeGeometry(0.018, 0.052, 5);
      leafGeo.scale(1.0, 1.0, 0.18);
      leafGeo.translate(0, 0.024, 0);
      leafGeo.rotateX(Math.PI * 0.42);
      const leaf = new THREE.Mesh(leafGeo, materials.berryLeaf);
      leaf.position.y = 0.114;
      leaf.rotation.y = ang;
      bg.add(leaf);
    }
    return bg;
  }

  const berries = [];
  const restOffsets = [
    new THREE.Vector3(-0.045, 0.028, 0.025),
    new THREE.Vector3(0.048, 0.028, 0.022),
    new THREE.Vector3(0.0, 0.032, -0.042),
  ];
  for (let i = 0; i < 3; i++) {
    const b = buildSingleBerry();
    b.position.copy(restOffsets[i]);
    b.rotation.set((i - 1) * 0.25, i * 2.1, (i % 2 === 0 ? 1 : -1) * 0.28);
    berries.push({
      mesh: b,
      restLocal: restOffsets[i].clone(),
      placedOnPudding: false,
      puddingOffset: new THREE.Vector3(),
      falling: false,
      vel: new THREE.Vector3(),
    });
    container.add(b);
  }

  return { container, bowlMesh, berries };
}

/**
 * Hero Soft-Body Pudding Assembly + Subtle Background Reference Tasting Pudding
 */
export function createHeroPudding(materials) {
  const geo = createPuddingGeometry({
    radiusBottom: 0.34,
    radiusTop: 0.235,
    height: 0.35,
    fluteCount: 12,
    fluteAmp: 0.019,
    radialSegs: 72,
    heightSegs: 36,
    capSegs: 12,
  });
  const mesh = new THREE.Mesh(geo, materials.heroPudding);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;

  const softBody = new PuddingSoftBody(mesh);
  return { mesh, softBody };
}

export function createSampleReferencePudding(textures, materials, lightPosUniform) {
  const group = new THREE.Group();
  // Small dark tasting saucer
  const saucerPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.24, 0.032),
    new THREE.Vector2(0.23, 0.038),
    new THREE.Vector2(0.14, 0.012),
    new THREE.Vector2(0, 0.012),
  ];
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 40), materials.plate);
  saucer.castShadow = true;
  saucer.receiveShadow = true;
  group.add(saucer);

  const miniMat = createHeroPuddingMaterial(textures, lightPosUniform);
  const miniGeo = createPuddingGeometry({
    radiusBottom: 0.135,
    radiusTop: 0.095,
    height: 0.14,
    radialSegs: 44,
    heightSegs: 20,
    capSegs: 6,
  });
  const miniMesh = new THREE.Mesh(miniGeo, miniMat);
  miniMesh.position.y = 0.012;
  miniMesh.castShadow = true;
  group.add(miniMesh);

  const miniSoft = new PuddingSoftBody(miniMesh);
  return { group, miniMesh, miniSoft };
}
