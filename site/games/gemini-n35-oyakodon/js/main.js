import * as THREE from '../vendor/three.module.js';
import { SoundEngine } from './audio.js';
import { AnimeChefCharacter } from './character.js';
import { OyakodonKitchen } from './kitchen.js';

const canvas = document.getElementById('game-canvas');
const soundBtn = document.getElementById('sound-btn');
const iconOn = document.getElementById('sound-icon-on');
const iconOff = document.getElementById('sound-icon-off');

// === Renderer Setup (Pixel ratio capped at 1.5 for silky 30+ fps on iPhone/iPad!) ===
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // Crisp vivid cel-anime colors!

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf9ebd2);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 60);

// === Warm Anime Sunlight Lighting Rig ===
const hemiLight = new THREE.HemisphereLight(0xfff9ea, 0xe8b48c, 1.15);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff5dc, 1.35);
sunLight.position.set(4.5, 8.5, 6.0);
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight(0xffd2a6, 0.45);
rimLight.position.set(-5.0, 4.0, -3.0);
scene.add(rimLight);

// === Core Actors ===
const sound = new SoundEngine();
const kitchen = new OyakodonKitchen(scene);
const chef = new AnimeChefCharacter();
chef.group.position.set(0, -0.22, -2.25);
scene.add(chef.group);

// Mute Toggle (icon-only, zero text)
soundBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  sound.unlock();
  sound.setMuted(!sound.muted);
  iconOn.style.display = sound.muted ? 'none' : 'block';
  iconOff.style.display = sound.muted ? 'block' : 'none';
});

// === Responsive Camera (handles iPhone Portrait & iPad Landscape cleanly!) ===
function updateCameraLayout(snap = false) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  camera.aspect = aspect;

  kitchen.applyResponsiveLayout(aspect, snap);

  if (aspect >= 1.15) {
    // Landscape (iPad / Desktop / 4:3) — full headroom for Hana-chan's buns & bow + huge counter props!
    camera.fov = 40;
    camera.position.set(0, 3.85, 6.45);
    camera.lookAt(0, 1.24, -0.14);
  } else if (aspect >= 0.78) {
    // Near-square / iPad Portrait
    camera.fov = 45;
    camera.position.set(0, 4.25, 6.85);
    camera.lookAt(0, 1.28, -0.1);
  } else {
    // Tall Phone Portrait (iPhone 9:19.5) — clean 2-row counter layout with zero clipping on all 4 sides!
    camera.fov = 50;
    camera.position.set(0, 5.45, 9.15);
    camera.lookAt(0, 1.15, 0.5);
  }
  camera.updateProjectionMatrix();
}
updateCameraLayout(true);
window.addEventListener('resize', () => updateCameraLayout(false));

// === Game Stage Machine ===
// 'simmer' -> 'egg_crack' -> 'egg_whisk' -> 'egg_pour' -> 'lid_on' -> 'steaming' -> 'lid_off' -> 'slide' -> 'feast' -> 'done'
let stage = 'simmer';
let stageTime = 0;
let simmerReadyTimer = 0;
let idleTime = 0;
let hintCycle = -1;
let hintShownForStage = false;
let steamEmitTimer = 0;
let pourSoundTimer = 0;
let whiskAngle = 0;
let whiskSoundCooldown = 0;
let feedingAnim = 0;
let slideAnim = 0;
let slideActive = false;
let roundCount = 0;

// === Single-Finger Pointer Handling ===
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
const hitPoint = new THREE.Vector3();

let activePointerId = null;
let dragState = null; // { type: 'ingredient'|'whisk'|'egg_bowl'|'lid'|'pan'|'garnish'|'scoop', item?, startX, startY, moved }
const prevPointerPos = new THREE.Vector2();

function setNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function projectToY(y) {
  dragPlane.constant = -y;
  raycaster.setFromCamera(ndc, camera);
  const res = new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane, res);
  return res;
}

function worldPosOf(obj) {
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  return v;
}

function setStage(next) {
  stage = next;
  stageTime = 0;
  idleTime = 0;
  hintShownForStage = false;
  hintCycle = -1;
  kitchen.hintHand.visible = false;

  if (next === 'egg_crack') {
    sound.playStageChime();
    chef.triggerReaction('sparkle', 'ooh', 1.2);
  } else if (next === 'egg_whisk') {
    kitchen.wholeEggGroup.visible = false;
    kitchen.eggLiquid.visible = true;
    kitchen.chopsticksGroup.visible = true;
    kitchen.crackAnim = 1.0;
    kitchen._redrawEggBowl(0);
    chef.triggerReaction('sparkle', 'bigsmile', 1.1);
  } else if (next === 'egg_pour') {
    sound.playStageChime();
    kitchen.chopsticksGroup.visible = false;
    chef.triggerReaction('sparkle', 'ooh', 1.0);
  } else if (next === 'lid_on') {
    sound.playStageChime();
    kitchen.eggStream.visible = false;
    chef.triggerReaction('happy', 'smile', 0.9);
  } else if (next === 'steaming') {
    kitchen.steamProgress = 0;
    chef.setIdleState('steaming', false);
  } else if (next === 'lid_off') {
    sound.playStageChime();
    kitchen.lidRattleBoost = 1.0;
    kitchen.spawnSteam(new THREE.Vector3(0, 1.05, 0.26), true);
  } else if (next === 'slide') {
    kitchen.triggerRevealBurst();
    sound.playRevealFanfare();
    chef.triggerReaction('ecstasy', 'bigsmile', 1.8);
  } else if (next === 'feast') {
    kitchen.garnishDishGroup.visible = true;
    kitchen.bitesTaken = 0;
    chef.setIdleState('feast', true);
    chef.triggerReaction('sparkle', 'ahhh', 1.4);
  } else if (next === 'done') {
    sound.playBowlFinish();
    roundCount++;
    chef.addCompletedBowl();
    chef.spoonGroup.visible = false;
    chef.triggerReaction('ecstasy', 'bigsmile', 2.4);
    kitchen.spawnBurst(new THREE.Vector3(0, 1.4, 0.9), 0xffd54a, 18, true);
    kitchen.spawnBurst(new THREE.Vector3(0, 2.2, -1.6), 0xff8585, 14, true);
  }
}

