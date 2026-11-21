import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { KitchenAudio } from './audio.js';
import { createKitchen } from './kitchen.js';
import { DISH_RECIPES, DishInstance, createRewardCake } from './dishes.js';
import { WaterFoamSystem } from './waterFoam.js';
import { createPlayerHand, createMomCharacter } from './characters.js';

const app = document.getElementById('app');

// ------------------------------------------------------------------
// 1. Renderer, Scene, Camera, Lighting (Photorealistic Kitchen Setup)
// ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // Helpful for crisp thumbnails
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe5dfd5);

// Realistic Studio/Room IBL reflections for stainless steel, wet ceramic, glass, and bubbles
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.62;

// Camera (auto-fits portrait iPhone, landscape iPad, and 4:3 / 16:9 screens)
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.08, 18);
const camLookTarget = new THREE.Vector3(0.03, 0.14, -0.14);

function updateCameraLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  renderer.setSize(w, h);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // Portrait iPhone: frames Mom (top), soap (left), sponge & dirty plate (center), faucet, and dish rack (right)!
    camera.fov = 54;
    camera.position.set(0.04, 1.02, 1.82);
    camLookTarget.set(0.04, 0.11, -0.12);
  } else if (aspect < 1.25) {
    // Square / near-square tablet
    camera.fov = 46;
    camera.position.set(0.03, 0.84, 1.48);
    camLookTarget.set(0.03, 0.14, -0.14);
  } else {
    // Landscape iPad / 4:3 / 16:9 desktop
    camera.fov = 44;
    camera.position.set(0.03, 0.72, 1.32);
    camLookTarget.set(0.03, 0.15, -0.14);
  }
  camera.lookAt(camLookTarget);
  camera.updateProjectionMatrix();
}
updateCameraLayout();
window.addEventListener('resize', updateCameraLayout);

// Warm morning kitchen sunlight streaming from the back-left window + rich interior contrast
const hemiLight = new THREE.HemisphereLight(0xfff6e8, 0x9b8977, 0.44);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff1dc, 1.65);
sunLight.position.set(-1.1, 2.25, 1.05);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 6.0;
sunLight.shadow.camera.left = -1.5;
sunLight.shadow.camera.right = 1.5;
sunLight.shadow.camera.top = 1.4;
sunLight.shadow.camera.bottom = -1.0;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.014;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xd6ebff, 0.45);
fillLight.position.set(1.5, 1.0, 0.9);
scene.add(fillLight);

// ------------------------------------------------------------------
// 2. Build Kitchen, Dishes, Water/Foam, Audio, Hand & Mom
// ------------------------------------------------------------------
const audio = new KitchenAudio();
const kitchen = createKitchen(scene);
const waterFoam = new WaterFoamSystem(scene, kitchen);
const playerHand = createPlayerHand(scene);
const mom = createMomCharacter(scene);
const rewardCake = createRewardCake();
rewardCake.position.set(0.0, 0.02, 0.08);
scene.add(rewardCake);

// Build all 5 dishes
const dishes = DISH_RECIPES.map((recipe, idx) => {
  const d = new DishInstance(recipe, idx);
  scene.add(d.group);
  return d;
});

// Dish positions & poses
const WASH_POS_PLATE = new THREE.Vector3(0.0, -0.045, 0.035);
const WASH_ROT_PLATE = new THREE.Euler(0.46, 0.0, 0.0);
const WASH_POS_CUP = new THREE.Vector3(0.0, -0.085, 0.035);
const WASH_ROT_CUP = new THREE.Euler(0.22, -0.3, 0.14);

const STACK_BASE = new THREE.Vector3(-0.72, 0.0, -0.26);

function positionWaitingStack() {
  let plateStackIdx = 0;
  let cupIdx = 0;
  for (const d of dishes) {
    if (d.state === 'waiting') {
      if (d.isCup) {
        // Stand mug & glass neatly beside the stacked plates (zero clipping!)
        d.group.position.set(
          -0.55 - cupIdx * 0.16,
          0.0,
          -0.31 - cupIdx * 0.03
        );
        d.group.rotation.set(0, 0.35 + cupIdx * 0.5, 0);
        cupIdx++;
      } else {
        d.group.position.set(
          STACK_BASE.x + (plateStackIdx % 2) * 0.012,
          STACK_BASE.y + plateStackIdx * 0.045,
          STACK_BASE.z
        );
        d.group.rotation.set(0, plateStackIdx * 0.35, 0);
        plateStackIdx++;
      }
      d.group.visible = true;
    }
  }
}

// ------------------------------------------------------------------
// 3. Game State
// ------------------------------------------------------------------
const state = {
  currentDishIndex: 0,
  activeDish: null,
  dishAnim: null, // { dish, fromPos, toPos, fromRot, toRot, t, duration, onDone }
  rackedCount: 0,
  celebrating: false,

  // Soap & sponge
  spongeSoap: 0, // 0 .. 1.5
  spongeFoam: 0, // 0 .. 1.5
  pumpPressAnim: 0,
  soapPressCount: 0,
  spongeDragging: false,
  spongeWorldPos: kitchen.spongeHomePos.clone(),
  spongeTargetPos: kitchen.spongeHomePos.clone(),
  spongeVelocity: 0,
  scrubDistanceAccum: 0,
  drySqueakCooldown: 0,

  // Faucet & drain plug
  faucetOn: false,
  waterFlow: 0, // smoothed 0..1
  isPlugged: false,
  overflowReacted: false,

  // Dish carrying to rack
  dishDragging: false,
  dishCarryOffset: new THREE.Vector3(),

  // Gentle idle hint (wordless rule: nothing for 0-10s, then 1 soft hand demo)
  lastInteractionTime: performance.now() * 0.001,
  hintActive: false,
  hintTimer: 0,
  hintShownForPhase: '',
};

