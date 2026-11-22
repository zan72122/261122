import * as THREE from '../vendor/three.module.js';
import {
  createWoodBoardTextures,
  createStainlessTextures,
  createTileTextures,
  createSkinTextures,
  createCarrotTextures,
  createPotatoTextures,
  createCastIronTextures,
  createRiceTextures,
  createLinenTextures,
  createRouxTextures,
  createSteamTexture,
  createEveningKitchenEnvMap,
} from './textures.js';
import { KitchenAudio } from './audio.js';
import { FirstPersonHands } from './hands.js';
import { CurryFluidSystem } from './fluid.js';
import { CarrotModel, PotatoModel, PotIngredients, CurryRouxSystem, CurryPlateModel } from './food.js';
import { buildKitchenEnvironment } from './scene.js';

// =========================================================================
// PHOTOREALISTIC FIRST-PERSON CURRY RICE COOKING EXPERIENCE
// Zero text • One-finger intuitive physics • Adult POV large both hands
// Evening western sunlight • Simmering bubbles & melting viscous curry roux
// =========================================================================

// Stages:
// 0: PEEL_CARROT    - swipe/drag across carrot to peel curls of skin
// 1: PEEL_POTATO    - swipe/drag across potato to peel skin
// 2: CUT_CARROT     - tap or swipe down to slice carrot into chunky rounds (shaku + ton!)
// 3: CUT_POTATO     - tap or swipe down to chop potato into chunks
// 4: SAUTE          - swirl/drag wooden spatula in oiled cast-iron pot (juwa~!)
// 5: POUR_WATER     - hold/tap/drag water carafe to fill pot with simmering broth
// 6: SIMMER         - stir & pop rising simmering bubbles as broth builds heat (kotokoto)
// 7: BREAK_ROUX     - tap/pull 4 dark glossy roux squares to snap & plop into pot (paki + dobon!)
// 8: MELT_ROUX      - swirl ladle as roux melts into marbled viscous glossy curry!
// 9: LADLE_RICE     - drag from curry pot to steaming white rice plate (3 lush scoops!)
// 10: EAT_AND_PLAY  - tap/drag on steaming curry rice to scoop delicious spoonfuls; tap veggie basket to cook again!

const STAGES = {
  PEEL_CARROT: 0,
  PEEL_POTATO: 1,
  CUT_CARROT: 2,
  CUT_POTATO: 3,
  SAUTE: 4,
  POUR_WATER: 5,
  SIMMER: 6,
  BREAK_ROUX: 7,
  MELT_ROUX: 8,
  LADLE_RICE: 9,
  EAT_AND_PLAY: 10,
};

// Renderer setup (capped pixel ratio 1.5 for silky 30+ fps on iPhone/iPad!)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2c1e16);
scene.fog = new THREE.FogExp2(0x3a261a, 0.36);

// Adult eye-level first-person camera
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 10);
camera.position.set(-0.20, 0.44, 0.50);
camera.lookAt(-0.22, 0.04, 0.06);

// Generate procedural photorealistic textures & sunset environment map
const textures = {
  wood: createWoodBoardTextures(),
  stainless: createStainlessTextures(),
  tile: createTileTextures(),
  skin: createSkinTextures(),
  carrot: createCarrotTextures(),
  potato: createPotatoTextures(),
  castIron: createCastIronTextures(),
  rice: createRiceTextures(),
  linen: createLinenTextures([232, 222, 206]),
  roux: createRouxTextures(),
  steam: createSteamTexture(),
};
scene.environment = createEveningKitchenEnvMap(renderer);
scene.environmentIntensity = 0.88;

// Build kitchen environment, hands, fluid, and food
const kitchen = buildKitchenEnvironment(scene, textures);
const audio = new KitchenAudio();
const hands = new FirstPersonHands(textures.skin, textures.linen, textures.wood);
scene.add(hands.group);

const fluid = new CurryFluidSystem(kitchen.potCenter, kitchen.potRadius, textures.steam);
scene.add(fluid.group);
scene.add(fluid.dripGroup);

// Board workspace food container
const boardFoodGroup = new THREE.Group();
boardFoodGroup.position.set(kitchen.boardGroup.position.x, 0.052, kitchen.boardGroup.position.z);
scene.add(boardFoodGroup);

const peelDebrisGroup = new THREE.Group();
scene.add(peelDebrisGroup);

const carrot = new CarrotModel(textures.carrot);
const potato = new PotatoModel(textures.potato);
boardFoodGroup.add(carrot.group);
boardFoodGroup.add(potato.group);
potato.group.visible = false;

const potIngredients = new PotIngredients(kitchen.potCenter, kitchen.potRadius, textures.carrot, textures.potato);
scene.add(potIngredients.group);

const roux = new CurryRouxSystem(textures.roux, kitchen.potCenter);
scene.add(roux.trayGroup);
scene.add(roux.floatingGroup);

const plate = new CurryPlateModel(textures.rice, textures.carrot, textures.potato, textures.steam);
plate.group.position.set(-0.14, 0.0, 0.14);
plate.group.visible = false;
scene.add(plate.group);

// =========================================================================
// GAME STATE & SMOOTH CAMERA CHOREOGRAPHY
// =========================================================================
const state = {
  stage: STAGES.PEEL_CARROT,
  stageTime: 0,
  idleTime: 0,

  // Peeling state
  peelDragAccum: 0,
  peelStrokeT: 0, // 0..1 visual stroke position of peeler along veggie
  peelIndex: 0,

  // Cutting state
  cutIndex: 0,
  chopAnim: 0, // 0 idle -> 1 chopping down!

  // Saute & Simmer state
  sauteProgress: 0, // 0..1
  waterLevel: 0,    // 0..1
  pouringWater: false,
  simmerProgress: 0, // 0..1
  stirAngle: 0,
  stirSpeed: 0,
  stirLocal: new THREE.Vector2(0, 0),

  // Roux state
  rouxBreakAnim: 0,
  rouxMeltProgress: 0, // 0..1
  viscosity: 0,        // 0..1

  // Ladling state
  ladlePhase: 'pot',   // 'pot' | 'carrying' | 'pouring' | 'returning'
  ladleCarryT: 0,      // 0 at pot -> 1 over plate
  ladlePourAnim: 0,

  // Eating state
  eatAnim: 0,
  eatBiteCount: 0,

  // Secondary playful wobble
  boardBump: 0,
  potBump: 0,
  plateBump: 0,
  basketBump: 0,
};

