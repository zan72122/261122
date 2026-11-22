import * as THREE from '../lib/three.module.js';
import { createAllTextures } from './textures.js';
import { NabeAudio } from './audio.js';
import { createDiningEnvironment } from './env.js';
import { PotAndFluidSystem } from './potAndFluid.js';
import { IngredientManager } from './ingredients.js';
import { FamilyAndHandSystem } from './familyAndHand.js';

const container = document.getElementById('app');

// Strictly cap pixelRatio <= 1.5 for iPhone/iPad >= 30fps performance
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120d0a);

// Camera seated at the player's place at the dining table looking across the central donabe at the family
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.06, 12.0);
const camState = {
  basePos: new THREE.Vector3(0, 0.56, 0.74),
  baseLook: new THREE.Vector3(0, 0.14, -0.14),
  yaw: 0,
  targetYaw: 0,
  pitch: 0,
  targetPitch: 0,
  autoFocusYaw: 0,
  serveFocusTimer: 0,
};

// Build procedural PBR textures (all <= 1024px), environment, pot/fluid, ingredients, family & audio
const textures = createAllTextures();
const audio = new NabeAudio();
const env = createDiningEnvironment(scene, renderer, textures);
const potSystem = new PotAndFluidSystem(scene, textures);
const ingredients = new IngredientManager(scene, textures);
const family = new FamilyAndHandSystem(scene, textures);

function updateResponsiveCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);

  // Adapt FOV & seat distance so Donabe + Ingredients + Family + Rainy Window are ALL visible on first screen!
  if (aspect < 0.85) {
    // iPhone Portrait: wider vertical FOV & comfortable seat so foreground food & family fill screen
    camera.fov = THREE.MathUtils.clamp(60 + (0.75 - aspect) * 28, 56, 70);
    camState.basePos.set(0, 0.64, 0.88);
    camState.baseLook.set(0, 0.12, -0.08);
  } else {
    // iPad / Desktop Landscape: cinematic 46 deg lens so 100% of platters, pot, ladle, bowls & family fit!
    camera.fov = THREE.MathUtils.clamp(47 - (aspect - 1.33) * 4, 41, 49);
    camState.basePos.set(0, 0.57, 0.81);
    camState.baseLook.set(0, 0.13, -0.10);
  }
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  ingredients.updateLayoutForAspect(aspect);
  potSystem.updateLayoutForAspect(aspect);
}
window.addEventListener('resize', updateResponsiveCamera);
updateResponsiveCamera();

// --- Single-Finger Embodied Interaction Controller ---
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
const intersectPt = new THREE.Vector3();

let activePointerId = null;
let pointerMode = null; // 'ingredient' | 'ladle' | 'stirPot' | 'lookOrWindow' | 'knob' | 'lid'
let draggedItem = null;
let downScreenPos = new THREE.Vector2();
let prevWorldPos = new THREE.Vector3();
let downTime = 0;
let ladlePrimed = false; // supports tap-ladle -> tap-bowl as well as drag!

// Animated arcs (for quick-tap ingredient toss or ladle pour)
const activeArcs = []; // { item, start, end, t, dur }
let pourAnim = null;   // { memberIdx, startPos, bowlPos, t, dur }

let totalBowlsServed = 0;
let snowTarget = 0.0;
let hasEverTouched = false;
let idleElapsed = 0;
let idleDemoDone = false;
let idleDemoAnim = null;

function setNDCFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function projectToHeight(yHeight, outVec) {
  dragPlane.constant = -yHeight;
  raycaster.setFromCamera(pointerNDC, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, outVec)) {
    outVec.set(0, yHeight, 0.1);
  }
  return outVec;
}

