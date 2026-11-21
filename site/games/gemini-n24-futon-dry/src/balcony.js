import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function safeMerge(geos) {
  const normalized = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    // Ensure consistent attributes (position, normal, uv)
    for (const key of Object.keys(ng.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') {
        ng.deleteAttribute(key);
      }
    }
    return ng;
  });
  return mergeGeometries(normalized, false);
}

export const BALCONY = {
  railZ: -0.66,
  railY: 1.04,
  railRadius: 0.028,
  floorY: 0.0,
  tatamiY: 0.065,
  sillZ: 0.42,
  indoorCenterZ: 1.44
};

function addContactShadow(parent, tex, w, d, x, y, z, opacity = 0.55) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y + 0.002, z);
  parent.add(mesh);
  return mesh;
}

// Build a realistic contoured Japanese futon clip (ふとんばさみ)
function createFutonClip(mats, sideSign) {
  const group = new THREE.Group();
  group.userData.interactiveType = 'clip';
  group.userData.side = sideSign;

  // Contoured jaw profile (curved pincer arms)
  const armCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.06, 0.015),
    new THREE.Vector3(0, 0.035, 0.048),
    new THREE.Vector3(0, -0.025, 0.056),
    new THREE.Vector3(0, -0.095, 0.045),
    new THREE.Vector3(0, -0.135, 0.024)
  ]);
  const armCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.06, -0.015),
    new THREE.Vector3(0, 0.035, -0.048),
    new THREE.Vector3(0, -0.025, -0.056),
    new THREE.Vector3(0, -0.095, -0.045),
    new THREE.Vector3(0, -0.135, -0.024)
  ]);

  const jawFront = new THREE.Group();
  const jawBack = new THREE.Group();

  const tubeGeoF = new THREE.TubeGeometry(armCurveL, 18, 0.011, 8, false);
  const tubeGeoB = new THREE.TubeGeometry(armCurveR, 18, 0.011, 8, false);

  // Twin parallel ribs per jaw (classic Japanese futon-basami shape)
  for (const dx of [-0.018, 0.018]) {
    const mF = new THREE.Mesh(tubeGeoF, mats.futonClipWhite);
    mF.position.x = dx;
    mF.castShadow = true;
    mF.receiveShadow = true;
    jawFront.add(mF);

    const mB = new THREE.Mesh(tubeGeoB, mats.futonClipWhite);
    mB.position.x = dx;
    mB.castShadow = true;
    mB.receiveShadow = true;
    jawBack.add(mB);
  }

  // Grip pads at tips & finger handles on top
  const padGeo = new RoundedBoxGeometry(0.052, 0.032, 0.014, 3, 0.004);
  const padF = new THREE.Mesh(padGeo, mats.futonClipAccent);
  padF.position.set(0, -0.125, 0.028);
  padF.castShadow = true;
  jawFront.add(padF);

  const padB = new THREE.Mesh(padGeo, mats.futonClipAccent);
  padB.position.set(0, -0.125, -0.028);
  padB.castShadow = true;
  jawBack.add(padB);

  const handleGeo = new RoundedBoxGeometry(0.048, 0.042, 0.013, 3, 0.004);
  const handleF = new THREE.Mesh(handleGeo, mats.futonClipWhite);
  handleF.position.set(0, 0.068, 0.016);
  handleF.rotation.x = -0.22;
  handleF.castShadow = true;
  jawFront.add(handleF);

  const handleB = new THREE.Mesh(handleGeo, mats.futonClipWhite);
  handleB.position.set(0, 0.068, -0.016);
  handleB.rotation.x = 0.22;
  handleB.castShadow = true;
  jawBack.add(handleB);

  // Central metal spring coil pin
  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.058, 12),
    mats.aluminum
  );
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0, 0.045, 0);
  group.add(pin);

  group.add(jawFront, jawBack);

  // Generous invisible touch hitbox for 5yo finger
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.28, 0.18),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, -0.03, 0);
  hit.userData.interactiveType = 'clip';
  hit.userData.clipGroup = group;
  group.add(hit);

  group.userData.jawFront = jawFront;
  group.userData.jawBack = jawBack;
  group.userData.clamped = false;
  group.userData.restX = sideSign * 0.86;
  group.userData.clampX = sideSign * 0.58;
  group.userData.currentX = group.userData.restX;
  group.userData.openAnim = 0;
  group.position.set(group.userData.restX, BALCONY.railY + 0.015, BALCONY.railZ);

  return group;
}

