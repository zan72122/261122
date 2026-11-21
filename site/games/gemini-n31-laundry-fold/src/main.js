import * as THREE from '../vendor/three.module.min.js';
import { FAMILY, LAYOUT, buildLaundryWave } from './config.js';
import { CraftRoom } from './room.js';
import { FoldableGarment, createStackedBundleMesh } from './garments.js';
import { CraftParticles } from './particles.js';
import { audio } from './audio.js';

// --- RENDERER, SCENE, LIGHTING ---
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f4e7d3');

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 40);

// Warm sunlit craft-studio lighting (soft, cozy, highlights felt bump & 3D stitches!)
const hemiLight = new THREE.HemisphereLight('#fff9ed', '#c79f79', 1.15);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#fff4dd', 1.55);
sunLight.position.set(-4.2, 8.2, 5.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1.5;
sunLight.shadow.camera.far = 22;
sunLight.shadow.camera.left = -5.5;
sunLight.shadow.camera.right = 5.5;
sunLight.shadow.camera.top = 5.5;
sunLight.shadow.camera.bottom = -4.5;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight('#ffe4d6', 0.45);
fillLight.position.set(4.5, 4.0, 3.0);
scene.add(fillLight);

// --- WORLD & SYSTEMS ---
const room = new CraftRoom(scene);
const particles = new CraftParticles(scene);

// Mute button (zero text)
const muteBtn = document.getElementById('mute-btn');
const iconOn = document.getElementById('icon-sound-on');
const iconOff = document.getElementById('icon-sound-off');
let isMuted = false;
muteBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  audio.unlock();
  isMuted = !isMuted;
  audio.setMuted(isMuted);
  muteBtn.classList.toggle('muted', isMuted);
  iconOn.style.display = isMuted ? 'none' : 'block';
  iconOff.style.display = isMuted ? 'block' : 'none';
  if (!isMuted) audio.playPatSquish(1.2);
});

// --- RESPONSIVE FRAMING (iPhone Portrait & iPad Landscape) ---
let isPortrait = false;
function updateCameraFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  isPortrait = aspect < 0.92;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  camera.aspect = aspect;
  room.setPortraitLayout(isPortrait);

  if (isPortrait) {
    // Tall phone (e.g. 390x844): compute exact distance so ALL 3 drawers + 3 dolls fit width comfortably!
    camera.fov = 44;
    const vRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfV = Math.tan(vRad / 2);
    const tanHalfH = tanHalfV * aspect;
    // Target horizontal half-span at chest/doll plane (~3.65 world units)
    const neededDist = 3.75 / Math.max(0.18, tanHalfH);
    const dir = new THREE.Vector3(0, 0.60, 0.80).normalize();
    const look = new THREE.Vector3(0, 0.72, -0.08);
    camera.position.copy(look).addScaledVector(dir, Math.max(11.0, neededDist));
    camera.lookAt(look);
  } else {
    // iPad 4:3 & Desktop 16:9: frame full dolls' heads + bunting, full basket, full dish, and HUGE folding mat!
    camera.fov = 38;
    const vRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfV = Math.tan(vRad / 2);
    const tanHalfH = tanHalfV * aspect;
    const distW = 4.22 / Math.max(0.25, tanHalfH);
    const distH = 3.58 / tanHalfV;
    const dist = Math.max(distW, distH);
    const dir = new THREE.Vector3(0, 0.55, 0.835).normalize();
    const look = new THREE.Vector3(0, 0.92, -0.18);
    camera.position.copy(look).addScaledVector(dir, dist);
    camera.lookAt(look);
  }
  camera.updateProjectionMatrix();
}
updateCameraFraming();
window.addEventListener('resize', updateCameraFraming);

// --- GAME STATE ---
let currentRound = 1;
let targetPerFamily = 2; // Round 1 = 2 items per family (fast early joy!), Round 2+ = 3 items!
let laundryQueue = buildLaundryWave(currentRound);
let activeGarment = null;
let garmentAnim = null; // flying-in from basket OR bouncing back on mismatch OR snapping to pile

// Piles stacked on the 3 color sorting mats
const piles = [[], [], []]; // piles[familyId] = array of { mesh, spec, baseY, wobble, wobbleVel }
const familyCompletedInRound = [false, false, false];
const flyingObjects = []; // clothespins, pocket treasures, tucking clothes flying in smooth arcs!

// Interaction tracking (strictly single-finger primary pointerId!)
let activePointerId = null;
let dragMode = null; // null | 'fold' | 'bundle' | 'pile' | 'drawer'
let dragStartWorld = new THREE.Vector3();
let dragStartScreen = { x: 0, y: 0 };
let dragCurrentWorld = new THREE.Vector3();
let dragMovedDist = 0;
let dragFamilyId = -1;
let dragDrawerStartZ = 0;
let lastRustleTime = 0;

