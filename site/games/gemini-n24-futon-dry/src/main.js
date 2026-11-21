import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createMaterials } from './materials.js';
import { buildBalcony, BALCONY } from './balcony.js';
import { Futon } from './futon.js';
import { HandAndBeater } from './handAndBeater.js';
import { DustParticles } from './particles.js';
import { SoundEngine } from './audio.js';

const canvas = document.getElementById('app');
const curtain = document.getElementById('curtain');

// 1. Photorealistic WebGL2 Renderer with AgX Tone Mapping & capped mobile pixelRatio (<= 1.5)
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
});
let currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(currentPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#7db7eb');

// 2. Natural-lens PerspectiveCamera with separate portrait & landscape compositions
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.06, 80);

// 3. Single Shadow-Casting Sun Light — crisp golden morning sun raking across BOTH
//    the hanging futon's quilted front face (z=-0.42) AND streaming through the open doorway onto the indoor tatami floor (z=1.44)!
const sunLight = new THREE.DirectionalLight(0xfff4e0, 3.1);
sunLight.position.set(3.2, 3.6, 1.05);
sunLight.castShadow = true;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const shadowSize = isMobile ? 1024 : 2048;
sunLight.shadow.mapSize.set(shadowSize, shadowSize);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 14.0;
sunLight.shadow.camera.left = -2.4;
sunLight.shadow.camera.right = 2.4;
sunLight.shadow.camera.top = 2.4;
sunLight.shadow.camera.bottom = -2.2;
sunLight.shadow.bias = -0.00045;
sunLight.shadow.normalBias = 0.018;
sunLight.shadow.radius = 2.5;
scene.add(sunLight);
scene.add(sunLight.target);
sunLight.target.position.set(0, 0.55, 0.15);

// Gentle sky/ground bounce fill (no extra shadows)
const hemiLight = new THREE.HemisphereLight(0xd8ecff, 0xcabaa5, 0.35);
scene.add(hemiLight);

// 4. Audio engine
const audio = new SoundEngine();

// 5. Camera rig (separate tuned compositions for Portrait 390x844 vs Landscape 1024x768)
const camRig = {
  pos: new THREE.Vector3(0, 1.18, 0.88),
  look: new THREE.Vector3(0, 0.72, -0.58),
  targetPos: new THREE.Vector3(),
  targetLook: new THREE.Vector3(),
  targetFov: 44,
  shake: 0
};

function computeCameraTarget(pose) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  // 0 = tall portrait (iPhone 390x844 ~ 0.46), 1 = landscape (iPad 1024x768 ~ 1.33+)
  const land = THREE.MathUtils.clamp((aspect - 0.52) / 0.72, 0, 1);

  if (pose === 'folded') {
    // Frame shows folded cozy futon on sunlit oak duckboard, gleaming balcony rail & blue sky ahead, beater on stool, potted plant on left
    camRig.targetPos.set(
      THREE.MathUtils.lerp(0.02, 0.03, land),
      THREE.MathUtils.lerp(1.26, 1.12, land),
      THREE.MathUtils.lerp(1.74, 1.06, land)
    );
    camRig.targetLook.set(
      0.0,
      THREE.MathUtils.lerp(0.58, 0.58, land),
      THREE.MathUtils.lerp(-0.36, -0.40, land)
    );
    camRig.targetFov = THREE.MathUtils.lerp(52, 44, land);
  } else if (pose === 'hanging') {
    // First-person POV standing in front of sunlit draped futon with clips, bright blue sky & rattan beater clearly framed
    camRig.targetPos.set(
      THREE.MathUtils.lerp(0.02, 0.03, land),
      THREE.MathUtils.lerp(1.08, 1.02, land),
      THREE.MathUtils.lerp(1.64, 0.88, land)
    );
    camRig.targetLook.set(
      0.0,
      THREE.MathUtils.lerp(0.84, 0.84, land),
      THREE.MathUtils.lerp(-0.62, -0.62, land)
    );
    camRig.targetFov = THREE.MathUtils.lerp(52, 44, land);
  } else {
    // 'indoors': Entire plump puffed-up futon framed cleanly on sunlit tatami mat, with oak sill & sunny balcony gleaming beyond!
    camRig.targetPos.set(
      THREE.MathUtils.lerp(0.02, 0.03, land),
      THREE.MathUtils.lerp(1.66, 1.36, land),
      THREE.MathUtils.lerp(3.12, 2.54, land)
    );
    camRig.targetLook.set(
      0.0,
      THREE.MathUtils.lerp(0.20, 0.22, land),
      THREE.MathUtils.lerp(1.24, 1.18, land)
    );
    camRig.targetFov = THREE.MathUtils.lerp(52, 43, land);
  }
}

