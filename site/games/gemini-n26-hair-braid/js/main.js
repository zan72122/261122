import * as THREE from '../vendor/three.module.js';
import { buildTextureLibrary } from './textures.js';
import { SoundEngine } from './audio.js';
import { YarnDoll } from './doll.js';
import { CraftProps, createAccessoryMesh } from './props.js';

/**
 * Yarn Doll Hair Salon — Wordless 3D Tactile Craft Game for 5-Year-Olds
 * Zero text, zero arrows, one-finger intuitive physical play.
 */

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#efd9c0');
scene.fog = new THREE.Fog('#efd9c0', 11.5, 22);

// Main Camera
const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 40);
const camPosTarget = new THREE.Vector3(0, 3.05, 7.6);
const camLookTarget = new THREE.Vector3(0, 1.95, 0.0);
const camLookCurrent = camLookTarget.clone();
camera.position.copy(camPosTarget);
camera.lookAt(camLookCurrent);

// Real-time Mirror Reflection Target (384x384 — crisp & silky >=30fps on iPhone/iPad!)
const mirrorRenderTarget = new THREE.WebGLRenderTarget(384, 384, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
});
mirrorRenderTarget.texture.colorSpace = THREE.SRGBColorSpace;
const mirrorCamera = new THREE.PerspectiveCamera(42, 0.86 / 1.13, 0.1, 25);

// Warm Cozy Craft-Table Lighting
const hemiLight = new THREE.HemisphereLight('#fff7eb', '#d8a986', 1.15);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight('#fff2de', 1.75);
keyLight.position.set(-3.2, 6.8, 5.4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(512, 512);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 18;
keyLight.shadow.camera.left = -4.5;
keyLight.shadow.camera.right = 4.5;
keyLight.shadow.camera.top = 5.5;
keyLight.shadow.camera.bottom = -2.5;
keyLight.shadow.bias = -0.0008;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight('#ffdcc8', 0.65);
fillLight.position.set(4.5, 3.2, 3.5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight('#fff5d6', 0.55);
rimLight.position.set(0.5, 4.8, -4.2);
scene.add(rimLight);

// Build textures, audio, doll, and craft props
const textures = buildTextureLibrary();
const sound = new SoundEngine();
const doll = new YarnDoll(textures);
const props = new CraftProps(textures, mirrorRenderTarget);
scene.add(doll.root);
scene.add(props.root);

// Soft yarn/felt particle system (wool wisps, felt hearts, stars, pom-pom confetti!)
const particles = [];
const particleGroup = new THREE.Group();
scene.add(particleGroup);

const pMats = [
  new THREE.MeshStandardMaterial({ color: '#f2788f', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#f6c851', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#78cbb8', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#b596e8', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#fff4df', roughness: 0.9 }),
];
const pSphereGeo = new THREE.SphereGeometry(0.075, 10, 8);
// Plush rounded felt heart particle shape!
const heartShape = new THREE.Shape();
heartShape.moveTo(0, -0.08);
heartShape.bezierCurveTo(0.09, -0.02, 0.11, 0.07, 0.05, 0.09);
heartShape.bezierCurveTo(0.02, 0.10, 0, 0.07, 0, 0.05);
heartShape.bezierCurveTo(0, 0.07, -0.02, 0.10, -0.05, 0.09);
heartShape.bezierCurveTo(-0.11, 0.07, -0.09, -0.02, 0, -0.08);
const pHeartGeo = new THREE.ExtrudeGeometry(heartShape, {
  depth: 0.03,
  bevelEnabled: true,
  bevelThickness: 0.015,
  bevelSize: 0.012,
  bevelSegments: 2,
});
pHeartGeo.center();

function spawnBurst(worldPos, count = 10, kind = 'pom') {
  for (let i = 0; i < count; i++) {
    const geo = kind === 'star' ? pHeartGeo : pSphereGeo;
    const mat = pMats[Math.floor(Math.random() * pMats.length)];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldPos);
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.0 + Math.random() * 1.8;
    const vel = new THREE.Vector3(Math.cos(ang) * spd, 1.2 + Math.random() * 1.8, Math.sin(ang) * spd * 0.6);
    particleGroup.add(mesh);
    particles.push({
      mesh,
      vel,
      life: 0.85 + Math.random() * 0.55,
      maxLife: 1.4,
      gravity: kind === 'star' ? 2.2 : 4.2,
      spin: (Math.random() - 0.5) * 6,
    });
  }
}

// Game Stage Machine
// 'brush' -> 'choose_style' -> 'weaving' | 'coiling' -> 'decorate' <-> 'mirror'
let stage = 'brush';
let idleSeconds = 0;
let demoActive = false;
let demoElapsed = 0;
let demoDoneForStage = false;
let mirrorFrameCounter = 0;

function setStage(nextStage) {
  stage = nextStage;
  idleSeconds = 0;
  demoActive = false;
  demoDoneForStage = false;
  props.demoHand.visible = false;

  if (stage === 'brush') {
    props.mirrorShowMode = false;
    props.mirrorReady = false;
    doll.mirrorMode = false;
    doll.setExpression('messy');
  } else if (stage === 'choose_style') {
    props.mirrorShowMode = false;
    props.mirrorReady = false;
    doll.mirrorMode = false;
    doll.setExpression('happy');
  } else if (stage === 'weaving' || stage === 'coiling') {
    props.mirrorShowMode = false;
    props.mirrorReady = false;
    doll.mirrorMode = false;
    doll.setExpression('happy');
  } else if (stage === 'decorate') {
    props.mirrorShowMode = false;
    props.mirrorReady = doll.placedAccessories.length >= 1;
    doll.mirrorMode = false;
    doll.setExpression(doll.placedAccessories.length >= 1 ? 'sparkle' : 'happy');
  } else if (stage === 'mirror') {
    props.mirrorShowMode = true;
    props.mirrorReady = true;
    doll.mirrorMode = true;
    doll.mirrorPoseIndex = 0;
    doll.setExpression('sparkle');
    doll.triggerBounce(0.18);
    sound.playMirrorReveal();
    spawnBurst(new THREE.Vector3(0.4, 2.55, 0.55), 24, 'star');
  }
  updateCameraTargets();
}

// Responsive Framing (Portrait iPhone & Landscape iPad/Desktop!)
function updateCameraTargets() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const isPortrait = aspect < 0.95;

  if (stage === 'mirror') {
    if (isPortrait) {
      camera.fov = 48;
      camPosTarget.set(-0.25, 2.75, 7.65);
      camLookTarget.set(0.32, 1.88, 0.20);
    } else {
      camera.fov = 37;
      camPosTarget.set(-0.55, 2.65, 6.95);
      camLookTarget.set(0.45, 1.92, 0.15);
    }
  } else if (isPortrait) {
    const narrow = aspect < 0.72;
    camera.fov = 50;
    camPosTarget.set(0, narrow ? 3.85 : 3.65, narrow ? 10.65 : 9.55);
    camLookTarget.set(0, narrow ? 1.44 : 1.48, 0.35);
  } else {
    camera.fov = 37;
    camPosTarget.set(0, 3.18, 8.15);
    camLookTarget.set(0, 1.62, 0.12);
  }
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  props.applyLayout(aspect);
}

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  updateCameraTargets();
});
updateCameraTargets();

