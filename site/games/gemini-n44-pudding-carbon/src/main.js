import * as THREE from 'three';
import { createStudioTextures, updateBatterSwirlTexture } from './textures.js';
import { createStudioMaterials } from './materials.js';
import {
  createMixingBowl,
  createFarmEggProp,
  createMilkCarafe,
  createBalloonWhisk,
  createFlutedPuddingCup,
  createSteamerCloche,
  createIceBathRing,
  createDessertPlateAndPool,
  createCopperSaucier,
  createSilverSpoon,
  createStrawberrySet,
  createHeroPudding,
  createSampleReferencePudding,
} from './props.js';
import { createSculptedHand, createStudioPatissier } from './chefAndHands.js';
import { LiquidStream, DropletSystem, SteamMistSystem } from './effects.js';
import { StudioAudio } from './audio.js';

// ============================================================================
// 1. RENDERER & DARK STUDIO 1-RIM-LIGHT CINEMATOGRAPHY SETUP
// ============================================================================
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
const MAX_PIXEL_RATIO = 1.5;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020203);
scene.fog = new THREE.FogExp2(0x020203, 0.14);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 25);

/**
 * Builds a Dark Cyclorama Studio HDR-like Environment Map (max 512px) with 1 Hero Strip Softbox!
 * Produces crisp, elongated wet specular reflections on yolk, pudding, caramel, glass & silver!
 */
