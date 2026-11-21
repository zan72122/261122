import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { sound } from './sound.js';
import { renderCardSlot, updatePosScreen } from './textures.js';
import {
  createFoodMesh,
  createShoppingCart,
  createPlayerHand,
  buildSupermarketWorld,
  matHitZone,
} from './models.js';

// ============================================================
// PHOTOREALISTIC 3D SUPERMARKET GAME FOR 5-YEAR-OLDS
// Zero text • One-finger touch • Big hands, big character, big food
// ============================================================

const ROUNDS = [
  ['carrot', 'milk', 'croissant'],
  ['tomato', 'strawberry_milk', 'melonpan'],
  ['broccoli', 'milk', 'baguette'],
  ['corn', 'orange_juice', 'croissant'],
];

const CATEGORY_MAP = {
  tomato: 'veg',
  carrot: 'veg',
  broccoli: 'veg',
  corn: 'veg',
  milk: 'dairy',
  strawberry_milk: 'dairy',
  orange_juice: 'dairy',
  croissant: 'bread',
  melonpan: 'bread',
  baguette: 'bread',
};

// Tuned so Red Cart Handlebar + Wire Basket + Big Food + Cashier + Eco-Bag all frame cleanly!
const STATIONS = {
  intro:    { cartX: 0.0,  cartZ: 1.40,  camDx: 0, camDy: 1.56, camDz: 1.48, lookX: 0.0,  lookY: 0.96, lookZ: -1.45 },
  produce:  { cartX: 0.0,  cartZ: -0.15, camDx: 0, camDy: 1.54, camDz: 1.42, lookX: 0.0,  lookY: 0.95, lookZ: -1.55 },
  dairy:    { cartX: 4.8,  cartZ: -0.15, camDx: 0, camDy: 1.54, camDz: 1.42, lookX: 4.8,  lookY: 1.04, lookZ: -1.55 },
  bakery:   { cartX: 9.6,  cartZ: -0.15, camDx: 0, camDy: 1.54, camDz: 1.42, lookX: 9.6,  lookY: 1.02, lookZ: -1.55 },
  checkout: { cartX: 14.8, cartZ: 0.16,  camDx: 0, camDy: 1.56, camDz: 1.24, lookX: 14.8, lookY: 1.22, lookZ: -1.42 },
};

const canvas = document.getElementById('stage');
const listCard = document.getElementById('list-card');
const slotEls = [
  document.getElementById('slot-0'),
  document.getElementById('slot-1'),
  document.getElementById('slot-2'),
];
const soundBtn = document.getElementById('sound-btn');
const soundOnIcon = document.getElementById('sound-on-icon');
const soundOffIcon = document.getElementById('sound-off-icon');

soundBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const muted = sound.toggleMute();
  soundOnIcon.style.display = muted ? 'none' : 'block';
  soundOffIcon.style.display = muted ? 'block' : 'none';
});

// ============================================================
// RENDERER, SCENE, PHOTOREALISTIC LIGHTING (Pixel ratio <= 1.5)
// ============================================================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0d8cc);
scene.fog = new THREE.Fog(0xe0d8cc, 16, 38);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.58;

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.08, 42);

// Rich natural supermarket contrast lighting + focused crisp shadows!
const hemiLight = new THREE.HemisphereLight(0xfff9ee, 0x8f7e6a, 0.56);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff8ec, 1.65);
sunLight.position.set(2.5, 6.2, 3.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1.0;
sunLight.shadow.camera.far = 18;
sunLight.shadow.camera.left = -3.4;
sunLight.shadow.camera.right = 3.4;
sunLight.shadow.camera.top = 3.4;
sunLight.shadow.camera.bottom = -3.4;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);
scene.add(sunLight.target);

const env = buildSupermarketWorld(scene);
const cart = createShoppingCart();
scene.add(cart.root);

// Big expressive realistic 3D hands (Right hand reaches/grabs, both hands grip handle when pushing!)
const playerHand = createPlayerHand(1);
const leftPushHand = createPlayerHand(-1);
scene.add(playerHand);
scene.add(leftPushHand);
playerHand.visible = false;
leftPushHand.visible = false;

// ============================================================
// PARTICLE SYSTEM (Mist, Cold Vapor, Steam, Sparkles, Confetti)
// ============================================================
const particles = [];
const particleGeo = new THREE.SphereGeometry(0.022, 6, 5);
const confettiGeo = new THREE.PlaneGeometry(0.052, 0.034);

