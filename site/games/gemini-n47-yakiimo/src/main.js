import * as THREE from '../vendor/three.module.js';
import {
  createMagicHourEnvironment,
  createGroundTextures,
  createStoneTextures,
  createCharcoalTextures,
  createWoodTextures,
  createBarkTextures,
  createLeafTextureSet,
  createPotatoSkinTextures,
  createPotatoFleshTextures,
  createFoilTextures,
  createKnitTextures,
  createSkinTextures,
  createParticleSprites,
} from './textures.js';
import {
  createSweetPotatoRig,
  createAluminumFoilRig,
  createWarmHandsRig,
  createBonfireEnvironment,
} from './geometry.js';
import { BonfireParticles } from './particles.js';
import { FallenLeavesSystem } from './leaves.js';
import { YakiimoAudio } from './audio.js';

const STATES = {
  GATHER_LEAVES: 'GATHER_LEAVES',
  WRAP_FOIL: 'WRAP_FOIL',
  PUT_IN_FIRE: 'PUT_IN_FIRE',
  ROASTING: 'ROASTING',
  TAKE_OUT: 'TAKE_OUT',
  UNWRAP_FOIL: 'UNWRAP_FOIL',
  BREAK_POTATO: 'BREAK_POTATO',
  ENJOY_MACRO: 'ENJOY_MACRO',
};

const container = document.getElementById('app');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// --- Scene & Magic-Hour Environment ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#4d2b1d', 0.032);

const { envMap, skyTex } = createMagicHourEnvironment(renderer);
scene.environment = envMap;

