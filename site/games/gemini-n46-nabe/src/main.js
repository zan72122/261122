import * as THREE from 'three';
import { createWoodTableTextures } from './textures.js';
import { buildDiningEnvironment } from './environment.js';
import { createWinterWindow } from './window.js';
import { createPotSystem } from './pot.js';
import { createIngredientSystem } from './ingredients.js';
import { createLadleSystem } from './ladle.js';
import { createFamilySystem } from './family.js';
import { createPlayerHand } from './hand.js';
import { NabeAudio } from './audio.js';

// ============================================================================
// Renderer & Scene Setup (Photorealistic ACES Filmic, Pixel Ratio <= 1.5)
// ============================================================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // allows clean screenshot/thumb capture
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e16);
scene.fog = new THREE.FogExp2(0x161213, 0.11);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.05, 16);

// ============================================================================
// Environment IBL, Lighting, Dining Table, Winter Window, Pot, Food, Family
// ============================================================================
const envRig = buildDiningEnvironment(renderer, scene);

// Solid Walnut/Oak Dining Table (hand-oiled matte-satin finish — zero plastic sheen!)
const woodTex = createWoodTableTextures();
const tableMat = new THREE.MeshPhysicalMaterial({
  map: woodTex.map,
  normalMap: woodTex.normalMap,
  normalScale: new THREE.Vector2(0.55, 0.55),
  roughnessMap: woodTex.roughnessMap,
  roughness: 1.0,
  metalness: 0.0,
  clearcoat: 0.05,
  clearcoatRoughness: 0.65,
});

const tableMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.055, 1.38), tableMat);
tableMesh.position.set(0, -0.0275, -0.02);
tableMesh.receiveShadow = true;
scene.add(tableMesh);

// Subtle cozy warm room ambiance props at far table corners (teapot / warm ceramic cup)
const teaCupMat = new THREE.MeshPhysicalMaterial({
  color: 0x3b483d,
  roughness: 0.22,
  clearcoat: 0.8,
});
for (const [tx, tz] of [[-0.64, -0.06], [0.62, -0.05]]) {
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.068, 22), teaCupMat);
  cup.position.set(tx, 0.034, tz);
  cup.castShadow = true;
  cup.receiveShadow = true;
  scene.add(cup);
}

const winterWindow = createWinterWindow(scene, tableMat);
const potSystem = createPotSystem(scene);
const ingredientSystem = createIngredientSystem(scene);
const ladleSystem = createLadleSystem(scene);
const familySystem = createFamilySystem(scene);
const playerHand = createPlayerHand(scene);
const audio = new NabeAudio();

// ============================================================================
// Camera Rig: Seated at Dining Table Center, Smoothly Looking Around at Family
// ============================================================================
const camState = {
  pan: 0.0,         // -1 (Mom left) .. 0 (Center/Dad) .. +1 (Sister right)
  targetPan: 0.0,
  zoom: 0.0,        // 0 normal table view .. 1 slight warm zoom when serving a family member
  targetZoom: 0.0,
  lookPos: new THREE.Vector3(0, 0.22, -0.10),
  curLookPos: new THREE.Vector3(0, 0.22, -0.10),
  autoCenterTimer: 0,
};

