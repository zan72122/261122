import * as THREE from '../vendor/three.module.js';
import { createStudio } from './studio.js';
import { createCustardTextures, createMixingLiquidCanvas } from './textures.js';
import { PuddingSoftBody, SlowMoDirector } from './softbody.js';
import { StudioAudio } from './audio.js';
import {
  createGlassMixingBowl,
  createFarmEggSet,
  createMilkCarafe,
  createBalloonWhisk,
  createPuddingCupAndSteamer,
  createPorcelainPlate,
  createHeroPudding,
  createCaramelPitcher,
  createSilverSpoon,
  createStudioHand,
  createVaporSystem,
} from './models.js';

const canvas = document.getElementById('stage');
const studio = createStudio(canvas);
const { renderer, scene, camera, rimLight, steamGlowLight, chillLight, createContactShadow } = studio;

const audio = new StudioAudio();
const softBody = new PuddingSoftBody();
const slowMo = new SlowMoDirector();

// Shared procedural textures
const mixingCanvas = createMixingLiquidCanvas();
let custardTextures = createCustardTextures(0.55);

// === BUILD ALL PHOTOREALISTIC 3D PROPS ===
const bowl = createGlassMixingBowl(mixingCanvas.texture);
bowl.group.position.set(-0.08, 0, 0.12);
scene.add(bowl.group);
const bowlShadow = createContactShadow(1.38, 0.85);
bowlShadow.position.set(-0.08, 0.004, 0.12);
scene.add(bowlShadow);

const eggs = createFarmEggSet();
eggs.egg1.root.position.set(-1.38, 0.36, 0.38);
eggs.egg1.root.rotation.set(0.18, 0.3, -0.35);
scene.add(eggs.egg1.root);
const egg1Shadow = createContactShadow(0.36, 0.72);
egg1Shadow.position.set(-1.38, 0.004, 0.38);
scene.add(egg1Shadow);

eggs.egg2.root.position.set(-1.82, 0.36, -0.22);
eggs.egg2.root.rotation.set(-0.15, 0.8, 0.25);
scene.add(eggs.egg2.root);
const egg2Shadow = createContactShadow(0.36, 0.65);
egg2Shadow.position.set(-1.82, 0.004, -0.22);
scene.add(egg2Shadow);

scene.add(eggs.fallingYolkGroup);

const milk = createMilkCarafe();
milk.group.position.set(1.56, 0, 0.06);
scene.add(milk.group);
const milkShadow = createContactShadow(0.68, 0.76);
milkShadow.position.set(1.56, 0.004, 0.06);
scene.add(milkShadow);
scene.add(milk.streamMesh);

const whisk = createBalloonWhisk();
whisk.visible = false;
scene.add(whisk);

// Custard pour stream (Stage 3A: bowl -> cup)
const custardStreamCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(-0.62, 1.52, 0.08),
  new THREE.Vector3(-0.14, 1.38, 0.08),
  new THREE.Vector3(0.18, 0.45, 0.08)
);
const custardStream = new THREE.Mesh(
  new THREE.TubeGeometry(custardStreamCurve, 24, 0.048, 14, false),
  new THREE.MeshPhysicalMaterial({
    color: 0xf7d67e,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  })
);
custardStream.visible = false;
scene.add(custardStream);

const cupSet = createPuddingCupAndSteamer(custardTextures);
cupSet.cupGroup.visible = false;
scene.add(cupSet.cupGroup);
scene.add(cupSet.steamerGroup);
scene.add(cupSet.iceBathGroup);
const cupShadow = createContactShadow(0.95, 0.82);
cupShadow.visible = false;
scene.add(cupShadow);

const plate = createPorcelainPlate();
plate.visible = false;
scene.add(plate);
const plateShadow = createContactShadow(1.68, 0.88);
plateShadow.visible = false;
scene.add(plateShadow);

const heroPudding = createHeroPudding(custardTextures, softBody.uniforms);
heroPudding.group.visible = false;
heroPudding.group.position.set(0, 0.078, 0);
scene.add(heroPudding.group);

const caramelPitcher = createCaramelPitcher();
caramelPitcher.group.visible = false;
scene.add(caramelPitcher.group);
scene.add(caramelPitcher.ribbonMesh);

const spoon = createSilverSpoon(custardTextures);
spoon.group.visible = false;
scene.add(spoon.group);

// Fresh replay egg resting gently on far-left slate during Stage 6 (wordless restart!)
const replayEgg = createFarmEggSet().egg1.root;
replayEgg.visible = false;
replayEgg.position.set(-2.12, 0.34, 0.48);
replayEgg.rotation.set(0.22, 0.4, -0.35);
scene.add(replayEgg);
const replayEggShadow = createContactShadow(0.34, 0.65);
replayEggShadow.position.set(-2.12, 0.004, 0.48);
replayEggShadow.visible = false;
scene.add(replayEggShadow);

// Sculpted photorealistic studio hand (active cooking companion + 9.5s single idle demo)
const hand = createStudioHand();
hand.root.visible = false;
scene.add(hand.root);

// Volumetric-feel steam / sinking cold mist particle system
const vapor = createVaporSystem(40);
scene.add(vapor.group);

// === GAME STATE MACHINE ===
const STAGES = {
  EGG_MILK: 'EGG_MILK',
  WHISK: 'WHISK',
  POUR_CUP: 'POUR_CUP',
  STEAM: 'STEAM',
  CHILL: 'CHILL',
  FLIP_CUP: 'FLIP_CUP',
  LIFT_CUP: 'LIFT_CUP',
  CARAMEL_PLAY: 'CARAMEL_PLAY',
};

const state = {
  stage: STAGES.EGG_MILK,
  stageTime: 0,
  elapsed: 0,
  idleTime: 0,
  idleDemoShown: false,
  idleDemoProgress: -1,

  // Cooking variables (choices persist visually into the finished pudding!)
  eggCount: 0, // 1 or 2 eggs!
  egg1Cracked: false,
  egg2Cracked: false,
  activeCrack: null, // { eggObj, t, slot }
  milkAmount: 0, // 0..1
  pouringMilk: false,

  // Whisking
  mixProgress: 0,
  swirlAngle: 0,
  whiskPos: new THREE.Vector2(0, 0),
  whiskTarget: new THREE.Vector2(0, 0),
  whiskDragging: false,

  // Pour into cup
  cupFill: 0,
  pouringCustard: false,

  // Steam
  steamProgress: 0,
  steamingActive: false,
  domeOpenT: 0,

  // Chill
  chillProgress: 0,
  iceDropped: 0,

  // Flip & Lift Unmold
  flipT: 0,
  flipping: false,
  liftProgress: 0,
  lifting: false,
  unmolded: false,
  unmoldAnimT: 0,

  // Caramel & Tactile Play
  caramelFlow: 0, // 0..1 (and can pour extra!)
  caramelExtraPool: 0,
  pouringCaramel: false,
  spoonState: 'idle', // 'idle' | 'scooping' | 'holding' | 'returning'
  spoonT: 0,
  scoopCount: 0,

  // Pointer tracking (1-finger strict)
  activePointerId: null,
  pointerDown: false,
  pointerNdc: new THREE.Vector2(),
  prevPointerNdc: new THREE.Vector2(),
  dragTarget: null, // 'milk' | 'whisk' | 'bowl_pour' | 'steam' | 'chill' | 'lift' | 'caramel' | 'pudding'
};

