import * as THREE from '../vendor/three.module.min.js';
import { sound } from './audio.js';
import {
  createPaperOverlayDataUrl,
  createRiceTextures,
  createNoriTexture,
  createWoodTexture,
  createGinghamTexture,
  createWickerTexture,
  createUmeboshiTexture,
  createSalmonTexture,
  createSoftWashTexture,
  createBentoFaceTexture,
  createKitchenBackdropTexture,
  createMeadowBackdropTexture
} from './textures.js';
import { createWatercolorMaterial, addPencilOutline } from './materials.js';
import { Onigiri3D } from './onigiri.js';
import { GirlCharacter, BigShapingHands } from './character.js';
import { createKitchenWorld, createPicnicWorld, createWatercolorFlower } from './props.js';

// ---------------------------------------------------------------------------
// 1. Setup Renderer, Scene, Camera, Warm Picture-Book Lighting
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const paperOverlay = document.getElementById('paper-overlay');
const transitionWash = document.getElementById('transition-wash');

paperOverlay.style.backgroundImage = `url(${createPaperOverlayDataUrl()})`;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xf8efdc, 1);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 60);

// Warm sunlit picture-book lighting (soft shadows, no harsh dark blacks!)
const hemiLight = new THREE.HemisphereLight(0xfffaf0, 0xd9b998, 1.18);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff4de, 1.08);
sunLight.position.set(4.8, 9.2, 6.4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 25;
sunLight.shadow.camera.left = -7.5;
sunLight.shadow.camera.right = 7.5;
sunLight.shadow.camera.top = 7.5;
sunLight.shadow.camera.bottom = -7.5;
sunLight.shadow.bias = -0.0012;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xffeed9, 0.42);
fillLight.position.set(-5.0, 4.0, 5.0);
scene.add(fillLight);

// ---------------------------------------------------------------------------
// 2. Build Shared Procedural Watercolor Assets (all <= 1024px)
// ---------------------------------------------------------------------------
const assets = {
  rice: createRiceTextures(),
  nori: createNoriTexture(),
  woodTable: createWoodTexture('#e3bd8c', '#be8e59', 301),
  woodBoard: createWoodTexture('#eed3a5', '#cb9f6b', 302),
  woodOhitsu: createWoodTexture('#d8a368', '#ae7842', 303),
  gingham: createGinghamTexture('rgba(226, 94, 84, 0.46)', 2),
  ginghamSmall: createGinghamTexture('rgba(226, 94, 84, 0.46)', 1),
  ginghamBlanket: createGinghamTexture('rgba(224, 88, 78, 0.44)', 5),
  wicker: createWickerTexture(),
  umeboshi: createUmeboshiTexture(),
  salmon: createSalmonTexture(),
  ceramicCream: createSoftWashTexture('#faf2e4', 'rgba(232,212,188,0.45)', 'rgba(255,250,240,0.4)', 41),
  ceramicBlue: createSoftWashTexture('#d3e6ee', 'rgba(170,206,222,0.45)', 'rgba(244,250,252,0.4)', 42),
  bambooTex: createSoftWashTexture('#c6d69c', 'rgba(168,192,126,0.42)', 'rgba(228,236,192,0.35)', 43),
  hairTex: createSoftWashTexture('#6b4534', 'rgba(92,58,42,0.45)', 'rgba(128,84,60,0.35)', 44),
  dressTex: createSoftWashTexture('#f6d7b0', 'rgba(242,196,154,0.45)', 'rgba(255,240,218,0.4)', 45),
  grassTex: createSoftWashTexture('#a9cd80', 'rgba(136,178,94,0.48)', 'rgba(198,224,142,0.4)', 46),
  bentoFace: createBentoFaceTexture(),
  kitchenBackdrop: createKitchenBackdropTexture(),
  meadowBackdrop: createMeadowBackdropTexture()
};

// ---------------------------------------------------------------------------
// 3. Build Worlds, Girl Character, Big Hands, Drag Proxies & Particles
// ---------------------------------------------------------------------------
const kitchen = createKitchenWorld(assets);
scene.add(kitchen.group);

const picnic = createPicnicWorld(assets);
scene.add(picnic.group);

// BIG Picture-book Girl (present in both Kitchen & Picnic!)
const girl = new GirlCharacter(assets);
girl.group.position.set(0, 1.56, -1.72);
girl.group.scale.setScalar(1.32);
scene.add(girl.group);

// BIG Expressive Watercolor Foreground Shaping Hands (Kitchen!)
const hands = new BigShapingHands(assets);
hands.group.position.set(0, 0.16, 1.05);
scene.add(hands.group);

// Active Onigiri holder on the center wooden cutting board
const activeOnigiriAnchor = new THREE.Group();
activeOnigiriAnchor.position.set(0, 0.82, 1.05);
scene.add(activeOnigiriAnchor);

// Soft watercolor particle system (steam, sparkles, sesame rain, petals, crumbs)
const particles = [];
const puffGeo = new THREE.SphereGeometry(0.14, 10, 8);
const starGeo = new THREE.OctahedronGeometry(0.11, 0);
const petalGeo = new THREE.SphereGeometry(0.11, 8, 6);
const sesameGeo = new THREE.SphereGeometry(0.036, 6, 5);

function spawnParticle({
  pos,
  vel,
  color = 0xfffdf6,
  scale = 1,
  life = 1.0,
  kind = 'puff',
  gravity = 0,
  spin = 0
}) {
  const geo =
    kind === 'star' ? starGeo : kind === 'petal' ? petalGeo : kind === 'sesame' ? sesameGeo : puffGeo;
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: kind === 'puff' ? 0.52 : 0.92,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.scale.setScalar(scale);
  if (kind === 'petal') mesh.scale.set(scale * 1.3, scale * 0.45, scale * 0.85);
  scene.add(mesh);
  particles.push({
    mesh,
    vel: vel.clone(),
    life,
    maxLife: life,
    kind,
    gravity,
    spin,
    baseScale: scale
  });
}

function spawnSparkleBurst(center, count = 10, colors = [0xffe484, 0xf9b2b2, 0xffffff, 0xbce6c2]) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 1.2 + Math.random() * 1.9;
    spawnParticle({
      pos: center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.25, 0.2)),
      vel: new THREE.Vector3(Math.cos(a) * sp, 1.4 + Math.random() * 1.8, Math.sin(a) * sp * 0.5),
      color: colors[i % colors.length],
      scale: 0.75 + Math.random() * 0.65,
      life: 0.75 + Math.random() * 0.4,
      kind: i % 3 === 0 ? 'petal' : 'star',
      gravity: -2.8,
      spin: (Math.random() - 0.5) * 8
    });
  }
}

function spawnSteam(origin, count = 1, spread = 0.32) {
  for (let i = 0; i < count; i++) {
    spawnParticle({
      pos: origin
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.15, (Math.random() - 0.5) * spread)),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.22, 0.75 + Math.random() * 0.45, (Math.random() - 0.5) * 0.12),
      color: 0xfffcf4,
      scale: 0.7 + Math.random() * 0.7,
      life: 1.35 + Math.random() * 0.5,
      kind: 'puff',
      gravity: 0.12
    });
  }
}

