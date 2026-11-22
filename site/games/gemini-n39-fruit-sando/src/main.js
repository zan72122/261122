import * as THREE from 'three';
import { SoundFX } from './audio.js';
import { createMorningWindowEnv, MORNING_SUN_DIR } from './materials.js';
import { MacroPostProcessor } from './postprocess.js';
import {
  BREAD_SIZE,
  BREAD_THICK,
  createMaterialLibrary,
  createBreadSlice,
  createCreamBed,
  createStrawberry,
  createKiwiPiece,
  createMikan,
  createSlicedSandwichHalf,
  createSpatula,
  createKnife,
  createRealisticHand,
  createKitchenEnvironment,
} from './models.js';

const container = document.getElementById('app');

// Renderer setup (mobile-optimized: pixelRatio <= 1.5, soft shadows, linear HDR into post-process)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // Handled in our Food-CM post-process pass!
container.appendChild(renderer.domElement);

// Scene & Macro Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcab69c);
scene.fog = new THREE.FogExp2(0xd8c6ad, 0.024);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.25, 32);
camera.position.set(0.08, 3.2, 5.4);
camera.lookAt(0.05, 0.42, -0.05);

// Procedural HDR Morning Window Environment
const envMap = createMorningWindowEnv(renderer);
scene.environment = envMap;

