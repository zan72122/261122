import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMiniatureTextures } from './textures.js';
import { MiniatureAudio } from './audio.js';
import { TiltShiftPipeline } from './postfx.js';
import {
  SYRUP_DEFS,
  createFruitMesh,
  KakigoriMachine,
  KakigoriBowl,
  MiniatureParticles,
} from './kakigori.js';
import { CustomerManager, ShopkeeperHands } from './characters.js';
import { KakigoriWorld } from './world.js';

class KakigoriMiniatureGame {
  constructor() {
    this.container = document.getElementById('app');

    // WebGLRenderer with strict pixelRatio <= 1.5 for silky 30-60fps on iPhone/iPad
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // MSAA handled on HalfFloat sharpRT
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // Filmic ACES handled in TiltShiftPipeline
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Warm sunlit miniature studio environment reflections for glass, brass & wet fruits
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.62;
    roomEnv.dispose();
    pmrem.dispose();

    // Macro photography camera
    this.camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.2, 35);
    this.camBasePos = new THREE.Vector3(0, 3.05, 5.28);
    this.camLookTarget = new THREE.Vector3(0.05, 1.48, 0.65);
    this.camFocusZoom = 0; // 0 = counter view, 1 = cozy customer eating close-up

    this.textures = createMiniatureTextures();
    this.audio = new MiniatureAudio();
    this.postfx = new TiltShiftPipeline(this.renderer);

    this.world = new KakigoriWorld(this.scene, this.textures);
    this.machine = new KakigoriMachine(this.textures);
    this.scene.add(this.machine.group);

    this.bowl = new KakigoriBowl(this.textures);
    this.scene.add(this.bowl.group);

    this.customer = new CustomerManager(this.textures);
    this.scene.add(this.customer.group);

    this.hands = new ShopkeeperHands();
    this.scene.add(this.hands.group);

    this.particles = new MiniatureParticles(this.scene);

