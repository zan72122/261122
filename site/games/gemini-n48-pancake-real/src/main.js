import * as THREE from 'three';
import {
  createMorningKitchenEnvMap,
  createWoodCounterTextures,
  createTileBacksplashTextures,
  createCastIronTextures,
  createStonewareTextures,
  createLinenTextures,
  createSkinTextures,
  createEyeTexture,
  createHairTextures,
  createPancakeNoiseTexture,
  createStrawberryTextures,
  createContactShadowTexture,
  createDustMoteTexture,
  createSteamTexture,
} from './textures.js';
import { KitchenAudio } from './audio.js';
import { createKitchen } from './kitchen.js';
import { createMama } from './mama.js';
import { createPancakeSystem } from './pancake.js';

const container = document.getElementById('app');

// =========================================================================
// 1. PHOTOREALISTIC RENDERER (iPhone / iPad 30fps+ tuned, pixelRatio <= 1.5)
// =========================================================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x281e16);
scene.fog = new THREE.FogExp2(0xe2d2ba, 0.020);

// =========================================================================
// 2. RESPONSIVE CINEMATIC CAMERA (EXACT BOUNDING FIT FOR iPHONE & iPAD!)
// =========================================================================
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 45);
const camBasePos = new THREE.Vector3();
const camBaseTarget = new THREE.Vector3();
const camCurPos = new THREE.Vector3();
const camCurTarget = new THREE.Vector3();

function updateCameraFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // iPhone portrait: mathematically fit full horizontal tabletop [-2.45 .. +2.55] cleanly inside frame with full oak counter foreground!
    camera.fov = 56;
    const halfReqW = 2.58;
    const tanHalfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * aspect;
    const reqDist = Math.max(6.4, halfReqW / Math.max(0.22, tanHalfH));
    camBasePos.set(0.06, 3.65 + (reqDist - 6.4) * 0.36, reqDist * 0.84);
    camBaseTarget.set(0.06, 1.02, -0.18);
  } else if (aspect < 1.28) {
    // iPad / 4:3 framing — Mama's face & hands + batter bowl + skillet + stacked plate + butter + syrup ALL large & clear!
    camera.fov = 44;
    camBasePos.set(0.06, 2.92, 5.10);
    camBaseTarget.set(0.08, 0.92, -0.26);
  } else {
    // Wide desktop / iPad landscape
    camera.fov = 40;
    camBasePos.set(0.06, 2.74, 4.92);
    camBaseTarget.set(0.08, 0.94, -0.26);
  }
  camera.updateProjectionMatrix();
  if (camCurPos.lengthSq() === 0) {
    camCurPos.copy(camBasePos);
    camCurTarget.copy(camBaseTarget);
  }
}
updateCameraFraming();

// =========================================================================
// 3. PROCEDURAL PBR TEXTURES & HIGH-CONTRAST MORNING STUDIO PMREM
// =========================================================================
const envMap = createMorningKitchenEnvMap(renderer);
scene.environment = envMap;
scene.environmentIntensity = 0.78;

const textures = {
  wood: createWoodCounterTextures(),
  tile: createTileBacksplashTextures(),
  castIron: createCastIronTextures(),
  stoneware: createStonewareTextures(),
  linen: createLinenTextures([224, 214, 198], { knitRib: false }),
  sweater: createLinenTextures([198, 134, 114], { knitRib: true }),
  skinFace: createSkinTextures({ cheekBlush: true }),
  skinHand: createSkinTextures({ cheekBlush: false }),
  eye: createEyeTexture(),
  hair: createHairTextures(),
  pancakeNoise: createPancakeNoiseTexture(),
  strawberry: createStrawberryTextures(),
  contactShadow: createContactShadowTexture(),
  dustMote: createDustMoteTexture(),
  steam: createSteamTexture(),
};

// =========================================================================
// 4. WEEKEND MORNING DIAGONAL WINDOW LIGHTING RIG (PHOTOGRAPHIC CONTRAST)
// =========================================================================
// Balanced cooler morning ambient bounce so golden window sunbeams pop vividly!
const hemiLight = new THREE.HemisphereLight(0xeef1f7, 0x5c3c24, 0.42);
scene.add(hemiLight);