// Lighting Rig: Physically Balanced Japanese Food-CM Backlight + Cool Sky Fill + Soft Front Reflector
const sunLight = new THREE.DirectionalLight(0xffe9c2, 2.05);
sunLight.position.copy(MORNING_SUN_DIR).multiplyScalar(11.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 2.0;
sunLight.shadow.camera.far = 22.0;
sunLight.shadow.camera.left = -5.2;
sunLight.shadow.camera.right = 5.2;
sunLight.shadow.camera.top = 5.2;
sunLight.shadow.camera.bottom = -5.2;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.022;
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(0xcfe0f5, 0x9c7f5c, 0.52);
scene.add(hemiLight);

// Soft warm front-right studio foamcore reflector (lifts fruit detail cleanly while preserving rich creamy shadows!)
const bounceLight = new THREE.DirectionalLight(0xfff1dc, 0.46);
bounceLight.position.set(4.5, 3.4, 6.2);
scene.add(bounceLight);

// Delicate warm rim kicker from rear-right for juicy wet edges
const rimLight = new THREE.DirectionalLight(0xffdca6, 0.62);
rimLight.position.set(3.8, 3.0, -6.5);
scene.add(rimLight);

// Post-processing: Optical Macro Bokeh DoF + Morning Window Bloom + High-Sat Food-CM Grading
const post = new MacroPostProcessor(
  renderer,
  Math.floor(window.innerWidth * renderer.getPixelRatio()),
  Math.floor(window.innerHeight * renderer.getPixelRatio())
);

// Materials, Environment, Audio
const sfx = new SoundFX();
const mats = createMaterialLibrary();
const kitchen = createKitchenEnvironment(mats);
scene.add(kitchen.env);

// ============================================================
// WORKSPACE STAGE OBJECTS
// ============================================================
const workOrigin = new THREE.Vector3(-0.15, 0.02, 0.05);

// Bottom Shokupan Bread
const bottomBread = createBreadSlice(mats);
bottomBread.position.set(workOrigin.x, workOrigin.y + BREAD_THICK * 0.5, workOrigin.z);
scene.add(bottomBread);

// Dynamic Sculptable Whipped Cream Bed
const creamBed = createCreamBed(mats);
creamBed.group.position.set(workOrigin.x, workOrigin.y + BREAD_THICK, workOrigin.z);
scene.add(creamBed.group);

// Waiting Top Shokupan Bread (rests warmly at upper-left until 2+ fruits are placed, then invites!)
const topBreadRestPos = new THREE.Vector3(-2.35, workOrigin.y + BREAD_THICK * 0.5, -1.55);
const topBreadInvitePos = new THREE.Vector3(-2.05, workOrigin.y + BREAD_THICK * 0.5 + 0.08, -1.18);
const topBread = createBreadSlice(mats);
topBread.position.copy(topBreadRestPos);
topBread.rotation.y = 0.14;
scene.add(topBread);

// Spatula (rests angled invitingly between cream bowl and bread)
const spatula = createSpatula(mats);
const spatulaRestPos = new THREE.Vector3(-1.35, 0.72, 0.45);
spatula.position.copy(spatulaRestPos);
spatula.rotation.set(0.12, 0.35, -0.35);
scene.add(spatula);

// Gleaming Japanese Fruit-Sando Knife (rests behind board until SLICE stage)
const knife = createKnife(mats);
const knifeRestPos = new THREE.Vector3(0.45, 0.24, -1.78);
knife.position.copy(knifeRestPos);
knife.rotation.set(0, -0.06, 0);
scene.add(knife);

// Photorealistic 3D Hand
const hand = createRealisticHand(mats);
const handHomePos = new THREE.Vector3(3.9, 2.35, 1.85);
hand.root.position.copy(handHomePos);
scene.add(hand.root);

// Placed fruits container
const placedFruitsGroup = new THREE.Group();
scene.add(placedFruitsGroup);

// Sliced Sandwich Halves container (Stage REVEAL)
const slicedGroup = new THREE.Group();
scene.add(slicedGroup);

// ============================================================
// FRUIT DISH SUPPLY (Strawberry, Kiwi, Mikan — always plump & inviting!)
// ============================================================
const traySlots = [
  { type: 'strawberry', pos: new THREE.Vector3(2.26, 0.52, -0.34), rotY: 0.35, scale: 1.05, mesh: null, pulsePhase: 0 },
  { type: 'kiwi', pos: new THREE.Vector3(2.58, 0.32, 0.34), rotY: -0.25, scale: 1.08, mesh: null, pulsePhase: 1.8 },
  { type: 'mikan', pos: new THREE.Vector3(2.14, 0.44, 0.94), rotY: 0.55, scale: 1.0, mesh: null, pulsePhase: 3.6 },
  { type: 'strawberry', pos: new THREE.Vector3(2.74, 0.5, -0.18), rotY: -0.45, scale: 0.96, mesh: null, pulsePhase: 0.8 },
  { type: 'kiwi', pos: new THREE.Vector3(1.98, 0.32, 0.14), rotY: 0.4, scale: 0.96, mesh: null, pulsePhase: 2.5 },
];

function createFruitByType(type, scale = 1.0) {
  if (type === 'strawberry') return createStrawberry(mats, scale);
  if (type === 'kiwi') return createKiwiPiece(mats, scale);
  return createMikan(mats, scale);
}

function populateTray() {
  for (const slot of traySlots) {
    if (!slot.mesh) {
      const m = createFruitByType(slot.type, slot.scale);
      m.position.copy(slot.pos);
      m.rotation.y = slot.rotY;
      if (slot.type === 'strawberry') m.rotation.z = 0.25;
      m.userData.traySlot = slot;
      scene.add(m);
      slot.mesh = m;
    }
  }
}
populateTray();

// ============================================================
// SUNLIT LENS SPARKLES & TRANSLUCENT JUICE MIST (Photographic, zero cartoon balls!)
// ============================================================
const particles = [];
const sparkSpriteMats = {
  cream: new THREE.SpriteMaterial({ map: mats.bokehTex, color: 0xfffaf0, transparent: true, opacity: 0.62, depthWrite: false }),
  strawberry: new THREE.SpriteMaterial({ map: mats.bokehTex, color: 0xffb8be, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
  kiwi: new THREE.SpriteMaterial({ map: mats.bokehTex, color: 0xd8ff96, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false }),
  mikan: new THREE.SpriteMaterial({ map: mats.bokehTex, color: 0xffd680, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
  sun: new THREE.SpriteMaterial({ map: mats.bokehTex, color: 0xfff2c2, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }),
};

function spawnBurst(pos, kind = 'sun', count = 10, speed = 1.6) {
  const mat = sparkSpriteMats[kind] || sparkSpriteMats.sun;
  for (let i = 0; i < count; i++) {
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    const up = 0.5 + Math.random() * 1.1;
    const rad = (0.3 + Math.random() * 0.7) * speed;
    const sc = 0.08 + Math.random() * 0.14;
    sp.scale.set(sc, sc, 1);
    scene.add(sp);
    particles.push({
      mesh: sp,
      vel: new THREE.Vector3(Math.cos(a) * rad, up * speed * 0.6, Math.sin(a) * rad),
      life: 0,
      maxLife: 0.45 + Math.random() * 0.4,
      baseScale: sc,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 2.8 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const t = 1 - p.life / p.maxLife;
    p.mesh.scale.set(p.baseScale * t, p.baseScale * t, 1);
  }
}

// ============================================================
// GAME STATE MACHINE
// Stages: 'SPREAD' -> 'FRUIT' -> 'SANDWICH' -> 'PRESS' -> 'SLICE' -> 'REVEAL'
// ============================================================
const state = {
  stage: 'SPREAD',
  time: 0,
  stageTime: 0,
  idleTime: 0,
  idleHintActive: false,
  idleHintT: 0,
  placedFruits: [], // { type, x, z, mesh, bounceT }
  draggingFruit: null, // { type, mesh, sourceSlot }
  draggingTopBread: false,
  slicing: false,
  sliceProgress: 0, // 0..1
  pressCount: 0,
  pressSquish: 0,
  revealOrbit: 0,
  revealTargetOrbit: 0,
  revealOpenT: 0,
  leftHalf: null,
  rightHalf: null,
  completedCount: 0,
  wobbles: new Map(), // mesh -> { t, amp }
  activePointerId: null,
  pointerDown: false,
  pointerMoved: false,
  pointerDownPos: new THREE.Vector2(),
  lastPointerWorld: new THREE.Vector3(),
  handTargetPos: handHomePos.clone(),
  handVisible: true,
  cameraPos: new THREE.Vector3(0.0, 5.0, 4.75),
  cameraLook: new THREE.Vector3(0.05, 0.25, 0.08),
  focusDist: 6.4,
  focusRange: 2.8,
  maxBlur: 17.5,
  nextBreadReady: false,
};

function triggerWobble(obj, amp = 0.14) {
  state.wobbles.set(obj, { t: 0, amp });
}

function setStage(next) {
  state.stage = next;
  state.stageTime = 0;
  state.idleTime = 0;
  state.idleHintActive = false;
  if (next === 'SPREAD') {
    hand.setPose('spatula');
  } else if (next === 'FRUIT') {
    hand.setPose('idle');
  } else if (next === 'SANDWICH') {
    hand.setPose('idle');
  } else if (next === 'PRESS') {
    hand.setPose('press');
  } else if (next === 'SLICE') {
    hand.setPose('knife');
    state.sliceProgress = 0;
  } else if (next === 'REVEAL') {
    hand.setPose('idle');
    state.revealOpenT = 0;
    state.revealOrbit = 0;
    state.revealTargetOrbit = 0;
    state.nextBreadReady = false;
  }
}

// ============================================================
// RAYCASTING & COORDINATE MAPPING
// ============================================================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(workOrigin.y + BREAD_THICK + 0.18));
const tempHit = new THREE.Vector3();

function updateRay(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

function getWorkPlanePoint(clientX, clientY, targetY = workOrigin.y + BREAD_THICK + 0.12) {
  updateRay(clientX, clientY);
  workPlane.constant = -targetY;
  if (raycaster.ray.intersectPlane(workPlane, tempHit)) {
    return tempHit.clone();
  }
  return null;
}

function isOverBread(pt, margin = 0.25) {
  if (!pt) return false;
  const half = BREAD_SIZE * 0.5 + margin;
  return Math.abs(pt.x - workOrigin.x) <= half && Math.abs(pt.z - workOrigin.z) <= half;
}

// Pick nearest tray fruit within generous 5-year-old touch radius
function hitTestTrayFruit(clientX, clientY) {
  updateRay(clientX, clientY);
  const meshes = traySlots.map((s) => s.mesh).filter(Boolean);
  const hits = raycaster.intersectObjects(meshes, true);
  if (hits.length > 0) {
    let cur = hits[0].object;
    while (cur && !cur.userData.traySlot) cur = cur.parent;
    if (cur && cur.userData.traySlot) return cur.userData.traySlot;
  }
  // Generous proximity fallback on plane
  const pt = getWorkPlanePoint(clientX, clientY, 0.38);
  if (pt) {
    let best = null;
    let bestD = 0.62;
    for (const s of traySlots) {
      if (!s.mesh) continue;
      const d = Math.hypot(pt.x - s.pos.x, pt.z - s.pos.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }
  return null;
}

function hitTestObject(clientX, clientY, obj) {
  updateRay(clientX, clientY);
  return raycaster.intersectObject(obj, true).length > 0;
}

// ============================================================
// CORE GAMEPLAY ACTIONS
// ============================================================
function placeFruitOnBread(type, worldX, worldZ) {
  // Clamp onto bread & softly attract toward the center cutting plane (z ~ workOrigin.z)
  // so ANY placement by a 5-year-old looks gorgeous in the cut cross-section while preserving their horizontal layout!
  const half = BREAD_SIZE * 0.38;
  let lx = THREE.MathUtils.clamp(worldX - workOrigin.x, -half, half);
  let lz = THREE.MathUtils.clamp(worldZ - workOrigin.z, -half * 0.72, half * 0.72);
  // Gentle magnetic pull toward center slice axis
  lz *= 0.48;

  // Avoid exact overlap with existing fruits
  for (const existing of state.placedFruits) {
    const dx = lx - existing.x;
    const dz = lz - existing.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.44) {
      lx = THREE.MathUtils.clamp(lx + (dx >= 0 ? 0.36 : -0.36), -half, half);
    }
  }

  const mesh = createFruitByType(type, type === 'mikan' ? 1.04 : 1.08);
  const yBase = workOrigin.y + BREAD_THICK + 0.3 + (type === 'strawberry' ? 0.2 : type === 'mikan' ? 0.12 : 0.04);
  mesh.position.set(workOrigin.x + lx, yBase, workOrigin.z + lz);
  if (type === 'strawberry') {
    mesh.rotation.z = -lx * 0.28;
    mesh.rotation.x = 0.08;
  } else if (type === 'kiwi') {
    mesh.rotation.y = (Math.random() - 0.5) * 1.2;
  }
  placedFruitsGroup.add(mesh);

  // Physically dimple & puff the cream bed right where the fruit landed!
  creamBed.nestFruit(lx, lz, type === 'mikan' ? 0.48 : 0.4);

  const entry = { type, x: lx, z: lz, mesh, bounceT: 0, baseY: yBase };
  state.placedFruits.push(entry);

  const pitch = type === 'strawberry' ? 1.15 : type === 'kiwi' ? 1.0 : 0.85;
  sfx.playFruitPlop(pitch);
  spawnBurst(mesh.position.clone().add(new THREE.Vector3(0, 0.2, 0)), type, 11, 1.85);
  spawnBurst(mesh.position.clone(), 'cream', 6, 1.3);

  // Cap at 6 fruits, or automatically invite top bread once 2+ fruits are placed!
  if (state.placedFruits.length >= 2 && state.stage === 'FRUIT') {
    // Keep allowing more fruits, while top bread rises into inviting view!
    // (In pointerdown, tapping/dragging topBread immediately triggers SANDWICH -> PRESS!)
  }
  if (state.placedFruits.length >= 6) {
    triggerSandwichCover();
  }
}

function getAutoNextFruitSpot() {
  // Smart pleasing floral arrangement spots for kids who tap fruits instead of dragging!
  const spots = [
    [0.0, 0.0],
    [-0.58, 0.04],
    [0.58, -0.04],
    [-0.28, -0.22],
    [0.32, 0.22],
    [0.0, 0.26],
  ];
  const idx = state.placedFruits.length % spots.length;
  return { x: workOrigin.x + spots[idx][0], z: workOrigin.z + spots[idx][1] };
}

function triggerSandwichCover() {
  if (state.stage !== 'FRUIT' && state.stage !== 'SANDWICH') return;
  creamBed.fillBlanket();
  creamBed.oozeGroup.visible = true;
  creamBed.oozeGroup.position.y = 0.38;
  sfx.playCreamSpread(1.4);
  spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.9, workOrigin.z), 'cream', 14, 1.8);
  setStage('PRESS');
  state.pressCount = 0;
  state.pressSquish = 0;
}

function performPressSquish() {
  state.pressCount++;
  state.pressSquish = 1.0;
  sfx.playBreadSquish();
  spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.72, workOrigin.z + 0.85), 'cream', 10, 1.5);
  spawnBurst(new THREE.Vector3(workOrigin.x + 0.85, workOrigin.y + 0.72, workOrigin.z), 'cream', 8, 1.5);

  if (state.pressCount >= 1) {
    // Smoothly transition to the big SLICE stage after the satisfying squish!
    setTimeout(() => {
      if (state.stage === 'PRESS') {
        setStage('SLICE');
      }
    }, 520);
  }
}

function completeSliceAndReveal() {
  if (state.stage === 'REVEAL') return;
  sfx.playFlowerReveal();

  // Hide whole sandwich components & reveal the two glistening 3D Flower Cross-Section halves!
  bottomBread.visible = false;
  topBread.visible = false;
  creamBed.group.visible = false;
  placedFruitsGroup.visible = false;
  knife.userData.creamSmear.visible = true;

  // Clean previous sliced halves
  while (slicedGroup.children.length) slicedGroup.remove(slicedGroup.children[0]);

  const avgCream = creamBed.getAverageThickness();
  const leftHalf = createSlicedSandwichHalf(mats, {
    fruits: state.placedFruits,
    creamThickness: avgCream,
    mirrorX: false,
  });
  const rightHalf = createSlicedSandwichHalf(mats, {
    fruits: state.placedFruits,
    creamThickness: avgCream,
    mirrorX: true,
  });

  // Start pressed together at the cut seam, then smoothly part & tilt open toward the macro camera!
  leftHalf.position.set(workOrigin.x, workOrigin.y + 0.02, workOrigin.z);
  rightHalf.position.set(workOrigin.x, workOrigin.y + 0.02, workOrigin.z);
  rightHalf.rotation.y = Math.PI;

  slicedGroup.add(leftHalf, rightHalf);
  state.leftHalf = leftHalf;
  state.rightHalf = rightHalf;

  // Radiant sunlit juice & sparkle bloom!
  spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.85, workOrigin.z + 0.2), 'sun', 18, 2.3);
  spawnBurst(new THREE.Vector3(workOrigin.x - 0.3, workOrigin.y + 0.75, workOrigin.z + 0.15), 'strawberry', 8, 1.9);
  spawnBurst(new THREE.Vector3(workOrigin.x + 0.3, workOrigin.y + 0.75, workOrigin.z + 0.15), 'kiwi', 8, 1.9);

  setStage('REVEAL');
}

function addKeepsakeToStand() {
  const mini = createSlicedSandwichHalf(mats, {
    fruits: state.placedFruits,
    creamThickness: creamBed.getAverageThickness(),
    mirrorX: false,
  });
  const idx = state.completedCount;
  const angle = idx * 1.45;
  const rad = idx === 0 ? 0.0 : Math.min(0.62, 0.36 + (idx % 3) * 0.12);
  mini.scale.setScalar(0.32);
  mini.position.set(Math.cos(angle) * rad, 0.02 + Math.floor(idx / 5) * 0.36, Math.sin(angle) * rad);
  mini.rotation.y = -0.35 + (idx % 3 - 1) * 0.28;
  kitchen.keepsakeSlots.add(mini);
  state.completedCount++;
}

function startNextRound() {
  addKeepsakeToStand();

  // Clear sliced halves & placed fruits
  while (slicedGroup.children.length) slicedGroup.remove(slicedGroup.children[0]);
  while (placedFruitsGroup.children.length) placedFruitsGroup.remove(placedFruitsGroup.children[0]);
  state.placedFruits = [];
  state.leftHalf = null;
  state.rightHalf = null;

  // Restore fresh shokupan bread, clean cream bed, gleaming knife
  bottomBread.visible = true;
  topBread.visible = true;
  topBread.position.copy(topBreadRestPos);
  topBread.rotation.set(0, 0.14, 0);
  topBread.scale.set(1, 1, 1);

  creamBed.group.visible = true;
  creamBed.reset();

  placedFruitsGroup.visible = true;
  knife.userData.creamSmear.visible = false;
  knife.position.copy(knifeRestPos);
  knife.rotation.set(0, -0.06, 0);

  sfx.playFruitPlop(1.2);
  spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.5, workOrigin.z), 'sun', 12, 1.7);
  setStage('SPREAD');
}

// ============================================================
// ONE-FINGER POINTER INTERACTION (Touch & Mouse, Multi-Touch Safe)
// ============================================================
function onPointerDown(e) {
  if (state.activePointerId !== null) return; // Ignore extra fingers safely!
  state.activePointerId = e.pointerId;
  state.pointerDown = true;
  state.pointerMoved = false;
  state.pointerDownPos.set(e.clientX, e.clientY);
  state.idleTime = 0;
  state.idleHintActive = false;

  sfx.unlock();

  const pt = getWorkPlanePoint(e.clientX, e.clientY);
  if (pt) state.lastPointerWorld.copy(pt);

  // Stage-specific primary interactions (obeying: current stage gets full reaction, others gently wobble!)
  if (state.stage === 'SPREAD') {
    // Allow touching bread or cream bowl to spread whipped cream
    if (isOverBread(pt, 0.32) || hitTestObject(e.clientX, e.clientY, kitchen.creamBowl)) {
      if (pt && isOverBread(pt, 0.15)) {
        creamBed.paint(pt.x - workOrigin.x, pt.z - workOrigin.z, 0.62, 0.16, 1, 0);
        sfx.playCreamSpread(1.0);
        spawnBurst(new THREE.Vector3(pt.x, workOrigin.y + 0.45, pt.z), 'cream', 4, 1.0);
      }
      return;
    }
    // Check if child poked a fruit on tray (gentle wobble + soft sound, NOT full activation yet)
    const slot = hitTestTrayFruit(e.clientX, e.clientY);
    if (slot && slot.mesh) {
      triggerWobble(slot.mesh, 0.18);
      sfx.playGentleTap('fruit');
      return;
    }
    if (hitTestObject(e.clientX, e.clientY, knife)) {
      triggerWobble(knife, 0.08);
      sfx.playGentleTap('metal');
      return;
    }
    sfx.playGentleTap('wood');
    return;
  }

  if (state.stage === 'FRUIT') {
    // 1. Check if child grabbed/tapped a fruit on the ceramic dish!
    const slot = hitTestTrayFruit(e.clientX, e.clientY);
    if (slot && slot.mesh) {
      const ghost = createFruitByType(slot.type, slot.scale * 1.08);
      ghost.position.copy(slot.pos).add(new THREE.Vector3(0, 0.45, 0));
      scene.add(ghost);
      state.draggingFruit = { type: slot.type, mesh: ghost, sourceSlot: slot };
      hand.setPose('pinch');
      triggerWobble(slot.mesh, 0.22);
      sfx.playGentleTap('fruit');
      return;
    }

    // 2. If 2+ fruits placed, check if child grabbed/tapped the inviting waiting top bread slice!
    if (state.placedFruits.length >= 2 && hitTestObject(e.clientX, e.clientY, topBread)) {
      state.draggingTopBread = true;
      hand.setPose('press');
      sfx.playGentleTap('wood');
      return;
    }

    // 3. Poking cream bowl lets them add a playful dab of extra cream!
    if (hitTestObject(e.clientX, e.clientY, kitchen.creamBowl)) {
      triggerWobble(kitchen.creamBowl, 0.1);
      sfx.playCreamSpread(0.8);
      return;
    }

    // 4. Poking an already-placed fruit on the bread makes it happily bounce & jiggle!
    for (const pf of state.placedFruits) {
      if (hitTestObject(e.clientX, e.clientY, pf.mesh)) {
        pf.bounceT = 0;
        triggerWobble(pf.mesh, 0.2);
        sfx.playFruitPlop(1.25);
        spawnBurst(pf.mesh.position.clone().add(new THREE.Vector3(0, 0.2, 0)), pf.type, 5, 1.2);
        return;
      }
    }

    // 5. Swiping bread still adds soft extra cream swirls if desired!
    if (isOverBread(pt, 0.15)) {
      creamBed.paint(pt.x - workOrigin.x, pt.z - workOrigin.z, 0.54, 0.1, 1, 0);
      sfx.playCreamSpread(0.8);
      return;
    }

    sfx.playGentleTap('wood');
    return;
  }

  if (state.stage === 'PRESS') {
    if (isOverBread(pt, 0.55) || hitTestObject(e.clientX, e.clientY, topBread)) {
      performPressSquish();
    } else {
      sfx.playGentleTap('wood');
    }
    return;
  }

  if (state.stage === 'SLICE') {
    if (isOverBread(pt, 0.75) || hitTestObject(e.clientX, e.clientY, knife)) {
      state.slicing = true;
      sfx.playSliceStroke(state.sliceProgress);
    } else {
      sfx.playGentleTap('metal');
    }
    return;
  }

  if (state.stage === 'REVEAL') {
    // Only start next round via waiting fresh bread if the tap didn't land on either sandwich half!
    const onLeft = state.leftHalf && state.leftHalf.visible && hitTestObject(e.clientX, e.clientY, state.leftHalf);
    const onRight = state.rightHalf && state.rightHalf.visible && hitTestObject(e.clientX, e.clientY, state.rightHalf);
    if (!onLeft && !onRight && state.nextBreadReady && hitTestObject(e.clientX, e.clientY, topBread)) {
      startNextRound();
      return;
    }
    // Tap left or right sandwich half to take a delicious bite (handled on pointerup if not drag-orbit!)
  }
}

function onPointerMove(e) {
  if (e.pointerId !== state.activePointerId || !state.pointerDown) return;
  const distPx = Math.hypot(e.clientX - state.pointerDownPos.x, e.clientY - state.pointerDownPos.y);
  if (distPx > 10) state.pointerMoved = true;

  state.idleTime = 0;

  const pt = getWorkPlanePoint(e.clientX, e.clientY);

  if (state.stage === 'SPREAD' && pt) {
    const dx = pt.x - state.lastPointerWorld.x;
    const dz = pt.z - state.lastPointerWorld.z;
    const step = Math.hypot(dx, dz);
    if (isOverBread(pt, 0.28) && step > 0.025) {
      const len = Math.max(step, 0.001);
      creamBed.paint(pt.x - workOrigin.x, pt.z - workOrigin.z, 0.62, Math.min(0.16, 0.06 + step * 0.22), dx / len, dz / len);
      sfx.playCreamSpread(Math.min(2.0, step * 8.0));
      if (Math.random() < 0.32) {
        spawnBurst(new THREE.Vector3(pt.x, workOrigin.y + 0.45, pt.z), 'cream', 2, 0.85);
      }
      // Smoothly move spatula & realistic hand with finger!
      state.handTargetPos.set(pt.x + 1.15, 0.85, pt.z + 0.12);

      // Check if bread is lushly covered with whipped cream -> gently progress to FRUIT stage!
      if (creamBed.getCoverage() >= 0.44) {
        spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.6, workOrigin.z), 'sun', 10, 1.6);
        setStage('FRUIT');
      }
    }
    state.lastPointerWorld.copy(pt);
    return;
  }

  if (state.stage === 'FRUIT' && pt) {
    if (state.draggingFruit) {
      state.draggingFruit.mesh.position.lerp(new THREE.Vector3(pt.x, workOrigin.y + 0.92, pt.z), 0.55);
      state.handTargetPos.set(pt.x + 0.82, workOrigin.y + 1.38, pt.z + 0.14);
    } else if (state.draggingTopBread) {
      topBread.position.lerp(new THREE.Vector3(pt.x, workOrigin.y + 1.25, pt.z), 0.45);
      state.handTargetPos.set(pt.x + 0.95, workOrigin.y + 1.62, pt.z + 0.1);
    }
    state.lastPointerWorld.copy(pt);
    return;
  }

  if (state.stage === 'SLICE' && state.slicing && pt) {
    const dx = pt.x - state.lastPointerWorld.x;
    const dz = pt.z - state.lastPointerWorld.z;
    const move = Math.hypot(dx, dz);
    if (move > 0.015) {
      // Generously accepts swiping left-to-right, right-to-left, OR front-to-back!
      state.sliceProgress = Math.min(1.0, state.sliceProgress + move * 0.36);
      sfx.playSliceStroke(state.sliceProgress);
      if (Math.random() < 0.45) {
        const sparkX = workOrigin.x + (state.sliceProgress - 0.5) * BREAD_SIZE * 0.8;
        spawnBurst(new THREE.Vector3(sparkX, workOrigin.y + 0.85, workOrigin.z), 'cream', 2, 1.1);
      }
      if (state.sliceProgress >= 0.98) {
        state.slicing = false;
        completeSliceAndReveal();
      }
    }
    state.lastPointerWorld.copy(pt);
    return;
  }

  if (state.stage === 'REVEAL' && state.pointerMoved) {
    // Smoothly orbit the macro camera to catch the morning window backlight through the translucent fruit!
    const deltaX = (e.clientX - state.pointerDownPos.x) / Math.max(window.innerWidth, 1);
    state.revealTargetOrbit = THREE.MathUtils.clamp(state.revealOrbit - deltaX * 1.1, -0.52, 0.52);
  }
}