function spawnSesameRain(targetPos) {
  for (let i = 0; i < 18; i++) {
    spawnParticle({
      pos: targetPos
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.55, 1.25 + Math.random() * 0.3, (Math.random() - 0.5) * 0.35)),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.4 - Math.random() * 1.1, (Math.random() - 0.5) * 0.4),
      color: i % 4 === 0 ? 0xffffff : 0x2a231e,
      scale: 0.9 + Math.random() * 0.45,
      life: 0.55 + Math.random() * 0.25,
      kind: 'sesame',
      gravity: -5.5
    });
  }
}

// Dragging Visual Proxies (what floats under the child's finger during 1-finger drag!)
const dragProxyGroup = new THREE.Group();
dragProxyGroup.visible = false;
scene.add(dragProxyGroup);

function buildDragProxies() {
  const map = {};

  // Rice scoop ball
  const riceBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 16, 14),
    createWatercolorMaterial({ map: assets.rice.map, emissive: 0x453525, emissiveIntensity: 0.18 })
  );
  addPencilOutline(riceBall, 1.04, 0x6b5040, 0.6);
  riceBall.visible = false;
  dragProxyGroup.add(riceBall);
  map.ohitsu = riceBall;

  // Big rosy Umeboshi
  const ume = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.36, 2),
    createWatercolorMaterial({ map: assets.umeboshi, emissive: 0x52121a, emissiveIntensity: 0.18 })
  );
  addPencilOutline(ume, 1.06, 0x6b222a, 0.65);
  ume.visible = false;
  dragProxyGroup.add(ume);
  map.ume = ume;

  // Chunky Grilled Salmon
  const salmon = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.3, 0.44),
    createWatercolorMaterial({ map: assets.salmon, emissive: 0x522112, emissiveIntensity: 0.18 })
  );
  addPencilOutline(salmon, 1.06, 0x703926, 0.65);
  salmon.visible = false;
  dragProxyGroup.add(salmon);
  map.salmon = salmon;

  // Crisp Nori Sheet
  const nori = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 1.12),
    createWatercolorMaterial({ map: assets.nori, side: THREE.DoubleSide, emissive: 0x101c14, emissiveIntensity: 0.18 })
  );
  nori.rotation.x = -0.35;
  nori.visible = false;
  dragProxyGroup.add(nori);
  map.nori = nori;

  // Wooden Sesame Shaker (tilted!)
  const shaker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.65, 14),
    createWatercolorMaterial({ map: assets.woodOhitsu, emissive: 0x3a2414, emissiveIntensity: 0.18 })
  );
  shaker.rotation.z = 2.4;
  addPencilOutline(shaker, 1.05, 0x5c3e2a, 0.6);
  shaker.visible = false;
  dragProxyGroup.add(shaker);
  map.sesame = shaker;

  return map;
}
const dragProxies = buildDragProxies();

// Flying tween animations (smooth juicy arcs for scooped rice, fillings, nori, basket drop!)
const activeTweens = [];
function addTween(duration, onUpdate, onDone) {
  activeTweens.push({ t: 0, duration, onUpdate, onDone });
}

// ---------------------------------------------------------------------------
// 4. Game State Machine (Kitchen <-> Picnic)
// ---------------------------------------------------------------------------
const state = {
  mode: 'kitchen', // 'kitchen' | 'transition' | 'picnic'
  activeOnigiri: null,
  squeezeCount: 0, // 0..3 -> 3 squeezes = full plump triangle!
  onigiriBounce: 0,
  onigiriSpinY: 0,
  onigiriSpinZ: 0,
  targetSpinZ: 0,

  basketRecipes: [], // up to 3 handmade onigiri recipes!
  basketMeshes: [],
  picnicItems: [], // { onigiri, recipe, anchor, state: 'whole'|'bitten'|'eaten', basePos }
  picnicCompletedCount: 0,
  picnicAllEaten: false,
  picnicBusy: false,

  // Gentle animations on kitchen props
  shamojiScoopAnim: 0,
  shakerAnim: 0,
  basketBounce: 0,
  basketLidTarget: -1.78, // open wide; 0 = closed
  propWiggles: { ume: 0, salmon: 0, nori: 0, ohitsu: 0, sesame: 0, teacup: 0 },

  // Idle timer (wordless.short.md: 0-10s silent, 10s+ single gentle physical nudge)
  idleTime: 0,
  steamClock: 0,

  // Responsive layout state
  isPortrait: false
};

// ---------------------------------------------------------------------------
// 5. Responsive iPad Landscape & iPhone Portrait Layout Framing
// ---------------------------------------------------------------------------
function updateResponsiveLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  camera.aspect = aspect;

  const isPortrait = aspect < 1.05;
  state.isPortrait = isPortrait;

  if (isPortrait) {
    // Portrait iPhone: full girl + sunlit windows + steaming rice + fillings + hands + nori + basket!
    camera.fov = THREE.MathUtils.clamp(53 - (aspect - 0.45) * 14, 44, 55);
    camera.position.set(0, 5.7, 11.4);
    camera.lookAt(0, 1.35, 0.55);

    kitchen.ohitsuGroup.position.set(-2.08, 0.0, -0.32);
    kitchen.ohitsuGroup.scale.setScalar(0.86);
    kitchen.umeGroup.position.set(-2.15, 0.0, 2.38);
    kitchen.salmonGroup.position.set(-0.98, 0.0, 2.75);
    kitchen.shakerGroup.position.set(1.02, 0.0, 2.72);
    kitchen.noriGroup.position.set(2.12, 0.0, 2.15);
    kitchen.noriGroup.scale.setScalar(0.86);
    kitchen.basket.group.position.set(2.05, 0.0, -0.45);
    kitchen.basket.group.scale.setScalar(0.82);
    kitchen.vaseGroup.position.set(-2.3, 0.0, -2.0);

    kitchen.boardGroup.position.set(0, 0.09, 1.25);
    activeOnigiriAnchor.position.set(0, 0.72, 1.28);
    hands.group.position.set(0, 0.14, 1.25);

    girl.group.position.set(0, 2.02, -1.95);
    girl.group.scale.setScalar(1.26);

    picnic.cupGroup.position.set(1.75, 0.04, 2.45);
    picnic.basket.group.position.set(1.9, 0.04, -0.15);
    picnic.basket.group.scale.setScalar(0.75);
  } else {
    // Landscape iPad (4:3) & Desktop (16:9): full girl + sunlit sky/windows + lush tabletop!
    const narrowFactor = THREE.MathUtils.clamp((aspect - 1.05) / 0.35, 0, 1);
    const xSpread = THREE.MathUtils.lerp(0.88, 1.02, narrowFactor);
    camera.fov = THREE.MathUtils.lerp(42, 39, narrowFactor);
    camera.position.set(0, 4.78, 9.55);
    camera.lookAt(0, 1.48, 0.08);

    kitchen.ohitsuGroup.position.set(-3.32 * xSpread, 0.0, 0.04);
    kitchen.ohitsuGroup.scale.setScalar(1.0);
    kitchen.umeGroup.position.set(-3.26 * xSpread, 0.0, 2.04);
    kitchen.salmonGroup.position.set(-2.08 * xSpread, 0.0, 2.58);
    kitchen.shakerGroup.position.set(2.12 * xSpread, 0.0, 2.52);
    kitchen.noriGroup.position.set(3.3 * xSpread, 0.0, 1.78);
    kitchen.noriGroup.scale.setScalar(0.98);
    kitchen.basket.group.position.set(3.22 * xSpread, 0.0, -0.38);
    kitchen.basket.group.scale.setScalar(0.92);
    kitchen.vaseGroup.position.set(-3.55 * xSpread, 0.0, -2.0);

    kitchen.boardGroup.position.set(0, 0.09, 1.22);
    activeOnigiriAnchor.position.set(0, 0.72, 1.25);
    hands.group.position.set(0, 0.14, 1.22);

    girl.group.position.set(0, 1.48, -2.02);
    girl.group.scale.setScalar(1.22);

    picnic.cupGroup.position.set(2.58 * xSpread, 0.04, 1.92);
    picnic.basket.group.position.set(3.05 * xSpread, 0.04, -0.15);
    picnic.basket.group.scale.setScalar(0.84);
  }

  camera.updateProjectionMatrix();
}
window.addEventListener('resize', updateResponsiveLayout);
updateResponsiveLayout();