// 6. Initialize HDRI, PBR materials, balcony, futon, hand/beater, particles
let balcony, futon, handAndBeater, dust;
let idleTime = 0;
let ready = false;

async function init() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Load Poly Haven sunny sky HDRI & materials in parallel
  const hdrPromise = new Promise((resolve) => {
    new HDRLoader().load(
      './assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr',
      (hdrTex) => {
        hdrTex.mapping = THREE.EquirectangularReflectionMapping;
        const envRT = pmrem.fromEquirectangular(hdrTex);
        scene.environment = envRT.texture;
        scene.environmentIntensity = 0.92;
        scene.background = hdrTex;
        scene.backgroundIntensity = 1.08;
        // Tilt & rotate the real Poly Haven Pure Sky HDRI so crisp azure sky & bright cumulus clouds shine cleanly above the balcony railing
        scene.backgroundRotation.set(-0.24, 0.85, 0);
        scene.environmentRotation.set(0, 0.85, 0);
        pmrem.dispose();
        resolve();
      },
      undefined,
      () => resolve()
    );
  });

  const mats = await createMaterials();
  balcony = buildBalcony(scene, mats);
  futon = new Futon(scene, mats);
  handAndBeater = new HandAndBeater(scene, mats);
  dust = new DustParticles(scene);

  await Promise.all([hdrPromise, balcony.ready]);

  computeCameraTarget('folded');
  camRig.pos.copy(camRig.targetPos);
  camRig.look.copy(camRig.targetLook);
  camera.fov = camRig.targetFov;
  camera.position.copy(camRig.pos);
  camera.lookAt(camRig.look);
  camera.updateProjectionMatrix();

  ready = true;
  if (curtain) curtain.classList.add('ready');

  setupInput();
  exposeDebugHandle();
  animate();
}

// 7. One-finger intuitive interaction (zero text, generous hitboxes, forgiving gestures)
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.25);

const pointer = {
  active: false,
  id: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startTime: 0,
  hitKind: null,
  hitObject: null,
  hitPoint: new THREE.Vector3(),
  hitUV: new THREE.Vector2(0.5, 0.5),
  didAction: false,
  lastRubTime: 0
};

function setNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function raycastScene(clientX, clientY) {
  setNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);
  const targets = [
    futon.frontMesh,
    futon.backMesh,
    ...balcony.interactables
  ];
  // Only raycast the resting beater when not already held in first-person hand
  if (handAndBeater.mode !== 'beater') {
    targets.push(handAndBeater.beater);
  }
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;

  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.interactiveType) o = o.parent;
    if (o && o.userData.interactiveType) {
      return {
        type: o.userData.interactiveType,
        object: o,
        point: h.point.clone(),
        uv: h.uv ? h.uv.clone() : new THREE.Vector2(0.5, 0.5)
      };
    }
  }
  return null;
}

function hangFutonOnRail() {
  if (futon.pose === 'hanging') return;
  futon.setPose('hanging');
  futon.dragLift = 0;
  futon.dragX = 0;
  handAndBeater.setMode('beater');
  audio.playFabricWhoosh(0.48, 1.0);
  setTimeout(() => audio.playSoftLand(), 240);
  // Small dust puff just from shaking the futon out onto the rail!
  setTimeout(() => {
    dust.spawnDustBurst(new THREE.Vector3(0, 0.88, -0.58), 0.7, 0.6);
  }, 280);
}

function bringFutonIndoors() {
  if (futon.pose === 'indoors') return;
  balcony.releaseClips();
  futon.leftClamped = false;
  futon.rightClamped = false;
  futon.setPose('indoors');
  futon.dragLift = 0;
  handAndBeater.setMode('pat');
  audio.playFabricWhoosh(0.55, 0.92);
  setTimeout(() => audio.playSoftLand(), 320);
}

