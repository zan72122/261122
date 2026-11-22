import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createNightDiningEnvMap, createRealisticEyeTexture } from './textures.js';
import { createDiningRoomAndProps, PLATE_Y, WELL_RADIUS } from './scene.js';
import { FamilyMember, PlayerHand } from './humans.js';
import { createTakoyakiSystem } from './takoyaki.js';
import { TakoyakiAudio } from './audio.js';

// =========================================================================
// 1. RENDERER, SCENE, CAMERA & SSAO PIPELINE (Mobile-tuned: DPR <= 1.5)
// =========================================================================
const container = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0908);
scene.fog = new THREE.FogExp2(0x110c09, 0.36);

// Procedural cozy night dining room PMREM environment reflections
scene.environment = createNightDiningEnvMap(renderer);
scene.environmentIntensity = 0.85;

// Low-angle table-height over-the-shoulder camera
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.05, 6.0);
const camBasePos = new THREE.Vector3();
const camLookAt = new THREE.Vector3();

function updateResponsiveCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // Portrait iPhone: slightly higher FOV & pulled back a touch so all bowls, 6 wells, hand, & Mom+Dad fit cleanly!
    camera.fov = 54;
    camBasePos.set(0.02, 0.34, 0.60);
    camLookAt.set(0.0, 0.165, -0.10);
  } else if (aspect < 1.25) {
    // 4:3 iPad / square
    camera.fov = 48;
    camBasePos.set(0.03, 0.29, 0.51);
    camLookAt.set(0.0, 0.168, -0.11);
  } else {
    // Wide landscape desktop / tablet
    camera.fov = 45;
    camBasePos.set(0.035, 0.27, 0.475);
    camLookAt.set(0.0, 0.168, -0.12);
  }
  camera.position.copy(camBasePos);
  camera.lookAt(camLookAt);
  camera.updateProjectionMatrix();
}
updateResponsiveCamera();

// Post-processing with true SSAO (soft contact shadows under bowls, inside iron wells, & around facial contours!)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight, 16);
ssaoPass.kernelRadius = 0.026;
ssaoPass.minDistance = 0.0005;
ssaoPass.maxDistance = 0.038;
ssaoPass.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssaoPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// =========================================================================
// 2. BUILD COZY NIGHT DINING WORLD, FAMILY, HAND, & 6-WELL TAKOYAKI SYSTEM
// =========================================================================
const audio = new TakoyakiAudio();
const world = createDiningRoomAndProps(scene);
const props = world.interactiveProps;

// Shared photorealistic eye texture for Mom & Dad
const sharedEyeTex = createRealisticEyeTexture();

// Mom (seated left-center across the table, leaned warmly toward the steaming grill)
const mom = new FamilyMember('mom', sharedEyeTex);
mom.root.position.set(-0.165, -0.02, -0.435);
mom.root.rotation.y = 0.17;
scene.add(mom.root);

// Dad (seated right-center across the table, warm grin & attentive eyes)
const dad = new FamilyMember('dad', sharedEyeTex);
dad.root.position.set(0.175, -0.015, -0.455);
dad.root.rotation.y = -0.17;
scene.add(dad.root);

// Invisible generous raycast targets over Mom & Dad so tapping/dragging a takoyaki to them feels effortless!
const momHit = new THREE.Mesh(
  new THREE.SphereGeometry(0.145, 10, 8),
  new THREE.MeshBasicMaterial({ visible: false })
);
momHit.position.set(-0.165, 0.34, -0.42);
momHit.userData.propId = 'mom';
scene.add(momHit);

const dadHit = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 10, 8),
  new THREE.MeshBasicMaterial({ visible: false })
);
dadHit.position.set(0.175, 0.35, -0.44);
dadHit.userData.propId = 'dad';
scene.add(dadHit);

// Foreground Player Hand
const playerHand = new PlayerHand();
scene.add(playerHand.root);

// 6-Well Takoyaki Cooking System + Steam & Oil Splatter Particles
const takoSys = createTakoyakiSystem(scene, props);
const balls = takoSys.balls;
const particles = takoSys.particles;

// Hide transparent steam sprites during SSAO depth/normal pass so ZERO rectangular SSAO ghost shadows appear!
const origSsaoRender = ssaoPass.render.bind(ssaoPass);
ssaoPass.render = (r, writeBuffer, readBuffer, deltaTime, maskActive) => {
  particles.steamGroup.visible = false;
  origSsaoRender(r, writeBuffer, readBuffer, deltaTime, maskActive);
  particles.steamGroup.visible = true;
};

// Held visual props attached to player hand when carrying octopus/katsuobushi
const heldOctoChunk = new THREE.Mesh(
  new THREE.DodecahedronGeometry(0.013, 1),
  props.octopus.octoMat
);
heldOctoChunk.visible = false;
playerHand.toolAnchor.add(heldOctoChunk);

// Wooden cooking chopsticks held when placing octopus
const heldChopsticks = new THREE.Group();
const chopMat = new THREE.MeshStandardMaterial({ color: 0xb98d5c, roughness: 0.55 });
for (let i = 0; i < 2; i++) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0036, 0.16, 8), chopMat);
  s.rotation.x = Math.PI * 0.5;
  s.position.set(i === 0 ? -0.005 : 0.005, 0.002, 0.05);
  s.rotation.y = i === 0 ? -0.06 : 0.06;
  heldChopsticks.add(s);
}
heldChopsticks.visible = false;
playerHand.toolAnchor.add(heldChopsticks);

// Pinched katsuobushi flakes held in hand fingers when sprinkling!
const heldFlakes = new THREE.Group();
for (let i = 0; i < 6; i++) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.026), props.katsuobushi.katsuoFlakeMat);
  f.position.set((i - 2.5) * 0.004, (i % 2) * 0.004, (i % 3) * 0.003);
  f.rotation.set(0.4 * i, i, 0.3);
  heldFlakes.add(f);
}
heldFlakes.visible = false;
playerHand.toolAnchor.add(heldFlakes);