// ---------------------------------------------------------------------------
// 6. Core Gameplay Actions (Wordless, Forgiving, Big Clear Reactions!)
// ---------------------------------------------------------------------------
function resetIdle() {
  state.idleTime = 0;
}

function getActiveBoardWorldPos() {
  return activeOnigiriAnchor.position.clone();
}

// Scoop fresh steaming rice from ohitsu onto the cutting board!
function actionScoopRice() {
  if (state.mode !== 'kitchen') return;
  resetIdle();
  state.shamojiScoopAnim = 1.0;
  state.propWiggles.ohitsu = 1.0;

  // Discovery 1: Scooping rice AGAIN when rice is already on the board makes a JUMBO plump onigiri!
  if (state.activeOnigiri) {
    if (state.activeOnigiri.jumboScale < 1.24) {
      state.activeOnigiri.jumboScale = Math.min(1.24, state.activeOnigiri.jumboScale + 0.12);
      state.onigiriBounce = 1.0;
      sound.playRiceScoop(true);
      girl.setExpression('sparkle', 1.6);
      spawnSteam(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.5, 0)), 4, 0.5);
      spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.4, 0)), 6);
    } else {
      sound.playSoftTap(420);
      girl.setExpression('happy', 1.2);
      spawnSteam(kitchen.ohitsuGroup.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 3, 0.4);
    }
    return;
  }

  // Create fresh warm fluffy rice mound!
  sound.playRiceScoop(false);
  const o = new Onigiri3D(assets);
  o.group.scale.setScalar(0.05);
  activeOnigiriAnchor.add(o.group);
  state.activeOnigiri = o;
  state.squeezeCount = 0;
  state.onigiriSpinZ = 0;
  state.targetSpinZ = 0;
  state.onigiriBounce = 1.0;

  // Arc from ohitsu to center board!
  const startPos = kitchen.ohitsuGroup.position.clone().add(new THREE.Vector3(0.2, 1.25, 0.1));
  const endPos = activeOnigiriAnchor.position.clone();
  addTween(
    0.34,
    (u) => {
      const e = 1 - Math.pow(1 - u, 3);
      const arcY = Math.sin(u * Math.PI) * 1.35;
      o.group.position.set(
        THREE.MathUtils.lerp(startPos.x - endPos.x, 0, e),
        THREE.MathUtils.lerp(startPos.y - endPos.y, 0, e) + arcY,
        THREE.MathUtils.lerp(startPos.z - endPos.z, 0, e)
      );
      const s = 0.25 + 0.75 * e;
      o.group.scale.setScalar(s * o.jumboScale);
    },
    () => {
      o.group.position.set(0, 0, 0);
      o.group.scale.setScalar(o.jumboScale);
      state.onigiriBounce = 0.85;
      spawnSteam(endPos.clone().add(new THREE.Vector3(0, 0.45, 0)), 6, 0.55);
      hands.setMode('cradle');
    }
  );

  girl.setExpression('eager', 1.8);
  girl.lookAtNormalized(0, -0.4);
}

// Squeeze / Shape rice with the big foreground hands ("にぎにぎ"!)
function actionSqueezeRice() {
  if (state.mode !== 'kitchen' || !state.activeOnigiri) return;
  resetIdle();

  const o = state.activeOnigiri;
  hands.setMode('squeeze');
  hands.triggerSqueeze();
  state.onigiriBounce = 1.0;

  if (state.squeezeCount < 3) {
    state.squeezeCount += 1;
    const morphSteps = [0, 0.36, 0.7, 1.0];
    o.targetMorph = morphSteps[state.squeezeCount];
    // Classic Japanese 120-degree gentle turn on each squeeze, ending upright on squeeze 3!
    state.targetSpinZ = state.squeezeCount < 3 ? state.squeezeCount * ((Math.PI * 2) / 3) : Math.PI * 2;

    sound.playSqueeze(state.squeezeCount);
    spawnSteam(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.45, 0)), 4, 0.45);

    if (state.squeezeCount === 3) {
      // Celebratory plump triangle completed!
      sound.playShapeDone();
      girl.setExpression('sparkle', 2.2);
      spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.45, 0)), 12);
      setTimeout(() => {
        if (state.mode === 'kitchen' && state.activeOnigiri === o) {
          hands.setMode('proud');
        }
      }, 340);
    } else {
      girl.setExpression('focus', 1.0);
    }
  } else {
    // Already a crisp triangle — extra squeezes give a playful plump bounce & happy giggle!
    sound.playSqueeze(3);
    girl.setExpression('happy', 1.2);
    spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.5, 0)), 5);
  }
}

