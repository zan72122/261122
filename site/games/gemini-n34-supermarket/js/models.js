import * as THREE from '../vendor/three.module.js';
import {
  getFloorTextures,
  getWallTileTexture,
  getWoodTexture,
  getShelfPackTexture,
  getWickerTexture,
  getConveyorTexture,
  getEcoBagTexture,
  getCartonTexture,
  getFoodSkinTexture,
  getContactShadowTexture,
  getAisleSignTexture,
  createPosScreenCanvas,
  updatePosScreen,
} from './textures.js';

// Shared photorealistic PBR materials
const matChrome = new THREE.MeshStandardMaterial({ color: 0xdce4ec, metalness: 0.90, roughness: 0.16 });
const matSteel = new THREE.MeshStandardMaterial({ color: 0xbac4ce, metalness: 0.78, roughness: 0.28 });
const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x252a32, metalness: 0.62, roughness: 0.36 });
const matShelfMetal = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.35, roughness: 0.38 });
export const matHitZone = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});
const matGlass = new THREE.MeshPhysicalMaterial({
  color: 0xdff2ff,
  transparent: true,
  opacity: 0.22,
  roughness: 0.06,
  metalness: 0.05,
  reflectivity: 0.95,
});

function addContactShadow(parent, radius = 0.18, y = 0.004) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  parent.add(m);
  return m;
}

function addBarcodeSticker(parent, x, y, z, rx = 0, ry = 0, rz = 0, w = 0.062, h = 0.04) {
  const mat = new THREE.MeshStandardMaterial({
    map: getFoodSkinTexture('barcode_sticker'),
    roughness: 0.55,
    metalness: 0.02,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

// ============================================================
// 1. PHOTOREALISTIC CHUNKY 3D FOOD MODELS (Large & Appetizing!)
// ============================================================
export function createFoodMesh(type, { withShadow = true } = {}) {
  const group = new THREE.Group();
  group.userData.foodType = type;

  if (withShadow) addContactShadow(group, type === 'baguette' ? 0.22 : 0.16, 0.004);

  if (type === 'tomato') {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xd61e14,
      roughness: 0.14,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.142, 24, 18), bodyMat);
    body.scale.set(1.06, 0.88, 1.06);
    body.position.y = 0.125;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x26752a, roughness: 0.45 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 6), leafMat);
      leaf.position.set(Math.cos(a) * 0.042, 0.25, Math.sin(a) * 0.042);
      leaf.rotation.z = -Math.cos(a) * 1.15;
      leaf.rotation.x = Math.sin(a) * 1.15;
      group.add(leaf);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.055, 8), leafMat);
    stem.position.y = 0.278;
    stem.rotation.z = 0.2;
    group.add(stem);

    addBarcodeSticker(group, 0, 0.125, 0.15, 0, 0, 0, 0.058, 0.038);
  } else if (type === 'carrot') {
    const sub = new THREE.Group();
    const carrotMat = new THREE.MeshStandardMaterial({
      map: getFoodSkinTexture('carrot'),
      roughness: 0.34,
      metalness: 0.02,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.017, 0.33, 18), carrotMat);
    body.castShadow = true;
    body.receiveShadow = true;
    sub.add(body);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), carrotMat);
    tip.position.y = -0.165;
    sub.add(tip);

    const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), carrotMat);
    topCap.scale.set(1, 0.45, 1);
    topCap.position.y = 0.164;
    sub.add(topCap);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8c34, roughness: 0.52 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.145, 6), leafMat);
      frond.position.set(Math.cos(a) * 0.032, 0.235, Math.sin(a) * 0.032);
      frond.rotation.z = -Math.cos(a) * 0.44;
      frond.rotation.x = Math.sin(a) * 0.44;
      frond.castShadow = true;
      sub.add(frond);
    }

    sub.rotation.z = -0.45;
    sub.rotation.x = 0.22;
    sub.position.set(0.02, 0.148, 0);
    group.add(sub);
    addBarcodeSticker(group, 0.02, 0.148, 0.076, 0, 0, -0.45, 0.052, 0.036);
  } else if (type === 'broccoli') {
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x72b84e, roughness: 0.52 });
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.044, 0.165, 14), stalkMat);
    stalk.position.y = 0.09;
    stalk.castShadow = true;
    group.add(stalk);

    const crownMat = new THREE.MeshStandardMaterial({ color: 0x1f6621, roughness: 0.80 });
    const crownLightMat = new THREE.MeshStandardMaterial({ color: 0x2f822d, roughness: 0.74 });
    const florets = [
      [0, 0.225, 0, 0.095],
      [-0.082, 0.185, 0.03, 0.076],
      [0.082, 0.185, 0.03, 0.076],
      [-0.052, 0.205, -0.068, 0.074],
      [0.052, 0.205, -0.068, 0.074],
      [0, 0.18, 0.08, 0.072],
      [-0.046, 0.255, 0.024, 0.066],
      [0.046, 0.255, 0.02, 0.066],
    ];
    florets.forEach(([x, y, z, r], i) => {
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 1),
        i % 2 === 0 ? crownMat : crownLightMat
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });
    addBarcodeSticker(group, 0, 0.088, 0.056, 0, 0, 0, 0.052, 0.036);
  } else if (type === 'corn') {
    const sub = new THREE.Group();
    const cornMat = new THREE.MeshStandardMaterial({
      map: getFoodSkinTexture('corn'),
      roughness: 0.3,
      metalness: 0.02,
    });
    const cob = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.195, 8, 16), cornMat);
    cob.castShadow = true;
    sub.add(cob);

    const huskMat = new THREE.MeshStandardMaterial({ color: 0x419438, roughness: 0.58, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.225, 6), huskMat);
      leaf.position.set(Math.cos(a) * 0.048, -0.06, Math.sin(a) * 0.048);
      leaf.rotation.z = -Math.cos(a) * 0.32;
      leaf.rotation.x = Math.sin(a) * 0.32;
      leaf.rotation.y = a;
      sub.add(leaf);
    }
    sub.rotation.z = 0.26;
    sub.position.y = 0.155;
    group.add(sub);
    addBarcodeSticker(group, 0, 0.135, 0.072, 0, 0, 0.26, 0.052, 0.035);
  } else if (type === 'milk' || type === 'strawberry_milk' || type === 'orange_juice') {
    const tex = getCartonTexture(type);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.24,
      metalness: 0.03,
    });
    const topColor = type === 'milk' ? 0x1965c4 : type === 'strawberry_milk' ? 0xd93862 : 0xe07610;
    const gableMat = new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.28 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.30 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.245, 0.152), bodyMat);
    body.position.y = 0.1225;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Authentic pitched roof prism gable (exact flush fit, zero overhang!)
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-0.076, 0);
    roofShape.lineTo(0.076, 0);
    roofShape.lineTo(0.008, 0.072);
    roofShape.lineTo(-0.008, 0.072);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.152, bevelEnabled: false });
    roofGeo.translate(0, 0, -0.076);
    roofGeo.rotateY(Math.PI / 2);
    const gable = new THREE.Mesh(roofGeo, gableMat);
    gable.position.y = 0.245;
    gable.castShadow = true;
    group.add(gable);

    // Clean folded white paperboard top seal fin (matches carton width neatly!)
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.024, 0.015), whiteMat);
    fin.position.y = 0.326;
    fin.castShadow = true;
    group.add(fin);
  } else if (type === 'croissant') {
    const breadMat = new THREE.MeshStandardMaterial({
      map: getFoodSkinTexture('croissant'),
      roughness: 0.36,
      metalness: 0.02,
    });
    const segments = [
      { x: 0, y: 0.078, z: -0.01, r: 0.074, sx: 1.12, sy: 0.88, sz: 0.96, rz: 0 },
      { x: -0.072, y: 0.066, z: 0.016, r: 0.058, sx: 1.15, sy: 0.84, sz: 0.9, rz: 0.38 },
      { x: 0.072, y: 0.066, z: 0.016, r: 0.058, sx: 1.15, sy: 0.84, sz: 0.9, rz: -0.38 },
      { x: -0.13, y: 0.044, z: 0.056, r: 0.039, sx: 1.24, sy: 0.78, sz: 0.84, rz: 0.78 },
      { x: 0.13, y: 0.044, z: 0.056, r: 0.039, sx: 1.24, sy: 0.78, sz: 0.84, rz: -0.78 },
    ];
    segments.forEach((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 16, 12), breadMat);
      m.position.set(s.x, s.y, s.z);
      m.scale.set(s.sx, s.sy, s.sz);
      m.rotation.z = s.rz;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });
    addBarcodeSticker(group, 0, 0.068, 0.066, -0.25, 0, 0, 0.052, 0.034);
  } else if (type === 'melonpan') {
    const domeMat = new THREE.MeshStandardMaterial({
      map: getFoodSkinTexture('melonpan'),
      roughness: 0.52,
      metalness: 0.02,
    });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xd49646, roughness: 0.70 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.134, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.65), domeMat);
    dome.scale.set(1.04, 0.78, 1.04);
    dome.position.y = 0.046;
    dome.castShadow = true;
    dome.receiveShadow = true;
    group.add(dome);

    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.118, 0.04, 20), baseMat);
    bottom.position.y = 0.022;
    group.add(bottom);
    addBarcodeSticker(group, 0, 0.066, 0.134, -0.3, 0, 0, 0.052, 0.034);
  } else if (type === 'baguette') {
    const bagMat = new THREE.MeshStandardMaterial({
      map: getFoodSkinTexture('baguette'),
      roughness: 0.58,
      metalness: 0.02,
    });
    // Rests naturally flat/angled on the wicker tray (no floating tilt!)
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.25, 10, 18), bagMat);
    loaf.rotation.z = Math.PI * 0.48;
    loaf.rotation.y = 0.26;
    loaf.position.y = 0.066;
    loaf.castShadow = true;
    loaf.receiveShadow = true;
    group.add(loaf);
    addBarcodeSticker(group, 0, 0.072, 0.064, -0.15, 0.26, 0, 0.052, 0.034);
  }

  return group;
}