function tryScoopIntoLadle() {
  if (potSystem.lidClosed) return false;
  const ls = potSystem.ladleState;
  ls.fillAmount = 1.0;

  if (ls.carriedItems.length < 2) {
    // Prefer nicely simmered items, fallback to any item in pot!
    const potItems = ingredients.items
      .filter((it) => it.state === 'pot' && it.type !== 'yuzu')
      .sort((a, b) => {
        const dA = a.mesh.position.distanceTo(potSystem.ladleGroup.position) - a.cookProgress * 0.12;
        const dB = b.mesh.position.distanceTo(potSystem.ladleGroup.position) - b.cookProgress * 0.12;
        return dA - dB;
      });
    for (const cand of potItems) {
      if (ls.carriedItems.length >= 2) break;
      if (cand.mesh.position.distanceTo(potSystem.ladleGroup.position) < 0.19) {
        cand.state = 'ladle';
        ls.carriedItems.push(cand);
      }
    }
  }
  audio.playScoop();
  potSystem.addSplash(
    THREE.MathUtils.clamp(potSystem.ladleGroup.position.x - potSystem.potCenter.x, -0.1, 0.1),
    THREE.MathUtils.clamp(potSystem.ladleGroup.position.z - potSystem.potCenter.z, -0.1, 0.1),
    0.55
  );
  return true;
}