// Idle felt mitten hint (ONLY appears once after 8+ seconds idle!)
let idleSeconds = 0;
let hintActive = false;
let hintProgress = 0;
let hintCooldown = 0;
let hintStartPos = new THREE.Vector3();
let hintEndPos = new THREE.Vector3();

// Raycasting helpers
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
const hoverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
const focusWorldPos = new THREE.Vector3(0, 0.2, LAYOUT.foldingMatPos.z);

function screenToWorld(clientX, clientY, plane = tablePlane, out = new THREE.Vector3()) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, out);
  return out;
}

function raycastScene(clientX, clientY, objects) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(objects, true);
}

// --- FLYING ARC HELPER ---
function launchArc(mesh, startPos, endPos, options = {}) {
  const { duration = 0.55, peakY = 1.6, spin = 4.0, onDone = null } = options;
  scene.add(mesh);
  mesh.position.copy(startPos);
  flyingObjects.push({
    mesh,
    start: startPos.clone(),
    end: endPos.clone(),
    duration,
    peakY,
    spin,
    age: 0,
    onDone,
  });
}

// --- SPAWN NEXT GARMENT FROM BASKET ---
function spawnNextGarment(immediate = false) {
  if (activeGarment || laundryQueue.length === 0) return;

  const spec = laundryQueue.shift();
  room.setBasketFillCount(laundryQueue.length);

  const garment = new FoldableGarment(spec);
  scene.add(garment.root);
  activeGarment = garment;

  const targetPos = new THREE.Vector3(LAYOUT.foldingMatPos.x, 0.085, LAYOUT.foldingMatPos.z);

  if (immediate) {
    garment.root.position.copy(targetPos);
    garment.root.scale.setScalar(1.12);
  } else {
    const startPos = room.basketGroup.position.clone().add(new THREE.Vector3(0, 1.05, 0));
    garment.root.position.copy(startPos);
    garment.root.scale.setScalar(0.35);
    room.jiggleBasket();
    audio.playBasketPop();
    garmentAnim = {
      kind: 'spawn',
      start: startPos,
      end: targetPos,
      age: 0,
      duration: 0.52,
    };
  }
}

// --- DETACH CLOTHESPIN / POP POCKET TREASURE ---
function triggerClothespinSnap() {
  if (!activeGarment) return false;
  const res = activeGarment.detachClothespin();
  if (!res) return false;

  audio.playClothespinSnap();
  particles.puff(res.worldPos, '#fff7e8', 5);
  const dishPos = room.dishGroup.position.clone().add(new THREE.Vector3(0, 0.35, 0));
  launchArc(res.mesh, res.worldPos, dishPos, {
    duration: 0.52,
    peakY: 1.7,
    spin: 9.0,
    onDone: () => {
      scene.remove(res.mesh);
      res.mesh.scale.setScalar(0.82);
      room.addTrinket(res.mesh);
      audio.playTrinketChime(room.trinketItems.length);
    },
  });
  return true;
}

function triggerPocketPop() {
  if (!activeGarment) return false;
  const res = activeGarment.popPocketTreasure();
  if (!res) return false;

  audio.playPocketPop();
  particles.burst(res.worldPos, {
    count: 12,
    colors: ['#ffd652', '#f26d7d', '#fff8ec'],
    kind: 'star',
    speed: 2.0,
    upward: 2.6,
  });

  const dishPos = room.dishGroup.position.clone().add(new THREE.Vector3(0, 0.36, 0));
  launchArc(res.mesh, res.worldPos, dishPos, {
    duration: 0.72,
    peakY: 2.1,
    spin: 6.5,
    onDone: () => {
      scene.remove(res.mesh);
      room.addTrinket(res.mesh);
      audio.playTrinketChime(room.trinketItems.length);
      particles.burst(dishPos, { count: 6, kind: 'star', scale: 0.7 });
    },
  });
  return true;
}

// --- COMPLETE A FOLD STEP ("ぱたん!") ---
function finishCurrentFoldStep() {
  if (!activeGarment || activeGarment.isFolded) return;
  const stepIdx = activeGarment.currentStepIdx;

  // If a clothespin was still clipped on, pop it off cheerfully as you fold!
  if (activeGarment.clothespin && !activeGarment.clothespinDetached) {
    triggerClothespinSnap();
  }

  const allDone = activeGarment.completeCurrentStep();
  audio.playFoldPatan(stepIdx);

  const puffPos = activeGarment.root.position.clone().add(new THREE.Vector3(0, 0.25, 0));
  particles.puff(puffPos, FAMILY[activeGarment.spec.familyId].colorLight, 6);

  // If this garment has an unpopped bulging pocket, pop the treasure on the final fold!
  if (allDone && activeGarment.pocketGroup && !activeGarment.pocketPopped) {
    setTimeout(() => triggerPocketPop(), 140);
  }

  if (allDone) {
    audio.playFoldComplete();
    particles.burst(puffPos, {
      count: 11,
      colors: [FAMILY[activeGarment.spec.familyId].color, '#fff8ec', '#ffd65c'],
      kind: 'star',
      speed: 1.8,
      upward: 2.2,
    });
    // The matching family member waves eagerly!
    room.dolls[activeGarment.spec.familyId].setMood('eager', 4.0);
  }
}