// Visible sunset sky dome rotated so sun disc aligns directly behind the clearing (-Z)
const skyGeo = new THREE.SphereGeometry(42, 32, 20);
const skyMat = new THREE.MeshBasicMaterial({
  map: skyTex,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
skyMesh.rotation.y = Math.PI * 0.5;
scene.add(skyMesh);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0.24, 1.82, 4.95);
const camLookAt = new THREE.Vector3(0.16, 0.72, -0.35);
const camTargetPos = new THREE.Vector3(0.24, 1.82, 4.95);
const camTargetLook = new THREE.Vector3(0.16, 0.72, -0.35);
camera.lookAt(camLookAt);

// --- Magic-Hour Backlit Lighting Rig ---
// 1. Low setting golden sun behind the woodland clearing (-Z), creating dramatic backlit rim light
const sunLight = new THREE.DirectionalLight('#ffa34d', 3.6);
sunLight.position.set(0.3, 2.55, -10.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 2.0;
sunLight.shadow.camera.far = 22.0;
sunLight.shadow.camera.left = -5.5;
sunLight.shadow.camera.right = 5.5;
sunLight.shadow.camera.top = 5.0;
sunLight.shadow.camera.bottom = -4.5;
sunLight.shadow.bias = -0.0008;
sunLight.shadow.normalBias = 0.025;
scene.add(sunLight);

// 2. Twilight sky & warm earth hemisphere bounce
const hemiLight = new THREE.HemisphereLight('#b6bce8', '#56301d', 0.78);
scene.add(hemiLight);

// 3. Soft warm front-side fill so hands, potato skin, and golden cross-section read lush & clear
const fillLight = new THREE.DirectionalLight('#ffe4c8', 0.92);
fillLight.position.set(-2.2, 3.0, 5.2);
scene.add(fillLight);

// 4. Dynamic flickering bonfire light right inside the stone ring
const fireLight = new THREE.PointLight('#ff721c', 3.5, 11.5, 1.42);
fireLight.position.set(0, 0.68, 0);
fireLight.castShadow = true;
fireLight.shadow.mapSize.width = 512;
fireLight.shadow.mapSize.height = 512;
fireLight.shadow.bias = -0.002;
scene.add(fireLight);

// 5. Subtle warm macro bounce light (illuminates exposed golden yakiimo cross-section cleanly!)
const macroRimLight = new THREE.PointLight('#ffd484', 0.0, 5.0, 1.4);
macroRimLight.position.set(0.88, 1.18, 3.35);
scene.add(macroRimLight);

// --- Procedural PBR Textures ---
const textures = {
  ground: createGroundTextures(),
  stone: createStoneTextures(),
  charcoal: createCharcoalTextures(),
  wood: createWoodTextures(),
  bark: createBarkTextures(),
  leaves: createLeafTextureSet(),
  potatoSkin: createPotatoSkinTextures(),
  potatoFlesh: createPotatoFleshTextures(),
  foil: createFoilTextures(),
  knit: createKnitTextures(),
  skin: createSkinTextures(),
  particles: createParticleSprites(),
};

// --- World & Hero Assets ---
const env = createBonfireEnvironment(textures);
scene.add(env.group);

const particles = new BonfireParticles(scene, textures.particles);
const leaves = new FallenLeavesSystem(scene, textures.leaves);
const audio = new YakiimoAudio();

// Hero Parcel Group (holds BOTH the sweet potato and its aluminum foil sheet/wrapper together!)
const parcelGroup = new THREE.Group();
const BOARD_HOME_POS = new THREE.Vector3(0.88, 0.44, 2.08);
const BOARD_HOME_ROT_Y = -0.26;
const PIT_ROAST_POS = new THREE.Vector3(0.0, 0.20, 0.06);

parcelGroup.position.copy(BOARD_HOME_POS);
parcelGroup.rotation.y = BOARD_HOME_ROT_Y;
scene.add(parcelGroup);

const potato = createSweetPotatoRig(textures.potatoSkin, textures.potatoFlesh);
const foil = createAluminumFoilRig(textures.foil);
const hands = createWarmHandsRig(textures.knit, textures.skin);

parcelGroup.add(foil.mesh);
parcelGroup.add(potato.root);
parcelGroup.add(hands.pairGroup);

scene.add(hands.hintHand);

// --- Game State ---
let state = STATES.GATHER_LEAVES;
let stateTime = 0;
let roundCount = 0;

let leavesNeeded = 10;
let gatheredLeaves = 0;
let fireIntensity = 0.24; // starts with cozy crackling starter embers
let fireTarget = 0.24;
let fireFanBoost = 0;

let wrapProgress = 0; // 0..1
let wrapTarget = 0;
let roastProgress = 0; // 0..1
let peelProgress = 0; // 0..1
let peelTarget = 0;
let splitProgress = 0; // 0..1
let splitTarget = 0;
let handAlpha = 0;

let isDraggingParcel = false;
let parcelArc = null; // smooth throw arc into/out of fire
let nextPotatoAnim = null;

// Idle hint timer (ONLY activates gently after 10s of zero touch per preference!)
let idleTimer = 0;
let idleHintPhase = 0;
let idleHintShown = false;

// --- Camera Preset Calculator (Portrait iPhone & Landscape iPad/Desktop adaptive) ---
function computeCameraTargets() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitFactor = Math.max(0, Math.min(1, (1.0 - aspect) / 0.52)); // 0 on desktop/iPad landscape, 1 on iPhone portrait

  // Widen FOV slightly on narrow phones so everything feels spacious yet large
  const desiredFov = 42 + portraitFactor * 12;
  if (Math.abs(camera.fov - desiredFov) > 0.1) {
    camera.fov = desiredFov;
    camera.updateProjectionMatrix();
  }

  switch (state) {
    case STATES.GATHER_LEAVES:
      // Cinema child's-eye magic hour view: golden sunset sky + autumn trees + bonfire + leaves + foreground foil/potato!
      camTargetPos.set(
        0.18,
        1.78 + portraitFactor * 0.72,
        4.95 + portraitFactor * 1.45
      );
      camTargetLook.set(0.14, 0.78 - portraitFactor * 0.14, -0.35);
      break;

    case STATES.WRAP_FOIL:
      // Large gleaming aluminum foil & sweet potato foreground, roaring sunset bonfire framed right behind!
      camTargetPos.set(
        1.22 - portraitFactor * 0.12,
        1.14 + portraitFactor * 0.28,
        3.78 + portraitFactor * 0.65
      );
      camTargetLook.set(0.76, 0.56, 1.65);
      break;

    case STATES.PUT_IN_FIRE:
      // Clear causal framing: shiny wrapped potato foreground + glowing ember pit + sunset sky behind!
      camTargetPos.set(
        0.42,
        1.68 + portraitFactor * 0.52,
        4.35 + portraitFactor * 0.95
      );
      camTargetLook.set(0.28, 0.58, 0.45);
      break;

    case STATES.ROASTING:
    case STATES.TAKE_OUT:
      // Intimate glowing bonfire ember view showing charred silver foil, flames, sparks & golden sunset sky!
      camTargetPos.set(
        0.12,
        1.28 + portraitFactor * 0.38,
        3.15 + portraitFactor * 0.68
      );
      camTargetLook.set(0.0, 0.56, -0.15);
      break;

    case STATES.UNWRAP_FOIL:
      camTargetPos.set(
        0.52,
        0.96 + portraitFactor * 0.24,
        3.56 + portraitFactor * 0.56
      );
      camTargetLook.set(0.86, 0.52, 2.02);
      break;

    case STATES.BREAK_POTATO:
      // HERO MACRO aligned straight onto parcelGroup's local +Z normal (-sin(-0.26), cos(-0.26)) = (-0.257, 0.966)!
      // This presents BOTH hands & BOTH golden cross-sections symmetrically in front of the glowing bonfire & sunset!
      camTargetPos.set(
        0.48,
        0.92 + portraitFactor * 0.22,
        3.58 + portraitFactor * 0.58
      );
      camTargetLook.set(0.87, 0.54, 2.04);
      break;

    case STATES.ENJOY_MACRO:
      // ULTRA-SYMMETRIC HERO MACRO CLIMAX: Both broken glowing golden fibrous halves + knit-cuffed hands + lush backlit steam + sunset bonfire!
      camTargetPos.set(
        0.49,
        0.86 + portraitFactor * 0.22,
        3.50 + portraitFactor * 0.60
      );
      camTargetLook.set(0.87, 0.56, 2.04);
      break;
  }
}

function setState(newState) {
  state = newState;
  stateTime = 0;
  idleTimer = 0;
  idleHintShown = false;
  hands.hintHand.visible = false;
  computeCameraTargets();
}

// --- Raycasting & Single-Finger Pointer Handling ---
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
const pointerNdc = new THREE.Vector2();
const hitWorld = new THREE.Vector3();
const prevHitWorld = new THREE.Vector3();

let activePointerId = null;
let pointerDownX = 0;
let pointerDownY = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let totalDragDist = 0;
let lastRustleSoundTime = 0;
let lastFoilSoundTime = 0;
let lastBlowSoundTime = 0;

function updateNdc(clientX, clientY) {
  pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
}

function raycastPlane(plane, out = new THREE.Vector3()) {
  return raycaster.ray.intersectPlane(plane, out);
}

function distToParcelScreen(clientX, clientY) {
  const p = parcelGroup.position.clone().project(camera);
  const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
  return Math.hypot(clientX - sx, clientY - sy);
}

function distToPitScreen(clientX, clientY) {
  const p = new THREE.Vector3(0, 0.25, 0).project(camera);
  const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
  return Math.hypot(clientX - sx, clientY - sy);
}

function triggerPineconeNudge(worldPos) {
  for (const cone of env.pinecones) {
    const d = Math.hypot(cone.position.x - worldPos.x, cone.position.z - worldPos.z);
    if (d < 0.72 && cone.userData.velY <= 0.1) {
      cone.userData.velY = 1.65 + Math.random() * 0.7;
      cone.userData.spin = (Math.random() - 0.5) * 10;
      audio.playCrackle(0.35);
    }
  }
}

function launchParcelToFire() {
  if (parcelArc) return;
  isDraggingParcel = false;
  audio.playFoilCrinkle(0.5);
  parcelArc = {
    startPos: parcelGroup.position.clone(),
    endPos: PIT_ROAST_POS.clone(),
    startRotY: parcelGroup.rotation.y,
    endRotY: 0.32,
    t: 0,
    duration: 0.58,
    height: 0.92,
    onDone: () => {
      audio.playEmberDrop();
      particles.burstSparks(PIT_ROAST_POS, 42, 1.55);
      fireFanBoost = Math.min(0.85, fireFanBoost + 0.55);
      roastProgress = 0;
      setState(STATES.ROASTING);
    },
  };
}

function liftParcelFromFire() {
  if (parcelArc) return;
  audio.playFoilCrinkle(0.65);
  audio.playFlameWhoosh(0.45);
  particles.burstSparks(PIT_ROAST_POS, 32, 1.2);
  potato.setRoasted(true);
  parcelArc = {
    startPos: parcelGroup.position.clone(),
    endPos: BOARD_HOME_POS.clone(),
    startRotY: parcelGroup.rotation.y,
    endRotY: BOARD_HOME_ROT_Y,
    t: 0,
    duration: 0.68,
    height: 1.05,
    onDone: () => {
      peelProgress = 0;
      peelTarget = 0;
      setState(STATES.UNWRAP_FOIL);
    },
  };
}

function startNextRound() {
  roundCount++;
  const nextVariant = roundCount % 2;

  // Celebratory swirl of golden autumn leaves & fresh leaf batch!
  leaves.scatterFreshBatch(38);
  leaves.triggerWindSwirl(1.15);
  audio.playLeafRustle(0.95);
  audio.playWarmNote(523.25, 0.05, 0.14);
  audio.playWarmNote(659.25, 0.18, 0.14);
  audio.playWarmNote(783.99, 0.32, 0.16);

  // Reset potato & foil cleanly off-screen slightly and roll fresh potato from basket side!
  potato.rebuildVariant(nextVariant);
  potato.resetBites();
  foil.setSoot(0);
  foil.updateDeform(0, 0);
  wrapProgress = 0;
  wrapTarget = 0;
  peelProgress = 0;
  peelTarget = 0;
  splitProgress = 0;
  splitTarget = 0;
  roastProgress = 0;
  handAlpha = 0;
  hands.setHoldSplit(0, 0);

  // Slightly deeper magical twilight hue on subsequent rounds for visual discovery!
  const duskShift = Math.min(1, roundCount * 0.22);
  scene.fog.color.setRGB(0.24 - duskShift * 0.04, 0.13 - duskShift * 0.02, 0.10 + duskShift * 0.03);

  parcelGroup.position.copy(BOARD_HOME_POS);
  parcelGroup.rotation.set(0, BOARD_HOME_ROT_Y, 0);

  // Animate fresh potato dropping gently onto shiny foil from basket side
  potato.root.position.set(-1.3, 0.65, -0.35);
  nextPotatoAnim = { t: 0, duration: 0.65 };

  // Keep bonfire embers alive & let child gather fresh leaves again if desired,
  // or directly wrap! Starting at GATHER_LEAVES with fewer needed leaves (10) keeps full ritual joyful & brisk!
  gatheredLeaves = 0;
  leavesNeeded = 10;
  fireTarget = 0.42;
  setState(STATES.GATHER_LEAVES);
}

// --- Pointer Event Listeners (Strict Single-Finger Safe) ---
const dom = renderer.domElement;

dom.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  if (activePointerId !== null) return; // ignore secondary fingers!
  activePointerId = e.pointerId;
  idleTimer = 0;
  hands.hintHand.visible = false;

  pointerDownX = lastPointerX = e.clientX;
  pointerDownY = lastPointerY = e.clientY;
  totalDragDist = 0;

  updateNdc(e.clientX, e.clientY);
  const hit = raycastPlane(groundPlane, hitWorld);
  if (hit) {
    prevHitWorld.copy(hitWorld);
    triggerPineconeNudge(hitWorld);
  }

  const parcelDist = distToParcelScreen(e.clientX, e.clientY);
  const pitDist = distToPitScreen(e.clientX, e.clientY);
  const minDim = Math.min(window.innerWidth, window.innerHeight);

  if (state === STATES.GATHER_LEAVES && hit) {
    // Immediate tactile burst of leaves on tap!
    const moved = leaves.applySweep(hitWorld, new THREE.Vector3(0, 0, 0), true);
    if (moved > 0) {
      audio.playLeafRustle(Math.min(1, 0.4 + moved * 0.05));
    } else if (pitDist < minDim * 0.24) {
      // Tapping embers fans tiny playful sparks!
      fireFanBoost = Math.min(0.75, fireFanBoost + 0.35);
      particles.burstSparks(new THREE.Vector3(0, 0.14, 0), 18, 1.15);
      audio.playFlameWhoosh(0.5);
    }
  } else if (state === STATES.WRAP_FOIL) {
    if (parcelDist < minDim * 0.46) {
      wrapTarget = Math.min(1, wrapTarget + 0.24);
      audio.playFoilCrinkle(0.75);
    }
  } else if (state === STATES.PUT_IN_FIRE) {
    if (parcelDist < minDim * 0.36) {
      isDraggingParcel = true;
      audio.playFoilCrinkle(0.42);
    } else if (pitDist < minDim * 0.38) {
      // Generous affordance: tapping anywhere near the glowing ember pit tosses the wrapped potato right in!
      launchParcelToFire();
    }
  } else if (state === STATES.ROASTING) {
    // Fanning/tapping the fire speeds up roasting & sends golden sparks flying!
    fireFanBoost = Math.min(0.95, fireFanBoost + 0.45);
    roastProgress = Math.min(1, roastProgress + 0.11);
    particles.burstSparks(PIT_ROAST_POS, 20, 1.25);
    audio.playFlameWhoosh(0.62);
    if (hit) leaves.applySweep(hitWorld, new THREE.Vector3(0, 0, 0), true);
  } else if (state === STATES.TAKE_OUT) {
    // Tap or pull the steaming parcel in the fire -> lifts cleanly onto the board!
    if (pitDist < minDim * 0.42 || parcelDist < minDim * 0.42) {
      liftParcelFromFire();
    }
  } else if (state === STATES.UNWRAP_FOIL) {
    if (parcelDist < minDim * 0.48) {
      peelTarget = Math.min(1, peelTarget + 0.30);
      audio.playFoilCrinkle(0.82);
    }
  } else if (state === STATES.BREAK_POTATO) {
    if (parcelDist < minDim * 0.48) {
      // Tap also cracks incrementally so very young 5-year-olds who tap instead of drag still succeed effortlessly!
      splitTarget = Math.min(1, splitTarget + 0.28);
      if (splitTarget >= 0.96) {
        completeBreakOpen();
      } else {
        audio.playCrackle(0.5);
      }
    }
  } else if (state === STATES.ENJOY_MACRO) {
    // Wait until pointerup to distinguish tap (bite) vs swipe (blow steam ふーふー)!
  }
});