// Primary diagonal golden morning sunlight streaming THROUGH the left window mullions!
const sunLight = new THREE.DirectionalLight(0xffd28c, 3.45);
sunLight.position.set(-6.8, 4.9, 1.45);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1.0;
sunLight.shadow.camera.far = 17.5;
sunLight.shadow.camera.left = -5.2;
sunLight.shadow.camera.right = 5.2;
sunLight.shadow.camera.top = 4.6;
sunLight.shadow.camera.bottom = -3.6;
sunLight.shadow.bias = -0.00045;
sunLight.shadow.normalBias = 0.018;
scene.add(sunLight);

// Cool morning sky fill from opposite high right-front (authentic warm-sun / cool-shadow photography!)
const skyFill = new THREE.DirectionalLight(0xb6d3ff, 0.48);
skyFill.position.set(4.6, 4.0, 3.6);
scene.add(skyFill);

// Soft warm oak-counter bounce onto Mama's face & underside of airborne flipping pancakes
const bounceLight = new THREE.PointLight(0xffbe72, 0.65, 7.8, 1.8);
bounceLight.position.set(-0.4, 1.1, 1.55);
scene.add(bounceLight);

// =========================================================================
// 5. BUILD WORLD: KITCHEN, MAMA & HERO PANCAKE SYSTEM
// =========================================================================
const audio = new KitchenAudio();
const kitchen = createKitchen(scene, textures);
const mama = createMama(scene, textures);
const pancakes = createPancakeSystem(scene, kitchen, textures, audio);

// =========================================================================
// 6. WORDLESS SINGLE-FINGER TACTILE INTERACTION ENGINE
// =========================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.65);
const dragWorld = new THREE.Vector3();

function makeHitTarget(radius, pos, id, parent = scene) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  m.position.copy(pos);
  m.userData.interactId = id;
  parent.add(m);
  return m;
}

const hitTargets = [
  makeHitTarget(0.88, new THREE.Vector3(kitchen.bowlPos.x, 0.42, kitchen.bowlPos.z), 'bowl'),
  makeHitTarget(1.16, new THREE.Vector3(kitchen.stovePos.x + 0.12, 0.30, kitchen.stovePos.z), 'skillet'),
  makeHitTarget(0.68, new THREE.Vector3(kitchen.stovePos.x + 0.68, 0.34, kitchen.stovePos.z + 1.10), 'handle'),
  makeHitTarget(0.36, new THREE.Vector3(kitchen.stovePos.x - 0.92, 0.12, kitchen.stovePos.z + 1.14), 'knob'),
  makeHitTarget(1.04, new THREE.Vector3(kitchen.platePos.x, 0.34, kitchen.platePos.z), 'plate'),
  makeHitTarget(0.42, new THREE.Vector3(kitchen.forkRestPos.x, 0.12, kitchen.forkRestPos.z), 'fork'),
  makeHitTarget(0.58, new THREE.Vector3(kitchen.butterDishPos.x, 0.24, kitchen.butterDishPos.z), 'butter'),
  makeHitTarget(0.66, new THREE.Vector3(kitchen.syrupRestPos.x, 0.48, kitchen.syrupRestPos.z), 'syrup'),
  makeHitTarget(0.56, new THREE.Vector3(kitchen.berryDishPos.x, 0.28, kitchen.berryDishPos.z), 'berries'),
  makeHitTarget(0.92, new THREE.Vector3(0.46, 2.24, -1.58), 'mama'),
];

const interaction = {
  activePointerId: null,
  grabbed: null,
  downScreen: new THREE.Vector2(),
  curScreen: new THREE.Vector2(),
  downTime: 0,
  movedDist: 0,
  heatLevel: 0.85,
  idleTime: 0,
  ladleMode: 'rest',
  ladleAnimT: 0,
  ladleHasBatter: false,
  ladlePos: kitchen.ladleRestPos.clone(),
  ladleRot: new THREE.Euler(0.18, 0.35, -0.58),
  syrupMode: 'rest',
  syrupAnimT: 0,
  syrupPos: kitchen.syrupRestPos.clone(),
  syrupTilt: 0,
  forkAnim: 0,
  panFlipImpulse: 0,
  panSlideImpulse: 0,
  wiggles: {
    bowl: 0,
    butter: 0,
    syrup: 0,
    berries: 0,
    plate: 0,
  },
};

function setPointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function getDragWorldPos(height = 0.85) {
  dragPlane.constant = -height;
  raycaster.setFromCamera(pointerNDC, camera);
  raycaster.ray.intersectPlane(dragPlane, dragWorld);
  dragWorld.x = THREE.MathUtils.clamp(dragWorld.x, -3.0, 3.0);
  dragWorld.z = THREE.MathUtils.clamp(dragWorld.z, -1.2, 2.0);
  return dragWorld;
}