// Camera targets (auto-adapt nicely for both portrait iPhone and landscape iPad/desktop!)
const camTargetPos = new THREE.Vector3();
const camTargetLook = new THREE.Vector3();
const camCurrentLook = new THREE.Vector3(-0.22, 0.04, 0.06);

function computeCameraForStage(stage) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portrait = aspect < 0.9;
  const distBoost = portrait ? 1.24 : 1.0;
  camera.fov = portrait ? 50 : 41;
  camera.updateProjectionMatrix();

  const bx = kitchen.boardGroup.position.x;
  const bz = kitchen.boardGroup.position.z;
  const px = kitchen.potCenter.x;
  const pz = kitchen.potCenter.z;

  if (stage <= STAGES.CUT_POTATO) {
    // Intimate adult POV over sunlit cutting board framing BOTH hands AND full carrot/peeler/knife!
    camTargetPos.set(bx + 0.01, 0.39 * distBoost, bz + 0.39 * distBoost);
    camTargetLook.set(bx + 0.01, 0.052, bz - 0.01);
  } else if (stage === STAGES.SAUTE || stage === STAGES.SIMMER || stage === STAGES.MELT_ROUX) {
    // Rich adult POV looking down into cast-iron pot with both hands & simmering fluid center-stage!
    camTargetPos.set(px - 0.02, 0.46 * distBoost, pz + 0.42 * distBoost);
    camTargetLook.set(px, 0.095, pz - 0.01);
  } else if (stage === STAGES.POUR_WATER) {
    camTargetPos.set(px + 0.05, 0.47 * distBoost, pz + 0.45 * distBoost);
    camTargetLook.set(px + 0.05, 0.10, pz);
  } else if (stage === STAGES.BREAK_ROUX) {
    // Clear view of left-hand 4-square roux tray right beside simmering pot!
    camTargetPos.set(px - 0.05, 0.45 * distBoost, pz + 0.45 * distBoost);
    camTargetLook.set(px - 0.04, 0.115, pz + 0.01);
  } else if (stage === STAGES.LADLE_RICE) {
    // Frame BOTH steaming rice plate (left-front) AND thick curry pot (right-back)!
    camTargetPos.set(0.03, 0.48 * distBoost, 0.50 * distBoost);
    camTargetLook.set(0.03, 0.070, 0.04);
  } else {
    // Stage 10: Hero close-up of steaming finished curry rice + spoon + basket visible on far left!
    camTargetPos.set(-0.14, 0.40 * distBoost, 0.49 * distBoost);
    camTargetLook.set(-0.14, 0.045, 0.11);
  }
}

function enterStage(nextStage, snapCamera = false) {
  state.stage = nextStage;
  state.stageTime = 0;
  state.idleTime = 0;

  // Stage-specific world visibility & setup
  const onBoard = nextStage <= STAGES.CUT_POTATO;
  kitchen.boardGroup.visible = onBoard;
  boardFoodGroup.visible = onBoard;
  peelDebrisGroup.visible = onBoard;

  // Slide plate into view for Stage 9-10
  plate.group.visible = nextStage >= STAGES.LADLE_RICE;

  // Default tool visibility
  if (nextStage === STAGES.PEEL_CARROT) {
    carrot.group.visible = true;
    carrot.peelGroup.visible = true;
    carrot.cutGroup.visible = false;
    potato.group.visible = false;
    state.peelIndex = 0;
    state.peelDragAccum = 0;
    hands.setTool('peeler');
  } else if (nextStage === STAGES.PEEL_POTATO) {
    carrot.group.visible = false;
    potato.group.visible = true;
    potato.peelGroup.visible = true;
    potato.cutGroup.visible = false;
    state.peelIndex = 0;
    state.peelDragAccum = 0;
    hands.setTool('peeler');
  } else if (nextStage === STAGES.CUT_CARROT) {
    carrot.group.visible = true;
    carrot.enterCutMode();
    potato.group.visible = false;
    state.cutIndex = 0;
    hands.setTool('knife');
  } else if (nextStage === STAGES.CUT_POTATO) {
    carrot.group.visible = false;
    potato.group.visible = true;
    potato.enterCutMode();
    state.cutIndex = 0;
    hands.setTool('knife');
  } else if (nextStage === STAGES.SAUTE) {
    potIngredients.dropIn();
    state.sauteProgress = 0;
    state.waterLevel = 0;
    state.viscosity = 0;
    state.rouxMeltProgress = 0;
    hands.setTool('spatula');
    audio.playSizzleBurst(0.95, 1.0);
  } else if (nextStage === STAGES.POUR_WATER) {
    potIngredients.group.visible = true;
    state.waterLevel = 0.05;
    state.pouringWater = false;
    hands.setTool(null);
  } else if (nextStage === STAGES.SIMMER) {
    potIngredients.group.visible = true;
    state.waterLevel = 1.0;
    state.simmerProgress = 0;
    hands.setTool('ladle');
    hands.setLadleFilled(false);
  } else if (nextStage === STAGES.BREAK_ROUX) {
    potIngredients.group.visible = true;
    state.waterLevel = 1.0;
    roux.trayGroup.visible = true;
    hands.setTool(null);
  } else if (nextStage === STAGES.MELT_ROUX) {
    potIngredients.group.visible = true;
    state.waterLevel = 1.0;
    roux.trayGroup.visible = false;
    hands.setTool('ladle');
    hands.setLadleFilled(false);
  } else if (nextStage === STAGES.LADLE_RICE) {
    potIngredients.group.visible = true;
    state.waterLevel = 1.0;
    state.viscosity = 1.0;
    state.rouxMeltProgress = 1.0;
    state.ladlePhase = 'pot';
    state.ladleCarryT = 0;
    hands.setTool('ladle');
    hands.setLadleFilled(true, true);
  } else if (nextStage === STAGES.EAT_AND_PLAY) {
    potIngredients.group.visible = true;
    state.waterLevel = 0.72;
    state.viscosity = 1.0;
    state.rouxMeltProgress = 1.0;
    state.eatBiteCount = 0;
    state.eatAnim = 0;
    hands.setTool('spoon');
    hands.setSpoonBite(false);
    audio.playWarmChord();
  }

  computeCameraForStage(nextStage);
  if (snapCamera) {
    camera.position.copy(camTargetPos);
    camCurrentLook.copy(camTargetLook);
    camera.lookAt(camCurrentLook);
  }
}

