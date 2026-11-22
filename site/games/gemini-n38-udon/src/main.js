import * as THREE from '../vendor/three.module.js';
import {
  createShowaWoodTextures,
  createShowaTileTextures,
  createBrushedSteelTextures,
  createHammeredAluminumTextures,
  createBambooZaruTextures,
  createDonburiTextures,
  createFukinClothTexture,
  createNegiTexture,
  createTenkasuTextures,
  createWinterKnitTextures,
  createSteamSpriteTexture,
  createSkinTextures,
  createUdonTextures,
  createFlourDustTexture,
  createSoftGlowTexture,
  createShowaEnvMap,
} from './textures.js';
import { ShowaFilmPostProcess } from './postprocess.js';
import { KitchenAudio } from './audio.js';
import { KitchenParticles } from './particles.js';
import {
  buildShowaKitchen,
  buildBoilingPot,
  buildRawUdonPrep,
  buildBambooZaru,
  buildDonburiBowl,
  buildDashiPotAndLadle,
  buildToppingDishes,
  buildChopsticks,
  buildRealisticHand,
} from './models.js';

// ============================================================================
// CORE GAME STATE & CONSTANTS
// ============================================================================
const PHASES = {
  RAW: 'raw',             // Drop raw udon into big boiling pot
  BOIL: 'boil',           // Stir & boil udon in pot
  SCOOP: 'scoop',         // Scoop cooked udon with bamboo zaru
  YUGIRI: 'yugiri',       // Shake zaru vigorously to drain water (splash particles!)
  POUR: 'pour',           // Ladle hot amber dashi into ceramic donburi bowl
  ENJOY: 'enjoy',         // Add negi & tenkasu, swirl broth, pour more, or eat with chopsticks!
  COMPLETE: 'complete',   // Bowl finished -> painted bottom revealed -> fresh udon arrives!
};

const POS = {
  pot: new THREE.Vector3(-1.68, 0.92, -0.35),
  raw: new THREE.Vector3(-1.35, 0.25, 1.56),
  knob: new THREE.Vector3(-2.62, 0.20, 1.56),
  zaruRest: new THREE.Vector3(-0.04, 0.56, -1.44),
  zaruShake: new THREE.Vector3(-0.42, 2.02, -0.18),
  bowl: new THREE.Vector3(0.94, 0.56, 0.44),
  dashiPot: new THREE.Vector3(1.42, 0.60, -1.32),
  negiDish: new THREE.Vector3(2.62, 0.20, -0.06),
  tenkasuDish: new THREE.Vector3(2.58, 0.20, 1.12),
  chopsticksRest: new THREE.Vector3(0.95, 0.14, 1.92),
};

class UdonKitchenGame {
  constructor() {
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    // Renderer (capped DPR <= 1.5 for guaranteed 30-60fps on iPhone/iPad)
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // MSAA handled by HalfFloat render target in postprocess
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // Handled in ShowaFilmPostProcess
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080a0e');

    // Directly overhead top-down perspective camera (真上からの俯瞰カメラ)
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 30);
    this.cameraBasePos = new THREE.Vector3(0.12, 7.6, 0.52); // Near-vertical overhead (~86 deg) for rich 3D rim/steam parallax
    this.cameraTarget = new THREE.Vector3(0.12, 0.15, 0.08);
    this.cameraShake = new THREE.Vector3();
    this.camera.position.copy(this.cameraBasePos);
    this.camera.lookAt(this.cameraTarget);

    this.postprocess = new ShowaFilmPostProcess(this.renderer);
    this.audio = new KitchenAudio();

    this._initTexturesAndEnv();
    this._initLights();
    this._initSceneObjects();
    this._initFloatingToppings();
    this._initState();
    this._initInput();

    this._updateResponsiveCamera();
    window.addEventListener('resize', () => this._onResize());

    // Non-visual inspection hook for automated verification & screenshot passes
    this.lastSceneTriangles = 0;
    this.lastSceneCalls = 0;
    window.__udonDebug = {
      getInfo: () => ({
        phase: this.phase,
        triangles: this.lastSceneTriangles,
        calls: this.lastSceneCalls,
        boilProgress: this.boilProgress,
        yugiriShakes: this.yugiriShakes,
        brothLevel: this.brothLevel,
        negiCount: this.activeNegiCount,
        tenkasuCount: this.activeTenkasuCount,
        bitesTaken: this.bitesTaken,
      }),
      setSceneState: (stateName) => this._debugJumpToState(stateName),
      stepFrames: (n = 10, dt = 0.033) => {
        for (let i = 0; i < n; i++) this._update(dt);
        this._renderFrame();
      },
    };