// Smooth camera rig targets
const camPosTarget = new THREE.Vector3(0, 2.55, 5.15);
const camLookTarget = new THREE.Vector3(0, 0.62, 0);
const camLookCurrent = new THREE.Vector3(0, 0.62, 0);

function updateRichnessMaterials() {
  const richness = state.eggCount >= 2 ? 0.92 : 0.42;
  custardTextures = createCustardTextures(richness);
  heroPudding.puddingMat.map = custardTextures.map;
  heroPudding.puddingMat.roughnessMap = custardTextures.roughnessMap;
  heroPudding.puddingMat.bumpMap = custardTextures.bumpMap;
  heroPudding.puddingMat.needsUpdate = true;

  cupSet.fillMat.map = custardTextures.map;
  cupSet.fillMat.roughnessMap = custardTextures.roughnessMap;
  cupSet.fillMat.needsUpdate = true;

  // 2-egg custard is firmer & richer amber; 1-egg is silkier & wobblier!
  softBody.setFirmness(state.eggCount >= 2 ? 1.15 : 0.86);
  const sss = heroPudding.puddingMat.userData.sssUniforms;
  if (sss) {
    sss.uSssColor.value.setHex(state.eggCount >= 2 ? 0xff9414 : 0xffb838);
  }
}

function enterStage(nextStage) {
  state.stage = nextStage;
  state.stageTime = 0;
  state.idleTime = 0;
  state.idleDemoShown = false;
  state.idleDemoProgress = -1;
  state.dragTarget = null;
  state.pouringMilk = false;
  state.pouringCustard = false;
  state.pouringCaramel = false;
  state.activeCrack = null;
  eggs.fallingYolkGroup.visible = false;
  vapor.clear();
  audio.setPourSound(false);
  audio.setSteamSound(0);

  // Reset stage-specific visibility cleanly
  const isMixingPhase = nextStage === STAGES.EGG_MILK || nextStage === STAGES.WHISK;
  bowl.group.visible = isMixingPhase || nextStage === STAGES.POUR_CUP;
  bowlShadow.visible = isMixingPhase;

  eggs.egg1.root.visible = nextStage === STAGES.EGG_MILK && !state.egg1Cracked;
  egg1Shadow.visible = eggs.egg1.root.visible;
  eggs.egg2.root.visible = nextStage === STAGES.EGG_MILK && !state.egg2Cracked;
  egg2Shadow.visible = eggs.egg2.root.visible;

  milk.group.visible = nextStage === STAGES.EGG_MILK;
  milkShadow.visible = nextStage === STAGES.EGG_MILK;
  milk.streamMesh.visible = false;

  whisk.visible = nextStage === STAGES.WHISK;
  custardStream.visible = false;

  const isCupPhase =
    nextStage === STAGES.POUR_CUP ||
    nextStage === STAGES.STEAM ||
    nextStage === STAGES.CHILL ||
    nextStage === STAGES.FLIP_CUP ||
    nextStage === STAGES.LIFT_CUP;
  cupSet.cupGroup.visible = isCupPhase;
  cupShadow.visible =
    nextStage === STAGES.POUR_CUP || nextStage === STAGES.STEAM || nextStage === STAGES.CHILL;

  cupSet.steamerGroup.visible = nextStage === STAGES.STEAM;
  cupSet.iceBathGroup.visible = nextStage === STAGES.CHILL;

  const isPlatePhase =
    nextStage === STAGES.FLIP_CUP ||
    nextStage === STAGES.LIFT_CUP ||
    nextStage === STAGES.CARAMEL_PLAY;
  plate.visible = isPlatePhase;
  plateShadow.visible = isPlatePhase;

  heroPudding.group.visible = nextStage === STAGES.CARAMEL_PLAY || (nextStage === STAGES.LIFT_CUP && state.unmolded);
  caramelPitcher.group.visible = nextStage === STAGES.CARAMEL_PLAY;
  caramelPitcher.ribbonMesh.visible = false;
  spoon.group.visible = nextStage === STAGES.CARAMEL_PLAY && state.caramelFlow > 0.22;
  replayEgg.visible = nextStage === STAGES.CARAMEL_PLAY;
  replayEggShadow.visible = nextStage === STAGES.CARAMEL_PLAY;

  // Stage setup positions
  if (nextStage === STAGES.EGG_MILK) {
    bowl.group.position.set(-0.08, 0, 0.12);
    bowl.group.rotation.set(0, 0, 0);
    milk.group.position.set(1.56, 0, 0.06);
    milk.group.rotation.set(0, 0, 0);
    camPosTarget.set(0.05, 2.58, 5.05);
    camLookTarget.set(0.0, 0.56, 0.05);
  } else if (nextStage === STAGES.WHISK) {
    bowl.group.position.set(0, 0, 0.1);
    bowl.group.rotation.set(0, 0, 0);
    bowlShadow.position.set(0, 0.004, 0.1);
    whisk.position.set(0, 0.28, 0.1);
    camPosTarget.set(0.0, 2.75, 4.35);
    camLookTarget.set(0, 0.72, 0.08);
    audio.playStageChime(1);
  } else if (nextStage === STAGES.POUR_CUP) {
    updateRichnessMaterials();
    bowl.group.position.set(-1.18, 1.48, 0.08);
    bowl.group.rotation.set(0, 0, -0.35);
    cupSet.cupGroup.position.set(0.28, 0, 0.08);
    cupSet.cupGroup.rotation.set(0, 0, 0);
    cupShadow.position.set(0.28, 0.004, 0.08);
    cupSet.fillMesh.visible = true;
    cupSet.fillMesh.scale.set(1, 0.005, 1);
    cupSet.baseCaramel.visible = true;
    cupSet.frostMat.opacity = 0;
    camPosTarget.set(-0.15, 2.25, 4.55);
    camLookTarget.set(-0.15, 0.82, 0.08);
    audio.playStageChime(2);
  } else if (nextStage === STAGES.STEAM) {
    cupSet.cupGroup.position.set(0, 0.16, 0);
    cupSet.cupGroup.rotation.set(0, 0, 0);
    cupSet.fillMesh.visible = true;
    cupSet.fillMesh.scale.set(1, 1, 1);
    cupSet.baseCaramel.visible = true;
    cupSet.domeGroup.position.set(0, 0, 0);
    cupSet.domeMat.opacity = 0.24;
    cupSet.glowRingMat.opacity = 0.25;
    cupShadow.position.set(0, 0.004, 0);
    camPosTarget.set(0, 2.15, 4.45);
    camLookTarget.set(0, 0.78, 0);
    audio.playStageChime(3);
  } else if (nextStage === STAGES.CHILL) {
    cupSet.cupGroup.position.set(0, 0.08, 0);
    cupSet.cupGroup.rotation.set(0, 0, 0);
    cupSet.fillMesh.visible = true;
    cupSet.fillMesh.scale.set(1, 1, 1);
    cupSet.baseCaramel.visible = true;
    cupSet.iceCubes.forEach((c) => {
      c.visible = false;
      c.userData.dropped = false;
      c.userData.dropT = 0;
    });
    state.iceDropped = 0;
    state.chillProgress = 0;
    camPosTarget.set(0, 2.35, 4.25);
    camLookTarget.set(0, 0.65, 0);
    audio.playStageChime(4);
  } else if (nextStage === STAGES.FLIP_CUP) {
    plate.position.set(0, 0, 0);
    plateShadow.position.set(0, 0.004, 0);
    cupSet.cupGroup.position.set(0, 1.52, 0);
    cupSet.cupGroup.rotation.set(0, 0, 0.28);
    cupSet.fillMesh.visible = true;
    cupSet.fillMesh.scale.set(1, 1, 1);
    cupSet.baseCaramel.visible = true;
    cupSet.frostMat.opacity = 0.42;
    state.flipT = 0;
    state.flipping = false;
    camPosTarget.set(0, 2.15, 4.45);
    camLookTarget.set(0, 0.85, 0);
    audio.playStageChime(5);
  } else if (nextStage === STAGES.LIFT_CUP) {
    plate.position.set(0, 0, 0);
    plateShadow.position.set(0, 0.004, 0);
    cupSet.cupGroup.position.set(0, 1.37, 0);
    cupSet.cupGroup.rotation.set(0, 0, Math.PI);
    cupSet.fillMesh.visible = true;
    cupSet.fillMesh.scale.set(1, 1, 1);
    cupSet.baseCaramel.visible = true;
    cupSet.frostMat.opacity = 0.36;
    state.liftProgress = 0;
    state.lifting = false;
    state.unmolded = false;
    state.unmoldAnimT = 0;
    camPosTarget.set(0, 1.62, 3.85);
    camLookTarget.set(0, 0.68, 0);
  } else if (nextStage === STAGES.CARAMEL_PLAY) {
    plate.position.set(0, 0, 0);
    plateShadow.position.set(0, 0.004, 0);
    heroPudding.group.visible = true;
    heroPudding.group.position.set(0, 0.078, 0);
    caramelPitcher.group.position.set(1.26, 1.32, 0.05);
    caramelPitcher.group.rotation.set(0, 0, 0.24);
    // Orient silver dessert spoon naturally: resting cleanly ON TOP of the right rim of the porcelain plate!
    spoon.group.position.set(1.54, 0.34, 0.86);
    spoon.group.rotation.set(0.06, 1.18, -0.14);
    spoon.biteGroup.visible = false;
    camPosTarget.set(0.14, 1.82, 4.35);
    camLookTarget.set(0.14, 0.88, 0);
  }
}

