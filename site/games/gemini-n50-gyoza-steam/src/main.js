import * as THREE from '../vendor/three.module.js';
import {
  createKitchenEnvMap,
  createWoodBoardTextures,
  createDoughTextures,
  createFillingTextures,
  createCastIronTextures,
  createHaneTextures,
  createSearSoleTextures,
  createStonewareTextures,
  createKitchenTileTextures,
  createBrushedSteelTextures,
  createSteamSpriteTexture,
  CondensationSimulator,
} from './textures.js';
import {
  createGyoza,
  createSkillet,
  createGlassLid,
  createGasStove,
  createFillingBowl,
  createWaterCup,
  createServingSet,
  createKitchenEnvironment,
  createDemoHand,
} from './meshes.js';
import { KitchenParticles } from './particles.js';
import { KitchenAudio } from './audio.js';

// =========================================================================
// RENDERER & CINEMATIC KITCHEN SCENE SETUP
// =========================================================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141210);
scene.fog = new THREE.FogExp2(0x181512, 0.04);

scene.environment = createKitchenEnvMap(renderer);
scene.environmentIntensity = 1.1;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 40);

// Studio-Grade Japanese Kitchen Lighting Rig
// 1. Warm overhead range-hood directional keylight with crisp soft shadows
const keyLight = new THREE.DirectionalLight(0xffeed6, 2.3);
keyLight.position.set(1.6, 6.4, 2.6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 14.5;
keyLight.shadow.camera.left = -4.6;
keyLight.shadow.camera.right = 4.6;
keyLight.shadow.camera.top = 4.6;
keyLight.shadow.camera.bottom = -4.6;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.022;
scene.add(keyLight);

// 2. Cool soft northern window fill from left (cinematic warm/cool photographic depth!)
const windowFill = new THREE.DirectionalLight(0xc2dcff, 0.78);
windowFill.position.set(-5.8, 3.0, 2.2);
scene.add(windowFill);

// 3. Strong warm kitchen rim backlight (makes rising steam, condensation beads & oil glints SPARKLE!)
const rimLight = new THREE.SpotLight(0xffcf94, 4.8, 15, Math.PI * 0.34, 0.6, 1.15);
rimLight.position.set(0.9, 3.2, -3.1);
rimLight.target.position.set(0.85, 0.48, -0.92);
scene.add(rimLight);
scene.add(rimLight.target);

// 4. Warm countertop bounce hemisphere + subtle warm interior pan glow for backlit steamed gyoza
const hemiLight = new THREE.HemisphereLight(0xffe9d2, 0x2e2319, 0.38);
scene.add(hemiLight);

const panWarmGlow = new THREE.PointLight(0xffdca6, 0.85, 3.6, 1.8);
panWarmGlow.position.set(0.85, 0.95, -0.78);
scene.add(panWarmGlow);

// =========================================================================
// TEXTURES, SIMULATORS & WORLD OBJECTS
// =========================================================================
const GYOZA_TOTAL = 5;
const textures = {
  wood: createWoodBoardTextures(),
  dough: createDoughTextures(),
  filling: createFillingTextures(),
  castIron: createCastIronTextures(),
  hane: createHaneTextures(GYOZA_TOTAL),
  searSole: createSearSoleTextures(),
  stoneware: createStonewareTextures(),
  tile: createKitchenTileTextures(),
  steel: createBrushedSteelTextures(),
  steam: createSteamSpriteTexture(),
};

const sharedGyozaMats = {
  dough: new THREE.MeshPhysicalMaterial({
    map: textures.dough.map,
    bumpMap: textures.dough.bumpMap,
    bumpScale: 0.015,
    roughnessMap: textures.dough.roughnessMap,
    roughness: 0.86,
    metalness: 0.0,
    clearcoat: 0.04,
    side: THREE.DoubleSide,
  }),
  filling: new THREE.MeshPhysicalMaterial({
    map: textures.filling.map,
    bumpMap: textures.filling.bumpMap,
    bumpScale: 0.04,
    roughnessMap: textures.filling.roughnessMap,
    roughness: 0.38,
    clearcoat: 0.56,
    clearcoatRoughness: 0.18,
  }),
  searSole: new THREE.MeshPhysicalMaterial({
    map: textures.searSole.map,
    bumpMap: textures.searSole.bumpMap,
    bumpScale: 0.028,
    roughnessMap: textures.searSole.roughnessMap,
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  }),
};

const condensationSim = new CondensationSimulator(1024, 512);
const particles = new KitchenParticles(scene, textures.steam);
const audio = new KitchenAudio();

// Cleanly separated kitchen anchors (zero clipping or overlapping props!)
const BOARD_WORK_POS = new THREE.Vector3(-0.46, 0.095, 1.48);
const PAN_POS = new THREE.Vector3(0.85, 0.28, -0.92);
const BOWL_POS = new THREE.Vector3(-1.58, 0.0, 1.06);
const CUP_REST_POS = new THREE.Vector3(-1.72, -0.02, -0.86);
const LID_REST_POS = new THREE.Vector3(3.15, 0.0, -0.95);
const PLATE_REST_POS = new THREE.Vector3(-1.55, 0.0, -0.68);
// Authentic serving position: ceramic plate rests cleanly on the counter/board well clear of the gas stove!
const SERVE_PLATE_POS = new THREE.Vector3(-0.46, 0.10, 2.25);
const SAUCE_POS = new THREE.Vector3(1.58, 0.0, 2.58);

const env = createKitchenEnvironment(textures);
scene.add(env.group);

const stove = createGasStove(textures);
stove.group.position.set(PAN_POS.x, 0.0, PAN_POS.z);
scene.add(stove.group);

const skillet = createSkillet(textures, GYOZA_TOTAL);
skillet.group.position.copy(PAN_POS);
scene.add(skillet.group);

const lid = createGlassLid(condensationSim);
lid.group.position.copy(LID_REST_POS);
scene.add(lid.group);

const bowl = createFillingBowl(textures);
bowl.group.position.copy(BOWL_POS);
scene.add(bowl.group);

const spoonHomePos = new THREE.Vector3(BOWL_POS.x + 0.34, BOWL_POS.y + 0.66, BOWL_POS.z + 0.06);
bowl.spoonGroup.position.copy(spoonHomePos);
bowl.spoonGroup.rotation.set(0.32, -0.22, -0.12);
scene.add(bowl.spoonGroup);

const waterCup = createWaterCup();
waterCup.group.position.copy(CUP_REST_POS);
scene.add(waterCup.group);

const serving = createServingSet(textures);
serving.plateGroup.position.copy(PLATE_REST_POS);
serving.plateGroup.visible = false;
scene.add(serving.plateGroup);

serving.sauceGroup.position.copy(SAUCE_POS);
serving.sauceGroup.visible = false;
scene.add(serving.sauceGroup);

scene.add(serving.chopsticks);

const demoHand = createDemoHand();
scene.add(demoHand.group);

// =========================================================================
// GAME STATE & PHASE MACHINE
// =========================================================================
const state = {
  phase: 'WRAP_SCOOP',
  time: 0,
  idleTime: 0,
  demoShownForPhase: false,
  demoAnim: 0,

  wrappedCount: 0,
  activeGyoza: null,
  panGyozas: [],
  spoonAnim: 0,
  spoonActive: false,
  placingGyozaAnim: 0,
  placingGyozaObj: null,
  placingStartPos: new THREE.Vector3(),
  placingTargetIdx: 0,

  heatLevel: 0.82,
  waterInCup: 1.0,
  waterInPan: 0.0,
  pouring: false,
  pourTilt: 0,
  lidOnPan: false,
  lidProgress: 0,
  cookProgress: 0,
  crispProgress: 0,
  steamBurstTimer: 0,

  plateOnPan: 0,
  flipProgress: 0,
  flipping: false,
  panLiftAfterFlip: 0,
  sauceRipple: 0,
  eatenCount: 0,
  eatAnim: null,

  pointerDown: false,
  pointerId: null,
  dragMode: null,
  dragStartNDC: new THREE.Vector2(),
  lastNDC: new THREE.Vector2(),
  lastWipeSound: 0,
  wobbles: new Map(),
};

const camTargetPos = new THREE.Vector3();
const camTargetLook = new THREE.Vector3();
const camCurrPos = new THREE.Vector3(-0.35, 2.05, 4.1);
const camCurrLook = new THREE.Vector3(-0.08, 0.28, 0.55);
camera.position.copy(camCurrPos);
camera.lookAt(camCurrLook);

function getPanSlotLocal(index) {
  const angle = (index / GYOZA_TOTAL) * Math.PI * 2 - Math.PI / 2;
  const r = 0.74;
  return {
    pos: new THREE.Vector3(Math.cos(angle) * r, 0.068, Math.sin(angle) * r),
    rotY: -angle + Math.PI / 2,
  };
}

function triggerWobble(obj, strength = 0.14) {
  state.wobbles.set(obj, { t: 0, strength, baseRotZ: obj.rotation.z });
}

function spawnNextWrapper() {
  const g = createGyoza(sharedGyozaMats);
  g.group.position.copy(BOARD_WORK_POS);
  g.group.position.y += 0.12;
  g.group.scale.setScalar(0.9);
  scene.add(g.group);
  state.activeGyoza = g;
  particles.spawnFlourPuff(BOARD_WORK_POS, 5);
}

function setPhase(next) {
  state.phase = next;
  state.idleTime = 0;
  state.demoShownForPhase = false;
  state.demoAnim = 0;
  demoHand.group.visible = false;

  if (next === 'POUR_WATER') {
    waterCup.group.visible = true;
    lid.group.visible = true;
  } else if (next === 'PLACE_PLATE') {
    serving.plateGroup.visible = true;
    serving.plateGroup.position.set(PAN_POS.x - 2.05, 0.02, PAN_POS.z + 0.25);
    serving.plateGroup.rotation.set(0, 0, 0);
  } else if (next === 'ENJOY') {
    serving.sauceGroup.visible = true;
    serving.sauceGroup.position.copy(SAUCE_POS);
    env.stackGroup.visible = true;
    bowl.group.visible = false;
    bowl.spoonGroup.visible = false;
  } else if (next === 'WRAP_SCOOP') {
    bowl.group.visible = true;
    bowl.spoonGroup.visible = true;
  }
}

function resetEntireGame() {
  if (state.activeGyoza) {
    scene.remove(state.activeGyoza.group);
    state.activeGyoza = null;
  }
  for (const g of state.panGyozas) {
    if (g.group.parent) g.group.parent.remove(g.group);
  }
  state.panGyozas = [];

  if (skillet.haneGroup.parent !== skillet.group) {
    skillet.group.add(skillet.haneGroup);
  }
  skillet.haneGroup.position.set(0, 0.064, 0);
  skillet.haneGroup.rotation.set(0, 0, 0);
  for (const w of skillet.haneWedges) {
    w.userData.cracked = false;
    w.userData.crackAnim = 0;
    w.position.set(0, 0, 0);
    w.rotation.set(0, 0, 0);
    w.visible = false;
  }

  skillet.group.position.copy(PAN_POS);
  skillet.group.rotation.set(0, 0, 0);
  skillet.group.visible = true;
  skillet.updateLiquid(0, 0, 0);
  skillet.updateHane(0);

  lid.group.position.copy(LID_REST_POS);
  lid.group.rotation.set(0, 0, 0);
  lid.group.visible = true;
  condensationSim.clear();

  waterCup.group.position.copy(CUP_REST_POS);
  waterCup.group.rotation.set(0, 0, 0);
  waterCup.group.visible = true;
  waterCup.waterInside.scale.y = 1;
  waterCup.waterInside.position.y = 0.39;
  waterCup.streamMesh.visible = false;

  serving.plateGroup.visible = false;
  serving.plateGroup.rotation.set(0, 0, 0);
  serving.sauceGroup.visible = false;
  serving.chopsticks.visible = false;

  state.wrappedCount = 0;
  state.waterInCup = 1.0;
  state.waterInPan = 0.0;
  state.pouring = false;
  state.pourTilt = 0;
  state.lidOnPan = false;
  state.lidProgress = 0;
  state.cookProgress = 0;
  state.crispProgress = 0;
  state.steamBurstTimer = 0;
  state.plateOnPan = 0;
  state.flipProgress = 0;
  state.flipping = false;
  state.panLiftAfterFlip = 0;
  state.eatenCount = 0;
  state.eatAnim = null;
  state.heatLevel = 0.82;

  spawnNextWrapper();
  setPhase('WRAP_SCOOP');
}

spawnNextWrapper();

// =========================================================================
// CAMERA CHOREOGRAPHY (True Low-Angle Side View & Glass-Lid Perspective!)
// =========================================================================
function updateCameraTargets() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitBoost = aspect < 1.0 ? (1.0 - aspect) * 2.15 : 0;

  if (state.phase === 'WRAP_SCOOP' || state.phase === 'WRAP_PLEAT' || state.phase === 'WRAP_PLACE') {
    // Low-angle hero counter view: filling bowl + wrapper on wood board + glistening cast-iron skillet behind!
    camTargetPos.set(-0.42, 1.88 + portraitBoost * 0.65, 3.95 + portraitBoost * 1.5);
    camTargetLook.set(-0.22, 0.28, 0.65);
  } else if (state.phase === 'POUR_WATER') {
    // Dramatic low-angle side view showing blue flames, skillet, pouring glass cup & erupting steam!
    camTargetPos.set(PAN_POS.x - 0.38, 1.44 + portraitBoost * 0.45, PAN_POS.z + 4.35 + portraitBoost * 1.6);
    camTargetLook.set(PAN_POS.x - 0.32, 0.56, PAN_POS.z);
  } else if (state.phase === 'PLACE_LID') {
    camTargetPos.set(PAN_POS.x + 0.72, 1.48 + portraitBoost * 0.45, PAN_POS.z + 4.65 + portraitBoost * 1.65);
    camTargetLook.set(PAN_POS.x + 0.65, 0.52, PAN_POS.z);
  } else if (state.phase === 'STEAM_COOK') {
    // SIGNATURE SHOT: True low-angle side view looking RIGHT THROUGH the domed glass lid!
    // Frames: glowing blue flames below + dark skillet + bubbling gyoza + steamy glass & droplets + knob + steam vent jet + front rotary dial!
    camTargetPos.set(PAN_POS.x + 0.14, 1.24 + portraitBoost * 0.35, PAN_POS.z + 4.18 + portraitBoost * 1.55);
    camTargetLook.set(PAN_POS.x + 0.08, 0.58, PAN_POS.z);
  } else if (state.phase === 'LIFT_LID') {
    camTargetPos.set(PAN_POS.x + 0.15, 1.46 + portraitBoost * 0.4, PAN_POS.z + 4.05 + portraitBoost * 1.5);
    camTargetLook.set(PAN_POS.x, 0.56, PAN_POS.z);
  } else if (state.phase === 'PLACE_PLATE') {
    camTargetPos.set(PAN_POS.x - 0.48, 1.72 + portraitBoost * 0.45, PAN_POS.z + 4.35 + portraitBoost * 1.6);
    camTargetLook.set(PAN_POS.x - 0.45, 0.48, PAN_POS.z);
  } else if (state.phase === 'FLIP_PAN') {
    camTargetPos.set(PAN_POS.x + 0.25, 1.82 + portraitBoost * 0.45, PAN_POS.z + 4.15 + portraitBoost * 1.5);
    camTargetLook.set(PAN_POS.x, 0.68, PAN_POS.z);
  } else if (state.phase === 'ENJOY') {
    // Hero food-magazine 25-degree low shot framing BOTH the entire seared golden hanetsuki rosette AND the gleaming soy/rayu dish!
    camTargetPos.set(SERVE_PLATE_POS.x + 0.85, 2.02 + portraitBoost * 0.55, SERVE_PLATE_POS.z + 3.82 + portraitBoost * 1.55);
    camTargetLook.set(SERVE_PLATE_POS.x + 0.52, 0.28, SERVE_PLATE_POS.z + 0.16);
  }
}