function onPointerUp(e) {
  if (e.pointerId !== state.activePointerId) return;
  const wasTap = !state.pointerMoved;
  state.activePointerId = null;
  state.pointerDown = false;

  const pt = getWorkPlanePoint(e.clientX, e.clientY);

  if (state.stage === 'SPREAD' && wasTap) {
    if (creamBed.getCoverage() >= 0.44) {
      spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.6, workOrigin.z), 'sun', 10, 1.6);
      setStage('FRUIT');
    }
    return;
  }

  if (state.stage === 'FRUIT') {
    if (state.draggingFruit) {
      const { type, mesh } = state.draggingFruit;
      scene.remove(mesh);
      state.draggingFruit = null;
      hand.setPose('idle');

      if (wasTap) {
        // One-tap accessibility for 5-year-olds: gently nests the fruit onto the next floral spot!
        const spot = getAutoNextFruitSpot();
        placeFruitOnBread(type, spot.x, spot.z);
      } else if (pt && isOverBread(pt, 0.55)) {
        placeFruitOnBread(type, pt.x, pt.z);
      } else {
        // Dropped far away: softly return (no penalty!)
        sfx.playGentleTap('wood');
      }
      return;
    }

    if (state.draggingTopBread) {
      state.draggingTopBread = false;
      if (wasTap || (pt && isOverBread(pt, 0.85))) {
        triggerSandwichCover();
      } else {
        hand.setPose('idle');
      }
      return;
    }
  }

  if (state.stage === 'SLICE') {
    state.slicing = false;
    if (wasTap) {
      // Tap-friendly fallback: each tap makes a crisp slicing stroke!
      state.sliceProgress = Math.min(1.0, state.sliceProgress + 0.36);
      sfx.playSliceStroke(state.sliceProgress);
      spawnBurst(new THREE.Vector3(workOrigin.x, workOrigin.y + 0.9, workOrigin.z), 'cream', 5, 1.3);
      if (state.sliceProgress >= 0.98) {
        completeSliceAndReveal();
      }
    }
    return;
  }

  if (state.stage === 'REVEAL') {
    state.revealOrbit = state.revealTargetOrbit;
    if (wasTap && state.revealOpenT > 0.65) {
      // Check if child tapped either glistening sandwich half to take a delicious bite!
      const hitLeft = state.leftHalf && state.leftHalf.visible && hitTestObject(e.clientX, e.clientY, state.leftHalf);
      const hitRight = state.rightHalf && state.rightHalf.visible && hitTestObject(e.clientX, e.clientY, state.rightHalf);
      const target = hitLeft ? state.leftHalf : hitRight ? state.rightHalf : null;
      if (target) {
        const nextBite = (target.userData.bites || 0) + 1;
        target.userData.applyBite(nextBite);
        triggerWobble(target, 0.22);
        sfx.playBite();
        spawnBurst(target.position.clone().add(new THREE.Vector3(0, 0.65, 0.25)), 'cream', 9, 1.8);
        spawnBurst(target.position.clone().add(new THREE.Vector3(0, 0.72, 0.3)), 'strawberry', 6, 1.9);

        // If both halves have been happily eaten, launch a joyful new sando round!
        const leftDone = !state.leftHalf || !state.leftHalf.visible;
        const rightDone = !state.rightHalf || !state.rightHalf.visible;
        if (leftDone && rightDone) {
          setTimeout(() => {
            if (state.stage === 'REVEAL') startNextRound();
          }, 720);
        }
      }
    }
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// ============================================================
// RESPONSIVE FRAMING (iPhone Portrait + iPad / Desktop Landscape)
// ============================================================
function getCameraTargets() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const isPortrait = aspect < 0.95;
  const distScale = isPortrait ? THREE.MathUtils.clamp(0.95 / aspect, 1.0, 1.52) : 1.0;

  if (state.stage === 'REVEAL') {
    // Iconic Japanese Food-CM Editorial MACRO HERO CLOSE-UP of BOTH complete Flower Cross-Section halves!
    // Clean breathing room between halves & around golden crusts, with huge sunlit morning bokeh above!
    const angle = state.revealTargetOrbit;
    const rad = (isPortrait ? 8.15 : 6.65) * (isPortrait ? Math.min(distScale, 1.15) : 1.0);
    const camX = workOrigin.x + Math.sin(angle) * rad;
    const camZ = workOrigin.z + Math.cos(angle) * rad;
    const camY = isPortrait ? 2.15 : 1.88;
    return {
      pos: new THREE.Vector3(camX, camY, camZ),
      look: new THREE.Vector3(workOrigin.x, workOrigin.y + 0.72, workOrigin.z - 0.12),
      focusDist: rad * 0.96,
      focusRange: 2.2,
      maxBlur: 15.5,
    };
  }

  if (state.stage === 'SLICE') {
    const rad = 5.1 * distScale;
    return {
      pos: new THREE.Vector3(workOrigin.x + 0.15, 2.95 * distScale, workOrigin.z + rad * 0.96),
      look: new THREE.Vector3(workOrigin.x, workOrigin.y + 0.65, workOrigin.z - 0.12),
      focusDist: Math.hypot(2.95 * distScale, rad * 0.96) * 0.95,
      focusRange: 2.3,
      maxBlur: 14.5,
    };
  }

  // SPREAD / FRUIT / PRESS: Editorial food-CM 3/4 view showing bread, cream, fruits AND sunlit morning bokeh behind!
  const cx = isPortrait ? 0.04 : 0.12;
  const cy = (isPortrait ? 4.35 : 3.25) * Math.min(distScale, 1.25);
  const cz = (isPortrait ? 5.95 : 5.35) * Math.min(distScale, 1.25);
  const look = new THREE.Vector3(0.06, 0.42, -0.08);
  const fDist = Math.hypot(cx - look.x, cy - look.y, cz - look.z) * 0.96;
  return {
    pos: new THREE.Vector3(cx, cy, cz),
    look,
    focusDist: fDist,
    focusRange: 2.7,
    maxBlur: 14.0,
  };
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  camera.aspect = w / Math.max(h, 1);
  camera.fov = w < h ? 42 : 35;
  camera.updateProjectionMatrix();
  post.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
}
window.addEventListener('resize', onResize);
onResize();