dom.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return;
  e.preventDefault();
  idleTimer = 0;

  const dxPx = e.clientX - lastPointerX;
  const dyPx = e.clientY - lastPointerY;
  const stepPx = Math.hypot(dxPx, dyPx);
  totalDragDist += stepPx;

  updateNdc(e.clientX, e.clientY);
  const now = performance.now();

  if (state === STATES.GATHER_LEAVES) {
    const hit = raycastPlane(groundPlane, hitWorld);
    if (hit) {
      const vel = hitWorld.clone().sub(prevHitWorld).multiplyScalar(32);
      const moved = leaves.applySweep(hitWorld, vel, true);
      if (moved > 0 && now - lastRustleSoundTime > 95) {
        audio.playLeafRustle(Math.min(1, 0.35 + moved * 0.045));
        lastRustleSoundTime = now;
      }
      triggerPineconeNudge(hitWorld);
      prevHitWorld.copy(hitWorld);
    }
  } else if (state === STATES.WRAP_FOIL) {
    if (stepPx > 2) {
      wrapTarget = Math.min(1, wrapTarget + stepPx * 0.0042);
      if (now - lastFoilSoundTime > 125) {
        audio.playFoilCrinkle(0.68);
        lastFoilSoundTime = now;
      }
    }
  } else if (state === STATES.PUT_IN_FIRE && isDraggingParcel) {
    const hit = raycastPlane(dragPlane, hitWorld);
    if (hit) {
      // Smoothly lift & follow finger toward firepit
      parcelGroup.position.lerp(
        new THREE.Vector3(
          THREE.MathUtils.clamp(hitWorld.x, -1.6, 1.9),
          0.74,
          THREE.MathUtils.clamp(hitWorld.z, -0.7, 2.6)
        ),
        0.42
      );
      // Generous magnetic capture when approaching the glowing stone ring!
      const pitDist3D = Math.hypot(parcelGroup.position.x, parcelGroup.position.z);
      if (pitDist3D < 1.32) {
        launchParcelToFire();
      }
    }
  } else if (state === STATES.ROASTING) {
    if (stepPx > 4) {
      fireFanBoost = Math.min(1.0, fireFanBoost + stepPx * 0.006);
      roastProgress = Math.min(1, roastProgress + stepPx * 0.0012);
      if (now - lastBlowSoundTime > 260) {
        audio.playFlameWhoosh(0.5);
        particles.burstSparks(PIT_ROAST_POS, 8, 1.1);
        lastBlowSoundTime = now;
      }
    }
    const hit = raycastPlane(groundPlane, hitWorld);
    if (hit) {
      const vel = hitWorld.clone().sub(prevHitWorld).multiplyScalar(28);
      leaves.applySweep(hitWorld, vel, true);
      prevHitWorld.copy(hitWorld);
    }
  } else if (state === STATES.TAKE_OUT) {
    if (totalDragDist > 26) {
      liftParcelFromFire();
    }
  } else if (state === STATES.UNWRAP_FOIL) {
    if (stepPx > 2) {
      peelTarget = Math.min(1, peelTarget + stepPx * 0.0048);
      if (now - lastFoilSoundTime > 125) {
        audio.playFoilCrinkle(0.74);
        lastFoilSoundTime = now;
      }
    }
  } else if (state === STATES.BREAK_POTATO) {
    // Accepts horizontal outward pull OR downward slice across center — both feel super intuitive!
    if (stepPx > 2) {
      splitTarget = Math.min(1, splitTarget + stepPx * 0.0052);
      if (splitTarget >= 0.96) {
        completeBreakOpen();
      }
    }
  } else if (state === STATES.ENJOY_MACRO) {
    // Swiping across the steaming golden potato blows the sunlit backlit steam curls (ふーふー)!
    if (stepPx > 3) {
      const nx = dxPx / Math.max(10, stepPx);
      const nz = dyPx / Math.max(10, stepPx);
      particles.applySteamBlow(nx * 0.95, nz * 0.55, Math.min(1.4, stepPx * 0.06));
      if (now - lastBlowSoundTime > 380 && totalDragDist > 24) {
        audio.playBlowBreath();
        lastBlowSoundTime = now;
      }
    }
  }

  lastPointerX = e.clientX;
  lastPointerY = e.clientY;
});