// Add Umeboshi or Grilled Salmon (tucked inside if unshaped, OR perched as crown on top if already shaped!)
function actionAddFilling(kind) {
  if (state.mode !== 'kitchen') return;
  resetIdle();
  state.propWiggles[kind] = 1.0;

  // If no rice yet, wiggle saucer & girl looks eagerly at the steaming rice tub!
  if (!state.activeOnigiri) {
    sound.playSoftTap(kind === 'ume' ? 620 : 490);
    girl.setExpression(kind === 'ume' ? 'sour' : 'eager', 1.2);
    girl.lookAtNormalized(-0.6, -0.35);
    state.propWiggles.ohitsu = 0.8;
    return;
  }

  const o = state.activeOnigiri;
  const isShaped = state.squeezeCount >= 3;
  const alreadyHasBoth =
    (o.fillings.ume || o.toppings.ume) && (o.fillings.salmon || o.toppings.salmon);

  // Add either inside (unshaped) or on top as a fancy crown (shaped)!
  o.addFilling(kind, isShaped);
  state.onigiriBounce = 0.95;

  const isDeluxe =
    !alreadyHasBoth &&
    (o.fillings.ume || o.toppings.ume) &&
    (o.fillings.salmon || o.toppings.salmon);

  if (isDeluxe) {
    sound.playFillingPlop('deluxe');
    girl.setExpression('sparkle', 2.2);
    spawnSparkleBurst(
      getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.65, 0)),
      14,
      [0xf56c78, 0xf29c68, 0xffe57f, 0xbce6c2]
    );
  } else if (kind === 'ume') {
    sound.playFillingPlop('ume');
    // Adorable sour-happy squint when seeing the rosy umeboshi!
    girl.setExpression('sour', 1.9);
    spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.6, 0)), 8, [0xf56c78, 0xfbc2c6, 0xfff5d6]);
  } else {
    sound.playFillingPlop('salmon');
    girl.setExpression('sparkle', 1.9);
    spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.6, 0)), 8, [0xf49868, 0xffe0b2, 0xfff8e2]);
  }
}

// Shake Gomashio (Black Sesame & Salt) onto the rice!
function actionShakeSesame() {
  if (state.mode !== 'kitchen') return;
  resetIdle();
  state.propWiggles.sesame = 1.0;

  if (!state.activeOnigiri) {
    sound.playSesameShake();
    spawnSesameRain(kitchen.shakerGroup.position.clone().add(new THREE.Vector3(0, 0.2, 0)));
    return;
  }

  state.shakerAnim = 1.0;
  sound.playSesameShake();
  state.activeOnigiri.addSesameBatch();
  state.onigiriBounce = 0.6;
  spawnSesameRain(getActiveBoardWorldPos());
  girl.setExpression('happy', 1.3);
}

// Wrap crisp Nori seaweed (1st sheet = classic wrap, 2nd sheet = adorable bento face!)
function actionWrapNori() {
  if (state.mode !== 'kitchen') return;
  resetIdle();
  state.propWiggles.nori = 1.0;

  if (!state.activeOnigiri) {
    sound.playSoftTap(540);
    girl.lookAtNormalized(-0.6, -0.35);
    state.propWiggles.ohitsu = 0.8;
    return;
  }

  const o = state.activeOnigiri;
  // Forgiving: if child wraps nori before finishing all 3 squeezes, gently finish shaping it cleanly!
  if (state.squeezeCount < 3) {
    state.squeezeCount = 3;
    o.targetMorph = 1.0;
    state.targetSpinZ = Math.PI * 2;
    hands.triggerSqueeze();
  }

  const result = o.wrapNori();
  state.onigiriBounce = 1.0;

  if (result === 'wrap') {
    sound.playNoriWrap(false);
    hands.setMode('nori');
    girl.setExpression('sparkle', 2.0);
    spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.4, 0.2)), 10, [0x7eb87a, 0xffe484, 0xffffff]);
  } else if (result === 'face') {
    // Discovery 4: 2nd nori sheet turns it into a smiling kyaraben bento face onigiri!
    sound.playNoriWrap(true);
    girl.setExpression('cheer', 2.4);
    spawnSparkleBurst(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.55, 0.3)), 16, [0xffa6b4, 0xffe484, 0xffffff, 0xa8e0b8]);
  } else {
    sound.playSoftTap(660);
    girl.setExpression('happy', 1.1);
  }
}

// Put the finished onigiri cozily into the open Picnic Basket!
function actionPlaceInBasket() {
  if (state.mode !== 'kitchen') return;
  resetIdle();

  if (!state.activeOnigiri) {
    // Playful basket wiggle when tapped empty or mid-batch
    state.basketBounce = 1.0;
    sound.playSoftTap(340);
    girl.lookAtNormalized(state.basketRecipes.length > 0 ? 0.55 : -0.6, -0.25);
    return;
  }

  const o = state.activeOnigiri;
  // Forgiving: ensure it finishes triangle shape nicely if child drags straight into basket
  if (state.squeezeCount < 3) {
    state.squeezeCount = 3;
    o.morph = 1.0;
    o.targetMorph = 1.0;
    o.updateGeometry(true);
  }

  const recipe = o.exportRecipe();
  const slotIdx = state.basketRecipes.length;
  if (slotIdx >= 3) return;

  state.basketRecipes.push(recipe);
  state.activeOnigiri = null;
  state.squeezeCount = 0;

  // Detach from active anchor and fly in a joyful arc right into the picnic basket slot!
  const worldStart = new THREE.Vector3();
  o.group.getWorldPosition(worldStart);
  activeOnigiriAnchor.remove(o.group);
  scene.add(o.group);
  o.group.position.copy(worldStart);
  o.group.rotation.set(0, 0, 0);

  const slotLocal = kitchen.basket.slotPositions[slotIdx].clone();
  const worldEnd = slotLocal.clone();
  kitchen.basket.contentsGroup.localToWorld(worldEnd);

  const startScale = o.jumboScale;
  const endScale = 0.56 * o.jumboScale;

  sound.playBasketPlace(slotIdx + 1);
  hands.setMode('rest');
  girl.setExpression('cheer', 2.1);
  girl.lookAtNormalized(0.65, -0.25);

  addTween(
    0.46,
    (u) => {
      const e = 1 - Math.pow(1 - u, 3);
      o.group.position.lerpVectors(worldStart, worldEnd, e);
      o.group.position.y += Math.sin(u * Math.PI) * 1.9;
      o.group.scale.setScalar(THREE.MathUtils.lerp(startScale, endScale, e));
      o.group.rotation.y = THREE.MathUtils.lerp(0, -0.25 + (slotIdx - 1) * 0.2, e);
    },
    () => {
      scene.remove(o.group);
      kitchen.basket.contentsGroup.add(o.group);
      o.group.position.copy(slotLocal).add(new THREE.Vector3(0, 0.42 * o.jumboScale, 0));
      o.group.scale.setScalar(endScale);
      o.group.rotation.set(0.15, (slotIdx - 1) * 0.22, 0);
      kitchen.basket.slotMarkers[slotIdx].visible = false;
      state.basketMeshes.push(o);
      state.basketBounce = 1.0;
      spawnSparkleBurst(worldEnd.clone().add(new THREE.Vector3(0, 0.5, 0)), 12);

      // Basket full (3 onigiri!) -> Close lid joyfully & go to the Sunny Picnic Meadow!
      if (state.basketRecipes.length >= 3) {
        triggerPicnicTransition();
      }
    }
  );
}