// ============================================================
// 2. REALISTIC SHOPPING CART (Prominent Red Handlebar + Wire Basket)
// ============================================================
export function createShoppingCart() {
  const cart = new THREE.Group();

  const handleGroup = new THREE.Group();
  const handleMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6241c,
    roughness: 0.20,
    metalness: 0.06,
    clearcoat: 0.85,
  });
  // Positioned forward & clearly visible in the lower foreground!
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.78, 18), handleMat);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 0.94, 0.34);
  handleBar.castShadow = true;
  handleGroup.add(handleBar);

  [-0.39, 0.39].forEach((sx) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), matChrome);
    cap.position.set(sx, 0.94, 0.34);
    handleGroup.add(cap);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.38, 10), matChrome);
    post.position.set(sx, 0.76, 0.30);
    post.rotation.x = 0.24;
    cart.add(post);
  });

  // Generous invisible touch zone around red handlebar (raycastable!)
  handleBar.userData.interactive = 'cart_handle';
  const handleHit = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.32, 0.36), matHitZone);
  handleHit.position.set(0, 0.94, 0.34);
  handleHit.userData.interactive = 'cart_handle';
  handleGroup.add(handleHit);

  cart.add(handleGroup);

  // Open Chrome Wire Shopping Basket
  const basket = new THREE.Group();
  basket.position.set(0, 0.68, -0.06);

  const w = 0.74;
  const h = 0.32;
  const d = 0.60;

  const addRim = (y, sx, sz) => {
    const barF = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, sx, 8), matChrome);
    barF.rotation.z = Math.PI / 2; barF.position.set(0, y, -sz / 2); basket.add(barF);
    const barB = barF.clone(); barB.position.z = sz / 2; basket.add(barB);
    const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, sz, 8), matChrome);
    barL.rotation.x = Math.PI / 2; barL.position.set(-sx / 2, y, 0); basket.add(barL);
    const barR = barL.clone(); barR.position.x = sx / 2; basket.add(barR);
  };
  addRim(h / 2, w, d);
  addRim(-h / 2, w * 0.88, d * 0.88);
  addRim(0, w * 0.94, d * 0.94);

  const wireGeo = new THREE.CylinderGeometry(0.0055, 0.0055, h, 6);
  for (let i = -4; i <= 4; i++) {
    const x = (i / 4) * (w * 0.44);
    const wf = new THREE.Mesh(wireGeo, matChrome);
    wf.position.set(x, 0, -d * 0.47);
    wf.rotation.x = -0.1;
    basket.add(wf);
    const wb = new THREE.Mesh(wireGeo, matChrome);
    wb.position.set(x, 0, d * 0.47);
    wb.rotation.x = 0.1;
    basket.add(wb);
  }
  for (let i = -3; i <= 3; i++) {
    const z = (i / 3) * (d * 0.42);
    const wl = new THREE.Mesh(wireGeo, matChrome);
    wl.position.set(-w * 0.47, 0, z);
    wl.rotation.z = 0.1;
    basket.add(wl);
    const wr = new THREE.Mesh(wireGeo, matChrome);
    wr.position.set(w * 0.47, 0, z);
    wr.rotation.z = -0.1;
    basket.add(wr);
  }

  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.86, 0.018, d * 0.86),
    new THREE.MeshStandardMaterial({ color: 0xcbd3dc, metalness: 0.65, roughness: 0.34 })
  );
  basePlate.position.y = -h / 2;
  basePlate.receiveShadow = true;
  basket.add(basePlate);

  [-w / 2, w / 2].forEach((bx) => {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.062), handleMat);
    bumper.position.set(bx, h / 2, -d / 2);
    basket.add(bumper);
  });

  const basketHit = new THREE.Mesh(new THREE.BoxGeometry(w * 1.18, 0.46, d * 1.18), matHitZone);
  basketHit.position.set(0, 0.08, 0);
  basketHit.userData.interactive = 'cart_basket';
  basket.add(basketHit);

  const itemContainer = new THREE.Group();
  itemContainer.position.set(0, -h / 2 + 0.02, 0.02);
  basket.add(itemContainer);

  cart.add(basket);

  // Lower frame & caster wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.72 });
  const wheels = [];
  [[-0.31, -0.32], [0.31, -0.32], [-0.31, 0.28], [0.31, 0.28]].forEach(([wx, wz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8), matChrome);
    leg.position.set(wx, 0.3, wz);
    cart.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.032, 14), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.065, wz);
    cart.add(wheel);
    wheels.push(wheel);
  });

  return { root: cart, handleGroup, handleBar, basket, itemContainer, wheels };
}

