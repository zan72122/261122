import { THREE, clayMat, SquashSpring } from './clay.js';
import { sound } from './audio.js';
import { createClayFamily, createForegroundTofuHands } from './characters.js';
import {
  createKitchenStage,
  createPotSystem,
  createWaterFaucet,
  createDashiTray,
  TofuPalmController,
  createWakameAndGarnishStation,
  createSwellingWakamePiece,
  buildFlowerCarrotMesh,
  buildUzumakiFuMesh,
  buildNegiRingMesh,
  createMisoAndLadleSystem,
  createSoupBowl,
  createReplayPotButton,
} from './potAndFood.js';

const canvas = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({
  canvas,
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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5e3cc);
scene.fog = new THREE.Fog(0xf5e3cc, 24.0, 38.0);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 30);

// Studio Tabletop Claymation Lighting (warm softbox key + caramel bounce fill + soft rim)
const hemiLight = new THREE.HemisphereLight(0xfff8eb, 0xdba173, 1.18);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.05);
keyLight.position.set(-3.4, 6.8, 4.6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 16.0;
keyLight.shadow.camera.left = -4.2;
keyLight.shadow.camera.right = 4.2;
keyLight.shadow.camera.top = 4.2;
keyLight.shadow.camera.bottom = -4.2;
keyLight.shadow.bias = -0.0008;
keyLight.shadow.radius = 3.0;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffe2b5, 0.78);
rimLight.position.set(2.8, 4.2, -3.5);
scene.add(rimLight);

// Build World & Characters
createKitchenStage(scene);
const family = createClayFamily(scene);
const pot = createPotSystem(scene);
const faucet = createWaterFaucet(scene);
const dashi = createDashiTray(scene);
const tofuHands = createForegroundTofuHands(scene);
const tofuCtrl = new TofuPalmController(tofuHands.tofuMount, pot);
const wakameStation = createWakameAndGarnishStation(scene);
const misoSys = createMisoAndLadleSystem(scene);
const replayBtn = createReplayPotButton(scene);

// Serving Bowl Coaster on foreground counter
const coasterMat = clayMat(0xd9b37c, { roughness: 0.82, warmth: 0.18 });
const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.05, 24), coasterMat);
coaster.position.set(1.38, 0.025, 1.38);
coaster.receiveShadow = true;
coaster.visible = false;
scene.add(coaster);

// Subtle stop-motion clay helper hand for >10s idle gentle nudge (once per stage only!)
const hintHand = new THREE.Group();
hintHand.visible = false;
{
  const hMat = clayMat(0xffe3cf, { roughness: 0.68, warmth: 0.25, transparent: true, opacity: 0.88 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), hMat);
  palm.scale.set(1.0, 0.7, 1.15);
  const idx = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 6, 10), hMat);
  idx.rotation.x = Math.PI * 0.35;
  idx.position.set(0, -0.08, -0.20);
  hintHand.add(palm, idx);
}
scene.add(hintHand);

// Flying arc animations (e.g. dashi, wakame, garnish, ladle scoop, bowl handoff)
const flyingArcs = []; // { mesh, start, mid, end, t, dur, onDone }
function launchArc(mesh, startWorld, endWorld, lift = 1.15, dur = 0.46, onDone = null) {
  const mid = startWorld.clone().lerp(endWorld, 0.5);
  mid.y = Math.max(startWorld.y, endWorld.y) + lift;
  scene.attach(mesh);
  mesh.position.copy(startWorld);
  flyingArcs.push({ mesh, start: startWorld.clone(), mid, end: endWorld.clone(), t: 0, dur, onDone });
}

// Game Progression & Recipe Memory State
const game = {
  stage: 'water', // 'water' | 'dashi' | 'tofu' | 'wakame' | 'miso' | 'serve'
  idleTime: 0,
  idleDemoShown: false,
  waterHolding: false,
  waterTapBurst: 0,
  overflowTriggered: false,

  kombuAdded: false,
  katsuoAdded: false,
  dashiSteepTimer: 0,
  dashiFinishing: false,

  knifeAnim: null, // { t, dur, startPos, cutPos, rotY }
  palmTiltAnim: 0, // 0..1 when tipping tofu into pot

  wakameCount: 0,
  hasFlower: false,
  hasFu: false,
  hasNegi: false,
  wakameReadyTimer: 0,

  misoInLadle: false,
  misoScoops: 0,
  misoDissolveProgress: 0, // 0..1

  activeBowl: null,
  nextBowlTimer: 0,
  ladlePourAnim: null, // { t, dur }
  celebrationDone: false,
};

// Camera framing targets (smoothly adapts to portrait vs landscape AND stage!)
const camGoalPos = new THREE.Vector3();
const camGoalLook = new THREE.Vector3();
const camCurrentLook = new THREE.Vector3(0, 0.72, -0.05);

function computeCameraTargets(customW = null, customH = null) {
  const w = customW || window.innerWidth;
  const h = customH || window.innerHeight;
  const aspect = w / Math.max(1, h);
  // Scale camera distance inversely on narrow portrait screens so full 4.8-unit stage width never clips!
  const widthScale = aspect < 1.05 ? Math.min(2.15, 1.05 / Math.max(0.43, aspect)) : 1.0;

  camera.aspect = aspect;
  camera.fov = 39;
  camera.updateProjectionMatrix();

  if (game.stage === 'tofu') {
    camGoalPos.set(0, 4.18 * widthScale, 4.85 * widthScale);
    camGoalLook.set(0.02, 1.05, -0.12);
  } else if (game.stage === 'serve') {
    camGoalPos.set(0, 4.52 * widthScale, 5.58 * widthScale);
    camGoalLook.set(0, 0.72, -0.04);
  } else {
    camGoalPos.set(0, 4.55 * widthScale, 5.58 * widthScale);
    camGoalLook.set(0, 0.72, -0.04);
  }
}

computeCameraTargets();
camera.position.copy(camGoalPos);
camCurrentLook.copy(camGoalLook);
camera.lookAt(camCurrentLook);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  computeCameraTargets();
});