// --- STACK FOLDED BUNDLE ONTO FAMILY'S COLOR PILE ---
function placeBundleOnPile(familyId) {
  if (!activeGarment) return;
  const spec = activeGarment.spec;
  const dropPos = activeGarment.root.position.clone();

  // Remove active foldable mesh and replace with crisp stackable folded bundle
  scene.remove(activeGarment.root);
  activeGarment = null;

  const bundle = createStackedBundleMesh(spec);
  const pile = piles[familyId];
  const stackIdx = pile.length;
  const mat = room.sortingMats[familyId];
  const baseY = 0.085 + stackIdx * 0.225;
  // Subtle natural handmade offset so tall stacks look authentically hand-piled!
  const jitterX = (stackIdx % 2 === 0 ? 1 : -1) * Math.min(0.05, stackIdx * 0.018);
  const rotY = (stackIdx % 2 === 0 ? 1 : -1) * 0.06;
  const targetPos = new THREE.Vector3(mat.baseX + jitterX, baseY, mat.baseZ);

  bundle.rotation.y = rotY;
  bundle.userData.familyId = familyId;
  bundle.userData.kind = 'pile_bundle';

  launchArc(bundle, dropPos, targetPos, {
    duration: 0.28,
    peakY: Math.max(dropPos.y, targetPos.y) + 0.55,
    spin: 0,
    onDone: () => {
      bundle.position.copy(targetPos);
      bundle.rotation.set(0, rotY, 0);
      pile.push({
        mesh: bundle,
        spec,
        baseX: targetPos.x,
        baseY: targetPos.y,
        baseZ: targetPos.z,
        rotY,
        wobble: 0,
        wobbleVel: 5.5,
      });

      mat.pulse = 1.0;
      audio.playPileLand(pile.length, familyId);
      particles.burst(targetPos.clone().add(new THREE.Vector3(0, 0.2, 0)), {
        count: 9,
        colors: [FAMILY[familyId].color, '#fff8ec'],
        kind: 'heart',
        speed: 1.5,
        upward: 1.9,
      });
      room.dolls[familyId].setMood('happy', 2.2);

      // Wobble existing stack playfully when stacking high!
      if (pile.length >= 2) {
        wobblePile(familyId, 3.5 + pile.length * 1.4);
      }

      // When pile reaches target height for this round, crack open the matching drawer!
      const drawer = room.drawers[familyId];
      if (pile.length >= targetPerFamily && drawer.state === 'closed') {
        setTimeout(() => {
          if (room.drawers[familyId].state === 'closed') {
            room.setDrawerState(familyId, 'ajar');
            audio.playDrawerSlide(true);
            room.dolls[familyId].setMood('eager', 3.5);
          }
        }, 320);
      }

      // Spawn next laundry item from basket!
      setTimeout(() => {
        spawnNextGarment(false);
      }, 360);
    },
  });
}

// --- PLAYFUL SIZE-MISMATCH REACTION (NEVER A BUZZER OR PUNISHMENT!) ---
function playMismatchBounce(wrongFamilyId) {
  if (!activeGarment) return;
  const ownerId = activeGarment.spec.familyId;

  audio.playMismatchGiggle(wrongFamilyId);
  room.dolls[wrongFamilyId].setMood('surprised', 1.8);
  // Real owner waves eagerly to help guide without words!
  room.dolls[ownerId].setMood('eager', 2.8);

  const startPos = activeGarment.root.position.clone();
  const returnPos = new THREE.Vector3(LAYOUT.foldingMatPos.x, 0.085, LAYOUT.foldingMatPos.z);
  garmentAnim = {
    kind: 'bounce_back',
    start: startPos,
    end: returnPos,
    age: 0,
    duration: 0.44,
  };
}

// --- WOBBLE A COLOR PILE PLAYFULLY ---
function wobblePile(familyId, strength = 4.5) {
  const pile = piles[familyId];
  pile.forEach((item, idx) => {
    const dir = idx % 2 === 0 ? 1 : -1;
    item.wobbleVel += dir * strength * (0.5 + idx * 0.45);
  });
}

