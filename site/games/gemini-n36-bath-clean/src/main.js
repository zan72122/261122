import * as THREE from '../vendor/three.module.min.js';
import {
  DynamicTubSurface,
  DynamicMirrorTexture,
  createStudioEnvironment,
} from './textures.js';
import { BathAudio } from './audio.js';
import { TiltShiftPipeline } from './postprocess.js';
import {
  TUB,
  tubInnerY,
  tubSuperellipseR,
  worldToTubUV,
  clampInsideTub,
  buildDiorama,
} from './diorama.js';
import {
  createBigSponge,
  createRubberDuck,
  createBathBomb,
  createToyBoat,
  createIdleDemoHand,
} from './toys.js';
import { BathEffects } from './effects.js';

// ============================================================
// 1. Renderer, Scene, Studio Miniature Lighting & Tilt-Shift
// ============================================================
const canvas = document.getElementById('game-canvas');
const replayBtn = document.getElementById('replay-btn');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // allows reliable screenshot captures
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// TiltShiftPipeline performs HDR ACESFilmic tone mapping + sRGB encoding in its final pass
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c8baa9');
scene.fog = new THREE.Fog('#c8baa9', 20, 38);
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = 0.58;

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.5, 45);
const lookTarget = new THREE.Vector3(0.05, 0.92, -0.05);

const pipeline = new TiltShiftPipeline(renderer);

// Warm sunlit studio photography lighting rig (balanced for linear HDR -> ACESFilmic)
const hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x8b7b6c, 0.72);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff1da, 1.65);
keyLight.position.set(5.5, 9.5, 6.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 24;
keyLight.shadow.camera.left = -5.4;
keyLight.shadow.camera.right = 5.4;
keyLight.shadow.camera.top = 5.0;
keyLight.shadow.camera.bottom = -4.2;
keyLight.shadow.bias = -0.0006;
keyLight.shadow.normalBias = 0.025;
scene.add(keyLight);

// Cool bathroom window bounce fill from left
const fillLight = new THREE.DirectionalLight(0xcbe8ff, 0.45);
fillLight.position.set(-6.5, 4.5, 3.0);
scene.add(fillLight);

// Subtle warm rim light to pop glossy porcelain, foam & rubber duck silhouettes
const rimLight = new THREE.DirectionalLight(0xffe0c0, 0.42);
rimLight.position.set(-1.0, 5.0, -7.0);
scene.add(rimLight);

// ============================================================
// 2. Build Diorama, Toys, Dynamic Surfaces, Effects & Audio
// ============================================================
const audio = new BathAudio();
const tubSurface = new DynamicTubSurface();
const mirrorTexture = new DynamicMirrorTexture();
const diorama = buildDiorama(scene, tubSurface, mirrorTexture);
const effects = new BathEffects(scene);

// Big Sponge (Hero of Stage 1)
const spongeHomeStart = new THREE.Vector3(-1.08, TUB.rimY + 0.04, 1.15);
const spongeHomeStool = new THREE.Vector3(-2.95, 0.84, 0.95);
const sponge = createBigSponge();
sponge.position.copy(spongeHomeStart);
sponge.rotation.y = 0.25;
scene.add(sponge);

// Big Mama Rubber Duck (Hero of Stage 4, perched eagerly on back-right tub ledge!)
const mamaRestPos = new THREE.Vector3(1.54, TUB.rimY + 0.05, -0.61);
const mamaDuck = createRubberDuck({
  scale: 1.06,
  bodyColor: 0xffd426,
  beakColor: 0xff7722,
  ribbonColor: 0xff7aa8,
});
mamaDuck.root.position.copy(mamaRestPos);
mamaDuck.root.rotation.y = -2.35; // looking down into the bathtub!
scene.add(mamaDuck.root);

// 3 Pastel Baby Ducks on the back wooden shelf (follow Mama in the water!)
const babySpecs = [
  { x: 0.24, color: 0xffe047, beak: 0xff8433 },
  { x: 0.72, color: 0xffa8c8, beak: 0xff7b47 },
  { x: 1.20, color: 0x98e6d4, beak: 0xff8c42 },
];
const babyDucks = babySpecs.map((spec, idx) => {
  const duck = createRubberDuck({
    scale: 0.48,
    bodyColor: spec.color,
    beakColor: spec.beak,
  });
  const restPos = new THREE.Vector3(spec.x, diorama.shelfY, -2.02);
  duck.root.position.copy(restPos);
  duck.root.rotation.y = -1.45 - idx * 0.1;
  scene.add(duck.root);
  return {
    id: `baby_${idx}`,
    idx,
    duck,
    restPos,
    inWater: false,
    jumping: false,
    jumpT: 0,
    jumpStart: restPos.clone(),
    jumpEnd: new THREE.Vector3(),
    x: restPos.x,
    z: restPos.z,
    vx: 0,
    vz: 0,
    angle: -1.45,
    bobPhase: idx * 2.1,
    peepDelay: 0,
  };
});

// Pastel Toy Sailboat on the right side of the shelf
const boatRestPos = new THREE.Vector3(1.76, diorama.shelfY, -2.02);
const toyBoatMesh = createToyBoat();
toyBoatMesh.position.copy(boatRestPos);
toyBoatMesh.rotation.y = -0.35;
scene.add(toyBoatMesh);
const toyBoat = {
  mesh: toyBoatMesh,
  restPos: boatRestPos,
  inWater: false,
  jumping: false,
  jumpT: 0,
  jumpStart: boatRestPos.clone(),
  jumpEnd: new THREE.Vector3(),
  x: boatRestPos.x,
  z: boatRestPos.z,
  angle: -0.35,
  orbitPhase: 0,
  wobble: 0,
};

// 2 Fizzy Pastel Bath Bombs on the far-right of the shelf
const WATER_PALETTES = [
  { name: 'sakura', waterHex: 0xffb2d2, fizzHex: 0xffd1e6, bombHex: 0xff8bb8 },
  { name: 'lavender', waterHex: 0xc8b2ff, fizzHex: 0xe4d6ff, bombHex: 0xb69cff },
  { name: 'peach', waterHex: 0xffcc96, fizzHex: 0xffe4c2, bombHex: 0xffb370 },
  { name: 'aqua', waterHex: 0x64d6f4, fizzHex: 0xbcf2ff, bombHex: 0x6ce0ff },
];

const bombConfigs = [
  { x: 2.22, paletteIdx: 0, color: 0xff8bb8, stripe: 0xfff0f6 },
  { x: 2.52, paletteIdx: 1, color: 0xb8a0ff, stripe: 0xf4f0ff },
];
const bathBombs = bombConfigs.map((cfg, idx) => {
  const mesh = createBathBomb(cfg.color, cfg.stripe);
  const restPos = new THREE.Vector3(cfg.x, diorama.shelfY + 0.16, -2.02);
  mesh.position.copy(restPos);
  scene.add(mesh);
  return {
    idx,
    mesh,
    restPos,
    paletteIdx: cfg.paletteIdx,
    state: 'shelf', // 'shelf' | 'jumping' | 'fizzing' | 'respawning'
    t: 0,
    jumpStart: restPos.clone(),
    jumpEnd: new THREE.Vector3(),
    x: 0,
    z: 0,
    angle: 0,
    wobble: 0,
  };
});

// Subtle Idle-Only Demo Hand (appears ONLY after 10s of total inactivity, once per stage)
const demoHand = createIdleDemoHand();
scene.add(demoHand.group);

// ============================================================
// 3. Game State Machine & Physical Object States
// ============================================================
const game = {
  stage: 'scrub', // 'scrub' | 'rinse' | 'fill' | 'play'
  time: 0,
  idleTime: 0,
  demoShownForStage: null,
  demoActive: false,
  demoT: 0,

  // Scrubbing
  spongeTarget: spongeHomeStart.clone(),
  spongeVel: new THREE.Vector3(),
  spongeSquash: 0,
  rainbowSoapTimer: 0,
  soapPumpAnim: 0,

  // Shower
  showerPos: diorama.showerRestPos.clone(),
  showerTargetPos: diorama.showerRestPos.clone(),
  showerAimWorld: new THREE.Vector3(0, 0.3, 0.25),
  showerSpraying: false,
  showerWobble: 0,
  showerDripTimer: 0,

  // Faucet & Water
  faucetOn: false,
  faucetAutoTimer: 0,
  faucetLeverAngle: 0,
  faucetWobble: 0,
  faucetDripTimer: 0,
  plugClosed: false,
  plugWobble: 0,
  waterFill: 0, // 0 .. 1.07
  waterPaletteIdx: 3, // starts clear crystal aqua
  overflowTimer: 0,

  // Mama Duck physics
  mama: {
    inWater: false,
    jumping: false,
    jumpT: 0,
    jumpStart: mamaRestPos.clone(),
    jumpEnd: new THREE.Vector3(),
    x: mamaRestPos.x,
    z: mamaRestPos.z,
    vx: 0,
    vz: 0,
    angle: -2.35,
    trail: [], // history of positions for baby ducks to follow!
  },

  // Pointer interaction state (strictly single-finger: tracks activePointerId only!)
  activePointerId: null,
  dragMode: null, // 'sponge' | 'shower' | 'faucet' | 'mama_duck' | 'baby_duck' | null
  dragBabyIdx: -1,
  lastPointerWorld: new THREE.Vector3(),
  pointerDownTime: 0,
  pointerMovedDist: 0,
  lastPointerX: 0,
  lastPointerY: 0,
};

// ============================================================
// 4. Responsive Camera Framing (iPhone Portrait & iPad Landscape)
// ============================================================
function updateCameraLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);

  camera.aspect = aspect;

  if (aspect >= 1.15) {
    // Landscape (iPad / Desktop / 4:3 thumb)
    // Macro tilt-shift angle: tub fills center, shelf, faucet & shower framed cleanly
    camera.fov = 31;
    const distScale = aspect < 1.4 ? 1.07 : 1.0;
    camera.position.set(0.28 * distScale, 6.15 * distScale, 7.95 * distScale);
    lookTarget.set(0.05, 0.96, -0.14);
    pipeline.setFocus(0.51, 0.25);
  } else {
    // Portrait (iPhone): solve exact distance from horizontal FOV so full tub + faucet + bath bombs + stool fit cleanly!
    camera.fov = 40;
    const vRad = THREE.MathUtils.degToRad(camera.fov);
    const halfTanH = Math.tan(vRad * 0.5) * Math.max(0.42, aspect);
    const neededDist = 4.05 / halfTanH;
    const baseDist = Math.hypot(6.15, 7.95);
    const scale = Math.max(1.15, Math.min(2.35, neededDist / baseDist));
    camera.position.set(0.32, 6.25 * scale, 7.9 * scale);
    lookTarget.set(0.22, 0.96, -0.18);
    pipeline.setFocus(0.51, 0.22);
  }

  camera.lookAt(lookTarget);
  camera.updateProjectionMatrix();

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  pipeline.setSize(w, h, dpr);
}

