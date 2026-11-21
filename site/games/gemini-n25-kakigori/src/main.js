import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { SoundEngine } from './audio.js';
import { TiltShiftRenderer } from './postprocess.js';
import { IceShaver } from './shaver.js';
import { FruitFactory, KakigoriBowl, SYRUP_COLORS } from './kakigori.js';
import { ShopProps } from './props.js';
import { MiniatureCustomer } from './customer.js';

class KakigoriGame {
  constructor() {
    this.sound = new SoundEngine();
    this.phase = 'SHAVE'; // SHAVE | DECORATE | SERVING
    this.isPortrait = false;
    this.time = 0;
    this.idleTime = 0;
    this.shaveHintShown = false;
    this.decorateHintShown = false;

    // Active single-finger gesture state
    this.activePointerId = null;
    this.dragMode = null; // 'crank' | 'bottle' | 'fruit' | 'bowl'
    this.dragStartScreen = new THREE.Vector2();
    this.dragLastScreen = new THREE.Vector2();
    this.dragLastAngle = 0;
    this.dragMoved = false;
    this.dragBottle = null;
    this.dragFruitMesh = null;
    this.dragFruitKind = null;
    this.pourAudioTimer = 0;
    this.milkDropTimer = 0;
    this.sparkleAudioTimer = 0;

    // Auto-animations for tap-tolerant gestures
    this.autoPour = null; // { bottle, t, duration, isMilk }
    this.flyingFruits = []; // { mesh, kind, start, end, t, duration }

    this._initRenderer();
    this._initScene();
    this._initWorld();
    this._initIdleDemoHand();
    this._bindEvents();
    this._handleResize();

    this.lastFrameTime = performance.now();
    this.fpsSamples = [];
    this._exposeDebug();
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    // Strict iPhone/iPad pixel ratio cap <= 1.5
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    const bufW = Math.floor(window.innerWidth * this.renderer.getPixelRatio());
    const bufH = Math.floor(window.innerHeight * this.renderer.getPixelRatio());
    this.tiltShift = new TiltShiftRenderer(this.renderer, bufW, bufH);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ec4c9);
    // Very gentle warm atmospheric depth haze behind the stall
    this.scene.fog = new THREE.Fog(0xd8e6d8, 8.5, 16.5);

