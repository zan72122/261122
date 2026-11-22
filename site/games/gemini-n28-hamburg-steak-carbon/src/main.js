import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { SoundEngine } from './audio.js';
import { makeSoft3DMaterial, addPencilOutline } from './materials.js';
import {
  createWoodCounterTexture,
  createGinghamTexture,
  createKerchiefTexture,
  MeatTexturePainter,
  createSpriteTextures
} from './textures.js';
import { ParticleSystem } from './particles.js';
import { ChefGirl } from './character.js';
import { CookingHands } from './hands.js';
import { CulinaryWorld } from './food.js';

const STAGES = {
  KNEAD: 0,
  PECHI: 1,
  SIZZLE: 2,
  SAUCE: 3,
  TASTE: 4
};

class HamburgSteakGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.sound = new SoundEngine();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfcebd4);

    this.camera = new THREE.PerspectiveCamera(
      43,
      window.innerWidth / window.innerHeight,
      0.1,
      30
    );
    this.cameraBasePos = new THREE.Vector3(0, 2.15, 3.55);
    this.cameraLookAt = new THREE.Vector3(0, 1.06, -0.15);
    this.cameraTargetPos = this.cameraBasePos.clone();
    this.cameraTargetLook = this.cameraLookAt.clone();

    this._setupLighting();
    this._setupEnvironment();

    this.meatPainter = new MeatTexturePainter();
    this.ginghamTex = createGinghamTexture();
    this.kerchiefTex = createKerchiefTexture();
    this.spriteTextures = createSpriteTextures();

    this.particles = new ParticleSystem(this.scene, this.spriteTextures);
    this.girl = new ChefGirl(this.kerchiefTex);
    this.scene.add(this.girl.group);

    this.food = new CulinaryWorld(
      this.scene,
      this.meatPainter,
      this.ginghamTex,
      this.spriteTextures
    );
    this.hands = new CookingHands();
    this.scene.add(this.hands.group);

    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.45);
    this.verticalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.55);
    this.activePointerId = null;
    this.isDown = false;
    this.downPos = new THREE.Vector2();
    this.lastPointerPos = new THREE.Vector2();
    this.worldTouch = new THREE.Vector3(0, 0.5, 0.48);

    this.stage = STAGES.KNEAD;
    this.stageTime = 0;
    this.idleTime = 0;
    this.demoShownThisStage = false;
    this.demoAnimTimer = 0;

    this.wobbleBowl = 0;
    this.wobbleStove = 0;
    this.wobblePlate = 0;

    this.pechiCount = 0;
    this.pechiSide = -1;
    this.pechiFlight = 0;
    this.pechiInFlight = false;
    this.dimpleDone = false;
    this.transitionDelay = 0;

    this.flipped = false;
    this.flipProgress = 0;
    this.isFlipping = false;
    this.lidCovered = false;
    this.lidSteamed = false;
    this.steamEmitTimer = 0;
    this.panShake = 0;

    this.hasCheese = false;
    this.hasEgg = false;
    this.sauceTotal = 0;
    this.isPouringSauce = false;
    this.pourTarget = new THREE.Vector3(0, 0.45, 0.48);

    this.biteLoaded = false;
    this.biteKind = 'meat';
    this.forkPos = new THREE.Vector3(0.75, 0.35, 0.65);
    this.forkFlyingToMouth = false;
    this.forkFlightT = 0;
    this.bitesFed = 0;
    this.celebratingRound = false;
    this.roundResetTimer = 0;

    this.fps = 60;
    this._fpsFrames = 0;
    this._fpsAccum = 0;

    this._enterStage(STAGES.KNEAD, true);
    this._onResize();
    this._bindEvents();

    this.lastFrameTime = performance.now();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _setupLighting() {
    const hemi = new THREE.HemisphereLight(0xfff7e8, 0xe8a576, 1.28);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.52);
    sun.position.set(-2.8, 4.6, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.8;
    sun.shadow.camera.far = 12;
    const d = 2.8;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 3.5;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffdfc2, 0.52);
    fill.position.set(2.4, 2.2, 3.0);
    this.scene.add(fill);
  }

  _setupEnvironment() {
    const loader = new THREE.TextureLoader();
    this.bgTex = loader.load('./assets/kitchen_bg.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
    });

    const bgMat = new THREE.MeshBasicMaterial({
      map: this.bgTex,
      depthWrite: false
    });
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 5.86), bgMat);
    this.bgMesh.position.set(0, 1.52, -2.35);
    this.bgMesh.renderOrder = -10;
    this.bgMesh.raycast = () => {};
    this.scene.add(this.bgMesh);

    const woodTex = createWoodCounterTexture();
    const counterMat = makeSoft3DMaterial({
      color: 0xffffff,
      map: woodTex,
      roughness: 0.68,
      emissive: 0x3b200c,
      emissiveIntensity: 0.08
    });
    const counterGeo = new RoundedBoxGeometry(7.2, 0.36, 2.65, 3, 0.05);
    this.counterMesh = new THREE.Mesh(counterGeo, counterMat);
    this.counterMesh.position.set(0, -0.18, 0.18);
    this.counterMesh.receiveShadow = true;
    this.counterMesh.raycast = () => {};
    this.scene.add(this.counterMesh);

    const boardMat = makeSoft3DMaterial({
      color: 0xf7dcb4,
      roughness: 0.62,
      emissive: 0x42260e,
      emissiveIntensity: 0.06
    });
    this.cuttingBoard = new THREE.Mesh(
      new RoundedBoxGeometry(1.76, 0.045, 1.24, 3, 0.02),
      boardMat
    );
    this.cuttingBoard.position.set(0, 0.02, 0.48);
    this.cuttingBoard.receiveShadow = true;
    this.cuttingBoard.raycast = () => {};
    addPencilOutline(this.cuttingBoard, 0.012, 0x7d5333, 0.38);
    this.scene.add(this.cuttingBoard);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.sound.unlock();
      if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
      this.activePointerId = e.pointerId;
      this.isDown = true;
      this.idleTime = 0;
      this.demoAnimTimer = 0;

      this.downPos.set(e.clientX, e.clientY);
      this.lastPointerPos.set(e.clientX, e.clientY);
      this._updatePointerWorld(e.clientX, e.clientY);
      this._handlePointerDown(e.clientX, e.clientY);
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDown || e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      this.idleTime = 0;
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.lastPointerPos.set(e.clientX, e.clientY);
      this._updatePointerWorld(e.clientX, e.clientY);
      this._handlePointerMove(dx, dy);
    }, { passive: false });

    const endPointer = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this.isDown = false;
      this.activePointerId = null;
      this.isPouringSauce = false;
      this.food.sauceStream.visible = false;
      this._handlePointerUp();
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.camera.aspect = aspect;

    if (aspect < 0.85) {
      this.food.spreadX = 0.96;
      this.isPortrait = true;
      this.camera.fov = 55;
      this.cameraBasePos.set(0, 2.32, 4.58);
      this.cameraLookAt.set(0, 1.00, -0.08);
    } else if (aspect < 1.15) {
      this.food.spreadX = 0.88;
      this.isPortrait = false;
      this.camera.fov = 46;
      this.cameraBasePos.set(0, 2.18, 3.82);
      this.cameraLookAt.set(0, 1.04, -0.12);
    } else {
      this.food.spreadX = 1.04;
      this.isPortrait = false;
      this.camera.fov = 43;
      this.cameraBasePos.set(0, 2.16, 3.58);
      this.cameraLookAt.set(0, 1.06, -0.15);
    }
    this.camera.updateProjectionMatrix();

    const dist = this.cameraBasePos.z - (-2.35);
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const visW = visH * aspect;
    const bgAspect = 1024 / 571;
    let planeW = visW * 1.14;
    let planeH = planeW / bgAspect;
    if (planeH < visH * 1.14) {
      planeH = visH * 1.14;
      planeW = planeH * bgAspect;
    }
    this.bgMesh.scale.set(planeW / 10.5, planeH / 5.86, 1);
  }

  _updatePointerWorld(clientX, clientY) {
    this.pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    const plane = (this.stage === STAGES.PECHI || this.stage === STAGES.TASTE)
      ? this.verticalPlane
      : this.workPlane;
    this.raycaster.ray.intersectPlane(plane, this.worldTouch);
  }

  _raycastHitKind() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const k = hits[i].object.userData.hitKind;
      if (k) return { kind: k, point: hits[i].point };
    }
    return { kind: null, point: this.worldTouch.clone() };
  }

  _enterStage(newStage, immediate = false) {
    this.stage = newStage;
    this.stageTime = 0;
    this.idleTime = 0;
    this.demoShownThisStage = false;
    this.demoAnimTimer = 0;
    this.transitionDelay = 0;

    const st = this.food.pattyState;

    if (newStage === STAGES.KNEAD) {
      this.sound.setSizzle(0);
      st.mode = 'mound';
      st.knead = 0;
      st.roundness = 0;
      st.flatness = 0;
      st.dimple = 0;
      st.plump = 0;
      st.searBottom = 0;
      st.searTop = 0;
      st.swirlAngle = 0;
      st.cutOpen = false;
      st.bitesLeft = 3;

      this.food.bowlGroup.visible = true;
      this.food.stoveGroup.visible = true;
      this.food.spatulaGroup.visible = false;
      this.food.yolkPopped = false;
      this.food.eggYolk.visible = true;
      this.food.eggYolk.scale.set(1.05, 0.72, 1.05);
      this.food.eggWhite.visible = true;
      this.food.eggWhite.scale.set(1.18, 0.24, 1.08);
      this.food.rawIngredients.visible = true;
      this.food.onionCubes.forEach((c) => {
        c.mesh.visible = true;
        c.mesh.scale.setScalar(1);
        c.mesh.position.copy(c.basePos);
      });

      this.food.airBubbles.forEach((b) => {
        b.popped = false;
        b.mesh.visible = false;
      });
      this.food.sauceGlaze.visible = false;
      this.food.sauceGlaze.scale.setScalar(0.001);
      this.food.sauceNodes.forEach((sn) => {
        sn.fill = 0;
        sn.mesh.visible = false;
        sn.mesh.scale.setScalar(0.001);
      });
      this.food.placedCheese.visible = false;
      this.food.placedEgg.visible = false;
      this.food.juicePool.visible = false;
      this.food.sauceStream.visible = false;
      this.food.lidGroup.visible = false;
      this.food.toppingsGroup.visible = false;
      this.food.pitcherGroup.visible = false;
      this.food.forkGroup.visible = false;
      this.food.flameGroup.visible = false;
      this.food.butterPat.visible = false;
      this.food.butterPool.material.opacity = 0;

      this.food.broccoli.visible = true;
      this.food.carrot.visible = true;
      this.food.tomato.visible = true;

      this.food.pattyFlipGroup.rotation.set(0, 0, 0);
      this.food.pattyMesh.scale.setScalar(1);
      this.meatPainter.update(0, 0, 0);
      this.food.deformPatty();

      if (immediate) {
        const sideZ = this.isPortrait ? -0.34 : 0.08;
        const plateZ = this.isPortrait ? -0.26 : 0.20;
        this.food.bowlGroup.position.set(0, 0, 0.52);
        this.food.pattyAnchor.position.set(0, 0.28, 0.52);
        this.food.stoveGroup.position.set(-1.54 * this.food.spreadX, 0, sideZ);
        this.food.plateGroup.position.set(1.54 * this.food.spreadX, 0, plateZ);
      }

      this.girl.setEmotion('expectant', 3.0);
    } else if (newStage === STAGES.PECHI) {
      this.pechiCount = 0;
      this.pechiSide = -1;
      this.pechiInFlight = false;
      this.pechiFlight = 0;
      this.dimpleDone = false;

      // Guarantee fully kneaded rosy ball & hide empty raw toppings cleanly!
      st.knead = 1.0;
      st.roundness = 1.0;
      this.food.rawIngredients.visible = false;
      this.meatPainter.update(1, 0, 0);
      this.food.deformPatty();

      this.food.airBubbles.forEach((b) => {
        b.popped = false;
        b.mesh.visible = true;
      });
      this.girl.setEmotion('curious', 2.5);
    } else if (newStage === STAGES.SIZZLE) {
      this.flipped = false;
      this.isFlipping = false;
      this.flipProgress = 0;
      this.lidCovered = false;
      this.lidSteamed = false;

      this.food.bowlGroup.visible = false;
      this.food.airBubbles.forEach((b) => { b.mesh.visible = false; });
      this.food.spatulaGroup.visible = true;
      this.food.flameGroup.visible = true;
      this.food.butterPat.visible = true;
      this.food.butterPat.scale.setScalar(1);
      this.food.lidGroup.visible = true;
      this.food.lidGroup.position.set(-1.18 * this.food.spreadX, 0.02, 0.52);

      this.sound.playPanDropSizzle();
      this.sound.setSizzle(0.75, false);
      this.girl.setEmotion('sniffing', 3.0);
    } else if (newStage === STAGES.SAUCE) {
      this.sound.setSizzle(0.10);
      this.hasCheese = false;
      this.hasEgg = false;
      this.sauceTotal = 0;
      this.isPouringSauce = false;

      this.food.bowlGroup.visible = false;
      this.food.lidGroup.visible = false;
      this.food.flameGroup.visible = false;
      this.food.spatulaGroup.visible = false;
      this.food.toppingsGroup.visible = true;
      this.food.cheeseToken.visible = true;
      this.food.eggToken.visible = true;
      this.food.pitcherGroup.visible = true;

      this.girl.setEmotion('amazed', 2.4);
      this.sound.playGirlReaction('giggle');
    } else if (newStage === STAGES.TASTE) {
      this.sound.setSizzle(0);
      this.biteLoaded = false;
      this.forkFlyingToMouth = false;
      this.forkFlightT = 0;
      this.bitesFed = 0;
      this.celebratingRound = false;

      this.food.pitcherGroup.visible = false;
      this.food.sauceStream.visible = false;
      this.food.toppingsGroup.visible = false;
      this.food.forkGroup.visible = true;
      this.food.forkBiteGroup.visible = false;
      this.forkPos.set(0.78 * this.food.spreadX, 0.34, 0.65);

      this.girl.setEmotion('expectant', 3.0);
    }
  }

  _handlePointerDown(clientX, clientY) {
    const hit = this._raycastHitKind();

    if (hit.kind === 'girl' && !(this.stage === STAGES.TASTE && this.biteLoaded)) {
      this.girl.setEmotion('giggling', 1.2);
      this.sound.playGirlReaction('giggle');
      return;
    }

    if (this.stage === STAGES.KNEAD) {
      if (hit.kind === 'skillet' || hit.kind === 'spatula') {
        this.wobbleStove = 1.0;
        this.sound.playGirlReaction('wobble');
        return;
      }
      if (hit.kind === 'plate') {
        this.wobblePlate = 1.0;
        this.sound.playGirlReaction('wobble');
        return;
      }
      this._doKneadPulse(0.11);
    } else if (this.stage === STAGES.PECHI) {
      if (hit.kind === 'skillet') {
        this.wobbleStove = 0.8;
        this.sound.playGirlReaction('wobble');
        return;
      }
      if (hit.kind === 'plate') {
        this.wobblePlate = 0.8;
        this.sound.playGirlReaction('wobble');
        return;
      }
      this._triggerPechiOrDimple();
    } else if (this.stage === STAGES.SIZZLE) {
      if (hit.kind === 'plate') {
        this.wobblePlate = 0.8;
        this.sound.playGirlReaction('wobble');
        return;
      }
      if (hit.kind === 'lid') {
        this._toggleSteamLid();
        return;
      }
      this._interactSkillet(hit.kind);
    } else if (this.stage === STAGES.SAUCE) {
      if (hit.kind === 'topping_cheese' && !this.hasCheese) {
        this._applyTopping('cheese');
        return;
      }
      if (hit.kind === 'topping_egg' && !this.hasEgg) {
        this._applyTopping('egg');
        return;
      }
      this.isPouringSauce = true;
      this._pourSauceAt(this.worldTouch);
    } else if (this.stage === STAGES.TASTE) {
      if (this.celebratingRound) return;

      if (!this.biteLoaded) {
        if (hit.kind === 'veggie_broccoli' && this.food.broccoli.visible) {
          this._loadForkBite('broccoli');
          return;
        }
        if (hit.kind === 'veggie_carrot' && this.food.carrot.visible) {
          this._loadForkBite('carrot');
          return;
        }
        this._loadForkBite('meat');
      } else if (!this.forkFlyingToMouth) {
        if (hit.kind === 'girl' || clientY < window.innerHeight * 0.56 || hit.kind === 'fork') {
          this._launchForkToMouth();
        }
      }
    }
  }

  _handlePointerMove(dx, dy) {
    const moveMag = Math.hypot(dx, dy);

    if (this.stage === STAGES.KNEAD) {
      if (moveMag > 3) {
        this._doKneadPulse(Math.min(0.055, moveMag * 0.0022));
      }
    } else if (this.stage === STAGES.PECHI) {
      if (Math.abs(dx) > 18 && !this.pechiInFlight) {
        this._triggerPechiOrDimple();
      }
    } else if (this.stage === STAGES.SIZZLE) {
      if (dy < -22 && !this.flipped && !this.isFlipping && this.food.pattyState.searBottom >= 0.48) {
        this._startBigFlip();
      } else if (moveMag > 4) {
        this.panShake = Math.min(1.0, this.panShake + moveMag * 0.018);
        this.food.pattyState.searBottom = Math.min(1, this.food.pattyState.searBottom + 0.006);
        if (this.flipped) {
          this.food.pattyState.searTop = Math.min(1, this.food.pattyState.searTop + 0.008);
        }
        if (Math.random() < 0.35) {
          this.particles.burstSizzleDrops(this.food.pattyAnchor.position, 2);
        }
      }
    } else if (this.stage === STAGES.SAUCE) {
      const hit = this._raycastHitKind();
      if (hit.kind === 'topping_cheese' && !this.hasCheese) {
        this._applyTopping('cheese');
        return;
      }
      if (hit.kind === 'topping_egg' && !this.hasEgg) {
        this._applyTopping('egg');
        return;
      }
      if (this.isPouringSauce || moveMag > 2) {
        this.isPouringSauce = true;
        this._pourSauceAt(this.worldTouch);
      }
    } else if (this.stage === STAGES.TASTE) {
      if (!this.biteLoaded && moveMag > 16) {
        this._loadForkBite('meat');
      } else if (this.biteLoaded && !this.forkFlyingToMouth) {
        this.forkPos.x = THREE.MathUtils.clamp(this.worldTouch.x, -0.85, 0.85);
        this.forkPos.y = THREE.MathUtils.clamp(this.worldTouch.y, 0.30, 1.85);
        this.forkPos.z = THREE.MathUtils.lerp(0.65, -0.55, (this.forkPos.y - 0.30) / 1.45);
        if (this.forkPos.y > 1.18 || dy < -24) {
          this._launchForkToMouth();
        }
      }
    }
  }

  _handlePointerUp() {
    if (this.stage === STAGES.SAUCE && this.sauceTotal >= 0.96 && this.transitionDelay === 0) {
      this.transitionDelay = 0.65;
    }
  }

  _doKneadPulse(amount) {
    if (this.transitionDelay > 0) return;
    const st = this.food.pattyState;

    if (!this.food.yolkPopped) {
      this.food.yolkPopped = true;
      this.food.eggYolk.scale.set(1.45, 0.16, 1.45);
      this.sound.playYolkPop();
      this.particles.burstSizzleDrops(new THREE.Vector3(0, 0.52, 0.48), 8, 0xffae19);
      this.girl.setEmotion('curious', 1.8);
    }

    st.knead = Math.min(1, st.knead + amount);
    st.swirlAngle += amount * 5.2;
    st.squashVel -= 2.4;

    st.indentLocal.set(
      THREE.MathUtils.clamp(this.worldTouch.x, -0.45, 0.45),
      0.32,
      THREE.MathUtils.clamp(this.worldTouch.z - 0.48, -0.45, 0.45)
    );
    st.indentStrength = 1.0;

    const sink = Math.min(1, st.knead * 1.25);
    this.food.eggYolk.scale.setScalar(Math.max(0.01, 1 - sink));
    this.food.eggWhite.scale.setScalar(Math.max(0.01, 1 - sink));
    if (sink >= 0.98) {
      this.food.rawIngredients.visible = false;
    } else {
      this.food.onionCubes.forEach((c, idx) => {
        const a = c.ang + st.swirlAngle * 0.45;
        const r = (0.26 + (idx % 3) * 0.1) * (1 - sink * 0.65);
        c.mesh.position.set(Math.cos(a) * r, -sink * 0.14, Math.sin(a) * r);
        c.mesh.scale.setScalar(1 - sink * 0.65);
      });
    }

    if (st.knead > 0.65) {
      st.roundness = (st.knead - 0.65) / 0.35;
    }

    this.meatPainter.update(st.knead, 0, 0);
    this.food.deformPatty();
    this.sound.playKneadSquish(0.75 + st.knead * 0.3);
    this.girl.triggerBounce(0.08);

    if (st.knead >= 1.0 && this.transitionDelay === 0) {
      st.roundness = 1.0;
      this.food.deformPatty();
      this.particles.burstCelebration(new THREE.Vector3(0, 0.65, 0.48), 7, false);
      this.sound.playGirlReaction('giggle');
      this.girl.setEmotion('giggling', 1.6);
      this.transitionDelay = 0.72;
    }
  }

  _triggerPechiOrDimple() {
    if (this.transitionDelay > 0 || this.pechiInFlight) return;

    const totalTosses = 5;
    if (this.pechiCount < totalTosses) {
      this.pechiInFlight = true;
      this.pechiFlight = 0;
      this.pechiSide *= -1;
      this.pechiCount++;

      for (let i = 0; i < this.food.airBubbles.length; i++) {
        if (!this.food.airBubbles[i].popped) {
          this.food.airBubbles[i].popped = true;
          this.food.airBubbles[i].mesh.visible = false;
          if (this.pechiCount === totalTosses) {
            this.food.airBubbles.forEach((b) => {
              b.popped = true;
              b.mesh.visible = false;
            });
          }
          break;
        }
      }

      this.sound.playPechiSlap(this.pechiCount);
      this.girl.setEmotion('giggling', 1.1);
      this.girl.triggerBounce(0.14);
    } else if (!this.dimpleDone) {
      this.dimpleDone = true;
      this.food.pattyState.dimple = 1.0;
      this.food.pattyState.squashVel -= 3.2;
      this.food.deformPatty();

      this.sound.playDimplePress();
      this.particles.burstCelebration(this.food.pattyAnchor.position, 8, false);
      this.girl.setEmotion('amazed', 1.6);
      this.transitionDelay = 0.85;
    }
  }

  _interactSkillet(hitKind) {
    if (this.transitionDelay > 0 || this.isFlipping) return;
    const st = this.food.pattyState;

    if (!this.flipped) {
      if (st.searBottom >= 0.55 || (hitKind === 'spatula' && st.searBottom >= 0.35)) {
        st.searBottom = Math.max(st.searBottom, 0.92);
        this._startBigFlip();
      } else {
        this.panShake = 0.85;
        st.searBottom = Math.min(1, st.searBottom + 0.16);
        this.meatPainter.update(1, st.searBottom, st.searTop);
        this.particles.burstSizzleDrops(this.food.pattyAnchor.position, 5);
        this.particles.burstSteamCloud(this.food.pattyAnchor.position, 3, false);
        this.sound.playPanDropSizzle();
      }
    } else {
      if (this.lidCovered) {
        this._toggleSteamLid();
        return;
      }
      if (st.searTop >= 0.72) {
        st.searTop = 1.0;
        this.meatPainter.update(1, st.searBottom, st.searTop);
        this.particles.burstCelebration(this.food.pattyAnchor.position, 8, false);
        this.transitionDelay = 0.55;
      } else {
        this.panShake = 0.75;
        st.searTop = Math.min(1, st.searTop + 0.22);
        this.meatPainter.update(1, st.searBottom, st.searTop);
        this.particles.burstSizzleDrops(this.food.pattyAnchor.position, 5);
      }
    }
  }

  _startBigFlip() {
    this.isFlipping = true;
    this.flipProgress = 0;
    if (this.lidCovered) this.lidCovered = false;
    this.sound.playBigFlip();
    this.girl.setEmotion('amazed', 2.2);
    this.girl.triggerBounce(0.20);
  }

  _toggleSteamLid() {
    if (this.isFlipping || this.transitionDelay > 0) return;
    this.lidCovered = !this.lidCovered;
    this.sound.playSteamPuff(!this.lidCovered);
    this.sound.setSizzle(this.lidCovered ? 0.45 : 0.82, this.lidCovered);

    if (!this.lidCovered) {
      this.particles.burstSteamCloud(this.food.pattyAnchor.position, 14, true);
      this.girl.setEmotion('amazed', 2.0);
      this.sound.playGirlReaction('giggle');
      if (this.flipped && this.food.pattyState.searTop >= 0.75) {
        this.transitionDelay = 0.75;
      }
    } else {
      this.lidSteamed = true;
      this.girl.setEmotion('curious', 1.8);
    }
  }

  _applyTopping(kind) {
    if (kind === 'cheese') {
      this.hasCheese = true;
      this.food.cheeseToken.visible = false;
      this.food.placedCheese.visible = true;
      this.food.placedCheese.scale.set(0.2, 0.2, 0.2);
      this.food.sauceGlaze.position.y = 0.025;
      this.sound.playToppingPlop('cheese');
      this.particles.burstCelebration(this.food.pattyAnchor.position, 6, false);
      this.girl.setEmotion('amazed', 1.5);
    } else if (kind === 'egg') {
      this.hasEgg = true;
      this.food.eggToken.visible = false;
      this.food.placedEgg.visible = true;
      this.food.placedEgg.scale.set(0.2, 0.2, 0.2);
      this.food.placedEgg.position.y = this.hasCheese ? 0.54 : 0.51;
      this.sound.playToppingPlop('egg');
      this.particles.burstCelebration(this.food.pattyAnchor.position, 6, false);
      this.girl.setEmotion('amazed', 1.5);
    }
    this.food.pattyState.squashVel -= 2.2;
  }

  _pourSauceAt(worldPt) {
    const center = this.food.pattyAnchor.position;
    const lx = THREE.MathUtils.clamp(worldPt.x - center.x, -0.45, 0.45);
    const lz = THREE.MathUtils.clamp(worldPt.z - center.z, -0.38, 0.38);

    this.pourTarget.set(center.x + lx, center.y + 0.48, center.z + lz);

    this.food.sauceStream.visible = true;
    const streamTopY = center.y + 0.78;
    const streamBotY = center.y + 0.44;
    const h = streamTopY - streamBotY;
    this.food.sauceStream.position.set(this.pourTarget.x, streamBotY + h * 0.5, this.pourTarget.z);
    this.food.sauceStream.scale.set(
      0.85 + Math.sin(this.stageTime * 22) * 0.12,
      h,
      0.85 + Math.cos(this.stageTime * 22) * 0.12
    );

    let sumFill = 0;
    this.food.sauceNodes.forEach((sn) => {
      const dist = Math.hypot(sn.pos2D.x - lx, sn.pos2D.y - lz);
      const gain = Math.max(0.035, Math.exp(-dist * dist * 8.5) * 0.16);
      sn.fill = Math.min(1, sn.fill + gain);
      if (sn.fill > 0.02) {
        sn.mesh.visible = true;
        sn.mesh.scale.lerpVectors(
          new THREE.Vector3(0.02, 0.02, 0.02),
          sn.targetScale,
          sn.fill
        );
      }
      sumFill += sn.fill;
    });

    this.sauceTotal = sumFill / this.food.sauceNodes.length;

    // Grow continuous glossy demi-glace glaze sheet across the top of the steak!
    this.food.sauceGlaze.visible = true;
    const gScale = THREE.MathUtils.lerp(0.25, 1.02, Math.min(1, this.sauceTotal * 1.15));
    this.food.sauceGlaze.scale.set(gScale, Math.min(1, 0.4 + this.sauceTotal * 0.65), gScale);

    this.sound.playSaucePour(this.sauceTotal);
    this.girl.setEmotion('amazed', 1.2);

    if (Math.random() < 0.28) {
      this.particles.burstSizzleDrops(this.pourTarget, 1, 0x7a2c12);
    }

    if (this.sauceTotal >= 0.98 && this.transitionDelay === 0) {
      this.particles.burstCelebration(this.food.pattyAnchor.position, 9, false);
      this.transitionDelay = 0.65;
    }
  }

  _loadForkBite(kind) {
    this.biteLoaded = true;
    this.biteKind = kind;
    this.food.forkBiteGroup.visible = true;
    this.forkPos.set(0.28, 0.64, 0.56);

    if (kind === 'broccoli') {
      this.food.broccoli.visible = false;
      this.food.biteMeatMesh.material.color.setHex(0x3b9e4b);
      this.food.biteSauceCap.visible = false;
      this.sound.playToppingPlop('cheese');
    } else if (kind === 'carrot') {
      this.food.carrot.visible = false;
      this.food.biteMeatMesh.material.color.setHex(0xff7830);
      this.food.biteSauceCap.visible = false;
      this.sound.playToppingPlop('egg');
    } else {
      const st = this.food.pattyState;
      if (!st.cutOpen) {
        st.cutOpen = true;
        this.food.juicePool.visible = true;
        this.food.deformPatty();
        this.sound.playJuicyCut();
        this.particles.burstSizzleDrops(
          this.food.pattyAnchor.position.clone().add(new THREE.Vector3(0.12, 0.15, 0.18)),
          10,
          0xffc94d
        );
        if (this.hasEgg && this.food.placedEgg.userData.yolk) {
          this.food.placedEgg.userData.yolk.scale.set(1.28, 0.32, 1.28);
          this.particles.burstSizzleDrops(this.food.pattyAnchor.position, 6, 0xff9d14);
        }
      } else {
        st.bitesLeft = Math.max(0, st.bitesLeft - 1);
        const s = st.bitesLeft === 2 ? 0.82 : (st.bitesLeft === 1 ? 0.60 : 0.01);
        this.food.pattyMesh.scale.setScalar(s);
        this.food.pattyTopDecor.scale.setScalar(s);
        if (st.bitesLeft === 0) {
          this.food.pattyMesh.visible = false;
          this.food.pattyTopDecor.visible = false;
        }
        this.sound.playToppingPlop('cheese');
      }
      this.food.biteMeatMesh.material.color.setHex(0x75351a);
      this.food.biteSauceCap.visible = true;
    }

    this.girl.setEmotion('mouthOpen', 8.0);
    this.sound.playGirlReaction('aan');
  }

  _launchForkToMouth() {
    this.forkFlyingToMouth = true;
    this.forkFlightT = 0;
    this.girl.setEmotion('mouthOpen', 2.0);
  }

  _completeMouthBite() {
    this.forkFlyingToMouth = false;
    this.biteLoaded = false;
    this.food.forkBiteGroup.visible = false;
    this.forkPos.set(0.75 * this.food.spreadX, 0.34, 0.65);
    this.bitesFed++;

    const mouthWorld = new THREE.Vector3(0, 1.48, -0.62);
    if (this.biteKind === 'broccoli' || this.biteKind === 'carrot') {
      this.girl.setEmotion('crunch', 1.4);
      this.sound.playGirlReaction('crunch');
      this.particles.burstCelebration(mouthWorld, 8, false);
    } else {
      this.girl.setEmotion('chewing', 1.1);
      this.sound.playGirlReaction('chomp');
      setTimeout(() => {
        if (this.stage === STAGES.TASTE) {
          this.girl.setEmotion('bliss', 2.2);
          this.sound.playGirlReaction('bliss');
          this.particles.burstCelebration(new THREE.Vector3(0, 1.72, -0.75), 14, true);
        }
      }, 620);
    }

    if (this.bitesFed >= 3 || this.food.pattyState.bitesLeft === 0) {
      this.celebratingRound = true;
      this.roundResetTimer = 2.9;
      this.food.addKeepsake({ hasCheese: this.hasCheese, hasEgg: this.hasEgg });
    }
  }

  _animate(now) {
    requestAnimationFrame(this._animate);
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    this._fpsFrames++;
    this._fpsAccum += rawDt;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    this.stageTime += dt;
    this.idleTime += dt;

    if (this.idleTime > 10.2 && !this.demoShownThisStage && !this.isDown) {
      this.demoShownThisStage = true;
      this.demoAnimTimer = 1.6;
      this.girl.triggerBounce(0.10);
    }
    if (this.demoAnimTimer > 0) {
      this.demoAnimTimer = Math.max(0, this.demoAnimTimer - dt);
    }

    this.wobbleBowl = Math.max(0, this.wobbleBowl - dt * 3.5);
    this.wobbleStove = Math.max(0, this.wobbleStove - dt * 3.5);
    this.wobblePlate = Math.max(0, this.wobblePlate - dt * 3.5);
    this.panShake = Math.max(0, this.panShake - dt * 3.2);

    this._updateStageChoreography(dt);
    this.food.updateAnimations(dt);
    this.hands.update(dt);
    this.girl.update(dt, this.stage);
    this.particles.update(dt);
    this.sound.update(dt, this.stage);

    this.camera.position.lerp(this.cameraTargetPos, Math.min(1, dt * 5.0));
    this.cameraLookAt.lerp(this.cameraTargetLook, Math.min(1, dt * 5.0));
    this.camera.lookAt(this.cameraLookAt);

    this.renderer.render(this.scene, this.camera);
  }

  _updateStageChoreography(dt) {
    const sx = this.food.spreadX;
    const st = this.food.pattyState;
    const lerpFast = Math.min(1, dt * 6.5);

    if (this.transitionDelay > 0) {
      this.transitionDelay -= dt;
      if (this.transitionDelay <= 0) {
        this.transitionDelay = 0;
        this._enterStage(this.stage + 1);
        return;
      }
    }

    const demoWave = this.demoAnimTimer > 0 ? Math.sin((1.6 - this.demoAnimTimer) * Math.PI * 2.5) : 0;

    if (this.stage === STAGES.KNEAD) {
      this.cameraTargetPos.copy(this.cameraBasePos);
      this.cameraTargetLook.set(0, 1.04, -0.12);

      this.food.pattyMesh.visible = true;
      this.food.pattyTopDecor.visible = true;
      this.food.pattyTopDecor.scale.setScalar(1);

      const sideZ = this.isPortrait ? -0.34 : 0.08;
      const plateZ = this.isPortrait ? -0.26 : 0.20;
      this.food.bowlGroup.position.lerp(new THREE.Vector3(0, 0, 0.52), lerpFast);
      this.food.stoveGroup.position.lerp(new THREE.Vector3(-1.54 * sx, 0, sideZ), lerpFast);
      this.food.plateGroup.position.lerp(new THREE.Vector3(1.54 * sx, 0, plateZ), lerpFast);
      this.food.pattyAnchor.position.lerp(new THREE.Vector3(0, 0.28 + st.roundness * 0.12, 0.52), lerpFast);

      if (this.isDown || this.demoAnimTimer > 0) {
        const tx = this.isDown ? THREE.MathUtils.clamp(this.worldTouch.x, -0.32, 0.32) : demoWave * 0.20;
        const tz = this.isDown ? THREE.MathUtils.clamp(this.worldTouch.z, 0.32, 0.68) : 0.48;
        const alt = Math.sin(this.stageTime * 14) * 0.07;
        this.hands.setLeftPose(
          new THREE.Vector3(-0.36 + tx * 0.45, 0.56 + alt, tz + 0.26),
          -0.28, -0.45, -0.25,
          0.62 + alt * 1.4
        );
        this.hands.setRightPose(
          new THREE.Vector3(0.36 + tx * 0.45, 0.56 - alt, tz + 0.26),
          -0.28, 0.45, 0.25,
          0.62 - alt * 1.4
        );
      } else {
        const breathe = Math.sin(this.stageTime * 2.4) * 0.022;
        this.hands.setLeftPose(
          new THREE.Vector3(-0.92 * sx, 0.44 + breathe, 0.96),
          -0.16, -0.45, -0.22, 0.26
        );
        this.hands.setRightPose(
          new THREE.Vector3(0.92 * sx, 0.44 + breathe, 0.96),
          -0.16, 0.45, 0.22, 0.26
        );
      }

      this.girl.setLookTarget(this.food.pattyAnchor.position);
    } else if (this.stage === STAGES.PECHI) {
      this.cameraTargetPos.copy(this.cameraBasePos).add(new THREE.Vector3(0, -0.04, -0.16));
      this.cameraTargetLook.set(0, 1.06, 0.0);

      this.food.bowlGroup.position.lerp(new THREE.Vector3(-2.15 * sx, 0, -0.65), lerpFast);
      this.food.stoveGroup.position.lerp(new THREE.Vector3(-1.46 * sx, 0, 0.12), lerpFast);
      this.food.plateGroup.position.lerp(new THREE.Vector3(1.48 * sx, 0, 0.22), lerpFast);

      let pattyX = this.pechiCount === 0 ? 0 : this.pechiSide * 0.40;
      let pattyY = 0.62;
      let leftX = -0.64, rightX = 0.64;

      if (this.pechiInFlight) {
        this.pechiFlight += dt * 3.8;
        const t = Math.min(1, this.pechiFlight);
        const fromX = -this.pechiSide * 0.42;
        const toX = this.pechiSide * 0.42;
        pattyX = THREE.MathUtils.lerp(fromX, toX, t);
        pattyY = 0.62 + Math.sin(t * Math.PI) * 0.26;
        this.food.pattyFlipGroup.rotation.z = -this.pechiSide * Math.sin(t * Math.PI) * 0.32;

        if (this.pechiSide < 0) leftX = -0.50 - (1 - t) * 0.16;
        else rightX = 0.50 + (1 - t) * 0.16;

        if (t >= 1) {
          this.pechiInFlight = false;
          this.food.pattyFlipGroup.rotation.z = 0;
          st.flatness = Math.min(1, this.pechiCount / 5);
          st.squashVel -= 4.0;
          this.food.deformPatty();
          this.particles.burstBubbles(this.food.pattyAnchor.position, 4);
        }
      } else if (this.pechiCount >= 5) {
        pattyX = 0;
        pattyY = 0.60;
        leftX = -0.52;
        rightX = 0.52;
      }

      this.food.pattyAnchor.position.set(pattyX, pattyY, 0.68);
      if (!this.pechiInFlight && Math.abs(st.squash) > 0.002) {
        this.food.deformPatty();
      }

      if (this.dimpleDone) {
        this.hands.setLeftPose(new THREE.Vector3(-0.54, 0.58, 0.80), -0.1, -1.05, -0.2, 0.35);
        this.hands.setRightPose(new THREE.Vector3(0.10, 0.76, 0.90), -0.45, 0.18, 0.1, 0.52);
      } else {
        this.hands.setLeftPose(
          new THREE.Vector3(leftX + demoWave * 0.14, 0.60, 0.80),
          0.04, -1.12, -0.32, 0.18
        );
        this.hands.setRightPose(
          new THREE.Vector3(rightX - demoWave * 0.14, 0.60, 0.80),
          0.04, 1.12, 0.32, 0.18
        );
      }

      this.girl.setLookTarget(this.food.pattyAnchor.position);
    } else if (this.stage === STAGES.SIZZLE) {
      this.cameraTargetPos.copy(this.cameraBasePos).add(new THREE.Vector3(0, -0.02, -0.12));
      this.cameraTargetLook.set(0, 1.02, -0.05);

      this.food.stoveGroup.position.lerp(new THREE.Vector3(0, 0, 0.44), lerpFast);
      this.food.plateGroup.position.lerp(new THREE.Vector3(1.50 * sx, 0, 0.24), lerpFast);

      const melt = Math.min(1, this.stageTime * 0.75);
      this.food.butterPat.scale.setScalar(Math.max(0.01, 1 - melt));
      if (melt >= 0.98) this.food.butterPat.visible = false;
      this.food.butterPool.material.opacity = melt * 0.82;

      const jiggleX = Math.sin(this.stageTime * 36) * 0.045 * this.panShake;
      this.food.skilletGroup.position.x = jiggleX;

      if (!this.flipped && !this.isFlipping) {
        st.searBottom = Math.min(1, st.searBottom + dt * 0.28);
        st.plump = Math.min(0.45, st.plump + dt * 0.10);
        this.meatPainter.update(1, st.searBottom, st.searTop);
        this.food.deformPatty();
      } else if (this.flipped && !this.isFlipping) {
        const cookRate = this.lidCovered ? 0.42 : 0.26;
        st.searTop = Math.min(1, st.searTop + dt * cookRate);
        const targetPlump = this.lidSteamed ? 1.0 : 0.65;
        if (st.plump < targetPlump) {
          st.plump = Math.min(targetPlump, st.plump + dt * (this.lidCovered ? 0.45 : 0.14));
          this.food.deformPatty();
        }
        this.meatPainter.update(1, st.searBottom, st.searTop);
      }

      // Dramatic front-to-back 180° X-axis somersault flip so the wide appetizing face stays visible!
      let flipY = 0;
      if (this.isFlipping) {
        this.flipProgress += dt * 1.75;
        const t = Math.min(1, this.flipProgress);
        flipY = Math.sin(t * Math.PI) * 0.92;
        this.food.pattyFlipGroup.rotation.x = -t * Math.PI;
        this.food.skilletGroup.rotation.x = -Math.sin(t * Math.PI) * 0.14;
        this.food.spatulaGroup.position.set(
          0.74 - Math.sin(t * Math.PI) * 0.56,
          0.22 + Math.sin(t * Math.PI) * 0.30,
          0.12
        );

        if (t >= 1) {
          this.isFlipping = false;
          this.flipped = true;
          this.food.pattyFlipGroup.rotation.x = -Math.PI;
          this.food.skilletGroup.rotation.x = 0;
          st.squashVel -= 4.6;
          this.food.deformPatty();
          this.particles.burstSizzleDrops(this.food.pattyAnchor.position, 10);
          this.particles.burstSteamCloud(this.food.pattyAnchor.position, 7, false);
        }
      } else {
        const readyBob = (!this.flipped && st.searBottom >= 0.55)
          ? Math.sin(this.stageTime * 7) * 0.05
          : 0;
        this.food.spatulaGroup.position.lerp(
          new THREE.Vector3(0.84, 0.36 + readyBob, 0.24),
          lerpFast
        );
      }

      this.food.pattyAnchor.position.set(
        this.food.stoveGroup.position.x + jiggleX,
        0.44 + flipY,
        this.food.stoveGroup.position.z
      );

      const lidTarget = this.lidCovered
        ? new THREE.Vector3(0, 0.30, 0.44)
        : new THREE.Vector3(-1.18 * sx, 0.02, 0.52);
      this.food.lidGroup.position.lerp(lidTarget, Math.min(1, dt * 8.5));

      this.steamEmitTimer += dt;
      if (this.steamEmitTimer > (this.lidCovered ? 0.28 : 0.18)) {
        this.steamEmitTimer = 0;
        this.particles.burstSteamCloud(this.food.pattyAnchor.position, 1, false);
        if (!this.lidCovered && Math.random() < 0.45) {
          this.particles.burstSizzleDrops(this.food.pattyAnchor.position, 1);
        }
      }

      this.hands.setLeftPose(
        this.lidCovered
          ? new THREE.Vector3(-0.34, 0.86, 0.78)
          : new THREE.Vector3(-1.05 * sx, 0.44, 0.94),
        -0.20, -0.35, -0.2, 0.46
      );
      this.hands.setRightPose(
        new THREE.Vector3(1.04 * sx, 0.52 + demoWave * 0.10, 0.86),
        -0.22, 0.42, 0.25, 0.52
      );

      this.girl.setLookTarget(this.food.pattyAnchor.position);
    } else if (this.stage === STAGES.SAUCE) {
      this.cameraTargetPos.copy(this.cameraBasePos).add(new THREE.Vector3(0, -0.04, -0.18));
      this.cameraTargetLook.set(0, 1.00, -0.04);

      // Slide stove cleanly back-left out of the way!
      this.food.stoveGroup.position.lerp(new THREE.Vector3(-1.95 * sx, 0, -0.35), lerpFast);
      this.food.plateGroup.position.lerp(new THREE.Vector3(0, 0, 0.48), lerpFast);
      this.food.toppingsGroup.position.lerp(new THREE.Vector3(-1.16 * sx, 0, 0.54), lerpFast);

      this.food.pattyAnchor.position.lerp(new THREE.Vector3(0.08, 0.25, 0.54), lerpFast);

      if (this.hasCheese) {
        this.food.placedCheese.scale.lerp(new THREE.Vector3(1, 1, 1), lerpFast);
      }
      if (this.hasEgg) {
        this.food.placedEgg.scale.lerp(new THREE.Vector3(1, 1, 1), lerpFast);
      }

      const pitcherTarget = this.isPouringSauce
        ? new THREE.Vector3(this.pourTarget.x + 0.28, 0.90, this.pourTarget.z)
        : new THREE.Vector3(0.96 * sx + demoWave * -0.35, 0.56, 0.64);
      this.food.pitcherGroup.position.lerp(pitcherTarget, Math.min(1, dt * 11));
      const targetTilt = (this.isPouringSauce || this.demoAnimTimer > 0) ? 0.54 : 0.12;
      this.food.pitcherGroup.rotation.z += (targetTilt - this.food.pitcherGroup.rotation.z) * Math.min(1, dt * 10);

      this.hands.setLeftPose(
        new THREE.Vector3(-1.08 * sx, 0.40, 1.02),
        -0.18, -0.35, -0.2, 0.25
      );
      this.hands.setRightPose(
        this.food.pitcherGroup.position.clone().add(new THREE.Vector3(0.36, -0.04, 0.28)),
        -0.18, 0.32, 0.30, 0.58
      );

      this.girl.setLookTarget(this.food.pattyAnchor.position);
    } else if (this.stage === STAGES.TASTE) {
      this.cameraTargetPos.copy(this.cameraBasePos).add(new THREE.Vector3(0, 0.02, -0.10));
      this.cameraTargetLook.set(0, 1.08, -0.16);

      this.food.stoveGroup.position.lerp(new THREE.Vector3(-2.05 * sx, 0, -0.40), lerpFast);
      this.food.plateGroup.position.lerp(new THREE.Vector3(0, 0, 0.48), lerpFast);
      this.food.pattyAnchor.position.lerp(new THREE.Vector3(0.08, 0.25, 0.54), lerpFast);

      if (this.food.juicePool.visible) {
        this.food.juicePool.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 4.5));
      }

      if (this.forkFlyingToMouth) {
        this.forkFlightT += dt * 2.2;
        const t = Math.min(1, this.forkFlightT);
        const mouthTarget = new THREE.Vector3(0, 1.44, -0.58);
        this.forkPos.lerp(mouthTarget, Math.min(1, t * 0.28 + dt * 6.5));
        if (t >= 1 || this.forkPos.distanceTo(mouthTarget) < 0.14) {
          this._completeMouthBite();
        }
      } else if (this.biteLoaded && !this.isDown) {
        this.forkPos.y = 0.66 + Math.sin(this.stageTime * 4.2) * 0.04 + (demoWave > 0 ? demoWave * 0.30 : 0);
      }

      this.food.forkGroup.position.lerp(this.forkPos, Math.min(1, dt * 14));
      this.food.forkGroup.rotation.set(
        this.biteLoaded ? -0.16 : 0.32,
        -0.12,
        0
      );

      this.hands.setLeftPose(
        new THREE.Vector3(-0.98 * sx, 0.38, 1.04),
        -0.16, -0.35, -0.2, 0.25
      );
      this.hands.setRightPose(
        this.food.forkGroup.position.clone().add(new THREE.Vector3(0.18, -0.04, 0.52)),
        -0.14, 0.22, 0.18, 0.62
      );

      this.girl.setLookTarget(
        this.biteLoaded ? this.food.forkGroup.position : this.food.pattyAnchor.position
      );

      if (this.celebratingRound) {
        this.roundResetTimer -= dt;
        if (this.roundResetTimer <= 0) {
          this.celebratingRound = false;
          this._enterStage(STAGES.KNEAD, false);
        }
      }
    }

    this.food.bowlGroup.rotation.z = Math.sin(this.stageTime * 28) * 0.08 * this.wobbleBowl;
    this.food.stoveGroup.rotation.z = Math.sin(this.stageTime * 28) * 0.05 * this.wobbleStove;
    this.food.plateGroup.rotation.z = Math.sin(this.stageTime * 28) * 0.06 * this.wobblePlate;
  }

  getDiagnostics() {
    const textures = [];
    this.scene.traverse((obj) => {
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map && m.map.image) {
            const w = m.map.image.width || 0;
            const h = m.map.image.height || 0;
            const label = `${w}x${h}`;
            if (!textures.includes(label)) textures.push(label);
          }
        });
      }
    });
    return {
      stage: this.stage,
      fps: this.fps,
      pixelRatio: this.renderer.getPixelRatio(),
      triangles: this.renderer.info.render.triangles,
      calls: this.renderer.info.render.calls,
      textureSizes: textures,
      knead: Number(this.food.pattyState.knead.toFixed(2)),
      pechiCount: this.pechiCount,
      flipped: this.flipped,
      sauceTotal: Number(this.sauceTotal.toFixed(2)),
      bitesFed: this.bitesFed
    };
  }
}

const game = new HamburgSteakGame();
window.__GAME__ = game;