// Delicate blown-glass Japanese wind chime (風鈴) hanging on upper-left pole
function createWindChime(mats) {
  const pivot = new THREE.Group();
  pivot.position.set(-0.96, 1.58, -0.34);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0014, 0.0014, 0.14, 6),
    mats.futonPiping
  );
  cord.position.y = -0.07;
  pivot.add(cord);

  // Blown glass dome profile via LatheGeometry
  const pts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.018, -0.004),
    new THREE.Vector2(0.034, -0.022),
    new THREE.Vector2(0.041, -0.050),
    new THREE.Vector2(0.036, -0.074),
    new THREE.Vector2(0.032, -0.076)
  ];
  const bellGeo = new THREE.LatheGeometry(pts, 24);
  const bell = new THREE.Mesh(bellGeo, mats.chimeGlass);
  bell.position.y = -0.14;
  pivot.add(bell);

  // Clapper & soft cream washi paper tanzaku strip
  const innerString = new THREE.Mesh(
    new THREE.CylinderGeometry(0.001, 0.001, 0.14, 6),
    mats.futonPiping
  );
  innerString.position.y = -0.21;
  pivot.add(innerString);

  const clapper = new THREE.Mesh(
    new THREE.SphereGeometry(0.0065, 10, 10),
    mats.aluminum
  );
  clapper.position.y = -0.205;
  pivot.add(clapper);

  const tanzaku = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, 0.135, 0.0012),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f7efe6'),
      roughness: 0.92,
      side: THREE.DoubleSide
    })
  );
  tanzaku.position.y = -0.34;
  tanzaku.castShadow = true;
  pivot.add(tanzaku);

  // Hitbox
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.44, 0.22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = -0.22;
  hit.userData.interactiveType = 'chime';
  pivot.add(hit);

  pivot.userData.angleZ = 0;
  pivot.userData.velZ = 0;
  pivot.userData.angleX = 0;
  pivot.userData.velX = 0;

  return pivot;
}