// --- TUCK AN ENTIRE COLOR PILE INTO ITS OPEN DRAWER! ---
function tuckPileIntoDrawer(familyId) {
  const drawer = room.drawers[familyId];
  const pile = piles[familyId];
  if (!drawer || drawer.state !== 'open' || pile.length === 0) return false;

  const itemsToTuck = pile.splice(0, pile.length);
  drawer.pendingTuckCount += itemsToTuck.length;
  itemsToTuck.forEach((entry, idx) => {
    const startPos = entry.mesh.position.clone();
    const existingCount = drawer.tuckedItems.length + idx;
    const col = existingCount % 2;
    const row = Math.floor(existingCount / 2);
    const localTarget = new THREE.Vector3(
      (col === 0 ? -0.36 : 0.36) * (itemsToTuck.length === 1 && drawer.tuckedItems.length === 0 ? 0 : 1),
      0.03 + row * 0.21,
      0.04
    );

    // World target right now inside open drawer cavity
    const worldTarget = localTarget.clone().applyMatrix4(drawer.tuckedContainer.matrixWorld);
    scene.remove(entry.mesh);

    setTimeout(() => {
      launchArc(entry.mesh, startPos, worldTarget, {
        duration: 0.34,
        peakY: Math.max(startPos.y, worldTarget.y) + 0.72,
        spin: 0,
        onDone: () => {
          scene.remove(entry.mesh);
          entry.mesh.scale.setScalar(0.74);
          entry.mesh.position.copy(localTarget);
          entry.mesh.rotation.set(0, 0, 0);
          drawer.tuckedContainer.add(entry.mesh);
          drawer.tuckedItems.push(entry.mesh);
          drawer.pendingTuckCount = Math.max(0, drawer.pendingTuckCount - 1);
          audio.playPileLand(idx + 2, familyId);
          particles.puff(worldTarget.clone().add(new THREE.Vector3(0, 0.25, 0)), FAMILY[familyId].colorLight, 6);
        },
      });
    }, idx * 120);
  });

  room.dolls[familyId].setMood('happy', 2.5);
  return true;
}

// --- CLOSE DRAWER & CELEBRATE FAMILY MEMBER! ---
function closeDrawerAndCheckReward(familyId) {
  const drawer = room.drawers[familyId];
  if (!drawer) return;

  const totalInside = drawer.tuckedItems.length + drawer.pendingTuckCount;
  const hasClothesInside = totalInside > 0;
  room.setDrawerState(familyId, hasClothesInside && totalInside >= targetPerFamily ? 'done' : 'closed');
  audio.playDrawerShut();

  if (hasClothesInside) {
    const doll = room.dolls[familyId];
    const burstPos = doll.root.position.clone().add(new THREE.Vector3(0, 1.0, 0.45));
    particles.burst(burstPos, {
      count: 16,
      colors: [FAMILY[familyId].color, FAMILY[familyId].colorLight, '#ffd859', '#fff8ec'],
      kind: 'mixed',
      speed: 2.6,
      upward: 3.1,
      scale: 1.15,
      life: 1.15,
    });

    if (totalInside >= targetPerFamily && !familyCompletedInRound[familyId]) {
      familyCompletedInRound[familyId] = true;
      doll.equipReward();
      audio.playFamilyCelebrate(familyId);
      checkGrandFinale();
    } else {
      doll.setMood('beaming', 2.2);
      audio.playFamilyCelebrate(familyId);
    }
  }
}

// --- ALL 3 DRAWERS FILLED → GRAND CELEBRATION & FRESH SUNLIT BASKET! ---
function checkGrandFinale() {
  if (!familyCompletedInRound.every(Boolean)) return;

  setTimeout(() => {
    audio.playGrandFinale();
    for (let f = 0; f < 3; f++) {
      room.dolls[f].setMood('beaming', 4.5);
      const pos = room.dolls[f].root.position.clone().add(new THREE.Vector3(0, 1.3, 0.5));
      particles.burst(pos, {
        count: 18,
        colors: ['#f2be35', '#df657a', '#4e84bb', '#fff8ec'],
        kind: 'mixed',
        speed: 3.0,
        upward: 3.6,
        scale: 1.25,
        life: 1.4,
      });
    }

    // After joyful dance, smoothly start the next sunlit laundry wave!
    setTimeout(() => {
      currentRound += 1;
      targetPerFamily = 3;
      familyCompletedInRound[0] = false;
      familyCompletedInRound[1] = false;
      familyCompletedInRound[2] = false;

      // Clear tucked drawer interiors cleanly for the fresh round while keeping dolls' cute outfits!
      for (const d of room.drawers) {
        while (d.tuckedContainer.children.length > 0) {
          d.tuckedContainer.remove(d.tuckedContainer.children[0]);
        }
        d.tuckedItems.length = 0;
        room.setDrawerState(d.familyId, 'closed');
      }

      laundryQueue = buildLaundryWave(currentRound);
      room.setBasketFillCount(laundryQueue.length);
      room.jiggleBasket();
      if (!activeGarment) spawnNextGarment(false);
    }, 2600);
  }, 550);
}