function resetFullGame() {
  // Clear fallen peel ribbons
  while (peelDebrisGroup.children.length > 0) {
    peelDebrisGroup.remove(peelDebrisGroup.children[0]);
  }
  carrot.ribbons.length = 0;
  potato.ribbons.length = 0;
  carrot.reset();
  potato.reset();
  potIngredients.reset();
  roux.reset();
  plate.reset();
  state.waterLevel = 0;
  state.viscosity = 0;
  state.rouxMeltProgress = 0;
  state.sauteProgress = 0;
  state.simmerProgress = 0;
  fluid.setDripRibbon(false);
  enterStage(STAGES.PEEL_CARROT, false);
}

// =========================================================================
// ONE-FINGER POINTER INPUT (forgiving, direct physical causality, multi-touch safe)
// =========================================================================
let activePointerId = null;
const pointerNDC = new THREE.Vector2();
const prevPointerNDC = new THREE.Vector2();
const pointerDownNDC = new THREE.Vector2();
let pointerIsDown = false;
let pointerMovedDist = 0;
let waterSoundTimer = 0;
let stirSoundTimer = 0;

const raycaster = new THREE.Raycaster();
const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.06);
const pointerWorld = new THREE.Vector3();

function updatePointerCoords(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const planeY = state.stage <= STAGES.CUT_POTATO ? 0.055 : 0.11;
  workPlane.constant = -planeY;
  raycaster.ray.intersectPlane(workPlane, pointerWorld);
}

// Check if pointer is near a world 3D point (in generous screen-space NDC radius)
function screenDistTo(worldPos) {
  const p = worldPos.clone().project(camera);
  return Math.hypot(p.x - pointerNDC.x, p.y - pointerNDC.y);
}

// Peel one strip off active vegetable
function peelNextStrip(veggie, isCarrot) {
  const strip = veggie.skinStrips[state.peelIndex];
  if (!strip || strip.userData.peeled) return;
  strip.userData.peeled = true;
  strip.visible = false;
  audio.playPeelSnap(isCarrot);

  const spawnPos = new THREE.Vector3(
    boardFoodGroup.position.x + 0.02,
    boardFoodGroup.position.y + 0.025,
    boardFoodGroup.position.z + 0.01
  );
  veggie.spawnPeelRibbon(peelDebrisGroup, spawnPos);

  state.peelIndex++;
  state.peelDragAccum = 0;
  // Slightly rotate veggie in left hand so next unpeeled strip turns face-up!
  veggie.peelGroup.rotation.x += (Math.PI * 2) / veggie.skinStrips.length;

  if (state.peelIndex >= veggie.skinStrips.length) {
    setTimeout(() => {
      if (state.stage === STAGES.PEEL_CARROT) enterStage(STAGES.PEEL_POTATO);
      else if (state.stage === STAGES.PEEL_POTATO) enterStage(STAGES.CUT_CARROT);
    }, 520);
  }
}

// Slice one chunky segment off active vegetable
function cutNextSegment(veggie, isCarrot) {
  if (state.chopAnim > 0.25) return;
  const seg = veggie.segments[state.cutIndex];
  if (!seg || seg.userData.cut) return;
  seg.userData.cut = true;
  state.chopAnim = 1.0;
  audio.playKnifeCut(isCarrot);

  // Give cleanly sliced wedge a real physical tumble to the right on the hinoki board!
  seg.userData.vel.set(0.16 + Math.random() * 0.08, 0.14 + Math.random() * 0.06, (Math.random() - 0.5) * 0.12);
  seg.userData.rotVel.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 6, -3.5 - Math.random() * 3);

  state.cutIndex++;
  if (state.cutIndex >= veggie.segments.length - 1) {
    // Also tumble the last piece gently when final cut finishes
    const lastSeg = veggie.segments[veggie.segments.length - 1];
    if (lastSeg && !lastSeg.userData.cut) {
      lastSeg.userData.cut = true;
      lastSeg.userData.vel.set(-0.04, 0.05, 0.02);
    }
    setTimeout(() => {
      if (state.stage === STAGES.CUT_CARROT) enterStage(STAGES.CUT_POTATO);
      else if (state.stage === STAGES.CUT_POTATO) enterStage(STAGES.SAUTE);
    }, 680);
  }
}

