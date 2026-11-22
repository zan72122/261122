import * as THREE from 'three';
import {
  createKinakoTextures,
  createAnkoTextures,
  createNoriTextures,
  createCeramicTextures,
} from './textures.js';

export const TOPPING_POS = {
  kinako: new THREE.Vector3(2.86, 0, -0.05),
  anko: new THREE.Vector3(2.96, 0, 1.56),
  nori: new THREE.Vector3(1.88, 0, 2.54),
};

export const FAMILY_PLATES = [
  {
    id: 'grandma',
    pos: new THREE.Vector3(-3.65, 0, 0.74),
    radius: 0.88,
    plateStyle: 'indigo',
  },
  {
    id: 'dad',
    pos: new THREE.Vector3(-1.92, 0, -1.78),
    radius: 0.90,
    plateStyle: 'vermilion',
  },
  {
    id: 'mom',
    pos: new THREE.Vector3(1.62, 0, -1.75),
    radius: 0.88,
    plateStyle: 'cream',
  },
];

export function buildToppingsAndPlates(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const kinakoTex = createKinakoTextures();
  const ankoTex = createAnkoTextures();
  const noriTex = createNoriTextures();

  const kinakoMat = new THREE.MeshStandardMaterial({
    map: kinakoTex.map,
    normalMap: kinakoTex.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughness: 0.95,
    metalness: 0.0,
  });

  const ankoMat = new THREE.MeshPhysicalMaterial({
    map: ankoTex.map,
    normalMap: ankoTex.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: ankoTex.roughnessMap,
    roughness: 0.92,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });

  const noriMat = new THREE.MeshStandardMaterial({
    map: noriTex.map,
    normalMap: noriTex.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: noriTex.roughnessMap,
    roughness: 0.94,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  // --- 1. Kinako Bowl (きなこ鉢) ---
  const kinakoGroup = new THREE.Group();
  kinakoGroup.position.copy(TOPPING_POS.kinako);

  const kBowlTex = createCeramicTextures(710, '#44382f', '#201814');
  const kBowlMat = new THREE.MeshStandardMaterial({
    map: kBowlTex.map,
    normalMap: kBowlTex.normalMap,
    roughness: 0.58,
    metalness: 0.04,
  });

  const kProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.44, 0.0),
    new THREE.Vector2(0.54, 0.08),
    new THREE.Vector2(0.88, 0.34),
    new THREE.Vector2(0.92, 0.54),
    new THREE.Vector2(0.86, 0.56),
    new THREE.Vector2(0.80, 0.34),
    new THREE.Vector2(0.44, 0.12),
    new THREE.Vector2(0.0, 0.10),
  ];
  const kBowl = new THREE.Mesh(new THREE.LatheGeometry(kProfile, 30), kBowlMat);
  kBowl.castShadow = true;
  kBowl.receiveShadow = true;
  kinakoGroup.add(kBowl);

  // Soft organic mound of toasted golden-ochre kinako powder
  const kHeapGeo = new THREE.SphereGeometry(0.80, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const kPos = kHeapGeo.attributes.position;
  for (let i = 0; i < kPos.count; i++) {
    const x = kPos.getX(i);
    const y = kPos.getY(i);
    const z = kPos.getZ(i);
    const r = Math.hypot(x, z);
    const bump = Math.sin(x * 7.2) * Math.cos(z * 6.5) * 0.028 + Math.sin((x + z) * 12) * 0.014;
    kPos.setY(i, y * 0.46 + bump * (1 - r / 0.95));
  }
  kHeapGeo.computeVertexNormals();
  const kinakoHeap = new THREE.Mesh(kHeapGeo, kinakoMat);
  kinakoHeap.position.y = 0.27;
  kinakoHeap.receiveShadow = true;
  kinakoGroup.add(kinakoHeap);

  // Authentic curved bamboo scoop (茶杓)
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0xb69258, roughness: 0.56 });
  const scoopGroup = new THREE.Group();
  const scoopHandle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.88), bambooMat);
  const scoopBowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), bambooMat);
  scoopBowl.scale.set(0.88, 0.36, 1.25);
  scoopBowl.position.set(0, -0.02, -0.42);
  scoopGroup.add(scoopHandle, scoopBowl);
  scoopGroup.position.set(0.30, 0.58, 0.22);
  scoopGroup.rotation.set(0.24, -0.62, 0.14);
  scoopGroup.castShadow = true;
  kinakoGroup.add(scoopGroup);

  root.add(kinakoGroup);

  // --- 2. Anko Bowl (つぶあん鉢) ---
  const ankoGroup = new THREE.Group();
  ankoGroup.position.copy(TOPPING_POS.anko);

  const aBowlTex = createCeramicTextures(725, '#272930', '#14151a');
  const aBowlMat = new THREE.MeshPhysicalMaterial({
    map: aBowlTex.map,
    normalMap: aBowlTex.normalMap,
    roughness: 0.36,
    clearcoat: 0.42,
    clearcoatRoughness: 0.24,
  });

  const aProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.40, 0.0),
    new THREE.Vector2(0.50, 0.08),
    new THREE.Vector2(0.80, 0.34),
    new THREE.Vector2(0.83, 0.54),
    new THREE.Vector2(0.76, 0.55),
    new THREE.Vector2(0.71, 0.33),
    new THREE.Vector2(0.40, 0.12),
    new THREE.Vector2(0.0, 0.10),
  ];
  const aBowl = new THREE.Mesh(new THREE.LatheGeometry(aProfile, 30), aBowlMat);
  aBowl.castShadow = true;
  aBowl.receiveShadow = true;
  ankoGroup.add(aBowl);

  // Glossy bumpy tsubu-an mound inside bowl
  const aHeapGeo = new THREE.SphereGeometry(0.70, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const aPos = aHeapGeo.attributes.position;
  for (let i = 0; i < aPos.count; i++) {
    const x = aPos.getX(i);
    const y = aPos.getY(i);
    const z = aPos.getZ(i);
    const lobe = Math.sin(x * 11 + 1.2) * Math.cos(z * 10 - 0.5) * 0.048
      + Math.sin(x * 18 - z * 16) * 0.024;
    aPos.setY(i, y * 0.48 + lobe);
  }
  aHeapGeo.computeVertexNormals();
  const ankoHeap = new THREE.Mesh(aHeapGeo, ankoMat);
  ankoHeap.position.y = 0.28;
  ankoHeap.castShadow = true;
  ankoHeap.receiveShadow = true;
  ankoGroup.add(ankoHeap);

  const spatMat = new THREE.MeshStandardMaterial({ color: 0xa67746, roughness: 0.60 });
  const spatula = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.026, 0.86), spatMat);
  spatula.position.set(0.32, 0.60, -0.16);
  spatula.rotation.set(-0.34, 0.58, -0.22);
  spatula.castShadow = true;
  ankoGroup.add(spatula);

  root.add(ankoGroup);

  // --- 3. Nori Tray (焼き海苔皿) + Tiny Soy Sauce Dish ---
  const noriGroup = new THREE.Group();
  noriGroup.position.copy(TOPPING_POS.nori);

  const blackLacquerMat = new THREE.MeshPhysicalMaterial({
    color: 0x151110,
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14,
  });

  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.09, 1.06), blackLacquerMat);
  trayBase.position.y = 0.045;
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  noriGroup.add(trayBase);

  const lipLong = new THREE.BoxGeometry(1.62, 0.12, 0.055);
  const lipShort = new THREE.BoxGeometry(0.055, 0.12, 1.08);
  const l1 = new THREE.Mesh(lipLong, blackLacquerMat); l1.position.set(0, 0.065, 0.52);
  const l2 = new THREE.Mesh(lipLong, blackLacquerMat); l2.position.set(0, 0.065, -0.52);
  const l3 = new THREE.Mesh(lipShort, blackLacquerMat); l3.position.set(0.79, 0.065, 0);
  const l4 = new THREE.Mesh(lipShort, blackLacquerMat); l4.position.set(-0.79, 0.065, 0);
  noriGroup.add(l1, l2, l3, l4);

  const noriSheets = [];
  for (let s = 0; s < 5; s++) {
    const sheetGeo = new THREE.PlaneGeometry(1.16, 0.74, 12, 8);
    const sp = sheetGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const px = sp.getX(i);
      const py = sp.getY(i);
      const curl = (px * px * 0.065) + Math.sin(px * 4.5 + s) * 0.012 + Math.cos(py * 5.0 + s) * 0.008;
      sp.setZ(i, curl);
    }
    sheetGeo.computeVertexNormals();
    const sheet = new THREE.Mesh(sheetGeo, noriMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = (s - 2) * 0.045;
    sheet.position.set((s - 2) * 0.022, 0.105 + s * 0.020, (s % 2 === 0 ? -0.02 : 0.02));
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    noriGroup.add(sheet);
    noriSheets.push(sheet);
  }

  const soyDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.21, 0.10, 20),
    new THREE.MeshPhysicalMaterial({ color: 0xebe6dc, roughness: 0.26, clearcoat: 0.50 })
  );
  soyDish.position.set(-1.12, 0.05, 0.08);
  soyDish.castShadow = true;
  soyDish.receiveShadow = true;
  const soyLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.23, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0x160603,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    })
  );
  soyLiquid.rotation.x = -Math.PI / 2;
  soyLiquid.position.set(-1.12, 0.102, 0.08);
  noriGroup.add(soyDish, soyLiquid);

  root.add(noriGroup);

  // --- 4. Three Family Members' Authentic Japanese Plates (取り皿) ---
  const plates = [];

  for (const cfg of FAMILY_PLATES) {
    const pGroup = new THREE.Group();
    pGroup.position.copy(cfg.pos);

    let plateMat;
    if (cfg.plateStyle === 'vermilion') {
      // Authentic deep glossy Japanese Urushi cinnabar-red lacquer
      plateMat = new THREE.MeshPhysicalMaterial({
        color: 0x760c06,
        roughness: 0.36,
        metalness: 0.01,
        clearcoat: 0.24,
        clearcoatRoughness: 0.26,
        envMapIntensity: 0.26,
      });
    } else if (cfg.plateStyle === 'indigo') {
      const tex = createCeramicTextures(830, '#243242', '#141d28');
      plateMat = new THREE.MeshPhysicalMaterial({
        map: tex.map,
        normalMap: tex.normalMap,
        roughness: 0.42,
        clearcoat: 0.36,
        clearcoatRoughness: 0.26,
      });
    } else {
      const tex = createCeramicTextures(842, '#cfc6b6', '#6e604f');
      plateMat = new THREE.MeshPhysicalMaterial({
        map: tex.map,
        normalMap: tex.normalMap,
        roughness: 0.44,
        clearcoat: 0.32,
        clearcoatRoughness: 0.28,
      });
    }

    const r = cfg.radius;
    const profile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(r * 0.56, 0.0),
      new THREE.Vector2(r * 0.64, 0.05),
      new THREE.Vector2(r * 0.98, 0.15),
      new THREE.Vector2(r * 1.0, 0.19),
      new THREE.Vector2(r * 0.94, 0.20),
      new THREE.Vector2(r * 0.62, 0.09),
      new THREE.Vector2(0.0, 0.07),
    ];
    const plateMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), plateMat);
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    pGroup.add(plateMesh);

    if (cfg.plateStyle === 'vermilion') {
      const goldRim = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.96, 0.017, 8, 34),
        new THREE.MeshStandardMaterial({ color: 0xb88b35, roughness: 0.30, metalness: 0.75 })
      );
      goldRim.rotation.x = Math.PI / 2;
      goldRim.position.y = 0.195;
      pGroup.add(goldRim);
    }

    const rest = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, 0.17, 6, 10),
      new THREE.MeshPhysicalMaterial({
        color: cfg.plateStyle === 'vermilion' ? 0x264230 : 0x942920,
        roughness: 0.28,
        clearcoat: 0.55,
      })
    );
    rest.rotation.z = Math.PI / 2;
    if (cfg.id === 'grandma') {
      rest.position.set(0.05, 0.052, 1.04);
      rest.rotation.y = Math.PI / 2;
    } else {
      rest.position.set(0.84, 0.052, -0.54);
    }
    rest.castShadow = true;
    pGroup.add(rest);

    root.add(pGroup);
    plates.push({
      id: cfg.id,
      group: pGroup,
      basePos: cfg.pos.clone(),
      radius: cfg.radius,
      surfaceY: 0.09,
      mochiList: [],
      wobble: 0,
      nudge: 0,
    });
  }

  return {
    root,
    materials: { kinakoMat, ankoMat, noriMat },
    toppings: {
      kinako: { group: kinakoGroup, heap: kinakoHeap, scoop: scoopGroup, pos: TOPPING_POS.kinako, radius: 0.95, wobble: 0 },
      anko: { group: ankoGroup, heap: ankoHeap, spatula, pos: TOPPING_POS.anko, radius: 0.88, wobble: 0 },
      nori: { group: noriGroup, sheets: noriSheets, pos: TOPPING_POS.nori, radius: 0.92, wobble: 0 },
    },
    plates,
  };
}