// ============================================================
// 3. BIG EXPRESSIVE REALISTIC 3D PLAYER HAND (Left or Right!)
// ============================================================
export function createPlayerHand(side = 1) {
  const hand = new THREE.Group();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2c19e,
    roughness: 0.46,
    metalness: 0.0,
    clearcoat: 0.06,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xffded0),
  });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xdf5872, roughness: 0.76 });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xf2e8e4, roughness: 0.82 });

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.32, 14), cuffMat);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.set(0, -0.02, 0.25);
  hand.add(forearm);

  const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14), ribMat);
  rib.rotation.x = Math.PI / 2;
  rib.position.set(0, -0.016, 0.11);
  hand.add(rib);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.046, 0.08, 12), skinMat);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, -0.01, 0.075);
  hand.add(wrist);

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.066, 16, 12), skinMat);
  palm.scale.set(1.06, 0.50, 1.15);
  palm.castShadow = true;
  hand.add(palm);

  const fingers = [];
  const fSpecs = [
    { x: -0.046, len: 0.092, r: 0.0155, z: -0.062 },
    { x: -0.015, len: 0.108, r: 0.0165, z: -0.070 },
    { x:  0.016, len: 0.104, r: 0.0160, z: -0.066 },
    { x:  0.046, len: 0.084, r: 0.0145, z: -0.054 },
  ];
  fSpecs.forEach((f) => {
    const pivot = new THREE.Group();
    pivot.position.set(f.x * side, 0.004, f.z);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(f.r, f.len, 6, 10), skinMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = -f.len * 0.54;
    mesh.castShadow = true;
    pivot.add(mesh);
    hand.add(pivot);
    fingers.push(pivot);
  });

  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-0.06 * side, -0.012, -0.005);
  thumbPivot.rotation.y = 0.52 * side;
  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.0185, 0.068, 6, 10), skinMat);
  thumbMesh.rotation.x = Math.PI / 2;
  thumbMesh.position.z = -0.04;
  thumbPivot.add(thumbMesh);
  hand.add(thumbPivot);

  hand.userData.setPose = (gripAmount) => {
    const curl = 0.16 + gripAmount * 0.88;
    fingers.forEach((p, idx) => {
      p.rotation.x = -curl - idx * 0.035;
    });
    thumbPivot.rotation.z = (-0.22 - gripAmount * 0.52) * side;
    thumbPivot.rotation.y = (0.52 - gripAmount * 0.34) * side;
  };
  hand.userData.setPose(0.25);

  return hand;
}

