import * as THREE from '../vendor/three.module.min.js';
import { createWatercolorMaterial, addPencilOutline } from './materials.js';

function tagInteract(root, key) {
  root.traverse((obj) => {
    if (obj.isMesh && !obj.userData.isOutline) {
      obj.userData.interact = key;
    }
  });
}

// Build all Kitchen Props & Picnic Meadow Props in unified Japanese picture-book style
export function createKitchenWorld(assets) {
  const group = new THREE.Group();

  // 1. Sunlit Watercolor Kitchen Wall Backdrop (positioned so windows frame the girl!)
  const wallMat = new THREE.MeshBasicMaterial({ map: assets.kitchenBackdrop });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), wallMat);
  wall.position.set(0, 3.25, -5.8);
  group.add(wall);

  // 2. Warm Honey-Cedar Kitchen Table
  const tableMat = createWatercolorMaterial({
    map: assets.woodTable,
    emissive: 0x3b2615,
    emissiveIntensity: 0.14
  });
  const table = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 9.5), tableMat);
  table.position.set(0, -0.4, 0.2);
  table.receiveShadow = true;
  group.add(table);

  // 3. Center Hinoki Cutting Board (Shaping Stage!)
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0.09, 1.05);
  const boardMat = createWatercolorMaterial({
    map: assets.woodBoard,
    emissive: 0x452d19,
    emissiveIntensity: 0.16
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.35), boardMat);
  board.receiveShadow = true;
  board.castShadow = true;
  addPencilOutline(board, 1.022, 0x6b4b35, 0.58);
  boardGroup.add(board);

  // Subtle soft painted circle mark in center of board (natural placement cue!)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc99c6b,
    transparent: true,
    opacity: 0.35
  });
  const guideDisc = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.76, 32), ringMat);
  guideDisc.rotation.x = -Math.PI / 2;
  guideDisc.position.y = 0.095;
  boardGroup.add(guideDisc);
  tagInteract(boardGroup, 'board');
  group.add(boardGroup);

  // 4. Steaming Wooden Ohitsu (Rice Tub) + Shamoji Paddle (Left!)
  const ohitsuGroup = new THREE.Group();
  ohitsuGroup.position.set(-3.15, 0.0, 0.15);

  const ohitsuWood = createWatercolorMaterial({
    map: assets.woodOhitsu,
    emissive: 0x3a2414,
    emissiveIntensity: 0.14
  });
  const copperMat = createWatercolorMaterial({
    color: 0xd68c54,
    emissive: 0x45200e,
    emissiveIntensity: 0.18
  });

  const tub = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.04, 1.12, 24), ohitsuWood);
  tub.position.y = 0.56;
  tub.castShadow = true;
  tub.receiveShadow = true;
  addPencilOutline(tub, 1.03, 0x5c3e2a, 0.65);
  ohitsuGroup.add(tub);

  // Classic copper hoops around the wooden rice tub
  for (const hy of [0.34, 0.84]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.13 + (hy - 0.5) * 0.09, 0.045, 8, 28), copperMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    ohitsuGroup.add(hoop);
  }

  // Fluffy mound of freshly steamed white rice brimming inside!
  const riceMoundGeo = new THREE.SphereGeometry(1.06, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const riceMoundMat = createWatercolorMaterial({
    color: 0xffffff,
    map: assets.rice.map,
    bumpMap: assets.rice.bumpMap,
    bumpScale: 0.025,
    emissive: 0x453525,
    emissiveIntensity: 0.18
  });
  const riceMound = new THREE.Mesh(riceMoundGeo, riceMoundMat);
  riceMound.position.y = 0.92;
  riceMound.scale.set(1.0, 0.56, 1.0);
  riceMound.receiveShadow = true;
  addPencilOutline(riceMound, 1.03, 0x7a6252, 0.5);
  ohitsuGroup.add(riceMound);

  // Wooden Shamoji (rice paddle) resting upright in the steaming rice!
  const shamojiPivot = new THREE.Group();
  shamojiPivot.position.set(0.42, 1.24, 0.15);
  shamojiPivot.rotation.set(0.18, 0.3, -0.45);
  const paddleHead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), boardMat);
  paddleHead.scale.set(0.82, 1.15, 0.22);
  paddleHead.position.y = -0.15;
  addPencilOutline(paddleHead, 1.06, 0x6b4b35, 0.58);
  const paddleHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.82, 10), boardMat);
  paddleHandle.position.y = 0.45;
  addPencilOutline(paddleHandle, 1.08, 0x6b4b35, 0.58);
  shamojiPivot.add(paddleHead, paddleHandle);
  ohitsuGroup.add(shamojiPivot);

  // Invisible generous hitbox for little fingers
  const ohitsuHit = new THREE.Mesh(
    new THREE.SphereGeometry(1.48, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ohitsuHit.position.set(0, 0.95, 0);
  ohitsuGroup.add(ohitsuHit);

  tagInteract(ohitsuGroup, 'ohitsu');
  group.add(ohitsuGroup);

  // 5. Filling Saucers & Sesame-Salt Shaker (Front-Left & Left!)
  // 5a. Umeboshi Saucer (Rosy Red Pickled Plum!)
  const umeGroup = new THREE.Group();
  umeGroup.position.set(-2.95, 0.0, 2.05);
  const dishCream = createWatercolorMaterial({
    map: assets.ceramicCream,
    emissive: 0x3b2f24,
    emissiveIntensity: 0.14
  });
  const umeDish = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.46, 0.22, 20), dishCream);
  umeDish.position.y = 0.11;
  umeDish.castShadow = true;
  umeDish.receiveShadow = true;
  addPencilOutline(umeDish, 1.045, 0x6c5548, 0.6);
  umeGroup.add(umeDish);

  const umeMat = createWatercolorMaterial({
    map: assets.umeboshi,
    emissive: 0x52121a,
    emissiveIntensity: 0.16
  });
  const makePlum = (x, y, z, r) => {
    const g = new THREE.IcosahedronGeometry(r, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const w = 1 + 0.1 * Math.sin(p.getX(i) * 18) * Math.cos(p.getY(i) * 16);
      p.setXYZ(i, p.getX(i) * w, p.getY(i) * w * 0.84, p.getZ(i) * w);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, umeMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    addPencilOutline(m, 1.06, 0x6e2028, 0.65);
    return m;
  };
  umeGroup.add(makePlum(-0.18, 0.34, 0.06, 0.28));
  umeGroup.add(makePlum(0.22, 0.32, -0.05, 0.25));
  umeGroup.add(makePlum(0.02, 0.46, -0.14, 0.24));
  const umeHit = new THREE.Mesh(new THREE.SphereGeometry(0.86, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  umeHit.position.y = 0.35;
  umeGroup.add(umeHit);
  tagInteract(umeGroup, 'ume');
  group.add(umeGroup);

  // 5b. Grilled Salmon Saucer (Warm Coral-Pink Flaky Salmon!)
  const salmonGroup = new THREE.Group();
  salmonGroup.position.set(-1.68, 0.0, 2.48);
  const dishBlue = createWatercolorMaterial({
    map: assets.ceramicBlue,
    emissive: 0x1c2f3a,
    emissiveIntensity: 0.14
  });
  const salmonDish = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.46, 0.22, 20), dishBlue);
  salmonDish.position.y = 0.11;
  salmonDish.castShadow = true;
  salmonDish.receiveShadow = true;
  addPencilOutline(salmonDish, 1.045, 0x4c5d6b, 0.6);
  salmonGroup.add(salmonDish);

  const salmonMat = createWatercolorMaterial({
    map: assets.salmon,
    emissive: 0x522112,
    emissiveIntensity: 0.16
  });
  const skinStripMat = createWatercolorMaterial({
    color: 0x4c5860,
    emissive: 0x161c20,
    emissiveIntensity: 0.16
  });
  const makeFillet = (x, y, z, ry) => {
    const fg = new THREE.Group();
    // Classic Japanese yakizake curved crescent wedge!
    const g = new THREE.CylinderGeometry(0.32, 0.34, 0.2, 16, 1, false, 0, Math.PI * 1.05);
    const m = new THREE.Mesh(g, salmonMat);
    m.scale.set(1.25, 1, 0.92);
    m.castShadow = true;
    addPencilOutline(m, 1.06, 0x733a24, 0.62);
    fg.add(m);
    // Crisp toasted dark-silver salmon skin rim along the curved back
    const skin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.335, 0.355, 0.205, 14, 1, true, 0, Math.PI * 1.05),
      skinStripMat
    );
    skin.scale.set(1.25, 1, 0.92);
    fg.add(skin);

    fg.position.set(x, y, z);
    fg.rotation.set(0.08, ry, 0.05);
    return fg;
  };
  salmonGroup.add(makeFillet(-0.1, 0.3, 0.12, 0.45));
  salmonGroup.add(makeFillet(0.14, 0.4, -0.06, -0.35));
  const salmonHit = new THREE.Mesh(new THREE.SphereGeometry(0.86, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  salmonHit.position.y = 0.35;
  salmonGroup.add(salmonHit);
  tagInteract(salmonGroup, 'salmon');
  group.add(salmonGroup);

  // 5c. Wooden Gomashio (Sesame-Salt) Shaker (Front-Right of board!)
  const shakerGroup = new THREE.Group();
  shakerGroup.position.set(1.75, 0.0, 2.42);
  const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.72, 16), ohitsuWood);
  jarBody.position.y = 0.36;
  jarBody.castShadow = true;
  addPencilOutline(jarBody, 1.055, 0x5c3e2a, 0.62);
  shakerGroup.add(jarBody);

  const jarLid = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    dishCream
  );
  jarLid.position.y = 0.7;
  addPencilOutline(jarLid, 1.06, 0x6b5344, 0.6);
  shakerGroup.add(jarLid);

  // Tiny black sesame dots on the shaker lid + belly stripe so a 5-year-old instantly reads "sprinkler!"
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x2c231e });
  const holeGeo = new THREE.SphereGeometry(0.036, 6, 5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = new THREE.Mesh(holeGeo, dotMat);
    h.position.set(Math.cos(a) * 0.13, 0.96, Math.sin(a) * 0.13);
    shakerGroup.add(h);
  }
  const hCenter = new THREE.Mesh(holeGeo, dotMat);
  hCenter.position.set(0, 1.0, 0);
  shakerGroup.add(hCenter);

  const shakerHit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  shakerHit.position.y = 0.5;
  shakerGroup.add(shakerHit);
  tagInteract(shakerGroup, 'sesame');
  group.add(shakerGroup);

  // 6. Crisp Nori Seaweed Stack on Bamboo Tray (Right-Front!)
  const noriGroup = new THREE.Group();
  noriGroup.position.set(3.05, 0.0, 1.72);
  const bambooMat = createWatercolorMaterial({
    map: assets.bambooTex,
    emissive: 0x24331c,
    emissiveIntensity: 0.14
  });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 1.42), bambooMat);
  tray.position.y = 0.05;
  tray.receiveShadow = true;
  tray.castShadow = true;
  addPencilOutline(tray, 1.03, 0x4b5c3c, 0.58);
  noriGroup.add(tray);

  const noriMat = createWatercolorMaterial({
    map: assets.nori,
    emissive: 0x101c14,
    emissiveIntensity: 0.16,
    side: THREE.DoubleSide
  });
  const noriSheets = [];
  for (let i = 0; i < 4; i++) {
    const sheetGeo = new THREE.PlaneGeometry(1.42, 1.08, 6, 4);
    const p = sheetGeo.attributes.position;
    for (let j = 0; j < p.count; j++) {
      // Crisp gentle corner curl
      const x = p.getX(j);
      const y = p.getY(j);
      p.setZ(j, (x * x + y * y) * 0.045);
    }
    sheetGeo.computeVertexNormals();
    const sheet = new THREE.Mesh(sheetGeo, noriMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = (i - 1.5) * 0.04;
    sheet.position.y = 0.13 + i * 0.045;
    sheet.castShadow = true;
    noriSheets.push(sheet);
    noriGroup.add(sheet);
  }
  const noriHit = new THREE.Mesh(new THREE.SphereGeometry(1.12, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  noriHit.position.y = 0.4;
  noriGroup.add(noriHit);
  tagInteract(noriGroup, 'nori');
  group.add(noriGroup);

  // 7. Open Woven Wicker Picnic Basket with Red Gingham Cloth & 3 Cozy Spots (Right-Back!)
  const basketObj = createPicnicBasket(assets);
  basketObj.group.position.set(3.12, 0.0, -0.35);
  basketObj.group.rotation.y = -0.32;
  tagInteract(basketObj.group, 'basket');
  group.add(basketObj.group);

  // 8. Windowsill Souvenir Flower Vase (collects pressed wildflowers after each picnic!)
  const vaseGroup = new THREE.Group();
  vaseGroup.position.set(-3.4, 0.0, -2.0);
  const vaseMat = createWatercolorMaterial({
    color: 0xd9eef5,
    emissive: 0x203540,
    emissiveIntensity: 0.14
  });
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 0.85, 14), vaseMat);
  vase.position.y = 0.42;
  addPencilOutline(vase, 1.055, 0x526b75, 0.55);
  vaseGroup.add(vase);
  const flowerContainer = new THREE.Group();
  flowerContainer.position.y = 0.82;
  vaseGroup.add(flowerContainer);
  group.add(vaseGroup);

  return {
    group,
    boardGroup,
    ohitsuGroup,
    shamojiPivot,
    umeGroup,
    salmonGroup,
    shakerGroup,
    noriGroup,
    noriTopSheet: noriSheets[noriSheets.length - 1],
    basket: basketObj,
    vaseGroup,
    flowerContainer
  };
}

