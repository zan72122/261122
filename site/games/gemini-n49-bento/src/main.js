import * as THREE from '../lib/three.module.js';
import { createTextures } from './textures.js';
import { createMorningEnvironment } from './environment.js';
import {
  createBentoBox,
  createCeramicPlate,
  createTamagoyaki,
  createKaraage,
  createBroccoli,
  createCherryTomato,
  createFuroshiki,
  createContactAO
} from './food.js';
import { createChopstickHand } from './hand.js';
import { audio } from './audio.js';

// =========================================================================
// RENDERER & SCENE SETUP (iPhone/iPad 30fps+ optimized: DPR <= 1.5, <= 1024px maps)
// =========================================================================
const appEl = document.getElementById('app');
const btnCamera = document.getElementById('btn-camera');
const btnReplay = document.getElementById('btn-replay');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 55);
camera.position.set(0.35, 8.8, 1.5);
camera.lookAt(0.35, 0.22, 0.08);

const textures = createTextures();
const envRig = createMorningEnvironment(renderer, scene, textures);

// =========================================================================
// KITCHEN TABLETOP COUNTER (wide enough for all low-angle macro perspectives!)
// =========================================================================
const tableMat = new THREE.MeshStandardMaterial({
  map: textures.tableMap,
  normalMap: textures.tableNormal,
  normalScale: new THREE.Vector2(0.85, 0.85),
  roughnessMap: textures.tableRough,
  roughness: 0.72,
  metalness: 0.02
});
const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), tableMat);
tableMesh.rotation.x = -Math.PI / 2;
tableMesh.receiveShadow = true;
scene.add(tableMesh);

// Grounded Japanese woven charcoal-linen kitchen placemat beneath the bento box (creates crisp editorial contrast!)
const placematMat = new THREE.MeshPhysicalMaterial({
  map: textures.matMap,
  normalMap: textures.matNormal,
  normalScale: new THREE.Vector2(0.85, 0.85),
  roughness: 0.94,
  sheen: 0.32,
  sheenColor: new THREE.Color(0x9a9690)
});
const placemat = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.018, 3.45), placematMat);
placemat.position.set(-1.12, 0.009, 0.25);
placemat.receiveShadow = true;
scene.add(placemat);

// =========================================================================
// WORLD OBJECTS
// =========================================================================
const bento = createBentoBox(textures);
scene.add(bento.boxGroup);
scene.add(bento.lidGroup);

const furoshiki = createFuroshiki(textures, bento.dims);
scene.add(furoshiki.group);

const plateWarm = createCeramicPlate(textures, 1.28, 1.08);
const plateFresh = createCeramicPlate(textures, 1.28, 1.08);
scene.add(plateWarm);
scene.add(plateFresh);

const chopstickHand = createChopstickHand(textures);
scene.add(chopstickHand.root);

// Soft rising warm morning steam wisps over freshly steamed white rice
const steamParticles = [];
const steamGroup = new THREE.Group();
scene.add(steamGroup);
const steamMatBase = new THREE.MeshBasicMaterial({
  map: textures.steamMap,
  transparent: true,
  opacity: 0.22,
  depthWrite: false
});
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), steamMatBase.clone());
  m.userData = {
    phase: i / 9,
    offsetX: (Math.random() - 0.5) * 0.65,
    offsetZ: (Math.random() - 0.5) * 0.85,
    speed: 0.14 + Math.random() * 0.08
  };
  steamGroup.add(m);
  steamParticles.push(m);
}

// =========================================================================
// BENTO SLOTS (Carefully fitted inside inner magewappa curve — ZERO wall clipping!)
// Right okazu compartment spans X in [-0.12 .. +1.68], Z in [-1.05 .. +1.05] with oval corner curve
// =========================================================================
const OKAZU_SLOTS = [
  // Row neatly against the cedar divider: 2 thick Tamagoyaki slices
  { id: 0, prefer: 'tamagoyaki', pos: new THREE.Vector3(0.24, 0.21, -0.44), rotY: 0.08 },
  { id: 1, prefer: 'tamagoyaki', pos: new THREE.Vector3(0.24, 0.21, 0.20), rotY: -0.06 },
  // Center hearty golden Karaage chunks (well inside the curved wall!)
  { id: 2, prefer: 'karaage', pos: new THREE.Vector3(0.92, 0.20, -0.36), rotY: 0.35 },
  { id: 3, prefer: 'karaage', pos: new THREE.Vector3(0.90, 0.20, 0.34), rotY: -0.55 },
  // Lush granular emerald Broccoli florets (safely inset from front & right wall!)
  { id: 4, prefer: 'broccoli', pos: new THREE.Vector3(1.26, 0.20, -0.02), rotY: 0.65 },
  { id: 5, prefer: 'broccoli', pos: new THREE.Vector3(0.54, 0.20, 0.62), rotY: -0.85 },
  // Glossy ruby Cherry Tomatoes brightening upper-left & lower-right curves!
  { id: 6, prefer: 'tomato', pos: new THREE.Vector3(0.56, 0.20, -0.78), rotY: 0.32 },
  { id: 7, prefer: 'tomato', pos: new THREE.Vector3(1.16, 0.20, 0.58), rotY: -0.38 }
];