// =========================================================================
// RAYCASTING & FORGIVING SINGLE-FINGER GESTURE SYSTEM
// =========================================================================
const raycaster = new THREE.Raycaster();
const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_WORK_POS.y);
const panPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PAN_POS.y + 0.3));

function getNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

function hitGroup(ndc, targetObj) {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(targetObj, true);
  return hits.length > 0 ? hits[0] : null;
}

function screenDistToWorld(ndc, worldPos) {
  const p = worldPos.clone().project(camera);
  return Math.hypot(ndc.x - p.x, ndc.y - p.y);
}

function triggerScoopFilling() {
  if (state.spoonActive || !state.activeGyoza) return;
  state.spoonActive = true;
  state.spoonAnim = 0;
  bowl.spoonFilling.visible = true;
  audio.playScoopPlop();
}

function advancePleatAtNDC(ndc) {
  const g = state.activeGyoza;
  if (!g) return;
  raycaster.setFromCamera(ndc, camera);
  const hitPt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(workPlane, hitPt)) return;

  const localX = hitPt.x - g.group.position.x;
  const norm = THREE.MathUtils.clamp((localX + 0.42) / 0.84, 0, 1);
  const idx = Math.min(5, Math.floor(norm * 6));

  g.state.fold = Math.min(1, g.state.fold + 0.22);

  let newlyPinched = false;
  for (let k = Math.max(0, idx - 1); k <= Math.min(5, idx); k++) {
    if (g.state.pleats[k] < 0.99) {
      g.state.pleats[k] = 1.0;
      newlyPinched = true;
    }
  }
  if (newlyPinched) {
    const doneCount = g.state.pleats.filter((p) => p > 0.8).length;
    g.state.fold = Math.max(g.state.fold, 0.35 + (doneCount / 6) * 0.65);
    audio.playPleatPinch(doneCount - 1);
    particles.spawnFlourPuff(
      new THREE.Vector3(g.group.position.x + localX * 0.5, g.group.position.y + 0.14, g.group.position.z),
      3
    );
    g.updateGeometry();

    if (doneCount >= 6) {
      g.state.fold = 1.0;
      g.updateGeometry();
      setPhase('WRAP_PLACE');
    }
  }
}