function dropIngredientIntoPan(item) {
  if (item.inPan) return;
  item.inPan = true;
  item.dragging = false;
  kitchen.simmeredItemsGroup.add(item.mesh);
  item.mesh.position.set(item.panOffset.x, 0.24, item.panOffset.y);
  sound.playSplash();
  kitchen.jiggleEnergy = 0.7;
  kitchen.spawnBurst(new THREE.Vector3(item.panOffset.x, 0.85, 0.26 + item.panOffset.y), 0xeea142, 8, false);
  kitchen.spawnSteam(new THREE.Vector3(0, 0.9, 0.26), false);
  chef.triggerReaction('sparkle', 'ooh', 0.85);
}

function advanceWhisk(deltaMag) {
  whiskAngle += deltaMag * 0.085;
  kitchen.eggWhisk = Math.min(1, kitchen.eggWhisk + deltaMag * 0.0022);
  kitchen._redrawEggBowl(whiskAngle);
  kitchen.chopsticksGroup.position.x = Math.cos(whiskAngle) * 0.14;
  kitchen.chopsticksGroup.position.z = Math.sin(whiskAngle) * 0.14;
  kitchen.chopsticksGroup.rotation.y = -whiskAngle * 0.4;

  if (whiskSoundCooldown <= 0) {
    sound.playWhisk(kitchen.eggWhisk);
    whiskSoundCooldown = 0.11;
    if (Math.random() < 0.35) {
      kitchen.spawnBurst(worldPosOf(kitchen.eggBowlGroup).add(new THREE.Vector3(0, 0.55, 0)), 0xffcf40, 3, false);
    }
  }
  if (kitchen.eggWhisk >= 1) {
    dragState = null;
    setStage('egg_pour');
  }
}

function performEggPourAt(worldPt, dt) {
  const panPos = worldPosOf(kitchen.panGroup);
  const dx = worldPt.x - panPos.x;
  const dz = worldPt.z - panPos.z;
  const dist = Math.hypot(dx, dz);

  // Smooth magnetic swirl over pan!
  const targetX = dist < 0.95 ? panPos.x + dx * 0.72 : panPos.x + Math.cos(stageTime * 3.8) * 0.42;
  const targetZ = dist < 0.95 ? panPos.z + dz * 0.72 : panPos.z + Math.sin(stageTime * 3.8) * 0.42;

  kitchen.eggBowlGroup.position.lerp(new THREE.Vector3(targetX + 0.52, 1.58, targetZ + 0.1), Math.min(1, dt * 12));
  kitchen.eggBowlGroup.rotation.z = THREE.MathUtils.lerp(kitchen.eggBowlGroup.rotation.z, 1.05, Math.min(1, dt * 10));

  // Position glossy golden egg pour stream cleanly from tilted bowl spout down into pan broth!
  const pourX = kitchen.eggBowlGroup.position.x - 0.42;
  const pourZ = kitchen.eggBowlGroup.position.z - 0.04;
  kitchen.eggStream.visible = true;
  kitchen.eggStream.position.set(pourX, 0.98, pourZ);
  kitchen.eggStream.rotation.z = 0.16;
  kitchen.eggStream.scale.set(1 + Math.sin(stageTime * 22) * 0.14, 1, 1 + Math.cos(stageTime * 22) * 0.14);

  const localX = pourX - panPos.x;
  const localZ = pourZ - panPos.z;
  kitchen.eggPourProgress = Math.min(1, kitchen.eggPourProgress + dt * 0.55);
  kitchen.addEggRibbonAt(localX, localZ);
  kitchen._redrawPanSurface(stageTime);

  // Shrink egg liquid inside bowl as it pours out
  kitchen.eggLiquid.position.y = 0.36 - kitchen.eggPourProgress * 0.24;
  kitchen.eggLiquid.scale.setScalar(1 - kitchen.eggPourProgress * 0.45);

  pourSoundTimer -= dt;
  if (pourSoundTimer <= 0) {
    sound.playEggPourTick();
    pourSoundTimer = 0.11;
    kitchen.spawnSteam(new THREE.Vector3(pourX, 0.88, pourZ), false);
  }

  if (kitchen.eggPourProgress >= 1) {
    kitchen.eggLiquid.visible = false;
    kitchen.eggStream.visible = false;
    dragState = null;
    setStage('lid_on');
  }
}

function beginSlideOntoRice() {
  if (slideActive || stage !== 'slide') return;
  slideActive = true;
  slideAnim = 0;
  sound.playSlideFood();
  chef.triggerReaction('sparkle', 'bigsmile', 1.4);
}

function applyGarnish(g) {
  if (g.used) return;
  g.used = true;
  kitchen.placedGarnishesGroup.add(g.mesh);
  sound.playGarnish(g.kind);
  kitchen.jiggleEnergy = 0.9;

  if (g.kind === 'mitsuba') {
    g.mesh.position.set(0.24, 0.46, 0.14);
    g.mesh.rotation.y = 0.4;
    g.mesh.scale.setScalar(1.32);
    kitchen.spawnBurst(worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.25, 0)), 0x4ad660, 10, true);
  } else if (g.kind === 'nori') {
    g.mesh.position.set(-0.26, 0.44, -0.14);
    g.mesh.scale.setScalar(1.3);
    kitchen.spawnBurst(worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.25, 0)), 0x26382d, 8, false);
  } else if (g.kind === 'yolk') {
    g.mesh.position.set(-0.04, 0.47, 0.04);
    g.mesh.scale.setScalar(1.24);
    kitchen.spawnBurst(worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.25, 0)), 0xffa61a, 10, true);
  }
  chef.triggerReaction('sparkle', 'ooh', 0.95);
}