// Pointer & One-Finger Gesture Controller (Multi-touch safe!)
let activePointerId = null;
const pointerNDC = new THREE.Vector2();
const prevPointerNDC = new THREE.Vector2();
const downPointerNDC = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.45);
const dragIntersect = new THREE.Vector3();

// Active drag state
let dragMode = null;
// null | 'brush' | 'style' | 'weave' | 'coil' | 'accessory_new' | 'accessory_move' | 'yarnball'
let draggedMesh = null;
let draggedType = null;
let draggedOriginalAnchorId = null;
let draggedStyle = null;
let dragMovedDistance = 0;

// Gesture accumulators for weaving (zigzag) and coiling (swirl/rub)
let weaveStrokeAccum = 0;
let weaveLastDir = 0;
let coilLastAngle = null;
let coilAccum = 0;
let lastSwirlSoundAt = 0;

function updatePointerNDC(e) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function getWorldPointOnHairPlane(zOffset = 0.55) {
  dragPlane.set(new THREE.Vector3(0, 0, 1), -zOffset);
  raycaster.setFromCamera(pointerNDC, camera);
  raycaster.ray.intersectPlane(dragPlane, dragIntersect);
  return dragIntersect.clone();
}

function raycastScene() {
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects([doll.root, props.root], true);
  for (const h of hits) {
    if (h.object.userData && h.object.userData.hitKind) {
      return h;
    }
  }
  return null;
}

function startBrushDrag() {
  dragMode = 'brush';
  canvas.classList.add('grabbing');
  sound.playPickup();
  if (stage === 'brush') {
    doll.setExpression('content');
  }
}

function chooseHairStyle(styleName) {
  sound.playPickup();
  doll.setStyle(styleName, true);
  spawnBurst(new THREE.Vector3(0, 2.75, 0.35), 14, 'pom');
  if (styleName === 'braids') {
    setStage('weaving');
  } else {
    setStage('coiling');
  }
}