function spawnBurst(pos, { count = 16, color = 0xffffff, speed = 1.2, gravity = -1.6, life = 0.9, scale = 1, flat = false } = {}) {
  const colors = Array.isArray(color) ? color : [color];
  for (let i = 0; i < count; i++) {
    const col = colors[i % colors.length];
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(flat ? confettiGeo : particleGeo, mat);
    m.position.copy(pos);
    m.scale.setScalar(scale * (0.7 + Math.random() * 0.7));
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.7;
    const spd = speed * (0.4 + Math.random() * 0.85);
    const vel = new THREE.Vector3(
      Math.cos(theta) * Math.sin(phi) * spd,
      Math.cos(phi) * spd * 0.85 + 0.35,
      Math.sin(theta) * Math.sin(phi) * spd
    );
    scene.add(m);
    particles.push({ mesh: m, vel, gravity, age: 0, life: life * (0.75 + Math.random() * 0.5), spin: (Math.random() - 0.5) * 9 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    p.vel.y += p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += p.spin * dt;
    p.mesh.rotation.y += p.spin * 0.7 * dt;
    const t = p.age / p.life;
    p.mesh.material.opacity = Math.max(0, 1 - t * t);
  }
}

// ============================================================
// GAME STATE & SHELF ITEMS
// ============================================================
const state = {
  roundIndex: 0,
  targets: ROUNDS[0].slice(),
  phase: 'intro', // intro | produce | dairy | bakery | checkout | celebrate
  collected: [false, false, false],
  scanned: [false, false, false],
  packed: [false, false, false],
  moving: false,
  moveFrom: new THREE.Vector3(),
  moveTo: new THREE.Vector3(),
  moveProgress: 1,
  moveDuration: 0.9,
  moveNextPhase: 'produce',
  cartPos: new THREE.Vector3(STATIONS.intro.cartX, 0, STATIONS.intro.cartZ),
  cartYaw: 0,
  camLook: new THREE.Vector3(STATIONS.intro.lookX, STATIONS.intro.lookY, STATIONS.intro.lookZ),
  camPos: new THREE.Vector3(0, STATIONS.intro.camDy, STATIONS.intro.cartZ + STATIONS.intro.camDz),
  shelfItems: [],
  basketItems: [],
  checkoutItems: [],
  activePointerId: null,
  pointerDownTime: 0,
  pointerDownXY: new THREE.Vector2(),
  dragItem: null,
  dragPlane: new THREE.Plane(),
  pushDragging: false,
  time: 0,
  idleTime: 0,
  idleHintShown: false,
  idleHintAnim: 0,
  scanFlash: 0,
  drawerOpen: false,
  drawerProgress: 0,
  receiptProgress: 0,
  bagSquash: 0,
  cashierJoy: 0,
  cashierWave: 0,
  mistActive: 0,
  bakeryGlowBoost: 0,
  bellShake: 0,
  fps: 60,
  fpsAccum: 0,
  fpsFrames: 0,
};

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function buildShelfItems() {
  state.shelfItems.forEach((it) => scene.remove(it.mesh));
  state.shelfItems = [];

  const layout = [
    // Station 1: Produce
    { station: 'produce', type: 'tomato',   x: -0.66, y: 0.99, z: -1.42, scale: 1.24 },
    { station: 'produce', type: 'carrot',   x: -0.22, y: 0.99, z: -1.42, scale: 1.24 },
    { station: 'produce', type: 'broccoli', x:  0.22, y: 0.99, z: -1.42, scale: 1.24 },
    { station: 'produce', type: 'corn',     x:  0.66, y: 0.99, z: -1.42, scale: 1.24 },
    // Station 2: Dairy
    { station: 'dairy',   type: 'milk',            x: 4.8 - 0.56, y: 0.905, z: -1.36, scale: 1.28 },
    { station: 'dairy',   type: 'strawberry_milk', x: 4.8,        y: 0.905, z: -1.36, scale: 1.28 },
    { station: 'dairy',   type: 'orange_juice',    x: 4.8 + 0.56, y: 0.905, z: -1.36, scale: 1.28 },
    // Station 3: Bakery
    { station: 'bakery',  type: 'croissant', x: 9.6 - 0.58, y: 1.015, z: -1.52, scale: 1.32 },
    { station: 'bakery',  type: 'melonpan',  x: 9.6,        y: 1.015, z: -1.52, scale: 1.30 },
    { station: 'bakery',  type: 'baguette',  x: 9.6 + 0.58, y: 1.015, z: -1.52, scale: 1.28 },
  ];

  layout.forEach((cfg) => {
    const mesh = createFoodMesh(cfg.type);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.scale.setScalar(cfg.scale);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), matHitZone);
    hit.position.y = 0.14;
    mesh.add(hit);
    mesh.traverse((o) => {
      if (o.isMesh) o.userData.shelfItemIndex = state.shelfItems.length;
    });
    scene.add(mesh);

    state.shelfItems.push({
      mesh,
      type: cfg.type,
      station: cfg.station,
      homePos: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      scaleBase: cfg.scale,
      collected: false,
      bounceAnim: 0,
      squishAnim: 0,
      flyAnim: null,
    });
  });
}

function clearBasketAndCheckout() {
  state.basketItems.forEach((b) => cart.itemContainer.remove(b.mesh));
  state.basketItems = [];
  state.checkoutItems.forEach((c) => scene.remove(c.mesh));
  state.checkoutItems = [];
  while (env.ecoBag.packedContainer.children.length > 0) {
    env.ecoBag.packedContainer.remove(env.ecoBag.packedContainer.children[0]);
  }
  env.ecoBag.ribbonStar.visible = false;
  env.ecoBag.root.position.set(0.64, 0.935, 0.09);
  env.ecoBag.root.scale.setScalar(1);
  env.receiptMesh.visible = false;
  env.receiptMesh.scale.y = 0.001;
  state.receiptProgress = 0;
  state.drawerOpen = false;
  updatePosScreen(env.posScreenObj, [], false);
}

function updateListCardUI() {
  listCard.classList.toggle('checkout-mode', state.phase === 'checkout' || state.phase === 'celebrate');
  const activeIdx =
    state.phase === 'produce' || state.phase === 'intro' ? 0
    : state.phase === 'dairy' ? 1
    : state.phase === 'bakery' ? 2
    : -1;

  slotEls.forEach((el, idx) => {
    const c = el.querySelector('canvas');
    renderCardSlot(c, state.targets[idx]);
    el.classList.toggle('active', idx === activeIdx && !state.collected[idx]);
    if (state.phase === 'checkout' || state.phase === 'celebrate') {
      el.classList.toggle('done', state.packed[idx]);
      el.classList.toggle('scanned', state.scanned[idx] && !state.packed[idx]);
      el.classList.toggle('packed', state.packed[idx]);
    } else {
      el.classList.toggle('done', state.collected[idx]);
      el.classList.remove('scanned', 'packed');
    }
  });
}

function nudgeTargetSlot(idx) {
  const el = slotEls[idx];
  if (!el) return;
  el.classList.remove('nudge');
  void el.offsetWidth;
  el.classList.add('nudge');
  setTimeout(() => el.classList.remove('nudge'), 600);
}

function startRound(roundIdx) {
  state.roundIndex = roundIdx % ROUNDS.length;
  state.targets = ROUNDS[state.roundIndex].slice();
  state.collected = [false, false, false];
  state.scanned = [false, false, false];
  state.packed = [false, false, false];
  state.dragItem = null;
  state.idleTime = 0;
  state.idleHintShown = false;

  clearBasketAndCheckout();
  buildShelfItems();

  state.phase = 'intro';
  state.moving = false;
  state.cartPos.set(STATIONS.intro.cartX, 0, STATIONS.intro.cartZ);
  state.cartYaw = 0;
  cart.root.position.copy(state.cartPos);
  cart.root.rotation.y = 0;
  cart.root.visible = true;
  state.camPos.set(STATIONS.intro.cartX, STATIONS.intro.camDy, STATIONS.intro.cartZ + STATIONS.intro.camDz);
  state.camLook.set(STATIONS.intro.lookX, STATIONS.intro.lookY, STATIONS.intro.lookZ);

  updateListCardUI();
}

// ============================================================
// CART MOVEMENT BETWEEN STATIONS
// ============================================================
function rollCartTo(nextPhase) {
  if (state.moving) return;
  const target = STATIONS[nextPhase];
  if (!target) return;

  state.moving = true;
  state.moveFrom.copy(state.cartPos);
  state.moveTo.set(target.cartX, 0, target.cartZ);
  state.moveProgress = 0;
  const dist = state.moveFrom.distanceTo(state.moveTo);
  state.moveDuration = Math.max(0.75, Math.min(1.45, dist * 0.24 + 0.45));
  state.moveNextPhase = nextPhase;
  state.idleTime = 0;
  state.idleHintShown = false;

  sound.playCartRoll(state.moveDuration);
}