function bringDishToSink(index) {
  if (index >= dishes.length) {
    triggerFinalCelebration();
    return;
  }
  state.currentDishIndex = index;
  const dish = dishes[index];
  state.activeDish = dish;
  dish.state = 'washing';
  positionWaitingStack();

  const targetPos = dish.isCup ? WASH_POS_CUP.clone() : WASH_POS_PLATE.clone();
  const targetRot = dish.isCup ? WASH_ROT_CUP.clone() : WASH_ROT_PLATE.clone();

  state.dishAnim = {
    dish,
    fromPos: dish.group.position.clone(),
    toPos: targetPos,
    fromRot: dish.group.rotation.clone(),
    toRot: targetRot,
    t: 0,
    duration: 0.65,
    arcHeight: 0.22,
    onDone: () => {
      audio.playDishClink(dish.recipe.materialType, 0);
    },
  };
  mom.setMood('curious', 2.0, false);
}

function sendActiveDishToRack() {
  const dish = state.activeDish;
  if (!dish || dish.state === 'racked' || state.dishAnim) return;

  dish.state = 'racked';
  for (const c of dish.crumbs) {
    c.gone = true;
    c.mesh.visible = false;
  }
  state.dishDragging = false;
  waterFoam.clearDishSuds();

  const slotIdx = Math.min(state.rackedCount, kitchen.slotPositions.length - 1);
  const slotPos = kitchen.slotPositions[slotIdx].clone();
  const slotRot = dish.isCup
    ? new THREE.Euler(Math.PI, 0.4, 0) // Cups rest neatly upside-down to drain!
    : new THREE.Euler(Math.PI / 2 - 0.18, 0.0, 0.0); // Plates stand upright in rack dividers!
  if (dish.isCup) {
    slotPos.y = 0.21;
    slotPos.x += 0.05;
  }

  state.rackedCount++;
  const nextIndex = state.currentDishIndex + 1;

  state.dishAnim = {
    dish,
    fromPos: dish.group.position.clone(),
    toPos: slotPos,
    fromRot: dish.group.rotation.clone(),
    toRot: slotRot,
    t: 0,
    duration: 0.62,
    arcHeight: 0.26,
    withHand: true,
    onDone: () => {
      audio.playDishClink(dish.recipe.materialType, slotIdx);
      waterFoam.spawnSparkles(slotPos, 7, 0.14);
      mom.setMood('joy', 2.5, true);
      playerHand.rest();

      // Turn faucet off gently if we're moving to the final celebration
      if (nextIndex >= dishes.length) {
        state.faucetOn = false;
      }

      setTimeout(() => {
        bringDishToSink(nextIndex);
      }, 450);
    },
  };
}

function triggerFinalCelebration() {
  state.celebrating = true;
  state.activeDish = null;
  state.faucetOn = false;
  state.spongeDragging = false;
  state.spongeTargetPos.copy(kitchen.spongeHomePos);
  playerHand.rest();

  // Ensure all dishes sit sparkling in the drying rack if jumped directly
  for (let i = 0; i < dishes.length; i++) {
    const d = dishes[i];
    if (d.state !== 'racked') {
      d.state = 'racked';
      d.dirtCtx.clearRect(0, 0, d.texSize, d.texSize);
      d.foamCtx.clearRect(0, 0, d.texSize, d.texSize);
      d.dirtTexture.needsUpdate = true;
      d.foamTexture.needsUpdate = true;
      d.wetDropGroup.visible = true;
      for (const c of d.crumbs) {
        c.gone = true;
        c.mesh.visible = false;
      }
      const slotPos = kitchen.slotPositions[Math.min(i, kitchen.slotPositions.length - 1)].clone();
      if (d.isCup) {
        slotPos.y = 0.21;
        slotPos.x += 0.05;
        d.group.rotation.set(Math.PI, 0.4, 0);
      } else {
        d.group.rotation.set(Math.PI / 2 - 0.18, 0, 0);
      }
      d.group.position.copy(slotPos);
    }
  }

  audio.playCelebrationClaps();
  mom.setMood('joy', 6.0, true);

  // Serve the strawberry shortcake reward cleanly on the wooden counter right in front!
  rewardCake.visible = true;
  rewardCake.scale.setScalar(0.01);
  rewardCake.position.set(0.02, 0.0, 0.36);

  // Festive floating rainbow bubbles & delicate sparkles
  for (let i = 0; i < 7; i++) {
    waterFoam.spawnFloatingBubble(
      new THREE.Vector3((Math.random() - 0.5) * 0.75, 0.14 + Math.random() * 0.22, -0.05),
      0.048
    );
  }
  waterFoam.spawnSparkles(new THREE.Vector3(0.02, 0.14, 0.36), 8, 0.18);
  waterFoam.spawnSparkles(new THREE.Vector3(0.64, 0.22, -0.02), 6, 0.16);
}