// ---------------------------------------------------------------------------
// 7. Transition to Sunny Picnic Meadow & Picnic Tasting Interactions!
// ---------------------------------------------------------------------------
function triggerPicnicTransition() {
  state.mode = 'transition';
  state.basketLidTarget = 0; // Close wicker lid snugly!
  girl.setExpression('cheer', 2.6);
  sound.playPicnicStart();

  // Soft watercolor wash fade to Sunny Meadow!
  setTimeout(() => {
    transitionWash.style.opacity = '1';
  }, 650);

  setTimeout(() => {
    enterPicnicMode();
    transitionWash.style.opacity = '0';
  }, 1150);
}

function enterPicnicMode() {
  state.mode = 'picnic';
  state.picnicAllEaten = false;
  state.picnicBusy = false;
  kitchen.group.visible = false;
  hands.setMode('hidden');
  picnic.group.visible = true;
  picnic.basket.lidPivot.rotation.x = -1.78;

  // Clear previous picnic onigiri
  while (picnic.picnicOnigiriGroup.children.length > 0) {
    picnic.picnicOnigiriGroup.remove(picnic.picnicOnigiriGroup.children[0]);
  }
  state.picnicItems = [];

  // Place the child's 3 EXACT handmade onigiri BIG & inviting on the wooden picnic platter!
  const platterSpots = state.isPortrait
    ? [
        new THREE.Vector3(-1.32, 0.88, 1.56),
        new THREE.Vector3(0.0, 0.92, 1.24),
        new THREE.Vector3(1.32, 0.88, 1.56)
      ]
    : [
        new THREE.Vector3(-1.68, 0.88, 1.62),
        new THREE.Vector3(-0.18, 0.94, 1.28),
        new THREE.Vector3(1.32, 0.88, 1.62)
      ];

  state.basketRecipes.forEach((recipe, idx) => {
    const anchor = new THREE.Group();
    const basePos = platterSpots[idx].clone();
    anchor.position.copy(basePos);
    const onigiri = Onigiri3D.fromRecipe(assets, recipe);
    onigiri.group.scale.setScalar(0.84 * (recipe.jumboScale || 1));

    // Add generous invisible hitbox for tapping/dragging in picnic
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData.interact = `picnic_onigiri_${idx}`;
    anchor.add(onigiri.group, hit);
    picnic.picnicOnigiriGroup.add(anchor);

    state.picnicItems.push({
      idx,
      onigiri,
      recipe,
      anchor,
      basePos,
      eatState: 'whole' // 'whole' -> 'bitten' -> 'eaten'
    });
  });

  girl.setExpression('sparkle', 2.4);
  girl.lookAtNormalized(0, -0.35);
  spawnSparkleBurst(new THREE.Vector3(0, 1.8, 0.8), 16);
}

// Feed / Bite a handmade onigiri at the picnic (reveals exact hidden filling!)
function actionEatPicnicOnigiri(idx) {
  if (state.mode !== 'picnic' || state.picnicBusy) return;
  const item = state.picnicItems[idx];
  if (!item || item.eatState === 'eaten') return;

  resetIdle();
  state.picnicBusy = true;

  const hasUme = item.recipe.fillings.ume || item.recipe.toppings.ume;
  const hasSalmon = item.recipe.fillings.salmon || item.recipe.toppings.salmon;

  let reaction = 'happy';
  let expr = 'munch';
  let burstCols = [0xffe584, 0xfff8e4, 0xf8c0c8];
  if (hasUme && hasSalmon) {
    reaction = 'rainbow';
    expr = 'sparkle';
    burstCols = [0xf56c78, 0xf49868, 0xffe57f, 0x9bd69e, 0x9cd2ec];
  } else if (hasUme) {
    reaction = 'sour';
    expr = 'sour';
    burstCols = [0xf56c78, 0xf8a6b0, 0xfff2c2];
  } else if (hasSalmon) {
    reaction = 'bliss';
    expr = 'bliss';
    burstCols = [0xf49868, 0xffd29d, 0xfff8dc];
  }

  const startPos = item.anchor.position.clone();
  const mouthPos = new THREE.Vector3(0, girl.group.position.y + 0.55, 0.15);

  if (item.eatState === 'whole') {
    // 1st Bite: Lift up to mouth -> CRUNCH! Reveal hidden filling inside! -> Hold proudly for child to see!
    girl.setExpression('eager', 0.6);
    addTween(
      0.32,
      (u) => {
        const e = 1 - Math.pow(1 - u, 3);
        item.anchor.position.lerpVectors(startPos, mouthPos, e);
        item.anchor.position.y += Math.sin(u * Math.PI) * 0.65;
      },
      () => {
        item.eatState = 'bitten';
        item.onigiri.applyBite();
        sound.playBite(reaction);
        girl.setExpression('munch', 0.85);
        spawnSparkleBurst(mouthPos.clone().add(new THREE.Vector3(0, 0.1, 0.4)), 14, burstCols);

        // Settle back slightly higher & closer so the child clearly sees the bitten filling reveal!
        const revealPos = item.basePos.clone().add(new THREE.Vector3(0, 0.14, 0.25));
        addTween(
          0.32,
          (u) => {
            const e = 1 - Math.pow(1 - u, 3);
            item.anchor.position.lerpVectors(mouthPos, revealPos, e);
          },
          () => {
            girl.setExpression(expr, 2.2);
            if (reaction === 'rainbow') girl.cheerTimer = 1.4;
            state.picnicBusy = false;
          }
        );
      }
    );
  } else if (item.eatState === 'bitten') {
    // 2nd Bite: Finish the rest happily!
    girl.setExpression('eager', 0.5);
    addTween(
      0.3,
      (u) => {
        const e = 1 - Math.pow(1 - u, 3);
        item.anchor.position.lerpVectors(startPos, mouthPos, e);
        item.anchor.scale.setScalar(1 - e * 0.72);
      },
      () => {
        item.eatState = 'eaten';
        item.anchor.visible = false;
        sound.playBite(reaction === 'sour' ? 'happy' : reaction);
        girl.setExpression('bliss', 1.8);
        spawnSparkleBurst(mouthPos.clone().add(new THREE.Vector3(0, 0.2, 0.4)), 12, burstCols);
        state.picnicBusy = false;

        // Check if all 3 handmade onigiri are happily eaten!
        const allDone = state.picnicItems.every((it) => it.eatState === 'eaten');
        if (allDone) {
          state.picnicAllEaten = true;
          state.picnicCompletedCount += 1;
          setTimeout(() => {
            if (state.mode === 'picnic') {
              girl.setExpression('cheer', 3.5);
              girl.cheerTimer = 2.6;
              sound.playPicnicStart();
              spawnSparkleBurst(new THREE.Vector3(0, 2.5, 0.5), 24, [0xffe57f, 0xf8a6b0, 0xfffdf2, 0xb8e0a8]);
            }
          }, 420);
        }
      }
    );
  }
}