// Stage Transition Helper
function enterStage(nextStage) {
  game.stage = nextStage;
  game.idleTime = 0;
  game.idleDemoShown = false;
  hintHand.visible = false;
  computeCameraTargets();

  if (nextStage === 'dashi') {
    sound.setWaterPouring(false);
    game.waterHolding = false;
    game.waterTapBurst = 0;
    faucet.streamMesh.visible = false;
    dashi.traySquash.impulse(2.4);
    family.members.forEach((m) => m.setMood('curious', 1.2));
  } else if (nextStage === 'tofu') {
    tofuHands.group.visible = true;
    tofuHands.palmPivot.position.set(-0.22, 2.55, 0.65);
    tofuHands.palmPivot.rotation.set(0, 0, 0);
    tofuHands.palmSquash.impulse(-2.5);
    tofuCtrl.spawnFreshBlock();
    game.palmTiltAnim = 0;
    sound.playTofuJiggle();
    family.members.forEach((m) => m.setMood('excited', 1.6));
  } else if (nextStage === 'wakame') {
    tofuHands.group.visible = false;
    wakameStation.station.visible = true;
    wakameStation.wakameBowlGroup.position.set(-0.92, 0.04, 1.62);
    wakameStation.garnishGroup.position.set(0.95, 0.04, 1.64);
    wakameStation.wakameSquash.impulse(2.4);
    wakameStation.garnishSquash.impulse(2.0);
  } else if (nextStage === 'miso') {
    // Keep wakame & garnish accessible on left while Miso Crock & Ladle take center-right!
    misoSys.crockGroup.visible = true;
    misoSys.crockGroup.position.set(1.36, 0.04, 1.44);
    misoSys.paddleGroup.visible = true;
    misoSys.scoopDollop.visible = true;
    misoSys.ladleGroup.visible = true;
    misoSys.ladleGroup.position.set(0.32, pot.getSoupY() + 0.08, 0.12);
    misoSys.ladleMiso.visible = false;
    misoSys.ladleSoup.visible = false;
    misoSys.crockSquash.impulse(2.5);
    sound.playMarimba(587.33, 0.18, 0.28);
  } else if (nextStage === 'serve') {
    wakameStation.station.visible = false;
    misoSys.crockGroup.visible = false;
    misoSys.ladleMiso.visible = false;
    misoSys.ladleGroup.visible = true;
    misoSys.ladleGroup.position.set(0.52, pot.getSoupY() + 0.14, 0.14);
    coaster.visible = true;
    spawnNextEmptyBowl();
    family.members.forEach((m) => {
      m.setMood('sniff', 1.6);
    });
    sound.playVoice('girl', 'sniff');
  }
}

function getSoupTraits() {
  const hasGiantTofu = pot.state.floatingItems.some((it) => it.type === 'tofu' && it.isGiant);
  return {
    hasGiantTofu,
    wakameCount: game.wakameCount,
    hasFlower: game.hasFlower,
    hasFu: game.hasFu,
    hasNegi: game.hasNegi,
  };
}

function spawnNextEmptyBowl() {
  if (game.activeBowl) return;
  const soupHex = pot.state.misoAmount > 1.05 ? 0xb86b27 : 0xd18838;
  const bowl = createSoupBowl(soupHex, getSoupTraits());
  bowl.position.set(1.38, 0.05, 1.38);
  bowl.userData.squash.impulse(2.6);
  scene.add(bowl);
  game.activeBowl = bowl;
}

function resetWholeGame() {
  sound.playMarimba(523.25, 0.2, 0.25, 0);
  sound.playMarimba(659.25, 0.2, 0.25, 0.08);
  sound.playMarimba(783.99, 0.22, 0.3, 0.16);

  pot.resetPot();
  tofuCtrl.clear();
  tofuHands.group.visible = false;
  wakameStation.station.visible = false;
  misoSys.crockGroup.visible = false;
  misoSys.ladleGroup.visible = false;
  coaster.visible = false;
  replayBtn.group.visible = false;

  if (game.activeBowl) {
    scene.remove(game.activeBowl);
    game.activeBowl = null;
  }

  for (const m of family.members) {
    m.clearBowl();
    m.servedCount = 0;
    m.setMood('curious', 1.0);
  }

  faucet.group.visible = true;
  faucet.group.position.set(-1.68, 0.0, 0.22);
  faucet.group.rotation.y = 0;

  dashi.trayGroup.visible = true;
  dashi.trayGroup.position.set(1.52, 0.04, 1.55);
  dashi.kombuGroup.visible = true;
  dashi.kombuGroup.position.set(-0.36, 0.18, 0);
  dashi.trayGroup.add(dashi.kombuGroup);
  dashi.katsuoGroup.visible = true;
  dashi.katsuoGroup.position.set(0.38, 0.22, 0.02);
  dashi.trayGroup.add(dashi.katsuoGroup);

  Object.assign(game, {
    stage: 'water',
    idleTime: 0,
    idleDemoShown: false,
    waterHolding: false,
    waterTapBurst: 0,
    overflowTriggered: false,
    kombuAdded: false,
    katsuoAdded: false,
    dashiSteepTimer: 0,
    dashiFinishing: false,
    knifeAnim: null,
    palmTiltAnim: 0,
    wakameCount: 0,
    hasFlower: false,
    hasFu: false,
    hasNegi: false,
    wakameReadyTimer: 0,
    misoInLadle: false,
    misoScoops: 0,
    misoDissolveProgress: 0,
    activeBowl: null,
    ladlePourAnim: null,
    celebrationDone: false,
  });

  computeCameraTargets();
}

// ============================================================================
// Single-Finger Pointer Interaction System (Multi-touch safe, generous hitboxes!)
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.95);
const palmPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.92);

const pointer = {
  active: false,
  id: null,
  startNDC: new THREE.Vector2(),
  currNDC: new THREE.Vector2(),
  worldHit: new THREE.Vector3(0, 0.9, 0.4),
  dragKind: null, // 'faucet' | 'dashi' | 'tofuSlice' | 'palmTilt' | 'wakamePick' | 'misoStir' | 'ladle' | 'bowl'
  dragPayload: null,
  dragMesh: null,
  lastStirAngle: null,
  tofuStartLocal: null,
  movedDistPx: 0,
  startScreen: { x: 0, y: 0 },
};

function updateRayFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  raycaster.ray.intersectPlane(groundPlane, pointer.worldHit);
}

function distScreenNorm(worldPos) {
  const p = worldPos.clone().project(camera);
  return Math.hypot(p.x - pointerNDC.x, p.y - pointerNDC.y);
}

function worldPosOf(obj) {
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  return v;
}

// Actions for spawning ingredients
function dropDashiItem(type) {
  if (type === 'kombu' && !game.kombuAdded) {
    game.kombuAdded = true;
    const start = worldPosOf(dashi.kombuGroup);
    const end = new THREE.Vector3(-0.28, pot.getSoupY() + 0.04, 0.25);
    sound.playClayBoop(0.95, 0.2);
    launchArc(dashi.kombuGroup, start, end, 0.95, 0.42, () => {
      pot.root.attach(dashi.kombuGroup);
      pot.addRipple(-0.28, -0.05, 0.08);
      pot.spawnSplash(-0.28, -0.05, 8, pot.state.dashiAmount > 0.2, 1.0);
      sound.playPlop(1.25);
      pot.state.heatOn = true;
      pot.potSquash.impulse(-1.4);
      sound.playDashiBloom();
      family.mom.setMood('excited', 1.4);
    });
  } else if (type === 'katsuo' && !game.katsuoAdded) {
    game.katsuoAdded = true;
    const start = worldPosOf(dashi.katsuoGroup);
    const end = new THREE.Vector3(0.30, pot.getSoupY() + 0.05, 0.35);
    sound.playClayBoop(1.15, 0.2);
    launchArc(dashi.katsuoGroup, start, end, 0.95, 0.42, () => {
      pot.root.attach(dashi.katsuoGroup);
      pot.addRipple(0.30, 0.03, 0.08);
      pot.spawnSplash(0.30, 0.03, 8, true, 1.0);
      sound.playPlop(1.15);
      pot.state.heatOn = true;
      pot.potSquash.impulse(-1.4);
      sound.playDashiBloom();
      family.dad.setMood('sniff', 1.6);
      family.girl.setMood('wow', 1.5);
    });
  }
}