    this._loop();
  }

  _initTexturesAndEnv() {
    this.textures = {
      wood: createShowaWoodTextures(),
      tile: createShowaTileTextures(),
      steel: createBrushedSteelTextures(),
      aluminum: createHammeredAluminumTextures(),
      bamboo: createBambooZaruTextures(),
      donburi: createDonburiTextures(),
      cloth: createFukinClothTexture(),
      negi: createNegiTexture(),
      tenkasu: createTenkasuTextures(),
      knit: createWinterKnitTextures(),
      steam: createSteamSpriteTexture(),
      skin: createSkinTextures(),
      udon: createUdonTextures(),
      flourDust: createFlourDustTexture(),
      softGlow: createSoftGlowTexture(),
    };
    this.scene.environment = createShowaEnvMap(this.renderer);
  }

  _initLights() {
    // SINGLE WARM BARE INCANDESCENT BULB (真冬の夜・裸電球の暖色1灯)
    // Dramatic tungsten pool overhead with natural inverse-square falloff into dark winter-night kitchen edges!
    this.bulbLight = new THREE.PointLight(0xffaa52, 30.0, 14.5, 2.0);
    this.bulbLight.position.set(0.05, 4.15, -0.22);
    this.bulbLight.castShadow = true;
    this.bulbLight.shadow.mapSize.set(1024, 1024);
    this.bulbLight.shadow.bias = -0.0005;
    this.bulbLight.shadow.normalBias = 0.025;
    this.bulbLight.shadow.radius = 3.6;
    this.scene.add(this.bulbLight);

    // Chilly midwinter-night blue-slate ambient air (deep moody shadows contrasting with warm bare bulb)
    this.nightAmbient = new THREE.HemisphereLight(0x1f304c, 0x0e0906, 0.24);
    this.scene.add(this.nightAmbient);

    // Subtle gas-burner underglow right beneath the boiling pot (reacts to stove dial!)
    this.gasGlowLight = new THREE.PointLight(0x4b93ff, 2.2, 3.0, 2.0);
    this.gasGlowLight.position.set(POS.pot.x, 0.22, POS.pot.z);
    this.scene.add(this.gasGlowLight);
  }

  _initSceneObjects() {
    // Shared cooked glossy udon material (plump glistening wet Sanuki wheat noodles!)
    this.cookedUdonMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2e8d2,
      map: this.textures.udon.map,
      bumpMap: this.textures.udon.bumpMap,
      bumpScale: 0.009,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      sheen: 0.18,
      sheenColor: new THREE.Color(0xfff1d2),
      envMapIntensity: 1.35,
    });

    this.kitchen = buildShowaKitchen(this.textures);
    this.scene.add(this.kitchen.group);

    this.pot = buildBoilingPot(this.textures, this.cookedUdonMat);
    this.scene.add(this.pot.group);

    this.rawPrep = buildRawUdonPrep(this.textures);
    this.scene.add(this.rawPrep.group);

    this.zaru = buildBambooZaru(this.textures, this.cookedUdonMat);
    this.zaru.group.position.copy(POS.zaruRest);
    this.zaru.group.rotation.y = -0.45;
    this.scene.add(this.zaru.group);

    this.bowl = buildDonburiBowl(this.textures, this.cookedUdonMat);
    this.scene.add(this.bowl.group);

    this.dashi = buildDashiPotAndLadle(this.textures);
    this.scene.add(this.dashi.potGroup);
    this.dashi.ladleGroup.position.set(POS.dashiPot.x + 0.04, POS.dashiPot.y - 0.16, POS.dashiPot.z + 0.06);
    this.scene.add(this.dashi.ladleGroup);
    this.scene.add(this.dashi.pourStream);

    this.dishes = buildToppingDishes(this.textures);
    this.scene.add(this.dishes.negiDish);
    this.scene.add(this.dishes.tenkasuDish);

    this.chopsticks = buildChopsticks(this.cookedUdonMat, this.dishes.negiRingGeo, this.dishes.negiRingMat);
    this.scene.add(this.chopsticks.restGroup);
    this.chopsticks.sticksGroup.position.copy(POS.chopsticksRest);
    this.chopsticks.sticksGroup.rotation.y = 0.04;
    this.scene.add(this.chopsticks.sticksGroup);

    this.hand = buildRealisticHand(this.textures);
    this.hand.root.position.set(0.4, 1.5, 6.2);
    this.scene.add(this.hand.root);

    this.particles = new KitchenParticles(this.scene, this.textures);
  }

  _initFloatingToppings() {
    // Pool of 90 floating negi rings + 90 floating crispy tenkasu pieces inside the bowl
    this.maxToppings = 90;
    this.negiPool = [];
    this.tenkasuPool = [];
    for (let i = 0; i < this.maxToppings; i++) {
      this.negiPool.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, landed: false });
      this.tenkasuPool.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, landed: false });
    }
    this.negiMesh = new THREE.InstancedMesh(this.dishes.negiRingGeo, this.dishes.negiRingMat, this.maxToppings);
    this.negiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.negiMesh.renderOrder = 11;
    this.scene.add(this.negiMesh);

    this.tenkasuMesh = new THREE.InstancedMesh(this.dishes.tenkasuGeo, this.dishes.tenkasuMat, this.maxToppings);
    this.tenkasuMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tenkasuMesh.renderOrder = 11;
    this.scene.add(this.tenkasuMesh);

    this._topDummy = new THREE.Object3D();
    this._clearToppings();
  }

  _clearToppings() {
    this.activeNegiCount = 0;
    this.activeTenkasuCount = 0;
    this._topDummy.position.set(0, -10, 0);
    this._topDummy.scale.setScalar(0.0001);
    this._topDummy.updateMatrix();
    for (let i = 0; i < this.maxToppings; i++) {
      this.negiPool[i].active = false;
      this.tenkasuPool[i].active = false;
      this.negiMesh.setMatrixAt(i, this._topDummy.matrix);
      this.tenkasuMesh.setMatrixAt(i, this._topDummy.matrix);
    }
    this.negiMesh.instanceMatrix.needsUpdate = true;
    this.tenkasuMesh.instanceMatrix.needsUpdate = true;
  }

  _initState() {
    this.phase = PHASES.RAW;
    this.stoveLevel = 1; // 0 = low simmer, 1 = medium boil, 2 = roaring high boil!
    this.flameSmooth = 0.58;
    this.boilProgress = 0.0; // 0 -> 1 cooked
    this.boilOver = 0.0;
    this.potSwirlAngle = 0.0;
    this.potSwirlVel = 0.35;
    this.splashWave = 0.0;

    // Zaru & yugiri physics
    this.zaruTargetPos = POS.zaruRest.clone();
    this.zaruTargetRot = new THREE.Euler(0, -0.45, 0);
    this.zaruNoodleBounce = 0;
    this.zaruNoodleBounceVel = 0;
    this.yugiriShakes = 0;
    this.lastShakeTime = 0;
    this.lastShakeDir = 0;
    this.dumpAnim = 0;

    // Broth & Bowl state
    this.brothLevel = 0.0; // 0 -> 1.0 full, up to 1.35 overflow!
    this.overflowAmount = 0.0;
    this.bowlSwirlVel = 0.0;
    this.bowlSwirlAngle = 0.0;
    this.brothRipple = 0.0;
    this.pouring = false;
    this.ladleState = 'rest'; // 'rest' | 'scoop' | 'carry' | 'pour' | 'return'
    this.ladleTimer = 0;
    this.ladleTargetPos = new THREE.Vector3(POS.dashiPot.x + 0.04, POS.dashiPot.y - 0.16, POS.dashiPot.z + 0.06);
    this.ladleTargetRot = new THREE.Euler(0, 0, 0);

    // Eating / Chopsticks state
    this.bitesTaken = 0;
    this.maxBites = 5;
    this.eatAnim = 0; // 0 idle, >0 lifting & slurping bite
    this.completeTimer = 0;

    // Hand animation state
    this.handTargetPos = new THREE.Vector3(0.4, 1.8, 6.2);
    this.handTargetRotY = 0;
    this.handPose = 'open';
    this.handActiveTimer = 0;
    this.idleSeconds = 0;
    this.hintAnim = 0; // 0 = off, >0 = gentle one-shot hand demonstration after 10s idle

    // Micro wobble feedback on non-active props
    this.wobbles = {
      bowl: 0,
      negi: 0,
      tenkasu: 0,
      dashi: 0,
      zaru: 0,
      raw: 0,
    };

    // Action lock / transition timers
    this.dropRawAnim = 0;
    this.steamAccum = 0;
    this.bubbleSoundTimer = 0;
  }

  _resetForNewBowl() {
    this._clearToppings();
    this.phase = PHASES.RAW;
    this.boilProgress = 0;
    this.yugiriShakes = 0;
    this.brothLevel = 0;
    this.overflowAmount = 0;
    this.bitesTaken = 0;
    this.eatAnim = 0;
    this.completeTimer = 0;
    this.dropRawAnim = 0;

    this.rawPrep.rawBundle.visible = true;
    this.rawPrep.rawBundle.position.set(0, 0.06, 0);
    this.rawPrep.rawBundle.scale.setScalar(1);

    this.pot.potNoodles.visible = false;
    this.zaru.zaruNoodles.visible = false;
    this.zaruTargetPos.copy(POS.zaruRest);
    this.zaruTargetRot.set(0, -0.45, 0);

    this.bowl.bowlNoodles.visible = false;
    this.bowl.bowlNoodles.scale.setScalar(1);
    this.bowl.brothMesh.visible = false;
    this.bowl.brothUniforms.uOpacity.value = 0;
    this.bowl.overflowPuddle.material.opacity = 0;

    this.ladleState = 'rest';
    this.ladleTimer = 0;
    this.ladleTargetPos.set(POS.dashiPot.x + 0.04, POS.dashiPot.y - 0.16, POS.dashiPot.z + 0.06);
    this.ladleTargetRot.set(0, 0, 0);
    this.dashi.ladleGroup.position.copy(this.ladleTargetPos);
    this.dashi.ladleGroup.rotation.set(0, 0, 0);
    this.dashi.pourStream.visible = false;

    this.chopsticks.liftedBite.visible = false;
    this.chopsticks.sticksGroup.position.copy(POS.chopsticksRest);
    this.chopsticks.sticksGroup.rotation.set(0, 0.04, 0);
    this.dragMode = null;
    this.idleSeconds = 0;
  }

  // ============================================================================
  // RESPONSIVE OVERHEAD CAMERA FRAMING (iPhone Portrait + iPad/Desktop Landscape)
  // ============================================================================
  _updateResponsiveCamera() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;

    // Core kitchen footprint spans X ~6.4, Z ~4.45
    const needW = 6.65;
    const needH = 4.65;
    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const tanHalfV = Math.tan(vFovRad / 2);
    const tanHalfH = tanHalfV * aspect;

    const distForH = (needH * 0.5) / tanHalfV;
    const distForW = (needW * 0.5) / tanHalfH;
    const dist = Math.max(distForH, distForW, 6.2);

    this.cameraBasePos.set(0.18, dist, 0.42 + dist * 0.04);
    this.cameraTarget.set(0.18, 0.12, 0.06);
    this.camera.updateProjectionMatrix();
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.postprocess.resize(w, h, this.pixelRatio);
    this._updateResponsiveCamera();
  }

  // ============================================================================
  // SINGLE-FINGER POINTER INTERACTION (Generous, Tolerant, Multi-touch Safe)
  // ============================================================================
  _initInput() {
    const dom = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
    this.activePointerId = null;
    this.dragMode = null; // 'raw' | 'stir' | 'zaru' | 'yugiri' | 'ladle' | 'negi' | 'tenkasu' | 'bowl'
    this.lastWorld = new THREE.Vector3();
    this.downWorld = new THREE.Vector3();
    this.downTime = 0;

    dom.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    dom.addEventListener('pointermove', (e) => this._onPointerMove(e));
    dom.addEventListener('pointerup', (e) => this._onPointerUp(e));
    dom.addEventListener('pointercancel', (e) => this._onPointerUp(e));
  }

  _screenToWorld(clientX, clientY, yHeight = 0.45) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    this.planeY.constant = -yHeight;
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.planeY, hit);
    return hit;
  }

  _dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  _onPointerDown(e) {
    // Multi-touch safe: ignore extra simultaneous fingers cleanly
    if (this.activePointerId !== null) return;
    this.activePointerId = e.pointerId;
    this.audio.unlock();
    this.idleSeconds = 0;
    this.hintAnim = 0;

    const pt = this._screenToWorld(e.clientX, e.clientY, 0.45);
    this.downWorld.copy(pt);
    this.lastWorld.copy(pt);
    this.downTime = this.elapsed;

    // 1. Stove rotary dial works at ANY phase! (Discovery: crank flame / boil over!)
    if (this._dist2D(pt, POS.knob) < 0.56) {
      this._cycleStoveKnob();
      return;
    }

    // 2. Phase-specific primary active targets (generous magnetic hit radii!)
    if (this.phase === PHASES.RAW && this.dropRawAnim === 0) {
      if (this._dist2D(pt, POS.raw) < 0.95) {
        this.dragMode = 'raw';
        this._moveHandTo(pt.x, 0.72, pt.z, 'pinch');
        return;
      }
      // If child taps the boiling pot while raw udon is still waiting, gently ripple pot & nudge raw udon
      if (this._dist2D(pt, POS.pot) < 1.35) {
        this.splashWave = 0.45;
        this.wobbles.raw = 1.0;
        this.audio.playBubble(true);
        return;
      }
    }

    if (this.phase === PHASES.BOIL) {
      if (this._dist2D(pt, POS.pot) < 1.48) {
        this.dragMode = 'stir';
        this.potSwirlVel = Math.min(7.5, this.potSwirlVel + 2.4);
        this.boilProgress = Math.min(1.0, this.boilProgress + 0.14);
        this.boilOver = Math.max(0, this.boilOver - 0.35); // Stirring calms boil-over!
        this.audio.playBubble(true);
        this._moveHandTo(pt.x + 0.35, 1.35, pt.z + 0.35, 'chopsticks');
        return;
      }
    }

    if (this.phase === PHASES.SCOOP) {
      const zaruPos = this.zaru.group.position;
      if (this._dist2D(pt, zaruPos) < 1.05 || this._dist2D(pt, POS.pot) < 1.38) {
        this._startScoopIntoYugiri();
        this.dragMode = 'yugiri';
        return;
      }
    }

    if (this.phase === PHASES.YUGIRI && this.dumpAnim === 0) {
      // Tapping or dragging anywhere near the lifted zaru triggers big joyful yugiri shake!
      if (this._dist2D(pt, this.zaru.group.position) < 1.65) {
        this.dragMode = 'yugiri';
        this._triggerYugiriShake(1.0, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4);
        return;
      }
      // Dragging/tapping the bowl after at least 1 shake tips noodles straight into bowl!
      if (this._dist2D(pt, POS.bowl) < 1.35 && this.yugiriShakes >= 1) {
        this._startDumpToBowl();
        return;
      }
    }

    if (this.phase === PHASES.POUR || this.phase === PHASES.ENJOY) {
      // Ladle / Dashi pot -> scoop & pour hot amber broth (works in both POUR and ENJOY for extra broth/overflow!)
      if ((this._dist2D(pt, POS.dashiPot) < 1.12 || this._dist2D(pt, this.dashi.ladleGroup.position) < 0.85) && this.ladleState === 'rest') {
        this.dragMode = 'ladle';
        this._startLadlePour();
        return;
      }
    }

    if (this.phase === PHASES.ENJOY) {
      // Negi dish -> pinch & scatter chopped green onions!
      if (this._dist2D(pt, POS.negiDish) < 0.85) {
        this.dragMode = 'negi';
        this._scatterTopping('negi', POS.bowl.x, POS.bowl.z);
        return;
      }
      // Tenkasu dish -> pinch & scatter golden crispy tenkasu!
      if (this._dist2D(pt, POS.tenkasuDish) < 0.85) {
        this.dragMode = 'tenkasu';
        this._scatterTopping('tenkasu', POS.bowl.x, POS.bowl.z);
        return;
      }
      // Chopsticks or Bowl -> swirl broth or lift steaming noodles to eat!
      if (this._dist2D(pt, POS.chopsticksRest) < 0.95 && this.eatAnim === 0) {
        this._triggerEatBite();
        return;
      }
      if (this._dist2D(pt, POS.bowl) < 1.30) {
        this.dragMode = 'bowl';
        return;
      }
    }

    // 3. Non-active props give realistic subtle tactile micro-reactions (never dead, never hijacks flow!)
    if (this._dist2D(pt, POS.bowl) < 1.25) {
      this.wobbles.bowl = 1.0;
      this.audio.playCeramicClink(0.75);
    } else if (this._dist2D(pt, POS.dashiPot) < 0.92) {
      this.wobbles.dashi = 1.0;
      this.audio.playBubble(false);
    } else if (this._dist2D(pt, POS.negiDish) < 0.72) {
      this.wobbles.negi = 1.0;
      this.audio.playCeramicClink(0.5);
    } else if (this._dist2D(pt, POS.tenkasuDish) < 0.72) {
      this.wobbles.tenkasu = 1.0;
      this.audio.playCeramicClink(0.5);
    } else if (this._dist2D(pt, this.zaru.group.position) < 0.85) {
      this.wobbles.zaru = 1.0;
      this.audio.playCeramicClink(0.4);
    } else if (this._dist2D(pt, POS.pot) < 1.30) {
      this.splashWave = 0.5;
      this.audio.playBubble(false);
    }
  }

  _onPointerMove(e) {
    if (this.activePointerId !== e.pointerId) return;
    this.idleSeconds = 0;

    const pt = this._screenToWorld(e.clientX, e.clientY, this.dragMode === 'yugiri' ? 1.85 : 0.55);
    const dx = pt.x - this.lastWorld.x;
    const dz = pt.z - this.lastWorld.z;
    const speed = Math.hypot(dx, dz);

    if (this.dragMode === 'raw') {
      // Carry plump raw udon bundle smoothly with the hand!
      const localX = pt.x - this.rawPrep.group.position.x;
      const localZ = pt.z - this.rawPrep.group.position.z;
      this.rawPrep.rawBundle.position.set(localX, 0.65, localZ);
      this._moveHandTo(pt.x + 0.08, 0.95, pt.z + 0.14, 'pinch');

      // Magnetic drop when brought over the big boiling pot!
      if (this._dist2D(pt, POS.pot) < 1.28) {
        this.dragMode = null;
        this._dropRawUdonIntoPot();
      }
    } else if (this.dragMode === 'stir' && this.phase === PHASES.BOIL) {
      if (speed > 0.025) {
        this.potSwirlVel = Math.min(8.5, this.potSwirlVel + speed * 5.2);
        this.boilProgress = Math.min(1.0, this.boilProgress + speed * 0.22);
        this.boilOver = Math.max(0, this.boilOver - speed * 0.3);
        const stirX = THREE.MathUtils.clamp(pt.x, POS.pot.x - 0.75, POS.pot.x + 0.75);
        const stirZ = THREE.MathUtils.clamp(pt.z, POS.pot.z - 0.75, POS.pot.z + 0.75);
        this._moveHandTo(stirX + 0.62, 1.55, stirZ + 0.42, 'chopsticks');
        this.chopsticks.sticksGroup.position.lerp(new THREE.Vector3(stirX + 0.48, 1.25, stirZ + 0.14), 0.45);
        this.chopsticks.sticksGroup.rotation.set(0, 0.35, 0.62);
        if (Math.random() < 0.28) {
          this.particles.spawnSteam(POS.pot.x, 1.05, POS.pot.z, { spread: 0.65, vy: 1.35, endScale: 2.4, opacity: 0.46 });
        }
      }
    } else if (this.dragMode === 'yugiri' && this.phase === PHASES.YUGIRI && this.dumpAnim === 0) {
      // Follow finger smoothly with elastic tether around shake zone
      this.zaruTargetPos.set(
        THREE.MathUtils.clamp(pt.x, -1.6, 1.15),
        2.05,
        THREE.MathUtils.clamp(pt.z, -1.25, 1.15)
      );
      this._moveHandTo(this.zaruTargetPos.x + 1.05, 2.55, this.zaruTargetPos.z + 0.35, 'grip');

      // Rapid swipe / back-and-forth flick launches dramatic yugiri water splash arcs!
      if (speed > 0.16 && this.elapsed - this.lastShakeTime > 0.20) {
        const dir = dx >= 0 ? 1 : -1;
        this._triggerYugiriShake(Math.min(1.5, 0.85 + speed * 1.4), dx * 7.5, dz * 7.5);
        this.lastShakeDir = dir;
      }

      // Dragging directly over the donburi bowl after shaking tips the noodles cleanly in!
      if (this.yugiriShakes >= 2 && this._dist2D(pt, POS.bowl) < 0.95) {
        this.dragMode = null;
        this._startDumpToBowl();
      }
    } else if (this.dragMode === 'bowl' && this.phase === PHASES.ENJOY) {
      // Swiping through the hot bowl swirls the dashi & orbiting negi/tenkasu!
      if (speed > 0.03) {
        this.bowlSwirlVel = Math.max(-5.5, Math.min(5.5, this.bowlSwirlVel + (dx - dz) * 3.2));
        this.brothRipple = Math.min(1.0, this.brothRipple + speed * 0.8);
      }
    } else if ((this.dragMode === 'negi' || this.dragMode === 'tenkasu') && this.phase === PHASES.ENJOY) {
      // Dragging from topping plate directly over bowl lets child place toppings wherever she wants!
      this._moveHandTo(pt.x + 0.06, 1.22, pt.z + 0.15, 'pinch');
      if (this._dist2D(pt, POS.bowl) < 0.95 && speed > 0.06 && Math.random() < 0.35) {
        this._scatterTopping(this.dragMode, pt.x, pt.z, 4);
      }
    }

    this.lastWorld.copy(pt);
  }

  _onPointerUp(e) {
    if (this.activePointerId !== e.pointerId) return;
    const tapDuration = this.elapsed - this.downTime;
    const tapDist = this._dist2D(this.downWorld, this.lastWorld);
    const wasTap = tapDuration < 0.35 && tapDist < 0.35;

    if (this.dragMode === 'raw' && this.phase === PHASES.RAW) {
      if (wasTap || this._dist2D(this.lastWorld, POS.pot) < 1.55) {
        // Forgiving: simple tap on raw udon picks it up and drops it cleanly into the pot!
        this._dropRawUdonIntoPot();
      } else {
        // Gently spring back onto wooden plate
        this.rawPrep.rawBundle.position.set(0, 0.06, 0);
      }
    } else if (this.dragMode === 'bowl' && this.phase === PHASES.ENJOY && wasTap && this.eatAnim === 0) {
      // Tap on the finished bowl lifts a steaming bite of noodles with chopsticks!
      this._triggerEatBite();
    }

    this.activePointerId = null;
    this.dragMode = null;
  }

  // ============================================================================
  // CORE PHYSICAL ACTIONS & DISCOVERIES
  // ============================================================================
  _moveHandTo(x, y, z, pose = 'open', holdTime = 0.85) {
    this.handTargetPos.set(x, y, z);
    this.handPose = pose;
    this.handActiveTimer = Math.max(this.handActiveTimer, holdTime);
  }

  _cycleStoveKnob() {
    this.stoveLevel = (this.stoveLevel + 1) % 3;
    this.audio.playKnobClick();
    this._moveHandTo(POS.knob.x + 0.12, 0.55, POS.knob.z + 0.25, 'pinch', 0.45);
    // Turning to max heat triggers an exciting burst of steam & boil-over foam!
    if (this.stoveLevel === 2) {
      this.audio.playSplash(0.55);
      for (let i = 0; i < 6; i++) {
        this.particles.spawnSteam(POS.pot.x, 1.02, POS.pot.z, { spread: 0.72, vy: 1.55, endScale: 2.5, opacity: 0.46 });
      }
    }
  }

  _dropRawUdonIntoPot() {
    if (this.dropRawAnim > 0) return;
    this.dropRawAnim = 0.001;
    this._moveHandTo(POS.pot.x + 0.1, 1.45, POS.pot.z + 0.25, 'pinch', 0.95);
  }

  _startScoopIntoYugiri() {
    this.phase = PHASES.YUGIRI;
    this.yugiriShakes = 0;
    this.pot.potNoodles.visible = false;
    this.zaru.zaruNoodles.visible = true;
    this.zaruTargetPos.copy(POS.zaruShake);
    this.zaruTargetRot.set(0.08, -0.32, 0.05);
    this.zaruNoodleBounceVel = 2.6;
    this.splashWave = 0.95;

    this.audio.playSplash(0.9);
    this.particles.spawnSplashBurst(POS.pot.x, 1.15, POS.pot.z, 28, { speed: 2.1, upBias: 1.9, size: 0.022 });
    for (let i = 0; i < 8; i++) {
      this.particles.spawnSteam(POS.zaruShake.x, 2.0, POS.zaruShake.z, { spread: 0.55, vy: 1.35, endScale: 2.2, opacity: 0.44 });
    }
    this._moveHandTo(POS.zaruShake.x + 1.02, 2.66, POS.zaruShake.z + 0.40, 'grip', 1.4);
  }

  _triggerYugiriShake(power = 1.0, dirX = 0, dirZ = 0) {
    this.lastShakeTime = this.elapsed;
    this.yugiriShakes += 1;

    // Big physical bounce & dramatic wrist flick!
    this.zaruNoodleBounceVel = 4.2 * power;
    this.zaruTargetRot.set(
      (Math.random() - 0.5) * 0.28,
      -0.32 + (Math.random() - 0.5) * 0.36,
      (this.yugiriShakes % 2 === 0 ? 1 : -1) * 0.26 * power
    );
    this.cameraShake.set((Math.random() - 0.5) * 0.11 * power, 0, (Math.random() - 0.5) * 0.11 * power);

    const zp = this.zaru.group.position;
    this.audio.playYugiriShake(power);
    // HUGE, unmistakable glistening water-droplet spray arcs (湯切りの水しぶき粒子)!
    this.particles.spawnSplashBurst(zp.x, zp.y + 0.12, zp.z, Math.floor(46 * power), {
      speed: 2.9 * power,
      upBias: 1.45 * power,
      spreadRadius: 0.46,
      size: 0.024,
      dirX,
      dirZ,
    });
    // Billowing warm steam puff!
    for (let i = 0; i < 8; i++) {
      this.particles.spawnSteam(zp.x, zp.y + 0.35, zp.z, { spread: 0.56, vy: 1.45, endScale: 2.45, opacity: 0.48 });
    }

    // After 3 energetic shakes, smoothly glide over & pour noodles into the donburi bowl!
    if (this.yugiriShakes >= 3) {
      setTimeout(() => {
        if (this.phase === PHASES.YUGIRI && this.dumpAnim === 0) {
          this._startDumpToBowl();
        }
      }, 360);
    }
  }

  _startDumpToBowl() {
    this.dumpAnim = 0.001;
    this.zaruTargetPos.set(POS.bowl.x - 0.15, 1.72, POS.bowl.z - 0.1);
    this.zaruTargetRot.set(0.15, -0.25, -1.65); // Tilt bamboo zaru sharply into bowl!
    this._moveHandTo(POS.bowl.x + 0.85, 2.25, POS.bowl.z + 0.25, 'grip', 1.2);
  }

  _startLadlePour() {
    if (this.ladleState !== 'rest') return;
    this.ladleState = 'scoop';
    this.ladleTimer = 0;
    this.audio.playBubble(false);
    this._moveHandTo(POS.dashiPot.x - 0.45, 1.55, POS.dashiPot.z + 0.35, 'grip', 2.4);
  }

  _scatterTopping(type, targetX, targetZ, count = 12) {
    const isNegi = type === 'negi';
    const pool = isNegi ? this.negiPool : this.tenkasuPool;
    const dishPos = isNegi ? POS.negiDish : POS.tenkasuDish;

    this.wobbles[isNegi ? 'negi' : 'tenkasu'] = 1.0;
    this.audio.playScatter(!isNegi);
    this._moveHandTo(targetX + 0.08, 1.38, targetZ + 0.18, 'pinch', 0.65);

    let spawned = 0;
    for (let i = 0; i < this.maxToppings && spawned < count; i++) {
      const p = pool[i];
      if (!p.active) {
        p.active = true;
        p.landed = false;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * 0.56;
        const destX = THREE.MathUtils.clamp(targetX + Math.cos(ang) * rad, POS.bowl.x - 0.72, POS.bowl.x + 0.72);
        const destZ = THREE.MathUtils.clamp(targetZ + Math.sin(ang) * rad, POS.bowl.z - 0.72, POS.bowl.z + 0.72);

        p.x = dishPos.x * 0.12 + destX * 0.88 + (Math.random() - 0.5) * 0.14;
        p.y = 1.38 + Math.random() * 0.42;
        p.z = dishPos.z * 0.12 + destZ * 0.88 + (Math.random() - 0.5) * 0.14;
        p.vx = (destX - p.x) * 3.1;
        p.vy = -0.35 - Math.random() * 0.7;
        p.vz = (destZ - p.z) * 3.1;
        p.rotX = Math.random() * Math.PI;
        p.rotY = Math.random() * Math.PI * 2;
        p.rotZ = Math.random() * Math.PI;
        p.scale = isNegi ? (0.88 + Math.random() * 0.42) : (0.78 + Math.random() * 0.56);
        spawned++;
        if (isNegi) this.activeNegiCount++;
        else this.activeTenkasuCount++;
      }
    }
  }

  _triggerEatBite() {
    if (this.eatAnim > 0 || this.phase !== PHASES.ENJOY) return;
    this.eatAnim = 0.001;
    this.brothRipple = 0.85;
    this.bowl.brothUniforms.uRippleCenter.value.set(0, 0);
    this._moveHandTo(POS.bowl.x + 0.65, 1.85, POS.bowl.z + 0.35, 'chopsticks', 1.4);
  }

  // ============================================================================
  // UPDATE LOOP (Physics, Boiling, Steam, Ladle Pour, Floating Toppings, Hand)
  // ============================================================================
  _update(dt) {
    this.elapsed += dt;
    this.idleSeconds += dt;

    // 1. Stove flame & overhead bare tungsten bulb subtle warm living flicker
    const targetFlame = this.stoveLevel === 0 ? 0.28 : (this.stoveLevel === 1 ? 0.62 : 1.0);
    this.flameSmooth = THREE.MathUtils.lerp(this.flameSmooth, targetFlame, dt * 4.5);
    this.kitchen.flameUniforms.uTime.value = this.elapsed;
    this.kitchen.flameUniforms.uLevel.value = this.flameSmooth;
    this.gasGlowLight.intensity = 1.0 + this.flameSmooth * 2.8 + Math.sin(this.elapsed * 19) * 0.22;

    // Smooth rotary stove dial rotation
    const dialTargetY = this.stoveLevel === 0 ? 0.72 : (this.stoveLevel === 1 ? 0.0 : -0.78);
    this.kitchen.dialBody.rotation.y = THREE.MathUtils.lerp(this.kitchen.dialBody.rotation.y, dialTargetY, dt * 10);

    // Subtle bare incandescent filament warmth breath
    this.bulbLight.intensity = 29.5 + Math.sin(this.elapsed * 2.7) * 0.65 + Math.sin(this.elapsed * 11.3) * 0.22;
    this.dashi.dashiUniforms.uTime.value = this.elapsed;

    // 2. Boiling Pot Physics & Boil-over Discovery
    const boilIntensity = this.flameSmooth * (this.phase === PHASES.BOIL ? 1.15 : 0.78);
    if (this.stoveLevel === 2 && this.phase === PHASES.BOIL) {
      this.boilOver = Math.min(1.0, this.boilOver + dt * 0.28);
    } else {
      this.boilOver = Math.max(0.0, this.boilOver - dt * 0.35);
    }

    this.potSwirlVel = THREE.MathUtils.lerp(this.potSwirlVel, 0.35 + boilIntensity * 1.1, dt * 1.4);
    this.potSwirlAngle += this.potSwirlVel * dt;
    this.splashWave = Math.max(0, this.splashWave - dt * 1.45);

    this.pot.waterUniforms.uTime.value = this.elapsed;
    this.pot.waterUniforms.uBoil.value = boilIntensity;
    this.pot.waterUniforms.uSwirl.value = this.potSwirlAngle;
    this.pot.waterUniforms.uSplashWave.value = this.splashWave;
    this.pot.waterUniforms.uStarch.value = THREE.MathUtils.lerp(
      this.pot.waterUniforms.uStarch.value,
      this.phase === PHASES.RAW ? 0.08 : (0.35 + this.boilProgress * 0.65),
      dt * 2.0
    );
    this.pot.waterMesh.position.y = 0.88 + this.boilOver * 0.11;

    this.audio.updateBoiling(boilIntensity, this.flameSmooth);

    // Occasional resonant boiling bubble pops
    this.bubbleSoundTimer -= dt * (0.6 + boilIntensity * 1.5);
    if (this.bubbleSoundTimer <= 0) {
      this.bubbleSoundTimer = 0.28 + Math.random() * 0.45;
      if (this.phase === PHASES.BOIL || this.stoveLevel === 2) {
        this.audio.playBubble(Math.random() < 0.35);
      }
    }

    // 3. Drop Raw Udon into Pot animation
    if (this.dropRawAnim > 0) {
      this.dropRawAnim += dt * 1.85;
      const t = Math.min(1, this.dropRawAnim);
      const startW = POS.raw;
      const endW = POS.pot;
      const wx = THREE.MathUtils.lerp(startW.x, endW.x, t);
      const wz = THREE.MathUtils.lerp(startW.z, endW.z, t);
      const wy = Math.sin(t * Math.PI) * 1.35 + THREE.MathUtils.lerp(0.2, 0.82, t);
      this.rawPrep.rawBundle.position.set(
        wx - this.rawPrep.group.position.x,
        wy - this.rawPrep.group.position.y,
        wz - this.rawPrep.group.position.z
      );
      if (t >= 1) {
        this.dropRawAnim = 0;
        this.rawPrep.rawBundle.visible = false;
        this.pot.potNoodles.visible = true;
        this.phase = PHASES.BOIL;
        this.boilProgress = 0.08;
        this.splashWave = 1.0;
        this.potSwirlVel = 4.2;
        this.audio.playSplash(1.15);
        this.particles.spawnSplashBurst(POS.pot.x, 1.0, POS.pot.z, 36, { speed: 2.2, upBias: 1.9, size: 0.024 });
        for (let i = 0; i < 7; i++) {
          this.particles.spawnSteam(POS.pot.x, 1.08, POS.pot.z, { spread: 0.65, vy: 1.45, endScale: 2.4, opacity: 0.45 });
        }
      }
    }

    // 4. Boiling Noodles transformation (raw matte -> plump glossy translucent cooked udon!)
    if (this.phase === PHASES.BOIL) {
      this.boilProgress = Math.min(1.0, this.boilProgress + dt * (0.085 + this.flameSmooth * 0.11));
      this.pot.potNoodles.rotation.y = this.potSwirlAngle * 0.65;
      // Plump up and float higher as they finish boiling!
      const plump = 0.88 + this.boilProgress * 0.22;
      this.pot.potNoodles.scale.set(plump, plump, plump);
      this.pot.potNoodles.position.y = 0.62 + this.boilProgress * 0.14 + Math.sin(this.elapsed * 5.2) * 0.025;

      // Material sheen increases as starch cooks
      this.cookedUdonMat.roughness = THREE.MathUtils.lerp(0.50, 0.14, this.boilProgress);

      if (this.boilProgress >= 1.0) {
        this.phase = PHASES.SCOOP;
        // Subtle natural invitation: bamboo zaru lifts & nudges closer toward the pot rim
        this.zaruTargetPos.set(-0.22, 0.82, -1.24);
        this.zaruTargetRot.set(0.06, -0.58, 0.08);
        this.audio.playBubble(true);
      }
    } else if (this.phase === PHASES.SCOOP) {
      this.pot.potNoodles.rotation.y = this.potSwirlAngle * 0.55;
      this.pot.potNoodles.position.y = 0.76 + Math.sin(this.elapsed * 4.8) * 0.028;
    }

    // 5. Bamboo Zaru spring physics & Dump into Bowl animation
    this.zaru.group.position.lerp(this.zaruTargetPos, Math.min(1, dt * 8.5));
    this.zaru.group.rotation.x = THREE.MathUtils.lerp(this.zaru.group.rotation.x, this.zaruTargetRot.x, Math.min(1, dt * 10));
    this.zaru.group.rotation.y = THREE.MathUtils.lerp(this.zaru.group.rotation.y, this.zaruTargetRot.y, Math.min(1, dt * 10));
    this.zaru.group.rotation.z = THREE.MathUtils.lerp(this.zaru.group.rotation.z, this.zaruTargetRot.z, Math.min(1, dt * 10));

    // Keep hand physically locked onto the bamboo zaru handle during active yugiri & bowl dump!
    if (this.phase === PHASES.YUGIRI && (this.handActiveTimer > 0 || this.dumpAnim > 0)) {
      this.zaru.group.updateMatrixWorld(true);
      const zGrip = new THREE.Vector3(1.36, 0.70, 0.0).applyMatrix4(this.zaru.group.matrixWorld);
      this._moveHandTo(zGrip.x + 0.04, zGrip.y + 0.09, zGrip.z + 0.14, 'grip', 0.25);
    }

    // Springy physical noodle mound bounce inside zaru during yugiri!
    this.zaruNoodleBounceVel += (-26.0 * this.zaruNoodleBounce - 6.5 * this.zaruNoodleBounceVel) * dt;
    this.zaruNoodleBounce += this.zaruNoodleBounceVel * dt;
    if (this.zaruNoodleBounce < -0.08) {
      this.zaruNoodleBounce = -0.08;
      this.zaruNoodleBounceVel *= -0.3;
    }
    this.zaru.zaruNoodles.position.y = 0.14 + Math.max(0, this.zaruNoodleBounce * 0.22);
    const squash = 1.0 - this.zaruNoodleBounce * 0.18;
    this.zaru.zaruNoodles.scale.set(squash, 1.0 + this.zaruNoodleBounce * 0.28, squash);

    if (this.dumpAnim > 0) {
      this.dumpAnim += dt * 1.45;
      if (this.dumpAnim >= 0.52 && this.zaru.zaruNoodles.visible) {
        this.zaru.zaruNoodles.visible = false;
        this.bowl.bowlNoodles.visible = true;
        this.bowl.bowlNoodles.position.y = 0.24;
        this.bowl.bowlNoodles.scale.set(1.06, 0.88, 1.06);
        this.audio.playNoodleDump();
        this.particles.spawnSplashBurst(POS.bowl.x, 0.78, POS.bowl.z, 20, { speed: 1.45, upBias: 1.3, size: 0.020 });
        for (let i = 0; i < 6; i++) {
          this.particles.spawnSteam(POS.bowl.x, 0.92, POS.bowl.z, { spread: 0.45, vy: 1.25, endScale: 2.1, opacity: 0.42 });
        }
      }
      if (this.dumpAnim >= 1.15) {
        this.dumpAnim = 0;
        this.zaruTargetPos.copy(POS.zaruRest);
        this.zaruTargetRot.set(0, -0.45, 0);
        this.phase = PHASES.POUR;
      }
    }

    // 6. Ladle Scoop & Golden Dashi Pouring Sequence
    this._updateLadlePour(dt);

    // 7. Bowl Noodles & Dashi Broth Visuals
    if (this.bowl.bowlNoodles.visible) {
      const biteRatio = Math.max(0.05, 1.0 - this.bitesTaken / this.maxBites);
      const targetScale = this.bitesTaken >= this.maxBites ? 0.001 : (0.52 + biteRatio * 0.48);
      this.bowl.bowlNoodles.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), dt * 6.5);
      // Noodles gently buoy upward as broth fills!
      const floatY = 0.24 + Math.min(1.0, this.brothLevel) * 0.14;
      this.bowl.bowlNoodles.position.y = THREE.MathUtils.lerp(this.bowl.bowlNoodles.position.y, floatY, dt * 4.0);
      this.bowl.bowlNoodles.rotation.y += this.bowlSwirlVel * 0.12 * dt;
    }

    const effBroth = Math.max(0, this.brothLevel * Math.max(0, 1.0 - (this.bitesTaken / this.maxBites) * 0.92));
    this.bowlSwirlVel *= Math.exp(-dt * 2.1);
    this.bowlSwirlAngle += this.bowlSwirlVel * dt;
    this.brothRipple = Math.max(0, this.brothRipple - dt * 1.1);

    if (effBroth > 0.02) {
      this.bowl.brothMesh.visible = true;
      const clampedLevel = Math.min(1.05, effBroth);
      const surfaceY = 0.24 + clampedLevel * 0.55;
      const surfaceRadius = 0.56 + clampedLevel * 0.52;
      this.bowl.brothMesh.position.y = surfaceY;
      this.bowl.brothMesh.scale.set(surfaceRadius, 1, surfaceRadius);
      this.bowl.brothUniforms.uTime.value = this.elapsed;
      this.bowl.brothUniforms.uRipple.value = this.brothRipple;
      this.bowl.brothUniforms.uSwirl.value = this.bowlSwirlAngle;
      this.bowl.brothUniforms.uOpacity.value = Math.min(1.0, effBroth * 1.8);
    } else {
      this.bowl.brothMesh.visible = false;
    }

    // Playful golden counter overflow puddle if child overfills the bowl!
    if (this.brothLevel > 1.02) {
      this.overflowAmount = Math.min(1.0, this.overflowAmount + dt * 0.55);
    }
    this.bowl.overflowPuddle.material.opacity = this.overflowAmount * 0.62;
    this.bowl.overflowPuddle.scale.setScalar(0.82 + this.overflowAmount * 0.34);

    // 8. Floating Negi & Crispy Tenkasu Toppings (3D drop arcs + fluid swirl physics!)
    this._updateFloatingToppings(dt, 0.24 + Math.min(1.05, effBroth) * 0.55);

    // 9. Chopsticks Lift & Eat Bite Sequence + Bowl Complete Reward!
    this._updateEating(dt);

    // 10. Billowing Volumetric Steam Emission (真冬の夜のもうもうと立つ湯気!)
    this._emitContinuousSteam(dt, boilIntensity, effBroth);

    // 11. Subtle micro-wobbles on touched non-active props
    this._updateWobbles(dt);

    // 12. Realistic 3D Hand Positioning & Subtle 10-second Idle Demonstration
    this._updateHandAndIdleHint(dt);

    // 13. Camera recoil damping
    this.cameraShake.multiplyScalar(Math.exp(-dt * 12));
    this.camera.position.copy(this.cameraBasePos).add(this.cameraShake);
    this.camera.lookAt(this.cameraTarget);

    // 14. Update particles
    this.particles.update(dt, POS.pot, 0.94, boilIntensity, this.boilOver, this.elapsed);
  }

  _updateLadlePour(dt) {
    if (this.ladleState === 'rest') {
      const restBob = Math.sin(this.elapsed * 2.2) * 0.015;
      this.ladleTargetPos.set(POS.dashiPot.x + 0.04, POS.dashiPot.y - 0.16 + restBob, POS.dashiPot.z + 0.06);
      this.ladleTargetRot.set(0, 0, 0);
      this.dashi.pourStream.visible = false;
      this.audio.setPouring(false);
    } else if (this.ladleState === 'scoop') {
      this.ladleTimer += dt;
      this.ladleTargetPos.set(POS.dashiPot.x, POS.dashiPot.y + 0.45, POS.dashiPot.z);
      this.ladleTargetRot.set(0.08, 0.2, 0.05);
      if (this.ladleTimer > 0.35) {
        this.ladleState = 'carry';
        this.ladleTimer = 0;
      }
    } else if (this.ladleState === 'carry') {
      this.ladleTimer += dt;
      this.ladleTargetPos.set(POS.bowl.x - 0.05, 1.72, POS.bowl.z - 0.12);
      this.ladleTargetRot.set(0.05, -0.22, 0.05);
      if (this.ladleTimer > 0.42) {
        this.ladleState = 'pour';
        this.ladleTimer = 0;
      }
    } else if (this.ladleState === 'pour') {
      this.ladleTimer += dt;
      this.ladleTargetPos.set(POS.bowl.x - 0.06, 1.66, POS.bowl.z - 0.08);
      this.ladleTargetRot.set(0.18, -0.22, -0.92); // Tilt ladle to pour amber dashi!
      this.dashi.pourStream.visible = true;
      this.dashi.pourStream.position.set(POS.bowl.x + 0.02, 1.72, POS.bowl.z - 0.04);
      const pulse = 0.88 + Math.sin(this.elapsed * 26) * 0.12;
      this.dashi.pourStream.scale.set(pulse, 1.0, pulse);

      this.brothLevel = Math.min(1.28, this.brothLevel + dt * 0.85);
      this.brothRipple = 0.92;
      this.bowl.brothUniforms.uRippleCenter.value.set(0.08, 0.02);
      this.audio.setPouring(true, Math.min(1, this.brothLevel));

      if (Math.random() < 0.35) {
        this.particles.spawnSplashBurst(POS.bowl.x + 0.08, 0.65 + Math.min(1, this.brothLevel) * 0.2, POS.bowl.z, 2, {
          speed: 0.75, upBias: 0.9, spreadRadius: 0.12, size: 0.024, amber: true,
        });
      }
      if (Math.random() < 0.38) {
        this.particles.spawnSteam(POS.bowl.x, 0.95, POS.bowl.z, { spread: 0.48, vy: 1.25, endScale: 2.0, opacity: 0.38 });
      }
      if (this.brothLevel > 1.04 && Math.random() < 0.22) {
        this.particles.spawnSplashBurst(POS.bowl.x + 0.95, 0.85, POS.bowl.z + 0.35, 3, {
          speed: 0.9, upBias: 0.3, spreadRadius: 0.18, size: 0.026, amber: true,
        });
      }

      if (this.ladleTimer > 1.05) {
        this.ladleState = 'return';
        this.ladleTimer = 0;
        this.dashi.pourStream.visible = false;
        this.audio.setPouring(false);
        if (this.phase === PHASES.POUR && this.brothLevel >= 0.68) {
          this.phase = PHASES.ENJOY;
        }
      }
    } else if (this.ladleState === 'return') {
      this.ladleTimer += dt;
      this.ladleTargetPos.set(POS.dashiPot.x + 0.04, POS.dashiPot.y - 0.16, POS.dashiPot.z + 0.06);
      this.ladleTargetRot.set(0, 0, 0);
      if (this.ladleTimer > 0.55) {
        this.ladleState = 'rest';
      }
    }

    this.dashi.ladleGroup.position.lerp(this.ladleTargetPos, Math.min(1, dt * 8.5));
    this.dashi.ladleGroup.rotation.x = THREE.MathUtils.lerp(this.dashi.ladleGroup.rotation.x, this.ladleTargetRot.x, Math.min(1, dt * 9));
    this.dashi.ladleGroup.rotation.y = THREE.MathUtils.lerp(this.dashi.ladleGroup.rotation.y, this.ladleTargetRot.y, Math.min(1, dt * 9));
    this.dashi.ladleGroup.rotation.z = THREE.MathUtils.lerp(this.dashi.ladleGroup.rotation.z, this.ladleTargetRot.z, Math.min(1, dt * 9));
    this.dashi.ladleLiquid.visible = this.ladleState !== 'return';

    // Attach hand cleanly right OVER the ladle's wooden handle grip (zero handle poke-through!)
    if (this.ladleState === 'scoop' || this.ladleState === 'carry' || this.ladleState === 'pour') {
      this.dashi.ladleGroup.updateMatrixWorld(true);
      const gripWorld = new THREE.Vector3(-0.90, 1.12, 0.37).applyMatrix4(this.dashi.ladleGroup.matrixWorld);
      this._moveHandTo(gripWorld.x + 0.08, gripWorld.y + 0.34, gripWorld.z + 0.26, 'grip', 0.35);
    }
  }

  _updateFloatingToppings(dt, surfaceY) {
    const updatePool = (pool, mesh, isNegi) => {
      let dirty = false;
      for (let i = 0; i < this.maxToppings; i++) {
        const p = pool[i];
        if (!p.active) continue;
        dirty = true;

        if (!p.landed) {
          p.vy -= 7.2 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.rotX += dt * 3.5;
          p.rotZ += dt * 2.8;
          if (p.y <= surfaceY + 0.025) {
            p.y = surfaceY + 0.02;
            p.landed = true;
            p.vx = 0;
            p.vy = 0;
            p.vz = 0;
            p.rotX = isNegi ? (Math.random() - 0.5) * 0.32 : Math.random() * Math.PI;
            p.rotZ = isNegi ? (Math.random() - 0.5) * 0.32 : Math.random() * Math.PI;
            this.brothRipple = Math.min(1.0, this.brothRipple + 0.25);
          }
        } else {
          // Orbit gently with bowl dashi swirl current & bob on hot broth!
          const rx = p.x - POS.bowl.x;
          const rz = p.z - POS.bowl.z;
          const dist = Math.hypot(rx, rz);
          const ang = Math.atan2(rz, rx) + (this.bowlSwirlVel * 0.42 + 0.07) * dt;
          const maxR = 0.78;
          const clampedR = Math.min(maxR, dist);
          p.x = POS.bowl.x + Math.cos(ang) * clampedR;
          p.z = POS.bowl.z + Math.sin(ang) * clampedR;
          // Rest atop central glistening udon dome in the middle, and float on amber dashi around edges!
          const domeBoost = Math.pow(Math.max(0, 1.0 - clampedR / 0.68), 1.4) * 0.145;
          p.y = surfaceY + 0.018 + domeBoost + Math.sin(this.elapsed * 2.8 + i * 1.3) * 0.007;
          p.rotY += (this.bowlSwirlVel * 0.4 + 0.08) * dt;
        }

        // Gradually reduce toppings on final bites so painted bottom reveals cleanly!
        const eatShrink = this.bitesTaken >= this.maxBites ? 0.001 : (i < this.bitesTaken * 10 ? 0.001 : 1.0);
        this._topDummy.position.set(p.x, p.y, p.z);
        this._topDummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        this._topDummy.scale.setScalar(p.scale * eatShrink);
        this._topDummy.updateMatrix();
        mesh.setMatrixAt(i, this._topDummy.matrix);
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    };

    updatePool(this.negiPool, this.negiMesh, true);
    updatePool(this.tenkasuPool, this.tenkasuMesh, false);
  }

  _updateEating(dt) {
    if (this.eatAnim > 0) {
      this.eatAnim += dt;
      if (this.eatAnim < 0.35) {
        // Dip chopsticks into the steaming donburi bowl
        const t = this.eatAnim / 0.35;
        this.chopsticks.sticksGroup.position.lerpVectors(
          POS.chopsticksRest,
          new THREE.Vector3(POS.bowl.x + 0.92, 0.85, POS.bowl.z + 0.08),
          t
        );
        this.chopsticks.sticksGroup.rotation.set(0, 0.14, 0.35 * t);
      } else if (this.eatAnim < 1.05) {
        // Lift a BIG glistening bundle of steaming udon right toward the overhead camera!
        const t = (this.eatAnim - 0.35) / 0.70;
        const ease = 1 - Math.pow(1 - t, 2.2);
        this.chopsticks.liftedBite.visible = true;
        this.chopsticks.sticksGroup.position.set(
          POS.bowl.x + 0.92,
          0.85 + ease * 1.42,
          POS.bowl.z + 0.08 + ease * 0.22
        );
        this.chopsticks.sticksGroup.rotation.set(0, 0.14, 0.35 - ease * 0.25);
        // Keep hand naturally gripping the chopsticks shaft while lifting noodles!
        this.chopsticks.sticksGroup.updateMatrixWorld(true);
        const stickGrip = new THREE.Vector3(0.45, 0.05, 0.02).applyMatrix4(this.chopsticks.sticksGroup.matrixWorld);
        this._moveHandTo(stickGrip.x + 0.08, stickGrip.y + 0.16, stickGrip.z + 0.22, 'chopsticks', 0.4);
        if (Math.random() < 0.32) {
          this.particles.spawnSteam(POS.bowl.x, 1.45 + ease * 0.7, POS.bowl.z, { spread: 0.3, vy: 1.35, endScale: 1.65, opacity: 0.24 });
        }
      } else if (this.eatAnim < 1.45) {
        // Slurp!
        if (this.chopsticks.liftedBite.visible) {
          this.chopsticks.liftedBite.visible = false;
          this.bitesTaken += 1;
          this.audio.playSlurp();
          this.particles.spawnSplashBurst(POS.bowl.x, 1.3, POS.bowl.z, 10, { speed: 1.1, upBias: 1.0, size: 0.025, amber: true });
        }
        const t = (this.eatAnim - 1.05) / 0.40;
        this.chopsticks.sticksGroup.position.lerp(POS.chopsticksRest, t);
        this.chopsticks.sticksGroup.rotation.set(0, 0.04, 0.1 * (1 - t));
      } else {
        this.eatAnim = 0;
        this.chopsticks.sticksGroup.position.copy(POS.chopsticksRest);
        this.chopsticks.sticksGroup.rotation.set(0, 0.04, 0);

        if (this.bitesTaken >= this.maxBites) {
          this.phase = PHASES.COMPLETE;
          this.completeTimer = 0;
          this.audio.playCompleteChime();
        }
      }
    }

    if (this.eatAnim === 0 && this.dragMode !== 'stir') {
      this.chopsticks.sticksGroup.position.lerp(POS.chopsticksRest, Math.min(1, dt * 8));
      this.chopsticks.sticksGroup.rotation.x = THREE.MathUtils.lerp(this.chopsticks.sticksGroup.rotation.x, 0, Math.min(1, dt * 8));
      this.chopsticks.sticksGroup.rotation.y = THREE.MathUtils.lerp(this.chopsticks.sticksGroup.rotation.y, 0.04, Math.min(1, dt * 8));
      this.chopsticks.sticksGroup.rotation.z = THREE.MathUtils.lerp(this.chopsticks.sticksGroup.rotation.z, 0, Math.min(1, dt * 8));
    }

    if (this.phase === PHASES.COMPLETE) {
      this.completeTimer += dt;
      // Pause ~2.4s so child delights in seeing the hidden Showa medallion at the empty bowl bottom, then reset cleanly!
      if (this.completeTimer > 2.4) {
        this._resetForNewBowl();
      }
    }
  }

  _emitContinuousSteam(dt, boilIntensity, effBroth) {
    this.steamAccum += dt;
    const rate = 0.055; // ~18 puffs/sec total distributed across hot vessels
    if (this.steamAccum < rate) return;
    this.steamAccum -= rate;

    // 1. Thick yet translucent curling winter-night steam tendrils from the big boiling pot (もうもうと立つ湯気!)
    const potCount = this.stoveLevel === 2 ? 2 : 1;
    for (let i = 0; i < potCount; i++) {
      this.particles.spawnSteam(POS.pot.x, 1.02, POS.pot.z, {
        spread: 0.72,
        vy: 0.92 + boilIntensity * 0.65,
        startScale: 0.56,
        endScale: 2.15 + boilIntensity * 0.45,
        life: 2.05,
        opacity: 0.14 + boilIntensity * 0.11,
      });
    }

    // 2. Gentle curling warm steam rising from the amber dashi saucepan
    if (Math.random() < 0.42) {
      this.particles.spawnSteam(POS.dashiPot.x, 0.68, POS.dashiPot.z, {
        spread: 0.40,
        vy: 0.72,
        startScale: 0.34,
        endScale: 1.35,
        life: 1.8,
        opacity: 0.15,
      });
    }

    // 3. Steaming wet noodles inside the lifted bamboo zaru during yugiri
    if (this.phase === PHASES.YUGIRI && this.zaru.zaruNoodles.visible) {
      const zp = this.zaru.group.position;
      this.particles.spawnSteam(zp.x, zp.y + 0.35, zp.z, {
        spread: 0.40,
        vy: 1.05,
        startScale: 0.42,
        endScale: 1.65,
        life: 1.55,
        opacity: 0.22,
      });
    }

    // 4. Steaming hot served udon donburi bowl!
    if (this.bowl.bowlNoodles.visible && this.bitesTaken < this.maxBites) {
      if (Math.random() < (effBroth > 0.2 ? 0.78 : 0.45)) {
        this.particles.spawnSteam(POS.bowl.x, 0.90, POS.bowl.z, {
          spread: 0.52,
          vy: 0.92,
          startScale: 0.44,
          endScale: 1.75,
          life: 1.95,
          opacity: effBroth > 0.2 ? 0.20 : 0.14,
        });
      }
    }
  }

  _updateWobbles(dt) {
    const decay = Math.exp(-dt * 11);
    for (const key of Object.keys(this.wobbles)) {
      if (this.wobbles[key] > 0.002) this.wobbles[key] *= decay;
      else this.wobbles[key] = 0;
    }
    this.bowl.group.rotation.z = Math.sin(this.elapsed * 28) * 0.045 * this.wobbles.bowl;
    this.dishes.negiDish.rotation.z = Math.sin(this.elapsed * 30) * 0.06 * this.wobbles.negi;
    this.dishes.tenkasuDish.rotation.z = Math.sin(this.elapsed * 30) * 0.06 * this.wobbles.tenkasu;
    this.dashi.potGroup.rotation.z = Math.sin(this.elapsed * 26) * 0.035 * this.wobbles.dashi;
    this.rawPrep.group.rotation.z = Math.sin(this.elapsed * 28) * 0.06 * this.wobbles.raw;
    if (this.wobbles.zaru > 0.01 && this.phase !== PHASES.YUGIRI) {
      this.zaru.group.rotation.z += Math.sin(this.elapsed * 26) * 0.05 * this.wobbles.zaru;
    }
  }

  _updateHandAndIdleHint(dt) {
    // Wordless idle guidance: 0-10s nothing; after 10s of inactivity, hand gently demonstrates ONCE!
    if (this.idleSeconds > 10.5 && this.hintAnim === 0 && this.activePointerId === null && this.phase !== PHASES.COMPLETE) {
      this.hintAnim = 0.001;
    }

    if (this.hintAnim > 0) {
      this.hintAnim += dt;
      const t = Math.min(1, this.hintAnim / 2.2);
      const ease = Math.sin(t * Math.PI);
      if (this.phase === PHASES.RAW) {
        const hx = THREE.MathUtils.lerp(POS.raw.x, POS.pot.x, t);
        const hz = THREE.MathUtils.lerp(POS.raw.z, POS.pot.z, t);
        this.handTargetPos.set(hx + 0.1, 1.35 + ease * 0.3, hz + 0.25);
        this.handPose = 'pinch';
      } else if (this.phase === PHASES.BOIL) {
        const a = t * Math.PI * 2;
        this.handTargetPos.set(POS.pot.x + Math.cos(a) * 0.45 + 0.2, 1.55, POS.pot.z + Math.sin(a) * 0.45 + 0.35);
        this.handPose = 'open';
      } else if (this.phase === PHASES.SCOOP || this.phase === PHASES.YUGIRI) {
        const zp = this.zaru.group.position;
        this.handTargetPos.set(zp.x + 0.85 + Math.sin(t * Math.PI * 4) * 0.28, 2.15, zp.z + 0.35);
        this.handPose = 'grip';
      } else if (this.phase === PHASES.POUR) {
        const hx = THREE.MathUtils.lerp(POS.dashiPot.x, POS.bowl.x, t);
        const hz = THREE.MathUtils.lerp(POS.dashiPot.z, POS.bowl.z, t);
        this.handTargetPos.set(hx, 1.85, hz + 0.35);
        this.handPose = 'grip';
      } else if (this.phase === PHASES.ENJOY) {
        const target = this.activeNegiCount === 0 ? POS.negiDish : (this.activeTenkasuCount === 0 ? POS.tenkasuDish : POS.bowl);
        const hx = THREE.MathUtils.lerp(target.x, POS.bowl.x, t);
        const hz = THREE.MathUtils.lerp(target.z, POS.bowl.z, t);
        this.handTargetPos.set(hx + 0.1, 1.55, hz + 0.25);
        this.handPose = 'pinch';
      }
      if (this.hintAnim >= 2.2) {
        this.hintAnim = 0;
        this.idleSeconds = 0; // Only once per 10s wait!
      }
    } else if (this.handActiveTimer > 0) {
      this.handActiveTimer -= dt;
    } else {
      // Gracefully retreat completely off the bottom frame (even on tall 9:19.5 portrait iPhones!)
      const hideZ = Math.max(6.8, this.cameraBasePos.z + this.cameraBasePos.y * 0.62);
      this.handTargetPos.set(0.55, 1.65, hideZ);
      this.handPose = 'open';
    }

    this.hand.root.position.lerp(this.handTargetPos, Math.min(1, dt * 7.5));
    const targetRotY = THREE.MathUtils.clamp(-(this.hand.root.position.x - 0.3) * 0.12, -0.35, 0.35);
    this.hand.root.rotation.y = THREE.MathUtils.lerp(this.hand.root.rotation.y, targetRotY, dt * 6);
    this.hand.setPose(this.handPose);
  }

  // Helper exclusively for automated visual verification of every gameplay stage
  _debugJumpToState(stateName) {
    this._resetForNewBowl();
    if (stateName === 'raw') {
      this.idleSeconds = 0;
    } else if (stateName === 'boil') {
      this.rawPrep.rawBundle.visible = false;
      this.pot.potNoodles.visible = true;
      this.phase = PHASES.BOIL;
      this.stoveLevel = 2;
      this.flameSmooth = 1.0;
      this.boilProgress = 0.72;
      this.boilOver = 0.55;
      this.cookedUdonMat.roughness = 0.18;
      this.chopsticks.sticksGroup.position.set(POS.pot.x + 0.42, 1.24, POS.pot.z + 0.14);
      this.chopsticks.sticksGroup.rotation.set(0, 0.35, 0.62);
      this.dragMode = 'stir';
      this._moveHandTo(POS.pot.x + 0.62, 1.54, POS.pot.z + 0.42, 'chopsticks', 4.0);
      this.hand.root.position.copy(this.handTargetPos);
      for (let i = 0; i < 10; i++) {
        this.particles.spawnSteam(POS.pot.x, 1.0 + Math.random() * 1.2, POS.pot.z, { spread: 0.72, vy: 1.1, endScale: 2.1, opacity: 0.22 });
      }
    } else if (stateName === 'yugiri') {
      this.rawPrep.rawBundle.visible = false;
      this.phase = PHASES.YUGIRI;
      this.cookedUdonMat.roughness = 0.14;
      this.zaru.zaruNoodles.visible = true;
      this.zaru.group.position.copy(POS.zaruShake);
      this.zaruTargetPos.copy(POS.zaruShake);
      this._moveHandTo(POS.zaruShake.x + 1.08, 2.66, POS.zaruShake.z + 0.42, 'grip', 4.0);
      this.hand.root.position.copy(this.handTargetPos);
      this._triggerYugiriShake(1.35, 1.8, -0.6);
      this.yugiriShakes = 1; // keep in yugiri for screenshot
      for (let i = 0; i < 9; i++) {
        this.particles.spawnSteam(POS.zaruShake.x, 2.1 + Math.random() * 0.8, POS.zaruShake.z, { spread: 0.56, vy: 1.0, endScale: 1.85, opacity: 0.24 });
      }
    } else if (stateName === 'pour') {
      this.rawPrep.rawBundle.visible = false;
      this.bowl.bowlNoodles.visible = true;
      this.cookedUdonMat.roughness = 0.14;
      this.phase = PHASES.POUR;
      this.brothLevel = 0.55;
      this.ladleState = 'pour';
      this.ladleTimer = 0.2;
      this.dashi.ladleGroup.position.set(POS.bowl.x - 0.06, 1.66, POS.bowl.z - 0.08);
      this.dashi.ladleGroup.rotation.set(0.18, -0.22, -0.92);
      this.dashi.ladleGroup.updateMatrixWorld(true);
      const gW = new THREE.Vector3(-0.90, 1.12, 0.37).applyMatrix4(this.dashi.ladleGroup.matrixWorld);
      this.dashi.pourStream.visible = true;
      this.dashi.pourStream.position.set(POS.bowl.x + 0.02, 1.72, POS.bowl.z - 0.04);
      this._moveHandTo(gW.x + 0.08, gW.y + 0.34, gW.z + 0.26, 'grip', 4.0);
      this.hand.root.position.copy(this.handTargetPos);
    } else if (stateName === 'topped') {
      this.rawPrep.rawBundle.visible = false;
      this.bowl.bowlNoodles.visible = true;
      this.cookedUdonMat.roughness = 0.12;
      this.phase = PHASES.ENJOY;
      this.brothLevel = 0.94;
      this._scatterTopping('negi', POS.bowl.x, POS.bowl.z, 34);
      this._scatterTopping('tenkasu', POS.bowl.x, POS.bowl.z, 36);
      // Place toppings organically across the center & floating broth ring of the bowl!
      for (let i = 0; i < this.maxToppings; i++) {
        if (this.negiPool[i].active) {
          const ang = i * 2.39996;
          const r = 0.08 + Math.sqrt((i % 34) / 34) * 0.58;
          this.negiPool[i].x = POS.bowl.x + Math.cos(ang) * r - 0.06;
          this.negiPool[i].z = POS.bowl.z + Math.sin(ang) * r - 0.04;
          this.negiPool[i].y = 0.785;
          this.negiPool[i].rotX = (Math.sin(i * 3.1)) * 0.25;
          this.negiPool[i].rotZ = (Math.cos(i * 2.7)) * 0.25;
          this.negiPool[i].landed = true;
        }
        if (this.tenkasuPool[i].active) {
          const ang = i * 2.39996 + 1.1;
          const r = 0.12 + Math.sqrt((i % 36) / 36) * 0.62;
          this.tenkasuPool[i].x = POS.bowl.x + Math.cos(ang) * r + 0.05;
          this.tenkasuPool[i].z = POS.bowl.z + Math.sin(ang) * r + 0.06;
          this.tenkasuPool[i].y = 0.785;
          this.tenkasuPool[i].landed = true;
        }
      }
      this.handActiveTimer = 0;
      const hideZ = Math.max(6.8, this.cameraBasePos.z + this.cameraBasePos.y * 0.62);
      this.hand.root.position.set(0.55, 1.65, hideZ);
      this.handTargetPos.set(0.55, 1.65, hideZ);
      for (let i = 0; i < 10; i++) {
        this.particles.spawnSteam(POS.bowl.x, 0.95 + Math.random() * 1.0, POS.bowl.z, { spread: 0.52, vy: 0.95, endScale: 1.85, opacity: 0.22 });
        this.particles.spawnSteam(POS.pot.x, 1.0 + Math.random() * 1.1, POS.pot.z, { spread: 0.68, vy: 1.0, endScale: 1.95, opacity: 0.20 });
      }
    } else if (stateName === 'eat') {
      this._debugJumpToState('topped');
      this.eatAnim = 0.36; // Early lift so stepping frames lands cleanly at peak steaming noodle lift!
      this.chopsticks.liftedBite.visible = true;
      this.chopsticks.sticksGroup.position.set(POS.bowl.x + 0.92, 1.85, POS.bowl.z + 0.22);
      this.chopsticks.sticksGroup.rotation.set(0, 0.14, 0.18);
      this.chopsticks.sticksGroup.updateMatrixWorld(true);
      const sg = new THREE.Vector3(0.45, 0.05, 0.02).applyMatrix4(this.chopsticks.sticksGroup.matrixWorld);
      this._moveHandTo(sg.x + 0.08, sg.y + 0.16, sg.z + 0.22, 'chopsticks', 4.0);
      this.hand.root.position.copy(this.handTargetPos);
    }
  }

  _renderFrame() {
    this.postprocess.render(this.scene, this.camera, this.elapsed, () => {
      this.lastSceneTriangles = this.renderer.info.render.triangles;
      this.lastSceneCalls = this.renderer.info.render.calls;
    });
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this._update(dt);
    this._renderFrame();
  }
}

new UdonKitchenGame();