function feedOneBite() {
  if (stage !== 'feast' || feedingAnim > 0.25) return;
  feedingAnim = 1.0;
  chef.spoonFood.visible = true;
  sound.playBite();
  kitchen.bitesTaken++;
  kitchen.jiggleEnergy = 0.8;

  const bowlTop = worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.15, 0));
  kitchen.spawnBurst(bowlTop, 0xffe066, 10, true);
  chef.triggerReaction('ecstasy', 'chew', 1.35);

  const remain = Math.max(0, 1 - kitchen.bitesTaken / kitchen.maxBites);
  if (remain <= 0.01) {
    kitchen.riceMoundGroup.visible = false;
    kitchen.bowlToppingMount.visible = false;
  } else {
    kitchen.riceMoundGroup.scale.set(0.55 + remain * 0.45, 0.35 + remain * 0.65, 0.55 + remain * 0.45);
    kitchen.bowlToppingMount.scale.set(0.55 + remain * 0.45, 0.4 + remain * 0.6, 0.55 + remain * 0.45);
    kitchen.bowlToppingMount.position.y = 0.58 + remain * 0.3;
  }
}

function resetForNewRound() {
  sound.playStageChime();
  // Return panContents back to panGroup!
  kitchen.panGroup.add(kitchen.panContents);
  kitchen.panContents.position.set(0, 0, 0);
  kitchen.panContents.scale.setScalar(1);
  kitchen.panContents.rotation.set(0, 0, 0);

  kitchen.cookProgress = 0;
  kitchen.eggWhisk = 0;
  kitchen.eggPourProgress = 0;
  kitchen.steamProgress = 0;
  kitchen.eggPuffiness = 0;
  kitchen.pouredSpots = [];
  kitchen.bitesTaken = 0;
  kitchen.yolkPopped = false;
  simmerReadyTimer = 0;
  slideActive = false;
  slideAnim = 0;
  feedingAnim = 0;

  kitchen.wholeEggGroup.visible = true;
  kitchen.eggLiquid.visible = false;
  kitchen.eggLiquid.position.y = 0.36;
  kitchen.eggLiquid.scale.setScalar(1);
  kitchen.chopsticksGroup.visible = false;
  kitchen.eggStream.visible = false;
  kitchen.garnishDishGroup.visible = false;

  kitchen.riceMoundGroup.visible = true;
  kitchen.riceMoundGroup.scale.setScalar(1);
  kitchen.bowlToppingMount.visible = true;
  kitchen.bowlToppingMount.scale.setScalar(1);
  kitchen.bowlToppingMount.position.y = 0.95;

  kitchen.spawnIngredients();
  kitchen.resetGarnishes();
  kitchen._redrawPanSurface(0);
  kitchen._redrawEggBowl(0);

  setStage('simmer');
  chef.setIdleState('simmer', false);
  chef.triggerReaction('sparkle', 'bigsmile', 1.2);
}

// === Hit Testing Helper (generous 3D-projected radius for 5-year-old fingers!) ===
function screenDistTo(obj, clientX, clientY, yOffset = 0.3) {
  const wp = worldPosOf(obj);
  wp.y += yOffset;
  wp.project(camera);
  const sx = (wp.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-wp.y * 0.5 + 0.5) * window.innerHeight;
  return Math.hypot(clientX - sx, clientY - sy);
}