function getNextPhaseAfterCurrent() {
  if (state.phase === 'intro') return 'produce';
  if (state.phase === 'produce' && state.collected[0]) return 'dairy';
  if (state.phase === 'dairy' && state.collected[1]) return 'bakery';
  if (state.phase === 'bakery' && state.collected[2]) return 'checkout';
  return null;
}

// Spawn collected items neatly inside checkout frame (never clipped on iPad OR iPhone!)
function setupCheckoutItems() {
  state.basketItems.forEach((b) => cart.itemContainer.remove(b.mesh));
  state.basketItems = [];

  const baseX = env.checkoutGroup.position.x;
  const baseZ = env.checkoutGroup.position.z;

  const slots = [
    { dx: -0.78, dz:  0.18 },
    { dx: -0.54, dz: -0.02 },
    { dx: -0.34, dz:  0.18 },
  ];

  state.targets.forEach((type, idx) => {
    const mesh = createFoodMesh(type);
    const scale = CATEGORY_MAP[type] === 'bread' ? 1.24 : 1.18;
    mesh.scale.setScalar(scale);

    const homePos = new THREE.Vector3(baseX + slots[idx].dx, 0.955, baseZ + slots[idx].dz);
    mesh.position.set(homePos.x - 0.28, homePos.y, homePos.z);

    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), matHitZone);
    hit.position.y = 0.14;
    mesh.add(hit);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.135, 0.17, 24),
      new THREE.MeshBasicMaterial({ color: 0x38d96c, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    ring.visible = false;
    mesh.add(ring);

    mesh.traverse((o) => {
      if (o.isMesh) o.userData.checkoutItemIndex = idx;
    });
    scene.add(mesh);

    state.checkoutItems.push({
      mesh,
      ring,
      type,
      slotIndex: idx,
      homePos,
      scaleBase: scale,
      scanned: false,
      packed: false,
      scanCount: 0,
      glideIn: 0,
      flyAnim: null,
    });
  });

  state.cashierWave = 1.6;
  sound.playCashierHappy();
  updateListCardUI();
}

// ============================================================
// COLLECTING & CHECKOUT ACTIONS
// ============================================================
function collectShelfItem(item) {
  const slotIdx = item.station === 'produce' ? 0 : item.station === 'dairy' ? 1 : 2;
  if (item.collected || state.collected[slotIdx]) return;

  item.collected = true;
  state.collected[slotIdx] = true;
  state.idleTime = 0;
  state.idleHintShown = false;

  const basketSlotPos = new THREE.Vector3(-0.20 + slotIdx * 0.20, 0.02, 0.02);
  const worldDest = basketSlotPos.clone();
  cart.itemContainer.localToWorld(worldDest);

  const startPos = item.mesh.position.clone();
  item.flyAnim = {
    startPos,
    endPos: worldDest,
    t: 0,
    duration: 0.42,
    onDone: () => {
      scene.remove(item.mesh);
      const inBasket = createFoodMesh(item.type, { withShadow: false });
      inBasket.scale.setScalar(0.88);
      inBasket.position.copy(basketSlotPos);
      inBasket.rotation.y = (slotIdx - 1) * 0.4;
      cart.itemContainer.add(inBasket);
      state.basketItems.push({ mesh: inBasket, type: item.type, slotIndex: slotIdx });

      sound.playBasketDrop();
      spawnBurst(worldDest.clone().add(new THREE.Vector3(0, 0.14, 0)), {
        count: 18,
        color: [0xffd84a, 0x62d96b, 0xffffff],
        speed: 1.4,
        life: 0.75,
        scale: 1.0,
      });
      updateListCardUI();
    },
  };
}

function rejectShelfItem(item) {
  const slotIdx = item.station === 'produce' ? 0 : item.station === 'dairy' ? 1 : 2;
  sound.playGentleBoing();
  nudgeTargetSlot(slotIdx);

  const startPos = item.mesh.position.clone();
  item.flyAnim = {
    startPos,
    endPos: item.homePos.clone(),
    t: 0,
    duration: 0.38,
    onDone: () => {
      item.bounceAnim = 1.0;
    },
  };
}

function scanCheckoutItem(cItem) {
  const firstTime = !cItem.scanned;
  cItem.scanned = true;
  cItem.scanCount += 1;
  state.scanned[cItem.slotIndex] = true;
  state.scanFlash = 1.0;
  state.cashierJoy = 1.0;
  state.idleTime = 0;
  state.idleHintShown = false;

  sound.playScanBeep(cItem.scanCount - 1);
  cItem.ring.visible = true;

  const scannedTypes = state.checkoutItems.filter((x) => x.scanned).map((x) => x.type);
  updatePosScreen(env.posScreenObj, scannedTypes, true);
  setTimeout(() => {
    const cur = state.checkoutItems.filter((x) => x.scanned).map((x) => x.type);
    updatePosScreen(env.posScreenObj, cur, false);
  }, 450);

  const scanWorld = new THREE.Vector3();
  env.scannerGroup.getWorldPosition(scanWorld);
  spawnBurst(scanWorld.add(new THREE.Vector3(0, 0.16, 0)), {
    count: 14,
    color: [0x4ade80, 0xfff07a, 0xffffff],
    speed: 1.35,
    life: 0.65,
  });

  if (firstTime) updateListCardUI();
}

function packCheckoutItem(cItem) {
  if (cItem.packed) return;
  if (!cItem.scanned) scanCheckoutItem(cItem);
  cItem.packed = true;
  state.packed[cItem.slotIndex] = true;
  state.idleTime = 0;
  state.idleHintShown = false;

  const bagWorld = new THREE.Vector3();
  env.ecoBag.root.getWorldPosition(bagWorld);
  bagWorld.y += 0.36;

  const startPos = cItem.mesh.position.clone();
  cItem.flyAnim = {
    startPos,
    endPos: bagWorld,
    t: 0,
    duration: 0.38,
    onDone: () => {
      scene.remove(cItem.mesh);
      const packedMesh = createFoodMesh(cItem.type, { withShadow: false });
      const idx = cItem.slotIndex;
      packedMesh.scale.setScalar(0.95);
      packedMesh.position.set(-0.11 + idx * 0.11, 0.22 + (idx === 1 ? 0.04 : 0), -0.02 + (idx % 2) * 0.04);
      packedMesh.rotation.z = (idx - 1) * -0.18;
      env.ecoBag.packedContainer.add(packedMesh);

      state.bagSquash = 1.0;
      state.cashierJoy = 1.1;
      sound.playBagPack();

      spawnBurst(bagWorld.clone(), {
        count: 18,
        color: [0x6be888, 0xffd84d, 0xff8fab],
        speed: 1.5,
        life: 0.8,
      });

      updateListCardUI();

      if (state.packed.every(Boolean)) {
        triggerCelebration();
      }
    },
  };
}