// ============================================================
// 4. REALISTIC PROPORTIONED FRIENDLY SUPERMARKET CASHIER
// ============================================================
export function createCashier() {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1bfa0,
    roughness: 0.44,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xffdfd0),
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x362218, roughness: 0.50 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ec, roughness: 0.72 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x266e42, roughness: 0.68 });
  const apronDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e5834, roughness: 0.72 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xea867e, roughness: 0.6, transparent: true, opacity: 0.34 });

  // Natural grounded lower/upper torso behind checkout counter (never floating!)
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.48, 18), apronMat);
  waist.position.y = 0.86;
  waist.scale.set(1.12, 1, 0.72);
  root.add(waist);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.175, 0.36, 18), shirtMat);
  chest.position.y = 1.26;
  chest.scale.set(1.14, 1, 0.72);
  chest.castShadow = true;
  root.add(chest);

  // Rounded natural shoulders (seamless connection to arms!)
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.34, 8, 14), shirtMat);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.set(0, 1.39, 0);
  shoulders.scale.set(1, 1, 0.88);
  shoulders.castShadow = true;
  root.add(shoulders);

  // Tailored blouse collar flaps
  [-0.065, 0.065].forEach((cx) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.06), shirtMat);
    col.position.set(cx, 1.48, 0.065);
    col.rotation.z = cx > 0 ? 0.32 : -0.32;
    root.add(col);
  });

  // Fitted Supermarket Apron Bib + Straps + Pocket + Gold Star Pin (ZERO text!)
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.045), apronMat);
  bib.position.set(0, 1.15, 0.132);
  bib.castShadow = true;
  root.add(bib);

  [-0.125, 0.125].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.19, 0.03), apronMat);
    strap.position.set(sx, 1.41, 0.105);
    strap.rotation.x = -0.35;
    root.add(strap);
  });

  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.025), apronDarkMat);
  pocket.position.set(0, 1.04, 0.156);
  root.add(pocket);

  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0xf5c236, roughness: 0.25, metalness: 0.48 })
  );
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.095, 1.30, 0.16);
  root.add(badge);

  // Natural slender neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.066, 0.14, 14), skinMat);
  neck.position.y = 1.52;
  root.add(neck);

  // Sculpted Realistic Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.71, 0.02);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.166, 24, 20), skinMat);
  cranium.scale.set(0.92, 1.04, 0.96);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Soft chin taper for natural human face profile
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 12), skinMat);
  jaw.position.set(0, -0.068, 0.026);
  jaw.scale.set(0.92, 0.88, 0.85);
  headGroup.add(jaw);

  // Ears
  [-0.148, 0.148].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skinMat);
    ear.scale.set(0.48, 1.05, 0.72);
    ear.position.set(ex, -0.01, -0.01);
    headGroup.add(ear);
  });

  // Layered realistic hairstyle (crown, side framing locks, back bun, subtle bangs)
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.178, 22, 16), hairMat);
  hairCrown.position.set(0, 0.032, -0.024);
  hairCrown.scale.set(1.0, 1.04, 1.02);
  headGroup.add(hairCrown);

  [-0.125, 0.125].forEach((hx) => {
    const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.15, 6, 10), hairMat);
    lock.position.set(hx, -0.04, -0.02);
    lock.rotation.z = hx > 0 ? 0.16 : -0.16;
    headGroup.add(lock);
  });

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), hairMat);
  bun.position.set(0, 0.18, -0.105);
  headGroup.add(bun);

  // Supermarket green cap/visor
  const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.172, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), apronMat);
  capCrown.position.set(0, 0.055, -0.01);
  headGroup.add(capCrown);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.195, 0.016, 18, 1, false, -Math.PI * 0.34, Math.PI * 0.68), apronDarkMat);
  brim.position.set(0, 0.095, 0.058);
  brim.rotation.x = 0.15;
  headGroup.add(brim);

  // Expressive Eyes with natural iris, dark pupil, specular sparkle & eyelid crease
  const whiteEyeMat = new THREE.MeshStandardMaterial({ color: 0xfbf9f6, roughness: 0.12 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x4b3122, roughness: 0.15 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x15100d, roughness: 0.08 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x362218, roughness: 0.65 });

  const eyes = [];
  const brows = [];
  [-0.056, 0.056].forEach((ex) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(ex, 0.01, 0.145);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 12), whiteEyeMat);
    sclera.scale.set(1.06, 0.96, 0.5);
    eyeGroup.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 12, 10), irisMat);
    iris.position.set(0, 0, 0.009);
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), pupilMat);
    pupil.position.set(0, 0, 0.018);
    eyeGroup.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), glintMat);
    glint.position.set(0.006, 0.007, 0.026);
    eyeGroup.add(glint);

    // Subtle upper lash line
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0045, 6, 12, Math.PI), browMat);
    lash.position.set(0, 0.004, 0.012);
    eyeGroup.add(lash);

    headGroup.add(eyeGroup);
    eyes.push({ eyeGroup, pupil: iris });

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.040, 4, 8), browMat);
    brow.rotation.z = Math.PI / 2 + (ex > 0 ? -0.1 : 0.1);
    brow.position.set(ex, 0.058, 0.15);
    headGroup.add(brow);
    brows.push(brow);

    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), cheekMat);
    cheek.position.set(ex * 1.48, -0.036, 0.145);
    cheek.rotation.y = ex * 4.2;
    headGroup.add(cheek);
  });

  // Sculpted subtle nose bridge
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), skinMat);
  nose.scale.set(0.85, 1.1, 1.0);
  nose.position.set(0, -0.02, 0.164);
  headGroup.add(nose);

  // Natural warm smiling mouth
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xc85a56, roughness: 0.42 });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0072, 8, 16, Math.PI), lipMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.062, 0.151);
  headGroup.add(smile);

  root.add(headGroup);

  // Seamlessly connected Articulated Left & Right Arms + Hands!
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.235, 1.38, 0.01);

    const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.074, 12, 10), shirtMat);
    pivot.add(shoulderJoint);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.14, 6, 12), shirtMat);
    sleeve.position.set(side * 0.015, -0.11, 0.02);
    sleeve.rotation.x = -0.2;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.21, 6, 12), skinMat);
    forearm.position.set(side * 0.02, -0.26, 0.11);
    forearm.rotation.x = -0.68;
    forearm.castShadow = true;
    pivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), skinMat);
    hand.scale.set(0.95, 0.65, 1.18);
    hand.position.set(side * 0.02, -0.35, 0.22);
    pivot.add(hand);

    root.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.98, 0.48), matHitZone);
  hit.position.set(0, 1.48, 0.05);
  hit.userData.interactive = 'cashier';
  root.add(hit);

  return { root, headGroup, eyes, brows, smile, leftArm, rightArm };
}

// ============================================================
// 5. REALISTIC WOVEN CANVAS ECO-BAG (Plumps & Holds Packed Food!)
// ============================================================
export function createEcoBag() {
  const bag = new THREE.Group();
  const canvasMat = new THREE.MeshStandardMaterial({
    map: getEcoBagTexture(),
    roughness: 0.86,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xc2b298,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x356e46, roughness: 0.78 });

  const bodyGroup = new THREE.Group();
  const w = 0.44;
  const h = 0.40;
  const d = 0.28;

  addContactShadow(bodyGroup, 0.28, 0.004);

  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  front.position.set(0, h / 2, d / 2);
  front.castShadow = true;
  front.receiveShadow = true;
  bodyGroup.add(front);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  back.position.set(0, h / 2, -d / 2);
  back.rotation.y = Math.PI;
  back.castShadow = true;
  bodyGroup.add(back);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), innerMat);
  left.position.set(-w / 2, h / 2, 0);
  left.rotation.y = -Math.PI / 2;
  bodyGroup.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(d, h), innerMat);
  right.position.set(w / 2, h / 2, 0);
  right.rotation.y = Math.PI / 2;
  bodyGroup.add(right);

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), innerMat);
  bottom.position.y = 0.01;
  bodyGroup.add(bottom);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.016, 0.03, d + 0.016), strapMat);
  rim.position.y = h;
  bodyGroup.add(rim);

  [-d / 2 + 0.018, d / 2 - 0.018].forEach((hz) => {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.017, 8, 18, Math.PI), strapMat);
    handle.position.set(0, h + 0.01, hz);
    handle.castShadow = true;
    bodyGroup.add(handle);
  });

  // Shiny Gold Star Medal (appears on bag completion!)
  const ribbonStar = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.068, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffcf33,
      emissive: 0x6b4200,
      roughness: 0.22,
      metalness: 0.72,
    })
  );
  ribbonStar.scale.set(1, 1, 0.32);
  ribbonStar.position.set(0, h * 0.62, d / 2 + 0.028);
  ribbonStar.visible = false;
  bodyGroup.add(ribbonStar);

  bag.add(bodyGroup);

  const packedContainer = new THREE.Group();
  bag.add(packedContainer);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.60), matHitZone);
  hit.position.set(0, 0.28, 0);
  hit.userData.interactive = 'eco_bag';
  bag.add(hit);

  return { root: bag, bodyGroup, packedContainer, ribbonStar };
}