function handlePointerDown(e) {
  if (activePointerId !== null) return; // Multi-touch safe! Ignore extra fingers cleanly.
  activePointerId = e.pointerId;
  idleTime = 0;
  kitchen.hintHand.visible = false;
  sound.unlock();

  setNDC(e.clientX, e.clientY);
  prevPointerPos.set(e.clientX, e.clientY);

  const pt = projectToY(0.8);
  chef.setLookTarget(pt);

  const minSide = Math.min(window.innerWidth, window.innerHeight);
  const generousR = Math.max(58, minSide * 0.13);

  // 1. Always-available discovery: Stacked Bowls on Shelf!
  if (chef.stackedBowls.length > 0 && screenDistTo(chef.shelfGroup, e.clientX, e.clientY, 0.2) < generousR * 0.9) {
    chef.wobbleShelf();
    sound.playTapCeramic();
    return;
  }

  // 2. Always-available discovery (except during feast): Gas Stove Red Flame Knob!
  if (stage !== 'feast' && stage !== 'done' && screenDistTo(kitchen.knobGroup, e.clientX, e.clientY, 0) < generousR * 0.72) {
    kitchen.setFlameLevel(kitchen.flameLevel + 1);
    sound.playKnobClick(kitchen.flameLevel);
    kitchen.triggerWiggle(kitchen.knobGroup, 0.8);
    kitchen.spawnSteam(new THREE.Vector3(0, 0.95, 0.26), kitchen.flameLevel === 2);
    if (stage === 'steaming') {
      kitchen.lidRattleBoost = 1.0;
      sound.playLidRattle(1.0);
    }
    return;
  }

  // === Stage-Specific Primary Interactions ===
  if (stage === 'simmer') {
    // Find nearest remaining ingredient on prep plate (super generous hitbox for 5yo fingers!)
    let best = null;
    let bestD = generousR * 1.45;
    for (const item of kitchen.ingredients) {
      if (item.inPan) continue;
      const d = screenDistTo(item.mesh, e.clientX, e.clientY, 0.08);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    if (best) {
      best.dragging = true;
      dragState = { type: 'ingredient', item: best, startX: e.clientX, startY: e.clientY, moved: false };
      sound.playPickup();
      return;
    }
    // Tapping pan splashes broth slightly!
    if (screenDistTo(kitchen.panGroup, e.clientX, e.clientY, 0.25) < generousR * 1.1) {
      kitchen.jiggleEnergy = 0.75;
      sound.playSplash();
      kitchen.spawnSteam(new THREE.Vector3(0, 0.9, 0.26), false);
      return;
    }
    // Non-active objects wiggle gently!
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'egg_crack') {
    if (screenDistTo(kitchen.eggBowlGroup, e.clientX, e.clientY, 0.45) < generousR * 1.35) {
      sound.playCrack();
      kitchen.spawnBurst(worldPosOf(kitchen.eggBowlGroup).add(new THREE.Vector3(0, 0.75, 0)), 0xfff3d4, 12, false);
      setStage('egg_whisk');
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'egg_whisk') {
    if (screenDistTo(kitchen.eggBowlGroup, e.clientX, e.clientY, 0.4) < generousR * 1.55) {
      dragState = { type: 'whisk', startX: e.clientX, startY: e.clientY, moved: false };
      advanceWhisk(26);
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'egg_pour') {
    const dEgg = screenDistTo(kitchen.eggBowlGroup, e.clientX, e.clientY, 0.4);
    const dPan = screenDistTo(kitchen.panGroup, e.clientX, e.clientY, 0.3);
    if (dEgg < generousR * 1.45 || dPan < generousR * 1.35) {
      dragState = { type: 'egg_bowl', startX: e.clientX, startY: e.clientY, moved: false };
      sound.playPickup();
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'lid_on') {
    if (screenDistTo(kitchen.lidGroup, e.clientX, e.clientY, 0.15) < generousR * 1.45) {
      dragState = { type: 'lid', startX: e.clientX, startY: e.clientY, moved: false };
      sound.playPickup();
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'steaming') {
    // Tapping the rattling lid bounces it & puffs happy extra steam!
    if (screenDistTo(kitchen.lidGroup, e.clientX, e.clientY, 0.2) < generousR * 1.45) {
      kitchen.lidRattleBoost = 1.0;
      kitchen.steamProgress = Math.min(1, kitchen.steamProgress + 0.14);
      sound.playLidRattle(1.0);
      kitchen.spawnSteam(new THREE.Vector3(0, 1.02, 0.26), true);
      chef.triggerReaction('sparkle', 'ooh', 0.7);
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'lid_off') {
    if (screenDistTo(kitchen.lidGroup, e.clientX, e.clientY, 0.2) < generousR * 1.55) {
      dragState = { type: 'lid_lift', startX: e.clientX, startY: e.clientY, moved: false };
      sound.playTapWood();
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'slide') {
    const dPan = screenDistTo(kitchen.panGroup, e.clientX, e.clientY, 0.3);
    const dRice = screenDistTo(kitchen.riceBowlGroup, e.clientX, e.clientY, 0.45);
    if (dPan < generousR * 1.45) {
      dragState = { type: 'pan', startX: e.clientX, startY: e.clientY, moved: false };
      sound.playPickup();
      return;
    }
    if (dRice < generousR * 1.25) {
      beginSlideOntoRice();
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'feast') {
    // 1. Check garnishes on side saucer
    for (const g of kitchen.garnishes) {
      if (g.used) continue;
      if (screenDistTo(g.mesh, e.clientX, e.clientY, 0.1) < generousR * 0.92) {
        dragState = { type: 'garnish', item: g, startX: e.clientX, startY: e.clientY, moved: false };
        sound.playPickup();
        return;
      }
    }
    // 2. Check extra yolk on top of bowl (Discovery: poke to pop into golden cascade!)
    const placedYolk = kitchen.garnishes.find((g) => g.kind === 'yolk' && g.used);
    if (placedYolk && !kitchen.yolkPopped && screenDistTo(placedYolk.mesh, e.clientX, e.clientY, 0.05) < generousR * 0.65) {
      if (kitchen.popExtraYolk()) {
        sound.playYolkPop();
        kitchen.spawnBurst(worldPosOf(placedYolk.mesh), 0xffa61a, 14, true);
        chef.triggerReaction('ecstasy', 'ooh', 1.1);
        return;
      }
    }
    // 3. Check bowl or Hana-chan to scoop a big joyful bite!
    const dBowl = screenDistTo(kitchen.riceBowlGroup, e.clientX, e.clientY, 0.55);
    const dChef = screenDistTo(chef.headPivot, e.clientX, e.clientY, 0);
    if (dBowl < generousR * 1.5 || dChef < generousR * 1.45) {
      feedOneBite();
      return;
    }
    wiggleOtherProps(e.clientX, e.clientY, generousR);
    return;
  }

  if (stage === 'done') {
    // Tap the sparkling empty bowl with flower emblem or Hana-chan to cook another bowl!
    if (
      screenDistTo(kitchen.riceBowlGroup, e.clientX, e.clientY, 0.4) < generousR * 1.8 ||
      screenDistTo(chef.headPivot, e.clientX, e.clientY, 0) < generousR * 1.5
    ) {
      resetForNewRound();
      return;
    }
  }
}

function wiggleOtherProps(cx, cy, r) {
  const checks = [
    [kitchen.plateGroup, 'ceramic'],
    [kitchen.eggBowlGroup, 'ceramic'],
    [kitchen.lidGroup, 'wood'],
    [kitchen.riceBowlGroup, 'ceramic'],
    [kitchen.panGroup, 'wood'],
  ];
  for (const [obj, kind] of checks) {
    if (screenDistTo(obj, cx, cy, 0.25) < r * 1.1) {
      kitchen.triggerWiggle(obj, 0.9);
      if (kind === 'wood') sound.playTapWood();
      else sound.playTapCeramic();
      return;
    }
  }
  if (screenDistTo(chef.headPivot, cx, cy, 0) < r * 1.25) {
    chef.triggerReaction('happy', 'bigsmile', 0.9);
    sound.playGarnish('mitsuba');
  }
}

function handlePointerMove(e) {
  if (e.pointerId !== activePointerId) return;
  idleTime = 0;
  setNDC(e.clientX, e.clientY);

  const dx = e.clientX - prevPointerPos.x;
  const dy = e.clientY - prevPointerPos.y;
  const distMove = Math.hypot(dx, dy);
  prevPointerPos.set(e.clientX, e.clientY);

  const pt = projectToY(1.0);
  chef.setLookTarget(pt);

  if (!dragState) return;
  if (Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) > 14) {
    dragState.moved = true;
  }

  if (dragState.type === 'ingredient') {
    const wp = projectToY(1.15);
    dragState.item.mesh.position.set(
      THREE.MathUtils.clamp(wp.x, -3.2, 3.2),
      1.15,
      THREE.MathUtils.clamp(wp.z, -1.2, 2.2)
    );
    // Generous magnetic auto-drop if dragged right over pan!
    const panP = worldPosOf(kitchen.panGroup);
    if (Math.hypot(wp.x - panP.x, wp.z - panP.z) < 0.95) {
      dropIngredientIntoPan(dragState.item);
      dragState = null;
    }
  } else if (dragState.type === 'whisk') {
    advanceWhisk(distMove);
  } else if (dragState.type === 'egg_bowl') {
    dragState.worldPt = projectToY(1.45);
  } else if (dragState.type === 'lid') {
    const wp = projectToY(1.25);
    kitchen.lidGroup.position.lerp(new THREE.Vector3(wp.x, 1.25, wp.z), 0.35);
    kitchen.lidGroup.rotation.set(0, 0, 0);
    const panP = worldPosOf(kitchen.panGroup);
    if (Math.hypot(wp.x - panP.x, wp.z - panP.z) < 0.98) {
      sound.playLidPlace();
      dragState = null;
      setStage('steaming');
    }
  } else if (dragState.type === 'lid_lift') {
    if (dragState.moved) {
      dragState = null;
      setStage('slide');
    }
  } else if (dragState.type === 'pan') {
    const wp = projectToY(1.1);
    const panX = THREE.MathUtils.clamp(wp.x, -0.4, kitchen.riceBowlHome.x - 0.35);
    kitchen.panGroup.position.lerp(new THREE.Vector3(panX, 1.18, kitchen.panHome.z + 0.3), 0.3);
    const tTilt = THREE.MathUtils.clamp((panX - 0.3) / 1.1, 0, 1);
    kitchen.panGroup.rotation.z = -tTilt * 0.55;
    if (tTilt > 0.62) {
      dragState = null;
      beginSlideOntoRice();
    }
  } else if (dragState.type === 'garnish') {
    const wp = projectToY(1.25);
    // Convert world drag pos to garnishDishGroup local or move directly in world
    if (dragState.item.mesh.parent !== kitchen.root) {
      kitchen.root.attach(dragState.item.mesh);
    }
    dragState.item.mesh.position.set(wp.x, 1.28, wp.z);
    const bowlP = worldPosOf(kitchen.riceBowlGroup);
    if (Math.hypot(wp.x - bowlP.x, wp.z - bowlP.z) < 1.05) {
      applyGarnish(dragState.item);
      dragState = null;
    }
  }
}

function handlePointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;

  if (!dragState) return;
  const st = dragState;
  dragState = null;

  // Forgiving tap-to-act fallback for 5-year-olds who tap instead of dragging!
  if (st.type === 'ingredient') {
    const panP = worldPosOf(kitchen.panGroup);
    const curP = st.item.mesh.position;
    if (!st.moved || Math.hypot(curP.x - panP.x, curP.z - panP.z) < 1.35) {
      dropIngredientIntoPan(st.item);
    } else {
      st.item.dragging = false;
    }
  } else if (st.type === 'egg_bowl') {
    if (!st.moved) {
      // One tap smoothly pours a good burst so kids never feel stuck
      performEggPourAt(worldPosOf(kitchen.panGroup), 0.55);
    }
    kitchen.eggStream.visible = false;
  } else if (st.type === 'lid') {
    const panP = worldPosOf(kitchen.panGroup);
    if (!st.moved || Math.hypot(kitchen.lidGroup.position.x - panP.x, kitchen.lidGroup.position.z - panP.z) < 1.35) {
      sound.playLidPlace();
      setStage('steaming');
    }
  } else if (st.type === 'lid_lift') {
    setStage('slide');
  } else if (st.type === 'pan') {
    if (!st.moved || kitchen.panGroup.position.x > 0.65) {
      beginSlideOntoRice();
    }
  } else if (st.type === 'garnish') {
    const bowlP = worldPosOf(kitchen.riceBowlGroup);
    if (!st.moved || Math.hypot(st.item.mesh.position.x - bowlP.x, st.item.mesh.position.z - bowlP.z) < 1.35) {
      applyGarnish(st.item);
    } else {
      kitchen.garnishDishGroup.add(st.item.mesh);
      st.item.mesh.position.copy(st.item.localHome);
    }
  }
}

canvas.addEventListener('pointerdown', handlePointerDown);
window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('pointerup', handlePointerUp);
window.addEventListener('pointercancel', handlePointerUp);

// === Idle Hint Hand Logic (Strictly waits 10s, demonstrates ONCE cleanly!) ===
function updateIdleHint(dt) {
  if (dragState || slideActive || feedingAnim > 0 || stage === 'steaming') {
    kitchen.hintHand.visible = false;
    return;
  }
  idleTime += dt;
  if (idleTime < 10.0 || hintShownForStage) {
    kitchen.hintHand.visible = false;
    return;
  }

  const p = (idleTime - 10.0) / 1.85;
  if (p >= 1.0) {
    hintShownForStage = true;
    kitchen.hintHand.visible = false;
    return;
  }

  let from = null;
  let to = null;
  if (stage === 'simmer') {
    const rem = kitchen.ingredients.find((i) => !i.inPan);
    if (rem) {
      from = worldPosOf(rem.mesh).add(new THREE.Vector3(0, 0.35, 0.2));
      to = worldPosOf(kitchen.panGroup).add(new THREE.Vector3(0, 0.55, 0.1));
    }
  } else if (stage === 'egg_crack') {
    from = worldPosOf(kitchen.eggBowlGroup).add(new THREE.Vector3(0, 0.95, 0.2));
    to = worldPosOf(kitchen.eggBowlGroup).add(new THREE.Vector3(0, 0.55, 0.2));
  } else if (stage === 'egg_whisk') {
    const c = worldPosOf(kitchen.eggBowlGroup).add(new THREE.Vector3(0, 0.72, 0.15));
    const ang = p * Math.PI * 4;
    kitchen.hintHand.visible = true;
    kitchen.hintHand.position.set(c.x + Math.cos(ang) * 0.32, c.y, c.z + Math.sin(ang) * 0.26);
    return;
  } else if (stage === 'egg_pour') {
    from = worldPosOf(kitchen.eggBowlGroup).add(new THREE.Vector3(0, 0.65, 0.2));
    to = worldPosOf(kitchen.panGroup).add(new THREE.Vector3(0, 1.1, 0.2));
  } else if (stage === 'lid_on') {
    from = worldPosOf(kitchen.lidGroup).add(new THREE.Vector3(0, 0.45, 0.2));
    to = worldPosOf(kitchen.panGroup).add(new THREE.Vector3(0, 0.75, 0.2));
  } else if (stage === 'lid_off') {
    from = worldPosOf(kitchen.lidGroup).add(new THREE.Vector3(0, 0.45, 0.2));
    to = worldPosOf(kitchen.lidGroup).add(new THREE.Vector3(-0.9, 1.15, 0.1));
  } else if (stage === 'slide') {
    from = worldPosOf(kitchen.panGroup).add(new THREE.Vector3(-0.3, 0.65, 0.2));
    to = worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 0.95, 0.2));
  } else if (stage === 'feast' || stage === 'done') {
    from = worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.1, 0.3));
    to = worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 0.85, 0.3));
  }

  if (from && to) {
    kitchen.hintHand.visible = true;
    const ease = p * p * (3 - 2 * p);
    kitchen.hintHand.position.lerpVectors(from, to, ease);
    kitchen.hintHand.position.y += Math.sin(ease * Math.PI) * 0.32;
  }
}