// Sip warm green tea at the picnic!
function actionSipTea() {
  if (state.mode !== 'picnic' || state.picnicBusy) return;
  resetIdle();
  state.picnicBusy = true;
  state.propWiggles.teacup = 1.0;
  sound.playTeaSip();
  girl.triggerSip();

  const orig = picnic.cupGroup.position.clone();
  const mouth = new THREE.Vector3(0.15, girl.group.position.y + 0.45, 0.35);

  addTween(
    0.45,
    (u) => {
      const e = 1 - Math.pow(1 - u, 3);
      picnic.cupGroup.position.lerpVectors(orig, mouth, e);
      picnic.cupGroup.rotation.x = -0.45 * e;
    },
    () => {
      spawnSteam(mouth.clone().add(new THREE.Vector3(0, 0.3, 0.1)), 5, 0.3);
      setTimeout(() => {
        addTween(
          0.42,
          (u) => {
            const e = 1 - Math.pow(1 - u, 3);
            picnic.cupGroup.position.lerpVectors(mouth, orig, e);
            picnic.cupGroup.rotation.x = -0.45 * (1 - e);
          },
          () => {
            picnic.cupGroup.position.copy(orig);
            picnic.cupGroup.rotation.x = 0;
            state.picnicBusy = false;
          }
        );
      }, 420);
    }
  );
}

// Return to sunny kitchen for a fresh batch + add souvenir flower to windowsill vase!
function returnToKitchen() {
  if (state.mode !== 'picnic') return;
  state.mode = 'transition';
  sound.playBasketPlace(3);
  transitionWash.style.opacity = '1';

  setTimeout(() => {
    // Clear basket meshes & recipes
    for (const m of state.basketMeshes) {
      kitchen.basket.contentsGroup.remove(m.group);
      m.dispose();
    }
    state.basketMeshes = [];
    state.basketRecipes = [];
    for (const marker of kitchen.basket.slotMarkers) {
      marker.visible = true;
    }
    state.basketLidTarget = -1.78;
    kitchen.basket.lidPivot.rotation.x = -1.78;

    // Add persistent souvenir wildflower to the kitchen windowsill vase! (up to 5 flowers)
    if (kitchen.flowerContainer.children.length < 5) {
      const palette = [0xfce068, 0xf8b2c0, 0xfff8e6, 0xb8d9f2, 0xf6c478];
      const idx = kitchen.flowerContainer.children.length;
      const fl = createWatercolorFlower(palette[idx % palette.length]);
      fl.position.set((idx - 2) * 0.12, 0, (idx % 2 === 0 ? 1 : -1) * 0.08);
      fl.rotation.z = (idx - 2) * 0.18;
      fl.scale.setScalar(0.85);
      kitchen.flowerContainer.add(fl);
    }

    picnic.group.visible = false;
    kitchen.group.visible = true;
    hands.setMode('rest');
    state.mode = 'kitchen';
    girl.setExpression('happy', 1.5);
    girl.lookAtNormalized(-0.4, -0.3);
    transitionWash.style.opacity = '0';
  }, 520);
}

// ---------------------------------------------------------------------------
// 8. Forgiving One-Finger Pointer Controls (Tap + Drag + Rub, Multi-touch safe)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.15);
const planeHit = new THREE.Vector3();

const input = {
  pointerId: null,
  downX: 0,
  downY: 0,
  lastX: 0,
  lastY: 0,
  movedDist: 0,
  rubAccum: 0,
  draggingKind: null, // 'ohitsu' | 'ume' | 'salmon' | 'sesame' | 'nori' | 'active_onigiri' | 'picnic_onigiri_X'
  pressedKind: null
};

function updateNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function raycastInteract(clientX, clientY) {
  updateNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);

  // Check active onigiri first when in kitchen
  if (state.mode === 'kitchen' && state.activeOnigiri) {
    const hits = raycaster.intersectObject(activeOnigiriAnchor, true);
    if (hits.length > 0) return 'active_onigiri';
  }

  const targets = state.mode === 'kitchen' ? [kitchen.group, girl.group] : [picnic.group, girl.group];
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    let cur = h.object;
    while (cur) {
      if (cur.userData && cur.userData.interact) {
        return cur.userData.interact;
      }
      cur = cur.parent;
    }
  }
  return null;
}

function setDragProxy(kind, clientX, clientY) {
  for (const k of Object.keys(dragProxies)) {
    dragProxies[k].visible = k === kind;
  }
  if (!kind || !dragProxies[kind]) {
    dragProxyGroup.visible = false;
    return;
  }
  dragProxyGroup.visible = true;
  updateNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);
  if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
    dragProxyGroup.position.set(planeHit.x, 1.35, planeHit.z);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  // One-finger rule: ignore extra simultaneous fingers cleanly
  if (input.pointerId !== null) return;
  input.pointerId = e.pointerId;
  input.downX = e.clientX;
  input.downY = e.clientY;
  input.lastX = e.clientX;
  input.lastY = e.clientY;
  input.movedDist = 0;
  input.rubAccum = 0;
  input.draggingKind = null;

  resetIdle();
  updateNDC(e.clientX, e.clientY);
  girl.lookAtNormalized(pointerNDC.x * 0.85, pointerNDC.y * 0.65);

  const hit = raycastInteract(e.clientX, e.clientY);
  input.pressedKind = hit;

  if (state.mode === 'kitchen') {
    if (hit === 'girl') {
      sound.playGiggle();
      girl.triggerWave();
      spawnSparkleBurst(girl.group.position.clone().add(new THREE.Vector3(0, 1.4, 0.8)), 7);
    } else if (hit === 'ohitsu' || hit === 'ume' || hit === 'salmon' || hit === 'sesame' || hit === 'nori') {
      sound.playSoftTap(520);
      state.propWiggles[hit] = 0.8;
    } else if (hit === 'active_onigiri' || hit === 'board') {
      if (state.activeOnigiri && state.squeezeCount < 3) {
        // Immediate tactile squeeze on touch!
        actionSqueezeRice();
      }
    }
  } else if (state.mode === 'picnic') {
    if (hit === 'girl') {
      sound.playGiggle();
      girl.triggerWave();
      spawnSparkleBurst(girl.group.position.clone().add(new THREE.Vector3(0, 1.4, 0.8)), 7);
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (input.pointerId !== e.pointerId) return;
  e.preventDefault();
  const dx = e.clientX - input.lastX;
  const dy = e.clientY - input.lastY;
  const stepDist = Math.hypot(dx, dy);
  input.movedDist += stepDist;
  input.lastX = e.clientX;
  input.lastY = e.clientY;

  updateNDC(e.clientX, e.clientY);
  girl.lookAtNormalized(pointerNDC.x * 0.85, pointerNDC.y * 0.65);

  if (state.mode === 'kitchen') {
    // Rubbing across unshaped rice also squeezes it ("nigi-nigi!")
    if (
      (input.pressedKind === 'active_onigiri' || input.pressedKind === 'board') &&
      state.activeOnigiri &&
      state.squeezeCount < 3
    ) {
      input.rubAccum += stepDist;
      if (input.rubAccum > 78) {
        input.rubAccum = 0;
        actionSqueezeRice();
      }
      return;
    }

    // Start dragging draggable ingredients or finished onigiri once moved > 16px
    if (input.movedDist > 16) {
      if (
        input.pressedKind === 'ohitsu' ||
        input.pressedKind === 'ume' ||
        input.pressedKind === 'salmon' ||
        input.pressedKind === 'sesame' ||
        input.pressedKind === 'nori'
      ) {
        input.draggingKind = input.pressedKind;
        setDragProxy(input.draggingKind, e.clientX, e.clientY);
      } else if (input.pressedKind === 'active_onigiri' && state.activeOnigiri && state.squeezeCount >= 3) {
        input.draggingKind = 'active_onigiri';
        raycaster.setFromCamera(pointerNDC, camera);
        if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
          activeOnigiriAnchor.position.lerp(new THREE.Vector3(planeHit.x, 1.35, planeHit.z), 0.45);
        }
      }
    }
  }
});