// --- IDLE FELT MITTEN HINT (ONLY ONCE AFTER 8+ SECONDS IDLE!) ---
function computeIdleHintPath() {
  // Priority 1: If a drawer is open and its color pile has clothes → show sliding pile into open drawer
  for (let f = 0; f < 3; f++) {
    if (room.drawers[f].state === 'open' && piles[f].length > 0) {
      return {
        start: new THREE.Vector3(FAMILY[f].matX, 0.55, LAYOUT.sortingMatZ),
        end: new THREE.Vector3(FAMILY[f].matX, 0.72, LAYOUT.chestFrontZ + 0.55),
      };
    }
    // Priority 2: If a drawer is open and already has clothes inside with empty pile → show pushing shut
    if (room.drawers[f].state === 'open' && piles[f].length === 0 && room.drawers[f].tuckedItems.length > 0) {
      return {
        start: new THREE.Vector3(FAMILY[f].matX, 0.85, LAYOUT.chestFrontZ + LAYOUT.drawerOpenZ + 0.25),
        end: new THREE.Vector3(FAMILY[f].matX, 0.85, LAYOUT.chestFrontZ + 0.05),
      };
    }
    // Priority 3: If a drawer is ajar → show pulling the wooden button handle forward
    if (room.drawers[f].state === 'ajar') {
      return {
        start: new THREE.Vector3(FAMILY[f].matX, 0.85, LAYOUT.chestFrontZ + LAYOUT.drawerAjarZ + 0.2),
        end: new THREE.Vector3(FAMILY[f].matX, 0.85, LAYOUT.chestFrontZ + LAYOUT.drawerOpenZ + 0.2),
      };
    }
  }

  if (activeGarment && !garmentAnim) {
    if (!activeGarment.isFolded) {
      const st = activeGarment.getActiveStep();
      if (st) {
        const start = st.flapCenterLocal.clone().add(activeGarment.root.position);
        start.y = 0.42;
        const end = start.clone().addScaledVector(st.dragDirWorld, st.dragDist * 0.95);
        return { start, end };
      }
    } else {
      // Folded bundle ready to sort onto matching color mat!
      const fId = activeGarment.spec.familyId;
      return {
        start: activeGarment.root.position.clone().add(new THREE.Vector3(0, 0.45, 0)),
        end: new THREE.Vector3(FAMILY[fId].matX, 0.45, LAYOUT.sortingMatZ),
      };
    }
  }
  return null;
}

function resetIdle() {
  idleSeconds = 0;
  hintActive = false;
  room.hintHand.visible = false;
}