// ============================================================
// MAIN ANIMATION LOOP
// ============================================================
let lastTime = performance.now();
let fpsFrames = 0;
let fpsLast = performance.now();
let currentFps = 60;

function stepSimulation(dt) {
  state.time += dt;
  state.stageTime += dt;
  if (!state.pointerDown) state.idleTime += dt;

  const kSmooth = 1 - Math.exp(-7.5 * dt);
  const kFast = 1 - Math.exp(-14.0 * dt);

  // 1. Update ambient morning kitchen curtains & shimmering bokeh
  kitchen.updateAmbient(state.time);
  creamBed.update();
  updateParticles(dt);

  // 2. Idle gentle physical demonstration cue (ONLY after 8.5s untouched — never arrows/cursors!)
  if (state.idleTime > 8.5 && !state.idleHintActive && state.stage !== 'REVEAL') {
    state.idleHintActive = true;
    state.idleHintT = 0;
  }
  if (state.idleHintActive) {
    state.idleHintT += dt;
    if (state.idleHintT > 2.2) {
      state.idleHintActive = false;
      state.idleTime = 2.0; // Wait another ~6.5s before demonstrating once again
    }
  }

  // 3. Smoothly slide side dishes slightly wider during REVEAL so hero sandwich halves own the foreground cleanly!
  const revealDishPush = state.stage === 'REVEAL' ? 1.0 : 0.0;
  kitchen.creamBowl.position.lerp(new THREE.Vector3(-2.32 - revealDishPush * 1.15, -0.02, 0.45 - revealDishPush * 1.1), kSmooth);
  kitchen.fruitDish.position.lerp(new THREE.Vector3(2.38 + revealDishPush * 1.15, -0.02, 0.32 - revealDishPush * 1.1), kSmooth);
  for (const slot of traySlots) {
    if (slot.mesh) {
      slot.mesh.position.lerp(
        new THREE.Vector3(slot.pos.x + revealDishPush * 1.15, slot.pos.y, slot.pos.z - revealDishPush * 1.1),
        kSmooth
      );
    }
  }

  // 4. Stage-driven prop & realistic hand choreography
  if (state.stage === 'SPREAD') {
    if (state.pointerDown) {
      // Spatula smoothly follows finger over bread; fingers cleanly wrap over the wooden handle!
      const spX = state.lastPointerWorld.x;
      const spZ = state.lastPointerWorld.z;
      spatula.position.lerp(new THREE.Vector3(spX + 0.52, workOrigin.y + BREAD_THICK + 0.28, spZ), kFast);
      spatula.rotation.z = THREE.MathUtils.lerp(spatula.rotation.z, -0.14, kFast);
      spatula.rotation.y = THREE.MathUtils.lerp(spatula.rotation.y, 0.22, kFast);
      hand.root.position.lerp(new THREE.Vector3(spX + 1.66, workOrigin.y + BREAD_THICK + 0.62, spZ + 0.1), kFast);
    } else if (state.idleHintActive) {
      // One soft real-hand sweep demo across the bread
      const p = Math.sin((state.idleHintT / 2.2) * Math.PI);
      const sx = workOrigin.x - 0.55 + p * 1.1;
      const sz = workOrigin.z + Math.sin(p * Math.PI * 2) * 0.22;
      spatula.position.lerp(new THREE.Vector3(sx + 0.45, workOrigin.y + BREAD_THICK + 0.42, sz), kSmooth);
      hand.root.position.lerp(new THREE.Vector3(sx + 1.62, workOrigin.y + BREAD_THICK + 0.76, sz + 0.1), kSmooth);
    } else {
      // Realistic hand naturally cradles the walnut spatula handle cleanly with ZERO metal clipping!
      const bob = Math.sin(state.time * 2.1) * 0.032;
      const spPos = new THREE.Vector3(0.46, 0.72 + bob, 0.22);
      spatula.position.lerp(spPos, kSmooth);
      spatula.rotation.set(0.06, 0.14, -0.14 + bob * 0.3);
      hand.root.position.lerp(new THREE.Vector3(spPos.x + 1.24, spPos.y + 0.34, spPos.z + 0.08), kSmooth);
    }
  } else if (state.stage === 'FRUIT') {
    // Park spatula neatly back inside the glass cream bowl well clear of the bread!
    spatula.position.lerp(new THREE.Vector3(-2.42, 0.86, 0.35), kSmooth);
    spatula.rotation.z = THREE.MathUtils.lerp(spatula.rotation.z, -0.68, kSmooth);

    // Gently breathe/glisten tray fruits to signal they're ready to place
    for (const slot of traySlots) {
      if (!slot.mesh) continue;
      const pulse = 1.0 + Math.sin(state.time * 2.6 + slot.pulsePhase) * 0.032;
      slot.mesh.scale.setScalar(slot.scale * pulse);
    }

    // Once 2+ fruits are nestled in cream, top bread gently lifts its edge to invite covering!
    if (!state.draggingTopBread) {
      const targetB = state.placedFruits.length >= 2 ? topBreadInvitePos : topBreadRestPos;
      const lift = state.placedFruits.length >= 2 ? Math.sin(state.time * 2.8) * 0.045 : 0;
      topBread.position.lerp(new THREE.Vector3(targetB.x, targetB.y + lift, targetB.z), kSmooth);
      topBread.rotation.z = THREE.MathUtils.lerp(topBread.rotation.z, state.placedFruits.length >= 2 ? -0.06 : 0, kSmooth);
    }

    // Hand tracks dragged fruit, dragged top bread, or performs subtle idle cue
    if (state.draggingFruit || state.draggingTopBread) {
      hand.root.position.lerp(state.handTargetPos, kFast);
    } else if (state.idleHintActive) {
      const p = Math.sin((state.idleHintT / 2.2) * Math.PI);
      const cueFrom = state.placedFruits.length >= 2 ? topBreadInvitePos : traySlots[0].pos;
      const hx = THREE.MathUtils.lerp(cueFrom.x + 0.85, workOrigin.x + 0.85, p * 0.65);
      const hz = THREE.MathUtils.lerp(cueFrom.z + 0.1, workOrigin.z + 0.1, p * 0.65);
      hand.root.position.lerp(new THREE.Vector3(hx, 1.35 + p * 0.35, hz), kSmooth);
    } else {
      hand.root.position.lerp(handHomePos, kSmooth);
    }
  } else if (state.stage === 'PRESS') {
    // Top bread settles smoothly over the pillowy cream & fruits!
    state.pressSquish = Math.max(0, state.pressSquish - dt * 2.4);
    const squishDrop = Math.sin(state.pressSquish * Math.PI) * 0.18;
    const targetTopY = workOrigin.y + BREAD_THICK + 0.86 - squishDrop;
    topBread.position.lerp(new THREE.Vector3(workOrigin.x, targetTopY, workOrigin.z), kFast);
    topBread.rotation.set(0, THREE.MathUtils.lerp(topBread.rotation.y, 0, kFast), 0);

    // Cream ooze bulges slightly wider on squish!
    const bulge = 1.0 + squishDrop * 0.6;
    creamBed.oozeGroup.scale.set(bulge, 1.0 - squishDrop * 0.5, bulge);

    // Realistic open hand hovers & gently presses right above top bread
    const pressHover = state.pressSquish > 0.05 ? targetTopY + 0.22 : targetTopY + 0.62 + Math.sin(state.time * 3.0) * 0.05;
    hand.root.position.lerp(new THREE.Vector3(workOrigin.x + 0.45, pressHover, workOrigin.z + 0.15), kFast);
  } else if (state.stage === 'SLICE') {
    // Sandwich sits plump & ready; gleaming Japanese knife hovers directly over the center cut seam!
    topBread.position.lerp(new THREE.Vector3(workOrigin.x, workOrigin.y + BREAD_THICK + 0.82, workOrigin.z), kSmooth);
    const cutX = workOrigin.x + 1.25 - state.sliceProgress * 0.4;
    const cutY = workOrigin.y + 1.48 - state.sliceProgress * 1.15;
    const cutZ = workOrigin.z + Math.sin(state.sliceProgress * Math.PI * 5) * 0.06;
    const idleFloat = state.slicing ? 0 : Math.sin(state.time * 2.8) * 0.045;
    knife.position.lerp(new THREE.Vector3(cutX, cutY + idleFloat, cutZ), kFast);
    knife.rotation.set(0, 0, Math.sin(state.sliceProgress * Math.PI) * -0.06);

    // Realistic hand grips the walnut knife handle cleanly!
    hand.root.position.lerp(new THREE.Vector3(cutX + 0.92, cutY + 0.24 + idleFloat, cutZ + 0.08), kFast);
  } else if (state.stage === 'REVEAL') {
    // Knife & spatula glide smoothly aside so hero sandwich halves have an immaculate clean stage!
    knife.position.lerp(new THREE.Vector3(0.95, 0.22, -2.15), kSmooth);
    spatula.position.lerp(new THREE.Vector3(-3.35, 0.65, -1.25), kSmooth);
    hand.root.position.lerp(new THREE.Vector3(5.2, 2.6, 2.4), kSmooth);

    // Smooth cinematic parting & opening of the two Flower Cross-Section halves toward the macro camera!
    state.revealOpenT = Math.min(1.0, state.revealOpenT + dt * 1.15);
    const ease = 1 - Math.pow(1 - state.revealOpenT, 3);

    if (state.leftHalf && state.rightHalf) {
      // Iconic staggered Japanese café hero V-composition: clean center sunlit gap + visible golden crust edges!
      state.leftHalf.position.set(
        workOrigin.x - ease * 1.28,
        workOrigin.y + 0.02,
        workOrigin.z + ease * 0.34
      );
      state.leftHalf.rotation.y = ease * 0.3;

      state.rightHalf.position.set(
        workOrigin.x + ease * 1.28,
        workOrigin.y + 0.02,
        workOrigin.z - ease * 0.16
      );
      state.rightHalf.rotation.y = THREE.MathUtils.lerp(Math.PI, -0.3, ease);
    }

    // After 2.8s of enjoying the reveal, gently slide a fresh bread slice onto the far-left background margin
    if (state.stageTime > 2.8) {
      state.nextBreadReady = true;
      topBread.visible = true;
      const pulse = Math.sin(state.time * 2.4) * 0.035;
      topBread.position.lerp(new THREE.Vector3(-3.65, workOrigin.y + BREAD_THICK * 0.5 + pulse, -1.35), kSmooth);
      topBread.rotation.set(0, 0.28, 0);
    }
  }

  // 4. Placed fruit landing spring bounce
  for (const pf of state.placedFruits) {
    if (pf.bounceT < 1) {
      pf.bounceT = Math.min(1, pf.bounceT + dt * 4.5);
      const s = 1 + Math.sin(pf.bounceT * Math.PI * 2.5) * 0.16 * (1 - pf.bounceT);
      pf.mesh.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      pf.mesh.position.y = pf.baseY + Math.sin(pf.bounceT * Math.PI) * 0.12 * (1 - pf.bounceT);
    }
  }

  // 5. Gentle wobble responses on poked inactive props
  for (const [obj, w] of state.wobbles.entries()) {
    w.t += dt * 11;
    if (w.t > Math.PI * 2) {
      obj.rotation.x = 0;
      state.wobbles.delete(obj);
    } else {
      obj.rotation.x = Math.sin(w.t) * w.amp * (1 - w.t / (Math.PI * 2));
    }
  }

  // 6. Update realistic hand articulation
  hand.update(dt, state.time);

  // 7. Smooth Macro Camera & Optical Focus Distance Tracking
  const camTarget = getCameraTargets();
  state.cameraPos.lerp(camTarget.pos, kSmooth);
  state.cameraLook.lerp(camTarget.look, kSmooth);
  state.focusDist = THREE.MathUtils.lerp(state.focusDist, camTarget.focusDist, kSmooth);
  state.focusRange = THREE.MathUtils.lerp(state.focusRange, camTarget.focusRange, kSmooth);
  state.maxBlur = THREE.MathUtils.lerp(state.maxBlur, camTarget.maxBlur, kSmooth);

  camera.position.copy(state.cameraPos);
  camera.lookAt(state.cameraLook);

  post.setFocus({
    focusDist: state.focusDist,
    focusRange: state.focusRange,
    maxBlur: state.maxBlur,
    bloomStrength: state.stage === 'REVEAL' ? 0.22 : 0.16,
    exposure: state.stage === 'REVEAL' ? 0.78 : 0.72,
    saturation: state.stage === 'REVEAL' ? 1.32 : 1.26,
  });

  // 8. Render with Macro Bokeh DoF + Morning Window Bloom + Food-CM Grading!
  post.render(scene, camera);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  fpsFrames++;
  if (now - fpsLast >= 500) {
    currentFps = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0;
    fpsLast = now;
  }
  stepSimulation(dt);
}