function autoPlaceAccessory(type) {
  const anchors = doll.getAccessoryAnchors();
  const used = new Set(doll.placedAccessories.map((p) => p.anchorId));
  // Prefer prominent anchors first
  const preferredOrder = [
    'braid_tie_L', 'braid_tie_R', 'bun_front_L', 'bun_front_R',
    'topbun_front', 'bang_L', 'bang_R', 'braid_top_L', 'braid_top_R',
    'topbun_L', 'topbun_R', 'crown_C',
  ];
  let chosen = null;
  for (const id of preferredOrder) {
    const found = anchors.find((a) => a.id === id && !used.has(a.id));
    if (found) {
      chosen = found;
      break;
    }
  }
  if (!chosen) {
    chosen = anchors.find((a) => !used.has(a.id)) || anchors[0];
  }
  const mesh = createAccessoryMesh(type, textures);
  const { isSymmetry } = doll.attachAccessory(type, mesh, chosen);
  sound.playPlaceAccessory(type, isSymmetry);
  spawnBurst(chosen.worldPos, isSymmetry ? 18 : 10, isSymmetry ? 'star' : 'pom');

  props.mirrorReady = true;
  doll.setExpression('sparkle');
}

canvas.addEventListener('pointerdown', (e) => {
  if (activePointerId !== null) return; // Ignore second finger (multi-touch safe!)
  activePointerId = e.pointerId;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {}
  sound.unlock();

  idleSeconds = 0;
  demoActive = false;
  props.demoHand.visible = false;

  updatePointerNDC(e);
  prevPointerNDC.copy(pointerNDC);
  downPointerNDC.copy(pointerNDC);
  dragMovedDistance = 0;

  const hit = raycastScene();
  const kind = hit ? hit.object.userData.hitKind : null;

  // MIRROR SHOWCASE INTERACTION
  if (stage === 'mirror') {
    if (kind === 'prop_brush' || kind === 'prop_yarnball' || kind === 'prop_accessory' || !hit) {
      // Return smoothly to the craft table to keep playing/decorating!
      sound.playDropSoft();
      setStage('decorate');
      return;
    }
    // Tapping mirror or doll cycles adorable mirror poses + felt-star sparkles!
    doll.mirrorPoseIndex = (doll.mirrorPoseIndex + 1) % 4;
    doll.setExpression(doll.mirrorPoseIndex === 1 ? 'wink' : 'sparkle');
    doll.triggerBounce(0.16);
    doll.triggerGiggle(0.8);
    sound.playMirrorPose(doll.mirrorPoseIndex);
    spawnBurst(hit.point.clone(), 16, 'star');
    return;
  }

  // 1. Hairbrush (main action in 'brush', or usable anytime to re-brush & change style!)
  if (kind === 'prop_brush') {
    startBrushDrag();
    return;
  }

  // 2. Directly swiping hair in Stage 1 ('brush') grabs brush automatically (forgiving gesture!)
  if (stage === 'brush' && (kind === 'doll_hair' || kind === 'doll_fuzz' || kind === 'doll_head')) {
    startBrushDrag();
    return;
  }

  // 3. Fallen fuzzballs on table — poke to make them squeak & hop away!
  if (kind === 'doll_fuzz') {
    const f = doll.fuzzballs[hit.object.userData.fuzzIndex];
    if (f && f.state === 'table') {
      f.hopTimer = 0.7;
      sound.playFuzzPop(f.index + 2);
      spawnBurst(hit.point, 7, 'pom');
      return;
    }
  }

  // 4. Yarn Ball — tap or drag to change hair yarn color with a magical wave!
  if (kind === 'prop_yarnball') {
    props.triggerNudge('yarn');
    const nextIdx = (doll.paletteIndex + 2) % textures.hairPalettes.length;
    doll.cycleHairColor();
    props.updateYarnBallPreview(nextIdx);
    sound.playColorWave();
    spawnBurst(new THREE.Vector3(0, 2.75, 0.25), 16, 'pom');
    return;
  }

  // 5. Hairstyle Choice Formers
  if (kind === 'prop_style') {
    const styleName = hit.object.userData.style;
    if (stage === 'brush') {
      // Not brushed yet: cute nudge & gentle wobble (only current stage does full action!)
      props.triggerNudge(`style_${styleName}`);
      props.triggerNudge('brush');
      sound.playNudge();
      return;
    }
    dragMode = 'style';
    draggedStyle = styleName;
    canvas.classList.add('grabbing');
    sound.playPickup();
    return;
  }

  // 6. Interactive Braiding ('weaving')
  if (stage === 'weaving' && (kind === 'doll_braid' || kind === 'doll_hair' || kind === 'doll_head' || kind === 'doll_body')) {
    dragMode = 'weave';
    weaveStrokeAccum = 0;
    weaveLastDir = 0;
    canvas.classList.add('grabbing');
    return;
  }

  // 7. Interactive Bun Coiling ('coiling')
  if (stage === 'coiling' && (kind === 'doll_bun' || kind === 'doll_hair' || kind === 'doll_head' || kind === 'doll_body')) {
    dragMode = 'coil';
    coilLastAngle = null;
    coilAccum = 0;
    canvas.classList.add('grabbing');
    return;
  }

  // 8. Accessory Tray (Ribbons & Hairpins)
  if (kind === 'prop_accessory') {
    const accType = hit.object.userData.accessoryType;
    if (stage === 'brush' || stage === 'choose_style' || stage === 'weaving' || stage === 'coiling') {
      // Before decorating stage: playful wobble nudge!
      props.triggerNudge(`acc_${accType}`);
      sound.playNudge();
      return;
    }
    dragMode = 'accessory_new';
    draggedType = accType;
    draggedMesh = createAccessoryMesh(accType, textures);
    draggedMesh.scale.setScalar(1.22);
    scene.add(draggedMesh);
    draggedMesh.position.copy(getWorldPointOnHairPlane(0.85));
    canvas.classList.add('grabbing');
    sound.playPickup();
    return;
  }

  // 9. Already-placed Accessory on Doll (poke to animate, or drag to reposition/remove!)
  if (kind === 'placed_accessory') {
    const accId = hit.object.userData.accessoryId;
    const rec = doll.placedAccessories.find((p) => p.id === accId);
    if (rec) {
      dragMode = 'accessory_move';
      draggedType = rec.type;
      draggedOriginalAnchorId = rec.anchorId;
      draggedMesh = rec.mesh;
      draggedMesh.userData._recordId = accId;
      canvas.classList.add('grabbing');
    }
    return;
  }

  // 10. Vanity Mirror — show her new hairstyle in real live 3D reflection!
  if (kind === 'prop_mirror') {
    if (stage === 'decorate' || (stage === 'choose_style' && doll.getBrushProgress() > 0.9)) {
      setStage('mirror');
    } else {
      props.triggerNudge('mirror');
      sound.playNudge();
    }
    return;
  }

  // 11. Playful Pokes on Doll (cheeks, braids, buns!)
  if (kind === 'doll_cheek') {
    doll.triggerGiggle(0.95);
    sound.playGiggle();
    spawnBurst(hit.point, 8, 'star');
    return;
  }
  if (kind === 'doll_braid') {
    doll.pokeBraid(hit.object.userData.side);
    sound.playGiggle();
    return;
  }
  if (kind === 'doll_bun') {
    doll.pokeBun(hit.object.userData.side);
    sound.playGiggle();
    return;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return;
  idleSeconds = 0;

  prevPointerNDC.copy(pointerNDC);
  updatePointerNDC(e);
  const dx = pointerNDC.x - prevPointerNDC.x;
  const dy = pointerNDC.y - prevPointerNDC.y;
  const stepDist = Math.hypot(dx, dy);
  dragMovedDistance += stepDist;

  if (dragMode === 'brush') {
    const pt = getWorldPointOnHairPlane(0.68);
    props.brushGroup.position.lerp(pt, 0.55);
    props.brushGroup.rotation.set(-0.18, 0.15, -0.35 - dx * 3.8);

    // If hair was styled & child deliberately drags the brush onto her hair, gently unbraid to re-brush!
    if (stage !== 'brush' && pt.distanceTo(new THREE.Vector3(0, 2.35, 0.4)) < 1.55) {
      doll.resetToTangled();
      doll.looseLocks.forEach((l) => (l.tangle = 0.55));
      doll.fuzzballs.forEach((f, i) => {
        if (i % 2 === 0) {
          f.state = 'gone';
          f.group.visible = false;
        }
      });
      setStage('brush');
      doll.setExpression('content');
    }

    if (stage === 'brush' && stepDist > 0.008) {
      const { smoothedAmount, poppedFuzz } = doll.brushAtWorldPoint(pt, dx * 30, dy * 30, scene);
      if (smoothedAmount > 0.001 || pt.distanceTo(new THREE.Vector3(0, 2.3, 0.3)) < 2.2) {
        sound.playBrushStroke(Math.min(1, stepDist * 20));
        if (Math.random() < 0.25) {
          spawnBurst(pt, 1, 'pom');
        }
      }
      for (const pf of poppedFuzz) {
        sound.playFuzzPop(pf.index);
        spawnBurst(pf.worldPos, 8, 'pom');
      }

      if (doll.getBrushProgress() >= 0.86) {
        doll.finishBrushingSnap(scene);
        sound.playBrushComplete();
        spawnBurst(new THREE.Vector3(0, 2.55, 0.4), 18, 'star');
        dragMode = null;
        canvas.classList.remove('grabbing');
        setStage('choose_style');
      }
    }
  } else if (dragMode === 'style') {
    const item = props.styleItems.find((s) => s.style === draggedStyle);
    if (item) {
      const worldPt = getWorldPointOnHairPlane(0.75);
      props.styleTrayGroup.worldToLocal(worldPt);
      item.group.position.lerp(worldPt, 0.55);
    }
  } else if (dragMode === 'weave') {
    // Generous weaving gesture: horizontal zigzag OR downward stroke weaves chunky braid links!
    const dir = Math.abs(dx) > 0.006 ? Math.sign(dx) : weaveLastDir;
    const directionReversed = weaveLastDir !== 0 && dir !== 0 && dir !== weaveLastDir;
    weaveStrokeAccum += Math.abs(dx) * 1.45 + Math.abs(dy) * 0.85;

    if (directionReversed && weaveStrokeAccum > 0.09) {
      weaveStrokeAccum = 0;
      weaveLastDir = dir;
      if (doll.advanceWeaveStep(dir)) {
        sound.playWeaveStep(doll.weaveSteps - 1);
        spawnBurst(new THREE.Vector3(dir * 0.85, 2.1 - doll.weaveSteps * 0.18, 0.45), 6, 'pom');
      }
    } else if (weaveStrokeAccum > 0.28) {
      weaveStrokeAccum = 0;
      weaveLastDir = dir || (doll.weaveSteps % 2 === 0 ? 1 : -1);
      if (doll.advanceWeaveStep(weaveLastDir)) {
        sound.playWeaveStep(doll.weaveSteps - 1);
        spawnBurst(new THREE.Vector3(weaveLastDir * 0.85, 2.1 - doll.weaveSteps * 0.18, 0.45), 6, 'pom');
      }
    } else if (weaveLastDir === 0 && dir !== 0) {
      weaveLastDir = dir;
    }

    if (doll.weaveSteps >= doll.maxWeaveSteps) {
      sound.playStyleDone();
      spawnBurst(new THREE.Vector3(0, 2.2, 0.5), 20, 'star');
      dragMode = null;
      canvas.classList.remove('grabbing');
      setStage('decorate');
    }
  } else if (dragMode === 'coil') {
    // Generous swirling/rubbing gesture coils the ponytail smoothly into plump buns!
    const centerNDC = new THREE.Vector2(0, 0.34);
    const angle = Math.atan2(pointerNDC.y - centerNDC.y, pointerNDC.x - centerNDC.x);
    let angDelta = 0;
    if (coilLastAngle !== null) {
      let diff = angle - coilLastAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      angDelta = Math.abs(diff);
    }
    coilLastAngle = angle;

    const progressGain = Math.min(0.14, angDelta * 0.14 + stepDist * 0.48);
    if (progressGain > 0.002) {
      doll.advanceCoil(progressGain);
      coilAccum += progressGain;
      if (coilAccum - lastSwirlSoundAt > 0.14) {
        lastSwirlSoundAt = coilAccum;
        sound.playSwirlTick(doll.coilProgress);
        const burstX = doll.style === 'top_bun' ? 0 : (Math.random() > 0.5 ? 0.78 : -0.78);
        spawnBurst(new THREE.Vector3(burstX, 3.05, 0.35), 4, 'pom');
      }
    }

    if (doll.coilProgress >= 1.0) {
      sound.playStyleDone();
      spawnBurst(new THREE.Vector3(0, 3.15, 0.4), 22, 'star');
      dragMode = null;
      canvas.classList.remove('grabbing');
      setStage('decorate');
    }
  } else if (dragMode === 'accessory_new' && draggedMesh) {
    const pt = getWorldPointOnHairPlane(0.88);
    draggedMesh.position.lerp(pt, 0.65);
    draggedMesh.rotation.z = Math.sin(performance.now() * 0.01) * 0.12;
  } else if (dragMode === 'accessory_move' && draggedMesh && dragMovedDistance > 0.04) {
    // Detach from doll once moved enough to reposition or remove
    if (draggedMesh.parent !== scene) {
      const recId = draggedMesh.userData._recordId;
      doll.removeAccessoryById(recId);
      scene.add(draggedMesh);
      sound.playPickup();
    }
    const pt = getWorldPointOnHairPlane(0.88);
    draggedMesh.position.lerp(pt, 0.65);
  }
});

function handlePointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  canvas.classList.remove('grabbing');

  if (dragMode === 'brush') {
    if (stage === 'brush') {
      doll.setExpression(doll.getBrushProgress() > 0.45 ? 'happy' : 'messy');
    }
  } else if (dragMode === 'style') {
    // Tap OR drag onto doll's head selects the hairstyle!
    const worldPt = getWorldPointOnHairPlane(0.45);
    const distToHead = worldPt.distanceTo(new THREE.Vector3(0, 2.4, 0.2));
    if (dragMovedDistance < 0.08 || distToHead < 2.2) {
      chooseHairStyle(draggedStyle);
    } else {
      sound.playDropSoft();
    }
    draggedStyle = null;
  } else if (dragMode === 'weave') {
    // Even a playful tap on the braid advances 1 weave step so a 5-year-old never gets stuck!
    if (dragMovedDistance < 0.08) {
      const nextDir = doll.weaveSteps % 2 === 0 ? 1 : -1;
      if (doll.advanceWeaveStep(nextDir)) {
        sound.playWeaveStep(doll.weaveSteps - 1);
        spawnBurst(new THREE.Vector3(nextDir * 0.85, 2.1 - doll.weaveSteps * 0.18, 0.45), 6, 'pom');
      }
      if (doll.weaveSteps >= doll.maxWeaveSteps) {
        sound.playStyleDone();
        spawnBurst(new THREE.Vector3(0, 2.2, 0.5), 20, 'star');
        setStage('decorate');
      }
    }
  } else if (dragMode === 'coil') {
    // Even a playful tap coils a generous chunk so a 5-year-old never gets stuck!
    if (dragMovedDistance < 0.08) {
      doll.advanceCoil(0.26);
      sound.playSwirlTick(doll.coilProgress);
      spawnBurst(new THREE.Vector3(0, 3.05, 0.35), 5, 'pom');
      if (doll.coilProgress >= 1.0) {
        sound.playStyleDone();
        spawnBurst(new THREE.Vector3(0, 3.15, 0.4), 22, 'star');
        setStage('decorate');
      }
    }
  } else if (dragMode === 'accessory_new' && draggedMesh) {
    if (dragMovedDistance < 0.08) {
      // Quick tap on tray accessory -> arcs straight onto doll's hair!
      scene.remove(draggedMesh);
      autoPlaceAccessory(draggedType);
    } else {
      const dropPt = draggedMesh.position.clone();
      const nearest = doll.findNearestAnchor(dropPt);
      if (nearest && nearest.dist < 1.95) {
        scene.remove(draggedMesh);
        const { isSymmetry } = doll.attachAccessory(draggedType, draggedMesh, nearest.anchor);
        sound.playPlaceAccessory(draggedType, isSymmetry);
        spawnBurst(nearest.anchor.worldPos, isSymmetry ? 18 : 10, isSymmetry ? 'star' : 'pom');
        props.mirrorReady = true;
        doll.setExpression('sparkle');
      } else {
        scene.remove(draggedMesh);
        sound.playDropSoft();
      }
    }
    draggedMesh = null;
    draggedType = null;
  } else if (dragMode === 'accessory_move' && draggedMesh) {
    if (dragMovedDistance <= 0.04) {
      // It was a quick poke! Trigger delightful accessory micro-animation!
      const rec = doll.pokeAccessory(draggedMesh.userData._recordId);
      if (rec) {
        sound.playPlaceAccessory(rec.type, false);
        const wp = new THREE.Vector3();
        rec.mesh.getWorldPosition(wp);
        spawnBurst(wp, 8, 'star');
      }
    } else {
      // Dropped after dragging: snap to nearest hair anchor OR remove if dragged away!
      const dropPt = draggedMesh.position.clone();
      const nearest = doll.findNearestAnchor(dropPt);
      if (nearest && nearest.dist < 1.75) {
        scene.remove(draggedMesh);
        const { isSymmetry } = doll.attachAccessory(draggedType, draggedMesh, nearest.anchor);
        sound.playPlaceAccessory(draggedType, isSymmetry);
        spawnBurst(nearest.anchor.worldPos, 10, 'pom');
      } else {
        // Removed cleanly!
        scene.remove(draggedMesh);
        sound.playDropSoft();
        props.mirrorReady = doll.placedAccessories.length >= 1;
      }
    }
    draggedMesh = null;
    draggedType = null;
    draggedOriginalAnchorId = null;
  }

  dragMode = null;
  lastSwirlSoundAt = 0;
}

canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);

// Idle Demo Hand (strictly obeys preference: 0-10s silent, then demonstrates ONCE softly!)
function updateDemoHand(dt) {
  if (activePointerId !== null || stage === 'mirror') {
    idleSeconds = 0;
    demoActive = false;
    props.demoHand.visible = false;
    return;
  }

  idleSeconds += dt;
  if (!demoActive && !demoDoneForStage && idleSeconds >= 10.0) {
    demoActive = true;
    demoElapsed = 0;
    props.demoHand.visible = true;
  }

  if (demoActive) {
    demoElapsed += dt;
    const dur = 2.6;
    const t = Math.min(1, demoElapsed / dur);
    const p = props.demoHand.position;

    if (stage === 'brush') {
      // Gentle downward brush sweep from brush to hair
      const s = Math.sin(t * Math.PI);
      p.set(THREE.MathUtils.lerp(-1.9, -0.7, t), 2.7 - t * 1.15, 0.95 + s * 0.25);
    } else if (stage === 'choose_style') {
      const start = props.styleTrayFocusPos.clone().add(new THREE.Vector3(-0.4, 0.45, 0.3));
      const end = new THREE.Vector3(0, 2.5, 0.75);
      p.lerpVectors(start, end, t);
      p.y += Math.sin(t * Math.PI) * 0.45;
    } else if (stage === 'weaving') {
      // Gentle left-right zigzag across braid
      p.set(-0.78 + Math.sin(t * Math.PI * 3) * 0.45, 2.25 - t * 0.75, 0.95);
    } else if (stage === 'coiling') {
      // Gentle circular swirl around bun
      const a = t * Math.PI * 3.5;
      p.set(Math.cos(a) * 0.55, 2.95 + Math.sin(a) * 0.42, 0.95);
    } else if (stage === 'decorate') {
      if (props.mirrorReady) {
        // Gentle tap gesture toward gleaming mirror
        const mp = props.mirrorSidePos.clone().add(new THREE.Vector3(-0.2, 1.5, 0.6));
        p.copy(mp);
        p.z += Math.sin(t * Math.PI * 2) * 0.25;
      } else {
        const start = props.accTrayFocusPos.clone().add(new THREE.Vector3(-0.8, 0.35, 0.25));
        const end = new THREE.Vector3(-0.55, 2.75, 0.85);
        p.lerpVectors(start, end, t);
        p.y += Math.sin(t * Math.PI) * 0.45;
      }
    }

    if (demoElapsed >= dur) {
      demoActive = false;
      demoDoneForStage = true;
      props.demoHand.visible = false;
    }
  }
}