function tossWakameOrGarnish(pickType, customStartWorld = null) {
  const angle = Math.random() * Math.PI * 2;
  const rad = 0.18 + Math.random() * 0.72;
  const endLocal = new THREE.Vector3(Math.cos(angle) * rad, pot.getSoupY() + 0.05, Math.sin(angle) * rad);
  const endWorld = pot.root.localToWorld(endLocal.clone());

  if (pickType === 'wakame') {
    wakameStation.wakameSquash.impulse(-2.4);
    const piece = createSwellingWakamePiece();
    const start = customStartWorld || worldPosOf(wakameStation.wakameBowlGroup).add(new THREE.Vector3(0, 0.32, 0));
    sound.playClayBoop(1.3, 0.15);
    game.wakameCount++;
    const countNow = game.wakameCount;

    launchArc(piece.root, start, endWorld, 0.9, 0.38, () => {
      scene.remove(piece.root);
      piece.root.position.set(endLocal.x, pot.getSoupY() + 0.04, endLocal.z);
      piece.root.scale.setScalar(0.24);
      pot.addFloatingIngredient({
        mesh: piece.root,
        crinkledMesh: piece.crinkledMesh,
        unfurledMesh: piece.unfurledMesh,
        type: 'wakame',
        swellProg: 0.01,
        sizeFactor: 0.75,
        baseScale: 1.0,
        falling: false,
        angle,
        dist: rad,
        bobPhase: Math.random() * Math.PI * 2,
        floatOffset: 0.01,
        squash: new SquashSpring(190, 12),
      });
      pot.addRipple(endLocal.x, endLocal.z, 0.05);
      sound.playWakameSwell(countNow);
      if (countNow >= 6) {
        // Wakame jungle discovery!
        family.girl.setMood('wow', 1.4);
        sound.playVoice('girl', 'giggle');
      } else if (countNow === 1) {
        family.mom.setMood('excited', 1.2);
      }
    });
  } else {
    wakameStation.garnishSquash.impulse(-2.2);
    let mesh;
    if (pickType === 'carrot') {
      mesh = buildFlowerCarrotMesh();
      game.hasFlower = true;
    } else if (pickType === 'fu') {
      mesh = buildUzumakiFuMesh();
      game.hasFu = true;
    } else {
      mesh = buildNegiRingMesh();
      game.hasNegi = true;
    }
    const start = customStartWorld || worldPosOf(wakameStation.garnishGroup).add(new THREE.Vector3(0, 0.22, 0));
    sound.playMarimba(783.99, 0.18, 0.24);
    launchArc(mesh, start, endWorld, 0.85, 0.38, () => {
      scene.remove(mesh);
      mesh.position.set(endLocal.x, pot.getSoupY() + 0.03, endLocal.z);
      pot.addFloatingIngredient({
        mesh,
        type: pickType,
        sizeFactor: 0.7,
        baseScale: 1.0,
        falling: false,
        angle,
        dist: rad,
        bobPhase: Math.random() * Math.PI * 2,
        floatOffset: 0.02,
        squash: new SquashSpring(200, 13),
      });
      pot.addRipple(endLocal.x, endLocal.z, 0.045);
      sound.playPlop(0.75);
      family.girl.setMood('excited', 1.3);
    });
  }
}

function addMisoScoopToLadle() {
  if (game.misoScoops >= 2) return;
  game.misoScoops++;
  game.misoInLadle = true;
  game.misoDissolveProgress = Math.min(0.45, game.misoDissolveProgress);
  misoSys.crockSquash.impulse(-2.5);
  sound.playMisoSquish();

  const tempBall = misoSys.scoopDollop.clone();
  const start = worldPosOf(misoSys.scoopDollop);
  const end = worldPosOf(misoSys.ladleGroup);
  if (game.misoScoops >= 2) {
    misoSys.scoopDollop.visible = false;
  }

  launchArc(tempBall, start, end, 0.65, 0.32, () => {
    scene.remove(tempBall);
    misoSys.ladleMiso.visible = true;
    misoSys.ladleMiso.scale.setScalar(1.0 + (game.misoScoops - 1) * 0.2);
    pot.addRipple(0.25, 0.0, 0.06);
    sound.playPlop(1.1);
  });
}

function triggerLadleScoopIntoBowl() {
  if (!game.activeBowl || game.ladlePourAnim) return;
  if (game.activeBowl.userData.fillAmount >= 2) return;
  game.ladlePourAnim = { t: 0, dur: 0.72 };
  sound.playPlop(0.95);
}

function handActiveBowlToMember(member) {
  if (!game.activeBowl || game.activeBowl.userData.fillAmount <= 0 || game.ladlePourAnim) return;
  if (member.eatingSeq) return; // Still sipping current bowl!

  // If member already finished an earlier bowl (seconds / おかわり!), clear the old finished bowl first
  if (member.heldBowl) {
    member.clearBowl();
  }

  const bowl = game.activeBowl;
  game.activeBowl = null;

  const start = worldPosOf(bowl);
  const end = member.root.localToWorld(new THREE.Vector3(0, 0.82, 0.92));
  sound.playMarimba(659.25, 0.18, 0.25);

  launchArc(bowl, start, end, 0.55, 0.42, () => {
    member.receiveBowl(bowl, getSoupTraits());
    game.nextBowlTimer = 0.42;
  });
}

function startTippingTofuIntoPot() {
  if (tofuCtrl.isTipping || tofuCtrl.pieces.length === 0) return;
  tofuCtrl.isTipping = true;
  game.palmTiltAnim = 0.001;
  sound.playMarimba(659.25, 0.18, 0.25);
  family.members.forEach((m) => m.setMood('wow', 1.5));
}