function triggerCelebration() {
  state.phase = 'celebrate';
  state.cashierJoy = 2.6;
  state.cashierWave = 2.8;
  state.idleTime = 0;
  state.idleHintShown = false;

  env.ecoBag.ribbonStar.visible = true;
  env.receiptMesh.visible = true;
  state.receiptProgress = 0.01;
  sound.playReceiptPrint();

  setTimeout(() => {
    sound.playCelebration();
    const bagWorld = new THREE.Vector3();
    env.ecoBag.root.getWorldPosition(bagWorld);
    spawnBurst(bagWorld.clone().add(new THREE.Vector3(-0.22, 0.82, -0.15)), {
      count: 42,
      color: [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0xff8fab, 0xffffff],
      speed: 2.4,
      gravity: -1.35,
      life: 2.0,
      scale: 1.35,
      flat: true,
    });
  }, 320);

  cart.root.visible = true;
}

// ============================================================
// INTERACTIVE PLAYFUL DISCOVERIES (6+ Tactile Toys!)
// ============================================================
function triggerMistSprayer() {
  state.mistActive = 1.6;
  sound.playMistSpray();
  const base = env.produceGroup.position;
  for (let i = -3; i <= 3; i++) {
    spawnBurst(new THREE.Vector3(base.x + i * 0.34, 1.92, base.z - 0.35), {
      count: 10,
      color: 0xdff6ff,
      speed: 0.65,
      gravity: -0.9,
      life: 1.05,
      scale: 0.85,
    });
  }
}

function triggerApplePyramid() {
  sound.playFruitTumble();
  env.applePyramid.forEach((a, i) => {
    a.falling = true;
    a.timer = 0;
    a.vel.set((Math.random() - 0.5) * 1.1, 0.55 + i * 0.14, 0.35 + Math.random() * 0.45);
  });
}

function triggerFrostVapor() {
  sound.playMistSpray();
  const base = env.dairyGroup.position;
  for (let i = -2; i <= 2; i++) {
    spawnBurst(new THREE.Vector3(base.x + i * 0.48, 1.48, base.z + 0.1), {
      count: 12,
      color: 0xe6f8ff,
      speed: 0.6,
      gravity: -0.45,
      life: 1.15,
      scale: 1.4,
    });
  }
}

function triggerBakeryBell() {
  state.bellShake = 1.0;
  state.bakeryGlowBoost = 1.4;
  sound.playBakeryBell();
  const base = env.bakeryGroup.position;
  [-0.58, 0, 0.58].forEach((ox) => {
    spawnBurst(new THREE.Vector3(base.x + ox, 1.2, base.z + 0.12), {
      count: 8,
      color: 0xfff5e0,
      speed: 0.45,
      gravity: 0.55,
      life: 1.0,
      scale: 1.25,
    });
  });
}

function triggerCashDrawer() {
  state.drawerOpen = !state.drawerOpen;
  sound.playCashDrawer();
  state.cashierJoy = Math.max(state.cashierJoy, 0.7);
}

// ============================================================
// ONE-FINGER POINTER INPUT (Multi-touch Safe, Tap + Drag!)
// ============================================================
function setRayFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

function getInteractiveHit(e) {
  setRayFromEvent(e);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    const obj = h.object;
    if (obj.userData.checkoutItemIndex !== undefined) {
      const ci = state.checkoutItems[obj.userData.checkoutItemIndex];
      if (ci && !ci.packed && !ci.flyAnim) return { kind: 'checkout_item', item: ci, point: h.point };
    }
    if (obj.userData.shelfItemIndex !== undefined) {
      const si = state.shelfItems[obj.userData.shelfItemIndex];
      if (si && !si.collected && !si.flyAnim) return { kind: 'shelf_item', item: si, point: h.point };
    }
    if (obj.userData.interactive) {
      return { kind: obj.userData.interactive, object: obj, point: h.point };
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.activePointerId !== null) return;
  state.activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  sound.ensure();
  state.idleTime = 0;
  state.idleHintShown = false;
  state.pointerDownTime = performance.now();
  state.pointerDownXY.set(e.clientX, e.clientY);

  if (state.moving) return;

  const hit = getInteractiveHit(e);

  if (state.phase === 'celebrate') {
    if (hit && hit.kind === 'cart_handle') {
      sound.playCartRoll(0.9);
      startRound(state.roundIndex + 1);
      return;
    }
    if (hit && hit.kind === 'eco_bag') {
      state.bagSquash = 1.0;
      state.cashierJoy = 1.2;
      sound.playBagPack();
      sound.playCashierHappy();
      const bagW = new THREE.Vector3();
      env.ecoBag.root.getWorldPosition(bagW);
      spawnBurst(bagW.add(new THREE.Vector3(0, 0.45, 0)), {
        count: 16,
        color: [0xffca3a, 0xff8fab, 0x6be888],
        speed: 1.6,
        life: 0.9,
      });
      return;
    }
    if (hit && hit.kind === 'cashier') {
      state.cashierWave = 1.6;
      state.cashierJoy = 1.2;
      sound.playCashierHappy();
      return;
    }
    if (hit && hit.kind === 'register_button') {
      triggerCashDrawer();
      return;
    }
    if (e.clientY > window.innerHeight * 0.72) {
      sound.playCartRoll(0.9);
      startRound(state.roundIndex + 1);
    }
    return;
  }

  if (hit) {
    if (hit.kind === 'mist_button') { triggerMistSprayer(); return; }
    if (hit.kind === 'apple_pyramid') { triggerApplePyramid(); return; }
    if (hit.kind === 'frost_button') { triggerFrostVapor(); return; }
    if (hit.kind === 'bakery_bell') { triggerBakeryBell(); return; }
    if (hit.kind === 'register_button') { triggerCashDrawer(); return; }
    if (hit.kind === 'cashier') {
      state.cashierWave = 1.6;
      state.cashierJoy = 1.0;
      sound.playCashierHappy();
      return;
    }
  }

  if (hit && hit.kind === 'cart_handle') {
    const next = getNextPhaseAfterCurrent();
    if (next) {
      state.pushDragging = true;
      rollCartTo(next);
    } else {
      const idx = state.phase === 'produce' ? 0 : state.phase === 'dairy' ? 1 : 2;
      nudgeTargetSlot(idx);
      sound.playGentleBoing();
    }
    return;
  }

  // Let user also tap anywhere on the lower cart area when it's time to push forward!
  if (hit && hit.kind === 'cart_basket') {
    const next = getNextPhaseAfterCurrent();
    if (next) {
      rollCartTo(next);
      return;
    }
  }

  if (state.phase === 'intro') {
    rollCartTo('produce');
    return;
  }

  if (hit && hit.kind === 'shelf_item') {
    const si = hit.item;
    if (si.station !== state.phase) {
      si.bounceAnim = 0.6;
      return;
    }
    const slotIdx = si.station === 'produce' ? 0 : si.station === 'dairy' ? 1 : 2;
    if (state.collected[slotIdx]) {
      si.squishAnim = 1.0;
      sound.playPickup(CATEGORY_MAP[si.type]);
      return;
    }

    sound.playPickup(CATEGORY_MAP[si.type]);
    si.squishAnim = 0.8;
    state.dragItem = { kind: 'shelf', ref: si };
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    state.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), si.mesh.position);
    playerHand.visible = true;
    leftPushHand.visible = false;
    playerHand.userData.setPose(0.88);
    return;
  }

  if (state.phase === 'checkout' && hit && hit.kind === 'checkout_item') {
    const ci = hit.item;
    sound.playPickup(CATEGORY_MAP[ci.type]);
    state.dragItem = { kind: 'checkout', ref: ci, lastScanAt: 0 };
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    state.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), ci.mesh.position);
    playerHand.visible = true;
    leftPushHand.visible = false;
    playerHand.userData.setPose(0.88);
    return;
  }

  if (state.phase === 'checkout' && hit && hit.kind === 'eco_bag') {
    const scannedWaiting = state.checkoutItems.find((x) => x.scanned && !x.packed && !x.flyAnim);
    if (scannedWaiting) {
      packCheckoutItem(scannedWaiting);
    } else {
      state.bagSquash = 0.5;
      sound.playBagPack();
    }
    return;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== state.activePointerId || !state.dragItem) return;
  state.idleTime = 0;

  setRayFromEvent(e);
  const intersect = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(state.dragPlane, intersect)) return;

  const ref = state.dragItem.ref;
  const towardCam = camera.position.clone().sub(intersect).normalize().multiplyScalar(0.18);
  const targetPos = intersect.add(towardCam);
  targetPos.y = Math.max(0.75, Math.min(1.95, targetPos.y));
  ref.mesh.position.lerp(targetPos, 0.45);

  if (state.dragItem.kind === 'checkout') {
    const scanWorld = new THREE.Vector3();
    env.scannerGroup.getWorldPosition(scanWorld);
    const dx = Math.abs(ref.mesh.position.x - scanWorld.x);
    const dy = Math.abs(ref.mesh.position.y - (scanWorld.y + 0.14));
    const now = performance.now();
    if (dx < 0.28 && dy < 0.34 && now - state.dragItem.lastScanAt > 360) {
      state.dragItem.lastScanAt = now;
      scanCheckoutItem(ref);
    }
  }
});

