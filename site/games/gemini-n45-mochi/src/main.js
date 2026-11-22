import * as THREE from 'three';
import {
  createWashitsuEnvironmentMap,
  buildWashitsuScene,
  BOARD_Y,
  BOARD_CENTER,
  BOARD_SIZE,
} from './environment.js';
import { createMochiTextures, createKinakoTextures } from './textures.js';
import {
  MochiMound,
  ViscoelasticBridge,
  MochiPiece,
  MOUND_POS,
  WORK_POS,
} from './mochiPhysics.js';
import { buildToppingsAndPlates } from './toppings.js';
import { FamilyHandsEnsemble } from './hands.js';
import { MochiParticleSystem } from './particles.js';
import { audio } from './audio.js';

// --- Renderer Setup (Photorealistic ACES Filmic, iPhone/iPad 30fps+ optimized) ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x28211b);
scene.fog = new THREE.FogExp2(0xe2d8c8, 0.015);

// Custom Washitsu Shoji HDR-like environment map for realistic reflections
const envMap = createWashitsuEnvironmentMap(renderer);
scene.environment = envMap;

// Camera (Photographic 50mm-style lens framing BOTH sunlit Shoji+Tatami AND large mochi/hands/toppings!)
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.2, 60);

function updateCameraLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // iPhone Portrait
    camera.fov = 48;
    camera.position.set(0.05, 6.75, 8.15);
    camera.lookAt(0.0, 0.10, -0.15);
  } else if (aspect < 1.25) {
    // iPad / 4:3 — intimate table-side washitsu photography framing Shoji, Tatami, family hands & mochi!
    camera.fov = 42;
    camera.position.set(0.08, 4.95, 7.15);
    camera.lookAt(0.02, 0.24, -0.45);
  } else {
    // Desktop / Landscape Widescreen
    camera.fov = 39;
    camera.position.set(0.10, 4.75, 6.85);
    camera.lookAt(0.02, 0.26, -0.45);
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
updateCameraLayout();
window.addEventListener('resize', updateCameraLayout);

// --- Build World, Mochi, Toppings, Family Hands, Particles ---
const env = buildWashitsuScene(scene);
const mochiTex = createMochiTextures();
const kinakoTex = createKinakoTextures();
const props = buildToppingsAndPlates(scene);
const mound = new MochiMound(scene, mochiTex, kinakoTex);
const stretchBridge = new ViscoelasticBridge(scene, mochiTex, kinakoTex);
const biteBridge = new ViscoelasticBridge(scene, mochiTex, kinakoTex);
const familyHands = new FamilyHandsEnsemble(scene);
const particles = new MochiParticleSystem(scene);

// --- Game & Interaction State ---
let activeMochi = null;        // Currently worked MochiPiece on the board (or null)
let pullingPiece = null;       // Temporary pulled lump while stretching from mound
let servedMochiAll = [];       // All served MochiPiece instances (for update & cleanup)
let familyServedSet = new Set();
let totalServedCount = 0;
let piecesTornSinceReplenish = 0;

// Idle gentle hint timer (Wordless spec: 0-6s silent, ~10s gentle environmental gesture once)
let idleTimer = 0;
let idleHintDone = false;

// Pointer tracking (strictly single-finger primary pointerId, multi-touch safe!)
let activePointerId = null;
let dragMode = 'none'; // 'none' | 'stretch' | 'roll_or_carry' | 'carry'
const dragStartWorld = new THREE.Vector3();
const prevDragWorld = new THREE.Vector3();
const curDragWorld = new THREE.Vector3();
let rollAccumDist = 0;
let rollPhase = 0;
let patCooldown = 0;
let kinakoTapBurstCount = 0;
let kagamiWobble = 0;
let carryAnim = null; // Optional smooth auto-move animation when child taps a topping or plate

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_Y);
const _hitVec = new THREE.Vector3();
const _anchorVec = new THREE.Vector3();
const _tipVec = new THREE.Vector3();

function screenToBoardWorld(clientX, clientY, out = _hitVec) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  raycaster.ray.intersectPlane(tablePlane, out);
  // Clamp safely within reachable table bounds
  out.x = THREE.MathUtils.clamp(out.x, -4.8, 4.8);
  out.z = THREE.MathUtils.clamp(out.z, -3.2, 3.4);
  return out;
}