function updateCameraProjection() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;
  // Adapt FOV seamlessly for iPhone portrait vs iPad/Desktop landscape so platter, pot,
  // ladle, family & winter window are ALL generously framed on frame 1!
  if (aspect < 0.72) {
    camera.fov = 64;
  } else if (aspect < 0.95) {
    camera.fov = 58;
  } else if (aspect < 1.2) {
    camera.fov = 52;
  } else {
    camera.fov = 47;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
updateCameraProjection();
window.addEventListener('resize', updateCameraProjection);

function updateCameraTransform(dt, elapsed) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitBoost = aspect < 0.72 ? 0.34 : aspect < 0.95 ? 0.22 : aspect < 1.25 ? 0.06 : 0.0;

  camState.pan += (camState.targetPan - camState.pan) * Math.min(1, dt * 5.2);
  camState.zoom += (camState.targetZoom - camState.zoom) * Math.min(1, dt * 4.5);

  // Subtle organic human breathing micro-motion
  const swayX = Math.sin(elapsed * 0.55) * 0.004;
  const swayY = Math.cos(elapsed * 0.85) * 0.003;

  // Seated right at the dining table looking slightly down across platter, steaming donabe,
  // ladle, all 3 family members & their bowls, and the rainy bokeh winter window!
  const baseZ = 0.86 + portraitBoost - camState.zoom * 0.14;
  const baseY = 0.56 + portraitBoost * 0.50 - camState.zoom * 0.06;

  // Gentle natural turn from the center of the dining table toward each family member
  const camX = -camState.pan * 0.09 + swayX;
  const camZ = baseZ - Math.abs(camState.pan) * 0.06;
  const camY = baseY + swayY;

  camera.position.set(camX, camY, camZ);

  // Look target swings smoothly across the table from Mom (left) -> Donabe/Dad -> Sister (right)
  const lookX = camState.pan * 0.44;
  const lookY = 0.18 + camState.zoom * 0.07 + Math.abs(camState.pan) * 0.03;
  const lookZ = -0.06 - Math.abs(camState.pan) * 0.10;

  camState.lookPos.set(lookX, lookY, lookZ);
  camState.curLookPos.lerp(camState.lookPos, Math.min(1, dt * 7.5));
  camera.lookAt(camState.curLookPos);
}

// ============================================================================
// Single-Finger Tactile Interaction Controller (Multi-touch Safe, Zero Text!)
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
const intersectPt = new THREE.Vector3();

const interaction = {
  activePointerId: null,
  mode: 'none', // 'none' | 'ingredient' | 'ladle' | 'lid' | 'stir' | 'window' | 'look'
  downScreen: new THREE.Vector2(),
  lastScreen: new THREE.Vector2(),
  movedDist: 0,
  grabbedIngredient: null,
  hoveredMember: null,
  lastActionTime: 0,
  idleHintActive: false,
  stirSoundCd: 0,
  wipeSoundCd: 0,
  hasAddedAny: false,
};

function setPointerNDC(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
}

function projectToDragPlane(yHeight) {
  dragPlane.constant = -yHeight;
  raycaster.setFromCamera(pointerNDC, camera);
  if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
    intersectPt.x = THREE.MathUtils.clamp(intersectPt.x, -0.68, 0.68);
    intersectPt.z = THREE.MathUtils.clamp(intersectPt.z, -0.45, 0.48);
    return intersectPt;
  }
  return null;
}