    // One-finger forgiving interaction state
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0.35, 0.94).normalize(), -1.55);

    this.activePointerId = null;
    this.gestureMode = null; // 'wheel' | 'syrup' | 'milk' | 'fruit' | 'bowlSlide'
    this.activeSyrupIdx = 0;
    this.draggingFruit = null;
    this.pointerDownPos = new THREE.Vector2();
    this.lastPointerPos = new THREE.Vector2();
    this.lastWheelPointerAngle = 0;
    this.wheelSpinVelocity = 0;
    this.pourClock = 0;

    // Idle guidance strictly obeying preference:
    // 0-6s: nothing. After 10s of complete inactivity on first stage, 3D hand demonstrates ONCE ("放置時のみ手で1回実演").
    this.idleSeconds = 0;
    this.hasDemonstratedThisBowl = false;
    this.demoAnimTimer = 0;
    this.servedBowlsCount = 0;
    this.servingTransition = null;

    // Performance tracking
    this.fps = 60;
    this._fpsFrames = 0;
    this._fpsAccum = 0;

    this._bindEvents();
    this._onResize();

    this.clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);

    // Expose read-only telemetry for automated QA & screenshot verification
    window.__KAKIGORI_DEBUG__ = {
      game: this,
      getStats: () => ({
        fps: Math.round(this.fps),
        triangles: this.postfx.sceneTriangles,
        calls: this.postfx.sceneCalls,
        textures: this.renderer.info.memory.textures,
        pixelRatio: this.renderer.getPixelRatio(),
        sharpRTSize: [this.postfx.sharpRT.width, this.postfx.sharpRT.height],
        iceProgress: Number(this.bowl.iceProgress.toFixed(3)),
        syrupDrops: this.bowl.syrupDropsCount,
        milkDrops: this.bowl.milkDropsCount,
        fruits: this.bowl.placedFruits.length,
        servedCount: this.servedBowlsCount,
        customerState: this.customer.state,
      }),
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._onPointerUp(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h);
    this.postfx.setSize(w, h, this.dpr);

    const aspect = w / Math.max(1, h);
    this.isPortrait = aspect < 0.85;
    this.camera.aspect = aspect;

    if (this.isPortrait) {
      // Ensure full horizontal workspace fits comfortably on iPhone portrait!
      const targetHalfTanH = 0.355;
      const vFovRad = 2 * Math.atan(targetHalfTanH / Math.max(0.42, aspect));
      this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFovRad), 38, 62);
      this.camBasePos.set(0, 3.48, 5.88);
      this.camLookTarget.set(0.0, 1.56, 0.92);
    } else {
      // Crisp 4:3 / iPad landscape macro diorama framing with zero edge cropping
      const extraWide = aspect > 1.45 ? 0 : (1.45 - aspect) * 6.5;
      this.camera.fov = 35 + extraWide;
      this.camBasePos.set(0, 3.16, 5.72);
      this.camLookTarget.set(0.02, 1.56, 0.78);
    }
    this.camera.updateProjectionMatrix();

    this.world.updateResponsiveLayout(this.isPortrait, this.machine.group);
    this.customer.setResponsivePosition(this.isPortrait);
  }

  _updateNDC(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  _getInteractiveTargets() {
    const list = [
      this.machine.wheelCollider,
      this.bowl.bowlCollider,
      this.customer.customerCollider,
      this.world.servingMat,
      ...this.world.syrupBottles.map((b) => b.group.children[b.group.children.length - 1]),
      this.world.milkBottleGroup.children[this.world.milkBottleGroup.children.length - 1],
      ...this.world.fruitDishes.map((d) => d.group.children[d.group.children.length - 1]),
      this.world.fuurin.group.children[this.world.fuurin.group.children.length - 1],
      this.world.pinwheel.group.children[this.world.pinwheel.group.children.length - 1],
      this.world.brassBell.group.children[this.world.brassBell.group.children.length - 1],
    ];
    if (this.bowl.snowMesh.visible) {
      list.unshift(this.bowl.snowMesh);
    }
    return list;
  }

  _projectToScreen(worldVec) {
    const v = worldVec.clone().project(this.camera);
    return new THREE.Vector2(v.x, v.y);
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.audio.unlock();

    // Multi-touch safe: ignore extra resting fingers while one finger is already operating
    if (this.activePointerId !== null) return;

    this.idleSeconds = 0;
    this.demoAnimTimer = 0;

    if (this.servingTransition || this.customer.state === 'eating' || this.customer.state === 'leaving') {
      return;
    }

    this.activePointerId = e.pointerId;
    this._updateNDC(e.clientX, e.clientY);
    this.pointerDownPos.copy(this.pointerNDC);
    this.lastPointerPos.copy(this.pointerNDC);

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this._getInteractiveTargets(), false);
    const topHit = hits[0]?.object;
    const role = topHit?.userData?.hitRole;

    // 0. Interactive Shop Keepsakes (always responsive!)
    if (role === 'keepsake') {
      const id = topHit.userData.keepsakeId;
      if (id === 'fuurin') {
        this.world.fuurin.swing = 0.34;
        this.audio.playWindChime();
      } else if (id === 'pinwheel' && this.world.pinwheel.group.visible) {
        this.world.pinwheel.spinVel = 22.0;
        this.audio.playSparkleChord([659.25, 880, 1046.5], 0.06);
      } else if (id === 'bell' && this.world.brassBell.group.visible) {
        this.world.brassBell.bounce = 1.0;
        this.audio.playBrassBell();
        this.customer.triggerBellWave();
      }
      this.activePointerId = null;
      return;
    }

    const hasIce = this.bowl.iceProgress >= 0.32;

    // 1. Crank Wheel (Primary action at start, and ALWAYS usable to shave even more mountain!)
    if (role === 'wheel' || (!hasIce && (!role || role === 'bowl'))) {
      if (role === 'wheel' || this.pointerNDC.x < 0.25) {
        this.gestureMode = 'wheel';
        this.machine.targetSwingAngle = 0;
        const hubWorld = new THREE.Vector3();
        this.machine.wheelGroup.getWorldPosition(hubWorld);
        const hubScreen = this._projectToScreen(hubWorld);
        this.lastWheelPointerAngle = Math.atan2(
          this.pointerNDC.y - hubScreen.y,
          this.pointerNDC.x - hubScreen.x
        );
        // Immediate tactile response on touch!
        this._advanceCrank(0.32);
        return;
      }
    }

    // Rule from preference: "今の段階の物だけ本反応、他は小さく揺れる"
    // If bowl has NO ice yet, tapping bottles/fruits/customer gently wobbles them without pouring into empty air!
    if (!hasIce) {
      if (role === 'syrup') {
        const b = this.world.syrupBottles[topHit.userData.syrupIndex];
        b.wobble = 1.0;
        this.audio.playWobbleClink(1.1 + b.index * 0.12);
      } else if (role === 'milk') {
        this.world.milkWobble = 1.0;
        this.audio.playWobbleClink(0.85);
      } else if (role === 'fruitDish') {
        const d = this.world.fruitDishes.find((x) => x.kind === topHit.userData.fruitKind);
        if (d) d.wobble = 1.0;
        this.audio.playWobbleClink(0.95);
      } else if (role === 'customer') {
        this.customer.triggerBellWave();
        this.audio.playWobbleClink(1.0);
      }
      this.activePointerId = null;
      return;
    }

    // 2. Syrup Bottle Picked Up!
    if (role === 'syrup') {
      this.gestureMode = 'syrup';
      this.activeSyrupIdx = topHit.userData.syrupIndex;
      this.machine.targetSwingAngle = -0.46;
      const b = this.world.syrupBottles[this.activeSyrupIdx];
      b.activePour = true;
      this._pourSyrupTowardMound(new THREE.Vector3(-0.08, 1.42, 1.54), true);
      return;
    }

    // 3. Condensed Milk Picked Up!
    if (role === 'milk') {
      this.gestureMode = 'milk';
      this.machine.targetSwingAngle = -0.46;
      this.world.milkActivePour = true;
      this._pourMilkTowardMound(new THREE.Vector3(-0.08, 1.45, 1.54), true);
      return;
    }

    // 4. Plump Fruit Picked Up from Ceramic Dish!
    if (role === 'fruitDish') {
      this.gestureMode = 'fruit';
      this.machine.targetSwingAngle = -0.46;
      const kind = topHit.userData.fruitKind;
      const dish = this.world.fruitDishes.find((x) => x.kind === kind);
      if (dish) dish.wobble = 0.55;

      this.draggingFruit = createFruitMesh(kind, this.textures, 1.08);
      const startWorld = new THREE.Vector3();
      topHit.getWorldPosition(startWorld);
      this.draggingFruit.position.copy(startWorld).add(new THREE.Vector3(0, 0.25, 0));
      this.scene.add(this.draggingFruit);
      this.hands.posePinchingFruit(this.draggingFruit.position);
      this.audio.playWobbleClink(1.25);
      return;
    }

    // 5. Tapping Customer / Serving Mat when Kakigori is Ready -> Smoothly Serve!
    if (role === 'customer') {
      if (this.bowl.isReadyToServe()) {
        this._startServingBowl();
      } else {
        this.customer.triggerBellWave();
        this.bowl.jiggleVel += 0.1;
        this.audio.playWobbleClink(0.9);
      }
      this.activePointerId = null;
      return;
    }

    // 6. Touching the Bowl / Snow Mound -> Slide up to hand over to customer!
    if (role === 'mound' || role === 'bowl') {
      this.gestureMode = 'bowlSlide';
      this.bowl.jiggleVel += 0.08;
      this.audio.playWobbleClink(0.78);
      return;
    }
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();

    this.idleSeconds = 0;
    this._updateNDC(e.clientX, e.clientY);

    const dx = this.pointerNDC.x - this.lastPointerPos.x;
    const dy = this.pointerNDC.y - this.lastPointerPos.y;

    if (this.gestureMode === 'wheel') {
      // Forgiving hybrid cranking: supports BOTH circular rotation around hub AND up/down/side rubbing!
      const hubWorld = new THREE.Vector3();
      this.machine.wheelGroup.getWorldPosition(hubWorld);
      const hubScreen = this._projectToScreen(hubWorld);
      const curAngle = Math.atan2(this.pointerNDC.y - hubScreen.y, this.pointerNDC.x - hubScreen.x);
      let dAngle = curAngle - this.lastWheelPointerAngle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      this.lastWheelPointerAngle = curAngle;

      const distFromHub = Math.hypot(this.pointerNDC.x - hubScreen.x, this.pointerNDC.y - hubScreen.y);
      const circularTurn = distFromHub > 0.04 ? Math.abs(dAngle) * 1.15 : 0;
      const linearTurn = Math.hypot(dx, dy) * 3.2;
      const turnAmount = Math.max(circularTurn, linearTurn);

      if (turnAmount > 0.002) {
        this._advanceCrank(turnAmount);
        this.wheelSpinVelocity = Math.min(16, turnAmount * 36);
      }
    } else if (this.gestureMode === 'syrup') {
      const hitPt = this._raycastMoundPoint();
      if (hitPt) {
        this._pourSyrupTowardMound(hitPt, false);
      }
    } else if (this.gestureMode === 'milk') {
      const hitPt = this._raycastMoundPoint();
      if (hitPt) {
        this._pourMilkTowardMound(hitPt, false);
      }
    } else if (this.gestureMode === 'fruit' && this.draggingFruit) {
      const moundHit = this._raycastMoundSurfaceOnly();
      if (moundHit) {
        // Magnetic snap onto fluffy snow mound!
        this.draggingFruit.position.copy(moundHit).add(new THREE.Vector3(0, 0.06, 0.03));
      } else {
        const planePt = new THREE.Vector3();
        this.raycaster.setFromCamera(this.pointerNDC, this.camera);
        this.raycaster.ray.intersectPlane(this.dragPlane, planePt);
        if (planePt) {
          planePt.y = Math.max(1.05, planePt.y);
          this.draggingFruit.position.copy(planePt);
        }
      }
      this.hands.posePinchingFruit(this.draggingFruit.position);
      this.customer.lookTarget.copy(this.draggingFruit.position);
    } else if (this.gestureMode === 'bowlSlide') {
      const totalDy = this.pointerNDC.y - this.pointerDownPos.y;
      if (this.bowl.isReadyToServe() && totalDy > 0.02) {
        const progress = THREE.MathUtils.clamp(totalDy / 0.22, 0, 1);
        const target = this.customer.getServingTargetWorldPos();
        this.bowl.group.position.lerpVectors(this.bowl.homePos, target, progress * 0.65);
        this.hands.poseServingBowl(this.bowl.group.position);
        this.customer.lookTarget.copy(this.bowl.group.position);
        if (progress >= 0.68) {
          this._startServingBowl();
          this.activePointerId = null;
          this.gestureMode = null;
          return;
        }
      }
    }

    this.lastPointerPos.copy(this.pointerNDC);
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) return;

    const dragDist = this.pointerNDC.distanceTo(this.pointerDownPos);

    if (this.gestureMode === 'syrup') {
      // Quick tap on bottle gives a generous colorful splash across top of mound!
      if (dragDist < 0.045) {
        const angle = this.bowl.syrupDropsCount * 1.7;
        const splashPt = new THREE.Vector3(
          this.bowl.homePos.x + Math.cos(angle) * 0.14,
          1.45,
          this.bowl.homePos.z + Math.sin(angle) * 0.14
        );
        this._pourSyrupTowardMound(splashPt, true, 0.44, 0.78);
      }
      this.world.syrupBottles[this.activeSyrupIdx].activePour = false;
    } else if (this.gestureMode === 'milk') {
      if (dragDist < 0.045) {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + this.bowl.milkDropsCount;
          const pt = new THREE.Vector3(
            this.bowl.homePos.x + Math.cos(a) * 0.12,
            1.38 + k * 0.04,
            this.bowl.homePos.z + Math.sin(a) * 0.12
          );
          this.bowl.applyCondensedMilkAtWorldPoint(pt);
        }
        this.audio.playMilkDrizzle();
      }
      this.world.milkActivePour = false;
    } else if (this.gestureMode === 'fruit' && this.draggingFruit) {
      this.scene.remove(this.draggingFruit);
      if (dragDist < 0.05) {
        // Quick tap on fruit dish places fruit nicely on snow mountain!
        this.bowl.placeFruitOnMound(this.draggingFruit, null);
      } else {
        const moundHit = this._raycastMoundSurfaceOnly();
        this.bowl.placeFruitOnMound(this.draggingFruit, moundHit || this.draggingFruit.position);
      }
      this.audio.playFruitLand(this.bowl.placedFruits.length);
      this.draggingFruit = null;
    } else if (this.gestureMode === 'bowlSlide') {
      // Return smoothly to coaster home if not slid all the way to customer
      this.bowl.group.position.copy(this.bowl.homePos);
    }

    this.hands.poseRest();
    this.activePointerId = null;
    this.gestureMode = null;
  }

  _advanceCrank(rad) {
    this.machine.crank(rad, this.bowl.iceProgress);
    const knobPos = this.machine.getKnobWorldPosition();
    this.hands.poseCranking(knobPos);
    this.customer.lookTarget.set(0, 1.45, 1.52);

    const overflowed = this.bowl.addShavedIce(rad * 0.092);
    const chutePos = this.machine.getChuteWorldPosition();
    const flakes = Math.min(6, Math.max(2, Math.ceil(rad * 10)));
    for (let i = 0; i < flakes; i++) {
      this.particles.spawnSnowFlake(chutePos);
    }

    this.audio.playShaveGrain(rad * 8.0, this.bowl.iceProgress);
    if (overflowed) {
      this.audio.playOverflowPuff();
    }
    if (this.world.pinwheel.group.visible) {
      this.world.pinwheel.spinVel = Math.max(this.world.pinwheel.spinVel, rad * 24);
    }
  }

  _raycastMoundSurfaceOnly() {
    if (!this.bowl.snowMesh.visible) return null;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObject(this.bowl.snowMesh, false);
    return hits.length > 0 ? hits[0].point : null;
  }

  _raycastMoundPoint() {
    const direct = this._raycastMoundSurfaceOnly();
    if (direct) return direct;

    // Forgiving fallback: intersect plane over the bowl and clamp near mound!
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, pt)) {
      pt.x = THREE.MathUtils.clamp(pt.x, -0.52, 0.52);
      pt.y = THREE.MathUtils.clamp(pt.y, 1.05, 1.85);
      pt.z = THREE.MathUtils.clamp(pt.z, 1.05, 1.95);
      return pt;
    }
    return null;
  }

  _pourSyrupTowardMound(worldTarget, forceDrop = false, radius = 0.42, strength = 0.72) {
    const b = this.world.syrupBottles[this.activeSyrupIdx];
    const hoverWorld = worldTarget.clone().add(new THREE.Vector3(-0.38, 0.42, 0.08));
    const localHover = this.world.syrupCaddy.worldToLocal(hoverWorld.clone());
    b.group.position.copy(localHover);
    // Tilt spout down-and-right (+X, -Y) directly over the snow peak!
    b.group.rotation.set(0.10, 0, -2.18);

    this.hands.poseHoldingBottle(hoverWorld, -1);
    this.customer.lookTarget.copy(worldTarget);

    const nozzleWorld = new THREE.Vector3();
    b.nozzleTip.getWorldPosition(nozzleWorld);
    for (let k = 0; k < 2; k++) {
      this.particles.spawnLiquidDrop(nozzleWorld, b.def.color);
    }

    if (forceDrop || this.pourClock <= 0) {
      this.pourClock = 0.045;
      const mixed = this.bowl.applySyrupAtWorldPoint(worldTarget, this.activeSyrupIdx, radius, strength);
      this.audio.playSyrupDrop(this.activeSyrupIdx, mixed);
    }
  }

  _pourMilkTowardMound(worldTarget, forceDrop = false) {
    const hoverWorld = worldTarget.clone().add(new THREE.Vector3(0.32, 0.58, 0.14));
    const localHover = this.world.toppingStation.worldToLocal(hoverWorld.clone());
    this.world.milkBottleGroup.position.copy(localHover);
    this.world.milkBottleGroup.rotation.set(0.15, 0, 2.02);

    this.hands.poseHoldingBottle(hoverWorld, 1);
    this.customer.lookTarget.copy(worldTarget);

    const nozzleWorld = new THREE.Vector3();
    this.world.milkNozzleTip.getWorldPosition(nozzleWorld);
    this.particles.spawnLiquidDrop(nozzleWorld, new THREE.Color(0xfff9e6));

    if (forceDrop || this.pourClock <= 0) {
      this.pourClock = 0.055;
      this.bowl.applyCondensedMilkAtWorldPoint(worldTarget);
      this.audio.playMilkDrizzle();
    }
  }

  _startServingBowl() {
    if (this.servingTransition) return;
    this.machine.targetSwingAngle = -0.50;
    this.bowl.spoonGroup.visible = true;
    this.audio.playBowlSlide();

    this.servingTransition = {
      timer: 0,
      duration: 0.44,
      from: this.bowl.group.position.clone(),
      to: this.customer.getServingTargetWorldPos(),
    };
  }

  _animate() {
    requestAnimationFrame(this._animate);

    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    const elapsed = this.clock.elapsedTime;

    // FPS monitor
    this._fpsFrames++;
    this._fpsAccum += rawDt;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    if (this.pourClock > 0) this.pourClock -= dt;

    // Gentle flywheel momentum when letting go of a fast crank spin!
    if (this.gestureMode !== 'wheel' && this.wheelSpinVelocity > 0.05) {
      const step = this.wheelSpinVelocity * dt * 0.55;
      this.wheelSpinVelocity *= Math.pow(0.04, dt);
      this.machine.crank(step, this.bowl.iceProgress);
      this.bowl.addShavedIce(step * 0.065);
      if (Math.random() < 0.5) {
        this.particles.spawnSnowFlake(this.machine.getChuteWorldPosition());
      }
    }

    // Update customer beckoning state
    this.customer.setBeckoning(this.bowl.isReadyToServe() && !this.servingTransition);

    // Serving bowl slide across cedar counter into customer's waiting hands!
    if (this.servingTransition) {
      const st = this.servingTransition;
      st.timer += dt;
      const t = Math.min(1, st.timer / st.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.bowl.group.position.lerpVectors(st.from, st.to, ease);
      this.world.bowlAO.position.set(this.bowl.group.position.x, 0.763, this.bowl.group.position.z);

      if (t < 0.78) {
        this.hands.poseServingBowl(this.bowl.group.position);
      } else {
        this.hands.poseRest();
      }

      if (t >= 1) {
        this.servingTransition = null;
        const recipe = this.bowl.getRecipeProfile();
        this.customer.beginEating(recipe, this.bowl, this.audio, this.particles, (reactionKind) => {
          this.servedBowlsCount++;
          this.world.unlockKeepsakeForServeCount(
            this.servedBowlsCount,
            reactionKind === 'rainbow'
          );
          this.bowl.resetForNextCustomer();
          this.world.bowlAO.position.set(this.bowl.homePos.x, 0.763, this.bowl.homePos.z);
          this.machine.resetIceBlock();
          this.hasDemonstratedThisBowl = false;
          this.idleSeconds = 0;
        });
      }
    }

    // Idle guidance strictly per preference:
    // 0-6s: zero hint. 6-10s: subtle environmental handle rock.
    // At 10s of complete inactivity (ONCE per bowl): 3D miniature hand demonstrates 1 gentle turn!
    let attractBounce = 0;
    if (!this.activePointerId && !this.servingTransition && this.customer.state === 'waiting' && this.bowl.iceProgress < 0.25) {
      this.idleSeconds += dt;
      if (this.idleSeconds > 6.5 && this.idleSeconds < 10.0) {
        attractBounce = Math.min(1, (this.idleSeconds - 6.5) / 2.0);
      }
      if (this.idleSeconds >= 10.0 && !this.hasDemonstratedThisBowl) {
        this.hasDemonstratedThisBowl = true;
        this.demoAnimTimer = 1.05;
      }
    }

    if (this.demoAnimTimer > 0) {
      this.demoAnimTimer -= dt;
      if (this.demoAnimTimer > 0.25) {
        this.machine.crank(dt * 2.2, this.bowl.iceProgress);
        this.bowl.addShavedIce(dt * 0.14);
        this.hands.poseCranking(this.machine.getKnobWorldPosition());
        if (Math.random() < 0.35) {
          this.particles.spawnSnowFlake(this.machine.getChuteWorldPosition());
        }
      } else {
        this.hands.poseRest();
      }
    }

    // Cozy camera macro dolly during customer eating & celebration!
    const wantZoom =
      this.customer.state === 'eating' || this.customer.state === 'reacting' ? 1.0 : 0.0;
    this.camFocusZoom += (wantZoom - this.camFocusZoom) * Math.min(1, dt * 3.8);

    const breatheX = Math.sin(elapsed * 0.55) * 0.025;
    const breatheY = Math.cos(elapsed * 0.42) * 0.018;
    const targetCamPos = this.camBasePos.clone().lerp(
      new THREE.Vector3(0.32, 2.52, 3.82),
      this.camFocusZoom * 0.68
    );
    this.camera.position.set(targetCamPos.x + breatheX, targetCamPos.y + breatheY, targetCamPos.z);

    const lookAtPt = this.camLookTarget.clone().lerp(
      new THREE.Vector3(0.45, 1.72, 0.22),
      this.camFocusZoom * 0.72
    );
    this.camera.lookAt(lookAtPt);

    // Update all subsystems
    this.machine.update(dt, elapsed, attractBounce);
    this.bowl.update(dt);
    this.customer.update(dt, elapsed);
    this.hands.update(dt);
    this.world.update(dt, elapsed);
    this.particles.update(dt);

    // Render through Tilt-Shift Macro Miniature Lens Pipeline!
    this.postfx.render(this.scene, this.camera, elapsed);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new KakigoriMiniatureGame();
});