    this.camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.2, 30);

    // Realistic studio-miniature reflections via RoomEnvironment PMREM
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    // Warm golden summer afternoon sunlight (macro miniature key light — balanced so snow never clips!)
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.88);
    sun.position.set(3.2, 5.6, 3.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); // Strict <= 1024px budget
    sun.shadow.camera.near = 1.0;
    sun.shadow.camera.far = 14.0;
    sun.shadow.camera.left = -3.4;
    sun.shadow.camera.right = 3.4;
    sun.shadow.camera.top = 3.6;
    sun.shadow.camera.bottom = -2.6;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    // Cool summer sky / warm wooden counter bounce hemisphere light
    const hemi = new THREE.HemisphereLight(0xd2ebff, 0xc7925e, 0.85);
    this.scene.add(hemi);

    // Soft backlit golden rim light so translucent shaved ice & glass sparkle photographically!
    const rim = new THREE.DirectionalLight(0xffe0ad, 0.85);
    rim.position.set(-2.6, 3.2, -3.4);
    this.scene.add(rim);
  }

  _initWorld() {
    this.fruitFactory = new FruitFactory();
    this.props = new ShopProps(this.scene, this.fruitFactory);
    this.shaver = new IceShaver(this.scene);
    this.shaver.group.position.set(-0.78, 0, 0.22);
    this.shaver.group.rotation.y = 0.14;

    this.bowl = new KakigoriBowl(this.scene, this.fruitFactory);
    this.customer = new MiniatureCustomer(this.scene);

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05);
    this.counterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  // Subtle sculpted miniature wooden/porcelain hand that ONLY performs 1 gentle demo if untouched for 10s
  _initIdleDemoHand() {
    this.demoHand = new THREE.Group();
    const handMat = new THREE.MeshStandardMaterial({
      color: 0xfbe5d2,
      roughness: 0.45,
      transparent: true,
      opacity: 0.0,
    });
    this.demoHandMat = handMat;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), handMat);
    palm.scale.set(1.0, 0.78, 1.15);
    this.demoHand.add(palm);

    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.14, 8, 10), handMat);
    finger.position.set(0.05, -0.02, -0.14);
    finger.rotation.x = Math.PI / 2;
    this.demoHand.add(finger);

    this.demoHand.visible = false;
    this.scene.add(this.demoHand);
    this.demoAnim = null;
  }

  _getShaveBowlPos() {
    const p = this.shaver.getChuteWorldPosition(new THREE.Vector3());
    p.y = 0.018; // Rests cleanly on top of the cast-iron drip pad with zero Z-fighting!
    return p;
  }

  _getDecorateBowlPos() {
    return new THREE.Vector3(this.props.coaster.position.x, 0.022, this.props.coaster.position.z);
  }

  _getServeBowlPos() {
    return new THREE.Vector3(0.0, 0.018, -0.58);
  }

  _handleResize(overrideW = null, overrideH = null) {
    const w = overrideW || window.innerWidth;
    const h = overrideH || window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.isPortrait = aspect < 0.85;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.tiltShift.resize(Math.floor(w * dpr), Math.floor(h * dpr));

    this.camera.aspect = aspect;

    if (this.isPortrait) {
      // Cozy vertical miniature portrait framing for iPhone — 100% of red crank handle, customer face, bottles, milk, fruits & bowl visible!
      this.shaver.group.position.set(-0.84, 0, 0.20);
      this.shaver.group.rotation.y = 0.28;
      this.props.applyLayout(true);
      this.camera.fov = aspect < 0.55 ? 50 : 45;
      this.camera.position.set(0.05, 3.95, 8.25);
      this.camera.lookAt(0.05, 1.05, 0.08);
    } else {
      // Lush wide macro tabletop photograph framing for iPad landscape & desktop!
      this.shaver.group.position.set(-1.12, 0, 0.16);
      this.shaver.group.rotation.y = 0.14;
      this.props.applyLayout(false);
      this.camera.fov = aspect > 1.5 ? 35 : 38;
      this.camera.position.set(0.04, 2.86, 5.82);
      this.camera.lookAt(0.06, 1.12, -0.10);
    }
    this.camera.updateProjectionMatrix();

    // Keep bowl aligned with its current station after orientation changes
    if (this.phase === 'SHAVE') {
      this.bowl.targetPos.copy(this._getShaveBowlPos());
    } else if (this.phase === 'DECORATE') {
      this.bowl.targetPos.copy(this._getDecorateBowlPos());
    } else if (this.phase === 'SERVING') {
      this.bowl.targetPos.copy(this._getServeBowlPos());
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._handleResize());
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._onPointerUp(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e), { passive: false });
  }

  _updateNDC(clientX, clientY) {
    this.ndc.x = (clientX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  _getAllHitMeshes() {
    return [
      ...this.shaver.hitMeshes,
      ...this.props.hitMeshes,
      ...this.bowl.hitMeshes,
      ...this.customer.hitMeshes,
    ];
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.sound.unlock();
    this.idleTime = 0;
    this.demoAnim = null;
    this.demoHand.visible = false;

    // Multi-touch guard: ignore extra fingers while one gesture is active
    if (this.activePointerId !== null) return;

    this._updateNDC(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this._getAllHitMeshes(), false);
    if (hits.length === 0) return;

    const hitObj = hits[0].object;
    const type = hitObj.userData.interactType;

    // Always allow ringing the hanging glass wind chime (Discovery 7)!
    if (type === 'furin') {
      this.props.ringFurin();
      this.sound.playFurinChime();
      return;
    }

    if (this.phase === 'SERVING') return;

    // Cancel any running auto-pour if user grabs something new
    if (this.autoPour) {
      this._finishAutoPour();
    }

    this.activePointerId = e.pointerId;
    this.dragStartScreen.set(e.clientX, e.clientY);
    this.dragLastScreen.set(e.clientX, e.clientY);
    this.dragMoved = false;

    if (type === 'crank') {
      this.dragMode = 'crank';
      const center = this.shaver.getWheelScreenCenter(this.camera, window.innerWidth, window.innerHeight);
      this.dragLastAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x);
      // Slide bowl smoothly under the shaver blade so child can shave (or add MORE snow anytime!)
      this.bowl.targetPos.copy(this._getShaveBowlPos());
      // Instant tactile micro-nudge & sparkle on touch (<100ms causality!)
      this._applyCrankSpin(0.28);
    } else if (type === 'syrup' || type === 'milk') {
      const key = type === 'milk' ? 'milk' : hitObj.userData.flavor;
      if (this.bowl.iceAmount < 0.25) {
        // Out-of-stage feedback: cute wobble + wood clink + gentle crank wiggle!
        this.props.wobbleBottle(key);
        this.sound.playWoodTok(1.1);
        this.shaver.triggerGentleNudge();
        this.activePointerId = null;
        return;
      }
      this.phase = 'DECORATE';
      this.bowl.targetPos.copy(this._getDecorateBowlPos());
      this.dragMode = 'bottle';
      this.dragBottle = this.props.bottles[key];
      this.sound.playWoodTok(1.25);
    } else if (type === 'fruit') {
      const kind = hitObj.userData.fruitKind;
      if (this.bowl.iceAmount < 0.25) {
        this.props.wobbleFruit(kind);
        this.sound.playWoodTok(1.3);
        this.shaver.triggerGentleNudge();
        this.activePointerId = null;
        return;
      }
      this.phase = 'DECORATE';
      this.bowl.targetPos.copy(this._getDecorateBowlPos());
      this.dragMode = 'fruit';
      this.dragFruitKind = kind;
      this.dragFruitMesh = this.fruitFactory.createFruit(kind, 1.15);
      this.scene.add(this.dragFruitMesh);
      this.props.popRespawnFruit(kind);
      this.sound.playWoodTok(1.45);
      this._positionDraggedFruit(e.clientX, e.clientY);
    } else if (type === 'bowl') {
      if (this.bowl.iceAmount < 0.32) {
        // Empty bowl gently clinks & invites cranking
        this.sound.playWoodTok(0.95);
        this.shaver.triggerGentleNudge();
        this.activePointerId = null;
        return;
      }
      this.dragMode = 'bowl';
    } else if (type === 'customer' || type === 'serveMat') {
      if (this.bowl.iceAmount >= 0.42 && this.bowl.hasDecoration()) {
        this._serveToCustomer();
      } else if (this.bowl.iceAmount >= 0.42) {
        // If tapped customer with plain snow, still let them gently bob excitedly!
        this.customer.setEager(true);
        this.sound.playWoodTok(1.15);
      } else {
        this.shaver.triggerGentleNudge();
        this.sound.playWoodTok(1.0);
      }
      this.activePointerId = null;
    }
  }

  _onPointerMove(e) {
    if (this.activePointerId === null || e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.idleTime = 0;

    const movedDist = Math.hypot(e.clientX - this.dragStartScreen.x, e.clientY - this.dragStartScreen.y);
    if (movedDist > 12) this.dragMoved = true;

    if (this.dragMode === 'crank') {
      const center = this.shaver.getWheelScreenCenter(this.camera, window.innerWidth, window.innerHeight);
      const ang = Math.atan2(e.clientY - center.y, e.clientX - center.x);
      let dAng = ang - this.dragLastAngle;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      this.dragLastAngle = ang;

      // Tolerant gesture: accepts circling OR vertical/horizontal rubbing on the crank!
      const linDist = Math.hypot(e.clientX - this.dragLastScreen.x, e.clientY - this.dragLastScreen.y);
      const effectiveSpin = Math.max(Math.abs(dAng), linDist * 0.022);
      if (effectiveSpin > 0.005) {
        this._applyCrankSpin(Math.min(0.65, effectiveSpin));
      }
    } else if (this.dragMode === 'bottle' && this.dragBottle) {
      this._positionDraggedBottle(e.clientX, e.clientY);
    } else if (this.dragMode === 'fruit' && this.dragFruitMesh) {
      this._positionDraggedFruit(e.clientX, e.clientY);
    } else if (this.dragMode === 'bowl') {
      // Slide bowl smoothly across wooden counter toward customer!
      this._updateNDC(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const pt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.counterPlane, pt)) {
        const clampedX = THREE.MathUtils.clamp(pt.x, -0.55, 0.55);
        const clampedZ = THREE.MathUtils.clamp(pt.z, -0.68, 0.62);
        this.bowl.targetPos.set(clampedX, 0, clampedZ);
        if (clampedZ < -0.28) {
          this.activePointerId = null;
          this.dragMode = null;
          this._serveToCustomer();
          return;
        }
      }
    }

    this.dragLastScreen.set(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    if (this.activePointerId === null || e.pointerId !== this.activePointerId) return;

    if (this.dragMode === 'crank') {
      // If child tapped crank without dragging, give a playful little spin boost!
      if (!this.dragMoved) {
        this._applyCrankSpin(0.85);
      }
      if (this.bowl.iceAmount >= 0.45 && this.phase === 'SHAVE') {
        this.phase = 'DECORATE';
        this.bowl.targetPos.copy(this._getDecorateBowlPos());
      }
    } else if (this.dragMode === 'bottle' && this.dragBottle) {
      const b = this.dragBottle;
      this.props.hidePourStream();
      if (!this.dragMoved) {
        // Tap tolerance! Bottle automatically arcs over the ice, pours generously, and returns!
        this._startAutoPour(b);
      } else {
        b.targetPos.copy(b.homePos);
        b.targetRotZ = 0;
        b.targetRotX = 0;
      }
      this.dragBottle = null;
    } else if (this.dragMode === 'fruit' && this.dragFruitMesh) {
      const kind = this.dragFruitKind;
      const pos = this.dragFruitMesh.position.clone();
      this.scene.remove(this.dragFruitMesh);
      this.dragFruitMesh = null;

      if (!this.dragMoved) {
        // Tap tolerance! Fruit hops in a joyful arc onto the shaved ice mountain!
        this._launchFruitArc(kind);
      } else {
        // Generous magnetic snap if released anywhere near the bowl!
        const distToBowl = Math.hypot(pos.x - this.bowl.group.position.x, pos.z - this.bowl.group.position.z);
        if (distToBowl < 1.25) {
          this.bowl.addFruitTopping(kind, pos);
          this.sound.playToppingPlop();
          this.customer.setEager(true);
        }
      }
      this.dragFruitKind = null;
    } else if (this.dragMode === 'bowl') {
      if (this.bowl.targetPos.z < -0.18) {
        this._serveToCustomer();
      } else if (!this.dragMoved && this.bowl.hasDecoration()) {
        // Gentle bounce toward customer if tapped when already decorated, or slide back neatly
        this.bowl.targetPos.copy(this._getDecorateBowlPos());
      } else {
        this.bowl.targetPos.copy(this.phase === 'SHAVE' ? this._getShaveBowlPos() : this._getDecorateBowlPos());
      }
    }

    this.activePointerId = null;
    this.dragMode = null;
  }

  _applyCrankSpin(deltaAngle) {
    this.shaver.addCrankDelta(deltaAngle);
    const result = this.bowl.addIce(deltaAngle * 0.055);
    this.customer.setLookTarget(this.bowl.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)));

    if (result === 'tumbled') {
      this.sound.playSnowTumble();
    } else if (this.sparkleAudioTimer <= 0) {
      this.sound.playIceSparkle(0.9 + this.bowl.iceAmount * 0.35);
      this.sparkleAudioTimer = 0.085;
    }

    if (this.bowl.iceAmount >= 0.45 && this.phase === 'SHAVE') {
      this.customer.setEager(true);
    }
  }

  _positionDraggedBottle(clientX, clientY) {
    this._updateNDC(clientX, clientY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const snowTop = this.bowl.getSnowTopWorldY();
    this.dragPlane.constant = -(snowTop + 0.45);
    const pt = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, pt)) return;

    pt.x = THREE.MathUtils.clamp(pt.x, -1.6, 2.0);
    pt.z = THREE.MathUtils.clamp(pt.z, -0.8, 1.3);

    const b = this.dragBottle;
    const isMilk = b.key === 'milk';
    const bowlPos = this.bowl.group.position;
    const dist = Math.hypot(pt.x - bowlPos.x, pt.z - bowlPos.z);

    // Offset slightly right so the spout hovers directly under the player's finger!
    b.targetPos.set(pt.x + (dist < 0.95 ? 0.36 : 0), pt.y, pt.z);
    if (dist < 0.98) {
      // Smoothly tilt bottle to pour straight onto the ice!
      b.targetRotZ = isMilk ? 2.35 : 1.32;
      b.targetRotX = 0.12;
      this.customer.setLookTarget(b.group.position);

      const spoutWorld = b.spoutTip.getWorldPosition(new THREE.Vector3());
      const aimX = pt.x - bowlPos.x;
      const aimZ = pt.z - bowlPos.z;
      const { pos: localSurf } = this.bowl.getSurfacePointLocal(aimX, aimZ);
      const hitWorld = this.bowl.snowGroup.localToWorld(localSurf.clone());

      this.props.showPourStream(spoutWorld, hitWorld, b.color, isMilk);

      if (isMilk) {
        if (this.milkDropTimer <= 0) {
          this.bowl.addMilkDrizzle(hitWorld);
          this.sound.playSyrupBubble('milk');
          this.milkDropTimer = 0.18;
          this.customer.setEager(true);
        }
      } else {
        const newlyMixed = this.bowl.pourSyrupAt(hitWorld, b.key, 0.06);
        if (newlyMixed) {
          this.sound.playColorMixSparkle();
        }
        if (this.pourAudioTimer <= 0) {
          this.sound.playSyrupBubble(b.key);
          this.pourAudioTimer = 0.085;
          this.customer.setEager(true);
        }
      }
    } else {
      b.targetRotZ = 0.12;
      b.targetRotX = 0;
      this.props.hidePourStream();
    }
  }

  _positionDraggedFruit(clientX, clientY) {
    this._updateNDC(clientX, clientY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const snowTop = this.bowl.getSnowTopWorldY();
    this.dragPlane.constant = -(snowTop + 0.18);
    const pt = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, pt)) return;
    this.dragFruitMesh.position.set(
      THREE.MathUtils.clamp(pt.x, -1.6, 1.8),
      pt.y,
      THREE.MathUtils.clamp(pt.z, -0.8, 1.3)
    );
    this.customer.setLookTarget(this.dragFruitMesh.position);
  }

  _startAutoPour(bottle) {
    this.autoPour = {
      bottle,
      t: 0,
      duration: bottle.key === 'milk' ? 0.85 : 0.92,
      isMilk: bottle.key === 'milk',
      milkDone: false,
    };
  }

  _finishAutoPour() {
    if (!this.autoPour) return;
    const b = this.autoPour.bottle;
    b.targetPos.copy(b.homePos);
    b.targetRotZ = 0;
    b.targetRotX = 0;
    this.props.hidePourStream();
    this.autoPour = null;
  }

  _launchFruitArc(kind) {
    const start = this.props.plateGroup.position.clone().add(new THREE.Vector3(0, 0.2, 0));
    const mesh = this.fruitFactory.createFruit(kind, 1.1);
    mesh.position.copy(start);
    this.scene.add(mesh);

    const end = this.bowl.group.position.clone().add(new THREE.Vector3(0, this.bowl.getSnowTopWorldY(), 0));
    this.flyingFruits.push({ mesh, kind, start, end, t: 0, duration: 0.36 });
  }

  _serveToCustomer() {
    if (this.phase === 'SERVING') return;
    this._finishAutoPour();
    this.phase = 'SERVING';
    this.sound.playBowlSlide();

    const servePos = this._getServeBowlPos();
    this.bowl.targetPos.copy(servePos);
    this.bowl.spoon.visible = false; // Customer picks up the spoon!

    const profile = this.bowl.getFlavorProfile();

    // Small pause while bowl glides onto the striped serving mat, then customer eats!
    setTimeout(() => {
      if (this.phase !== 'SERVING') return;
      this.customer.startEating(
        profile,
        (biteOrEvent, reactionType) => {
          if (biteOrEvent === 'react') {
            this.sound.playReaction(reactionType);
            this.props.addKeepsakeCharm(profile);
          } else {
            this.bowl.takeBite(biteOrEvent);
            this.sound.playEatCrunch();
          }
        },
        () => {
          // Seamless next bowl!
          this.phase = 'SHAVE';
          this.shaver.resetIceBlock();
          this.bowl.resetForNewBowl(this._getShaveBowlPos());
          this.sound.resetToppingPitch();
          this.idleTime = 0;
        }
      );
    }, 380);
  }

  _updateAutoPour(dt) {
    if (!this.autoPour) return;
    const ap = this.autoPour;
    ap.t += dt;
    const f = Math.min(1, ap.t / ap.duration);
    const b = ap.bottle;
    const bowlPos = this.bowl.group.position;
    const snowTop = this.bowl.getSnowTopWorldY();

    if (f < 0.82) {
      // Orbit gently over the snow mountain while pouring!
      const swirlA = f * Math.PI * 2.5;
      const rad = 0.20;
      const aimX = bowlPos.x + Math.cos(swirlA) * rad;
      const aimZ = bowlPos.z + Math.sin(swirlA) * rad;
      b.targetPos.set(aimX + 0.44, snowTop + 0.48, aimZ);
      b.targetRotZ = ap.isMilk ? 2.35 : 1.32;
      b.targetRotX = 0.1;

      if (f > 0.18) {
        const spoutWorld = b.spoutTip.getWorldPosition(new THREE.Vector3());
        const { pos: localSurf } = this.bowl.getSurfacePointLocal(aimX - bowlPos.x, aimZ - bowlPos.z);
        const hitWorld = this.bowl.snowGroup.localToWorld(localSurf.clone());
        this.props.showPourStream(spoutWorld, hitWorld, b.color, ap.isMilk);
        this.customer.setLookTarget(hitWorld);

        if (ap.isMilk) {
          if (!ap.milkDone && f > 0.35) {
            ap.milkDone = true;
            this.bowl.addMilkDrizzle(null);
            this.sound.playSyrupBubble('milk');
            this.customer.setEager(true);
          }
        } else {
          const mixed = this.bowl.pourSyrupAt(hitWorld, b.key, dt * 1.45);
          if (mixed) this.sound.playColorMixSparkle();
          if (this.pourAudioTimer <= 0) {
            this.sound.playSyrupBubble(b.key);
            this.pourAudioTimer = 0.085;
            this.customer.setEager(true);
          }
        }
      }
    } else {
      this._finishAutoPour();
    }
  }

  _updateFlyingFruits(dt) {
    for (let i = this.flyingFruits.length - 1; i >= 0; i--) {
      const ff = this.flyingFruits[i];
      ff.t += dt;
      const f = Math.min(1, ff.t / ff.duration);
      ff.mesh.position.lerpVectors(ff.start, ff.end, f);
      ff.mesh.position.y += Math.sin(f * Math.PI) * 0.72;
      ff.mesh.rotation.y += dt * 7;
      if (f >= 1) {
        this.scene.remove(ff.mesh);
        this.bowl.addFruitTopping(ff.kind, null);
        this.sound.playToppingPlop();
        this.customer.setEager(true);
        this.flyingFruits.splice(i, 1);
      }
    }
  }

  // Strictly obeys: "放置時のみ手で1回実演" — 0-10s silent, then ONE gentle 3D hand arc demo
  _updateIdleHint(dt) {
    if (this.phase === 'SERVING' || this.activePointerId !== null || this.autoPour) {
      this.idleTime = 0;
      return;
    }
    this.idleTime += dt;

    if (this.phase === 'SHAVE' && !this.shaveHintShown && this.idleTime > 10.0) {
      this.shaveHintShown = true;
      this.demoAnim = { t: 0, duration: 2.3 };
      this.demoHand.visible = true;
    } else if (this.phase === 'DECORATE' && !this.bowl.hasDecoration() && !this.decorateHintShown && this.idleTime > 11.0) {
      this.decorateHintShown = true;
      this.props.wobbleBottle('strawberry');
      this.sound.playWoodTok(1.15);
    }

    if (this.demoAnim) {
      this.demoAnim.t += dt;
      const f = this.demoAnim.t / this.demoAnim.duration;
      if (f >= 1) {
        this.demoAnim = null;
        this.demoHand.visible = false;
        this.demoHandMat.opacity = 0;
      } else {
        const fade = Math.sin(f * Math.PI);
        this.demoHandMat.opacity = fade * 0.72;
        // Orbit softly near the red wooden crank knob once!
        const hp = this.shaver.getHandleWorldPosition(new THREE.Vector3());
        const a = f * Math.PI * 2.1;
        this.demoHand.position.set(
          hp.x - 0.12,
          hp.y + Math.sin(a) * 0.34,
          hp.z + 0.15 + Math.cos(a) * 0.25
        );
      }
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.time += dt;

    if (this.pourAudioTimer > 0) this.pourAudioTimer -= dt;
    if (this.milkDropTimer > 0) this.milkDropTimer -= dt;
    if (this.sparkleAudioTimer > 0) this.sparkleAudioTimer -= dt;

    // Continuous velocity-coupled ice-shaving crunch sound
    this.sound.setShaveSpeed(this.shaver.crankVelocity / 12);

    this._updateAutoPour(dt);
    this._updateFlyingFruits(dt);
    this._updateIdleHint(dt);

    const snowTopY = this.bowl.getSnowTopWorldY();
    this.shaver.update(dt, snowTopY);
    this.bowl.update(dt);
    this.props.update(dt);
    this.customer.update(dt);

    // Track rolling FPS for perf diagnostics
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 45) this.fpsSamples.shift();

    this.tiltShift.render(this.scene, this.camera);
  }

  _exposeDebug() {
    window.__KAKIGORI__ = {
      getStats: () => {
        const avgFps = this.fpsSamples.length
          ? Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length)
          : 0;
        return {
          phase: this.phase,
          iceAmount: Number(this.bowl.iceAmount.toFixed(2)),
          syrupTotals: { ...this.bowl.syrupTotals },
          milkCount: this.bowl.milkCount,
          toppings: this.bowl.toppings.length,
          keepsakes: this.props.keepsakes.length,
          triangles: this.tiltShift.lastSceneTriangles || this.renderer.info.render.triangles,
          calls: this.tiltShift.lastSceneCalls || this.renderer.info.render.calls,
          pixelRatio: this.renderer.getPixelRatio(),
          avgFps,
        };
      },
      // Helper methods for automated screenshot verification of every gameplay stage
      demoShave: (amount = 0.95) => {
        const steps = Math.ceil(amount / 0.055);
        for (let i = 0; i < steps; i++) this._applyCrankSpin(0.95);
        this.phase = 'DECORATE';
        this.bowl.targetPos.copy(this._getDecorateBowlPos());
        this.bowl.group.position.copy(this.bowl.targetPos);
      },
      demoDecorate: (rainbow = true) => {
        const bp = this.bowl.group.position;
        if (rainbow) {
          this.bowl.pourSyrupAt(new THREE.Vector3(bp.x - 0.30, bp.y + 1.08, bp.z + 0.16), 'strawberry', 1.15);
          this.bowl.pourSyrupAt(new THREE.Vector3(bp.x + 0.02, bp.y + 1.24, bp.z + 0.14), 'lemon', 1.10);
          this.bowl.pourSyrupAt(new THREE.Vector3(bp.x + 0.30, bp.y + 1.06, bp.z + 0.16), 'blue', 1.15);
        } else {
          this.bowl.pourSyrupAt(new THREE.Vector3(bp.x, bp.y + 1.18, bp.z + 0.14), 'strawberry', 1.35);
        }
        this.bowl.addMilkDrizzle(null);
        this.bowl.addFruitTopping('cherry', null);
        this.bowl.addFruitTopping('strawberry', null);
        this.bowl.addFruitTopping('kiwi', null);
        this.bowl.addFruitTopping('mandarin', null);
        this.customer.setEager(true);
      },
      demoServe: () => this._serveToCustomer(),
      resizeForTest: (w, h) => this._handleResize(w, h),
      stepAndRender: (seconds = 0.05) => {
        const steps = Math.max(1, Math.ceil(seconds / 0.033));
        const dt = seconds / steps;
        for (let i = 0; i < steps; i++) {
          this.time += dt;
          this._updateAutoPour(dt);
          this._updateFlyingFruits(dt);
          this._updateIdleHint(dt);
          this.shaver.update(dt, this.bowl.getSnowTopWorldY());
          this.bowl.update(dt);
          this.props.update(dt);
          this.customer.update(dt);
        }
        this.tiltShift.render(this.scene, this.camera);
      },
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new KakigoriGame();
});