// Pointer Down
canvas.addEventListener('pointerdown', (e) => {
  if (pointer.active) return; // Strictly 1-finger; ignore extra resting fingers cleanly!
  sound.unlock();
  canvas.setPointerCapture(e.pointerId);

  pointer.active = true;
  pointer.id = e.pointerId;
  pointer.movedDistPx = 0;
  pointer.startScreen.x = e.clientX;
  pointer.startScreen.y = e.clientY;
  pointer.dragKind = null;
  pointer.dragPayload = null;
  pointer.lastStirAngle = null;

  updateRayFromEvent(e);
  pointer.startNDC.copy(pointerNDC);
  pointer.currNDC.copy(pointerNDC);

  game.idleTime = 0;
  hintHand.visible = false;

  const hits = raycaster.intersectObjects(scene.children, true);

  // Check Replay Mini-Pot Button first if visible
  if (replayBtn.group.visible) {
    const hitReplay = hits.some((h) => h.object.userData.isReplay) ||
      distScreenNorm(worldPosOf(replayBtn.group).add(new THREE.Vector3(0, 0.2, 0))) < 0.18;
    if (hitReplay) {
      replayBtn.squash.impulse(-3.0);
      resetWholeGame();
      return;
    }
  }

  // Stage-specific primary interactions (with forgiving screen-space magnet radius!)
  if (game.stage === 'water') {
    const faucetCenter = worldPosOf(faucet.handlePivot);
    const spoutPos = faucet.getSpoutWorldPos();
    const hitFaucet =
      hits.some((h) => h.object.userData.isFaucet) ||
      distScreenNorm(faucetCenter) < 0.25 ||
      distScreenNorm(spoutPos) < 0.22 ||
      hits.some((h) => h.object.userData.isPot || h.object.userData.isSoup);

    // Check if child tapped the waiting Dashi tray early -> small cute wiggle ("他は小さく揺れる")
    const hitEarlyDashi = hits.some((h) => h.object.userData.dashiType) ||
      distScreenNorm(worldPosOf(dashi.trayGroup)) < 0.18;
    if (hitEarlyDashi && !hits.some((h) => h.object.userData.isFaucet)) {
      dashi.traySquash.impulse(-1.4);
      sound.playClayBoop(1.35, 0.10);
      return;
    }

    if (hitFaucet) {
      pointer.dragKind = 'faucet';
      game.waterHolding = true;
      game.waterTapBurst = 0.42; // Even a quick tap pours a generous splash!
      faucet.squash.impulse(-2.2);
      return;
    }
  } else if (game.stage === 'dashi') {
    if (!game.kombuAdded && distScreenNorm(worldPosOf(dashi.kombuGroup)) < 0.24) {
      pointer.dragKind = 'dashi';
      pointer.dragPayload = 'kombu';
      dashi.kombuSquash.impulse(-2.2);
      return;
    }
    if (!game.katsuoAdded && distScreenNorm(worldPosOf(dashi.katsuoGroup)) < 0.24) {
      pointer.dragKind = 'dashi';
      pointer.dragPayload = 'katsuo';
      dashi.katsuoSquash.impulse(-2.2);
      return;
    }
    // Check raycast hit directly
    const dashiHit = hits.find((h) => h.object.userData.dashiType);
    if (dashiHit) {
      const t = dashiHit.object.userData.dashiType;
      if ((t === 'kombu' && !game.kombuAdded) || (t === 'katsuo' && !game.katsuoAdded)) {
        pointer.dragKind = 'dashi';
        pointer.dragPayload = t;
        return;
      }
    }
  } else if (game.stage === 'tofu') {
    if (!tofuCtrl.isTipping) {
      const palmWorld = new THREE.Vector3();
      raycaster.ray.intersectPlane(palmPlane, palmWorld);
      const local = tofuHands.tofuMount.worldToLocal(palmWorld.clone());
      pointer.tofuStartLocal = local.clone();
      pointer.dragKind = 'tofuSlice';
      tofuHands.palmSquash.impulse(-0.9);
      return;
    }
  } else if (game.stage === 'wakame') {
    // Check garnish items first if close
    const pickHit = hits.find((h) => h.object.userData.pickType);
    if (pickHit) {
      pointer.dragKind = 'wakamePick';
      pointer.dragPayload = pickHit.object.userData.pickType;
      return;
    }
    if (distScreenNorm(worldPosOf(wakameStation.wakameBowlGroup)) < 0.26) {
      pointer.dragKind = 'wakamePick';
      pointer.dragPayload = 'wakame';
      return;
    }
    if (distScreenNorm(worldPosOf(wakameStation.garnishGroup)) < 0.24) {
      const types = ['carrot', 'fu', 'negi'];
      pointer.dragKind = 'wakamePick';
      pointer.dragPayload = types[(game.hasFlower ? (game.hasFu ? 2 : 1) : 0)];
      return;
    }
  } else if (game.stage === 'miso') {
    // Can still pick extra wakame or garnishes from left bowl!
    const pickHit = hits.find((h) => h.object.userData.pickType);
    if (pickHit) {
      tossWakameOrGarnish(pickHit.object.userData.pickType);
      return;
    }
    // Check Miso Crock / Paddle Scoop
    if (
      hits.some((h) => h.object.userData.isMisoSource) ||
      distScreenNorm(worldPosOf(misoSys.crockGroup).add(new THREE.Vector3(0, 0.35, 0))) < 0.24
    ) {
      addMisoScoopToLadle();
      pointer.dragKind = 'misoStir';
      return;
    }
    // Touching pot or ladle starts stirring (and auto-scoops miso if not yet in ladle!)
    if (
      hits.some((h) => h.object.userData.isPot || h.object.userData.isSoup || h.object.userData.isLadle) ||
      distScreenNorm(worldPosOf(pot.root).add(new THREE.Vector3(0, 0.7, 0))) < 0.38
    ) {
      if (!game.misoInLadle && game.misoScoops === 0) {
        addMisoScoopToLadle();
      }
      pointer.dragKind = 'misoStir';
      return;
    }
  } else if (game.stage === 'serve') {
    // If bowl is filled, dragging bowl OR tapping a family member serves them!
    if (game.activeBowl && game.activeBowl.userData.fillAmount > 0 && !game.ladlePourAnim) {
      if (
        hits.some((h) => h.object.userData.isBowl) ||
        distScreenNorm(worldPosOf(game.activeBowl).add(new THREE.Vector3(0, 0.25, 0))) < 0.25
      ) {
        pointer.dragKind = 'bowl';
        game.activeBowl.userData.squash.impulse(-1.8);
        sound.playClayBoop(1.1, 0.15);
        return;
      }
      // Tapping directly on a hungry family member hands them the filled bowl!
      for (const m of family.members) {
        const headW = worldPosOf(m.headGroup);
        if (
          hits.some((h) => h.object.userData.character === m) ||
          distScreenNorm(headW) < 0.24
        ) {
          if (!m.eatingSeq) {
            handActiveBowlToMember(m);
            return;
          }
        }
      }
    }

    // Ladle / Pot / Empty Bowl tap or drag -> scoop soup into bowl!
    if (
      game.activeBowl &&
      !game.ladlePourAnim &&
      (hits.some((h) => h.object.userData.isLadle || h.object.userData.isPot || h.object.userData.isSoup || h.object.userData.isBowl) ||
        distScreenNorm(worldPosOf(pot.root).add(new THREE.Vector3(0, 0.7, 0))) < 0.34 ||
        distScreenNorm(worldPosOf(game.activeBowl)) < 0.24)
    ) {
      pointer.dragKind = 'ladle';
      return;
    }
  }

  // Anytime Delight: Poking the liquid in the pot ripples & splashes!
  if (pot.state.waterLevel > 0.1 && hits.some((h) => h.object.userData.isSoup)) {
    const soupHit = hits.find((h) => h.object.userData.isSoup);
    const loc = pot.root.worldToLocal(soupHit.point.clone());
    pot.addRipple(loc.x, loc.z, 0.075);
    pot.spawnSplash(loc.x, loc.z, 5, pot.state.dashiAmount > 0.3, 0.85);
    sound.playDroplet(460 + Math.random() * 180, 0.16);
    if (game.stage === 'dashi' && (game.kombuAdded || game.katsuoAdded)) {
      pot.state.dashiAmount = Math.min(1, pot.state.dashiAmount + 0.12);
      sound.playMarimba(659.25, 0.12, 0.2);
    }
    return;
  }

  // Anytime Delight: Poking any Clay Family Member squishes & makes them giggle (or helps blow cool soup!)
  for (const m of family.members) {
    if (
      hits.some((h) => h.object.userData.character === m) ||
      distScreenNorm(worldPosOf(m.headGroup)) < 0.22
    ) {
      m.poke();
      return;
    }
  }
});