function isInsideBoard(pos, margin = 0.25) {
  return (
    Math.abs(pos.x - BOARD_CENTER.x) < BOARD_SIZE.w * 0.5 + margin &&
    Math.abs(pos.z - BOARD_CENTER.z) < BOARD_SIZE.d * 0.5 + margin
  );
}

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Apply a topping to the active mochi with rich particles & sound
function applyToppingToActive(kind) {
  if (!activeMochi) return;
  const mp = activeMochi.group.position;
  if (kind === 'kinako') {
    activeMochi.addKinako(0.62);
    props.toppings.kinako.wobble = 1.0;
    audio.playKinakoPuff(1.1);
    particles.burstKinako(new THREE.Vector3(mp.x, mp.y + 0.28, mp.z), 1.35);
    particles.burstKinako(new THREE.Vector3(props.toppings.kinako.pos.x, 0.52, props.toppings.kinako.pos.z), 0.9);
    familyHands.triggerKinakoFan();
  } else if (kind === 'anko') {
    activeMochi.addAnko();
    props.toppings.anko.wobble = 1.0;
    audio.playAnkoScoop();
    particles.burstFlour(new THREE.Vector3(mp.x, mp.y + 0.22, mp.z), 0.35);
  } else if (kind === 'nori') {
    activeMochi.addNori();
    props.toppings.nori.wobble = 1.0;
    audio.playNoriWrap();
  }
}

// Serve the active mochi onto a chosen family plate!
function serveActiveMochiToPlate(plate) {
  if (!activeMochi) return;
  const piece = activeMochi;
  activeMochi = null;

  // Tidy oldest if plate already holds 3 mochi
  while (plate.mochiList.length >= 3) {
    const old = plate.mochiList.shift();
    old.dispose();
    servedMochiAll = servedMochiAll.filter((m) => m !== old);
  }

  // Stack nicely if 1 already exists (especially fun for Kagami-mochi mini surprise!), or nest beside
  const existing = plate.mochiList;
  let targetY = plate.surfaceY;
  let offsetX = 0;
  let offsetZ = 0;

  if (existing.length === 1) {
    const first = existing[0];
    // Stack directly on top!
    targetY = plate.surfaceY + first.baseRadius * 0.92;
    offsetX = 0;
    offsetZ = 0;
    // Discovery: stacking 2 plain white mochi triggers Mini Kagami-Mochi with a tiny orange mikan!
    const bothPlainWhite =
      first.kinakoAmount < 0.1 && first.ankoAmount === 0 && first.noriAmount === 0 &&
      piece.kinakoAmount < 0.1 && piece.ankoAmount === 0 && piece.noriAmount === 0;
    if (bothPlainWhite) {
      piece.addBonusMikan();
    }
  } else if (existing.length === 2) {
    offsetX = 0.34;
    offsetZ = 0.22;
    targetY = plate.surfaceY;
  }

  piece.group.position.set(plate.basePos.x + offsetX, targetY, plate.basePos.z + offsetZ);
  piece.impulse(0, -3.2, 0);
  plate.mochiList.push(piece);
  servedMochiAll.push(piece);
  plate.wobble = 1.0;

  // Particle puff if kinako coated!
  if (piece.kinakoAmount > 0.1) {
    particles.burstKinako(piece.group.position, 0.65);
  }

  familyServedSet.add(plate.id);
  totalServedCount++;
  const isFullFamilyCelebration = familyServedSet.size >= 3 && totalServedCount % 3 === 0;

  const pIdx = props.plates.indexOf(plate);
  audio.playServe(pIdx, isFullFamilyCelebration);

  // Trigger family member's chopsticks lift-and-stretch reaction!
  familyHands.triggerServeReaction(
    plate.id,
    existing.length === 1 ? piece : piece,
    new THREE.Vector3(plate.basePos.x + offsetX, plate.basePos.y, plate.basePos.z + offsetZ),
    (ptA, ptB, ratio, kinakoAmt) => {
      if (!ptA || !ptB || ratio < 0.04) {
        biteBridge.hide();
      } else {
        biteBridge.updateStretch(ptA, ptB, 0.24, 0.20, ratio, performance.now() * 0.001, kinakoAmt);
      }
    }
  );

  if (isFullFamilyCelebration) {
    familyHands.triggerCelebration();
  }

  // Replenish fresh steaming mochi mound smoothly after several pieces
  if (piecesTornSinceReplenish >= 5) {
    piecesTornSinceReplenish = 0;
    setTimeout(() => {
      mound.replenish();
      particles.burstFlour(new THREE.Vector3(MOUND_POS.x, BOARD_Y + 0.55, MOUND_POS.z), 1.1);
      audio.playPoke(0.9);
    }, 650);
  }
}