function beatFutonAt(worldPoint, uv) {
  handAndBeater.triggerBeat(worldPoint, () => {
    const res = futon.beatAtUV(uv.x, uv.y, 1.0);
    dust.spawnDustBurst(worldPoint, 1.05, 0.55 + res.dustReleased * 0.5);
    audio.playFutonBeat(res.centerFactor, futon.fluffCharge, 1.0);
    camRig.shake = Math.min(1.0, camRig.shake + 0.32);
    // Strong nearby beat gently nudges the glass wind chime
    if (worldPoint.x < -0.22 && Math.random() < 0.35) {
      balcony.triggerChime(0.18);
    }
  });
}

function squishIndoorFutonAt(worldPoint, uv) {
  futon.pressAtUV(uv.x, uv.y, 0.95);
  handAndBeater.triggerPat(worldPoint);
  audio.playFluffySquish(0.9);
  dust.spawnWarmthPuff(worldPoint, 10);
}

function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    if (pointer.active) return; // Single-finger focus, multi-touch safe
    e.preventDefault();
    audio.unlock();
    idleTime = 0;

    pointer.active = true;
    pointer.id = e.pointerId;
    pointer.startX = pointer.lastX = e.clientX;
    pointer.startY = pointer.lastY = e.clientY;
    pointer.startTime = performance.now();
    pointer.didAction = false;

    const hit = raycastScene(e.clientX, e.clientY);
    pointer.hitKind = hit ? hit.type : null;
    pointer.hitObject = hit ? hit.object : null;
    if (hit) {
      pointer.hitPoint.copy(hit.point);
      pointer.hitUV.copy(hit.uv);
    }

    // Immediate snappy responses for discovery props
    if (pointer.hitKind === 'chime') {
      balcony.triggerChime(0.75);
      audio.playWindChime();
      pointer.didAction = true;
    } else if (pointer.hitKind === 'clip') {
      const clipGroup = pointer.hitObject.userData.clipGroup || pointer.hitObject;
      const canClamp = futon.pose === 'hanging';
      const clamped = balcony.toggleClip(clipGroup, canClamp);
      if (clipGroup.userData.side < 0) futon.leftClamped = clamped;
      else futon.rightClamped = clamped;
      audio.playClipSnap(clamped);
      pointer.didAction = true;
    } else if (pointer.hitKind === 'beater') {
      if (futon.pose === 'folded') {
        // Picking up beater while futon is waiting gently lifts futon onto rail too so she can immediately beat!
        hangFutonOnRail();
      } else if (futon.pose === 'hanging') {
        handAndBeater.setMode('beater');
        audio.playClipSnap(false);
      }
      pointer.didAction = true;
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointer.active || e.pointerId !== pointer.id) return;
    e.preventDefault();
    idleTime = 0;

    const dx = e.clientX - pointer.startX;
    const dy = e.clientY - pointer.startY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;

    if (pointer.didAction) return;

    if (futon.pose === 'folded' && (pointer.hitKind === 'futon' || pointer.hitKind === null)) {
      // Smoothly lift futon upward with one finger!
      const lift = THREE.MathUtils.clamp(-dy / 135, 0, 1.1);
      futon.dragLift = lift;
      futon.dragX = THREE.MathUtils.clamp(dx / 240, -1, 1);

      setNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, pt)) {
        handAndBeater.setLiftPoint(pt);
      }

      if (lift > 0.62) {
        hangFutonOnRail();
        pointer.didAction = true;
      }
    } else if (futon.pose === 'hanging' && pointer.hitKind === 'futon') {
      // Horizontal swipe flips the futon over to beat the back side!
      if (Math.abs(dx) > 105 && Math.abs(dx) > Math.abs(dy) * 1.45) {
        if (futon.flip()) {
          audio.playFabricWhoosh(0.52, 1.08);
          dust.spawnDustBurst(new THREE.Vector3(0, 0.95, -0.56), 0.75, 0.7);
          pointer.didAction = true;
        }
      }
      // Pull downward smoothly brings the sun-warmed futon indoors to puff up!
      else if (dy > 35 && Math.abs(dy) > Math.abs(dx) * 1.25) {
        futon.dragLift = -THREE.MathUtils.clamp((dy - 25) / 115, 0, 1);
        if (dy > 118) {
          bringFutonIndoors();
          pointer.didAction = true;
        }
      }
    } else if (futon.pose === 'indoors' && pointer.hitKind === 'futon') {
      // Dragging upward toward the bright balcony brings futon back out to air again!
      if (dy < -115 && Math.abs(dy) > Math.abs(dx) * 1.35) {
        futon.setPose('folded');
        setTimeout(() => hangFutonOnRail(), 50);
        pointer.didAction = true;
      } else {
        // Gentle rubbing/stroking squishes the fluffy futon continuously!
        const now = performance.now();
        if (now - pointer.lastRubTime > 170) {
          const hit = raycastScene(e.clientX, e.clientY);
          if (hit && hit.type === 'futon') {
            pointer.lastRubTime = now;
            squishIndoorFutonAt(hit.point, hit.uv);
          }
        }
      }
    }
  }, { passive: false });

  function finishPointer(e) {
    if (!pointer.active || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.startX;
    const dy = e.clientY - pointer.startY;
    const dist = Math.hypot(dx, dy);

    if (!pointer.didAction) {
      if (futon.pose === 'folded') {
        // Tap on futon or sunlit rail immediately lifts & drapes futon cleanly (forgiving for 5yo!)
        if (pointer.hitKind === 'futon' || pointer.hitKind === 'rail' || dist < 24) {
          hangFutonOnRail();
        }
      } else if (futon.pose === 'hanging') {
        if (pointer.hitKind === 'futon') {
          // Tap on hanging futon -> crisp PAN! beat right at touched point!
          beatFutonAt(pointer.hitPoint, pointer.hitUV);
        } else if (pointer.hitKind === 'rail') {
          // Tap bare metal handrail -> metallic KANG!
          handAndBeater.triggerBeat(pointer.hitPoint, () => {
            balcony.triggerRailShake();
            audio.playRailClang();
          });
        } else if (pointer.hitYBottomZone(e.clientY) && futon.beatsCount >= 2) {
          // Tapping the warm oak sill / lower foreground after beating invites bringing it in!
          bringFutonIndoors();
        }
      } else if (futon.pose === 'indoors') {
        if (pointer.hitKind === 'futon') {
          squishIndoorFutonAt(pointer.hitPoint, pointer.hitUV);
        } else if (pointer.hitKind === 'rail') {
          // Tapping the sunlit balcony railing visible beyond the window hangs it back out!
          futon.setPose('folded');
          setTimeout(() => hangFutonOnRail(), 50);
        }
      }
    }

    futon.dragLift = 0;
    futon.dragX = 0;
    if (futon.pose === 'folded' && handAndBeater.mode === 'lift') {
      handAndBeater.setMode('rest');
    }
    pointer.active = false;
    pointer.id = null;
  }

  pointer.hitYBottomZone = (clientY) => clientY > window.innerHeight * 0.78;

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
}