function handlePointerEnd(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;

  if (state === STATES.PUT_IN_FIRE && isDraggingParcel) {
    isDraggingParcel = false;
    const movedTowardFire = e.clientY < pointerDownY - 36 || Math.hypot(parcelGroup.position.x, parcelGroup.position.z) < 1.85;
    if (movedTowardFire) {
      launchParcelToFire();
    }
  } else if (state === STATES.ENJOY_MACRO && totalDragDist < 22) {
    // Crisp joyful bite on tapped half (left or right)!
    const side = e.clientX < window.innerWidth * 0.5 ? -1 : 1;
    let targetSide = side;
    if (!potato.isHalfVisible(targetSide)) targetSide = -targetSide;

    const bitten = potato.takeBite(targetSide);
    if (bitten) {
      const eatenCount = 6 - potato.getBitesRemaining();
      audio.playBite(eatenCount - 1);
      // Fresh burst of hot aromatic steam right from the freshly bitten golden interior!
      const pos = potato.getHalfCenterWorld(targetSide);
      for (let i = 0; i < 8; i++) {
        particles.spawnSteam(pos, 1.15, 1.25);
      }
      if (potato.getBitesRemaining() <= 0) {
        setTimeout(() => {
          if (state === STATES.ENJOY_MACRO) startNextRound();
        }, 950);
      }
    }
  }
}