// === Main Animation Loop ===
let lastTime = performance.now();
let elapsed = 0;
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;
  stageTime += dt;

  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAccum);
    fpsFrames = 0;
    fpsAccum = 0;
  }

  whiskSoundCooldown = Math.max(0, whiskSoundCooldown - dt);

  // === Ambient Cooking Audio & Steam ===
  const inPanCount = kitchen.ingredients.filter((i) => i.inPan).length;
  const simmerAmt =
    stage === 'feast' || stage === 'done'
      ? 0
      : stage === 'simmer'
        ? 0.35 + (inPanCount / kitchen.ingredients.length) * 0.55
        : 0.75;
  const steamAmt = stage === 'steaming' ? 0.45 + kitchen.steamProgress * 0.55 : stage === 'lid_off' ? 0.8 : 0;
  sound.setAmbience(simmerAmt, kitchen.flameLevel, steamAmt);
  sound.update(dt);

  // === Stage 1 Completion Check (All ingredients dropped + quick juicy simmer!) ===
  if (stage === 'simmer') {
    if (inPanCount === kitchen.ingredients.length) {
      simmerReadyTimer += dt * (0.85 + kitchen.flameLevel * 0.35);
      if (simmerReadyTimer > 1.35) {
        setStage('egg_crack');
      }
    }
  }

  // === Stage 2A / 2B: Egg Bowl Staging & Swirl Pour ===
  if (stage === 'egg_crack' || stage === 'egg_whisk' || stage === 'egg_pour') {
    if (dragState && dragState.type === 'egg_bowl') {
      performEggPourAt(dragState.worldPt || worldPosOf(kitchen.panGroup), dt);
    } else {
      // Gently bring egg bowl slightly forward so it's big & effortless to tap/whisk!
      const focusPos = kitchen.eggBowlHome.clone();
      focusPos.z += 0.42;
      focusPos.x *= 0.88;
      if (stage === 'egg_crack') {
        focusPos.y = Math.abs(Math.sin(elapsed * 4.2)) * 0.06;
      } else if (stage === 'egg_pour') {
        focusPos.y = 0.14 + Math.sin(elapsed * 4.5) * 0.05;
      }
      kitchen.eggBowlGroup.position.lerp(focusPos, Math.min(1, dt * 7));
      const targetRotZ = stage === 'egg_pour' ? 0.24 : 0;
      kitchen.eggBowlGroup.rotation.z = THREE.MathUtils.lerp(kitchen.eggBowlGroup.rotation.z, targetRotZ, Math.min(1, dt * 8));
    }
  } else if (stage !== 'feast' && stage !== 'done') {
    kitchen.eggBowlGroup.position.lerp(kitchen.eggBowlHome, Math.min(1, dt * 6));
    kitchen.eggBowlGroup.rotation.z = THREE.MathUtils.lerp(kitchen.eggBowlGroup.rotation.z, 0, Math.min(1, dt * 8));
  }

  // === Stage 3: Lid Placement, Steaming & Rattling ===
  if (stage === 'lid_on') {
    if (!dragState || dragState.type !== 'lid') {
      const targetLid = kitchen.lidHome.clone();
      targetLid.y += Math.abs(Math.sin(elapsed * 4.2)) * 0.08;
      kitchen.lidGroup.position.lerp(targetLid, Math.min(1, dt * 7));
      kitchen.lidGroup.rotation.set(0.35, 0.22, -0.1);
    }
  } else if (stage === 'steaming' || stage === 'lid_off') {
    const rate = 0.24 + kitchen.flameLevel * 0.09;
    if (stage === 'steaming') {
      kitchen.steamProgress = Math.min(1, kitchen.steamProgress + dt * rate);
      kitchen.eggPuffiness = Math.min(1, kitchen.steamProgress * 1.05);
      if (kitchen.steamProgress >= 1) {
        setStage('lid_off');
      }
    }
    const rattleAmp = (0.04 + kitchen.steamProgress * 0.075 + kitchen.lidRattleBoost * 0.12) * (0.7 + kitchen.flameLevel * 0.35);
    const liftPop = stage === 'lid_off' ? 0.1 + Math.abs(Math.sin(elapsed * 6.5)) * 0.09 : 0;
    kitchen.lidGroup.position.lerp(
      new THREE.Vector3(0, 1.0 + liftPop + Math.abs(Math.sin(elapsed * 22)) * rattleAmp, 0.26),
      Math.min(1, dt * 16)
    );
    kitchen.lidGroup.rotation.set(
      Math.sin(elapsed * 26) * rattleAmp * 1.1,
      0,
      Math.cos(elapsed * 23) * rattleAmp * 1.2 + (stage === 'lid_off' ? 0.14 : 0)
    );
  } else if (stage !== 'feast' && stage !== 'done') {
    kitchen.lidGroup.position.lerp(kitchen.lidHome, Math.min(1, dt * 7));
    kitchen.lidGroup.rotation.x = THREE.MathUtils.lerp(kitchen.lidGroup.rotation.x, 0.35, Math.min(1, dt * 7));
    kitchen.lidGroup.rotation.z = THREE.MathUtils.lerp(kitchen.lidGroup.rotation.z, -0.1, Math.min(1, dt * 7));
  }

  // === Stage 4: Pan Slide onto Rice Bowl ===
  if (stage === 'slide') {
    if (slideActive) {
      slideAnim = Math.min(1, slideAnim + dt * 1.05);
      const rPos = kitchen.riceBowlHome;
      if (slideAnim < 0.45) {
        const u = slideAnim / 0.45;
        kitchen.panGroup.position.lerp(new THREE.Vector3(rPos.x - 0.72, 1.48, rPos.z - 0.05), Math.min(1, dt * 12));
        kitchen.panGroup.rotation.z = -u * 0.78;
      } else if (slideAnim < 0.82) {
        const u = (slideAnim - 0.45) / 0.37;
        kitchen.panGroup.position.set(
          rPos.x - 0.72 + Math.sin(u * Math.PI * 3) * 0.06,
          1.48,
          rPos.z - 0.05
        );
        kitchen.panGroup.rotation.z = -0.78 - u * 0.22;
        // Slide panContents cleanly off pan into rice bowl!
        kitchen.panContents.position.set(u * 0.88, -u * 0.14, 0);
      } else {
        // Attach oyakodon topping securely onto the rice mound!
        if (kitchen.panContents.parent !== kitchen.bowlToppingMount) {
          kitchen.bowlToppingMount.add(kitchen.panContents);
          kitchen.panContents.position.set(0, -0.08, 0);
          kitchen.panContents.rotation.set(0, 0, 0);
          kitchen.panContents.scale.set(1.06, 1.08, 1.06);
          kitchen.jiggleEnergy = 1.0;
          kitchen.spawnBurst(worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.15, 0)), 0xffe066, 14, true);
        }
        kitchen.panGroup.position.lerp(kitchen.panHome, Math.min(1, dt * 8));
        kitchen.panGroup.rotation.z = THREE.MathUtils.lerp(kitchen.panGroup.rotation.z, 0, Math.min(1, dt * 8));
      }
      if (slideAnim >= 1) {
        slideActive = false;
        setStage('feast');
      }
    } else if (!dragState || dragState.type !== 'pan') {
      const hoverPos = kitchen.panHome.clone();
      hoverPos.y += 0.06 + Math.abs(Math.sin(elapsed * 4)) * 0.06;
      kitchen.panGroup.position.lerp(hoverPos, Math.min(1, dt * 8));
      kitchen.panGroup.rotation.z = THREE.MathUtils.lerp(kitchen.panGroup.rotation.z, -0.1, Math.min(1, dt * 8));
    }
  } else if (stage !== 'feast' && stage !== 'done') {
    kitchen.panGroup.position.lerp(kitchen.panHome, Math.min(1, dt * 7));
    kitchen.panGroup.rotation.z = THREE.MathUtils.lerp(kitchen.panGroup.rotation.z, 0, Math.min(1, dt * 7));
  }

  // === Stage 5 & Done: Hero Centering of Finished Oyakodon + Garnish Dish + Eating Spoon ===
  if (stage === 'feast' || stage === 'done') {
    // Slide rice bowl into glorious hero center-front!
    const heroBowl = new THREE.Vector3(0.0, 0.0, 1.15);
    kitchen.riceBowlGroup.position.lerp(heroBowl, Math.min(1, dt * 6));
    kitchen.riceBowlGroup.scale.lerp(new THREE.Vector3(1.16, 1.16, 1.16), Math.min(1, dt * 6));

    // Slide stove/plate smoothly off to the side so hero oyakodon bowl & Hana-chan shine uncluttered!
    kitchen.stoveGroup.position.lerp(new THREE.Vector3(4.6, 0, -1.2), Math.min(1, dt * 5));
    kitchen.panGroup.position.lerp(new THREE.Vector3(4.6, 0.56, -1.22), Math.min(1, dt * 5));
    kitchen.plateGroup.position.lerp(new THREE.Vector3(-4.6, 0, 0.92), Math.min(1, dt * 5));
    kitchen.lidGroup.position.lerp(new THREE.Vector3(-4.4, 0.24, -0.8), Math.min(1, dt * 5));
    kitchen.eggBowlGroup.position.lerp(new THREE.Vector3(4.8, 0.16, -0.9), Math.min(1, dt * 5));
    kitchen.garnishDishGroup.position.lerp(kitchen.garnishDishHome, Math.min(1, dt * 6));

    if (feedingAnim > 0) {
      feedingAnim = Math.max(0, feedingAnim - dt * 1.55);
      if (feedingAnim < 0.35) {
        chef.spoonFood.visible = false;
      }
      if (feedingAnim === 0 && kitchen.bitesTaken >= kitchen.maxBites) {
        setStage('done');
      }
    }
  } else {
    const bScale = kitchen.portraitBowlScale || 1.0;
    kitchen.riceBowlGroup.position.lerp(kitchen.riceBowlHome, Math.min(1, dt * 6));
    kitchen.riceBowlGroup.scale.lerp(new THREE.Vector3(bScale, bScale, bScale), Math.min(1, dt * 6));
    kitchen.stoveGroup.position.lerp(new THREE.Vector3(0, 0, 0.28), Math.min(1, dt * 6));
    kitchen.plateGroup.position.lerp(kitchen.plateHome, Math.min(1, dt * 6));
    kitchen.garnishDishGroup.position.lerp(new THREE.Vector3(-4.8, 0, 1.12), Math.min(1, dt * 6));
  }

  // === Ambient Steam Emission ===
  steamEmitTimer -= dt;
  if (steamEmitTimer <= 0) {
    if (stage === 'steaming' || stage === 'lid_off') {
      kitchen.spawnSteam(new THREE.Vector3(0, 1.22, 0.26), stage === 'lid_off' || kitchen.flameLevel === 2);
      steamEmitTimer = 0.24 / (0.65 + kitchen.flameLevel * 0.4);
    } else if (stage === 'simmer' || stage === 'egg_crack' || stage === 'egg_whisk' || stage === 'egg_pour' || stage === 'slide') {
      kitchen.spawnSteam(new THREE.Vector3(0, 1.12, 0.26), false);
      steamEmitTimer = 0.55 / (0.65 + kitchen.flameLevel * 0.35);
    } else if (stage === 'feast') {
      kitchen.spawnSteam(worldPosOf(kitchen.riceBowlGroup).add(new THREE.Vector3(0, 1.28, 0)), false);
      steamEmitTimer = 0.65;
    } else {
      steamEmitTimer = 0.8;
    }
  }

  // === Update Subsystems ===
  kitchen.update(dt, elapsed, stage);
  chef.setIdleState(stage, stage === 'feast');
  chef.update(dt, elapsed);
  updateIdleHint(dt);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// === Lightweight Debug Hook for Automated Visual & Performance Inspection ===