// ============================================================
// 6. PHOTOREALISTIC SUPERMARKET INTERIOR ENVIRONMENT
// ============================================================
export function buildSupermarketWorld(scene) {
  const world = new THREE.Group();
  scene.add(world);

  // --- FLOOR (Glossy terrazzo ceramic supermarket tiles) ---
  const floorTex = getFloorTextures();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 24),
    new THREE.MeshStandardMaterial({
      map: floorTex.map,
      roughnessMap: floorTex.roughnessMap,
      roughness: 0.36,
      metalness: 0.06,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(7.5, 0, -2.5);
  floor.receiveShadow = true;
  world.add(floor);

  // --- TILED SUPERMARKET BACK WALL & ARCHITECTURAL TRIM ---
  const wallMat = new THREE.MeshStandardMaterial({ map: getWallTileTexture(), roughness: 0.48, metalness: 0.04 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(36, 5.2, 0.3), wallMat);
  backWall.position.set(7.5, 2.6, -5.2);
  backWall.receiveShadow = true;
  world.add(backWall);

  // Dark forest-green supermarket header fascia & warm wood rail along back wall
  const accentBand = new THREE.Mesh(
    new THREE.BoxGeometry(36, 0.32, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x265c37, roughness: 0.46 })
  );
  accentBand.position.set(7.5, 2.95, -5.16);
  world.add(accentBand);

  const kickPlate = new THREE.Mesh(new THREE.BoxGeometry(36, 0.22, 0.35), matDarkMetal);
  kickPlate.position.set(7.5, 0.11, -5.16);
  world.add(kickPlate);

  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0xe4ddd1, roughness: 0.8 });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 24), sideWallMat);
  leftWall.position.set(-4.5, 2.6, -2.5);
  world.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 24), sideWallMat);
  rightWall.position.set(19.5, 2.6, -2.5);
  world.add(rightWall);

  // Recessed supermarket ceiling + overhead commercial LED light panels
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 24),
    new THREE.MeshStandardMaterial({ color: 0xe6e1d9, roughness: 0.9 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(7.5, 4.45, -2.5);
  world.add(ceiling);

  const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xfffcf4 });
  for (let lx = -1; lx <= 16; lx += 3.6) {
    for (let lz = -3.4; lz <= 2.2; lz += 2.8) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.44), matSteel);
      fixture.position.set(lx, 4.35, lz);
      world.add(fixture);
      const bulb = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.36), lightPanelMat);
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(lx, 4.31, lz);
      world.add(bulb);
    }
  }

  // --- REALISTIC METAL GROCERY GONDOLA SHELVING (Background Depth!) ---
  const packMats = [0, 1, 2, 3, 4, 5].map(
    (i) => new THREE.MeshStandardMaterial({ map: getShelfPackTexture(i), roughness: 0.36, metalness: 0.04 })
  );
  const bottleMats = [
    new THREE.MeshPhysicalMaterial({ color: 0x2d7a36, roughness: 0.14, clearcoat: 0.9 }),
    new THREE.MeshPhysicalMaterial({ color: 0xd98218, roughness: 0.14, clearcoat: 0.9 }),
    new THREE.MeshPhysicalMaterial({ color: 0xb82420, roughness: 0.14, clearcoat: 0.9 }),
  ];

  for (let sx = -2.4; sx <= 17.8; sx += 2.45) {
    const gondola = new THREE.Group();
    gondola.position.set(sx, 0, -4.55);

    // Back pegboard & dark steel side uprights
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(2.26, 2.55, 0.06), matShelfMetal);
    backPanel.position.set(0, 1.275, -0.26);
    gondola.add(backPanel);

    [-1.12, 1.12].forEach((ux) => {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.58, 0.56), matDarkMetal);
      upright.position.set(ux, 1.29, 0);
      gondola.add(upright);
    });

    // 4 realistic metal shelves with glossy price-rail trim + real jars, bottles, cans & boxes!
    for (let row = 0; row < 4; row++) {
      const sy = 0.28 + row * 0.56;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.036, 0.52), matShelfMetal);
      deck.position.set(0, sy, 0);
      gondola.add(deck);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.038, 0.02), matDarkMetal);
      rail.position.set(0, sy - 0.006, 0.26);
      gondola.add(rail);

      for (let col = 0; col < 6; col++) {
        const px = -0.88 + col * 0.35;
        const hash = Math.abs(Math.floor(sx * 3 + row * 7 + col * 11));
        if (row === 2 || (row === 1 && col % 2 === 0)) {
          // Glossy glass grocery bottles / jars
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.30, 10), bottleMats[hash % bottleMats.length]);
          b.position.set(px, sy + 0.17, 0.05);
          gondola.add(b);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.07, 8), matDarkMetal);
          cap.position.set(px, sy + 0.34, 0.05);
          gondola.add(cap);
        } else if (row === 0) {
          // Stacked cylindrical grocery cans with colorful paper bands
          const can = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.24, 12), packMats[hash % packMats.length]);
          can.position.set(px, sy + 0.14, 0.06);
          gondola.add(can);
        } else {
          // Realistic pictorial grocery cartons/boxes
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.18), packMats[hash % packMats.length]);
          box.position.set(px, sy + 0.19, 0.05);
          gondola.add(box);
        }
      }
    }
    world.add(gondola);
  }

  // Hanging pictorial department signs (matte printed store signage, framed cleanly, ZERO text!)
  const addHangingSign = (x, z, section, y = 2.44) => {
    const signGroup = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 0.54, 0.05),
      new THREE.MeshStandardMaterial({ map: getAisleSignTexture(section), roughness: 0.82, metalness: 0.02 })
    );
    signGroup.add(board);
    [-0.60, 0.60].forEach((rx) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.0, 6), matChrome);
      rod.position.set(rx, 1.25, 0);
      signGroup.add(rod);
    });
    signGroup.position.set(x, y, z);
    world.add(signGroup);
  };

  // ==========================================================
  // STATION 1: PRODUCE SECTION (X = 0, Z = -1.65)
  // ==========================================================
  const produceGroup = new THREE.Group();
  produceGroup.position.set(0, 0, -1.65);
  world.add(produceGroup);
  addHangingSign(0, -1.85, 'produce');

  const darkWoodMat = new THREE.MeshStandardMaterial({ map: getWoodTexture('dark'), roughness: 0.64 });
  const warmWoodMat = new THREE.MeshStandardMaterial({ map: getWoodTexture('warm'), roughness: 0.58 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x263b2b, roughness: 0.62 });

  const prodBase = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.86, 1.18), darkWoodMat);
  prodBase.position.set(0, 0.43, 0);
  prodBase.castShadow = true;
  prodBase.receiveShadow = true;
  produceGroup.add(prodBase);

  const prodKick = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.12, 1.2), matDarkMetal);
  prodKick.position.set(0, 0.06, 0);
  produceGroup.add(prodKick);

  const prodSlope = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.08, 1.26), warmWoodMat);
  prodSlope.position.set(0, 0.90, 0.02);
  prodSlope.rotation.x = 0.14;
  prodSlope.receiveShadow = true;
  produceGroup.add(prodSlope);

  const prodLip = new THREE.Mesh(new THREE.BoxGeometry(2.98, 0.075, 0.055), matSteel);
  prodLip.position.set(0, 0.86, 0.65);
  produceGroup.add(prodLip);

  // Dark forest-green supermarket produce crates under each of the 4 vegetable bays!
  ['tomato', 'carrot', 'broccoli', 'corn'].forEach((t, idx) => {
    const bx = -0.66 + idx * 0.44;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.08, 0.98), crateMat);
    crate.position.set(bx, 0.94, 0.02);
    crate.rotation.x = 0.14;
    crate.receiveShadow = true;
    produceGroup.add(crate);

    // Richly stocked background produce pile inside each crate!
    for (let b = 0; b < 3; b++) {
      const dec = createFoodMesh(t, { withShadow: false });
      dec.scale.setScalar(0.84);
      dec.position.set(bx + (b - 1) * 0.11, 1.00 + (b === 1 ? 0.05 : 0), -0.26 - (b % 2) * 0.08);
      dec.rotation.y = (b + idx) * 1.1;
      produceGroup.add(dec);
    }
  });

  // Overhead stainless-steel produce misting bar with downward spray nozzles
  [-1.36, 1.36].forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.08, 10), matChrome);
    post.position.set(px, 1.44, -0.45);
    produceGroup.add(post);
  });
  const mistBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.78, 10), matChrome);
  mistBar.rotation.z = Math.PI / 2;
  mistBar.position.set(0, 1.96, -0.45);
  produceGroup.add(mistBar);
  for (let nx = -0.9; nx <= 0.91; nx += 0.45) {
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 8), matSteel);
    nozzle.rotation.x = Math.PI;
    nozzle.position.set(nx, 1.93, -0.45);
    produceGroup.add(nozzle);
  }

  // Interactive Glossy Blue Dome Mist Sprayer Button (left edge)
  const mistBtnGroup = new THREE.Group();
  mistBtnGroup.position.set(-1.14, 0.94, 0.56);
  const mistHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.108, 0.05, 16), matChrome);
  mistBtnGroup.add(mistHousing);
  const mistDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.076, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshPhysicalMaterial({ color: 0x1a8cff, roughness: 0.1, clearcoat: 1.0, emissive: 0x093b75, emissiveIntensity: 0.45 })
  );
  mistDome.position.y = 0.022;
  mistDome.userData.interactive = 'mist_button';
  mistBtnGroup.add(mistDome);
  produceGroup.add(mistBtnGroup);

  // Interactive 3-2-1 Stacked Green Apple Pyramid (right edge!)
  const appleMat = new THREE.MeshPhysicalMaterial({
    map: getFoodSkinTexture('apple'),
    roughness: 0.15,
    clearcoat: 0.92,
  });
  const applePyramid = [];
  const pyrBasePos = [
    [-0.13, 0.06, 0.05], [0, 0.06, 0.05], [0.13, 0.06, 0.05],
    [-0.065, 0.175, 0.03], [0.065, 0.175, 0.03],
    [0, 0.285, 0.02],
  ];
  const pyramidGroup = new THREE.Group();
  pyramidGroup.position.set(1.12, 0.92, 0.24);
  produceGroup.add(pyramidGroup);

  pyrBasePos.forEach(([ax, ay, az]) => {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), appleMat);
    apple.position.set(ax, ay, az);
    apple.castShadow = true;
    apple.userData.interactive = 'apple_pyramid';
    pyramidGroup.add(apple);
    applePyramid.push({
      mesh: apple,
      home: new THREE.Vector3(ax, ay, az),
      vel: new THREE.Vector3(),
      falling: false,
    });
  });

  // ==========================================================
  // STATION 2: CHILLED DAIRY COOLER (X = 4.8, Z = -1.65)
  // ==========================================================
  const dairyGroup = new THREE.Group();
  dairyGroup.position.set(4.8, 0, -1.65);
  world.add(dairyGroup);
  addHangingSign(4.8, -1.85, 'dairy');

  const coolerBodyMat = new THREE.MeshStandardMaterial({ color: 0xdce5ef, roughness: 0.26, metalness: 0.42 });
  const coolerDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e3044, roughness: 0.34, metalness: 0.55 });

  const coolerBase = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.85, 1.12), coolerDarkMat);
  coolerBase.position.set(0, 0.425, 0);
  coolerBase.castShadow = true;
  coolerBase.receiveShadow = true;
  dairyGroup.add(coolerBase);

  // Stainless steel grille vent along cooler front base
  for (let g = 0; g < 3; g++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.028, 0.02), matSteel);
    slat.position.set(0, 0.20 + g * 0.06, 0.565);
    dairyGroup.add(slat);
  }

  const coolerBack = new THREE.Mesh(new THREE.BoxGeometry(2.92, 2.25, 0.14), coolerBodyMat);
  coolerBack.position.set(0, 1.25, -0.52);
  coolerBack.receiveShadow = true;
  dairyGroup.add(coolerBack);

  // Realistic stainless airflow vent slots on cooler back wall
  for (let v = 0; v < 5; v++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.022, 0.02), matSteel);
    vent.position.set(0, 1.05 + v * 0.12, -0.44);
    dairyGroup.add(vent);
  }

  const coolerTop = new THREE.Mesh(new THREE.BoxGeometry(2.98, 0.18, 1.16), coolerDarkMat);
  coolerTop.position.set(0, 2.34, 0);
  dairyGroup.add(coolerTop);

  const ledMat = new THREE.MeshBasicMaterial({ color: 0xe3f6ff });
  const topLed = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.035, 0.08), ledMat);
  topLed.position.set(0, 2.23, 0.28);
  dairyGroup.add(topLed);

  [-1.44, 1.44].forEach((gx) => {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.48, 1.06), matGlass);
    sideGlass.position.set(gx, 1.56, 0);
    dairyGroup.add(sideGlass);
  });

  const dairyShelfMain = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.94), matSteel);
  dairyShelfMain.position.set(0, 0.87, 0.04);
  dairyShelfMain.receiveShadow = true;
  dairyGroup.add(dairyShelfMain);

  // Colored shelf edge strip (zero text — realistic dairy aisle visual!)
  const dairyEdge = new THREE.Mesh(
    new THREE.BoxGeometry(2.82, 0.055, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x1e6bc9, roughness: 0.35 })
  );
  dairyEdge.position.set(0, 0.87, 0.515);
  dairyGroup.add(dairyEdge);

  const dairyShelfTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.048, 0.80), matSteel);
  dairyShelfTop.position.set(0, 1.56, -0.05);
  dairyGroup.add(dairyShelfTop);

  // Stocked dairy rows
  ['milk', 'strawberry_milk', 'orange_juice'].forEach((t, i) => {
    const sx = -0.78 + i * 0.78;
    for (let k = -1; k <= 1; k++) {
      const m = createFoodMesh(t);
      m.scale.setScalar(0.95);
      m.position.set(sx + k * 0.2, 1.586, -0.06);
      dairyGroup.add(m);
    }
    const backRow = createFoodMesh(t);
    backRow.scale.setScalar(1.06);
    backRow.position.set(-0.56 + i * 0.56, 0.90, -0.26);
    dairyGroup.add(backRow);
  });

  // Interactive Frosty Cold-Air Button (left edge)
  const frostHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.04, 16), matChrome);
  frostHousing.position.set(-1.16, 0.92, 0.42);
  dairyGroup.add(frostHousing);
  const frostBtn = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshPhysicalMaterial({ color: 0x56ccf2, roughness: 0.1, clearcoat: 1, emissive: 0x1a759f, emissiveIntensity: 0.5 })
  );
  frostBtn.position.set(-1.16, 0.935, 0.42);
  frostBtn.userData.interactive = 'frost_button';
  dairyGroup.add(frostBtn);

  // ==========================================================
  // STATION 3: WARM ARTISAN BAKERY COUNTER (X = 9.6, Z = -1.65)
  // ==========================================================
  const bakeryGroup = new THREE.Group();
  bakeryGroup.position.set(9.6, 0, -1.65);
  world.add(bakeryGroup);
  addHangingSign(9.6, -1.85, 'bakery');

  const bakeryBase = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.88, 1.14), warmWoodMat);
  bakeryBase.position.set(0, 0.44, 0);
  bakeryBase.castShadow = true;
  bakeryBase.receiveShadow = true;
  bakeryGroup.add(bakeryBase);

  const bakeryTop = new THREE.Mesh(
    new THREE.BoxGeometry(3.02, 0.065, 1.22),
    new THREE.MeshStandardMaterial({ map: getWoodTexture('light'), roughness: 0.48 })
  );
  bakeryTop.position.set(0, 0.91, 0.02);
  bakeryTop.receiveShadow = true;
  bakeryGroup.add(bakeryTop);

  const bakeryBack = new THREE.Mesh(new THREE.BoxGeometry(2.94, 2.22, 0.14), darkWoodMat);
  bakeryBack.position.set(0, 1.3, -0.52);
  bakeryGroup.add(bakeryBack);

  // Warm brass hanging bakery pendant lamps!
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xdfa934, metalness: 0.86, roughness: 0.18 });
  [-0.78, 0, 0.78].forEach((lx) => {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.65, 6), matDarkMetal);
    cord.position.set(lx, 2.38, 0.02);
    bakeryGroup.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 16, 1, true), brassMat);
    shade.position.set(lx, 2.02, 0.02);
    bakeryGroup.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe4a8 }));
    bulb.position.set(lx, 1.98, 0.02);
    bakeryGroup.add(bulb);
  });

  // Woven wicker trays with parchment liners
  const wickerMat = new THREE.MeshStandardMaterial({ map: getWickerTexture(), roughness: 0.82 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xfbf3e0, roughness: 0.88 });
  [-0.58, 0, 0.58].forEach((tx) => {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.068, 0.46), wickerMat);
    tray.position.set(tx, 0.975, 0.12);
    tray.castShadow = true;
    tray.receiveShadow = true;
    bakeryGroup.add(tray);

    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.40), paperMat);
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(tx, 1.012, 0.12);
    bakeryGroup.add(paper);
  });

  const upperBakeryShelf = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.055, 0.56), warmWoodMat);
  upperBakeryShelf.position.set(0, 1.56, -0.22);
  bakeryGroup.add(upperBakeryShelf);

  ['croissant', 'melonpan', 'baguette'].forEach((t, i) => {
    const dec = createFoodMesh(t);
    dec.scale.setScalar(0.95);
    dec.position.set(-0.68 + i * 0.68, 1.59, -0.20);
    bakeryGroup.add(dec);
  });

  // Interactive Glossy Brass Bakery Service Bell
  const bellGroup = new THREE.Group();
  bellGroup.position.set(1.16, 0.945, 0.36);
  const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.03, 18), matDarkMetal);
  bellGroup.add(bellBase);
  const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), brassMat);
  bellDome.position.y = 0.015;
  bellDome.userData.interactive = 'bakery_bell';
  bellGroup.add(bellDome);
  const bellButton = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12), matChrome);
  bellButton.position.y = 0.108;
  bellButton.userData.interactive = 'bakery_bell';
  bellGroup.add(bellButton);
  bakeryGroup.add(bellGroup);

  // ==========================================================
  // STATION 4: CHECKOUT REGISTER & ECO-BAG (X = 14.8, Z = -1.35)
  // ==========================================================
  const checkoutGroup = new THREE.Group();
  checkoutGroup.position.set(14.8, 0, -1.35);
  world.add(checkoutGroup);
  addHangingSign(14.8, -2.55, 'checkout', 2.38);

  // Modern supermarket checkout counter (rich dark slate front + warm wood trim + stainless top)
  const counterBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.95, 0.88, 0.98),
    new THREE.MeshStandardMaterial({ color: 0x38424d, roughness: 0.45 })
  );
  counterBody.position.set(0, 0.44, 0);
  counterBody.castShadow = true;
  counterBody.receiveShadow = true;
  checkoutGroup.add(counterBody);

  const counterTrim = new THREE.Mesh(new THREE.BoxGeometry(2.98, 0.10, 1.0), warmWoodMat);
  counterTrim.position.set(0, 0.81, 0);
  checkoutGroup.add(counterTrim);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.055, 1.04), matSteel);
  counterTop.position.set(0, 0.905, 0);
  counterTop.receiveShadow = true;
  checkoutGroup.add(counterTop);

  // Moving dark rubber Conveyor Belt on left
  const conveyorTex = getConveyorTexture();
  const conveyorBelt = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.03, 0.62),
    new THREE.MeshStandardMaterial({ map: conveyorTex, roughness: 0.78 })
  );
  conveyorBelt.position.set(-0.68, 0.935, 0.08);
  conveyorBelt.receiveShadow = true;
  checkoutGroup.add(conveyorBelt);

  // --- REALISTIC RECESSED & VERTICAL LASER BARCODE SCANNER (Center!) ---
  const scannerGroup = new THREE.Group();
  scannerGroup.position.set(0.06, 0.935, 0.06);

  const scannerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.038, 0.38), matDarkMetal);
  scannerGroup.add(scannerFrame);

  // Sleek upright supermarket barcode scanner hood (authentic Japanese checkout!)
  const scannerHood = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.08), matDarkMetal);
  scannerHood.position.set(0, 0.12, -0.17);
  scannerHood.castShadow = true;
  scannerGroup.add(scannerHood);

  const scannerGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x161a20,
    roughness: 0.06,
    metalness: 0.25,
    emissive: 0x6b0b0b,
    emissiveIntensity: 0.65,
  });
  const scannerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.044, 0.28), scannerGlassMat);
  scannerGlass.userData.interactive = 'scanner';
  scannerGroup.add(scannerGlass);

  const vertGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), scannerGlassMat);
  vertGlass.position.set(0, 0.13, -0.128);
  scannerGroup.add(vertGlass);

  // Crisp glowing horizontal & crisscrossed laser lines (photorealistic red beam, NOT a solid pink block!)
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xff2828,
    transparent: true,
    opacity: 0.88,
  });
  const laserPlane = new THREE.Group();
  const beam1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.009, 0.009), laserMat);
  beam1.position.set(0, 0.11, -0.02);
  laserPlane.add(beam1);
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.007, 0.007), laserMat);
  beam2.position.set(0, 0.07, 0.02);
  beam2.rotation.y = 0.35;
  laserPlane.add(beam2);
  const beam3 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.007, 0.007), laserMat);
  beam3.position.set(0, 0.07, 0.02);
  beam3.rotation.y = -0.35;
  laserPlane.add(beam3);
  scannerGroup.add(laserPlane);

  const laserBeamLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.012, 0.014),
    new THREE.MeshBasicMaterial({ color: 0xff4545 })
  );
  laserBeamLine.position.set(0, 0.028, 0);
  scannerGroup.add(laserBeamLine);

  const ledLightMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const scannerLed = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), ledLightMat);
  scannerLed.position.set(0.14, 0.21, -0.128);
  scannerGroup.add(scannerLed);

  const scannerHit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.58), matHitZone);
  scannerHit.position.set(0, 0.22, 0);
  scannerHit.userData.interactive = 'scanner';
  scannerGroup.add(scannerHit);

  checkoutGroup.add(scannerGroup);

  // --- POS CASH REGISTER + PICTORIAL SCREEN + CASH DRAWER + RECEIPT ---
  const registerGroup = new THREE.Group();
  registerGroup.position.set(-0.76, 0.93, -0.34);

  const regBase = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.38), matDarkMetal);
  regBase.position.y = 0.065;
  regBase.castShadow = true;
  registerGroup.add(regBase);

  // Sliding Cash Drawer (slightly narrower & cleanly recessed to avoid z-fighting!)
  const cashDrawer = new THREE.Group();
  const drawerBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.085, 0.30), matSteel);
  drawerBox.position.set(0, 0.052, 0.02);
  cashDrawer.add(drawerBox);

  const coinMat = new THREE.MeshStandardMaterial({ color: 0xf7c538, metalness: 0.88, roughness: 0.18 });
  for (let c = 0; c < 8; c++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 12), coinMat);
    coin.position.set(-0.11 + (c % 4) * 0.072, 0.102, 0.04 + Math.floor(c / 4) * 0.072);
    cashDrawer.add(coin);
  }
  registerGroup.add(cashDrawer);

  // Big glossy Green tactile register button
  const regBtn = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.052, 0.095),
    new THREE.MeshPhysicalMaterial({ color: 0x2ecc71, roughness: 0.20, clearcoat: 0.8 })
  );
  regBtn.position.set(0.14, 0.155, 0.12);
  regBtn.userData.interactive = 'register_button';
  registerGroup.add(regBtn);

  // Tilted Pictorial POS Screen
  const posScreenObj = createPosScreenCanvas();
  updatePosScreen(posScreenObj, [], false);
  const screenStand = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.22, 10), matDarkMetal);
  screenStand.position.set(-0.04, 0.22, -0.04);
  registerGroup.add(screenStand);

  const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.29, 0.04), matDarkMetal);
  screenFrame.position.set(-0.04, 0.38, -0.01);
  screenFrame.rotation.x = -0.16;
  registerGroup.add(screenFrame);

  const screenFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.33, 0.245),
    new THREE.MeshBasicMaterial({ map: posScreenObj.tex })
  );
  screenFace.position.set(-0.04, 0.38, 0.014);
  screenFace.rotation.x = -0.16;
  registerGroup.add(screenFace);

  // Pictorial Paper Receipt curling up out of slot!
  const receiptMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.13, 0.30),
    new THREE.MeshStandardMaterial({
      map: getFoodSkinTexture('receipt'),
      roughness: 0.85,
      side: THREE.DoubleSide,
    })
  );
  receiptMesh.position.set(0.16, 0.26, -0.04);
  receiptMesh.rotation.x = -0.22;
  receiptMesh.scale.y = 0.001;
  receiptMesh.visible = false;
  registerGroup.add(receiptMesh);

  checkoutGroup.add(registerGroup);

  // --- BIG FRIENDLY REALISTIC CASHIER BEHIND COUNTER ---
  const cashier = createCashier();
  cashier.root.position.set(0.10, 0, -0.74);
  checkoutGroup.add(cashier.root);

  // --- LARGE REALISTIC CANVAS ECO-BAG ON RIGHT OF SCANNER ---
  const ecoBag = createEcoBag();
  ecoBag.root.position.set(0.64, 0.935, 0.09);
  ecoBag.root.rotation.y = -0.26;
  checkoutGroup.add(ecoBag.root);

  // Rich local supermarket accent lights (cool dairy, warm golden bakery, crisp checkout)
  const dairyLight = new THREE.PointLight(0xd9f2ff, 3.6, 6.5, 1.5);
  dairyLight.position.set(4.8, 2.15, -1.0);
  world.add(dairyLight);

  const bakeryLight = new THREE.PointLight(0xffcb78, 4.4, 6.8, 1.4);
  bakeryLight.position.set(9.6, 2.1, -1.0);
  world.add(bakeryLight);

  const checkoutLight = new THREE.PointLight(0xfff5e4, 3.2, 7.5, 1.5);
  checkoutLight.position.set(14.8, 2.55, -0.6);
  world.add(checkoutLight);

  return {
    world,
    produceGroup,
    dairyGroup,
    bakeryGroup,
    checkoutGroup,
    mistDome,
    applePyramid,
    frostBtn,
    bellGroup,
    bakeryLight,
    conveyorTex,
    scannerGroup,
    scannerGlassMat,
    laserPlane,
    laserMat,
    laserBeamLine,
    ledLightMat,
    posScreenObj,
    cashDrawer,
    regBtn,
    receiptMesh,
    cashier,
    ecoBag,
  };
}