function resetGame() {
  state.eggCount = 0;
  state.egg1Cracked = false;
  state.egg2Cracked = false;
  state.activeCrack = null;
  state.milkAmount = 0;
  state.mixProgress = 0;
  state.swirlAngle = 0;
  state.cupFill = 0;
  state.steamProgress = 0;
  state.domeOpenT = 0;
  state.chillProgress = 0;
  state.iceDropped = 0;
  state.flipT = 0;
  state.flipping = false;
  state.liftProgress = 0;
  state.lifting = false;
  state.unmolded = false;
  state.caramelFlow = 0;
  state.caramelExtraPool = 0;
  state.spoonState = 'idle';
  state.spoonT = 0;
  state.scoopCount = 0;

  softBody.reset();
  heroPudding.setCaramelFlow(0);
  heroPudding.caramelPool.visible = false;
  heroPudding.caramelPool.scale.set(0.58, 1, 0.58);

  eggs.egg1.whole.visible = true;
  eggs.egg1.splitGroup.visible = false;
  eggs.egg1.root.position.set(-1.38, 0.36, 0.38);
  eggs.egg1.root.rotation.set(0.18, 0.3, -0.35);

  eggs.egg2.whole.visible = true;
  eggs.egg2.splitGroup.visible = false;
  eggs.egg2.root.position.set(-1.82, 0.36, -0.22);
  eggs.egg2.root.rotation.set(-0.15, 0.8, 0.25);

  bowl.yolks.forEach((y) => {
    y.group.visible = false;
    y.yolk.scale.set(1, 0.68, 1);
  });
  bowl.liqGroup.visible = false;
  milk.milkMesh.scale.set(1, 1, 1);
  mixingCanvas.redraw({ milkAmount: 0, eggCount: 0, mixProgress: 0, swirlAngle: 0 });
  enterStage(STAGES.EGG_MILK);
}

// === START CRACKING AN EGG (Slow-Motion Hero Shot #1!) ===
function startEggCrack(which) {
  if (state.activeCrack) return;
  const isFirst = which === 1;
  if (isFirst && state.egg1Cracked) return;
  if (!isFirst && state.egg2Cracked) return;

  if (isFirst) state.egg1Cracked = true;
  else state.egg2Cracked = true;

  const eggObj = isFirst ? eggs.egg1 : eggs.egg2;
  if (isFirst) egg1Shadow.visible = false;
  else egg2Shadow.visible = false;

  state.activeCrack = {
    eggObj,
    slot: state.eggCount,
    t: 0,
    crackedSoundPlayed: false,
    plopSoundPlayed: false,
    startPos: eggObj.root.position.clone(),
  };
  audio.unlock();
}

// === DROP ICE CUBES (Stage 4 Chilling) ===
function dropIceBatch(count = 3) {
  let droppedNow = 0;
  for (let i = 0; i < cupSet.iceCubes.length && droppedNow < count; i++) {
    const c = cupSet.iceCubes[i];
    if (!c.userData.dropped) {
      c.userData.dropped = true;
      c.userData.dropT = 0;
      c.visible = true;
      c.position.set(c.userData.targetPos.x * 1.15, 2.35 + droppedNow * 0.32, c.userData.targetPos.z * 1.15);
      c.rotation.copy(c.userData.rot);
      state.iceDropped++;
      droppedNow++;
    }
  }
  if (droppedNow > 0) {
    audio.playIceClink();
  }
}

// === TRIGGER DRAMATIC SLOW-MOTION UNMOLD ("ぷるんっ！") ===
function triggerSlowMoUnmold() {
  if (state.unmolded) return;
  state.unmolded = true;
  state.unmoldAnimT = 0;
  cupSet.fillMesh.visible = false;
  cupSet.baseCaramel.visible = false;
  cupSet.airBubble.visible = false;

  heroPudding.group.visible = true;
  heroPudding.group.position.set(0, 0.24, 0);
  heroPudding.setCaramelFlow(0.0);
  heroPudding.caramelPool.visible = true;
  heroPudding.caramelPool.scale.set(0.64, 1, 0.64);

  // Engage cinematic slow motion!
  slowMo.trigger(0.22, 1.45);
  softBody.impulseUnmold(1.15);
  audio.playPurunUnmold(0.22);
}

// === RAYCASTING & GENEROUS ONE-FINGER POINTER INPUT ===
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
const dragHitPoint = new THREE.Vector3();

function getPointerNdc(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
  };
}

function projectToScreenNdc(worldPos) {
  const v = worldPos.clone().project(camera);
  return new THREE.Vector2(v.x, v.y);
}