function finishPointer(e) {
  if (input.pointerId !== e.pointerId) return;
  e.preventDefault();

  const wasTap = input.movedDist < 22;
  const pressed = input.pressedKind;
  const dragged = input.draggingKind;

  setDragProxy(null, 0, 0);
  input.pointerId = null;
  input.pressedKind = null;
  input.draggingKind = null;

  if (state.mode === 'kitchen') {
    // 1. Handle finished drag drop
    if (dragged === 'ohitsu') {
      actionScoopRice();
      return;
    }
    if (dragged === 'ume' || dragged === 'salmon') {
      actionAddFilling(dragged);
      return;
    }
    if (dragged === 'sesame') {
      actionShakeSesame();
      return;
    }
    if (dragged === 'nori') {
      actionWrapNori();
      return;
    }
    if (dragged === 'active_onigiri') {
      // Check if dragged near the picnic basket (generous magnetic snap on right side!)
      const distToBasket = activeOnigiriAnchor.position.distanceTo(
        kitchen.basket.group.position.clone().add(new THREE.Vector3(0, 1.0, 0))
      );
      if (distToBasket < 2.6 || pointerNDC.x > 0.28) {
        actionPlaceInBasket();
      } else {
        // Snap gently back to wooden board
        const target = kitchen.boardGroup.position.clone().add(new THREE.Vector3(0, 0.75, 0));
        activeOnigiriAnchor.position.copy(target);
      }
      return;
    }

    // 2. Handle forgiving one-tap actions!
    if (wasTap && pressed) {
      if (pressed === 'ohitsu') actionScoopRice();
      else if (pressed === 'ume') actionAddFilling('ume');
      else if (pressed === 'salmon') actionAddFilling('salmon');
      else if (pressed === 'sesame') actionShakeSesame();
      else if (pressed === 'nori') actionWrapNori();
      else if (pressed === 'basket') actionPlaceInBasket();
      else if (pressed === 'active_onigiri' && state.activeOnigiri && state.squeezeCount >= 3) {
        // Tapping finished onigiri gives a happy bounce (and if already has nori, gently wiggles basket!)
        state.onigiriBounce = 0.85;
        sound.playSqueeze(3);
        if (state.activeOnigiri.hasNori) state.basketBounce = 0.7;
      }
    }
  } else if (state.mode === 'picnic') {
    const dropHit = raycastInteract(e.clientX, e.clientY);
    const chosen = pressed || dropHit;
    if (chosen && chosen.startsWith('picnic_onigiri_')) {
      const idx = parseInt(chosen.replace('picnic_onigiri_', ''), 10);
      actionEatPicnicOnigiri(idx);
    } else if (chosen === 'teacup') {
      actionSipTea();
    } else if (chosen === 'picnic_basket') {
      if (state.picnicAllEaten) {
        returnToKitchen();
      } else {
        // Playful hop & look at remaining onigiri!
        state.basketBounce = 1.0;
        sound.playSoftTap(380);
      }
    }
  }
}

canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);

// ---------------------------------------------------------------------------
// 9. Main Animation Loop (30–60fps smooth, gentle living world!)
// ---------------------------------------------------------------------------
let lastTime = performance.now();
let elapsed = 0;