// =========================================================================
// 3. WORDLESS ONE-FINGER INTERACTION STATE MACHINE
// =========================================================================
let activePointerId = null;
let activeTool = 'none'; // 'none' | 'pitcher' | 'octopus' | 'pick' | 'sauce' | 'katsuobushi' | 'carry'
let toolPickedExplicitly = false;
let carriedBall = null;
let pointerDownScreen = new THREE.Vector2();
let lastPointerScreen = new THREE.Vector2();
let dragWorldPos = new THREE.Vector3(0, PLATE_Y + 0.06, 0);
let isDragging = false;
let pourActionTimer = 0;
let currentAction = null; // Timed choreography for clean tap actions (e.g. tap well -> hand pours smoothly)
let lastInteractionTime = performance.now() * 0.001;
let idleHintPlayed = false;
let idleHintAnim = 0;
let gazeTarget = new THREE.Vector3(0, 0.06, 0);
let totalEaten = 0;
const recentDragHitCooldown = new Map();

// Interactive raycast plane at plate working height
const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PLATE_Y + 0.015));
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function setNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function getAllRaycastTargets() {
  const targets = [
    props.pitcher.group,
    props.octopus.group,
    props.pick.group,
    props.sauce.group,
    props.katsuobushi.group,
    props.plate.group,
    momHit,
    dadHit,
    world.lampPivot,
    props.knob.group,
    ...props.teaGlasses.map(t => t.group),
    ...balls.map(b => b.hitbox)
  ];
  return targets;
}

function findPropId(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.propId !== undefined) return { type: 'prop', id: cur.userData.propId };
    if (cur.userData && cur.userData.wellIndex !== undefined) return { type: 'well', index: cur.userData.wellIndex };
    cur = cur.parent;
  }
  return null;
}