function onPointerDown(e) {
  if (state.activePointerId !== null) return; // Strict one-finger immunity against accidental multi-touch!
  state.activePointerId = e.pointerId;
  state.pointerDown = true;
  state.idleTime = 0;
  state.idleDemoProgress = -1;
  audio.unlock();

  const ndc = getPointerNdc(e);
  state.pointerNdc.set(ndc.x, ndc.y);
  state.prevPointerNdc.set(ndc.x, ndc.y);
  raycaster.setFromCamera(state.pointerNdc, camera);

  // === STAGE-SPECIFIC GENEROUS INTERACTION MAPPING ===
  if (state.stage === STAGES.EGG_MILK) {
    const egg1Screen = projectToScreenNdc(eggs.egg1.root.position);
    const egg2Screen = projectToScreenNdc(eggs.egg2.root.position);
    const milkScreen = projectToScreenNdc(milk.group.position.clone().add(new THREE.Vector3(0, 0.65, 0)));

    const dEgg1 = !state.egg1Cracked ? state.pointerNdc.distanceTo(egg1Screen) : 99;
    const dEgg2 = !state.egg2Cracked ? state.pointerNdc.distanceTo(egg2Screen) : 99;
    const dMilk = state.milkAmount < 0.98 ? state.pointerNdc.distanceTo(milkScreen) : 99;

    // Generous hitbox check — only active stage props respond prominently
    if (dEgg1 < 0.48 && dEgg1 <= dMilk && dEgg1 <= dEgg2) {
      startEggCrack(1);
    } else if (dEgg2 < 0.46 && dEgg2 <= dMilk) {
      startEggCrack(2);
    } else if (dMilk < 0.58) {
      state.dragTarget = 'milk';
      state.pouringMilk = true;
    } else {
      // Gentle tactile wiggle if she taps the glass bowl directly
      bowl.group.rotation.z = 0.04;
      audio.playPorcelainClink();
    }
  } else if (state.stage === STAGES.WHISK) {
    state.dragTarget = 'whisk';
    state.whiskDragging = true;
    // Allow immediate tap impulse too so even tapping stirs slightly!
    state.mixProgress = Math.min(1, state.mixProgress + 0.045);
    state.swirlAngle += 0.35;
    audio.playWhiskSwish(1.1);
  } else if (state.stage === STAGES.POUR_CUP) {
    state.dragTarget = 'bowl_pour';
    state.pouringCustard = true;
  } else if (state.stage === STAGES.STEAM) {
    state.dragTarget = 'steam';
    state.steamingActive = true;
    // Give tactile boost on tap
    state.steamProgress = Math.min(1, state.steamProgress + 0.14);
  } else if (state.stage === STAGES.CHILL) {
    state.dragTarget = 'chill';
    dropIceBatch(3);
  } else if (state.stage === STAGES.FLIP_CUP) {
    if (!state.flipping) {
      state.flipping = true;
      state.flipT = 0;
    }
  } else if (state.stage === STAGES.LIFT_CUP) {
    if (!state.unmolded) {
      state.dragTarget = 'lift';
      state.lifting = true;
      // Generous lift boost even on simple taps so a 5yo never gets stuck!
      state.liftProgress = Math.min(1, state.liftProgress + 0.36);
      if (state.liftProgress >= 0.92) {
        triggerSlowMoUnmold();
      }
    }
  } else if (state.stage === STAGES.CARAMEL_PLAY) {
    const pitcherScreen = projectToScreenNdc(caramelPitcher.group.position.clone().add(new THREE.Vector3(0, 0.35, 0)));
    const spoonScreen = projectToScreenNdc(spoon.group.position);
    const replayScreen = projectToScreenNdc(replayEgg.position);
    const puddingHits = raycaster.intersectObjects([heroPudding.puddingMesh, heroPudding.caramelCapMesh], false);

    const dPitcher = state.pointerNdc.distanceTo(pitcherScreen);
    const dSpoon = spoon.group.visible ? state.pointerNdc.distanceTo(spoonScreen) : 99;
    const dReplay = state.pointerNdc.distanceTo(replayScreen);

    if (dPitcher < 0.44) {
      state.dragTarget = 'caramel';
      state.pouringCaramel = true;
      slowMo.trigger(0.36, 0.75);
    } else if (dSpoon < 0.36 && state.spoonState === 'idle') {
      state.spoonState = 'scooping';
      state.spoonT = 0;
      audio.playSpoonScoop();
    } else if (dReplay < 0.28) {
      audio.playEggCrack(1.0);
      resetGame();
    } else if (puddingHits.length > 0 || state.pointerNdc.length() < 0.56) {
      state.dragTarget = 'pudding';
      const hitLocal =
        puddingHits.length > 0
          ? heroPudding.group.worldToLocal(puddingHits[0].point.clone())
          : new THREE.Vector3(state.pointerNdc.x * 0.5, 0.72, 0.55);
      softBody.impulsePoke(hitLocal, state.pointerNdc.x * 0.6, -0.5, 1.0);
      audio.playPuddingWobble(0.95);
    }
  }
}