// Live Planar Mirror Reflection Renderer
const _mirrorWorldPos = new THREE.Vector3();
const _mirrorNormal = new THREE.Vector3();
const _mirrorUp = new THREE.Vector3();
const _dollFacePos = new THREE.Vector3();
const _mirrorQuat = new THREE.Quaternion();

function renderMirrorReflection() {
  // Position virtual portrait mirror camera facing the doll's front smiling face & FULL decorated hairstyle!
  doll.headGroup.getWorldPosition(_dollFacePos);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(doll.bodyGroup.quaternion).normalize();
  const sideOffset = props.mirrorShowMode ? 0.35 : 0.72;

  mirrorCamera.position.set(
    _dollFacePos.x + forward.x * 3.55 + sideOffset * 0.30,
    _dollFacePos.y + 0.14,
    _dollFacePos.z + forward.z * 3.55
  );
  mirrorCamera.up.set(0, 1, 0);
  mirrorCamera.lookAt(_dollFacePos.x, _dollFacePos.y + 0.02, _dollFacePos.z);
  mirrorCamera.fov = props.mirrorShowMode ? 48 : 52;
  mirrorCamera.updateProjectionMatrix();

  // Hide mirror itself during reflection pass
  const wasVisible = props.mirrorGroup.visible;
  props.mirrorGroup.visible = false;
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(mirrorRenderTarget);
  renderer.clear();
  renderer.render(scene, mirrorCamera);
  renderer.setRenderTarget(prevTarget);
  props.mirrorGroup.visible = wasVisible;
}