// Pointer Move
canvas.addEventListener('pointermove', (e) => {
  if (!pointer.active || e.pointerId !== pointer.id) return;
  const dxPx = e.clientX - pointer.startScreen.x;
  const dyPx = e.clientY - pointer.startScreen.y;
  pointer.movedDistPx = Math.hypot(dxPx, dyPx);

  updateRayFromEvent(e);
  pointer.currNDC.copy(pointerNDC);
  game.idleTime = 0;

  if (pointer.dragKind === 'misoStir') {
    const potCenter = worldPosOf(pot.root);
    const relX = THREE.MathUtils.clamp(pointer.worldHit.x - potCenter.x, -0.88, 0.88);
    const relZ = THREE.MathUtils.clamp(pointer.worldHit.z - potCenter.z, -0.88, 0.88);

    // Move big wooden ladle smoothly inside pot
    misoSys.ladleGroup.position.lerp(
      new THREE.Vector3(potCenter.x + relX, pot.getSoupY() + 0.06, potCenter.z + relZ),
      0.45
    );
    misoSys.ladleGroup.rotation.z = -relX * 0.22;
    misoSys.ladleGroup.rotation.x = relZ * 0.22;

    const ang = Math.atan2(relZ, relX);
    const rad = Math.hypot(relX, relZ);
    if (pointer.lastStirAngle !== null && rad > 0.10) {
      let dAng = ang - pointer.lastStirAngle;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;

      pot.state.vortexVel = THREE.MathUtils.clamp(pot.state.vortexVel + dAng * 3.8, -7.5, 7.5);
      const stirDelta = Math.min(0.08, Math.abs(dAng) * 0.14 + 0.008);

      if (game.misoInLadle) {
        game.misoDissolveProgress = Math.min(1.0, game.misoDissolveProgress + stirDelta);
        const targetMiso = game.misoScoops >= 2 ? 1.32 : 1.0;
        pot.state.misoAmount = Math.max(
          pot.state.misoAmount,
          game.misoDissolveProgress * targetMiso
        );
        const rem = Math.max(0.01, 1 - game.misoDissolveProgress);
        misoSys.ladleMiso.scale.setScalar(rem);
        if (Math.random() < 0.48) {
          pot.emitMisoSwirl(misoSys.ladleGroup.position.x, misoSys.ladleGroup.position.z);
        }
        if (game.misoDissolveProgress >= 1.0) {
          misoSys.ladleMiso.visible = false;
          game.misoInLadle = false;
          sound.setStirring(0);
          pot.spawnSteamBurst(7, true);
          sound.playDashiBloom();
          enterStage('serve');
        }
      }
    }
    pointer.lastStirAngle = ang;
    sound.setStirring(Math.abs(pot.state.vortexVel) * 0.22);
  } else if (pointer.dragKind === 'bowl' && game.activeBowl) {
    // Drag steaming filled bowl freely across counter toward any family member!
    const bx = THREE.MathUtils.clamp(pointer.worldHit.x, -1.85, 1.85);
    const bz = THREE.MathUtils.clamp(pointer.worldHit.z, -0.95, 2.15);
    game.activeBowl.position.lerp(new THREE.Vector3(bx, 0.24, bz), 0.5);
  }
});

// Pointer Up / Cancel
function onPointerEnd(e) {
  if (!pointer.active || e.pointerId !== pointer.id) return;
  updateRayFromEvent(e);

  if (pointer.dragKind === 'faucet') {
    game.waterHolding = false;
  } else if (pointer.dragKind === 'dashi' && pointer.dragPayload) {
    dropDashiItem(pointer.dragPayload);
  } else if (pointer.dragKind === 'tofuSlice' && !tofuCtrl.isTipping) {
    const palmWorld = new THREE.Vector3();
    raycaster.ray.intersectPlane(palmPlane, palmWorld);
    const endLocal = tofuHands.tofuMount.worldToLocal(palmWorld.clone());
    const startLocal = pointer.tofuStartLocal || endLocal;

    const screenDeltaX = pointer.currNDC.x - pointer.startNDC.x;
    const screenDeltaY = pointer.currNDC.y - pointer.startNDC.y;

    // If >= 1 cut already made and child flicks/drags palm rightward/downward toward pot (or taps pot area outside palm) -> Tip into pot!
    const outsideTofu = Math.abs(endLocal.x) > 0.78 || Math.abs(endLocal.z) > 0.70;
    const flickToPot = tofuCtrl.cutCount >= 1 && screenDeltaX > 0.22 && screenDeltaY < -0.10 && Math.abs(startLocal.x) > 0.35;

    if ((tofuCtrl.cutCount >= 1 && outsideTofu && pointer.movedDistPx < 18) || flickToPot) {
      startTippingTofuIntoPot();
    } else {
      const res = tofuCtrl.performCut(startLocal, endLocal);
      if (res.didCut) {
        tofuHands.palmSquash.impulse(-1.8);
        // Animate chunky clay knife slicing cleanly down through the cut line!
        const cutLocal = new THREE.Vector3(
          res.axis === 'x' ? res.coord : 0,
          0.32,
          res.axis === 'z' ? res.coord : 0
        );
        const cutWorld = tofuHands.tofuMount.localToWorld(cutLocal);
        game.knifeAnim = {
          t: 0,
          dur: 0.30,
          cutPos: cutWorld,
          rotY: res.axis === 'x' ? Math.PI * 0.5 : 0,
        };
        if (res.cutCount % 2 === 1) {
          family.girl.setMood('excited', 1.1);
        } else {
          family.mom.setMood('excited', 1.1);
        }
      } else if (res.allBiteSized && tofuCtrl.cutCount >= 1) {
        // All cubes are already bite-sized -> tapping tips the palm cleanly into the pot!
        startTippingTofuIntoPot();
      }
    }
  } else if (pointer.dragKind === 'wakamePick' && pointer.dragPayload) {
    tossWakameOrGarnish(pointer.dragPayload);
  } else if (pointer.dragKind === 'misoStir') {
    sound.setStirring(0);
    pointer.lastStirAngle = null;
  } else if (pointer.dragKind === 'ladle') {
    triggerLadleScoopIntoBowl();
  } else if (pointer.dragKind === 'bowl' && game.activeBowl) {
    // Find closest family member if dragged toward upper half (or snap back neatly to coaster)
    let bestMember = null;
    let bestDist = Infinity;
    const bowlWorld = worldPosOf(game.activeBowl);

    for (const m of family.members) {
      if (m.eatingSeq) continue;
      const mPos = worldPosOf(m.root).add(new THREE.Vector3(0, 0.6, 0.8));
      const d = bowlWorld.distanceTo(mPos);
      if (d < bestDist) {
        bestDist = d;
        bestMember = m;
      }
    }

    if (bestMember && (bowlWorld.z < 0.85 || bestDist < 1.95)) {
      handActiveBowlToMember(bestMember);
    } else {
      game.activeBowl.position.set(1.38, 0.05, 1.38);
      game.activeBowl.userData.squash.impulse(-1.4);
    }
  }

  pointer.active = false;
  pointer.id = null;
  pointer.dragKind = null;
}