// Reusable Woven Wicker Picnic Basket with hinged gingham lid & 3 onigiri slots
export function createPicnicBasket(assets) {
  const group = new THREE.Group();
  const wickerMat = createWatercolorMaterial({
    map: assets.wicker,
    emissive: 0x3b2612,
    emissiveIntensity: 0.15
  });
  const ginghamMat = createWatercolorMaterial({
    map: assets.gingham,
    emissive: 0x381c18,
    emissiveIntensity: 0.14,
    side: THREE.DoubleSide
  });

  // Basket body (rounded rectangular open wicker tub)
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.82, 1.75), wickerMat);
  base.position.y = 0.41;
  base.castShadow = true;
  base.receiveShadow = true;
  addPencilOutline(base, 1.03, 0x5e3e22, 0.65);
  group.add(base);

  // Braided wicker rim + draped red-and-white gingham cloth liner!
  const clothLiner = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.22, 1.86), ginghamMat);
  clothLiner.position.y = 0.83;
  clothLiner.receiveShadow = true;
  addPencilOutline(clothLiner, 1.025, 0x733a36, 0.55);
  group.add(clothLiner);

  // 3 visible cozy round spots lined inside the basket (unmistakable affordance: "put 3 onigiri here!")
  const slotPositions = [
    new THREE.Vector3(-0.72, 0.96, 0.18),
    new THREE.Vector3(0.0, 0.96, -0.18),
    new THREE.Vector3(0.72, 0.96, 0.18)
  ];
  const slotMarkers = [];
  const spotMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55
  });
  for (const pos of slotPositions) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(pos.x, 0.945, pos.z);
    group.add(spot);
    slotMarkers.push(spot);
  }

  // Hinged Wicker Lid (flips open to invite, closes cheerfully when full!)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.88, -0.88);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.16, 1.82), wickerMat);
  lidMesh.position.set(0, 0.08, 0.91);
  lidMesh.castShadow = true;
  addPencilOutline(lidMesh, 1.03, 0x5e3e22, 0.6);
  lidPivot.add(lidMesh);

  // Cute arched wicker handle on top of lid
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.085, 8, 20, Math.PI), wickerMat);
  handle.position.set(0, 0.18, 0.91);
  addPencilOutline(handle, 1.05, 0x5e3e22, 0.6);
  lidPivot.add(handle);

  // Red picnic ribbon bow on front of basket
  const ribbonMat = createWatercolorMaterial({ color: 0xe05852, emissive: 0x401212, emissiveIntensity: 0.15 });
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), ribbonMat);
  bow.scale.set(1.4, 0.85, 0.7);
  bow.position.set(0, 0.72, 0.96);
  addPencilOutline(bow, 1.07, 0x6b2220, 0.55);
  group.add(bow);

  lidPivot.rotation.x = -1.78; // Open wide!
  group.add(lidPivot);

  // Slot container for placed 3D onigiri
  const contentsGroup = new THREE.Group();
  group.add(contentsGroup);

  const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitMesh.position.set(0, 0.85, 0.05);
  group.add(hitMesh);

  return {
    group,
    lidPivot,
    contentsGroup,
    slotPositions,
    slotMarkers
  };
}