window.addEventListener('resize', updateCameraLayout);
updateCameraLayout();

// ============================================================
// 5. Raycasting & Generous Tactile Hit-Testing
// ============================================================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tubMidPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.62);
const waterDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
const tmpVec = new THREE.Vector3();

function getRayFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}

function hitSphere(ray, pos, radius) {
  return ray.distanceToPoint(pos) <= radius;
}

function intersectTubPlane(ray, planeY = 0.55) {
  tubMidPlane.constant = -planeY;
  const out = new THREE.Vector3();
  if (ray.intersectPlane(tubMidPlane, out)) {
    return out;
  }
  return null;
}

// ============================================================
// 6. Stage Transitions & Helper Actions
// ============================================================
function enterStage(nextStage) {
  if (game.stage === nextStage) return;
  game.stage = nextStage;
  game.idleTime = 0;
  game.demoActive = false;
  demoHand.group.visible = false;

  if (nextStage === 'rinse') {
    audio.playStageSparkle(false);
    // Sparkle celebration around foamy tub
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      effects.spawnSparkle(
        TUB.centerX + Math.cos(a) * 1.15,
        0.95 + Math.random() * 0.4,
        TUB.centerZ + Math.sin(a) * 0.55,
        0xfff6d6,
        0.48
      );
    }
    // Sponge hops neatly onto the wooden stool
    game.spongeTarget.copy(spongeHomeStool);
    // Shower gives an inviting rattle + droplet
    game.showerWobble = 0.8;
    game.showerDripTimer = 0.1;
  } else if (nextStage === 'fill') {
    tubSurface.clearAllRemaining();
    effects.flushAllFoamToDrain();
    audio.playStageSparkle(true);
    // Grand gleaming porcelain sparkle cascade!
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 0.4 + (i % 3) * 0.45;
      effects.spawnSparkle(
        TUB.centerX + Math.cos(a) * r * 1.15,
        0.6 + Math.random() * 0.75,
        TUB.centerZ + Math.sin(a) * r * 0.55,
        0xffffff,
        0.56
      );
    }
    // Shower returns smoothly to wall cradle
    game.showerSpraying = false;
    game.showerTargetPos.copy(diorama.showerRestPos);
    audio.setShower(false);

    // Drain plug playfully seals the tub so turning the faucet immediately fills!
    game.plugClosed = true;
    audio.playPlugPop(true);
    game.faucetWobble = 0.85;
    game.faucetDripTimer = 0.15;
  } else if (nextStage === 'play') {
    audio.playStageSparkle(true);
    mamaDuck.triggerQuack(1.6);
    audio.playDuckQuack(false, false);
    for (let i = 0; i < 10; i++) {
      effects.spawnSparkle(
        TUB.centerX + (Math.random() - 0.5) * 2.6,
        effects.waterLevelY + 0.25 + Math.random() * 0.5,
        TUB.centerZ + (Math.random() - 0.5) * 1.2,
        0xfff9dd,
        0.45
      );
    }
  }
}

function launchMamaIntoWater(targetX = TUB.centerX + 0.15, targetZ = TUB.centerZ) {
  if (game.mama.inWater || game.mama.jumping) return;
  const clamped = clampInsideTub(targetX, targetZ, 0.58);
  game.mama.jumping = true;
  game.mama.jumpT = 0;
  game.mama.jumpStart.copy(mamaDuck.root.position);
  game.mama.jumpEnd.set(clamped.x, effects.waterLevelY, clamped.z);
  mamaDuck.triggerQuack(1.4);
  audio.playDuckQuack(false, false);
  replayBtn.classList.remove('hidden');
}

function launchBabyIntoWater(b, targetX, targetZ) {
  if (b.inWater || b.jumping) return;
  const clamped = clampInsideTub(targetX, targetZ, 0.68);
  b.jumping = true;
  b.jumpT = 0;
  b.jumpStart.copy(b.duck.root.position);
  b.jumpEnd.set(clamped.x, effects.waterLevelY, clamped.z);
  b.duck.triggerQuack(1.1);
  audio.playDuckQuack(true, false);
}

function launchBoatIntoWater() {
  if (toyBoat.inWater || toyBoat.jumping) return;
  toyBoat.jumping = true;
  toyBoat.jumpT = 0;
  toyBoat.jumpStart.copy(toyBoat.mesh.position);
  toyBoat.jumpEnd.set(TUB.centerX - 0.85, effects.waterLevelY, TUB.centerZ - 0.15);
  audio.playWobbleTap(620);
}

function launchBathBomb(bomb) {
  if (bomb.state !== 'shelf') return;
  bomb.state = 'jumping';
  bomb.t = 0;
  bomb.jumpStart.copy(bomb.mesh.position);
  bomb.jumpEnd.set(
    TUB.centerX + (Math.random() - 0.5) * 1.5,
    effects.waterLevelY,
    TUB.centerZ + (Math.random() - 0.5) * 0.65
  );
  audio.playWobbleTap(720);
}

function triggerSoapPump() {
  game.soapPumpAnim = 1.0;
  audio.playSoapSquirt();

  // Squirt glossy pink soap blobs into the tub!
  const nozzlePos = new THREE.Vector3(-1.45, TUB.rimY + 0.62, -0.45);
  for (let i = 0; i < 8; i++) {
    effects.spawnWaterDrop(
      nozzlePos.x,
      nozzlePos.y,
      nozzlePos.z,
      1.15 + Math.random() * 0.6,
      0.85 + Math.random() * 0.5,
      0.95 + Math.random() * 0.6,
      0.06,
      0xffb3cf,
      1.3,
      0.65
    );
  }

  if (game.stage === 'scrub') {
    game.rainbowSoapTimer = 8.0;
    for (let i = 0; i < 5; i++) {
      effects.spawnFloatingBubble(-1.1 + Math.random() * 0.9, 1.35, -0.1 + Math.random() * 0.6, true, 0xffd6ea);
    }
  } else if (game.stage === 'play' || (game.stage === 'fill' && game.waterFill > 0.25)) {
    // Bubble bath islands floating on the water!
    for (let i = 0; i < 18; i++) {
      const rx = TUB.centerX + (Math.random() - 0.5) * 2.4;
      const rz = TUB.centerZ + (Math.random() - 0.5) * 1.1;
      effects.spawnFoamPuff(rx, rz, 1.0, true);
    }
    for (let i = 0; i < 6; i++) {
      effects.spawnFloatingBubble(
        TUB.centerX + (Math.random() - 0.5) * 1.6,
        effects.waterLevelY + 0.12,
        TUB.centerZ + (Math.random() - 0.5) * 0.8,
        true
      );
    }
  }
}

function triggerOverflowSplash(power = 1.0) {
  if (game.waterFill < 0.96) return;
  effects.growOverflowPuddles(0.06 * power);
  // Water cascades over front and side edges of the porcelain tub!
  const spillPoints = [
    [TUB.centerX + 0.9, TUB.centerZ + TUB.innerHalfZ + 0.14, 0.2, 1.0],
    [TUB.centerX - 0.85, TUB.centerZ + TUB.innerHalfZ + 0.14, -0.2, 1.0],
    [TUB.centerX + 0.05, TUB.centerZ + TUB.innerHalfZ + 0.16, 0.0, 1.0],
  ];
  for (const [sx, sz, vx, vz] of spillPoints) {
    if (Math.random() > 0.55) continue;
    const pal = WATER_PALETTES[game.waterPaletteIdx];
    effects.spawnWaterDrop(
      sx + (Math.random() - 0.5) * 0.3,
      TUB.rimY + 0.04,
      sz,
      vx * (0.4 + Math.random() * 0.5),
      0.55 * power + Math.random() * 0.4,
      vz * (0.65 + Math.random() * 0.5),
      0.055,
      pal.fizzHex,
      1.6,
      0.75
    );
  }
}