// Well-spaced ceramic plate positions (zero overlapping karaage!)
const FOOD_DEFS = [
  { type: 'tamagoyaki', variant: 0, plate: 'warm', local: new THREE.Vector3(-0.42, 0.08, -0.34), rotY: 0.22 },
  { type: 'tamagoyaki', variant: 1, plate: 'warm', local: new THREE.Vector3(-0.38, 0.08, 0.36), rotY: -0.16 },
  { type: 'karaage', variant: 0, plate: 'warm', local: new THREE.Vector3(0.42, 0.08, -0.38), rotY: 0.38 },
  { type: 'karaage', variant: 1, plate: 'warm', local: new THREE.Vector3(0.44, 0.08, 0.36), rotY: -0.52 },
  { type: 'broccoli', variant: 0, plate: 'fresh', local: new THREE.Vector3(-0.38, 0.08, -0.32), rotY: 0.35 },
  { type: 'broccoli', variant: 1, plate: 'fresh', local: new THREE.Vector3(-0.36, 0.08, 0.36), rotY: -0.95 },
  { type: 'tomato', variant: 0, plate: 'fresh', local: new THREE.Vector3(0.44, 0.08, -0.30), rotY: 0.1 },
  { type: 'tomato', variant: 1, plate: 'fresh', local: new THREE.Vector3(0.40, 0.08, 0.36), rotY: 1.4 }
];

const foods = FOOD_DEFS.map((def, index) => {
  let built;
  if (def.type === 'tamagoyaki') built = createTamagoyaki(textures, def.variant);
  else if (def.type === 'karaage') built = createKaraage(textures, def.variant);
  else if (def.type === 'broccoli') built = createBroccoli(textures, def.variant);
  else built = createCherryTomato(textures, def.variant);

  const root = built.group;
  const ao = createContactAO(textures, 0.82, 0.82, 0.48);
  ao.position.y = 0.012;
  root.add(ao);

  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.userData.foodIndex = index;
    }
  });

  scene.add(root);
  return {
    index,
    type: def.type,
    plate: def.plate,
    plateLocal: def.local.clone(),
    baseRotY: def.rotY,
    root,
    ao,
    gripWidth: built.gripWidth,
    heightOffset: built.heightOffset,
    packed: false,
    slotId: -1,
    homePos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    targetRotY: def.rotY,
    wobble: 0,
    squish: 0,
    dropAnim: null
  };
});

// =========================================================================
// RESPONSIVE LAYOUT (iPhone Portrait vs iPad/Desktop Landscape)
// =========================================================================
const layout = {
  portrait: false,
  bentoPos: new THREE.Vector3(-1.12, 0, 0.18),
  plateWarmPos: new THREE.Vector3(2.15, 0, -1.06),
  plateFreshPos: new THREE.Vector3(2.12, 0, 1.18),
  lidRestPos: new THREE.Vector3(-1.12, 0, -2.55),
  lidReadyPos: new THREE.Vector3(2.25, 0, 0.18),
  handRestPos: new THREE.Vector3(2.6, 1.45, 0.55)
};

function computeLayout() {
  const aspect = window.innerWidth / window.innerHeight;
  layout.portrait = aspect < 0.95;

  if (layout.portrait) {
    layout.bentoPos.set(0.0, 0, -1.12);
    layout.plateWarmPos.set(-1.35, 0, 1.62);
    layout.plateFreshPos.set(1.35, 0, 1.62);
    layout.lidRestPos.set(0.0, 0, -3.72);
    layout.lidReadyPos.set(0.0, 0, 1.65);
    layout.handRestPos.set(1.85, 1.55, 1.9);
  } else {
    layout.bentoPos.set(-1.12, 0, 0.25);
    layout.plateWarmPos.set(2.18, 0, -0.95);
    layout.plateFreshPos.set(2.15, 0, 1.32);
    layout.lidRestPos.set(-1.12, 0, -2.42);
    layout.lidReadyPos.set(2.28, 0, 0.25);
    // Keep chopstick tips & hand gracefully hovering right near the prep plates (large & inviting!)
    layout.handRestPos.set(2.65, 1.52, 0.52);
  }

  bento.boxGroup.position.copy(layout.bentoPos);
  furoshiki.group.position.copy(layout.bentoPos);
  placemat.position.set(layout.bentoPos.x, 0.009, layout.bentoPos.z);

  if (state.phase === 'pack') {
    plateWarm.position.copy(layout.plateWarmPos);
    plateFresh.position.copy(layout.plateFreshPos);
    bento.lidGroup.position.copy(layout.lidRestPos);
  }

  foods.forEach((f) => {
    const pPos = f.plate === 'warm' ? layout.plateWarmPos : layout.plateFreshPos;
    f.homePos.copy(pPos).add(f.plateLocal);
    if (!f.packed && state.heldFood !== f && !f.dropAnim) {
      f.root.position.copy(f.homePos);
      f.root.rotation.y = f.baseRotY;
    } else if (f.packed) {
      const slot = OKAZU_SLOTS[f.slotId];
      f.root.position.copy(layout.bentoPos).add(slot.pos);
    }
  });
}