function getNearestWell(worldPos, maxDist = 0.056) {
  let best = null;
  let bestD = maxDist;
  for (const b of balls) {
    if (b.isCarried) continue;
    const d = Math.hypot(b.root.position.x - worldPos.x, b.root.position.z - worldPos.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function hasAnyWellInStage(predicate) {
  return balls.some(b => !b.isCarried && predicate(b));
}

function getNaturalNextStage() {
  // Used ONLY for gentle 10s idle hand nudge (no arrows, no glowing outlines!)
  if (balls.some(b => b.isOnPlate)) return 'feed';
  if (balls.some(b => !b.isOnPlate && !b.isCarried && b.isReadyToServe())) return 'serve';
  if (balls.some(b => !b.isOnPlate && !b.isCarried && b.flipCount >= 2 && b.sauceLevel >= 1 && b.katsuoAmount < 0.5)) return 'katsuobushi';
  if (balls.some(b => !b.isOnPlate && !b.isCarried && b.flipCount >= 2 && b.sauceLevel === 0)) return 'sauce';
  if (balls.some(b => !b.isOnPlate && !b.isCarried && b.fillLevel >= 0.4 && (b.octopusCount >= 1 || b.cookBottom > 0.35) && b.flipCount < 2)) return 'pick';
  if (balls.some(b => !b.isOnPlate && !b.isCarried && b.fillLevel >= 0.4 && b.octopusCount === 0)) return 'octopus';
  return 'pitcher';
}

function triggerTimedChoreography(tool, targetPos, duration = 0.48, onPeak = null) {
  currentAction = {
    tool,
    targetPos: targetPos.clone(),
    timer: 0,
    duration,
    peakDone: false,
    onPeak
  };
  gazeTarget.copy(targetPos);
}

// Feed a finished takoyaki to Mom or Dad with blowing "fuu~" + joyful eating reaction!
function feedBallToFamily(ball, member, who) {
  const mouthPos = member.getMouthWorldPosition(new THREE.Vector3());
  const approachPos = mouthPos.clone().add(new THREE.Vector3(0, -0.015, 0.085));

  // Clear plate slot if it was plated
  if (ball.isOnPlate && ball.plateSlot >= 0) {
    props.plate.occupied[ball.plateSlot] = null;
    ball.isOnPlate = false;
    ball.plateSlot = -1;
  }
  ball.isCarried = true;
  carriedBall = ball;
  activeTool = 'carry';
  member.react('eager');

  // Choreography: hold steaming ball up to Mom/Dad -> they blow "fuu~" -> take happy bite!
  currentAction = {
    tool: 'feed',
    ball,
    member,
    who,
    targetPos: approachPos,
    mouthPos,
    timer: 0,
    duration: 1.45,
    blew: false,
    ate: false
  };
  gazeTarget.copy(approachPos);
}

function placeBallOnPlate(ball) {
  const slotIdx = props.plate.occupied.findIndex(s => s === null);
  if (slotIdx === -1) {
    // Boat full! Hand it directly to whoever ate less recently (Mom or Dad)
    const targetMember = totalEaten % 2 === 0 ? mom : dad;
    feedBallToFamily(ball, targetMember, totalEaten % 2 === 0 ? 'mom' : 'dad');
    return;
  }
  props.plate.occupied[slotIdx] = ball;
  ball.isCarried = false;
  ball.isOnPlate = true;
  ball.plateSlot = slotIdx;
  ball.root.position.copy(props.plate.slots[slotIdx]);
  ball.bounce = 0.45;
  carriedBall = null;
  activeTool = 'none';
  audio.playSoftClink(620);
  particles.spawnSteamBurst(ball.root.position.x, ball.root.position.y + 0.025, ball.root.position.z, 5);
  mom.react('smile');
  dad.react('smile');
}

// Execute physical tool effect on a specific takoyaki well
function applyToolToWell(tool, ball, swipeX = 0, swipeZ = 0) {
  const now = performance.now();
  const key = `${tool}_${ball.index}`;
  if (now - (recentDragHitCooldown.get(key) || 0) < 260) return false;
  recentDragHitCooldown.set(key, now);

  const wp = ball.root.position;
  gazeTarget.copy(wp);

  if (tool === 'pitcher') {
    if (ball.pourBatter(0.85)) {
      audio.playBatterPour();
      pourActionTimer = 0.35;
      particles.spawnSteamBurst(wp.x, PLATE_Y + 0.01, wp.z, 5);
      particles.spawnOilBurst(wp.x, PLATE_Y + 0.005, wp.z, 8, 0.85);
      playerHand.kickAction();
      if (ball.fillLevel > 1.05) {
        // Overflow delight!
        mom.react('amazed');
        dad.react('smile');
      }
      return true;
    }
  } else if (tool === 'octopus') {
    if (ball.addOctopus()) {
      const isDouble = ball.octopusCount >= 2;
      audio.playOctopusPlop(isDouble);
      particles.spawnOilBurst(wp.x, PLATE_Y + 0.01, wp.z, isDouble ? 14 : 9, 1.0);
      particles.spawnSteamBurst(wp.x, PLATE_Y + 0.015, wp.z, 4);
      playerHand.kickAction();
      if (isDouble) {
        mom.react('amazed');
        dad.react('amazed');
      } else {
        mom.react('smile');
      }
      return true;
    }
  } else if (tool === 'pick') {
    if (ball.flip(swipeX, swipeZ)) {
      audio.playPickFlip(ball.flipCount);
      particles.spawnOilBurst(wp.x, PLATE_Y + 0.012, wp.z, 12, 1.15);
      particles.spawnSteamBurst(wp.x, PLATE_Y + 0.022, wp.z, 7);
      playerHand.kickAction();
      if (ball.flipCount === 1) {
        dad.react('smile');
      } else if (ball.flipCount === 2) {
        mom.react('amazed');
        dad.react('amazed');
      } else {
        dad.react('smile');
      }
      return true;
    }
  } else if (tool === 'sauce') {
    const res = ball.addSauce();
    if (res) {
      audio.playSauceDrizzle(res === 'mayo');
      particles.spawnSteamBurst(wp.x, wp.y + 0.025, wp.z, 4);
      playerHand.kickAction();
      if (res === 'mayo') {
        mom.react('amazed');
        dad.react('smile');
      } else {
        dad.react('smile');
      }
      return true;
    }
  } else if (tool === 'katsuobushi') {
    const res = ball.addKatsuobushi();
    if (res) {
      audio.playKatsuobushiFlutter();
      particles.spawnSteamBurst(wp.x, wp.y + 0.028, wp.z, 6);
      playerHand.kickAction();
      mom.react('amazed');
      dad.react('amazed');
      return true;
    }
  }
  return false;
}

// =========================================================================
// 4. POINTER EVENT HANDLERS (Single-finger forgiving tap + drag + swipe)
// =========================================================================
function onPointerDown(e) {
  if (activePointerId !== null) return; // Multi-touch safe: ignore secondary fingers
  activePointerId = e.pointerId;
  audio.unlock();

  lastInteractionTime = performance.now() * 0.001;
  idleHintPlayed = false;
  idleHintAnim = 0;

  pointerDownScreen.set(e.clientX, e.clientY);
  lastPointerScreen.set(e.clientX, e.clientY);
  isDragging = true;

  // Cancel non-feeding choreography so player always feels 100% immediate agency
  if (currentAction && currentAction.tool !== 'feed') {
    currentAction = null;
  }
  if (currentAction && currentAction.tool === 'feed') return;

  setNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(workPlane, dragWorldPos);

  const hits = raycaster.intersectObjects(getAllRaycastTargets(), true);
  const hitInfo = hits.length > 0 ? findPropId(hits[0].object) : null;

  if (!hitInfo) {
    // Tapping empty space near steam? Gentle breeze that blows steam & makes katsuobushi dance!
    let blewAny = false;
    for (const b of balls) {
      if (b.stage !== 'empty' && b.katsuoAmount > 0) {
        b.blowSteam();
        blewAny = true;
      }
    }
    if (blewAny) {
      audio.playBlowSteam();
    }
    return;
  }

  // --- CASE A: Player touched a physical table prop or Mom/Dad ---
  if (hitInfo.type === 'prop') {
    const id = hitInfo.id;

    if (id === 'lamp') {
      props.lamp.swingVel += (Math.random() > 0.5 ? 1 : -1) * 1.4;
      audio.playSoftClink(520);
      return;
    }
    if (id === 'tea') {
      props.teaGlasses.forEach(t => (t.clink = 1.0));
      audio.playSoftClink(1340);
      return;
    }
    if (id === 'knob') {
      props.knob.highHeat = !props.knob.highHeat;
      props.knob.wobble = 1.0;
      audio.playSoftClink(740);
      return;
    }

    if (id === 'mom' || id === 'dad') {
      const member = id === 'mom' ? mom : dad;
      // If there's a finished takoyaki on the wooden boat or ready on the grill, offer it to them!
      const plated = balls.find(b => b.isOnPlate);
      const readyGrill = balls.find(b => !b.isOnPlate && !b.isCarried && b.isReadyToServe());
      if (plated) {
        feedBallToFamily(plated, member, id);
      } else if (readyGrill) {
        feedBallToFamily(readyGrill, member, id);
      } else {
        // Gentle friendly wave / smile!
        member.react('smile');
        audio.playFamilyHappy(id);
      }
      return;
    }

    if (id === 'pitcher') {
      if (hasAnyWellInStage(b => b.flipCount === 0 && !b.isOnPlate)) {
        activeTool = 'pitcher';
        toolPickedExplicitly = true;
        audio.playSoftClink(420);
        const emptyWell = balls.find(b => b.stage === 'empty' && !b.isOnPlate && !b.isCarried);
        if (emptyWell) {
          gazeTarget.copy(emptyWell.root.position);
        }
      } else {
        props.pitcher.wobble = 1.0;
        audio.playSoftClink(420);
      }
      return;
    }

    if (id === 'octopus') {
      if (hasAnyWellInStage(b => b.fillLevel >= 0.3 && b.flipCount < 2 && b.octopusCount < 2 && !b.isOnPlate)) {
        activeTool = 'octopus';
        toolPickedExplicitly = true;
        audio.playSoftClink(540);
      } else {
        props.octopus.wobble = 1.0;
        audio.playSoftClink(520);
      }
      return;
    }

    if (id === 'pick') {
      if (hasAnyWellInStage(b => b.fillLevel >= 0.3 && !b.isOnPlate)) {
        activeTool = 'pick';
        toolPickedExplicitly = true;
        audio.playSoftClink(1120);
      } else {
        props.pick.wobble = 1.0;
        audio.playSoftClink(1120);
      }
      return;
    }

    if (id === 'sauce') {
      if (hasAnyWellInStage(b => b.flipCount >= 1)) {
        activeTool = 'sauce';
        toolPickedExplicitly = true;
        audio.playSoftClink(360);
      } else {
        props.sauce.wobble = 1.0;
        audio.playSoftClink(360);
      }
      return;
    }

    if (id === 'katsuobushi') {
      if (hasAnyWellInStage(b => b.flipCount >= 1)) {
        activeTool = 'katsuobushi';
        toolPickedExplicitly = true;
        audio.playKatsuobushiFlutter();
      } else {
        props.katsuobushi.wobble = 1.0;
        audio.playSoftClink(480);
      }
      return;
    }

    if (id === 'plate') {
      // If tapping a plated takoyaki on the wooden boat, pick it up to feed Mom or Dad!
      const plated = getNearestWell(dragWorldPos, 0.08);
      if (plated && plated.isOnPlate) {
        activeTool = 'carry';
        carriedBall = plated;
        props.plate.occupied[plated.plateSlot] = null;
        plated.isOnPlate = false;
        plated.plateSlot = -1;
        plated.isCarried = true;
        audio.playSoftClink(760);
        mom.react('eager');
        dad.react('eager');
      }
      return;
    }
    return;
  }

  // --- CASE B: Player touched a Takoyaki Well directly! ---
  if (hitInfo.type === 'well') {
    const ball = balls[hitInfo.index];
    if (!ball) return;

    // If it's on the serving plate, pick it up to feed Mom/Dad!
    if (ball.isOnPlate) {
      activeTool = 'carry';
      carriedBall = ball;
      props.plate.occupied[ball.plateSlot] = null;
      ball.isOnPlate = false;
      ball.plateSlot = -1;
      ball.isCarried = true;
      audio.playSoftClink(760);
      mom.react('eager');
      dad.react('eager');
      return;
    }

    // If player explicitly picked up a tool prop, apply it directly!
    if (toolPickedExplicitly && activeTool !== 'none' && activeTool !== 'carry') {
      const ok = applyToolToWell(activeTool, ball);
      if (ok) return;
      // Tool no longer matches this well's stage -> release explicit hold smoothly
      toolPickedExplicitly = false;
      activeTool = 'none';
    }

    // Natural causal direct manipulation on THAT specific well:
    toolPickedExplicitly = false;
    if (ball.stage === 'empty') {
      activeTool = 'pitcher';
      triggerTimedChoreography('pitcher', ball.root.position, 0.42, () => {
        applyToolToWell('pitcher', ball);
      });
    } else if (ball.stage === 'batter' && ball.octopusCount === 0) {
      activeTool = 'octopus';
      triggerTimedChoreography('octopus', ball.root.position, 0.38, () => {
        applyToolToWell('octopus', ball);
      });
    } else if (ball.flipCount < 2) {
      activeTool = 'pick';
      triggerTimedChoreography('pick', ball.root.position, 0.32, () => {
        applyToolToWell('pick', ball, 0.5, 0.8);
      });
    } else if (ball.sauceLevel === 0) {
      activeTool = 'sauce';
      triggerTimedChoreography('sauce', ball.root.position, 0.36, () => {
        applyToolToWell('sauce', ball);
      });
    } else if (ball.katsuoAmount < 0.5) {
      activeTool = 'katsuobushi';
      triggerTimedChoreography('katsuobushi', ball.root.position, 0.38, () => {
        applyToolToWell('katsuobushi', ball);
      });
    } else {
      activeTool = 'carry';
      carriedBall = ball;
      ball.isCarried = true;
      audio.playSoftClink(840);
      mom.react('eager');
      dad.react('eager');
    }
  }
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId || !isDragging) return;
  lastInteractionTime = performance.now() * 0.001;

  const dx = e.clientX - lastPointerScreen.x;
  const dy = e.clientY - lastPointerScreen.y;
  lastPointerScreen.set(e.clientX, e.clientY);

  setNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(ndc, camera);

  // When carrying a finished takoyaki up toward Mom or Dad, elevate into vertical plane
  if (activeTool === 'carry' && carriedBall) {
    const upLift = Math.max(0, (pointerDownScreen.y - e.clientY) / Math.max(200, window.innerHeight * 0.55));
    const carryPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PLATE_Y + 0.055 + upLift * 0.28));
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(carryPlane, pt)) {
      pt.x = Math.max(-0.32, Math.min(0.32, pt.x));
      pt.z = Math.max(-0.40, Math.min(0.20, pt.z));
      dragWorldPos.copy(pt);
      carriedBall.root.position.lerp(pt, 0.45);
      gazeTarget.copy(carriedBall.root.position);
      if (pt.z < -0.18) {
        if (pt.x < 0) mom.react('eager');
        else dad.react('eager');
      }
    }
    return;
  }

  if (!raycaster.ray.intersectPlane(workPlane, dragWorldPos)) return;
  dragWorldPos.x = Math.max(-0.34, Math.min(0.34, dragWorldPos.x));
  dragWorldPos.z = Math.max(-0.26, Math.min(0.24, dragWorldPos.z));
  gazeTarget.copy(dragWorldPos);

  // Dragging an active tool smoothly interacts with any well it passes over!
  if (activeTool !== 'none') {
    const nearWell = getNearestWell(dragWorldPos, WELL_RADIUS * 1.45);
    if (nearWell && !nearWell.isOnPlate) {
      applyToolToWell(activeTool, nearWell, Math.sign(dx), Math.sign(dy));
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  isDragging = false;

  const movedPx = Math.hypot(e.clientX - pointerDownScreen.x, e.clientY - pointerDownScreen.y);

  // Handle releasing a carried finished takoyaki!
  if (activeTool === 'carry' && carriedBall) {
    const ball = carriedBall;
    setNDC(e.clientX, e.clientY);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([momHit, dadHit, props.plate.group], true);
    const hInfo = hits.length > 0 ? findPropId(hits[0].object) : null;

    if (hInfo && hInfo.id === 'mom') {
      feedBallToFamily(ball, mom, 'mom');
      return;
    }
    if (hInfo && hInfo.id === 'dad') {
      feedBallToFamily(ball, dad, 'dad');
      return;
    }
    if (ball.root.position.z < -0.24) {
      // Dragged up near Mom or Dad!
      const isMom = ball.root.position.x <= 0;
      feedBallToFamily(ball, isMom ? mom : dad, isMom ? 'mom' : 'dad');
      return;
    }
    if (movedPx < 18) {
      // Quick tap on a finished takoyaki: if on grill -> serve onto wooden boat; if already picked from boat -> feed Mom/Dad!
      const freeSlot = props.plate.occupied.findIndex(s => s === null);
      if (ball.homePos.distanceTo(ball.root.position) < 0.08 && freeSlot !== -1) {
        placeBallOnPlate(ball);
      } else {
        const isMom = totalEaten % 2 === 0;
        feedBallToFamily(ball, isMom ? mom : dad, isMom ? 'mom' : 'dad');
      }
      return;
    }
    // Dropped near the wooden boat -> place neatly on boat!
    placeBallOnPlate(ball);
    return;
  }

  // Quick tap directly on a table tool (moved < 16px) performs one satisfying causal step on the best matching well!
  if (movedPx < 16 && toolPickedExplicitly && activeTool !== 'none' && !currentAction) {
    if (activeTool === 'pitcher') {
      const target = balls.find(b => b.stage === 'empty' && !b.isOnPlate) || balls.find(b => b.flipCount === 0 && !b.isOnPlate);
      if (target) {
        triggerTimedChoreography('pitcher', target.root.position, 0.44, () => applyToolToWell('pitcher', target));
      }
    } else if (activeTool === 'octopus') {
      const target = balls.find(b => b.fillLevel >= 0.3 && b.octopusCount === 0 && b.flipCount < 2 && !b.isOnPlate)
        || balls.find(b => b.fillLevel >= 0.3 && b.octopusCount < 2 && b.flipCount < 2 && !b.isOnPlate);
      if (target) {
        triggerTimedChoreography('octopus', target.root.position, 0.38, () => applyToolToWell('octopus', target));
      }
    } else if (activeTool === 'pick') {
      const target = balls.find(b => b.fillLevel >= 0.3 && b.flipCount < 2 && !b.isOnPlate)
        || balls.find(b => b.fillLevel >= 0.3 && !b.isOnPlate);
      if (target) {
        triggerTimedChoreography('pick', target.root.position, 0.34, () => applyToolToWell('pick', target, 0.5, 0.9));
      }
    } else if (activeTool === 'sauce') {
      const target = balls.find(b => b.flipCount >= 1 && b.sauceLevel === 0)
        || balls.find(b => b.flipCount >= 1 && b.sauceLevel === 1);
      if (target) {
        triggerTimedChoreography('sauce', target.root.position, 0.38, () => applyToolToWell('sauce', target));
      }
    } else if (activeTool === 'katsuobushi') {
      const target = balls.find(b => b.flipCount >= 1 && b.katsuoAmount < 0.5)
        || balls.find(b => b.flipCount >= 1);
      if (target) {
        triggerTimedChoreography('katsuobushi', target.root.position, 0.40, () => applyToolToWell('katsuobushi', target));
      }
    }
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  ssaoPass.setSize(w, h);
  updateResponsiveCamera();
});

// =========================================================================
// 5. UTENSIL & FOREGROUND HAND CHOREOGRAPHY UPDATE
// =========================================================================
const _tmpPos = new THREE.Vector3();
const _tmpRot = new THREE.Euler();

function updateUtensilsAndHand(dt, time) {
  // Default hide hand-attached micro-props
  heldOctoChunk.visible = false;
  heldChopsticks.visible = false;
  heldFlakes.visible = false;
  props.pitcher.pourStream.visible = false;

  // Compute where each table prop should rest vs be held by foreground hand
  let handTargetPos = playerHand.restPos.clone();
  let handTargetRot = new THREE.Euler(-0.14, 0.28, -0.08);
  let handGrip = 0.28;
  let heldToolId = activeTool;
  let focusPos = dragWorldPos;

  // Handle timed tap-choreography & family feeding sequence
  if (currentAction) {
    currentAction.timer += dt;
    const p = Math.min(1, currentAction.timer / currentAction.duration);

    if (currentAction.tool === 'feed') {
      heldToolId = 'carry';
      const { ball, member, who, targetPos, mouthPos } = currentAction;
      const moveT = Math.min(1, p / 0.35);
      const ease = 1 - Math.pow(1 - moveT, 3);
      ball.root.position.lerp(targetPos, Math.min(1, dt * 10 + ease * 0.2));
      focusPos = ball.root.position;

      // Step 1: Mom/Dad gently blows "fuu~ fuu~" to cool the hot takoyaki!
      if (p > 0.36 && !currentAction.blew) {
        currentAction.blew = true;
        member.react('blow_and_eat');
        audio.playBlowSteam();
        ball.blowSteam();
        particles.spawnSteamBurst(ball.root.position.x, ball.root.position.y + 0.015, ball.root.position.z, 9, who === 'mom' ? 1.5 : -1.5);
      }
      // Step 2: Move into happy bite!
      if (p > 0.72) {
        ball.root.position.lerp(mouthPos, Math.min(1, dt * 14));
        const shrink = Math.max(0.05, 1 - (p - 0.72) / 0.24);
        ball.root.scale.setScalar(shrink);
      }
      if (p > 0.78 && !currentAction.ate) {
        currentAction.ate = true;
        totalEaten++;
        audio.playFamilyHappy(who);
        // The other parent smiles warmly too!
        (who === 'mom' ? dad : mom).react('smile');
      }
      if (p >= 1) {
        ball.reset();
        carriedBall = null;
        activeTool = 'none';
        currentAction = null;
      }
    } else {
      heldToolId = currentAction.tool;
      focusPos = currentAction.targetPos;
      if (p >= 0.45 && !currentAction.peakDone) {
        currentAction.peakDone = true;
        if (currentAction.onPeak) currentAction.onPeak();
      }
      if (p >= 1) {
        currentAction = null;
      }
    }
  }

  // Gentle 10-second idle hand nudge (ONLY once after 10s inactivity — zero arrows, zero glowing rings!)
  const idleSec = time - lastInteractionTime;
  if (!isDragging && !currentAction && idleSec > 10.0 && !idleHintPlayed) {
    idleHintPlayed = true;
    idleHintAnim = 1.0;
  }
  if (idleHintAnim > 0) {
    idleHintAnim = Math.max(0, idleHintAnim - dt * 0.65);
    const next = getNaturalNextStage();
    let hintTarget = props.pitcher.homePos;
    if (next === 'octopus') hintTarget = props.octopus.homePos;
    else if (next === 'pick') hintTarget = props.pick.homePos;
    else if (next === 'sauce') hintTarget = props.sauce.homePos;
    else if (next === 'katsuobushi') hintTarget = props.katsuobushi.homePos;
    else if (next === 'feed' || next === 'serve') hintTarget = new THREE.Vector3(0, PLATE_Y + 0.04, -0.05);

    const wave = Math.sin(idleHintAnim * Math.PI);
    handTargetPos.lerp(hintTarget.clone().add(new THREE.Vector3(0.05, 0.09, 0.06)), wave * 0.78);
    handGrip = 0.25 + wave * 0.2;
  }

  // Determine active tool placement (held in foreground hand vs resting cleanly on walnut table)
  const isActivelyUsing = isDragging || currentAction !== null;

  // 1. Batter Pitcher
  if (heldToolId === 'pitcher' && isActivelyUsing) {
    _tmpPos.set(focusPos.x - 0.042, PLATE_Y + 0.088, focusPos.z + 0.015);
    props.pitcher.group.position.lerp(_tmpPos, Math.min(1, dt * 16));
    const tilt = pourActionTimer > 0 || isDragging ? -0.62 : -0.22;
    props.pitcher.group.rotation.z += (tilt - props.pitcher.group.rotation.z) * Math.min(1, dt * 14);
    props.pitcher.group.rotation.y += (0.05 - props.pitcher.group.rotation.y) * Math.min(1, dt * 12);

    handTargetPos.set(props.pitcher.group.position.x + 0.015, props.pitcher.group.position.y + 0.052, props.pitcher.group.position.z + 0.075);
    handTargetRot.set(-0.35, -0.15, -0.28);
    handGrip = 0.85;

    if (pourActionTimer > 0) {
      pourActionTimer = Math.max(0, pourActionTimer - dt);
      props.pitcher.pourStream.visible = true;
      props.pitcher.pourStream.position.set(focusPos.x, PLATE_Y + 0.048, focusPos.z);
    }
  } else {
    const w = Math.sin(props.pitcher.wobble * Math.PI * 4) * 0.08 * props.pitcher.wobble;
    props.pitcher.wobble = Math.max(0, props.pitcher.wobble - dt * 2.5);
    props.pitcher.group.position.lerp(props.pitcher.homePos, Math.min(1, dt * 10));
    props.pitcher.group.rotation.z += (w - props.pitcher.group.rotation.z) * Math.min(1, dt * 10);
    props.pitcher.group.rotation.y += (props.pitcher.homeRot.y - props.pitcher.group.rotation.y) * Math.min(1, dt * 10);
  }

  // 2. Octopus Bowl + Chopsticks
  {
    const w = Math.sin(props.octopus.wobble * Math.PI * 4) * 0.09 * props.octopus.wobble;
    props.octopus.wobble = Math.max(0, props.octopus.wobble - dt * 2.6);
    props.octopus.group.rotation.z = w;
    if (heldToolId === 'octopus' && isActivelyUsing) {
      heldChopsticks.visible = true;
      heldOctoChunk.visible = true;
      handTargetPos.set(focusPos.x + 0.045, PLATE_Y + 0.078, focusPos.z + 0.088);
      handTargetRot.set(-0.48, -0.25, 0.08);
      handGrip = 0.72;
    }
  }

  // 3. Steel Takoyaki Pick (also used to carry finished steaming takoyaki!)
  if ((heldToolId === 'pick' || heldToolId === 'carry') && isActivelyUsing) {
    const tipPos = (heldToolId === 'carry' && carriedBall)
      ? carriedBall.root.position.clone()
      : new THREE.Vector3(focusPos.x, PLATE_Y + 0.018, focusPos.z);

    _tmpPos.set(tipPos.x + 0.025, tipPos.y + 0.055, tipPos.z + 0.055);
    props.pick.group.position.lerp(_tmpPos, Math.min(1, dt * 18));
    props.pick.group.rotation.set(-0.68, 0.36, 0.1);

    handTargetPos.set(_tmpPos.x + 0.032, _tmpPos.y + 0.028, _tmpPos.z + 0.072);
    handTargetRot.set(-0.55, -0.28, 0.16);
    handGrip = 0.82;
  } else {
    const w = Math.sin(props.pick.wobble * Math.PI * 4) * 0.12 * props.pick.wobble;
    props.pick.wobble = Math.max(0, props.pick.wobble - dt * 2.8);
    props.pick.group.position.lerp(props.pick.homePos, Math.min(1, dt * 10));
    props.pick.group.rotation.x += (props.pick.homeRot.x - props.pick.group.rotation.x) * Math.min(1, dt * 10);
    props.pick.group.rotation.y += (props.pick.homeRot.y + w - props.pick.group.rotation.y) * Math.min(1, dt * 10);
    props.pick.group.rotation.z += (0 - props.pick.group.rotation.z) * Math.min(1, dt * 10);
  }

  // 4. Glossy Dark Takoyaki Sauce Squeeze Bottle
  if (heldToolId === 'sauce' && isActivelyUsing) {
    _tmpPos.set(focusPos.x + 0.02, PLATE_Y + 0.125, focusPos.z + 0.012);
    props.sauce.group.position.lerp(_tmpPos, Math.min(1, dt * 16));
    // Invert bottle nozzle downward over the hot takoyaki!
    props.sauce.group.rotation.z += (Math.PI * 0.86 - props.sauce.group.rotation.z) * Math.min(1, dt * 14);
    props.sauce.group.rotation.x += (-0.25 - props.sauce.group.rotation.x) * Math.min(1, dt * 14);

    handTargetPos.set(_tmpPos.x + 0.038, _tmpPos.y + 0.012, _tmpPos.z + 0.075);
    handTargetRot.set(-0.35, -0.32, 0.25);
    handGrip = 0.90;
  } else {
    const w = Math.sin(props.sauce.wobble * Math.PI * 4) * 0.08 * props.sauce.wobble;
    props.sauce.wobble = Math.max(0, props.sauce.wobble - dt * 2.6);
    props.sauce.group.position.lerp(props.sauce.homePos, Math.min(1, dt * 10));
    props.sauce.group.rotation.z += (w - props.sauce.group.rotation.z) * Math.min(1, dt * 10);
    props.sauce.group.rotation.x += (0 - props.sauce.group.rotation.x) * Math.min(1, dt * 10);
  }

  // 5. Katsuobushi Bowl & Hand Sprinkle Pinch
  {
    const w = Math.sin(props.katsuobushi.wobble * Math.PI * 4) * 0.09 * props.katsuobushi.wobble;
    props.katsuobushi.wobble = Math.max(0, props.katsuobushi.wobble - dt * 2.6);
    props.katsuobushi.group.rotation.z = w;
    // Subtle breeze shiver on bonito flakes inside the wooden bowl
    for (let i = 0; i < props.katsuobushi.bowlFlakes.length; i++) {
      const fl = props.katsuobushi.bowlFlakes[i];
      fl.rotation.z = (i % 2) * 0.6 + Math.sin(time * 2.1 + i) * 0.04;
    }
    if (heldToolId === 'katsuobushi' && isActivelyUsing) {
      heldFlakes.visible = true;
      handTargetPos.set(focusPos.x + 0.035, PLATE_Y + 0.092, focusPos.z + 0.075);
      handTargetRot.set(-0.42, -0.22, -0.05);
      handGrip = 0.58;
    }
  }

  playerHand.setTarget(handTargetPos, handTargetRot, handGrip);
  playerHand.update(dt, time);
}

// =========================================================================
// 6. MAIN ANIMATION LOOP (30fps+ mobile-friendly, smooth damped physics)
// =========================================================================
let prevTime = performance.now() * 0.001;
let frameCount = 0;
let fpsAccum = 0;
let currentFps = 60;

// Extract one simulation step so both live RAF loop & fast deterministic testing share identical physics
function stepFrame(dt, now) {
  // 1. Overhead pendant lamp pendulum physics (swings warm light pool + real shadows!)
  const lamp = props.lamp;
  const springAcc = -4.2 * lamp.swingAngle - 0.55 * lamp.swingVel;
  lamp.swingVel += springAcc * dt;
  lamp.swingAngle += lamp.swingVel * dt;
  const subtleDrift = Math.sin(now * 0.65) * 0.006;
  lamp.group.rotation.z = lamp.swingAngle + subtleDrift;

  // 2. Gas burner warm flicker & cast-iron oil heat shimmer
  const heatScale = props.knob.highHeat ? 1.0 : 0.65;
  const flicker = 0.92 + Math.sin(now * 19.3) * 0.05 + Math.sin(now * 31.7) * 0.03;
  world.burnerUnderLight.intensity = 0.24 * heatScale * flicker;
  props.knob.wobble = Math.max(0, props.knob.wobble - dt * 4);
  props.knob.group.rotation.z = (props.knob.highHeat ? 0.55 : -0.35) + Math.sin(props.knob.wobble * 12) * 0.1;

  for (let i = 0; i < world.oilPools.length; i++) {
    const pool = world.oilPools[i];
    const hasBatter = balls[i].stage !== 'empty' && !balls[i].isOnPlate && !balls[i].isCarried;
    pool.visible = !hasBatter;
    if (pool.visible) {
      const s = 0.96 + Math.sin(now * 4.2 + i * 1.4) * 0.04;
      pool.scale.set(s, s, 1);
      if (Math.random() < 0.015 * dt * 60) {
        particles.spawnSteam(pool.position.x, PLATE_Y + 0.005, pool.position.z, 0.45);
      }
    }
  }

  for (const t of props.teaGlasses) {
    if (t.clink > 0) {
      t.clink = Math.max(0, t.clink - dt * 2.5);
      t.ice.position.y = 0.065 + Math.sin(t.clink * Math.PI * 5) * 0.004 * t.clink;
      t.ice.rotation.y += dt * 4 * t.clink;
    }
  }

  let activeCookingCount = 0;
  for (const b of balls) {
    b.update(dt, now, particles);
    if (b.stage !== 'empty' && !b.isOnPlate && !b.isCarried) {
      activeCookingCount++;
    }
  }
  audio.setSizzleLevel(activeCookingCount / 6);

  particles.update(dt, now);
  updateUtensilsAndHand(dt, now);
  mom.update(dt, now, gazeTarget);
  dad.update(dt, now, gazeTarget);

  camera.position.set(
    camBasePos.x + Math.sin(now * 0.45) * 0.003,
    camBasePos.y + Math.cos(now * 0.62) * 0.002,
    camBasePos.z
  );
  camera.lookAt(camLookAt);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevTime));
  prevTime = now;

  frameCount++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    currentFps = Math.round(frameCount / fpsAccum);
    frameCount = 0;
    fpsAccum = 0;
  }

  stepFrame(dt, now);
  composer.render();
}
animate();