function resetFullGame() {
  audio.playStageSparkle(false);
  replayBtn.classList.add('hidden');

  game.stage = 'scrub';
  game.idleTime = 0;
  game.demoShownForStage = null;
  game.demoActive = false;
  demoHand.group.visible = false;

  tubSurface.resetDirty();
  mirrorTexture.reset();
  effects.clearAllFoam();
  effects.resetPuddles();
  effects.setWaterTargetColor(0x64d6f4);
  game.waterPaletteIdx = 3;

  sponge.position.copy(spongeHomeStart);
  game.spongeTarget.copy(spongeHomeStart);
  game.rainbowSoapTimer = 0;

  game.showerSpraying = false;
  game.showerPos.copy(diorama.showerRestPos);
  game.showerTargetPos.copy(diorama.showerRestPos);
  audio.setShower(false);

  game.faucetOn = false;
  game.faucetAutoTimer = 0;
  audio.setFaucet(false, 0);
  audio.setFizz(0);

  game.plugClosed = false;
  game.waterFill = 0;

  // Reset Mama Duck
  game.mama.inWater = false;
  game.mama.jumping = false;
  game.mama.x = mamaRestPos.x;
  game.mama.z = mamaRestPos.z;
  game.mama.vx = 0;
  game.mama.vz = 0;
  game.mama.angle = -2.35;
  game.mama.trail.length = 0;
  mamaDuck.root.position.copy(mamaRestPos);
  mamaDuck.root.rotation.set(0, -2.35, 0);

  // Reset Baby Ducks
  for (const b of babyDucks) {
    b.inWater = false;
    b.jumping = false;
    b.x = b.restPos.x;
    b.z = b.restPos.z;
    b.vx = 0;
    b.vz = 0;
    b.angle = -1.45 - b.idx * 0.1;
    b.duck.root.position.copy(b.restPos);
    b.duck.root.rotation.set(0, b.angle, 0);
  }

  // Reset Boat & Bath Bombs
  toyBoat.inWater = false;
  toyBoat.jumping = false;
  toyBoat.mesh.position.copy(boatRestPos);
  toyBoat.mesh.rotation.set(0, -0.35, 0);

  for (const bomb of bathBombs) {
    bomb.state = 'shelf';
    bomb.mesh.visible = true;
    bomb.mesh.scale.setScalar(1);
    bomb.mesh.position.copy(bomb.restPos);
  }
}

replayBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.unlock();
  resetFullGame();
});

// ============================================================
// 7. One-Finger Pointer Handlers (Strict Single-Touch & Causality)
// ============================================================
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();

  // Single-finger rule: ignore extra fingers so multi-touch never breaks state
  if (game.activePointerId !== null) return;
  game.activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);

  game.idleTime = 0;
  game.demoActive = false;
  demoHand.group.visible = false;
  game.pointerDownTime = game.time;
  game.pointerMovedDist = 0;
  game.lastPointerX = e.clientX;
  game.lastPointerY = e.clientY;
  game.dragMode = null;

  const ray = getRayFromClient(e.clientX, e.clientY);

  // 0. Always allow popping floating iridescent soap bubbles with a musical chime!
  const popped = effects.tryPopBubbleWithRay(ray);
  if (popped) {
    audio.playMusicalPop();
    return;
  }

  // Check generous hit spheres for physical interactive props
  const hitSponge = hitSphere(ray, sponge.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0.78);
  const hitSoap = hitSphere(ray, diorama.soapBottleGroup.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 0.56);
  const hitShower = hitSphere(ray, diorama.showerHeadGroup.position, 0.72);
  const hitFaucet = hitSphere(ray, diorama.faucetGroup.position.clone().add(new THREE.Vector3(-0.2, 0.45, 0)), 0.78);
  const hitPlug = hitSphere(ray, diorama.drainPlugGroup.position, 0.48);
  const hitMama = hitSphere(ray, mamaDuck.root.position.clone().add(new THREE.Vector3(0, 0.42, 0)), 0.72);
  const hitBoat = hitSphere(ray, toyBoat.mesh.position.clone().add(new THREE.Vector3(0, 0.18, 0)), 0.48);

  let hitBaby = null;
  for (const b of babyDucks) {
    if (hitSphere(ray, b.duck.root.position.clone().add(new THREE.Vector3(0, 0.22, 0)), 0.44)) {
      hitBaby = b;
      break;
    }
  }
  let hitBomb = null;
  for (const bomb of bathBombs) {
    if (bomb.state === 'shelf' && hitSphere(ray, bomb.mesh.position, 0.38)) {
      hitBomb = bomb;
      break;
    }
  }

  const tubPt = intersectTubPlane(ray, game.waterFill > 0.2 ? effects.waterLevelY : 0.48);
  const insideTub = tubPt && tubSuperellipseR(tubPt.x, tubPt.z) <= 1.06;

  // ------------------------------------------------------------------
  // STAGE 1: SCRUBBING (Active: Sponge + Soap Pump; others gently wobble)
  // ------------------------------------------------------------------
  if (game.stage === 'scrub') {
    if (hitSoap) {
      triggerSoapPump();
      return;
    }
    if (hitSponge || insideTub) {
      game.dragMode = 'sponge';
      if (tubPt) {
        const c = clampInsideTub(tubPt.x, tubPt.z, 0.9);
        game.spongeTarget.set(c.x, tubInnerY(c.x, c.z) + 0.03, c.z);
        game.lastPointerWorld.set(c.x, 0, c.z);
      }
      audio.playBubblePop(0.95, 0.16);
      return;
    }
    // Gentle non-advancing wobbles for out-of-stage props
    if (hitMama) {
      mamaDuck.triggerWobble();
      audio.playDuckQuack(false, true);
    } else if (hitShower) {
      game.showerWobble = 0.45;
      audio.playWobbleTap(640);
    } else if (hitFaucet) {
      game.faucetWobble = 0.45;
      audio.playWobbleTap(520);
    } else if (hitBaby) {
      hitBaby.duck.triggerWobble();
      audio.playDuckQuack(true, true);
    } else if (hitBomb) {
      hitBomb.wobble = 0.4;
      audio.playWobbleTap(780);
    } else if (hitBoat) {
      toyBoat.wobble = 0.4;
      audio.playWobbleTap(580);
    }
    return;
  }

  // ------------------------------------------------------------------
  // STAGE 2: SHOWER RINSE (Active: Handheld Shower; others gently wobble)
  // ------------------------------------------------------------------
  if (game.stage === 'rinse') {
    if (hitShower || insideTub) {
      game.dragMode = 'shower';
      game.showerSpraying = true;
      updateShowerAimFromRay(ray);
      audio.setShower(true, false);
      return;
    }
    if (hitMama) {
      mamaDuck.triggerWobble();
      audio.playDuckQuack(false, true);
    } else if (hitFaucet) {
      game.faucetWobble = 0.45;
      audio.playWobbleTap(520);
    } else if (hitSoap) {
      game.soapPumpAnim = 0.4;
      audio.playWobbleTap(500);
    } else if (hitBaby) {
      hitBaby.duck.triggerWobble();
      audio.playDuckQuack(true, true);
    }
    return;
  }

  // ------------------------------------------------------------------
  // STAGE 3: FILLING WARM WATER (Active: Faucet & Plug; others gently wobble)
  // ------------------------------------------------------------------
  if (game.stage === 'fill') {
    if (hitPlug) {
      game.plugClosed = !game.plugClosed;
      game.plugWobble = 0.5;
      audio.playPlugPop(game.plugClosed);
      return;
    }
    if (hitFaucet || insideTub) {
      // Ensure plug is closed when turning on water to fill
      if (!game.plugClosed) {
        game.plugClosed = true;
        audio.playPlugPop(true);
      }
      game.dragMode = 'faucet';
      game.faucetOn = true;
      game.faucetAutoTimer = 3.2; // Even a quick tap pours generously!
      audio.setFaucet(true, game.waterFill);
      return;
    }
    if (hitMama) {
      mamaDuck.triggerWobble();
      audio.playDuckQuack(false, true);
    } else if (hitSoap) {
      triggerSoapPump();
    } else if (hitShower) {
      game.showerWobble = 0.45;
      audio.playWobbleTap(640);
    } else if (hitBaby) {
      hitBaby.duck.triggerWobble();
      audio.playDuckQuack(true, true);
    }
    return;
  }

  // ------------------------------------------------------------------
  // STAGE 4: BATH PARTY & SANDBOX PLAY (All bath toys + Overflow + Plug!)
  // ------------------------------------------------------------------
  if (game.stage === 'play') {
    // 1. Big Mama Rubber Duck (tap to jump in / squeak-quack, or drag across water!)
    if (hitMama) {
      if (!game.mama.inWater && !game.mama.jumping) {
        launchMamaIntoWater();
      } else if (game.mama.inWater) {
        game.dragMode = 'mama_duck';
        mamaDuck.triggerQuack(1.1);
        audio.playDuckQuack(false, false);
        effects.addWaterRipple(game.mama.x, game.mama.z, 0.095);
        effects.spawnSplashBurst(game.mama.x, effects.waterLevelY, game.mama.z, 12, 2.2);
        triggerOverflowSplash(1.1);
        // Cascade peep chorus down all baby ducks in water!
        babyDucks.forEach((b) => {
          if (b.inWater) b.peepDelay = 0.16 + b.idx * 0.14;
        });
      }
      return;
    }

    // 2. Baby Ducks (hop into water & follow Mama, or poke/drag!)
    if (hitBaby) {
      if (!hitBaby.inWater && !hitBaby.jumping) {
        launchBabyIntoWater(
          hitBaby,
          TUB.centerX - 0.55 + hitBaby.idx * 0.45,
          TUB.centerZ + (hitBaby.idx % 2 === 0 ? -0.25 : 0.25)
        );
      } else if (hitBaby.inWater) {
        game.dragMode = 'baby_duck';
        game.dragBabyIdx = hitBaby.idx;
        hitBaby.duck.triggerQuack(0.9);
        audio.playDuckQuack(true, false);
        effects.addWaterRipple(hitBaby.x, hitBaby.z, 0.07);
        effects.spawnSplashBurst(hitBaby.x, effects.waterLevelY, hitBaby.z, 8, 1.6);
      }
      return;
    }

    // 3. Fizzy Bath Bombs (spin & change bathwater color!)
    if (hitBomb) {
      launchBathBomb(hitBomb);
      return;
    }

    // 4. Toy Sailboat
    if (hitBoat) {
      if (!toyBoat.inWater && !toyBoat.jumping) {
        launchBoatIntoWater();
      } else {
        toyBoat.wobble = 0.6;
        effects.addWaterRipple(toyBoat.x, toyBoat.z, 0.065);
        audio.playWobbleTap(640);
      }
      return;
    }

    // 5. Faucet (keep pouring / OVERFLOW over the rim!)
    if (hitFaucet) {
      if (!game.plugClosed) {
        game.plugClosed = true;
        audio.playPlugPop(true);
      }
      if (game.faucetOn && game.faucetAutoTimer > 0.2) {
        // Toggle off if already running hands-free
        game.faucetOn = false;
        game.faucetAutoTimer = 0;
        audio.setFaucet(false, game.waterFill);
      } else {
        game.dragMode = 'faucet';
        game.faucetOn = true;
        game.faucetAutoTimer = 4.0;
        audio.setFaucet(true, game.waterFill);
      }
      return;
    }

    // 6. Drain Plug (pull to swirl & drain, tap again to seal!)
    if (hitPlug) {
      game.plugClosed = !game.plugClosed;
      game.plugWobble = 0.6;
      audio.playPlugPop(game.plugClosed);
      if (!game.plugClosed) {
        game.faucetOn = false;
        game.faucetAutoTimer = 0;
        audio.setFaucet(false, game.waterFill);
      }
      return;
    }

    // 7. Soap Bottle (floating bubble bath islands!)
    if (hitSoap) {
      triggerSoapPump();
      return;
    }

    // 8. Shower (still fun to splash the ducks & clear mirror in Stage 4!)
    if (hitShower) {
      game.dragMode = 'shower';
      game.showerSpraying = true;
      updateShowerAimFromRay(ray);
      audio.setShower(true, false);
      return;
    }

    // 9. Tapping directly on the water!
    if (insideTub && tubPt) {
      if (!game.mama.inWater && !game.mama.jumping && game.waterFill > 0.45) {
        // Shortest distance from desire to delight: tapping the warm water calls Mama Duck straight in!
        launchMamaIntoWater(tubPt.x, tubPt.z);
      } else if (game.waterFill > 0.05) {
        // Playful water splash + big ripples + slosh overflow if brim-full!
        effects.addWaterRipple(tubPt.x, tubPt.z, 0.11);
        const pal = WATER_PALETTES[game.waterPaletteIdx];
        effects.spawnSplashBurst(tubPt.x, effects.waterLevelY, tubPt.z, 16, 2.6, pal.fizzHex);
        audio.playSplash(false);
        triggerOverflowSplash(1.25);
        // Nearby ducks bounce happily from the splash!
        if (game.mama.inWater && Math.hypot(game.mama.x - tubPt.x, game.mama.z - tubPt.z) < 1.1) {
          mamaDuck.triggerQuack(0.8);
          audio.playDuckQuack(false, false);
        }
      }
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== game.activePointerId) return;
  e.preventDefault();

  game.idleTime = 0;
  const dxPx = e.clientX - game.lastPointerX;
  const dyPx = e.clientY - game.lastPointerY;
  game.pointerMovedDist += Math.hypot(dxPx, dyPx);
  game.lastPointerX = e.clientX;
  game.lastPointerY = e.clientY;

  const ray = getRayFromClient(e.clientX, e.clientY);

  if (game.dragMode === 'sponge') {
    const pt = intersectTubPlane(ray, 0.5);
    if (pt) {
      const c = clampInsideTub(pt.x, pt.z, 0.91);
      const stepDist = Math.hypot(c.x - game.lastPointerWorld.x, c.z - game.lastPointerWorld.z);
      game.spongeTarget.set(c.x, tubInnerY(c.x, c.z) + 0.02, c.z);

      if (stepDist > 0.025) {
        // Scrub continuously along the drag segment for zero gaps!
        const steps = Math.max(1, Math.min(6, Math.ceil(stepDist / 0.12)));
        const boost = game.rainbowSoapTimer > 0 ? 1.0 : 0.0;
        for (let s = 1; s <= steps; s++) {
          const sx = THREE.MathUtils.lerp(game.lastPointerWorld.x, c.x, s / steps);
          const sz = THREE.MathUtils.lerp(game.lastPointerWorld.z, c.z, s / steps);
          const uv = worldToTubUV(sx, sz);
          tubSurface.scrubAt(uv.u, uv.v, 0.22, 0.62 + boost * 0.22, boost);

          if (Math.random() < 0.85) {
            effects.spawnFoamPuff(sx, sz, boost, false);
          }
        }
        if (Math.random() < (boost > 0 ? 0.6 : 0.32)) {
          effects.spawnFloatingBubble(c.x, tubInnerY(c.x, c.z) + 0.28, c.z, boost > 0);
        }

        game.spongeSquash = 0.24;
        audio.setScrub(1.0, stepDist * 28);
        game.lastPointerWorld.set(c.x, 0, c.z);

        // Check if tub is thoroughly scrubbed & foamy -> seamlessly invite Shower Stage!
        const stats = tubSurface.getStats();
        if (stats.cleanRatio >= 0.68 && stats.foamRatio >= 0.46) {
          audio.setScrub(0, 0);
          game.dragMode = null;
          enterStage('rinse');
        }
      }
    }
  } else if (game.dragMode === 'shower') {
    updateShowerAimFromRay(ray);
  } else if (game.dragMode === 'mama_duck') {
    waterDragPlane.constant = -effects.waterLevelY;
    if (ray.intersectPlane(waterDragPlane, tmpVec)) {
      const c = clampInsideTub(tmpVec.x, tmpVec.z, 0.74);
      const dx = c.x - game.mama.x;
      const dz = c.z - game.mama.z;
      const moveD = Math.hypot(dx, dz);
      if (moveD > 0.02) {
        game.mama.vx = dx * 9;
        game.mama.vz = dz * 9;
        game.mama.x = THREE.MathUtils.lerp(game.mama.x, c.x, 0.45);
        game.mama.z = THREE.MathUtils.lerp(game.mama.z, c.z, 0.45);
        game.mama.angle = Math.atan2(-dz, dx);
        if (Math.random() < 0.35) {
          effects.addWaterRipple(game.mama.x, game.mama.z, 0.055);
          effects.spawnFloatingBubble(game.mama.x, effects.waterLevelY + 0.08, game.mama.z, false);
        }
        if (game.waterFill > 0.96 && Math.random() < 0.25) {
          triggerOverflowSplash(0.8);
        }
      }
    }
  } else if (game.dragMode === 'baby_duck' && game.dragBabyIdx >= 0) {
    const b = babyDucks[game.dragBabyIdx];
    waterDragPlane.constant = -effects.waterLevelY;
    if (ray.intersectPlane(waterDragPlane, tmpVec)) {
      const c = clampInsideTub(tmpVec.x, tmpVec.z, 0.78);
      const dx = c.x - b.x;
      const dz = c.z - b.z;
      b.x = THREE.MathUtils.lerp(b.x, c.x, 0.5);
      b.z = THREE.MathUtils.lerp(b.z, c.z, 0.5);
      if (Math.hypot(dx, dz) > 0.02) {
        b.angle = Math.atan2(-dz, dx);
        if (Math.random() < 0.25) effects.addWaterRipple(b.x, b.z, 0.04);
      }
    }
  }
});

