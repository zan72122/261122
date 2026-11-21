import * as THREE from '../vendor/three.module.js';
import { SoundEngine } from './audio.js';
import {
  createWatercolorKitchenBackdrop,
  createWoodCounterTexture,
  createCeramicTexture,
  createSkinTexture,
  createParticleTextures,
  DynamicMeatTexture,
  DynamicGirlFace,
} from './textures.js';
import { ParticleSystem } from './particles.js';
import {
  createEnvironment,
  createGirlCharacter,
  createCookingHand,
  createHamburgPatty,
  createMixingBowl,
  createSaltShaker,
  createStoveAndPan,
  createDinnerPlate,
  createSauceTools,
  createFork,
} from './meshes.js';

export class HamburgGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.sound = new SoundEngine();

    // Renderer tuned for 30fps+ on iPhone/iPad (pixelRatio max 1.5, soft shadows)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // helpful for crisp screenshot capture
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8ecd9);
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camPos = new THREE.Vector3(0, 4.4, 6.2);
    this.camTarget = new THREE.Vector3(0, 0.85, 0);
    this.camGoalPos = this.camPos.clone();
    this.camGoalTarget = this.camTarget.clone();

    // Warm Studio Ghibli afternoon sunlight rig (warm creamy sky + peach bounce + sunlit key light)
    const hemi = new THREE.HemisphereLight(0xfff9ea, 0xf2c59f, 1.15);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1d4, 1.45);
    sun.position.set(-4.5, 8.5, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 22;
    const d = 5.8;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    const rimLight = new THREE.DirectionalLight(0xffdcb8, 0.55);
    rimLight.position.set(4.5, 4.0, -3.5);
    this.scene.add(rimLight);

    // Build watercolor textures (all <= 1024px!)
    this.texBackdrop = createWatercolorKitchenBackdrop();
    this.texWood = createWoodCounterTexture();
    this.texBowl = createCeramicTexture('bowl');
    this.texPlate = createCeramicTexture('plate');
    this.texBoat = createCeramicTexture('boat');
    this.texSkin = createSkinTexture();
    this.texParticles = createParticleTextures();
    this.meatTex = new DynamicMeatTexture();
    this.girlFace = new DynamicGirlFace();

    // Particle System
    this.particles = new ParticleSystem(this.scene, this.texParticles);

    // Environment
    this.env = createEnvironment(this.texBackdrop, this.texWood);
    this.scene.add(this.env.group);

    // Expressive Anime Girl
    this.girl = createGirlCharacter(this.girlFace, this.texSkin);
    this.girl.root.position.set(0, 1.55, -2.55);
    this.scene.add(this.girl.root);

    // Large Warm 3D Cooking Hands (Left, Right, and idle-only translucent Hint Hand)
    this.handL = createCookingHand(-1, this.texSkin, false);
    this.handR = createCookingHand(1, this.texSkin, false);
    this.handL.root.scale.setScalar(1.18);
    this.handR.root.scale.setScalar(1.18);
    this.scene.add(this.handL.root);
    this.scene.add(this.handR.root);

    this.hintHand = createCookingHand(1, this.texSkin, true);
    this.hintHand.root.scale.setScalar(0.95);
    this.hintHand.root.visible = false;
    this.scene.add(this.hintHand.root);

    // Deformable Hamburg Patty
    this.patty = createHamburgPatty(this.meatTex);
    this.scene.add(this.patty.root);

    // Stage 1: Mixing Bowl & Salt Shaker
    this.bowl = createMixingBowl(this.texBowl);
    this.bowl.position.set(0, 0, 0.2);
    this.scene.add(this.bowl);

    this.saltShaker = createSaltShaker();
    this.saltShaker.position.set(-2.45, 0, 0.65);
    this.scene.add(this.saltShaker);

    // Stage 3: Stove, Pan, Butter, Lid, Spatula
    this.stove = createStoveAndPan();
    this.stove.root.visible = false;
    this.scene.add(this.stove.root);

    // Stage 4 & 5: Dinner Plate, Sauce Boat, Ketchup, Fried Egg Dish, Fork
    this.plate = createDinnerPlate(this.texPlate);
    this.plate.root.visible = false;
    this.scene.add(this.plate.root);

    this.sauceTools = createSauceTools(this.texBoat);
    this.sauceTools.root.visible = false;
    this.scene.add(this.sauceTools.root);

    this.fork = createFork();
    this.fork.group.visible = false;
    this.scene.add(this.fork.group);

    // Fresh Replay Bowl (appears smoothly beside the clean plate at the end of Stage 5!)
    this.replayBowl = createMixingBowl(this.texBowl);
    this.replayBowl.scale.setScalar(0.62);
    this.replayBowl.position.set(2.85, 0, 0.85);
    this.replayBowl.visible = false;
    this.scene.add(this.replayBowl);

    // Pointer / One-Finger Input State
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.activePointerId = null;
    this.pointerDownPos = { x: 0, y: 0 };
    this.lastPointerPos = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragTarget = null;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
    this.dragWorldPoint = new THREE.Vector3();

    // Game State & Causal Memory across stages
    this.time = 0;
    this.stage = 'knead'; // knead | pat | cook | sauce | eat
    this.stageTime = 0;
    this.idleTimer = 0;
    this.hintActiveTimer = 0;
    this.blinkTimer = 2.6;
    this.girlMood = 'curious';
    this.girlMoodTimer = 0;
    this.girlExcitement = 0;
    this.girlChewPhase = 0;

    // Performance tracking
    this.fps = 60;
    this._frameCount = 0;
    this._fpsAcc = 0;

    this.resetRound();
    this._bindEvents();
    this.resize();
  }

  resetRound() {
    this.sound.stopSizzleLoop();

    // Causal recipe memory
    this.mem = {
      kneadProgress: 0,
      eggPopped: false,
      saltAdded: false,
      patCount: 0,
      patHandSide: -1, // -1 left, +1 right
      patFlight: null,
      dimpleDone: false,
      dimpleDepth: 0,
      cookPhase: 'drop', // drop | sizzle1 | flipping | sizzle2 | plate_ready
      bottomBrown: 0,
      topBrown: 0,
      heatLevel: 1, // 0=low, 1=med, 2=high
      butterAdded: false,
      butterFlight: null,
      butterMelt: 0,
      lidCovered: false,
      lidAnim: 0, // 0=resting right, 1=covering pan
      puffiness: 0,
      flipAnim: null,
      plateTransferAnim: null,
      sauceAmount: 0,
      saucePourAnim: 0,
      hasKetchup: false,
      ketchupAnim: 0,
      hasEgg: false,
      eggAnim: 0,
      eatPhase: 'pick', // pick | carry | chew | done
      firstCutDone: false,
      heldBite: null,
      eatenCount: 0,
      totalEatable: 4,
      chewTimer: 0,
    };

    // Spring physics state
    this.pattySquash = 1.0;
    this.pattySquashVel = 0;
    this.kneadIndent = { x: 0, z: 0, strength: 0 };
    this.saltAnim = 0;
    this.handBounceL = 0;
    this.handBounceR = 0;
    this.thumbPressAnim = 0;
    this.propWiggle = new Map();
    this.steamTimer = 0;
    this.sizzleSparkTimer = 0;

    // Reset meat visual state
    this.meatTex.update(0, 0, 0, 0);
    this.patty.mainMesh.visible = true;
    this.patty.wedgesGroup.visible = false;
    this.patty.rawGroup.visible = true;
    this.patty.yolk.visible = true;
    this.patty.yolk.scale.set(1.12, 0.62, 1.12);
    this.patty.yolk.position.set(0.05, 0.72, 0.06);
    this.patty.eggWhite.visible = true;
    this.patty.eggWhite.material.opacity = 0.65;
    for (const rb of this.patty.rawBits) {
      rb.mesh.visible = true;
      rb.mesh.scale.setScalar(1);
    }
    this.patty.sauceCap.visible = false;
    this.patty.sauceCap.userData.amount = 0;
    this.patty.ketchupMesh.visible = false;
    this.patty.eggTopping.visible = false;
    for (const w of this.patty.wedges) {
      w.eaten = false;
      w.group.visible = true;
      w.group.position.set(0, 0, 0);
      w.group.rotation.set(0, 0, 0);
      w.group.scale.setScalar(1);
      if (w.group.parent !== this.patty.wedgesGroup) {
        this.patty.wedgesGroup.add(w.group);
      }
    }

    // Reset plate garnishes
    for (const g of this.plate.garnishItems) {
      g.eaten = false;
      g.group.visible = true;
      g.group.scale.setScalar(1);
      if (g.group.parent !== this.plate.root) {
        this.plate.root.add(g.group);
      }
    }
    // Restore garnish original positions
    const cPos = [
      [-1.25, 0.24, -0.68],
      [-0.82, 0.24, -1.05],
      [-1.35, 0.24, -0.18],
      [1.18, 0.24, -0.78],
      [1.38, 0.24, -0.22],
    ];
    this.plate.garnishItems.forEach((g, idx) => {
      g.group.position.set(cPos[idx][0], cPos[idx][1], cPos[idx][2]);
      g.group.rotation.set(0, 0, idx < 3 ? (idx === 1 ? -0.2 : 0.2) : 0);
    });

    // Reset stove props
    this.stove.butterPat.visible = true;
    this.stove.butterPat.position.set(0, 0.24, 0);
    this.stove.butterPat.scale.setScalar(1);
    this.stove.butterFoam.visible = false;
    this.stove.butterFoam.scale.set(0.01, 0.01, 0.01);
    this.stove.lidGroup.position.set(2.55, 0.05, -0.35);
    this.stove.lidGroup.rotation.set(0, 0, 0);
    this.stove.panGroup.position.set(-0.15, 0.62, -0.05);
    this.stove.panGroup.rotation.set(0, 0, 0);
    this.stove.spatulaGroup.position.set(2.25, 0.14, 1.35);
    this.stove.spatulaGroup.rotation.set(0, 0.65, 0);

    // Reset sauce tools
    this.sauceTools.boatGroup.position.set(2.72, 0.02, -0.18);
    this.sauceTools.boatGroup.rotation.set(0, 0, 0);
    this.sauceTools.streamMesh.visible = false;
    this.sauceTools.ketchupGroup.position.set(-2.62, 0.02, -0.58);
    this.sauceTools.ketchupGroup.rotation.set(0, 0, 0);
    this.sauceTools.dishEgg.visible = true;
    this.sauceTools.dishEgg.position.set(0, 0.18, 0);
    this.sauceTools.dishEgg.scale.setScalar(1);

    this.replayBowl.visible = false;
    this.enterStage('knead');
  }

  enterStage(stageName) {
    this.stage = stageName;
    this.stageTime = 0;
    this.idleTimer = 0;
    this.hintActiveTimer = 0;
    this.hintHand.root.visible = false;
    this.isDragging = false;
    this.dragTarget = null;

    // Hide everything first, then cleanly reveal active stage props
    this.bowl.visible = false;
    this.saltShaker.visible = false;
    this.stove.root.visible = false;
    this.plate.root.visible = false;
    this.sauceTools.root.visible = false;
    this.fork.group.visible = false;
    this.handL.root.visible = false;
    this.handR.root.visible = false;
    this.replayBowl.visible = false;

    if (stageName !== 'cook') {
      this.sound.stopSizzleLoop();
    }

    if (stageName === 'knead') {
      this.bowl.visible = true;
      this.bowl.position.set(0, 0, 0.2);
      this.saltShaker.visible = true;
      this.saltShaker.position.set(-2.45, 0, 0.65);

      this.patty.root.position.set(0, 0.88, 0.2);
      this.patty.root.rotation.set(0, 0, 0);
      this.patty.root.scale.setScalar(1.06);
      this.patty.rawGroup.visible = !this.mem.eggPopped || this.mem.kneadProgress < 0.98;
      this.patty.updateShape({ flatten: 0.12, lumpiness: 1 - this.mem.kneadProgress, time: this.time });

      // Right cooking hand enters cleanly from RIGHT side (+Z cuff off-right, -Z fingers reaching INWARD toward bowl!)
      this.handR.root.visible = true;
      this.handR.root.position.set(2.35, 1.58, 0.45);
      this.handR.root.rotation.set(0.28, 1.15, -0.25);
      this.handR.setCurl(0.35, 0.28);

      this.girl.root.position.set(0, 1.32, -2.75);
      this.girl.root.scale.setScalar(0.95);
      this.setGirlMood('curious', 3);
    } else if (stageName === 'pat') {
      this.patty.rawGroup.visible = false;
      this.meatTex.update(1, 0, 0, 0);

      // Two large warm hands enter naturally from LEFT and RIGHT edges (cuffs outward, palms & fingers cupped inward!)
      this.handL.root.visible = true;
      this.handR.root.visible = true;
      this.handL.root.position.set(-1.35, 1.48, 0.45);
      this.handR.root.position.set(1.35, 1.48, 0.45);
      this.handL.root.rotation.set(0.18, -1.18, 0.35);
      this.handR.root.rotation.set(0.18, 1.18, -0.35);
      this.handL.setCurl(0.42, 0.32);
      this.handR.setCurl(0.42, 0.32);

      this.patty.root.position.set(this.mem.patHandSide * 0.92, 1.78, 0.42);
      this.patty.root.rotation.set(0, 0, 0);
      this.patty.root.scale.setScalar(0.92);
      this.patty.updateShape({ flatten: this.mem.patCount / 6, dimple: this.mem.dimpleDepth });

      this.girl.root.position.set(0, 1.78, -2.85);
      this.girl.root.scale.setScalar(0.95);
      this.setGirlMood('excited', 2.5);
    } else if (stageName === 'cook') {
      this.stove.root.visible = true;
      this.patty.rawGroup.visible = false;
      this.patty.root.scale.setScalar(0.94);

      if (this.mem.cookPhase === 'drop') {
        // Warm hands hold the dimpled patty right over the hot oiled skillet!
        this.handL.root.visible = true;
        this.handR.root.visible = true;
        this.patty.root.position.set(-0.15, 2.25, -0.05);
        this.patty.root.rotation.set(0, 0, 0);
      } else {
        this.patty.root.position.set(-0.15, 1.08, -0.05);
        this.patty.root.rotation.set(this.mem.cookPhase === 'sizzle2' || this.mem.cookPhase === 'plate_ready' ? Math.PI : 0, 0, 0);
      }

      if (this.mem.cookPhase === 'plate_ready') {
        this.plate.root.visible = true;
        this.plate.root.position.set(-2.95, 0.02, 1.1);
        this.plate.root.scale.setScalar(0.76);
      }

      this.girl.root.position.set(0, 1.48, -3.15);
      this.girl.root.scale.setScalar(0.96);
      this.setGirlMood('curious', 3);
    } else if (stageName === 'sauce') {
      this.plate.root.visible = true;
      this.plate.root.position.set(0, 0.02, 0.25);
      this.plate.root.scale.setScalar(0.94);

      this.sauceTools.root.visible = true;
      this.patty.rawGroup.visible = false;
      this.patty.root.position.set(0, 0.56, 0.35);
      this.patty.root.rotation.set(0, 0, 0);
      this.patty.root.scale.setScalar(0.92);
      this.meatTex.update(1, Math.max(0.85, this.mem.topBrown), Math.max(0.85, this.mem.bottomBrown), this.mem.butterMelt);
      this.patty.updateShape({ flatten: 1, dimple: this.mem.dimpleDepth * 0.4, puff: this.mem.puffiness });

      // Show fork beside plate once sauce or topping is applied
      this.fork.group.visible = this.mem.sauceAmount > 0.1 || this.mem.hasKetchup || this.mem.hasEgg;
      this.fork.group.position.set(2.15, 0.25, 1.45);
      this.fork.group.rotation.set(0, 0.32, 0);

      this.girl.root.position.set(0, 1.38, -2.75);
      this.girl.root.scale.setScalar(0.96);
      this.setGirlMood('excited', 3);
    } else if (stageName === 'eat') {
      this.plate.root.visible = true;
      this.plate.root.position.set(0, 0.02, 1.25);
      this.plate.root.scale.setScalar(0.92);

      // Prepare sliceable juicy hamburg wedges!
      this.patty.rawGroup.visible = false;
      this.patty.root.position.set(0, 0.54, 1.32);
      this.patty.root.rotation.set(0, 0, 0);
      this.patty.root.scale.setScalar(0.88);
      this.meatTex.update(1, 0.95, 0.95, this.mem.butterMelt);
      this.patty.updateShape({ flatten: 1, dimple: this.mem.dimpleDepth * 0.35, puff: this.mem.puffiness });

      // Show whole patty until very first cut, OR wedges once cut!
      this.patty.mainMesh.visible = !this.mem.firstCutDone;
      this.patty.sauceCap.visible = !this.mem.firstCutDone && this.mem.sauceAmount > 0.05;
      this.patty.wedgesGroup.visible = this.mem.firstCutDone;
      for (const w of this.patty.wedges) {
        w.sauce.visible = this.mem.sauceAmount > 0.05;
      }

      // Fork hovering ready on right side of plate
      this.fork.group.visible = true;
      this.fork.group.position.set(1.95, 0.55, 1.85);
      this.fork.group.rotation.set(0.18, 0.35, 0);

      // BIG expressive girl right across the sunny dining table (entire head & ribbons framed cleanly!)
      this.girl.root.position.set(0, 1.48, -1.45);
      this.girl.root.scale.setScalar(1.12);
      this.setGirlMood('excited', 4);
    }

    this._updateCameraGoal();
  }

  _updateCameraGoal() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.95;
    // Smoothly widen FOV on narrow portrait phones so side tools & big hands never crop!
    const targetFov = isPortrait
      ? THREE.MathUtils.clamp(40 / Math.pow(aspect, 0.44), 44, 64)
      : 38;
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();

    const zPull = isPortrait ? 1.15 : 0;

    if (this.stage === 'knead') {
      this.camGoalPos.set(0, 3.85, 6.05 + zPull);
      this.camGoalTarget.set(0, 1.05, -0.25);
    } else if (this.stage === 'pat') {
      this.camGoalPos.set(0, 2.75, 5.95 + zPull);
      this.camGoalTarget.set(0, 1.72, -0.1);
    } else if (this.stage === 'cook') {
      this.camGoalPos.set(0, 4.35, 6.75 + zPull);
      this.camGoalTarget.set(0, 1.15, -0.15);
    } else if (this.stage === 'sauce') {
      this.camGoalPos.set(0, 4.3, 6.75 + zPull);
      this.camGoalTarget.set(0, 0.95, -0.1);
    } else if (this.stage === 'eat') {
      this.camGoalPos.set(0, 2.65, 6.35 + zPull);
      this.camGoalTarget.set(0, 1.48, 0.1);
    }
  }

  setGirlMood(mood, duration = 2.0) {
    this.girlMood = mood;
    this.girlMoodTimer = duration;
    if (mood === 'amazed' || mood === 'excited' || mood === 'bliss') {
      this.girlExcitement = 1.0;
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this._updateCameraGoal();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.resize());

    const toNDC = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      // Multi-touch safety: ignore secondary fingers cleanly
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);

      this.sound.unlock();
      this.idleTimer = 0;
      this.hintHand.root.visible = false;

      toNDC(e);
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      this.isDragging = true;
      this._onPointerDown();
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId || !this.isDragging) return;
      this.idleTimer = 0;
      toNDC(e);
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      this._onPointerMove(dx, dy);
    });

    const endPointer = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      const totalDx = e.clientX - this.pointerDownPos.x;
      const totalDy = e.clientY - this.pointerDownPos.y;
      this._onPointerUp(totalDx, totalDy);
      this.activePointerId = null;
      this.isDragging = false;
      this.dragTarget = null;
    };

    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
  }

  _hitTest(objects) {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.length > 0 ? hits[0] : null;
  }

  _worldOnPlane(yHeight = 0.9) {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    this.dragPlane.constant = -yHeight;
    this.raycaster.ray.intersectPlane(this.dragPlane, this.dragWorldPoint);
    return this.dragWorldPoint;
  }

  _triggerWiggle(obj) {
    this.propWiggle.set(obj, 1.0);
    this.sound.playPropWiggle();
  }

  // ==================== STAGE INPUT HANDLERS ====================

  _onPointerDown() {
    // Check playful poke on the girl (always gives joyful giggle/blink without hijacking cooking!)
    const hitGirl = this._hitTest([this.girl.root]);

    if (this.stage === 'knead') {
      if (this._hitTest([this.saltShaker])) {
        this._triggerSaltShake();
        return;
      }
      if (this._hitTest([this.bowl, this.patty.root])) {
        this.dragTarget = 'knead';
        this._applyKneadTouch(0.14);
        return;
      }
      if (hitGirl) {
        this.setGirlMood('bliss', 1.5);
        this.sound.playHappyGiggle();
        return;
      }
      return;
    }

    if (this.stage === 'pat') {
      if (this._hitTest([this.patty.root, this.handL.root, this.handR.root])) {
        if (this.mem.patCount < 6) {
          this._triggerPatToss();
        } else if (!this.mem.dimpleDone) {
          this._triggerThumbDimple();
        }
        return;
      }
      if (hitGirl) {
        this.setGirlMood('bliss', 1.4);
        this.sound.playHappyGiggle();
      }
      return;
    }

    if (this.stage === 'cook') {
      if (this.mem.cookPhase === 'drop') {
        if (this._hitTest([this.patty.root, this.stove.panGroup, this.handL.root, this.handR.root])) {
          this._dropPattyIntoPan();
          return;
        }
      }

      // Tactile stove knob (always interactive!)
      if (this._hitTest([this.stove.knobGroup])) {
        this.mem.heatLevel = (this.mem.heatLevel + 1) % 3;
        this.sound.playKnobClick(this.mem.heatLevel);
        this._triggerWiggle(this.stove.knobGroup);
        this.particles.emitSizzleSparkles(new THREE.Vector3(-0.15, 1.05, -0.05), 5, 0.7 + this.mem.heatLevel * 0.35);
        return;
      }

      // Butter dish discovery!
      if (!this.mem.butterAdded && this._hitTest([this.stove.butterDishGroup])) {
        this._tossButterInPan();
        return;
      }

      // Glass steam lid discovery!
      if (this.mem.cookPhase !== 'drop' && this.mem.cookPhase !== 'flipping' && this._hitTest([this.stove.lidGroup])) {
        this._toggleGlassLid();
        return;
      }

      // Plate transfer when cooked!
      if (this.mem.cookPhase === 'plate_ready' && this._hitTest([this.plate.root, this.patty.root, this.stove.spatulaGroup])) {
        this._transferPattyToPlate();
        return;
      }

      // Flipping or poking sizzling patty / spatula / handle!
      if (this.mem.cookPhase === 'sizzle1' || this.mem.cookPhase === 'sizzle2') {
        const hitSpatula = this._hitTest([this.stove.spatulaGroup, this.stove.handleGroup]);
        const hitPatty = this._hitTest([this.patty.root, this.stove.panGroup]);
        if (hitSpatula || hitPatty) {
          if (this.mem.cookPhase === 'sizzle1' && this.mem.bottomBrown >= 0.65) {
            this._triggerPanFlip();
          } else if (hitPatty) {
            // Track swipe up or playful sizzle bounce
            this.dragTarget = 'pan';
            this.pattySquashVel = -2.2;
            this.sound.playDropSizzle();
            this.particles.emitSizzleSparkles(this.patty.root.position, 6, 1.0);
          } else {
            this._triggerWiggle(this.stove.spatulaGroup);
          }
          return;
        }
      }

      if (hitGirl) {
        this.setGirlMood('excited', 1.4);
        this.sound.playHappyGiggle();
      }
      return;
    }

    if (this.stage === 'sauce') {
      // Demi-glace sauce boat!
      if (this._hitTest([this.sauceTools.boatGroup])) {
        this._triggerSaucePour();
        return;
      }
      // Red ketchup bottle!
      if (this._hitTest([this.sauceTools.ketchupGroup])) {
        this._triggerKetchupSqueeze();
        return;
      }
      // Sunny-side-up egg dish!
      if (!this.mem.hasEgg && this._hitTest([this.sauceTools.eggDishGroup])) {
        this._triggerAddEgg();
        return;
      }
      // Fork or Girl -> serve to dining table once sauced/topped!
      const hasAny = this.mem.sauceAmount > 0.1 || this.mem.hasKetchup || this.mem.hasEgg;
      if (hasAny && (this._hitTest([this.fork.group]) || hitGirl || this._hitTest([this.patty.root]))) {
        this.sound.playStageCompleteChime();
        this.enterStage('eat');
        return;
      }
      if (this._hitTest([this.patty.root])) {
        // Bouncy steaming patty reaction!
        this.pattySquashVel = -2.0;
        this.particles.emitSteam(this.patty.root.position, 4, 1.0);
        this.sound.playPropWiggle();
      }
      return;
    }

    if (this.stage === 'eat') {
      // Check fresh replay bowl when meal is finished!
      if (this.replayBowl.visible && this._hitTest([this.replayBowl])) {
        this.sound.playStageCompleteChime();
        this.resetRound();
        return;
      }

      if (this.mem.eatPhase === 'pick') {
        // Check hamburg bites first
        const hitPatty = this._hitTest([this.patty.root]);
        if (hitPatty) {
          this._pickNextHamburgBite();
          return;
        }
        // Check fried egg topping!
        if (this.mem.hasEgg && this.patty.eggTopping.visible && this._hitTest([this.patty.eggTopping])) {
          this._pickEggBite();
          return;
        }
        // Check colorful glazed carrots & broccoli florets!
        for (const g of this.plate.garnishItems) {
          if (!g.eaten && this._hitTest([g.group])) {
            this._pickGarnishBite(g);
            return;
          }
        }
        if (hitGirl) {
          this.setGirlMood('anticipating', 1.4);
          this.sound.playPropWiggle();
        }
      } else if (this.mem.eatPhase === 'carry') {
        this.dragTarget = 'fork';
        // Tapping near the girl's mouth immediately feeds her!
        if (hitGirl || this.pointerNDC.y > -0.05) {
          this._feedGirlCurrentBite();
        }
      }
    }
  }

  _onPointerMove(dx, dy) {
    const moveDist = Math.hypot(dx, dy);

    if (this.stage === 'knead' && this.dragTarget === 'knead') {
      const wp = this._worldOnPlane(0.95);
      // Clamp hand target inside bowl radius
      const rx = THREE.MathUtils.clamp(wp.x, -1.15, 1.15);
      const rz = THREE.MathUtils.clamp(wp.z - 0.2, -1.0, 1.0);
      this.kneadIndent.x = rx * 0.72;
      this.kneadIndent.z = rz * 0.72;
      this.kneadIndent.strength = 1.0;

      // Move big warm hand directly where the child's finger kneads!
      this.handR.root.position.lerp(new THREE.Vector3(rx * 0.8 + 0.25, 1.48, rz * 0.7 + 0.55), 0.35);
      this.handR.setCurl(0.72, 0.58);

      if (moveDist > 2.5) {
        this._applyKneadTouch(Math.min(0.06, moveDist * 0.0022));
      }
      return;
    }

    if (this.stage === 'eat' && this.mem.eatPhase === 'carry' && this.dragTarget === 'fork') {
      const wp = this._worldOnPlane(1.7);
      this.fork.group.position.lerp(new THREE.Vector3(
        THREE.MathUtils.clamp(wp.x, -1.8, 1.8),
        THREE.MathUtils.clamp(1.6 + (this.pointerNDC.y + 0.2) * 1.9, 0.9, 2.7),
        1.1
      ), 0.32);
      const mouthPos = this.girl.mouthWorldPos();
      if (this.fork.group.position.distanceTo(mouthPos) < 1.35 || this.pointerNDC.y > 0.12) {
        this._feedGirlCurrentBite();
      }
    }
  }

  _onPointerUp(totalDx, totalDy) {
    if (this.stage === 'knead') {
      this.kneadIndent.strength = 0;
    }
    // Forgiving upward swipe in Stage 3 flips the patty if bottom is seared!
    if (this.stage === 'cook' && this.mem.cookPhase === 'sizzle1' && this.mem.bottomBrown >= 0.45 && totalDy < -40) {
      this._triggerPanFlip();
    }
    // Forgiving sideways swipe in Stage 2 tosses the meatball!
    if (this.stage === 'pat' && this.mem.patCount < 6 && Math.abs(totalDx) > 35 && !this.mem.patFlight) {
      this._triggerPatToss();
    }
  }

  // ==================== STAGE 1: KNEAD & SHAPE ====================

  _applyKneadTouch(delta) {
    if (!this.mem.eggPopped) {
      this.mem.eggPopped = true;
      this.sound.playEggPop();
      this.pattySquashVel = -2.8;
      this.particles.emitSizzleSparkles(new THREE.Vector3(0, 1.45, 0.2), 8, 0.85);
      this.setGirlMood('excited', 2.0);
    } else {
      this.sound.playSquish(Math.min(1, 0.4 + delta * 8));
      this.pattySquashVel = -1.6;
    }

    this.mem.kneadProgress = Math.min(1, this.mem.kneadProgress + delta);
    this.meatTex.update(this.mem.kneadProgress, 0, 0, 0);

    // Pop & blend egg yolk flat into the meat!
    const k = this.mem.kneadProgress;
    this.patty.yolk.scale.set(1.12 + k * 0.9, Math.max(0.05, 0.62 * (1 - k * 1.8)), 1.12 + k * 0.9);
    this.patty.yolk.position.y = 0.72 - k * 0.35;
    if (k > 0.45) this.patty.yolk.visible = false;
    this.patty.eggWhite.material.opacity = Math.max(0, 0.65 * (1 - k * 1.5));

    // Swirl diced onions & breadcrumbs organically into the meat!
    for (const rb of this.patty.rawBits) {
      rb.angle += delta * 5.2;
      const r = rb.rad * (1 - k * 0.62);
      rb.mesh.position.set(
        Math.cos(rb.angle) * r,
        rb.baseY - k * 0.36,
        Math.sin(rb.angle) * r
      );
      const s = Math.max(0.01, 1 - k * 1.05);
      rb.mesh.scale.setScalar(s);
    }

    // Complete Stage 1 -> smooth transition into Stage 2 (Pat-Pat)!
    if (this.mem.kneadProgress >= 1.0) {
      this.sound.playStageCompleteChime();
      this.particles.emitHappyBlossoms(new THREE.Vector3(0, 1.6, 0.2), 10);
      this.setGirlMood('excited', 2.5);
      this.enterStage('pat');
    }
  }

  _triggerSaltShake() {
    this.mem.saltAdded = true;
    this.saltAnim = 1.0;
    this.sound.playSaltShake();
    this.particles.emitSaltShower(new THREE.Vector3(0, 2.35, 0.2));
    this.setGirlMood('excited', 1.8);
  }

  // ==================== STAGE 2: PAT-PAT & THUMB DIMPLE ====================

  _triggerPatToss() {
    if (this.mem.patFlight) return;
    const fromSide = this.mem.patHandSide;
    const toSide = -fromSide;
    this.mem.patFlight = {
      t: 0,
      dur: 0.27,
      fromSide,
      toSide,
    };
    this.sound.playPat(this.mem.patCount, toSide);
    if (fromSide < 0) this.handBounceL = 1.0;
    else this.handBounceR = 1.0;
  }

  _triggerThumbDimple() {
    this.mem.dimpleDone = true;
    this.thumbPressAnim = 1.0;
    this.sound.playDimple();
    this.pattySquashVel = -2.2;
    this.particles.emitSizzleSparkles(new THREE.Vector3(0, 2.0, 0.45), 10, 0.9);
    this.setGirlMood('bliss', 2.2);

    // Smoothly carry dimpled patty to the hot frying pan!
    setTimeout(() => {
      if (this.stage === 'pat') {
        this.enterStage('cook');
      }
    }, 900);
  }

  // ==================== STAGE 3: SIZZLE & FLIP ====================

  _dropPattyIntoPan() {
    this.mem.cookPhase = 'sizzle1';
    this.handL.root.visible = false;
    this.handR.root.visible = false;
    this.patty.root.position.set(-0.15, 1.04, -0.05);
    this.pattySquashVel = -3.4;
    this.sound.playDropSizzle();
    this.sound.startSizzleLoop();
    this.particles.emitSizzleSparkles(new THREE.Vector3(-0.15, 1.05, -0.05), 14, 1.15);
    this.particles.emitSteam(new THREE.Vector3(-0.15, 1.15, -0.05), 5, 1.1);
    this.setGirlMood('excited', 2.0);
  }

  _tossButterInPan() {
    this.mem.butterAdded = true;
    this.mem.butterFlight = { t: 0, dur: 0.42 };
    this.sound.playButterDrop();
    this.setGirlMood('excited', 1.8);
  }

  _toggleGlassLid() {
    this.mem.lidCovered = !this.mem.lidCovered;
    this.sound.playLidClink(this.mem.lidCovered);
    if (!this.mem.lidCovered) {
      // Big joyful fragrant steam puff when lifting the lid!
      this.particles.emitSteam(new THREE.Vector3(-0.15, 1.35, -0.05), 10, 1.45);
      this.setGirlMood('amazed', 1.8);
    } else {
      this.setGirlMood('curious', 1.5);
    }
  }

  _triggerPanFlip() {
    if (this.mem.cookPhase !== 'sizzle1') return;
    if (this.mem.lidCovered) {
      this._toggleGlassLid();
    }
    this.mem.cookPhase = 'flipping';
    this.mem.flipAnim = { t: 0, dur: 0.85 };
    this.sound.playFlipWhoosh();
    this.setGirlMood('amazed', 2.4);
    this.particles.emitSizzleSparkles(new THREE.Vector3(-0.15, 1.2, -0.05), 12, 1.3);
  }

  _transferPattyToPlate() {
    if (this.mem.plateTransferAnim) return;
    if (this.mem.lidCovered) this._toggleGlassLid();
    this.mem.plateTransferAnim = { t: 0, dur: 0.7 };
    this.sound.playPlateSlide();
    this.setGirlMood('bliss', 2.2);
  }

  // ==================== STAGE 4: POUR SAUCE & GARNISH ====================

  _triggerSaucePour() {
    if (this.mem.saucePourAnim > 0.05) return;
    this.mem.saucePourAnim = 1.0;
    this.sound.playSaucePour();
    this.setGirlMood('amazed', 2.2);
  }

  _triggerKetchupSqueeze() {
    if (this.mem.ketchupAnim > 0.05) return;
    this.mem.ketchupAnim = 1.0;
    this.mem.hasKetchup = true;
    this.sound.playKetchupSqueeze();
    this.setGirlMood('excited', 2.0);
  }

  _triggerAddEgg() {
    if (this.mem.eggAnim > 0.05) return;
    this.mem.eggAnim = 1.0;
    this.mem.hasEgg = true;
    this.sound.playToppingPop();
    this.setGirlMood('amazed', 2.2);
  }

  // ==================== STAGE 5: YUMMY FEAST ====================

  _pickNextHamburgBite() {
    // On VERY FIRST cut: swap whole patty -> 4 juicy wedges + BIG golden meat-juice burst (肉汁ジュワ〜!)
    if (!this.mem.firstCutDone) {
      this.mem.firstCutDone = true;
      this.patty.mainMesh.visible = false;
      this.patty.sauceCap.visible = false;
      this.patty.ketchupMesh.visible = false;
      this.patty.wedgesGroup.visible = true;
      const bigJuice = this.mem.dimpleDepth > 0.3 || this.mem.puffiness > 0.25;
      this.sound.playCutJuicy(bigJuice);
      this.particles.emitMeatJuiceBurst(new THREE.Vector3(0, 0.72, 1.25), bigJuice);
      this.particles.emitSteam(new THREE.Vector3(0, 0.85, 1.25), 7, 1.25);
      this.setGirlMood('amazed', 2.2);
    } else {
      this.sound.playCutJuicy(false);
    }

    const nextWedge = this.patty.wedges.find((w) => !w.eaten);
    if (!nextWedge) return;
    nextWedge.eaten = true;

    // Attach wedge cleanly to fork tines!
    this.fork.biteSlot.add(nextWedge.group);
    nextWedge.group.position.set(0, 0.02, 0);
    nextWedge.group.scale.setScalar(0.62);

    this.mem.heldBite = { obj: nextWedge.group, type: 'meat' };
    this.mem.eatPhase = 'carry';
    this.setGirlMood('anticipating', 6.0);
  }

  _pickEggBite() {
    this.patty.eggTopping.visible = false;
    const miniEgg = this.patty.eggTopping.clone();
    miniEgg.visible = true;
    miniEgg.scale.setScalar(0.58);
    miniEgg.position.set(0, 0.04, 0);
    this.fork.biteSlot.add(miniEgg);
    this.mem.heldBite = { obj: miniEgg, type: 'egg', disposable: true };
    this.mem.eatPhase = 'carry';
    this.sound.playToppingPop();
    this.setGirlMood('anticipating', 6.0);
  }

  _pickGarnishBite(garnish) {
    garnish.eaten = true;
    this.fork.biteSlot.add(garnish.group);
    garnish.group.position.set(0, 0.05, 0);
    garnish.group.rotation.set(0, 0, 0);
    garnish.group.scale.setScalar(0.95);
    this.mem.heldBite = { obj: garnish.group, type: garnish.type };
    this.mem.eatPhase = 'carry';
    this.sound.playToppingPop();
    this.setGirlMood('anticipating', 6.0);
  }

  _feedGirlCurrentBite() {
    if (!this.mem.heldBite || this.mem.eatPhase !== 'carry') return;
    const bite = this.mem.heldBite;
    this.mem.heldBite = null;
    this.mem.eatPhase = 'chew';
    this.mem.chewTimer = 1.45;
    this.girlChewPhase = 0;

    // Hide eaten bite cleanly
    bite.obj.visible = false;
    if (bite.disposable && bite.obj.parent) {
      bite.obj.parent.remove(bite.obj);
    }

    this.sound.playMunch(bite.type);
    this.setGirlMood('chewing', 1.45);
    this.particles.emitHappyBlossoms(this.girl.mouthWorldPos(), 10);

    // Check if all 4 hamburg wedges are eaten!
    const meatRemaining = this.patty.wedges.filter((w) => !w.eaten).length;
    if (meatRemaining === 0 && !this.replayBowl.visible) {
      setTimeout(() => {
        if (this.stage === 'eat') {
          this.replayBowl.visible = true;
          this.setGirlMood('bliss', 8.0);
          this.sound.playHappyGiggle();
          this.particles.emitHappyBlossoms(new THREE.Vector3(0, 2.3, -0.6), 24);
        }
      }, 1500);
    }
  }

  // ==================== UPDATE LOOP ====================

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;
    this.stageTime += clampedDt;
    this.idleTimer += clampedDt;

    // FPS meter
    this._frameCount++;
    this._fpsAcc += clampedDt;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._frameCount / this._fpsAcc);
      this._frameCount = 0;
      this._fpsAcc = 0;
    }

    // Smooth camera glide
    const camLerp = 1 - Math.exp(-4.5 * clampedDt);
    this.camPos.lerp(this.camGoalPos, camLerp);
    this.camTarget.lerp(this.camGoalTarget, camLerp);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // Environment floating dust motes
    this.env.update(this.time);

    // Patty squash-and-stretch spring
    const springK = 140;
    const damp = 11;
    const force = (1.0 - this.pattySquash) * springK;
    this.pattySquashVel += (force - this.pattySquashVel * damp) * clampedDt;
    this.pattySquash = THREE.MathUtils.clamp(this.pattySquash + this.pattySquashVel * clampedDt, 0.52, 1.48);

    // Prop wiggles
    for (const [obj, val] of this.propWiggle.entries()) {
      const nv = Math.max(0, val - clampedDt * 2.6);
      obj.rotation.z = Math.sin(nv * Math.PI * 4) * nv * 0.22;
      if (nv <= 0) {
        obj.rotation.z = 0;
        this.propWiggle.delete(obj);
      } else {
        this.propWiggle.set(obj, nv);
      }
    }

    // Stage-specific updates
    if (this.stage === 'knead') this._updateKnead(clampedDt);
    else if (this.stage === 'pat') this._updatePat(clampedDt);
    else if (this.stage === 'cook') this._updateCook(clampedDt);
    else if (this.stage === 'sauce') this._updateSauce(clampedDt);
    else if (this.stage === 'eat') this._updateEat(clampedDt);

    // Idle-only gentle single hand demonstration (only after 9.5 seconds of zero touch!)
    this._updateIdleHint(clampedDt);

    // Expressive anime girl blinking, gaze, breathing & mood updates!
    this._updateGirl(clampedDt);

    // Particle simulation
    this.particles.update(clampedDt);
  }

  _updateKnead(dt) {
    // Gentle wobble on raw yolk before popped
    if (!this.mem.eggPopped) {
      const wob = Math.sin(this.time * 3.8) * 0.05;
      this.patty.yolk.scale.set(1.12 + wob, 0.62 - wob * 0.5, 1.12 - wob);
    }

    // Smoothly relax kneading indent & rest hand when not dragging
    if (!this.isDragging || this.dragTarget !== 'knead') {
      this.kneadIndent.strength = Math.max(0, this.kneadIndent.strength - dt * 4);
      this.handR.root.position.lerp(
        new THREE.Vector3(2.35, 1.58 + Math.sin(this.time * 2.2) * 0.08, 0.45),
        dt * 4
      );
      this.handR.root.rotation.set(0.28, 1.15, -0.25);
      this.handR.setCurl(0.35, 0.28);
    }

    // Salt shaker animation!
    if (this.saltAnim > 0) {
      this.saltAnim = Math.max(0, this.saltAnim - dt * 1.15);
      const p = 1 - this.saltAnim;
      const arc = Math.sin(p * Math.PI);
      this.saltShaker.position.set(
        THREE.MathUtils.lerp(-2.45, -0.35, arc),
        arc * 2.35 + Math.sin(p * Math.PI * 6) * 0.14 * arc,
        THREE.MathUtils.lerp(0.65, 0.25, arc)
      );
      this.saltShaker.rotation.z = -arc * 2.45;
    }

    this.patty.updateShape({
      flatten: 0.12 + this.mem.kneadProgress * 0.08,
      lumpiness: Math.max(0, 1 - this.mem.kneadProgress * 1.1),
      squashY: this.pattySquash,
      indentX: this.kneadIndent.x,
      indentZ: this.kneadIndent.z,
      indentStrength: this.kneadIndent.strength,
      time: this.time,
    });
  }

  _updatePat(dt) {
    this.handBounceL = Math.max(0, this.handBounceL - dt * 4.5);
    this.handBounceR = Math.max(0, this.handBounceR - dt * 4.5);

    const flatten = Math.min(1, this.mem.patCount / 6);

    if (this.mem.patFlight) {
      const fl = this.mem.patFlight;
      fl.t += dt;
      const u = Math.min(1, fl.t / fl.dur);
      const x = THREE.MathUtils.lerp(fl.fromSide * 0.92, fl.toSide * 0.92, u);
      const y = 1.75 + Math.sin(u * Math.PI) * 0.95;
      this.patty.root.position.set(x, y, 0.42);
      this.patty.root.rotation.z = -fl.toSide * u * Math.PI * 0.55;

      if (u >= 1) {
        this.mem.patFlight = null;
        this.mem.patHandSide = fl.toSide;
        this.mem.patCount++;
        if (fl.toSide < 0) this.handBounceL = 1.0;
        else this.handBounceR = 1.0;

        this.pattySquashVel = -4.2; // Satisfying bouncy catch squish!
        this.sound.playAirPuff();
        this.particles.emitAirPuffs(this.patty.root.position, 6);
        this.setGirlMood('excited', 1.2);
      }
    } else if (this.mem.patCount >= 6) {
      // Gently center the smooth oval patty flat in both palms for the thumb dimple!
      this.patty.root.position.lerp(new THREE.Vector3(0, 1.68, 0.55), dt * 6);
      this.patty.root.rotation.z = THREE.MathUtils.lerp(this.patty.root.rotation.z, 0, dt * 8);
      if (this.thumbPressAnim > 0) {
        this.thumbPressAnim = Math.max(0, this.thumbPressAnim - dt * 1.6);
        this.mem.dimpleDepth = Math.min(1, this.mem.dimpleDepth + dt * 3.5);
      }
    } else {
      // Resting in current cupped hand
      const bob = Math.sin(this.time * 3.5) * 0.05;
      const bounce = this.mem.patHandSide < 0 ? this.handBounceL : this.handBounceR;
      this.patty.root.position.lerp(
        new THREE.Vector3(this.mem.patHandSide * 0.92, 1.75 - bounce * 0.25 + bob, 0.42),
        dt * 12
      );
      this.patty.root.rotation.z = THREE.MathUtils.lerp(this.patty.root.rotation.z, -this.mem.patHandSide * 0.18, dt * 8);
    }

    // Position Left & Right Big Warm Hands entering gracefully from LEFT & RIGHT edges (cuffs outward, palms cupped upward!)
    if (this.mem.patCount < 6) {
      const waitBobL = this.mem.patHandSide > 0 ? Math.sin(this.time * 4.5) * 0.1 : 0;
      const waitBobR = this.mem.patHandSide < 0 ? Math.sin(this.time * 4.5) * 0.1 : 0;
      this.handL.root.position.set(-1.35, 1.38 - this.handBounceL * 0.26 + waitBobL, 0.45);
      this.handR.root.position.set(1.35, 1.38 - this.handBounceR * 0.26 + waitBobR, 0.45);
      this.handL.root.rotation.set(0.18, -1.18, 0.35 - this.handBounceL * 0.22);
      this.handR.root.rotation.set(0.18, 1.18, -0.35 + this.handBounceR * 0.22);
      this.handL.setCurl(0.42 + this.handBounceL * 0.22, 0.32);
      this.handR.setCurl(0.42 + this.handBounceR * 0.22, 0.32);
    } else {
      // Hands cradle patty horizontally; right thumb presses into the center dimple!
      this.handL.root.position.lerp(new THREE.Vector3(-1.12, 1.18, 0.65), dt * 6);
      this.handL.root.rotation.set(0.14, -1.05, 0.18);
      this.handL.setCurl(0.28, 0.2);

      const pressDip = Math.sin(this.thumbPressAnim * Math.PI);
      this.handR.root.position.lerp(
        new THREE.Vector3(1.15 - pressDip * 0.42, 1.85 - pressDip * 0.35, 0.68 - pressDip * 0.18),
        dt * 8
      );
      this.handR.root.rotation.set(0.24, 1.05, -0.28 - pressDip * 0.32);
      this.handR.setCurl(0.35, 0.3 + pressDip * 0.55);
    }

    // Subtle inviting pulse at the center before dimple is pressed
    const pulseSquash =
      this.mem.patCount >= 6 && !this.mem.dimpleDone
        ? this.pattySquash + Math.sin(this.time * 5.2) * 0.04
        : this.pattySquash;

    this.patty.updateShape({
      flatten,
      dimple: this.mem.dimpleDepth,
      squashY: pulseSquash,
      time: this.time,
    });
  }

  _updateCook(dt) {
    const heatMult = 0.65 + this.mem.heatLevel * 0.42;
    this.stove.animateFlame(this.time, this.mem.heatLevel);

    // Sub-phase: holding patty above skillet waiting to drop in
    if (this.mem.cookPhase === 'drop') {
      const hover = Math.sin(this.time * 3.4) * 0.08;
      this.patty.root.position.set(-0.15, 2.22 + hover, -0.05);
      this.handL.root.position.set(-1.42, 2.15 + hover, 0.18);
      this.handL.root.rotation.set(0.1, 0.45, -0.42);
      this.handR.root.position.set(1.12, 2.15 + hover, 0.18);
      this.handR.root.rotation.set(0.1, -0.45, 0.42);
      this.patty.updateShape({ flatten: 1, dimple: this.mem.dimpleDepth, squashY: this.pattySquash });
      return;
    }

    // Animate butter pat flying into pan & melting into golden foam!
    if (this.mem.butterFlight) {
      const bf = this.mem.butterFlight;
      bf.t += dt;
      const u = Math.min(1, bf.t / bf.dur);
      this.stove.butterPat.position.set(
        THREE.MathUtils.lerp(0, 2.8, u),
        0.24 + Math.sin(u * Math.PI) * 2.1 + u * 0.65,
        THREE.MathUtils.lerp(0, -1.0, u)
      );
      this.stove.butterPat.rotation.x = u * Math.PI * 2;
      if (u >= 1) {
        this.mem.butterFlight = null;
        this.stove.butterPat.visible = false;
        this.stove.butterFoam.visible = true;
        this.particles.emitSizzleSparkles(new THREE.Vector3(-0.15, 1.05, -0.05), 14, 1.2);
      }
    }
    if (this.mem.butterAdded && !this.mem.butterFlight) {
      this.mem.butterMelt = Math.min(1, this.mem.butterMelt + dt * 0.55);
      const fm = this.mem.butterMelt * (1 + Math.sin(this.time * 9) * 0.03);
      this.stove.butterFoam.scale.set(fm, fm, 1);
    }

    // Animate Glass Steam Lid smoothly between resting spot & covering the frying pan!
    const targetLid = this.mem.lidCovered ? 1 : 0;
    this.mem.lidAnim = THREE.MathUtils.lerp(this.mem.lidAnim, targetLid, dt * 7);
    const la = this.mem.lidAnim;
    this.stove.lidGroup.position.set(
      THREE.MathUtils.lerp(2.55, -0.15, la),
      THREE.MathUtils.lerp(0.05, 1.15, la) + Math.sin(la * Math.PI) * 1.15,
      THREE.MathUtils.lerp(-0.35, -0.05, la)
    );

    // Steam puffing under the glass lid makes the hamburg extra plump & tall!
    if (this.mem.lidCovered && (this.mem.cookPhase === 'sizzle1' || this.mem.cookPhase === 'sizzle2')) {
      this.mem.puffiness = Math.min(1, this.mem.puffiness + dt * 0.28);
    }

    // Continuous sizzle audio + steam & oil sparkles
    const isSizzling = this.mem.cookPhase === 'sizzle1' || this.mem.cookPhase === 'sizzle2' || this.mem.cookPhase === 'plate_ready';
    this.sound.updateSizzle(dt, this.mem.heatLevel, this.mem.lidCovered, this.mem.butterMelt, isSizzling);

    if (isSizzling) {
      this.steamTimer -= dt;
      if (this.steamTimer <= 0) {
        this.steamTimer = this.mem.lidCovered ? 0.45 : 0.22 / heatMult;
        this.particles.emitSteam(
          new THREE.Vector3(-0.15, this.mem.lidCovered ? 1.85 : 1.25, -0.05),
          1,
          this.mem.lidCovered ? 0.75 : 1.05
        );
      }
      if (!this.mem.lidCovered) {
        this.sizzleSparkTimer -= dt;
        if (this.sizzleSparkTimer <= 0) {
          this.sizzleSparkTimer = (0.35 + Math.random() * 0.35) / heatMult;
          this.particles.emitSizzleSparkles(new THREE.Vector3(-0.15, 0.96, -0.05), 2, 0.75 * heatMult);
        }
      }
    }

    // Sizzle Phase 1: browning bottom side
    if (this.mem.cookPhase === 'sizzle1') {
      const rate = 0.22 * heatMult * (1 + this.mem.butterMelt * 0.25);
      this.mem.bottomBrown = Math.min(1, this.mem.bottomBrown + dt * rate);
      this.meatTex.update(1, this.mem.topBrown, this.mem.bottomBrown, this.mem.butterMelt);

      // Once browned enough, playful sizzle bounce & wooden spatula scoots eagerly closer!
      const readyToFlip = this.mem.bottomBrown >= 0.72;
      const jiggle = readyToFlip ? Math.abs(Math.sin(this.time * 7.5)) * 0.08 : Math.sin(this.time * 14) * 0.012;
      this.patty.root.position.set(-0.15, 1.04 + jiggle, -0.05);

      const spatTargetX = readyToFlip ? 1.85 + Math.sin(this.time * 4.5) * 0.12 : 2.35;
      this.stove.spatulaGroup.position.x = THREE.MathUtils.lerp(this.stove.spatulaGroup.position.x, spatTargetX, dt * 5);
    }

    // Flipping in mid-air! (Graceful height so patty stays 100% in frame with girl's amazed eyes behind!)
    if (this.mem.cookPhase === 'flipping' && this.mem.flipAnim) {
      const fa = this.mem.flipAnim;
      fa.t += dt;
      const u = Math.min(1, fa.t / fa.dur);
      const height = Math.sin(u * Math.PI) * 1.48;
      this.patty.root.position.set(-0.15, 1.08 + height, 0.15);
      this.patty.root.rotation.x = u * Math.PI;
      // Pan tilts playfully up with the toss!
      this.stove.panGroup.rotation.x = -Math.sin(Math.min(1, u * 2.5) * Math.PI) * 0.22;

      if (u >= 1) {
        this.mem.flipAnim = null;
        this.mem.cookPhase = 'sizzle2';
        this.stove.panGroup.rotation.x = 0;
        this.patty.root.position.set(-0.15, 1.08, -0.05);
        this.patty.root.rotation.x = Math.PI;
        this.pattySquashVel = -4.0;
        this.sound.playLandSizzle();
        this.particles.emitSizzleSparkles(new THREE.Vector3(-0.15, 1.12, -0.05), 16, 1.3);
        this.particles.emitSteam(new THREE.Vector3(-0.15, 1.25, -0.05), 6, 1.2);
        this.setGirlMood('bliss', 2.0);
      }
    }

    // Sizzle Phase 2: browning second side (which is now facing down!)
    if (this.mem.cookPhase === 'sizzle2') {
      const rate = 0.25 * heatMult * (1 + this.mem.butterMelt * 0.25);
      this.mem.topBrown = Math.min(1, this.mem.topBrown + dt * rate);
      this.meatTex.update(1, this.mem.topBrown, this.mem.bottomBrown, this.mem.butterMelt);
      this.patty.root.position.set(-0.15, 1.04 + Math.sin(this.time * 13) * 0.015, -0.05);

      if (this.mem.topBrown >= 0.8) {
        this.mem.cookPhase = 'plate_ready';
        this.plate.root.visible = true;
        this.plate.root.position.set(-4.5, 0.02, 1.2);
        this.plate.root.scale.setScalar(0.78);
        this.sound.playStageCompleteChime();
        this.setGirlMood('excited', 2.5);
      }
    }

    // Plate glides into view beside the stove!
    if (this.mem.cookPhase === 'plate_ready') {
      this.plate.root.position.x = THREE.MathUtils.lerp(this.plate.root.position.x, -2.75, dt * 5);
      const readyBob = Math.abs(Math.sin(this.time * 5)) * 0.06;

      if (this.mem.plateTransferAnim) {
        const pt = this.mem.plateTransferAnim;
        pt.t += dt;
        const u = Math.min(1, pt.t / pt.dur);
        this.patty.root.position.set(
          THREE.MathUtils.lerp(-0.15, this.plate.root.position.x, u),
          THREE.MathUtils.lerp(1.04, 0.56, u) + Math.sin(u * Math.PI) * 1.45,
          THREE.MathUtils.lerp(-0.05, this.plate.root.position.z, u)
        );
        if (u >= 1) {
          this.mem.plateTransferAnim = null;
          this.enterStage('sauce');
          return;
        }
      } else {
        this.patty.root.position.set(-0.15, 1.04 + readyBob, -0.05);
      }
    }

    this.patty.updateShape({
      flatten: 1,
      dimple: this.mem.dimpleDepth * (1 - this.mem.puffiness * 0.45),
      puff: this.mem.puffiness,
      squashY: this.pattySquash,
      time: this.time,
    });
  }

  _updateSauce(dt) {
    // Gentle rising steam from freshly seared hamburg!
    this.steamTimer -= dt;
    if (this.steamTimer <= 0) {
      this.steamTimer = 0.42;
      this.particles.emitSteam(new THREE.Vector3(0, 0.95, 0.35), 1, 0.85);
    }

    // Demi-glace sauce boat pouring animation!
    if (this.mem.saucePourAnim > 0) {
      this.mem.saucePourAnim = Math.max(0, this.mem.saucePourAnim - dt * 0.72);
      const p = 1 - this.mem.saucePourAnim;
      const lift = Math.sin(p * Math.PI);
      this.sauceTools.boatGroup.position.set(
        THREE.MathUtils.lerp(2.72, 0.98, lift),
        0.02 + lift * 1.82,
        THREE.MathUtils.lerp(-0.18, 0.35, lift)
      );
      this.sauceTools.boatGroup.rotation.z = lift * 0.62;
      const pouring = p > 0.2 && p < 0.82;
      this.sauceTools.streamMesh.visible = pouring;

      if (pouring) {
        this.mem.sauceAmount = Math.min(1.0, this.mem.sauceAmount + dt * 1.25);
        this.patty.sauceCap.visible = true;
        this.patty.sauceCap.userData.amount = this.mem.sauceAmount;
        if (Math.random() < 0.25) {
          this.particles.emitSizzleSparkles(new THREE.Vector3(0, 1.05, 0.35), 1, 0.7);
        }
      }

      if (this.mem.saucePourAnim === 0) {
        this.sauceTools.streamMesh.visible = false;
        this.fork.group.visible = true;
      }
    } else {
      // Gentle inviting bob on sauce boat if sauce not poured yet
      const bob = this.mem.sauceAmount < 0.1 ? Math.sin(this.time * 3.8) * 0.06 : 0;
      this.sauceTools.boatGroup.position.set(2.72, 0.02 + bob, -0.18);
      this.sauceTools.boatGroup.rotation.z = 0;
    }

    // Ketchup bottle swoop & squeeze!
    if (this.mem.ketchupAnim > 0) {
      this.mem.ketchupAnim = Math.max(0, this.mem.ketchupAnim - dt * 0.85);
      const p = 1 - this.mem.ketchupAnim;
      const lift = Math.sin(p * Math.PI);
      this.sauceTools.ketchupGroup.position.set(
        THREE.MathUtils.lerp(-2.62, Math.sin(p * Math.PI * 3) * 0.55, lift),
        0.02 + lift * 2.15,
        THREE.MathUtils.lerp(-0.58, 0.35, lift)
      );
      this.sauceTools.ketchupGroup.rotation.z = -lift * 2.65;
      if (p > 0.35) {
        this.patty.ketchupMesh.visible = true;
        const sc = Math.min(1, (p - 0.35) * 2.5);
        this.patty.ketchupMesh.scale.set(sc, 1, sc);
      }
      if (this.mem.ketchupAnim === 0) {
        this.fork.group.visible = true;
      }
    }

    // Sunny-side-up fried egg plopping onto the hamburg crown!
    if (this.mem.eggAnim > 0) {
      this.mem.eggAnim = Math.max(0, this.mem.eggAnim - dt * 1.35);
      const p = 1 - this.mem.eggAnim;
      this.sauceTools.dishEgg.position.set(
        THREE.MathUtils.lerp(0, 2.58, p),
        0.18 + Math.sin(p * Math.PI) * 1.9 + p * 0.72,
        THREE.MathUtils.lerp(0, -0.6, p)
      );
      if (this.mem.eggAnim === 0) {
        this.sauceTools.dishEgg.visible = false;
        this.patty.eggTopping.visible = true;
        this.pattySquashVel = -2.6;
        this.particles.emitSizzleSparkles(new THREE.Vector3(0, 1.15, 0.35), 8, 0.85);
        this.fork.group.visible = true;
      }
    }

    // Jiggly fried egg yolk charm!
    if (this.patty.eggTopping.visible) {
      const wob = Math.sin(this.time * 5.2) * 0.05;
      this.patty.friedYolk.scale.set(1 + wob, 0.65 - wob * 0.4, 1 - wob);
    }

    // Gently bobbing fork once ready to serve!
    if (this.fork.group.visible) {
      this.fork.group.position.y = 0.28 + Math.sin(this.time * 5.2) * 0.09;
      this.fork.group.rotation.z = Math.sin(this.time * 5.2) * 0.08;
    }

    this.patty.updateShape({
      flatten: 1,
      dimple: this.mem.dimpleDepth * 0.35,
      puff: this.mem.puffiness,
      squashY: this.pattySquash,
      time: this.time,
    });
  }

  _updateEat(dt) {
    // Gentle steam from remaining juicy hamburg!
    if (this.patty.wedges.some((w) => !w.eaten)) {
      this.steamTimer -= dt;
      if (this.steamTimer <= 0) {
        this.steamTimer = 0.55;
        this.particles.emitSteam(new THREE.Vector3(0, 0.9, 1.25), 1, 0.72);
      }
    }

    if (this.mem.eatPhase === 'pick') {
      // Fork hovers invitingly over the right side of the plate
      this.fork.group.position.lerp(
        new THREE.Vector3(1.85, 0.72 + Math.sin(this.time * 3.8) * 0.08, 1.75),
        dt * 5
      );
      this.fork.group.rotation.x = THREE.MathUtils.lerp(this.fork.group.rotation.x, 0.22, dt * 6);
    } else if (this.mem.eatPhase === 'carry' && !this.isDragging) {
      // Lift juicy steaming bite right up in front of the girl's eager mouth!
      this.fork.group.position.lerp(
        new THREE.Vector3(0.35, 1.75 + Math.sin(this.time * 4.5) * 0.06, 1.15),
        dt * 6
      );
      this.fork.group.rotation.x = THREE.MathUtils.lerp(this.fork.group.rotation.x, -0.05, dt * 6);
    } else if (this.mem.eatPhase === 'chew') {
      this.mem.chewTimer -= dt;
      this.girlChewPhase += dt * 15;
      // Gently lower fork while she chews happily
      this.fork.group.position.lerp(new THREE.Vector3(1.95, 0.65, 1.85), dt * 4);
      if (this.mem.chewTimer <= 0) {
        this.mem.eatPhase = 'pick';
        this.setGirlMood('bliss', 1.6);
      }
    }

    // Playful gentle pulse on the fresh replay mixing bowl when meal is finished!
    if (this.replayBowl.visible) {
      const s = 0.62 + Math.sin(this.time * 3.8) * 0.03;
      this.replayBowl.scale.setScalar(s);
      this.replayBowl.rotation.y = Math.sin(this.time * 1.4) * 0.15;
    }
  }

  // Idle-only subtle translucent hand demonstration (ONLY after 9.5 seconds of inactivity!)
  _updateIdleHint(dt) {
    if (this.idleTimer < 9.5) {
      this.hintHand.root.visible = false;
      this.hintActiveTimer = 0;
      return;
    }

    this.hintActiveTimer += dt;
    // Play ONE gentle 2.8s demo, then wait another 10s of idle
    if (this.hintActiveTimer > 2.8) {
      this.hintHand.root.visible = false;
      this.idleTimer = 0;
      this.hintActiveTimer = 0;
      return;
    }

    const u = this.hintActiveTimer / 2.8;
    this.hintHand.root.visible = true;
    this.hintHand.setCurl(0.45, 0.35);

    if (this.stage === 'knead') {
      const a = u * Math.PI * 2;
      this.hintHand.root.position.set(Math.cos(a) * 0.65, 1.75, 0.25 + Math.sin(a) * 0.5);
      this.hintHand.root.rotation.set(0.55, 0, 0);
    } else if (this.stage === 'pat') {
      this.hintHand.root.position.set(Math.sin(u * Math.PI * 2) * 0.85, 2.25, 1.15);
      this.hintHand.root.rotation.set(0.25, 0, 0);
    } else if (this.stage === 'cook') {
      if (this.mem.cookPhase === 'drop') {
        this.hintHand.root.position.set(0.1, 2.4 - u * 0.9, 0.65);
      } else if (this.mem.cookPhase === 'sizzle1') {
        this.hintHand.root.position.set(0.2, 1.1 + u * 1.5, 0.65);
      } else {
        this.hintHand.root.position.set(THREE.MathUtils.lerp(0, -2.5, u), 1.45, 0.65);
      }
      this.hintHand.root.rotation.set(0.3, 0, 0);
    } else if (this.stage === 'sauce') {
      this.hintHand.root.position.set(THREE.MathUtils.lerp(2.6, 0.2, u), 1.65 + Math.sin(u * Math.PI) * 0.6, 0.55);
      this.hintHand.root.rotation.set(0.35, 0, 0.35);
    } else if (this.stage === 'eat') {
      if (this.mem.eatPhase === 'carry') {
        this.hintHand.root.position.set(0.3, THREE.MathUtils.lerp(1.4, 2.35, u), 1.4);
      } else {
        this.hintHand.root.position.set(0.2, 1.15 + Math.sin(u * Math.PI * 2) * 0.25, 1.65);
      }
      this.hintHand.root.rotation.set(0.3, 0, 0);
    }
  }

  _updateGirl(dt) {
    // Natural blinking every ~3 seconds
    this.blinkTimer -= dt;
    let blink = 0;
    if (this.blinkTimer < 0) {
      const bt = -this.blinkTimer;
      if (bt < 0.14) {
        blink = Math.sin((bt / 0.14) * Math.PI);
      } else {
        this.blinkTimer = 2.4 + Math.random() * 2.5;
      }
    }

    if (this.girlMoodTimer > 0) {
      this.girlMoodTimer -= dt;
      if (this.girlMoodTimer <= 0 && this.girlMood !== 'anticipating' && this.girlMood !== 'chewing') {
        this.girlMood = this.stage === 'eat' ? 'excited' : 'curious';
      }
    }

    this.girlExcitement = Math.max(0, this.girlExcitement - dt * 1.5);

    // Subtle gaze tracking toward the patty or held fork bite!
    const focusObj = this.stage === 'eat' && this.mem.eatPhase === 'carry' ? this.fork.group : this.patty.root;
    const lookX = THREE.MathUtils.clamp(focusObj.position.x * 0.35, -0.75, 0.75);
    const lookY = THREE.MathUtils.clamp((focusObj.position.y - 2.1) * 0.35, -0.55, 0.45);

    this.girlFace.setState({
      expression: this.girlMood,
      lookX,
      lookY,
      blink,
      chewPhase: this.girlChewPhase,
    });

    this.girl.animate(this.time, this.girlMood, this.girlExcitement, this.girlChewPhase);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // Diagnostic & QA helper (for visual verification & performance checks)
  getStats() {
    const info = this.renderer.info;
    return {
      stage: this.stage,
      cookPhase: this.mem.cookPhase,
      eatPhase: this.mem.eatPhase,
      fps: this.fps,
      triangles: info.render.triangles,
      calls: info.render.calls,
      textures: info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }

  // Jump cleanly to any stage state for visual QA screenshots
  debugJumpTo(stage, subState = {}) {
    this.resetRound();
    if (stage === 'knead') {
      if (subState.progress) {
        this.mem.eggPopped = true;
        this.mem.kneadProgress = subState.progress;
        this.meatTex.update(subState.progress, 0, 0, 0);
      }
      this.enterStage('knead');
    } else if (stage === 'pat') {
      this.mem.kneadProgress = 1;
      this.mem.patCount = subState.patCount ?? 3;
      this.mem.dimpleDepth = subState.dimple ?? 0;
      this.enterStage('pat');
    } else if (stage === 'cook') {
      this.mem.kneadProgress = 1;
      this.mem.patCount = 6;
      this.mem.dimpleDone = true;
      this.mem.dimpleDepth = 1;
      this.mem.cookPhase = subState.cookPhase || 'sizzle1';
      this.mem.bottomBrown = subState.bottomBrown ?? 0.85;
      this.mem.topBrown = subState.topBrown ?? 0.1;
      this.mem.butterAdded = !!subState.butter;
      this.mem.butterMelt = subState.butter ? 1 : 0;
      this.stove.butterFoam.visible = !!subState.butter;
      this.stove.butterPat.visible = !subState.butter;
      this.mem.lidCovered = !!subState.lid;
      this.mem.lidAnim = subState.lid ? 1 : 0;
      this.meatTex.update(1, this.mem.topBrown, this.mem.bottomBrown, this.mem.butterMelt);
      this.enterStage('cook');
      if (subState.flipMidair) {
        this.mem.cookPhase = 'flipping';
        this.mem.flipAnim = { t: 0.62, dur: 0.85 };
        this.setGirlMood('amazed', 5);
      }
    } else if (stage === 'sauce') {
      this.mem.kneadProgress = 1;
      this.mem.dimpleDepth = 0.8;
      this.mem.topBrown = 0.95;
      this.mem.bottomBrown = 0.95;
      this.mem.butterMelt = 0.8;
      this.mem.sauceAmount = subState.sauce ?? 0.85;
      this.patty.sauceCap.visible = this.mem.sauceAmount > 0.05;
      this.patty.sauceCap.userData.amount = this.mem.sauceAmount;
      if (subState.egg) {
        this.mem.hasEgg = true;
        this.sauceTools.dishEgg.visible = false;
        this.patty.eggTopping.visible = true;
      }
      if (subState.ketchup) {
        this.mem.hasKetchup = true;
        this.patty.ketchupMesh.visible = true;
      }
      this.enterStage('sauce');
    } else if (stage === 'eat') {
      this.mem.kneadProgress = 1;
      this.mem.dimpleDepth = 1;
      this.mem.puffiness = 0.7;
      this.mem.sauceAmount = 0.95;
      this.patty.sauceCap.visible = true;
      this.patty.sauceCap.userData.amount = 0.95;
      this.mem.hasEgg = !!subState.egg;
      this.patty.eggTopping.visible = !!subState.egg;
      this.enterStage('eat');
      if (subState.picking) {
        this._pickNextHamburgBite();
      } else if (subState.bliss) {
        this.setGirlMood('bliss', 10);
        this.particles.emitHappyBlossoms(new THREE.Vector3(0, 2.2, 0.2), 18);
      }
    }
    // Snap camera immediately for crisp inspection
    this.camPos.copy(this.camGoalPos);
    this.camTarget.copy(this.camGoalTarget);
    this.update(0.016);
    this.render();
  }
}