function finishDrag(e) {
  if (e.pointerId !== state.activePointerId) return;
  state.activePointerId = null;
  state.pushDragging = false;

  if (!state.dragItem) return;

  const held = state.dragItem;
  state.dragItem = null;
  playerHand.visible = false;

  const elapsed = performance.now() - state.pointerDownTime;
  const distPx = Math.hypot(e.clientX - state.pointerDownXY.x, e.clientY - state.pointerDownXY.y);
  const isTap = elapsed < 320 && distPx < 24;

  if (held.kind === 'shelf') {
    const si = held.ref;
    const slotIdx = si.station === 'produce' ? 0 : si.station === 'dairy' ? 1 : 2;
    const isMatch = si.type === state.targets[slotIdx];

    const basketWorld = new THREE.Vector3();
    cart.basket.getWorldPosition(basketWorld);
    const overBasket =
      si.mesh.position.y < 1.15 &&
      Math.abs(si.mesh.position.x - basketWorld.x) < 0.65 &&
      si.mesh.position.z > basketWorld.z - 0.85;

    if (isMatch && (isTap || overBasket || e.clientY > window.innerHeight * 0.56)) {
      collectShelfItem(si);
    } else if (!isMatch && (isTap || overBasket || e.clientY > window.innerHeight * 0.56)) {
      rejectShelfItem(si);
    } else {
      si.flyAnim = {
        startPos: si.mesh.position.clone(),
        endPos: si.homePos.clone(),
        t: 0,
        duration: 0.28,
      };
    }
  } else if (held.kind === 'checkout') {
    const ci = held.ref;
    const scanWorld = new THREE.Vector3();
    env.scannerGroup.getWorldPosition(scanWorld);
    const bagWorld = new THREE.Vector3();
    env.ecoBag.root.getWorldPosition(bagWorld);

    const nearBag = Math.abs(ci.mesh.position.x - bagWorld.x) < 0.48;
    const nearScanner = Math.abs(ci.mesh.position.x - scanWorld.x) < 0.36;

    if (isTap) {
      if (!ci.scanned) {
        const hoverPos = scanWorld.clone().add(new THREE.Vector3(0.06, 0.16, 0.05));
        ci.flyAnim = {
          startPos: ci.mesh.position.clone(),
          endPos: hoverPos,
          t: 0,
          duration: 0.32,
          onDone: () => {
            scanCheckoutItem(ci);
            ci.homePos.copy(hoverPos);
          },
        };
      } else {
        packCheckoutItem(ci);
      }
    } else if (nearBag) {
      packCheckoutItem(ci);
    } else if (nearScanner) {
      if (!ci.scanned) scanCheckoutItem(ci);
      const hoverPos = scanWorld.clone().add(new THREE.Vector3(0.08, 0.14, 0.05));
      ci.homePos.copy(hoverPos);
      ci.flyAnim = {
        startPos: ci.mesh.position.clone(),
        endPos: hoverPos,
        t: 0,
        duration: 0.22,
      };
    } else {
      ci.flyAnim = {
        startPos: ci.mesh.position.clone(),
        endPos: ci.homePos.clone(),
        t: 0,
        duration: 0.28,
      };
    }
  }
}

canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

// ============================================================
// RESPONSIVE FRAMING (iPhone Portrait & iPad Landscape)
// ============================================================
function updateCameraAspect() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? Math.min(76, 46 / Math.pow(aspect, 0.50)) : 46;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', updateCameraAspect);
updateCameraAspect();