function endPointer(e) {
  if (e.pointerId !== game.activePointerId) return;
  game.activePointerId = null;

  if (game.dragMode === 'sponge') {
    audio.setScrub(0, 0);
  }
  if (game.dragMode === 'shower') {
    game.showerSpraying = false;
    audio.setShower(false);
    if (game.stage === 'play') {
      game.showerTargetPos.copy(diorama.showerRestPos);
    }
  }
  if (game.dragMode === 'faucet') {
    // If held for > 0.45s, turn off on release; if quick tap, let autoTimer pour cleanly!
    if (game.time - game.pointerDownTime > 0.45) {
      game.faucetOn = false;
      game.faucetAutoTimer = 0;
      audio.setFaucet(false, game.waterFill);
    }
  }
  game.dragMode = null;
  game.dragBabyIdx = -1;
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function updateShowerAimFromRay(ray) {
  // Intersect with tub plane OR back wall if aimed high toward the steamy mirror!
  const pt = intersectTubPlane(ray, 0.42);
  if (pt) {
    const aimX = THREE.MathUtils.clamp(pt.x, -2.35, 2.15);
    const aimZ = THREE.MathUtils.clamp(pt.z, -2.2, 1.35);
    const aimY = aimZ < -1.3 ? 2.25 : tubInnerY(aimX, aimZ);
    game.showerAimWorld.set(aimX, aimY, aimZ);

    // Position the big chrome shower head gracefully above & slightly behind the spray target
    game.showerTargetPos.set(
      THREE.MathUtils.clamp(aimX - 0.32, -2.2, 1.65),
      aimZ < -1.3 ? 2.55 : 2.18,
      THREE.MathUtils.clamp(aimZ - 0.65, -2.05, 0.65)
    );
  }
}

// ============================================================
// 8. Main Animation Loop (Physics, Water, Ducks, Idle Demo)
// ============================================================
let lastTime = performance.now();
let fpsAccumulator = 0;
let fpsFrames = 0;
let currentFps = 60;

function animate(now) {
  requestAnimationFrame(animate);

  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(0.05, Math.max(0.001, rawDt));
  game.time += dt;
  game.idleTime += dt;

  fpsAccumulator += rawDt;
  fpsFrames++;
  if (fpsAccumulator >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAccumulator);
    fpsAccumulator = 0;
    fpsFrames = 0;
  }

  // 1. Update Sponge Physics & Stage 1 Breathing Cue
  if (game.rainbowSoapTimer > 0) {
    game.rainbowSoapTimer = Math.max(0, game.rainbowSoapTimer - dt);
  }
  const spongeLerp = Math.min(1, dt * (game.dragMode === 'sponge' ? 22 : 6));
  const prevSX = sponge.position.x;
  const prevSZ = sponge.position.z;
  sponge.position.lerp(game.spongeTarget, spongeLerp);

  const sVx = (sponge.position.x - prevSX) / dt;
  const sVz = (sponge.position.z - prevSZ) / dt;
  game.spongeSquash += (0 - game.spongeSquash) * Math.min(1, dt * 12);

  if (game.stage === 'scrub' && game.dragMode !== 'sponge') {
    // Subtle organic invitation bob on the sponge (no glowing outline!)
    const bob = Math.sin(game.time * 3.1) * 0.04;
    sponge.position.y = spongeHomeStart.y + Math.max(0, bob);
    sponge.rotation.z = Math.sin(game.time * 2.2) * 0.06;
    sponge.rotation.x = 0;
    if (Math.random() < dt * 0.7) {
      effects.spawnFloatingBubble(sponge.position.x, sponge.position.y + 0.35, sponge.position.z, false);
    }
  } else {
    sponge.rotation.z = THREE.MathUtils.clamp(-sVx * 0.08, -0.32, 0.32);
    sponge.rotation.x = THREE.MathUtils.clamp(sVz * 0.08, -0.32, 0.32);
  }
  const sq = game.spongeSquash;
  const restScale = game.stage === 'scrub' ? 1.0 : 0.72;
  sponge.scale.set((1 + sq * 0.45) * restScale, (1 - sq) * restScale, (1 + sq * 0.45) * restScale);

  if (game.dragMode !== 'sponge') {
    audio.setScrub(0, 0);
  }

  // 2. Soap Bottle Pump Animation
  if (game.soapPumpAnim > 0) {
    game.soapPumpAnim = Math.max(0, game.soapPumpAnim - dt * 3.5);
    const press = Math.sin(game.soapPumpAnim * Math.PI);
    diorama.soapPumpHead.position.y = 0.54 - press * 0.12;
    diorama.soapBottleGroup.scale.set(1 + press * 0.07, 1 - press * 0.07, 1 + press * 0.07);
  } else {
    diorama.soapPumpHead.position.y = 0.54;
    diorama.soapBottleGroup.scale.set(1, 1, 1);
  }

  // 3. Handheld Shower Head, Flexing Hose & Rinsing Stream!
  if (game.stage === 'rinse' && !game.showerSpraying) {
    // Inviting hover slightly forward from wall cradle + occasional glinting water droplet
    game.showerTargetPos.set(
      diorama.showerRestPos.x + 0.12,
      diorama.showerRestPos.y - 0.04 + Math.sin(game.time * 2.8) * 0.045,
      diorama.showerRestPos.z + 0.25
    );
    game.showerDripTimer -= dt;
    if (game.showerDripTimer <= 0) {
      game.showerDripTimer = 1.65;
      effects.spawnWaterDrop(
        diorama.showerHeadGroup.position.x,
        diorama.showerHeadGroup.position.y + 0.05,
        diorama.showerHeadGroup.position.z + 0.25,
        0.2,
        -0.4,
        0.6,
        0.048
      );
      audio.playDroplet();
    }
  }

  diorama.showerHeadGroup.position.lerp(game.showerTargetPos, Math.min(1, dt * 11));
  if (game.showerSpraying) {
    // Tilt the shower head smoothly toward the target spray zone
    const dir = game.showerAimWorld.clone().sub(diorama.showerHeadGroup.position).normalize();
    const targetRotY = Math.atan2(dir.x, dir.z);
    const targetRotX = THREE.MathUtils.clamp(-dir.y * 0.85 - 0.2, -0.3, 0.95);
    diorama.showerHeadGroup.rotation.y = THREE.MathUtils.lerp(diorama.showerHeadGroup.rotation.y, targetRotY, Math.min(1, dt * 14));
    diorama.showerHeadGroup.rotation.x = THREE.MathUtils.lerp(diorama.showerHeadGroup.rotation.x, targetRotX, Math.min(1, dt * 14));
    diorama.showerHeadGroup.rotation.z = 0;

    // Emit lush parabolic shower water streams!
    const faceWorld = new THREE.Vector3(0, 0.18, 0.26).applyMatrix4(diorama.showerHeadGroup.matrixWorld);
    const toTarget = game.showerAimWorld.clone().sub(faceWorld);
    const dist = Math.max(0.5, toTarget.length());
    const flightT = Math.min(0.45, Math.max(0.22, dist * 0.16));
    const baseVx = toTarget.x / flightT;
    const baseVz = toTarget.z / flightT;
    const baseVy = (toTarget.y + 0.5 * 9.8 * flightT * flightT) / flightT;

    for (let i = 0; i < 6; i++) {
      const spreadA = Math.random() * Math.PI * 2;
      const spreadR = Math.random() * 0.14;
      effects.spawnWaterDrop(
        faceWorld.x + Math.cos(spreadA) * spreadR,
        faceWorld.y + Math.sin(spreadA) * spreadR * 0.5,
        faceWorld.z + Math.sin(spreadA) * spreadR,
        baseVx + (Math.random() - 0.5) * 0.75,
        baseVy + (Math.random() - 0.5) * 0.55,
        baseVz + (Math.random() - 0.5) * 0.75,
        0.036 + Math.random() * 0.015,
        0xcbf4ff,
        2.6,
        flightT + 0.06
      );
    }

    // Apply physical rinsing effects where the shower hits!
    const aimX = game.showerAimWorld.x;
    const aimZ = game.showerAimWorld.z;

    // Discovery: Clearing the steamy mirror when sprayed!
    if (aimZ < -1.15 && Math.abs(aimX - (-0.22)) < 0.95) {
      if (mirrorTexture.clearSteam(dt * 0.75) && Math.random() < dt * 6) {
        effects.spawnSparkle(-0.22 + (Math.random() - 0.5) * 0.6, 2.58 + (Math.random() - 0.5) * 0.5, -2.18, 0xffffff, 0.35);
      }
    }

    // Discovery: Spraying Mama Duck on the ledge makes her shake & quack happily!
    const dMama = Math.hypot(aimX - mamaDuck.root.position.x, aimZ - mamaDuck.root.position.z);
    if (dMama < 0.85 && Math.random() < dt * 2.8) {
      mamaDuck.triggerQuack(0.7);
      audio.playDuckQuack(false, false);
      effects.spawnSplashBurst(mamaDuck.root.position.x, mamaDuck.root.position.y + 0.5, mamaDuck.root.position.z, 8, 1.8);
    }

    // Rinsing foam inside the bathtub!
    if (tubSuperellipseR(aimX, aimZ) <= 1.08) {
      const uv = worldToTubUV(aimX, aimZ);
      const rinsed = tubSurface.rinseAt(uv.u, uv.v, 0.22, dt * 4.4);
      const puffHits = effects.rinseFoamNear(aimX, aimZ, 0.88);
      audio.setShower(true, rinsed > 0.005 || puffHits > 0);

      // Sparkling glints on newly cleaned porcelain!
      if ((rinsed > 0.005 || puffHits > 0) && Math.random() < dt * 11) {
        effects.spawnSparkle(
          aimX + (Math.random() - 0.5) * 0.4,
          tubInnerY(aimX, aimZ) + 0.18,
          aimZ + (Math.random() - 0.5) * 0.4,
          0xffffff,
          0.34
        );
      }

      // Check completion of Rinse Stage!
      if (game.stage === 'rinse') {
        const stats = tubSurface.getStats();
        if (stats.foamRatio <= 0.18 && stats.dirtRatio <= 0.24) {
          enterStage('fill');
        }
      }
    } else {
      audio.setShower(true, false);
    }
  } else {
    const wob = game.showerWobble > 0 ? Math.sin(game.showerWobble * 28) * 0.18 * game.showerWobble : 0;
    game.showerWobble = Math.max(0, game.showerWobble - dt);
    const restPitch = game.stage === 'rinse' ? 0.28 : 0.08;
    diorama.showerHeadGroup.rotation.x = THREE.MathUtils.lerp(diorama.showerHeadGroup.rotation.x, restPitch, Math.min(1, dt * 8));
    diorama.showerHeadGroup.rotation.y = THREE.MathUtils.lerp(diorama.showerHeadGroup.rotation.y, 0.15, Math.min(1, dt * 8));
    diorama.showerHeadGroup.rotation.z = wob;
  }
  diorama.showerHeadGroup.updateMatrixWorld();
  diorama.updateShowerHose();

  // 4. Faucet, Drain Plug, Water Fill & Overflow Physics!
  if (game.faucetAutoTimer > 0 && game.dragMode !== 'faucet') {
    game.faucetAutoTimer = Math.max(0, game.faucetAutoTimer - dt);
    if (game.faucetAutoTimer <= 0) {
      game.faucetOn = false;
      audio.setFaucet(false, game.waterFill);
    }
  }

  // Stage 3 subtle inviting lever bob + glinting droplet at spout
  if (game.stage === 'fill' && !game.faucetOn) {
    const inviteBob = Math.sin(game.time * 3.4) * 0.12;
    diorama.faucetHandlePivot.rotation.z = inviteBob;
    game.faucetDripTimer -= dt;
    if (game.faucetDripTimer <= 0) {
      game.faucetDripTimer = 1.45;
      effects.spawnWaterDrop(
        diorama.faucetSpoutWorldPos.x,
        diorama.faucetSpoutWorldPos.y,
        diorama.faucetSpoutWorldPos.z,
        -0.12,
        -0.3,
        0,
        0.05
      );
      audio.playDroplet();
    }
  } else {
    const targetLever = game.faucetOn ? -0.52 : 0;
    game.faucetLeverAngle += (targetLever - game.faucetLeverAngle) * Math.min(1, dt * 12);
    const fw = game.faucetWobble > 0 ? Math.sin(game.faucetWobble * 26) * 0.2 * game.faucetWobble : 0;
    game.faucetWobble = Math.max(0, game.faucetWobble - dt);
    diorama.faucetHandlePivot.rotation.z = game.faucetLeverAngle + fw;
  }

  // Drain plug visual position + beaded brass chain
  const plugTarget = game.plugClosed
    ? new THREE.Vector3(TUB.drainX, TUB.floorY + 0.03, TUB.drainZ)
    : new THREE.Vector3(TUB.drainX - 0.36, TUB.floorY + 0.055, TUB.drainZ + 0.2);
  diorama.drainPlugGroup.position.lerp(plugTarget, Math.min(1, dt * 14));
  if (game.plugWobble > 0) {
    game.plugWobble = Math.max(0, game.plugWobble - dt);
    diorama.drainPlugGroup.rotation.z = Math.sin(game.plugWobble * 24) * 0.3 * game.plugWobble;
  } else {
    diorama.drainPlugGroup.rotation.z = game.plugClosed ? 0 : 0.24;
  }
  diorama.updatePlugChain();

  // Pouring water from faucet!
  effects.setFaucetStreamActive(game.faucetOn, diorama.faucetSpoutWorldPos, effects.waterLevelY, game.time);
  const isDraining = !game.plugClosed && game.waterFill > 0.005;

  if (game.faucetOn) {
    audio.setFaucet(true, game.waterFill);
    if (game.plugClosed) {
      game.waterFill = Math.min(1.06, game.waterFill + dt * 0.24);
    }
    // Splash droplets where pouring stream hits water
    const hitX = diorama.faucetSpoutWorldPos.x - 0.28;
    const hitZ = diorama.faucetSpoutWorldPos.z;
    if (Math.random() < dt * 18) {
      const pal = WATER_PALETTES[game.waterPaletteIdx];
      effects.spawnWaterDrop(
        hitX + (Math.random() - 0.5) * 0.14,
        effects.waterLevelY + 0.04,
        hitZ + (Math.random() - 0.5) * 0.14,
        (Math.random() - 0.5) * 1.4,
        1.1 + Math.random() * 0.9,
        (Math.random() - 0.5) * 1.4,
        0.042,
        pal.fizzHex,
        1.3,
        0.48
      );
    }
    if (Math.random() < dt * 5) {
      effects.addWaterRipple(hitX, hitZ, 0.055);
    }

    // Delightful OVERFLOW when filled right to the brim!
    if (game.waterFill >= 0.98) {
      game.overflowTimer += dt;
      if (game.overflowTimer > 0.06) {
        game.overflowTimer = 0;
        triggerOverflowSplash(1.0);
      }
    }

    // Enter Stage 4 (Duck Bath Party!) smoothly as soon as tub is nicely warm & full!
    if (game.stage === 'fill' && game.waterFill >= 0.72) {
      enterStage('play');
      // Keep pouring smoothly up to ~0.88 if auto-triggered, or let child hold for overflow!
      if (game.dragMode !== 'faucet') {
        game.faucetAutoTimer = Math.min(game.faucetAutoTimer, 0.65);
      }
    }
  } else if (isDraining) {
    game.waterFill = Math.max(0, game.waterFill - dt * 0.16);
    if (Math.random() < dt * 3.5) {
      audio.playDrainGurgle(0.18);
    }
  }

  // 5. Update Big Mama Rubber Duck & Trail for Baby Ducks
  const mamaExcited = game.stage === 'play' && !game.mama.inWater && !game.mama.jumping;
  mamaDuck.update(dt, game.time, mamaExcited);

  if (game.mama.jumping) {
    game.mama.jumpT = Math.min(1, game.mama.jumpT + dt * 1.85);
    const p = game.mama.jumpT;
    const x = THREE.MathUtils.lerp(game.mama.jumpStart.x, game.mama.jumpEnd.x, p);
    const z = THREE.MathUtils.lerp(game.mama.jumpStart.z, game.mama.jumpEnd.z, p);
    const arcY = Math.sin(p * Math.PI) * 1.15;
    const y = THREE.MathUtils.lerp(game.mama.jumpStart.y, effects.waterLevelY - 0.1, p) + arcY;
    mamaDuck.root.position.set(x, y, z);
    mamaDuck.root.rotation.z = Math.sin(p * Math.PI) * 0.35;

    if (p >= 1) {
      game.mama.jumping = false;
      game.mama.inWater = true;
      game.mama.x = game.mama.jumpEnd.x;
      game.mama.z = game.mama.jumpEnd.z;
      mamaDuck.root.rotation.z = 0;
      mamaDuck.triggerQuack(1.3);
      audio.playSplash(true);
      audio.playDuckQuack(false, false);
      const pal = WATER_PALETTES[game.waterPaletteIdx];
      effects.addWaterRipple(game.mama.x, game.mama.z, 0.14);
      effects.spawnSplashBurst(game.mama.x, effects.waterLevelY, game.mama.z, 24, 3.1, pal.fizzHex);
      triggerOverflowSplash(1.4);
    }
  } else if (game.mama.inWater) {
    if (game.dragMode !== 'mama_duck') {
      if (isDraining) {
        // Spin comically around the drain vortex!
        const dx = TUB.drainX - game.mama.x;
        const dz = TUB.drainZ - game.mama.z;
        const d = Math.hypot(dx, dz) + 0.01;
        game.mama.vx += ((dx / d) * 0.7 - (dz / d) * 1.4) * dt;
        game.mama.vz += ((dz / d) * 0.7 + (dx / d) * 1.4) * dt;
        game.mama.angle += dt * 2.2;
      } else {
        // Gentle cheerful figure-8 autonomous swim when not dragged!
        const targetX = TUB.centerX + Math.sin(game.time * 0.55) * 0.92;
        const targetZ = TUB.centerZ + Math.sin(game.time * 1.1) * 0.32;
        game.mama.vx += (targetX - game.mama.x) * dt * 0.85;
        game.mama.vz += (targetZ - game.mama.z) * dt * 0.85;
      }
      game.mama.vx *= 0.94;
      game.mama.vz *= 0.94;
      const next = clampInsideTub(game.mama.x + game.mama.vx * dt, game.mama.z + game.mama.vz * dt, 0.74);
      game.mama.x = next.x;
      game.mama.z = next.z;
      if (Math.hypot(game.mama.vx, game.mama.vz) > 0.08 && !isDraining) {
        const desired = Math.atan2(-game.mama.vz, game.mama.vx);
        game.mama.angle = lerpAngle(game.mama.angle, desired, Math.min(1, dt * 5));
      }
    }

    const waterFloatY = game.waterFill > 0.05 ? effects.waterLevelY - 0.11 : TUB.floorY + 0.01;
    const bob = game.waterFill > 0.05 ? Math.sin(game.time * 3.1) * 0.025 : 0;
    mamaDuck.root.position.set(game.mama.x, waterFloatY + bob, game.mama.z);
    mamaDuck.root.rotation.y = game.mama.angle;
    mamaDuck.root.rotation.z = Math.sin(game.time * 2.4) * 0.06;
    mamaDuck.root.rotation.x = Math.cos(game.time * 2.0) * 0.05;

    // Record breadcrumb trail for baby ducks to follow in a parade!
    const lastTr = game.mama.trail[0];
    if (!lastTr || Math.hypot(lastTr.x - game.mama.x, lastTr.z - game.mama.z) > 0.12) {
      game.mama.trail.unshift({ x: game.mama.x, z: game.mama.z });
      if (game.mama.trail.length > 48) game.mama.trail.pop();
    }
  } else if (mamaExcited) {
    // Eagerly hopping on the tub ledge wanting to jump into the warm bath!
    const hop = Math.abs(Math.sin(game.time * 5.2)) * 0.13;
    mamaDuck.root.position.set(mamaRestPos.x, mamaRestPos.y + hop, mamaRestPos.z);
    mamaDuck.root.rotation.y = -2.35 + Math.sin(game.time * 3.5) * 0.18;
  }

  // 6. Update 3 Baby Ducks (follow-the-leader parade behind Mama Duck!)
  const floatingDuckPositions = [];
  if (game.mama.inWater) floatingDuckPositions.push({ x: game.mama.x, z: game.mama.z });

  for (const b of babyDucks) {
    b.duck.update(dt, game.time + b.idx * 0.6, game.stage === 'play' && !b.inWater && game.mama.inWater);

    if (b.peepDelay > 0) {
      b.peepDelay -= dt;
      if (b.peepDelay <= 0) {
        b.duck.triggerQuack(0.75);
        audio.playDuckQuack(true, false);
        effects.addWaterRipple(b.x, b.z, 0.05);
      }
    }

    if (b.jumping) {
      b.jumpT = Math.min(1, b.jumpT + dt * 1.9);
      const p = b.jumpT;
      const x = THREE.MathUtils.lerp(b.jumpStart.x, b.jumpEnd.x, p);
      const z = THREE.MathUtils.lerp(b.jumpStart.z, b.jumpEnd.z, p);
      const y = THREE.MathUtils.lerp(b.jumpStart.y, effects.waterLevelY - 0.05, p) + Math.sin(p * Math.PI) * 1.1;
      b.duck.root.position.set(x, y, z);
      if (p >= 1) {
        b.jumping = false;
        b.inWater = true;
        b.x = b.jumpEnd.x;
        b.z = b.jumpEnd.z;
        b.duck.triggerQuack(0.9);
        audio.playSplash(false);
        audio.playDuckQuack(true, false);
        const pal = WATER_PALETTES[game.waterPaletteIdx];
        effects.addWaterRipple(b.x, b.z, 0.085);
        effects.spawnSplashBurst(b.x, effects.waterLevelY, b.z, 12, 2.0, pal.fizzHex);
      }
    } else if (b.inWater) {
      if (!(game.dragMode === 'baby_duck' && game.dragBabyIdx === b.idx)) {
        if (isDraining) {
          const dx = TUB.drainX - b.x;
          const dz = TUB.drainZ - b.z;
          const d = Math.hypot(dx, dz) + 0.01;
          b.vx += ((dx / d) * 0.9 - (dz / d) * 1.8) * dt;
          b.vz += ((dz / d) * 0.9 + (dx / d) * 1.8) * dt;
          b.angle += dt * 3.0;
        } else if (game.mama.inWater) {
          // Follow Mama Duck's wake in a cute trailing duckling line!
          const trailIdx = Math.min(game.mama.trail.length - 1, (b.idx + 1) * 5);
          const target =
            game.mama.trail[trailIdx] || {
              x: game.mama.x - Math.cos(game.mama.angle) * (0.58 + b.idx * 0.38),
              z: game.mama.z + Math.sin(game.mama.angle) * (0.58 + b.idx * 0.38),
            };
          const dx = target.x - b.x;
          const dz = target.z - b.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.24) {
            b.vx += (dx / dist) * dt * 2.1;
            b.vz += (dz / dist) * dt * 2.1;
          }
        } else {
          // Paddle in gentle circles if Mama hasn't jumped in yet
          const tx = TUB.centerX + Math.cos(game.time * 0.8 + b.bobPhase) * 0.75;
          const tz = TUB.centerZ + Math.sin(game.time * 0.8 + b.bobPhase) * 0.35;
          b.vx += (tx - b.x) * dt * 1.1;
          b.vz += (tz - b.z) * dt * 1.1;
        }

        // Soft separation between baby ducks so they never overlap
        for (const other of babyDucks) {
          if (other === b || !other.inWater) continue;
          const ox = b.x - other.x;
          const oz = b.z - other.z;
          const od = Math.hypot(ox, oz);
          if (od < 0.38 && od > 0.001) {
            b.vx += (ox / od) * dt * 2.8;
            b.vz += (oz / od) * dt * 2.8;
          }
        }

        b.vx *= 0.91;
        b.vz *= 0.91;
        const clamped = clampInsideTub(b.x + b.vx * dt, b.z + b.vz * dt, 0.8);
        b.x = clamped.x;
        b.z = clamped.z;
        if (Math.hypot(b.vx, b.vz) > 0.06 && !isDraining) {
          b.angle = lerpAngle(b.angle, Math.atan2(-b.vz, b.vx), Math.min(1, dt * 6));
        }
      }
      const fy = game.waterFill > 0.05 ? effects.waterLevelY - 0.05 : TUB.floorY + 0.01;
      const bob = game.waterFill > 0.05 ? Math.sin(game.time * 3.8 + b.bobPhase) * 0.018 : 0;
      b.duck.root.position.set(b.x, fy + bob, b.z);
      b.duck.root.rotation.y = b.angle;
      b.duck.root.rotation.z = Math.sin(game.time * 3.2 + b.bobPhase) * 0.07;
      floatingDuckPositions.push({ x: b.x, z: b.z });
    } else if (game.stage === 'play' && game.mama.inWater) {
      // Excited tiny bounces on the shelf once Mama is swimming!
      const hop = Math.abs(Math.sin(game.time * 4.5 + b.bobPhase)) * 0.045;
      b.duck.root.position.y = b.restPos.y + hop;
    }
  }

  // 7. Update Toy Sailboat
  if (toyBoat.jumping) {
    toyBoat.jumpT = Math.min(1, toyBoat.jumpT + dt * 1.8);
    const p = toyBoat.jumpT;
    toyBoat.mesh.position.set(
      THREE.MathUtils.lerp(toyBoat.jumpStart.x, toyBoat.jumpEnd.x, p),
      THREE.MathUtils.lerp(toyBoat.jumpStart.y, effects.waterLevelY - 0.03, p) + Math.sin(p * Math.PI) * 1.0,
      THREE.MathUtils.lerp(toyBoat.jumpStart.z, toyBoat.jumpEnd.z, p)
    );
    if (p >= 1) {
      toyBoat.jumping = false;
      toyBoat.inWater = true;
      toyBoat.x = toyBoat.jumpEnd.x;
      toyBoat.z = toyBoat.jumpEnd.z;
      audio.playSplash(false);
      effects.addWaterRipple(toyBoat.x, toyBoat.z, 0.09);
      effects.spawnSplashBurst(toyBoat.x, effects.waterLevelY, toyBoat.z, 12, 2.0);
    }
  } else if (toyBoat.inWater) {
    toyBoat.orbitPhase += dt * (isDraining ? 1.8 : 0.42);
    const tx = TUB.centerX + Math.cos(toyBoat.orbitPhase) * 1.05;
    const tz = TUB.centerZ + Math.sin(toyBoat.orbitPhase) * 0.42;
    const dx = tx - toyBoat.x;
    const dz = tz - toyBoat.z;
    toyBoat.x += dx * dt * 1.4;
    toyBoat.z += dz * dt * 1.4;
    toyBoat.angle = lerpAngle(toyBoat.angle, Math.atan2(-dz, dx), Math.min(1, dt * 3.5));
    const fy = game.waterFill > 0.05 ? effects.waterLevelY - 0.035 : TUB.floorY + 0.01;
    toyBoat.mesh.position.set(toyBoat.x, fy + Math.sin(game.time * 2.9) * 0.018, toyBoat.z);
    toyBoat.mesh.rotation.y = toyBoat.angle;
    toyBoat.mesh.rotation.z = Math.sin(game.time * 2.4) * 0.08 + (toyBoat.wobble > 0 ? Math.sin(toyBoat.wobble * 24) * 0.25 : 0);
  } else if (toyBoat.wobble > 0) {
    toyBoat.mesh.rotation.z = Math.sin(toyBoat.wobble * 24) * 0.2 * toyBoat.wobble;
  }
  toyBoat.wobble = Math.max(0, toyBoat.wobble - dt);

  // 8. Update Fizzy Pastel Bath Bombs!
  let anyFizzing = 0;
  for (const bomb of bathBombs) {
    if (bomb.state === 'shelf') {
      if (bomb.wobble > 0) {
        bomb.wobble = Math.max(0, bomb.wobble - dt);
        bomb.mesh.position.y = bomb.restPos.y + Math.abs(Math.sin(bomb.wobble * 22)) * 0.06;
      } else {
        bomb.mesh.position.y = bomb.restPos.y;
      }
    } else if (bomb.state === 'jumping') {
      bomb.t = Math.min(1, bomb.t + dt * 1.9);
      const p = bomb.t;
      bomb.mesh.position.set(
        THREE.MathUtils.lerp(bomb.jumpStart.x, bomb.jumpEnd.x, p),
        THREE.MathUtils.lerp(bomb.jumpStart.y, effects.waterLevelY, p) + Math.sin(p * Math.PI) * 1.15,
        THREE.MathUtils.lerp(bomb.jumpStart.z, bomb.jumpEnd.z, p)
      );
      if (p >= 1) {
        bomb.state = 'fizzing';
        bomb.t = 0;
        bomb.x = bomb.jumpEnd.x;
        bomb.z = bomb.jumpEnd.z;
        bomb.angle = Math.random() * Math.PI * 2;
        audio.playSplash(false);
        audio.playStageSparkle(false);

        // Shift bathwater palette to this bath bomb's dreamy color!
        game.waterPaletteIdx = bomb.paletteIdx;
        const pal = WATER_PALETTES[game.waterPaletteIdx];
        effects.setWaterTargetColor(pal.waterHex);
        effects.addWaterRipple(bomb.x, bomb.z, 0.12);
        effects.spawnSplashBurst(bomb.x, effects.waterLevelY, bomb.z, 18, 2.5, pal.fizzHex);
      }
    } else if (bomb.state === 'fizzing') {
      anyFizzing = 1;
      bomb.t += dt;
      bomb.angle += dt * 7.5;
      // Zoom wildly in fizzy spiral loops across the bathwater!
      const nx = bomb.x + Math.cos(bomb.angle) * dt * 1.6;
      const nz = bomb.z + Math.sin(bomb.angle) * dt * 1.2;
      const c = clampInsideTub(nx, nz, 0.76);
      bomb.x = c.x;
      bomb.z = c.z;

      const remain = Math.max(0, 1 - bomb.t / 3.4);
      bomb.mesh.scale.setScalar(0.15 + remain * 0.85);
      bomb.mesh.position.set(bomb.x, effects.waterLevelY - 0.02, bomb.z);
      bomb.mesh.rotation.x += dt * 12;
      bomb.mesh.rotation.y += dt * 9;

      const pal = WATER_PALETTES[bomb.paletteIdx];
      if (Math.random() < dt * 22) {
        effects.spawnWaterDrop(
          bomb.x + (Math.random() - 0.5) * 0.14,
          effects.waterLevelY + 0.04,
          bomb.z + (Math.random() - 0.5) * 0.14,
          (Math.random() - 0.5) * 1.3,
          1.2 + Math.random() * 0.9,
          (Math.random() - 0.5) * 1.3,
          0.048,
          pal.fizzHex,
          1.1,
          0.5
        );
      }
      if (Math.random() < dt * 7) {
        effects.spawnFloatingBubble(bomb.x, effects.waterLevelY + 0.1, bomb.z, false, pal.fizzHex);
        effects.spawnSparkle(bomb.x, effects.waterLevelY + 0.15, bomb.z, pal.fizzHex, 0.32);
      }

      if (remain <= 0.01) {
        bomb.state = 'respawning';
        bomb.t = 0;
        bomb.mesh.visible = false;
        // Cycle this shelf slot to a fresh color next time!
        bomb.paletteIdx = (bomb.paletteIdx + 2) % WATER_PALETTES.length;
        const nextPal = WATER_PALETTES[bomb.paletteIdx];
        bomb.mesh.children[0].material.color.setHex(nextPal.bombHex);
      }
    } else if (bomb.state === 'respawning') {
      bomb.t += dt;
      if (bomb.t > 2.2) {
        bomb.state = 'shelf';
        bomb.mesh.visible = true;
        bomb.mesh.position.copy(bomb.restPos);
        bomb.mesh.scale.setScalar(1);
      }
    }
  }
  audio.setFizz(anyFizzing);

  // 9. Idle-Only One-Time Hand Demonstration (after 10s of total inactivity!)
  if (
    game.idleTime > 10.0 &&
    game.demoShownForStage !== game.stage &&
    game.activePointerId === null &&
    !(game.stage === 'play' && game.mama.inWater)
  ) {
    game.demoShownForStage = game.stage;
    game.demoActive = true;
    game.demoT = 0;
    demoHand.group.visible = true;
  }

  if (game.demoActive) {
    game.demoT += dt;
    const dur = 2.6;
    const p = Math.min(1, game.demoT / dur);
    const fade = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
    demoHand.mat.opacity = fade * 0.85;

    if (game.stage === 'scrub') {
      const a = p * Math.PI * 2.2;
      demoHand.group.position.set(
        TUB.centerX - 0.55 + Math.cos(a) * 0.55,
        1.12,
        TUB.centerZ + Math.sin(a) * 0.35
      );
      demoHand.group.rotation.set(0.25, 0, Math.sin(a) * 0.2);
    } else if (game.stage === 'rinse') {
      demoHand.group.position.set(
        THREE.MathUtils.lerp(-1.45, 0.45, Math.sin(p * Math.PI)),
        2.05,
        THREE.MathUtils.lerp(-1.75, 0.2, Math.sin(p * Math.PI))
      );
      demoHand.group.rotation.set(0.3, 0.2, 0);
    } else if (game.stage === 'fill') {
      const lift = Math.sin(p * Math.PI) * 0.35;
      demoHand.group.position.set(
        diorama.faucetGroup.position.x - 0.12,
        diorama.faucetGroup.position.y + 0.85 + lift,
        diorama.faucetGroup.position.z + 0.15
      );
      demoHand.group.rotation.set(0.2, -0.4, 0);
    } else if (game.stage === 'play') {
      demoHand.group.position.set(
        THREE.MathUtils.lerp(mamaRestPos.x, TUB.centerX + 0.2, p),
        mamaRestPos.y + 0.8 + Math.sin(p * Math.PI) * 0.45,
        THREE.MathUtils.lerp(mamaRestPos.z, TUB.centerZ, p)
      );
      demoHand.group.rotation.set(0.3, -0.5, 0);
    }

    if (p >= 1) {
      game.demoActive = false;
      demoHand.group.visible = false;
    }
  }

  // 10. Redraw dynamic porcelain dirt/foam texture if dirty & update all 3D effects
  tubSurface.redraw();
  effects.update(dt, game.time, {
    waterFill: game.waterFill,
    draining: isDraining,
    duckPositions: floatingDuckPositions,
  });

  // 11. Render via Miniature Tilt-Shift Pipeline!
  pipeline.render(scene, camera);
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