// Expose clean internal verification hook (zero UI impact) for automated screenshot & perf inspection
function countSceneTriangles() {
  let tris = 0;
  scene.traverse(obj => {
    if (obj.isMesh && obj.geometry) {
      const g = obj.geometry;
      const mult = obj.isInstancedMesh ? obj.count : 1;
      if (g.index) tris += (g.index.count / 3) * mult;
      else if (g.attributes.position) tris += (g.attributes.position.count / 3) * mult;
    }
  });
  return Math.round(tris);
}

window.__TAKOYAKI_DEBUG__ = {
  getStats: () => ({
    fps: currentFps,
    sceneTriangles: countSceneTriangles(),
    dpr: renderer.getPixelRatio(),
    size: { w: renderer.domElement.width, h: renderer.domElement.height },
    stages: balls.map(b => ({ stage: b.stage, flip: b.flipCount, sauce: b.sauceLevel, katsuo: b.katsuoAmount, plated: b.isOnPlate }))
  }),
  step: (n = 20, dt = 1 / 30) => {
    let t = performance.now() * 0.001;
    for (let i = 0; i < n; i++) {
      t += dt;
      stepFrame(dt, t);
    }
    composer.render();
  },
  capture: async (name = '_shot.png', mime = 'image/png', quality = 0.92) => {
    // Advance one clean render frame right before readback so drawing buffer is fresh
    composer.render();
    const dataUrl = renderer.domElement.toDataURL(mime, quality);
    const res = await fetch('/__shot?name=' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: dataUrl
    });
    return await res.text();
  },
  demoStage: (mode) => {
    if (mode === 'fresh') {
      balls.forEach(b => b.reset());
    } else if (mode === 'cooking_mix') {
      balls.forEach(b => b.reset());
      // Well 0: raw batter + octopus + crispy overflow skirt
      balls[0].pourBatter(1.25);
      balls[0].addOctopus();
      balls[0].cookBottom = 0.45;
      // Well 1: half-flipped showing golden crust + raw batter!
      balls[1].pourBatter(1.0);
      balls[1].addOctopus();
      balls[1].cookBottom = 0.72;
      balls[1].flip(1, 1);
      // Well 2: plump golden round ball!
      balls[2].pourBatter(1.0);
      balls[2].addOctopus();
      balls[2].flip(1, 1);
      balls[2].flip(1, 1);
      balls[2].cookBottom = 0.92;
      balls[2].cookTop = 0.88;
      // Well 3: golden + glossy dark sauce!
      balls[3].pourBatter(1.0);
      balls[3].addOctopus();
      balls[3].flip(1, 1);
      balls[3].flip(1, 1);
      balls[3].cookBottom = 0.95;
      balls[3].cookTop = 0.90;
      balls[3].addSauce();
      // Well 4: finished golden + sauce + mayo/aonori + dancing katsuobushi!
      balls[4].pourBatter(1.0);
      balls[4].addOctopus();
      balls[4].addOctopus();
      balls[4].flip(1, 1);
      balls[4].flip(1, 1);
      balls[4].cookBottom = 0.95;
      balls[4].cookTop = 0.92;
      balls[4].addSauce();
      balls[4].addSauce();
      balls[4].addKatsuobushi();
      // Well 5: finished golden + sauce + dancing katsuobushi!
      balls[5].pourBatter(1.0);
      balls[5].addOctopus();
      balls[5].flip(1, 1);
      balls[5].flip(1, 1);
      balls[5].cookBottom = 0.94;
      balls[5].cookTop = 0.91;
      balls[5].addSauce();
      balls[5].addKatsuobushi();
      mom.react('amazed');
      dad.react('amazed');
      particles.spawnSteamBurst(0, PLATE_Y + 0.025, 0, 14);
      particles.spawnOilBurst(balls[1].root.position.x, PLATE_Y + 0.01, balls[1].root.position.z, 14, 1.0);
    }
  }
};