function handleTapOrAction() {
  const st = state.stage;

  // Check playful secondary taps on non-active background props first!
  if (st === STAGES.EAT_AND_PLAY && screenDistTo(kitchen.basketGroup.position) < 0.34) {
    audio.playTap('wood');
    state.basketBump = 1.0;
    resetFullGame();
    return;
  }

  // Stage-specific tap actions (makes single taps AND drags both work naturally for 5yo!)
  if (st === STAGES.PEEL_CARROT || st === STAGES.PEEL_POTATO) {
    const dist = screenDistTo(boardFoodGroup.position);
    if (dist < 0.65) {
      state.peelStrokeT = 1.0;
      peelNextStrip(st === STAGES.PEEL_CARROT ? carrot : potato, st === STAGES.PEEL_CARROT);
    } else if (screenDistTo(kitchen.potCenter) < 0.35) {
      audio.playTap('pot');
      state.potBump = 1.0;
    } else {
      audio.playTap('wood');
      state.boardBump = 1.0;
    }
  } else if (st === STAGES.CUT_CARROT || st === STAGES.CUT_POTATO) {
    const dist = screenDistTo(boardFoodGroup.position);
    if (dist < 0.72) {
      cutNextSegment(st === STAGES.CUT_CARROT ? carrot : potato, st === STAGES.CUT_CARROT);
    } else {
      audio.playTap('wood');
      state.boardBump = 1.0;
    }
  } else if (st === STAGES.SAUTE) {
    if (screenDistTo(kitchen.potCenter) < 0.78) {
      state.stirSpeed = Math.min(1.6, state.stirSpeed + 0.95);
      state.sauteProgress = Math.min(1, state.sauteProgress + 0.14);
      audio.playStirSwish(0, 0.8);
      audio.playSizzleBurst(0.45, 0.35);
      if (state.sauteProgress >= 1) enterStage(STAGES.POUR_WATER);
    }
  } else if (st === STAGES.SIMMER) {
    if (screenDistTo(kitchen.potCenter) < 0.78) {
      const localX = THREE.MathUtils.clamp(pointerWorld.x - kitchen.potCenter.x, -0.1, 0.1);
      const localZ = THREE.MathUtils.clamp(pointerWorld.z - kitchen.potCenter.z, -0.1, 0.1);
      fluid.triggerSplash(localX, localZ, 1.0);
      audio.playBubblePop(0.05, 1.0);
      state.simmerProgress = Math.min(1, state.simmerProgress + 0.18);
      if (state.simmerProgress >= 1) enterStage(STAGES.BREAK_ROUX);
    }
  } else if (st === STAGES.BREAK_ROUX) {
    const trayWorld = new THREE.Vector3();
    roux.trayGroup.getWorldPosition(trayWorld);
    if (screenDistTo(trayWorld) < 0.75 || screenDistTo(kitchen.potCenter) < 0.78) {
      const blk = roux.breakNextBlock((lx, lz) => {
        fluid.triggerSplash(lx, lz, 1.3);
        audio.playLiquidPlop();
        // Slight immediate marbling hint on splash!
        state.rouxMeltProgress = Math.min(0.28, state.rouxMeltProgress + 0.06);
      });
      if (blk) {
        state.rouxBreakAnim = 1.0;
        audio.playRouxSnap();
        if (roux.remainingOnTray() === 0) {
          setTimeout(() => {
            if (state.stage === STAGES.BREAK_ROUX) enterStage(STAGES.MELT_ROUX);
          }, 720);
        }
      }
    }
  } else if (st === STAGES.MELT_ROUX) {
    if (screenDistTo(kitchen.potCenter) < 0.78) {
      state.stirSpeed = Math.min(1.6, state.stirSpeed + 0.9);
      state.rouxMeltProgress = Math.min(1, state.rouxMeltProgress + 0.14);
      audio.playStirSwish(state.viscosity, 0.85);
      audio.playBubblePop(state.viscosity, 0.85);
      if (state.rouxMeltProgress >= 1) {
        setTimeout(() => {
          if (state.stage === STAGES.MELT_ROUX) enterStage(STAGES.LADLE_RICE);
        }, 420);
      }
    }
  } else if (st === STAGES.LADLE_RICE) {
    // Tapping either the plate or pot triggers a smooth juicy ladle scoop & pour!
    if (state.ladlePhase === 'pot' && (screenDistTo(plate.group.position) < 0.75 || screenDistTo(kitchen.potCenter) < 0.75)) {
      startLadlePourCycle();
    }
  } else if (st === STAGES.EAT_AND_PLAY) {
    if (screenDistTo(plate.group.position) < 0.75 && state.eatAnim <= 0.05) {
      state.eatAnim = 1.0;
      hands.setSpoonBite(true);
      audio.playMunch();
      state.eatBiteCount = plate.takeBite();
      state.plateBump = 0.6;
    } else if (screenDistTo(kitchen.potCenter) < 0.45) {
      // Bonus toy discovery: tapping the pot lets you add a fresh warm ladle of curry back onto your plate!
      audio.playCurryPour();
      plate.addLadle();
      plate.bitesTaken = Math.max(0, plate.bitesTaken - 1);
      state.potBump = 0.8;
    }
  }
}

function startLadlePourCycle() {
  state.ladlePhase = 'carrying';
  state.ladleCarryT = 0;
  hands.setLadleFilled(true, true);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (activePointerId !== null) return; // Multi-touch safe: ignore extra fingers!
  activePointerId = e.pointerId;
  pointerIsDown = true;
  pointerMovedDist = 0;
  state.idleTime = 0;
  updatePointerCoords(e);
  prevPointerNDC.copy(pointerNDC);
  pointerDownNDC.copy(pointerNDC);

  if (state.stage === STAGES.POUR_WATER) {
    state.pouringWater = true;
    audio.playSizzleBurst(0.6, 0.5);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId || !pointerIsDown) return;
  state.idleTime = 0;
  updatePointerCoords(e);
  const dx = pointerNDC.x - prevPointerNDC.x;
  const dy = pointerNDC.y - prevPointerNDC.y;
  const step = Math.hypot(dx, dy);
  pointerMovedDist += step;
  prevPointerNDC.copy(pointerNDC);

  const st = state.stage;

  // 1. PEELING DRAG: direct finger-driven peeling stroke along vegetable!
  if (st === STAGES.PEEL_CARROT || st === STAGES.PEEL_POTATO) {
    if (step > 0.004) {
      state.peelDragAccum += step;
      state.peelStrokeT = Math.min(1, state.peelDragAccum / 0.24);
      audio.drivePeelScrape(Math.min(1, step * 18), st === STAGES.PEEL_CARROT);
      if (state.peelDragAccum >= 0.24) {
        peelNextStrip(st === STAGES.PEEL_CARROT ? carrot : potato, st === STAGES.PEEL_CARROT);
      }
    }
  }
  // 2. CUTTING SWIPE: dragging down across veggie triggers crisp chop!
  else if (st === STAGES.CUT_CARROT || st === STAGES.CUT_POTATO) {
    if (dy < -0.025 && state.chopAnim <= 0.15) {
      cutNextSegment(st === STAGES.CUT_CARROT ? carrot : potato, st === STAGES.CUT_CARROT);
    }
  }
  // 3. SAUTE / SIMMER / MELT ROUX STIRRING: hand & spatula/ladle follow finger swirl inside pot!
  else if (st === STAGES.SAUTE || st === STAGES.SIMMER || st === STAGES.MELT_ROUX) {
    const lx = THREE.MathUtils.clamp(pointerWorld.x - kitchen.potCenter.x, -0.095, 0.095);
    const lz = THREE.MathUtils.clamp(pointerWorld.z - kitchen.potCenter.z, -0.095, 0.095);
    state.stirLocal.set(lx, lz);
    const boost = Math.min(1.6, step * 22);
    state.stirSpeed = Math.min(1.8, state.stirSpeed + boost * 0.45);
    state.stirAngle += step * 7.5;

    if (step > 0.008) {
      stirSoundTimer -= 0.016;
      if (stirSoundTimer <= 0) {
        audio.playStirSwish(state.viscosity, Math.min(1, step * 14));
        stirSoundTimer = 0.14;
      }
    }

    if (st === STAGES.SAUTE) {
      state.sauteProgress = Math.min(1, state.sauteProgress + step * 0.42);
      if (state.sauteProgress >= 1) enterStage(STAGES.POUR_WATER);
    } else if (st === STAGES.SIMMER) {
      state.simmerProgress = Math.min(1, state.simmerProgress + step * 0.46);
      if (state.simmerProgress >= 1) enterStage(STAGES.BREAK_ROUX);
    } else if (st === STAGES.MELT_ROUX) {
      state.rouxMeltProgress = Math.min(1, state.rouxMeltProgress + step * 0.36);
      if (state.rouxMeltProgress >= 1) {
        setTimeout(() => {
          if (state.stage === STAGES.MELT_ROUX) enterStage(STAGES.LADLE_RICE);
        }, 420);
      }
    }
  }
  // 4. LADLE DRAG from pot toward steaming rice plate!
  else if (st === STAGES.LADLE_RICE && state.ladlePhase === 'pot') {
    if (dx < -0.02 || pointerMovedDist > 0.14) {
      startLadlePourCycle();
    }
  }
});