// Helper to place BOTH realistic child hands cleanly on the red cart handlebar!
function placeHandsOnHandlebar(grip = 0.85, pushOffset = 0) {
  const rightW = new THREE.Vector3(0.24, 0.985, 0.40 - pushOffset);
  const leftW = new THREE.Vector3(-0.24, 0.985, 0.40 - pushOffset);
  cart.root.localToWorld(rightW);
  cart.root.localToWorld(leftW);
  playerHand.visible = true;
  leftPushHand.visible = true;
  playerHand.position.copy(rightW);
  leftPushHand.position.copy(leftW);
  playerHand.rotation.set(-0.32, state.cartYaw, 0.08);
  leftPushHand.rotation.set(-0.32, state.cartYaw, -0.08);
  playerHand.userData.setPose(grip);
  leftPushHand.userData.setPose(grip);
}

// ============================================================
// ANIMATION LOOP
// ============================================================
let lastNow = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  state.time += dt;

  state.fpsAccum += dt;
  state.fpsFrames += 1;
  if (state.fpsAccum >= 0.5) {
    state.fps = Math.round(state.fpsFrames / state.fpsAccum);
    state.fpsAccum = 0;
    state.fpsFrames = 0;
  }

  // Keep focused directional shadow light right over the active station!
  sunLight.position.set(state.cartPos.x + 2.2, 6.2, state.cartPos.z + 2.4);
  sunLight.target.position.set(state.cartPos.x, 0.9, -1.4);

  // 1. Cart rolling movement
  if (state.moving) {
    state.moveProgress = Math.min(1, state.moveProgress + dt / state.moveDuration);
    const ease = state.moveProgress < 0.5
      ? 2 * state.moveProgress * state.moveProgress
      : 1 - Math.pow(-2 * state.moveProgress + 2, 2) / 2;

    const prevX = state.cartPos.x;
    const prevZ = state.cartPos.z;
    state.cartPos.lerpVectors(state.moveFrom, state.moveTo, ease);
    if (Math.abs(state.moveTo.x - state.moveFrom.x) > 1.5) {
      state.cartPos.z += Math.sin(ease * Math.PI) * 0.72;
    }

    const dx = state.cartPos.x - prevX;
    const dz = state.cartPos.z - prevZ;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);

    const travelYaw = Math.sin(ease * Math.PI) * (dx > 0.001 ? -0.32 : 0);
    state.cartYaw = THREE.MathUtils.lerp(state.cartYaw, travelYaw, 0.18);

    cart.wheels.forEach((w) => { w.rotation.x -= speed * dt * 8; });
    cart.root.position.set(state.cartPos.x, Math.sin(state.time * 24) * 0.004 * Math.min(1, speed), state.cartPos.z);
    cart.root.rotation.y = state.cartYaw;

    placeHandsOnHandlebar(0.95, 0.02);

    if (state.moveProgress >= 1) {
      state.moving = false;
      state.phase = state.moveNextPhase;
      state.cartYaw = 0;
      cart.root.rotation.y = 0;
      playerHand.visible = false;
      leftPushHand.visible = false;
      updateListCardUI();
      if (state.phase === 'checkout') {
        cart.root.visible = false;
        setupCheckoutItems();
      }
    }
  } else {
    cart.root.position.copy(state.cartPos);
    if (state.phase === 'celebrate') {
      // Clearly visible red cart handlebar at lower-center-left inviting a fresh shopping trip!
      cart.root.position.set(STATIONS.checkout.cartX - 0.16, 0.08, STATIONS.checkout.cartZ - 0.14);
      cart.root.rotation.y = 0.06;
    }
  }

  // Show both realistic hands resting warmly on the red handlebar when it's time to push!
  const canPush = !state.moving && (getNextPhaseAfterCurrent() !== null || state.phase === 'celebrate');
  if (canPush) {
    const pulse = 1 + Math.sin(state.time * 4.2) * 0.06;
    cart.handleBar.scale.set(pulse, 1, pulse);
    cart.handleBar.material.emissive.setHex(0x66120a);
    cart.handleBar.material.emissiveIntensity = 0.22 + Math.sin(state.time * 4.2) * 0.2;
    if (!state.dragItem && state.phase !== 'celebrate') {
      placeHandsOnHandlebar(0.72, Math.sin(state.time * 2.8) * 0.018);
    } else if (state.phase === 'celebrate') {
      playerHand.visible = false;
      leftPushHand.visible = false;
    }
  } else {
    cart.handleBar.scale.set(1, 1, 1);
    cart.handleBar.material.emissiveIntensity = 0;
    if (!state.moving && !state.dragItem && state.idleHintAnim <= 0) {
      playerHand.visible = false;
      leftPushHand.visible = false;
    }
  }

  // 2. Smooth Responsive Camera Follow
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const activeStationKey = state.moving ? state.moveNextPhase : (state.phase === 'celebrate' ? 'checkout' : state.phase);
  const portraitMult = activeStationKey === 'checkout' ? 1.55 : 0.85;
  const portraitBack = aspect < 1 ? (1 - aspect) * portraitMult : 0;
  const st = STATIONS[activeStationKey] || STATIONS.produce;

  const desiredCam = new THREE.Vector3(
    state.cartPos.x + st.camDx,
    st.camDy + portraitBack * 0.18,
    state.cartPos.z + st.camDz + portraitBack
  );
  const desiredLook = new THREE.Vector3(
    state.moving ? state.cartPos.x : st.lookX,
    st.lookY,
    state.moving ? state.cartPos.z - 1.5 : st.lookZ
  );
  state.camPos.lerp(desiredCam, Math.min(1, dt * 6.5));
  state.camLook.lerp(desiredLook, Math.min(1, dt * 6.5));
  camera.position.copy(state.camPos);
  camera.lookAt(state.camLook);

  // 3. Player Hand tracking dragged food item (big & crystal clear!)
  if (state.dragItem) {
    const p = state.dragItem.ref.mesh.position;
    playerHand.visible = true;
    leftPushHand.visible = false;
    playerHand.position.set(p.x + 0.04, p.y + 0.04, p.z + 0.14);
    playerHand.rotation.set(-0.22, 0.12, -0.08);
  }

  // 4. Slow Gentle Idle Demonstration (ONLY once after 10s of inactivity!)
  if (!state.moving && !state.dragItem && state.phase !== 'celebrate') {
    state.idleTime += dt;
    if (state.idleTime > 10.0 && !state.idleHintShown) {
      state.idleHintShown = true;
      state.idleHintAnim = 1.6;
    }
  }
  if (state.idleHintAnim > 0 && !state.dragItem && !state.moving) {
    state.idleHintAnim = Math.max(0, state.idleHintAnim - dt);
    const p = 1 - state.idleHintAnim / 1.6;
    if (!canPush) {
      playerHand.visible = state.idleHintAnim > 0.02;
      leftPushHand.visible = false;
      playerHand.userData.setPose(0.4 + Math.sin(p * Math.PI) * 0.4);
      if (state.phase === 'produce' || state.phase === 'dairy' || state.phase === 'bakery') {
        const slotIdx = state.phase === 'produce' ? 0 : state.phase === 'dairy' ? 1 : 2;
        const targetItem = state.shelfItems.find((x) => x.station === state.phase && x.type === state.targets[slotIdx]);
        if (targetItem) {
          const bPos = new THREE.Vector3();
          cart.basket.getWorldPosition(bPos);
          playerHand.position.lerpVectors(
            targetItem.homePos.clone().add(new THREE.Vector3(0, 0.14, 0.18)),
            bPos.clone().add(new THREE.Vector3(0, 0.28, 0.12)),
            Math.sin(p * Math.PI)
          );
          playerHand.rotation.set(-0.2, 0, 0);
        }
      } else if (state.phase === 'checkout') {
        const nextItem = state.checkoutItems.find((x) => !x.packed);
        if (nextItem) {
          const dest = new THREE.Vector3();
          (nextItem.scanned ? env.ecoBag.root : env.scannerGroup).getWorldPosition(dest);
          playerHand.position.lerpVectors(
            nextItem.mesh.position.clone().add(new THREE.Vector3(0, 0.16, 0.16)),
            dest.clone().add(new THREE.Vector3(0, 0.28, 0.14)),
            Math.sin(p * Math.PI)
          );
          playerHand.rotation.set(-0.2, 0, 0);
        }
      }
    }
  }

  // 5. Shelf Item Animations
  state.shelfItems.forEach((si) => {
    if (si.flyAnim) {
      si.flyAnim.t += dt / si.flyAnim.duration;
      const u = Math.min(1, si.flyAnim.t);
      si.mesh.position.lerpVectors(si.flyAnim.startPos, si.flyAnim.endPos, u);
      si.mesh.position.y += Math.sin(u * Math.PI) * 0.34;
      if (u >= 1) {
        const cb = si.flyAnim.onDone;
        si.flyAnim = null;
        if (cb) cb();
      }
    }
    if (si.bounceAnim > 0) {
      si.bounceAnim = Math.max(0, si.bounceAnim - dt * 2.2);
      si.mesh.rotation.z = Math.sin(si.bounceAnim * Math.PI * 4) * 0.18 * si.bounceAnim;
    } else {
      si.mesh.rotation.z = 0;
    }
    if (si.squishAnim > 0) {
      si.squishAnim = Math.max(0, si.squishAnim - dt * 3.0);
      const sq = Math.sin(si.squishAnim * Math.PI * 2) * 0.18 * si.squishAnim;
      si.mesh.scale.set(si.scaleBase * (1 + sq), si.scaleBase * (1 - sq * 1.15), si.scaleBase * (1 + sq));
    } else {
      si.mesh.scale.setScalar(si.scaleBase);
    }
  });

  // 6. Checkout Conveyor, Items, Laser Scanner, Cash Drawer, Receipt, Eco-Bag
  if (state.phase === 'checkout' || state.phase === 'celebrate') {
    env.conveyorTex.offset.y -= dt * 0.28;
  }

  state.checkoutItems.forEach((ci) => {
    if (ci.packed && !ci.flyAnim) return;
    if (ci.glideIn < 1) {
      ci.glideIn = Math.min(1, ci.glideIn + dt * 1.8);
      const u = 1 - Math.pow(1 - ci.glideIn, 3);
      ci.mesh.position.x = THREE.MathUtils.lerp(ci.homePos.x - 0.28, ci.homePos.x, u);
    }
    if (ci.flyAnim) {
      ci.flyAnim.t += dt / ci.flyAnim.duration;
      const u = Math.min(1, ci.flyAnim.t);
      ci.mesh.position.lerpVectors(ci.flyAnim.startPos, ci.flyAnim.endPos, u);
      ci.mesh.position.y += Math.sin(u * Math.PI) * 0.32;
      if (u >= 1) {
        const cb = ci.flyAnim.onDone;
        ci.flyAnim = null;
        if (cb) cb();
      }
    }
    if (ci.ring.visible) ci.ring.rotation.z += dt * 1.8;
  });

  // Crisp realistic laser beams pulse (turns bright emerald green on "ピッ!")
  if (state.scanFlash > 0) {
    state.scanFlash = Math.max(0, state.scanFlash - dt * 2.4);
    env.laserMat.color.setHex(0x38ff7a);
    env.laserMat.opacity = 0.96;
    env.ledLightMat.color.setHex(0x38ff7a);
    env.scannerGlassMat.emissive.setHex(0x16803c);
    env.laserBeamLine.material.color.setHex(0x4dff88);
  } else {
    env.laserMat.color.setHex(0xff2828);
    env.laserMat.opacity = 0.65 + Math.sin(state.time * 8) * 0.25;
    env.ledLightMat.color.setHex(0xff3b30);
    env.scannerGlassMat.emissive.setHex(0x550808);
    env.laserBeamLine.material.color.setHex(0xff4545);
  }

  const targetDrawer = state.drawerOpen ? 1 : 0;
  state.drawerProgress = THREE.MathUtils.lerp(state.drawerProgress, targetDrawer, Math.min(1, dt * 10));
  env.cashDrawer.position.z = state.drawerProgress * 0.22;

  if (state.receiptProgress > 0 && state.receiptProgress < 1) {
    state.receiptProgress = Math.min(1, state.receiptProgress + dt * 1.6);
    env.receiptMesh.scale.y = state.receiptProgress;
    env.receiptMesh.position.y = 0.16 + state.receiptProgress * 0.14;
  }

  if (state.bagSquash > 0) {
    state.bagSquash = Math.max(0, state.bagSquash - dt * 2.6);
    const s = Math.sin(state.bagSquash * Math.PI * 2.5) * 0.16 * state.bagSquash;
    env.ecoBag.bodyGroup.scale.set(1 + s, 1 - s * 0.85, 1 + s);
  } else {
    const fullness = state.packed.filter(Boolean).length;
    env.ecoBag.bodyGroup.scale.set(1 + fullness * 0.045, 1, 1 + fullness * 0.055);
  }
  if (state.phase === 'celebrate') {
    env.ecoBag.root.position.x = THREE.MathUtils.lerp(env.ecoBag.root.position.x, 0.36, Math.min(1, dt * 3));
    env.ecoBag.root.position.z = THREE.MathUtils.lerp(env.ecoBag.root.position.z, 0.22, Math.min(1, dt * 3));
    env.ecoBag.ribbonStar.rotation.y += dt * 1.8;
  }

  // 7. Expressive Cashier Animation
  const cash = env.cashier;
  const blink = (state.time % 3.8) > 3.66 ? 0.12 : 1.0;
  cash.eyes.forEach(({ eyeGroup, pupil }) => {
    eyeGroup.scale.y = blink;
    if (state.dragItem) {
      const relX = THREE.MathUtils.clamp((state.dragItem.ref.mesh.position.x - 14.9) * 0.012, -0.008, 0.008);
      const relY = THREE.MathUtils.clamp((state.dragItem.ref.mesh.position.y - 1.55) * 0.01, -0.006, 0.006);
      pupil.position.x = THREE.MathUtils.lerp(pupil.position.x, relX, 0.2);
      pupil.position.y = THREE.MathUtils.lerp(pupil.position.y, relY, 0.2);
    } else {
      pupil.position.x = THREE.MathUtils.lerp(pupil.position.x, 0, 0.1);
      pupil.position.y = THREE.MathUtils.lerp(pupil.position.y, -0.001, 0.1);
    }
  });

  if (state.cashierJoy > 0) {
    state.cashierJoy = Math.max(0, state.cashierJoy - dt);
    cash.smile.scale.set(1.22, 1.38, 1);
    cash.headGroup.rotation.x = Math.sin(state.time * 12) * 0.09;
  } else {
    cash.smile.scale.set(1.0, 1.0, 1);
    cash.headGroup.rotation.x = Math.sin(state.time * 1.8) * 0.025;
  }

  if (state.cashierWave > 0) {
    state.cashierWave = Math.max(0, state.cashierWave - dt);
    if (state.phase === 'celebrate') {
      cash.leftArm.rotation.z = -0.45 + Math.sin(state.time * 16) * 0.22;
      cash.rightArm.rotation.z = 0.45 - Math.sin(state.time * 16) * 0.22;
      cash.leftArm.rotation.x = -0.75;
      cash.rightArm.rotation.x = -0.75;
    } else {
      cash.rightArm.rotation.z = 2.1 + Math.sin(state.time * 12) * 0.28;
      cash.rightArm.rotation.x = -0.35;
      cash.leftArm.rotation.z = -0.18;
      cash.leftArm.rotation.x = -0.38;
    }
  } else {
    cash.rightArm.rotation.z = THREE.MathUtils.lerp(cash.rightArm.rotation.z, 0.26, 0.1);
    cash.rightArm.rotation.x = THREE.MathUtils.lerp(cash.rightArm.rotation.x, -0.45, 0.1);
    cash.leftArm.rotation.z = THREE.MathUtils.lerp(cash.leftArm.rotation.z, -0.18, 0.1);
    cash.leftArm.rotation.x = THREE.MathUtils.lerp(cash.leftArm.rotation.x, -0.35, 0.1);
  }

  // 8. Interactive Side Toys
  env.applePyramid.forEach((a) => {
    if (!a.falling) return;
    a.timer += dt;
    if (a.timer < 1.35) {
      a.vel.y -= 4.8 * dt;
      a.mesh.position.addScaledVector(a.vel, dt);
      if (a.mesh.position.y < 0.05) {
        a.mesh.position.y = 0.05;
        a.vel.y = Math.abs(a.vel.y) * 0.42;
        a.vel.x *= 0.82;
        a.vel.z *= 0.82;
      }
      a.mesh.rotation.x += a.vel.z * dt * 6;
      a.mesh.rotation.z -= a.vel.x * dt * 6;
    } else {
      a.mesh.position.lerp(a.home, Math.min(1, dt * 6));
      if (a.mesh.position.distanceTo(a.home) < 0.01) {
        a.mesh.position.copy(a.home);
        a.falling = false;
      }
    }
  });

  if (state.bellShake > 0) {
    state.bellShake = Math.max(0, state.bellShake - dt * 2.5);
    env.bellGroup.rotation.z = Math.sin(state.bellShake * Math.PI * 6) * 0.16 * state.bellShake;
  }
  if (state.bakeryGlowBoost > 0) {
    state.bakeryGlowBoost = Math.max(0, state.bakeryGlowBoost - dt);
    env.bakeryLight.intensity = 4.4 + state.bakeryGlowBoost * 2.4;
  } else {
    env.bakeryLight.intensity = 4.4;
  }

  updateParticles(dt);

  renderer.render(scene, camera);
}