dom.addEventListener('pointerup', handlePointerEnd);
dom.addEventListener('pointercancel', handlePointerEnd);

let breakCompleted = false;
function completeBreakOpen() {
  if (breakCompleted) return;
  breakCompleted = true;
  splitTarget = 1.0;
  audio.playPotatoBreak();

  // Lush burst of backlit golden macro steam the exact instant it cracks open!
  const leftP = potato.getHalfCenterWorld(-1);
  const rightP = potato.getHalfCenterWorld(1);
  for (let i = 0; i < 16; i++) {
    particles.spawnSteam(i % 2 === 0 ? leftP : rightP, 1.25, 1.35);
  }
  setState(STATES.ENJOY_MACRO);
}

// --- Resize Handler ---
window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  computeCameraTargets();
});

computeCameraTargets();

// --- Main Loop ---
const clock = new THREE.Clock();
let fpsSmooth = 60;
const steamSources = [];
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function stepFrame(dt) {
  simTime += dt;
  const elapsed = simTime;
  if (dt > 0) fpsSmooth = fpsSmooth * 0.92 + (1 / dt) * 0.08;
  stateTime += dt;

  // --- 1. Update Fallen Leaves Physics ---
  leaves.update(dt, fireIntensity, (newlyEntered) => {
    if (state === STATES.GATHER_LEAVES) {
      gatheredLeaves += newlyEntered;
      const ratio = Math.min(1, gatheredLeaves / leavesNeeded);
      fireTarget = Math.max(fireTarget, 0.24 + ratio * 0.86);
      fireFanBoost = Math.min(0.85, fireFanBoost + newlyEntered * 0.14);
      particles.burstSparks(new THREE.Vector3(0, 0.15, 0), 6 + newlyEntered * 4, 1.15);
      if (newlyEntered >= 2 || ratio >= 0.99) {
        audio.playFlameWhoosh(0.45 + ratio * 0.4);
      }
      if (gatheredLeaves >= leavesNeeded) {
        // Bonfire roars warmly! Smoothly glide into foil wrapping stage
        particles.burstSparks(new THREE.Vector3(0, 0.22, 0), 38, 1.45);
        audio.playFlameWhoosh(0.9);
        setTimeout(() => {
          if (state === STATES.GATHER_LEAVES) setState(STATES.WRAP_FOIL);
        }, 850);
      }
    } else if (state === STATES.ROASTING) {
      // Sweeping extra leaves during roasting feeds embers & accelerates cooking!
      fireFanBoost = Math.min(1.0, fireFanBoost + newlyEntered * 0.18);
      roastProgress = Math.min(1, roastProgress + newlyEntered * 0.045);
      particles.burstSparks(PIT_ROAST_POS, 12, 1.25);
    }
  });

  // --- 2. Update Pinecones Bounce ---
  for (const cone of env.pinecones) {
    if (cone.position.y > cone.userData.baseY || cone.userData.velY > 0) {
      cone.position.y += cone.userData.velY * dt;
      cone.userData.velY -= 7.5 * dt;
      cone.rotation.x += cone.userData.spin * dt;
      cone.rotation.z += cone.userData.spin * 0.7 * dt;
      if (cone.position.y <= cone.userData.baseY) {
        cone.position.y = cone.userData.baseY;
        cone.userData.velY = 0;
        cone.userData.spin = 0;
      }
    }
  }

  // --- 3. Update Fire & Flickering Ember Light ---
  fireFanBoost *= Math.exp(-dt * 1.4);
  const desiredFire =
    state === STATES.GATHER_LEAVES
      ? fireTarget
      : state === STATES.ROASTING || state === STATES.TAKE_OUT
      ? 0.84
      : 0.72;
  fireIntensity += (desiredFire + fireFanBoost * 0.45 - fireIntensity) * Math.min(1, dt * 3.8);

  const flicker =
    1.0 +
    Math.sin(elapsed * 13.7) * 0.08 +
    Math.sin(elapsed * 23.3 + 1.2) * 0.05 +
    Math.cos(elapsed * 7.1) * 0.06;
  fireLight.intensity = (1.6 + fireIntensity * 7.2) * flicker;
  fireLight.position.x = Math.sin(elapsed * 9.5) * 0.07;
  fireLight.position.y = 0.52 + fireIntensity * 0.35 + Math.sin(elapsed * 16.2) * 0.04;
  fireLight.position.z = Math.cos(elapsed * 8.3) * 0.07;

  env.groundMat.emissiveIntensity = (0.45 + fireIntensity * 1.65) * (0.92 + 0.08 * Math.sin(elapsed * 6.5));
  env.barkMat.emissiveIntensity = (0.35 + fireIntensity * 1.25) * flicker;
  env.coalMat.emissiveIntensity = (0.55 + fireIntensity * 1.95) * (0.9 + 0.1 * Math.sin(elapsed * 5.2));

  // --- 4. Parcel Arc / Next Potato Animations ---
  if (parcelArc) {
    parcelArc.t += dt / parcelArc.duration;
    const u = Math.min(1, parcelArc.t);
    const ease = u * u * (3 - 2 * u);
    parcelGroup.position.lerpVectors(parcelArc.startPos, parcelArc.endPos, ease);
    parcelGroup.position.y += Math.sin(u * Math.PI) * parcelArc.height;
    parcelGroup.rotation.y = THREE.MathUtils.lerp(parcelArc.startRotY, parcelArc.endRotY, ease);
    if (u >= 1) {
      const done = parcelArc.onDone;
      parcelArc = null;
      if (done) done();
    }
  } else if (state === STATES.PUT_IN_FIRE && !isDraggingParcel) {
    // Gently return to home board if released early, with subtle inviting breath wobble
    parcelGroup.position.lerp(BOARD_HOME_POS, Math.min(1, dt * 8));
    parcelGroup.rotation.y = THREE.MathUtils.lerp(parcelGroup.rotation.y, BOARD_HOME_ROT_Y, Math.min(1, dt * 8));
  }

  if (nextPotatoAnim) {
    nextPotatoAnim.t += dt / nextPotatoAnim.duration;
    const u = Math.min(1, nextPotatoAnim.t);
    const ease = 1 - Math.pow(1 - u, 3);
    potato.root.position.set(
      THREE.MathUtils.lerp(-1.3, 0, ease),
      Math.sin(u * Math.PI) * 0.42 + (1 - ease) * 0.25,
      THREE.MathUtils.lerp(-0.35, 0, ease)
    );
    if (u >= 1) {
      potato.root.position.set(0, 0, 0);
      nextPotatoAnim = null;
    }
  }

  // --- 5. Stage Progress Smoothing & Transitions ---
  if (state === STATES.WRAP_FOIL) {
    wrapProgress += (wrapTarget - wrapProgress) * Math.min(1, dt * 8.5);
    foil.updateDeform(wrapProgress, 0);
    if (wrapProgress > 0.96 && stateTime > 0.5) {
      wrapProgress = 1.0;
      foil.updateDeform(1, 0);
      audio.playWarmNote(440, 0.02, 0.1);
      setState(STATES.PUT_IN_FIRE);
    }
  } else if (state === STATES.ROASTING) {
    // Natural cozy roasting speed (~5.5 seconds passive, faster when fanning/adding leaves!)
    roastProgress = Math.min(1, roastProgress + dt * (0.175 + fireFanBoost * 0.18));
    foil.setSoot(roastProgress * 0.88);
    // Subtle sizzle tremor as heat peaks
    const tremor = roastProgress > 0.55 ? Math.sin(elapsed * 28) * 0.008 * roastProgress : 0;
    parcelGroup.position.set(PIT_ROAST_POS.x + tremor, PIT_ROAST_POS.y, PIT_ROAST_POS.z);

    if (roastProgress >= 1.0) {
      // Done roasting! Big fragrant puff of backlit steam & gentle jiggle to invite pulling it out!
      for (let i = 0; i < 10; i++) {
        particles.spawnSteam(PIT_ROAST_POS, 1.0, 1.1);
      }
      audio.playWarmNote(587.33, 0.02, 0.12);
      setState(STATES.TAKE_OUT);
    }
  } else if (state === STATES.TAKE_OUT && !parcelArc) {
    // Gentle inviting steaming pulse in the glowing embers
    const pulse = Math.sin(elapsed * 4.5) * 0.014;
    parcelGroup.position.set(PIT_ROAST_POS.x, PIT_ROAST_POS.y + Math.max(0, pulse), PIT_ROAST_POS.z);
    parcelGroup.rotation.z = Math.sin(elapsed * 6.0) * 0.035;
  } else if (state === STATES.UNWRAP_FOIL) {
    parcelGroup.rotation.z = 0;
    peelProgress += (peelTarget - peelProgress) * Math.min(1, dt * 8.5);
    foil.updateDeform(1, peelProgress);
    if (peelProgress > 0.95 && stateTime > 0.4) {
      peelProgress = 1.0;
      foil.updateDeform(1, 1);
      breakCompleted = false;
      splitProgress = 0;
      splitTarget = 0;
      setState(STATES.BREAK_POTATO);
    }
  } else if (state === STATES.BREAK_POTATO) {
    splitProgress += (splitTarget - splitProgress) * Math.min(1, dt * 8.5);
    handAlpha = Math.min(1, handAlpha + dt * 3.2);
    potato.setSplit(splitProgress);
    hands.setHoldSplit(splitProgress, handAlpha);
  } else if (state === STATES.ENJOY_MACRO) {
    splitProgress += (1.0 - splitProgress) * Math.min(1, dt * 7.5);
    // Keep warm hands gently holding/presenting the steaming halves while you blow steam & eat!
    const targetHandAlpha = potato.getBitesRemaining() > 0 ? 0.92 : 0.0;
    handAlpha += (targetHandAlpha - handAlpha) * Math.min(1, dt * 3.5);
    potato.setSplit(splitProgress);
    hands.setHoldSplit(splitProgress, handAlpha);
  } else {
    handAlpha = Math.max(0, handAlpha - dt * 4.0);
    hands.setHoldSplit(0, handAlpha);
  }

  // Macro warm accent lighting (makes exposed golden yakiimo cross-section glow deliciously!)
  const macroLightTarget =
    state === STATES.ENJOY_MACRO ? 2.6 : state === STATES.BREAK_POTATO ? 1.5 : state === STATES.UNWRAP_FOIL ? 0.9 : 0.0;
  macroRimLight.intensity += (macroLightTarget - macroRimLight.intensity) * Math.min(1, dt * 3.5);

  // --- 6. Collect Active Steam Sources ---
  steamSources.length = 0;
  if (state === STATES.ROASTING && roastProgress > 0.35) {
    steamSources.push({
      pos: tmpV1.set(PIT_ROAST_POS.x - 0.35, PIT_ROAST_POS.y + 0.14, PIT_ROAST_POS.z),
      scale: 0.75 + roastProgress * 0.5,
      opacity: 0.55 * roastProgress,
      rate: 0.45,
    });
    steamSources.push({
      pos: tmpV2.set(PIT_ROAST_POS.x + 0.35, PIT_ROAST_POS.y + 0.14, PIT_ROAST_POS.z),
      scale: 0.75 + roastProgress * 0.5,
      opacity: 0.55 * roastProgress,
      rate: 0.45,
    });
  } else if (state === STATES.TAKE_OUT) {
    steamSources.push({
      pos: tmpV1.set(PIT_ROAST_POS.x, PIT_ROAST_POS.y + 0.2, PIT_ROAST_POS.z),
      scale: 1.1,
      opacity: 0.95,
      rate: 0.85,
    });
  } else if (state === STATES.UNWRAP_FOIL || state === STATES.BREAK_POTATO) {
    steamSources.push({
      pos: tmpV1.set(BOARD_HOME_POS.x, BOARD_HOME_POS.y + 0.18, BOARD_HOME_POS.z),
      scale: 0.95 + peelProgress * 0.25,
      opacity: 0.85,
      rate: 0.75,
    });
  } else if (state === STATES.ENJOY_MACRO) {
    // DENSE, LUSH BACKLIT MACRO STEAM rising straight off BOTH golden fractured cross-sections!
    if (potato.isHalfVisible(-1)) {
      potato.getHalfCenterWorld(-1, tmpV1);
      tmpV1.y += 0.05;
      steamSources.push({ pos: tmpV1, scale: 1.15, opacity: 1.15, rate: 0.95 });
    }
    if (potato.isHalfVisible(1)) {
      potato.getHalfCenterWorld(1, tmpV2);
      tmpV2.y += 0.05;
      steamSources.push({ pos: tmpV2, scale: 1.15, opacity: 1.15, rate: 0.95 });
    }
  }

  particles.update(dt, fireIntensity, steamSources);

  // --- 7. Continuous Web Audio Ambience ---
  const sizzleAmt =
    state === STATES.ROASTING
      ? Math.max(0, (roastProgress - 0.15) * 1.15)
      : state === STATES.TAKE_OUT
      ? 0.9
      : 0;
  audio.update(dt, fireIntensity, sizzleAmt);

  // --- 8. Gentle Single-Shot Idle Hand Demo ONLY after 10s of total inactivity ---
  idleTimer += dt;
  if (idleTimer > 10.0 && !idleHintShown && activePointerId === null && !parcelArc) {
    idleHintPhase += dt * 0.72;
    if (idleHintPhase >= 1.0) {
      idleHintShown = true;
      idleHintPhase = 0;
      hands.hintHand.visible = false;
    } else {
      hands.hintHand.visible = true;
      const s = Math.sin(idleHintPhase * Math.PI);
      if (state === STATES.GATHER_LEAVES) {
        hands.hintHand.position.set(
          THREE.MathUtils.lerp(-1.95, -0.35, idleHintPhase),
          0.34 + s * 0.18,
          THREE.MathUtils.lerp(1.45, 0.35, idleHintPhase)
        );
        hands.hintHand.rotation.set(0.35, -0.6, 0.25);
      } else if (state === STATES.WRAP_FOIL || state === STATES.UNWRAP_FOIL) {
        hands.hintHand.position.set(
          BOARD_HOME_POS.x + 0.15,
          BOARD_HOME_POS.y + 0.25 + s * 0.12,
          BOARD_HOME_POS.z + THREE.MathUtils.lerp(0.45, -0.25, idleHintPhase)
        );
        hands.hintHand.rotation.set(0.4, -0.3, 0.3);
      } else if (state === STATES.PUT_IN_FIRE) {
        hands.hintHand.position.lerpVectors(
          new THREE.Vector3(BOARD_HOME_POS.x, BOARD_HOME_POS.y + 0.32, BOARD_HOME_POS.z),
          new THREE.Vector3(0.05, 0.65, 0.1),
          idleHintPhase
        );
        hands.hintHand.position.y += s * 0.35;
        hands.hintHand.rotation.set(0.35, -0.4, 0.2);
      } else if (state === STATES.TAKE_OUT) {
        hands.hintHand.position.lerpVectors(
          new THREE.Vector3(0.05, 0.42, 0.1),
          new THREE.Vector3(BOARD_HOME_POS.x, BOARD_HOME_POS.y + 0.42, BOARD_HOME_POS.z),
          idleHintPhase
        );
        hands.hintHand.position.y += s * 0.35;
      } else {
        hands.hintHand.visible = false;
      }
    }
  }

  // --- 9. Smooth Cinematic Camera Choreography ---
  const camLerp = 1 - Math.exp(-dt * 3.2);
  // Subtle handheld natural outdoor breathing motion (cinema lens feel!)
  const breatheX = Math.sin(elapsed * 0.55) * 0.018;
  const breatheY = Math.cos(elapsed * 0.72) * 0.014;
  camera.position.lerp(
    tmpV1.set(camTargetPos.x + breatheX, camTargetPos.y + breatheY, camTargetPos.z),
    camLerp
  );
  camLookAt.lerp(camTargetLook, camLerp);
  camera.lookAt(camLookAt);

  renderer.render(scene, camera);
}