// 8. Responsive resize handling
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentPixelRatio);
  renderer.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  if (dust) dust.mat.uniforms.uPixelRatio.value = currentPixelRatio;
  if (futon) computeCameraTarget(futon.pose);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', handleResize);

// 9. Main animation loop + subtle FPS telemetry
let lastTime = performance.now();
let elapsed = 0;
let fpsSamples = [];
let avgFps = 60;

function tick(dt) {
  elapsed += dt;

  // Gentle non-intrusive environmental cue after 9s of idle (wordless.short.md)
  idleTime += dt;
  futon.nudgePulse = idleTime > 9.0 ? 1.0 : 0.0;

  // Update balcony, futon, hand/beater, dust particles
  balcony.update(dt, elapsed);
  futon.update(dt, elapsed, () => {
    // Triggered the moment the sun-warmed futon begins puffing up on the tatami!
    audio.playFluffExpand();
    dust.spawnWarmthPuff(new THREE.Vector3(0, 0.18, BALCONY.indoorCenterZ), 44);
  });

  // Grounding contact shadow fades in smoothly as futon lands on indoor tatami
  balcony.indoorFutonShadow.material.opacity = futon.indoorBlend * (0.46 + futon.displayLoft * 0.14);

  handAndBeater.update(dt, elapsed, camera, futon.pose);
  dust.update(dt, elapsed);

  // Smooth camera transition between Balcony & Indoor Tatami compositions
  computeCameraTarget(futon.pose);
  const camLerp = Math.min(1, dt * 4.2);
  camRig.pos.lerp(camRig.targetPos, camLerp);
  camRig.look.lerp(camRig.targetLook, camLerp);
  camera.fov += (camRig.targetFov - camera.fov) * camLerp;

  // Subtle tactile handheld camera micro-breath + soft beat impact jolt
  if (camRig.shake > 0.001) {
    camRig.shake = Math.max(0, camRig.shake - dt * 6.5);
  }
  const joltY = Math.sin(elapsed * 55) * 0.004 * camRig.shake;
  const microX = Math.sin(elapsed * 0.55) * 0.004;
  const microY = Math.cos(elapsed * 0.72) * 0.003;

  camera.position.set(camRig.pos.x + microX, camRig.pos.y + microY + joltY, camRig.pos.z);
  camera.lookAt(camRig.look);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Track rolling FPS & adapt pixel ratio slightly if ever below 28fps
  if (dt > 0.001) {
    fpsSamples.push(1 / dt);
    if (fpsSamples.length > 45) {
      avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
      fpsSamples.length = 0;
      if (avgFps < 28 && currentPixelRatio > 1.0) {
        currentPixelRatio = Math.max(1.0, currentPixelRatio - 0.15);
        renderer.setPixelRatio(currentPixelRatio);
      }
    }
  }

  tick(dt);
  renderer.render(scene, camera);
}