function resetRoundForEndlessPlay() {
  rewardCake.visible = false;
  state.celebrating = false;
  state.rackedCount = 0;
  state.spongeSoap = 0;
  state.spongeFoam = 0;
  kitchen.soapPuddle.visible = false;
  for (const d of dishes) {
    d.resetForReplay();
  }
  positionWaitingStack();
  bringDishToSink(0);
}

// Start with Dish #1 right in the sink so the child sees dirty dish, soap, sponge, faucet, and empty rack immediately!
dishes[0].state = 'washing';
dishes[0].group.position.copy(WASH_POS_PLATE);
dishes[0].group.rotation.copy(WASH_ROT_PLATE);
state.activeDish = dishes[0];
positionWaitingStack();

// ------------------------------------------------------------------
// 4. Single-Finger Intuitive Pointer Controls (Touch & Mouse)
// ------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.06);
const dragIntersect = new THREE.Vector3();

let activePointerId = null;
let dragMode = null; // 'sponge' | 'dish' | 'water' | null
let lastDragWorld = new THREE.Vector3();
let downPos = { x: 0, y: 0 };

function updatePointerNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function markInteracted() {
  state.lastInteractionTime = performance.now() * 0.001;
  state.hintActive = false;
}

function pumpSoap() {
  audio.playSoapPump();
  state.pumpPressAnim = 1.0;
  state.soapPressCount++;

  // Animate player hand pressing the pump briefly
  const bottleTop = kitchen.soapBottleGroup.position.clone().add(new THREE.Vector3(0.02, 0.34, 0.04));
  playerHand.setTarget(bottleTop, 'press');
  setTimeout(() => {
    if (!state.spongeDragging && !state.dishDragging) playerHand.rest();
  }, 320);

  // Launch glossy green detergent droplet onto the sponge!
  const start = kitchen.getSoapNozzleWorld(new THREE.Vector3());
  const end = state.spongeWorldPos.clone().add(new THREE.Vector3(0, 0.036, 0));
  waterFoam.launchSoapDrop(start, end, () => {
    state.spongeSoap = Math.min(1.5, state.spongeSoap + 0.65);
    state.spongeFoam = Math.min(1.5, state.spongeFoam + 0.38);
    kitchen.soapPuddle.visible = true;
    const pScale = 0.75 + Math.min(0.65, state.spongeSoap * 0.45);
    kitchen.soapPuddle.scale.set(1.25 * pScale, 0.26, 0.92 * pScale);

    // Foam bursts right on the sponge!
    for (let i = 0; i < 6; i++) {
      waterFoam.spawnSud(
        'sponge',
        new THREE.Vector3((Math.random() - 0.5) * 0.11, 0.028 + Math.random() * 0.02, (Math.random() - 0.5) * 0.075),
        0.017 + Math.random() * 0.014,
        14
      );
    }

    // Extra pumps create fun big iridescent bubbles!
    if (state.spongeSoap > 0.9 || waterFoam.waterFill > 0.12) {
      waterFoam.basinSoapLevel = Math.min(1, waterFoam.basinSoapLevel + 0.35);
      waterFoam.spawnFloatingBubble(end.clone().add(new THREE.Vector3(0, 0.06, 0)), 0.044);
      mom.setMood('amazed', 2.0, false);
    }
  });
}

function toggleFaucet() {
  state.faucetOn = !state.faucetOn;
  audio.playFaucetToggle(state.faucetOn);

  const leverWorld = new THREE.Vector3(0.11, 0.12, -0.32);
  playerHand.setTarget(leverWorld, 'press');
  setTimeout(() => {
    if (!state.spongeDragging && !state.dishDragging) playerHand.rest();
  }, 280);

  if (state.faucetOn) {
    waterFoam.spawnSplashBurst(new THREE.Vector3(0, 0.02, 0), 6, 0.55);
  }
}

function toggleDrainPlug() {
  state.isPlugged = !state.isPlugged;
  audio.playDrainPlug(state.isPlugged);
  if (!state.isPlugged && waterFoam.waterFill > 0.1) {
    audio.playDrainGlug();
    state.overflowReacted = false;
  }
}

function getInteractiveTargets() {
  const list = [
    kitchen.soapBottleGroup,
    kitchen.spongeGroup,
    kitchen.faucetGroup,
    kitchen.drainPlugGroup,
    kitchen.rackGroup,
  ];
  if (waterFoam.sinkWater.visible) list.push(waterFoam.sinkWater);
  for (const b of waterFoam.floatingBubbles) {
    if (b.active) list.push(b.mesh);
  }
  for (const d of dishes) {
    if (d.state === 'washing' || d.state === 'clean_ready' || d.state === 'racked') {
      list.push(d.group);
    }
  }
  if (rewardCake.visible) list.push(rewardCake);
  return list;
}

function findInteractiveKind(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.interactive) {
      return { kind: cur.userData.interactive, object: cur };
    }
    cur = cur.parent;
  }
  return null;
}