function buildStudioEnvironment(rendererInstance) {
  const pmrem = new THREE.PMREMGenerator(rendererInstance);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x010102);

  // Feathered softbox gradient canvas (256x256) so reflections have silky optical studio falloff
  const sbCanvas = document.createElement('canvas');
  sbCanvas.width = sbCanvas.height = 256;
  const sbCtx = sbCanvas.getContext('2d');
  const grad = sbCtx.createRadialGradient(128, 128, 12, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(255, 250, 240, 1.0)');
  grad.addColorStop(0.55, 'rgba(255, 244, 226, 0.85)');
  grad.addColorStop(0.88, 'rgba(255, 232, 205, 0.25)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  sbCtx.fillStyle = grad;
  sbCtx.fillRect(0, 0, 256, 256);
  const sbTex = new THREE.CanvasTexture(sbCanvas);

  // 1. Primary Hero Back-Left Rim Strip Softbox (high HDR intensity!)
  const heroSoftbox = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 5.8),
    new THREE.MeshBasicMaterial({
      map: sbTex,
      color: new THREE.Color(15.0, 13.8, 12.0), // Linear HDR > 1.0 for realistic specular bloom!
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  heroSoftbox.position.set(-3.1, 4.4, -3.6);
  heroSoftbox.lookAt(0, 0.2, 0);
  envScene.add(heroSoftbox);

  // 2. Narrow Overhead Top-Back Kicker Strip (crowns pudding & caramel pool!)
  const topStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.3),
    new THREE.MeshBasicMaterial({
      map: sbTex,
      color: new THREE.Color(9.5, 8.9, 7.8),
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  topStrip.position.set(0.4, 5.4, -2.4);
  topStrip.lookAt(0, 0, 0);
  envScene.add(topStrip);

  // 3. Subtle Right-Edge Silver Reflector Card (classic 1-light tabletop food setup!)
  const edgeReflector = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 3.6),
    new THREE.MeshBasicMaterial({
      map: sbTex,
      color: new THREE.Color(2.6, 2.35, 2.05),
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  edgeReflector.position.set(3.8, 2.2, -1.5);
  edgeReflector.lookAt(0, 0.2, 0);
  envScene.add(edgeReflector);

  // 4. Soft Warm Front Fill Bounce Card (keeps shadows rich & readable, never muddy)
  const frontBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 3.2),
    new THREE.MeshBasicMaterial({
      map: sbTex,
      color: new THREE.Color(0.55, 0.48, 0.42),
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  frontBounce.position.set(0.5, 2.1, 4.8);
  frontBounce.lookAt(0, 0.3, 0);
  envScene.add(frontBounce);

  const envRT = pmrem.fromScene(envScene, 0.02, 0.1, 20);
  pmrem.dispose();
  sbTex.dispose();
  return envRT.texture;
}

scene.environment = buildStudioEnvironment(renderer);

// Single Hero Studio Rim / Back-Key Light (1024x1024 soft shadow map)
const rimLightPos = new THREE.Vector3(-1.95, 4.35, -2.55);
const rimLightUniform = { value: rimLightPos.clone() };

const heroRimLight = new THREE.SpotLight(0xfff2df, 48, 16, 0.66, 0.80, 1.55);
heroRimLight.position.copy(rimLightPos);
heroRimLight.target.position.set(0, 0.28, 0.05);
heroRimLight.castShadow = true;
heroRimLight.shadow.mapSize.set(1024, 1024);
heroRimLight.shadow.camera.near = 1.5;
heroRimLight.shadow.camera.far = 10.5;
heroRimLight.shadow.bias = -0.00035;
heroRimLight.shadow.normalBias = 0.014;
heroRimLight.shadow.radius = 3.2;
scene.add(heroRimLight, heroRimLight.target);

// Subtle warm front bounce card illumination (dramatic 1-light studio contrast!)
const bounceFill = new THREE.DirectionalLight(0xffead6, 0.36);
bounceFill.position.set(0.9, 1.8, 3.2);
scene.add(bounceFill);

const studioHemi = new THREE.HemisphereLight(0x221d1a, 0x040406, 0.24);
scene.add(studioHemi);

// ============================================================================
// 2. TEXTURES, MATERIALS, TABLETOP, PROPS, CHEF & HANDS
// ============================================================================
const textures = createStudioTextures();
const materials = createStudioMaterials(textures, rimLightUniform);
const audio = new StudioAudio();

// Honed Black Basalt Culinary Tabletop (wide cyclorama plane fading smoothly into studio black!)
const tableGeo = new THREE.PlaneGeometry(5.6, 5.6, 1, 1);
tableGeo.rotateX(-Math.PI / 2);
const tableMesh = new THREE.Mesh(tableGeo, materials.tabletop);
tableMesh.position.set(0, 0.0, 0.0);
tableMesh.receiveShadow = true;
scene.add(tableMesh);

// Chiaroscuro Studio Patissier across the table + Foreground Working Hands
const patissier = createStudioPatissier(materials);
scene.add(patissier.root);

const rightHand = createSculptedHand(materials, 1);
const leftHand = createSculptedHand(materials, -1);
scene.add(rightHand.root, leftHand.root);

// Studio Kitchenware & Food Props
const mixingBowl = createMixingBowl(materials);
scene.add(mixingBowl.group);

const heroEgg = createFarmEggProp(materials, 1.0);
scene.add(heroEgg.group);

// Extra optional farm eggs (#2 & #3) in a small dark egg holder (Discovery #1: Extra Rich Golden Custard!)
const extraEggsGroup = new THREE.Group();
extraEggsGroup.position.set(-0.76, 0.0, -0.18);
scene.add(extraEggsGroup);

const eggHolder = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.16, 0.055, 32),
  materials.chefApron
);
eggHolder.position.y = 0.028;
eggHolder.castShadow = true;
eggHolder.receiveShadow = true;
extraEggsGroup.add(eggHolder);

const extraEggs = [0, 1].map((idx) => {
  const e = createFarmEggProp(materials, 0.94);
  e.group.position.set(idx === 0 ? -0.075 : 0.08, 0.125, idx === 0 ? 0.03 : -0.03);
  e.group.rotation.set(0.18, idx * 1.4, idx === 0 ? 0.24 : -0.22);
  extraEggsGroup.add(e.group);
  return { prop: e, used: false, basePos: e.group.position.clone() };
});

const milkCarafe = createMilkCarafe(materials);
scene.add(milkCarafe.group);

const whisk = createBalloonWhisk(materials);
whisk.group.visible = false;
scene.add(whisk.group);

const puddingCup = createFlutedPuddingCup(materials);
scene.add(puddingCup.group);

const steamerCloche = createSteamerCloche(materials);
steamerCloche.group.visible = false;
scene.add(steamerCloche.group);

const iceBath = createIceBathRing(materials);
iceBath.group.visible = false;
scene.add(iceBath.group);

const plateAndPool = createDessertPlateAndPool(materials);
scene.add(plateAndPool.group);

// Flip Assembly Pivot (allows smooth 180-degree plate + cup flip animation!)
const flipPivot = new THREE.Group();
scene.add(flipPivot);

const heroPudding = createHeroPudding(materials);
plateAndPool.group.add(heroPudding.mesh);
heroPudding.mesh.position.y = plateAndPool.wellY;

const copperSaucier = createCopperSaucier(materials);
copperSaucier.group.visible = false;
scene.add(copperSaucier.group);

const silverSpoon = createSilverSpoon(materials);
silverSpoon.group.visible = false;
scene.add(silverSpoon.group);

const strawberrySet = createStrawberrySet(materials);
strawberrySet.container.visible = false;
scene.add(strawberrySet.container);

// Subtle Reference Tasting Pudding on Back-Left Pedestal (Desired outcome visible cleanly!)
const samplePudding = createSampleReferencePudding(textures, materials, rimLightUniform);
samplePudding.group.position.set(-0.92, 0.0, -0.62);
scene.add(samplePudding.group);

// Subtle Fresh Egg Reset Prop (appears at corner during reward playground so child can bake another round!)
const nextRoundEgg = createFarmEggProp(materials, 0.95);
nextRoundEgg.group.position.set(-0.82, 0.12, -0.35);
nextRoundEgg.group.rotation.z = 0.35;
nextRoundEgg.group.visible = false;
scene.add(nextRoundEgg.group);

// Fluid Stream, Slow-Mo Specular Droplets & Volumetric Steam/Mist
const liquidStream = new LiquidStream(materials.milk);
scene.add(liquidStream.mesh);

const droplets = new DropletSystem(materials.milk, 48);
scene.add(droplets.group);

const steamMist = new SteamMistSystem(textures.steamSprite, 64);
scene.add(steamMist.group);

// ============================================================================
// 3. SLOW-MOTION TIME DILATION & RESPONSIVE CAMERA DIRECTOR
// ============================================================================
let timeScale = 1.0;
let slowMoTimer = 0;
let slowMoTarget = 1.0;

function triggerSlowMotion(scale = 0.20, realDurationSec = 1.15) {
  slowMoTarget = scale;
  slowMoTimer = Math.max(slowMoTimer, realDurationSec);
}

const camState = {
  basePos: new THREE.Vector3(0, 1.48, 2.38),
  lookAt: new THREE.Vector3(0, 0.36, -0.08),
  curPos: new THREE.Vector3(0, 1.48, 2.38),
  curLook: new THREE.Vector3(0, 0.36, -0.08),
  zoomPunch: 0,
};

function updateCameraFraming(dt = 0.016, snap = false) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.aspect = aspect;

  // Keep horizontal & vertical framing generous on iPhone portrait (0.46), 4:3 (1.33), & iPad landscape!
  if (aspect < 0.85) {
    // Portrait phone: widen vertical FOV & pull slightly back/up so bowl/plate + hands + chef fit big & clear!
    const portraitFactor = THREE.MathUtils.clamp((0.85 - aspect) / 0.42, 0, 1);
    camera.fov = THREE.MathUtils.lerp(38, 49, portraitFactor);
  } else {
    camera.fov = THREE.MathUtils.lerp(36, 33, THREE.MathUtils.clamp((aspect - 1.0) / 0.8, 0, 1));
  }
  camera.updateProjectionMatrix();

  const distScale = aspect < 0.85 ? THREE.MathUtils.lerp(1.0, 1.24, (0.85 - aspect) / 0.42) : 1.0;
  const slowZoom = (1.0 - timeScale) * 0.22 + camState.zoomPunch;

  const desiredPos = camState.basePos.clone();
  desiredPos.z = desiredPos.z * distScale - slowZoom * 0.42;
  desiredPos.y = desiredPos.y * THREE.MathUtils.lerp(1.0, 1.08, distScale - 1.0) - slowZoom * 0.08;

  if (snap) {
    camState.curPos.copy(desiredPos);
    camState.curLook.copy(camState.lookAt);
  } else {
    const f = Math.min(1, dt * 5.5);
    camState.curPos.lerp(desiredPos, f);
    camState.curLook.lerp(camState.lookAt, f);
  }
  camState.zoomPunch *= Math.max(0, 1 - dt * 3.5);

  camera.position.copy(camState.curPos);
  camera.lookAt(camState.curLook);
}

// ============================================================================
// 4. SEAMLESS GAME STATE MACHINE & 6+ INTERACTIVE DISCOVERIES
// ============================================================================
const STAGES = {
  CRACK_MIX: 'CRACK_MIX',           // Crack 1-3 eggs, poke yolk, pour milk, whisk silky batter
  POUR_MOLD: 'POUR_MOLD',           // Pour custard into caramel-lined fluted cup
  STEAM_COOK: 'STEAM_COOK',         // Lower glass steamer dome -> billowing backlit steam sets custard
  ICE_CHILL: 'ICE_CHILL',           // Chill hot cup with glistening ice ring & rolling cold mist
  FLIP_PLATE: 'FLIP_PLATE',         // Place stoneware plate & flip 180 degrees onto center stage
  UNMOLD_PURUN: 'UNMOLD_PURUN',     // Wiggle cup & lift upward -> Slow-Mo Vacuum Pop & Hero PURUN!
  CARAMEL_PLAY: 'CARAMEL_PLAY',     // Pour warm caramel, poke/stretch pudding, drop berries, spoon spank & scoop!
};

const game = {
  stage: STAGES.CRACK_MIX,
  stageTime: 0,
  idleTime: 0,
  idleDemoShown: false,

  // Recipe memory (carries discoveries forward into final pudding!)
  eggCount: 0,
  crackingAnim: null,     // { eggObj, progress, isExtra, slotIdx }
  milkAmount: 0,          // 0 .. 1.08
  pouringMilk: false,
  mixProgress: 0,         // 0 .. 1.0
  swirlAngle: 0,
  whiskSpeed: 0,
  foamAmount: 0,

  // Mold & cooking state
  cupFill: 0,             // 0 .. 1.08 (controls final pudding heightScale!)
  pouringBatter: false,
  domePlaced: false,
  steamProgress: 0,       // 0 .. 1.0
  domeLifting: 0,
  icePlaced: false,
  chillProgress: 0,       // 0 .. 1.0

  // Flip & Unmold state
  flipping: false,
  flipProgress: 0,
  cupLiftHeight: 0,       // 0 .. 1.0 (at >= 0.42 vacuum pops!)
  unmolded: false,
  puddingDropY: 0,
  puddingDropVel: 0,

  // Caramel & Playground state
  caramelPoured: 0,
  firstCaramelSlowMoDone: false,
  pouringCaramel: false,
  saucierTarget: new THREE.Vector3(0.32, 0.62, 0.05),
  activeTool: null,       // 'pudding' | 'saucier' | 'spoon' | 'berry' | 'plate'
  activeBerryIdx: -1,
  spoonMode: 'idle',      // 'idle' | 'dragging' | 'loaded' | 'feeding'
  spoonPos: new THREE.Vector3(0.54, 0.05, 0.32),
  spoonRot: new THREE.Euler(0, 0.35, 0.08),
  bitesEaten: 0,
  roundsCompleted: 0,
};

function getCustardRichColor(eggCount, mix = 1.0) {
  const rich = THREE.MathUtils.clamp((Math.max(1, eggCount) - 1) / 2, 0, 1);
  const pale = new THREE.Color(0xfbe399);
  const royal = new THREE.Color(0xf7be52);
  const target = pale.lerp(royal, rich);
  return new THREE.Color(0xfffcf5).lerp(target, mix);
}

function applyRecipeToHeroPudding() {
  const rich = THREE.MathUtils.clamp((Math.max(1, game.eggCount) - 1) / 2, 0, 1);
  const u = materials.heroPudding.userData.puddingUniforms;
  u.uCustardTint.value.setRGB(
    THREE.MathUtils.lerp(0.99, 0.98, rich),
    THREE.MathUtils.lerp(0.86, 0.74, rich),
    THREE.MathUtils.lerp(0.49, 0.31, rich)
  );
  u.uCustardScatter.value.setRGB(1.0, THREE.MathUtils.lerp(0.58, 0.42, rich), 0.10);
  u.uExtraTopCaramel.value = 0.0;
  for (let i = 0; i < 16; i++) {
    u.uDrips.value[i] = 0.15 + Math.sin(i * 1.7) * 0.025;
  }

  const heightScale = THREE.MathUtils.lerp(0.86, 1.18, THREE.MathUtils.clamp((game.cupFill - 0.65) / 0.38, 0, 1));
  heroPudding.softBody.configureByRecipe(Math.max(1, game.eggCount), heightScale);
  heroPudding.softBody.resetClean();

  // Match spoon bite custard tint!
  silverSpoon.biteCust.material = materials.heroPudding;
}

function setupInitialRound() {
  game.stage = STAGES.CRACK_MIX;
  game.stageTime = 0;
  game.idleTime = 0;
  game.idleDemoShown = false;
  game.eggCount = 0;
  game.crackingAnim = null;
  game.milkAmount = 0;
  game.pouringMilk = false;
  game.mixProgress = 0;
  game.swirlAngle = 0;
  game.whiskSpeed = 0;
  game.foamAmount = 0;
  game.cupFill = 0;
  game.pouringBatter = false;
  game.domePlaced = false;
  game.steamProgress = 0;
  game.domeLifting = 0;
  game.icePlaced = false;
  game.chillProgress = 0;
  game.flipping = false;
  game.flipProgress = 0;
  game.cupLiftHeight = 0;
  game.unmolded = false;
  game.caramelPoured = 0;
  game.firstCaramelSlowMoDone = false;
  game.pouringCaramel = false;
  game.activeTool = null;
  game.spoonMode = 'idle';
  game.bitesEaten = 0;

  audio.updatePourSound(false);
  audio.updateSteamSound(false);

  // Place Mixing Bowl center-stage; Pudding Cup & Dessert Plate visible in background-side context!
  scene.add(puddingCup.group);
  scene.add(plateAndPool.group);
  flipPivot.rotation.set(0, 0, 0);
  flipPivot.position.set(0, 0, 0);

  mixingBowl.group.visible = true;
  mixingBowl.group.position.set(0, 0, 0.12);
  mixingBowl.group.rotation.set(0, 0, 0);
  mixingBowl.albumenMesh.visible = false;
  mixingBowl.batterMesh.visible = false;
  mixingBowl.yolks.forEach((y) => {
    y.mesh.visible = false;
    y.popped = false;
    y.popProgress = 0;
    y.pokeCount = 0;
  });
  updateBatterSwirlTexture(textures, 0, 0, 1, 0);

  // Hero egg poised right above/beside bowl rim!
  heroEgg.group.visible = true;
  heroEgg.wholeMesh.visible = true;
  heroEgg.crackGroup.visible = false;
  heroEgg.group.position.set(0.24, 0.46, 0.16);
  heroEgg.group.rotation.set(0.12, 0.2, 0.42);

  // Extra eggs available on left
  extraEggsGroup.visible = true;
  extraEggs.forEach((ee, idx) => {
    ee.used = false;
    ee.prop.group.visible = true;
    ee.prop.wholeMesh.visible = true;
    ee.prop.crackGroup.visible = false;
    ee.prop.group.position.copy(ee.basePos);
  });

  // Milk carafe poised on right
  milkCarafe.group.visible = true;
  milkCarafe.group.position.set(0.76, 0, 0.05);
  milkCarafe.group.rotation.set(0, 0, 0);
  milkCarafe.setMilkLevel(0.92);

  whisk.group.visible = false;

  // Fluted pudding cup & stoneware plate tucked cleanly in studio context (no clutter overlap!)
  samplePudding.group.visible = false;
  puddingCup.group.visible = true;
  puddingCup.group.position.set(-0.62, 0, -0.46);
  puddingCup.group.rotation.set(0, 0, 0);
  puddingCup.setCustardFill(0, 0);
  puddingCup.beadsGroup.visible = false;
  puddingCup.caramelLayer.visible = true;

  plateAndPool.group.visible = false;
  plateAndPool.group.position.set(0.86, 0, -0.56);
  plateAndPool.group.rotation.set(0, 0, 0);
  plateAndPool.poolMesh.visible = false;

  // Keep reference tasting pudding cleanly visible in open space at back-right-center (zero carafe overlap!)
  samplePudding.group.visible = true;
  samplePudding.group.position.set(0.42, 0.0, -0.56);

  heroPudding.mesh.visible = false;
  steamerCloche.group.visible = false;
  iceBath.group.visible = false;
  copperSaucier.group.visible = false;
  silverSpoon.group.visible = false;
  silverSpoon.biteGroup.visible = false;
  strawberrySet.container.visible = false;
  strawberrySet.berries.forEach((b) => {
    b.placedOnPudding = false;
    b.falling = false;
    strawberrySet.container.add(b.mesh);
    b.mesh.position.copy(b.restLocal);
  });
  nextRoundEgg.group.visible = false;

  patissier.setMood('attentive');
  camState.basePos.set(0, 1.38, 2.38);
  camState.lookAt.set(0, 0.37, -0.08);

  leftHand.setTarget(new THREE.Vector3(-0.48, 0.28, 0.24), new THREE.Euler(0.25, -0.35, -0.25), 'cradleCup');
  rightHand.setTarget(new THREE.Vector3(0.32, 0.48, 0.24), new THREE.Euler(0.18, 0.35, 0.15), 'pinchEgg');
}

setupInitialRound();
leftHand.snapToTarget();
rightHand.snapToTarget();
updateCameraFraming(0.016, true);

// ============================================================================
// 5. ONE-FINGER FORGIVING POINTER INPUT & RAYCAST SYSTEM
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22);
const dragWorldPos = new THREE.Vector3();
const prevDragWorldPos = new THREE.Vector3();
const pointerDownWorld = new THREE.Vector3();

const pointer = {
  active: false,
  id: null,
  downTime: 0,
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
  prevAngle: 0,
  movedDist: 0,
};

function updateRayFromEvent(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  prevDragWorldPos.copy(dragWorldPos);
  raycaster.ray.intersectPlane(tablePlane, dragWorldPos);
}

function worldDist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function startEggCrack(eggProp, isExtra = false, extraIdx = -1) {
  if (game.crackingAnim || game.eggCount >= 3) return;
  audio.playEggCrack();
  game.crackingAnim = {
    eggProp,
    isExtra,
    extraIdx,
    progress: 0,
    plopped: false,
  };
  patissier.setMood('attentive');
}

function onPointerDown(e) {
  if (pointer.active && pointer.id !== e.pointerId) return;
  audio.unlock();

  pointer.active = true;
  pointer.id = e.pointerId;
  pointer.downTime = performance.now();
  pointer.startX = pointer.curX = e.clientX;
  pointer.startY = pointer.curY = e.clientY;
  pointer.movedDist = 0;

  game.idleTime = 0;
  game.idleDemoShown = false;

  updateRayFromEvent(e.clientX, e.clientY);
  pointerDownWorld.copy(dragWorldPos);
  prevDragWorldPos.copy(dragWorldPos);

  // Subtle curiosity reaction if child taps the background reference pudding!
  if (samplePudding.group.visible) {
    const hitsSample = raycaster.intersectObject(samplePudding.miniMesh, false);
    if (hitsSample.length > 0) {
      samplePudding.miniSoft.impulse({ squashVel: -2.2, shearVelX: 0.9, shearVelZ: -0.6 });
      audio.playPurun(0.45, 1.45);
      if (game.stage !== STAGES.CARAMEL_PLAY) return;
    }
  }

  // --- STAGE-SPECIFIC IMMEDIATE PHYSICAL RESPONSE (< 100ms!) ---
  if (game.stage === STAGES.CRACK_MIX) {
    // 1. Check Extra Eggs (#2, #3) if >= 1 egg already cracked (or even first!)
    for (let i = 0; i < extraEggs.length; i++) {
      const ee = extraEggs[i];
      if (!ee.used && ee.prop.group.visible) {
        const wPos = new THREE.Vector3();
        ee.prop.group.getWorldPosition(wPos);
        if (dragWorldPos.distanceTo(wPos) < 0.28 || raycaster.intersectObject(ee.prop.wholeMesh).length > 0) {
          ee.used = true;
          startEggCrack(ee.prop, true, i);
          return;
        }
      }
    }

    // 2. Check Hero Egg #1
    if (heroEgg.group.visible && !game.crackingAnim) {
      const ePos = heroEgg.group.position;
      if (dragWorldPos.distanceTo(ePos) < 0.42 || game.eggCount === 0) {
        startEggCrack(heroEgg, false, -1);
        return;
      }
    }

    // 3. Check Raw Yolks inside Mixing Bowl (Discovery #2: Poke wobble & 3-poke pop!)
    if (game.eggCount > 0 && game.mixProgress < 0.25) {
      for (let i = 0; i < game.eggCount; i++) {
        const ysb = mixingBowl.yolks[i];
        if (ysb.mesh.visible && raycaster.intersectObject(ysb.mesh).length > 0) {
          const popped = ysb.poke((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15);
          audio.playPurun(popped ? 0.85 : 0.55, popped ? 0.85 : 1.25);
          if (popped) {
            droplets.burst(ysb.mesh.getWorldPosition(new THREE.Vector3()), materials.yolk, {
              count: 10,
              speed: 0.9,
              floorY: 0.08,
            });
          }
          return;
        }
      }
    }

    // 4. Check Milk Carafe (pour creamy milk!)
    if (game.eggCount > 0 && game.milkAmount < 1.02) {
      if (dragWorldPos.x > 0.25 || game.milkAmount < 0.72) {
        game.pouringMilk = true;
        return;
      }
    }

    // 5. Whisking ready!
    if (game.eggCount > 0 && game.milkAmount >= 0.65) {
      pointer.prevAngle = Math.atan2(
        dragWorldPos.z - mixingBowl.group.position.z,
        dragWorldPos.x - mixingBowl.group.position.x
      );
      game.whiskSpeed = Math.max(game.whiskSpeed, 0.55);
      audio.playWhiskStroke(0.6);
    }
  } else if (game.stage === STAGES.POUR_MOLD) {
    game.pouringBatter = true;
  } else if (game.stage === STAGES.STEAM_COOK) {
    if (!game.domePlaced) {
      game.domePlaced = true;
      audio.playGlassCloche();
      patissier.setMood('attentive');
    }
  } else if (game.stage === STAGES.ICE_CHILL) {
    if (!game.icePlaced) {
      game.icePlaced = true;
      audio.playIceChime();
    } else {
      // Extra tap clinks ice & bursts extra cold mist!
      audio.playIceChime();
      for (let k = 0; k < 6; k++) steamMist.emitColdMist(puddingCup.group.position, { opacity: 0.3 });
    }
  } else if (game.stage === STAGES.FLIP_PLATE) {
    if (!game.flipping) {
      game.flipping = true;
      audio.playPlateClack();
    }
  } else if (game.stage === STAGES.UNMOLD_PURUN) {
    // Tapping gives an upward nudge; dragging upward lifts smoothly!
    game.cupLiftHeight = Math.min(1.0, game.cupLiftHeight + 0.26);
    heroPudding.softBody.impulse({ shearVelX: (Math.random() - 0.5) * 1.8 });
    audio.playPurun(0.4, 1.1);
  } else if (game.stage === STAGES.CARAMEL_PLAY) {
    handlePlaygroundPointerDown();
  }
}

function handlePlaygroundPointerDown() {
  // Check Next-Round Fresh Egg at back-left corner
  if (nextRoundEgg.group.visible && raycaster.intersectObject(nextRoundEgg.wholeMesh).length > 0) {
    audio.playEggTap();
    game.roundsCompleted++;
    setupInitialRound();
    return;
  }

  // If spoon is already loaded with a quivering bite, tapping feeds it or moves toward chef!
  if (game.spoonMode === 'loaded') {
    const mouthPos = patissier.getMouthWorldPosition(new THREE.Vector3());
    if (pointerNDC.y > 0.1 || dragWorldPos.z < -0.25) {
      feedLoadedSpoonBite();
      return;
    }
    game.activeTool = 'spoon';
    return;
  }

  // 1. Check Strawberries in front-left pinch bowl
  if (strawberrySet.container.visible) {
    for (let i = 0; i < strawberrySet.berries.length; i++) {
      const b = strawberrySet.berries[i];
      if (!b.placedOnPudding && !b.falling) {
        if (raycaster.intersectObject(b.mesh, true).length > 0) {
          game.activeTool = 'berry';
          game.activeBerryIdx = i;
          scene.attach(b.mesh);
          audio.playPurun(0.35, 1.5);
          return;
        }
      }
    }
  }

  // 2. Check Silver Dessert Spoon
  if (silverSpoon.group.visible) {
    const spPos = silverSpoon.group.position;
    if (
      raycaster.intersectObject(silverSpoon.group, true).length > 0 ||
      worldDist2D(dragWorldPos, spPos) < 0.24
    ) {
      game.activeTool = 'spoon';
      game.spoonMode = 'dragging';
      patissier.setMood('attentive');
      return;
    }
  }

  // 3. Check Copper Caramel Saucier (or initial caramel pour before playground tools appear!)
  if (copperSaucier.group.visible) {
    const scPos = copperSaucier.group.position;
    if (
      game.caramelPoured < 0.32 ||
      raycaster.intersectObject(copperSaucier.group, true).length > 0 ||
      (dragWorldPos.x > 0.26 && dragWorldPos.z < 0.08)
    ) {
      game.activeTool = 'saucier';
      game.pouringCaramel = true;
      return;
    }
  }

  // 4. Check Direct Touch on Hero Soft-Body Pudding!
  const pudHits = raycaster.intersectObject(heroPudding.mesh, false);
  if (pudHits.length > 0) {
    game.activeTool = 'pudding';
    const hitPt = pudHits[0].point;
    heroPudding.softBody.setFingerTouch(true, hitPt, new THREE.Vector3());
    const loc = heroPudding.mesh.worldToLocal(hitPt.clone());
    heroPudding.softBody.addRipple(loc, 0.028);
    heroPudding.softBody.impulse({
      squashVel: -1.65,
      shearVelX: (Math.random() - 0.5) * 1.4,
      shearVelZ: (Math.random() - 0.5) * 1.4,
    });
    audio.playPurun(0.75, 1.0);
    return;
  }

  // 5. Check Stoneware Plate edge (slosh caramel pool & inertia-jiggle pudding!)
  if (raycaster.intersectObject(plateAndPool.plateMesh, false).length > 0) {
    game.activeTool = 'plate';
    heroPudding.softBody.impulse({
      shearVelX: (Math.random() - 0.5) * 2.8,
      shearVelZ: (Math.random() - 0.5) * 2.8,
    });
    plateAndPool.updatePool(0.016, 0.36 + game.caramelPoured * 0.16, 0.7);
    audio.playPurun(0.55, 0.95);
  }
}

function feedLoadedSpoonBite() {
  game.spoonMode = 'feeding';
  game.bitesEaten++;
  audio.playHappyTaste();
  patissier.setMood('chewHappy');
  nextRoundEgg.group.visible = true;
}

function onPointerMove(e) {
  if (!pointer.active || pointer.id !== e.pointerId) return;
  const dxPx = e.clientX - pointer.curX;
  const dyPx = e.clientY - pointer.curY;
  pointer.movedDist += Math.hypot(dxPx, dyPx);
  pointer.curX = e.clientX;
  pointer.curY = e.clientY;
  game.idleTime = 0;

  updateRayFromEvent(e.clientX, e.clientY);

  if (game.stage === STAGES.CRACK_MIX) {
    if (game.eggCount > 0 && game.milkAmount >= 0.65 && !game.pouringMilk) {
      const ang = Math.atan2(
        dragWorldPos.z - mixingBowl.group.position.z,
        dragWorldPos.x - mixingBowl.group.position.x
      );
      let dAng = ang - pointer.prevAngle;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      pointer.prevAngle = ang;

      const linMove = dragWorldPos.distanceTo(prevDragWorldPos);
      const stirImpulse = Math.min(0.16, Math.abs(dAng) * 0.08 + linMove * 0.22);
      if (stirImpulse > 0.002) {
        game.swirlAngle += dAng !== 0 ? dAng : linMove * 4.5;
        game.whiskSpeed = Math.min(1.6, game.whiskSpeed + stirImpulse * 6.5);
        game.mixProgress = Math.min(1.0, game.mixProgress + stirImpulse * 0.68);
        if (game.whiskSpeed > 1.05) {
          game.foamAmount = Math.min(1.0, game.foamAmount + stirImpulse * 0.45);
        }
        audio.playWhiskStroke(Math.min(1, game.whiskSpeed));
        updateBatterSwirlTexture(textures, game.mixProgress, game.swirlAngle, game.eggCount, game.foamAmount);
      }
    }
  } else if (game.stage === STAGES.UNMOLD_PURUN && !game.unmolded) {
    // Dragging upward lifts the cup; dragging sideways jiggles the pudding inside the glass!
    const liftDelta = -dyPx / Math.max(240, window.innerHeight * 0.32);
    if (liftDelta > 0) {
      game.cupLiftHeight = Math.min(1.0, game.cupLiftHeight + liftDelta);
    }
    if (Math.abs(dxPx) > 2) {
      puddingCup.group.position.x = THREE.MathUtils.clamp(dxPx * 0.0025, -0.04, 0.04);
      audio.playPurun(0.28, 1.18);
    }
  } else if (game.stage === STAGES.CARAMEL_PLAY) {
    if (game.activeTool === 'pudding') {
      const pudHits = raycaster.intersectObject(heroPudding.mesh, false);
      const deltaWorld = dragWorldPos.clone().sub(pointerDownWorld);
      if (pudHits.length > 0) {
        heroPudding.softBody.setFingerTouch(true, pudHits[0].point, deltaWorld);
      } else {
        heroPudding.softBody.setFingerTouch(true, null, deltaWorld);
      }
    } else if (game.activeTool === 'saucier') {
      game.saucierTarget.set(
        THREE.MathUtils.clamp(dragWorldPos.x + 0.22, -0.05, 0.55),
        0.58,
        THREE.MathUtils.clamp(dragWorldPos.z, -0.25, 0.28)
      );
    } else if (game.activeTool === 'berry' && game.activeBerryIdx >= 0) {
      const b = strawberrySet.berries[game.activeBerryIdx];
      b.mesh.position.set(
        THREE.MathUtils.clamp(dragWorldPos.x, -0.65, 0.65),
        0.48,
        THREE.MathUtils.clamp(dragWorldPos.z, -0.45, 0.45)
      );
    } else if (game.activeTool === 'spoon') {
      if (game.spoonMode === 'dragging') {
        game.spoonPos.set(
          THREE.MathUtils.clamp(dragWorldPos.x + 0.08, -0.35, 0.68),
          0.26,
          THREE.MathUtils.clamp(dragWorldPos.z, -0.35, 0.48)
        );
        // Check if spoon bowl slices through hero pudding!
        const tipWorld = game.spoonPos.clone().add(new THREE.Vector3(-0.08, -0.02, 0));
        const pCenter = new THREE.Vector3();
        heroPudding.mesh.getWorldPosition(pCenter);
        if (worldDist2D(tipWorld, pCenter) < 0.28 && pointer.movedDist > 26) {
          // Carve a real 3D bite out of the soft-body pudding in Slow-Mo!!
          heroPudding.softBody.addScoopBite(tipWorld, 0.11);
          silverSpoon.biteGroup.visible = true;
          silverSpoon.triggerBiteJiggle(3.2);
          game.spoonMode = 'loaded';
          audio.playSpoonScoop();
          triggerSlowMotion(0.26, 0.85);
          patissier.setMood('openForBite');
          droplets.burst(tipWorld, materials.caramel, { count: 8, speed: 0.7, floorY: 0.04 });
        }
      } else if (game.spoonMode === 'loaded') {
        // Lift spoon upward toward patissier's smiling mouth!
        const lift = THREE.MathUtils.clamp((window.innerHeight * 0.65 - e.clientY) / (window.innerHeight * 0.45), 0, 1);
        const mouthPos = patissier.getMouthWorldPosition(new THREE.Vector3());
        game.spoonPos.set(
          THREE.MathUtils.lerp(dragWorldPos.x, mouthPos.x + 0.08, lift * 0.85),
          THREE.MathUtils.lerp(0.28, mouthPos.y - 0.02, lift),
          THREE.MathUtils.lerp(dragWorldPos.z, mouthPos.z + 0.22, lift * 0.85)
        );
        patissier.setMood('openForBite');
        if (lift > 0.78) {
          feedLoadedSpoonBite();
        }
      }
    } else if (game.activeTool === 'plate') {
      const vx = (dragWorldPos.x - prevDragWorldPos.x) * 28;
      const vz = (dragWorldPos.z - prevDragWorldPos.z) * 28;
      plateAndPool.group.position.x = THREE.MathUtils.clamp(dragWorldPos.x * 0.22, -0.14, 0.14);
      heroPudding.softBody.impulse({
        shearVelX: -vx * 0.45,
        shearVelZ: -vz * 0.45,
      });
      plateAndPool.updatePool(0.016, 0.36 + game.caramelPoured * 0.16, Math.hypot(vx, vz) * 0.08);
    }
  }
}

function onPointerUp(e) {
  if (!pointer.active || pointer.id !== e.pointerId) return;
  pointer.active = false;
  pointer.id = null;

  game.pouringMilk = false;
  if (game.stage === STAGES.POUR_MOLD && game.cupFill >= 0.72) {
    game.pouringBatter = false;
  } else if (game.stage === STAGES.POUR_MOLD && pointer.movedDist < 12 && game.cupFill < 0.72) {
    // Short tap pours a generous pour burst so taps AND holds both feel great!
    game.pouringBatter = false;
    game.cupFill = Math.min(0.95, game.cupFill + 0.48);
    puddingCup.setCustardFill(game.cupFill, 0, getCustardRichColor(game.eggCount, 1));
    audio.playYolkPlop(false);
  }

  if (game.stage === STAGES.CRACK_MIX && game.eggCount > 0 && game.milkAmount > 0 && game.milkAmount < 0.70 && pointer.movedDist < 14) {
    // Tap on milk carafe pours a generous splash too!
    game.milkAmount = Math.min(0.88, game.milkAmount + 0.46);
    milkCarafe.setMilkLevel(Math.max(0.05, 0.92 - game.milkAmount * 0.78));
    updateBatterSwirlTexture(textures, game.mixProgress, game.swirlAngle, game.eggCount, game.foamAmount);
  }

  if (game.stage === STAGES.CARAMEL_PLAY) {
    if (game.activeTool === 'pudding') {
      heroPudding.softBody.setFingerTouch(false);
      audio.playPurun(0.82, 1.02);
    } else if (game.activeTool === 'saucier') {
      if (pointer.movedDist < 12 && game.caramelPoured < 0.38) {
        // Gentle tap also pours a luscious swirl of caramel!
        pourCaramelStep(0.24, 0);
      }
      game.pouringCaramel = false;
    } else if (game.activeTool === 'berry' && game.activeBerryIdx >= 0) {
      const b = strawberrySet.berries[game.activeBerryIdx];
      // Drop strawberry onto the hero pudding crown! (Forgiving magnetic aim toward crown!)
      const pPos = new THREE.Vector3();
      heroPudding.mesh.getWorldPosition(pPos);
      b.mesh.position.set(
        THREE.MathUtils.clamp(b.mesh.position.x, pPos.x - 0.12, pPos.x + 0.12),
        Math.max(0.54, b.mesh.position.y),
        THREE.MathUtils.clamp(b.mesh.position.z, pPos.z - 0.12, pPos.z + 0.12)
      );
      b.falling = true;
      b.vel.set(0, -0.4, 0);
      game.activeBerryIdx = -1;
    } else if (game.activeTool === 'spoon') {
      if (game.spoonMode === 'dragging' && pointer.movedDist < 24) {
        // Short tap with spoon = classic viral "Pata-Purun!" spoon spank on the pudding!!
        performSpoonSpank();
        game.spoonMode = 'idle';
      } else if (game.spoonMode === 'dragging') {
        game.spoonMode = 'idle';
      }
    }
    game.activeTool = null;
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// ============================================================================
// 6. STAGE PHYSICS, HAND CHOREOGRAPHY & CONTINUOUS SIMULATION LOOP
// ============================================================================
let spankAnimTimer = 0;

function performSpoonSpank() {
  spankAnimTimer = 0.36;
  audio.playSpoonSpank();
  heroPudding.softBody.impulse({
    squashVel: -2.45,
    shearVelX: -1.65,
    shearVelZ: 0.75,
    ellipA: 1.8,
  });
  heroPudding.softBody.addRipple(new THREE.Vector3(0.08, 0.32, 0), 0.032);
  patissier.setMood('awe');
}

function pourCaramelStep(amount, angleOffset = 0) {
  const prev = game.caramelPoured;
  game.caramelPoured = Math.min(1.35, game.caramelPoured + amount);

  if (!game.firstCaramelSlowMoDone) {
    game.firstCaramelSlowMoDone = true;
    triggerSlowMotion(0.28, 0.95);
    patissier.setMood('awe');
  }

  // Advance dynamic caramel drips along the exact angular side being poured on!
  const pWorld = new THREE.Vector3();
  heroPudding.mesh.getWorldPosition(pWorld);
  const spoutPos = new THREE.Vector3();
  copperSaucier.spoutAnchor.getWorldPosition(spoutPos);

  const dx = spoutPos.x - pWorld.x;
  const dz = spoutPos.z - pWorld.z;
  const targetTheta = Math.atan2(dz, dx) + angleOffset;
  const u = materials.heroPudding.userData.puddingUniforms;
  u.uExtraTopCaramel.value = Math.min(1.0, game.caramelPoured * 0.9);

  const drips = u.uDrips.value;
  for (let i = 0; i < 16; i++) {
    const sectorAng = (i / 16) * Math.PI * 2 - Math.PI;
    let diff = Math.abs(sectorAng - targetTheta);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    const weight = Math.exp(-(diff * diff) / 0.85) * 0.75 + 0.25;
    drips[i] = Math.min(1.02, drips[i] + amount * 1.15 * weight);
  }

  // Expand glossy caramel pool on the stoneware plate & gently jiggle the pudding!
  plateAndPool.poolMesh.visible = true;
  plateAndPool.updatePool(0.016, 0.35 + Math.min(0.22, game.caramelPoured * 0.16), amount * 1.8);
  heroPudding.softBody.impulse({
    squashVel: -amount * 1.9,
    shearVelX: -Math.cos(targetTheta) * amount * 1.4,
    shearVelZ: -Math.sin(targetTheta) * amount * 1.4,
  });

  // Unlock playground garnishes & silver spoon once caramel starts coating!
  if (prev < 0.22 && game.caramelPoured >= 0.22) {
    silverSpoon.group.visible = true;
    silverSpoon.group.position.set(0.62, 0.05, 0.34);
    strawberrySet.container.visible = true;
    strawberrySet.container.position.set(-0.68, 0, 0.28);
  }
}

function triggerHeroUnmoldPurun() {
  game.unmolded = true;
  puddingCup.caramelLayer.visible = false;
  puddingCup.custardFill.visible = false;

  applyRecipeToHeroPudding();
  heroPudding.mesh.visible = true;
  game.puddingDropY = 0.11;
  game.puddingDropVel = -0.35;
  heroPudding.mesh.position.y = plateAndPool.wellY + game.puddingDropY;

  plateAndPool.poolMesh.visible = true;
  plateAndPool.updatePool(0.016, 0.35, 0.95);

  // HERO PHANTOM SLOW-MOTION (0.18x) + rim-lit caramel droplets + sub-bass purun!
  triggerSlowMotion(0.18, 1.45);
  camState.zoomPunch = 0.24;
  audio.playUnmoldPopAndDrop();
  patissier.setMood('awe');

  const dropOrigin = new THREE.Vector3(0, 0.22, 0.08);
  droplets.burst(dropOrigin, materials.caramel, {
    count: 18,
    speed: 1.45,
    upBias: 1.15,
    radiusMin: 0.007,
    radiusMax: 0.018,
    floorY: 0.04,
  });
}

function transitionToStage(nextStage) {
  game.stage = nextStage;
  game.stageTime = 0;
  game.idleTime = 0;
  game.idleDemoShown = false;
  audio.updatePourSound(false);
  audio.updateSteamSound(false);
  liquidStream.update(1, false, new THREE.Vector3(), new THREE.Vector3());

  if (nextStage === STAGES.POUR_MOLD) {
    whisk.group.visible = false;
    extraEggsGroup.visible = false;
    milkCarafe.group.visible = false;
    camState.basePos.set(0, 1.38, 2.32);
    camState.lookAt.set(0, 0.42, -0.12);
  } else if (nextStage === STAGES.STEAM_COOK) {
    mixingBowl.group.visible = false;
    steamerCloche.group.visible = true;
    steamerCloche.group.position.set(0.62, 0, 0.06);
    camState.basePos.set(0, 1.36, 2.26);
    camState.lookAt.set(0, 0.42, -0.10);
  } else if (nextStage === STAGES.ICE_CHILL) {
    steamerCloche.group.visible = false;
    iceBath.group.visible = true;
    iceBath.group.position.set(0.68, 0, 0.08);
  } else if (nextStage === STAGES.FLIP_PLATE) {
    iceBath.group.visible = false;
    plateAndPool.group.visible = true;
    plateAndPool.group.position.set(0.66, 0, 0.06);
    camState.basePos.set(0, 1.40, 2.34);
    camState.lookAt.set(0, 0.42, -0.10);
  } else if (nextStage === STAGES.UNMOLD_PURUN) {
    samplePudding.group.visible = false;
    camState.basePos.set(0, 1.28, 2.12);
    camState.lookAt.set(0, 0.39, -0.06);
  } else if (nextStage === STAGES.CARAMEL_PLAY) {
    samplePudding.group.visible = false;
    puddingCup.group.visible = false;
    copperSaucier.group.visible = true;
    copperSaucier.group.position.set(0.42, 0.56, 0.08);
    game.saucierTarget.set(0.28, 0.58, 0.06);
    camState.basePos.set(0, 1.30, 2.16);
    camState.lookAt.set(0, 0.39, -0.06);
  }
}

let waveClock = 0;

function updateSimulation(realDt) {
  // Smooth Slow-Motion Time Dilation
  if (slowMoTimer > 0) {
    slowMoTimer -= realDt;
    timeScale = THREE.MathUtils.lerp(timeScale, slowMoTarget, Math.min(1, realDt * 16));
  } else {
    timeScale = THREE.MathUtils.lerp(timeScale, 1.0, Math.min(1, realDt * 6.5));
  }
  audio.setTimeScale(timeScale);

  const dt = realDt * timeScale;
  waveClock += dt;
  game.stageTime += realDt;
  if (!pointer.active) {
    game.idleTime += realDt;
  }

  // Gentle 10s Idle Physical Nudge (ONLY once after 10s of complete stillness, per wordless.short.md!)
  let idlePulse = 0;
  if (game.idleTime > 10.0 && !game.idleDemoShown) {
    const demoT = game.idleTime - 10.0;
    if (demoT < 1.1) {
      idlePulse = Math.sin((demoT / 1.1) * Math.PI);
    } else {
      game.idleDemoShown = true;
    }
  }

  // Always step background sample pudding subtle physics
  samplePudding.miniSoft.step(dt);

  // ==========================================================================
  // STAGE 1: CRACK EGG(S), POKE YOLK, POUR MILK & WHISK BATTER
  // ==========================================================================
  if (game.stage === STAGES.CRACK_MIX) {
    // Egg Cracking Animation + Slow-Mo Golden Yolk Plop!
    if (game.crackingAnim) {
      const ca = game.crackingAnim;
      ca.progress += realDt * 1.95; // Use realDt up to plop so crack feels snappy!
      const p = ca.progress;
      const eGroup = ca.eggProp.group;

      if (p < 0.35) {
        // Swing egg to tap crisp against glass bowl rim
        const k = p / 0.35;
        eGroup.position.lerp(new THREE.Vector3(0.08, 0.38, 0.12), k * 0.45);
      } else {
        // Part two shell halves in sculpted hands over bowl center!
        ca.eggProp.wholeMesh.visible = false;
        ca.eggProp.crackGroup.visible = true;
        const openT = Math.min(1, (p - 0.35) / 0.45);
        eGroup.position.lerp(new THREE.Vector3(0, 0.44, 0.12), 0.25);
        ca.eggProp.topHalf.rotation.z = -openT * 0.72;
        ca.eggProp.topHalf.position.x = openT * 0.055;
        ca.eggProp.bottomHalf.rotation.z = openT * 0.72;
        ca.eggProp.bottomHalf.position.x = -openT * 0.055;

        if (!ca.plopped && openT > 0.38) {
          ca.plopped = true;
          const idx = game.eggCount;
          game.eggCount = Math.min(3, game.eggCount + 1);
          mixingBowl.albumenMesh.visible = true;
          mixingBowl.albumenMesh.scale.setScalar(0.85 + game.eggCount * 0.22);

          const ysb = mixingBowl.yolks[idx];
          ysb.mesh.visible = true;
          const offsetAng = idx * 2.1;
          const offR = idx === 0 ? 0 : 0.095;
          ysb.mesh.position.set(Math.cos(offsetAng) * offR, 0.055 + game.milkAmount * 0.14, Math.sin(offsetAng) * offR);
          ysb.impulse(-3.4, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8);

          // Slow-Mo #1 on first golden yolk plop!
          if (game.eggCount === 1) {
            triggerSlowMotion(0.24, 1.05);
            camState.zoomPunch = 0.16;
            patissier.setMood('awe');
          }
          audio.playYolkPlop(game.eggCount === 1);
          droplets.burst(new THREE.Vector3(0, 0.18, 0.12), materials.yolk, {
            count: 12,
            speed: 1.05,
            floorY: 0.07,
          });
          updateBatterSwirlTexture(textures, game.mixProgress, game.swirlAngle, game.eggCount, game.foamAmount);
        }
      }

      leftHand.setTarget(new THREE.Vector3(-0.14, 0.45, 0.20), new THREE.Euler(0.2, -0.25, -0.35), 'pinchEgg');
      rightHand.setTarget(new THREE.Vector3(0.14, 0.45, 0.20), new THREE.Euler(0.2, 0.25, 0.35), 'pinchEgg');

      if (p >= 1.05) {
        eGroup.visible = false;
        game.crackingAnim = null;
      }
    } else if (game.eggCount === 0) {
      // Poised Egg #1 waiting at bowl rim
      const nudgeX = -idlePulse * 0.14;
      const nudgeY = -idlePulse * 0.08;
      heroEgg.group.position.set(0.24 + nudgeX, 0.45 + Math.sin(waveClock * 2.2) * 0.008 + nudgeY, 0.16);
      leftHand.setTarget(new THREE.Vector3(-0.48, 0.26, 0.24), new THREE.Euler(0.25, -0.35, -0.25), 'cradleCup');
      rightHand.setTarget(
        new THREE.Vector3(0.31 + nudgeX, 0.47 + nudgeY, 0.24),
        new THREE.Euler(0.18, 0.35, 0.15 + idlePulse * 0.2),
        'pinchEgg'
      );
    } else if (game.pouringMilk || game.milkAmount < 0.68) {
      // Milk Carafe pouring stage
      const tilt = game.pouringMilk ? 1.02 : idlePulse * 0.32;
      milkCarafe.group.position.lerp(
        new THREE.Vector3(game.pouringMilk ? 0.38 : 0.66, game.pouringMilk ? 0.34 : 0.0, 0.12),
        Math.min(1, realDt * 8)
      );
      milkCarafe.group.rotation.z = THREE.MathUtils.lerp(milkCarafe.group.rotation.z, tilt, Math.min(1, realDt * 9));

      if (game.pouringMilk) {
        game.milkAmount = Math.min(1.06, game.milkAmount + dt * 0.68);
        milkCarafe.setMilkLevel(Math.max(0.04, 0.92 - game.milkAmount * 0.80));
        audio.updatePourSound(true, game.milkAmount, false);

        const spoutWorld = new THREE.Vector3();
        milkCarafe.spoutAnchor.getWorldPosition(spoutWorld);
        const surfY = mixingBowl.updateLiquidSurface(game.milkAmount, 0.18, waveClock * 4);
        const endWorld = new THREE.Vector3(0.02, surfY, 0.12);
        liquidStream.setMaterial(materials.milk);
        liquidStream.update(dt, true, spoutWorld, endWorld, 0.024);

        // Rising milk gently buoys & wobbles the raw yolks!
        for (let i = 0; i < game.eggCount; i++) {
          const ysb = mixingBowl.yolks[i];
          ysb.mesh.position.y = surfY - 0.035;
          if (Math.random() < 0.25) ysb.impulse(-0.35, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
        }
      } else {
        audio.updatePourSound(false);
        liquidStream.update(dt, false, new THREE.Vector3(), new THREE.Vector3());
        mixingBowl.updateLiquidSurface(game.milkAmount, 0, waveClock);
      }

      leftHand.setTarget(new THREE.Vector3(-0.48, 0.26, 0.24), new THREE.Euler(0.25, -0.35, -0.25), 'cradleCup');
      rightHand.setTarget(
        new THREE.Vector3(
          milkCarafe.group.position.x + 0.14,
          milkCarafe.group.position.y + 0.26,
          0.18
        ),
        new THREE.Euler(0.15, 0.25, milkCarafe.group.rotation.z * 0.65),
        'gripHandle'
      );
    } else {
      // Balloon Whisk Stirring Stage!
      audio.updatePourSound(false);
      liquidStream.update(dt, false, new THREE.Vector3(), new THREE.Vector3());
      milkCarafe.group.position.lerp(new THREE.Vector3(0.82, 0, -0.18), Math.min(1, dt * 5));
      milkCarafe.group.rotation.z = THREE.MathUtils.lerp(milkCarafe.group.rotation.z, 0, Math.min(1, dt * 6));

      whisk.group.visible = true;
      game.whiskSpeed *= Math.max(0, 1 - dt * 2.6);
      const demoSwirl = idlePulse * 3.5;
      const stirR = 0.095 * Math.min(1, game.whiskSpeed + idlePulse);
      const stirAng = game.swirlAngle + demoSwirl;

      const surfY = mixingBowl.updateLiquidSurface(
        game.milkAmount,
        Math.min(0.85, game.whiskSpeed * 0.55),
        waveClock * 6
      );

      whisk.group.position.set(
        mixingBowl.group.position.x + Math.cos(stirAng) * stirR,
        0.06,
        mixingBowl.group.position.z + Math.sin(stirAng) * stirR
      );
      whisk.group.rotation.set(
        -0.22 + Math.sin(stirAng) * 0.15,
        0,
        -0.28 - Math.cos(stirAng) * 0.15
      );

      // Yolks dissolve smoothly into the golden custard swirl as mixProgress increases!
      for (let i = 0; i < game.eggCount; i++) {
        const ysb = mixingBowl.yolks[i];
        if (game.mixProgress > 0.48) {
          ysb.mesh.visible = false;
        } else {
          const orbitA = stirAng + i * 2.1;
          ysb.mesh.position.set(
            Math.cos(orbitA) * 0.09 * (1 - game.mixProgress),
            surfY - 0.03,
            Math.sin(orbitA) * 0.09 * (1 - game.mixProgress)
          );
          ysb.mesh.scale.setScalar(1 - game.mixProgress * 1.4);
        }
      }
      mixingBowl.albumenMesh.visible = game.mixProgress < 0.3;

      leftHand.setTarget(new THREE.Vector3(-0.48, 0.26, 0.24), new THREE.Euler(0.25, -0.35, -0.25), 'cradleCup');
      rightHand.setTarget(
        new THREE.Vector3(whisk.group.position.x + 0.12, 0.44, whisk.group.position.z + 0.10),
        new THREE.Euler(0.32, 0.22, -0.35),
        'gripHandle'
      );

      if (game.mixProgress >= 0.98) {
        audio.playHappyTaste();
        transitionToStage(STAGES.POUR_MOLD);
      }
    }

    // Step visible raw egg yolks
    for (let i = 0; i < 3; i++) {
      if (mixingBowl.yolks[i].mesh.visible) mixingBowl.yolks[i].step(dt);
    }
  }

  // ==========================================================================
  // STAGE 2: POUR SILKY CUSTARD BATTER INTO FLUTED MOLD CUP
  // ==========================================================================
  else if (game.stage === STAGES.POUR_MOLD) {
    puddingCup.group.position.lerp(new THREE.Vector3(-0.12, 0, 0.10), Math.min(1, dt * 6.5));
    const pourActive = game.pouringBatter && game.cupFill < 1.04;
    const tilt = pourActive ? 0.92 : 0.22 + idlePulse * 0.25;

    mixingBowl.group.position.lerp(
      new THREE.Vector3(pourActive ? 0.42 : 0.56, pourActive ? 0.52 : 0.26, 0.10),
      Math.min(1, dt * 7)
    );
    mixingBowl.group.rotation.z = THREE.MathUtils.lerp(mixingBowl.group.rotation.z, tilt, Math.min(1, dt * 8));

    const richCol = getCustardRichColor(game.eggCount, 1.0);
    if (pourActive) {
      game.cupFill = Math.min(1.04, game.cupFill + dt * 0.58);
      puddingCup.setCustardFill(game.cupFill, 0, richCol);
      mixingBowl.updateLiquidSurface(Math.max(0.08, game.milkAmount * (1 - game.cupFill * 0.85)), 0.12, waveClock * 4);

      const spoutPos = mixingBowl.group.position.clone().add(new THREE.Vector3(-0.42, 0.12, 0));
      const endPos = puddingCup.group.position.clone().add(new THREE.Vector3(0, 0.08 + game.cupFill * 0.28, 0));
      liquidStream.setMaterial(materials.batter);
      liquidStream.update(dt, true, spoutPos, endPos, 0.026);
      audio.updatePourSound(true, game.cupFill, false);
    } else {
      liquidStream.update(dt, false, new THREE.Vector3(), new THREE.Vector3());
      audio.updatePourSound(false);
    }

    leftHand.setTarget(
      new THREE.Vector3(puddingCup.group.position.x - 0.36, 0.22, 0.22),
      new THREE.Euler(0.2, -0.35, -0.2),
      'cradleCup'
    );
    rightHand.setTarget(
      new THREE.Vector3(mixingBowl.group.position.x + 0.36, mixingBowl.group.position.y + 0.16, 0.20),
      new THREE.Euler(0.2, 0.3, tilt * 0.5),
      'cradleCup'
    );

    if (game.cupFill >= 0.78 && !pointer.active) {
      transitionToStage(STAGES.STEAM_COOK);
    } else if (game.cupFill >= 1.03) {
      transitionToStage(STAGES.STEAM_COOK);
    }
  }

  // ==========================================================================
  // STAGE 3: STEAMING UNDER GLASS CLOCHE (VOLUMETRIC BACKLIT STEAM!)
  // ==========================================================================
  else if (game.stage === STAGES.STEAM_COOK) {
    puddingCup.group.position.lerp(new THREE.Vector3(0, 0, 0.10), Math.min(1, dt * 7));

    if (!game.domePlaced) {
      // Gentle ambient steam wisps invite placing the glass cloche!
      if (Math.random() < 0.3) {
        steamMist.emitHotSteam(new THREE.Vector3(0, 0.05, 0.10), { radius: 0.24, opacity: 0.14, riseSpeed: 0.28 });
      }
      const demoX = -idlePulse * 0.26;
      steamerCloche.group.position.lerp(new THREE.Vector3(0.58 + demoX, idlePulse * 0.12, 0.08), Math.min(1, dt * 7));
      leftHand.setTarget(new THREE.Vector3(-0.46, 0.22, 0.24), new THREE.Euler(0.2, -0.3, -0.2), 'relaxed');
      rightHand.setTarget(
        new THREE.Vector3(steamerCloche.group.position.x + 0.06, 0.62 + idlePulse * 0.12, 0.16),
        new THREE.Euler(0.35, 0.2, -0.15),
        'pinchEgg'
      );
    } else if (game.steamProgress < 1.0) {
      steamerCloche.group.position.lerp(new THREE.Vector3(0, 0, 0.10), Math.min(1, dt * 9));
      game.steamProgress = Math.min(1.0, game.steamProgress + dt * 0.52);

      // Rich backlit steam billows + condensation beads on cup!
      if (Math.random() < 0.75) {
        steamMist.emitHotSteam(new THREE.Vector3(0, 0.06, 0.10), {
          radius: 0.30,
          opacity: 0.26,
          riseSpeed: 0.45,
          scale: 0.95,
        });
      }
      puddingCup.beadsGroup.visible = game.steamProgress > 0.32;
      puddingCup.setCustardFill(game.cupFill, game.steamProgress, getCustardRichColor(game.eggCount, 1.0));
      audio.updateSteamSound(true, 0.85);

      leftHand.setTarget(new THREE.Vector3(-0.52, 0.24, 0.26), new THREE.Euler(0.2, -0.3, -0.2), 'relaxed');
      rightHand.setTarget(new THREE.Vector3(0.06, 0.62, 0.18), new THREE.Euler(0.35, 0.15, -0.1), 'pinchEgg');
    } else {
      // Lift cloche through a dramatic burst of backlit studio steam!
      if (game.domeLifting === 0) {
        audio.playGlassCloche();
        audio.updateSteamSound(false);
        patissier.setMood('awe');
        for (let i = 0; i < 14; i++) {
          steamMist.emitHotSteam(new THREE.Vector3(0, 0.22, 0.10), {
            radius: 0.26,
            opacity: 0.32,
            riseSpeed: 0.62,
            scale: 1.25,
          });
        }
      }
      game.domeLifting += dt * 1.35;
      steamerCloche.group.position.set(game.domeLifting * 0.55, game.domeLifting * 0.65, 0.05);
      rightHand.setTarget(
        new THREE.Vector3(steamerCloche.group.position.x + 0.06, steamerCloche.group.position.y + 0.60, 0.14),
        new THREE.Euler(0.35, 0.2, -0.15),
        'pinchEgg'
      );
      if (game.domeLifting >= 0.95) {
        transitionToStage(STAGES.ICE_CHILL);
      }
    }
  }

  // ==========================================================================
  // STAGE 4: CHILLING WITH GLISTENING ICE RING & COLD VAPOR
  // ==========================================================================
  else if (game.stage === STAGES.ICE_CHILL) {
    // Hot pudding still emits faint steam until chilled!
    if (game.chillProgress < 0.5 && Math.random() < 0.25) {
      steamMist.emitHotSteam(new THREE.Vector3(0, 0.36, 0.10), { radius: 0.12, opacity: 0.16, riseSpeed: 0.32, scale: 0.7 });
    }

    if (!game.icePlaced) {
      const nudge = -idlePulse * 0.24;
      iceBath.group.position.lerp(new THREE.Vector3(0.66 + nudge, 0, 0.10), Math.min(1, dt * 7));
      if (Math.random() < 0.35) {
        steamMist.emitColdMist(iceBath.group.position, { radius: 0.18, opacity: 0.2 });
      }
      leftHand.setTarget(new THREE.Vector3(-0.46, 0.22, 0.24), new THREE.Euler(0.2, -0.3, -0.2), 'relaxed');
      rightHand.setTarget(
        new THREE.Vector3(iceBath.group.position.x + 0.32, 0.18, 0.22),
        new THREE.Euler(0.2, 0.35, 0.15),
        'cradleCup'
      );
    } else {
      iceBath.group.position.lerp(new THREE.Vector3(0, 0, 0.10), Math.min(1, dt * 8.5));
      game.chillProgress = Math.min(1.0, game.chillProgress + dt * 0.68);
      if (Math.random() < 0.8) {
        steamMist.emitColdMist(new THREE.Vector3(0, 0.02, 0.10), { radius: 0.28, opacity: 0.28 });
      }
      // Slight contraction away from glass walls signals ready to unmold!
      puddingCup.custardFill.scale.x = THREE.MathUtils.lerp(1.0, 0.96, game.chillProgress);
      puddingCup.custardFill.scale.z = THREE.MathUtils.lerp(1.0, 0.96, game.chillProgress);

      leftHand.setTarget(new THREE.Vector3(-0.48, 0.18, 0.22), new THREE.Euler(0.2, -0.3, -0.2), 'cradleCup');
      rightHand.setTarget(new THREE.Vector3(0.48, 0.18, 0.22), new THREE.Euler(0.2, 0.3, 0.2), 'cradleCup');

      if (game.chillProgress >= 1.0) {
        audio.playIceChime();
        transitionToStage(STAGES.FLIP_PLATE);
      }
    }
  }

  // ==========================================================================
  // STAGE 5: PLACE ARTISAN STONEWARE PLATE & DRAMATIC 180-DEGREE FLIP!
  // ==========================================================================
  else if (game.stage === STAGES.FLIP_PLATE) {
    if (!game.flipping) {
      const nudge = -idlePulse * 0.22;
      plateAndPool.group.position.lerp(new THREE.Vector3(0.64 + nudge, 0.04 + idlePulse * 0.14, 0.10), Math.min(1, dt * 7));
      leftHand.setTarget(new THREE.Vector3(-0.36, 0.22, 0.20), new THREE.Euler(0.2, -0.3, -0.2), 'cradleCup');
      rightHand.setTarget(
        new THREE.Vector3(plateAndPool.group.position.x + 0.34, 0.16 + idlePulse * 0.12, 0.20),
        new THREE.Euler(0.15, 0.3, 0.1),
        'flatFlip'
      );
    } else {
      game.flipProgress = Math.min(1.0, game.flipProgress + dt * 1.28);
      const fp = game.flipProgress;

      if (fp < 0.38) {
        // Bring stoneware plate upside-down neatly over the pudding cup mouth!
        const k = THREE.MathUtils.smoothstep(fp / 0.38, 0, 1);
        plateAndPool.group.position.set(
          THREE.MathUtils.lerp(0.64, 0, k),
          THREE.MathUtils.lerp(0.04, puddingCup.height + 0.095, k),
          0.10
        );
        plateAndPool.group.rotation.z = THREE.MathUtils.lerp(0, Math.PI, k);
        leftHand.setTarget(new THREE.Vector3(-0.38, 0.24, 0.18), new THREE.Euler(0.2, -0.3, -0.2), 'cradleCup');
        rightHand.setTarget(new THREE.Vector3(0.38, 0.42, 0.18), new THREE.Euler(0.2, 0.3, 0.2), 'flatFlip');
      } else {
        // Attach both to flipPivot and rotate 180 degrees in mid-air onto center stage!
        const k = THREE.MathUtils.smoothstep((fp - 0.38) / 0.62, 0, 1);
        const arcLift = Math.sin(k * Math.PI) * 0.32;
        const rotZ = k * Math.PI;

        // Compute coupled positions cleanly around pivot (0, 0.24 + arcLift, 0.10)
        const py = 0.24 * (1 - k) + arcLift;
        plateAndPool.group.rotation.z = Math.PI + rotZ;
        puddingCup.group.rotation.z = rotZ;

        // At k=0: cup at y=0, plate inverted at y=H+0.095; at k=1: plate upright at y=0, cup inverted at y=H+0.032!
        const plateY = THREE.MathUtils.lerp(puddingCup.height + 0.06, 0.0, k) + arcLift;
        const cupY = THREE.MathUtils.lerp(0.0, puddingCup.height + plateAndPool.wellY, k) + arcLift;
        plateAndPool.group.position.set(0, plateY, 0.08);
        puddingCup.group.position.set(0, cupY, 0.08);

        leftHand.setTarget(new THREE.Vector3(-0.46, py + 0.22, 0.16), new THREE.Euler(0.15, -0.25, rotZ * 0.25), 'flatFlip');
        rightHand.setTarget(new THREE.Vector3(0.46, py + 0.22, 0.16), new THREE.Euler(0.15, 0.25, -rotZ * 0.25), 'flatFlip');

        if (fp >= 1.0) {
          plateAndPool.group.rotation.set(0, 0, 0);
          plateAndPool.group.position.set(0, 0, 0.08);
          puddingCup.group.rotation.set(0, 0, Math.PI);
          puddingCup.group.position.set(0, puddingCup.height + plateAndPool.wellY, 0.08);
          audio.playPlateClack();
          transitionToStage(STAGES.UNMOLD_PURUN);
        }
      }
    }
  }

  // ==========================================================================
  // STAGE 6: LIFT GLASS CUP -> VACUUM POP & SLOW-MOTION "PURUN!!" UNMOLD
  // ==========================================================================
  else if (game.stage === STAGES.UNMOLD_PURUN) {
    if (!game.unmolded) {
      // Subtle trembling inside glass mold builds anticipation!
      const tremble = Math.sin(waveClock * 26) * 0.003 * (0.3 + game.cupLiftHeight);
      const liftY = game.cupLiftHeight * 0.22 + idlePulse * 0.06;
      puddingCup.group.position.x = THREE.MathUtils.lerp(puddingCup.group.position.x, tremble, 0.35);
      puddingCup.group.position.y = puddingCup.height + plateAndPool.wellY + liftY;
      puddingCup.group.position.z = 0.08;

      leftHand.setTarget(
        new THREE.Vector3(-0.28, puddingCup.group.position.y - 0.14, 0.18),
        new THREE.Euler(0.22, -0.25, -0.18),
        'cradleCup'
      );
      rightHand.setTarget(
        new THREE.Vector3(0.28, puddingCup.group.position.y - 0.14, 0.18),
        new THREE.Euler(0.22, 0.25, 0.18),
        'cradleCup'
      );

      if (game.cupLiftHeight >= 0.42) {
        triggerHeroUnmoldPurun();
      }
    } else {
      // Glass cup lifts smoothly up and out of frame while pudding drops & bounces in Slow-Mo!
      puddingCup.group.position.y += dt * 1.65;
      puddingCup.group.position.x += dt * 0.35;

      leftHand.setTarget(new THREE.Vector3(-0.62, 0.26, 0.26), new THREE.Euler(0.2, -0.35, -0.2), 'relaxed');
      rightHand.setTarget(
        new THREE.Vector3(puddingCup.group.position.x + 0.28, puddingCup.group.position.y - 0.1, 0.16),
        new THREE.Euler(0.25, 0.25, 0.2),
        'cradleCup'
      );

      // Pudding drop onto stoneware well + plush squash impact!
      if (game.puddingDropY > 0) {
        game.puddingDropVel -= 9.2 * dt;
        game.puddingDropY += game.puddingDropVel * dt;
        if (game.puddingDropY <= 0) {
          game.puddingDropY = 0;
          heroPudding.softBody.impulse({
            squashVel: -4.2,
            shearVelX: 1.35,
            shearVelZ: -0.95,
            ellipA: 2.2,
            ellipB: -1.4,
          });
          heroPudding.softBody.addRipple(new THREE.Vector3(0, 0.05, 0), 0.036);
          audio.playPurun(1.0, 0.92);
        }
        heroPudding.mesh.position.y = plateAndPool.wellY + game.puddingDropY;
      }

      heroPudding.softBody.step(dt);
      plateAndPool.updatePool(dt, 0.35, 0);

      if (puddingCup.group.position.y > 1.45 && timeScale > 0.82) {
        transitionToStage(STAGES.CARAMEL_PLAY);
      }
    }
  }

  // ==========================================================================
  // STAGE 7: WARM CARAMEL POUR & TACTILE SOFT-BODY PLAYGROUND
  // ==========================================================================
  else if (game.stage === STAGES.CARAMEL_PLAY) {
    // Ease plate back to center if sloshed
    if (game.activeTool !== 'plate') {
      plateAndPool.group.position.x = THREE.MathUtils.lerp(plateAndPool.group.position.x, 0, Math.min(1, dt * 6));
    }

    // Copper Caramel Saucier motion & pouring (rests grounded on tabletop at y=0.01 unless held!)
    const pouring = game.pouringCaramel;
    const scRest = game.caramelPoured < 0.22
      ? new THREE.Vector3(0.42 - idlePulse * 0.14, 0.56, 0.08)
      : new THREE.Vector3(0.76, 0.008, -0.26);
    const scDesired = pouring ? game.saucierTarget : scRest;
    copperSaucier.group.position.lerp(scDesired, Math.min(1, dt * 8.5));
    const scTilt = pouring ? 0.78 : (game.caramelPoured < 0.22 ? 0.24 + idlePulse * 0.25 : 0.0);
    copperSaucier.group.rotation.z = THREE.MathUtils.lerp(copperSaucier.group.rotation.z, scTilt, Math.min(1, dt * 9));

    // Faint warm wisps rising from the warm copper caramel saucier
    if (Math.random() < 0.18) {
      steamMist.emitHotSteam(copperSaucier.group.position.clone().add(new THREE.Vector3(0, 0.1, 0)), {
        radius: 0.07,
        opacity: 0.12,
        riseSpeed: 0.24,
        scale: 0.55,
      });
    }

    if (pouring) {
      pourCaramelStep(dt * 0.42);
      const spoutPos = new THREE.Vector3();
      copperSaucier.spoutAnchor.getWorldPosition(spoutPos);
      const pTopY = plateAndPool.wellY + 0.35 * heroPudding.softBody.heightScale * (1 + heroPudding.softBody.squash);
      const landX = THREE.MathUtils.clamp(spoutPos.x - 0.04, -0.22, 0.22);
      const landZ = THREE.MathUtils.clamp(spoutPos.z, -0.22, 0.22);
      const endPos = new THREE.Vector3(plateAndPool.group.position.x + landX, pTopY, plateAndPool.group.position.z + landZ);

      liquidStream.setMaterial(materials.caramel);
      liquidStream.update(dt, true, spoutPos, endPos, 0.017);
      audio.updatePourSound(true, 0.5, true);
    } else {
      liquidStream.update(dt, false, new THREE.Vector3(), new THREE.Vector3());
      audio.updatePourSound(false);
    }

    // Silver Dessert Spoon animation (idle / spank / scoop / feed!)
    if (silverSpoon.group.visible) {
      if (spankAnimTimer > 0) {
        spankAnimTimer = Math.max(0, spankAnimTimer - dt);
        const sPhase = Math.sin((spankAnimTimer / 0.36) * Math.PI);
        silverSpoon.group.position.set(0.24 - sPhase * 0.14, 0.34 - sPhase * 0.08, 0.12);
        silverSpoon.group.rotation.set(0, 0.1, 0.35 - sPhase * 0.48);
      } else if (game.spoonMode === 'feeding') {
        const mouthPos = patissier.getMouthWorldPosition(new THREE.Vector3());
        silverSpoon.group.position.lerp(
          new THREE.Vector3(mouthPos.x + 0.08, mouthPos.y - 0.03, mouthPos.z + 0.20),
          Math.min(1, dt * 8)
        );
        silverSpoon.group.rotation.set(-0.15, 0.25, -0.05);
        if (silverSpoon.group.position.distanceTo(new THREE.Vector3(mouthPos.x + 0.08, mouthPos.y - 0.03, mouthPos.z + 0.20)) < 0.08) {
          silverSpoon.biteGroup.visible = false;
          game.spoonMode = 'idle';
        }
      } else if (game.spoonMode === 'dragging' || game.spoonMode === 'loaded') {
        silverSpoon.group.position.lerp(game.spoonPos, Math.min(1, dt * 14));
        silverSpoon.group.rotation.set(0, 0.18, game.spoonMode === 'loaded' ? 0.04 : 0.28);
      } else {
        silverSpoon.group.position.lerp(new THREE.Vector3(0.58, 0.055, 0.34), Math.min(1, dt * 7));
        silverSpoon.group.rotation.set(0, 0.38, 0.06);
      }
      silverSpoon.updateBite(dt);
    }

    // Falling / Placed Fresh Strawberries on Pudding Crown (Trampoline Bounce!)
    const pCrownY = plateAndPool.wellY + 0.355 * heroPudding.softBody.heightScale * (1 + heroPudding.softBody.squash);
    strawberrySet.berries.forEach((b, idx) => {
      if (b.falling) {
        b.vel.y -= 7.8 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        if (b.mesh.position.y <= pCrownY) {
          b.mesh.position.y = pCrownY;
          b.falling = false;
          b.placedOnPudding = true;
          b.puddingOffset.set(
            b.mesh.position.x - plateAndPool.group.position.x,
            0,
            b.mesh.position.z - plateAndPool.group.position.z
          );
          // Mini slow-mo trampoline bounce on landing!
          triggerSlowMotion(0.32, 0.65);
          heroPudding.softBody.impulse({
            squashVel: -2.6,
            shearVelX: b.puddingOffset.x * 5.0,
            shearVelZ: b.puddingOffset.z * 5.0,
          });
          heroPudding.softBody.addRipple(new THREE.Vector3(b.puddingOffset.x, 0.34, b.puddingOffset.z), 0.03);
          audio.playPurun(0.9, 1.05);
          patissier.setMood('awe');
          droplets.burst(b.mesh.position, materials.caramel, { count: 10, speed: 0.95, floorY: 0.04 });
        }
      } else if (b.placedOnPudding) {
        // Ride seamlessly with the wobbling soft-body pudding crown!!
        const sb = heroPudding.softBody;
        const crownDX = sb.shearX + (sb.whipX - sb.shearX * 0.35) * 1.45;
        const crownDZ = sb.shearZ + (sb.whipZ - sb.shearZ * 0.35) * 1.45;
        b.mesh.position.set(
          plateAndPool.group.position.x + b.puddingOffset.x + crownDX,
          pCrownY - 0.008,
          plateAndPool.group.position.z + b.puddingOffset.z + crownDZ
        );
        b.mesh.rotation.z = -crownDX * 1.8 + (idx - 1) * 0.15;
        b.mesh.rotation.x = crownDZ * 1.8;
      }
    });

    // Step Hero Pudding Soft-Body & Caramel Pool
    heroPudding.softBody.step(dt);
    plateAndPool.updatePool(dt, 0.35 + Math.min(0.22, game.caramelPoured * 0.16), 0);

    // Expressive Foreground Hand Choreography in Playground (uses exact world-space handle anchors!)
    leftHand.setTarget(new THREE.Vector3(-0.66, 0.18, 0.36), new THREE.Euler(0.2, -0.4, -0.18), 'relaxed');
    if (game.activeTool === 'pudding' && pointer.active) {
      rightHand.setTarget(
        new THREE.Vector3(dragWorldPos.x + 0.06, 0.32, dragWorldPos.z + 0.16),
        new THREE.Euler(0.35, 0.15, -0.1),
        'pokeIndex'
      );
    } else if (pouring || game.caramelPoured < 0.22) {
      const scGrip = new THREE.Vector3();
      copperSaucier.gripAnchor.getWorldPosition(scGrip);
      rightHand.setTarget(
        scGrip,
        new THREE.Euler(0.18, 0.22, copperSaucier.group.rotation.z * 0.45),
        'gripHandle'
      );
    } else if (game.activeTool === 'spoon' || game.spoonMode === 'loaded' || game.spoonMode === 'feeding' || spankAnimTimer > 0) {
      const spGrip = new THREE.Vector3();
      silverSpoon.gripAnchor.getWorldPosition(spGrip);
      rightHand.setTarget(
        spGrip,
        new THREE.Euler(0.22, 0.22, -0.12),
        'pinchEgg'
      );
    } else {
      rightHand.setTarget(new THREE.Vector3(0.72, 0.22, 0.36), new THREE.Euler(0.2, 0.35, 0.18), 'relaxed');
    }
  }

  // Update Hands, Patissier, Droplets, Steam & Camera
  leftHand.update(realDt);
  rightHand.update(realDt);
  patissier.update(realDt, pointer.active ? dragWorldPos : null);
  droplets.update(dt);
  steamMist.update(dt, camera);
  updateCameraFraming(realDt, false);
}

// ============================================================================
// 7. RENDER LOOP, RESIZE & INSPECTION / TELEMETRY HOOKS
// ============================================================================
window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCameraFraming(0.016, true);
});

let lastFrameTime = performance.now();
let fpsSmooth = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  const clampedDt = Math.min(rawDt, 0.05);
  if (rawDt > 0.001) {
    fpsSmooth = THREE.MathUtils.lerp(fpsSmooth, 1 / rawDt, 0.08);
  }

  updateSimulation(clampedDt);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Expose clean inspection API for automated visual verification & performance checks
window.__puddingStudio = {
  STAGES,
  stepAndRender(frames = 1, dt = 0.016) {
    for (let i = 0; i < frames; i++) {
      updateSimulation(dt);
    }
    renderer.render(scene, camera);
  },
  getStats() {
    return {
      stage: game.stage,
      fps: Math.round(fpsSmooth * 10) / 10,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      texturesCount: renderer.info.memory.textures,
      maxTextureSize: textures.maxTextureSize,
      shadowMapSize: heroRimLight.shadow.mapSize.x,
      pixelRatio: renderer.getPixelRatio(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timeScale: Math.round(timeScale * 100) / 100,
    };
  },
  jumpToStage(stageName, opts = {}) {
    setupInitialRound();
    if (stageName === STAGES.CRACK_MIX) {
      if (opts.withYolk) {
        heroEgg.group.visible = false;
        game.eggCount = opts.eggCount || 2;
        game.milkAmount = opts.milkAmount ?? 0.48;
        game.mixProgress = opts.mixProgress ?? 0.14;
        mixingBowl.albumenMesh.visible = true;
        for (let i = 0; i < game.eggCount; i++) {
          mixingBowl.yolks[i].mesh.visible = true;
          const xOff = game.eggCount === 1 ? 0 : (i === 0 ? -0.105 : 0.105);
          const zOff = game.eggCount === 1 ? 0 : (i === 0 ? 0.03 : -0.03);
          mixingBowl.yolks[i].mesh.position.set(xOff, 0.12 + game.milkAmount * 0.08, zOff);
        }
        updateBatterSwirlTexture(textures, game.mixProgress, 1.8, game.eggCount, 0.1);
      }
      leftHand.snapToTarget();
      rightHand.snapToTarget();
      updateCameraFraming(0.016, true);
      return;
    }

    game.eggCount = opts.eggCount || 2;
    game.milkAmount = 0.88;
    game.mixProgress = 1.0;
    game.cupFill = opts.cupFill || 0.94;
    updateBatterSwirlTexture(textures, 1.0, 2.5, game.eggCount, 0.2);

    puddingCup.setCustardFill(game.cupFill, 1.0, getCustardRichColor(game.eggCount, 1.0));
    heroEgg.group.visible = false;
    milkCarafe.group.visible = false;
    extraEggsGroup.visible = false;

    if (stageName === STAGES.STEAM_COOK) {
      mixingBowl.group.visible = false;
      puddingCup.group.position.set(0, 0, 0.10);
      transitionToStage(STAGES.STEAM_COOK);
      game.domePlaced = true;
      game.steamProgress = 0.55;
      for (let i = 0; i < 18; i++) {
        steamMist.emitHotSteam(new THREE.Vector3(0, 0.15, 0.10), { radius: 0.28, opacity: 0.28, riseSpeed: 0.4 });
      }
    } else if (stageName === STAGES.UNMOLD_PURUN) {
      mixingBowl.group.visible = false;
      plateAndPool.group.visible = true;
      plateAndPool.group.position.set(0, 0, 0.08);
      plateAndPool.group.rotation.set(0, 0, 0);
      puddingCup.group.position.set(0, puddingCup.height + plateAndPool.wellY, 0.08);
      puddingCup.group.rotation.set(0, 0, Math.PI);
      transitionToStage(STAGES.UNMOLD_PURUN);
      if (opts.triggerPurun) {
        triggerHeroUnmoldPurun();
        puddingCup.group.position.set(0.12, 0.72, 0.08);
        game.puddingDropY = 0;
        heroPudding.mesh.position.y = plateAndPool.wellY;
        heroPudding.softBody.squash = -0.22;
        heroPudding.softBody.shearX = 0.055;
        heroPudding.softBody.updateGeometry();
      }
    } else if (stageName === STAGES.CARAMEL_PLAY) {
      mixingBowl.group.visible = false;
      plateAndPool.group.visible = true;
      plateAndPool.group.position.set(0, 0, 0.08);
      plateAndPool.group.rotation.set(0, 0, 0);
      applyRecipeToHeroPudding();
      heroPudding.mesh.visible = true;
      heroPudding.mesh.position.y = plateAndPool.wellY;
      game.unmolded = true;
      transitionToStage(STAGES.CARAMEL_PLAY);

      if (opts.pourCaramel) {
        game.pouringCaramel = true;
        game.saucierTarget.set(0.24, 0.58, 0.06);
        copperSaucier.group.position.copy(game.saucierTarget);
        copperSaucier.group.rotation.z = 0.78;
        pourCaramelStep(0.55, 0.2);
        heroPudding.softBody.squash = -0.11;
        heroPudding.softBody.shearX = -0.042;
        heroPudding.softBody.updateGeometry();
      }
      if (opts.withGarnishAndBite) {
        pourCaramelStep(0.68, -0.3);
        game.pouringCaramel = false;
        copperSaucier.group.position.set(0.76, 0.008, -0.26);
        copperSaucier.group.rotation.set(0, 0, 0);
        const b0 = strawberrySet.berries[0];
        scene.attach(b0.mesh);
        b0.placedOnPudding = true;
        b0.puddingOffset.set(-0.04, 0, 0.02);
        heroPudding.softBody.addScoopBite(new THREE.Vector3(0.14, 0.25, 0.16), 0.11);
        silverSpoon.biteGroup.visible = true;
        game.spoonMode = 'loaded';
        game.spoonPos.set(0.28, 0.34, 0.22);
        silverSpoon.group.position.copy(game.spoonPos);
      }
    }
    updateCameraFraming(0.016, true);
  },
};