function triggerQuickPleatTap() {
  const g = state.activeGyoza;
  if (!g) return;
  const nextIdx = g.state.pleats.findIndex((p) => p < 0.9);
  if (nextIdx >= 0) {
    g.state.pleats[nextIdx] = 1;
    if (nextIdx + 1 < 6) g.state.pleats[nextIdx + 1] = 1;
    const doneCount = g.state.pleats.filter((p) => p > 0.8).length;
    g.state.fold = Math.min(1, 0.32 + (doneCount / 6) * 0.68);
    audio.playPleatPinch(doneCount - 1);
    particles.spawnFlourPuff(g.group.position, 4);
    g.updateGeometry();
    if (doneCount >= 6) {
      g.state.fold = 1.0;
      g.updateGeometry();
      setPhase('WRAP_PLACE');
    }
  }
}

function sendActiveGyozaToPan() {
  if (!state.activeGyoza || state.placingGyozaObj) return;
  state.placingGyozaObj = state.activeGyoza;
  state.activeGyoza = null;
  state.placingGyozaAnim = 0;
  state.placingStartPos.copy(state.placingGyozaObj.group.position);
  state.placingTargetIdx = state.wrappedCount;
}

function triggerStartFlip() {
  if (state.flipping) return;
  state.flipping = true;
  state.flipProgress = 0;
  state.panLiftAfterFlip = 0;
  audio.playFlipWhoosh();
}

function crackWedgeAt(wedge, worldPos) {
  if (wedge.userData.cracked) return;
  wedge.userData.cracked = true;
  wedge.userData.crackAnim = 0.01;
  audio.playHaneCrack();
  particles.spawnHaneCrumbs(worldPos, PAN_POS.y + 0.16, 18);
}

function triggerEatGyoza(g) {
  if (state.eatAnim || g.state.bitten > 0.5) return;
  state.eatAnim = {
    gyoza: g,
    t: 0,
    startPos: g.group.position.clone(),
    startRot: g.group.rotation.clone(),
    dipped: false,
    bitten: false,
  };
  serving.chopsticks.visible = true;
}

