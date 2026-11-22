import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createNorthWindowEnvironment } from './textures.js';
import { KitchenAudio } from './audio.js';
import { RiceCookSimulation, STAGES } from './simulation.js';

const container = document.getElementById('app');

// 1. Photorealistic Renderer with ACES Filmic Tone Mapping & iPhone/iPad pixelRatio <= 1.5
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // allows crisp screenshot capture
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// 2. Scene & Overcast North-Window Environment
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc5cdd6);
scene.fog = new THREE.FogExp2(0xcad2db, 0.008);

const envMap = createNorthWindowEnvironment(renderer);
scene.environment = envMap;
scene.environmentIntensity = 0.66;

// 3. Soft Overcast North-Window Diffused Lighting Rig
// Primary diffused sky key light coming softly from the left north window (-X, +Y, +Z)
const northWindowKey = new THREE.DirectionalLight(0xedf4ff, 1.55);
northWindowKey.position.set(-7.4, 5.8, 3.2);
northWindowKey.castShadow = true;
northWindowKey.shadow.mapSize.set(1024, 1024);
northWindowKey.shadow.camera.near = 1.0;
northWindowKey.shadow.camera.far = 22.0;
northWindowKey.shadow.camera.left = -7.5;
northWindowKey.shadow.camera.right = 7.5;
northWindowKey.shadow.camera.top = 6.0;
northWindowKey.shadow.camera.bottom = -5.5;
northWindowKey.shadow.bias = -0.0005;
northWindowKey.shadow.normalBias = 0.018;
northWindowKey.shadow.radius = 3.8; // soft overcast shadow penumbra!
scene.add(northWindowKey);

// Balanced cool-sky / warm-wood hemisphere fill (preserves real shadow sculpting & grain micro-contrast)
const hemiLight = new THREE.HemisphereLight(0xd4e2f2, 0x8c765c, 0.48);
scene.add(hemiLight);

// Subtle back-left rim light catching translucent rice edges & billowing white steam
const steamRimLight = new THREE.DirectionalLight(0xeef5ff, 0.56);
steamRimLight.position.set(-4.8, 4.2, -4.6);
scene.add(steamRimLight);

// Very gentle warm kitchen interior bounce from right-front so shadows stay natural and sculptural
const warmBounce = new THREE.DirectionalLight(0xffe9cf, 0.22);
warmBounce.position.set(5.5, 2.4, 4.2);
scene.add(warmBounce);

// 4. Cinematic Camera (36mm photographic lens feel — zero toy-like wide-angle distortion!)
const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.15,
  45
);
camera.position.set(-0.95, 3.15, 3.35);
const currentLook = new THREE.Vector3(-1.12, 0.56, 0.10);
camera.lookAt(currentLook);

// 5. Post-Processing: ACES Filmic + Restrained Subtle Bloom (glints on wet rice, water & backlit steam)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.16, // restrained photographic bloom strength
  0.42, // soft natural radius
  0.92  // high threshold so only bright wet specular glints & window highlights gently bloom
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// 6. Audio & Simulation
const audio = new KitchenAudio();
const sim = new RiceCookSimulation(scene, audio);

// Optional verification query parameter (?stage=...) — never shown visually
const urlParams = new URLSearchParams(window.location.search);
const initialStageParam = urlParams.get('stage');
if (initialStageParam) {
  sim.debugJumpStage(initialStageParam);
}

// Snap camera cleanly to initial opening frame
{
  const initCam = sim.getCameraTarget(camera.aspect);
  camera.position.copy(initCam.pos);
  currentLook.copy(initCam.look);
  camera.lookAt(currentLook);
}

function countSceneTriangles() {
  let tris = 0;
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.visible || !obj.geometry) return;
    const g = obj.geometry;
    const baseTris = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
    tris += obj.isInstancedMesh ? baseTris * obj.count : baseTris;
  });
  return Math.round(tris);
}

// 7. Single-Finger Touch / Mouse Input Controller (Multi-touch safe!)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.68);
const planeHit = new THREE.Vector3();