let simTime = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  stepFrame(dt);
}

animate();

// --- Inspection & QA Helpers (zero visible UI; used only for visual verification) ---
window.__yakiimo = {
  getState: () => ({
    state,
    gatheredLeaves,
    fireIntensity: Number(fireIntensity.toFixed(2)),
    wrapProgress: Number(wrapProgress.toFixed(2)),
    roastProgress: Number(roastProgress.toFixed(2)),
    peelProgress: Number(peelProgress.toFixed(2)),
    splitProgress: Number(splitProgress.toFixed(2)),
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    fps: Math.round(fpsSmooth),
    pixelRatio: renderer.getPixelRatio(),
  }),
  stepAndRender: (frames = 20, dt = 0.033) => {
    for (let i = 0; i < frames; i++) stepFrame(dt);
  },
  jumpToStage: (stageName) => {
    parcelArc = null;
    nextPotatoAnim = null;
    if (stageName === 'GATHER_LEAVES') {
      leaves.resetAllLeaves();
      gatheredLeaves = 0;
      wrapProgress = wrapTarget = 0;
      roastProgress = 0;
      peelProgress = peelTarget = 0;
      splitProgress = splitTarget = 0;
      breakCompleted = false;
      fireIntensity = fireTarget = 0.36;
      potato.rebuildVariant(0);
      potato.setRoasted(false);
      foil.setSoot(0);
      foil.updateDeform(0, 0);
      parcelGroup.position.copy(BOARD_HOME_POS);
      parcelGroup.rotation.set(0, BOARD_HOME_ROT_Y, 0);
      handAlpha = 0;
      hands.setHoldSplit(0, 0);
      setState(STATES.GATHER_LEAVES);
    } else if (stageName === 'GATHER_ACTIVE') {
      fireIntensity = fireTarget = 0.95;
      leaves.triggerWindSwirl(1.1);
      particles.burstSparks(new THREE.Vector3(0, 0.16, 0), 65, 1.45);
      setState(STATES.GATHER_LEAVES);
    } else if (stageName === 'WRAP_FOIL') {
      fireIntensity = fireTarget = 0.85;
      wrapProgress = wrapTarget = 0.44;
      foil.setSoot(0);
      foil.updateDeform(0.44, 0);
      potato.setRoasted(false);
      potato.setSplit(0);
      parcelGroup.position.copy(BOARD_HOME_POS);
      parcelGroup.rotation.set(0, BOARD_HOME_ROT_Y, 0);
      setState(STATES.WRAP_FOIL);
    } else if (stageName === 'ROASTING') {
      fireIntensity = fireTarget = 0.95;
      wrapProgress = wrapTarget = 1.0;
      roastProgress = 0.78;
      foil.updateDeform(1, 0);
      foil.setSoot(0.7);
      parcelGroup.position.copy(PIT_ROAST_POS);
      parcelGroup.rotation.set(0, 0.32, 0);
      particles.burstSparks(PIT_ROAST_POS, 54, 1.35);
      setState(STATES.ROASTING);
    } else if (stageName === 'BREAK_MACRO') {
      fireIntensity = fireTarget = 0.82;
      wrapProgress = wrapTarget = 1.0;
      peelProgress = peelTarget = 1.0;
      splitProgress = splitTarget = 1.0;
      breakCompleted = true;
      handAlpha = 0.96;
      foil.updateDeform(1, 1);
      foil.setSoot(0.80);
      potato.resetBites();
      potato.setRoasted(true);
      potato.setSplit(1.0);
      hands.setHoldSplit(1.0, 0.96);
      parcelGroup.position.copy(BOARD_HOME_POS);
      parcelGroup.rotation.set(0, BOARD_HOME_ROT_Y, 0);
      setState(STATES.ENJOY_MACRO);
      const lp = potato.getHalfCenterWorld(-1);
      const rp = potato.getHalfCenterWorld(1);
      for (let i = 0; i < 24; i++) {
        particles.spawnSteam(i % 2 === 0 ? lp : rp, 1.15, 1.25);
      }
    }
    computeCameraTargets();
    camera.position.copy(camTargetPos);
    camLookAt.copy(camTargetLook);
    camera.lookAt(camLookAt);
  },
};