// Build a cheerful watercolor wildflower for the windowsill souvenir vase or meadow!
export function createWatercolorFlower(petalColor = 0xfce068) {
  const f = new THREE.Group();
  const stemMat = createWatercolorMaterial({ color: 0x76a85c, emissive: 0x182b12, emissiveIntensity: 0.15 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.65, 6), stemMat);
  stem.position.y = 0.32;
  f.add(stem);

  const centerMat = createWatercolorMaterial({ color: 0xf09c42, emissive: 0x452208, emissiveIntensity: 0.16 });
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), centerMat);
  center.position.y = 0.66;
  f.add(center);

  const petalMat = createWatercolorMaterial({ color: petalColor, emissive: 0x3b2c12, emissiveIntensity: 0.16 });
  const petalGeo = new THREE.SphereGeometry(0.1, 8, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(petalGeo, petalMat);
    p.scale.set(1.2, 0.45, 0.75);
    p.position.set(Math.cos(a) * 0.16, 0.66, Math.sin(a) * 0.16);
    p.rotation.y = -a;
    f.add(p);
  }
  return f;
}

// Build the Sunny Picnic Meadow Reward World!
export function createPicnicWorld(assets) {
  const group = new THREE.Group();
  group.visible = false;

  // 1. Sunlit Meadow Sky & Rolling Hills Backdrop (positioned so blue sky & fluffy clouds frame the girl!)
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 13),
    new THREE.MeshBasicMaterial({ map: assets.meadowBackdrop })
  );
  sky.position.set(0, 3.15, -6.2);
  group.add(sky);

  // 2. Soft Watercolor Meadow Grass Ground
  const grassMat = createWatercolorMaterial({
    map: assets.grassTex,
    emissive: 0x243616,
    emissiveIntensity: 0.15
  });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 12), grassMat);
  ground.position.set(0, -0.35, 0.5);
  ground.receiveShadow = true;
  group.add(ground);

  // 3. Big Red-and-White Gingham Picnic Blanket!
  const blanketMat = createWatercolorMaterial({
    map: assets.ginghamBlanket,
    emissive: 0x381e1a,
    emissiveIntensity: 0.14
  });
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, 4.6), blanketMat);
  blanket.position.set(0, 0.0, 1.1);
  blanket.receiveShadow = true;
  addPencilOutline(blanket, 1.01, 0x733a36, 0.48);
  group.add(blanket);

  // 4. Swaying Watercolor Dandelions & Clovers around the blanket!
  const flowers = [];
  const spots = [
    [-3.8, 0.0, 0.2, 0xfce166],
    [-3.5, 0.0, 1.9, 0xfff8e8],
    [-2.8, 0.0, -1.2, 0xf8b6c2],
    [3.8, 0.0, 0.4, 0xfce166],
    [3.5, 0.0, 2.1, 0xfff8e8],
    [2.9, 0.0, -1.1, 0xfce166],
    [-1.9, 0.0, 3.2, 0xf8b6c2],
    [2.1, 0.0, 3.1, 0xfff8e8]
  ];
  for (const [fx, fy, fz, col] of spots) {
    const fl = createWatercolorFlower(col);
    fl.position.set(fx, fy, fz);
    fl.scale.setScalar(1.15);
    fl.userData.phase = Math.random() * Math.PI * 2;
    flowers.push(fl);
    group.add(fl);
  }

  // 5. Big Cozy Wooden Picnic Platter in Center-Foreground holding the 3 handmade onigiri!
  const platterMat = createWatercolorMaterial({
    map: assets.woodBoard,
    emissive: 0x3f2918,
    emissiveIntensity: 0.15
  });
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 1.88, 0.18, 28), platterMat);
  platter.position.set(-0.2, 0.13, 1.45);
  platter.scale.set(1.18, 1.0, 0.78);
  platter.receiveShadow = true;
  platter.castShadow = true;
  addPencilOutline(platter, 1.025, 0x6b4b35, 0.55);
  group.add(platter);

  // Container for the 3 tappable picnic onigiri
  const picnicOnigiriGroup = new THREE.Group();
  group.add(picnicOnigiriGroup);

  // 6. Warm Green-Tea Ceramic Teacup (tap for cozy sip!)
  const cupGroup = new THREE.Group();
  cupGroup.position.set(2.55, 0.04, 1.88);
  const cupMat = createWatercolorMaterial({
    map: assets.ceramicBlue,
    emissive: 0x1c2f3a,
    emissiveIntensity: 0.14
  });
  const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.68, 18), cupMat);
  cupBody.position.y = 0.34;
  cupBody.castShadow = true;
  addPencilOutline(cupBody, 1.05, 0x455866, 0.62);
  cupGroup.add(cupBody);

  const teaMat = new THREE.MeshBasicMaterial({ color: 0x93b856 });
  const teaTop = new THREE.Mesh(new THREE.CircleGeometry(0.38, 18), teaMat);
  teaTop.rotation.x = -Math.PI / 2;
  teaTop.position.y = 0.675;
  cupGroup.add(teaTop);
  const teaGloss = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 12),
    new THREE.MeshBasicMaterial({ color: 0xd9ea9e, transparent: true, opacity: 0.72 })
  );
  teaGloss.rotation.x = -Math.PI / 2;
  teaGloss.position.set(-0.11, 0.68, -0.09);
  cupGroup.add(teaGloss);

  const cupHit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  cupHit.position.y = 0.45;
  cupGroup.add(cupHit);
  tagInteract(cupGroup, 'teacup');
  group.add(cupGroup);

  // 7. Open Picnic Basket resting cozily on the right (tap after picnic to return to kitchen!)
  const basket = createPicnicBasket(assets);
  basket.group.position.set(2.95, 0.04, -0.05);
  basket.group.rotation.y = -0.45;
  basket.group.scale.setScalar(0.86);
  tagInteract(basket.group, 'picnic_basket');
  group.add(basket.group);

  return {
    group,
    flowers,
    picnicOnigiriGroup,
    cupGroup,
    basket
  };
}