// Smoothly carry active mochi via child hand to a destination (used when child taps a topping or plate)
function startAutoCarry(targetPos, onArrive, returnToBoard = false) {
  if (!activeMochi) return;
  carryAnim = {
    start: activeMochi.group.position.clone(),
    target: targetPos.clone(),
    progress: 0,
    duration: 0.34,
    onArrive,
    returnToBoard,
    returning: false,
  };
}

// --- Unified Single-Finger Pointer Input ---
function onPointerDown(e) {
  if (activePointerId !== null) return; // Ignore 2nd finger safely (multi-touch safe!)
  activePointerId = e.pointerId;
  renderer.domElement.setPointerCapture?.(e.pointerId);
  audio.unlock();
  idleTimer = 0;
  idleHintDone = false;

  const world = screenToBoardWorld(e.clientX, e.clientY);
  dragStartWorld.copy(world);
  prevDragWorld.copy(world);
  curDragWorld.copy(world);
  carryAnim = null;

  // 1. Check active mochi first (generous touch radius for a 5-year-old!)
  if (activeMochi && dist2D(world, activeMochi.group.position) < 1.15) {
    dragMode = 'roll_or_carry';
    rollAccumDist = 0;
    activeMochi.impulse(0, -1.8, 0);
    audio.playRollPat(activeMochi.roundness);
    familyHands.setChildPose('roll', activeMochi.group.position, rollPhase);
    return;
  }

  // 2. Check Main Steaming Mochi Mound (generous touch radius!)
  if (dist2D(world, MOUND_POS) < 1.55) {
    dragMode = 'stretch';
    mound.poke(0, -2.2, 0);
    audio.playPoke(0.85);
    particles.burstFlour(new THREE.Vector3(world.x, BOARD_Y + 0.45, world.z), 0.55);

    // If an earlier active mochi was still sitting untouched on the board, keep it gently nudged or replace cleanly
    if (pullingPiece) {
      pullingPiece.dispose();
      pullingPiece = null;
    }
    pullingPiece = new MochiPiece(scene, mochiTex, kinakoTex, props.materials, 0.92);
    pullingPiece.group.position.set(world.x, BOARD_Y + 0.22, world.z);
    pullingPiece.group.scale.setScalar(0.55);
    familyHands.setChildPose('stretch', pullingPiece.group.position);
    return;
  }

  // 3. Check Toppings (Kinako / Anko / Nori)
  for (const [kind, obj] of Object.entries(props.toppings)) {
    if (dist2D(world, obj.pos) < obj.radius + 0.35) {
      obj.wobble = 1.0;
      if (activeMochi) {
        // Forgiving 5-year-old affordance: tapping a topping while mochi is on board dips it automatically!
        startAutoCarry(
          new THREE.Vector3(obj.pos.x, obj.pos.y + 0.48, obj.pos.z),
          () => applyToppingToActive(kind),
          true
        );
      } else {
        // Honest playful tactile reaction even before tearing mochi!
        if (kind === 'kinako') {
          kinakoTapBurstCount++;
          audio.playKinakoPuff(1.0);
          particles.burstKinako(new THREE.Vector3(obj.pos.x, 0.52, obj.pos.z), 1.35);
          if (kinakoTapBurstCount >= 2) {
            familyHands.triggerKinakoFan();
            kinakoTapBurstCount = 0;
          }
        } else if (kind === 'anko') {
          audio.playAnkoScoop();
        } else {
          audio.playNoriWrap();
        }
      }
      return;
    }
  }

  // 4. Check Family Plates (serving OR playful beckon)
  for (let i = 0; i < props.plates.length; i++) {
    const plate = props.plates[i];
    if (dist2D(world, plate.basePos) < plate.radius + 0.42) {
      if (activeMochi) {
        startAutoCarry(
          new THREE.Vector3(plate.basePos.x, 0.55, plate.basePos.z),
          () => serveActiveMochiToPlate(plate),
          false
        );
      } else {
        plate.wobble = 0.85;
        audio.playPlateTap(i);
        familyHands.triggerBeckon(plate.id);
      }
      return;
    }
  }

  // 5. Playful surprise: tapping the Kagami-Mochi in the upper-left corner!
  if (dist2D(world, env.kagamiGroup.position) < 1.1) {
    kagamiWobble = 1.0;
    audio.playPoke(0.55);
  }
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId) return;
  idleTimer = 0;

  const world = screenToBoardWorld(e.clientX, e.clientY);
  const dx = world.x - prevDragWorld.x;
  const dz = world.z - prevDragWorld.z;
  const stepDist = Math.hypot(dx, dz);
  curDragWorld.copy(world);

  if (dragMode === 'stretch' && pullingPiece) {
    const pullDist = dist2D(world, MOUND_POS);
    const snapDist = 1.92;
    const ratio = THREE.MathUtils.clamp(pullDist / snapDist, 0, 1.05);

    // Pulled piece grows as you pull more mochi out of the mound!
    const grow = THREE.MathUtils.clamp(0.55 + ratio * 0.48, 0.55, 1.06);
    pullingPiece.group.scale.setScalar(grow);
    pullingPiece.roundness = Math.min(0.45, ratio * 0.45);
    const liftY = BOARD_Y + 0.14 + Math.min(0.32, ratio * 0.28);
    pullingPiece.group.position.set(world.x, liftY, world.z);

    // Viscoelastic mound tenting & bridge update
    mound.setPull(pullingPiece.group.position, Math.min(1.0, ratio * 1.15));
    familyHands.setBoardBracing(ratio > 0.25);

    // Compute seamless anchor point inside the facing flank of the main mound
    const dirX = (world.x - MOUND_POS.x) / Math.max(0.01, pullDist);
    const dirZ = (world.z - MOUND_POS.z) / Math.max(0.01, pullDist);
    _anchorVec.set(MOUND_POS.x + dirX * 0.56, BOARD_Y + 0.28, MOUND_POS.z + dirZ * 0.56);
    _tipVec.set(world.x, liftY + 0.14, world.z);
    stretchBridge.updateStretch(_anchorVec, _tipVec, 0.44, 0.34 * grow, ratio, simClock, 0);

    audio.updateStretch(true, ratio, stepDist * 40);
    familyHands.setChildPose('stretch', pullingPiece.group.position);

    // SNAP! (ちぎれる！)
    if (pullDist >= snapDist) {
      finishStretchSnap(dirX, dirZ, stepDist, world);
    }
  } else if (dragMode === 'roll_or_carry' && activeMochi) {
    if (!isInsideBoard(world, 0.08)) {
      // Child dragged the mochi off the board toward toppings or family plates -> Carry mode!
      dragMode = 'carry';
    } else {
      // Rolling & shaping on the dusted hinoki board!
      // Keep mochi softly magneted near the clean right-center of the board while letting it follow gently
      const targetX = THREE.MathUtils.clamp(world.x, BOARD_CENTER.x - 0.15, BOARD_CENTER.x + BOARD_SIZE.w * 0.42);
      const targetZ = THREE.MathUtils.clamp(world.z, BOARD_CENTER.z - BOARD_SIZE.d * 0.36, BOARD_CENTER.z + BOARD_SIZE.d * 0.36);
      activeMochi.group.position.x += (targetX - activeMochi.group.position.x) * 0.28;
      activeMochi.group.position.z += (targetZ - activeMochi.group.position.z) * 0.28;
      activeMochi.group.position.y = BOARD_Y;

      if (stepDist > 0.015) {
        rollAccumDist += stepDist;
        rollPhase += stepDist * 4.2;
        activeMochi.group.rotation.y += (dx - dz) * 0.85;
        activeMochi.addRollingProgress(stepDist * 0.24, dx * 22, dz * 22);

        if (patCooldown <= 0) {
          audio.playRollPat(activeMochi.roundness);
          particles.burstFlour(activeMochi.group.position, 0.38);
          patCooldown = 0.16;
        }
      }
      familyHands.setChildPose('roll', activeMochi.group.position, rollPhase);
    }
  }

  if (dragMode === 'carry' && activeMochi) {
    // Carry the mochi gracefully above the table following the child's finger!
    const hoverY = BOARD_Y + 0.46;
    activeMochi.group.position.x += (world.x - activeMochi.group.position.x) * 0.45;
    activeMochi.group.position.z += (world.z - activeMochi.group.position.z) * 0.45;
    activeMochi.group.position.y += (hoverY - activeMochi.group.position.y) * 0.35;
    familyHands.setChildPose('carry', activeMochi.group.position);

    // Live dipping while dragging directly over a topping bowl!
    for (const [kind, obj] of Object.entries(props.toppings)) {
      if (dist2D(activeMochi.group.position, obj.pos) < obj.radius + 0.22) {
        if (!obj._dippedDuringDrag) {
          obj._dippedDuringDrag = true;
          applyToppingToActive(kind);
        }
      } else {
        obj._dippedDuringDrag = false;
      }
    }
  }

  prevDragWorld.copy(world);
}

