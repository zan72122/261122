import * as THREE from 'three';
import {
  createCastIronTextures,
  createWalnutWoodTextures,
  createCeramicTexture,
  createOctopusTextures,
  createKatsuobushiTexture
} from './textures.js';

// Well centers in cast-iron plate local space (3 columns x 2 rows = 6 big generous wells!)
export const WELL_RADIUS = 0.0285; // ~5.7cm juicy home takoyaki well!
export const PLATE_Y = 0.056;      // Top surface height of cast-iron griddle above table
export const WELL_OFFSETS = [
  { x: -0.074, z: -0.038 },
  { x: 0.000,  z: -0.038 },
  { x: 0.074,  z: -0.038 },
  { x: -0.074, z: 0.038 },
  { x: 0.000,  z: 0.038 },
  { x: 0.074,  z: 0.038 }
];

// Build an authentic 3D sculpted cast-iron takoyaki plate with 6 true concave hemispherical wells
function createSculptedCastIronPlateGeo() {
  const plateW = 0.256;
  const plateD = 0.172;
  const segX = 76;
  const segZ = 52;
  const geo = new THREE.PlaneGeometry(plateW, plateD, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let y = 0;

    // Raised outer rim lip around the iron griddle (holds overflowing batter!)
    const edgeX = Math.abs(x) / (plateW * 0.5);
    const edgeZ = Math.abs(z) / (plateD * 0.5);
    const edge = Math.max(edgeX, edgeZ);
    if (edge > 0.87) {
      const t = (edge - 0.87) / 0.13;
      y += Math.sin(Math.min(1, t) * Math.PI * 0.8) * 0.0075;
    }

    // Carve 6 crisp concave hemispherical takoyaki wells with subtle chamfered rim
    for (const w of WELL_OFFSETS) {
      const d = Math.hypot(x - w.x, z - w.z);
      if (d < WELL_RADIUS * 1.12) {
        if (d < WELL_RADIUS) {
          const nd = d / WELL_RADIUS;
          const depth = Math.sqrt(Math.max(0, 1 - nd * nd)) * (WELL_RADIUS * 0.86);
          y -= depth;
        } else {
          // Subtle rounded lip bevel into the well
          const t = (d - WELL_RADIUS) / (WELL_RADIUS * 0.12);
          y += (1 - t) * 0.0012;
        }
      }
    }
    pos.setY(i, y);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createDiningRoomAndProps(scene) {
  const interactiveProps = {};
  const castIronTex = createCastIronTextures();
  const walnutTex = createWalnutWoodTextures();
  const ceramicWhiteTex = createCeramicTexture('#d6cbb8', '#7d6e5d');
  const ceramicDarkTex = createCeramicTexture('#2c2827', '#5e5047');
  const ceramicBlueTex = createCeramicTexture('#283847', '#6c7c89');
  const octoTex = createOctopusTextures();
  const katsuoTex = createKatsuobushiTexture();

  // =========================================================================
  // 1. WALNUT DINING TABLE (Tabletop surface is Y = 0.0)
  // =========================================================================
  const tableMat = new THREE.MeshPhysicalMaterial({
    map: walnutTex.map,
    normalMap: walnutTex.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: walnutTex.roughnessMap,
    roughness: 0.72,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.34
  });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.045, 1.05), tableMat);
  tableTop.position.set(0, -0.0225, -0.04);
  tableTop.receiveShadow = true;
  scene.add(tableTop);

  // =========================================================================
  // 2. COZY NIGHT JAPANESE DINING ROOM BACKDROP (Warm plaster, cedar trim, glowing shoji, night window)
  // =========================================================================
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3b2c22,
    roughness: 0.92
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), wallMat);
  backWall.position.set(0, 0.82, -1.35);
  scene.add(backWall);

  // Warm wood wainscoting paneling along lower wall behind family
  const cedarMat = new THREE.MeshStandardMaterial({
    map: walnutTex.map,
    color: 0x5d3f2a,
    roughness: 0.78
  });
  const wainscot = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.56), cedarMat);
  wainscot.position.set(0, 0.20, -1.33);
  scene.add(wainscot);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.028, 0.16), cedarMat);
  shelf.position.set(0.0, 0.54, -1.24);
  scene.add(shelf);

  // Subtle warm background sconce glow illuminating the plaster wall behind Mom & Dad (NO black void!)
  const wallSconceLight = new THREE.PointLight(0xffb468, 1.35, 3.2, 1.4);
  wallSconceLight.position.set(0.0, 0.72, -0.95);
  scene.add(wallSconceLight);

  // Softly glowing shoji / kitchen partition panel on back-left (warm evening home vibe)
  const shojiPaperMat = new THREE.MeshStandardMaterial({
    color: 0xffd7a3,
    emissive: 0xd9873d,
    emissiveIntensity: 0.48,
    roughness: 0.95
  });
  const shoji = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.25), shojiPaperMat);
  shoji.position.set(-0.92, 0.76, -1.32);
  scene.add(shoji);

  // Wooden kumiko lattice mullions over shoji
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3b271a, roughness: 0.7 });
  for (let i = -2; i <= 2; i++) {
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.016, 1.26, 0.02), frameMat);
    vBar.position.set(-0.92 + i * 0.22, 0.76, -1.31);
    scene.add(vBar);
  }
  for (let j = -2; j <= 2; j++) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.016, 0.02), frameMat);
    hBar.position.set(-0.92, 0.76 + j * 0.28, -1.31);
    scene.add(hBar);
  }

  // Deep indigo night window on back-right (contrasts with warm amber interior!)
  const nightGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0e1b30,
    emissive: 0x132645,
    emissiveIntensity: 0.65,
    roughness: 0.15,
    metalness: 0.2
  });
  const nightWin = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.15), nightGlassMat);
  nightWin.position.set(0.92, 0.76, -1.32);
  scene.add(nightWin);

  // Distant blurred warm city/house bokeh lights outside the night window
  const bokehColors = [0xffc46b, 0xffe4a8, 0xff9d52, 0x8db8ff];
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Mesh(
      new THREE.CircleGeometry(0.016 + (i % 3) * 0.012, 12),
      new THREE.MeshBasicMaterial({
        color: bokehColors[i % bokehColors.length],
        transparent: true,
        opacity: 0.5
      })
    );
    b.position.set(0.62 + (i * 0.11) % 0.62, 0.45 + ((i * 0.19) % 0.52), -1.315);
    scene.add(b);
  }
  const winV = new THREE.Mesh(new THREE.BoxGeometry(0.026, 1.16, 0.028), frameMat);
  winV.position.set(0.92, 0.76, -1.30);
  scene.add(winV);
  const winH = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.026, 0.028), frameMat);
  winH.position.set(0.92, 0.68, -1.30);
  scene.add(winH);

  // Decorative background ceramic teapot, cup, & framed botanical print on rear shelf
  const bgPot = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 14, 10),
    new THREE.MeshStandardMaterial({ map: ceramicWhiteTex, roughness: 0.35 })
  );
  bgPot.scale.set(1.1, 0.82, 1.1);
  bgPot.position.set(-0.04, 0.595, -1.21);
  scene.add(bgPot);

  const bgCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.019, 0.046, 14),
    new THREE.MeshStandardMaterial({ color: 0x3b4d5a, roughness: 0.3 })
  );
  bgCup.position.set(0.06, 0.578, -1.20);
  scene.add(bgCup);

  // =========================================================================
  // 3. LOW-HANGING OVERHEAD PENDANT LAMP (Warm glowing rim peeking gracefully at top edge!)
  // =========================================================================
  const lampPivot = new THREE.Group();
  lampPivot.position.set(0, 0.978, 0.02);
  scene.add(lampPivot);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.50, 8),
    new THREE.MeshStandardMaterial({ color: 0x1c1714, roughness: 0.8 })
  );
  cord.position.set(0, -0.25, 0);
  lampPivot.add(cord);

  const shadeOuterMat = new THREE.MeshStandardMaterial({
    color: 0x453226,
    roughness: 0.62,
    metalness: 0.08,
    side: THREE.FrontSide
  });
  const shadeInnerMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b8,
    emissive: 0xffb866,
    emissiveIntensity: 1.55,
    roughness: 0.48,
    side: THREE.BackSide
  });
  const shadeGeo = new THREE.CylinderGeometry(0.042, 0.148, 0.115, 28, 1, true);
  const shadeOut = new THREE.Mesh(shadeGeo, shadeOuterMat);
  shadeOut.position.set(0, -0.525, 0);
  shadeOut.userData.propId = 'lamp';
  lampPivot.add(shadeOut);

  const shadeIn = new THREE.Mesh(shadeGeo, shadeInnerMat);
  shadeIn.position.set(0, -0.525, 0);
  lampPivot.add(shadeIn);

  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
  );
  bulbMesh.position.set(0, -0.55, 0);
  lampPivot.add(bulbMesh);

  // Warm key pendant SpotLight casting soft real shadows onto table, plate & faces!
  const pendantSpot = new THREE.SpotLight(0xffcb8c, 2.55, 4.2, Math.PI * 0.48, 0.68, 1.3);
  pendantSpot.position.set(0, -0.58, 0);
  pendantSpot.target.position.set(0, -1.06, -0.08);
  pendantSpot.castShadow = true;
  pendantSpot.shadow.mapSize.set(2048, 2048);
  pendantSpot.shadow.camera.near = 0.22;
  pendantSpot.shadow.camera.far = 2.6;
  pendantSpot.shadow.bias = -0.00045;
  pendantSpot.shadow.normalBias = 0.008;
  lampPivot.add(pendantSpot);
  lampPivot.add(pendantSpot.target);

  // Warm upward bounce fill from the lit table/plate back onto Mom & Dad's faces
  const tableBounceLight = new THREE.PointLight(0xffbc78, 0.85, 1.8, 1.4);
  tableBounceLight.position.set(0, 0.18, 0.08);
  scene.add(tableBounceLight);

  // Soft cool indigo rim light from night window on right side
  const windowRim = new THREE.DirectionalLight(0x6389c6, 0.46);
  windowRim.position.set(1.4, 0.9, -0.4);
  scene.add(windowRim);

  // Warm room ambient fill
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x382519, 0.56);
  scene.add(hemi);

  interactiveProps.lamp = { group: lampPivot, swingVel: 0, swingAngle: 0 };

  // =========================================================================
  // 4. PORTABLE GAS TAKOYAKI STOVE + SCULPTED CAST-IRON 6-WELL PLATE
  // =========================================================================
  const stoveGroup = new THREE.Group();
  scene.add(stoveGroup);

  // Matte enameled dark-charcoal stove body
  const stoveBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x26211f,
    roughness: 0.42,
    metalness: 0.55,
    clearcoat: 0.25
  });
  const stoveBase = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.046, 0.215), stoveBodyMat);
  stoveBase.position.set(0, 0.024, 0);
  stoveBase.castShadow = true;
  stoveBase.receiveShadow = true;
  stoveGroup.add(stoveBase);

  // Rubber feet so stove sits authentically on walnut table with SSAO shadow gap
  const footMat = new THREE.MeshStandardMaterial({ color: 0x111010, roughness: 0.9 });
  for (const fx of [-0.125, 0.125]) {
    for (const fz of [-0.088, 0.088]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.008, 10), footMat);
      foot.position.set(fx, 0.004, fz);
      stoveGroup.add(foot);
    }
  }

  // Warm flickering gas burner glow visible through side heat vents!
  const burnerGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6b24 });
  const ventSlots = [];
  for (let i = -2; i <= 2; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.004), burnerGlowMat);
    slot.position.set(i * 0.044, 0.032, 0.108);
    stoveGroup.add(slot);
    ventSlots.push(slot);
  }
  const burnerUnderLight = new THREE.PointLight(0xff6b24, 0.22, 0.35, 2.0);
  burnerUnderLight.position.set(0, 0.032, 0.125);
  stoveGroup.add(burnerUnderLight);

  // Small brass/chrome gas dial knob on front-right of stove (interactive click!)
  const knobGroup = new THREE.Group();
  knobGroup.position.set(0.118, 0.024, 0.112);
  stoveGroup.add(knobGroup);
  const knobMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.015, 0.014, 16),
    new THREE.MeshStandardMaterial({ color: 0x9c8266, metalness: 0.65, roughness: 0.32 })
  );
  knobMesh.rotation.x = Math.PI / 2;
  knobMesh.userData.propId = 'knob';
  knobGroup.add(knobMesh);
  interactiveProps.knob = { group: knobGroup, highHeat: true, wobble: 0 };

  // Sculpted 3D Cast-Iron Takoyaki Griddle Plate (with 6 oiled concave hemispherical wells!)
  const castIronMat = new THREE.MeshPhysicalMaterial({
    map: castIronTex.map,
    normalMap: castIronTex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: castIronTex.roughnessMap,
    roughness: 0.44,
    metalness: 0.72,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35
  });

  const plateMesh = new THREE.Mesh(createSculptedCastIronPlateGeo(), castIronMat);
  plateMesh.position.set(0, PLATE_Y, 0);
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  stoveGroup.add(plateMesh);

  // Thick cast-iron side skirt walls around plate perimeter
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.258, 0.014, 0.174), castIronMat);
  skirt.position.set(0, PLATE_Y - 0.007, 0);
  skirt.castShadow = true;
  stoveGroup.add(skirt);

  // Glistening thin oil sheen disc shimmering at the very bottom of each concave well
  const oilMat = new THREE.MeshPhysicalMaterial({
    color: 0x453114,
    roughness: 0.06,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.55,
    envMapIntensity: 2.0
  });
  const oilPools = [];
  for (const w of WELL_OFFSETS) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), oilMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(w.x, PLATE_Y - WELL_RADIUS * 0.78, w.z);
    stoveGroup.add(pool);
    oilPools.push(pool);
  }

  // =========================================================================
  // 5. TABLETOP INGREDIENTS & UTENSILS (Big, unmistakable, physically inviting!)
  // =========================================================================

  // --- A. BATTER PITCHER (Left-front of plate, creamy batter brimming inside!) ---
  const pitcherGroup = new THREE.Group();
  const pitcherHome = new THREE.Vector3(-0.228, 0.0, 0.055);
  pitcherGroup.position.copy(pitcherHome);
  scene.add(pitcherGroup);

  const pitcherCeramicMat = new THREE.MeshPhysicalMaterial({
    map: ceramicWhiteTex,
    roughness: 0.22,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12
  });
  const pitcherBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.095, 22), pitcherCeramicMat);
  pitcherBody.position.y = 0.048;
  pitcherBody.castShadow = true;
  pitcherBody.receiveShadow = true;
  pitcherBody.userData.propId = 'pitcher';
  pitcherGroup.add(pitcherBody);

  // Pouring spout clearly aimed toward the iron plate!
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.034, 12), pitcherCeramicMat);
  spout.rotation.z = -Math.PI * 0.42;
  spout.position.set(0.044, 0.086, 0);
  spout.userData.propId = 'pitcher';
  pitcherGroup.add(spout);

  // Curved handle on left side
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.0058, 8, 18, Math.PI * 1.15), pitcherCeramicMat);
  handle.position.set(-0.042, 0.052, 0);
  handle.rotation.z = Math.PI * 0.45;
  handle.userData.propId = 'pitcher';
  pitcherGroup.add(handle);

  // Glossy pale-cream liquid batter visible right at the top rim (natural warm cream, never blown-out white)
  const batterLiquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xdccaa2,
    roughness: 0.16,
    clearcoat: 0.85,
    clearcoatRoughness: 0.10
  });
  const batterSurface = new THREE.Mesh(new THREE.CircleGeometry(0.040, 20), batterLiquidMat);
  batterSurface.rotation.x = -Math.PI / 2;
  batterSurface.position.y = 0.089;
  batterSurface.userData.propId = 'pitcher';
  pitcherGroup.add(batterSurface);

  // Active batter pouring stream (visible only while pouring!)
  const pourStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0045, 0.0072, 0.11, 10),
    batterLiquidMat
  );
  pourStream.visible = false;
  scene.add(pourStream);

  interactiveProps.pitcher = {
    group: pitcherGroup,
    homePos: pitcherHome.clone(),
    homeRot: new THREE.Euler(0, 0.25, 0),
    pourStream,
    wobble: 0
  };
  pitcherGroup.rotation.copy(interactiveProps.pitcher.homeRot);

  // --- B. OCTOPUS & NEGI BOWL (Left-rear of plate, heaped with glistening red-white octopus!) ---
  const octoBowlGroup = new THREE.Group();
  const octoHome = new THREE.Vector3(-0.232, 0.0, -0.078);
  octoBowlGroup.position.copy(octoHome);
  scene.add(octoBowlGroup);

  const darkBowlMat = new THREE.MeshPhysicalMaterial({
    map: ceramicDarkTex,
    roughness: 0.34,
    clearcoat: 0.45,
    side: THREE.DoubleSide
  });
  const octoBowl = new THREE.Mesh(new THREE.SphereGeometry(0.054, 22, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52), darkBowlMat);
  octoBowl.position.y = 0.052;
  octoBowl.castShadow = true;
  octoBowl.receiveShadow = true;
  octoBowl.userData.propId = 'octopus';
  octoBowlGroup.add(octoBowl);

  // Heaped glistening boiled octopus chunks + chopped green negi inside the bowl
  const octoMat = new THREE.MeshPhysicalMaterial({
    map: octoTex.map,
    normalMap: octoTex.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.24,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12
  });
  const octoChunkGeo = new THREE.DodecahedronGeometry(0.0135, 1);
  const chunkPositions = [
    [-0.016, 0.036, 0.010], [0.014, 0.038, 0.014], [0.002, 0.044, -0.004],
    [-0.012, 0.040, -0.014], [0.018, 0.035, -0.012], [-0.002, 0.050, 0.004],
    [0.022, 0.042, 0.002]
  ];
  for (let i = 0; i < chunkPositions.length; i++) {
    const p = chunkPositions[i];
    const ch = new THREE.Mesh(octoChunkGeo, octoMat);
    ch.position.set(p[0], p[1], p[2]);
    ch.scale.set(1.0 + (i % 2) * 0.2, 0.85, 1.15);
    ch.rotation.set(i * 0.9, i * 1.3, i * 0.5);
    ch.castShadow = true;
    ch.userData.propId = 'octopus';
    octoBowlGroup.add(ch);
  }
  // Fresh chopped green negi rings nestled beside octopus
  const negiMat = new THREE.MeshStandardMaterial({ color: 0x3b8a36, roughness: 0.42 });
  for (let i = 0; i < 10; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0014, 5, 10), negiMat);
    const a = (i / 10) * Math.PI * 2;
    ring.position.set(Math.cos(a) * 0.026, 0.042 + (i % 3) * 0.003, Math.sin(a) * 0.022);
    ring.rotation.set(Math.PI * 0.5 + (i % 2) * 0.3, 0, a);
    ring.userData.propId = 'octopus';
    octoBowlGroup.add(ring);
  }

  interactiveProps.octopus = {
    group: octoBowlGroup,
    homePos: octoHome.clone(),
    octoMat,
    negiMat,
    wobble: 0
  };

  // --- C. STEEL TAKOYAKI PICK (Front-right resting on wooden rest, pointed at plate!) ---
  const pickGroup = new THREE.Group();
  const pickHome = new THREE.Vector3(0.165, 0.022, 0.155);
  pickGroup.position.copy(pickHome);
  scene.add(pickGroup);

  const pickHandleMat = new THREE.MeshStandardMaterial({
    map: walnutTex.map,
    color: 0xa06b42,
    roughness: 0.45
  });
  const pickSteelMat = new THREE.MeshStandardMaterial({
    color: 0xdce2e8,
    metalness: 0.92,
    roughness: 0.16
  });
  const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0082, 0.088, 12), pickHandleMat);
  pickHandle.rotation.x = Math.PI / 2;
  pickHandle.position.z = 0.044;
  pickHandle.castShadow = true;
  pickHandle.userData.propId = 'pick';
  pickGroup.add(pickHandle);

  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0066, 0.0066, 0.012, 12), pickSteelMat);
  ferrule.rotation.x = Math.PI / 2;
  ferrule.position.z = -0.002;
  pickGroup.add(ferrule);

  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.0024, 0.086, 10), pickSteelMat);
  needle.rotation.x = -Math.PI / 2;
  needle.position.z = -0.048;
  needle.castShadow = true;
  needle.userData.propId = 'pick';
  pickGroup.add(needle);

  // Wooden pick rest block on table
  const pickRest = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.012, 0.016),
    new THREE.MeshStandardMaterial({ color: 0x5c3c24, roughness: 0.65 })
  );
  pickRest.position.set(0.165, 0.006, 0.155);
  pickRest.rotation.y = 0.38;
  pickRest.castShadow = true;
  scene.add(pickRest);

  interactiveProps.pick = {
    group: pickGroup,
    homePos: pickHome.clone(),
    homeRot: new THREE.Euler(0.04, 0.38, 0),
    wobble: 0
  };
  pickGroup.rotation.copy(interactiveProps.pick.homeRot);

  // --- D. TAKOYAKI SAUCE SQUEEZE BOTTLE (Right-front of plate, glossy dark brown!) ---
  const sauceGroup = new THREE.Group();
  const sauceHome = new THREE.Vector3(0.228, 0.0, 0.048);
  sauceGroup.position.copy(sauceHome);
  scene.add(sauceGroup);

  const sauceBottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b1106,
    roughness: 0.18,
    metalness: 0.05,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08
  });
  const sauceBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.030, 0.105, 20), sauceBottleMat);
  sauceBody.position.y = 0.0525;
  sauceBody.castShadow = true;
  sauceBody.receiveShadow = true;
  sauceBody.userData.propId = 'sauce';
  sauceGroup.add(sauceBody);

  // Classic red-ochre squeeze cap & pointed nozzle (zero text, pure physical shape signifier!)
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0xa62a1d, roughness: 0.3, clearcoat: 0.5 });
  const sauceShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 0.018, 18), capMat);
  sauceShoulder.position.y = 0.114;
  sauceShoulder.userData.propId = 'sauce';
  sauceGroup.add(sauceShoulder);

  const sauceNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.032, 14), capMat);
  sauceNozzle.position.y = 0.136;
  sauceNozzle.userData.propId = 'sauce';
  sauceGroup.add(sauceNozzle);

  // Subtle cream decorative band (pure texture/craft look, ZERO letters)
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0304, 0.0306, 0.032, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe6d3b3, roughness: 0.6 })
  );
  band.position.y = 0.054;
  band.userData.propId = 'sauce';
  sauceGroup.add(band);

  interactiveProps.sauce = {
    group: sauceGroup,
    homePos: sauceHome.clone(),
    homeRot: new THREE.Euler(0, 0, 0),
    wobble: 0
  };

  // --- E. KATSUOBUSHI WOODEN BOWL (Right-rear of plate, heaped with fluttering bonito flakes!) ---
  const katsuoGroup = new THREE.Group();
  const katsuoHome = new THREE.Vector3(0.232, 0.0, -0.072);
  katsuoGroup.position.copy(katsuoHome);
  scene.add(katsuoGroup);

  const lacquerMat = new THREE.MeshPhysicalMaterial({
    color: 0x451a12,
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
    side: THREE.DoubleSide
  });
  const katsuoBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 20, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52),
    lacquerMat
  );
  katsuoBowl.position.y = 0.050;
  katsuoBowl.castShadow = true;
  katsuoBowl.receiveShadow = true;
  katsuoBowl.userData.propId = 'katsuobushi';
  katsuoGroup.add(katsuoBowl);

  const katsuoFlakeMat = new THREE.MeshStandardMaterial({
    map: katsuoTex,
    transparent: true,
    alphaTest: 0.12,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  const bowlFlakes = [];
  for (let i = 0; i < 18; i++) {
    const fGeo = new THREE.PlaneGeometry(0.022, 0.036, 2, 3);
    // Gentle organic curl
    const fp = fGeo.attributes.position;
    for (let k = 0; k < fp.count; k++) {
      const fy = fp.getY(k);
      fp.setZ(k, Math.sin(fy * 60) * 0.004);
    }
    fGeo.computeVertexNormals();
    const fl = new THREE.Mesh(fGeo, katsuoFlakeMat);
    const a = (i / 18) * Math.PI * 2;
    const r = 0.008 + (i % 3) * 0.011;
    fl.position.set(Math.cos(a) * r, 0.044 + (i % 4) * 0.005, Math.sin(a) * r);
    fl.rotation.set(Math.PI * 0.32 + (i % 3) * 0.22, a, (i % 2) * 0.6);
    fl.userData.propId = 'katsuobushi';
    katsuoGroup.add(fl);
    bowlFlakes.push(fl);
  }
  interactiveProps.katsuobushi = {
    group: katsuoGroup,
    homePos: katsuoHome.clone(),
    bowlFlakes,
    katsuoFlakeMat,
    wobble: 0
  };

  // --- F. WOODEN SERVING BOAT (FUNE) / CERAMIC PLATTER (Between stove and family!) ---
  const boatGroup = new THREE.Group();
  const boatPos = new THREE.Vector3(0.0, 0.002, -0.175);
  boatGroup.position.copy(boatPos);
  scene.add(boatGroup);

  const pineMat = new THREE.MeshStandardMaterial({
    map: walnutTex.map,
    color: 0xd9b98c,
    roughness: 0.74,
    side: THREE.DoubleSide
  });
  // Sculpted Japanese takoyaki wooden boat (fune-zara)
  const boatGeo = new THREE.CylinderGeometry(0.095, 0.068, 0.024, 24, 1, true);
  boatGeo.scale(1.38, 1, 0.68);
  const boatWalls = new THREE.Mesh(boatGeo, pineMat);
  boatWalls.position.y = 0.012;
  boatWalls.castShadow = true;
  boatWalls.receiveShadow = true;
  boatWalls.userData.propId = 'plate';
  boatGroup.add(boatWalls);

  const boatFloorGeo = new THREE.CircleGeometry(0.068, 24);
  boatFloorGeo.scale(1.38, 0.68, 1);
  const boatFloor = new THREE.Mesh(boatFloorGeo, pineMat);
  boatFloor.rotation.x = -Math.PI / 2;
  boatFloor.position.y = 0.002;
  boatFloor.receiveShadow = true;
  boatFloor.userData.propId = 'plate';
  boatGroup.add(boatFloor);

  // 6 neat serving slots on the wooden boat
  const boatSlots = [
    new THREE.Vector3(-0.065, 0.024, -0.016),
    new THREE.Vector3(0.000,  0.024, -0.018),
    new THREE.Vector3(0.065,  0.024, -0.016),
    new THREE.Vector3(-0.056, 0.024, 0.020),
    new THREE.Vector3(0.006,  0.024, 0.022),
    new THREE.Vector3(0.062,  0.024, 0.018)
  ];
  interactiveProps.plate = {
    group: boatGroup,
    slots: boatSlots.map(s => s.clone().add(boatPos)),
    occupied: new Array(6).fill(null)
  };

  // --- G. AMBIENT DINING DETAILS: Iced Mugicha Barley Tea Glasses & Small Personal Dishes ---
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.72,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1.0
  });
  const teaMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b320d,
    roughness: 0.1,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.88
  });
  const teaGlasses = [];
  for (const gx of [-0.34, 0.33]) {
    const gGroup = new THREE.Group();
    gGroup.position.set(gx, 0, -0.21);
    scene.add(gGroup);

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.092, 18, 1, true), glassMat);
    glass.position.y = 0.046;
    glass.userData.propId = 'tea';
    gGroup.add(glass);

    const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.024, 0.068, 16), teaMat);
    tea.position.y = 0.036;
    tea.userData.propId = 'tea';
    gGroup.add(tea);

    // Floating ice cube catching warm pendant specular highlight
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.016, 0.018),
      new THREE.MeshPhysicalMaterial({ color: 0xe6f2ff, roughness: 0.08, transparent: true, opacity: 0.65 })
    );
    ice.position.set(0.004, 0.065, -0.003);
    ice.rotation.set(0.3, 0.5, 0.2);
    gGroup.add(ice);
    teaGlasses.push({ group: gGroup, ice, clink: 0 });
  }
  interactiveProps.teaGlasses = teaGlasses;

  // Mom & Dad's small personal ceramic sharing plates (torizara)
  const smallDishMat = new THREE.MeshPhysicalMaterial({
    map: ceramicBlueTex,
    roughness: 0.24,
    clearcoat: 0.65
  });
  for (const dx of [-0.21, 0.21]) {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.046, 0.012, 20), smallDishMat);
    dish.position.set(dx, 0.006, -0.25);
    dish.receiveShadow = true;
    scene.add(dish);
  }

  return {
    stoveGroup,
    plateMesh,
    oilPools,
    burnerGlowMat,
    burnerUnderLight,
    pendantSpot,
    lampPivot,
    interactiveProps
  };
}