function findNearestFamilyMember(worldPos, maxDist = 0.22) {
  let best = null;
  let bestD = maxDist;
  for (const m of familySystem.members) {
    const bp = m.getBowlWorldPos();
    const dx = worldPos.x - bp.x;
    const dz = worldPos.z - bp.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function onPointerDown(e) {
  if (interaction.activePointerId !== null) return; // single-finger safe!
  interaction.activePointerId = e.pointerId;
  interaction.downScreen.set(e.clientX, e.clientY);
  interaction.lastScreen.set(e.clientX, e.clientY);
  interaction.movedDist = 0;
  interaction.lastActionTime = performance.now() * 0.001;
  interaction.idleHintActive = false;

  audio.unlock();
  setPointerNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(pointerNDC, camera);

  // Priority 1: If already holding a full ladle (from tap-to-scoop), tapping a family bowl pours right in!
  if (ladleSystem.state.mode === 'holding') {
    const bowlHits = raycaster.intersectObjects(familySystem.getBowlHitMeshes(), false);
    if (bowlHits.length > 0) {
      const m = bowlHits[0].object.userData.familyMember;
      camState.targetPan = m.cfg.panAngle;
      camState.targetZoom = 0.72;
      camState.autoCenterTimer = 3.2;
      ladleSystem.startPour(m, potSystem, audio);
      playerHand.release();
      interaction.mode = 'none';
      return;
    }
  }

  // Priority 2: Stove heat knob
  const knobHits = raycaster.intersectObject(potSystem.knobHit, false);
  if (knobHits.length > 0) {
    const heat = potSystem.cycleHeat();
    audio.playStoveClick(heat);
    const kp = new THREE.Vector3();
    potSystem.knobPivot.getWorldPosition(kp);
    playerHand.setTarget(kp, 'point');
    setTimeout(() => {
      if (interaction.mode === 'none') playerHand.release();
    }, 360);
    interaction.mode = 'none';
    return;
  }

  // Priority 3: Grabbing a fresh ingredient on the wooden platter
  const ingHits = raycaster.intersectObjects(ingredientSystem.getHitMeshes(), false);
  if (ingHits.length > 0) {
    const item = ingHits[0].object.userData.ingredient;
    if (item && item.state === 'platter') {
      interaction.mode = 'ingredient';
      interaction.grabbedIngredient = item;
      item.state = 'dragging';
      item.wobble = 0.8;
      audio.playPickup(item.type === 'tofu');
      camState.targetPan = 0;
      camState.targetZoom = 0;
      return;
    }
  }

  // Priority 4: Grabbing / tapping the ladle
  const ladleHits = raycaster.intersectObjects(ladleSystem.hitMeshes, false);
  if (ladleHits.length > 0) {
    interaction.mode = 'ladle';
    audio.playPickup(true);
    if (ladleSystem.state.mode === 'rest') {
      ladleSystem.state.mode = 'dragging';
    } else if (ladleSystem.state.mode === 'holding') {
      ladleSystem.state.mode = 'dragging';
    }
    return;
  }

  // Priority 5: Donabe ceramic lid (drag onto pot or lift off!)
  const lidHits = raycaster.intersectObject(potSystem.lidMesh, false);
  if (lidHits.length > 0) {
    interaction.mode = 'lid';
    potSystem.state.lidDragging = true;
    audio.playCeramicClink(0.16, 1.08);
    return;
  }

  // Priority 6: Stirring directly inside the open steaming pot!
  if (!potSystem.state.lidOn) {
    const brothHits = raycaster.intersectObject(potSystem.brothPlane, false);
    if (brothHits.length > 0) {
      interaction.mode = 'stir';
      const p = brothHits[0].point;
      potSystem.spawnSplash(p.x, p.z, 6, 0.55);
      audio.playStirSwish();
      return;
    }
  }

  // Priority 7: Tapping a family member's bowl (pans gently to look at them & smiles!)
  const bowlHits = raycaster.intersectObjects(familySystem.getBowlHitMeshes(), false);
  if (bowlHits.length > 0) {
    const m = bowlHits[0].object.userData.familyMember;
    camState.targetPan = m.cfg.panAngle;
    camState.targetZoom = 0.55;
    camState.autoCenterTimer = 2.6;
    m.nudgeReact(audio);
    interaction.mode = 'none';
    return;
  }

  // Priority 8: Tapping the empty wooden platter refills fresh ingredients!
  const platterHits = raycaster.intersectObject(ingredientSystem.trayBase, false);
  if (platterHits.length > 0) {
    ingredientSystem.refillPlatter(audio);
    interaction.mode = 'none';
    return;
  }

  // Priority 9: Touching the winter rainy window wipes condensation clear!
  const winHits = raycaster.intersectObject(winterWindow.glassMesh, false);
  if (winHits.length > 0) {
    interaction.mode = 'window';
    winterWindow.wipeAtUV(winHits[0].uv);
    audio.playWindowWipe();
    return;
  }

  // Priority 10: Dragging anywhere else gently looks around the dining table at the family!
  interaction.mode = 'look';
}

function onPointerMove(e) {
  if (e.pointerId !== interaction.activePointerId) return;
  const dx = e.clientX - interaction.lastScreen.x;
  const dy = e.clientY - interaction.lastScreen.y;
  interaction.movedDist += Math.hypot(dx, dy);
  interaction.lastScreen.set(e.clientX, e.clientY);
  interaction.lastActionTime = performance.now() * 0.001;

  setPointerNDC(e.clientX, e.clientY);

  if (interaction.mode === 'ingredient' && interaction.grabbedIngredient) {
    const pt = projectToDragPlane(0.28);
    if (pt) {
      interaction.grabbedIngredient.mesh.position.lerp(pt, 0.45);
      playerHand.setTarget(interaction.grabbedIngredient.mesh.position, 'pinch');
    }
  } else if (interaction.mode === 'ladle') {
    const pt = projectToDragPlane(0.27);
    if (pt) {
      const shouldScoop = ladleSystem.setDragTarget(pt, potSystem);
      if (shouldScoop) {
        ladleSystem.startScoop(potSystem, ingredientSystem, audio);
        interaction.mode = 'none';
        playerHand.setTarget(ladleSystem.getHandleGripWorld(), 'grip');
        return;
      }
      // Look smoothly toward the family member as you bring the full ladle near them!
      const nearMember = ladleSystem.state.hasBroth ? findNearestFamilyMember(pt, 0.28) : null;
      interaction.hoveredMember = nearMember;
      if (nearMember) {
        camState.targetPan = nearMember.cfg.panAngle;
        camState.targetZoom = 0.62;
        camState.autoCenterTimer = 0;
      } else {
        camState.targetPan = THREE.MathUtils.clamp(pt.x * 1.1, -0.45, 0.45);
        camState.targetZoom = 0.0;
      }
      playerHand.setTarget(ladleSystem.getHandleGripWorld(), 'grip');
    }
  } else if (interaction.mode === 'lid') {
    const pt = projectToDragPlane(0.26);
    if (pt) {
      potSystem.lidGroup.position.lerp(pt, 0.45);
      const knobTop = potSystem.lidGroup.position.clone().add(new THREE.Vector3(0, 0.095, 0));
      playerHand.setTarget(knobTop, 'pinch');
    }
  } else if (interaction.mode === 'stir') {
    const pt = projectToDragPlane(potSystem.state.potCenter.y);
    if (pt) {
      potSystem.addSwirl(dx * 0.045);
      if (interaction.stirSoundCd <= 0 && Math.hypot(dx, dy) > 6) {
        potSystem.spawnRipple(pt.x, pt.z, 0.7);
        audio.playStirSwish();
        interaction.stirSoundCd = 0.24;
      }
      playerHand.setTarget(pt, 'point');
    }
  } else if (interaction.mode === 'window') {
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(winterWindow.glassMesh, false);
    if (hits.length > 0) {
      winterWindow.wipeAtUV(hits[0].uv);
      if (interaction.wipeSoundCd <= 0 && Math.hypot(dx, dy) > 5) {
        audio.playWindowWipe();
        interaction.wipeSoundCd = 0.18;
      }
    }
    // Also gently pan camera slightly if swiping wide across window
    camState.targetPan = THREE.MathUtils.clamp(camState.targetPan - dx * 0.0012, -0.55, 0.55);
  } else if (interaction.mode === 'look') {
    camState.targetPan = THREE.MathUtils.clamp(camState.targetPan - dx * 0.0028, -0.62, 0.62);
    camState.autoCenterTimer = 4.0;
  }
}

function onPointerUp(e) {
  if (e.pointerId !== interaction.activePointerId) return;
  const wasTap = interaction.movedDist < 20;

  if (interaction.mode === 'ingredient' && interaction.grabbedIngredient) {
    const item = interaction.grabbedIngredient;
    interaction.grabbedIngredient = null;

    // Forgiving for a 5yo: tapping OR releasing anywhere near the pot arcs the ingredient right in!
    const distToPot = Math.hypot(
      item.mesh.position.x - potSystem.state.potCenter.x,
      item.mesh.position.z - potSystem.state.potCenter.z
    );
    if (wasTap || distToPot < 0.34) {
      // If lid is currently covering the pot, lift it smoothly first so child is never blocked!
      if (potSystem.state.lidOn) {
        potSystem.setLidOn(false, audio);
      }
      ingredientSystem.launchIntoPot(item, potSystem, audio);
      interaction.hasAddedAny = true;
    } else {
      // Gentle return back to platter slot if dragged far away
      item.state = 'platter';
      const platterSlot = ingredientSystem.items.find((x) => x === item);
      if (platterSlot) item.state = 'platter';
      ingredientSystem.launchIntoPot(item, potSystem, audio); // still delightful & responsive!
      interaction.hasAddedAny = true;
    }
    playerHand.release();
  } else if (interaction.mode === 'ladle') {
    if (wasTap && !ladleSystem.state.hasBroth) {
      // Tapping the ladle scoops straight from the steaming pot!
      if (potSystem.state.lidOn) potSystem.setLidOn(false, audio);
      ladleSystem.startScoop(potSystem, ingredientSystem, audio);
    } else if (ladleSystem.state.hasBroth) {
      // Check if released over a family member's bowl (very generous magnet radius!)
      const near = interaction.hoveredMember || findNearestFamilyMember(ladleSystem.ladleGroup.position, 0.34);
      if (near) {
        camState.targetPan = near.cfg.panAngle;
        camState.targetZoom = 0.72;
        camState.autoCenterTimer = 3.2;
        ladleSystem.startPour(near, potSystem, audio);
        playerHand.release();
      } else if (wasTap) {
        // Tapping full ladle serves the hungriest/least-served family member!
        const sorted = [...familySystem.members].sort((a, b) => a.serveCount - b.serveCount);
        const target = sorted[0];
        camState.targetPan = target.cfg.panAngle;
        camState.targetZoom = 0.72;
        camState.autoCenterTimer = 3.2;
        ladleSystem.startPour(target, potSystem, audio);
        playerHand.release();
      } else {
        // Keep ladle floating ready above pot so child can drag or tap a bowl next!
        ladleSystem.state.mode = 'holding';
        ladleSystem.state.targetPos.set(potSystem.state.potCenter.x, potSystem.state.potCenter.y + 0.16, potSystem.state.potCenter.z + 0.04);
        camState.targetPan = 0;
        camState.targetZoom = 0;
        playerHand.release();
      }
    } else {
      ladleSystem.returnToRest();
      playerHand.release();
    }
    interaction.hoveredMember = null;
  } else if (interaction.mode === 'lid') {
    potSystem.state.lidDragging = false;
    if (wasTap) {
      potSystem.setLidOn(!potSystem.state.lidOn, audio);
    } else {
      const dist = Math.hypot(
        potSystem.lidGroup.position.x - potSystem.lidOnPos.x,
        potSystem.lidGroup.position.z - potSystem.lidOnPos.z
      );
      potSystem.setLidOn(dist < 0.18, audio);
    }
    playerHand.release();
  } else if (interaction.mode === 'stir') {
    playerHand.release();
  }

  interaction.mode = 'none';
  interaction.activePointerId = null;
}

const domEl = renderer.domElement;
domEl.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });

// ============================================================================
// Main Animation Loop
// ============================================================================
const clock = new THREE.Clock();
let elapsed = 0;
interaction.lastActionTime = performance.now() * 0.001;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  if (interaction.stirSoundCd > 0) interaction.stirSoundCd -= dt;
  if (interaction.wipeSoundCd > 0) interaction.wipeSoundCd -= dt;

  // Gently return camera to center view a few seconds after serving or looking around
  if (camState.autoCenterTimer > 0 && interaction.mode === 'none') {
    camState.autoCenterTimer -= dt;
    if (camState.autoCenterTimer <= 0) {
      camState.targetPan = 0;
      camState.targetZoom = 0;
    }
  }

  // Subtle wordless idle invitation ONLY after 10+ seconds of zero interaction on opening state
  const nowSec = performance.now() * 0.001;
  if (!interaction.hasAddedAny && interaction.mode === 'none' && nowSec - interaction.lastActionTime > 10.0) {
    const firstPlatter = ingredientSystem.getPlatterItems()[0];
    if (firstPlatter) {
      const pulse = Math.sin(elapsed * 3.2) * 0.008;
      firstPlatter.mesh.position.y += pulse * dt * 8;
    }
  }

  // Keep player hand gripping ladle during automated scoop animation
  if (ladleSystem.state.mode === 'scooping' || ladleSystem.state.mode === 'pouring') {
    playerHand.setTarget(ladleSystem.getHandleGripWorld(), 'grip');
  } else if (interaction.mode === 'none' && ladleSystem.state.mode !== 'scooping' && ladleSystem.state.mode !== 'pouring') {
    if (playerHand.state.active) playerHand.release();
  }

  const potItems = ingredientSystem.getPotItems();
  potSystem.update(dt, elapsed, {
    flameLight: envRig.flameLight,
    ingredientCount: potItems.length,
  });

  ingredientSystem.update(dt, elapsed, potSystem, audio);
  ladleSystem.update(dt, elapsed, potSystem, familySystem);

  // Determine where family members should naturally look
  let familyLook = potSystem.state.potCenter;
  if (interaction.grabbedIngredient) {
    familyLook = interaction.grabbedIngredient.mesh.position;
  } else if (ladleSystem.state.mode !== 'rest') {
    familyLook = ladleSystem.ladleGroup.position;
  }

  familySystem.update(dt, elapsed, {
    lookTarget: familyLook,
    hoveredMember: interaction.hoveredMember,
    potSystem,
    ingredientSystem,
    audio,
  });

  winterWindow.update(dt, elapsed, {
    cameraPan: camState.pan,
    boilLevel: potSystem.state.boilLevel,
  });

  playerHand.update(dt);
  updateCameraTransform(dt, elapsed);
  audio.update(dt, {
    boilLevel: potSystem.state.boilLevel,
    heatLevel: potSystem.state.heatLevel,
    lidOn: potSystem.state.lidOn,
  });

  renderer.render(scene, camera);
}