function finishStretchSnap(dirX, dirZ, stepDist, world, onRelease = false) {
  stretchBridge.hide();
  mound.setPull(null, 0);
  mound.consumePiece();
  mound.poke(-dirX * 3.6, 2.1, -dirZ * 3.6);
  familyHands.setBoardBracing(false);

  if (activeMochi) {
    activeMochi.dispose();
  }
  activeMochi = pullingPiece;
  pullingPiece = null;
  piecesTornSinceReplenish++;

  const finalScale = THREE.MathUtils.clamp(0.92 + Math.min(0.22, stepDist * 0.40), 0.90, 1.14);
  activeMochi.group.scale.setScalar(finalScale);
  activeMochi.impulse(dirX * 3.0, -2.4, dirZ * 3.0);

  audio.playSnap(finalScale);
  const midPt = _anchorVec.clone().lerp(_tipVec, 0.5);
  particles.burstFlour(midPt, 1.25);

  if (onRelease) {
    activeMochi.group.position.set(
      THREE.MathUtils.clamp(world.x, BOARD_CENTER.x - 0.05, BOARD_CENTER.x + BOARD_SIZE.w * 0.40),
      BOARD_Y,
      THREE.MathUtils.clamp(world.z, BOARD_CENTER.z - BOARD_SIZE.d * 0.34, BOARD_CENTER.z + BOARD_SIZE.d * 0.34)
    );
  } else {
    dragMode = isInsideBoard(world, 0.1) ? 'roll_or_carry' : 'carry';
    rollAccumDist = 0;
  }
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  audio.updateStretch(false);
  familyHands.setBoardBracing(false);

  // Clear per-drag dip flags
  for (const obj of Object.values(props.toppings)) obj._dippedDuringDrag = false;

  if (dragMode === 'stretch' && pullingPiece) {
    const pullDist = dist2D(pullingPiece.group.position, MOUND_POS);
    if (pullDist >= 1.28) {
      // Forgiving 5-year-old assist: pulling out past 1.28 units & releasing cleanly tears the mochi off!
      const dirX = (pullingPiece.group.position.x - MOUND_POS.x) / Math.max(0.01, pullDist);
      const dirZ = (pullingPiece.group.position.z - MOUND_POS.z) / Math.max(0.01, pullDist);
      finishStretchSnap(dirX, dirZ, 0.1, pullingPiece.group.position, true);
    } else {
      // Short playful tug -> elastic spring recoil back into the main mound!
      stretchBridge.hide();
      mound.setPull(null, 0);
      mound.poke(
        (pullingPiece.group.position.x - MOUND_POS.x) * 1.6,
        -2.0,
        (pullingPiece.group.position.z - MOUND_POS.z) * 1.6
      );
      audio.playPoke(0.75);
      pullingPiece.dispose();
      pullingPiece = null;
    }
  } else if ((dragMode === 'carry' || dragMode === 'roll_or_carry') && activeMochi) {
    const pos = activeMochi.group.position;

    // 1. Forgiving magnetic drop onto any Family Plate!
    let droppedPlate = null;
    let bestD = Infinity;
    for (const plate of props.plates) {
      const d = dist2D(pos, plate.basePos);
      if (d < plate.radius + 0.55 && d < bestD) {
        bestD = d;
        droppedPlate = plate;
      }
    }

    if (droppedPlate) {
      serveActiveMochiToPlate(droppedPlate);
    } else {
      // Check if released right over a topping bowl -> apply topping & gently settle back onto board!
      let droppedTopping = null;
      for (const [kind, obj] of Object.entries(props.toppings)) {
        if (dist2D(pos, obj.pos) < obj.radius + 0.35) {
          droppedTopping = kind;
          break;
        }
      }
      if (droppedTopping) {
        applyToppingToActive(droppedTopping);
      }

      // Gently settle onto the clean working area of the hinoki board
      const settleX = isInsideBoard(pos, -0.1)
        ? THREE.MathUtils.clamp(pos.x, BOARD_CENTER.x - 0.1, BOARD_CENTER.x + BOARD_SIZE.w * 0.40)
        : WORK_POS.x;
      const settleZ = isInsideBoard(pos, -0.1)
        ? THREE.MathUtils.clamp(pos.z, BOARD_CENTER.z - BOARD_SIZE.d * 0.35, BOARD_CENTER.z + BOARD_SIZE.d * 0.35)
        : WORK_POS.z;

      startAutoCarry(new THREE.Vector3(settleX, BOARD_Y, settleZ), () => {
        if (activeMochi) activeMochi.impulse(0, -1.5, 0);
      }, false);
    }
  }

  dragMode = 'none';
  if (!carryAnim) {
    familyHands.setChildPose('idle');
  }
}

