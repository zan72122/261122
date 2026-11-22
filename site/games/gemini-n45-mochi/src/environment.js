import * as THREE from 'three';
import {
  createTatamiTextures,
  createKeyakiWoodTextures,
  createHinokiBoardTextures,
  createShojiPaperTexture,
  createCeramicTextures,
} from './textures.js';

export const BOARD_Y = 0.16;
export const BOARD_CENTER = new THREE.Vector3(-0.32, 0, 0.72);
export const BOARD_SIZE = { w: 4.65, d: 3.00, h: BOARD_Y };

// Photographic PMREM environment map: luminous white Shoji window, golden tatami bounce, warm cedar interior
export function createWashitsuEnvironmentMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x211a14);

  // Soft white Shoji window panels (balanced so mochi & red lacquer stay rich, never washed out!)
  const shojiBack = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.35, 2.32, 2.25) })
  );
  shojiBack.position.set(-4, 5.5, -12);
  shojiBack.lookAt(0, 1, 0);
  envScene.add(shojiBack);

  const shojiSide = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.05, 2.02, 1.98) })
  );
  shojiSide.position.set(-13, 4.5, -2);
  shojiSide.lookAt(0, 1, 0);
  envScene.add(shojiSide);

  // Shoji kumiko grid bars in specular reflection
  const barMat = new THREE.MeshBasicMaterial({ color: 0x3a281a });
  for (let i = -3; i <= 3; i++) {
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 14, 0.1), barMat);
    vBar.position.set(-4 + i * 3.1, 5.5, -11.7);
    envScene.add(vBar);
  }
  for (let j = -2; j <= 2; j++) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(24, 0.16, 0.1), barMat);
    hBar.position.set(-4, 5.5 + j * 2.5, -11.7);
    envScene.add(hBar);
  }

  // Warm golden-olive tatami floor bounce
  const tatamiBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.66, 0.58, 0.36) })
  );
  tatamiBounce.rotation.x = -Math.PI / 2;
  tatamiBounce.position.y = -4;
  envScene.add(tatamiBounce);

  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.38, 0.31) })
  );
  rightWall.position.set(13, 4, 0);
  rightWall.rotation.y = -Math.PI / 2;
  envScene.add(rightWall);

  const frontFill = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.65, 0.58, 0.50) })
  );
  frontFill.position.set(3, 5, 13);
  frontFill.rotation.y = Math.PI;
  envScene.add(frontFill);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