canvas.addEventListener('pointerup', onPointerEnd);
canvas.addEventListener('pointercancel', onPointerEnd);

// ============================================================================
// Main Animation Loop
// ============================================================================
let lastTime = performance.now();
let simClock = 0;

function stepFrame(dt) {
  simClock += dt;
  const time = simClock;

  // Smooth responsive camera glide
  camera.position.lerp(camGoalPos, Math.min(1, dt * 4.5));
  camCurrentLook.lerp(camGoalLook, Math.min(1, dt * 5.0));
  camera.lookAt(camCurrentLook);

  // Stage 1A: Water Faucet Pouring & Overflow Physics!
  if (game.stage === 'water') {
    if (game.waterTapBurst > 0) game.waterTapBurst -= dt;
    const isPouring = game.waterHolding || game.waterTapBurst > 0;

    if (isPouring) {
      faucet.handlePivot.rotation.y += dt * 7.5;
      const rate = pot.state.waterLevel < 1.0 ? 0.44 : 0.24;
      pot.state.waterLevel = Math.min(1.14, pot.state.waterLevel + rate * dt);

      const spoutPos = faucet.getSpoutWorldPos();
      const soupWorldY = pot.root.position.y + pot.getSoupY();
      const streamLen = Math.max(0.15, spoutPos.y - soupWorldY + 0.05);
      faucet.streamMesh.visible = true;
      faucet.streamMesh.scale.set(
        0.92 + Math.sin(time * 28) * 0.08,
        streamLen,
        0.92 + Math.cos(time * 28) * 0.08
      );
      faucet.streamMesh.position.set(0.94, 1.22 - streamLen * 0.5, 0.08);

      const spoutInPot = pot.root.worldToLocal(spoutPos.clone());
      if (Math.random() < 0.45) {
        pot.addRipple(spoutInPot.x, spoutInPot.z, 0.035);
      }

      const overflowing = pot.state.waterLevel > 1.02;
      sound.setWaterPouring(true, Math.min(1, pot.state.waterLevel), overflowing);

      if (overflowing) {
        pot.spawnOverflowDrops();
        if (!game.overflowTriggered) {
          game.overflowTriggered = true;
          sound.playSplash(1.1);
          sound.playVoice('dad', 'wow');
          family.dad.setMood('wow', 1.8);
          family.girl.setMood('excited', 1.8);
        }
      }
    } else {
      faucet.streamMesh.visible = false;
      sound.setWaterPouring(false);
      // Settle overflow dome back neatly to brimming 0.92 when released
      if (pot.state.waterLevel > 0.92) {
        pot.state.waterLevel = THREE.MathUtils.lerp(pot.state.waterLevel, 0.92, dt * 6);
      }
      // Advance to Dashi as soon as pot is generously filled and finger is released!
      if (pot.state.waterLevel >= 0.84) {
        sound.playMarimba(523.25, 0.2, 0.25, 0);
        sound.playMarimba(659.25, 0.2, 0.3, 0.09);
        enterStage('dashi');
      }
    }
  } else {
    // Settle water level neatly below pot inner lip in stages 2..6!
    if (pot.state.waterLevel > 0.92) {
      pot.state.waterLevel = THREE.MathUtils.lerp(pot.state.waterLevel, 0.92, dt * 6);
    }
    // Slide faucet completely off-stage so Girl's face & held bowl are 100% clear!
    faucet.group.position.lerp(new THREE.Vector3(-4.2, -1.2, -0.5), Math.min(1, dt * 4.5));
    if (faucet.group.position.x < -3.6) {
      faucet.group.visible = false;
    }
  }
  faucet.squash.update(dt, faucet.group, 1.0);

  // Stage 1B: Dashi Tray slide & steep bloom
  if (game.stage === 'dashi') {
    dashi.trayGroup.position.lerp(new THREE.Vector3(1.12, 0.04, 1.52), Math.min(1, dt * 6));
    const targetDashi = (game.kombuAdded ? 0.5 : 0) + (game.katsuoAdded ? 0.5 : 0);
    pot.state.dashiAmount = THREE.MathUtils.lerp(pot.state.dashiAmount, targetDashi, dt * 2.2);

    if (game.kombuAdded) {
      dashi.kombuGroup.position.y = pot.getSoupY() - 0.02 + Math.sin(time * 4) * 0.02;
      dashi.kombuGroup.rotation.z = Math.sin(time * 3) * 0.08;
    }
    if (game.katsuoAdded) {
      dashi.katsuoGroup.position.y = pot.getSoupY() - 0.01 + Math.cos(time * 4.4) * 0.025;
      dashi.katsuoGroup.rotation.z = Math.cos(time * 3.5) * 0.1;
    }

    if (game.kombuAdded && game.katsuoAdded && !game.dashiFinishing) {
      game.dashiSteepTimer += dt;
      if (game.dashiSteepTimer > 1.35) {
        game.dashiFinishing = true;
        pot.state.dashiAmount = 1.0;
        pot.spawnSteamBurst(4, false);
        // Steeped kombu & dashi pouch hop neatly onto side tray as broth sparkles golden!
        const trayTarget = new THREE.Vector3(-1.75, 0.15, 1.15);
        dashi.trayGroup.position.lerp(trayTarget, 0.4);
        launchArc(dashi.kombuGroup, worldPosOf(dashi.kombuGroup), new THREE.Vector3(-1.9, 0.22, 1.15), 0.7, 0.42, () => {
          dashi.kombuGroup.visible = false;
        });
        launchArc(dashi.katsuoGroup, worldPosOf(dashi.katsuoGroup), new THREE.Vector3(-1.6, 0.22, 1.15), 0.7, 0.45, () => {
          dashi.katsuoGroup.visible = false;
          dashi.trayGroup.visible = false;
          enterStage('tofu');
        });
      }
    }
  }
  dashi.traySquash.update(dt, dashi.trayGroup, 1.0);
  dashi.kombuSquash.update(dt, dashi.kombuGroup, 1.0);
  dashi.katsuoSquash.update(dt, dashi.katsuoGroup, 1.0);

  // Stage 2: Foreground Palm Tofu Cutting & Tilting into Pot!
  if (game.stage === 'tofu') {
    tofuCtrl.update(dt);
    tofuHands.palmSquash.update(dt, tofuHands.palmMesh, 1.0);

    if (!tofuCtrl.isTipping) {
      // Hover big open palm right over the pot! After >= 4 cuts, subtly tilt 10 deg toward pot as physical signifier!
      const inviteTilt = tofuCtrl.cutCount >= 4 ? -0.17 : 0.0;
      tofuHands.palmPivot.position.lerp(new THREE.Vector3(-0.22, 1.66, 0.36), Math.min(1, dt * 6));
      tofuHands.palmPivot.rotation.z = THREE.MathUtils.lerp(tofuHands.palmPivot.rotation.z, inviteTilt, dt * 6);
    } else {
      game.palmTiltAnim += dt;
      tofuHands.palmPivot.rotation.z = THREE.MathUtils.lerp(tofuHands.palmPivot.rotation.z, -0.78, dt * 9);
      tofuHands.palmPivot.position.lerp(new THREE.Vector3(-0.32, 1.54, 0.24), dt * 7);

      if (game.palmTiltAnim > 0.22 && tofuCtrl.pieces.length > 0) {
        tofuCtrl.dropPiecesIntoPot();
      }
      if (game.palmTiltAnim > 1.05) {
        enterStage('wakame');
      }
    }

    // Knife slice chop animation
    if (game.knifeAnim) {
      const ka = game.knifeAnim;
      ka.t += dt;
      const p = Math.min(1, ka.t / ka.dur);
      const down = Math.sin(p * Math.PI); // Swoops cleanly down to tofu base and right back up!
      const hoverPos = new THREE.Vector3(1.18, 2.46, 0.40);
      tofuHands.knifeRig.position.lerpVectors(hoverPos, ka.cutPos, down);
      tofuHands.knifeRig.rotation.y = THREE.MathUtils.lerp(0, ka.rotY, down);
      tofuHands.knifeRig.rotation.z = -down * 0.18;
      if (p >= 1) game.knifeAnim = null;
    } else {
      const restX = tofuCtrl.isTipping ? 2.1 : 1.18;
      tofuHands.knifeRig.position.lerp(
        new THREE.Vector3(restX, 2.42 + Math.sin(time * 2.6) * 0.04, 0.40),
        Math.min(1, dt * 6)
      );
      tofuHands.knifeRig.rotation.y = THREE.MathUtils.lerp(tofuHands.knifeRig.rotation.y, 0, dt * 6);
      tofuHands.knifeRig.rotation.z = THREE.MathUtils.lerp(tofuHands.knifeRig.rotation.z, 0.08, dt * 6);
    }
  }

  // Stage 3 & 4: Wakame Station & Miso Crock positioning
  if (game.stage === 'wakame') {
    wakameStation.wakameSquash.update(dt, wakameStation.wakameBowlGroup, 1.0);
    wakameStation.garnishSquash.update(dt, wakameStation.garnishGroup, 1.0);
    if (game.wakameCount >= 3) {
      game.wakameReadyTimer += dt;
      if (game.wakameReadyTimer > 0.95) {
        enterStage('miso');
      }
    }
  } else if (game.stage === 'miso') {
    // Shift wakame & garnish smoothly to front-left so Miso Crock shines on front-right!
    wakameStation.wakameBowlGroup.position.lerp(new THREE.Vector3(-1.42, 0.04, 1.72), dt * 5);
    wakameStation.garnishGroup.position.lerp(new THREE.Vector3(-1.42, 0.04, 0.85), dt * 5);
    wakameStation.wakameSquash.update(dt, wakameStation.wakameBowlGroup, 0.86);
    wakameStation.garnishSquash.update(dt, wakameStation.garnishGroup, 0.84);
    misoSys.crockSquash.update(dt, misoSys.crockGroup, 1.0);

    if (pointer.dragKind !== 'misoStir') {
      // Gentle bob inside pot
      misoSys.ladleGroup.position.y = pot.getSoupY() + 0.06 + Math.sin(time * 3) * 0.015;
    }
  }

  // Stage 5: Serving Ladle Scoop & Pour Animation + Family Finale!
  if (game.stage === 'serve') {
    if (game.nextBowlTimer > 0) {
      game.nextBowlTimer -= dt;
      if (game.nextBowlTimer <= 0 && !game.activeBowl) {
        spawnNextEmptyBowl();
      }
    }
    if (game.activeBowl) {
      game.activeBowl.userData.squash.update(dt, game.activeBowl, 1.0);
    }

    if (game.ladlePourAnim && game.activeBowl) {
      const lp = game.ladlePourAnim;
      lp.t += dt;
      const p = Math.min(1, lp.t / lp.dur);
      const potPos = new THREE.Vector3(0.15, pot.getSoupY() + 0.02, 0.32);
      const aboveBowl = worldPosOf(game.activeBowl).add(new THREE.Vector3(0.28, 0.82, -0.05));

      if (p < 0.42) {
        // Dip & lift full ladle from pot to above bowl
        const k = p / 0.42;
        misoSys.ladleSoup.visible = true;
        misoSys.ladleSoupMat.color.copy(pot.soupMesh.material.color);
        misoSys.ladleGroup.position.lerpVectors(potPos, aboveBowl, k);
        misoSys.ladleGroup.position.y += Math.sin(k * Math.PI) * 0.45;
        misoSys.ladleGroup.rotation.z = 0;
      } else if (p < 0.78) {
        // Tilt ladle & pour steaming soup + ingredients into bowl!
        const k = (p - 0.42) / 0.36;
        if (!lp.playedPourSound) {
          lp.playedPourSound = true;
          sound.playLadlePour();
          game.activeBowl.userData.fillAmount++;
          game.activeBowl.userData.liquidGroup.visible = true;
          game.activeBowl.userData.squash.impulse(-2.2);
        }
        misoSys.ladleGroup.position.copy(aboveBowl);
        misoSys.ladleGroup.rotation.z = Math.sin(k * Math.PI) * 0.92;
        const targetY = game.activeBowl.userData.fillAmount >= 2 ? 0.43 : 0.36;
        game.activeBowl.userData.liquidGroup.position.y = THREE.MathUtils.lerp(0.18, targetY, k);
        if (k > 0.65) misoSys.ladleSoup.visible = false;
      } else {
        // Return ladle smoothly to pot rim
        const k = (p - 0.78) / 0.22;
        misoSys.ladleGroup.position.lerpVectors(
          aboveBowl,
          new THREE.Vector3(0.55, pot.getSoupY() + 0.14, 0.25),
          k
        );
        misoSys.ladleGroup.rotation.z = THREE.MathUtils.lerp(0.4, 0, k);
      }

      if (p >= 1) {
        game.ladlePourAnim = null;
        family.members.forEach((m) => {
          if (m.servedCount === 0) m.setMood('eager', 1.4);
        });
      }
    } else {
      misoSys.ladleGroup.position.lerp(
        new THREE.Vector3(0.58, pot.getSoupY() + 0.14 + Math.sin(time * 2.5) * 0.015, 0.25),
        dt * 5
      );
      misoSys.ladleGroup.rotation.z = THREE.MathUtils.lerp(misoSys.ladleGroup.rotation.z, 0, dt * 5);
    }

    // Check if all 3 family members have been served & finished sipping!
    if (
      !game.celebrationDone &&
      family.members.every((m) => m.servedCount >= 1 && !m.eatingSeq)
    ) {
      game.celebrationDone = true;
      sound.playCelebration();
      family.members.forEach((m) => {
        m.setMood('bliss', 5.0);
        m.spawnJoyBurst(4);
      });
      replayBtn.group.visible = true;
      replayBtn.squash.impulse(3.2);
    }

    if (replayBtn.group.visible) {
      replayBtn.squash.update(dt, replayBtn.group, 1.0 + Math.sin(time * 3.5) * 0.04);
    }
  }

  // Update Flying Arcs
  for (let i = flyingArcs.length - 1; i >= 0; i--) {
    const a = flyingArcs[i];
    a.t += dt;
    const p = Math.min(1, a.t / a.dur);
    // Quadratic Bezier arc
    const u = 1 - p;
    a.mesh.position.set(
      u * u * a.start.x + 2 * u * p * a.mid.x + p * p * a.end.x,
      u * u * a.start.y + 2 * u * p * a.mid.y + p * p * a.end.y,
      u * u * a.start.z + 2 * u * p * a.mid.z + p * p * a.end.z
    );
    if (p >= 1) {
      flyingArcs.splice(i, 1);
      if (a.onDone) a.onDone();
    }
  }

  // Subtle Idle >10s Once-Per-Stage Physical Nudge ("0-6秒は何もしない、10秒以降に環境の動きでそっと誘う / 放置時のみ手で1回実演")
  if (!pointer.active) {
    game.idleTime += dt;
    if (game.idleTime > 10.2 && !game.idleDemoShown) {
      const demoT = game.idleTime - 10.2;
      if (demoT < 2.2) {
        hintHand.visible = true;
        const p = demoT / 2.2;
        if (game.stage === 'water') {
          const target = worldPosOf(faucet.handlePivot).add(new THREE.Vector3(0, 0.28 - Math.sin(p * Math.PI * 2) * 0.08, 0.18));
          hintHand.position.copy(target);
        } else if (game.stage === 'dashi') {
          const src = !game.kombuAdded ? worldPosOf(dashi.kombuGroup) : worldPosOf(dashi.katsuoGroup);
          hintHand.position.lerpVectors(src.add(new THREE.Vector3(0, 0.25, 0)), new THREE.Vector3(0, 1.1, 0.35), (p % 1));
        } else if (game.stage === 'tofu') {
          const c = worldPosOf(tofuHands.tofuMount);
          hintHand.position.set(c.x, c.y + 0.38, c.z - 0.38 + (p % 1) * 0.76);
        } else if (game.stage === 'wakame') {
          const src = worldPosOf(wakameStation.wakameBowlGroup).add(new THREE.Vector3(0, 0.35, 0));
          hintHand.position.lerpVectors(src, new THREE.Vector3(0, 1.1, 0.35), (p % 1));
        } else if (game.stage === 'miso') {
          const a = p * Math.PI * 3;
          hintHand.position.set(Math.cos(a) * 0.48, pot.getSoupY() + 0.35, 0.32 + Math.sin(a) * 0.48);
        } else if (game.stage === 'serve') {
          if (game.activeBowl && game.activeBowl.userData.fillAmount > 0) {
            hintHand.position.lerpVectors(
              worldPosOf(game.activeBowl).add(new THREE.Vector3(0, 0.35, 0)),
              worldPosOf(family.mom.headGroup).add(new THREE.Vector3(0, -0.4, 0.5)),
              p % 1
            );
          } else {
            hintHand.position.lerpVectors(
              new THREE.Vector3(0.2, 1.15, 0.32),
              new THREE.Vector3(0, 0.65, 1.94),
              p % 1
            );
          }
        }
      } else {
        hintHand.visible = false;
        game.idleDemoShown = true;
      }
    }
  }

  // Update Pot Physics & Family Autonomous Eye-Tracking
  pot.update(dt, time);

  let familyFocus = pointer.active
    ? pointer.worldHit
    : game.stage === 'tofu'
    ? worldPosOf(tofuHands.tofuMount)
    : game.stage === 'serve' && game.activeBowl && game.activeBowl.userData.fillAmount > 0
    ? worldPosOf(game.activeBowl)
    : new THREE.Vector3(0, 0.85, 0.35);

  const isWaitingToBeServed =
    game.stage === 'serve' && game.activeBowl && game.activeBowl.userData.fillAmount > 0;
  for (const m of family.members) {
    m.update(dt, time, familyFocus, isWaitingToBeServed);
  }

  renderer.render(scene, camera);
}