// =========================================================================
// GAME STATE MACHINE
// =========================================================================
const state = {
  phase: 'pack',
  packedCount: 0,
  heldFood: null,
  holdingLid: false,
  dragStartTime: 0,
  dragStartScreen: new THREE.Vector2(),
  pointerWorld: new THREE.Vector3(),
  morningProgress: 0.0,
  targetMorningProgress: 0.0,
  cameraLockedMacro: false,
  autoMacroTimer: 0,
  autoMacroFocus: new THREE.Vector3(),
  lastFocusPoint: new THREE.Vector3(0.4, 0.45, 0.1),
  lidAnim: 0,
  lidSlideAnim: 0,
  unfoldAnim: 0,
  fold1Anim: 0,
  fold2Anim: 0,
  platesSlideOut: 0,
  lidWobble: 0,
  ricePoke: 0,
  bentoBounce: 0,
  idleSeconds: 0,
  hintActive: false,
  hintTimer: 0,
  handPos: new THREE.Vector3(2.65, 1.52, 0.52),
  handTargetPos: new THREE.Vector3(2.65, 1.52, 0.52),
  prevPointerWorld: new THREE.Vector3(),
  carryVel: new THREE.Vector3()
};

bento.lidGroup.traverse((o) => {
  if (o.isMesh) o.userData.interactive = 'lid';
});
furoshiki.group.traverse((o) => {
  if (o.isMesh) o.userData.interactive = 'furoshiki';
});

// =========================================================================
// DUAL CAMERA CONTROLLER (Overhead Top-Down <-> Dramatic Tabletop Macro!)
// =========================================================================
const camCurPos = new THREE.Vector3(0.4, 8.8, 1.55);
const camCurLook = new THREE.Vector3(0.4, 0.22, 0.0);
const camDesPos = new THREE.Vector3();
const camDesLook = new THREE.Vector3();
let camCurFov = 35;

function updateCamera(dt, elapsed) {
  const aspect = window.innerWidth / window.innerHeight;
  const inMacro =
    state.cameraLockedMacro ||
    state.heldFood !== null ||
    state.holdingLid ||
    state.autoMacroTimer > 0 ||
    state.phase === 'wrap2' ||
    state.phase === 'done';

  let desFov = 35;

  if (!inMacro) {
    // CAMERA A: Crisp Overhead Top-Down Editorial Bento View (真上の俯瞰)
    desFov = layout.portrait ? 40 : 35;
    if (layout.portrait) {
      const distScale = Math.max(1.0, 0.58 / Math.max(0.38, aspect));
      camDesLook.set(0.0, 0.2, 0.15);
      camDesPos.set(0.0, 10.2 * distScale, 1.85 * distScale);
    } else {
      const distScale = Math.max(1.0, 1.32 / Math.max(0.8, aspect));
      // Generous balanced editorial frame showing full cedar bento, lid edge, both dishes & chopstick hand!
      camDesLook.set(0.35, 0.2, 0.02);
      camDesPos.set(0.35, 8.75 * distScale, 1.58 * distScale);
    }
  } else {
    // CAMERA B: Dramatic Low-Angle Tabletop Macro View (マクロ接写)
    desFov = layout.portrait ? 34 : 31;
    const focus = new THREE.Vector3();

    if (state.heldFood) {
      // Frame the pinched ingredient, the LARGE realistic human hand gripping the chopsticks, AND the bento cavity!
      focus.copy(state.heldFood.root.position);
      focus.x += 0.75;
      focus.y = Math.max(0.68, focus.y * 0.85);
      state.lastFocusPoint.copy(focus);
      const dist = layout.portrait ? 5.6 : 5.05;
      camDesLook.copy(focus);
      camDesPos.set(focus.x - 0.45, focus.y + 2.15, focus.z + dist);
    } else if (state.holdingLid || (state.phase === 'lid' && state.autoMacroTimer > 0)) {
      focus.copy(layout.bentoPos).add(new THREE.Vector3(0, 0.65, 0));
      camDesLook.copy(focus);
      camDesPos.set(focus.x - 0.8, 2.65, focus.z + (layout.portrait ? 5.2 : 4.4));
    } else if (state.phase === 'wrap2' || state.phase === 'done') {
      // Hero golden-hour low-angle beauty shot framing the ENTIRE wrapped bento + linen bow + sunlit kitchen wall!
      focus.copy(layout.bentoPos).add(new THREE.Vector3(0, 0.78, 0));
      const orbit = state.phase === 'done' ? Math.sin(elapsed * 0.3) * 0.68 : 0;
      camDesLook.copy(focus);
      camDesPos.set(focus.x - 0.85 + orbit, 2.75, focus.z + (layout.portrait ? 6.2 : 5.1));
    } else if (state.autoMacroTimer > 0) {
      focus.copy(state.autoMacroFocus);
      state.lastFocusPoint.copy(focus);
      camDesLook.copy(focus);
      camDesPos.set(focus.x - 0.65, focus.y + 1.55, focus.z + (layout.portrait ? 3.8 : 2.95));
    } else {
      // Manual Macro Inspection Mode (toggled by top-right camera button!)
      if (state.packedCount > 0) {
        // High-angle-enough tabletop macro to peer clearly INTO the cedar bento box without front wall blocking the food!
        focus.copy(layout.bentoPos).add(new THREE.Vector3(0.62, 0.45, 0.0));
        const sway = Math.sin(elapsed * 0.42) * 0.3;
        camDesLook.copy(focus);
        camDesPos.set(focus.x - 0.65 + sway, 2.08, focus.z + (layout.portrait ? 3.9 : 2.85));
      } else {
        // Showcase the glistening cherry tomatoes, granular broccoli, karaage & tamagoyaki up close!
        focus.copy(layout.plateFreshPos).lerp(layout.plateWarmPos, 0.42);
        focus.y = 0.32;
        const sway = Math.sin(elapsed * 0.42) * 0.28;
        camDesLook.copy(focus);
        camDesPos.set(focus.x - 0.8 + sway, 1.72, focus.z + (layout.portrait ? 3.9 : 2.85));
      }
    }
  }

  camDesPos.x += Math.sin(elapsed * 0.55) * 0.022;
  camDesPos.y += Math.cos(elapsed * 0.72) * 0.015;

  const damp = 1 - Math.exp(-5.4 * dt);
  camCurPos.lerp(camDesPos, damp);
  camCurLook.lerp(camDesLook, damp);
  camCurFov += (desFov - camCurFov) * damp;

  camera.fov = camCurFov;
  camera.position.copy(camCurPos);
  camera.lookAt(camCurLook);
  camera.updateProjectionMatrix();

  btnCamera.classList.toggle('active', state.cameraLockedMacro);
}