function handlePointerDown(e) {
  if (activePointerId !== null) return; // Single-finger safety: ignore extra simultaneous touches
  activePointerId = e.pointerId;
  audio.unlock();
  markInteracted();
  downPos = { x: e.clientX, y: e.clientY };

  updatePointerNDC(e);
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(getInteractiveTargets(), true);

  for (const hit of hits) {
    const info = findInteractiveKind(hit.object);
    if (!info) continue;

    // 1. Floating rainbow soap bubble -> musical pop!
    if (info.kind === 'floatingBubble') {
      if (waterFoam.popFloatingBubble(info.object.userData.bubbleIndex)) {
        audio.playBubblePop();
        mom.setMood('amazed', 1.4, false);
      }
      return;
    }

    // 2. Reward Strawberry Shortcake!
    if (info.kind === 'rewardCake') {
      audio.playCelebrationClaps();
      waterFoam.spawnSparkles(rewardCake.position.clone().add(new THREE.Vector3(0, 0.14, 0)), 14, 0.22);
      mom.setMood('joy', 2.4, true);
      setTimeout(() => {
        if (state.celebrating) resetRoundForEndlessPlay();
      }, 900);
      return;
    }

    // 3. Detergent bottle -> squirt soap!
    if (info.kind === 'soapBottle') {
      pumpSoap();
      return;
    }

    // 4. Faucet lever -> toggle running water!
    if (info.kind === 'faucet') {
      toggleFaucet();
      return;
    }

    // 5. Rubber drain plug -> plug/unplug sink!
    if (info.kind === 'drainPlug') {
      toggleDrainPlug();
      return;
    }

    // 6. Sponge -> grab & scrub!
    if (info.kind === 'sponge') {
      dragMode = 'sponge';
      state.spongeDragging = true;
      lastDragWorld.copy(state.spongeWorldPos);
      if (state.spongeSoap > 0.05) {
        state.spongeFoam = Math.min(1.5, state.spongeFoam + 0.12);
      }
      return;
    }

    // 7. Active dish:
    // - If spotless & ready -> grab to carry to dish rack!
    // - If dirty/soapy -> generously bring sponge right under finger to scrub!
    // - If racked -> tap to play musical ceramic/glass chime & gently wiggle!
    if (info.kind === 'activeDish') {
      const dish = info.object.userData.dish;
      if (dish.state === 'racked') {
        audio.playDishClink(dish.recipe.materialType, dish.index);
        waterFoam.spawnSparkles(dish.group.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 4, 0.09);
        dish.group.rotation.z = (Math.random() - 0.5) * 0.16;
        return;
      }
      if (dish === state.activeDish) {
        if (dish.state === 'clean_ready') {
          dragMode = 'dish';
          state.dishDragging = true;
          lastDragWorld.copy(dish.group.position);
          return;
        } else {
          // Child touched the dirty dish directly -> smoothly grab sponge right to the dish!
          dragMode = 'sponge';
          state.spongeDragging = true;
          state.spongeTargetPos.copy(hit.point).add(new THREE.Vector3(0, 0.02, 0.02));
          lastDragWorld.copy(hit.point);
          applySpongeScrub(hit);
          return;
        }
      }
    }

    // 8. Dish Rack: if active dish is already sparkling clean, tapping rack neatly places it!
    if (info.kind === 'dishRack') {
      if (state.activeDish && state.activeDish.state === 'clean_ready') {
        sendActiveDishToRack();
      } else {
        // Gentle rattle feedback on empty rack
        audio.playDishClink('ceramic', 2);
      }
      return;
    }

    // 9. Standing sink water -> splash, ripple & bubble overflow fun!
    if (info.kind === 'sinkWater') {
      dragMode = 'water';
      splashWaterAt(hit.point);
      return;
    }
  }
}

function splashWaterAt(point) {
  waterFoam.addRipple(point.x, point.z, 0.02);
  waterFoam.spawnSplashBurst(point.clone().add(new THREE.Vector3(0, 0.02, 0)), 10, 0.85);
  audio.playSplash(0.85);

  // Poking full soapy water makes extra joyful foam spill over!
  if (waterFoam.waterFill > 0.72) {
    for (let i = 0; i < 4; i++) {
      waterFoam.spawnSud(
        'overflow',
        new THREE.Vector3(point.x + (Math.random() - 0.5) * 0.2, 0.025, Math.min(0.32, point.z + 0.18)),
        0.024 + Math.random() * 0.02,
        6.0
      );
    }
    waterFoam.spawnFloatingBubble(point.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.05);
    mom.setMood('amazed', 1.8, false);
  }
}

function applySpongeScrub(hit) {
  const dish = state.activeDish;
  if (!dish || dish.state !== 'washing') return;
  if (!hit.uv) return;

  const hasSoap = state.spongeSoap > 0.05 || state.spongeFoam > 0.08;
  const radius = dish.isCup ? 36 : 30;
  dish.scrubAtUV(hit.uv, hasSoap ? Math.max(state.spongeSoap, state.spongeFoam) : 0, radius);

  // Pop nearby 3D food crumbs off the plate!
  const localPt = dish.group.worldToLocal(hit.point.clone());
  const popped = dish.popNearbyCrumbs(localPt);
  if (popped > 0) {
    audio.playWaterDrop(0.11, 620);
  }

  if (hasSoap) {
    // Rich lathering! Grow foam on sponge and leave 3D fluffy suds on the dish!
    state.spongeFoam = Math.min(1.5, state.spongeFoam + 0.025);
    state.spongeSoap = Math.max(0.08, state.spongeSoap - 0.0025);
    waterFoam.basinSoapLevel = Math.min(1, waterFoam.basinSoapLevel + 0.012);

    if (Math.random() < 0.48) {
      waterFoam.spawnSud(
        'dish',
        hit.point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.014, (Math.random() - 0.5) * 0.04)),
        0.014 + Math.random() * 0.014,
        10
      );
    }
    if (Math.random() < 0.08) {
      waterFoam.spawnFloatingBubble(hit.point.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.04);
    }
  } else if (state.drySqueakCooldown <= 0) {
    // Dry rubbing gives tactile squeak feedback (teaches soap causality without words!)
    audio.playDrySqueak();
    state.drySqueakCooldown = 0.42;
  }
}