// --- ONE-FINGER POINTER INPUT ---
function onPointerDown(e) {
  if (activePointerId !== null) return; // Multi-touch safe: ignore secondary fingers!
  activePointerId = e.pointerId;
  audio.unlock();
  resetIdle();

  dragStartScreen.x = e.clientX;
  dragStartScreen.y = e.clientY;
  dragMovedDist = 0;
  screenToWorld(e.clientX, e.clientY, tablePlane, dragStartWorld);
  dragCurrentWorld.copy(dragStartWorld);
  focusWorldPos.copy(dragStartWorld);

  // 1. Check direct interactive props on the active garment first (clothespin, pocket!)
  if (activeGarment && !garmentAnim) {
    const garmentHits = raycastScene(e.clientX, e.clientY, [activeGarment.root]);
    for (const h of garmentHits) {
      if (h.object.userData?.kind === 'clothespin') {
        triggerClothespinSnap();
        activePointerId = null;
        return;
      }
      if (h.object.userData?.kind === 'pocket') {
        triggerPocketPop();
        activePointerId = null;
        return;
      }
    }

    // 2. If garment is unfolded, check if touching near the active garment to fold!
    const localPt = dragStartWorld.clone().sub(activeGarment.root.position);
    if (!activeGarment.isFolded) {
      const st = activeGarment.getActiveStep();
      const insideGarment = Math.abs(localPt.x) < 1.65 && Math.abs(localPt.z) < 1.25;
      if (st && insideGarment) {
        dragMode = 'fold';
        audio.playFabricRustle(0.45, 1.05);
        return;
      }
    } else {
      // Folded bundle ready to pick up & drag to a family's color mat!
      const distToBundle = Math.hypot(localPt.x, localPt.z);
      if (distToBundle < 1.05) {
        dragMode = 'bundle';
        activeGarment.patSquish();
        audio.playFabricRustle(0.55, 1.15);
        return;
      }
    }
  }

  // 3. Check Drawer Handles & Open Drawer Cavities
  const drawerColliders = [];
  for (const d of room.drawers) {
    drawerColliders.push(d.handleCollider, d.cavityCollider);
  }
  const drawerHits = raycastScene(e.clientX, e.clientY, drawerColliders);
  if (drawerHits.length > 0) {
    const hitData = drawerHits[0].object.userData;
    const fId = hitData.familyId;
    const drawer = room.drawers[fId];
    if (hitData.kind === 'drawer_cavity' && drawer.state === 'open' && piles[fId].length > 0) {
      // Tapping an open drawer cavity while its pile is waiting right in front tucks the pile in!
      tuckPileIntoDrawer(fId);
      activePointerId = null;
      return;
    }
    dragMode = 'drawer';
    dragFamilyId = fId;
    dragDrawerStartZ = drawer.currentZ;
    return;
  }

  // 4. Check Color Piles (drag pile into open drawer, or pat/wobble the stack!)
  for (let f = 0; f < 3; f++) {
    const mat = room.sortingMats[f];
    const dist = Math.hypot(dragStartWorld.x - mat.baseX, dragStartWorld.z - mat.baseZ);
    if (dist < 0.92 && piles[f].length > 0) {
      dragMode = 'pile';
      dragFamilyId = f;
      wobblePile(f, 4.2);
      audio.playPatSquish(0.95 + f * 0.12);
      return;
    }
  }

  // 5. Check Family Dolls, Laundry Basket, Trinket Dish (joyful secondary toy reactions!)
  const toyTargets = [
    ...room.dolls.map((d) => d.hitCollider),
    room.basketGroup,
    room.dishGroup,
  ];
  const toyHits = raycastScene(e.clientX, e.clientY, toyTargets);
  if (toyHits.length > 0) {
    let obj = toyHits[0].object;
    while (obj && !obj.userData?.kind && obj.parent) obj = obj.parent;
    const kind = obj?.userData?.kind;
    if (kind === 'doll') {
      const fId = obj.userData.familyId;
      room.dolls[fId].poke();
      audio.playPatSquish(fId === 0 ? 1.35 : fId === 1 ? 1.05 : 0.78);
      particles.burst(room.dolls[fId].root.position.clone().add(new THREE.Vector3(0, 1.3, 0.45)), {
        count: 6,
        colors: [FAMILY[fId].color, '#fff8ec'],
        kind: 'heart',
        speed: 1.4,
        upward: 1.7,
        scale: 0.75,
      });
    } else if (kind === 'basket') {
      room.jiggleBasket();
      audio.playBasketPop();
      particles.puff(room.basketGroup.position.clone().add(new THREE.Vector3(0, 1.05, 0)), '#fff7e8', 5);
    } else if (kind === 'dish') {
      room.jiggleDish();
      audio.playTrinketChime(Math.floor(Math.random() * 6));
    }
    activePointerId = null;
    return;
  }

  activePointerId = null;
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId || !dragMode) return;
  resetIdle();

  dragMovedDist = Math.hypot(e.clientX - dragStartScreen.x, e.clientY - dragStartScreen.y);

  if (dragMode === 'fold' && activeGarment && !activeGarment.isFolded) {
    screenToWorld(e.clientX, e.clientY, tablePlane, dragCurrentWorld);
    focusWorldPos.copy(dragCurrentWorld);

    const st = activeGarment.getActiveStep();
    if (!st) return;
    const delta = dragCurrentWorld.clone().sub(dragStartWorld);
    const proj = delta.dot(st.dragDirWorld);
    const progress = THREE.MathUtils.clamp(proj / st.dragDist, 0, 1);
    activeGarment.setStepProgress(progress);

    const now = performance.now();
    if (now - lastRustleTime > 120 && progress > 0.08 && progress < 0.92) {
      audio.playFabricRustle(0.32, 0.9 + progress * 0.45);
      lastRustleTime = now;
    }

    if (progress >= 0.88) {
      finishCurrentFoldStep();
      dragMode = null;
      activePointerId = null;
    }
  } else if (dragMode === 'bundle' && activeGarment && activeGarment.isFolded) {
    screenToWorld(e.clientX, e.clientY, hoverPlane, dragCurrentWorld);
    focusWorldPos.copy(dragCurrentWorld);

    // Smoothly lift & carry the folded bundle right under the child's finger!
    activeGarment.root.position.x = THREE.MathUtils.clamp(dragCurrentWorld.x, -3.5, 3.5);
    activeGarment.root.position.z = THREE.MathUtils.clamp(dragCurrentWorld.z, -1.8, 2.8);
    activeGarment.root.position.y = 0.56;

    // Highlight nearest matching mat gently if hovering close
    const ownerId = activeGarment.spec.familyId;
    const mat = room.sortingMats[ownerId];
    if (Math.hypot(activeGarment.root.position.x - mat.baseX, activeGarment.root.position.z - mat.baseZ) < 1.1) {
      room.dolls[ownerId].setMood('eager', 0.6);
    }
  } else if (dragMode === 'drawer' && dragFamilyId >= 0) {
    screenToWorld(e.clientX, e.clientY, tablePlane, dragCurrentWorld);
    const dz = dragCurrentWorld.z - dragStartWorld.z;
    const drawer = room.drawers[dragFamilyId];
    drawer.targetZ = THREE.MathUtils.clamp(dragDrawerStartZ + dz * 1.1, 0, LAYOUT.drawerOpenZ);
  } else if (dragMode === 'pile' && dragFamilyId >= 0) {
    screenToWorld(e.clientX, e.clientY, tablePlane, dragCurrentWorld);
    const dz = dragCurrentWorld.z - dragStartWorld.z;
    const drawer = room.drawers[dragFamilyId];
    // Swiping the pile backward toward its open drawer smoothly tucks it right in!
    if (drawer.state === 'open' && dz < -0.45) {
      tuckPileIntoDrawer(dragFamilyId);
      dragMode = null;
      activePointerId = null;
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;

  if (dragMode === 'fold' && activeGarment && !activeGarment.isFolded) {
    const st = activeGarment.getActiveStep();
    const localStart = dragStartWorld.clone().sub(activeGarment.root.position);
    const nearFlap =
      st &&
      Math.abs(localStart.x - st.flapCenterLocal.x) <= st.flapHalfSize.x * 1.15 &&
      Math.abs(localStart.z - st.flapCenterLocal.z) <= st.flapHalfSize.z * 1.15;

    // Forgiving rule: past 34% drag OR a direct tap on the lifted flap completes the fold ("ぱたん!")!
    if (activeGarment.stepProgress >= 0.34 || (dragMovedDist < 22 && nearFlap)) {
      finishCurrentFoldStep();
    } else {
      // Gentle soft squish back to lifted curl
      activeGarment.setStepProgress(0.08);
      activeGarment.patSquish();
    }
  } else if (dragMode === 'bundle' && activeGarment && activeGarment.isFolded) {
    // Check if dropped near any of the 3 color mats (or open drawer!)
    const pos = activeGarment.root.position;
    let bestMat = -1;
    let bestDist = 1.38; // Generous magnetic drop radius for 5-year-old!
    for (let f = 0; f < 3; f++) {
      const mat = room.sortingMats[f];
      const d = Math.hypot(pos.x - mat.baseX, pos.z - mat.baseZ);
      if (d < bestDist) {
        bestDist = d;
        bestMat = f;
      }
    }

    if (bestMat >= 0) {
      if (bestMat === activeGarment.spec.familyId) {
        placeBundleOnPile(bestMat);
      } else {
        playMismatchBounce(bestMat);
      }
    } else {
      // Dropped outside mats — softly return onto the folding pad!
      garmentAnim = {
        kind: 'bounce_back',
        start: pos.clone(),
        end: new THREE.Vector3(LAYOUT.foldingMatPos.x, 0.085, LAYOUT.foldingMatPos.z),
        age: 0,
        duration: 0.32,
      };
      audio.playPatSquish(1.0);
    }
  } else if (dragMode === 'drawer' && dragFamilyId >= 0) {
    const fId = dragFamilyId;
    const drawer = room.drawers[fId];
    const wasTap = dragMovedDist < 20;

    if (wasTap) {
      // Single tap toggles open/shut intuitively!
      if (drawer.state === 'open') {
        if (piles[fId].length > 0 && drawer.tuckedItems.length === 0) {
          // If pile is sitting right in front of open drawer, tuck it in first!
          tuckPileIntoDrawer(fId);
        } else {
          closeDrawerAndCheckReward(fId);
        }
      } else {
        room.setDrawerState(fId, 'open');
        audio.playDrawerSlide(true);
        room.dolls[fId].setMood('eager', 2.4);
      }
    } else {
      // Snap based on how far child pulled or pushed!
      if (drawer.targetZ > LAYOUT.drawerOpenZ * 0.45) {
        room.setDrawerState(fId, 'open');
        audio.playDrawerSlide(true);
      } else {
        closeDrawerAndCheckReward(fId);
      }
    }
  } else if (dragMode === 'pile' && dragFamilyId >= 0) {
    const fId = dragFamilyId;
    const drawer = room.drawers[fId];
    // Tapping a color pile when its drawer is already open neatly pops the pile into the drawer!
    if (dragMovedDist < 22 && drawer.state === 'open' && piles[fId].length > 0) {
      tuckPileIntoDrawer(fId);
    } else if (dragMovedDist < 22 && piles[fId].length >= targetPerFamily && drawer.state === 'closed') {
      room.setDrawerState(fId, 'ajar');
      audio.playDrawerSlide(true);
    }
  }

  dragMode = null;
  dragFamilyId = -1;
  activePointerId = null;
}

const domEl = renderer.domElement;
domEl.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// Spawn first garment right onto the folding mat immediately so play begins on frame 1!
spawnNextGarment(true);

// --- ANIMATION LOOP ---
let lastTime = performance.now();
let elapsed = 0;
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  fpsFrames += 1;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAccum);
    fpsFrames = 0;
    fpsAccum = 0;
  }

  // Update garment spawn / bounce-back animation
  if (activeGarment && garmentAnim) {
    garmentAnim.age += dt;
    const t = Math.min(1, garmentAnim.age / garmentAnim.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    activeGarment.root.position.lerpVectors(garmentAnim.start, garmentAnim.end, ease);
    const arcY = Math.sin(t * Math.PI) * (garmentAnim.kind === 'spawn' ? 1.15 : 0.72);
    activeGarment.root.position.y += arcY;
    if (garmentAnim.kind === 'spawn') {
      activeGarment.root.scale.setScalar(0.35 + 0.77 * ease);
    }
    if (t >= 1) {
      activeGarment.root.position.copy(garmentAnim.end);
      activeGarment.root.scale.setScalar(1.12);
      activeGarment.patSquish();
      garmentAnim = null;
    }
  }

  // Update active garment cloth breathing / squish
  if (activeGarment) {
    activeGarment.update(dt, elapsed, dragMode === 'fold');
    if (dragMode !== 'bundle' && !garmentAnim) {
      focusWorldPos.lerp(activeGarment.root.position, Math.min(1, dt * 3));
    }
  }

  // Update stacked color piles spring-wobble physics!
  for (let f = 0; f < 3; f++) {
    const pile = piles[f];
    for (let i = 0; i < pile.length; i++) {
      const p = pile[i];
      p.wobbleVel += (-36 * p.wobble - 5.2 * p.wobbleVel) * dt;
      p.wobble += p.wobbleVel * dt;
      p.mesh.position.x = p.baseX + p.wobble * 0.032 * (i + 1);
      p.mesh.rotation.z = -p.wobble * 0.055 * (i + 0.5);
    }
  }

  // Update flying arcs (clothespins, treasures, tucking bundles)
  for (let i = flyingObjects.length - 1; i >= 0; i--) {
    const fo = flyingObjects[i];
    fo.age += dt;
    const t = Math.min(1, fo.age / fo.duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    fo.mesh.position.lerpVectors(fo.start, fo.end, ease);
    fo.mesh.position.y += Math.sin(t * Math.PI) * (fo.peakY - Math.max(fo.start.y, fo.end.y) * 0.35);
    if (fo.spin) {
      fo.mesh.rotation.x += fo.spin * dt;
      fo.mesh.rotation.y += fo.spin * 0.7 * dt;
    }
    if (t >= 1) {
      flyingObjects.splice(i, 1);
      if (fo.onDone) fo.onDone();
    }
  }

  // Idle felt mitten hand (ONLY demonstrates once after 8.5s of no touch!)
  if (activePointerId === null && !garmentAnim) {
    if (hintCooldown > 0) {
      hintCooldown -= dt;
    } else if (!hintActive) {
      idleSeconds += dt;
      if (idleSeconds >= 8.5) {
        const path = computeIdleHintPath();
        if (path) {
          hintStartPos.copy(path.start);
          hintEndPos.copy(path.end);
          hintActive = true;
          hintProgress = 0;
          room.hintHand.visible = true;
        } else {
          idleSeconds = 0;
        }
      }
    } else {
      hintProgress += dt * 0.72;
      if (hintProgress >= 1.25) {
        hintActive = false;
        room.hintHand.visible = false;
        idleSeconds = 0;
        hintCooldown = 9.0; // Only demonstrates once, then waits patiently!
      } else {
        const t = THREE.MathUtils.clamp(hintProgress, 0, 1);
        const ease = t * t * (3 - 2 * t);
        room.hintHand.position.lerpVectors(hintStartPos, hintEndPos, ease);
        room.hintHand.position.y += Math.sin(t * Math.PI) * 0.38;
        const s = hintProgress > 1 ? Math.max(0.01, 1 - (hintProgress - 1) * 4) : Math.min(1, hintProgress * 5);
        room.hintHand.scale.setScalar(s);
      }
    }
  }

  room.update(dt, elapsed, focusWorldPos);
  particles.update(dt, elapsed);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Lightweight read-only debug handle for automated visual/perf checks (zero UI impact)
window.__LAUNDRY_DEBUG__ = {
  getStats() {
    return {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      fps: currentFps,
      pixelRatio: renderer.getPixelRatio(),
      round: currentRound,
      queueLeft: laundryQueue.length,
      activeGarment: activeGarment
        ? {
            type: activeGarment.spec.type,
            familyId: activeGarment.spec.familyId,
            step: activeGarment.currentStepIdx,
            totalSteps: activeGarment.steps.length,
            isFolded: activeGarment.isFolded,
            hasPin: Boolean(activeGarment.clothespin),
            hasPocket: Boolean(activeGarment.pocketGroup && !activeGarment.pocketPopped),
          }
        : null,
      piles: piles.map((p) => p.length),
      drawers: room.drawers.map((d) => ({ state: d.state, tucked: d.tuckedItems.length })),
      trinkets: room.trinketItems.length,
    };
  },
  // Helper actions for automated visual verification of all game states
  stepFold() {
    finishCurrentFoldStep();
  },
  sortActive() {
    if (activeGarment && activeGarment.isFolded) {
      placeBundleOnPile(activeGarment.spec.familyId);
    }
  },
  openDrawer(fId) {
    room.setDrawerState(fId, 'open');
  },
  tuckPile(fId) {
    tuckPileIntoDrawer(fId);
  },
  closeDrawer(fId) {
    closeDrawerAndCheckReward(fId);
  },
  captureFrame(outW = 800, outH = 600, quality = 0.85) {
    renderer.render(scene, camera);
    const tmp = document.createElement('canvas');
    tmp.width = outW;
    tmp.height = outH;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, outW, outH);
    return tmp.toDataURL('image/jpeg', quality);
  },
};