// ============================================================
// 9. Clean Debug & Verification Handle (for automated visual QA)
// ============================================================
window.__BATH_GAME__ = {
  getStats: () => ({
    stage: game.stage,
    fps: currentFps,
    triangles: pipeline.lastSceneTriangles || renderer.info.render.triangles,
    calls: pipeline.lastSceneCalls || renderer.info.render.calls,
    dpr: renderer.getPixelRatio(),
    waterFill: Number(game.waterFill.toFixed(2)),
    surface: tubSurface.getStats(),
  }),
  // Helper for visual verification of every stage
  setStageForPreview: (mode) => {
    if (mode === 'scrub_mid') {
      resetFullGame();
      for (let i = 0; i < 45; i++) {
        const a = (i / 45) * Math.PI * 4;
        const r = 0.25 + (i / 45) * 0.45;
        const x = TUB.centerX + Math.cos(a) * r * 1.4;
        const z = TUB.centerZ + Math.sin(a) * r * 0.72;
        const uv = worldToTubUV(x, z);
        tubSurface.scrubAt(uv.u, uv.v, 0.16, 0.55, 0.8);
        effects.spawnFoamPuff(x, z, 0.8, false);
      }
      for (let i = 0; i < 12; i++) {
        effects.spawnFloatingBubble(
          TUB.centerX + (Math.random() - 0.5) * 2.2,
          1.2 + Math.random() * 0.9,
          TUB.centerZ + (Math.random() - 0.5) * 0.9,
          i % 3 === 0
        );
      }
      game.spongeTarget.set(-0.25, tubInnerY(-0.25, 0.35) + 0.04, 0.35);
      sponge.position.copy(game.spongeTarget);
      tubSurface.redraw();
    } else if (mode === 'rinse_mid') {
      resetFullGame();
      for (let i = 0; i < 95; i++) {
        const x = TUB.centerX + (Math.random() - 0.5) * 2.9;
        const z = TUB.centerZ + (Math.random() - 0.5) * 1.4;
        if (tubSuperellipseR(x, z) > 0.88) continue;
        const uv = worldToTubUV(x, z);
        tubSurface.scrubAt(uv.u, uv.v, 0.18, 0.9, 0.4);
        effects.spawnFoamPuff(x, z, 0.3, false);
      }
      enterStage('rinse');
      sponge.position.copy(spongeHomeStool);
      game.spongeTarget.copy(spongeHomeStool);
      game.showerSpraying = true;
      game.showerAimWorld.set(0.15, 0.35, 0.25);
      game.showerTargetPos.set(-0.25, 2.15, -0.35);
      diorama.showerHeadGroup.position.copy(game.showerTargetPos);
      // Rinse right half so gleam & foam contrast clearly
      for (let i = 0; i < 14; i++) {
        const rx = 0.25 + (i % 5) * 0.28;
        const rz = -0.15 + Math.floor(i / 5) * 0.32;
        const uv = worldToTubUV(rx, rz);
        tubSurface.rinseAt(uv.u, uv.v, 0.2, 0.95);
        effects.rinseFoamNear(rx, rz, 0.65);
      }
      tubSurface.redraw();
    } else if (mode === 'play_ducks') {
      resetFullGame();
      enterStage('rinse');
      enterStage('fill');
      game.waterFill = 0.88;
      game.faucetOn = false;
      enterStage('play');
      sponge.position.copy(spongeHomeStool);
      game.spongeTarget.copy(spongeHomeStool);
      // Place Mama Duck + all 3 baby ducks + boat + bubble foam islands right in the warm bath!
      game.mama.inWater = true;
      game.mama.x = 0.25;
      game.mama.z = 0.28;
      game.mama.angle = -2.6;
      mamaDuck.triggerQuack(3.0);
      babyDucks[0].inWater = true;
      babyDucks[0].x = -0.58;
      babyDucks[0].z = 0.12;
      babyDucks[0].angle = -0.25;
      babyDucks[1].inWater = true;
      babyDucks[1].x = -1.05;
      babyDucks[1].z = 0.42;
      babyDucks[1].angle = 0.15;
      babyDucks[2].inWater = true;
      babyDucks[2].x = 0.98;
      babyDucks[2].z = 0.46;
      babyDucks[2].angle = -2.4;
      toyBoat.inWater = true;
      toyBoat.x = -0.35;
      toyBoat.z = -0.22;
      for (let i = 0; i < 14; i++) {
        effects.spawnFloatingBubble(
          TUB.centerX + (Math.random() - 0.5) * 2.5,
          1.35 + Math.random() * 0.85,
          TUB.centerZ + (Math.random() - 0.5) * 1.1,
          i % 3 === 0
        );
      }
      for (let i = 0; i < 16; i++) {
        effects.spawnFoamPuff(
          TUB.centerX + (Math.random() - 0.5) * 2.4,
          TUB.centerZ + (Math.random() - 0.5) * 1.0,
          0.9,
          true
        );
      }
      effects.addWaterRipple(0.25, 0.28, 0.08);
      effects.addWaterRipple(-0.58, 0.12, 0.06);
      replayBtn.classList.remove('hidden');
    } else if (mode === 'hero_thumb') {
      // Iconic hero shot showing ALL elements of the bath-clean story at once:
      // Sparkling warm turquoise bathwater + Big Mama Duck + Baby Ducks + Floating Iridescent Bubbles + Sponge + Faucet + Shower + Miniature Tilt-Shift Diorama!
      resetFullGame();
      enterStage('rinse');
      enterStage('fill');
      game.waterFill = 0.86;
      game.faucetOn = true;
      game.faucetAutoTimer = 99;
      enterStage('play');
      sponge.position.copy(spongeHomeStart);
      game.spongeTarget.copy(spongeHomeStart);

      game.mama.inWater = true;
      game.mama.x = 0.05;
      game.mama.z = 0.32;
      game.mama.angle = -2.45;
      mamaDuck.triggerQuack(99);

      babyDucks[0].inWater = true;
      babyDucks[0].x = -0.78;
      babyDucks[0].z = 0.14;
      babyDucks[0].angle = -0.2;

      babyDucks[1].inWater = true;
      babyDucks[1].x = -1.24;
      babyDucks[1].z = 0.44;
      babyDucks[1].angle = 0.25;

      toyBoat.inWater = true;
      toyBoat.x = 0.72;
      toyBoat.z = -0.18;

      for (let i = 0; i < 18; i++) {
        effects.spawnFloatingBubble(
          TUB.centerX + (Math.random() - 0.5) * 2.7,
          1.35 + Math.random() * 0.95,
          TUB.centerZ + (Math.random() - 0.5) * 1.1,
          i % 3 === 0
        );
      }
      for (let i = 0; i < 24; i++) {
        effects.spawnFoamPuff(
          TUB.centerX + (Math.random() - 0.5) * 2.5,
          TUB.centerZ + (Math.random() - 0.5) * 1.05,
          0.8,
          true
        );
      }
      for (let i = 0; i < 8; i++) {
        effects.spawnSparkle(
          TUB.centerX + (Math.random() - 0.5) * 2.5,
          1.25 + Math.random() * 0.7,
          TUB.centerZ + (Math.random() - 0.5) * 1.0,
          0xffffff,
          0.45
        );
      }
      effects.addWaterRipple(0.05, 0.32, 0.08);
      mirrorTexture.clearSteam(0.8);
      replayBtn.classList.add('hidden'); // clean wordless, UI-free hero thumbnail!
    }
  },
};

const previewMode = new URLSearchParams(window.location.search).get('preview');
if (previewMode) {
  window.__BATH_GAME__.setStageForPreview(previewMode);
}

requestAnimationFrame(animate);