function onPointerDown(e) {
  if (state.pointerDown && state.pointerId !== e.pointerId) return;
  audio.unlock();
  state.pointerDown = true;
  state.pointerId = e.pointerId;
  state.idleTime = 0;

  const ndc = getNDC(e);
  state.dragStartNDC.copy(ndc);
  state.lastNDC.copy(ndc);
  state.dragMode = null;

  if (state.phase === 'WRAP_SCOOP') {
    if (hitGroup(ndc, bowl.group) || hitGroup(ndc, bowl.spoonGroup) || screenDistToWorld(ndc, BOWL_POS) < 0.36) {
      state.dragMode = 'scoop_drag';
      triggerScoopFilling();
      return;
    }
    if (state.activeGyoza && (hitGroup(ndc, state.activeGyoza.group) || screenDistToWorld(ndc, BOARD_WORK_POS) < 0.28)) {
      particles.spawnFlourPuff(BOARD_WORK_POS, 4);
      audio.playPropBump('wood');
      triggerWobble(bowl.spoonGroup, 0.24);
      return;
    }
  }

  if (state.phase === 'WRAP_PLEAT' && state.activeGyoza) {
    if (hitGroup(ndc, state.activeGyoza.group) || screenDistToWorld(ndc, BOARD_WORK_POS) < 0.36) {
      state.dragMode = 'pleat_swipe';
      triggerQuickPleatTap();
      return;
    }
    if (hitGroup(ndc, bowl.group) && state.activeGyoza.state.fillingAmount < 1.25 && state.activeGyoza.state.fold < 0.35) {
      triggerScoopFilling();
      return;
    }
  }

  if (state.phase === 'WRAP_PLACE' && state.activeGyoza) {
    if (hitGroup(ndc, state.activeGyoza.group) || screenDistToWorld(ndc, BOARD_WORK_POS) < 0.34) {
      state.dragMode = 'drag_gyoza_to_pan';
      return;
    }
    if (hitGroup(ndc, skillet.group) || screenDistToWorld(ndc, PAN_POS) < 0.44) {
      sendActiveGyozaToPan();
      return;
    }
  }

  if (state.phase === 'POUR_WATER') {
    if (hitGroup(ndc, waterCup.group) || screenDistToWorld(ndc, waterCup.group.position) < 0.38 || hitGroup(ndc, skillet.group)) {
      state.dragMode = 'pour_water';
      state.pouring = true;
      audio.playWaterJuwaaBurst(1.0);
      particles.spawnEvaporationBurst(PAN_POS, 28, 1.0);
      return;
    }
  }

  if (state.phase === 'PLACE_LID') {
    if (hitGroup(ndc, lid.group) || screenDistToWorld(ndc, lid.group.position) < 0.44 || hitGroup(ndc, skillet.group)) {
      state.dragMode = 'place_lid';
      return;
    }
  }

  if (state.phase === 'STEAM_COOK') {
    const dialWorld = new THREE.Vector3();
    stove.dialGroup.getWorldPosition(dialWorld);
    if (hitGroup(ndc, stove.dialGroup) || screenDistToWorld(ndc, dialWorld) < 0.24) {
      state.dragMode = 'stove_dial';
      state.heatLevel = state.heatLevel > 0.85 ? 0.35 : Math.min(1.0, state.heatLevel + 0.3);
      audio.playKnobClick(state.heatLevel);
      return;
    }

    const knobWorld = new THREE.Vector3();
    lid.knob.getWorldPosition(knobWorld);
    if ((hitGroup(ndc, lid.knob) || screenDistToWorld(ndc, knobWorld) < 0.22) && state.crispProgress >= 0.72) {
      setPhase('LIFT_LID');
      audio.playLidClink(false);
      particles.spawnEvaporationBurst(PAN_POS, 22, 0.85);
      return;
    }

    const condHit = hitGroup(ndc, lid.innerCond) || hitGroup(ndc, lid.outerGlass);
    if (condHit && condHit.uv) {
      state.dragMode = 'wipe_glass';
      condensationSim.wipe(condHit.uv.x, condHit.uv.y, 50);
      audio.playGlassWipe();
      return;
    }
  }

  if (state.phase === 'LIFT_LID') {
    if (hitGroup(ndc, lid.group) || screenDistToWorld(ndc, lid.group.position) < 0.42) {
      state.dragMode = 'lift_lid';
      return;
    }
  }

  if (state.phase === 'PLACE_PLATE') {
    if (hitGroup(ndc, serving.plateGroup) || screenDistToWorld(ndc, serving.plateGroup.position) < 0.44 || hitGroup(ndc, skillet.group)) {
      state.dragMode = 'place_plate';
      return;
    }
  }

  if (state.phase === 'FLIP_PAN') {
    if (hitGroup(ndc, skillet.group) || hitGroup(ndc, serving.plateGroup) || screenDistToWorld(ndc, PAN_POS) < 0.56) {
      state.dragMode = 'flip_swipe';
      return;
    }
  }

  if (state.phase === 'ENJOY') {
    if (state.eatenCount >= 1 && hitGroup(ndc, env.stackGroup)) {
      audio.playPropBump('wood');
      resetEntireGame();
      return;
    }

    const activeWedges = skillet.haneWedges.filter((w) => w.visible && !w.userData.cracked);
    if (activeWedges.length > 0) {
      raycaster.setFromCamera(ndc, camera);
      const wHits = raycaster.intersectObjects(activeWedges, false);
      if (wHits.length > 0) {
        crackWedgeAt(wHits[0].object, wHits[0].point);
        return;
      }
    }

    for (const g of state.panGyozas) {
      if (g.state.bitten < 0.5 && hitGroup(ndc, g.group)) {
        const attached = skillet.haneWedges[state.panGyozas.indexOf(g)];
        if (attached && !attached.userData.cracked) {
          const wp = new THREE.Vector3();
          g.group.getWorldPosition(wp);
          crackWedgeAt(attached, wp);
        }
        triggerEatGyoza(g);
        return;
      }
    }

    if (hitGroup(ndc, serving.sauceGroup) || screenDistToWorld(ndc, serving.sauceGroup.position) < 0.25) {
      state.sauceRipple = 0.01;
      audio.playSauceDip();
      const nextGyoza = state.panGyozas.find((g) => g.state.bitten < 0.5);
      if (nextGyoza) triggerEatGyoza(nextGyoza);
      return;
    }
  }

  if (hitGroup(ndc, bowl.group)) {
    triggerWobble(bowl.group, 0.09);
    audio.playPropBump('wood');
  } else if (hitGroup(ndc, lid.group)) {
    triggerWobble(lid.group, 0.06);
    audio.playPropBump('glass');
  } else if (hitGroup(ndc, waterCup.group)) {
    triggerWobble(waterCup.group, 0.08);
    audio.playPropBump('glass');
  } else if (hitGroup(ndc, skillet.group)) {
    triggerWobble(skillet.group, 0.03);
    audio.playPropBump('metal');
  }
}

function onPointerMove(e) {
  if (!state.pointerDown || e.pointerId !== state.pointerId) return;
  state.idleTime = 0;
  const ndc = getNDC(e);

  if (state.dragMode === 'pleat_swipe' && state.phase === 'WRAP_PLEAT') {
    advancePleatAtNDC(ndc);
  } else if (state.dragMode === 'drag_gyoza_to_pan' && state.activeGyoza) {
    raycaster.setFromCamera(ndc, camera);
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(panPlane, pt)) {
      state.activeGyoza.group.position.lerp(
        new THREE.Vector3(pt.x, Math.max(0.32, pt.y + 0.15), pt.z),
        0.38
      );
      if (state.activeGyoza.group.position.distanceTo(PAN_POS) < 1.55) {
        state.dragMode = null;
        sendActiveGyozaToPan();
      }
    }
  } else if (state.dragMode === 'wipe_glass' && state.phase === 'STEAM_COOK') {
    const condHit = hitGroup(ndc, lid.innerCond) || hitGroup(ndc, lid.outerGlass);
    if (condHit && condHit.uv) {
      condensationSim.wipe(condHit.uv.x, condHit.uv.y, 50);
      if (state.time - state.lastWipeSound > 0.14) {
        audio.playGlassWipe();
        state.lastWipeSound = state.time;
      }
    }
  } else if (state.dragMode === 'stove_dial' && state.phase === 'STEAM_COOK') {
    const dx = ndc.x - state.lastNDC.x;
    state.heatLevel = THREE.MathUtils.clamp(state.heatLevel + dx * 2.2, 0.22, 1.0);
  } else if (state.dragMode === 'flip_swipe' && state.phase === 'FLIP_PAN') {
    const dy = ndc.y - state.dragStartNDC.y;
    const dx = Math.abs(ndc.x - state.dragStartNDC.x);
    if (dy > 0.12 || dx > 0.18) {
      state.dragMode = null;
      triggerStartFlip();
    }
  }

  state.lastNDC.copy(ndc);
}