function triggerPourIntoBowl(memberIdx) {
  const ls = potSystem.ladleState;
  const m = family.members[memberIdx];
  if (!m) return;

  ls.held = false;
  ladlePrimed = false;
  pourAnim = {
    memberIdx,
    startPos: potSystem.ladleGroup.position.clone(),
    bowlPos: m.spec.bowlHome.clone().add(new THREE.Vector3(0, 0.135, 0.03)),
    t: 0,
    dur: 0.72,
    delivered: false,
  };
  camState.autoFocusYaw = THREE.MathUtils.clamp(-m.spec.bowlHome.x * 0.65, -0.26, 0.26);
  camState.serveFocusTimer = 2.8;
  audio.playPour();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  // Single-finger lock: ignore extra simultaneous fingers cleanly
  if (activePointerId !== null) return;
  activePointerId = e.pointerId;
  renderer.domElement.setPointerCapture(e.pointerId);

  audio.init();
  hasEverTouched = true;
  setNDCFromEvent(e);
  downScreenPos.set(e.clientX, e.clientY);
  downTime = performance.now();

  raycaster.setFromCamera(pointerNDC, camera);

  // 0. If ladle was primed by a tap and child taps a family bowl -> serve immediately!
  const bowlHits = raycaster.intersectObjects(family.members.map((m) => m.bowl.hit), false);
  if (bowlHits.length > 0) {
    const mIdx = bowlHits[0].object.userData.memberIndex;
    if (ladlePrimed && potSystem.ladleState.fillAmount > 0.2) {
      triggerPourIntoBowl(mIdx);
      pointerMode = 'served';
      return;
    } else {
      // Honest subtle secondary reaction: small ceramic clink & gentle wobble (not dead prop!)
      audio.playCeramicClink(1.1 + mIdx * 0.12);
      family.members[mIdx].bowl.grp.rotation.z = 0.09;
      setTimeout(() => { family.members[mIdx].bowl.grp.rotation.z = 0; }, 140);
    }
  }

  // 1. Check Stove Rotary Knob
  if (raycaster.intersectObject(potSystem.knobHitMesh, false).length > 0) {
    pointerMode = 'knob';
    const isHigh = potSystem.toggleFlame();
    audio.playStoveClick(isHigh);
    const kp = new THREE.Vector3();
    potSystem.knobGroup.getWorldPosition(kp);
    family.setPlayerHandTarget(kp.add(new THREE.Vector3(0.02, 0.02, 0.04)), 0.85, true);
    return;
  }

  // 2. Check Ladle (generous radius check + raycast)
  if (!pourAnim && raycaster.intersectObject(potSystem.ladleHitMesh, false).length > 0) {
    pointerMode = 'ladle';
    potSystem.ladleState.held = true;
    audio.playPickup('ladle');
    projectToHeight(0.22, intersectPt);
    potSystem.ladleGroup.position.lerp(intersectPt, 0.45);
    potSystem.ladleGroup.rotation.set(0.18, 0, 0);
    const gripInit = new THREE.Vector3(0, 0.145, 0.185);
    potSystem.ladleTiltGroup.localToWorld(gripInit);
    family.setPlayerHandTarget(gripInit, 0.9, true);
    return;
  }

  // 3. Check Donabe Lid
  if (raycaster.intersectObject(potSystem.lidHitMesh, false).length > 0) {
    pointerMode = 'lid';
    potSystem.toggleLid(audio);
    const lp = new THREE.Vector3();
    potSystem.lidGroup.getWorldPosition(lp);
    family.setPlayerHandTarget(lp.add(new THREE.Vector3(0, 0.07, 0.03)), 0.8, true);
    return;
  }

  // 4. Check Ingredients on Trays (generous screen/world magnetic pick!)
  const trayItems = ingredients.items.filter((it) => it.state === 'tray');
  let bestItem = null;
  let bestDist = 0.078; // generous 7.8cm magnetic pick radius for 5yo fingers!
  projectToHeight(0.032, intersectPt);
  for (const it of trayItems) {
    const d = it.mesh.position.distanceTo(intersectPt);
    if (d < bestDist) {
      bestDist = d;
      bestItem = it;
    }
  }
  // Also direct mesh raycast fallback
  if (!bestItem && trayItems.length > 0) {
    const hits = raycaster.intersectObjects(trayItems.map((i) => i.mesh), true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.ingredientItem) obj = obj.parent;
      if (obj && obj.userData.ingredientItem) bestItem = obj.userData.ingredientItem;
    }
  }

  if (bestItem) {
    pointerMode = 'ingredient';
    draggedItem = bestItem;
    bestItem.state = 'held';
    bestItem.jiggleAmp = 0.9;
    audio.playPickup(bestItem.type);
    projectToHeight(0.19, intersectPt);
    bestItem.mesh.position.y += 0.06;
    family.setPlayerHandTarget(bestItem.mesh.position.clone().add(new THREE.Vector3(0.02, 0.035, 0.05)), 0.7, true);
    return;
  }

  // 5. Check Broth Surface / Pot interior (stirring fluid & poking floating tofu!)
  projectToHeight(potSystem.brothSurfaceY, intersectPt);
  const dPot = Math.hypot(intersectPt.x - potSystem.potCenter.x, intersectPt.z - potSystem.potCenter.z);
  if (dPot < 0.19 && !potSystem.lidClosed) {
    pointerMode = 'stirPot';
    prevWorldPos.copy(intersectPt);
    potSystem.addSplash(intersectPt.x - potSystem.potCenter.x, intersectPt.z - potSystem.potCenter.z, 0.45);
    audio.playScoop();
    // Jiggle any nearby tofu/ingredient in pot!
    for (const it of ingredients.items) {
      if (it.state === 'pot' && it.mesh.position.distanceTo(intersectPt) < 0.075) {
        it.jiggleAmp = 1.0;
      }
    }
    family.setPlayerHandTarget(intersectPt.clone().add(new THREE.Vector3(0.02, 0.06, 0.06)), 0.4, true);
    return;
  }

  // 6. Otherwise: Look Around the Dining Table + Wipe Rainy Window Condensation!
  pointerMode = 'lookOrWindow';
  const winHits = raycaster.intersectObject(env.glassMesh, false);
  if (winHits.length > 0 && winHits[0].uv) {
    env.wipeWindowAtUV(winHits[0].uv.x, winHits[0].uv.y);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return;
  setNDCFromEvent(e);

  if (pointerMode === 'ingredient' && draggedItem) {
    projectToHeight(0.21, intersectPt);
    intersectPt.x = THREE.MathUtils.clamp(intersectPt.x, -0.45, 0.45);
    intersectPt.z = THREE.MathUtils.clamp(intersectPt.z, -0.12, 0.42);
    draggedItem.mesh.position.lerp(intersectPt, 0.55);

    // If hovering over closed lid with an ingredient, automatically open the lid helpfully!
    const dPot = Math.hypot(intersectPt.x - potSystem.potCenter.x, intersectPt.z - potSystem.potCenter.z);
    if (dPot < 0.20 && potSystem.lidClosed) {
      potSystem.toggleLid(audio);
    }

    family.setPlayerHandTarget(
      draggedItem.mesh.position.clone().add(new THREE.Vector3(0.018, 0.032, 0.048)),
      0.75,
      true
    );
  } else if (pointerMode === 'ladle') {
    // Lift smoothly over pot rim & move across table toward family bowls
    projectToHeight(0.20, intersectPt);
    intersectPt.x = THREE.MathUtils.clamp(intersectPt.x, -0.42, 0.42);
    intersectPt.z = THREE.MathUtils.clamp(intersectPt.z, -0.28, 0.32);

    const dPot = Math.hypot(intersectPt.x - potSystem.potCenter.x, intersectPt.z - potSystem.potCenter.z);
    if (dPot < 0.165 && !potSystem.lidClosed) {
      // Dip down into the golden simmering broth!
      intersectPt.y = potSystem.brothSurfaceY + 0.008;
      if (potSystem.ladleState.fillAmount < 0.8 || potSystem.ladleState.carriedItems.length === 0) {
        tryScoopIntoLadle();
      }
      // Stirring pot gently with ladle
      const dx = intersectPt.x - prevWorldPos.x;
      const dz = intersectPt.z - prevWorldPos.z;
      const rx = intersectPt.x - potSystem.potCenter.x;
      const rz = intersectPt.z - potSystem.potCenter.z;
      const cross = rx * dz - rz * dx;
      potSystem.swirlAngularVel = THREE.MathUtils.clamp(potSystem.swirlAngularVel + cross * 160, -3.5, 3.5);
    } else {
      intersectPt.y = 0.215;
    }

    prevWorldPos.copy(intersectPt);
    potSystem.ladleGroup.position.lerp(intersectPt, 0.52);
    potSystem.ladleGroup.rotation.set(0.14, -intersectPt.x * 0.4, 0);

    // Subtle magnetic camera gaze turn as you carry the ladle toward Dad (left) or Mom (right)!
    camState.autoFocusYaw = THREE.MathUtils.clamp(-intersectPt.x * 0.55, -0.28, 0.28);

    // Compute exact world grip point on the 1.26x ladle handle shaft!
    const gripLocal = new THREE.Vector3(0, 0.145, 0.185);
    potSystem.ladleTiltGroup.localToWorld(gripLocal);
    family.setPlayerHandTarget(gripLocal, 0.92, true);

    // Automatic magnetic pour if brimming ladle hovers right over a family member's bowl!
    if (potSystem.ladleState.fillAmount > 0.3) {
      for (let i = 0; i < family.members.length; i++) {
        const bPos = family.members[i].spec.bowlHome;
        const dBowl = Math.hypot(potSystem.ladleGroup.position.x - bPos.x, potSystem.ladleGroup.position.z - bPos.z);
        if (dBowl < 0.105) {
          pointerMode = 'served';
          triggerPourIntoBowl(i);
          break;
        }
      }
    }
  } else if (pointerMode === 'stirPot') {
    projectToHeight(potSystem.brothSurfaceY, intersectPt);
    const dPot = Math.hypot(intersectPt.x - potSystem.potCenter.x, intersectPt.z - potSystem.potCenter.z);
    if (dPot < 0.18) {
      const dx = intersectPt.x - prevWorldPos.x;
      const dz = intersectPt.z - prevWorldPos.z;
      const rx = intersectPt.x - potSystem.potCenter.x;
      const rz = intersectPt.z - potSystem.potCenter.z;
      const cross = rx * dz - rz * dx;
      potSystem.swirlAngularVel = THREE.MathUtils.clamp(potSystem.swirlAngularVel + cross * 220, -4.2, 4.2);
      if (Math.hypot(dx, dz) > 0.018) {
        potSystem.addSplash(rx, rz, 0.28);
        prevWorldPos.copy(intersectPt);
      }
      family.setPlayerHandTarget(intersectPt.clone().add(new THREE.Vector3(0.02, 0.055, 0.06)), 0.45, true);
    }
  } else if (pointerMode === 'lookOrWindow') {
    // Pan camera smoothly around the dining table ("カメラは食卓中央から家族を見回す")
    const dx = (e.clientX - downScreenPos.x) / Math.max(300, window.innerWidth);
    const dy = (e.clientY - downScreenPos.y) / Math.max(300, window.innerHeight);
    camState.targetYaw = THREE.MathUtils.clamp(camState.targetYaw - dx * 1.15, -0.44, 0.44);
    camState.targetPitch = THREE.MathUtils.clamp(camState.targetPitch - dy * 0.55, -0.14, 0.18);
    downScreenPos.set(e.clientX, e.clientY);

    // Also wipe condensation if finger glides across the rainy window!
    raycaster.setFromCamera(pointerNDC, camera);
    const winHits = raycaster.intersectObject(env.glassMesh, false);
    if (winHits.length > 0 && winHits[0].uv) {
      env.wipeWindowAtUV(winHits[0].uv.x, winHits[0].uv.y);
    }
  }
});