function releasePointer(e) {
  if (e.pointerId !== activePointerId) return;
  const wasTap = pointerMovedDist < 0.06;
  activePointerId = null;
  pointerIsDown = false;
  state.pouringWater = false;

  if (wasTap) {
    handleTapOrAction();
  }
}

renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  computeCameraForStage(state.stage);
});

// =========================================================================
// HAND CHOREOGRAPHY PER STAGE (large, natural, unmistakable first-person POV!)
// =========================================================================
function updateHandsAndTools(dt, time) {
  const st = state.stage;
  const bx = kitchen.boardGroup.position.x;
  const bz = kitchen.boardGroup.position.z;
  const px = kitchen.potCenter.x;
  const py = kitchen.potCenter.y;
  const pz = kitchen.potCenter.z;

  // Subtle idle invitation after 7.5s of no input (gentle human hand anticipation, zero UI arrows!)
  const idlePulse = state.idleTime > 7.5 ? Math.sin((state.idleTime - 7.5) * 3.2) : 0;

  if (st === STAGES.PEEL_CARROT || st === STAGES.PEEL_POTATO) {
    // Left hand holds thick left end of carrot/potato cleanly on cutting board!
    hands.setLeftTarget(
      new THREE.Vector3(bx - 0.17, 0.090, bz + 0.095),
      new THREE.Euler(-0.22, -0.72, -0.25, 'YXZ'),
      'holdVeggie'
    );
    // Right hand holds Y-peeler so gleaming blade rests directly ON TOP of the carrot ridge!
    const slide = state.peelStrokeT + Math.max(0, idlePulse) * 0.22;
    const rx = THREE.MathUtils.lerp(bx + 0.088, bx + 0.188, slide);
    const ry = 0.136 - Math.sin(slide * Math.PI) * 0.012;
    const rz = bz + 0.135 + slide * 0.010;
    hands.setRightTarget(
      new THREE.Vector3(rx, ry, rz),
      new THREE.Euler(-0.34, 0.66, 0.22, 'YXZ'),
      'pinchPeeler'
    );
    state.peelStrokeT *= Math.exp(-dt * 6);
  } else if (st === STAGES.CUT_CARROT || st === STAGES.CUT_POTATO) {
    const veggie = st === STAGES.CUT_CARROT ? carrot : potato;
    const curSeg = veggie.segments[Math.min(state.cutIndex, veggie.segments.length - 1)];
    const cutLocalX = curSeg ? curSeg.userData.cutX : 0;

    // Left hand uses Japanese chef "cat's paw" safe-curl grip on left half of veggie
    hands.setLeftTarget(
      new THREE.Vector3(bx + cutLocalX - 0.135, 0.096, bz + 0.098),
      new THREE.Euler(-0.22, -0.62, -0.18, 'YXZ'),
      'catPaw'
    );

    // Right hand holds Santoku knife with blade poised right over the carrot cut line!
    const chopDown = Math.sin(state.chopAnim * Math.PI);
    const idleNudge = Math.max(0, idlePulse) * 0.018;
    hands.setRightTarget(
      new THREE.Vector3(bx + cutLocalX + 0.068, 0.126 - chopDown * 0.048 - idleNudge, bz + 0.155),
      new THREE.Euler(-0.18 - chopDown * 0.26, 0.36, 1.30, 'YXZ'),
      'gripTool'
    );
    state.chopAnim = Math.max(0, state.chopAnim - dt * 4.8);
  } else if (st === STAGES.SAUTE) {
    // Left hand steadies the left cast-iron pot handle cleanly
    hands.setLeftTarget(
      new THREE.Vector3(px - 0.22, py + 0.13, pz + 0.13),
      new THREE.Euler(-0.22, -0.62, -0.35, 'YXZ'),
      'holdVeggie'
    );
    // Right hand swirls wooden spatula cleanly from lower-right without blocking pot interior!
    const swirlX = state.stirLocal.x * 0.75 + Math.cos(state.stirAngle) * 0.032;
    const swirlZ = state.stirLocal.y * 0.75 + Math.sin(state.stirAngle) * 0.032;
    hands.setRightTarget(
      new THREE.Vector3(px + 0.16 + swirlX, py + 0.24, pz + 0.21 + swirlZ + idlePulse * 0.015),
      new THREE.Euler(-0.56, 0.54 + swirlX * 1.2, 0.62, 'YXZ'),
      'gripTool'
    );
  } else if (st === STAGES.POUR_WATER) {
    hands.setLeftTarget(
      new THREE.Vector3(px - 0.22, py + 0.13, pz + 0.13),
      new THREE.Euler(-0.22, -0.62, -0.35, 'YXZ'),
      'holdVeggie'
    );
    const tilt = state.pouringWater ? 1.0 : Math.max(0, idlePulse) * 0.25;
    const carafeTarget = new THREE.Vector3(
      THREE.MathUtils.lerp(0.50, px + 0.16, tilt),
      THREE.MathUtils.lerp(0.0, py + 0.19, tilt),
      THREE.MathUtils.lerp(-0.04, pz + 0.02, tilt)
    );
    kitchen.carafeGroup.position.lerp(carafeTarget, Math.min(1, dt * 8));
    kitchen.carafeGroup.rotation.z = THREE.MathUtils.lerp(kitchen.carafeGroup.rotation.z, tilt * 1.08, Math.min(1, dt * 8));
    kitchen.carafeWater.scale.y = Math.max(0.08, 1 - state.waterLevel * 0.88);
    kitchen.carafeWater.position.y = 0.01 + kitchen.carafeWater.scale.y * 0.045;

    kitchen.waterStream.visible = state.pouringWater && state.waterLevel < 1;
    if (kitchen.waterStream.visible) {
      kitchen.waterStream.position.set(px + 0.055, py + 0.16, pz + 0.01);
      kitchen.waterStream.rotation.z = 0.18;
      kitchen.waterStream.scale.x = 0.9 + Math.sin(time * 32) * 0.12;
      state.waterLevel = Math.min(1, state.waterLevel + dt * 0.38);
      fluid.triggerSplash(0.05, 0.01, 0.35);
      waterSoundTimer -= dt;
      if (waterSoundTimer <= 0) {
        audio.playWaterPourTick(state.waterLevel);
        waterSoundTimer = 0.075;
      }
      if (state.waterLevel >= 1) {
        state.pouringWater = false;
        kitchen.waterStream.visible = false;
        enterStage(STAGES.SIMMER);
      }
    }

    hands.setRightTarget(
      new THREE.Vector3(
        kitchen.carafeGroup.position.x + 0.08,
        kitchen.carafeGroup.position.y + 0.10,
        kitchen.carafeGroup.position.z + 0.14
      ),
      new THREE.Euler(-0.20, 0.42, 1.05 + tilt * 0.55, 'YXZ'),
      'holdVeggie'
    );
  } else if (st === STAGES.SIMMER || st === STAGES.MELT_ROUX) {
    kitchen.carafeGroup.position.lerp(new THREE.Vector3(0.56, 0.0, -0.06), Math.min(1, dt * 6));
    kitchen.carafeGroup.rotation.z *= Math.exp(-dt * 6);
    kitchen.waterStream.visible = false;

    hands.setLeftTarget(
      new THREE.Vector3(px - 0.22, py + 0.13, pz + 0.13),
      new THREE.Euler(-0.22, -0.62, -0.35, 'YXZ'),
      'holdVeggie'
    );
    const swirlX = state.stirLocal.x * 0.72 + Math.cos(state.stirAngle) * 0.036;
    const swirlZ = state.stirLocal.y * 0.72 + Math.sin(state.stirAngle) * 0.036;
    hands.setRightTarget(
      new THREE.Vector3(px + 0.16 + swirlX, py + 0.26, pz + 0.22 + swirlZ + idlePulse * 0.012),
      new THREE.Euler(-0.62, 0.50 + swirlX * 1.1, 0.48, 'YXZ'),
      'gripTool'
    );
  } else if (st === STAGES.BREAK_ROUX) {
    // Left hand presents the glossy 4-square curry roux tray cleanly at lower-left of pot!
    const trayPos = new THREE.Vector3(px - 0.16, py + 0.155, pz + 0.125);
    roux.trayGroup.position.copy(trayPos);
    roux.trayGroup.rotation.set(0.32, 0.36, -0.14);

    hands.setLeftTarget(
      new THREE.Vector3(trayPos.x - 0.085, trayPos.y - 0.015, trayPos.z + 0.11),
      new THREE.Euler(-0.10, -0.48, -0.82, 'YXZ'),
      'openSupport'
    );

    // Right hand poised cleanly to the right of the roux squares (leaving all 4 squares & pot crystal clear!)
    const snap = Math.sin(state.rouxBreakAnim * Math.PI);
    hands.setRightTarget(
      new THREE.Vector3(
        trayPos.x + 0.13 + snap * 0.05,
        trayPos.y + 0.04 - snap * 0.02 + Math.max(0, idlePulse) * 0.015,
        trayPos.z + 0.14 - snap * 0.04
      ),
      new THREE.Euler(-0.28 - snap * 0.28, 0.62, 0.42, 'YXZ'),
      'pinchRoux'
    );
    state.rouxBreakAnim = Math.max(0, state.rouxBreakAnim - dt * 3.8);
  } else if (st === STAGES.LADLE_RICE) {
    // Both hands clearly frame the steaming rice plate and brimming ladle in the simmering pot!
    const pl = plate.group.position;
    hands.setLeftTarget(
      new THREE.Vector3(pl.x - 0.19, 0.085, pl.z + 0.15),
      new THREE.Euler(-0.18, -0.58, -0.22, 'YXZ'),
      'openSupport'
    );

    const potLadlePos = new THREE.Vector3(px + 0.08, py + 0.24, pz + 0.22);
    const plateLadlePos = new THREE.Vector3(pl.x + 0.08, 0.255, pl.z + 0.20);

    if (state.ladlePhase === 'pot') {
      hands.setRightTarget(
        new THREE.Vector3(potLadlePos.x - Math.max(0, idlePulse) * 0.03, potLadlePos.y + Math.max(0, idlePulse) * 0.02, potLadlePos.z),
        new THREE.Euler(-0.56, 0.48, 0.42, 'YXZ'),
        'gripTool'
      );
      fluid.setDripRibbon(false);
    } else if (state.ladlePhase === 'carrying') {
      state.ladleCarryT = Math.min(1, state.ladleCarryT + dt * 1.65);
      const t = state.ladleCarryT;
      const pos = potLadlePos.clone().lerp(plateLadlePos, t);
      pos.y += Math.sin(t * Math.PI) * 0.075;
      hands.setRightTarget(pos, new THREE.Euler(-0.50, 0.50, 0.38, 'YXZ'), 'gripTool');
      const bowlWorld = new THREE.Vector3();
      hands.tools.ladle.userData.bowlGroup.getWorldPosition(bowlWorld);
      if (t < 0.35) {
        fluid.setDripRibbon(true, bowlWorld, new THREE.Vector3(bowlWorld.x, fluid.getSurfaceWorldY(), bowlWorld.z), 0.75 * (1 - t * 2.5));
      } else {
        fluid.setDripRibbon(false);
      }
      if (t >= 1) {
        state.ladlePhase = 'pouring';
        state.ladlePourAnim = 0;
        audio.playCurryPour();
        plate.addLadle();
      }
    } else if (state.ladlePhase === 'pouring') {
      state.ladlePourAnim = Math.min(1, state.ladlePourAnim + dt * 1.45);
      const tilt = Math.sin(state.ladlePourAnim * Math.PI);
      hands.setRightTarget(
        new THREE.Vector3(plateLadlePos.x, plateLadlePos.y - 0.02, plateLadlePos.z),
        new THREE.Euler(-0.52, 0.52, 0.38 + tilt * 1.15, 'YXZ'),
        'gripTool'
      );
      const bowlWorld = new THREE.Vector3();
      hands.tools.ladle.userData.bowlGroup.getWorldPosition(bowlWorld);
      const pourEnd = new THREE.Vector3(pl.x - 0.04, 0.025, pl.z);
      fluid.setDripRibbon(tilt > 0.15, bowlWorld, pourEnd, 0.65 + tilt * 0.95);
      if (state.ladlePourAnim > 0.55) {
        hands.setLadleFilled(false);
      }
      if (state.ladlePourAnim >= 1) {
        fluid.setDripRibbon(false);
        if (plate.ladleCount >= 3) {
          enterStage(STAGES.EAT_AND_PLAY);
        } else {
          state.ladlePhase = 'returning';
          state.ladleCarryT = 1;
        }
      }
    } else if (state.ladlePhase === 'returning') {
      state.ladleCarryT = Math.max(0, state.ladleCarryT - dt * 2.1);
      const pos = potLadlePos.clone().lerp(plateLadlePos, state.ladleCarryT);
      pos.y += Math.sin(state.ladleCarryT * Math.PI) * 0.05;
      hands.setRightTarget(pos, new THREE.Euler(-0.56, 0.48, 0.42, 'YXZ'), 'gripTool');
      if (state.ladleCarryT <= 0) {
        state.ladlePhase = 'pot';
        hands.setLadleFilled(true, true);
      }
    }
  } else if (st === STAGES.EAT_AND_PLAY) {
    // Left hand rests gracefully on the OUTER porcelain rim (cleanly clear of curry!)
    const pl = plate.group.position;
    hands.setLeftTarget(
      new THREE.Vector3(pl.x - 0.275, 0.074, pl.z + 0.11),
      new THREE.Euler(-0.18, -0.68, -0.25, 'YXZ'),
      'openSupport'
    );
    // Right hand holds gleaming silver curry spoon cleanly from lower-right so entire plate shines!
    if (state.eatAnim > 0) {
      state.eatAnim = Math.max(0, state.eatAnim - dt * 0.92);
      const p = 1 - state.eatAnim;
      const dip = p < 0.35 ? Math.sin((p / 0.35) * Math.PI * 0.5) : 1;
      const lift = p > 0.35 ? Math.sin(((p - 0.35) / 0.65) * Math.PI) : 0;
      const sx = THREE.MathUtils.lerp(pl.x + 0.17, pl.x + 0.06, dip);
      const sy = 0.11 - dip * 0.025 + lift * 0.18;
      const sz = pl.z + 0.19 + lift * 0.14;
      hands.setRightTarget(
        new THREE.Vector3(sx, sy, sz),
        new THREE.Euler(-0.28 + lift * 0.35, 0.62, 0.58, 'YXZ'),
        'gripTool'
      );
      if (p > 0.85) hands.setSpoonBite(false);
    } else {
      hands.setRightTarget(
        new THREE.Vector3(pl.x + 0.18, 0.115 - Math.max(0, idlePulse) * 0.012, pl.z + 0.195),
        new THREE.Euler(-0.30, 0.64, 0.55, 'YXZ'),
        'gripTool'
      );
    }
  }
}