function stepSimulation(dt) {
  elapsed += dt;

  // 1. Update tweens
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const tw = activeTweens[i];
    tw.t += dt;
    const u = Math.min(1, tw.t / tw.duration);
    tw.onUpdate(u);
    if (u >= 1) {
      activeTweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }

  // 2. Living Girl & Foreground Big Hands
  girl.tick(dt);
  hands.tick(dt);

  // 3. Kitchen World Animations & Subtle Single-Focus Affordances
  if (state.mode === 'kitchen' || state.mode === 'transition') {
    // Continuous warm steam rising from the freshly cooked ohitsu rice tub!
    state.steamClock += dt;
    if (state.steamClock > 0.34) {
      state.steamClock = 0;
      const steamRate = state.activeOnigiri ? 1 : 2;
      spawnSteam(kitchen.ohitsuGroup.position.clone().add(new THREE.Vector3(0, 1.25, 0)), steamRate, 0.65);
      if (state.activeOnigiri && state.squeezeCount < 3) {
        spawnSteam(getActiveBoardWorldPos().add(new THREE.Vector3(0, 0.45, 0)), 1, 0.35);
      }
    }

    // Current-stage gentle living invitation (never arrows/boxes!)
    const waitingForRice = !state.activeOnigiri;
    const waitingForSqueeze = !!state.activeOnigiri && state.squeezeCount < 3;
    const waitingForNori = !!state.activeOnigiri && state.squeezeCount >= 3 && !state.activeOnigiri.hasNori;
    const waitingForBasket = !!state.activeOnigiri && state.squeezeCount >= 3 && state.activeOnigiri.hasNori;

    // Shamoji gently bobs invitingly when no rice on board, or dips dramatically on scoop
    state.shamojiScoopAnim = Math.max(0, state.shamojiScoopAnim - dt * 2.6);
    const scoopDip = Math.sin(state.shamojiScoopAnim * Math.PI) * 0.75;
    const shamojiInvite = waitingForRice ? Math.sin(elapsed * 3.4) * 0.14 : 0;
    kitchen.shamojiPivot.rotation.z = -0.45 - scoopDip + shamojiInvite;
    kitchen.shamojiPivot.position.y = 1.24 + scoopDip * 0.45 + Math.abs(shamojiInvite) * 0.25;

    // Top crisp nori sheet subtly lifts its corner in the breeze when onigiri is shaped!
    const noriBreeze = waitingForNori ? Math.sin(elapsed * 3.8) * 0.08 + 0.07 : 0;
    kitchen.noriTopSheet.position.y = 0.265 + noriBreeze;
    kitchen.noriTopSheet.rotation.x = -Math.PI / 2 - noriBreeze * 1.1;

    // Shaker hop-and-shake animation!
    if (state.shakerAnim > 0) {
      state.shakerAnim = Math.max(0, state.shakerAnim - dt * 2.1);
      const sArc = Math.sin(state.shakerAnim * Math.PI);
      const boardPos = kitchen.boardGroup.position;
      const baseShakerX = state.isPortrait ? 1.02 : 2.12;
      const baseShakerZ = state.isPortrait ? 2.68 : 2.52;
      kitchen.shakerGroup.position.set(
        THREE.MathUtils.lerp(baseShakerX, boardPos.x + 0.35, sArc),
        sArc * 2.15 + Math.sin(elapsed * 42) * 0.12 * sArc,
        THREE.MathUtils.lerp(baseShakerZ, boardPos.z, sArc)
      );
      kitchen.shakerGroup.rotation.z = sArc * 2.35;
    } else {
      kitchen.shakerGroup.position.y = 0;
      kitchen.shakerGroup.rotation.z = 0;
    }

    // Basket lid & inviting gentle bounce
    state.basketBounce = Math.max(0, state.basketBounce - dt * 2.8);
    const bInvite = waitingForBasket ? Math.sin(elapsed * 3.6) * 0.055 : 0;
    const bPop = Math.sin(state.basketBounce * Math.PI * 2) * state.basketBounce * 0.14;
    kitchen.basket.group.position.y = Math.max(0, bPop + bInvite);
    kitchen.basket.lidPivot.rotation.x = THREE.MathUtils.lerp(
      kitchen.basket.lidPivot.rotation.x,
      state.basketLidTarget + (waitingForBasket ? Math.sin(elapsed * 3.6) * 0.1 : 0),
      Math.min(1, dt * 8)
    );

    // Gentle prop wiggles on poke
    for (const [k, obj] of [
      ['ohitsu', kitchen.ohitsuGroup],
      ['ume', kitchen.umeGroup],
      ['salmon', kitchen.salmonGroup],
      ['nori', kitchen.noriGroup]
    ]) {
      if (state.propWiggles[k] > 0) {
        state.propWiggles[k] = Math.max(0, state.propWiggles[k] - dt * 3.2);
        const w = Math.sin(state.propWiggles[k] * Math.PI * 3) * state.propWiggles[k] * 0.12;
        obj.rotation.z = w;
      } else {
        obj.rotation.z = 0;
      }
    }

    // Active Onigiri spring squash-and-stretch + 120° shaping rotation!
    if (state.activeOnigiri) {
      state.activeOnigiri.tick(dt);
      state.onigiriBounce = Math.max(0, state.onigiriBounce - dt * 3.4);
      const sq = Math.sin(state.onigiriBounce * Math.PI * 2) * state.onigiriBounce * 0.18;
      const baseS = state.activeOnigiri.jumboScale;
      state.activeOnigiri.group.scale.set(baseS * (1 + sq), baseS * (1 - sq * 0.85), baseS * (1 + sq * 0.5));

      state.onigiriSpinZ = THREE.MathUtils.lerp(state.onigiriSpinZ, state.targetSpinZ, Math.min(1, dt * 9));
      state.activeOnigiri.group.rotation.z = state.onigiriSpinZ;
    }

    // Idle gentle environmental cue ONLY after 10 seconds of complete inactivity
    if (state.mode === 'kitchen') {
      state.idleTime += dt;
      if (state.idleTime > 10.0) {
        state.idleTime = 0;
        if (waitingForRice) {
          state.shamojiScoopAnim = 0.65;
          spawnSteam(kitchen.ohitsuGroup.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 3, 0.5);
        } else if (waitingForSqueeze) {
          hands.triggerIdlePat();
        } else if (waitingForNori) {
          state.propWiggles.nori = 0.7;
        } else if (waitingForBasket) {
          state.basketBounce = 0.75;
        }
      }
    }
  } else if (state.mode === 'picnic') {
    // Gentle breeze swaying meadow wildflowers!
    for (const fl of picnic.flowers) {
      fl.rotation.z = Math.sin(elapsed * 2.1 + fl.userData.phase) * 0.12;
    }
    // Warm steam rising from the green tea teacup
    state.steamClock += dt;
    if (state.steamClock > 0.45) {
      state.steamClock = 0;
      spawnSteam(picnic.cupGroup.position.clone().add(new THREE.Vector3(0, 0.72, 0)), 1, 0.18);
    }
    // Gentle inviting bob on uneaten picnic onigiri
    for (const item of state.picnicItems) {
      if (item.eatState !== 'eaten' && !state.picnicBusy) {
        item.onigiri.group.rotation.y = Math.sin(elapsed * 1.8 + item.idx) * 0.12;
      }
    }
    // When all 3 onigiri are happily eaten, open picnic basket bounces joyfully to invite next round!
    if (state.picnicAllEaten) {
      picnic.basket.group.position.y = 0.04 + Math.abs(Math.sin(elapsed * 3.8)) * 0.22;
      picnic.basket.lidPivot.rotation.x = -1.78 + Math.sin(elapsed * 3.8) * 0.18;
    } else {
      state.basketBounce = Math.max(0, state.basketBounce - dt * 3);
      picnic.basket.group.position.y = 0.04 + Math.sin(state.basketBounce * Math.PI * 2) * state.basketBounce * 0.15;
    }
  }

  // 4. Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    const u = 1 - p.life / p.maxLife;
    p.vel.y += p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.spin) {
      p.mesh.rotation.z += p.spin * dt;
      p.mesh.rotation.x += p.spin * 0.6 * dt;
    }
    if (p.kind === 'puff') {
      p.mesh.scale.setScalar(p.baseScale * (0.7 + u * 1.25));
      p.mesh.material.opacity = 0.5 * (1 - u);
    } else {
      p.mesh.material.opacity = Math.min(1, (1 - u) * 1.6);
    }
  }

  renderer.render(scene, camera);
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  stepSimulation(dt);
}

requestAnimationFrame(tick);

// Clean inspection hook for automated visual & performance verification (no UI exposed)
window.__game = {
  state,
  renderer,
  scene,
  camera,
  step(seconds = 1.0) {
    const steps = Math.max(1, Math.ceil(seconds / 0.016));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) stepSimulation(dt);
  },
  setLayoutForAspect(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  },
  actions: {
    scoopRice: actionScoopRice,
    squeezeRice: actionSqueezeRice,
    addFilling: actionAddFilling,
    shakeSesame: actionShakeSesame,
    wrapNori: actionWrapNori,
    placeInBasket: actionPlaceInBasket,
    eatPicnic: actionEatPicnicOnigiri,
    sipTea: actionSipTea,
    returnToKitchen
  },
  getStats() {
    return {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      pixelRatio: renderer.getPixelRatio(),
      mode: state.mode,
      hasActiveOnigiri: !!state.activeOnigiri,
      squeezeCount: state.squeezeCount,
      basketCount: state.basketRecipes.length
    };
  }
};