// Main Animation Loop
let lastTime = performance.now();
let fpsSmooth = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (dt > 0) {
    fpsSmooth = fpsSmooth * 0.92 + (1 / dt) * 0.08;
  }
  const time = now * 0.001;

  // Smooth camera glide
  camera.position.lerp(camPosTarget, Math.min(1, dt * 4.8));
  camLookCurrent.lerp(camLookTarget, Math.min(1, dt * 5.2));
  camera.lookAt(camLookCurrent);

  // Update Doll & Craft Props
  doll.update(dt, time, stage);
  props.update(dt, time, stage, dragMode === 'brush', draggedStyle);
  updateDemoHand(dt);

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particleGroup.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += p.spin * dt;
    p.mesh.rotation.y += p.spin * dt;
    const ratio = p.life / p.maxLife;
    p.mesh.scale.setScalar(Math.max(0.01, Math.min(1, ratio * 2.2)));
  }

  // Render real-time reflection (30Hz when showcased, 20Hz when parked — ultra-smooth on mobile!)
  mirrorFrameCounter++;
  if (mirrorFrameCounter === 1 || (props.mirrorShowMode ? mirrorFrameCounter % 2 === 0 : mirrorFrameCounter % 3 === 0)) {
    renderMirrorReflection();
  }

  // Render main scene
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Expose clean read-only telemetry & verification helpers for screenshot QA
window.__GAME__ = {
  getStats: () => ({
    stage,
    style: doll.style,
    weaveSteps: doll.weaveSteps,
    coilProgress: Number(doll.coilProgress.toFixed(2)),
    brushProgress: Number(doll.getBrushProgress().toFixed(2)),
    accessoriesCount: doll.placedAccessories.length,
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    fps: Math.round(fpsSmooth),
    pixelRatio: renderer.getPixelRatio(),
  }),
  // Non-UI helpers strictly for QA state inspection
  _qaSetState: (targetStage, styleName = 'braids') => {
    // Clear any in-flight particles for crisp QA inspection
    while (particles.length > 0) {
      const p = particles.pop();
      particleGroup.remove(p.mesh);
    }
    if (targetStage === 'brush') {
      doll.resetToTangled();
      setStage('brush');
    } else if (targetStage === 'choose_style') {
      doll.finishBrushingSnap(scene, true);
      setStage('choose_style');
    } else if (targetStage === 'weaving') {
      doll.finishBrushingSnap(scene, true);
      doll.setStyle('braids', true);
      doll.advanceWeaveStep(1);
      doll.advanceWeaveStep(-1);
      doll.braidSwing = { left: 0, leftVel: 0, right: 0, rightVel: 0 };
      setStage('weaving');
    } else if (targetStage === 'decorate') {
      doll.finishBrushingSnap(scene, true);
      doll.setStyle(styleName, true);
      if (styleName === 'braids') {
        for (let i = 0; i < 5; i++) doll.advanceWeaveStep(i % 2 === 0 ? 1 : -1);
        doll.braidSwing = { left: 0, leftVel: 0, right: 0, rightVel: 0 };
      } else {
        doll.advanceCoil(1.0);
      }
      setStage('decorate');
      autoPlaceAccessory('bow');
      autoPlaceAccessory('bow');
      autoPlaceAccessory('flower');
      autoPlaceAccessory('star');
    } else if (targetStage === 'mirror') {
      doll.finishBrushingSnap(scene, true);
      doll.setStyle(styleName, true);
      if (styleName === 'braids') {
        for (let i = 0; i < 5; i++) doll.advanceWeaveStep(i % 2 === 0 ? 1 : -1);
        doll.braidSwing = { left: 0, leftVel: 0, right: 0, rightVel: 0 };
      } else {
        doll.advanceCoil(1.0);
      }
      setStage('decorate');
      autoPlaceAccessory('bow');
      autoPlaceAccessory('bow');
      autoPlaceAccessory('flower');
      autoPlaceAccessory('strawberry');
      setStage('mirror');
      props.mirrorGroup.position.copy(props.mirrorShowPos);
      props.mirrorGroup.rotation.y = props.mirrorShowRotY;
      doll.bodyGroup.rotation.y = 0.36;
    }
    // Clear QA setup particles so face & hair are crystal clear
    while (particles.length > 0) {
      const p = particles.pop();
      particleGroup.remove(p.mesh);
    }
    // Snap accessory pop-in scale
    doll.placedAccessories.forEach((a) => {
      a.popScale = 1.0;
      a.pokeTimer = 0;
      a.mesh.scale.setScalar(1.0);
    });
  },
};

// Optional QA query parameter hook (silent in normal play)
const _qaParams = new URLSearchParams(window.location.search);
if (_qaParams.has('qa')) {
  const s = _qaParams.get('qa');
  const st = _qaParams.get('style') || 'braids';
  window.__GAME__._qaSetState(s, st);
  // Snap camera & props immediately for crisp frame capture
  camera.position.copy(camPosTarget);
  camLookCurrent.copy(camLookTarget);
  camera.lookAt(camLookCurrent);
}