const dom = renderer.domElement;
dom.addEventListener('pointerdown', onPointerDown);
dom.addEventListener('pointermove', onPointerMove);
dom.addEventListener('pointerup', onPointerUp);
dom.addEventListener('pointercancel', onPointerUp);

// --- Main Animation Loop ---
let lastTime = performance.now();
let fpsSmooth = 60;

function stepSimulation(dt, time) {
  if (patCooldown > 0) patCooldown -= dt;

  if (activePointerId === null && !carryAnim) {
    idleTimer += dt;
    if (idleTimer > 10.0 && !idleHintDone) {
      idleHintDone = true;
      familyHands.triggerIdleHint(activeMochi ? 'plate' : 'mound');
    }
  }

  if (carryAnim && activeMochi) {
    carryAnim.progress += dt / carryAnim.duration;
    const t = Math.min(1.0, carryAnim.progress);
    const ease = t * t * (3 - 2 * t);
    const arc = Math.sin(t * Math.PI) * 0.55;

    activeMochi.group.position.lerpVectors(carryAnim.start, carryAnim.target, ease);
    activeMochi.group.position.y += arc;
    familyHands.setChildPose('carry', activeMochi.group.position);

    if (t >= 1.0) {
      const cb = carryAnim.onArrive;
      const shouldReturn = carryAnim.returnToBoard && !carryAnim.returning;
      if (cb) cb();
      if (shouldReturn && activeMochi) {
        carryAnim = {
          start: activeMochi.group.position.clone(),
          target: new THREE.Vector3(WORK_POS.x, BOARD_Y, WORK_POS.z),
          progress: 0,
          duration: 0.34,
          onArrive: () => {
            if (activeMochi) activeMochi.impulse(0, -1.6, 0);
            familyHands.setChildPose('idle');
          },
          returnToBoard: false,
          returning: true,
        };
      } else {
        carryAnim = null;
        familyHands.setChildPose('idle');
      }
    }
  }

  mound.update(dt, time);
  if (pullingPiece) pullingPiece.update(dt);
  if (activeMochi) activeMochi.update(dt);
  for (const sm of servedMochiAll) sm.update(dt);

  for (const obj of Object.values(props.toppings)) {
    if (obj.wobble > 0.001) {
      obj.wobble = Math.max(0, obj.wobble - dt * 2.8);
      const w = Math.sin(obj.wobble * Math.PI * 5) * obj.wobble * 0.05;
      obj.group.rotation.z = w;
      obj.group.rotation.x = w * 0.6;
    } else {
      obj.group.rotation.set(0, 0, 0);
    }
  }
  for (const plate of props.plates) {
    if (plate.wobble > 0.001) {
      plate.wobble = Math.max(0, plate.wobble - dt * 3.0);
      const w = Math.sin(plate.wobble * Math.PI * 4) * plate.wobble * 0.04;
      plate.group.rotation.z = w;
    } else {
      plate.group.rotation.z = 0;
    }
  }
  if (kagamiWobble > 0.001) {
    kagamiWobble = Math.max(0, kagamiWobble - dt * 2.2);
    env.daidaiGroup.rotation.z = Math.sin(kagamiWobble * Math.PI * 6) * kagamiWobble * 0.24;
  }

  familyHands.update(dt, time);

  const steamSources = [
    { pos: new THREE.Vector3(MOUND_POS.x, BOARD_Y + 0.55, MOUND_POS.z), scale: 1.05, chance: 0.72 },
    { pos: env.teaSteamOrigin, scale: 0.55, chance: 0.35 },
  ];
  if (activeMochi && activeMochi.kinakoAmount < 0.4) {
    steamSources.push({
      pos: new THREE.Vector3(
        activeMochi.group.position.x,
        activeMochi.group.position.y + 0.35,
        activeMochi.group.position.z
      ),
      scale: 0.62,
      chance: 0.45,
    });
  }
  particles.update(dt, time, steamSources);
}