// =========================================================================
// SMART SLOT SELECTION & PACKING LOGIC
// =========================================================================
function findBestSlot(food, worldDropPos) {
  const localDrop = worldDropPos.clone().sub(layout.bentoPos);
  const openSlots = OKAZU_SLOTS.filter((s) => !foods.some((f) => f.packed && f.slotId === s.id));
  if (openSlots.length === 0) return null;

  let best = openSlots[0];
  let bestScore = Infinity;
  for (const slot of openSlots) {
    const dist = Math.hypot(localDrop.x - slot.pos.x, localDrop.z - slot.pos.z);
    const typeBonus = slot.prefer === food.type ? -0.45 : 0;
    const score = dist + typeBonus;
    if (score < bestScore) {
      bestScore = score;
      best = slot;
    }
  }
  return best;
}

function isOverBento(worldPos) {
  const local = worldPos.clone().sub(layout.bentoPos);
  return Math.abs(local.x) < bento.dims.W * 0.62 && Math.abs(local.z) < bento.dims.D * 0.68;
}

function packFoodIntoSlot(food, slot) {
  food.packed = true;
  food.slotId = slot.id;
  food.targetPos.copy(layout.bentoPos).add(slot.pos);
  food.targetRotY = slot.rotY + (Math.random() - 0.5) * 0.18;

  const startPos = food.root.position.clone();
  food.dropAnim = {
    kind: 'pack',
    t: 0,
    duration: 0.36,
    startPos,
    endPos: food.targetPos.clone(),
    arcHeight: 0.55,
    startRotY: food.root.rotation.y,
    endRotY: food.targetRotY,
    landed: false
  };

  state.packedCount++;
  state.targetMorningProgress = Math.min(0.72, (state.packedCount / foods.length) * 0.72);
  state.autoMacroFocus.copy(food.targetPos).add(new THREE.Vector3(0, 0.25, 0));
  state.autoMacroTimer = 0.85;
}

function returnFoodToPlate(food) {
  audio.playBounce(food.type);
  food.dropAnim = {
    kind: 'return',
    t: 0,
    duration: 0.42,
    startPos: food.root.position.clone(),
    endPos: food.homePos.clone(),
    arcHeight: 0.42,
    startRotY: food.root.rotation.y,
    endRotY: food.baseRotY,
    landed: false
  };
}

function advancePhaseIfReady() {
  if (state.phase === 'pack' && state.packedCount >= foods.length) {
    state.phase = 'lid';
    state.targetMorningProgress = 0.8;
    setTimeout(() => {
      if (state.phase === 'lid') {
        audio.playPoke('wood');
        state.lidWobble = 1.0;
      }
    }, 650);
  }
}

function triggerLidClose() {
  if (state.phase !== 'lid' || state.lidAnim > 0) return;
  state.holdingLid = false;
  state.lidAnim = 0.001;
  state.autoMacroTimer = 1.5;
  state.targetMorningProgress = 0.88;
  audio.playLidClose();
}

function triggerWrapStep() {
  if (state.phase === 'wrap1' && state.fold1Anim === 0) {
    state.fold1Anim = 0.001;
    state.targetMorningProgress = 0.94;
    audio.playClothFold(false);
  } else if (state.phase === 'wrap2' && state.fold2Anim === 0) {
    state.fold2Anim = 0.001;
    state.targetMorningProgress = 1.0;
    audio.playClothFold(true);
    setTimeout(() => audio.playComplete(), 380);
  }
}