export function buildBalcony(scene, mats) {
  const root = new THREE.Group();
  scene.add(root);

  const interactables = [];

  // 1. Concrete balcony floor (3.8m wide x 1.25m deep)
  const floorGeo = new THREE.BoxGeometry(3.8, 0.16, 1.32);
  floorGeo.setAttribute('uv2', floorGeo.attributes.uv);
  const floor = new THREE.Mesh(floorGeo, mats.concreteFloor);
  floor.position.set(0, -0.08, -0.22);
  floor.receiveShadow = true;
  root.add(floor);

  // Outer drainage gutter lip along concrete edge
  const gutter = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.015, 0.12),
    mats.concreteWall
  );
  gutter.position.set(0, -0.004, -0.56);
  gutter.receiveShadow = true;
  root.add(gutter);

  // 2. Concrete balcony parapet wall (腰壁 — bright sunlit exterior concrete/stucco)
  const parapetGeo = new RoundedBoxGeometry(3.8, 0.80, 0.15, 2, 0.008);
  parapetGeo.setAttribute('uv2', parapetGeo.attributes.uv);
  const parapet = new THREE.Mesh(parapetGeo, mats.balconyParapet);
  parapet.position.set(0, 0.40, BALCONY.railZ - 0.01);
  parapet.castShadow = true;
  parapet.receiveShadow = true;
  root.add(parapet);

  // Aluminum coping cap on top of concrete parapet
  const coping = new THREE.Mesh(
    new RoundedBoxGeometry(3.82, 0.036, 0.178, 2, 0.006),
    mats.aluminum
  );
  coping.position.set(0, 0.818, BALCONY.railZ - 0.01);
  coping.castShadow = true;
  coping.receiveShadow = true;
  root.add(coping);

  // 3. Gleaming brushed aluminum handrail (手すり) — oval ergonomic profile
  const railGroup = new THREE.Group();
  root.add(railGroup);

  const mainRail = new THREE.Mesh(
    new THREE.CylinderGeometry(BALCONY.railRadius, BALCONY.railRadius, 3.78, 24),
    mats.aluminum
  );
  mainRail.rotation.z = Math.PI / 2;
  mainRail.scale.set(1.0, 1.0, 1.35);
  mainRail.position.set(0, BALCONY.railY, BALCONY.railZ);
  mainRail.castShadow = true;
  mainRail.receiveShadow = true;
  railGroup.add(mainRail);

  // Merge static aluminum rail parts (lower bar + vertical posts + flanges) into 1 draw call
  const railStaticParts = [];
  const midBarGeo = new THREE.CylinderGeometry(0.012, 0.012, 3.76, 14);
  midBarGeo.rotateZ(Math.PI / 2);
  midBarGeo.translate(0, 0.92, BALCONY.railZ);
  railStaticParts.push(midBarGeo);

  const postXs = [-1.62, -1.04, -0.42, 0.42, 1.04, 1.62];
  for (const px of postXs) {
    const postGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.22, 14);
    postGeo.translate(px, 0.93, BALCONY.railZ);
    railStaticParts.push(postGeo);

    const flangeGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.018, 14);
    flangeGeo.translate(px, 0.838, BALCONY.railZ);
    railStaticParts.push(flangeGeo);
  }
  const mergedRailSupports = new THREE.Mesh(safeMerge(railStaticParts), mats.aluminum);
  mergedRailSupports.castShadow = true;
  mergedRailSupports.receiveShadow = true;
  railGroup.add(mergedRailSupports);

  // Rail interactive hitbox (for lifting futon onto rail or tapping rail with beater)
  const railHit = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.28, 0.28),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  railHit.position.set(0, BALCONY.railY, BALCONY.railZ);
  railHit.userData.interactiveType = 'rail';
  railGroup.add(railHit);
  interactables.push(railHit);

  // 4. Left apartment concrete wall & right low sunlit partition (allows warm morning sun to pour across balcony & tatami!)
  const leftWallGeo = new THREE.BoxGeometry(0.18, 2.75, 1.65);
  leftWallGeo.setAttribute('uv2', leftWallGeo.attributes.uv);
  const leftWall = new THREE.Mesh(leftWallGeo, mats.balconyParapet);
  leftWall.position.set(-1.86, 1.35, -0.18);
  leftWall.receiveShadow = true;
  leftWall.castShadow = true;
  root.add(leftWall);

  // Right balcony low concrete privacy curb (keeps right side open to bright morning sun!)
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.12, 1.55),
    mats.balconyParapet
  );
  rightWall.position.set(1.86, 0.56, -0.18);
  rightWall.receiveShadow = true;
  root.add(rightWall);

  // Exterior rain downpipe on far left corner
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 2.7, 14),
    mats.darkSash
  );
  pipe.position.set(-1.70, 1.35, -0.52);
  pipe.castShadow = true;
  root.add(pipe);

  // 5. Japanese stainless laundry pole (物干し竿) & left wall bracket
  const laundryPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 3.6, 16),
    mats.aluminum
  );
  laundryPole.rotation.z = Math.PI / 2;
  laundryPole.position.set(0, 1.64, -0.34);
  laundryPole.castShadow = true;
  root.add(laundryPole);

  const bracket = new THREE.Mesh(
    new RoundedBoxGeometry(0.06, 0.04, 0.42, 2, 0.005),
    mats.aluminum
  );
  bracket.position.set(-1.72, 1.61, -0.45);
  root.add(bracket);

  // 6. Sliding glass door threshold (アルミサッシ), oak sill & sunlit indoor Tatami room
  // Aluminum track sill
  const sashTrack = new THREE.Mesh(
    new RoundedBoxGeometry(3.6, 0.055, 0.12, 2, 0.005),
    mats.darkSash
  );
  sashTrack.position.set(0, 0.032, BALCONY.sillZ);
  sashTrack.receiveShadow = true;
  root.add(sashTrack);

  // Subtle metallic runner rails inside the sash track
  for (const rz of [-0.025, 0.025]) {
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(3.56, 0.012, 0.008),
      mats.aluminum
    );
    runner.position.set(0, 0.062, BALCONY.sillZ + rz);
    root.add(runner);
  }

  // Left & Right open sliding glass doors framing the balcony opening
  for (const sx of [-1.42, 1.42]) {
    const frameGroup = new THREE.Group();
    frameGroup.position.set(sx, 1.18, BALCONY.sillZ + (sx < 0 ? -0.025 : 0.025));

    const vStyleL = new THREE.Mesh(new THREE.BoxGeometry(0.048, 2.24, 0.034), mats.darkSash);
    vStyleL.position.x = -0.36;
    const vStyleR = new THREE.Mesh(new THREE.BoxGeometry(0.048, 2.24, 0.034), mats.darkSash);
    vStyleR.position.x = 0.36;
    const hTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.055, 0.034), mats.darkSash);
    hTop.position.y = 1.1;
    const hBot = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.065, 0.034), mats.darkSash);
    hBot.position.y = -1.09;

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 2.12), mats.windowGlass);
    frameGroup.add(vStyleL, vStyleR, hTop, hBot, glass);
    root.add(frameGroup);
  }

  // Warm oak wooden veranda-to-room sill (縁側ボード)
  const oakSillGeo = new RoundedBoxGeometry(3.6, 0.072, 0.24, 2, 0.008);
  oakSillGeo.setAttribute('uv2', oakSillGeo.attributes.uv);
  const oakSill = new THREE.Mesh(oakSillGeo, mats.oakWood);
  oakSill.position.set(0, 0.032, 0.57);
  oakSill.receiveShadow = true;
  oakSill.castShadow = true;
  root.add(oakSill);

  // Indoor Sunlit Tatami floor (2 side-by-side mats extending comfortably to Z = 3.55)
  const tatamiGeo = new THREE.BoxGeometry(3.56, 0.068, 2.85);
  tatamiGeo.setAttribute('uv2', tatamiGeo.attributes.uv);
  const tatamiFloor = new THREE.Mesh(tatamiGeo, mats.tatami);
  tatamiFloor.position.set(0, BALCONY.tatamiY - 0.034, 2.10);
  tatamiFloor.receiveShadow = true;
  root.add(tatamiFloor);

  // Authentic woven fabric tatami borders (畳の縁)
  const heriFront = new THREE.Mesh(new THREE.BoxGeometry(3.56, 0.004, 0.036), mats.tatamiHeri);
  heriFront.position.set(0, BALCONY.tatamiY + 0.001, 0.695);
  heriFront.receiveShadow = true;
  root.add(heriFront);

  const heriCenter = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.004, 2.85), mats.tatamiHeri);
  heriCenter.position.set(0, BALCONY.tatamiY + 0.001, 2.10);
  heriCenter.receiveShadow = true;
  root.add(heriCenter);

  // Indoor side walls & warm cream shikkui plaster interior backdrop (well behind portrait indoor camera at Z=3.12!)
  const indoorWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#eee9df'),
    roughness: 0.92,
    metalness: 0.0
  });
  const indoorBackWall = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.8, 0.12), indoorWallMat);
  indoorBackWall.position.set(0, 1.4, 3.65);
  indoorBackWall.receiveShadow = true;
  root.add(indoorBackWall);

  // Low wooden futon duckboard (すのこ) merged into 1 draw call with clean oak wood grain
  const deckParts = [];
  for (let i = -3; i <= 3; i++) {
    const slatGeo = new RoundedBoxGeometry(1.12, 0.022, 0.068, 2, 0.004);
    slatGeo.translate(0, 0.044, 0.06 + i * 0.082);
    deckParts.push(slatGeo);
  }
  for (const bx of [-0.46, 0, 0.46]) {
    const bearerGeo = new THREE.BoxGeometry(0.045, 0.032, 0.54);
    bearerGeo.translate(bx, 0.016, 0.06);
    deckParts.push(bearerGeo);
  }
  const mergedDeckGeo = safeMerge(deckParts);
  mergedDeckGeo.setAttribute('uv2', mergedDeckGeo.attributes.uv);
  const deckMesh = new THREE.Mesh(mergedDeckGeo, mats.oakWood);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  root.add(deckMesh);
  addContactShadow(root, mats.contactShadowTex, 1.32, 0.72, 0, 0.0, 0.06, 0.36);

  // Indoor tatami contact shadow (fades in when futon is brought indoors)
  const indoorFutonShadow = addContactShadow(
    root,
    mats.contactShadowTex,
    1.55,
    1.95,
    0,
    BALCONY.tatamiY,
    BALCONY.indoorCenterZ,
    0.0
  );

  // 7. Interactive Futon Clips (ふとんばさみ) on left & right of railing
  const clipLeft = createFutonClip(mats, -1);
  const clipRight = createFutonClip(mats, 1);
  root.add(clipLeft, clipRight);
  interactables.push(
    clipLeft.children[clipLeft.children.length - 1],
    clipRight.children[clipRight.children.length - 1]
  );

  // 8. Interactive Glass Wind Chime (風鈴)
  const windChime = createWindChime(mats);
  root.add(windChime);
  interactables.push(windChime.children[windChime.children.length - 1]);

  // 9. Realistic crisp sunlit blue sky & soft hazy distant mountain/horizon band (NO primitive toy houses!)
  // A subtle distant atmospheric horizon ring blends smoothly into the Poly Haven Pure Sky HDRI
  const horizonCanvas = document.createElement('canvas');
  horizonCanvas.width = 512;
  horizonCanvas.height = 128;
  const hctx = horizonCanvas.getContext('2d');
  const hgrad = hctx.createLinearGradient(0, 0, 0, 128);
  hgrad.addColorStop(0.0, 'rgba(195, 224, 248, 0.0)');
  hgrad.addColorStop(0.45, 'rgba(202, 226, 245, 0.55)');
  hgrad.addColorStop(0.68, 'rgba(166, 194, 218, 0.85)');
  hgrad.addColorStop(1.0, 'rgba(146, 172, 194, 0.96)');
  hctx.fillStyle = hgrad;
  hctx.fillRect(0, 0, 512, 128);
  // Subtle distant soft mountain ridge silhouette in atmospheric perspective (photographic haze, very gentle)
  hctx.fillStyle = 'rgba(135, 162, 188, 0.35)';
  hctx.beginPath();
  hctx.moveTo(0, 128);
  for (let x = 0; x <= 512; x += 8) {
    const t = (x / 512) * Math.PI * 2;
    const ridge = 78 + Math.sin(t * 2.0 + 0.5) * 10 + Math.sin(t * 5.0) * 4 + Math.cos(t * 9.0) * 2;
    hctx.lineTo(x, ridge);
  }
  hctx.lineTo(512, 128);
  hctx.closePath();
  hctx.fill();

  const horizonTex = new THREE.CanvasTexture(horizonCanvas);
  horizonTex.colorSpace = THREE.SRGBColorSpace;
  const horizonBand = new THREE.Mesh(
    new THREE.CylinderGeometry(36, 36, 14, 32, 1, true),
    new THREE.MeshBasicMaterial({
      map: horizonTex,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    })
  );
  horizonBand.position.set(0, -1.6, 0);
  root.add(horizonBand);

  // 10. Load Poly Haven CC0 3D models: Potted Plant 04 (left) & Folding Wooden Stool (right)
  const gltfLoader = new GLTFLoader();
  const loadedProps = { plant: null, stool: null };

  const plantPromise = new Promise((resolve) => {
    gltfLoader.load(
      './assets/models/potted_plant_04/potted_plant_04_1k.gltf',
      (gltf) => {
        const plant = gltf.scene;
        plant.scale.setScalar(1.05);
        plant.position.set(-1.12, 0.0, -0.34);
        plant.rotation.y = 0.55;
        plant.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        root.add(plant);
        addContactShadow(root, mats.contactShadowTex, 0.56, 0.56, -1.12, 0.0, -0.34, 0.48);
        loadedProps.plant = plant;
        resolve(plant);
      },
      undefined,
      () => resolve(null)
    );
  });

  const stoolPromise = new Promise((resolve) => {
    gltfLoader.load(
      './assets/models/folding_wooden_stool/folding_wooden_stool_1k.gltf',
      (gltf) => {
        const stool = gltf.scene;
        stool.scale.setScalar(0.95);
        stool.position.set(0.96, 0.0, -0.26);
        stool.rotation.y = -0.38;
        stool.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        root.add(stool);
        addContactShadow(root, mats.contactShadowTex, 0.58, 0.52, 0.96, 0.0, -0.26, 0.46);
        loadedProps.stool = stool;
        resolve(stool);
      },
      undefined,
      () => resolve(null)
    );
  });

  // Rail vibration state when tapped with beater
  const railState = { shake: 0 };

  function triggerRailShake() {
    railState.shake = 1.0;
  }

  function triggerChime(impulse = 0.45) {
    windChime.userData.velZ += impulse * (Math.random() > 0.5 ? 1 : -1);
    windChime.userData.velX += impulse * 0.4;
  }

  function toggleClip(clipGroup, canClamp) {
    clipGroup.userData.openAnim = 1.0;
    if (canClamp) {
      clipGroup.userData.clamped = !clipGroup.userData.clamped;
    } else {
      clipGroup.userData.clamped = false;
    }
    return clipGroup.userData.clamped;
  }

  function releaseClips() {
    for (const c of [clipLeft, clipRight]) {
      if (c.userData.clamped) {
        c.userData.clamped = false;
        c.userData.openAnim = 0.8;
      }
    }
  }

  function update(dt, elapsed) {
    // Subtle aluminum handrail vibration decay
    if (railState.shake > 0.001) {
      railState.shake = Math.max(0, railState.shake - dt * 5.2);
      mainRail.position.y = BALCONY.railY + Math.sin(elapsed * 85) * 0.003 * railState.shake;
    } else {
      mainRail.position.y = BALCONY.railY;
    }

    // Wind chime gentle pendulum physics + outdoor breeze
    const breeze = Math.sin(elapsed * 1.1) * 0.03 + Math.sin(elapsed * 2.3) * 0.015;
    const ch = windChime.userData;
    const k = 14.0;
    const damp = 1.15;
    ch.velZ += (-k * (ch.angleZ - breeze) - damp * ch.velZ) * dt;
    ch.velX += (-k * (ch.angleX - breeze * 0.4) - damp * ch.velX) * dt;
    ch.angleZ += ch.velZ * dt;
    ch.angleX += ch.velX * dt;
    windChime.rotation.z = ch.angleZ;
    windChime.rotation.x = ch.angleX;

    // Futon clips smooth slide & jaw open/close animation
    for (const clip of [clipLeft, clipRight]) {
      const ud = clip.userData;
      const targetX = ud.clamped ? ud.clampX : ud.restX;
      ud.currentX += (targetX - ud.currentX) * Math.min(1, dt * 10);
      clip.position.x = ud.currentX;

      if (ud.openAnim > 0) {
        ud.openAnim = Math.max(0, ud.openAnim - dt * 4.5);
      }
      const spread = Math.sin(ud.openAnim * Math.PI) * 0.34 + (ud.clamped ? 0.08 : 0.0);
      ud.jawFront.rotation.x = -spread;
      ud.jawBack.rotation.x = spread;
    }

    // Subtle living breeze sway on potted plant leaves
    if (loadedProps.plant) {
      loadedProps.plant.rotation.z = Math.sin(elapsed * 1.35) * 0.012;
    }
  }

  return {
    root,
    interactables,
    clips: [clipLeft, clipRight],
    windChime,
    indoorFutonShadow,
    ready: Promise.all([plantPromise, stoolPromise]),
    triggerRailShake,
    triggerChime,
    toggleClip,
    releaseClips,
    update
  };
}