function triggerLadleAutoPour() {
  if (pancakes.active.exists) return;
  interaction.ladleMode = 'autoScoop';
  interaction.ladleAnimT = 0;
  interaction.ladleHasBatter = true;
  audio.playSoftClick(520);
}

function triggerPanFlip() {
  if (!pancakes.active.exists || pancakes.active.isFlipping || pancakes.active.slidingToPlate) return;
  if (pancakes.triggerFlip()) {
    interaction.panFlipImpulse = 1.0;
    mama.triggerCheer(1.65);
    audio.playWarmDelight(false);
  }
}

function triggerPanPlateSlide() {
  if (!pancakes.active.exists || pancakes.active.isFlipping || pancakes.active.slidingToPlate) return;
  if (pancakes.triggerSlideToPlate()) {
    interaction.panSlideImpulse = 1.0;
    mama.triggerCheer(1.5);
  }
}

function handlePointerDown(e) {
  if (interaction.activePointerId !== null) return;
  interaction.activePointerId = e.pointerId;
  interaction.idleTime = 0;
  audio.unlock();

  setPointerFromEvent(e);
  interaction.downScreen.set(e.clientX, e.clientY);
  interaction.curScreen.set(e.clientX, e.clientY);
  interaction.downTime = performance.now();
  interaction.movedDist = 0;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(hitTargets, false);
  if (hits.length === 0) return;

  const id = hits[0].object.userData.interactId;

  if (id === 'knob') {
    interaction.heatLevel = interaction.heatLevel < 0.65 ? 0.88 : interaction.heatLevel < 1.1 ? 1.32 : 0.45;
    audio.playSoftClick(640 + interaction.heatLevel * 220);
    return;
  }

  if (id === 'bowl') {
    if (!pancakes.active.exists && interaction.ladleMode === 'rest') {
      interaction.grabbed = 'ladle';
      interaction.ladleMode = 'dragging';
      interaction.ladleHasBatter = true;
      audio.playSoftClick(460);
    } else {
      interaction.wiggles.bowl = 1.0;
      audio.playSoftClick(320);
    }
    return;
  }

  if (id === 'skillet' || id === 'handle') {
    if (pancakes.active.exists && !pancakes.active.isFlipping && !pancakes.active.slidingToPlate) {
      if (id === 'skillet' && !pancakes.active.flipped) {
        const pt = getDragWorldPos(0.32);
        if (pancakes.popBubbleAtWorldPoint(pt)) {
          interaction.grabbed = 'skillet';
          return;
        }
      }
      interaction.grabbed = 'skillet';
    } else if (!pancakes.active.exists) {
      interaction.panFlipImpulse = 0.22;
      audio.playSoftClick(280);
    }
    return;
  }

  if (id === 'butter') {
    if (pancakes.stack.length > 0) {
      interaction.grabbed = 'butter';
      audio.playSoftClick(540);
    } else {
      interaction.wiggles.butter = 1.0;
      audio.playSoftClick(740);
    }
    return;
  }

  if (id === 'syrup') {
    if (pancakes.stack.length > 0) {
      interaction.grabbed = 'syrup';
      interaction.syrupMode = 'dragging';
      audio.playSoftClick(620);
    } else {
      interaction.wiggles.syrup = 1.0;
      audio.playSoftClick(880);
    }
    return;
  }

  if (id === 'berries') {
    if (pancakes.stack.length > 0) {
      interaction.grabbed = 'berries';
      audio.playSoftClick(680);
    } else {
      interaction.wiggles.berries = 1.0;
      audio.playSoftClick(760);
    }
    return;
  }

  if (id === 'fork') {
    if (pancakes.stack.length > 0 && interaction.forkAnim <= 0.01) {
      interaction.forkAnim = 1.0;
      pancakes.takeHappyBite();
      mama.triggerTaste(2.4);
    } else {
      audio.playSoftClick(1240);
    }
    return;
  }

  if (id === 'plate') {
    if (pancakes.active.exists && pancakes.active.flipped && !pancakes.active.isFlipping) {
      triggerPanPlateSlide();
    } else if (pancakes.stack.length > 0) {
      pancakes.pokeStack((Math.random() - 0.5) * 0.24, 0.14);
      if (pancakes.butterPats.length > 0 || pancakes.syrupAmount > 0.15) {
        mama.triggerTaste(2.5);
        audio.playWarmDelight(true);
      }
    } else {
      interaction.wiggles.plate = 1.0;
      audio.playSoftClick(920);
    }
    return;
  }

  if (id === 'mama') {
    mama.triggerCheer(2.0);
    audio.playWarmDelight(pancakes.stack.length > 0);
  }
}