requestAnimationFrame(animate);

// ============================================================
// NON-INTRUSIVE INSPECTION HOOK (for automated photorealism & perf checks)
// ============================================================
window.__SANDO_DEBUG__ = {
  step: (frames = 45, dt = 0.033) => {
    for (let i = 0; i < frames; i++) stepSimulation(dt);
  },
  getStats: () => ({
    stage: state.stage,
    fps: currentFps,
    triangles: post.sceneTriangles || 0,
    calls: post.sceneCalls || 0,
    placedFruits: state.placedFruits.length,
    coverage: Number(creamBed.getCoverage().toFixed(2)),
    dpr: renderer.getPixelRatio(),
  }),
  demoSpread: () => {
    for (let x = -0.75; x <= 0.75; x += 0.35) {
      for (let z = -0.65; z <= 0.65; z += 0.35) {
        creamBed.paint(x, z, 0.65, 0.24, 1, 0);
      }
    }
    creamBed.update();
    setStage('FRUIT');
  },
  demoFruits: () => {
    if (creamBed.getCoverage() < 0.4) window.__SANDO_DEBUG__.demoSpread();
    placeFruitOnBread('strawberry', workOrigin.x, workOrigin.z);
    placeFruitOnBread('kiwi', workOrigin.x - 0.6, workOrigin.z + 0.05);
    placeFruitOnBread('mikan', workOrigin.x + 0.62, workOrigin.z - 0.04);
    placeFruitOnBread('kiwi', workOrigin.x + 0.15, workOrigin.z + 0.25);
  },
  demoSlice: () => {
    if (state.placedFruits.length < 2) window.__SANDO_DEBUG__.demoFruits();
    triggerSandwichCover();
    setStage('SLICE');
    state.sliceProgress = 0.45;
  },
  demoReveal: () => {
    if (state.placedFruits.length < 2) window.__SANDO_DEBUG__.demoFruits();
    creamBed.fillBlanket();
    completeSliceAndReveal();
    state.revealOpenT = 1.0;
  },
  setOrbit: (angle) => {
    state.revealTargetOrbit = angle;
    state.revealOrbit = angle;
  },
};