function handlePointerMove(e) {
  if (activePointerId !== e.pointerId) return;
  markInteracted();
  updatePointerNDC(e);
  raycaster.setFromCamera(pointerNDC, camera);

  if (dragMode === 'sponge') {
    let hitDish = false;
    if (state.activeDish && state.activeDish.state === 'washing') {
      const dishHits = raycaster.intersectObject(state.activeDish.dirtMesh, false);
      if (dishHits.length > 0) {
        const hit = dishHits[0];
        hitDish = true;
        state.spongeTargetPos.copy(hit.point).add(new THREE.Vector3(0, 0.024, 0.02));
        const moved = state.spongeTargetPos.distanceTo(lastDragWorld);
        state.spongeVelocity = Math.min(1.5, moved * 28);
        if (moved > 0.008) {
          applySpongeScrub(hit);
          lastDragWorld.copy(state.spongeTargetPos);
        }
      }
    }

    if (!hitDish) {
      // Move sponge freely on counter/sink plane; rubbing sponge on its own still lathers soap!
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
        dragIntersect.x = THREE.MathUtils.clamp(dragIntersect.x, -0.68, 0.55);
        dragIntersect.z = THREE.MathUtils.clamp(dragIntersect.z, -0.26, 0.38);
        dragIntersect.y = Math.max(waterFoam.getWaterSurfaceY() + 0.02, 0.035);
        state.spongeTargetPos.copy(dragIntersect);
        const moved = state.spongeTargetPos.distanceTo(lastDragWorld);
        state.spongeVelocity = Math.min(1.5, moved * 22);

        if (moved > 0.015) {
          // Dipping sponge under running water splashes!
          if (state.faucetOn && Math.hypot(dragIntersect.x, dragIntersect.z) < 0.14) {
            waterFoam.spawnSplashBurst(dragIntersect.clone(), 4, 0.7);
            if (state.spongeSoap > 0.05) {
              state.spongeFoam = Math.min(1.5, state.spongeFoam + 0.06);
              waterFoam.spawnFloatingBubble(dragIntersect.clone().add(new THREE.Vector3(0, 0.06, 0)), 0.042);
            }
          } else if (state.spongeSoap > 0.05) {
            // Rubbing soapy sponge creates fluffy lather!
            state.spongeFoam = Math.min(1.5, state.spongeFoam + 0.03);
            if (Math.random() < 0.1) {
              waterFoam.spawnFloatingBubble(dragIntersect.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.038);
            }
          }
          // Swishing in basin water makes ripples!
          if (waterFoam.waterFill > 0.15 && Math.abs(dragIntersect.x) < 0.42 && Math.abs(dragIntersect.z) < 0.26) {
            waterFoam.addRipple(dragIntersect.x, dragIntersect.z, 0.012);
          }
          lastDragWorld.copy(dragIntersect);
        }
      }
    }
  } else if (dragMode === 'dish' && state.activeDish && state.activeDish.state === 'clean_ready') {
    const carryPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.16);
    if (raycaster.ray.intersectPlane(carryPlane, dragIntersect)) {
      dragIntersect.x = THREE.MathUtils.clamp(dragIntersect.x, -0.35, 0.85);
      dragIntersect.z = THREE.MathUtils.clamp(dragIntersect.z, -0.25, 0.25);
      state.activeDish.group.position.lerp(dragIntersect, 0.45);
      playerHand.setTarget(state.activeDish.group.position.clone().add(new THREE.Vector3(0.08, 0.03, 0.09)), 'carry');

      // Magnetic snap to dish rack once dragged into right zone!
      if (state.activeDish.group.position.x > 0.34) {
        dragMode = null;
        sendActiveDishToRack();
      }
    }
  } else if (dragMode === 'water' && waterFoam.sinkWater.visible) {
    const hits = raycaster.intersectObject(waterFoam.sinkWater, false);
    if (hits.length > 0 && Math.random() < 0.35) {
      splashWaterAt(hits[0].point);
    }
  }
}

function handlePointerUp(e) {
  if (activePointerId !== e.pointerId) return;
  const distMoved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);

  if (dragMode === 'sponge') {
    state.spongeDragging = false;
    state.spongeVelocity = 0;
    // Sponge smoothly glides back to its clean tray spot so the dish stays unobstructed!
    state.spongeTargetPos.copy(kitchen.spongeHomePos);
    playerHand.rest();
  } else if (dragMode === 'dish' && state.activeDish && state.activeDish.state === 'clean_ready') {
    state.dishDragging = false;
    // Generous tap-to-rack OR drag-right-to-rack!
    if (distMoved < 26 || state.activeDish.group.position.x > 0.22) {
      sendActiveDishToRack();
    } else {
      playerHand.rest();
    }
  }

  dragMode = null;
  activePointerId = null;
}

const domEl = renderer.domElement;
domEl.addEventListener('pointerdown', handlePointerDown);
window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('pointerup', handlePointerUp);
window.addEventListener('pointercancel', handlePointerUp);