animate();

// Expose lightweight non-visual diagnostic handle for automated quality inspection
window.__NABE_DEBUG__ = {
  getStats() {
    return {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      pixelRatio: renderer.getPixelRatio(),
      boilLevel: potSystem.state.boilLevel,
      heatLevel: potSystem.state.heatLevel,
      lidOn: potSystem.state.lidOn,
      potItems: ingredientSystem.getPotItems().length,
      platterItems: ingredientSystem.getPlatterItems().length,
      ladleMode: ladleSystem.state.mode,
      pan: camState.pan,
    };
  },
  // Programmatic demo helpers so we can inspect every visual stage cleanly
  demoDropIngredients(count = 7) {
    const platter = ingredientSystem.getPlatterItems();
    const order = ['cabbage', 'tofu', 'shiitake', 'carrot', 'shimeji', 'negi', 'cabbage', 'tofu'];
    let dropped = 0;
    for (const type of order) {
      if (dropped >= count) break;
      const item = platter.find((it) => it.type === type && it.state === 'platter');
      if (item) {
        ingredientSystem.launchIntoPot(item, potSystem, audio);
        dropped++;
      }
    }
    potSystem.state.heatStep = 2;
    potSystem.state.heatLevel = 1.0;
    potSystem.state.boilLevel = 0.96;
  },
  demoSetPan(p, z = 0) {
    camState.targetPan = p;
    camState.pan = p;
    camState.targetZoom = z;
    camState.zoom = z;
    camState.autoCenterTimer = 0;
  },
  demoScoopAndServe(memberIdx = 0) {
    const m = familySystem.members[memberIdx % 3];
    if (!m) return;
    if (ingredientSystem.getPotItems().length < 2) {
      this.demoDropIngredients(4);
      // Fast-land them for demo inspection
      for (const it of ingredientSystem.items) {
        if (it.state === 'flying') {
          it.state = 'pot';
          it.cooked = 0.95;
          it.mesh.position.copy(it.flyEnd);
        }
      }
    }
    ladleSystem.startScoop(potSystem, ingredientSystem, audio);
    setTimeout(() => {
      camState.targetPan = m.cfg.panAngle;
      camState.targetZoom = 0.65;
      ladleSystem.startPour(m, potSystem, audio);
    }, 750);
  },
  demoToggleLid(on) {
    potSystem.setLidOn(on, audio);
  },
};