function handlePointerMove(e) {
  if (interaction.activePointerId !== e.pointerId) return;
  interaction.idleTime = 0;

  const dx = e.clientX - interaction.curScreen.x;
  const dy = e.clientY - interaction.curScreen.y;
  interaction.movedDist += Math.hypot(dx, dy);
  interaction.curScreen.set(e.clientX, e.clientY);
  setPointerFromEvent(e);

  if (interaction.grabbed === 'ladle') {
    const w = getDragWorldPos(1.06);
    interaction.ladlePos.lerp(new THREE.Vector3(w.x, 1.06, w.z), 0.38);
    const distToPan = Math.hypot(w.x - kitchen.stovePos.x, w.z - kitchen.stovePos.z);
    if (distToPan < 1.15 && !pancakes.active.exists) {
      interaction.ladleMode = 'autoPour';
      interaction.ladleAnimT = 0;
      interaction.grabbed = null;
      pancakes.startBatterPour(0.92 + Math.random() * 0.18);
    }
  } else if (interaction.grabbed === 'skillet') {
    const totalDx = e.clientX - interaction.downScreen.x;
    const totalDy = e.clientY - interaction.downScreen.y;
    if (totalDy < -38 && !pancakes.active.isFlipping) {
      triggerPanFlip();
      interaction.grabbed = null;
    } else if (totalDx > 55 && pancakes.active.flipped && !pancakes.active.isFlipping) {
      triggerPanPlateSlide();
      interaction.grabbed = null;
    }
  } else if (interaction.grabbed === 'syrup') {
    const w = getDragWorldPos(1.38);
    interaction.syrupPos.lerp(new THREE.Vector3(w.x, 1.24, w.z), 0.35);
  }
}

function handlePointerUp(e) {
  if (interaction.activePointerId !== e.pointerId) return;
  interaction.activePointerId = null;

  const isTap = interaction.movedDist < 26;

  if (interaction.grabbed === 'ladle') {
    if (isTap && !pancakes.active.exists) {
      triggerLadleAutoPour();
    } else {
      interaction.ladleMode = 'returning';
    }
  } else if (interaction.grabbed === 'skillet') {
    if (isTap && pancakes.active.exists && !pancakes.active.isFlipping && !pancakes.active.slidingToPlate) {
      if (!pancakes.active.flipped) {
        triggerPanFlip();
      } else if (pancakes.active.readyToPlate || pancakes.active.cookTop > 0.22) {
        triggerPanPlateSlide();
      } else {
        triggerPanFlip();
      }
    }
  } else if (interaction.grabbed === 'butter') {
    const startWorld = new THREE.Vector3();
    kitchen.readyButterPat.getWorldPosition(startWorld);
    if (pancakes.addButterToStack(startWorld)) {
      mama.triggerCheer(1.6);
    }
  } else if (interaction.grabbed === 'syrup') {
    if (isTap) {
      interaction.syrupMode = 'autoPour';
      interaction.syrupAnimT = 0;
    } else {
      interaction.syrupMode = 'returning';
      pancakes.stopSyrupPour();
    }
  } else if (interaction.grabbed === 'berries') {
    const startWorld = new THREE.Vector3();
    kitchen.berryDishGroup.getWorldPosition(startWorld);
    startWorld.y += 0.25;
    pancakes.dropStrawberry(startWorld);
    mama.triggerCheer(1.4);
  }

  interaction.grabbed = null;
}

renderer.domElement.addEventListener('pointerdown', handlePointerDown);
window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('pointerup', handlePointerUp);
window.addEventListener('pointercancel', handlePointerUp);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCameraFraming();
});