// ------------------------------------------------------------------
// 5. Subtle Wordless Idle Hint (0-10s silent, then 1 gentle hand gesture)
// ------------------------------------------------------------------
function getCurrentGoalPhase() {
  if (state.celebrating) return 'celebrate';
  const dish = state.activeDish;
  if (!dish) return 'none';
  if (dish.state === 'clean_ready') return 'rack';
  if (dish.isScrubbedClean() && dish.foamCoverage > 0.01) return 'rinse';
  if (state.spongeSoap < 0.08 && state.spongeFoam < 0.08) return 'soap';
  return 'scrub';
}

function updateIdleHint(dt, nowSec) {
  const idleSec = nowSec - state.lastInteractionTime;
  const phase = getCurrentGoalPhase();

  if (idleSec > 10.0 && !state.hintActive && state.hintShownForPhase !== phase && phase !== 'none' && phase !== 'celebrate') {
    state.hintActive = true;
    state.hintTimer = 0;
    state.hintShownForPhase = phase;
  }

  if (!state.hintActive) return;

  state.hintTimer += dt;
  const u = Math.min(1, state.hintTimer / 1.8);

  if (phase === 'soap') {
    // Gently tap near the soap pump once
    const p = kitchen.soapBottleGroup.position.clone().add(new THREE.Vector3(0.03, 0.36 - Math.sin(u * Math.PI) * 0.04, 0.05));
    playerHand.setTarget(p, 'hint');
  } else if (phase === 'scrub') {
    // Gently sweep from sponge toward center plate once
    const p = kitchen.spongeHomePos.clone().lerp(new THREE.Vector3(0, 0.07, 0.06), Math.sin(u * Math.PI * 0.5));
    p.x += Math.sin(u * Math.PI * 3) * 0.04;
    playerHand.setTarget(p, 'hint');
  } else if (phase === 'rinse') {
    // Point gently near faucet lever once
    const p = new THREE.Vector3(0.14, 0.15 - Math.sin(u * Math.PI) * 0.025, -0.28);
    playerHand.setTarget(p, 'hint');
  } else if (phase === 'rack') {
    // Sweep gently from clean dish toward right dish rack once
    const p = new THREE.Vector3(0.05, 0.14, 0.05).lerp(new THREE.Vector3(0.62, 0.18, 0.0), u);
    p.y += Math.sin(u * Math.PI) * 0.08;
    playerHand.setTarget(p, 'hint');
  }

  if (state.hintTimer >= 2.0) {
    state.hintActive = false;
    playerHand.rest();
  }
}

// ------------------------------------------------------------------
// 6. Main Animation Loop
// ------------------------------------------------------------------
let lastTime = performance.now();
let simTime = 0;
let fpsFrames = 0;
let fpsLastCheck = lastTime;
let measuredFps = 60;

