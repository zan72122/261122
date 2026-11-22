import * as THREE from 'three';
import { createSummerEnvironmentMap } from './textures.js';
import { VerandaAudio } from './audio.js';
import { ShoeWashSimulation, STAGES } from './simulation.js';

const container = document.getElementById('app');

// 1. Photorealistic WebGLRenderer tuned for iPhone/iPad 30fps+ (pixel ratio capped at 1.5!)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// 2. Scene with sunlit summer outdoor PMREM environment map
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ac0f8);
scene.environment = createSummerEnvironmentMap(renderer);
scene.fog = new THREE.FogExp2(0xc4e3fc, 0.014);

// 3. Wide-Angle Lens Camera (strong foreground presence + sweeping summer sky behind!)
const camera = new THREE.PerspectiveCamera(
  56,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.04,
  90
);

// 4. Strong Direct Summer Sunlight & Crisp Shadows (shadow map strictly <= 1024px!)
const sunLight = new THREE.DirectionalLight(0xfff1d6, 3.85);
sunLight.position.set(3.2, 4.4, -2.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.8;
sunLight.shadow.camera.far = 12.0;
const d = 1.95;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.015;
scene.add(sunLight);

// Rich summer sky fill (deeper sky contrast so sun shadows read crisp and photographic!)
const hemiLight = new THREE.HemisphereLight(0x78bfff, 0xc8b298, 0.64);
scene.add(hemiLight);

// Subtle warm front concrete bounce light
const bounceLight = new THREE.DirectionalLight(0xffe6c8, 0.42);
bounceLight.position.set(-1.4, 1.2, 2.2);
scene.add(bounceLight);

// 5. Audio & Simulation
const audio = new VerandaAudio();
const sim = new ShoeWashSimulation(scene, camera, audio);

function onResize() {
  const w = window.innerWidth;
  const h = Math.max(1, window.innerHeight);
  const aspect = w / h;
  camera.aspect = aspect;
  // Slightly wider FOV on portrait phones so foreground hands, bucket & shoes stay generously framed
  camera.fov = aspect < 0.85 ? 64 : 54;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  sim.setAspect(aspect);
}
window.addEventListener('resize', onResize);
onResize();

// 6. Single-Finger Pointer Handling (works seamlessly on touch & mouse, zero scroll bounce)
const dom = renderer.domElement;
dom.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { dom.setPointerCapture(e.pointerId); } catch (_) {}
  sim.onPointerDown(e.clientX, e.clientY, e.pointerId, dom.getBoundingClientRect());
});
dom.addEventListener('pointermove', (e) => {
  e.preventDefault();
  sim.onPointerMove(e.clientX, e.clientY, e.pointerId, dom.getBoundingClientRect());
});
const handleUp = (e) => {
  sim.onPointerUp(e.pointerId);
};
dom.addEventListener('pointerup', handleUp);
dom.addEventListener('pointercancel', handleUp);

// Prevent accidental iOS pinch/double-tap zoom
document.addEventListener('gesturestart', (e) => e.preventDefault());

// 7. Render Loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  sim.update(dt);
  renderer.render(scene, camera);
}
animate();

// 8. Inspection & Automated Screenshot Debug Hook (zero UI impact)
window.__shoeWash = {
  STAGES,
  sim,
  renderer,
  scene,
  camera,
  getStats() {
    return {
      stage: sim.stage,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      pixelRatio: renderer.getPixelRatio(),
      foamLevel: sim.foamLevel,
      shoe0: sim.shoes[0].surface.getStats(),
      shoe1: sim.shoes[1].surface.getStats()
    };
  },
  // Helper for rapid visual inspection of each stage during photorealism passes
  demoState(mode) {
    if (mode === 'LATHER_START') {
      sim.setStage(STAGES.LATHER);
      sim.foamLevel = 0.08;
    } else if (mode === 'LATHER_FOAM') {
      sim.setStage(STAGES.LATHER);
      sim.foamLevel = 1.38;
      sim.swirlVelocity = 6.5;
      sim.spawnSplash(new THREE.Vector3(-0.24, 0.42, 0.04), 16, 1.15, 0.6);
      sim.spawnFloatingBubble(new THREE.Vector3(-0.22, 0.55, 0.04));
      sim.spawnFloatingBubble(new THREE.Vector3(-0.08, 0.68, -0.04));
      sim.wetConcreteAt(-0.18, 0.25, 0.09, 0.85);
      sim.wetConcreteAt(0.05, 0.28, 0.07, 0.75);
    } else if (mode === 'SCRUB_MID') {
      sim.setStage(STAGES.SCRUB);
      sim.foamLevel = 1.15;
      sim.shoes[0].surface.scrubAt(0.55, 0.52, 0.35, 0.75, 0.85);
      sim.shoes[0].surface.updateTexture();
      sim.shoes[0].puffAnchors.forEach((p, i) => (p.level = i % 2 === 0 ? 0.85 : 0.35));
      sim.shoes[0].updateShoeFoam(0);
      sim.shoes[0].setWetAppearance(0.65);
      sim.dragTarget = 'shoe';
      sim.scrubEnergy = 1.0;
      sim.spawnSplash(new THREE.Vector3(0.02, 0.50, 0.22), 18, 1.25, 0.6);
      sim.spawnFloatingBubble(new THREE.Vector3(0.18, 0.68, 0.12));
    } else if (mode === 'RINSE_ACTION') {
      sim.setStage(STAGES.RINSE);
      sim.rinseOffset.set(0.02, 0.0);
      sim.shoes[0].surface.scrubAt(0.5, 0.5, 1.2, 1.0, 0.4);
      sim.shoes[0].surface.rinseAt(0.35, 0.5, 0.5, 0.7);
      sim.shoes[0].surface.updateTexture();
      sim.shoes[0].setWetAppearance(0.95);
      sim.rainbowOpacity = 0.85;
      sim.spawnSplash(new THREE.Vector3(-0.30, 0.45, -0.02), 24, 1.35, 0.25);
    } else if (mode === 'DRY_SUN') {
      sim.setStage(STAGES.DRY);
      for (const s of sim.shoes) {
        s.surface.scrubAt(0.5, 0.5, 1.5, 1.0, 0.0);
        s.surface.rinseAt(0.5, 0.5, 1.5, 2.0);
        s.surface.dryStep(1.5);
        s.surface.updateTexture();
        s.puffAnchors.forEach((p) => (p.level = 0));
        s.updateShoeFoam(0);
        s.setWetAppearance(0.05);
      }
      sim._snapShoeToHanger(0);
      sim._snapShoeToHanger(1);
      sim.dryProgress = 0.92;
      sim.spawnFloatingBubble(new THREE.Vector3(-0.28, 1.15, -0.35));
      sim.spawnFloatingBubble(new THREE.Vector3(0.42, 1.22, -0.42));
      sim.spawnGlint(new THREE.Vector3(-0.14, 1.20, -0.52));
      sim.spawnGlint(new THREE.Vector3(0.24, 1.18, -0.52));
    }
    // Snap camera immediately for crisp screenshots
    sim._updateCameraTargets();
    sim.camPosCurrent.copy(sim.camPosTarget);
    sim.camLookCurrent.copy(sim.camLookTarget);
    for (let i = 0; i < 12; i++) sim.update(0.016);
    renderer.render(scene, camera);
  }
};

// Optional URL hash/query demo state for deterministic screenshot verification
const demoParam = new URLSearchParams(window.location.search).get('demo');
if (demoParam) {
  window.__shoeWash.demoState(demoParam);
}