export function buildWashitsuScene(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- Balanced Photographic New Year's Morning Shoji Lighting ---
  // 1. Key directional soft winter sunlight pouring from back-left Shoji
  const sunLight = new THREE.DirectionalLight(0xfffaf0, 2.35);
  sunLight.position.set(-7.2, 8.6, -5.8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 25.0;
  sunLight.shadow.camera.left = -6.8;
  sunLight.shadow.camera.right = 6.8;
  sunLight.shadow.camera.top = 5.8;
  sunLight.shadow.camera.bottom = -5.8;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.022;
  sunLight.shadow.radius = 3.0;
  scene.add(sunLight);

  // 2. Soft Shoji daylight sky / warm tatami ground bounce
  const hemiLight = new THREE.HemisphereLight(0xeef4ff, 0x7c6340, 0.78);
  scene.add(hemiLight);

  // 3. Subtle warm sculpting fill from front-right (preserves rich shadow depth!)
  const fillLight = new THREE.DirectionalLight(0xffe4c4, 0.56);
  fillLight.position.set(6.5, 5.2, 7.2);
  scene.add(fillLight);

  // 4. Crisp Shoji rim highlight grazing the back of the mochi, hands & steam
  const rimLight = new THREE.PointLight(0xfffcf4, 12, 15, 1.7);
  rimLight.position.set(-4.2, 2.8, -4.4);
  scene.add(rimLight);

  // --- 1. Woven Tatami Floor (畳 — clearly visible framing the top & sides of the low table!) ---
  const tatamiTex = createTatamiTextures();
  const tatamiMat = new THREE.MeshStandardMaterial({
    map: tatamiTex.map,
    normalMap: tatamiTex.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: tatamiTex.roughnessMap,
    roughness: 0.94,
    metalness: 0.0,
  });
  const tatamiY = -1.95; // Classic low Japanese zataku height so tatami & zabuton show prominently behind the table!
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 30), tatamiMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, tatamiY, -2);
  floor.receiveShadow = true;
  group.add(floor);

  // Dark woven indigo-charcoal Tatami-beri (畳縁) borders
  const beriMat = new THREE.MeshStandardMaterial({
    color: 0x1e2524,
    roughness: 0.88,
    metalness: 0.0,
  });
  const beriPositions = [
    { w: 36, d: 0.24, x: 0, z: -4.15 },
    { w: 36, d: 0.24, x: 0, z: -8.2 },
    { w: 0.24, d: 18, x: -4.9, z: -2.0 },
    { w: 0.24, d: 18, x: 0.2, z: -2.0 },
    { w: 0.24, d: 18, x: 5.3, z: -2.0 },
  ];
  for (const b of beriPositions) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.025, b.d), beriMat);
    strip.position.set(b.x, tatamiY + 0.012, b.z);
    strip.receiveShadow = true;
    group.add(strip);
  }

  // --- 2. Sunlit Shoji Sliding Doors (障子越しの白い光) ---
  const shojiPaperTex = createShojiPaperTexture();
  const shojiPaperMat = new THREE.MeshStandardMaterial({
    map: shojiPaperTex,
    emissive: new THREE.Color(0xfffdf6),
    emissiveMap: shojiPaperTex,
    emissiveIntensity: 1.25,
    roughness: 0.95,
    metalness: 0.0,
  });

  const cedarMat = new THREE.MeshStandardMaterial({
    color: 0x875f3c,
    roughness: 0.76,
    metalness: 0.0,
  });
  const darkPillarMat = new THREE.MeshStandardMaterial({
    color: 0x452b19,
    roughness: 0.62,
    metalness: 0.02,
  });

  function buildShojiPanel(width, height, cols, rows) {
    const panel = new THREE.Group();
    const frameThick = 0.22;
    const frameDepth = 0.16;

    const paper = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, height - 0.2), shojiPaperMat);
    paper.position.z = -0.02;
    panel.add(paper);

    const topF = new THREE.Mesh(new THREE.BoxGeometry(width, frameThick, frameDepth), cedarMat);
    topF.position.y = height / 2 - frameThick / 2;
    const botF = new THREE.Mesh(new THREE.BoxGeometry(width, 1.05, frameDepth), cedarMat);
    botF.position.y = -height / 2 + 0.525;
    const leftF = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameDepth), cedarMat);
    leftF.position.x = -width / 2 + frameThick / 2;
    const rightF = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameDepth), cedarMat);
    rightF.position.x = width / 2 - frameThick / 2;
    panel.add(topF, botF, leftF, rightF);

    const usableH = height - 1.05 - frameThick;
    const startY = -height / 2 + 1.05;
    for (let c = 1; c < cols; c++) {
      const x = -width / 2 + (width / cols) * c;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.055, usableH, 0.07), cedarMat);
      bar.position.set(x, startY + usableH / 2, 0.02);
      panel.add(bar);
    }
    for (let r = 1; r < rows; r++) {
      const y = startY + (usableH / rows) * r;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width - frameThick * 2, 0.055, 0.07), cedarMat);
      bar.position.set(0, y, 0.02);
      panel.add(bar);
    }
    return panel;
  }

  // Place Shoji wall slightly further back (-8.2) so a generous band of sunlit woven Tatami shows in between!
  const shojiZ = -8.2;
  const shojiH = 11.0;
  const shoji1 = buildShojiPanel(8.0, shojiH, 4, 6);
  shoji1.position.set(-5.0, tatamiY + shojiH / 2, shojiZ);
  group.add(shoji1);

  const shoji2 = buildShojiPanel(8.0, shojiH, 4, 6);
  shoji2.position.set(2.7, tatamiY + shojiH / 2, shojiZ + 0.18);
  group.add(shoji2);

  const shojiSidePanel = buildShojiPanel(11.0, shojiH, 5, 6);
  shojiSidePanel.rotation.y = Math.PI / 2;
  shojiSidePanel.position.set(-9.1, tatamiY + shojiH / 2, -2.5);
  group.add(shojiSidePanel);

  // Wooden shikii sliding rail (敷居) and Japanese cedar corner pillar (柱)
  const shikii = new THREE.Mesh(new THREE.BoxGeometry(24, 0.16, 0.55), cedarMat);
  shikii.position.set(-1, tatamiY + 0.08, shojiZ + 0.1);
  group.add(shikii);

  const pillarRight = new THREE.Mesh(new THREE.BoxGeometry(0.55, 11.8, 0.55), darkPillarMat);
  pillarRight.position.set(6.8, tatamiY + 5.9, shojiZ + 0.2);
  group.add(pillarRight);

  const plasterMat = new THREE.MeshStandardMaterial({ color: 0x94866c, roughness: 0.94 });
  const rightPlaster = new THREE.Mesh(new THREE.BoxGeometry(10, 11.8, 0.4), plasterMat);
  rightPlaster.position.set(11.6, tatamiY + 5.9, shojiZ + 0.25);
  group.add(rightPlaster);

  // Soft sunlit glow patch projected from the Shoji onto the Tatami floor!
  const sunPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 4.2),
    new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  sunPatch.rotation.x = -Math.PI / 2;
  sunPatch.position.set(-1.5, tatamiY + 0.03, -5.6);
  group.add(sunPatch);

  // --- 3. Rich Dark Keyaki Low Table (座卓 / ちゃぶ台) ---
  const keyakiTex = createKeyakiWoodTextures();
  const tableMat = new THREE.MeshStandardMaterial({
    map: keyakiTex.map,
    normalMap: keyakiTex.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: keyakiTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.02,
    envMapIntensity: 0.72,
  });

  const tableW = 10.6;
  const tableD = 6.25; // Slightly trimmer depth so Tatami & Zabuton frame the upper room beautifully!
  const tableThick = 0.34;
  const tableCenterZ = 0.35;

  const tableGroup = new THREE.Group();
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(tableW, tableThick, tableD), tableMat);
  tableTop.position.set(0, -tableThick / 2, tableCenterZ);
  tableTop.receiveShadow = true;
  tableTop.castShadow = true;
  tableGroup.add(tableTop);

  // Subtle dark chamfered rim strips
  const rimH = 0.12;
  const frontRim = new THREE.Mesh(new THREE.BoxGeometry(tableW + 0.08, rimH, 0.10), tableMat);
  frontRim.position.set(0, -0.08, tableCenterZ + tableD / 2);
  const backRim = new THREE.Mesh(new THREE.BoxGeometry(tableW + 0.08, rimH, 0.10), tableMat);
  backRim.position.set(0, -0.08, tableCenterZ - tableD / 2);
  tableGroup.add(frontRim, backRim);

  // Four low sturdy legs reaching the tatami
  const legGeo = new THREE.BoxGeometry(0.40, 1.75, 0.40);
  const legCoords = [
    [-4.5, -1.08, tableCenterZ - 2.4],
    [4.5, -1.08, tableCenterZ - 2.4],
    [-4.5, -1.08, tableCenterZ + 2.4],
    [4.5, -1.08, tableCenterZ + 2.4],
  ];
  for (const [lx, ly, lz] of legCoords) {
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    tableGroup.add(leg);
  }
  group.add(tableGroup);

  // Cozy woven Japanese Zabuton cushions resting visibly on the tatami around the table!
  const zabutonColors = [0x6e2c26, 0x2a3f4e, 0x4b5638];
  const zabutonPos = [
    [-2.1, tatamiY + 0.16, -4.45],
    [1.85, tatamiY + 0.16, -4.35],
    [-6.15, tatamiY + 0.16, 0.65],
  ];
  zabutonPos.forEach(([zx, zy, zz], i) => {
    const zMat = new THREE.MeshStandardMaterial({ color: zabutonColors[i], roughness: 0.92 });
    const cushion = new THREE.Mesh(new THREE.SphereGeometry(1.42, 18, 12), zMat);
    cushion.scale.set(1.0, 0.18, 0.92);
    cushion.position.set(zx, zy, zz);
    cushion.rotation.y = (i - 1) * 0.10;
    cushion.receiveShadow = true;
    cushion.castShadow = true;
    group.add(cushion);
  });

  // --- 4. Warm Pale Hinoki Mochi Board (のし台) with Flour Dusting ---
  const hinokiTex = createHinokiBoardTextures();
  const boardMat = new THREE.MeshStandardMaterial({
    map: hinokiTex.map,
    normalMap: hinokiTex.normalMap,
    normalScale: new THREE.Vector2(0.50, 0.50),
    roughnessMap: hinokiTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
  });

  const boardGroup = new THREE.Group();
  boardGroup.position.set(BOARD_CENTER.x, 0, BOARD_CENTER.z);

  const boardSlab = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_SIZE.w, BOARD_SIZE.h, BOARD_SIZE.d),
    boardMat
  );
  boardSlab.position.y = BOARD_SIZE.h / 2;
  boardSlab.castShadow = true;
  boardSlab.receiveShadow = true;
  boardGroup.add(boardSlab);

  const cleatGeo = new THREE.BoxGeometry(0.22, 0.055, BOARD_SIZE.d - 0.16);
  const cleatL = new THREE.Mesh(cleatGeo, boardMat);
  cleatL.position.set(-BOARD_SIZE.w / 2 + 0.34, 0.02, 0);
  const cleatR = new THREE.Mesh(cleatGeo, boardMat);
  cleatR.position.set(BOARD_SIZE.w / 2 - 0.34, 0.02, 0);
  boardGroup.add(cleatL, cleatR);
  group.add(boardGroup);

  // --- 5. Authentic New Year's Props (お正月のしつらえ) ---
  // 5a. Kagami-Mochi (鏡餅) resting cleanly on the far back-left corner of the table
  const kagamiGroup = new THREE.Group();
  kagamiGroup.position.set(-4.35, 0, -2.05);

  const sanpoMat = new THREE.MeshStandardMaterial({
    map: hinokiTex.map,
    roughness: 0.78,
    color: 0xe6cfa8,
  });
  const sanpoBase = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.32, 0.76), sanpoMat);
  sanpoBase.position.y = 0.16;
  sanpoBase.castShadow = true;
  sanpoBase.receiveShadow = true;
  const sanpoTray = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.10, 1.12), sanpoMat);
  sanpoTray.position.y = 0.37;
  sanpoTray.castShadow = true;
  sanpoTray.receiveShadow = true;
  kagamiGroup.add(sanpoBase, sanpoTray);

  // Red-edged white washi paper (四方紅)
  const paperRed = new THREE.Mesh(
    new THREE.BoxGeometry(1.06, 0.010, 1.06),
    new THREE.MeshStandardMaterial({ color: 0x9c1e16, roughness: 0.88 })
  );
  paperRed.position.y = 0.425;
  paperRed.rotation.y = Math.PI / 4;
  const paperWhite = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.013, 0.98),
    new THREE.MeshStandardMaterial({ color: 0xf2eee5, roughness: 0.92 })
  );
  paperWhite.position.y = 0.429;
  paperWhite.rotation.y = Math.PI / 4;
  kagamiGroup.add(paperRed, paperWhite);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x244822, roughness: 0.70 });
  for (const side of [-1, 1]) {
    const fern = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), leafMat);
    fern.scale.set(1.25, 0.07, 0.48);
    fern.position.set(side * 0.38, 0.45, 0.16);
    fern.rotation.y = side * -0.4;
    fern.rotation.z = side * -0.14;
    kagamiGroup.add(fern);
  }

  const kMochiMat = new THREE.MeshPhysicalMaterial({
    color: 0xeee8da,
    roughness: 0.42,
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
  });
  const kBot = new THREE.Mesh(new THREE.SphereGeometry(0.40, 22, 14), kMochiMat);
  kBot.scale.set(1.0, 0.50, 1.0);
  kBot.position.y = 0.62;
  kBot.castShadow = true;
  kBot.receiveShadow = true;
  const kTop = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 14), kMochiMat);
  kTop.scale.set(1.0, 0.54, 1.0);
  kTop.position.y = 0.92;
  kTop.castShadow = true;
  kTop.receiveShadow = true;
  kagamiGroup.add(kBot, kTop);

  // Authentic dimpled Daidai orange
  const daidaiGroup = new THREE.Group();
  daidaiGroup.position.set(0, 1.18, 0);
  const orangeMat = new THREE.MeshPhysicalMaterial({
    color: 0xd45b0e,
    roughness: 0.42,
    clearcoat: 0.28,
    clearcoatRoughness: 0.35,
  });
  const daidai = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), orangeMat);
  daidai.scale.set(1.06, 0.86, 1.06);
  daidai.castShadow = true;
  const dLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), leafMat);
  dLeaf.scale.set(1.3, 0.16, 0.62);
  dLeaf.position.set(0.10, 0.14, 0.02);
  dLeaf.rotation.z = 0.25;
  daidaiGroup.add(daidai, dLeaf);
  kagamiGroup.add(daidaiGroup);
  group.add(kagamiGroup);

  // 5b. Cast-Iron Kyusu Teapot (急須) & Steaming Green Tea Cup (湯呑み) at upper-right
  const teaGroup = new THREE.Group();
  teaGroup.position.set(4.10, 0, -1.85);

  const ironTex = createCeramicTextures(950, '#262321', '#151210');
  const teapotMat = new THREE.MeshStandardMaterial({
    map: ironTex.map,
    normalMap: ironTex.normalMap,
    roughness: 0.56,
    metalness: 0.24,
  });
  const potBody = new THREE.Mesh(new THREE.SphereGeometry(0.52, 22, 14), teapotMat);
  potBody.scale.set(1.05, 0.72, 1.05);
  potBody.position.y = 0.35;
  potBody.castShadow = true;
  potBody.receiveShadow = true;

  const potLid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.32, 0.07, 18), teapotMat);
  potLid.position.y = 0.70;
  const potKnob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), teapotMat);
  potKnob.position.y = 0.78;
  const potSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.10, 0.38, 10), teapotMat);
  potSpout.position.set(-0.52, 0.44, 0.12);
  potSpout.rotation.z = 0.95;
  const potHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.50, 10), teapotMat);
  potHandle.position.set(0.55, 0.42, -0.10);
  potHandle.rotation.z = -1.18;
  teaGroup.add(potBody, potLid, potKnob, potSpout, potHandle);

  const cupTex = createCeramicTextures(955, '#cfc5b4', '#635646');
  const cupMat = new THREE.MeshStandardMaterial({
    map: cupTex.map,
    normalMap: cupTex.normalMap,
    roughness: 0.42,
    metalness: 0.02,
  });
  const cupPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.21, 0.0),
    new THREE.Vector2(0.25, 0.08),
    new THREE.Vector2(0.29, 0.42),
    new THREE.Vector2(0.27, 0.50),
    new THREE.Vector2(0.23, 0.50),
    new THREE.Vector2(0.22, 0.09),
    new THREE.Vector2(0.0, 0.08),
  ];
  const teacup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 22), cupMat);
  teacup.position.set(-1.02, 0.01, 0.42);
  teacup.castShadow = true;
  teacup.receiveShadow = true;
  teaGroup.add(teacup);

  const teaLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 18),
    new THREE.MeshPhysicalMaterial({ color: 0x55682a, roughness: 0.08, clearcoat: 0.8 })
  );
  teaLiquid.rotation.x = -Math.PI / 2;
  teaLiquid.position.set(-1.02, 0.40, 0.42);
  teaGroup.add(teaLiquid);

  // Red Nandina berries sprig (南天) in stoneware vase
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.20, 0.60, 14),
    new THREE.MeshStandardMaterial({ color: 0x2d3633, roughness: 0.46 })
  );
  vase.position.set(0.55, 0.30, -0.68);
  vase.castShadow = true;
  teaGroup.add(vase);

  const berryMat = new THREE.MeshPhysicalMaterial({ color: 0xad1a16, roughness: 0.24, clearcoat: 0.55 });
  const berryOffsets = [
    [0.44, 0.80, -0.60], [0.51, 0.87, -0.64], [0.38, 0.72, -0.66],
    [0.49, 0.74, -0.56], [0.58, 0.90, -0.70], [0.35, 0.84, -0.62],
  ];
  for (const [bx, by, bz] of berryOffsets) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), berryMat);
    b.position.set(bx, by, bz);
    teaGroup.add(b);
  }
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.022, 0.50, 6),
    new THREE.MeshStandardMaterial({ color: 0x422f1f, roughness: 0.82 })
  );
  stem.position.set(0.50, 0.70, -0.65);
  stem.rotation.z = 0.32;
  teaGroup.add(stem);

  group.add(teaGroup);

  return {
    group,
    boardGroup,
    kagamiGroup,
    daidaiGroup,
    teaSteamOrigin: new THREE.Vector3(4.10 - 1.02, 0.44, -1.85 + 0.42),
    sunLight,
  };
}