function stepSimulation(dt, nowMs) {
  simTime += dt;
  const time = simTime;

  if (state.drySqueakCooldown > 0) state.drySqueakCooldown -= dt;

  // 1. Faucet lever & water flow smoothing
  const targetFlow = state.faucetOn ? 1.0 : 0.0;
  state.waterFlow = THREE.MathUtils.lerp(state.waterFlow, targetFlow, Math.min(1, dt * 8));
  kitchen.leverPivot.rotation.z = THREE.MathUtils.lerp(
    kitchen.leverPivot.rotation.z,
    state.faucetOn ? 0.52 : 0.0,
    Math.min(1, dt * 12)
  );

  // Subtle inviting micro-motion ONLY on the current stage object (never flashing arrows!)
  const phase = getCurrentGoalPhase();
  const bottleTilt = phase === 'soap' ? Math.sin(time * 2.4) * 0.025 : 0;
  kitchen.soapBottleGroup.rotation.z = THREE.MathUtils.lerp(kitchen.soapBottleGroup.rotation.z, bottleTilt, dt * 6);
  if (phase === 'rinse' && !state.faucetOn) {
    kitchen.leverPivot.rotation.x = Math.sin(time * 3.0) * 0.04;
  } else {
    kitchen.leverPivot.rotation.x = THREE.MathUtils.lerp(kitchen.leverPivot.rotation.x, 0, dt * 6);
  }
  if (phase === 'rack') {
    kitchen.rackGroup.rotation.y = Math.sin(time * 2.5) * 0.015;
  } else {
    kitchen.rackGroup.rotation.y = THREE.MathUtils.lerp(kitchen.rackGroup.rotation.y, 0, dt * 6);
  }

  // 2. Soap pump spring animation
  if (state.pumpPressAnim > 0) {
    state.pumpPressAnim = Math.max(0, state.pumpPressAnim - dt * 4.5);
  }
  kitchen.pumpHead.position.y = 0.285 - Math.sin(state.pumpPressAnim * Math.PI) * 0.032;

  // 3. Drain plug smooth animation
  const plugGoal = state.isPlugged ? kitchen.plugClosedPos : kitchen.plugOpenPos;
  kitchen.drainPlugGroup.position.lerp(plugGoal, Math.min(1, dt * 12));

  // 4. Sponge smooth movement & buoyant bobbing if sink water is high
  state.spongeWorldPos.lerp(state.spongeTargetPos, Math.min(1, dt * (state.spongeDragging ? 22 : 9)));
  kitchen.spongeGroup.position.copy(state.spongeWorldPos);
  if (!state.spongeDragging) {
    state.spongeVelocity = Math.max(0, state.spongeVelocity - dt * 5);
    const gentleBob = phase === 'scrub' ? Math.sin(time * 3.2) * 0.006 : 0;
    kitchen.spongeGroup.position.y += gentleBob;
  } else {
    playerHand.setTarget(state.spongeWorldPos.clone().add(new THREE.Vector3(0.075, 0.036, 0.05)), 'grip');
  }
  // Gentle sponge squash while scrubbing
  const squash = state.spongeDragging ? 0.88 + Math.sin(time * 22) * 0.04 : 1.0;
  kitchen.spongeMeshGroup.scale.set(1.0 + (1 - squash) * 0.4, squash, 1.0 + (1 - squash) * 0.4);

  // 5. Active dish rinse, texture flush, buoyancy, and clean detection!
  let streamHitY = kitchen.sinkBounds.bottomY + 0.01;
  const activeDish = state.activeDish;

  if (activeDish && !state.dishAnim) {
    activeDish.updateCrumbs(dt);

    // If water is running over the active dish, rinse away foam & sparkle!
    if (state.waterFlow > 0.1 && activeDish.state === 'washing') {
      streamHitY = activeDish.isCup ? 0.06 : 0.03;
      activeDish.rinseUnderWater(dt, state.waterFlow);
      // Slight gentle tremor under water stream
      activeDish.group.rotation.z = Math.sin(time * 24) * 0.014 * state.waterFlow;
    }

    activeDish.flushTexturesAndMeasure(nowMs);

    // Transition washing -> clean_ready as soon as both dirt & foam are gone!
    if (activeDish.state === 'washing' && activeDish.isFullyRinsed()) {
      activeDish.state = 'clean_ready';
      if (!activeDish.sparkleTriggered) {
        activeDish.sparkleTriggered = true;
        audio.playSparkleClean();
        waterFoam.spawnSparkles(activeDish.group.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 10, 0.18);
        mom.setMood('joy', 2.4, true);
      }
    }

    // Visual lift & gleaming presentation when clean_ready!
    if (activeDish.state === 'clean_ready' && !state.dishDragging) {
      const restPos = activeDish.isCup ? WASH_POS_CUP : WASH_POS_PLATE;
      const liftedY = Math.max(restPos.y + 0.085, waterFoam.getWaterSurfaceY() + 0.05) + Math.sin(time * 3.0) * 0.01;
      activeDish.group.position.x = THREE.MathUtils.lerp(activeDish.group.position.x, restPos.x, dt * 6);
      activeDish.group.position.y = THREE.MathUtils.lerp(activeDish.group.position.y, liftedY, dt * 6);
      activeDish.group.position.z = THREE.MathUtils.lerp(activeDish.group.position.z, restPos.z + 0.02, dt * 6);
      activeDish.group.rotation.y = Math.sin(time * 1.9) * 0.18;
      if (Math.random() < dt * 2.2) {
        waterFoam.spawnSparkles(activeDish.group.position.clone().add(new THREE.Vector3(0, 0.05, 0.04)), 1, 0.14);
      }
    } else if (activeDish.state === 'washing') {
      // Float gently higher if sink fills up with water!
      const restPos = activeDish.isCup ? WASH_POS_CUP : WASH_POS_PLATE;
      const floatY = Math.max(restPos.y, waterFoam.getWaterSurfaceY() - 0.02);
      activeDish.group.position.y = THREE.MathUtils.lerp(activeDish.group.position.y, floatY, dt * 5);
      if (waterFoam.waterFill > 0.3) {
        activeDish.group.rotation.z = Math.sin(time * 2.5) * 0.05;
      }
    }
  }

  // Smoothly settle any tapped racked dishes back upright
  for (const d of dishes) {
    if (d.state === 'racked') {
      d.group.rotation.z = THREE.MathUtils.lerp(d.group.rotation.z, 0, dt * 8);
    }
  }

  // 6. Dish transition animations (from waiting stack -> sink, or sink -> drying rack)
  if (state.dishAnim) {
    const a = state.dishAnim;
    a.t += dt / a.duration;
    const u = Math.min(1, a.t);
    const ease = 1 - Math.pow(1 - u, 3);
    a.dish.group.position.lerpVectors(a.fromPos, a.toPos, ease);
    a.dish.group.position.y += Math.sin(u * Math.PI) * a.arcHeight;
    a.dish.group.rotation.set(
      THREE.MathUtils.lerp(a.fromRot.x, a.toRot.x, ease),
      THREE.MathUtils.lerp(a.fromRot.y, a.toRot.y, ease),
      THREE.MathUtils.lerp(a.fromRot.z, a.toRot.z, ease)
    );
    if (a.withHand) {
      playerHand.setTarget(a.dish.group.position.clone().add(new THREE.Vector3(0.08, 0.04, 0.08)), 'carry');
    }
    if (u >= 1) {
      const doneCb = a.onDone;
      state.dishAnim = null;
      if (doneCb) doneCb();
    }
  }

  // 7. Reward cake pop-in bounce
  if (rewardCake.visible) {
    const s = THREE.MathUtils.lerp(rewardCake.scale.x, 1.0, Math.min(1, dt * 7));
    rewardCake.scale.setScalar(s);
    rewardCake.rotation.y += dt * 0.45;
  }

  // 8. Mom reacts with amazed joy when sink water brims over!
  if (waterFoam.waterFill > 0.94 && !state.overflowReacted) {
    state.overflowReacted = true;
    mom.setMood('amazed', 3.0, false);
  }

  // 9. Update Water/Foam, Audio, Hand, Idle Hint, and Mom
  waterFoam.update(dt, time, {
    waterFlow: state.waterFlow,
    isPlugged: state.isPlugged,
    spongeWorldPos: state.spongeWorldPos,
    spongeFoamLevel: state.spongeFoam,
    streamHitY,
    onDrainGlug: () => audio.playDrainGlug(),
  });

  audio.updateContinuous(
    dt,
    state.waterFlow,
    waterFoam.waterFill,
    state.spongeVelocity,
    state.spongeSoap > 0.05 || state.spongeFoam > 0.08
  );

  updateIdleHint(dt, time);
  playerHand.update(dt, time);

  const lookAtPoint = state.spongeDragging
    ? state.spongeWorldPos
    : activeDish
    ? activeDish.group.position
    : rewardCake.position;
  mom.update(dt, time, lookAtPoint);

  renderer.render(scene, camera);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) * 0.001);
  lastTime = now;

  fpsFrames++;
  if (now - fpsLastCheck > 1000) {
    measuredFps = Math.round((fpsFrames * 1000) / (now - fpsLastCheck));
    fpsFrames = 0;
    fpsLastCheck = now;
  }

  stepSimulation(dt, now);
}