function animate(nowMs) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTime) / 1000));
  lastTime = nowMs;
  stepFrame(dt);
}

requestAnimationFrame(animate);

// Expose non-visual technical telemetry for automated quality & FPS/triangle checks
window.__misoDebug = {
  resizeTest: (w, h) => {
    renderer.setSize(w, h, false);
    computeCameraTargets(w, h);
    camera.position.copy(camGoalPos);
    camCurrentLook.copy(camGoalLook);
    camera.lookAt(camCurrentLook);
    renderer.render(scene, camera);
  },
  stepSim: (seconds = 0.5) => {
    const steps = Math.max(1, Math.ceil(seconds / (1 / 60)));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) stepFrame(dt);
  },
  setWaterHolding: (v) => {
    game.waterHolding = v;
  },
  getStats: () => ({
    stage: game.stage,
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    pixelRatio: renderer.getPixelRatio(),
    waterLevel: pot.state.waterLevel,
    dashiAmount: pot.state.dashiAmount,
    misoAmount: pot.state.misoAmount,
    floatingCount: pot.state.floatingItems.length,
    wakameCount: game.wakameCount,
    tofuPiecesOnPalm: tofuCtrl.pieces.length,
    servedCounts: family.members.map((m) => m.servedCount),
  }),
  enterStage,
  dropDashiItem,
  tossWakameOrGarnish,
  addMisoScoopToLadle,
  triggerLadleScoopIntoBowl,
  handBowlTo: (idx) => handActiveBowlToMember(family.members[idx]),
  sliceTofuDemo: (axis = 'x', coord = 0) => {
    if (axis === 'x') return tofuCtrl.performCut(new THREE.Vector3(coord, 0, -0.4), new THREE.Vector3(coord, 0, 0.4));
    return tofuCtrl.performCut(new THREE.Vector3(-0.4, 0, coord), new THREE.Vector3(0.4, 0, coord));
  },
  tipTofu: () => startTippingTofuIntoPot(),
  stirDemo: (amt = 0.35) => {
    if (!game.misoInLadle && game.misoScoops === 0) addMisoScoopToLadle();
    pot.state.vortexVel = 5.2;
    game.misoDissolveProgress = Math.min(1, game.misoDissolveProgress + amt);
    pot.state.misoAmount = game.misoDissolveProgress;
    pot.emitMisoSwirl(0.2, 0.3);
    if (game.misoDissolveProgress >= 1) {
      misoSys.ladleMiso.visible = false;
      game.misoInLadle = false;
      pot.spawnSteamBurst(7, true);
      enterStage('serve');
    }
  },
  resetWholeGame,
};