window.__GAME__ = {
  getStats() {
    return {
      stage,
      fps: currentFps,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      pixelRatio: renderer.getPixelRatio(),
      roundCount,
      flameLevel: kitchen.flameLevel,
    };
  },
  jumpTo(targetStage) {
    // Helper for visual verification of every stage cleanly
    if (targetStage === 'simmer') {
      resetForNewRound();
      return;
    }
    // Put all ingredients in pan & cook them
    kitchen.ingredients.forEach((item) => {
      if (!item.inPan) {
        item.inPan = true;
        item.cooked = 0.9;
        kitchen.simmeredItemsGroup.add(item.mesh);
        item.mesh.position.set(item.panOffset.x, 0.24, item.panOffset.y);
      }
    });
    if (targetStage === 'egg_crack') {
      setStage('egg_crack');
      return;
    }
    if (targetStage === 'egg_whisk') {
      setStage('egg_whisk');
      kitchen.eggWhisk = 0.45;
      kitchen.crackAnim = 0;
      kitchen._redrawEggBowl(1.4);
      const focusPos = kitchen.eggBowlHome.clone();
      focusPos.z += 0.42;
      focusPos.x *= 0.88;
      kitchen.eggBowlGroup.position.copy(focusPos);
      kitchen.update(0.016, 1.0, stage);
      chef.update(0.016, 1.0);
      renderer.render(scene, camera);
      return;
    }
    kitchen.eggWhisk = 1.0;
    kitchen._redrawEggBowl(4.2);
    if (targetStage === 'egg_pour') {
      setStage('egg_pour');
      kitchen.wholeEggGroup.visible = false;
      kitchen.eggLiquid.visible = true;
      kitchen.eggBowlGroup.position.set(0.55, 1.58, 0.35);
      kitchen.eggBowlGroup.rotation.z = 1.05;
      performEggPourAt(worldPosOf(kitchen.panGroup), 0.75);
      kitchen.eggPourProgress = 0.65;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 1.5;
        kitchen.addEggRibbonAt(Math.cos(a) * 0.42, Math.sin(a) * 0.42);
      }
      kitchen._redrawPanSurface(1.2);
      kitchen.update(0.016, 1.2, stage);
      chef.update(0.016, 1.2);
      renderer.render(scene, camera);
      return;
    }
    kitchen.eggPourProgress = 1.0;
    kitchen.wholeEggGroup.visible = false;
    kitchen.eggLiquid.visible = false;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      kitchen.addEggRibbonAt(Math.cos(a) * 0.45, Math.sin(a) * 0.45);
    }
    kitchen._redrawPanSurface(2.0);
    if (targetStage === 'steaming') {
      setStage('steaming');
      kitchen.steamProgress = 0.65;
      kitchen.eggPuffiness = 0.68;
      kitchen.lidGroup.position.set(0, 1.0, 0.26);
      kitchen.lidGroup.rotation.set(0.05, 0, -0.06);
      for (let i = 0; i < 4; i++) kitchen.spawnSteam(new THREE.Vector3((i - 1.5) * 0.3, 1.28 + i * 0.15, 0.26), true);
      kitchen.update(0.25, 1.5, stage);
      chef.setIdleState('steaming', false);
      chef.update(0.016, 1.5);
      renderer.render(scene, camera);
      return;
    }
    kitchen.steamProgress = 1.0;
    kitchen.eggPuffiness = 1.0;
    if (targetStage === 'slide') {
      setStage('slide');
      kitchen.lidGroup.position.copy(kitchen.lidHome);
      kitchen.revealGlow = 0.85;
      kitchen.update(0.15, 2.0, stage);
      chef.update(0.016, 2.0);
      renderer.render(scene, camera);
      return;
    }
    if (targetStage === 'feast') {
      kitchen.bowlToppingMount.add(kitchen.panContents);
      kitchen.panContents.position.set(0, -0.06, 0);
      kitchen.panContents.scale.set(1.06, 1.08, 1.06);
      kitchen.riceBowlGroup.position.set(0.0, 0.0, 1.15);
      kitchen.riceBowlGroup.scale.setScalar(1.16);
      kitchen.stoveGroup.position.set(4.6, 0, -1.2);
      kitchen.panGroup.position.set(4.6, 0.56, -1.22);
      kitchen.plateGroup.position.set(-4.6, 0, 0.92);
      kitchen.lidGroup.position.set(-4.4, 0.24, -0.8);
      kitchen.eggBowlGroup.position.set(4.8, 0.16, -0.9);
      kitchen.garnishDishGroup.position.copy(kitchen.garnishDishHome);
      setStage('feast');
      applyGarnish(kitchen.garnishes[0]); // mitsuba
      applyGarnish(kitchen.garnishes[2]); // extra yolk
      kitchen.spawnSteam(new THREE.Vector3(-0.35, 1.5, 1.15), false);
      kitchen.update(0.2, 2.5, stage);
      chef.setIdleState('feast', true);
      chef.update(0.016, 2.5);
      renderer.render(scene, camera);
      return;
    }
    if (targetStage === 'done') {
      kitchen.bowlToppingMount.add(kitchen.panContents);
      kitchen.riceMoundGroup.visible = false;
      kitchen.bowlToppingMount.visible = false;
      kitchen.riceBowlGroup.position.set(0.0, 0.0, 1.15);
      kitchen.riceBowlGroup.scale.setScalar(1.16);
      kitchen.stoveGroup.position.set(4.6, 0, -1.2);
      kitchen.panGroup.position.set(4.6, 0.56, -1.22);
      kitchen.plateGroup.position.set(-4.6, 0, 0.92);
      kitchen.lidGroup.position.set(-4.4, 0.24, -0.8);
      kitchen.eggBowlGroup.position.set(4.8, 0.16, -0.9);
      setStage('done');
      kitchen.update(0.15, 3.0, stage);
      chef.update(0.016, 3.0);
      renderer.render(scene, camera);
      return;
    }
  },
};

// Optional stage jump query for automated visual QA (no visible effect in normal play)
const initStageParam = new URLSearchParams(window.location.search).get('stage');
if (initStageParam && window.__GAME__) {
  window.__GAME__.jumpTo(initStageParam);
}