requestAnimationFrame(animate);

// Expose clean diagnostic hooks for automated visual & performance verification (zero UI text)
window.__DISH_GAME__ = {
  stepRender(frames = 8, dt = 0.03) {
    const baseNow = performance.now();
    for (let i = 0; i < frames; i++) {
      stepSimulation(dt, baseNow + i * 40);
    }
  },
  getStats() {
    return {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      pixelRatio: renderer.getPixelRatio(),
      fps: measuredFps,
      phase: getCurrentGoalPhase(),
      activeDish: state.activeDish ? state.activeDish.recipe.id : null,
      dirtRemaining: state.activeDish ? Number(state.activeDish.dirtRemaining.toFixed(3)) : 0,
      foamCoverage: state.activeDish ? Number(state.activeDish.foamCoverage.toFixed(3)) : 0,
      waterFill: Number(waterFoam.waterFill.toFixed(3)),
      rackedCount: state.rackedCount,
      celebrating: state.celebrating,
    };
  },
  // Action helpers for deterministic visual testing of every stage
  pumpSoap,
  toggleFaucet,
  toggleDrainPlug,
  simulateScrub(passes = 18) {
    if (!state.activeDish) return;
    state.spongeSoap = Math.max(state.spongeSoap, 1.0);
    state.spongeFoam = Math.max(state.spongeFoam, 1.0);
    kitchen.soapPuddle.visible = true;
    const dish = state.activeDish;
    for (let i = 0; i < passes; i++) {
      const ang = (i / passes) * Math.PI * 4;
      const rad = 0.06 + (i / passes) * 0.26;
      const uv = new THREE.Vector2(0.5 + Math.cos(ang) * rad, 0.5 + Math.sin(ang) * rad);
      dish.scrubAtUV(uv, 1.0, 34);
      const wp = dish.group.position.clone().add(new THREE.Vector3(Math.cos(ang) * 0.11, 0.038, Math.sin(ang) * 0.08));
      waterFoam.spawnSud('dish', wp, 0.012 + Math.random() * 0.018, 12);
      if (i % 2 === 0) {
        waterFoam.spawnSud('dish', wp.clone().add(new THREE.Vector3(0.02, 0.01, -0.01)), 0.009 + Math.random() * 0.011, 12);
      }
    }
    state.spongeTargetPos.copy(dish.group.position).add(new THREE.Vector3(-0.02, 0.048, 0.04));
    state.spongeWorldPos.copy(state.spongeTargetPos);
    playerHand.setTarget(state.spongeWorldPos.clone().add(new THREE.Vector3(0.075, 0.036, 0.05)), 'grip');
    for (let i = 0; i < 4; i++) {
      waterFoam.spawnFloatingBubble(
        new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.16 + Math.random() * 0.22, 0.0),
        0.048
      );
    }
    dish.flushTexturesAndMeasure(performance.now() + 100);
  },
  simulateRinseComplete() {
    if (!state.activeDish) return;
    state.faucetOn = true;
    state.waterFlow = 1.0;
    const dish = state.activeDish;
    dish.dirtCtx.clearRect(0, 0, dish.texSize, dish.texSize);
    dish.foamCtx.clearRect(0, 0, dish.texSize, dish.texSize);
    dish.textureDirty = true;
    dish.flushTexturesAndMeasure(performance.now() + 100);
    waterFoam.clearDishSuds();
  },
  sendActiveDishToRack,
  triggerFinalCelebration,
  fillSinkWithBubbles() {
    state.isPlugged = true;
    state.faucetOn = true;
    state.waterFlow = 1.0;
    waterFoam.waterFill = 0.98;
    waterFoam.basinSoapLevel = 0.9;
    for (let i = 0; i < 24; i++) {
      waterFoam.spawnSud(
        'basin',
        new THREE.Vector3((Math.random() - 0.5) * 0.72, 0.01, (Math.random() - 0.5) * 0.44),
        0.025 + Math.random() * 0.022,
        12
      );
    }
    for (let i = 0; i < 5; i++) {
      waterFoam.spawnFloatingBubble(
        new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.18 + Math.random() * 0.25, 0.0),
        0.052
      );
    }
    mom.setMood('amazed', 4.0, false);
  },
};