function exposeDebugHandle() {
  window.__app = {
    getStats: () => ({
      ready,
      pose: futon.pose,
      beatsCount: futon.beatsCount,
      fluffCharge: Number(futon.fluffCharge.toFixed(2)),
      displayLoft: Number(futon.displayLoft.toFixed(2)),
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      pixelRatio: renderer.getPixelRatio(),
      fps: Math.round(avgFps),
      toneMapping: renderer.toneMapping === THREE.AgXToneMapping ? 'AgX' : 'ACESFilmic'
    }),
    step: (seconds = 1.0) => {
      const steps = Math.max(1, Math.round(seconds * 25));
      const dt = seconds / steps;
      for (let i = 0; i < steps; i++) tick(dt);
      renderer.render(scene, camera);
    },
    captureDataUrl: (quality = 0.90) => {
      renderer.render(scene, camera);
      return canvas.toDataURL('image/jpeg', quality);
    },
    hang: () => hangFutonOnRail(),
    beat: (u = 0.5, v = 0.72) => {
      const wp = new THREE.Vector3((u - 0.5) * 0.85, 0.76 + (0.72 - v) * 0.45, -0.43);
      beatFutonAt(wp, new THREE.Vector2(u, v));
    },
    flip: () => futon.flip(),
    bringIn: () => bringFutonIndoors(),
    squish: (u = 0.5, v = 0.5) => {
      squishIndoorFutonAt(new THREE.Vector3((u - 0.5) * 0.6, 0.22, BALCONY.indoorCenterZ + (v - 0.5) * 0.6), new THREE.Vector2(u, v));
    },
    setViewportForTest: (w, h) => {
      const pr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      const land = THREE.MathUtils.clamp((camera.aspect - 0.52) / 0.72, 0, 1);
      if (futon.pose === 'folded') {
        camRig.pos.set(THREE.MathUtils.lerp(0.02, 0.03, land), THREE.MathUtils.lerp(1.26, 1.12, land), THREE.MathUtils.lerp(1.74, 1.06, land));
        camRig.look.set(0.0, THREE.MathUtils.lerp(0.58, 0.58, land), THREE.MathUtils.lerp(-0.36, -0.40, land));
        camera.fov = THREE.MathUtils.lerp(52, 44, land);
      } else if (futon.pose === 'hanging') {
        camRig.pos.set(THREE.MathUtils.lerp(0.02, 0.03, land), THREE.MathUtils.lerp(1.08, 1.02, land), THREE.MathUtils.lerp(1.64, 0.88, land));
        camRig.look.set(0.0, THREE.MathUtils.lerp(0.84, 0.84, land), THREE.MathUtils.lerp(-0.62, -0.62, land));
        camera.fov = THREE.MathUtils.lerp(52, 44, land);
      } else {
        camRig.pos.set(THREE.MathUtils.lerp(0.02, 0.03, land), THREE.MathUtils.lerp(1.66, 1.36, land), THREE.MathUtils.lerp(3.12, 2.54, land));
        camRig.look.set(0.0, THREE.MathUtils.lerp(0.20, 0.22, land), THREE.MathUtils.lerp(1.24, 1.18, land));
        camera.fov = THREE.MathUtils.lerp(52, 43, land);
      }
      camera.position.copy(camRig.pos);
      camera.lookAt(camRig.look);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    toggleToneMapping: () => {
      renderer.toneMapping =
        renderer.toneMapping === THREE.AgXToneMapping
          ? THREE.ACESFilmicToneMapping
          : THREE.AgXToneMapping;
    }
  };
}

init();