// =========================================================================
// 7. MAIN SIMULATION & RENDER LOOP
// =========================================================================
const clock = new THREE.Clock();
let fpsSmooth = 60;
const tmpSpoutPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function computeCurrentLookAndHint() {
  if (pancakes.active.isFlipping) {
    return { look: pancakes.activeGroup.position.clone(), hintPos: null };
  }
  if (interaction.syrupMode === 'dragging' || interaction.syrupMode === 'autoPour') {
    return { look: pancakes.getStackTopWorldPos(), hintPos: null };
  }
  if (pancakes.active.exists) {
    if (pancakes.active.readyToPlate) {
      return {
        look: kitchen.platePos.clone().add(new THREE.Vector3(0, 0.35, 0)),
        hintPos: kitchen.platePos.clone(),
      };
    }
    return {
      look: pancakes.activeGroup.position.clone(),
      hintPos: pancakes.active.readyToFlip ? kitchen.stovePos.clone().add(new THREE.Vector3(0.7, 0.25, 0.3)) : null,
    };
  }
  if (pancakes.stack.length === 0) {
    return {
      look: kitchen.bowlPos.clone().add(new THREE.Vector3(0.4, 0.4, 0)),
      hintPos: kitchen.bowlPos.clone(),
    };
  }
  if (pancakes.butterPats.length === 0) {
    return { look: pancakes.getStackTopWorldPos(), hintPos: kitchen.butterDishPos.clone() };
  }
  if (pancakes.syrupAmount < 0.2) {
    return { look: pancakes.getStackTopWorldPos(), hintPos: kitchen.syrupRestPos.clone() };
  }
  return { look: pancakes.getStackTopWorldPos(), hintPos: kitchen.bowlPos.clone() };
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;
  if (dt > 0) fpsSmooth = fpsSmooth * 0.92 + (1 / dt) * 0.08;

  interaction.idleTime += dt;

  // --- 1. LADLE & BATTER POUR CHOREOGRAPHY ---
  const panCenter = new THREE.Vector3(kitchen.stovePos.x, 0.96, kitchen.stovePos.z);
  let batterStreamActive = false;

  if (interaction.ladleMode === 'autoScoop') {
    interaction.ladleAnimT += dt * 1.9;
    const t = Math.min(1, interaction.ladleAnimT);
    const arc = Math.sin(t * Math.PI) * 0.50;
    interaction.ladlePos.lerpVectors(kitchen.ladleRestPos, panCenter, t);
    interaction.ladlePos.y += arc;
    interaction.ladleRot.set(0.12 * (1 - t), 0.35 * (1 - t), THREE.MathUtils.lerp(-0.58, -0.15, t));
    if (t >= 1) {
      interaction.ladleMode = 'autoPour';
      interaction.ladleAnimT = 0;
      pancakes.startBatterPour(0.94 + Math.random() * 0.16);
    }
  } else if (interaction.ladleMode === 'autoPour') {
    interaction.ladleAnimT += dt * 0.92;
    const t = Math.min(1, interaction.ladleAnimT);
    interaction.ladlePos.lerp(panCenter, Math.min(1, dt * 12));
    const pourTilt = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.72) * 1.12;
    interaction.ladleRot.set(0.18, 0.15, -0.15 + pourTilt);
    batterStreamActive = t < 0.85;
    if (t >= 1) {
      pancakes.finishBatterPour();
      interaction.ladleHasBatter = false;
      interaction.ladleMode = 'returning';
    }
  } else if (interaction.ladleMode === 'returning') {
    interaction.ladlePos.lerp(kitchen.ladleRestPos, Math.min(1, dt * 7.5));
    interaction.ladleRot.x += (0.18 - interaction.ladleRot.x) * Math.min(1, dt * 7);
    interaction.ladleRot.y += (0.35 - interaction.ladleRot.y) * Math.min(1, dt * 7);
    interaction.ladleRot.z += (-0.58 - interaction.ladleRot.z) * Math.min(1, dt * 7);
    if (interaction.ladlePos.distanceTo(kitchen.ladleRestPos) < 0.04) {
      interaction.ladleMode = 'rest';
    }
  } else if (interaction.ladleMode === 'dragging') {
    interaction.ladleRot.set(0.12, 0.18, -0.22);
  } else {
    const bob = !pancakes.active.exists ? Math.sin(time * 2.1) * 0.015 : 0;
    interaction.ladlePos.copy(kitchen.ladleRestPos);
    interaction.ladlePos.y += bob;
    interaction.ladleRot.set(0.18, 0.35 + Math.sin(time * 1.4) * 0.03, -0.58);
  }

  kitchen.ladleGroup.position.copy(interaction.ladlePos);
  kitchen.ladleGroup.rotation.copy(interaction.ladleRot);
  kitchen.ladleBatter.visible = interaction.ladleHasBatter || interaction.ladleMode === 'rest';

  if (batterStreamActive) {
    kitchen.batterPourStream.visible = true;
    const cupBottom = interaction.ladlePos.clone().add(new THREE.Vector3(0.05, -0.12, 0));
    const panFloorY = 0.25;
    const h = Math.max(0.1, cupBottom.y - panFloorY);
    kitchen.batterPourStream.position.copy(cupBottom);
    const pulse = 0.88 + 0.16 * Math.sin(time * 22);
    kitchen.batterPourStream.scale.set(pulse, h, pulse);
  } else {
    kitchen.batterPourStream.visible = false;
  }

  // --- 2. MAPLE SYRUP CARAFE POUR CHOREOGRAPHY ---
  let syrupFlowing = 0;
  const stackTop = pancakes.getStackTopWorldPos();
  const autoPourPos = new THREE.Vector3(stackTop.x + 0.54, stackTop.y + 0.84, stackTop.z + 0.04);

  if (interaction.syrupMode === 'autoPour') {
    interaction.syrupAnimT += dt;
    interaction.syrupPos.lerp(autoPourPos, Math.min(1, dt * 6.5));
    const readyToTilt = interaction.syrupPos.distanceTo(autoPourPos) < 0.25;
    const targetTilt = readyToTilt && interaction.syrupAnimT < 2.25 ? 0.92 : 0.0;
    interaction.syrupTilt += (targetTilt - interaction.syrupTilt) * Math.min(1, dt * 7.5);
    if (interaction.syrupTilt > 0.55) {
      kitchen.pitcherSpout.getWorldPosition(tmpSpoutPos);
      pancakes.pourSyrupStep(dt, tmpSpoutPos);
      syrupFlowing = 1.0;
    } else {
      pancakes.stopSyrupPour();
    }
    if (interaction.syrupAnimT > 2.65) {
      interaction.syrupMode = 'returning';
      pancakes.stopSyrupPour();
      mama.triggerCheer(1.8);
      audio.playWarmDelight(true);
    }
  } else if (interaction.syrupMode === 'dragging') {
    const distToPlate = Math.hypot(interaction.syrupPos.x - kitchen.platePos.x, interaction.syrupPos.z - kitchen.platePos.z);
    const overPlate = distToPlate < 1.15 && pancakes.stack.length > 0;
    const targetTilt = overPlate ? 0.95 : 0.14;
    interaction.syrupTilt += (targetTilt - interaction.syrupTilt) * Math.min(1, dt * 8.5);
    if (overPlate && interaction.syrupTilt > 0.5) {
      kitchen.pitcherSpout.getWorldPosition(tmpSpoutPos);
      pancakes.pourSyrupStep(dt, tmpSpoutPos);
      syrupFlowing = 1.0;
    } else {
      pancakes.stopSyrupPour();
    }
  } else if (interaction.syrupMode === 'returning') {
    interaction.syrupPos.lerp(kitchen.syrupRestPos, Math.min(1, dt * 7.0));
    interaction.syrupTilt += (0 - interaction.syrupTilt) * Math.min(1, dt * 8.0);
    if (interaction.syrupPos.distanceTo(kitchen.syrupRestPos) < 0.04) {
      interaction.syrupMode = 'rest';
    }
  } else {
    interaction.syrupPos.copy(kitchen.syrupRestPos);
    interaction.syrupTilt = 0;
  }

  kitchen.syrupGroup.position.copy(interaction.syrupPos);
  kitchen.syrupGroup.rotation.z = interaction.syrupTilt;
  kitchen.syrupLiquidMesh.rotation.z = -interaction.syrupTilt * 0.52;

  // --- 3. INTERACTIVE DESSERT FORK TASTING MOTION ---
  if (interaction.forkAnim > 0) {
    interaction.forkAnim = Math.max(0, interaction.forkAnim - dt * 1.45);
    const wave = Math.sin(interaction.forkAnim * Math.PI);
    const targetFork = stackTop.clone().add(new THREE.Vector3(0.28, 0.42, 0.20));
    kitchen.forkGroup.position.lerpVectors(kitchen.forkRestPos, targetFork, wave);
    kitchen.forkGroup.rotation.set(-wave * 0.45, 0.08 + wave * 0.72, wave * 0.25);
  } else {
    kitchen.forkGroup.position.copy(kitchen.forkRestPos);
    kitchen.forkGroup.rotation.set(0, 0.08, 0);
  }

  // --- 4. SKILLET PHYSICAL MOTION ---
  interaction.panFlipImpulse = Math.max(0, interaction.panFlipImpulse - dt * 2.4);
  interaction.panSlideImpulse = Math.max(0, interaction.panSlideImpulse - dt * 2.1);

  const flipWave = Math.sin(interaction.panFlipImpulse * Math.PI);
  const slideWave = Math.sin(interaction.panSlideImpulse * Math.PI);
  const readyPlateLean = pancakes.active.readyToPlate ? -0.055 : 0;

  kitchen.skilletGroup.position.y = flipWave * 0.24 + slideWave * 0.16;
  kitchen.skilletGroup.position.x = slideWave * 0.34;
  kitchen.skilletGroup.rotation.z = flipWave * 0.34 - slideWave * 0.36 + readyPlateLean;
  kitchen.skilletGroup.rotation.x = -flipWave * 0.12;

  // --- 5. GENTLE SECONDARY OBJECT WIGGLES ---
  for (const key of Object.keys(interaction.wiggles)) {
    if (interaction.wiggles[key] > 0) {
      interaction.wiggles[key] = Math.max(0, interaction.wiggles[key] - dt * 3.5);
    }
  }
  kitchen.bowlGroup.rotation.z = Math.sin(interaction.wiggles.bowl * Math.PI * 3) * 0.08 * interaction.wiggles.bowl;
  kitchen.butterDishGroup.rotation.z = Math.sin(interaction.wiggles.butter * Math.PI * 3) * 0.11 * interaction.wiggles.butter;
  if (interaction.syrupMode === 'rest') {
    kitchen.syrupGroup.rotation.z += Math.sin(interaction.wiggles.syrup * Math.PI * 3) * 0.1 * interaction.wiggles.syrup;
  }
  kitchen.berryDishGroup.rotation.z = Math.sin(interaction.wiggles.berries * Math.PI * 3) * 0.1 * interaction.wiggles.berries;
  kitchen.plateGroup.rotation.z = Math.sin(interaction.wiggles.plate * Math.PI * 3) * 0.05 * interaction.wiggles.plate;

  // --- 6. UPDATE WORLD, PANCAKES, MAMA & CONTINUOUS AUDIO ---
  kitchen.update(time, interaction.heatLevel);
  pancakes.update(dt, time, interaction.heatLevel);

  const { look, hintPos } = computeCurrentLookAndHint();
  // Idle hint fires gently once between 10s..14s so it never nags!
  const idleHintAlpha =
    interaction.idleTime > 10.0 && interaction.idleTime < 14.5
      ? Math.sin(((interaction.idleTime - 10.0) / 4.5) * Math.PI)
      : 0;

  mama.update(dt, time, {
    lookTarget: look,
    handleGripPoint: kitchen.handleGripPoint,
    isFlipping: pancakes.active.isFlipping || interaction.panFlipImpulse > 0.35,
    isPouring: batterStreamActive || syrupFlowing > 0,
    stackTopPos: pancakes.stack.length > 0 ? stackTop : null,
    idleHintPos: hintPos,
    idleHintAlpha,
  });

  const isOnPan = pancakes.active.exists && !pancakes.active.isFlipping && !pancakes.active.slidingToPlate;
  audio.updateContinuous(dt, {
    sizzleIntensity: isOnPan ? 0.42 + interaction.heatLevel * 0.42 : 0.0,
    sizzleBright: pancakes.active.flipped ? 0.35 : 0.78 - pancakes.active.cookBot * 0.4,
    syrupFlow: syrupFlowing,
    time,
  });

  // Subtle living handheld-camera breath
  const camSwayX = Math.sin(time * 0.38) * 0.028;
  const camSwayY = Math.cos(time * 0.52) * 0.018;
  const flipCamBoost = pancakes.active.isFlipping ? 0.24 : 0;
  camCurPos.lerp(
    new THREE.Vector3(camBasePos.x + camSwayX, camBasePos.y + camSwayY + flipCamBoost * 0.18, camBasePos.z),
    Math.min(1, dt * 3.0)
  );
  tmpLook.set(camBaseTarget.x, camBaseTarget.y + flipCamBoost * 0.42, camBaseTarget.z);
  camCurTarget.lerp(tmpLook, Math.min(1, dt * 3.5));
  camera.position.copy(camCurPos);
  camera.lookAt(camCurTarget);

  renderer.render(scene, camera);
}