function releasePointer(e) {
  if (e.pointerId !== activePointerId) return;
  const movePx = Math.hypot(e.clientX - downScreenPos.x, e.clientY - downScreenPos.y);
  const dtMs = performance.now() - downTime;
  const isQuickTap = movePx < 18 && dtMs < 280;

  if (pointerMode === 'ingredient' && draggedItem) {
    const it = draggedItem;
    draggedItem = null;
    const dPot = Math.hypot(it.mesh.position.x - potSystem.potCenter.x, it.mesh.position.z - potSystem.potCenter.z);

    if (isQuickTap || dPot < 0.25) {
      // Generous magnetic assist: quick tap OR release near pot arcs cleanly into the golden broth!
      if (potSystem.lidClosed) potSystem.toggleLid(audio);
      const randA = Math.random() * Math.PI * 2;
      const randR = 0.03 + Math.random() * 0.095;
      activeArcs.push({
        item: it,
        start: it.mesh.position.clone(),
        end: new THREE.Vector3(
          potSystem.potCenter.x + Math.cos(randA) * randR,
          potSystem.brothSurfaceY + 0.015,
          potSystem.potCenter.z + Math.sin(randA) * randR
        ),
        t: 0,
        dur: isQuickTap ? 0.36 : 0.22,
      });
    } else {
      it.state = 'falling';
      it.vel.set(0, 0, 0);
    }
  } else if (pointerMode === 'ladle') {
    // Check if released near any family bowl -> pour!
    let servedIdx = -1;
    if (potSystem.ladleState.fillAmount > 0.25) {
      let minD = 0.165; // generous 16.5cm magnet to nearest bowl!
      family.members.forEach((m, idx) => {
        const d = Math.hypot(
          potSystem.ladleGroup.position.x - m.spec.bowlHome.x,
          potSystem.ladleGroup.position.z - m.spec.bowlHome.z
        );
        if (d < minD) {
          minD = d;
          servedIdx = idx;
        }
      });
    }

    if (servedIdx >= 0) {
      triggerPourIntoBowl(servedIdx);
    } else if (isQuickTap && !potSystem.lidClosed) {
      // Tapping the ladle dips into pot & primes it so child can tap any bowl next!
      potSystem.ladleGroup.position.set(potSystem.potCenter.x + 0.03, potSystem.brothSurfaceY + 0.01, potSystem.potCenter.z + 0.02);
      tryScoopIntoLadle();
      potSystem.ladleGroup.position.y = 0.21;
      potSystem.ladleState.held = false;
      ladlePrimed = true;
    } else {
      // Return unused items in ladle to pot if hovering pot, or rest ladle back on ceramic stand
      potSystem.ladleState.held = false;
      ladlePrimed = potSystem.ladleState.fillAmount > 0.3;
      if (!ladlePrimed) {
        potSystem.ladleGroup.position.copy(potSystem.ladleRestPos);
        potSystem.ladleGroup.rotation.set(0.08, -0.35, 0);
      }
      camState.autoFocusYaw = 0;
    }
  } else if (pointerMode === 'lookOrWindow') {
    // Gently ease pitch back toward comfortable horizon while preserving horizontal look-around briefly
    camState.targetPitch *= 0.5;
  }

  family.setPlayerHandTarget(null, 0.1, false);
  activePointerId = null;
  pointerMode = null;
}

renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);

// --- Main Simulation & Render Loop ---
const clock = new THREE.Clock();
let elapsed = 0;
let fpsFrames = 0;
let fpsTime = 0;
let currentFps = 60;

function stepSimulation(dt) {
  elapsed += dt;

  // 1. Subtle 10.5s idle one-time in-world hand nudge (wordless.short.md & summary.short.md!)
  if (!hasEverTouched && !idleDemoDone) {
    idleElapsed += dt;
    if (idleElapsed > 10.5) {
      idleDemoDone = true;
      const sampleVeg = ingredients.items.find((i) => i.state === 'tray' && i.type === 'hakusai');
      if (sampleVeg) {
        idleDemoAnim = { item: sampleVeg, t: 0 };
      }
    }
  }
  if (idleDemoAnim) {
    idleDemoAnim.t += dt;
    const t = idleDemoAnim.t;
    if (t < 0.55) {
      family.setPlayerHandTarget(
        idleDemoAnim.item.mesh.position.clone().add(new THREE.Vector3(0.02, 0.04, 0.05)),
        0.5,
        true
      );
    } else if (t < 0.75) {
      idleDemoAnim.item.jiggleAmp = 0.85;
      family.setPlayerHandTarget(null, 0.1, false);
    } else {
      idleDemoAnim = null;
    }
  }

  // 2. Update ingredient toss arcs
  for (let i = activeArcs.length - 1; i >= 0; i--) {
    const arc = activeArcs[i];
    arc.t = Math.min(1, arc.t + dt / arc.dur);
    const p = arc.start.clone().lerp(arc.end, arc.t);
    p.y += Math.sin(arc.t * Math.PI) * 0.12;
    arc.item.mesh.position.copy(p);
    arc.item.mesh.rotation.y += dt * 2.5;
    family.setPlayerHandTarget(p.clone().add(new THREE.Vector3(0.02, 0.04, 0.05)), 0.65, arc.t < 0.65);

    if (arc.t >= 1) {
      arc.item.state = 'pot';
      arc.item.potAngle = Math.atan2(arc.end.z - potSystem.potCenter.z, arc.end.x - potSystem.potCenter.x);
      arc.item.potRadius = Math.min(0.13, Math.hypot(arc.end.x - potSystem.potCenter.x, arc.end.z - potSystem.potCenter.z));
      arc.item.jiggleAmp = 1.0;
      potSystem.addSplash(arc.end.x - potSystem.potCenter.x, arc.end.z - potSystem.potCenter.z, 1.0);
      audio.playSplash(arc.item.type === 'tofu' ? 1.15 : 0.95);
      if (arc.item.type === 'yuzu') potSystem.triggerYuzuAroma();
      family.setPlayerHandTarget(null, 0.1, false);
      ingredients.checkReplenish();
      activeArcs.splice(i, 1);
    }
  }

  // 3. Update Ladle Pouring Choreography into Family Bowls
  if (pourAnim) {
    pourAnim.t = Math.min(1, pourAnim.t + dt / pourAnim.dur);
    const t = pourAnim.t;
    if (t < 0.32) {
      const u = t / 0.32;
      potSystem.ladleGroup.position.lerpVectors(pourAnim.startPos, pourAnim.bowlPos, u);
      const gripPour = new THREE.Vector3(0, 0.145, 0.185);
      potSystem.ladleTiltGroup.localToWorld(gripPour);
      family.setPlayerHandTarget(gripPour, 0.9, true);
    } else if (t < 0.78) {
      const u = (t - 0.32) / 0.46;
      const tilt = Math.sin(u * Math.PI) * 0.92;
      potSystem.ladleTiltGroup.rotation.z = tilt;
      potSystem.ladleState.fillAmount = Math.max(0, 1 - u * 1.25);

      // Show glistening golden soup stream pouring into the tonsui bowl!
      potSystem.pourStreamMesh.visible = true;
      potSystem.pourStreamMesh.position.copy(pourAnim.bowlPos).add(new THREE.Vector3(-0.032, -0.01, -0.02));
      potSystem.pourStreamMesh.scale.set(0.8 + Math.sin(u * 20) * 0.15, 1.0, 0.8);

      if (!pourAnim.delivered && u > 0.42) {
        pourAnim.delivered = true;
        const deliveredItems = potSystem.ladleState.carriedItems.splice(0);
        family.serveBowl(pourAnim.memberIdx, deliveredItems, potSystem, audio);
        totalBowlsServed += 1;
        ingredients.checkReplenish();

        // Reward Stage ("お鍋のシメ"): after 3 bowls served, unlock glossy Udon & Toasted Mochi + gentle winter snow!
        if (totalBowlsServed >= 3 && !ingredients.shimeUnlocked) {
          ingredients.unlockShimeReward();
          snowTarget = 1.0;
        }
      }
    } else {
      const u = (t - 0.78) / 0.22;
      potSystem.pourStreamMesh.visible = false;
      potSystem.ladleTiltGroup.rotation.z = 0;
      potSystem.ladleGroup.position.lerpVectors(pourAnim.bowlPos, potSystem.ladleRestPos, u);
      potSystem.ladleGroup.rotation.set(0.08, -0.35 * u, 0);
      family.setPlayerHandTarget(null, 0.1, false);
    }

    if (t >= 1) {
      potSystem.pourStreamMesh.visible = false;
      potSystem.ladleTiltGroup.rotation.z = 0;
      potSystem.ladleState.fillAmount = 0;
      potSystem.ladleGroup.position.copy(potSystem.ladleRestPos);
      potSystem.ladleGroup.rotation.set(0.08, -0.35, 0);
      pourAnim = null;
    }
  } else if (!potSystem.ladleState.held && !ladlePrimed) {
    potSystem.ladleGroup.position.lerp(potSystem.ladleRestPos, Math.min(1, dt * 8));
  }

  // 4. Compute pot cooking summary & update subsystems
  const potItems = ingredients.items.filter((i) => i.state === 'pot');
  const avgCook = potItems.length > 0
    ? potItems.reduce((acc, it) => acc + it.cookProgress, 0) / potItems.length
    : 0;

  potSystem.update(dt, elapsed, camera, potItems.length, avgCook);
  ingredients.update(dt, elapsed, potSystem);
  env.update(dt, elapsed, potSystem.boilLevel, snowTarget);
  audio.update(dt, potSystem.boilLevel, potSystem.lidClosed);

  // Focus point that family eyes/heads naturally follow!
  let focusPos = potSystem.potCenter.clone().setY(potSystem.brothSurfaceY);
  if (draggedItem) {
    focusPos.copy(draggedItem.mesh.position);
  } else if (potSystem.ladleState.held || pourAnim || ladlePrimed) {
    focusPos.copy(potSystem.ladleGroup.position);
  }
  family.update(dt, elapsed, potSystem, focusPos);

  // 5. Update Camera Look-Around from Center of Dining Table ("食卓中央から家族を見回す")
  if (camState.serveFocusTimer > 0) {
    camState.serveFocusTimer -= dt;
    if (camState.serveFocusTimer <= 0) camState.autoFocusYaw = 0;
  }
  if (pointerMode !== 'lookOrWindow') {
    // Slowly drift manual pan back slightly only if untouched for a while, keeping comfortable view
    camState.targetYaw *= Math.exp(-dt * 0.18);
  }
  const desiredYaw = THREE.MathUtils.clamp(camState.targetYaw + camState.autoFocusYaw, -0.46, 0.46);
  camState.yaw += (desiredYaw - camState.yaw) * Math.min(1, dt * 5.5);
  camState.pitch += (camState.targetPitch - camState.pitch) * Math.min(1, dt * 5.5);

  // Subtle handheld human breathing warmth
  const breatheX = Math.sin(elapsed * 0.75) * 0.004;
  const breatheY = Math.cos(elapsed * 1.1) * 0.003;
  camera.position.set(
    camState.basePos.x + Math.sin(camState.yaw) * 0.08 + breatheX,
    camState.basePos.y + camState.pitch * 0.12 + breatheY,
    camState.basePos.z
  );

  // Rotate look direction around the central dining table
  const lookOffset = camState.baseLook.clone().sub(camera.position);
  lookOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), camState.yaw);
  lookOffset.y += camState.pitch * 0.42;
  camera.lookAt(camera.position.clone().add(lookOffset));
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  stepSimulation(dt);
  renderer.render(scene, camera);

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
    window.__nabeStats = {
      fps: currentFps,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      pixelRatio: renderer.getPixelRatio(),
      potItems: ingredients.items.filter((i) => i.state === 'pot').length,
      bowlsServed: totalBowlsServed,
      shimeUnlocked: ingredients.shimeUnlocked,
    };
  }
}

// Expose deterministic test helper for visual verification across states
window.__nabeDebug = {
  scene,
  camera,
  renderer,
  potSystem,
  ingredients,
  family,
  camState,
  step: (seconds) => {
    const steps = Math.ceil(seconds / 0.016);
    for (let i = 0; i < steps; i++) stepSimulation(0.016);
    renderer.render(scene, camera);
  },
};

animate();