let activePointerId = null;
let lastScreenX = 0;
let lastScreenY = 0;

function getInteractHit(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(ndc, camera);

  // Intersect horizontal interaction plane at pot/bowl working height
  const planeY =
    sim.stage === STAGES.FLUFF || sim.stage === STAGES.SCOOP ? 1.05
    : sim.stage === STAGES.SERVE ? 0.55
    : 0.68;
  dragPlane.constant = -planeY;
  const hasPlane = raycaster.ray.intersectPlane(dragPlane, planeHit);

  // Find tagged interactive object
  const hits = raycaster.intersectObjects(scene.children, true);
  let interactId = null;
  for (let i = 0; i < hits.length; i++) {
    const id = hits[i].object.userData?.interactId;
    if (id) {
      interactId = id;
      break;
    }
  }

  return { interactId, worldPoint: hasPlane ? planeHit.clone() : null };
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (activePointerId !== null) return; // Strict one-finger safety
  activePointerId = e.pointerId;
  renderer.domElement.setPointerCapture?.(e.pointerId);
  audio.unlock();

  lastScreenX = e.clientX;
  lastScreenY = e.clientY;
  const { interactId, worldPoint } = getInteractHit(e.clientX, e.clientY);
  sim.onPointerDown(interactId, worldPoint);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (activePointerId !== e.pointerId) return;
  const dx = e.clientX - lastScreenX;
  const dy = e.clientY - lastScreenY;
  lastScreenX = e.clientX;
  lastScreenY = e.clientY;
  const { worldPoint } = getInteractHit(e.clientX, e.clientY);
  sim.onPointerMove(worldPoint, dx, dy);
});

function handlePointerEnd(e) {
  if (activePointerId !== e.pointerId) return;
  activePointerId = null;
  sim.onPointerUp();
}
renderer.domElement.addEventListener('pointerup', handlePointerEnd);
renderer.domElement.addEventListener('pointercancel', handlePointerEnd);

// 8. Responsive Resize (iPhone Portrait & iPad Landscape)
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}
window.addEventListener('resize', onResize);

// 9. Main Cinematic Loop
let lastTime = performance.now();
let fpsFrames = 0;
let fpsAccum = 0;
let measuredFps = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    measuredFps = Math.round(fpsFrames / fpsAccum);
    fpsFrames = 0;
    fpsAccum = 0;
  }

  sim.update(dt);

  // Slow cinematic dolly camera motion + gentle organic breathing drift
  const camTarget = sim.getCameraTarget(camera.aspect);
  const dollyDamp = 1 - Math.exp(-dt * 2.15); // slow filmic dolly!
  const breathX = Math.sin(sim.time * 0.42) * 0.045;
  const breathY = Math.cos(sim.time * 0.34) * 0.028;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTarget.pos.x + breathX, dollyDamp);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTarget.pos.y + breathY, dollyDamp);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, camTarget.pos.z, dollyDamp);

  currentLook.lerp(camTarget.look, 1 - Math.exp(-dt * 2.8));
  camera.lookAt(currentLook);

  composer.render();
}

requestAnimationFrame(animate);

// Internal inspection hook for visual quality verification & performance telemetry (zero UI on screen)
window.__RICE_DEBUG__ = {
  STAGES,
  getState: () => ({
    stage: sim.stage,
    turbidity: Number(sim.turbidity.toFixed(3)),
    washProgress: Number(sim.washProgress.toFixed(3)),
    cookProgress: Number(sim.cookProgress.toFixed(3)),
    fluffProgress: Number(sim.fluffProgress.toFixed(3)),
    bowlScoops: sim.bowlScoops,
    triangles: countSceneTriangles(),
    calls: renderer.info.render.calls,
    fps: measuredFps,
    pixelRatio: renderer.getPixelRatio(),
  }),
  jump: (stageName) => {
    sim.debugJumpStage(stageName);
    const camTarget = sim.getCameraTarget(camera.aspect);
    camera.position.copy(camTarget.pos);
    currentLook.copy(camTarget.look);
    camera.lookAt(currentLook);
    sim.update(0.016);
    composer.render();
  },
};