// =========================================================================
// MAIN ANIMATION LOOP
// =========================================================================
const clock = new THREE.Clock();
enterStage(STAGES.PEEL_CARROT, true);
hands.update(0.016, true);

function updateBoardDebrisAndSegments(dt) {
  const boardTopY = 0.032;

  // Curled peel ribbons falling onto wooden cutting board
  for (const veggie of [carrot, potato]) {
    for (const r of veggie.ribbons) {
      if (r.settled) continue;
      r.vel.y -= 1.6 * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      r.mesh.rotation.x += r.rotVel.x * dt;
      r.mesh.rotation.y += r.rotVel.y * dt;
      r.mesh.rotation.z += r.rotVel.z * dt;
      if (r.mesh.position.y <= boardTopY) {
        r.mesh.position.y = boardTopY;
        r.settled = true;
        audio.playPeelDrop();
      }
    }
    // Cut chunky slices tumbling onto board
    for (const seg of veggie.segments) {
      if (!seg.userData.cut) continue;
      const v = seg.userData.vel;
      if (v.lengthSq() > 0.0001 || seg.position.y > -0.018) {
        v.y -= 1.7 * dt;
        seg.position.addScaledVector(v, dt);
        seg.rotation.x += seg.userData.rotVel.x * dt;
        seg.rotation.y += seg.userData.rotVel.y * dt;
        seg.rotation.z += seg.userData.rotVel.z * dt;
        if (seg.position.y <= -0.018) {
          seg.position.y = -0.018;
          v.y *= -0.18;
          v.x *= 0.65;
          v.z *= 0.65;
          seg.userData.rotVel.multiplyScalar(0.55);
        }
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  state.stageTime += dt;
  state.idleTime += dt;

  // Smooth camera glide
  camera.position.lerp(camTargetPos, Math.min(1, dt * 4.2));
  camCurrentLook.lerp(camTargetLook, Math.min(1, dt * 5.0));
  camera.lookAt(camCurrentLook);

  // Subtle playful secondary prop wobbles
  state.boardBump *= Math.exp(-dt * 10);
  state.potBump *= Math.exp(-dt * 10);
  state.plateBump *= Math.exp(-dt * 10);
  state.basketBump *= Math.exp(-dt * 10);
  kitchen.boardGroup.position.y = state.boardBump * 0.005;
  kitchen.potGroup.position.y = kitchen.potCenter.y + state.potBump * 0.005;
  plate.group.position.y = state.plateBump * 0.005;
  kitchen.basketGroup.position.y = state.basketBump * 0.008;

  // Stove & fluid parameters derived cleanly from culinary stage
  const stoveOn = state.stage >= STAGES.SAUTE && state.stage <= STAGES.LADLE_RICE;
  const sizzleAmt = state.stage === STAGES.SAUTE ? 0.95 : state.stage === STAGES.POUR_WATER ? Math.max(0, 0.8 - state.waterLevel) : 0;
  const simmerAmt =
    state.stage === STAGES.SIMMER
      ? 0.55 + state.simmerProgress * 0.45
      : state.stage === STAGES.BREAK_ROUX || state.stage === STAGES.MELT_ROUX
      ? 0.95
      : state.stage === STAGES.LADLE_RICE
      ? 0.68
      : state.stage === STAGES.EAT_AND_PLAY
      ? 0.25
      : 0;

  // Viscosity smoothly rises as roux melts!
  const targetVisc =
    state.stage >= STAGES.LADLE_RICE
      ? 1.0
      : state.stage === STAGES.MELT_ROUX
      ? state.rouxMeltProgress
      : state.stage === STAGES.BREAK_ROUX
      ? state.rouxMeltProgress * 0.4
      : 0;
  state.viscosity += (targetVisc - state.viscosity) * Math.min(1, dt * 3.5);

  const steamAmt =
    state.stage === STAGES.SAUTE
      ? 0.42
      : state.stage === STAGES.POUR_WATER
      ? 0.85
      : state.stage >= STAGES.SIMMER && state.stage <= STAGES.LADLE_RICE
      ? 1.05
      : state.stage === STAGES.EAT_AND_PLAY
      ? 0.45
      : 0;

  // Update environment, hands, fluid, food & audio
  kitchen.update(dt, time, stoveOn);
  updateBoardDebrisAndSegments(dt);
  updateHandsAndTools(dt, time);
  hands.update(dt, false);

  fluid.update(dt, {
    level: state.waterLevel,
    simmer: simmerAmt,
    viscosity: state.viscosity,
    rouxMelt: state.rouxMeltProgress,
    stirInput: state.stirSpeed,
    stirLocal: state.stirLocal,
    steam: steamAmt,
  });

  if (potIngredients.group.visible) {
    potIngredients.applyStir(dt, state.stirSpeed, state.stirLocal, state.waterLevel);
    potIngredients.updateAppearance(state.stage >= STAGES.POUR_WATER ? 1.0 : state.sauteProgress, state.viscosity);
  }

  roux.update(dt, fluid.surfaceMesh.position.y, state.stirSpeed, state.stage === STAGES.MELT_ROUX ? 0.35 + state.stirSpeed * 1.4 : 0.05);
  plate.update(dt, plate.group.visible);

  audio.update(dt, {
    sizzle: sizzleAmt,
    simmer: simmerAmt,
    viscosity: state.viscosity,
    stirSpeed: state.stirSpeed,
  });

  state.stirSpeed *= Math.exp(-dt * 4.2);

  renderer.render(scene, camera);
}

animate();

// Expose clean diagnostic handle for automated screenshot verification across every stage (no UI clutter!)
window.__GAME__ = {
  STAGES,
  state,
  enterStage: (s) => {
    enterStage(s, true);
    if (s >= STAGES.SAUTE) {
      potIngredients.settleInPot(state.waterLevel);
      potIngredients.updateAppearance(s >= STAGES.POUR_WATER ? 1 : 0.65, s >= STAGES.LADLE_RICE ? 1 : s === STAGES.MELT_ROUX ? 0.52 : 0);
    }
    if (s === STAGES.MELT_ROUX) {
      roux.blocks.forEach((b) => {
        b.state = 'melting';
        b.trayMesh.visible = false;
        b.floatMesh.visible = true;
        b.melt = 0.32;
      });
      state.rouxMeltProgress = 0.52;
      state.viscosity = 0.56;
      state.stirSpeed = 0.9;
    }
    if (s === STAGES.LADLE_RICE) {
      plate.reset();
      plate.addLadle();
      plate.addLadle();
      plate.fillLevel = 0.72;
    }
    if (s === STAGES.EAT_AND_PLAY) {
      plate.reset();
      plate.addLadle();
      plate.addLadle();
      plate.addLadle();
      plate.fillLevel = 1.0;
    }
    // Step simulation briefly so simmering bubbles, steam wisps, and melted roux are alive!
    for (let i = 0; i < 12; i++) {
      updateHandsAndTools(0.05, 1.5 + i * 0.05);
      hands.update(0.05, true);
      fluid.update(0.05, {
        level: state.waterLevel,
        simmer: s >= STAGES.SIMMER ? 0.95 : 0,
        viscosity: state.viscosity,
        rouxMelt: state.rouxMeltProgress,
        stirInput: s === STAGES.MELT_ROUX ? 0.8 : 0.25,
        steam: s >= STAGES.SAUTE ? 1.0 : 0,
      });
      roux.update(0.05, fluid.surfaceMesh.position.y, 0.5, 0.0);
      plate.update(0.05, plate.group.visible);
    }
    kitchen.update(0.05, 2.0, s >= STAGES.SAUTE && s <= STAGES.LADLE_RICE);
    renderer.render(scene, camera);
  },
  getStats: () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    pixelRatio: renderer.getPixelRatio(),
    stage: state.stage,
  }),
};