animate();

// =========================================================================
// 8. CLEAN DEBUG & VERIFICATION HOOK (ZERO VISUAL OVERLAY!)
// =========================================================================
window.__PANCAKE_DEBUG__ = {
  getStats: () => ({
    fps: Math.round(fpsSmooth),
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    pixelRatio: renderer.getPixelRatio(),
    stackCount: pancakes.stack.length,
    activeCookBot: Number(pancakes.active.cookBot.toFixed(2)),
    activeCookTop: Number(pancakes.active.cookTop.toFixed(2)),
    activeFlipped: pancakes.active.flipped,
    poppedBubbles: pancakes.active.poppedCount,
    butterCount: pancakes.butterPats.length,
    syrupAmount: Number(pancakes.syrupAmount.toFixed(2)),
  }),
  pour: () => triggerLadleAutoPour(),
  flip: () => triggerPanFlip(),
  plate: () => triggerPanPlateSlide(),
  addButter: () => {
    const p = new THREE.Vector3();
    kitchen.readyButterPat.getWorldPosition(p);
    pancakes.addButterToStack(p);
  },
  pourSyrup: () => {
    if (pancakes.stack.length === 0) return;
    interaction.syrupMode = 'autoPour';
    interaction.syrupAnimT = 0;
  },
  addBerry: () => {
    const p = new THREE.Vector3();
    kitchen.berryDishGroup.getWorldPosition(p);
    p.y += 0.25;
    pancakes.dropStrawberry(p);
  },
  bite: () => {
    interaction.forkAnim = 1.0;
    pancakes.takeHappyBite();
    mama.triggerTaste(2.4);
  },
  setupHeroShowcase: () => {
    pancakes.clearPlateForFreshBatch();
    for (let i = 0; i < 3; i++) {
      pancakes.startBatterPour(1.03 - i * 0.03);
      pancakes.active.pourProgress = 1;
      pancakes.active.cookBot = 0.78 + i * 0.04;
      pancakes.active.cookTop = 0.74;
      pancakes.active.flipped = true;
      pancakes.triggerSlideToPlate();
      pancakes.update(1.0, clock.elapsedTime, 0.9);
    }
    const bp = new THREE.Vector3();
    kitchen.readyButterPat.getWorldPosition(bp);
    pancakes.addButterToStack(bp);
    for (let s = 0; s < 35; s++) pancakes.update(0.1, clock.elapsedTime + s * 0.1, 0.9);
    const top = pancakes.getStackTopWorldPos();
    const fakeSpout = top.clone().add(new THREE.Vector3(0.28, 0.65, 0));
    for (let s = 0; s < 30; s++) {
      pancakes.pourSyrupStep(0.08, fakeSpout);
      pancakes.update(0.08, clock.elapsedTime + s * 0.08, 0.9);
    }
    pancakes.stopSyrupPour();
    const sp = new THREE.Vector3();
    kitchen.berryDishGroup.getWorldPosition(sp);
    sp.y += 0.25;
    pancakes.dropStrawberry(sp);
    pancakes.dropStrawberry(sp);
    for (let s = 0; s < 16; s++) pancakes.update(0.08, clock.elapsedTime + s * 0.08, 0.9);
    pancakes.startBatterPour(1.0);
    pancakes.active.pourProgress = 1;
    // Advance to the exact lush "pukupuku" bubbling stage (plenty of glossy swelling domes + freshly popped craters!)
    for (let s = 0; s < 19; s++) pancakes.update(0.1, clock.elapsedTime + s * 0.1, 1.0);
    mama.triggerCheer(3.5);
  },
};

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('demo') === 'hero') {
  window.__PANCAKE_DEBUG__.setupHeroShowcase();
} else if (urlParams.get('demo') === 'flip') {
  window.__PANCAKE_DEBUG__.setupHeroShowcase();
  pancakes.triggerFlip();
  for (let s = 0; s < 14; s++) pancakes.update(0.024, clock.elapsedTime + s * 0.024, 1.0);
} else if (urlParams.get('demo') === 'pour') {
  window.__PANCAKE_DEBUG__.setupHeroShowcase();
  interaction.syrupMode = 'autoPour';
  interaction.syrupAnimT = 0.85;
  const st = pancakes.getStackTopWorldPos();
  interaction.syrupPos.set(st.x + 0.54, st.y + 0.84, st.z + 0.04);
  interaction.syrupTilt = 0.88;
}