function onPointerMove(e) {
  if (e.pointerId !== state.activePointerId || !state.pointerDown) return;
  state.idleTime = 0;

  const ndc = getPointerNdc(e);
  const dx = ndc.x - state.pointerNdc.x;
  const dy = ndc.y - state.pointerNdc.y;
  state.prevPointerNdc.copy(state.pointerNdc);
  state.pointerNdc.set(ndc.x, ndc.y);

  if (state.dragTarget === 'whisk' && state.stage === STAGES.WHISK) {
    raycaster.setFromCamera(state.pointerNdc, camera);
    if (raycaster.ray.intersectPlane(groundPlane, dragHitPoint)) {
      const clamped = new THREE.Vector2(dragHitPoint.x, dragHitPoint.z - 0.1);
      if (clamped.length() > 0.74) clamped.setLength(0.74);
      state.whiskTarget.copy(clamped);
    }
    const speed = Math.hypot(dx, dy) * 28;
    if (speed > 0.08) {
      state.mixProgress = Math.min(1, state.mixProgress + speed * 0.022);
      state.swirlAngle += (dx * 3.8 + Math.hypot(dx, dy) * 2.2);
      audio.playWhiskSwish(speed * 0.45);
    }
  } else if (state.dragTarget === 'lift' && state.stage === STAGES.LIFT_CUP && !state.unmolded) {
    if (dy > 0.004) {
      state.liftProgress = Math.min(1, state.liftProgress + dy * 1.65);
      if (state.liftProgress >= 0.92) {
        triggerSlowMoUnmold();
      }
    }
  } else if (state.dragTarget === 'steam' && state.stage === STAGES.STEAM) {
    state.steamProgress = Math.min(1, state.steamProgress + Math.hypot(dx, dy) * 0.65);
  } else if (state.dragTarget === 'chill' && state.stage === STAGES.CHILL) {
    if (Math.hypot(dx, dy) > 0.06) {
      dropIceBatch(1);
    }
  } else if (state.dragTarget === 'pudding' && state.stage === STAGES.CARAMEL_PLAY) {
    softBody.applyDrag(dx * 1.45, -dy * 1.25);
    if (Math.hypot(dx, dy) > 0.035) {
      audio.playPuddingWobble(Math.min(1.1, Math.hypot(dx, dy) * 12));
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== state.activePointerId) return;
  state.activePointerId = null;
  state.pointerDown = false;
  state.pouringMilk = false;
  state.whiskDragging = false;
  state.pouringCustard = false;
  state.steamingActive = false;
  state.lifting = false;
  state.pouringCaramel = false;
  state.dragTarget = null;
  audio.setPourSound(false);
}

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// === UPDATE LOOP ===
let lastTime = performance.now();
let fpsSamples = [];

function updateHandAndIdle(rawDt) {
  // Active hand accompanies key cooking actions; otherwise shows ONCE after 9.5s idle!
  let handActive = false;

  if (state.activeCrack) {
    // Hand holds the egg gently while cracking & splitting shells!
    const { eggObj, t } = state.activeCrack;
    handActive = true;
    hand.root.position.copy(eggObj.root.position).add(new THREE.Vector3(0.45, 0.25, 0.55));
    hand.root.rotation.set(-0.35, 0.55, 0.18);
    hand.setPose('pinch', t < 0.45 ? 1.0 : 0.4);
  } else if (state.pouringMilk) {
    handActive = true;
    hand.root.position.copy(milk.group.position).add(new THREE.Vector3(0.58, 0.72, 0.42));
    hand.root.rotation.set(-0.22, 0.65, 0.45);
    hand.setPose('grip', 1.0);
  } else if (state.stage === STAGES.WHISK && (state.whiskDragging || state.stageTime < 1.2)) {
    handActive = true;
    hand.root.position.copy(whisk.position).add(new THREE.Vector3(0.32, 1.55, 0.48));
    hand.root.rotation.set(-0.62, 0.35, -0.12);
    hand.setPose('grip', 1.0);
  } else if (state.pouringCaramel) {
    // Hand grips the copper handle on the right side of the caramel pitcher (never blocks the pour!)
    handActive = true;
    hand.root.position.copy(caramelPitcher.group.position).add(new THREE.Vector3(0.88, 0.22, 0.36));
    hand.root.rotation.set(-0.12, 1.18, 0.32);
    hand.setPose('grip', 1.0);
  }

  // Idle demonstration: 0-9.5s do NOTHING; at 9.5s gently demonstrate ONCE, then retreat!
  if (!handActive && !state.pointerDown) {
    state.idleTime += rawDt;
    if (state.idleTime > 9.5 && !state.idleDemoShown) {
      state.idleDemoShown = true;
      state.idleDemoProgress = 0;
    }
  }

  if (state.idleDemoProgress >= 0) {
    state.idleDemoProgress += rawDt * 0.42;
    if (state.idleDemoProgress >= 1.0) {
      state.idleDemoProgress = -1;
    } else {
      handActive = true;
      const p = state.idleDemoProgress;
      const pulse = Math.sin(p * Math.PI);
      hand.setPose('point', 1.0);
      hand.root.rotation.set(-0.48, 0.25, 0.08);

      if (state.stage === STAGES.EGG_MILK) {
        const target = !state.egg1Cracked ? eggs.egg1.root.position : milk.group.position;
        hand.root.position.set(target.x + 0.35, target.y + 0.85 - pulse * 0.25, target.z + 0.68);
      } else if (state.stage === STAGES.WHISK) {
        const a = p * Math.PI * 3;
        hand.root.position.set(Math.cos(a) * 0.45 + 0.32, 1.75, Math.sin(a) * 0.45 + 0.55);
      } else if (state.stage === STAGES.POUR_CUP) {
        hand.root.position.set(-0.85, 1.85 - pulse * 0.22, 0.65);
      } else if (state.stage === STAGES.STEAM) {
        hand.root.position.set(0.35, 1.95 - pulse * 0.25, 0.68);
      } else if (state.stage === STAGES.CHILL) {
        hand.root.position.set(0.85, 1.35 - pulse * 0.32, 0.65);
      } else if (state.stage === STAGES.FLIP_CUP) {
        hand.root.position.set(0.38, 1.95 - pulse * 0.45, 0.68);
      } else if (state.stage === STAGES.LIFT_CUP) {
        hand.root.position.set(0.38, 1.15 + pulse * 0.65, 0.68);
      } else if (state.stage === STAGES.CARAMEL_PLAY) {
        hand.root.position.set(1.32, 1.92 - pulse * 0.22, 0.62);
      }
    }
  }

  hand.root.visible = handActive;
}

function updateStageLogic(dt, rawDt, timeScale) {
  state.stageTime += dt;

  // Smooth spring recovery for gentle bowl wiggle
  bowl.group.rotation.z *= Math.exp(-rawDt * 8);

  // === STAGE 1: EGG & MILK ===
  if (state.stage === STAGES.EGG_MILK) {
    // Subtle organic idle invitation on uncracked egg1
    if (!state.egg1Cracked && !state.activeCrack) {
      eggs.egg1.root.rotation.z = -0.35 + Math.sin(state.elapsed * 2.2) * 0.045;
    }

    // Active slow-mo egg crack animation
    if (state.activeCrack) {
      const ac = state.activeCrack;
      ac.t += dt * 1.18;

      if (ac.t < 0.28) {
        // Lift egg cleanly to rim of glass mixing bowl
        const k = ac.t / 0.28;
        const ease = k * k * (3 - 2 * k);
        ac.eggObj.root.position.lerpVectors(ac.startPos, new THREE.Vector3(-0.98, 1.24, 0.14), ease);
        ac.eggObj.root.rotation.set(0, 0, THREE.MathUtils.lerp(-0.35, 0.25, ease));
      } else if (ac.t < 0.44) {
        // Crisp tap on glass rim + move over center of bowl
        if (!ac.crackedSoundPlayed) {
          ac.crackedSoundPlayed = true;
          audio.playEggCrack(0.32);
          slowMo.trigger(0.28, 0.72); // SLOW MOTION EGG CRACK!
          bowl.group.rotation.z = -0.045;
        }
        const k = (ac.t - 0.28) / 0.16;
        ac.eggObj.root.position.lerpVectors(new THREE.Vector3(-0.98, 1.24, 0.14), new THREE.Vector3(ac.slot === 0 ? -0.14 : 0.18, 1.62, 0.12), k);
        ac.eggObj.root.rotation.set(0, 0, Math.PI * 0.5);
      } else if (ac.t < 1.15) {
        // Split halves apart & drop glossy translucent egg yolk in slow motion!
        const k = (ac.t - 0.44) / 0.71;
        ac.eggObj.whole.visible = false;
        ac.eggObj.splitGroup.visible = true;
        ac.eggObj.leftHalf.position.y = -0.06 - k * 0.42;
        ac.eggObj.rightHalf.position.y = 0.06 + k * 0.42;
        ac.eggObj.leftHalf.rotation.z = -k * 0.85;
        ac.eggObj.rightHalf.rotation.z = k * 0.85;

        // Falling translucent yolk stretches realistically!
        const fallK = Math.min(1, k * 1.35);
        eggs.fallingYolkGroup.visible = fallK < 0.98;
        const yYolk = THREE.MathUtils.lerp(1.48, 0.22 + state.milkAmount * 0.34, fallK * fallK);
        eggs.fallingYolkGroup.position.set(ac.eggObj.root.position.x, yYolk, 0.12);
        eggs.fYolk.scale.set(1 - fallK * 0.14, 1 + fallK * 0.32, 1 - fallK * 0.14);
        eggs.fTail.scale.set(1, 0.5 + fallK * 1.2, 1);

        if (fallK >= 0.96 && !ac.plopSoundPlayed) {
          ac.plopSoundPlayed = true;
          eggs.fallingYolkGroup.visible = false;
          state.eggCount++;
          audio.playYolkPlop(timeScale);
          bowl.liqGroup.visible = true;
          const yObj = bowl.yolks[ac.slot];
          yObj.group.visible = true;
          yObj.group.position.set(ac.slot === 0 ? -0.22 : 0.26, 0.08, ac.slot === 0 ? 0.06 : -0.12);
          yObj.yolk.scale.set(1.28, 0.45, 1.28); // squash on plop!
          mixingCanvas.redraw({
            milkAmount: state.milkAmount,
            eggCount: state.eggCount,
            mixProgress: 0,
            swirlAngle: 0,
            richness: state.eggCount >= 2 ? 0.92 : 0.45,
          });
        }
      } else {
        // Shells glide away cleanly
        ac.eggObj.root.visible = false;
        eggs.fallingYolkGroup.visible = false;
        state.activeCrack = null;
      }
    }

    // Spring-rebound yolks in bowl after plop!
    bowl.yolks.forEach((yObj) => {
      if (yObj.group.visible) {
        yObj.yolk.scale.x += (1.0 - yObj.yolk.scale.x) * Math.min(1, rawDt * 10);
        yObj.yolk.scale.y += (0.68 - yObj.yolk.scale.y) * Math.min(1, rawDt * 10);
        yObj.yolk.scale.z += (1.0 - yObj.yolk.scale.z) * Math.min(1, rawDt * 10);
      }
    });

    // Milk carafe pouring physics
    const targetMilkPos = state.pouringMilk ? new THREE.Vector3(1.18, 1.18, 0.12) : new THREE.Vector3(1.56, 0, 0.06);
    const targetMilkRotZ = state.pouringMilk ? 1.12 : 0.0;
    milk.group.position.lerp(targetMilkPos, Math.min(1, rawDt * 7.5));
    milk.group.rotation.z += (targetMilkRotZ - milk.group.rotation.z) * Math.min(1, rawDt * 7.5);
    milkShadow.material.opacity = state.pouringMilk ? 0.28 : 0.76;

    if (state.pouringMilk && state.milkAmount < 1.0 && milk.group.rotation.z > 0.65) {
      state.milkAmount = Math.min(1.0, state.milkAmount + dt * 0.56);
      milk.streamMesh.visible = true;
      milk.streamMesh.position.set(0.68, 1.46, 0.12);
      milk.milkMesh.scale.y = Math.max(0.08, 1.0 - state.milkAmount * 0.88);
      bowl.liqGroup.visible = true;
      audio.setPourSound(true, 0.25, state.milkAmount);
      mixingCanvas.redraw({
        milkAmount: state.milkAmount,
        eggCount: state.eggCount,
        mixProgress: 0,
        swirlAngle: state.elapsed * 0.6,
        richness: state.eggCount >= 2 ? 0.92 : 0.45,
      });
    } else {
      milk.streamMesh.visible = false;
      if (state.stage === STAGES.EGG_MILK) audio.setPourSound(false);
    }

    // Update liquid level inside glass bowl
    const liqLevel = Math.max(state.eggCount > 0 ? 0.18 : 0, state.milkAmount * 0.85 + state.eggCount * 0.08);
    if (liqLevel > 0.01) {
      bowl.liqGroup.visible = true;
      bowl.liqSide.scale.set(1, Math.min(1, liqLevel), 1);
      const topY = Math.min(0.62, liqLevel * 0.62);
      bowl.liqTop.position.y = topY;
      const topRad = THREE.MathUtils.lerp(0.64, 1.05, Math.min(1, liqLevel));
      bowl.liqTop.scale.set(topRad, 1, topRad);
      bowl.yolks.forEach((yObj) => {
        yObj.group.position.y = topY + 0.015;
      });
    }

    // Auto-advance once BOTH egg(s) AND milk are poured and active crack finishes!
    if (state.eggCount >= 1 && state.milkAmount >= 0.96 && !state.activeCrack && !state.pouringMilk) {
      enterStage(STAGES.WHISK);
    }
  }

  // === STAGE 2: WHISK / EMULSIFY ===
  else if (state.stage === STAGES.WHISK) {
    state.whiskPos.lerp(state.whiskTarget, Math.min(1, rawDt * 14));
    whisk.position.set(state.whiskPos.x, 0.28, 0.1 + state.whiskPos.y);
    whisk.rotation.z = -state.whiskPos.x * 0.35;
    whisk.rotation.x = state.whiskPos.y * 0.35;
    whisk.rotation.y += rawDt * (state.whiskDragging ? 4.5 : 0.3);

    // Dissolve whole egg yolks flat into the swirling golden ribbons!
    const yolkFade = Math.max(0, 1 - state.mixProgress * 4.5);
    bowl.yolks.forEach((yObj, i) => {
      if (yObj.group.visible) {
        const ang = state.swirlAngle + i * Math.PI;
        const r = 0.24 * yolkFade;
        yObj.group.position.x = Math.cos(ang) * r;
        yObj.group.position.z = Math.sin(ang) * r;
        yObj.yolk.scale.set(0.75 + yolkFade * 0.25, Math.max(0.01, yolkFade * 0.55), 0.75 + yolkFade * 0.25);
        if (yolkFade <= 0.04) yObj.group.visible = false;
      }
    });

    // Update bowl side liquid color smoothly toward rich golden custard
    const richness = state.eggCount >= 2 ? 0.92 : 0.45;
    const custardCol = new THREE.Color().setRGB(
      (248 + richness * 4) / 255,
      (218 - richness * 20) / 255,
      (132 - richness * 38) / 255
    );
    bowl.liqSideMat.color.lerpColors(new THREE.Color(0xf7eed8), custardCol, state.mixProgress);

    mixingCanvas.redraw({
      milkAmount: 1,
      eggCount: state.eggCount,
      mixProgress: state.mixProgress,
      swirlAngle: state.swirlAngle,
      richness,
    });

    if (state.mixProgress >= 1.0) {
      enterStage(STAGES.POUR_CUP);
    }
  }

  // === STAGE 3A: POUR CUSTARD INTO GLASS PUDDING CUP ===
  else if (state.stage === STAGES.POUR_CUP) {
    const targetTilt = state.pouringCustard ? -1.08 : -0.35;
    bowl.group.rotation.z += (targetTilt - bowl.group.rotation.z) * Math.min(1, rawDt * 7.5);

    if (state.pouringCustard && state.cupFill < 1.0) {
      state.cupFill = Math.min(1.0, state.cupFill + dt * 0.58);
      custardStream.visible = true;
      cupSet.fillMesh.scale.set(1, Math.max(0.02, state.cupFill), 1);
      bowl.liqGroup.scale.y = Math.max(0.05, 1.0 - state.cupFill * 0.92);
      audio.setPourSound(true, 0.42, state.cupFill);
    } else {
      custardStream.visible = false;
      audio.setPourSound(false);
    }

    if (state.cupFill >= 0.99) {
      custardStream.visible = false;
      audio.setPourSound(false);
      bowl.liqGroup.scale.y = 1;
      enterStage(STAGES.STEAM);
    }
  }

  // === STAGE 3B: STEAMING ===
  else if (state.stage === STAGES.STEAM) {
    if (state.steamingActive && state.steamProgress < 1.0) {
      state.steamProgress = Math.min(1.0, state.steamProgress + dt * 0.42);
    }
    const heatIntensity = state.steamingActive ? 0.55 + state.steamProgress * 0.65 : 0.25 + state.steamProgress * 0.45;
    cupSet.glowRingMat.opacity = 0.28 + heatIntensity * 0.68;
    steamGlowLight.intensity = 1.6 + heatIntensity * 3.2;
    cupSet.domeMat.opacity = 0.22 + state.steamProgress * 0.22;
    audio.setSteamSound(state.steamingActive ? 0.85 : state.steamProgress * 0.35);

    vapor.update(dt, {
      active: state.steamProgress > 0.05,
      mode: 'steam',
      origin: new THREE.Vector3(0, 1.15, 0),
      intensity: 0.45 + state.steamProgress * 0.9,
    });

    // Lift steamer dome cleanly in a dramatic rim-lit steam plume when done!
    if (state.steamProgress >= 1.0) {
      state.domeOpenT += dt * 0.95;
      cupSet.domeGroup.position.y = state.domeOpenT * 2.4;
      cupSet.domeMat.opacity = Math.max(0, 0.44 * (1 - state.domeOpenT));
      steamGlowLight.intensity = Math.max(0, 4.2 * (1 - state.domeOpenT));
      if (state.domeOpenT >= 1.05) {
        steamGlowLight.intensity = 0;
        audio.setSteamSound(0);
        enterStage(STAGES.CHILL);
      }
    }
  }

  // === STAGE 4: CHILL IN ICE BATH ===
  else if (state.stage === STAGES.CHILL) {
    // Animate falling crystal ice cubes into cold bath
    cupSet.iceCubes.forEach((cube) => {
      if (cube.userData.dropped && cube.userData.dropT < 1.0) {
        cube.userData.dropT = Math.min(1.0, cube.userData.dropT + dt * 3.4);
        const k = cube.userData.dropT;
        const bounce = k < 0.78 ? (k / 0.78) * (k / 0.78) : 1 - Math.sin(((k - 0.78) / 0.22) * Math.PI) * 0.08;
        cube.position.lerpVectors(
          new THREE.Vector3(cube.userData.targetPos.x * 1.15, 2.35, cube.userData.targetPos.z * 1.15),
          cube.userData.targetPos,
          bounce
        );
      }
    });

    const targetChill = Math.min(1, state.iceDropped / 10);
    state.chillProgress += (targetChill - state.chillProgress) * Math.min(1, rawDt * 3.2);
    cupSet.frostMat.opacity = state.chillProgress * 0.48;
    chillLight.intensity = state.chillProgress * 3.2;

    // Cold mist sinks gently downward onto black slate!
    vapor.update(dt, {
      active: state.chillProgress > 0.12,
      mode: 'cold',
      origin: new THREE.Vector3(0, 1.05, 0),
      intensity: state.chillProgress * 1.15,
    });

    if (state.chillProgress >= 0.96) {
      chillLight.intensity *= 0.85;
      if (state.stageTime > 1.8 && state.iceDropped >= 10) {
        chillLight.intensity = 0;
        enterStage(STAGES.FLIP_CUP);
      }
    }
  }

  // === STAGE 5A: FLIP CUP ONTO WHITE PORCELAIN PLATE ===
  else if (state.stage === STAGES.FLIP_CUP) {
    vapor.update(dt, { active: false, mode: 'cold', intensity: 0 });
    if (!state.flipping) {
      // Subtle inviting hover bob above the gleaming white plate
      cupSet.cupGroup.position.y = 1.52 + Math.sin(state.elapsed * 2.4) * 0.055;
      cupSet.cupGroup.rotation.z = 0.28 + Math.sin(state.elapsed * 2.4) * 0.06;
    } else {
      state.flipT = Math.min(1, state.flipT + dt * 2.2);
      const ease = state.flipT * state.flipT * (3 - 2 * state.flipT);
      cupSet.cupGroup.rotation.z = THREE.MathUtils.lerp(0.28, Math.PI, ease);
      cupSet.cupGroup.position.y = THREE.MathUtils.lerp(1.52, 1.37, ease) + Math.sin(ease * Math.PI) * 0.32;
      if (state.flipT >= 1.0) {
        audio.playPorcelainClink();
        enterStage(STAGES.LIFT_CUP);
      }
    }
  }

  // === STAGE 5B: PULL UP CUP -> SLOW-MOTION PURUN! ===
  else if (state.stage === STAGES.LIFT_CUP) {
    if (!state.unmolded) {
      // Suction pull resistance + rising glistening air bubble along glass wall!
      cupSet.cupGroup.position.y = 1.37 + state.liftProgress * 0.28;
      cupSet.cupGroup.rotation.z = Math.PI + Math.sin(state.elapsed * 18) * state.liftProgress * 0.025;
      if (state.liftProgress > 0.25) {
        cupSet.airBubble.visible = true;
        const bt = (state.liftProgress - 0.25) / 0.68;
        cupSet.airBubble.position.set(0.62, THREE.MathUtils.lerp(1.08, 0.16, bt), 0.22);
      }
    } else {
      // Dramatic slow-mo lift away + pudding landing wobble!
      state.unmoldAnimT += dt;
      const dropK = Math.min(1, state.unmoldAnimT * 4.5);
      heroPudding.group.position.y = THREE.MathUtils.lerp(0.24, 0.078, dropK * dropK);
      cupSet.cupGroup.position.y += dt * 3.8;
      cupSet.cupGroup.position.x -= dt * 0.8;

      if (state.unmoldAnimT >= 0.72) {
        cupSet.cupGroup.visible = false;
        enterStage(STAGES.CARAMEL_PLAY);
      }
    }
  }

  // === STAGE 6: CARAMEL POUR + INFINITE SOFT-BODY PLAY + SILVER SPOON ===
  else if (state.stage === STAGES.CARAMEL_PLAY) {
    // Caramel pitcher tilt & backlit amber ribbon pour!
    const targetPitcherPos = state.pouringCaramel
      ? new THREE.Vector3(0.92, 1.72, 0.04)
      : new THREE.Vector3(1.26, 1.32 + Math.sin(state.elapsed * 1.9) * 0.035, 0.05);
    const targetPitcherRotZ = state.pouringCaramel ? 1.02 : 0.24;

    caramelPitcher.group.position.lerp(targetPitcherPos, Math.min(1, rawDt * 7.5));
    caramelPitcher.group.rotation.z += (targetPitcherRotZ - caramelPitcher.group.rotation.z) * Math.min(1, rawDt * 7.5);

    if (state.pouringCaramel && caramelPitcher.group.rotation.z > 0.58) {
      caramelPitcher.ribbonMesh.visible = true;
      caramelPitcher.ribbonMesh.position.set(0.36, 2.22, 0.04);
      state.caramelFlow = Math.min(1.0, state.caramelFlow + dt * 0.75);
      if (state.caramelFlow >= 0.98) {
        state.caramelExtraPool = Math.min(1.0, state.caramelExtraPool + dt * 0.45);
      }
      heroPudding.setCaramelFlow(state.caramelFlow);
      heroPudding.caramelPool.visible = true;
      const poolScale = 0.64 + state.caramelFlow * 0.34 + state.caramelExtraPool * 0.14;
      heroPudding.caramelPool.scale.set(poolScale, 1, poolScale);
      audio.setPourSound(true, 0.82, state.caramelFlow);

      // Weight of pouring caramel makes pudding gently tremble!
      if (Math.random() < 0.28) {
        softBody.impulseTopDrop(0.26);
      }

      // Reveal gleaming silver dessert spoon once caramel glazes the pudding!
      if (state.caramelFlow > 0.22) {
        spoon.group.visible = true;
      }
    } else {
      caramelPitcher.ribbonMesh.visible = false;
      audio.setPourSound(false);
    }

    // Silver dessert spoon tactile scoop animation!
    if (state.spoonState !== 'idle') {
      state.spoonT += rawDt * 1.15;
      if (state.spoonState === 'scooping') {
        const k = Math.min(1, state.spoonT);
        const ease = k * k * (3 - 2 * k);
        spoon.group.position.lerpVectors(new THREE.Vector3(1.54, 0.34, 0.86), new THREE.Vector3(0.52, 0.88, 0.48), ease);
        spoon.group.rotation.set(THREE.MathUtils.lerp(0.06, 0.28, ease), THREE.MathUtils.lerp(1.18, 1.05, ease), THREE.MathUtils.lerp(-0.14, -0.22, ease));
        if (k >= 1) {
          state.spoonState = 'holding';
          state.spoonT = 0;
          spoon.biteGroup.visible = true;
          softBody.targetScoop = Math.min(1.0, softBody.targetScoop + 0.65);
          softBody.impulsePoke(new THREE.Vector3(0.45, 0.88, 0.45), -0.45, -0.35, 0.85);
          audio.playPuddingWobble(0.75);
        }
      } else if (state.spoonState === 'holding') {
        const k = Math.min(1, state.spoonT * 0.68);
        const ease = k * k * (3 - 2 * k);
        // Lift glossy trembling spoonful cleanly to right-front toward viewer!
        spoon.group.position.lerpVectors(new THREE.Vector3(0.52, 0.88, 0.48), new THREE.Vector3(0.86, 1.12, 1.05), ease);
        spoon.group.rotation.set(0.12, 1.28, 0.04);
        spoon.biteGroup.rotation.z = Math.sin(state.elapsed * 20) * 0.08 * (1 - k * 0.5);
        if (k >= 1) {
          state.spoonState = 'returning';
          state.spoonT = 0;
          spoon.biteGroup.visible = false;
          audio.playStageChime(state.scoopCount++);
        }
      } else if (state.spoonState === 'returning') {
        const k = Math.min(1, state.spoonT * 1.2);
        const ease = k * k * (3 - 2 * k);
        spoon.group.position.lerpVectors(new THREE.Vector3(0.86, 1.12, 1.05), new THREE.Vector3(1.54, 0.34, 0.86), ease);
        spoon.group.rotation.set(THREE.MathUtils.lerp(0.12, 0.06, ease), THREE.MathUtils.lerp(1.28, 1.18, ease), THREE.MathUtils.lerp(0.04, -0.14, ease));
        if (k >= 1) {
          state.spoonState = 'idle';
          state.spoonT = 0;
        }
      }
    }
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (rawDt <= 0) return;

  fpsSamples.push(1 / rawDt);
  if (fpsSamples.length > 45) fpsSamples.shift();

  const timeScale = slowMo.update(rawDt);
  const dt = rawDt * timeScale;
  state.elapsed += dt;

  // Update soft-body spring-mass simulation in dilated time so slow-mo wobble looks hypnotic!
  softBody.update(dt);
  updateStageLogic(dt, rawDt, timeScale);
  updateHandAndIdle(rawDt);

  // Subtle macro camera dolly-in during slow motion + ultra-smooth stage camera glides
  const dollyTarget = camPosTarget.clone();
  const zoomPull = slowMo.zoomBoost * 0.72;
  const toLook = camLookTarget.clone().sub(dollyTarget).normalize();
  dollyTarget.addScaledVector(toLook, zoomPull);
  // Microscopic studio breathing motion (keeps black-studio frame alive)
  dollyTarget.x += Math.sin(state.elapsed * 0.45) * 0.025;
  dollyTarget.y += Math.cos(state.elapsed * 0.35) * 0.015;

  camera.position.lerp(dollyTarget, Math.min(1, rawDt * 4.2));
  camLookCurrent.lerp(camLookTarget, Math.min(1, rawDt * 4.5));
  camera.lookAt(camLookCurrent);

  renderer.render(scene, camera);
}

// Start cleanly on Stage 1
enterStage(STAGES.EGG_MILK);
requestAnimationFrame(animate);

// === DIAGNOSTIC / VISUAL QA HOOK (non-intrusive, zero UI) ===
window.__PUDDING_DEBUG__ = {
  getStats() {
    const avgFps = fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0;
    return {
      stage: state.stage,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      pixelRatio: renderer.getPixelRatio(),
      fps: Math.round(avgFps),
      timeScale: Number(slowMo.scale.toFixed(2)),
    };
  },
  jumpTo(stageName, opts = {}) {
    if (opts.eggCount) state.eggCount = opts.eggCount;
    if (stageName === 'CARAMEL_PLAY') {
      state.eggCount = opts.eggCount || 2;
      updateRichnessMaterials();
      enterStage(STAGES.CARAMEL_PLAY);
      if (opts.caramelFlow !== undefined) {
        state.caramelFlow = opts.caramelFlow;
        heroPudding.setCaramelFlow(state.caramelFlow);
        heroPudding.caramelPool.visible = true;
        const ps = 0.64 + state.caramelFlow * 0.38;
        heroPudding.caramelPool.scale.set(ps, 1, ps);
        spoon.group.visible = state.caramelFlow > 0.22;
      }
      if (opts.wobble) {
        softBody.impulseUnmold(opts.wobble);
      }
      if (opts.pouring) {
        state.pouringCaramel = true;
      }
      if (opts.scoop) {
        softBody.targetScoop = 0.8;
        softBody.scoopAmount = 0.8;
        spoon.group.visible = true;
        spoon.biteGroup.visible = true;
        spoon.group.position.set(0.84, 1.06, 0.92);
        spoon.group.rotation.set(0.12, 1.26, 0.04);
      }
    } else if (stageName === 'WHISK') {
      state.eggCount = 2;
      state.milkAmount = 1;
      state.mixProgress = opts.mixProgress ?? 0.35;
      bowl.liqGroup.visible = true;
      bowl.liqSide.scale.set(1, 0.92, 1);
      bowl.liqTop.position.y = 0.57;
      bowl.liqTop.scale.set(1.02, 1, 1.02);
      bowl.yolks[0].group.visible = true;
      bowl.yolks[0].group.position.set(-0.18, 0.59, 0.05);
      enterStage(STAGES.WHISK);
    } else if (stageName === 'STEAM') {
      state.eggCount = 2;
      updateRichnessMaterials();
      enterStage(STAGES.STEAM);
      state.steamProgress = opts.steamProgress ?? 0.65;
      state.steamingActive = true;
    } else if (stageName === 'CHILL') {
      state.eggCount = 2;
      updateRichnessMaterials();
      enterStage(STAGES.CHILL);
      dropIceBatch(10);
      state.chillProgress = 0.85;
    } else if (stageName === 'LIFT_CUP') {
      state.eggCount = 2;
      updateRichnessMaterials();
      enterStage(STAGES.LIFT_CUP);
      state.liftProgress = 0.65;
    } else {
      resetGame();
    }
    // Snap camera immediately for clean inspection
    camera.position.copy(camPosTarget);
    camLookCurrent.copy(camLookTarget);
    camera.lookAt(camLookCurrent);
  },
  crackEgg() {
    startEggCrack(1);
  },
  renderNow(steps = 1, stepDt = 0.033) {
    for (let i = 0; i < steps; i++) {
      const ts = slowMo.update(stepDt);
      const dt = stepDt * ts;
      state.elapsed += dt;
      softBody.update(dt);
      updateStageLogic(dt, stepDt, ts);
      updateHandAndIdle(stepDt);
    }
    camera.position.copy(camPosTarget);
    camLookCurrent.copy(camLookTarget);
    camera.lookAt(camLookCurrent);
    renderer.render(scene, camera);
  },
};