// =========================================================================
// ONE-FINGER INPUT
// =========================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.25);

function updatePointerWorld(clientX, clientY, planeY = 1.25) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  dragPlane.constant = -planeY;
  raycaster.ray.intersectPlane(dragPlane, state.pointerWorld);
}

let activePointerId = null;

function onPointerDown(e) {
  if (activePointerId !== null) return;
  if (e.target.closest && e.target.closest('.icon-btn')) return;

  audio.unlock();
  activePointerId = e.pointerId;
  state.idleSeconds = 0;
  state.hintActive = false;
  state.dragStartTime = performance.now();
  state.dragStartScreen.set(e.clientX, e.clientY);

  updatePointerWorld(e.clientX, e.clientY, 0.3);
  const hits = raycaster.intersectObjects(scene.children, true);

  if (state.phase === 'pack') {
    for (const h of hits) {
      const idx = h.object.userData.foodIndex;
      if (idx !== undefined) {
        const food = foods[idx];
        if (!food.packed && !food.dropAnim) {
          state.heldFood = food;
          state.prevPointerWorld.copy(food.root.position);
          updatePointerWorld(e.clientX, e.clientY, 1.25);
          audio.playPickup(food.type);
          chopstickHand.setPinch(0.18 + food.gripWidth * 0.35);
          return;
        } else if (food.packed) {
          food.squish = 1.0;
          audio.playPoke('rice');
          return;
        }
      }
      if (h.object.userData.interactive === 'rice') {
        state.ricePoke = 1.0;
        audio.playPoke('rice');
        return;
      }
      if (h.object.userData.interactive === 'lid') {
        state.lidWobble = 1.0;
        audio.playPoke('wood');
        return;
      }
    }

    let nearest = null;
    let nearestD = 0.88;
    for (const food of foods) {
      if (food.packed || food.dropAnim) continue;
      const d = Math.hypot(
        state.pointerWorld.x - food.root.position.x,
        state.pointerWorld.z - food.root.position.z
      );
      if (d < nearestD) {
        nearestD = d;
        nearest = food;
      }
    }
    if (nearest) {
      state.heldFood = nearest;
      state.prevPointerWorld.copy(nearest.root.position);
      updatePointerWorld(e.clientX, e.clientY, 1.25);
      audio.playPickup(nearest.type);
      chopstickHand.setPinch(0.18 + nearest.gripWidth * 0.35);
      return;
    }
  }

  if (state.phase === 'lid' && state.lidAnim === 0) {
    for (const h of hits) {
      if (h.object.userData.interactive === 'lid') {
        state.holdingLid = true;
        updatePointerWorld(e.clientX, e.clientY, 1.25);
        audio.playPoke('wood');
        return;
      }
    }
    const dLid = Math.hypot(
      state.pointerWorld.x - bento.lidGroup.position.x,
      state.pointerWorld.z - bento.lidGroup.position.z
    );
    if (dLid < 2.2) {
      state.holdingLid = true;
      updatePointerWorld(e.clientX, e.clientY, 1.25);
      audio.playPoke('wood');
      return;
    }
  }

  if (state.phase === 'wrap1' || state.phase === 'wrap2') {
    for (const h of hits) {
      if (h.object.userData.interactive === 'furoshiki' || h.object.userData.interactive === 'lid') {
        triggerWrapStep();
        return;
      }
    }
    const dBox = Math.hypot(
      state.pointerWorld.x - layout.bentoPos.x,
      state.pointerWorld.z - layout.bentoPos.z
    );
    if (dBox < 3.6) {
      triggerWrapStep();
      return;
    }
  }

  if (state.phase === 'done') {
    state.bentoBounce = 1.0;
    audio.playClothFold(false);
  }
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId) return;
  state.idleSeconds = 0;

  if (state.heldFood) {
    updatePointerWorld(e.clientX, e.clientY, 1.25);
  } else if (state.holdingLid) {
    updatePointerWorld(e.clientX, e.clientY, 1.25);
    bento.lidGroup.position.lerp(
      new THREE.Vector3(state.pointerWorld.x, 1.22, state.pointerWorld.z),
      0.38
    );
    if (isOverBento(bento.lidGroup.position)) {
      triggerLidClose();
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;

  const elapsedMs = performance.now() - state.dragStartTime;
  const movePx = Math.hypot(
    e.clientX - state.dragStartScreen.x,
    e.clientY - state.dragStartScreen.y
  );
  const wasQuickTap = elapsedMs < 290 && movePx < 24;

  if (state.heldFood) {
    const food = state.heldFood;
    state.heldFood = null;
    chopstickHand.setPinch(0.62);

    if (wasQuickTap) {
      const slot = findBestSlot(food, layout.bentoPos.clone().add(new THREE.Vector3(0.65, 0, 0)));
      if (slot) packFoodIntoSlot(food, slot);
    } else if (isOverBento(food.root.position)) {
      const slot = findBestSlot(food, food.root.position);
      if (slot) packFoodIntoSlot(food, slot);
    } else {
      returnFoodToPlate(food);
    }
  }

  if (state.holdingLid) {
    state.holdingLid = false;
    if (wasQuickTap || isOverBento(bento.lidGroup.position)) {
      triggerLidClose();
    }
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

btnCamera.addEventListener('click', () => {
  audio.unlock();
  audio.playPoke('camera');
  state.cameraLockedMacro = !state.cameraLockedMacro;
  state.autoMacroTimer = 0;
});

function resetBento() {
  audio.unlock();
  audio.playPoke('wood');
  state.phase = 'pack';
  state.packedCount = 0;
  state.heldFood = null;
  state.holdingLid = false;
  state.targetMorningProgress = 0.0;
  state.cameraLockedMacro = false;
  state.autoMacroTimer = 0;
  state.lidAnim = 0;
  state.unfoldAnim = 0;
  state.fold1Anim = 0;
  state.fold2Anim = 0;
  state.platesSlideOut = 0;
  state.idleSeconds = 0;
  state.hintActive = false;

  state.lidSlideAnim = 0;
  bento.lidAO.visible = true;
  bento.lidGroup.rotation.set(0, 0, 0);
  furoshiki.setFoldState(0, 0, 0);
  btnReplay.classList.remove('visible');

  foods.forEach((f) => {
    f.packed = false;
    f.slotId = -1;
    f.dropAnim = null;
    f.root.rotation.set(0, f.baseRotY, 0);
    f.root.scale.setScalar(1);
    f.ao.visible = true;
  });

  computeLayout();
}

btnReplay.addEventListener('click', resetBento);

// =========================================================================
// MAIN ANIMATION LOOP
// =========================================================================
computeLayout();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  computeLayout();
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  state.morningProgress += (state.targetMorningProgress - state.morningProgress) * Math.min(1, dt * 2.1);
  envRig.update(state.morningProgress, elapsed);

  if (state.autoMacroTimer > 0) {
    state.autoMacroTimer = Math.max(0, state.autoMacroTimer - dt);
  }

  if (state.phase === 'pack' && state.packedCount === 0 && !state.heldFood) {
    state.idleSeconds += dt;
    if (state.idleSeconds > 10.0) {
      state.hintActive = true;
      state.hintTimer += dt;
    }
  } else {
    state.idleSeconds = 0;
    state.hintActive = false;
    state.hintTimer = 0;
  }

  if (state.heldFood) {
    const f = state.heldFood;
    const target = new THREE.Vector3(state.pointerWorld.x, 1.22, state.pointerWorld.z);
    state.carryVel.subVectors(target, f.root.position);
    f.root.position.lerp(target, 1 - Math.exp(-18 * dt));
    f.root.rotation.z = THREE.MathUtils.clamp(-state.carryVel.x * 0.42, -0.35, 0.35);
    f.root.rotation.x = THREE.MathUtils.clamp(state.carryVel.z * 0.42, -0.35, 0.35);
    f.ao.visible = false;

    state.handTargetPos.copy(f.root.position).add(new THREE.Vector3(0, f.heightOffset, 0));
    chopstickHand.setPinch(0.16 + f.gripWidth * 0.28);
  }

  let activePackDropFood = null;
  for (const f of foods) {
    if (f.dropAnim) {
      const a = f.dropAnim;
      a.t = Math.min(1, a.t + dt / a.duration);
      const u = a.t;
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      f.root.position.lerpVectors(a.startPos, a.endPos, ease);
      f.root.position.y += Math.sin(u * Math.PI) * a.arcHeight;
      f.root.rotation.y = THREE.MathUtils.lerp(a.startRotY, a.endRotY, ease);
      f.root.rotation.x *= 1 - ease;
      f.root.rotation.z *= 1 - ease;

      if (a.kind === 'pack') {
        activePackDropFood = f;
        state.handTargetPos.copy(f.root.position).add(new THREE.Vector3(0, f.heightOffset, 0));
        chopstickHand.setPinch(u < 0.78 ? 0.18 + f.gripWidth * 0.25 : 0.72);
      }

      if (u >= 1) {
        f.root.position.copy(a.endPos);
        f.root.rotation.set(0, a.endRotY, 0);
        f.ao.visible = true;
        f.squish = 1.0;
        if (a.kind === 'pack' && !a.landed) {
          a.landed = true;
          audio.playPack(f.type, state.packedCount);
          advancePhaseIfReady();
        }
        f.dropAnim = null;
      }
    }

    if (f.squish > 0.001) {
      f.squish = Math.max(0, f.squish - dt * 3.8);
      const s = Math.sin(f.squish * Math.PI * 2) * f.squish * 0.14;
      f.root.scale.set(1 + s * 0.7, 1 - s, 1 + s * 0.7);
    } else {
      f.root.scale.setScalar(1);
    }
  }

  if (!state.heldFood && !activePackDropFood) {
    if (state.phase === 'pack') {
      if (state.hintActive) {
        const targetFood = foods[0];
        const hover = Math.sin(state.hintTimer * 2.8) * 0.22;
        state.handTargetPos.copy(targetFood.root.position).add(new THREE.Vector3(0.05, 0.75 + hover, 0.05));
        chopstickHand.setPinch(0.32 + Math.sin(state.hintTimer * 5.0) * 0.22);
      } else {
        state.handTargetPos.copy(layout.handRestPos);
        state.handTargetPos.y += Math.sin(elapsed * 1.6) * 0.06;
        chopstickHand.setPinch(0.42);
      }
    } else {
      state.handTargetPos.copy(layout.handRestPos).add(new THREE.Vector3(4.5, 2.2, 2.0));
    }
  }
  state.handPos.lerp(state.handTargetPos, 1 - Math.exp(-12 * dt));
  chopstickHand.root.position.copy(state.handPos);
  chopstickHand.update(dt);

  if (state.phase !== 'pack') {
    state.platesSlideOut = Math.min(1, state.platesSlideOut + dt * 1.45);
    const pe = state.platesSlideOut * state.platesSlideOut * (3 - 2 * state.platesSlideOut);
    const outDir = layout.portrait ? new THREE.Vector3(0, 0, 5.2) : new THREE.Vector3(5.2, 0, 0);
    plateWarm.position.lerpVectors(layout.plateWarmPos, layout.plateWarmPos.clone().add(outDir), pe);
    plateFresh.position.lerpVectors(layout.plateFreshPos, layout.plateFreshPos.clone().add(outDir), pe);

    if (state.phase === 'lid' && !state.holdingLid && state.lidAnim === 0) {
      state.lidSlideAnim = Math.min(1, state.lidSlideAnim + dt * 1.45);
      const u = state.lidSlideAnim;
      const ease = u * u * (3 - 2 * u);
      const midPt = layout.portrait
        ? new THREE.Vector3(2.8, 0.12, -1.1)
        : new THREE.Vector3(2.28, 0.12, -2.42);
      const omt = 1 - ease;
      const bx = omt * omt * layout.lidRestPos.x + 2 * omt * ease * midPt.x + ease * ease * layout.lidReadyPos.x;
      const bz = omt * omt * layout.lidRestPos.z + 2 * omt * ease * midPt.z + ease * ease * layout.lidReadyPos.z;
      const breath = u >= 1 ? Math.max(0, Math.sin(elapsed * 2.4) * 0.025) : Math.sin(ease * Math.PI) * 0.18;
      bento.lidGroup.position.set(bx, breath, bz);
    }
  }

  if (state.lidAnim > 0 && state.lidAnim < 1) {
    state.lidAnim = Math.min(1, state.lidAnim + dt * 2.1);
    const u = state.lidAnim;
    const ease = u * u * (3 - 2 * u);
    const targetP = new THREE.Vector3(layout.bentoPos.x, bento.dims.H - 0.14, layout.bentoPos.z);
    bento.lidGroup.position.lerp(targetP, Math.min(1, ease * 0.45 + 0.15));
    bento.lidGroup.position.y += Math.sin(u * Math.PI) * 0.35;
    bento.lidGroup.rotation.z = Math.sin(u * Math.PI) * 0.12;
    bento.lidAO.visible = u < 0.35;

    if (state.lidAnim >= 1) {
      bento.lidGroup.position.copy(targetP);
      bento.lidGroup.rotation.set(0, 0, 0);
      state.bentoBounce = 0.7;
      state.phase = 'wrap1';
    }
  }

  if (state.phase === 'wrap1' || state.phase === 'wrap2' || state.phase === 'done') {
    state.unfoldAnim = Math.min(1, state.unfoldAnim + dt * 1.9);
  }
  if (state.fold1Anim > 0 && state.fold1Anim < 1) {
    state.fold1Anim = Math.min(1, state.fold1Anim + dt * 1.85);
    if (state.fold1Anim >= 1) state.phase = 'wrap2';
  }
  if (state.fold2Anim > 0 && state.fold2Anim < 1) {
    state.fold2Anim = Math.min(1, state.fold2Anim + dt * 1.45);
    if (state.fold2Anim >= 1) {
      state.phase = 'done';
      state.bentoBounce = 1.0;
      btnReplay.classList.add('visible');
    }
  }
  furoshiki.setFoldState(state.unfoldAnim, state.fold1Anim, state.fold2Anim);

  if (state.phase === 'wrap1' && state.fold1Anim === 0 && state.unfoldAnim > 0.7) {
    const fl = Math.sin(elapsed * 3.1) * 0.08;
    furoshiki.frontFlap.pivot.rotation.x = Math.PI / 2 - 0.12 - fl;
    furoshiki.backFlap.pivot.rotation.x = Math.PI / 2 - 0.12 - fl;
  } else if (state.phase === 'wrap2' && state.fold2Anim === 0) {
    const fl = Math.sin(elapsed * 3.1) * 0.08;
    furoshiki.leftFlap.pivot.rotation.x = Math.PI / 2 - 0.12 - fl;
    furoshiki.rightFlap.pivot.rotation.x = Math.PI / 2 - 0.12 - fl;
  }

  if (state.lidWobble > 0.001) {
    state.lidWobble = Math.max(0, state.lidWobble - dt * 3.4);
    bento.lidGroup.rotation.z = Math.sin(state.lidWobble * Math.PI * 3) * state.lidWobble * 0.085;
  }
  if (state.ricePoke > 0.001) {
    state.ricePoke = Math.max(0, state.ricePoke - dt * 3.2);
    const s = Math.sin(state.ricePoke * Math.PI * 2.5) * state.ricePoke * 0.12;
    bento.umeboshi.scale.set(1 + s, 1 - s * 0.8, 1 + s);
  }
  if (state.bentoBounce > 0.001) {
    state.bentoBounce = Math.max(0, state.bentoBounce - dt * 3.0);
    const s = Math.sin(state.bentoBounce * Math.PI * 2) * state.bentoBounce * 0.07;
    bento.boxGroup.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
    furoshiki.group.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
  } else {
    bento.boxGroup.scale.setScalar(1);
    furoshiki.group.scale.setScalar(1);
  }

  const steamStrength = state.lidAnim > 0.35 ? 0 : 1;
  steamGroup.visible = steamStrength > 0.01;
  if (steamGroup.visible) {
    for (const sp of steamParticles) {
      const u = (elapsed * sp.userData.speed + sp.userData.phase) % 1;
      sp.position.set(
        layout.bentoPos.x - 0.96 + sp.userData.offsetX + Math.sin(elapsed * 0.9 + sp.userData.phase * 10) * 0.14,
        0.95 + u * 1.45,
        layout.bentoPos.z + sp.userData.offsetZ + Math.cos(elapsed * 0.7 + sp.userData.phase * 8) * 0.1
      );
      sp.lookAt(camera.position);
      sp.scale.setScalar(0.45 + u * 1.15);
      const envFade = Math.sin(u * Math.PI);
      sp.material.opacity = envFade * (0.26 - state.morningProgress * 0.12);
    }
  }

  updateCamera(dt, elapsed);
  renderer.render(scene, camera);
}

animate();

// =========================================================================
// VERIFICATION HOOK
// =========================================================================
window.__BENTO__ = {
  getStats() {
    return {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      phase: state.phase,
      packedCount: state.packedCount,
      morningProgress: Number(state.morningProgress.toFixed(2)),
      cameraLockedMacro: state.cameraLockedMacro,
      pixelRatio: renderer.getPixelRatio()
    };
  },
  setCameraMacro(flag) {
    state.cameraLockedMacro = Boolean(flag);
    state.autoMacroTimer = 0;
  },
  snapCamera() {
    envRig.update(state.morningProgress, clock.elapsedTime);
    for (let i = 0; i < 40; i++) {
      updateCamera(0.08, clock.elapsedTime);
    }
    renderer.render(scene, camera);
  },
  settleLidReady() {
    state.lidSlideAnim = 1;
    state.platesSlideOut = 1;
    bento.lidGroup.position.copy(layout.lidReadyPos);
  },
  packNext() {
    const next = foods.find((f) => !f.packed);
    if (!next) return false;
    const slot = findBestSlot(next, layout.bentoPos.clone().add(new THREE.Vector3(0.65, 0, 0)));
    if (slot) {
      next.packed = true;
      next.slotId = slot.id;
      next.root.position.copy(layout.bentoPos).add(slot.pos);
      next.root.rotation.set(0, slot.rotY, 0);
      state.packedCount++;
      state.targetMorningProgress = Math.min(0.72, (state.packedCount / foods.length) * 0.72);
      state.morningProgress = state.targetMorningProgress;
      advancePhaseIfReady();
      return true;
    }
    return false;
  },
  holdFood(index = 0) {
    const f = foods[index];
    if (!f) return;
    state.heldFood = f;
    state.pointerWorld.copy(layout.bentoPos).add(new THREE.Vector3(0.45, 1.18, 0.1));
    f.root.position.copy(state.pointerWorld);
    f.ao.visible = false;
    state.handPos.copy(f.root.position).add(new THREE.Vector3(0, f.heightOffset, 0));
    state.handTargetPos.copy(state.handPos);
    chopstickHand.root.position.copy(state.handPos);
    chopstickHand.setPinch(0.18 + f.gripWidth * 0.25);
    chopstickHand.update(1);
  },
  releaseHold() {
    state.heldFood = null;
  },
  completeWrap() {
    state.phase = 'done';
    state.platesSlideOut = 1;
    state.lidAnim = 1;
    bento.lidGroup.position.set(layout.bentoPos.x, bento.dims.H - 0.14, layout.bentoPos.z);
    bento.lidAO.visible = false;
    state.unfoldAnim = 1;
    state.fold1Anim = 1;
    state.fold2Anim = 1;
    furoshiki.setFoldState(1, 1, 1);
    state.targetMorningProgress = 1.0;
    state.morningProgress = 1.0;
    envRig.update(1.0, clock.elapsedTime);
    btnReplay.classList.add('visible');
  },
  reset: resetBento
};