startRound(0);
requestAnimationFrame(animate);

window.__GAME_DEBUG__ = {
  getStats: () => ({
    phase: state.phase,
    targets: state.targets,
    collected: state.collected,
    scanned: state.scanned,
    packed: state.packed,
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    textures: renderer.info.memory.textures,
    pixelRatio: renderer.getPixelRatio(),
    fps: state.fps,
  }),
  jumpTo: (phase) => {
    const st = STATIONS[phase === 'celebrate' ? 'checkout' : phase];
    if (!st) return;
    state.moving = false;
    state.phase = phase;
    state.cartPos.set(st.cartX, 0, st.cartZ);
    cart.root.position.copy(state.cartPos);
    cart.root.rotation.y = 0;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const portraitMult = (phase === 'checkout' || phase === 'celebrate') ? 1.18 : 0.78;
    const portraitBack = aspect < 1 ? (1 - aspect) * portraitMult : 0;
    state.camPos.set(st.cartX + st.camDx, st.camDy + portraitBack * 0.18, st.cartZ + st.camDz + portraitBack);
    state.camLook.set(st.lookX, st.lookY, st.lookZ);
    if (phase === 'dairy') state.collected = [true, false, false];
    if (phase === 'bakery') state.collected = [true, true, false];
    if (phase === 'checkout') {
      state.collected = [true, true, true];
      cart.root.visible = false;
      clearBasketAndCheckout();
      setupCheckoutItems();
      state.checkoutItems.forEach((ci) => { ci.glideIn = 1; ci.mesh.position.copy(ci.homePos); });
    } else if (phase === 'celebrate') {
      state.collected = [true, true, true];
      clearBasketAndCheckout();
      setupCheckoutItems();
      state.checkoutItems.forEach((ci) => {
        scanCheckoutItem(ci);
        packCheckoutItem(ci);
        if (ci.flyAnim && ci.flyAnim.onDone) {
          ci.flyAnim.onDone();
          ci.flyAnim = null;
        }
      });
      state.receiptProgress = 1;
      env.receiptMesh.scale.y = 1;
      env.receiptMesh.position.y = 0.30;
    } else {
      cart.root.visible = true;
    }
    updateListCardUI();
  },
  triggerMist: triggerMistSprayer,
  triggerApples: triggerApplePyramid,
  triggerBell: triggerBakeryBell,
  triggerDrawer: triggerCashDrawer,
};