let simClock = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - lastTime) * 0.001;
  lastTime = now;
  const dt = Math.min(rawDt, 0.05);
  simClock += dt;
  if (rawDt > 0.001) {
    fpsSmooth = fpsSmooth * 0.92 + (1 / rawDt) * 0.08;
  }

  stepSimulation(dt, simClock);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Lightweight invisible diagnostic handle for automated realism & performance inspection
window.__mochiDebug = {
  renderNow: () => renderer.render(scene, camera),
  step: (seconds = 0.5) => {
    const steps = Math.max(1, Math.round(seconds / 0.02));
    for (let i = 0; i < steps; i++) {
      simClock += 0.02;
      stepSimulation(0.02, simClock);
    }
    renderer.render(scene, camera);
  },
  reset: () => {
    if (pullingPiece) { pullingPiece.dispose(); pullingPiece = null; }
    if (activeMochi) { activeMochi.dispose(); activeMochi = null; }
    for (const sm of servedMochiAll) sm.dispose();
    servedMochiAll = [];
    for (const p of props.plates) p.mochiList = [];
    stretchBridge.hide();
    biteBridge.hide();
    mound.setPull(null, 0);
    familyHands.setBoardBracing(false);
    familyHands.setChildPose('idle');
    for (const m of familyHands.members) {
      m.state = 'idle';
      m.servedMochi = null;
      m.mainHand.setPose('relaxed');
      m.helperHand.setPose('relaxed');
    }
  },
  getStats: () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    fps: Math.round(fpsSmooth),
    pixelRatio: renderer.getPixelRatio(),
    hasActiveMochi: !!activeMochi,
    servedCount: totalServedCount,
  }),
  demoStretch: (ratio = 0.84) => {
    window.__mochiDebug.reset();
    pullingPiece = new MochiPiece(scene, mochiTex, kinakoTex, props.materials, 0.96);
    pullingPiece.roundness = 0.55;
    const target = new THREE.Vector3(MOUND_POS.x + 2.52 * ratio, BOARD_Y + 0.34, MOUND_POS.z + 0.26 * ratio);
    pullingPiece.group.position.copy(target);
    pullingPiece.group.scale.setScalar(0.95);
    mound.setPull(target, ratio);
    familyHands.setBoardBracing(true);
    familyHands.setChildPose('stretch', target);
    _anchorVec.set(MOUND_POS.x + 0.58, BOARD_Y + 0.28, MOUND_POS.z + 0.08);
    _tipVec.set(target.x, target.y + 0.14, target.z);
    stretchBridge.updateStretch(_anchorVec, _tipVec, 0.44, 0.34, ratio, simClock, 0);
    particles.burstFlour(target, 0.8);
  },
  demoDecoratedServe: () => {
    window.__mochiDebug.reset();
    const configs = [
      { plateIdx: 0, kinako: 0.95, anko: 0, nori: 0 },
      { plateIdx: 1, kinako: 0, anko: 1.0, nori: 0 },
      { plateIdx: 2, kinako: 0, anko: 0, nori: 1.0 },
    ];
    for (const c of configs) {
      const m = new MochiPiece(scene, mochiTex, kinakoTex, props.materials, 1.04);
      m.roundness = 1.0;
      if (c.kinako) m.addKinako(c.kinako);
      if (c.anko) m.addAnko();
      if (c.nori) m.addNori();
      activeMochi = m;
      serveActiveMochiToPlate(props.plates[c.plateIdx]);
    }
    activeMochi = new MochiPiece(scene, mochiTex, kinakoTex, props.materials, 1.05);
    activeMochi.roundness = 1.0;
    activeMochi.group.position.set(WORK_POS.x, BOARD_Y, WORK_POS.z);
    activeMochi.addKinako(0.88);
    particles.burstKinako(new THREE.Vector3(WORK_POS.x, BOARD_Y + 0.42, WORK_POS.z), 1.65);
    particles.burstKinako(new THREE.Vector3(props.toppings.kinako.pos.x, 0.58, props.toppings.kinako.pos.z), 1.25);
  },
};