function onPointerUp(e) {
  if (e.pointerId !== state.pointerId) return;

  if (state.dragMode === 'drag_gyoza_to_pan' && state.phase === 'WRAP_PLACE') {
    sendActiveGyozaToPan();
  } else if (state.dragMode === 'pour_water') {
    state.pouring = false;
  } else if (state.dragMode === 'place_lid' && state.phase === 'PLACE_LID') {
    state.lidOnPan = true;
    audio.playLidClink(true);
    setPhase('STEAM_COOK');
  } else if (state.dragMode === 'place_plate' && state.phase === 'PLACE_PLATE') {
    audio.playPlateClack();
    setPhase('FLIP_PAN');
  } else if (state.dragMode === 'flip_swipe' && state.phase === 'FLIP_PAN') {
    triggerStartFlip();
  }

  state.pointerDown = false;
  state.pointerId = null;
  state.dragMode = null;
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =========================================================================
// IDLE DEMO HAND (Single calm gesture ONLY after 9 seconds of inactivity)
// =========================================================================
function updateIdleDemo(dt) {
  if (state.pointerDown || state.flipping || state.spoonActive || state.eatAnim) {
    state.idleTime = 0;
    demoHand.group.visible = false;
    return;
  }
  state.idleTime += dt;
  if (state.idleTime < 9.0 || state.demoShownForPhase) {
    demoHand.group.visible = false;
    return;
  }

  demoHand.group.visible = true;
  state.demoAnim += dt * 0.55;
  const t = state.demoAnim;
  if (t >= 1.0) {
    state.demoShownForPhase = true;
    demoHand.group.visible = false;
    return;
  }

  const fade = Math.sin(t * Math.PI);
  demoHand.skinMat.opacity = fade * 0.85;

  if (state.phase === 'WRAP_SCOOP') {
    demoHand.group.position.lerpVectors(
      new THREE.Vector3(BOWL_POS.x + 0.1, 0.65, BOWL_POS.z + 0.1),
      new THREE.Vector3(BOARD_WORK_POS.x, 0.35, BOARD_WORK_POS.z),
      THREE.MathUtils.smoothstep(t, 0.1, 0.9)
    );
  } else if (state.phase === 'WRAP_PLEAT') {
    const a = -0.38 + t * 0.76;
    demoHand.group.position.set(BOARD_WORK_POS.x + a, 0.28, BOARD_WORK_POS.z + 0.22);
  } else if (state.phase === 'WRAP_PLACE') {
    demoHand.group.position.lerpVectors(
      new THREE.Vector3(BOARD_WORK_POS.x, 0.35, BOARD_WORK_POS.z),
      new THREE.Vector3(PAN_POS.x, 0.52, PAN_POS.z),
      THREE.MathUtils.smoothstep(t, 0.1, 0.9)
    );
  } else if (state.phase === 'POUR_WATER') {
    demoHand.group.position.lerpVectors(
      new THREE.Vector3(CUP_REST_POS.x, 0.72, CUP_REST_POS.z),
      new THREE.Vector3(PAN_POS.x - 0.6, 0.95, PAN_POS.z),
      THREE.MathUtils.smoothstep(t, 0.1, 0.9)
    );
  } else if (state.phase === 'PLACE_LID') {
    demoHand.group.position.lerpVectors(
      new THREE.Vector3(LID_REST_POS.x, 1.0, LID_REST_POS.z),
      new THREE.Vector3(PAN_POS.x, 1.15, PAN_POS.z),
      THREE.MathUtils.smoothstep(t, 0.1, 0.9)
    );
  } else if (state.phase === 'STEAM_COOK') {
    if (state.crispProgress >= 0.75) {
      demoHand.group.position.set(PAN_POS.x, 1.38 + t * 0.55, PAN_POS.z);
    } else {
      demoHand.group.position.set(PAN_POS.x - 0.55 + t * 1.1, 0.88, PAN_POS.z + 1.15);
    }
  } else if (state.phase === 'PLACE_PLATE') {
    demoHand.group.position.lerpVectors(
      new THREE.Vector3(serving.plateGroup.position.x, 0.45, serving.plateGroup.position.z),
      new THREE.Vector3(PAN_POS.x, 0.88, PAN_POS.z),
      THREE.MathUtils.smoothstep(t, 0.1, 0.9)
    );
  } else if (state.phase === 'FLIP_PAN') {
    demoHand.group.position.set(PAN_POS.x, 0.72 + Math.sin(t * Math.PI) * 0.78, PAN_POS.z + 0.55);
  } else {
    demoHand.group.visible = false;
  }
}

// =========================================================================
// MAIN SIMULATION STEP & RENDER LOOP
// =========================================================================
let lastTime = performance.now();
let steamSpawnAcc = 0;
let bubbleSpawnAcc = 0;
let ventSpawnAcc = 0;
let dropSpawnAcc = 0;

function stepSimulation(dt) {
  state.time += dt;

  // 1. Camera choreography
  updateCameraTargets();
  const camLerp = 1 - Math.exp(-dt * 3.8);
  camCurrPos.lerp(camTargetPos, camLerp);
  camCurrLook.lerp(camTargetLook, camLerp);
  camera.position.copy(camCurrPos);
  camera.lookAt(camCurrLook);

  // 2. Active wrapper landing settle
  if (state.activeGyoza && state.dragMode !== 'drag_gyoza_to_pan') {
    state.activeGyoza.group.position.lerp(BOARD_WORK_POS, 1 - Math.exp(-dt * 9));
    const sc = THREE.MathUtils.lerp(state.activeGyoza.group.scale.x, 1.0, 1 - Math.exp(-dt * 9));
    state.activeGyoza.group.scale.setScalar(sc);
  }

  // 3. Spoon Scoop & Plop Animation
  if (state.spoonActive && state.activeGyoza) {
    state.spoonAnim += dt * 2.25;
    const t = state.spoonAnim;
    if (t < 0.52) {
      const k = THREE.MathUtils.smoothstep(t / 0.52, 0, 1);
      const target = new THREE.Vector3(BOARD_WORK_POS.x - 0.08, BOARD_WORK_POS.y + 0.42, BOARD_WORK_POS.z);
      bowl.spoonGroup.position.lerpVectors(spoonHomePos, target, k);
      bowl.spoonGroup.position.y += Math.sin(k * Math.PI) * 0.35;
      bowl.spoonGroup.rotation.z = THREE.MathUtils.lerp(-0.42, 0.25, k);
    } else if (t < 0.72) {
      const k = (t - 0.52) / 0.2;
      bowl.spoonGroup.rotation.x = THREE.MathUtils.lerp(0.15, 1.45, k);
      if (bowl.spoonFilling.visible && k > 0.35) {
        bowl.spoonFilling.visible = false;
        state.activeGyoza.state.fillingAmount = Math.min(1.3, state.activeGyoza.state.fillingAmount + 1.0);
        state.activeGyoza.updateGeometry();
        particles.spawnFlourPuff(BOARD_WORK_POS, 5);
      }
    } else if (t < 1.0) {
      const k = THREE.MathUtils.smoothstep((t - 0.72) / 0.28, 0, 1);
      const overPos = new THREE.Vector3(BOARD_WORK_POS.x - 0.08, BOARD_WORK_POS.y + 0.42, BOARD_WORK_POS.z);
      bowl.spoonGroup.position.lerpVectors(overPos, spoonHomePos, k);
      bowl.spoonGroup.rotation.x = THREE.MathUtils.lerp(1.45, 0.15, k);
      bowl.spoonGroup.rotation.z = THREE.MathUtils.lerp(0.25, -0.42, k);
    } else {
      state.spoonActive = false;
      bowl.spoonGroup.position.copy(spoonHomePos);
      bowl.spoonGroup.rotation.set(0.15, -0.4, -0.42);
      if (state.phase === 'WRAP_SCOOP') setPhase('WRAP_PLEAT');
    }
  }

  // 4. Placing Wrapped Gyoza into Skillet
  if (state.placingGyozaObj) {
    state.placingGyozaAnim += dt * 2.15;
    const t = Math.min(1, state.placingGyozaAnim);
    const slot = getPanSlotLocal(state.placingTargetIdx);
    const worldDest = slot.pos.clone().add(PAN_POS);
    const k = THREE.MathUtils.smoothstep(t, 0, 1);

    state.placingGyozaObj.group.position.lerpVectors(state.placingStartPos, worldDest, k);
    state.placingGyozaObj.group.position.y += Math.sin(k * Math.PI) * 0.72;
    state.placingGyozaObj.group.rotation.y = THREE.MathUtils.lerp(0, slot.rotY, k);

    if (t >= 1) {
      const placed = state.placingGyozaObj;
      state.placingGyozaObj = null;
      skillet.group.add(placed.group);
      placed.group.position.copy(slot.pos);
      placed.group.rotation.set(0, slot.rotY, 0);
      state.panGyozas.push(placed);
      state.wrappedCount++;

      audio.playPanDrop();
      particles.spawnSteam(worldDest.clone().add(new THREE.Vector3(0, 0.12, 0)), {
        life: 0.7, vy: 0.45, startScale: 0.18, endScale: 0.55, opacity: 0.28,
      });

      if (state.wrappedCount < GYOZA_TOTAL) {
        spawnNextWrapper();
        setPhase('WRAP_SCOOP');
      } else {
        setPhase('POUR_WATER');
      }
    }
  }

  // 5. Gas Stove Flames
  const stoveActiveHeat =
    state.phase === 'ENJOY' || state.flipping
      ? 0
      : state.wrappedCount > 0
      ? state.phase === 'POUR_WATER' || state.phase === 'PLACE_LID' || state.phase === 'STEAM_COOK' || state.phase === 'LIFT_LID'
        ? state.heatLevel
        : 0.4
      : 0.22;
  stove.updateFlames(state.time, stoveActiveHeat);

  // 6. Pouring Katakuriko-Water into Hot Skillet
  if (state.phase === 'POUR_WATER') {
    const targetTilt = state.pouring ? 1 : 0;
    state.pourTilt = THREE.MathUtils.lerp(state.pourTilt, targetTilt, 1 - Math.exp(-dt * 8));

    const pourPos = new THREE.Vector3(PAN_POS.x - 1.44, PAN_POS.y + 1.05, PAN_POS.z + 0.08);
    waterCup.group.position.lerpVectors(CUP_REST_POS, pourPos, state.pourTilt);
    waterCup.group.rotation.z = -state.pourTilt * 1.12;
    waterCup.streamMesh.visible = state.pouring && state.waterInCup > 0.02;
    // Physically slosh liquid gently toward spout while staying 100% inside glass walls!
    waterCup.waterInside.position.x = state.pourTilt * 0.05;
    waterCup.waterInside.rotation.z = state.pourTilt * 0.14;

    if (state.pouring && state.waterInCup > 0) {
      const pourRate = dt * 0.68;
      state.waterInCup = Math.max(0, state.waterInCup - pourRate);
      state.waterInPan = Math.min(1.0, state.waterInPan + pourRate * 1.12);
      waterCup.waterInside.scale.y = Math.max(0.01, state.waterInCup);
      waterCup.waterInside.position.y = 0.08 + 0.31 * state.waterInCup;

      dropSpawnAcc += dt * 45;
      while (dropSpawnAcc >= 1) {
        dropSpawnAcc -= 1;
        particles.spawnEvaporationBurst(PAN_POS, 3, 0.9);
      }

      if (state.waterInPan >= 0.92 || state.waterInCup <= 0.05) {
        state.pouring = false;
        waterCup.streamMesh.visible = false;
        setPhase('PLACE_LID');
      }
    }
  } else {
    waterCup.streamMesh.visible = false;
    waterCup.waterInside.position.x = 0;
    waterCup.waterInside.rotation.z = 0;
    waterCup.group.rotation.z = THREE.MathUtils.lerp(waterCup.group.rotation.z, 0, 1 - Math.exp(-dt * 6));
    const awayPos =
      state.phase === 'PLACE_PLATE' || state.phase === 'FLIP_PAN' || state.phase === 'ENJOY'
        ? new THREE.Vector3(-3.2, -0.02, -1.75)
        : CUP_REST_POS;
    waterCup.group.position.lerp(awayPos, 1 - Math.exp(-dt * 5));
  }

  // 7. Domed Glass Lid Placement, Steam Rattle & Lifting
  const lidTarget = new THREE.Vector3();
  if (state.phase === 'STEAM_COOK') {
    state.lidProgress = THREE.MathUtils.lerp(state.lidProgress, 1, 1 - Math.exp(-dt * 7));
    lidTarget.set(PAN_POS.x, PAN_POS.y + 0.47, PAN_POS.z);
    lid.group.position.lerp(lidTarget, 1 - Math.exp(-dt * 9));

    const rattle = state.waterInPan > 0.08 && state.heatLevel > 0.62 ? state.heatLevel * 0.018 : 0;
    lid.group.rotation.z = Math.sin(state.time * 38) * rattle;
    lid.group.rotation.x = Math.cos(state.time * 31) * rattle * 0.7;

    if (state.crispProgress >= 0.96) {
      lid.group.position.y += Math.sin(state.time * 5.2) * 0.012;
    }
  } else if (state.phase === 'LIFT_LID') {
    state.lidProgress = THREE.MathUtils.lerp(state.lidProgress, 0, 1 - Math.exp(-dt * 5));
    const liftDest = new THREE.Vector3(PAN_POS.x + 2.65, 0.35, PAN_POS.z - 0.55);
    lid.group.position.lerp(liftDest, 1 - Math.exp(-dt * 3.8));
    lid.group.rotation.z = THREE.MathUtils.lerp(lid.group.rotation.z, -0.18, 1 - Math.exp(-dt * 4));
    if (lid.group.position.distanceTo(liftDest) < 0.38) {
      setPhase('PLACE_PLATE');
    }
  } else {
    state.lidProgress = THREE.MathUtils.lerp(state.lidProgress, 0, 1 - Math.exp(-dt * 5));
    const rest =
      state.phase === 'ENJOY' || state.phase === 'FLIP_PAN'
        ? new THREE.Vector3(4.1, 0.0, -1.7)
        : LID_REST_POS;
    lid.group.position.lerp(rest, 1 - Math.exp(-dt * 5));
    lid.group.rotation.z = THREE.MathUtils.lerp(lid.group.rotation.z, 0, 1 - Math.exp(-dt * 5));
    lid.group.rotation.x = THREE.MathUtils.lerp(lid.group.rotation.x, 0, 1 - Math.exp(-dt * 5));
  }

  // 8. REAL-TIME STEAMING, EVAPORATION, CONDENSATION & CRISPY HANE FORMATION
  let boilIntensity = 0;
  let steamIntensity = 0;
  let oilIntensity = 0;
  let ventIntensity = 0;

  if (state.waterInPan > 0.005 && (state.phase === 'POUR_WATER' || state.phase === 'PLACE_LID' || state.phase === 'STEAM_COOK')) {
    const heatFactor = 0.45 + state.heatLevel * 0.95;
    boilIntensity = Math.min(1, state.waterInPan * 1.45) * heatFactor;
    steamIntensity = boilIntensity * (state.phase === 'STEAM_COOK' ? 1.2 : 0.9);

    if (state.phase === 'STEAM_COOK') {
      const evapRate = dt * 0.095 * heatFactor;
      state.waterInPan = Math.max(0, state.waterInPan - evapRate);
      state.cookProgress = Math.min(1, state.cookProgress + dt * 0.115 * heatFactor);
      ventIntensity = Math.min(1, (state.waterInPan * 1.6 + 0.18) * state.heatLevel);

      for (const g of state.panGyozas) {
        g.state.steamCook = Math.min(1, state.cookProgress * 1.25);
        g.state.sear = THREE.MathUtils.smoothstep(state.cookProgress, 0.42, 0.98);
        g.updateGeometry();
      }
    }
  }

  if (state.phase === 'STEAM_COOK' && state.waterInPan < 0.38) {
    const dryRate = dt * 0.24 * (0.5 + state.heatLevel * 0.8);
    state.crispProgress = Math.min(1, state.crispProgress + dryRate);
    oilIntensity = (0.45 + state.crispProgress * 0.65) * state.heatLevel;
    for (const g of state.panGyozas) {
      g.state.sear = Math.max(g.state.sear, state.crispProgress);
      g.updateGeometry();
    }
    if (state.crispProgress >= 1.0 && state.waterInPan <= 0.01) {
      state.steamBurstTimer += dt;
      if (state.steamBurstTimer > 4.2 && !state.pointerDown) {
        setPhase('LIFT_LID');
        audio.playLidClink(false);
        particles.spawnEvaporationBurst(PAN_POS, 18, 0.8);
      }
    }
  } else if (state.phase === 'LIFT_LID' || state.phase === 'PLACE_PLATE') {
    oilIntensity = 0.48;
  } else if (state.wrappedCount > 0 && state.phase.startsWith('WRAP')) {
    oilIntensity = 0.12 + state.wrappedCount * 0.03;
  }

  skillet.updateLiquid(state.time, state.waterInPan, boilIntensity);
  skillet.updateHane(state.crispProgress);
  condensationSim.update(dt, steamIntensity * (state.lidProgress > 0.7 ? 1.15 : 0), state.phase === 'STEAM_COOK');

  if (boilIntensity > 0.05) {
    bubbleSpawnAcc += dt * (20 + boilIntensity * 38);
    while (bubbleSpawnAcc >= 1) {
      bubbleSpawnAcc -= 1;
      particles.spawnBoilingBubble(PAN_POS, PAN_POS.y + 0.068 + state.waterInPan * 0.14, 1.32);
    }

    steamSpawnAcc += dt * (10 + steamIntensity * 18);
    while (steamSpawnAcc >= 1) {
      steamSpawnAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.1;
      particles.spawnSteam(
        new THREE.Vector3(PAN_POS.x + Math.cos(a) * r, PAN_POS.y + 0.22, PAN_POS.z + Math.sin(a) * r),
        {
          life: state.lidProgress > 0.7 ? 1.45 : 1.2,
          vy: state.lidProgress > 0.7 ? 0.58 : 0.98,
          startScale: 0.3,
          endScale: state.lidProgress > 0.7 ? 1.05 : 1.45,
          opacity: state.lidProgress > 0.7 ? 0.32 : 0.42,
          trappedUnderLid: state.lidProgress > 0.7,
          panCenter: PAN_POS,
          lidHeight: 0.85,
          lidRadius: 1.48,
        }
      );
    }

    dropSpawnAcc += dt * (10 + boilIntensity * 26);
    while (dropSpawnAcc >= 1) {
      dropSpawnAcc -= 1;
      if (state.lidProgress < 0.7 || Math.random() < 0.55) {
        particles.spawnEvaporationBurst(PAN_POS, 1, 0.62 * boilIntensity);
      }
    }
  }

  // Dramatic focused white steam plume jetting out of the glass lid's metal vent!
  if (state.phase === 'STEAM_COOK' && ventIntensity > 0.08) {
    ventSpawnAcc += dt * (28 + ventIntensity * 34);
    const ventWorld = new THREE.Vector3();
    lid.ventGroup.getWorldPosition(ventWorld);
    while (ventSpawnAcc >= 1) {
      ventSpawnAcc -= 1;
      particles.spawnSteam(ventWorld, {
        life: 0.95 + Math.random() * 0.45,
        vx: 0.28 + (Math.random() - 0.5) * 0.14,
        vy: 1.65 + ventIntensity * 1.0,
        vz: 0.14 + (Math.random() - 0.5) * 0.14,
        startScale: 0.2,
        endScale: 0.95,
        opacity: 0.62 * ventIntensity,
      });
    }
  }

  // Appetizing piping-hot steam wisps rising off freshly flipped golden hanetsuki gyoza!
  if ((state.phase === 'LIFT_LID' || state.phase === 'PLACE_PLATE' || state.phase === 'ENJOY') && state.eatenCount < GYOZA_TOTAL) {
    steamSpawnAcc += dt * (state.phase === 'ENJOY' ? 7.5 : 9.0);
    const origin = state.phase === 'ENJOY' ? SERVE_PLATE_POS : PAN_POS;
    while (steamSpawnAcc >= 1) {
      steamSpawnAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.95;
      particles.spawnSteam(
        new THREE.Vector3(origin.x + Math.cos(a) * r, origin.y + 0.42, origin.z + Math.sin(a) * r),
        {
          life: 1.45 + Math.random() * 0.6,
          vx: (Math.random() - 0.5) * 0.12,
          vy: 0.54 + Math.random() * 0.3,
          vz: (Math.random() - 0.5) * 0.12,
          startScale: 0.24,
          endScale: 0.98,
          opacity: 0.32,
        }
      );
    }
  }

  audio.updateSizzle(dt, {
    oil: oilIntensity,
    steam: steamIntensity,
    boil: boilIntensity,
    vent: ventIntensity,
    lidClosed: state.lidProgress,
    crackle: (oilIntensity * 14 + boilIntensity * 16) * (state.phase === 'ENJOY' ? 0 : 1),
  });

  // 9. Plate Covering Skillet & BIG 180-DEGREE FLIP!
  if (state.phase === 'FLIP_PAN' && !state.flipping) {
    state.plateOnPan = THREE.MathUtils.lerp(state.plateOnPan, 1, 1 - Math.exp(-dt * 8));
    serving.plateGroup.position.lerp(
      new THREE.Vector3(PAN_POS.x, PAN_POS.y + 0.72, PAN_POS.z),
      1 - Math.exp(-dt * 8)
    );
    serving.plateGroup.rotation.z = THREE.MathUtils.lerp(serving.plateGroup.rotation.z, Math.PI, 1 - Math.exp(-dt * 8));
  }

  if (state.flipping) {
    if (state.flipProgress < 1.0) {
      state.flipProgress = Math.min(1, state.flipProgress + dt * 1.15);
      const k = THREE.MathUtils.smoothstep(state.flipProgress, 0, 1);
      const arcY = Math.sin(k * Math.PI) * 0.95;
      const angle = k * Math.PI;

      const pivotY = PAN_POS.y + 0.42 + arcY;
      skillet.group.position.set(PAN_POS.x, pivotY - Math.cos(angle) * 0.26, PAN_POS.z);
      skillet.group.rotation.z = angle;

      serving.plateGroup.position.set(PAN_POS.x, pivotY + Math.cos(angle) * 0.26, PAN_POS.z);
      serving.plateGroup.rotation.z = Math.PI + angle;

      if (state.flipProgress >= 1.0) {
        // Set plate cleanly onto warm hinoki board in foreground, zero burner overlap!
        serving.plateGroup.position.set(PAN_POS.x, PAN_POS.y + 0.18, PAN_POS.z);
        serving.plateGroup.rotation.set(0, 0, 0);

        for (const g of state.panGyozas) {
          const slotIdx = state.panGyozas.indexOf(g);
          const slot = getPanSlotLocal(slotIdx);
          serving.plateGroup.add(g.group);
          g.group.position.set(slot.pos.x, 0.43, -slot.pos.z);
          g.group.rotation.set(Math.PI, -slot.rotY, 0);
        }

        serving.plateGroup.add(skillet.haneGroup);
        skillet.haneGroup.position.set(0, 0.38, 0);
        skillet.haneGroup.rotation.set(Math.PI, 0, 0);

        audio.playPlateClack();
      }
    } else {
      // Lift cast-iron skillet back onto the stove & glide the served plate cleanly onto the warm wooden board!
      state.panLiftAfterFlip = Math.min(1, state.panLiftAfterFlip + dt * 1.25);
      const k = THREE.MathUtils.smoothstep(state.panLiftAfterFlip, 0, 1);
      skillet.group.position.set(
        PAN_POS.x + k * 0.35,
        PAN_POS.y + 0.68 + Math.sin(k * Math.PI) * 0.72 - k * 0.68,
        PAN_POS.z - k * 0.15
      );
      skillet.group.rotation.z = Math.PI * (1 - k);

      serving.plateGroup.position.lerpVectors(
        new THREE.Vector3(PAN_POS.x, PAN_POS.y + 0.18, PAN_POS.z),
        SERVE_PLATE_POS,
        k
      );

      if (state.panLiftAfterFlip >= 1.0) {
        state.flipping = false;
        skillet.group.position.copy(PAN_POS);
        skillet.group.rotation.set(0, 0, 0);
        skillet.group.visible = true;
        serving.plateGroup.position.copy(SERVE_PLATE_POS);
        setPhase('ENJOY');
      }
    }
  }

  // 10. Crispy Hane Wedge Crack-away + Dipping & Eating Animation
  for (const w of skillet.haneWedges) {
    if (w.userData.cracked && w.userData.crackAnim < 1) {
      w.userData.crackAnim = Math.min(1, w.userData.crackAnim + dt * 3.4);
      w.position.y -= dt * 0.55;
      w.rotation.x += dt * 1.8;
      w.material.opacity = Math.max(0, 1 - w.userData.crackAnim);
    }
  }

  if (state.sauceRipple > 0) {
    state.sauceRipple += dt * 2.1;
    if (state.sauceRipple >= 1) {
      state.sauceRipple = 0;
      serving.rippleRing.material.opacity = 0;
    } else {
      const s = 1 + state.sauceRipple * 4.2;
      serving.rippleRing.scale.setScalar(s);
      serving.rippleRing.material.opacity = (1 - state.sauceRipple) * 0.65;
    }
  }

  if (state.eatAnim) {
    const ea = state.eatAnim;
    ea.t += dt * 0.92;
    const g = ea.gyoza;
    const plateOrigin = serving.plateGroup.position;
    const localStart = ea.startPos;
    const sauceLocal = serving.sauceGroup.position.clone().sub(plateOrigin);
    sauceLocal.y = 0.42;
    const heroBiteLocal = new THREE.Vector3(0.45, 1.15, 1.15);

    if (ea.t < 0.36) {
      const k = THREE.MathUtils.smoothstep(ea.t / 0.36, 0, 1);
      g.group.position.lerpVectors(localStart, sauceLocal.clone().add(new THREE.Vector3(0, 0.32, 0)), k);
      g.group.position.y += Math.sin(k * Math.PI) * 0.45;
    } else if (ea.t < 0.54) {
      const k = Math.sin(((ea.t - 0.36) / 0.18) * Math.PI);
      g.group.position.set(sauceLocal.x, sauceLocal.y + 0.32 - k * 0.24, sauceLocal.z);
      if (!ea.dipped && k > 0.7) {
        ea.dipped = true;
        state.sauceRipple = 0.01;
        audio.playSauceDip();
      }
    } else if (ea.t < 0.88) {
      const k = THREE.MathUtils.smoothstep((ea.t - 0.54) / 0.34, 0, 1);
      g.group.position.lerpVectors(sauceLocal.clone().add(new THREE.Vector3(0, 0.32, 0)), heroBiteLocal, k);
      g.group.rotation.x = THREE.MathUtils.lerp(Math.PI, Math.PI * 0.78, k);
      if (!ea.bitten && k > 0.62) {
        ea.bitten = true;
        g.state.bitten = 1.0;
        g.updateGeometry();
        audio.playBiteCrunch();
        const wp = new THREE.Vector3();
        g.group.getWorldPosition(wp);
        particles.spawnHaneCrumbs(wp, PAN_POS.y + 0.15, 10);
        particles.spawnSteam(wp, { life: 1.0, vy: 0.45, startScale: 0.16, endScale: 0.55, opacity: 0.35 });
      }
    } else if (ea.t < 1.15) {
      const k = (ea.t - 0.88) / 0.27;
      g.group.scale.setScalar(Math.max(0.001, 1 - k));
    } else {
      g.group.visible = false;
      serving.chopsticks.visible = false;
      state.eatenCount++;
      state.eatAnim = null;

      if (state.eatenCount >= GYOZA_TOTAL) {
        setTimeout(() => {
          if (state.phase === 'ENJOY' && state.eatenCount >= GYOZA_TOTAL) {
            resetEntireGame();
          }
        }, 1200);
      }
    }

    const gWorld = new THREE.Vector3();
    g.group.getWorldPosition(gWorld);
    serving.chopsticks.position.copy(gWorld);
    serving.chopsticks.rotation.set(0.12, -0.35, 0.22);
  }

  for (const [obj, w] of state.wobbles.entries()) {
    w.t += dt * 11;
    if (w.t > Math.PI * 3) {
      obj.rotation.z = w.baseRotZ;
      state.wobbles.delete(obj);
    } else {
      obj.rotation.z = w.baseRotZ + Math.sin(w.t) * w.strength * Math.exp(-w.t * 0.45);
    }
  }

  particles.update(dt);
  updateIdleDemo(dt);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  stepSimulation(dt);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// =========================================================================
// INTERNAL INSPECTION HOOK (Invisible to user; allows deterministic visual testing)
// =========================================================================
window.__GYOZA_DEBUG__ = {
  getStats() {
    return {
      phase: state.phase,
      wrappedCount: state.wrappedCount,
      waterInPan: Number(state.waterInPan.toFixed(2)),
      cookProgress: Number(state.cookProgress.toFixed(2)),
      crispProgress: Number(state.crispProgress.toFixed(2)),
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      pixelRatio: renderer.getPixelRatio(),
    };
  },
  stepAndRender(frames = 8, dt = 0.033) {
    for (let i = 0; i < frames; i++) stepSimulation(dt);
    renderer.render(scene, camera);
  },
  jumpToPhase(targetPhase) {
    resetEntireGame();
    if (targetPhase === 'WRAP_SCOOP') {
      updateCameraTargets();
      camCurrPos.copy(camTargetPos);
      camCurrLook.copy(camTargetLook);
      this.stepAndRender(12, 0.033);
      return;
    }

    if (targetPhase === 'WRAP_PLEAT') {
      state.activeGyoza.state.fillingAmount = 1.0;
      state.activeGyoza.state.fold = 0.72;
      state.activeGyoza.state.pleats = [1, 1, 1, 1, 0, 0];
      state.activeGyoza.updateGeometry();
      setPhase('WRAP_PLEAT');
      updateCameraTargets();
      camCurrPos.copy(camTargetPos);
      camCurrLook.copy(camTargetLook);
      this.stepAndRender(10, 0.033);
      return;
    }

    if (state.activeGyoza) {
      scene.remove(state.activeGyoza.group);
      state.activeGyoza = null;
    }
    for (let i = 0; i < GYOZA_TOTAL; i++) {
      const g = createGyoza(sharedGyozaMats);
      g.state.fillingAmount = 1.0;
      g.state.fold = 1.0;
      g.state.pleats = [1, 1, 1, 1, 1, 1];
      g.updateGeometry();
      const slot = getPanSlotLocal(i);
      skillet.group.add(g.group);
      g.group.position.copy(slot.pos);
      g.group.rotation.set(0, slot.rotY, 0);
      state.panGyozas.push(g);
    }
    state.wrappedCount = GYOZA_TOTAL;

    if (targetPhase === 'POUR_WATER') {
      setPhase('POUR_WATER');
      state.pouring = true;
      state.pourTilt = 1;
      state.waterInPan = 0.48;
      state.waterInCup = 0.58;
      particles.spawnEvaporationBurst(PAN_POS, 38, 1.15);
      updateCameraTargets();
      camCurrPos.copy(camTargetPos);
      camCurrLook.copy(camTargetLook);
      this.stepAndRender(10, 0.033);
      return;
    }

    if (targetPhase === 'STEAM_COOK') {
      state.waterInPan = 0.62;
      state.cookProgress = 0.55;
      state.crispProgress = 0.25;
      state.lidOnPan = true;
      state.lidProgress = 1;
      lid.group.position.set(PAN_POS.x, PAN_POS.y + 0.47, PAN_POS.z);
      setPhase('STEAM_COOK');
      for (const g of state.panGyozas) {
        g.state.steamCook = 0.72;
        g.state.sear = 0.45;
        g.updateGeometry();
      }
      for (let i = 0; i < 45; i++) condensationSim.update(0.08, 1.0, true);
      updateCameraTargets();
      camCurrPos.copy(camTargetPos);
      camCurrLook.copy(camTargetLook);
      this.stepAndRender(24, 0.033);
      // Wipe a crisp fresh peek window right on the front glass dome!
      condensationSim.wipe(0.25, 0.42, 62);
      condensationSim.update(0.01, 0.5, true);
      renderer.render(scene, camera);
      return;
    }

    if (targetPhase === 'ENJOY') {
      state.waterInPan = 0;
      state.cookProgress = 1;
      state.crispProgress = 1;
      skillet.updateHane(1);
      skillet.group.position.copy(PAN_POS);
      skillet.group.rotation.set(0, 0, 0);
      skillet.group.visible = true;
      serving.plateGroup.visible = true;
      serving.plateGroup.position.copy(SERVE_PLATE_POS);
      serving.plateGroup.rotation.set(0, 0, 0);
      for (let i = 0; i < GYOZA_TOTAL; i++) {
        const g = state.panGyozas[i];
        g.state.steamCook = 1;
        g.state.sear = 1;
        g.updateGeometry();
        const slot = getPanSlotLocal(i);
        serving.plateGroup.add(g.group);
        g.group.position.set(slot.pos.x, 0.43, -slot.pos.z);
        g.group.rotation.set(Math.PI, -slot.rotY, 0);
      }
      serving.plateGroup.add(skillet.haneGroup);
      skillet.haneGroup.position.set(0, 0.38, 0);
      skillet.haneGroup.rotation.set(Math.PI, 0, 0);
      setPhase('ENJOY');
      updateCameraTargets();
      camCurrPos.copy(camTargetPos);
      camCurrLook.copy(camTargetLook);
      this.stepAndRender(24, 0.033);
    }
  },
};
